import { Response } from 'express';
import { db } from '../db/index.js';
import { AuthRequest } from '../middleware/auth.js';

export async function getAdminStatistics(req: AuthRequest, res: Response) {
  try {
    const totalDocs = (db.prepare(`SELECT COUNT(*) as count FROM documents`).get() as any).count;
    const readyDocs = (db.prepare(`SELECT COUNT(*) as count FROM documents WHERE status = 'READY'`).get() as any).count;
    const processingDocs = (db.prepare(`SELECT COUNT(*) as count FROM documents WHERE status = 'PROCESSING'`).get() as any).count;
    const failedDocs = (db.prepare(`SELECT COUNT(*) as count FROM documents WHERE status = 'FAILED'`).get() as any).count;

    const totalUsers = (db.prepare(`SELECT COUNT(*) as count FROM users`).get() as any).count;
    const totalQueries = (db.prepare(`SELECT COUNT(*) as count FROM messages WHERE role = 'user'`).get() as any).count;
    const totalChunks = (db.prepare(`SELECT COUNT(*) as count FROM document_chunks`).get() as any).count;

    const recentDocuments = db.prepare(`
      SELECT id, title, filename, fileType, fileSize, status, chunkCount, createdAt
      FROM documents
      ORDER BY createdAt DESC
      LIMIT 10
    `).all();

    res.json({
      statistics: {
        totalDocuments: totalDocs,
        readyDocuments: readyDocs,
        processingDocuments: processingDocs,
        failedDocuments: failedDocs,
        totalUsers,
        totalQueries,
        totalChunks,
      },
      recentDocuments,
    });
  } catch (err) {
    console.error('Admin statistics error:', err);
    res.status(500).json({ error: 'Failed to retrieve admin statistics.' });
  }
}

export async function getLoginLogs(req: AuthRequest, res: Response) {
  try {
    const logs = db.prepare(`SELECT * FROM login_logs ORDER BY loginTime DESC`).all();
    res.json({ logs });
  } catch (err) {
    console.error('Get login logs error:', err);
    res.status(500).json({ error: 'Failed to retrieve login logs.' });
  }
}
