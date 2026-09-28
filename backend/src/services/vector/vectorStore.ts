import { db } from '../../db/index.js';
import { cosineSimilarity, generateEmbedding } from '../embeddings/embeddingService.js';
import { config } from '../../config/index.js';
import { randomUUID } from 'crypto';
import { Chunk } from '../document/chunker.js';

export interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  similarityScore: number;
}

export async function storeDocumentChunks(
  documentId: string,
  chunks: Chunk[]
): Promise<number> {
  const insertStmt = db.prepare(`
    INSERT INTO document_chunks (id, documentId, chunkIndex, pageNumber, content, embedding, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  let count = 0;

  for (const chunk of chunks) {
    const chunkId = randomUUID();
    const embedding = await generateEmbedding(chunk.content);
    insertStmt.run(
      chunkId,
      documentId,
      chunk.chunkIndex,
      chunk.pageNumber,
      chunk.content,
      JSON.stringify(embedding),
      now
    );
    count++;
  }

  return count;
}

export async function deleteDocumentChunks(documentId: string): Promise<void> {
  db.prepare(`DELETE FROM document_chunks WHERE documentId = ?`).run(documentId);
}

const ABBREVIATIONS: Record<string, string[]> = {
  lib: ['library', 'books', 'borrow', 'reading', 'timing', 'timings'],
  fee: ['fees', 'tuition', 'payment', 'dues', 'cost', 'charge', 'hostel'],
  fees: ['fee', 'tuition', 'payment', 'dues', 'cost', 'charge'],
  schol: ['scholarship', 'stipend', 'financial', 'concession', 'grant'],
  scholarship: ['schol', 'stipend', 'grant', 'financial', 'aid'],
  time: ['timings', 'timing', 'hours', 'schedule', 'open', 'close'],
  timings: ['time', 'timing', 'hours', 'schedule', 'open', 'close'],
  timing: ['time', 'timings', 'hours', 'schedule', 'open', 'close'],
  date: ['deadline', 'due', 'schedule', 'last date'],
  exam: ['examination', 'test', 'midterm', 'marks', 'hall ticket'],
  doc: ['document', 'certificate', 'verification', 'proof'],
  docs: ['documents', 'certificates', 'verification'],
  admin: ['admission', 'administration', 'office', 'contact'],
  dept: ['department', 'branch', 'course'],
  pass: ['passing', 'marks', 'grade', 'percentage', 'credit'],
  hostel: ['mess', 'room', 'accommodation', 'boarding', 'warden'],
};

export async function searchSimilarChunks(
  query: string,
  topK: number = config.maxSearchResults,
  threshold: number = 0.20
): Promise<VectorSearchResult[]> {
  const cleanQuery = query.trim();
  const words = cleanQuery.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);

  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'who', 'what', 'when', 'where', 'how', 'why', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'of', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'this', 'that', 'these', 'those', 'am', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'tell', 'me', 'give', 'detail', 'details', 'info', 'information', 'know']);

  const originalQueryTerms = Array.from(
    new Set(words.filter((w) => (w.length >= 2 || /^\d+$/.test(w)) && !stopWords.has(w)))
  );

  // Dynamic threshold for short queries (1-4 words)
  const isShortQuery = words.length <= 4;
  const effectiveThreshold = isShortQuery ? 0.10 : threshold;

  // Build expanded search query to assist short/abbreviated questions
  let expandedTerms: string[] = [...words];
  for (const w of words) {
    if (ABBREVIATIONS[w]) {
      expandedTerms.push(...ABBREVIATIONS[w]);
    }
  }
  const expandedQuery = Array.from(new Set(expandedTerms)).join(' ');

  // Generate embedding using expanded context if short
  const searchQuery = isShortQuery && expandedQuery ? `${cleanQuery} (${expandedQuery})` : cleanQuery;
  const queryEmbedding = await generateEmbedding(searchQuery);

  // Retrieve chunks from READY documents
  const rows = db.prepare(`
    SELECT 
      dc.id as chunkId,
      dc.documentId,
      d.filename as documentName,
      dc.pageNumber,
      dc.chunkIndex,
      dc.content,
      dc.embedding
    FROM document_chunks dc
    JOIN documents d ON dc.documentId = d.id
    WHERE d.status = 'READY'
  `).all() as any[];

  if (rows.length === 0) {
    return [];
  }

  const allMatchTerms = Array.from(
    new Set(expandedTerms.filter((t) => (t.length >= 2 || /^\d+$/.test(t)) && !stopWords.has(t)))
  );

  const results: VectorSearchResult[] = [];

  for (const row of rows) {
    const chunkEmbedding = Array.isArray(row.embedding)
      ? row.embedding
      : typeof row.embedding === 'string'
      ? JSON.parse(row.embedding)
      : [];
    const cosScore = cosineSimilarity(queryEmbedding, chunkEmbedding);

    const contentLower = row.content.toLowerCase();
    
    // Keyword hits against original query terms
    let originalHits = 0;
    for (const term of originalQueryTerms) {
      if (contentLower.includes(term) || (term.length > 3 && contentLower.includes(term.substring(0, term.length - 1)))) {
        originalHits++;
      }
    }

    // Keyword hits against all expanded terms
    let expandedHits = 0;
    for (const term of allMatchTerms) {
      if (contentLower.includes(term) || (term.length > 3 && contentLower.includes(term.substring(0, term.length - 1)))) {
        expandedHits++;
      }
    }

    const keywordDenom = Math.max(1, originalQueryTerms.length);
    const keywordRatio = Math.min(1.0, (originalHits + Math.min(expandedHits, 2) * 0.2) / keywordDenom);

    let finalScore = cosScore;
    if (originalQueryTerms.length > 0 || allMatchTerms.length > 0) {
      finalScore = cosScore * 0.4 + keywordRatio * 0.6;
    }

    if (finalScore >= effectiveThreshold || originalHits > 0 || (expandedHits > 0 && cosScore >= 0.15)) {
      results.push({
        chunkId: row.chunkId,
        documentId: row.documentId,
        documentName: row.documentName,
        pageNumber: row.pageNumber,
        chunkIndex: row.chunkIndex,
        content: row.content,
        similarityScore: Math.min(Math.max(Math.round(finalScore * 100) / 100, 0.15), 0.99),
      });
    }
  }

  // Exact Day X / Module X / Unit X / Rule X pattern boost
  const dayMatch = cleanQuery.match(/\b(day|module|unit|section|rule|part)\s*(\d+)\b/i);
  if (dayMatch) {
    const sectionRegex = new RegExp(`\\b${dayMatch[1]}\\s*${dayMatch[2]}\\b`, 'i');
    for (const res of results) {
      if (sectionRegex.test(res.content)) {
        res.similarityScore = Math.min(res.similarityScore + 0.60, 0.99);
      }
    }
  }

  // LeetCode / Practice problem query boost
  if (/leetcode|practice|problem/i.test(cleanQuery)) {
    for (const res of results) {
      if (/leetcode/i.test(res.content) || /practice problem/i.test(res.content)) {
        res.similarityScore = Math.min(res.similarityScore + 0.50, 0.99);
      }
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.similarityScore - a.similarityScore);

  return results.slice(0, topK);
}
