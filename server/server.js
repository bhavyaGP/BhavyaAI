require('dotenv').config();
const express = require('express');
const fs = require('fs');
const readline = require('readline');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const cors = require('cors');
const corsOptions = {
    origin: process.env.FRONTEND_URL,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};
const app = express();
app.use(cors(corsOptions))
app.use(express.json());

// Initialize GoogleGenerativeAI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

// Initialize Pinecone
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});

// Check if text has been already processed
async function isTextAlreadyProcessed() {
    const index = pinecone.Index('chatbot');
    const queryResponse = await index.query({
        vector: new Array(768).fill(0),
        topK: 1,
    });
    return queryResponse.matches.length > 0;
}

async function initializeLangChain() {
    try {
        // Check if data already exists
        const alreadyProcessed = await isTextAlreadyProcessed();
        if (alreadyProcessed) {
            console.log('Text has already been processed and stored. Skipping initialization.');
            return;
        }

        const fileStream = fs.createReadStream('bhavya.txt');
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity,
        });

        let text = '';
        for await (const line of rl) {
            text += line + '\n';
        }

        // Split text into chunks and store embeddings for each chunk
        await storeTextChunksInPinecone(text);
    } catch (error) {
        console.error('Error in initializeLangChain:', error);
        throw error;
    }
}
function splitIntoChunks(text, chunkSize = 500, overlap = 50) {
    const words = text.split(' ');
    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;

    for (const word of words) {
        currentChunk.push(word);
        currentLength += word.length + 1; // +1 for space

        if (currentLength >= chunkSize) {
            chunks.push(currentChunk.join(' '));
            // Keep last few words for overlap
            const overlapWords = currentChunk.slice(-Math.floor(overlap / 10));
            currentChunk = [...overlapWords];
            currentLength = overlapWords.join(' ').length;
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }

    return chunks;
}

async function storeTextChunksInPinecone(text) {
    const index = pinecone.Index(process.env.indexName);
    const chunks = splitIntoChunks(text);

    const upserts = [];

    for (const [i, chunk] of chunks.entries()) {
        const embeddingResponse = await model.embedContent(chunk);
        const embedding = embeddingResponse.embedding.values;

        const id = `chunk-${i}`;
        upserts.push({
            id,
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

function extractKeyPhrases(text) {
    // Simple key phrase extraction
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    return words
        .filter(word => word.length > 3 && !stopWords.has(word))
        .slice(0, 10); // Keep top 10 key phrases
}

async function generateAnswer(question, relevantChunks) {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const context = relevantChunks.map(chunk => chunk.metadata.text).join('\n\n');
    const prompt = `
    Question: ${question}
    Context: ${context}

    Please provide a concise and relevant answer based on the context above. If the context doesn't contain relevant information, please indicate that.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
}

// Routes
app.post('/ask', async (req, res) => {
    try {
        const { question } = req.body;
        console.log('Received question:', question);

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        // Create embedding for the question
        const questionEmbedding = await model.embedContent(question);

        const index = pinecone.Index(process.env.indexName);
        const queryResponse = await index.query({
            vector: questionEmbedding.embedding.values,
            topK: 3,
            includeMetadata: true,
        });

        if (queryResponse.matches.length === 0) {
            return res.json({ answer: 'No relevant information found.' });
        }

        // Generate a coherent answer using the relevant chunks
        const answer = await generateAnswer(question, queryResponse.matches);
        res.json({ answer });
    } catch (error) {
        console.error('Error processing question:', error);
        res.status(500).json({ error: 'Failed to process question' });
    }
});

// Server initialization
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await initializeLangChain();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
}

startServer();
