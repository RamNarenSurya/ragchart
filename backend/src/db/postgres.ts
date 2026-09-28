import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

export let pgPool: pg.Pool | null = null;
export let isPostgresActive = false;

export async function initPostgres(): Promise<boolean> {
  if (!config.postgresUrl) {
    return false;
  }

  try {
    const poolConfig: pg.PoolConfig = {
      connectionString: config.postgresUrl,
      connectionTimeoutMillis: 5000,
    };

    if (
      config.postgresUrl.includes('sslmode=require') ||
      config.postgresUrl.includes('.neon.tech') ||
      config.postgresUrl.includes('.supabase.co')
    ) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    pgPool = new Pool(poolConfig);
    const client = await pgPool.connect();

    try {
      // Attempt to enable pgvector extension if available
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;').catch(() => {
        // Vector extension might require superuser or not be available, fall back to TEXT embedding serialization
      });

      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          "passwordHash" TEXT NOT NULL,
          role VARCHAR(50) NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create documents table
      await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR(255) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          filename VARCHAR(255) NOT NULL,
          "fileType" VARCHAR(100) NOT NULL,
          "fileSize" INTEGER NOT NULL,
          "storagePath" TEXT NOT NULL,
          "uploadedBy" VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
          status VARCHAR(50) NOT NULL,
          "chunkCount" INTEGER DEFAULT 0,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create document_chunks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id VARCHAR(255) PRIMARY KEY,
          "documentId" VARCHAR(255) REFERENCES documents(id) ON DELETE CASCADE,
          "chunkIndex" INTEGER NOT NULL,
          "pageNumber" INTEGER NOT NULL,
          content TEXT NOT NULL,
          embedding TEXT NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create conversations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id VARCHAR(255) PRIMARY KEY,
          "userId" VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create messages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(255) PRIMARY KEY,
          "conversationId" VARCHAR(255) REFERENCES conversations(id) ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create message_sources table
      await client.query(`
        CREATE TABLE IF NOT EXISTS message_sources (
          id VARCHAR(255) PRIMARY KEY,
          "messageId" VARCHAR(255) REFERENCES messages(id) ON DELETE CASCADE,
          "documentId" VARCHAR(255),
          "chunkId" VARCHAR(255),
          "documentName" VARCHAR(255) NOT NULL,
          "pageNumber" INTEGER NOT NULL,
          "similarityScore" DOUBLE PRECISION NOT NULL
        );
      `);

      // Create login_logs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS login_logs (
          id VARCHAR(255) PRIMARY KEY,
          "userId" VARCHAR(255),
          "userName" VARCHAR(255) NOT NULL,
          "userEmail" VARCHAR(255) NOT NULL,
          "userRole" VARCHAR(50) NOT NULL,
          "ipAddress" VARCHAR(100) NOT NULL,
          "loginTime" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('🐘 PostgreSQL Database connected and tables verified.');
      isPostgresActive = true;
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('⚠️ Could not connect to PostgreSQL database:', (err as Error).message);
    console.warn('⚡ Falling back to file-backed JSON Database.');
    isPostgresActive = false;
    pgPool = null;
    return false;
  }
}
