/**
 * Text extraction from various document formats
 * Supports: PDF, DOCX, TXT
 */

import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

/**
 * Extract text from a PDF buffer using pdf-parse v2
 * Pure TypeScript cross-platform library with serverless support
 */
export async function extractFromPDF(buffer) {
  try {
    console.log('[extractText] Parsing PDF with pdf-parse v2...');

    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

    console.log('[extractText] PDF parsed successfully, text length:', result.text?.length);

    return {
      success: true,
      text: result.text?.trim() || '',
      pageCount: result.total || 1,
      info: {},
    };
  } catch (error) {
    console.error('[extractText] PDF extraction error:', error.message);
    return {
      success: false,
      error: `Failed to extract text from PDF: ${error.message}`,
      text: '',
    };
  }
}

/**
 * Extract text from a DOCX buffer
 */
export async function extractFromDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return {
      success: true,
      text: result.value,
      warnings: result.messages.filter(m => m.type === 'warning').map(m => m.message),
    };
  } catch (error) {
    console.error('[extractText] DOCX extraction error:', error.message);
    return {
      success: false,
      error: `Failed to extract text from DOCX: ${error.message}`,
      text: '',
    };
  }
}

/**
 * Extract text from a plain text buffer
 */
export function extractFromTXT(buffer) {
  try {
    // Try to detect encoding - default to UTF-8
    let text = buffer.toString('utf-8');

    // If starts with BOM, it's UTF-8 with BOM
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    return {
      success: true,
      text,
    };
  } catch (error) {
    console.error('[extractText] TXT extraction error:', error.message);
    return {
      success: false,
      error: `Failed to read text file: ${error.message}`,
      text: '',
    };
  }
}

/**
 * Detect file type from buffer and filename
 */
export function detectFileType(buffer, filename) {
  const ext = filename ? filename.toLowerCase().split('.').pop() : '';

  // Check by extension first
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'doc') return 'doc';
  if (ext === 'txt') return 'txt';
  if (ext === 'rtf') return 'rtf';

  // Check by magic bytes
  if (buffer.length >= 4) {
    // PDF: starts with %PDF
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return 'pdf';
    }
    // DOCX/ZIP: starts with PK
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
      return 'docx';
    }
  }

  // Default to txt
  return 'txt';
}

/**
 * Extract text from any supported document
 */
export async function extractText(buffer, filename) {
  const fileType = detectFileType(buffer, filename);

  console.log(`[extractText] Detected file type: ${fileType} for ${filename}`);

  switch (fileType) {
    case 'pdf':
      return await extractFromPDF(buffer);

    case 'docx':
      return await extractFromDOCX(buffer);

    case 'doc':
      return {
        success: false,
        error: 'Old .doc format is not supported. Please convert to .docx or PDF.',
        text: '',
      };

    case 'rtf':
      return {
        success: false,
        error: 'RTF format is not supported. Please convert to .docx, PDF, or plain text.',
        text: '',
      };

    case 'txt':
    default:
      return extractFromTXT(buffer);
  }
}

/**
 * Preprocess extracted text for parsing
 */
export function preprocessText(text) {
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive blank lines (more than 2 in a row)
    .replace(/\n{4,}/g, '\n\n\n')
    // Normalize whitespace within lines (but preserve indentation)
    .replace(/[ \t]+/g, ' ')
    // Remove leading/trailing whitespace from lines
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Trim overall
    .trim();
}
