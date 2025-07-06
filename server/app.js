
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(morgan("[:date[clf]] :method :url :status :res[content-length] - :response-time ms"));
app.use(cors({ origin: '*' }));
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const textEmbeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const userMemory = new Map();

function splitIntoChunks(text, chunkSize = 500, overlap = 50) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
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

function extractKeyPhrases(text) {
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    return words.filter(word => word.length > 3 && !stopWords.has(word)).slice(0, 10);
}

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

async function retrieveRelevantChunks(question) {
    const questionEmbedding = await textEmbeddingModel.embedContent(question);
    const index = pinecone.Index(process.env.indexName);
    const queryResponse = await index.query({
        vector: questionEmbedding.embedding.values,
        topK: 5,
        includeMetadata: true,
    });
    return queryResponse.matches;
}

async function generateAnswer(prompt) {
    const primaryModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const primaryResponse = await primaryModel.generateContent(prompt);
    const text = primaryResponse.response.text().toLowerCase();
    if (text.includes('no relevant information found')) {
        const backupModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const backupResponse = await backupModel.generateContent(prompt);
        return backupResponse.response.text();
    }
    return primaryResponse.response.text();
}

async function initializeLangChain() {
    const filePath = 'bhavya.txt';
    if (!fs.existsSync(filePath)) {
        console.error('Text file not found.');
        return;
    }
    const text = fs.readFileSync(filePath, 'utf-8');
    await storeTextChunksInPinecone(text);
}

