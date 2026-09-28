import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractionResult {
  text: string;
  pages: ExtractedPage[];
}

export async function extractTextFromFile(filePath: string, mimeType: string, filename: string): Promise<ExtractionResult> {
  const extension = filename.split('.').pop()?.toLowerCase();

  if (mimeType.includes('pdf') || extension === 'pdf') {
    return extractFromPdf(filePath);
  } else if (
    mimeType.includes('wordprocessingml') ||
    mimeType.includes('msword') ||
    extension === 'docx' ||
    extension === 'doc'
  ) {
    return extractFromDocx(filePath);
  } else {
    // Plain text or CSV or fallback
    return extractFromTxt(filePath);
  }
}

async function extractFromPdf(filePath: string): Promise<ExtractionResult> {
  const dataBuffer = fs.readFileSync(filePath);
  const pages: ExtractedPage[] = [];

  // pdf-parse callback to capture page numbers
  const renderPage = (pageData: any) => {
    return pageData.getTextContent().then((textContent: any) => {
      let lastY, text = '';
      for (const item of textContent.items) {
        if (lastY === item.transform[5] || !lastY) {
          text += item.str + ' ';
        } else {
          text += '\n' + item.str + ' ';
        }
        lastY = item.transform[5];
      }
      pages.push({
        pageNumber: pageData.pageIndex + 1,
        text: cleanText(text),
      });
      return text;
    });
  };

  const data = await pdfParse(dataBuffer, { pagerender: renderPage });

  // If pages array wasn't populated properly by pagerender
  if (pages.length === 0) {
    const totalPages = data.numpages || 1;
    const splitText = data.text.split('\n\n');
    const chunksPerPage = Math.ceil(splitText.length / totalPages);

    for (let i = 0; i < totalPages; i++) {
      const pageContent = splitText.slice(i * chunksPerPage, (i + 1) * chunksPerPage).join('\n');
      pages.push({
        pageNumber: i + 1,
        text: cleanText(pageContent),
      });
    }
  }

  return {
    text: cleanText(data.text),
    pages,
  };
}

async function extractFromDocx(filePath: string): Promise<ExtractionResult> {
  const result = await mammoth.extractRawText({ path: filePath });
  const cleaned = cleanText(result.value);

  // Divide into estimated pages based on ~1500 chars per page
  const pages: ExtractedPage[] = [];
  const pageSize = 1500;
  const totalLength = cleaned.length;
  let offset = 0;
  let pageNum = 1;

  while (offset < totalLength) {
    const end = Math.min(offset + pageSize, totalLength);
    pages.push({
      pageNumber: pageNum++,
      text: cleaned.substring(offset, end),
    });
    offset = end;
  }

  if (pages.length === 0) {
    pages.push({ pageNumber: 1, text: cleaned });
  }

  return {
    text: cleaned,
    pages,
  };
}

async function extractFromTxt(filePath: string): Promise<ExtractionResult> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const cleaned = cleanText(content);
  
  const pages: ExtractedPage[] = [];
  const pageSize = 1500;
  let offset = 0;
  let pageNum = 1;

  while (offset < cleaned.length) {
    const end = Math.min(offset + pageSize, cleaned.length);
    pages.push({
      pageNumber: pageNum++,
      text: cleaned.substring(offset, end),
    });
    offset = end;
  }

  if (pages.length === 0) {
    pages.push({ pageNumber: 1, text: cleaned });
  }

  return {
    text: cleaned,
    pages,
  };
}

export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}
