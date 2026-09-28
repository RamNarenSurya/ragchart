import { config } from '../../config/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

const VECTOR_DIMENSION = 128;

export async function generateEmbedding(text: string): Promise<number[]> {
  const cleanInput = text.replace(/\s+/g, ' ').trim();
  if (!cleanInput) {
    return new Array(VECTOR_DIMENSION).fill(0);
  }

  // Fast, deterministic local dense vector encoder (128 dimensions)
  return generateLocalVector(cleanInput);
}

function generateLocalVector(text: string): number[] {
  const vector = new Array(VECTOR_DIMENSION).fill(0);
  const normalized = text.toLowerCase();
  const words = normalized.split(/[^a-z0-9]+/i).filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    hashStringToVector(word, vector, 1.0);

    if (i < words.length - 1) {
      const bigram = `${word}_${words[i + 1]}`;
      hashStringToVector(bigram, vector, 0.8);
    }
  }

  for (let i = 0; i < normalized.length - 2; i++) {
    const trigram = normalized.substring(i, i + 3);
    hashStringToVector(trigram, vector, 0.3);
  }

  let norm = 0;
  for (let i = 0; i < VECTOR_DIMENSION; i++) {
    norm += vector[i] * vector[i];
  }

  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIMENSION; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
}

function hashStringToVector(str: string, vector: number[], weight: number) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  const index = Math.abs(hash) % VECTOR_DIMENSION;
  const sign = (hash & 1) === 0 ? 1 : -1;
  vector[index] += sign * weight;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
