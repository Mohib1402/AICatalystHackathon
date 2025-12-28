import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

export const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.5-flash', // Stable production model with 1M context, thinking, grounding
  generationConfig: {
    temperature: 0.7,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
  },
});

export async function generateResponse(prompt: string, conversationHistory: Array<{role: string, content: string}> = []) {
  try {
    const chat = model.startChat({
      history: conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })),
    });

    const result = await chat.sendMessage(prompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}
