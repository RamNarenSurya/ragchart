import { Response } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { db } from '../db/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { extractTextFromFile } from '../services/document/extractor.js';
import { chunkDocumentPages } from '../services/document/chunker.js';
import { storeDocumentChunks, deleteDocumentChunks } from '../services/vector/vectorStore.js';

export async function uploadDocument(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No document file uploaded.' });
      return;
    }

    const { title } = req.body;
    const file = req.file;
    const documentId = randomUUID();
    const docTitle = title || file.originalname;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO documents (id, title, filename, fileType, fileSize, storagePath, uploadedBy, status, chunkCount, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      documentId,
      docTitle,
      file.originalname,
      file.mimetype,
      file.size,
      file.path,
      req.user!.id,
      'PROCESSING',
      0,
      now,
      now
    );

    // Process document in background to prevent blocking HTTP response
    processDocumentTask(documentId, file.path, file.mimetype, file.originalname).catch((err) => {
      console.error(`Error processing document ${documentId}:`, err);
    });

    res.status(202).json({
      message: 'Document uploaded successfully and is now processing.',
      document: {
        id: documentId,
        title: docTitle,
        filename: file.originalname,
        status: 'PROCESSING',
        createdAt: now,
      },
    });
  } catch (err) {
    console.error('Upload document error:', err);
    res.status(500).json({ error: 'Failed to upload document.' });
  }
}

export async function processDocumentTask(
  documentId: string,
  filePath: string,
  mimeType: string,
  filename: string
) {
  const now = new Date().toISOString();
  try {
    console.log(`⏳ Starting document processing for: ${filename} (ID: ${documentId})`);

    // 1. Extract text
    const extraction = await extractTextFromFile(filePath, mimeType, filename);

    // 2. Chunk text
    const chunks = chunkDocumentPages(extraction.pages);

    // 3. Clear existing chunks if any
    await deleteDocumentChunks(documentId);

    // 4. Store chunks & embeddings
    const storedCount = await storeDocumentChunks(documentId, chunks);

    // 5. Update document status
    db.prepare(`
      UPDATE documents 
      SET status = 'READY', chunkCount = ?, updatedAt = ?
      WHERE id = ?
    `).run(storedCount, now, documentId);

    console.log(`✅ Document processing READY: ${filename} (${storedCount} chunks)`);
  } catch (err) {
    console.error(`❌ Document processing FAILED for ${filename}:`, err);
    db.prepare(`
      UPDATE documents 
      SET status = 'FAILED', updatedAt = ?
      WHERE id = ?
    `).run(now, documentId);
  }
}

export async function listDocuments(req: AuthRequest, res: Response) {
  try {
    const documents = db.prepare(`
      SELECT d.*, u.name as uploadedByName 
      FROM documents d
      LEFT JOIN users u ON d.uploadedBy = u.id
      ORDER BY d.createdAt DESC
    `).all();

    res.json({ documents });
  } catch (err) {
    console.error('List documents error:', err);
    res.status(500).json({ error: 'Failed to list documents.' });
  }
}

export async function getDocumentById(req: AuthRequest, res: Response) {
  try {
    const document = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id);
    if (!document) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    const chunks = db.prepare(`
      SELECT id, chunkIndex, pageNumber, content, createdAt 
      FROM document_chunks 
      WHERE documentId = ? 
      ORDER BY chunkIndex ASC
    `).all(req.params.id);

    res.json({ document, chunks });
  } catch (err) {
    console.error('Get document error:', err);
    res.status(500).json({ error: 'Failed to get document.' });
  }
}

export async function reprocessDocument(req: AuthRequest, res: Response) {
  try {
    const doc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id) as any;
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    db.prepare(`UPDATE documents SET status = 'PROCESSING', updatedAt = ? WHERE id = ?`)
      .run(new Date().toISOString(), doc.id);

    processDocumentTask(doc.id, doc.storagePath, doc.fileType, doc.filename).catch((err) => {
      console.error(`Error reprocessing document ${doc.id}:`, err);
    });

    res.json({ message: 'Document reprocessing initiated.', documentId: doc.id });
  } catch (err) {
    console.error('Reprocess document error:', err);
    res.status(500).json({ error: 'Failed to reprocess document.' });
  }
}

export async function deleteDocument(req: AuthRequest, res: Response) {
  try {
    const doc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id) as any;
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    // Delete chunks from vector database
    await deleteDocumentChunks(doc.id);

    // Delete file from disk if exists
    if (fs.existsSync(doc.storagePath)) {
      try {
        fs.unlinkSync(doc.storagePath);
      } catch (e) {
        console.warn('Could not delete file from storage:', e);
      }
    }

    // Delete document row
    db.prepare(`DELETE FROM documents WHERE id = ?`).run(doc.id);

    res.json({ message: 'Document and its vector chunks deleted successfully.' });
  } catch (err) {
    console.error('Delete document error:', err);
    res.status(500).json({ error: 'Failed to delete document.' });
  }
}
