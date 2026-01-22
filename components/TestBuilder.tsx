import React, { useState, useMemo } from 'react';
import { SavedAudio, TestType, TestQuestion, ListeningTest } from '../types';
import { ArrowLeftIcon, PlusIcon, TrashIcon, SparklesIcon, CopyIcon, DownloadIcon } from './Icons';
import { parseDialogue } from '../utils/parser';

interface TestBuilderProps {
  audio: SavedAudio;
  existingTest?: ListeningTest;
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

// LLM Template for question generation
const getLLMTemplate = (
  testType: TestType,
  transcript: string,
  customPrompt: string,
  includeExplanations: boolean,
  explanationStyle: string,
  questionCount: number,
  explanationLanguage: 'english' | 'arabic'
): string => {
  const langInstruction = explanationLanguage === 'arabic'
    ? 'Write the explanation in Arabic (العربية)'
    : 'Write the explanation in English';

  const explanationField = includeExplanations
    ? `\n    "explanation": "${explanationStyle || 'Brief explanation of why this is correct'}"`
    : '';

  const explanationRule = includeExplanations
    ? `\n- explanation: ${explanationStyle || 'Provide a brief explanation for each answer'}. ${langInstruction}.`
    : '';

  const baseInstructions = `Based on the following transcript, generate questions for a listening comprehension test.

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
    "correctAnswer": "Option A"${explanationField}
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
    "correctAnswer": "missing word or phrase"${explanationField}
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
    "correctAnswer": "The exact text the learner should write"${explanationField}
  }
]

RULES:
- questionText: Instructions for the dictation segment
- correctAnswer: The exact text to transcribe${explanationRule}`;
  }
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

export const TestBuilder: React.FC<TestBuilderProps> = ({ audio, existingTest, onSave, onCancel }) => {
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
  const [explanationLanguage, setExplanationLanguage] = useState<'english' | 'arabic'>('english');

  const isEditMode = !!existingTest;

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
    const template = getLLMTemplate(testType, audio.transcript, customPrompt, includeExplanations, explanationStyle, questionCount, explanationLanguage);
    copyToClipboard(template, 'Template copied!');
    setShowTemplateModal(false);
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
      }));

      setQuestions(newQuestions);
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
  };

  // Update a question
  const updateQuestion = (id: string, updates: Partial<TestQuestion>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  // Update an option for a question
  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== questionId || !q.options) return q;
      const newOptions = [...q.options];
      newOptions[optionIndex] = value;
      return { ...q, options: newOptions };
    }));
  };

  // Remove a question
  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
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

      const prompt = getLLMTemplate(testType, audio.transcript.slice(0, 2000), customPrompt, includeExplanations, explanationStyle, questionCount, explanationLanguage);

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
        }));
        setQuestions(newQuestions);
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
    } else if (testType === 'fill-in-blank') {
      const uniqueWords = Array.from(new Set<string>(words)).slice(0, 5);
      const newQuestions: TestQuestion[] = uniqueWords.map((word: string) => ({
        id: generateId(),
        questionText: `Fill in the blank: The audio mentions "_____" (hint: ${word.slice(0, 2)}...)`,
        correctAnswer: word,
      }));
      setQuestions(newQuestions);
    } else if (testType === 'dictation') {
      setQuestions([{
        id: generateId(),
        questionText: 'Listen and write what you hear',
        correctAnswer: audio.transcript.slice(0, 200),
      }]);
    }
  };

  const handleSave = () => {
    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    const test: Omit<ListeningTest, 'id' | 'createdAt' | 'updatedAt'> = {
      audioId: audio.id,
      title: testTitle,
      type: testType,
      questions,
    };

    onSave(test);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Copy Feedback Toast */}
      {copyFeedback && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in duration-200">
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
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          {isEditMode ? 'Update Test' : 'Save Test'}
        </button>
      </div>

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
              onChange={(e) => setTestTitle(e.target.value)}
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
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="mb-2">No questions yet.</p>
            <p className="text-sm">Use "LLM Template" to copy a prompt for any AI, or "AI Generate" to use Gemini directly.</p>
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

                {/* Explanation Field (Optional) */}
                <div className="ml-12 mt-3">
                  <label className="text-xs text-slate-500 mb-1 block">Explanation (optional):</label>
                  <input
                    type="text"
                    value={question.explanation || ''}
                    onChange={(e) => updateQuestion(question.id, { explanation: e.target.value || undefined })}
                    placeholder="Why is this the correct answer? (shown when user gets it wrong)"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Action Buttons */}
        <div className="flex justify-between mt-6 pt-6 border-t border-slate-200">
          <button
            onClick={onCancel}
            className="px-6 py-3 text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={questions.length === 0}
            className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEditMode ? 'Update Test' : 'Save Test'} ({questions.length} questions)
          </button>
        </div>
      </div>

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

              {/* Custom Instructions */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Custom Instructions (optional)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Add any specific instructions for question generation...&#10;&#10;Examples:&#10;- Focus on vocabulary related to business&#10;- Make questions suitable for intermediate learners&#10;- Include questions about speaker intent and tone&#10;- Test grammar structures used in the dialogue"
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
                            العربية (Arabic)
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
                  {getLLMTemplate(testType, audio.transcript, customPrompt, includeExplanations, explanationStyle, questionCount, explanationLanguage)}
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
    </div>
  );
};
