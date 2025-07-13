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
    let currentLength = 0;
    for (const sentence of sentences) {
        const sentenceLength = sentence.length;
        if (currentLength + sentenceLength <= chunkSize) {
            currentChunk.push(sentence);
            currentLength += sentenceLength;
        } else {
            if (currentChunk.length) {
                chunks.push(currentChunk.join(' '));
            }
            // Overlap logic
            if (overlap > 0 && currentChunk.length) {
                let overlapChunk = [];
                let overlapLen = 0;
                for (let i = currentChunk.length - 1; i >= 0 && overlapLen < overlap; i--) {
                    overlapChunk.unshift(currentChunk[i]);
                    overlapLen += currentChunk[i].length;
                }
                currentChunk = [...overlapChunk, sentence];
                currentLength = currentChunk.reduce((sum, s) => sum + s.length, 0);
            } else {
                currentChunk = [sentence];
                currentLength = sentenceLength;
            }
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
    const keyPhrases = [];
    for (const word of words) {
        if (word.length > 3 && !stopWords.has(word) && !keyPhrases.includes(word)) {
            keyPhrases.push(word);
            if (keyPhrases.length === 10) break;
        }
    }
    return keyPhrases;
}

async function storeTextChunksInPinecone(text) {
    const index = pinecone.Index(process.env.indexName);
    const chunks = splitIntoChunks(text);
    const upserts = await Promise.all(chunks.map(async (chunk, i) => {
        const embeddingResponse = await textEmbeddingModel.embedContent(chunk);
        return {
            id: `chunk-${i}`,
            values: embeddingResponse.embedding.values,
            metadata: {
                text: chunk,
                chunkIndex: i,
                totalChunks: chunks.length,
                keyPhrases: extractKeyPhrases(chunk),
            },
        };
    }));
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const response = await model.generateContent(prompt);
    const text = response.response.text();
    if (isNoRelevantInfoResponse(text)) {
        const backupResponse = await model.generateContent(prompt);
        return backupResponse.response.text();
    }
    return text;
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

function buildConversationText(history) {
    return history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.message}`).join('\n');
}

function buildContextFromChunks(chunks) {
    return chunks.map(c => c.metadata.text).join("\n\n");
}

function buildPrompt({ previousContext, question, context, instructions }) {
    return `Past Interaction:\n${previousContext}

Current Question: ${question}
${context ? `Context from knowledge base: ${context}` : ''}
Instructions: ${instructions}`;
}

app.post('/ask', async (req, res) => {
    try {
        const { question, userId } = req.body;
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }
        const effectiveUserId = userId || 'default_user';

        if (question.startsWith('@reset')) {
            userMemory.set(effectiveUserId, []);
            return res.json({ answer: 'Memory has been reset. You can start a fresh conversation now.' });
        }

        if (question.startsWith('@summarize')) {
            const history = userMemory.get(effectiveUserId) || [];
            if (history.length === 0) {
                return res.json({ answer: 'No conversation history to summarize.' });
            }
            const conversationText = buildConversationText(history);
            const summaryPrompt = `Please provide a concise summary of this conversation:
${conversationText}

Instructions: You are Bhavya. Provide a clear, bullet-pointed summary of the key topics discussed and main points covered and Bhavya Like to reply with emoji(especially 🫡🫡). Do NOT use markdown formatting.`;
            const summary = await generateAnswer(summaryPrompt);
            return res.json({ answer: summary });
        }

        if (question.startsWith('@explain')) {
            const topic = question.replace('@explain', '').trim();
            if (!topic) {
                return res.json({ answer: 'Please specify what you would like me to explain. Usage: @explain [topic]\n\nExample: @explain machine learning\nExample: @explain how photosynthesis works' });
            }
            const relevantChunks = await retrieveRelevantChunks(topic);
            const context = buildContextFromChunks(relevantChunks);
            let explanation;
            if (context && context.trim().length > 0) {
                const explainPrompt = `Topic to explain: ${topic}
Context from knowledge base: ${context}
Instructions: You are Bhavya, an AI assistant. Provide a detailed, educational explanation of "${topic}". Use the context provided along with your general knowledge to give a comprehensive explanation. Break it down into simple terms and include relevant examples. Do NOT use markdown formatting. Provide plain text only.`;
                explanation = await generateAnswer(explainPrompt);
                if (isNoRelevantInfoResponse(explanation)) {
                    const fallbackPrompt = `You are Bhavya, a knowledgeable AI assistant. Please provide a detailed, educational explanation of "${topic}".

Instructions:
- Break down the concept into simple, easy-to-understand terms                       

Topic to explain: ${topic}`;
                    explanation = await generateAnswer(fallbackPrompt);
                }
            } else {
                const generalExplainPrompt = `You are Bhavya, a knowledgeable AI assistant. Please provide a detailed, educational explanation of "${topic}".

Instructions:
- Break down the concept into simple, easy-to-understand terms

Topic to explain: ${topic}`;
                explanation = await generateAnswer(generalExplainPrompt);
            }
            return res.json({ answer: explanation });
        }

        const relevantChunks = await retrieveRelevantChunks(question);
        let history = userMemory.get(effectiveUserId) || [];
        history.push({ role: 'user', message: question });

        const previousContext = buildConversationText(history.slice(-4));
        const context = buildContextFromChunks(relevantChunks);

        let answer;
        const instructionsWithEmoji = "You are Bhavya. Answer the question using the provided context and conversation history and Bhavya Like to reply with emoji(especially 🫡🫡). Do NOT use any markdown formatting. Provide plain text only.";
        const generalInstructions = "You are Bhavya, a helpful AI assistant. The user is asking about something that's not in my specific knowledge base, so please provide a helpful answer using your general knowledge. Be conversational and helpful and Bhavya Like to reply with emoji(especially 🫡🫡). Do NOT use any markdown formatting. Provide plain text only.";

        if (context && context.trim().length > 0) {
            const prompt = buildPrompt({ previousContext, question, context, instructions: instructionsWithEmoji });
            answer = await generateAnswer(prompt);
            if (isNoRelevantInfoResponse(answer)) {
                const fallbackPrompt = buildPrompt({ previousContext, question, context: '', instructions: instructionsWithEmoji });
                answer = await generateAnswer(fallbackPrompt);
            }
        } else {
            const generalPrompt = buildPrompt({ previousContext, question, context: '', instructions: generalInstructions });
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

function isNoRelevantInfoResponse(response) {
    if (!response || typeof response !== 'string') return false;
    const noInfoPhrases = [
        'no relevant information found',
        'no relevant information',
        "i don't have information",
        "i don't have relevant information",
        'no information available',
        'not enough information',
        'insufficient information',
        'i cannot find information',
        'no data available',
        'information not available',
        'unable to find information',
        'no specific information',
        "i don't know",
        'i am not sure',
        'i cannot answer',
        "i don't have enough information",
        "sorry, i don't have information"
    ];
    const lowerResponse = response.toLowerCase().trim();
    return noInfoPhrases.some(phrase => lowerResponse.includes(phrase)) ||
        (lowerResponse.length < 20 && (
            lowerResponse.includes('sorry') ||
            lowerResponse.includes("don't know") ||
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