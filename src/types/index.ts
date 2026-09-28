export type UserRole = 'STUDENT' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Source {
  documentId: string;
  documentName: string;
  pageNumber: number;
  similarityScore: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  sources?: Source[];
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
  chunkCount: number;
  uploadedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStatistics {
  totalDocuments: number;
  readyDocuments: number;
  processingDocuments: number;
  failedDocuments: number;
  totalUsers: number;
  totalQueries: number;
  totalChunks: number;
}

export interface LoginLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  ipAddress: string;
  loginTime: string;
}
