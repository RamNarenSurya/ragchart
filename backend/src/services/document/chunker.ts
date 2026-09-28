import { ExtractedPage } from './extractor.js';

export interface Chunk {
  chunkIndex: number;
  pageNumber: number;
  content: string;
}

export interface ChunkOptions {
  chunkSize?: number; // character count (~600 chars)
  chunkOverlap?: number; // overlap character count (~120 chars)
}

export function chunkDocumentPages(
  pages: ExtractedPage[],
  options: ChunkOptions = {}
): Chunk[] {
  const chunkSize = options.chunkSize || 700;
  const chunkOverlap = options.chunkOverlap || 120;
  const chunks: Chunk[] = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;

    if (text.length <= chunkSize) {
      chunks.push({
        chunkIndex: globalChunkIndex++,
        pageNumber: page.pageNumber,
        content: text,
      });
      continue;
    }

    // Split page text into overlapping windows
    let start = 0;
    while (start < text.length) {
      let end = start + chunkSize;

      // Try to break at natural boundary (newline or period)
      if (end < text.length) {
        const boundary = text.lastIndexOf('\n', end);
        const periodBoundary = text.lastIndexOf('. ', end);
        const chosenBoundary = Math.max(boundary, periodBoundary);

        if (chosenBoundary > start + chunkSize / 2) {
          end = chosenBoundary + 1;
        }
      } else {
        end = text.length;
      }

      const chunkText = text.substring(start, end).trim();
      if (chunkText.length > 20) {
        chunks.push({
          chunkIndex: globalChunkIndex++,
          pageNumber: page.pageNumber,
          content: chunkText,
        });
      }

      if (end >= text.length) break;
      start = end - chunkOverlap;
    }
  }

  return chunks;
}
