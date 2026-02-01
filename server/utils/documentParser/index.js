/**
 * Document Parser - Main Entry Point
 * Parses PDF, DOCX, and TXT files containing test questions
 */

import { extractText, preprocessText } from './extractText.js';
import { splitDocument } from './sectionDetector.js';
import {
  parseAnswerKey,
  parseQuestions,
  calculateConfidence,
  toTestQuestionFormat,
} from './questionParser.js';

/**
 * Parse a document and extract structured test questions
 *
 * @param {Buffer} buffer - The file buffer
 * @param {string} filename - Original filename (for type detection)
 * @returns {Promise<ParseResult>}
 */
export async function parseDocument(buffer, filename) {
  const result = {
    success: false,
    questions: [],
    transcript: null,
    vocabulary: null,
    confidence: 0,
    warnings: [],
    rawText: '',
    error: null,
  };

  try {
    // Step 1: Extract text from document
    console.log(`[DocumentParser] Extracting text from: ${filename}`);
    const extraction = await extractText(buffer, filename);

    if (!extraction.success) {
      result.error = extraction.error;
      return result;
    }

    if (!extraction.text || extraction.text.trim().length === 0) {
      result.error = 'Document appears to be empty or could not be read.';
      return result;
    }

    // Step 2: Preprocess text
    const processedText = preprocessText(extraction.text);
    result.rawText = processedText;

    console.log(`[DocumentParser] Extracted ${processedText.length} characters`);

    // Step 3: Detect and split sections
    const sections = splitDocument(processedText);
    console.log('[DocumentParser] Detected sections:', {
      hasQuestions: !!sections.questions,
      hasAnswerKey: !!sections.answerKey,
      hasTranscript: !!sections.transcript,
      hasVocabulary: !!sections.vocabulary,
    });

    // Store transcript and vocabulary if found
    result.transcript = sections.transcript;
    result.vocabulary = sections.vocabulary;

    // Step 4: Parse answer key if present
    const answerKeyMap = parseAnswerKey(sections.answerKey);
    console.log(`[DocumentParser] Parsed ${Object.keys(answerKeyMap).length} answers from key`);

    // Step 5: Parse questions
    const { questions, warnings } = parseQuestions(sections.questions, answerKeyMap);
    console.log(`[DocumentParser] Parsed ${questions.length} questions with ${warnings.length} warnings`);

    result.warnings = warnings;

    // Step 6: Calculate confidence
    result.confidence = calculateConfidence(questions, warnings);
    console.log(`[DocumentParser] Confidence score: ${result.confidence}`);

    // Step 7: Convert to TestQuestion format
    result.questions = toTestQuestionFormat(questions);
    result.success = true;

    // Add low confidence warning
    if (result.confidence < 50) {
      result.warnings.unshift(
        'Low confidence in parsing results. Please review carefully or consider using AI-assisted parsing.'
      );
    }

    return result;

  } catch (error) {
    console.error('[DocumentParser] Unexpected error:', error);
    result.error = `Unexpected error while parsing document: ${error.message}`;
    return result;
  }
}

/**
 * Get supported file types
 */
export function getSupportedTypes() {
  return {
    supported: ['pdf', 'docx', 'txt'],
    unsupported: ['doc', 'rtf'],
    mimeTypes: {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt',
    },
  };
}

/**
 * Validate file before parsing
 */
export function validateFile(filename, size, maxSizeMB = 10) {
  const ext = filename.toLowerCase().split('.').pop();
  const supported = getSupportedTypes().supported;

  if (!supported.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file type: .${ext}. Supported types: ${supported.join(', ')}`,
    };
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (size > maxBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${maxSizeMB}MB.`,
    };
  }

  return { valid: true };
}
