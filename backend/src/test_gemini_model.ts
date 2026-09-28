import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

async function testGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log(`🔑 Testing Gemini API Key (starts with: ${apiKey ? apiKey.substring(0, 8) + '...' : 'NONE'})`);

  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY is not configured in backend/.env');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const candidateModels = [
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-flash',
    'gemini-pro'
  ];

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const res = await model.generateContent('Hello! Test connection.');
      console.log(`✅ Model '${modelName}' works! Response: ${res.response.text().substring(0, 50).trim()}...`);
      return modelName;
    } catch (err: any) {
      console.log(`❌ Model '${modelName}' failed: ${err.message}`);
    }
  }
}

testGeminiModels();
