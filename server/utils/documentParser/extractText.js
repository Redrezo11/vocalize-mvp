/**
 * Text extraction from various document formats
 * Supports: PDF, DOCX, TXT
 */

import mammoth from 'mammoth';
import PDFParser from 'pdf2json';

/**
 * Extract text from a PDF buffer using pdf2json
 * This library is designed for Node.js and doesn't require browser APIs
 */
export async function extractFromPDF(buffer) {
  return new Promise((resolve) => {
    try {
      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          // Extract text from all pages
          const pages = pdfData.Pages || [];
          const textParts = [];

          for (const page of pages) {
            const pageTexts = [];
            for (const textItem of (page.Texts || [])) {
              for (const run of (textItem.R || [])) {
                if (run.T) {
                  // Decode URI-encoded text
                  pageTexts.push(decodeURIComponent(run.T));
                }
              }
            }
            textParts.push(pageTexts.join(' '));
          }

          let text = textParts.join('\n\n');

          // Fix character-spaced text (common in some PDFs where each char is positioned separately)
          // Detect if text has the pattern of single chars separated by spaces: "L i s t e n i n g"
          // Check by looking for repeated "char space char space" patterns
          const charSpacedPattern = /^(?:[A-Za-z0-9] ){5,}/;
          if (charSpacedPattern.test(text.trim())) {
            console.log('[extractText] Detected character-spaced text, collapsing spaces...');
            // Remove spaces between single characters
            // Match: single char, space, single char (lookahead to not consume)
            // Repeat until we hit a natural word boundary (double space or punctuation with space)
            text = text.replace(/([A-Za-z0-9]) (?=[A-Za-z0-9] |[A-Za-z0-9]$|[A-Za-z0-9][.,!?:;'")])/g, '$1');
            // Clean up: handle remaining single-char patterns
            text = text.replace(/([A-Za-z0-9]) ([A-Za-z0-9])$/gm, '$1$2');
            // Normalize multiple spaces to single
            text = text.replace(/  +/g, ' ');
          }

          resolve({
            success: true,
            text: text.trim(),
            pageCount: pages.length,
            info: pdfData.Meta || {},
          });
        } catch (parseError) {
          console.error('[extractText] PDF text extraction error:', parseError.message);
          resolve({
            success: false,
            error: `Failed to extract text from PDF: ${parseError.message}`,
            text: '',
          });
        }
      });

      pdfParser.on('pdfParser_dataError', (errData) => {
        console.error('[extractText] PDF parsing error:', errData.parserError);
        resolve({
          success: false,
          error: `Failed to parse PDF: ${errData.parserError}`,
          text: '',
        });
      });

      // Parse the buffer
      pdfParser.parseBuffer(buffer);
    } catch (error) {
      console.error('[extractText] PDF extraction error:', error.message);
      resolve({
        success: false,
        error: `Failed to extract text from PDF: ${error.message}`,
        text: '',
      });
    }
  });
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
