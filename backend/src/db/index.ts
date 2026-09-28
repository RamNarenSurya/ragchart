import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { initPostgres, pgPool, isPostgresActive } from './postgres.js';

interface DatabaseSchema {
  users: any[];
  documents: any[];
  document_chunks: any[];
  conversations: any[];
  messages: any[];
  message_sources: any[];
  login_logs: any[];
}

function getDbFilePath(): string {
  const rawFileName = 'college_rag.json';
  const rootCandidate = path.resolve(process.cwd(), rawFileName);
  const parentCandidate = path.resolve(process.cwd(), '..', rawFileName);

  if (path.basename(process.cwd()).toLowerCase() === 'backend' && fs.existsSync(parentCandidate)) {
    return parentCandidate;
  }
  if (fs.existsSync(rootCandidate)) {
    return rootCandidate;
  }
  if (fs.existsSync(parentCandidate)) {
    return parentCandidate;
  }
  return path.resolve(config.dbPath.endsWith('.db') ? config.dbPath.replace('.db', '.json') : config.dbPath);
}

let dbFilePath = getDbFilePath();

let dbData: DatabaseSchema = {
  users: [],
  documents: [],
  document_chunks: [],
  conversations: [],
  messages: [],
  message_sources: [],
  login_logs: [],
};

function loadDb() {
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dbFilePath)) {
    try {
      const fileContent = fs.readFileSync(dbFilePath, 'utf-8');
      dbData = JSON.parse(fileContent);
    } catch (e) {
      console.warn('⚠️ Could not parse existing JSON database, resetting file:', e);
      saveDb();
    }
  } else {
    saveDb();
  }
}

function saveDb() {
  fs.writeFileSync(dbFilePath, JSON.stringify(dbData, null, 2), 'utf-8');
}

export async function initDatabase() {
  const pgConnected = await initPostgres();
  if (pgConnected && pgPool) {
    try {
      const usersRes = await pgPool.query('SELECT * FROM users');
      const docsRes = await pgPool.query('SELECT * FROM documents');
      const chunksRes = await pgPool.query('SELECT * FROM document_chunks');
      const convsRes = await pgPool.query('SELECT * FROM conversations');
      const msgsRes = await pgPool.query('SELECT * FROM messages');
      const sourcesRes = await pgPool.query('SELECT * FROM message_sources');
      const logsRes = await pgPool.query('SELECT * FROM login_logs');

      dbData = {
        users: usersRes.rows,
        documents: docsRes.rows,
        document_chunks: chunksRes.rows.map((row) => ({
          ...row,
          embedding: typeof row.embedding === 'string' && row.embedding.startsWith('[') ? JSON.parse(row.embedding) : row.embedding,
        })),
        conversations: convsRes.rows,
        messages: msgsRes.rows,
        message_sources: sourcesRes.rows,
        login_logs: logsRes.rows,
      };
      console.log('⚡ Loaded database records from PostgreSQL into active runtime memory.');
      return;
    } catch (err) {
      console.warn('⚠️ Error loading state from PostgreSQL, falling back to JSON file:', err);
    }
  }
  loadDb();
  console.log('⚡ File-backed JSON Database initialized successfully at:', dbFilePath);
}

