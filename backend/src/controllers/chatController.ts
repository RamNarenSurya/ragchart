import { Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { searchSimilarChunks } from '../services/vector/vectorStore.js';
import { generateGroundedAnswer } from '../services/llm/llmService.js';

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const { conversationId, message } = req.body;
    const userId = req.user!.id;

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message content is required.' });
      return;
    }

    const now = new Date().toISOString();
    let currentConvId = conversationId;

    // Create conversation if not provided
    if (!currentConvId) {
      currentConvId = randomUUID();
      const title = message.trim().slice(0, 40) + (message.length > 40 ? '...' : '');
      db.prepare(`
        INSERT INTO conversations (id, userId, title, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `).run(currentConvId, userId, title, now, now);
    } else {
      // Verify user owns conversation
      const conv = db.prepare(`SELECT * FROM conversations WHERE id = ? AND userId = ?`).get(currentConvId, userId);
      if (!conv) {
        res.status(404).json({ error: 'Conversation not found.' });
        return;
      }
      db.prepare(`UPDATE conversations SET updatedAt = ? WHERE id = ?`).run(now, currentConvId);
    }

    // 1. Store user message
    const userMsgId = randomUUID();
    db.prepare(`
      INSERT INTO messages (id, conversationId, role, content, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(userMsgId, currentConvId, 'user', message.trim(), now);

    // 2. Fetch conversation history for multi-turn context
    const historyRows = db.prepare(`
      SELECT role, content FROM messages 
      WHERE conversationId = ? AND id != ?
      ORDER BY createdAt ASC LIMIT 10
    `).all(currentConvId, userMsgId) as any[];

    // 3. Vector Similarity Search
    const retrievedChunks = await searchSimilarChunks(message.trim());

    // 4. Generate grounded LLM response
    const groundedResult = await generateGroundedAnswer(message.trim(), retrievedChunks, historyRows);

    // 5. Store assistant message
    const assistantMsgId = randomUUID();
    const assistantTime = new Date().toISOString();
    db.prepare(`
      INSERT INTO messages (id, conversationId, role, content, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(assistantMsgId, currentConvId, 'assistant', groundedResult.answer, assistantTime);

    // 6. Store message sources
    const insertSourceStmt = db.prepare(`
      INSERT INTO message_sources (id, messageId, documentId, chunkId, documentName, pageNumber, similarityScore)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    groundedResult.sources.forEach((source) => {
      insertSourceStmt.run(
        randomUUID(),
        assistantMsgId,
        source.documentId,
        `chunk_${source.documentId}`,
        source.documentName,
        source.pageNumber,
        source.similarityScore
      );
    });

    res.json({
      conversationId: currentConvId,
      userMessage: {
        id: userMsgId,
        role: 'user',
        content: message.trim(),
        createdAt: now,
      },
      assistantMessage: {
        id: assistantMsgId,
        role: 'assistant',
        content: groundedResult.answer,
        createdAt: assistantTime,
        sources: groundedResult.sources,
      },
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to process chat message.' });
  }
}

export async function getConversations(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const conversations = db.prepare(`
      SELECT c.*, 
             (SELECT content FROM messages WHERE conversationId = c.id ORDER BY createdAt DESC LIMIT 1) as lastMessage
      FROM conversations c
      WHERE c.userId = ?
      ORDER BY c.updatedAt DESC
    `).all(userId);

    res.json({ conversations });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Failed to retrieve conversations.' });
  }
}

export async function createConversation(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { title } = req.body;
    const convId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO conversations (id, userId, title, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(convId, userId, title || 'New Conversation', now, now);

    res.status(201).json({
      conversation: {
        id: convId,
        userId,
        title: title || 'New Conversation',
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Failed to create conversation.' });
  }
}

export async function getConversationById(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const convId = req.params.id;

    const conversation = db.prepare(`
      SELECT * FROM conversations WHERE id = ? AND userId = ?
    `).get(convId, userId);

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    const messages = db.prepare(`
      SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC
    `).all(convId) as any[];

    // Fetch sources for assistant messages
    const messageIds = messages.filter((m) => m.role === 'assistant').map((m) => m.id);
    const sourcesMap: Record<string, any[]> = {};

    if (messageIds.length > 0) {
      const placeholders = messageIds.map(() => '?').join(',');
      const sourcesRows = db.prepare(`
        SELECT * FROM message_sources WHERE messageId IN (${placeholders})
      `).all(...messageIds) as any[];

      sourcesRows.forEach((s) => {
        if (!sourcesMap[s.messageId]) {
          sourcesMap[s.messageId] = [];
        }
        sourcesMap[s.messageId].push({
          documentId: s.documentId,
          documentName: s.documentName,
          pageNumber: s.pageNumber,
          similarityScore: s.similarityScore,
        });
      });
    }

    const formattedMessages = messages.map((m) => ({
      ...m,
      sources: sourcesMap[m.id] || [],
    }));

    res.json({ conversation, messages: formattedMessages });
  } catch (err) {
    console.error('Get conversation error:', err);
    res.status(500).json({ error: 'Failed to get conversation.' });
  }
}

export async function deleteConversation(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const convId = req.params.id;

    const result = db.prepare(`
      DELETE FROM conversations WHERE id = ? AND userId = ?
    `).run(convId, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Conversation not found or unauthorized.' });
      return;
    }

    res.json({ message: 'Conversation deleted successfully.' });
  } catch (err) {
    console.error('Delete conversation error:', err);
    res.status(500).json({ error: 'Failed to delete conversation.' });
  }
}
