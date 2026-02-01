/**
 * Question parser for extracting structured questions from text
 */

import {
  extractQuestionNumber,
  extractOption,
  extractAnswerKeyEntry,
  extractStandaloneAnswer,
} from './patterns.js';

/**
 * Parse answer key section into a map of question number -> answer
 */
export function parseAnswerKey(answerKeyText) {
  if (!answerKeyText) return {};

  const answers = {};
  const lines = answerKeyText.split('\n');

  for (const line of lines) {
    const entry = extractAnswerKeyEntry(line.trim());
    if (entry) {
      answers[entry.questionNumber] = entry.answer;
    }
  }

  return answers;
}

/**
 * Parse questions from text content
 */
export function parseQuestions(questionsText, answerKeyMap = {}) {
  if (!questionsText) return { questions: [], warnings: [] };

  const lines = questionsText.split('\n');
  const questions = [];
  const warnings = [];

  let currentQuestion = null;
  let collectingOptions = false;
  let lineBuffer = [];

  const saveCurrentQuestion = () => {
    if (currentQuestion) {
      // Apply answer from answer key if not found inline
      if (!currentQuestion.correctAnswer && answerKeyMap[currentQuestion.number]) {
        currentQuestion.correctAnswer = answerKeyMap[currentQuestion.number];
      }

      // Generate unique ID
      currentQuestion.id = `q${currentQuestion.number}`;

      // Check for issues
      const optionCount = Object.keys(currentQuestion.options).length;
      if (optionCount === 0) {
        warnings.push(`Question ${currentQuestion.number}: No options detected`);
      } else if (optionCount < 4) {
        warnings.push(`Question ${currentQuestion.number}: Only ${optionCount} options found`);
      }

      if (!currentQuestion.correctAnswer) {
        warnings.push(`Question ${currentQuestion.number}: No correct answer found`);
      }

      questions.push(currentQuestion);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      // If we were collecting multi-line question text, empty line might end it
      if (lineBuffer.length > 0 && !collectingOptions) {
        if (currentQuestion) {
          currentQuestion.questionText = lineBuffer.join(' ').trim();
        }
        lineBuffer = [];
        collectingOptions = true;
      }
      continue;
    }

    // Check for new question
    const questionMatch = extractQuestionNumber(trimmed);
    if (questionMatch) {
      // Save previous question
      saveCurrentQuestion();

      // Start new question
      currentQuestion = {
        number: questionMatch.number,
        questionText: questionMatch.rest,
        options: {},
        correctAnswer: null,
      };
      lineBuffer = questionMatch.rest ? [questionMatch.rest] : [];
      collectingOptions = false;
      continue;
    }

    // Check for option
    const optionMatch = extractOption(trimmed);
    if (optionMatch && currentQuestion) {
      // If we had buffered text, it's the question text
      if (lineBuffer.length > 0 && !currentQuestion.questionText) {
        currentQuestion.questionText = lineBuffer.join(' ').trim();
        lineBuffer = [];
      }

      currentQuestion.options[optionMatch.letter] = optionMatch.text;
      if (optionMatch.isCorrect) {
        currentQuestion.correctAnswer = optionMatch.letter;
      }
      collectingOptions = true;
      continue;
    }

    // Check for standalone answer line
    const standaloneAnswer = extractStandaloneAnswer(trimmed);
    if (standaloneAnswer && currentQuestion) {
      currentQuestion.correctAnswer = standaloneAnswer;
      continue;
    }

    // Otherwise, buffer the line as potential question text continuation
    if (currentQuestion && !collectingOptions) {
      lineBuffer.push(trimmed);
    } else if (currentQuestion && collectingOptions) {
      // Might be continuation of last option or standalone answer
      const lastOptionLetter = Object.keys(currentQuestion.options).pop();
      if (lastOptionLetter && !extractOption(trimmed)) {
        // Could be continuation of the option text
        currentQuestion.options[lastOptionLetter] += ' ' + trimmed;
      }
    }
  }

  // Save the last question
  if (lineBuffer.length > 0 && currentQuestion && !currentQuestion.questionText) {
    currentQuestion.questionText = lineBuffer.join(' ').trim();
  }
  saveCurrentQuestion();

  return { questions, warnings };
}

/**
 * Calculate confidence score for parsed questions
 */
export function calculateConfidence(questions, warnings) {
  let score = 100;

  if (questions.length === 0) {
    return 0;
  }

  // Deduct for missing options
  for (const q of questions) {
    const optionCount = Object.keys(q.options).length;
    if (optionCount === 0) {
      score -= 15;
    } else if (optionCount < 4) {
      score -= (4 - optionCount) * 3;
    }
  }

  // Deduct for missing answers
  const questionsWithoutAnswer = questions.filter(q => !q.correctAnswer).length;
  score -= questionsWithoutAnswer * 5;

  // Deduct for warnings
  score -= warnings.length * 2;

  // Check sequential numbering
  let sequential = true;
  for (let i = 0; i < questions.length; i++) {
    if (questions[i].number !== i + 1) {
      sequential = false;
      break;
    }
  }
  if (!sequential && questions.length > 1) {
    score -= 10;
  }

  // Ensure score is in range [0, 100]
  return Math.max(0, Math.min(100, score));
}

/**
 * Convert parsed questions to the TestQuestion format
 */
export function toTestQuestionFormat(parsedQuestions) {
  return parsedQuestions.map(q => ({
    id: q.id,
    questionText: q.questionText || '',
    options: [
      q.options.A || '',
      q.options.B || '',
      q.options.C || '',
      q.options.D || '',
    ].filter(opt => opt), // Remove empty options
    correctAnswer: q.correctAnswer || '',
    explanation: '',
    explanationArabic: '',
  }));
}
