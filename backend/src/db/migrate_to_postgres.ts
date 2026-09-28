import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { initPostgres, pgPool, isPostgresActive } from './postgres.js';

async function migrate() {
  console.log('🚀 Starting migration from JSON Database to PostgreSQL...');

  const rawFileName = 'college_rag.json';
  const rootCandidate = path.resolve(process.cwd(), rawFileName);
  const parentCandidate = path.resolve(process.cwd(), '..', rawFileName);

  let jsonPath = '';
  if (fs.existsSync(rootCandidate)) {
    jsonPath = rootCandidate;
  } else if (fs.existsSync(parentCandidate)) {
    jsonPath = parentCandidate;
  }

  if (!jsonPath || !fs.existsSync(jsonPath)) {
    console.error('❌ Could not find college_rag.json source file to migrate.');
    process.exit(1);
  }

  const success = await initPostgres();
  if (!success || !pgPool) {
    console.error('❌ Cannot run migration: PostgreSQL is not connected. Please check DATABASE_URL in backend/.env.');
    process.exit(1);
  }

  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(jsonContent);

  const client = await pgPool.connect();

  try {
    await client.query('BEGIN');

    // 1. Migrate Users
    if (data.users && data.users.length > 0) {
      console.log(`👤 Migrating ${data.users.length} users...`);
      for (const u of data.users) {
        await client.query(
          `INSERT INTO users (id, name, email, "passwordHash", role, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            "passwordHash" = EXCLUDED."passwordHash",
            role = EXCLUDED.role,
            "updatedAt" = EXCLUDED."updatedAt"`,
          [u.id, u.name, u.email, u.passwordHash, u.role, u.createdAt, u.updatedAt]
        );
      }
    }

    // 2. Migrate Documents
    if (data.documents && data.documents.length > 0) {
      console.log(`📄 Migrating ${data.documents.length} documents...`);
      for (const d of data.documents) {
        await client.query(
          `INSERT INTO documents (id, title, filename, "fileType", "fileSize", "storagePath", "uploadedBy", status, "chunkCount", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            status = EXCLUDED.status,
            "chunkCount" = EXCLUDED."chunkCount",
            "updatedAt" = EXCLUDED."updatedAt"`,
          [d.id, d.title, d.filename, d.fileType, d.fileSize, d.storagePath, d.uploadedBy, d.status, d.chunkCount || 0, d.createdAt, d.updatedAt]
        );
      }
    }

    // 3. Migrate Chunks
    if (data.document_chunks && data.document_chunks.length > 0) {
      console.log(`🧩 Migrating ${data.document_chunks.length} document chunks...`);
      for (const c of data.document_chunks) {
        const embeddingStr = typeof c.embedding === 'string' ? c.embedding : JSON.stringify(c.embedding);
        await client.query(
          `INSERT INTO document_chunks (id, "documentId", "chunkIndex", "pageNumber", content, embedding, "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding`,
          [c.id, c.documentId, c.chunkIndex, c.pageNumber, c.content, embeddingStr, c.createdAt]
        );
      }
    }

    // 4. Migrate Conversations
    if (data.conversations && data.conversations.length > 0) {
      console.log(`💬 Migrating ${data.conversations.length} conversations...`);
      for (const conv of data.conversations) {
        await client.query(
          `INSERT INTO conversations (id, "userId", title, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            "updatedAt" = EXCLUDED."updatedAt"`,
          [conv.id, conv.userId, conv.title, conv.createdAt, conv.updatedAt]
        );
      }
    }

    // 5. Migrate Messages
    if (data.messages && data.messages.length > 0) {
      console.log(`✉️ Migrating ${data.messages.length} messages...`);
      for (const m of data.messages) {
        await client.query(
          `INSERT INTO messages (id, "conversationId", role, content, "createdAt")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [m.id, m.conversationId, m.role, m.content, m.createdAt]
        );
      }
    }

    // 6. Migrate Message Sources
    if (data.message_sources && data.message_sources.length > 0) {
      console.log(`📌 Migrating ${data.message_sources.length} message sources...`);
      for (const ms of data.message_sources) {
        await client.query(
          `INSERT INTO message_sources (id, "messageId", "documentId", "chunkId", "documentName", "pageNumber", "similarityScore")
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [ms.id, ms.messageId, ms.documentId, ms.chunkId, ms.documentName, ms.pageNumber, ms.similarityScore]
        );
      }
    }

    // 7. Migrate Login Logs
    if (data.login_logs && data.login_logs.length > 0) {
      console.log(`🔒 Migrating ${data.login_logs.length} login logs...`);
      for (const log of data.login_logs) {
        await client.query(
          `INSERT INTO login_logs (id, "userId", "userName", "userEmail", "userRole", "ipAddress", "loginTime")
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [log.id, log.userId, log.userName, log.userEmail, log.userRole, log.ipAddress, log.loginTime]
        );
      }
    }

    await client.query('COMMIT');
    console.log('🎉 Migration completed successfully! All data from college_rag.json is now in PostgreSQL.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pgPool.end();
  }
}

migrate();
