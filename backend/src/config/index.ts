import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const cwd = process.cwd();
const possibleEnvPaths = [
  path.join(cwd, 'backend', '.env'),
  path.join(cwd, '.env'),
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  dbPath: process.env.DATABASE_PATH || './college_rag.db',
  jwtSecret: process.env.JWT_SECRET || 'college_rag_super_secret_jwt_key_2026',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  similarityThreshold: parseFloat(process.env.VECTOR_SIMILARITY_THRESHOLD || '0.35'),
  maxSearchResults: parseInt(process.env.MAX_SEARCH_RESULTS || '5', 10),
  uploadDir: path.join(process.cwd(), 'uploads'),
  postgresUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
};
