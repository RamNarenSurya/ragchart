import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config/index.js';
import { initDatabase } from './db/index.js';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(config.uploadDir));

// Health check endpoint (Public)
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'RAG-Based College Chatbot API',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);
app.use('/api', documentRoutes);
app.use('/api', adminRoutes);

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

function startServerOnPort(port: number) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 College RAG Chatbot Backend running at http://localhost:${port}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use. Retrying on ${nextPort}...`);
      startServerOnPort(nextPort);
      return;
    }

    console.error('❌ Failed to start backend server:', error);
    process.exit(1);
  });
}

async function startServer() {
  await initDatabase();
  startServerOnPort(config.port);
}

startServer().catch((error) => {
  console.error('❌ Backend startup failed:', error);
  process.exit(1);
});
