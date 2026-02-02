/**
 * Text extraction from various document formats
 * Supports: PDF, DOCX, TXT
 */

import mammoth from 'mammoth';
import PDFParser from 'pdf2json';
import WordsNinjaPack from 'wordsninja';

// Create WordsNinja instance (the package exports a class that must be instantiated)
const wordsNinja = new WordsNinjaPack();

// Initialize WordsNinja dictionary once
let wordsNinjaLoaded = false;
async function ensureWordsNinjaLoaded() {
  if (!wordsNinjaLoaded) {
    console.log('[extractText] Loading WordsNinja dictionary...');
    await wordsNinja.loadDictionary();
    wordsNinjaLoaded = true;
    console.log('[extractText] WordsNinja dictionary loaded');
  }
}

/**
 * Extract text from a PDF buffer using pdf2json
 * This library is designed for Node.js and doesn't require browser APIs
 */
export async function extractFromPDF(buffer) {
  return new Promise((resolve) => {
    try {
      const pdfParser = new PDFParser();

      pdfParser.on('pdfParser_dataReady', async (pdfData) => {
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
          const charSpacedPattern = /^(?:[A-Za-z0-9] ){5,}/;
          if (charSpacedPattern.test(text.trim())) {
            console.log('[extractText] Detected character-spaced text, collapsing spaces...');

            // Step 1: Remove ALL whitespace between characters (collapse everything)
            // This handles "L i s t e n i n g" -> "Listening" and "C  o m p a n y" -> "Company"
            let collapsed = text.replace(/(\S)\s+(?=\S)/g, '$1');

            console.log('[extractText] Collapsed text sample (first 200 chars):', collapsed.substring(0, 200));

            // Step 2: Use WordsNinja to segment collapsed text properly
            // This handles "Whoisspeakinginthetalk" -> "Who is speaking in the talk"
            try {
              await ensureWordsNinjaLoaded();

              // Split by existing punctuation and newlines to preserve structure
              const segments = collapsed.split(/([.?!,;:\n]+)/);
              const resegmented = [];

              for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                // If it's punctuation or newline, keep as-is
                if (/^[.?!,;:\n]+$/.test(segment)) {
                  resegmented.push(segment);
                } else if (segment.trim()) {
                  // For text segments, split by existing spaces first
                  const words = segment.split(/\s+/);
                  const processedWords = [];

                  for (const word of words) {
                    // Skip if word is just numbers, option letters, or very short
                    if (/^\d+$/.test(word) || /^[a-dA-D]\)$/.test(word) || word.length <= 2) {
                      processedWords.push(word);
                    } else if (/^[A-Z][a-z]*[A-Z]/.test(word) || /[a-z][A-Z]/.test(word)) {
                      // Word has mixed case, likely needs segmentation
                      // e.g., "Whoisspeaking" or "LevelAQuestions1"
                      const segmented = wordsNinja.splitSentence(word);
                      if (segmented.length > 1) {
                        processedWords.push(segmented.join(' '));
                      } else {
                        processedWords.push(word);
                      }
                    } else if (word.length > 5) {
                      // Word longer than 5 chars without spaces, try to segment
                      // (lowered from 15 to catch collapsed words like "Astudent", "Toexplain")
                      const segmented = wordsNinja.splitSentence(word);
                      if (segmented.length > 1) {
                        processedWords.push(segmented.join(' '));
                      } else {
                        processedWords.push(word);
                      }
                    } else {
                      processedWords.push(word);
                    }
                  }
                  resegmented.push(processedWords.join(' '));
                }
              }

              collapsed = resegmented.join('');
              console.log('[extractText] After word segmentation (first 300 chars):', collapsed.substring(0, 300));
            } catch (segmentError) {
              console.error('[extractText] Word segmentation error, falling back to heuristics:', segmentError.message);
              // Fall back to basic heuristics if WordsNinja fails
              collapsed = collapsed.replace(/([a-z])([A-Z][a-z]{2,})/g, '$1 $2');
            }

            // Step 3: Fix punctuation that got stuck to words
            // "1." should stay, but "word.Next" -> "word. Next"
            collapsed = collapsed.replace(/([a-z])\.([A-Z])/g, '$1. $2');
            collapsed = collapsed.replace(/([a-z])\?([A-Z])/g, '$1? $2');
            collapsed = collapsed.replace(/([a-z])!([A-Z])/g, '$1! $2');

            // Step 4: Add space after ) when followed by uppercase or number (new question/option)
            collapsed = collapsed.replace(/\.(\d)/g, '. $1');
            collapsed = collapsed.replace(/\)(\d)/g, ') $1');
            collapsed = collapsed.replace(/\)([A-Z])/g, ') $1');

            // Step 5: Fix option patterns - "a)Text" -> "a) Text"
            collapsed = collapsed.replace(/([a-d])\)([A-Z])/gi, '$1) $2');

            // Step 6: Fix common word boundaries that got collapsed
            const wordBoundaryFixes = [
              [/\?([a-d]\))/gi, '? $1'],      // "talk?a)" -> "talk? a)"
              [/\.([a-d]\))/gi, '. $1'],      // "manager.a)" -> "manager. a)"
              [/(\d)\.([A-Z])/g, '$1. $2'],   // "1.What" -> "1. What"
            ];
            for (const [pattern, replacement] of wordBoundaryFixes) {
              collapsed = collapsed.replace(pattern, replacement);
            }

            // Step 7: Add newlines before question numbers so parser can detect them
            // Pattern: period/question mark followed by space and a number followed by period
            collapsed = collapsed.replace(/([.?!])\s+(\d+)\.\s+/g, '$1\n$2. ');

            // Step 8: Fix first question embedded in header (e.g., "LevelAQuestions1." or "Questions1.")
            // Add newline before "1." if preceded by text like "Questions"
            collapsed = collapsed.replace(/([Qq]uestions?\s*)(\d+)\.\s*/g, '$1\n$2. ');
            // Also handle "Level A Questions 1." pattern
            collapsed = collapsed.replace(/(Level\s*[A-Za-z]?\s*Questions?\s*)(\d+)\.\s*/gi, '$1\n$2. ');

            text = collapsed;
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