app.post('/ask', async (req, res) => {
    try {
        const { question, userId } = req.body;
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }
        console.log('Received question:', question);
        // Use a default userId if not provided for backward compatibility
        const effectiveUserId = userId || 'default_user';

        // Handle special commands
        if (question.startsWith('@reset')) {
            userMemory.set(effectiveUserId, []);
            return res.json({ answer: 'Memory has been reset. You can start a fresh conversation now.' });
        }

        if (question.startsWith('@summarize')) {
            const history = userMemory.get(effectiveUserId) || [];
            if (history.length === 0) {
                return res.json({ answer: 'No conversation history to summarize.' });
            }

            const conversationText = history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.message}`).join('\n');
            const summaryPrompt = `
Please provide a concise summary of this conversation:
${conversationText}

Instructions: You are Bhavya. Provide a clear, bullet-pointed summary of the key topics discussed and main points covered and Bhavya Like to reply with emoji(especially 🫡🫡). Do NOT use markdown formatting.
            `;
            const summary = await generateAnswer(summaryPrompt);
            return res.json({ answer: summary });
        }

        if (question.startsWith('@explain')) {
            console.log('Received explain command:', question);
            const topic = question.replace('@explain', '').trim();
            if (!topic) {
                return res.json({ answer: 'Please specify what you would like me to explain. Usage: @explain [topic]\n\nExample: @explain machine learning\nExample: @explain how photosynthesis works' });
            }

            // First try to get relevant chunks from your knowledge base
            const relevantChunks = await retrieveRelevantChunks(topic);
            const context = relevantChunks.map(c => c.metadata.text).join("\n\n");

            let explanation;

            if (context && context.trim().length > 0) {
                // Use context from knowledge base if available
                const explainPrompt = `
                    Topic to explain: ${topic}
                    Context from knowledge base: ${context}
                    Instructions: You are Bhavya, an AI assistant. Provide a detailed, educational explanation of "${topic}". Use the context provided along with your general knowledge to give a comprehensive explanation. Break it down into simple terms and include relevant examples. Do NOT use markdown formatting. Provide plain text only.
                `;
                explanation = await generateAnswer(explainPrompt);
                console.log('Generated explanation:', explanation);
                // Check if LLM returned no relevant information and fallback
                if (isNoRelevantInfoResponse(explanation)) {
                    const fallbackPrompt = `
                        You are Bhavya, a knowledgeable AI assistant. Please provide a detailed, educational explanation of "${topic}".

                        Instructions:
                        - Break down the concept into simple, easy-to-understand terms                       

                        Topic to explain: ${topic}
                    `;
                    explanation = await generateAnswer(fallbackPrompt);
                }
            } else {
                // Fallback to general knowledge if no relevant context found
                const generalExplainPrompt = `
                        You are Bhavya, a knowledgeable AI assistant. Please provide a detailed, educational explanation of "${topic}".

                        Instructions:
                        - Break down the concept into simple, easy-to-understand terms

                        Topic to explain: ${topic}
                `;
                explanation = await generateAnswer(generalExplainPrompt);
            }

            return res.json({ answer: explanation });
        }

        const relevantChunks = await retrieveRelevantChunks(question);
        let history = userMemory.get(effectiveUserId) || [];
        history.push({ role: 'user', message: question });

        const previousContext = history.slice(-4).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.message}`).join('\n');
        const context = relevantChunks.map(c => c.metadata.text).join("\n\n");

        let answer;

        if (context && context.trim().length > 0) {
            // Use knowledge base context if available
            const prompt = `
                        Past Interaction:\n${previousContext}

                        Current Question: ${question}
                        Context from knowledge base: ${context}
                        Instructions: You are Bhavya. Answer the question using the provided context and conversation history and Bhavya Like to reply with emoji(especially 🫡🫡). Do NOT use any markdown formatting. Provide plain text only.
            `;
            answer = await generateAnswer(prompt);

            // Check if LLM returned no relevant information and fallback
            if (isNoRelevantInfoResponse(answer)) {
                const fallbackPrompt = `
                        Past Interaction:\n${previousContext}

                        Current Question: ${question}
                        Instructions: You are Bhavya. Answer the question using the provided context and conversation history and Bhavya Like to reply with emoji(especially 🫡🫡). Do NOT use any markdown formatting. Provide plain text only.
                `;
                answer = await generateAnswer(fallbackPrompt);
            }
        } else {
            // Fallback to general knowledge when no relevant context found
            const generalPrompt = `
                        Past Interaction:\n${previousContext}
                                
                        Current Question: ${question}
                        Instructions: You are Bhavya, a helpful AI assistant. The user is asking about something that's not in my specific knowledge base, so please provide a helpful answer using your general knowledge. Be conversational and helpful and Bhavya Like to reply with emoji(especially 🫡🫡). Do NOT use any markdown formatting. Provide plain text only.
            `;
            answer = await generateAnswer(generalPrompt);
        }

        history.push({ role: 'assistant', message: answer });
        userMemory.set(effectiveUserId, history);

        res.json({ answer });
    } catch (error) {
        console.error('Error handling question:', error);
        res.status(500).json({ error: 'Failed to process question' });
    }
});

// Helper function to detect if LLM returned no relevant information
function isNoRelevantInfoResponse(response) {
    if (!response || typeof response !== 'string') {
        return false;
    }

    const noInfoPhrases = [
        'no relevant information found',
        'no relevant information',
        'i don\'t have information',
        'i don\'t have relevant information',
        'no information available',
        'not enough information',
        'insufficient information',
        'i cannot find information',
        'no data available',
        'information not available',
        'unable to find information',
        'no specific information',
        'i don\'t know',
        'i am not sure',
        'i cannot answer',
        'i don\'t have enough information',
        'sorry, i don\'t have information'
    ];

    const lowerResponse = response.toLowerCase().trim();

    // Check if response contains any of the no-info phrases
    return noInfoPhrases.some(phrase => lowerResponse.includes(phrase)) ||
        // Check if response is very short (less than 20 characters) and seems unhelpful
        (lowerResponse.length < 20 && (
            lowerResponse.includes('sorry') ||
            lowerResponse.includes('don\'t know') ||
            lowerResponse.includes('no') ||
            lowerResponse.includes('not available')
        ));
}

app.get('/', (req, res) => {
    res.json('🫡');
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeLangChain();
});
