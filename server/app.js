require('dotenv').config();
const express = require('express');
const fs = require('fs');
const readline = require('readline');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');    
const cors = require('cors');
const morgan = require('morgan');

// Configurations


const app = express();
app.use(morgan("[:date[clf]] :method :url :status :res[content-length] - :response-time ms"));
app.use(cors({ origin: '*' }));
app.use(express.json());

// Initialize Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const textEmbeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

// Initialize Pinecone
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// Helper Function: Split Text into Semantic Chunks
function splitIntoChunks(text, chunkSize = 500, overlap = 50) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]; // Split by sentence boundaries
    const chunks = [];
    let currentChunk = [];

    for (const sentence of sentences) {
        if (currentChunk.join(' ').length + sentence.length <= chunkSize) {
            currentChunk.push(sentence);
        } else {
            chunks.push(currentChunk.join(' '));
            currentChunk = [sentence];
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }

    return chunks;
}

// Helper Function: Store Embeddings in Pinecone
async function storeTextChunksInPinecone(text) {
    const index = pinecone.Index(process.env.indexName);
    const chunks = splitIntoChunks(text);
    const upserts = [];

    for (const [i, chunk] of chunks.entries()) {
        const embeddingResponse = await textEmbeddingModel.embedContent(chunk);
        const embedding = embeddingResponse.embedding.values;

        upserts.push({
            id: `chunk-${i}`,
            values: embedding,
            metadata: {
                text: chunk,
                chunkIndex: i,
                totalChunks: chunks.length,
                keyPhrases: extractKeyPhrases(chunk),
            },
        });
    }

    await index.upsert(upserts);
    console.log(`${chunks.length} chunks stored successfully in Pinecone.`);
}

// Helper Function: Key Phrase Extraction
function extractKeyPhrases(text) {
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    return words
        .filter(word => word.length > 3 && !stopWords.has(word))
        .slice(0, 10); // Keep top 10 key phrases
}

// Helper Function: Clean markdown from text
function cleanMarkdownOutput(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')       // Remove bold markers
    .replace(/\*(.*?)\*/g, '$1')           // Remove italic markers
    .replace(/```[\s\S]*?```/g, (match) => // Clean code blocks
      match.replace(/```(.*?)\n/g, '').replace(/```$/g, '')
    )
    .replace(/^#+ (.*?)$/gm, '$1')         // Remove heading markers
    .replace(/`(.*?)`/g, '$1')             // Remove inline code markers
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')  // Replace links with just text
    .replace(/^\> (.*?)$/gm, '$1')         // Remove blockquote markers
    .replace(/\n\n+/g, '\n\n');            // Normalize spacing
}

// Helper Function: Retrieve Relevant Chunks from Pinecone
async function retrieveRelevantChunks(question) {
    const questionEmbedding = await textEmbeddingModel.embedContent(question);
    const index = pinecone.Index(process.env.indexName);

    const queryResponse = await index.query({
        vector: questionEmbedding.embedding.values,
        topK: 5, // Retrieve top 5 relevant chunks
        includeMetadata: true,
    });

    return queryResponse.matches;
}

// Helper Function: Generate Answer from Relevant Chunks
async function generateAnswer(question, relevantChunks) {
    try {
        const sortedChunks = relevantChunks
            .sort((a, b) => b.score - a.score)
            .map(chunk => chunk.metadata.text)
            .join('\n\n');

        const prompt = `
        Question: ${question}
        Context: ${sortedChunks}
        Instructions: You are Bhavya. IMPORTANT: Do NOT use any markdown formatting in your response.
        - NO asterisks (**)
        - NO backticks (\`\`\`)
        - NO hashtags for headings (#)
        - NO bullet points with dashes or asterisks
        - Provide plain text only

        Provide a concise, accurate answer based on the above context. If the context lacks relevant details, reply with "No relevant information found."
        You may include emoji characters but don't include markdown formatting syntax.`;

        const primaryModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const primaryResponse = await primaryModel.generateContent(prompt);
        const text = primaryResponse.response.text().toLowerCase();

        if (text.includes('no relevant information found')) {
            const backupModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
            const backupResponse = await backupModel.generateContent(prompt);
            return backupResponse.response.text();
        }

        return primaryResponse.response.text();
    } catch (error) {
        console.error('Error generating answer:', error);
        return 'An error occurred while generating the answer.';
    }
}

// Initialization: Load Text and Store Embeddings
async function initializeLangChain() {
    const filePath = 'bhavya.txt';

    if (!fs.existsSync(filePath)) {
        console.error('Text file not found.');
        return;
    }

    const text = fs.readFileSync(filePath, 'utf-8');
    await storeTextChunksInPinecone(text);
}

// API Routes
app.post('/ask', async (req, res) => {
    try {
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        const relevantChunks = await retrieveRelevantChunks(question);
        if (relevantChunks.length === 0) {
            return res.json({ answer: 'No relevant information found.' });
        }

        const answer = await generateAnswer(question, relevantChunks);
        res.json({ answer });
    } catch (error) {
        console.error('Error handling question:', error);
        res.status(500).json({ error: 'Failed to process question' });
    }
});

app.get('/', (req, res) => {
    res.json('🫡');
});

// Server Initialization
const PORT = process.env.PORT || 3003;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeLangChain();
});
