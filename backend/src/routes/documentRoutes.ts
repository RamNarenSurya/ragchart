import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';
import {
  uploadDocument,
  listDocuments,
  getDocumentById,
  reprocessDocument,
  deleteDocument,
} from '../controllers/documentController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.pdf', '.docx', '.doc', '.txt', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File format ${ext} is not supported. Please upload PDF, DOCX, or TXT documents.`));
    }
  },
});

const router = Router();

router.use(authenticateToken);

router.get('/documents', listDocuments);
router.get('/documents/:id', getDocumentById);

// Admin-only document actions
router.post('/documents', requireAdmin, upload.single('file'), uploadDocument);
router.post('/documents/:id/reprocess', requireAdmin, reprocessDocument);
router.delete('/documents/:id', requireAdmin, deleteDocument);

export default router;
