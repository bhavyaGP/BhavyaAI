const natural = require('natural');
const tokenizer = new natural.SentenceTokenizer();
const TfIdf = natural.TfIdf;

// Improved chunk splitting with smart boundaries
function splitIntoSmartChunks(text, targetChunkSize = 500, minChunkSize = 200) {
    // First split into paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;

    for (const paragraph of paragraphs) {
        // Split paragraph into sentences
        const sentences = tokenizer.tokenize(paragraph);
        
        for (const sentence of sentences) {
            const sentenceLength = sentence.length;
            
            if (currentLength + sentenceLength > targetChunkSize && currentLength >= minChunkSize) {
                // Store current chunk and start a new one
                chunks.push({
                    text: currentChunk.join(' '),
                    paragraphContext: paragraph.substring(0, 200) + '...' // Store paragraph context
                });
                currentChunk = [];
                currentLength = 0;
            }
            
            currentChunk.push(sentence);
            currentLength += sentenceLength;
        }
        
        // Add paragraph boundary marker if chunk isn't complete
        if (currentChunk.length > 0) {
            currentChunk.push('[PARA_END]');
        }
    }
    
    // Handle any remaining text
    if (currentChunk.length > 0) {
        chunks.push({
            text: currentChunk.join(' ').replace('[PARA_END]', ''),
            paragraphContext: currentChunk.join(' ').substring(0, 200) + '...'
        });
    }
    
    return chunks;
}

// Enhanced key phrase extraction using TF-IDF
function extractEnhancedKeyPhrases(text, allTexts) {
    const tfidf = new TfIdf();
    
    // Add all texts to establish corpus
    allTexts.forEach(t => tfidf.addDocument(t));
    tfidf.addDocument(text);
    
    // Get important terms using TF-IDF
    const terms = [];
    tfidf.listTerms(tfidf.documents.length - 1).forEach(item => {
        if (item.term.length > 3 && !stopWords.has(item.term)) {
            terms.push({
                term: item.term,
                score: item.tfidf
            });
        }
    });
    
    // Extract noun phrases using natural's NGrams
    const NGrams = natural.NGrams;
    const nounPhrases = NGrams.ngrams(text.split(' '), 2)
        .map(ngram => ngram.join(' '))
        .filter(phrase => {
            // Basic noun phrase filtering rules
            const words = phrase.split(' ');
            return !words.some(word => stopWords.has(word.toLowerCase()));
        });
    
    return {
        keyTerms: terms.slice(0, 10),
        nounPhrases: nounPhrases.slice(0, 5)
    };
}

// Calculate semantic similarity score between chunks
async function calculateSemanticSimilarity(chunk1, chunk2, model) {
    const embedding1 = await model.embedContent(chunk1);
    const embedding2 = await model.embedContent(chunk2);
    
    return cosineSimilarity(embedding1.embedding.values, embedding2.embedding.values);
}

function cosineSimilarity(vector1, vector2) {
    const dotProduct = vector1.reduce((acc, val, i) => acc + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((acc, val) => acc + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (magnitude1 * magnitude2);
}

async function storeTextChunksInPinecone(text, model, pineconeIndex) {
    const chunks = splitIntoSmartChunks(text);
    const allTexts = chunks.map(chunk => chunk.text);
    const upserts = [];
    
    // Process chunks in batches to avoid rate limiting
    const BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchChunks = chunks.slice(i, i + BATCH_SIZE);
        const batchPromises = batchChunks.map(async (chunk, batchIndex) => {
            const chunkIndex = i + batchIndex;
            const embeddingResponse = await model.embedContent(chunk.text);
            const embedding = embeddingResponse.embedding.values;
            
            // Calculate similarity with neighboring chunks
            const similarities = {};
            if (chunkIndex > 0) {
                similarities.prev = await calculateSemanticSimilarity(
                    chunk.text,
                    chunks[chunkIndex - 1].text,
                    model
                );
            }
            if (chunkIndex < chunks.length - 1) {
                similarities.next = await calculateSemanticSimilarity(
                    chunk.text,
                    chunks[chunkIndex + 1].text,
                    model
                );
            }
            
            // Extract enhanced metadata
            const keyPhrases = extractEnhancedKeyPhrases(chunk.text, allTexts);
            
            return {
                id: `chunk-${chunkIndex}`,
                values: embedding,
                metadata: {
                    text: chunk.text,
                    paragraphContext: chunk.paragraphContext,
                    chunkIndex,
                    totalChunks: chunks.length,
                    keyPhrases: keyPhrases.keyTerms,
                    nounPhrases: keyPhrases.nounPhrases,
                    similarities,
                    chunkLength: chunk.text.length,
                    position: {
                        isFirst: chunkIndex === 0,
                        isLast: chunkIndex === chunks.length - 1,
                        section: Math.floor(chunkIndex / (chunks.length / 3)) // rough section position (beginning, middle, end)
                    }
                }
            };
        });
        
        const batchResults = await Promise.all(batchPromises);
        upserts.push(...batchResults);
        
        // Add small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < chunks.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    await pineconeIndex.upsert(upserts);
    console.log(`${chunks.length} chunks stored successfully in Pinecone with enhanced metadata.`);
    
    return chunks.length;
}

// Enhanced answer generation using better context
async function generateAnswer(question, relevantChunks, model) {
    // Sort chunks by similarity score
    const sortedChunks = relevantChunks.sort((a, b) => b.score - a.score);
    
    // Build enhanced context with positional awareness
    const context = sortedChunks.map(chunk => {
        const position = chunk.metadata.position;
        let contextPrefix = '';
        if (position.isFirst) {
            contextPrefix = '[START OF DOCUMENT] ';
        } else if (position.isLast) {
            contextPrefix = '[END OF DOCUMENT] ';
        }
        return `${contextPrefix}${chunk.metadata.paragraphContext}`;
    }).join('\n\n');
    
    const prompt = `
    Question: ${question}
    
    Relevant Context (in order of relevance):
    ${context}
    
    Based on the above context, please provide a comprehensive and accurate answer.
    If the context doesn't contain enough information to fully answer the question,
    please indicate what specific aspects cannot be addressed from the given context.
    
    Answer:`;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
}

module.exports = {
    splitIntoSmartChunks,
    storeTextChunksInPinecone,
    generateAnswer
};