export const db = {
  pragma: (str: string) => {},
  exec: (sql: string) => {
    loadDb();
  },
  prepare: (sql: string) => {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    return {
      run: (...params: any[]) => {
        let changes = 0;

        if (cleanSql.startsWith('INSERT INTO users')) {
          const [id, name, email, passwordHash, role, createdAt, updatedAt] = params;
          dbData.users.push({ id, name, email, passwordHash, role, createdAt, updatedAt });
          changes = 1;
          if (isPostgresActive && pgPool) {
            pgPool.query(
              'INSERT INTO users (id, name, email, "passwordHash", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
              params
            ).catch((err) => console.error('PostgreSQL insert user error:', err));
          }
        } else if (cleanSql.startsWith('UPDATE users SET passwordHash = ? WHERE id = ?')) {
          const [passwordHash, id] = params;
          const user = dbData.users.find((u) => u.id === id);
          if (user) {
            user.passwordHash = passwordHash;
            user.updatedAt = new Date().toISOString();
            changes = 1;
          }
          if (isPostgresActive && pgPool) {
            pgPool.query('UPDATE users SET "passwordHash" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2', [
              passwordHash,
              id,
            ]).catch((err) => console.error('PostgreSQL update user password error:', err));
          }
        } else if (cleanSql.startsWith('INSERT INTO documents')) {
          const [id, title, filename, fileType, fileSize, storagePath, uploadedBy, status, chunkCount, createdAt, updatedAt] = params;
          dbData.documents.push({ id, title, filename, fileType, fileSize, storagePath, uploadedBy, status, chunkCount, createdAt, updatedAt });
          changes = 1;
          if (isPostgresActive && pgPool) {
            pgPool.query(
              'INSERT INTO documents (id, title, filename, "fileType", "fileSize", "storagePath", "uploadedBy", status, "chunkCount", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING',
              params
            ).catch((err) => console.error('PostgreSQL insert document error:', err));
          }
        } else if (cleanSql.includes('UPDATE documents')) {
          const docId = params[params.length - 1];
          const doc = dbData.documents.find((d) => d.id === docId);
          if (doc) {
            if (cleanSql.includes("status = 'READY'") || cleanSql.includes("status = ?")) {
              doc.status = 'READY';
            }
            if (params.length >= 3 && typeof params[0] === 'number') {
              doc.chunkCount = params[0];
            } else if (params.length >= 3 && typeof params[1] === 'number') {
              doc.chunkCount = params[1];
            }
            doc.updatedAt = new Date().toISOString();
            changes = 1;
          }
          if (isPostgresActive && pgPool && doc) {
            pgPool.query('UPDATE documents SET status = $1, "chunkCount" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3', [
              doc.status,
              doc.chunkCount,
              docId,
            ]).catch((err) => console.error('PostgreSQL update document error:', err));
          }
        } else if (cleanSql.startsWith('DELETE FROM documents WHERE id = ?')) {
          const [id] = params;
          const initialLen = dbData.documents.length;
          dbData.documents = dbData.documents.filter((d) => d.id !== id);
          dbData.document_chunks = dbData.document_chunks.filter((c) => c.documentId !== id);
          changes = initialLen - dbData.documents.length;
          if (isPostgresActive && pgPool) {
            pgPool.query('DELETE FROM documents WHERE id = $1', [id]).catch((err) => console.error('PostgreSQL delete document error:', err));
          }
        } else if (cleanSql.startsWith('INSERT INTO document_chunks')) {
          const [id, documentId, chunkIndex, pageNumber, content, embedding, createdAt] = params;
          dbData.document_chunks.push({ id, documentId, chunkIndex, pageNumber, content, embedding, createdAt });
          changes = 1;
          if (isPostgresActive && pgPool) {
            const embeddingStr = typeof embedding === 'string' ? embedding : JSON.stringify(embedding);
            pgPool.query(
              'INSERT INTO document_chunks (id, "documentId", "chunkIndex", "pageNumber", content, embedding, "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
              [id, documentId, chunkIndex, pageNumber, content, embeddingStr, createdAt]
            ).catch((err) => console.error('PostgreSQL insert chunk error:', err));
          }
        } else if (cleanSql.startsWith('DELETE FROM document_chunks WHERE documentId = ?')) {
          const [documentId] = params;
          dbData.document_chunks = dbData.document_chunks.filter((c) => c.documentId !== documentId);
          changes = 1;
          if (isPostgresActive && pgPool) {
            pgPool.query('DELETE FROM document_chunks WHERE "documentId" = $1', [documentId]).catch((err) => console.error('PostgreSQL delete chunks error:', err));
          }
        } else if (cleanSql.startsWith('INSERT INTO conversations')) {
          const [id, userId, title, createdAt, updatedAt] = params;
          dbData.conversations.push({ id, userId, title, createdAt, updatedAt });
          changes = 1;
          if (isPostgresActive && pgPool) {
            pgPool.query(
              'INSERT INTO conversations (id, "userId", title, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
              params
            ).catch((err) => console.error('PostgreSQL insert conversation error:', err));
          }
        } else if (cleanSql.startsWith('UPDATE conversations SET updatedAt = ? WHERE id = ?')) {
          const [updatedAt, id] = params;
          const conv = dbData.conversations.find((c) => c.id === id);
          if (conv) {
            conv.updatedAt = updatedAt;
            changes = 1;
          }
          if (isPostgresActive && pgPool) {
            pgPool.query('UPDATE conversations SET "updatedAt" = $1 WHERE id = $2', [updatedAt, id]).catch((err) => console.error('PostgreSQL update conversation error:', err));
          }
        } else if (cleanSql.startsWith('DELETE FROM conversations WHERE id = ?')) {
          const [id, userId] = params;
          const initialLen = dbData.conversations.length;
          dbData.conversations = dbData.conversations.filter((c) => c.id !== id && (!userId || c.userId === userId));
          const deletedCount = initialLen - dbData.conversations.length;
          if (deletedCount > 0) {
            dbData.messages = dbData.messages.filter((m) => m.conversationId !== id);
          }
          changes = deletedCount;
          if (isPostgresActive && pgPool) {
            pgPool.query('DELETE FROM conversations WHERE id = $1', [id]).catch((err) => console.error('PostgreSQL delete conversation error:', err));
          }
        } else if (cleanSql.startsWith('INSERT INTO messages')) {
          const [id, conversationId, role, content, createdAt] = params;
          dbData.messages.push({ id, conversationId, role, content, createdAt });
          changes = 1;
          if (isPostgresActive && pgPool) {
            pgPool.query(
              'INSERT INTO messages (id, "conversationId", role, content, "createdAt") VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
              params
            ).catch((err) => console.error('PostgreSQL insert message error:', err));
          }
        } else if (cleanSql.startsWith('INSERT INTO message_sources')) {
          const [id, messageId, documentId, chunkId, documentName, pageNumber, similarityScore] = params;
          dbData.message_sources.push({ id, messageId, documentId, chunkId, documentName, pageNumber, similarityScore });
          changes = 1;
          if (isPostgresActive && pgPool) {
            pgPool.query(
              'INSERT INTO message_sources (id, "messageId", "documentId", "chunkId", "documentName", "pageNumber", "similarityScore") VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
              params
            ).catch((err) => console.error('PostgreSQL insert message source error:', err));
          }
        } else if (cleanSql.startsWith('INSERT INTO login_logs')) {
          const [id, userId, userName, userEmail, userRole, ipAddress, loginTime] = params;
          if (!dbData.login_logs) dbData.login_logs = [];
          dbData.login_logs.push({ id, userId, userName, userEmail, userRole, ipAddress, loginTime });
          changes = 1;
          if (isPostgresActive && pgPool) {
            pgPool.query(
              'INSERT INTO login_logs (id, "userId", "userName", "userEmail", "userRole", "ipAddress", "loginTime") VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
              params
            ).catch((err) => console.error('PostgreSQL insert login log error:', err));
          }
        }

        saveDb();
        return { changes };
      },

      get: (...params: any[]) => {
        if (cleanSql.includes('FROM users WHERE email = ?')) {
          const [email] = params;
          return dbData.users.find((u) => u.email === email) || undefined;
        }
        if (cleanSql.includes('FROM documents WHERE id = ?')) {
          const [id] = params;
          return dbData.documents.find((d) => d.id === id) || undefined;
        }
        if (cleanSql.includes('FROM conversations WHERE id = ?')) {
          const [id, userId] = params;
          return dbData.conversations.find((c) => c.id === id && (!userId || c.userId === userId)) || undefined;
        }
        if (cleanSql.includes('SELECT COUNT(*) as count FROM documents WHERE status = \'READY\'')) {
          return { count: dbData.documents.filter((d) => d.status === 'READY').length };
        }
        if (cleanSql.includes('SELECT COUNT(*) as count FROM documents WHERE status = \'PROCESSING\'')) {
          return { count: dbData.documents.filter((d) => d.status === 'PROCESSING').length };
        }
        if (cleanSql.includes('SELECT COUNT(*) as count FROM documents WHERE status = \'FAILED\'')) {
          return { count: dbData.documents.filter((d) => d.status === 'FAILED').length };
        }
        if (cleanSql.includes('SELECT COUNT(*) as count FROM documents')) {
          return { count: dbData.documents.length };
        }
        if (cleanSql.includes('SELECT COUNT(*) as count FROM users')) {
          return { count: dbData.users.length };
        }
        if (cleanSql.includes('SELECT COUNT(*) as count FROM messages WHERE role = \'user\'')) {
          return { count: dbData.messages.filter((m) => m.role === 'user').length };
        }
        if (cleanSql.includes('SELECT COUNT(*) as count FROM document_chunks')) {
          return { count: dbData.document_chunks.length };
        }
        return undefined;
      },

      all: (...params: any[]) => {
        if (cleanSql.includes('FROM users')) {
          return [...dbData.users];
        }
        if (cleanSql.includes('FROM documents d') || cleanSql.includes('FROM documents')) {
          const docs = [...dbData.documents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          if (cleanSql.includes('LIMIT 10')) {
            return docs.slice(0, 10);
          }
          return docs.map((d) => {
            const user = dbData.users.find((u) => u.id === d.uploadedBy);
            return { ...d, uploadedByName: user ? user.name : 'Admin' };
          });
        }

        if (cleanSql.includes('FROM document_chunks dc')) {
          return dbData.document_chunks
            .filter((dc) => {
              const doc = dbData.documents.find((d) => d.id === dc.documentId);
              return doc && doc.status === 'READY';
            })
            .map((dc) => {
              const doc = dbData.documents.find((d) => d.id === dc.documentId);
              return {
                chunkId: dc.id,
                documentId: dc.documentId,
                documentName: doc ? doc.filename : 'Document',
                pageNumber: dc.pageNumber,
                chunkIndex: dc.chunkIndex,
                content: dc.content,
                embedding: dc.embedding,
              };
            });
        }

        if (cleanSql.includes('FROM document_chunks WHERE documentId = ?')) {
          const [docId] = params;
          return dbData.document_chunks
            .filter((dc) => dc.documentId === docId)
            .sort((a, b) => a.chunkIndex - b.chunkIndex);
        }

        if (cleanSql.includes('FROM conversations c WHERE c.userId = ?')) {
          const [userId] = params;
          return dbData.conversations
            .filter((c) => c.userId === userId)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .map((c) => {
              const msgs = dbData.messages
                .filter((m) => m.conversationId === c.id)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              return {
                ...c,
                lastMessage: msgs.length > 0 ? msgs[0].content : '',
              };
            });
        }

        if (cleanSql.includes('FROM messages WHERE conversationId = ?')) {
          const [convId, userMsgId] = params;
          return dbData.messages
            .filter((m) => m.conversationId === convId && (!userMsgId || m.id !== userMsgId))
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }

        if (cleanSql.includes('FROM message_sources WHERE messageId IN')) {
          const messageIds = params;
          return dbData.message_sources.filter((ms) => messageIds.includes(ms.messageId));
        }

        if (cleanSql.includes('FROM login_logs')) {
          if (!dbData.login_logs) dbData.login_logs = [];
          return [...dbData.login_logs].sort((a, b) => new Date(b.loginTime).getTime() - new Date(a.loginTime).getTime());
        }

        return [];
      },
    };
  },
};
