/**
 * Regex patterns for document parsing
 * Handles various formats of test questions and answers
 */

// Question number patterns
export const QUESTION_NUMBER_PATTERNS = [
  /^(\d+)\.\s*/,                           // 1.
  /^(\d+)\)\s*/,                           // 1)
  /^Q(\d+)[.:]\s*/i,                       // Q1. or Q1:
  /^Question\s*(\d+)[.:]\s*/i,             // Question 1. or Question 1:
  /^#(\d+)[.:]\s*/,                        // #1. or #1:
];

// Option/choice patterns (A, B, C, D)
export const OPTION_PATTERNS = [
  /^([A-Da-d])\)\s*/,                      // A) or a)
  /^([A-Da-d])\.\s*/,                      // A. or a.
  /^\(([A-Da-d])\)\s*/,                    // (A) or (a)
  /^([A-Da-d]):\s*/,                       // A: or a:
  /^([A-Da-d])\s*[-–—]\s*/,                // A - or A –
];

// Correct answer indicators (inline with option)
export const INLINE_CORRECT_PATTERNS = [
  /\*$/,                                   // ends with *
  /^\*/,                                   // starts with *
  /\(correct\)/i,                          // (correct)
  /\[correct\]/i,                          // [correct]
  /✓|✔|√/,                                 // checkmarks
  /\s+\*\s*$/,                             // space then asterisk at end
];

// Answer key patterns (for separate answer section)
export const ANSWER_KEY_LINE_PATTERNS = [
  /^(\d+)[.:]\s*([A-Da-d])\s*$/i,          // 1. A or 1: B
  /^(\d+)\)\s*([A-Da-d])\s*$/i,            // 1) A
  /^Q?(\d+)[.:]\s*([A-Da-d])\s*$/i,        // Q1. A
  /^(\d+)\s*[-–—]\s*([A-Da-d])\s*$/i,      // 1 - A
];

// Section header patterns
export const SECTION_PATTERNS = {
  questions: [
    /^(?:part|section)\s*(?:\d+|[a-z])?[.:]\s*(?:questions?|listening|comprehension)/i,
    /^questions?\s*$/i,
    /^listening\s+(?:comprehension|test|exercise)/i,
    /^(?:part|section)\s*(?:\d+|[a-z])\s*$/i,
  ],
  answerKey: [
    /^answers?\s*(?:key)?:?\s*$/i,
    /^(?:answer|correct)\s+key\s*$/i,
    /^key\s*$/i,
    /^solutions?\s*$/i,
    /^answer\s+sheet\s*$/i,
  ],
  transcript: [
    /^transcri?pt\s*$/i,
    /^dialogue\s*$/i,
    /^listening\s+(?:text|script)\s*$/i,
    /^audio\s+(?:script|text)\s*$/i,
    /^script\s*$/i,
    /^text\s*$/i,
  ],
  vocabulary: [
    /^vocabular?y\s*$/i,
    /^key\s+words?\s*$/i,
    /^lexis\s*$/i,
    /^word\s+list\s*$/i,
    /^new\s+words?\s*$/i,
    /^glossary\s*$/i,
  ],
};

// Standalone correct answer line patterns
export const STANDALONE_ANSWER_PATTERNS = [
  /^(?:correct\s+)?answer[s]?[.:]\s*([A-Da-d])\s*$/i,     // Answer: A
  /^correct[.:]\s*([A-Da-d])\s*$/i,                        // Correct: A
  /^key[.:]\s*([A-Da-d])\s*$/i,                            // Key: A
  /^ans[.:]\s*([A-Da-d])\s*$/i,                            // Ans: A
];

/**
 * Test if a line matches any pattern in an array
 */
export function matchesAny(line, patterns) {
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) return match;
  }
  return null;
}

/**
 * Extract question number from a line
 */
export function extractQuestionNumber(line) {
  const match = matchesAny(line.trim(), QUESTION_NUMBER_PATTERNS);
  if (match) {
    return {
      number: parseInt(match[1], 10),
      rest: line.trim().slice(match[0].length),
    };
  }
  return null;
}

/**
 * Extract option letter and text from a line
 */
export function extractOption(line) {
  const trimmed = line.trim();
  const match = matchesAny(trimmed, OPTION_PATTERNS);
  if (match) {
    const letter = match[1].toUpperCase();
    let text = trimmed.slice(match[0].length);

    // Check for inline correct markers
    let isCorrect = false;
    for (const pattern of INLINE_CORRECT_PATTERNS) {
      if (pattern.test(text)) {
        isCorrect = true;
        // Remove the marker from text
        text = text.replace(/\*|\(correct\)|\[correct\]|✓|✔|√/gi, '').trim();
        break;
      }
    }

    return { letter, text, isCorrect };
  }
  return null;
}

/**
 * Extract answer from answer key line
 */
export function extractAnswerKeyEntry(line) {
  const match = matchesAny(line.trim(), ANSWER_KEY_LINE_PATTERNS);
  if (match) {
    return {
      questionNumber: parseInt(match[1], 10),
      answer: match[2].toUpperCase(),
    };
  }
  return null;
}

/**
 * Extract standalone correct answer
 */
export function extractStandaloneAnswer(line) {
  const match = matchesAny(line.trim(), STANDALONE_ANSWER_PATTERNS);
  if (match) {
    return match[1].toUpperCase();
  }
  return null;
}

/**
 * Detect section type from a line
 */
export function detectSectionType(line) {
  const trimmed = line.trim();

  for (const [sectionType, patterns] of Object.entries(SECTION_PATTERNS)) {
    if (matchesAny(trimmed, patterns)) {
      return sectionType;
    }
  }
  return null;
}

/**
 * Check if a line is likely a section header
 */
export function isSectionHeader(line) {
  const trimmed = line.trim();
  // Short line, possibly all caps or title case, no question/option patterns
  if (trimmed.length > 100) return false;
  if (extractQuestionNumber(trimmed)) return false;
  if (extractOption(trimmed)) return false;

  // Check for section patterns
  if (detectSectionType(trimmed)) return true;

  // Check for all caps short line
  if (trimmed.length < 50 && trimmed === trimmed.toUpperCase() && /^[A-Z\s\d:.-]+$/.test(trimmed)) {
    return true;
  }

  return false;
}
