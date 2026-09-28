import { Router } from 'express';
import {
  sendMessage,
  getConversations,
  createConversation,
  getConversationById,
  deleteConversation,
} from '../controllers/chatController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.post('/chat', sendMessage);
router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:id', getConversationById);
router.delete('/conversations/:id', deleteConversation);

export default router;
