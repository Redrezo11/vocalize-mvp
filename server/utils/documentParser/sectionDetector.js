/**
 * Section detector for document parsing
 * Identifies and splits documents into logical sections
 */

import {
  detectSectionType,
  isSectionHeader,
  extractQuestionNumber,
  extractAnswerKeyEntry,
} from './patterns.js';

/**
 * Detect sections in a document
 * Returns an array of sections with their types and content
 */
export function detectSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let currentSection = {
    type: 'unknown',
    startLine: 0,
    lines: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines at the beginning of a section
    if (!trimmed && currentSection.lines.length === 0) {
      currentSection.startLine = i + 1;
      continue;
    }

    // Check if this is a section header
    const sectionType = detectSectionType(trimmed);
    if (sectionType && isSectionHeader(trimmed)) {
      // Save current section if it has content
      if (currentSection.lines.length > 0) {
        sections.push({
          ...currentSection,
          content: currentSection.lines.join('\n').trim(),
        });
      }

      // Start new section
      currentSection = {
        type: sectionType,
        header: trimmed,
        startLine: i,
        lines: [],
      };
      continue;
    }

    // Check for implicit answer key section (consecutive answer entries)
    if (currentSection.type !== 'answerKey' && extractAnswerKeyEntry(trimmed)) {
      // Look ahead to see if there are more answer entries
      let answerCount = 1;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (extractAnswerKeyEntry(lines[j].trim())) {
          answerCount++;
        }
      }

      if (answerCount >= 3) {
        // Likely an answer key section
        if (currentSection.lines.length > 0) {
          sections.push({
            ...currentSection,
            content: currentSection.lines.join('\n').trim(),
          });
        }

        currentSection = {
          type: 'answerKey',
          startLine: i,
          lines: [],
        };
      }
    }

    // Add line to current section
    currentSection.lines.push(line);
  }

  // Save the last section
  if (currentSection.lines.length > 0) {
    sections.push({
      ...currentSection,
      content: currentSection.lines.join('\n').trim(),
    });
  }

  // Post-process sections to determine unknown types
  for (const section of sections) {
    if (section.type === 'unknown') {
      section.type = inferSectionType(section.content);
    }
  }

  return sections;
}

/**
 * Infer section type from content if not explicitly marked
 */
export function inferSectionType(content) {
  const lines = content.split('\n').filter(l => l.trim());

  // Count question patterns
  let questionCount = 0;
  let optionCount = 0;
  let answerKeyCount = 0;

  for (const line of lines) {
    if (extractQuestionNumber(line.trim())) questionCount++;
    if (/^[A-Da-d][).\s]/.test(line.trim())) optionCount++;
    if (extractAnswerKeyEntry(line.trim())) answerKeyCount++;
  }

  // If most lines are answer key entries, it's an answer key
  if (answerKeyCount > lines.length * 0.5) {
    return 'answerKey';
  }

  // If we have questions and options, it's a questions section
  if (questionCount > 0 && optionCount > questionCount) {
    return 'questions';
  }

  // If we have questions but no options, might be a transcript with numbered lines
  if (questionCount > 0 && optionCount === 0) {
    // Check for dialogue markers (e.g., "Man:", "Woman:", "Speaker 1:")
    const dialogueMarkers = content.match(/^[A-Za-z]+\s*\d*\s*:/gm);
    if (dialogueMarkers && dialogueMarkers.length > 2) {
      return 'transcript';
    }
    return 'questions';
  }

  // Check for dialogue/transcript patterns
  const dialoguePattern = /^(?:Man|Woman|Speaker|Person|[A-Z][a-z]+)\s*\d*\s*:/gm;
  const dialogueMatches = content.match(dialoguePattern);
  if (dialogueMatches && dialogueMatches.length >= 2) {
    return 'transcript';
  }

  return 'questions'; // Default assumption
}

/**
 * Split document into structured parts
 */
export function splitDocument(text) {
  const sections = detectSections(text);

  const result = {
    questions: null,
    answerKey: null,
    transcript: null,
    vocabulary: null,
    other: [],
  };

  for (const section of sections) {
    switch (section.type) {
      case 'questions':
        // Concatenate if multiple question sections
        if (result.questions) {
          result.questions += '\n\n' + section.content;
        } else {
          result.questions = section.content;
        }
        break;

      case 'answerKey':
        if (result.answerKey) {
          result.answerKey += '\n' + section.content;
        } else {
          result.answerKey = section.content;
        }
        break;

      case 'transcript':
        if (result.transcript) {
          result.transcript += '\n\n' + section.content;
        } else {
          result.transcript = section.content;
        }
        break;

      case 'vocabulary':
        if (result.vocabulary) {
          result.vocabulary += '\n' + section.content;
        } else {
          result.vocabulary = section.content;
        }
        break;

      default:
        result.other.push(section);
    }
  }

  // If no explicit sections found, treat entire document as questions
  if (!result.questions && !result.answerKey) {
    result.questions = text;
  }

  return result;
}
