import React, { useState, useMemo } from 'react';
import { SavedAudio, TestType, TestQuestion, ListeningTest, LexisItem } from '../types';
import { ArrowLeftIcon, PlusIcon, TrashIcon, SparklesIcon, CopyIcon, DownloadIcon, BookOpenIcon } from './Icons';
import { parseDialogue } from '../utils/parser';
import { CEFRLevel } from './Settings';
import DocumentImport from './DocumentImport';

interface TestBuilderProps {
  audio: SavedAudio;
  existingTest?: ListeningTest;
  defaultDifficulty?: CEFRLevel;
  onSave: (test: Omit<ListeningTest, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 11);

// Extract words from transcript for fill-in-blank
const extractWords = (transcript: string): string[] => {
  return transcript
    .replace(/^[A-Za-z]+:\s*/gm, '') // Remove speaker labels
    .split(/\s+/)
    .filter(word => word.length > 3) // Only words longer than 3 chars
    .map(word => word.replace(/[.,!?;:'"]/g, '').toLowerCase());
};

// CEFR difficulty level descriptions
const getCEFRDescription = (level: CEFRLevel): string => {
  switch (level) {
    case 'A1':
      return 'A1 (Beginner): Use very simple vocabulary and short sentences. Focus on basic comprehension of familiar words and phrases.';
    case 'A2':
      return 'A2 (Elementary): Use common vocabulary and straightforward questions. Focus on routine matters and direct exchange of information.';
    case 'B1':
      return 'B1 (Intermediate): Use moderately complex language. Questions can involve main points, opinions, and some inference from context.';
    case 'B2':
      return 'B2 (Upper-Intermediate): Use more sophisticated vocabulary and complex structures. Questions can involve nuance, implied meaning, and detailed comprehension.';
    case 'C1':
      return 'C1 (Advanced): Use complex language and abstract concepts. Questions can involve subtle meaning, inference, and critical analysis.';
  }
};

// LLM Template for question generation
const getLLMTemplate = (
  testType: TestType,
  transcript: string,
  customPrompt: string,
  includeExplanations: boolean,
  explanationStyle: string,
  questionCount: number,
  explanationLanguage: 'english' | 'arabic' | 'both',
  difficultyLevel: CEFRLevel
): string => {
  // Generate explanation fields based on language selection
  let explanationFields = '';
  let explanationRule = '';

  if (includeExplanations) {
    if (explanationLanguage === 'both') {
      explanationFields = `,
    "explanation": "English explanation here",
    "explanationArabic": "الشرح بالعربية هنا"`;
      explanationRule = `\n- explanation: ${explanationStyle || 'Provide a brief explanation in English for each answer'}.
- explanationArabic: Provide the same explanation in Arabic (العربية).`;
    } else if (explanationLanguage === 'arabic') {
      explanationFields = `,
    "explanationArabic": "الشرح بالعربية هنا"`;
      explanationRule = `\n- explanationArabic: ${explanationStyle || 'Provide a brief explanation in Arabic (العربية) for each answer'}.`;
    } else {
      explanationFields = `,
    "explanation": "English explanation here"`;
      explanationRule = `\n- explanation: ${explanationStyle || 'Provide a brief explanation in English for each answer'}.`;
    }
  }

  const levelDescription = getCEFRDescription(difficultyLevel);

  const baseInstructions = `Based on the following transcript, generate questions for a listening comprehension test.

TARGET LEARNER LEVEL: ${difficultyLevel.toUpperCase()}
${levelDescription}

TRANSCRIPT:
---
${transcript}
---

${customPrompt ? `ADDITIONAL INSTRUCTIONS:\n${customPrompt}\n\n` : ''}IMPORTANT: Return ONLY a valid JSON array. Do not include any other text, markdown, or explanation.`;

  if (testType === 'listening-comprehension') {
    return `${baseInstructions}

Generate ${questionCount} multiple choice questions. Each question should test understanding of the content.

JSON FORMAT (return exactly this structure):
[
  {
    "questionText": "Your question here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A"${explanationFields}
  }
]

RULES:
- questionText: Clear question about the content
- options: Exactly 4 options (A, B, C, D)
- correctAnswer: Must match one of the options exactly${explanationRule}`;
  } else if (testType === 'fill-in-blank') {
    return `${baseInstructions}

Generate ${questionCount} fill-in-the-blank questions using key vocabulary or phrases from the transcript.

JSON FORMAT (return exactly this structure):
[
  {
    "questionText": "Complete the sentence: The speaker said _____ about the topic.",
    "correctAnswer": "missing word or phrase"${explanationFields}
  }
]

RULES:
- questionText: A sentence with _____ marking the blank
- correctAnswer: The word(s) that fill the blank${explanationRule}`;
  } else {
    const dictationCount = Math.min(questionCount, 5); // Cap dictation at 5
    return `${baseInstructions}

Generate ${dictationCount} dictation exercises. Each should be a meaningful segment from the transcript.

JSON FORMAT (return exactly this structure):
[
  {
    "questionText": "Listen and write what you hear (Segment 1)",
    "correctAnswer": "The exact text the learner should write"${explanationFields}
  }
]

RULES:
- questionText: Instructions for the dictation segment
- correctAnswer: The exact text to transcribe${explanationRule}`;
  }
};

// Calculate suggested lexis count based on word count
const getSuggestedLexisCount = (transcript: string): number => {
  const wordCount = transcript.split(/\s+/).filter(w => w.length > 0).length;
  // Roughly 1 vocab item per 15-20 words, min 5, max 15
  const suggested = Math.round(wordCount / 17);
  return Math.min(Math.max(suggested, 5), 15);
};

// LLM Template for lexis generation
const getLexisLLMTemplate = (
  transcript: string,
  customPrompt: string,
  lexisCount: number,
  difficultyLevel: CEFRLevel
): string => {
  const levelDescription = getCEFRDescription(difficultyLevel);

  return `Extract key vocabulary (lexis) from the following listening transcript for EFL learners.

TARGET LEARNER LEVEL: ${difficultyLevel.toUpperCase()}
${levelDescription}

TRANSCRIPT:
---
${transcript}
---

${customPrompt ? `ADDITIONAL INSTRUCTIONS:\n${customPrompt}\n\n` : ''}Generate ${lexisCount} vocabulary items that are important for understanding this listening passage.

IMPORTANT: Return ONLY a valid JSON array. Do not include any other text, markdown, or explanation.

JSON FORMAT (return exactly this structure):
[
  {
    "term": "vocabulary word or phrase",
    "definition": "Clear English definition appropriate for ${difficultyLevel} level",
    "definitionArabic": "كلمة عربية",
    "example": "Example sentence using the term (preferably from or related to the transcript)",
    "partOfSpeech": "noun/verb/adjective/adverb/phrase/idiom"
  }
]

RULES:
- term: The vocabulary word or phrase from the transcript
- definition: Clear, simple English definition appropriate for ${difficultyLevel} learners
- definitionArabic: Simple Arabic translation word(s) only - NOT a definition or explanation. Just the direct Arabic equivalent for easy memorization (e.g., "travel" → "يسافر", "library" → "مكتبة")
- example: A contextual example sentence (can be from the transcript or created)
- partOfSpeech: Grammatical category (noun, verb, adjective, adverb, phrase, idiom, etc.)

Focus on:
- Words that are essential for understanding the main ideas
- Vocabulary that ${difficultyLevel} learners might not know
- Useful phrases and expressions from the dialogue
- Academic or topic-specific vocabulary`;
};

// Get a readable label for test type
const getTestTypeLabel = (type: TestType): string => {
  switch (type) {
    case 'listening-comprehension':
      return 'Comprehension';
    case 'fill-in-blank':
      return 'Fill in Blank';
    case 'dictation':
      return 'Dictation';
    default:
      return type;
  }
};

// Generate a smart default title
const generateDefaultTitle = (audioTitle: string, testType: TestType): string => {
  const typeLabel = getTestTypeLabel(testType);
  const date = new Date();
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${audioTitle} - ${typeLabel} (${dateStr}, ${timeStr})`;
};

export const TestBuilder: React.FC<TestBuilderProps> = ({ audio, existingTest, defaultDifficulty = 'B1', onSave, onCancel }) => {
  const [testType, setTestType] = useState<TestType>(existingTest?.type || 'listening-comprehension');
  const [testTitle, setTestTitle] = useState(existingTest?.title || generateDefaultTitle(audio.title, existingTest?.type || 'listening-comprehension'));
  const [questions, setQuestions] = useState<TestQuestion[]>(existingTest?.questions || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Custom prompt settings
  const [customPrompt, setCustomPrompt] = useState('');
  const [includeExplanations, setIncludeExplanations] = useState(false);
  const [explanationStyle, setExplanationStyle] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [explanationLanguage, setExplanationLanguage] = useState<'english' | 'arabic' | 'both'>('both');
  const [difficultyLevel, setDifficultyLevel] = useState<CEFRLevel>(defaultDifficulty);

  // Update explanations modal state
  const [showUpdateExplanationsModal, setShowUpdateExplanationsModal] = useState(false);
  const [updateExplanationPrompt, setUpdateExplanationPrompt] = useState('');
  const [updateExplanationLanguage, setUpdateExplanationLanguage] = useState<'english' | 'arabic'>('english');
  const [updateExplanationMode, setUpdateExplanationMode] = useState<'replace' | 'supplement'>('supplement');
  const [updateExplanationPaste, setUpdateExplanationPaste] = useState('');
  const [showImportSection, setShowImportSection] = useState(false);
  const [showDocumentImport, setShowDocumentImport] = useState(false);

  // Lexis (vocabulary) state
  const [lexis, setLexis] = useState<LexisItem[]>(() => {
    console.log('[TestBuilder] Initializing lexis state');
    console.log('[TestBuilder] existingTest:', existingTest);
    console.log('[TestBuilder] existingTest?.lexis:', existingTest?.lexis);
    return existingTest?.lexis || [];
  });
  const [showLexisModal, setShowLexisModal] = useState(false);
  const [lexisCustomPrompt, setLexisCustomPrompt] = useState('');
  const [lexisPasteContent, setLexisPasteContent] = useState('');
  const [showLexisImportSection, setShowLexisImportSection] = useState(false);
  const [isGeneratingLexis, setIsGeneratingLexis] = useState(false);
  const [lexisCount, setLexisCount] = useState<number>(8);

  const isEditMode = !!existingTest;

  // Track if there are unsaved changes
  const [isDirty, setIsDirty] = useState(false);

  const analysis = useMemo(() => parseDialogue(audio.transcript), [audio.transcript]);
  const words = useMemo<string[]>(() => extractWords(audio.transcript), [audio.transcript]);

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, feedbackMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(feedbackMessage);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  // Copy transcript
  const handleCopyTranscript = () => {
    copyToClipboard(audio.transcript, 'Transcript copied!');
  };

  // Copy LLM template
  const handleCopyTemplate = () => {
    const template = getLLMTemplate(testType, audio.transcript, customPrompt, includeExplanations, explanationStyle, questionCount, explanationLanguage, difficultyLevel);
    copyToClipboard(template, 'Template copied!');
    setShowTemplateModal(false);
  };

  // Copy current questions as JSON
  const handleCopyQuestionsJson = () => {
    const questionsJson = JSON.stringify(questions.map(q => ({
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || null,
      explanationArabic: q.explanationArabic || null
    })), null, 2);
    copyToClipboard(questionsJson, 'Questions JSON copied!');
  };

  // Generate update explanations template
  const getUpdateExplanationsTemplate = (): string => {
    const questionsJson = JSON.stringify(questions.map(q => ({
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || null,
      explanationArabic: q.explanationArabic || null
    })), null, 2);

    const hasExistingExplanations = questions.some(q => q.explanation || q.explanationArabic);

    let modeInstruction = '';
    if (updateExplanationMode === 'replace') {
      modeInstruction = `REPLACE all existing explanations with new ones. Generate BOTH English and Arabic explanations for each question.`;
    } else {
      if (hasExistingExplanations) {
        modeInstruction = `SUPPLEMENT existing explanations. If an explanation exists in one language, translate it to the other language. If both exist, improve and clarify them. Always provide BOTH "explanation" (English) and "explanationArabic" (Arabic) fields.`;
      } else {
        modeInstruction = `ADD new explanations in BOTH English and Arabic for each question.`;
      }
    }

    const customInstructions = updateExplanationPrompt
      ? `\nCUSTOM INSTRUCTIONS:\n${updateExplanationPrompt}\n`
      : hasExistingExplanations
        ? '\nNo specific instructions provided. Clarify and improve the existing explanations, or extend them with additional helpful context.'
        : '\nNo specific instructions provided. Generate clear, educational explanations for why each answer is correct.';

    return `Update the explanations for the following test questions.

${modeInstruction}
${customInstructions}

CURRENT QUESTIONS:
${questionsJson}

IMPORTANT: Return ONLY a valid JSON array with the SAME questions but updated explanations. Do not change questionText, options, or correctAnswer.

You MUST provide BOTH explanation fields:
- "explanation": English explanation
- "explanationArabic": Arabic explanation (العربية)

JSON FORMAT (return exactly this structure):
[
  {
    "questionText": "Same as input",
    "options": ["Same", "as", "input", "options"],
    "correctAnswer": "Same as input",
    "explanation": "English explanation here",
    "explanationArabic": "الشرح بالعربية هنا"
  }
]`;
  };

  // Copy update explanations template
  const handleCopyUpdateTemplate = () => {
    const template = getUpdateExplanationsTemplate();
    copyToClipboard(template, 'Update template copied!');
    setShowImportSection(true); // Show import section after copying
  };

  // Import explanations from LLM response (merges with existing questions)
  const handleImportExplanations = () => {
    try {
      // Try to extract JSON array from the pasted content
      const jsonMatch = updateExplanationPaste.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        alert('Could not find a valid JSON array in the pasted content. Make sure the LLM output contains a JSON array.');
        return;
      }

      const parsed = JSON.parse(jsonMatch[0]) as Partial<TestQuestion>[];

      if (!Array.isArray(parsed) || parsed.length === 0) {
        alert('The JSON array is empty or invalid.');
        return;
      }

      // Merge explanations with existing questions
      const updatedQuestions = questions.map((existingQ, index) => {
        // Try to match by questionText first, then fall back to index
        let matchedQ = parsed.find(p =>
          p.questionText?.toLowerCase().trim() === existingQ.questionText.toLowerCase().trim()
        );

        // If no match by text, use index
        if (!matchedQ && index < parsed.length) {
          matchedQ = parsed[index];
        }

        if (matchedQ && (matchedQ.explanation || matchedQ.explanationArabic)) {
          return {
            ...existingQ,
            explanation: matchedQ.explanation || existingQ.explanation,
            explanationArabic: matchedQ.explanationArabic || existingQ.explanationArabic
          };
        }

        return existingQ;
      });

      setQuestions(updatedQuestions);
      setIsDirty(true);
      setShowUpdateExplanationsModal(false);
      setUpdateExplanationPaste('');
      setShowImportSection(false);
      setUpdateExplanationPrompt('');

      // Show feedback - count how many had any explanation updated
      const updatedCount = updatedQuestions.filter((q, i) =>
        q.explanation !== questions[i].explanation ||
        q.explanationArabic !== questions[i].explanationArabic
      ).length;
      setCopyFeedback(`Updated ${updatedCount} explanations!`);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      alert('Failed to parse JSON. Please check the format and try again.');
    }
  };

  // Copy lexis LLM template
  const handleCopyLexisTemplate = () => {
    const template = getLexisLLMTemplate(audio.transcript, lexisCustomPrompt, lexisCount, difficultyLevel);
    copyToClipboard(template, 'Lexis template copied!');
    setShowLexisImportSection(true);
  };

  // Import lexis from LLM response
  const handleImportLexis = () => {
    try {
      const jsonMatch = lexisPasteContent.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        alert('Could not find a valid JSON array in the pasted content.');
        return;
      }

      const parsed = JSON.parse(jsonMatch[0]) as Partial<LexisItem>[];

      if (!Array.isArray(parsed) || parsed.length === 0) {
        alert('The JSON array is empty or invalid.');
        return;
      }

      const newLexis: LexisItem[] = parsed.map(item => ({
        id: generateId(),
        term: item.term || '',
        definition: item.definition || '',
        definitionArabic: item.definitionArabic,
        example: item.example,
        partOfSpeech: item.partOfSpeech,
      }));

      console.log('[TestBuilder] handleImportLexis - setting lexis:', newLexis);
      setLexis(newLexis);
      setIsDirty(true);
      setShowLexisModal(false);
      setLexisPasteContent('');
      setShowLexisImportSection(false);
      setCopyFeedback(`Imported ${newLexis.length} vocabulary items!`);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (error) {
      console.error('Failed to parse lexis JSON:', error);
      alert('Failed to parse JSON. Please check the format and try again.');
    }
  };

  // AI generate lexis using Gemini
  const generateLexis = async () => {
    setIsGeneratingLexis(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        alert('Gemini API key not configured. Please use the LLM Template option instead.');
        setIsGeneratingLexis(false);
        return;
      }

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const prompt = getLexisLLMTemplate(audio.transcript.slice(0, 3000), lexisCustomPrompt, lexisCount, difficultyLevel);

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<LexisItem>[];
        const newLexis: LexisItem[] = parsed.map(item => ({
          id: generateId(),
          term: item.term || '',
          definition: item.definition || '',
          definitionArabic: item.definitionArabic,
          example: item.example,
          partOfSpeech: item.partOfSpeech,
        }));
        console.log('[TestBuilder] generateLexis - setting lexis:', newLexis);
        setLexis(newLexis);
        setIsDirty(true);
        setShowLexisModal(false);
        setCopyFeedback(`Generated ${newLexis.length} vocabulary items!`);
        setTimeout(() => setCopyFeedback(null), 2000);
      } else {
        alert('Could not parse AI response. Please try using the LLM Template option.');
      }
    } catch (error) {
      console.error('Failed to generate lexis:', error);
      alert('Failed to generate vocabulary. Please try using the LLM Template option.');
    } finally {
      setIsGeneratingLexis(false);
    }
  };

  // Update a lexis item
  const updateLexisItem = (id: string, updates: Partial<LexisItem>) => {
    setLexis(lexis.map(item => item.id === id ? { ...item, ...updates } : item));
    setIsDirty(true);
  };

  // Remove a lexis item
  const removeLexisItem = (id: string) => {
    setLexis(lexis.filter(item => item.id !== id));
    setIsDirty(true);
  };

  // Add a new empty lexis item
  const addLexisItem = () => {
    const newItem: LexisItem = {
      id: generateId(),
      term: '',
      definition: '',
    };
    setLexis([...lexis, newItem]);
    setIsDirty(true);
  };

  // Parse pasted JSON from LLM
  const handlePasteFromLLM = () => {
    try {
      // Try to extract JSON array from the pasted content
      const jsonMatch = pasteContent.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        alert('Could not find a valid JSON array in the pasted content. Make sure the LLM output contains a JSON array.');
        return;
      }

      const parsed = JSON.parse(jsonMatch[0]) as Partial<TestQuestion>[];

      if (!Array.isArray(parsed) || parsed.length === 0) {
        alert('The JSON array is empty or invalid.');
        return;
      }

      const newQuestions: TestQuestion[] = parsed.map(q => ({
        id: generateId(),
        questionText: q.questionText || '',
        options: testType === 'listening-comprehension' ? (q.options || ['', '', '', '']) : undefined,
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation || undefined,
        explanationArabic: q.explanationArabic || undefined,
      }));

      setQuestions(newQuestions);
      setIsDirty(true);
      setShowPasteModal(false);
      setPasteContent('');
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      alert('Failed to parse JSON. Please check the format and try again.');
    }
  };

  // Handle test type change
  const handleTestTypeChange = (newType: TestType) => {
    setTestType(newType);
    setQuestions([]);
    setIsDirty(true);
    // Update title if it hasn't been manually changed from the default pattern
    if (!isEditMode) {
      const currentDefault = generateDefaultTitle(audio.title, testType);
      if (testTitle === currentDefault || testTitle === `${audio.title} - Listening Test`) {
        setTestTitle(generateDefaultTitle(audio.title, newType));
      }
    }
  };

  // Add a new empty question
  const addQuestion = () => {
    const newQuestion: TestQuestion = {
      id: generateId(),
      questionText: '',
      options: testType === 'listening-comprehension' ? ['', '', '', ''] : undefined,
      correctAnswer: '',
    };
    setQuestions([...questions, newQuestion]);
    setIsDirty(true);
  };

  // Update a question
  const updateQuestion = (id: string, updates: Partial<TestQuestion>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
    setIsDirty(true);
  };

  // Update an option for a question
  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== questionId || !q.options) return q;
      const newOptions = [...q.options];
      newOptions[optionIndex] = value;
      return { ...q, options: newOptions };
    }));
    setIsDirty(true);
  };

  // Remove a question
  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
    setIsDirty(true);
  };

  // Import questions from document
  const handleDocumentImport = (importedQuestions: TestQuestion[]) => {
    // Generate new IDs for imported questions to avoid conflicts
    const questionsWithNewIds = importedQuestions.map(q => ({
      ...q,
      id: generateId(),
    }));
    setQuestions([...questions, ...questionsWithNewIds]);
    setShowDocumentImport(false);
    setIsDirty(true);
  };

  // Auto-generate questions using AI (Gemini)
  const generateQuestions = async () => {
    setIsGenerating(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        generateSimpleQuestions();
        return;
      }

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const prompt = getLLMTemplate(testType, audio.transcript.slice(0, 2000), customPrompt, includeExplanations, explanationStyle, questionCount, explanationLanguage, difficultyLevel);

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<TestQuestion>[];
        const newQuestions: TestQuestion[] = parsed.map(q => ({
          id: generateId(),
          questionText: q.questionText || '',
          options: testType === 'listening-comprehension' ? q.options : undefined,
          correctAnswer: q.correctAnswer || '',
          explanation: q.explanation || undefined,
          explanationArabic: q.explanationArabic || undefined,
        }));
        setQuestions(newQuestions);
        setIsDirty(true);
      } else {
        generateSimpleQuestions();
      }
    } catch (error) {
      console.error('Failed to generate questions:', error);
      generateSimpleQuestions();
    } finally {
      setIsGenerating(false);
    }
  };

  // Simple fallback question generation
  const generateSimpleQuestions = () => {
    if (testType === 'listening-comprehension') {
      const newQuestions: TestQuestion[] = [
        {
          id: generateId(),
          questionText: 'What is the main topic of this audio?',
          options: ['Topic A', 'Topic B', 'Topic C', 'Topic D'],
          correctAnswer: 'Topic A',
        },
        {
          id: generateId(),
          questionText: 'How many speakers are in this dialogue?',
          options: ['1', '2', '3', '4'],
          correctAnswer: String(analysis.speakers.length || 1),
        },
      ];
      if (analysis.speakers.length > 0) {
        newQuestions.push({
          id: generateId(),
          questionText: `Who speaks first in the dialogue?`,
          options: [...analysis.speakers.slice(0, 3), 'Unknown'].slice(0, 4),
          correctAnswer: analysis.speakers[0] || 'Unknown',
        });
      }
      setQuestions(newQuestions);
      setIsDirty(true);
    } else if (testType === 'fill-in-blank') {
      const uniqueWords = Array.from(new Set<string>(words)).slice(0, 5);
      const newQuestions: TestQuestion[] = uniqueWords.map((word: string) => ({
        id: generateId(),
        questionText: `Fill in the blank: The audio mentions "_____" (hint: ${word.slice(0, 2)}...)`,
        correctAnswer: word,
      }));
      setQuestions(newQuestions);
      setIsDirty(true);
    } else if (testType === 'dictation') {
      setQuestions([{
        id: generateId(),
        questionText: 'Listen and write what you hear',
        correctAnswer: audio.transcript.slice(0, 200),
      }]);
      setIsDirty(true);
    }
  };

  const handleSave = () => {
    console.log('[TestBuilder] handleSave called');
    console.log('[TestBuilder] lexis state:', lexis);
    console.log('[TestBuilder] lexis.length:', lexis.length);

    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    const test: Omit<ListeningTest, 'id' | 'createdAt' | 'updatedAt'> = {
      audioId: audio.id,
      title: testTitle,
      type: testType,
      questions,
      lexis: lexis.length > 0 ? lexis : undefined,
    };

    console.log('[TestBuilder] Saving test with lexis:', test.lexis);
    onSave(test);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Copy Feedback Toast - Bottom center to avoid nav obstruction */}
      {copyFeedback && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-2.5 rounded-full shadow-lg z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {copyFeedback}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>
        <h1 className="text-2xl font-bold text-slate-900">{isEditMode ? 'Edit Test' : 'Create Test'}</h1>
        <div className="w-20" /> {/* Spacer for centering */}
      </div>

      {/* Floating Save Button - Bottom Right Corner */}
      {/* Show in create mode when there are questions OR lexis, or in edit mode only when dirty */}
      {(questions.length > 0 || lexis.length > 0) && (!isEditMode || isDirty) && (
        <button
          onClick={handleSave}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full font-semibold shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105 transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {isEditMode ? 'Update' : 'Save'} {questions.length > 0 && `(${questions.length})`} {lexis.length > 0 && `[${lexis.length}]`}
        </button>
      )}

      {/* Audio Reference with Copy Button */}
      <div className="bg-slate-100 rounded-xl p-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500">Creating test for:</p>
            <p className="font-medium text-slate-900">{audio.title}</p>
          </div>
          <button
            onClick={handleCopyTranscript}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white text-slate-700 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
            title="Copy transcript to clipboard"
          >
            <CopyIcon className="w-4 h-4" />
            Copy Transcript
          </button>
        </div>
        {audio.audioUrl && (
          <audio src={audio.audioUrl} controls className="w-full mt-2 h-10" />
        )}
      </div>

      {/* Test Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Test Title
            </label>
            <input
              type="text"
              value={testTitle}
              onChange={(e) => { setTestTitle(e.target.value); setIsDirty(true); }}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Enter test title..."
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Test Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'listening-comprehension' as TestType, label: 'Comprehension', desc: 'Multiple choice questions' },
                { type: 'fill-in-blank' as TestType, label: 'Fill in Blank', desc: 'Complete missing words' },
                { type: 'dictation' as TestType, label: 'Dictation', desc: 'Write what you hear' },
              ].map(({ type, label, desc }) => (
                <button
                  key={type}
                  onClick={() => handleTestTypeChange(type)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    testType === type
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-medium text-slate-900 text-sm">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lexis Section - Before questions */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpenIcon className="w-5 h-5 text-amber-600" />
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Vocabulary / Lexis ({lexis.length})
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLexisModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors"
                title="Generate vocabulary from transcript"
              >
                <BookOpenIcon className="w-4 h-4" />
                Generate Lexis
              </button>
              <button
                onClick={addLexisItem}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Item
              </button>
            </div>
          </div>

          {lexis.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <BookOpenIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="mb-1">No vocabulary items yet.</p>
              <p className="text-sm">Generate lexis to help students understand key terms from the transcript.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lexis.map((item, index) => (
                <div key={item.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-amber-100 text-amber-700 rounded-md flex items-center justify-center font-bold text-xs">
                      {index + 1}
                    </span>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={item.term}
                          onChange={(e) => updateLexisItem(item.id, { term: e.target.value })}
                          placeholder="Term or phrase"
                          className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                        <select
                          value={item.partOfSpeech || ''}
                          onChange={(e) => updateLexisItem(item.id, { partOfSpeech: e.target.value || undefined })}
                          className="w-28 p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        >
                          <option value="">Type</option>
                          <option value="noun">noun</option>
                          <option value="verb">verb</option>
                          <option value="adjective">adjective</option>
                          <option value="adverb">adverb</option>
                          <option value="phrase">phrase</option>
                          <option value="idiom">idiom</option>
                        </select>
                        <button
                          onClick={() => removeLexisItem(item.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={item.definition}
                        onChange={(e) => updateLexisItem(item.id, { definition: e.target.value })}
                        placeholder="English definition"
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <input
                        type="text"
                        dir="rtl"
                        value={item.definitionArabic || ''}
                        onChange={(e) => updateLexisItem(item.id, { definitionArabic: e.target.value || undefined })}
                        placeholder="التعريف بالعربية"
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                      <input
                        type="text"
                        value={item.example || ''}
                        onChange={(e) => updateLexisItem(item.id, { example: e.target.value || undefined })}
                        placeholder="Example sentence (optional)"
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Questions Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6">
        <div className="flex items-center justify-between mb-4">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Questions ({questions.length})
          </label>
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors"
              title="Get LLM template to generate questions with any AI"
            >
              <CopyIcon className="w-4 h-4" />
              LLM Template
            </button>
            <button
              onClick={() => setShowPasteModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors"
              title="Paste JSON questions from any LLM"
            >
              <DownloadIcon className="w-4 h-4" />
              Paste from LLM
            </button>
            {questions.length > 0 && (
              <button
                onClick={() => setShowUpdateExplanationsModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors"
                title="Update or add explanations to existing questions"
              >
                <SparklesIcon className="w-4 h-4" />
                Update Explanations
              </button>
            )}
            <button
              onClick={generateQuestions}
              disabled={isGenerating}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <SparklesIcon className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'AI Generate'}
            </button>
            <button
              onClick={addQuestion}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add Question
            </button>
            <button
              onClick={() => setShowDocumentImport(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 transition-colors"
              title="Import questions from PDF, Word, or text document"
            >
              <DownloadIcon className="w-4 h-4" />
              Import
            </button>
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="mb-2">No questions yet.</p>
            <p className="text-sm">Use "LLM Template" to copy a prompt for any AI, "AI Generate" to use Gemini, or "Import" to upload a document.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={question.questionText}
                    onChange={(e) => updateQuestion(question.id, { questionText: e.target.value })}
                    placeholder="Enter question..."
                    className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    onClick={() => removeQuestion(question.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Multiple Choice Options */}
                {testType === 'listening-comprehension' && question.options && (
                  <div className="ml-12 space-y-2">
                    {question.options.map((option, optIndex) => (
                      <div key={optIndex} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${question.id}`}
                          checked={question.correctAnswer === option && option !== ''}
                          onChange={() => updateQuestion(question.id, { correctAnswer: option })}
                          className="text-indigo-600"
                        />
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                          className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    ))}
                    <p className="text-xs text-slate-400 mt-1">Select the radio button next to the correct answer</p>
                  </div>
                )}

                {/* Fill in Blank / Dictation Answer */}
                {(testType === 'fill-in-blank' || testType === 'dictation') && (
                  <div className="ml-12">
                    <label className="text-xs text-slate-500 mb-1 block">Correct Answer:</label>
                    <input
                      type="text"
                      value={question.correctAnswer}
                      onChange={(e) => updateQuestion(question.id, { correctAnswer: e.target.value })}
                      placeholder="Enter correct answer..."
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                )}

                {/* Explanation Fields (Optional) */}
                <div className="ml-12 mt-3 space-y-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">English Explanation (optional):</label>
                    <input
                      type="text"
                      value={question.explanation || ''}
                      onChange={(e) => updateQuestion(question.id, { explanation: e.target.value || undefined })}
                      placeholder="Why is this the correct answer? (shown when user gets it wrong)"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Arabic Explanation (optional):</label>
                    <input
                      type="text"
                      dir="rtl"
                      value={question.explanationArabic || ''}
                      onChange={(e) => updateQuestion(question.id, { explanationArabic: e.target.value || undefined })}
                      placeholder="الشرح بالعربية (يظهر عند الإجابة الخاطئة)"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-right"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom spacer for floating button */}
        <div className="h-16" />
      </div>

      {/* Lexis Generation Modal */}
      {showLexisModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Generate Vocabulary</h2>
              <p className="text-sm text-slate-500 mt-1">
                Extract key vocabulary from the transcript to help students understand the listening passage.
              </p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Vocabulary Count */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Number of Vocabulary Items
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="5"
                    max="15"
                    value={lexisCount}
                    onChange={(e) => setLexisCount(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-8 text-center font-medium text-slate-700">{lexisCount}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Suggested: {getSuggestedLexisCount(audio.transcript)} items based on transcript length (~{audio.transcript.split(/\s+/).length} words)
                </p>
              </div>

              {/* Difficulty Level - uses same as questions */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Learner Level (CEFR)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficultyLevel(level)}
                      className={`py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                        difficultyLevel === level
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Instructions */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Custom Instructions (optional)
                </label>
                <textarea
                  value={lexisCustomPrompt}
                  onChange={(e) => setLexisCustomPrompt(e.target.value)}
                  placeholder="Add specific instructions for vocabulary extraction...&#10;&#10;Examples:&#10;- Focus on business vocabulary&#10;- Include phrasal verbs&#10;- Prioritize academic words"
                  className="w-full h-20 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Preview - Only show when not in import mode */}
              {!showLexisImportSection && (
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    Generated Template Preview
                  </label>
                  <pre className="bg-slate-100 p-4 rounded-xl text-xs whitespace-pre-wrap font-mono text-slate-700 max-h-40 overflow-y-auto">
                    {getLexisLLMTemplate(audio.transcript, lexisCustomPrompt, lexisCount, difficultyLevel)}
                  </pre>
                </div>
              )}

              {/* Import Section */}
              {showLexisImportSection && (
                <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-200">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                      Step 2: Import LLM Response
                    </label>
                    <button
                      onClick={() => setShowLexisImportSection(false)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Back to template
                    </button>
                  </div>
                  <p className="text-sm text-amber-700 mb-3">
                    Paste the LLM response below to import vocabulary items.
                  </p>
                  <textarea
                    value={lexisPasteContent}
                    onChange={(e) => setLexisPasteContent(e.target.value)}
                    placeholder='Paste the LLM response here... It should contain a JSON array:
[
  {
    "term": "vocabulary word",
    "definition": "English definition",
    "definitionArabic": "التعريف بالعربية",
    "example": "Example sentence",
    "partOfSpeech": "noun"
  }
]'
                    className="w-full h-48 p-4 bg-white border border-amber-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-between">
              <button
                onClick={() => {
                  setShowLexisModal(false);
                  setLexisCustomPrompt('');
                  setLexisPasteContent('');
                  setShowLexisImportSection(false);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                {!showLexisImportSection ? (
                  <>
                    <button
                      onClick={() => setShowLexisImportSection(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      <DownloadIcon className="w-4 h-4" />
                      Import Response
                    </button>
                    <button
                      onClick={handleCopyLexisTemplate}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors"
                    >
                      <CopyIcon className="w-4 h-4" />
                      Copy Template
                    </button>
                    <button
                      onClick={generateLexis}
                      disabled={isGeneratingLexis}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      <SparklesIcon className="w-4 h-4" />
                      {isGeneratingLexis ? 'Generating...' : 'AI Generate'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleImportLexis}
                    disabled={!lexisPasteContent.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    Import Vocabulary
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LLM Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">LLM Template Generator</h2>
              <p className="text-sm text-slate-500 mt-1">
                Customize the prompt, then copy and paste into any LLM (ChatGPT, Claude, Gemini, etc.)
              </p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Question Count Selector */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Number of Questions
                </label>
                <div className="flex gap-2">
                  {[5, 10].map((count) => (
                    <button
                      key={count}
                      onClick={() => setQuestionCount(count)}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                        questionCount === count
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {count} Questions
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Level Selector */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Learner Level (CEFR)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['A1', 'A2', 'B1', 'B2', 'C1'] as CEFRLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficultyLevel(level)}
                      className={`py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                        difficultyLevel === level
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {getCEFRDescription(difficultyLevel)}
                </p>
              </div>

              {/* Custom Instructions */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Custom Instructions (optional)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Add any specific instructions for question generation...&#10;&#10;Examples:&#10;- Focus on vocabulary related to business&#10;- Include questions about speaker intent and tone&#10;- Test grammar structures used in the dialogue"
                  className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Explanation Toggle */}
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="include-explanations"
                  checked={includeExplanations}
                  onChange={(e) => setIncludeExplanations(e.target.checked)}
                  className="mt-1 text-indigo-600 rounded"
                />
                <div className="flex-1">
                  <label htmlFor="include-explanations" className="font-medium text-slate-900 text-sm cursor-pointer">
                    Include explanations for answers
                  </label>
                  <p className="text-xs text-slate-500 mt-1">
                    When enabled, the LLM will generate an explanation for each question that shows when users answer incorrectly.
                  </p>

                  {/* Explanation Options (only shown when explanations are enabled) */}
                  {includeExplanations && (
                    <div className="mt-3 space-y-3">
                      {/* Language Selector */}
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Explanation language:</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setExplanationLanguage('both')}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                              explanationLanguage === 'both'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            Both
                          </button>
                          <button
                            onClick={() => setExplanationLanguage('english')}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                              explanationLanguage === 'english'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            English
                          </button>
                          <button
                            onClick={() => setExplanationLanguage('arabic')}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                              explanationLanguage === 'arabic'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            العربية
                          </button>
                        </div>
                      </div>

                      {/* Explanation Style */}
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Explanation style:</label>
                        <input
                          type="text"
                          value={explanationStyle}
                          onChange={(e) => setExplanationStyle(e.target.value)}
                          placeholder="e.g., Explain the grammar rule, Reference the transcript, Keep it brief..."
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Generated Template Preview
                </label>
                <pre className="bg-slate-100 p-4 rounded-xl text-xs whitespace-pre-wrap font-mono text-slate-700 max-h-48 overflow-y-auto">
                  {getLLMTemplate(testType, audio.transcript, customPrompt, includeExplanations, explanationStyle, questionCount, explanationLanguage, difficultyLevel)}
                </pre>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <CopyIcon className="w-4 h-4" />
                Copy Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste from LLM Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Paste from LLM</h2>
              <p className="text-sm text-slate-500 mt-1">
                Paste the JSON output from your LLM. The system will extract the JSON array automatically.
              </p>
            </div>
            <div className="p-6">
              <textarea
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder='Paste the LLM response here... It should contain a JSON array like:
[
  {
    "questionText": "What is the main topic?",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "A",
    "explanation": "Optional explanation"
  }
]'
                className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowPasteModal(false); setPasteContent(''); }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteFromLLM}
                disabled={!pasteContent.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <DownloadIcon className="w-4 h-4" />
                Import Questions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Explanations Modal */}
      {showUpdateExplanationsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Update Explanations</h2>
              <p className="text-sm text-slate-500 mt-1">
                Generate or update explanations for your existing questions using any LLM.
              </p>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Current Questions Summary */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {questions.length} questions
                      {questions.filter(q => q.explanation).length > 0 && (
                        <span className="text-slate-500">
                          {' '}({questions.filter(q => q.explanation).length} with explanations)
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={handleCopyQuestionsJson}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                  >
                    <CopyIcon className="w-3 h-3" />
                    Copy JSON
                  </button>
                </div>
              </div>

              {/* Mode Selector */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Update Mode
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUpdateExplanationMode('supplement')}
                    className={`flex-1 py-3 px-4 rounded-lg text-sm transition-all text-left ${
                      updateExplanationMode === 'supplement'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <p className="font-medium">Supplement</p>
                    <p className={`text-xs mt-0.5 ${updateExplanationMode === 'supplement' ? 'text-blue-100' : 'text-slate-500'}`}>
                      Keep existing + add/translate
                    </p>
                  </button>
                  <button
                    onClick={() => setUpdateExplanationMode('replace')}
                    className={`flex-1 py-3 px-4 rounded-lg text-sm transition-all text-left ${
                      updateExplanationMode === 'replace'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <p className="font-medium">Replace</p>
                    <p className={`text-xs mt-0.5 ${updateExplanationMode === 'replace' ? 'text-blue-100' : 'text-slate-500'}`}>
                      Overwrite all explanations
                    </p>
                  </button>
                </div>
              </div>

              {/* Language Selector */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Output Language
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUpdateExplanationLanguage('english')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                      updateExplanationLanguage === 'english'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setUpdateExplanationLanguage('arabic')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                      updateExplanationLanguage === 'arabic'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    العربية (Arabic)
                  </button>
                </div>
                {updateExplanationMode === 'supplement' && questions.some(q => q.explanation) && (
                  <p className="text-xs text-slate-500 mt-2">
                    Existing explanations will be translated to {updateExplanationLanguage === 'arabic' ? 'Arabic' : 'English'} if in a different language.
                  </p>
                )}
              </div>

              {/* Custom Instructions */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Custom Instructions (optional)
                </label>
                <textarea
                  value={updateExplanationPrompt}
                  onChange={(e) => setUpdateExplanationPrompt(e.target.value)}
                  placeholder="Leave empty to let the LLM improve/clarify existing explanations, or provide specific instructions...&#10;&#10;Examples:&#10;- Focus on grammar rules&#10;- Keep explanations under 2 sentences&#10;- Reference specific parts of the dialogue&#10;- Explain vocabulary in context"
                  className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Preview - Only show when not in import mode */}
              {!showImportSection && (
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    Generated Template Preview
                  </label>
                  <pre className="bg-slate-100 p-4 rounded-xl text-xs whitespace-pre-wrap font-mono text-slate-700 max-h-48 overflow-y-auto">
                    {getUpdateExplanationsTemplate()}
                  </pre>
                </div>
              )}

              {/* Import Section - Show after copying template */}
              {showImportSection && (
                <div className="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-green-700 uppercase tracking-wider">
                      Step 2: Import LLM Response
                    </label>
                    <button
                      onClick={() => setShowImportSection(false)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Back to template
                    </button>
                  </div>
                  <p className="text-sm text-green-700 mb-3">
                    Paste the LLM response below. Only explanations will be updated - questions remain unchanged.
                  </p>
                  <textarea
                    value={updateExplanationPaste}
                    onChange={(e) => setUpdateExplanationPaste(e.target.value)}
                    placeholder='Paste the LLM response here... It should contain a JSON array with updated explanations:
[
  {
    "questionText": "Same question text",
    "explanation": "Updated explanation here"
  }
]'
                    className="w-full h-48 p-4 bg-white border border-green-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-between">
              <button
                onClick={() => {
                  setShowUpdateExplanationsModal(false);
                  setUpdateExplanationPrompt('');
                  setUpdateExplanationPaste('');
                  setShowImportSection(false);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-3">
                {!showImportSection ? (
                  <>
                    <button
                      onClick={() => setShowImportSection(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                    >
                      <DownloadIcon className="w-4 h-4" />
                      Import Response
                    </button>
                    <button
                      onClick={handleCopyUpdateTemplate}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <CopyIcon className="w-4 h-4" />
                      Copy Template
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleImportExplanations}
                    disabled={!updateExplanationPaste.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    Update Explanations
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Import Modal */}
      {showDocumentImport && (
        <DocumentImport
          onImport={handleDocumentImport}
          onCancel={() => setShowDocumentImport(false)}
        />
      )}
    </div>
  );
};
