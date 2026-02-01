import React, { useState, useRef } from 'react';
import { TestQuestion } from '../types';

type AudioOption = 'external' | 'upload';
type QuestionInputMode = 'paste' | 'upload';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: ImportData) => void;
}

export interface ImportData {
  title: string;
  audioOption: AudioOption;
  audioFile?: File;
  questionsText: string;
  answerKeyText: string;
  lexisText: string;
  parsedQuestionCount: number;
  parsedLexisCount: number;
  parsedQuestions: TestQuestion[];
}

// Icons
const ChevronLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const UploadIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </svg>
);

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const WarningIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// Simple question counter (placeholder - will be replaced with actual parser)
const countQuestions = (text: string): number => {
  if (!text.trim()) return 0;
  // Count lines that start with a number followed by . or )
  const matches = text.match(/^\s*\d+[\.\)]/gm);
  return matches ? matches.length : 0;
};

// Simple lexis counter (placeholder - will be replaced with actual parser)
const countLexis = (text: string): number => {
  if (!text.trim()) return 0;
  // Count non-empty lines
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  return lines.length;
};

// Parse answer key input in various formats
// Supports: "1-B, 2-A, 3-C" or "1B 2A 3C" or "1.B 2.A 3.C" or "1)B 2)A 3)C"
const parseAnswerKeyInput = (text: string): Record<number, string> => {
  const answers: Record<number, string> = {};
  if (!text.trim()) return answers;

  // Match patterns like: 1-B, 1.B, 1)B, 1B, 1 B, 1:B
  const pattern = /(\d+)\s*[-.):\s]?\s*([A-Da-d])/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const questionNum = parseInt(match[1], 10);
    const answer = match[2].toUpperCase();
    answers[questionNum] = answer;
  }

  return answers;
};

export const ImportWizard: React.FC<ImportWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [title, setTitle] = useState('');
  const [audioOption, setAudioOption] = useState<AudioOption>('external');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [questionsText, setQuestionsText] = useState('');
  const [answerKeyText, setAnswerKeyText] = useState('');
  const [lexisText, setLexisText] = useState('');

  // Document upload state
  const [questionInputMode, setQuestionInputMode] = useState<QuestionInputMode>('upload');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isParsingDocument, setIsParsingDocument] = useState(false);
  const [documentParseError, setDocumentParseError] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<TestQuestion[]>([]);
  const [parseConfidence, setParseConfidence] = useState<number>(0);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);

  // Answer key document upload state
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [isParsingAnswerKey, setIsParsingAnswerKey] = useState(false);
  const [answerKeyParseError, setAnswerKeyParseError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const answerKeyInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const questionCount = countQuestions(questionsText);
  const lexisCount = countLexis(lexisText);

  const canProceedStep1 = title.trim().length > 0;
  const canProceedStep2 = questionCount > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  // Handle document file upload and parsing
  const handleDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocumentFile(file);
    setIsParsingDocument(true);
    setDocumentParseError(null);
    setParsedQuestions([]);
    setParseWarnings([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import/document', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse document');
      }

      setParsedQuestions(data.questions || []);
      setParseConfidence(data.confidence || 0);
      setParseWarnings(data.warnings || []);

      // Convert parsed questions to text format for the textarea
      if (data.questions && data.questions.length > 0) {
        const questionsAsText = data.questions.map((q: TestQuestion, i: number) => {
          let text = `${i + 1}. ${q.questionText}`;
          if (q.options && q.options.length > 0) {
            q.options.forEach((opt, j) => {
              const letter = String.fromCharCode(97 + j); // a, b, c, d
              const isCorrect = q.correctAnswer === opt || q.correctAnswer === letter.toUpperCase();
              text += `\n${letter}) ${opt}${isCorrect ? ' *' : ''}`;
            });
          }
          return text;
        }).join('\n\n');
        setQuestionsText(questionsAsText);
      }

    } catch (err) {
      setDocumentParseError(err instanceof Error ? err.message : 'Failed to parse document');
    } finally {
      setIsParsingDocument(false);
    }
  };

  const handleDocumentDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.txt'))) {
      // Create a synthetic event to reuse the handler
      const syntheticEvent = {
        target: { files: [file] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleDocumentChange(syntheticEvent);
    }
  };

  // Handle answer key document upload
  const handleAnswerKeyChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnswerKeyFile(file);
    setIsParsingAnswerKey(true);
    setAnswerKeyParseError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import/document', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse answer key');
      }

      // Extract text and parse for answer patterns
      const rawText = data.rawText || '';
      const answers = parseAnswerKeyInput(rawText);

      if (Object.keys(answers).length > 0) {
        // Apply answers to parsed questions
        setParsedQuestions(prev => prev.map((q, i) => ({
          ...q,
          correctAnswer: answers[i + 1] || q.correctAnswer || ''
        })));
        setAnswerKeyText(rawText);
      } else {
        setAnswerKeyParseError('Could not find answer patterns in the document. Try entering manually.');
      }

    } catch (err) {
      setAnswerKeyParseError(err instanceof Error ? err.message : 'Failed to parse answer key');
    } finally {
      setIsParsingAnswerKey(false);
    }
  };

  const handleAnswerKeyDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.txt'))) {
      const syntheticEvent = {
        target: { files: [file] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleAnswerKeyChange(syntheticEvent);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
    }
  };

  const handleComplete = () => {
    onComplete({
      title,
      audioOption,
      audioFile: audioFile || undefined,
      questionsText,
      answerKeyText,
      lexisText,
      parsedQuestionCount: questionCount,
      parsedLexisCount: lexisCount,
      parsedQuestions,
    });
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setTitle('');
    setAudioOption('external');
    setAudioFile(null);
    setQuestionsText('');
    setAnswerKeyText('');
    setLexisText('');
    setQuestionInputMode('upload');
    setDocumentFile(null);
    setIsParsingDocument(false);
    setDocumentParseError(null);
    setParsedQuestions([]);
    setParseConfidence(0);
    setParseWarnings([]);
    // Reset answer key state
    setAnswerKeyFile(null);
    setIsParsingAnswerKey(false);
    setAnswerKeyParseError(null);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  // Step indicator component
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((step, index) => (
        <React.Fragment key={step}>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
              step < currentStep
                ? 'bg-emerald-500 text-white'
                : step === currentStep
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            {step < currentStep ? (
              <CheckCircleIcon className="w-5 h-5" />
            ) : (
              step
            )}
          </div>
          {index < 2 && (
            <div
              className={`w-16 h-1 mx-2 rounded-full transition-all duration-300 ${
                step < currentStep ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // Step 1: Setup
  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Unit 5 - Travel and Tourism"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all duration-200"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-3">
          Audio Source
        </label>
        <div className="space-y-3">
          <label
            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
              audioOption === 'external'
                ? 'border-amber-500 bg-amber-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="audioOption"
              value="external"
              checked={audioOption === 'external'}
              onChange={() => setAudioOption('external')}
              className="sr-only"
            />
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                audioOption === 'external'
                  ? 'border-amber-500'
                  : 'border-slate-300'
              }`}
            >
              {audioOption === 'external' && (
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              )}
            </div>
            <ExternalLinkIcon className={`w-5 h-5 ${audioOption === 'external' ? 'text-amber-600' : 'text-slate-400'}`} />
            <div>
              <div className={`font-medium ${audioOption === 'external' ? 'text-amber-900' : 'text-slate-700'}`}>
                External Audio
              </div>
              <div className="text-sm text-slate-500">
                Audio played via Oxford CPT, CD, or other device
              </div>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
              audioOption === 'upload'
                ? 'border-amber-500 bg-amber-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="audioOption"
              value="upload"
              checked={audioOption === 'upload'}
              onChange={() => setAudioOption('upload')}
              className="sr-only"
            />
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                audioOption === 'upload'
                  ? 'border-amber-500'
                  : 'border-slate-300'
              }`}
            >
              {audioOption === 'upload' && (
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              )}
            </div>
            <UploadIcon className={`w-5 h-5 mt-0.5 ${audioOption === 'upload' ? 'text-amber-600' : 'text-slate-400'}`} />
            <div className="flex-1">
              <div className={`font-medium ${audioOption === 'upload' ? 'text-amber-900' : 'text-slate-700'}`}>
                Upload Audio File
              </div>
              <div className="text-sm text-slate-500 mb-3">
                Upload MP3, WAV, or other audio file
              </div>

              {audioOption === 'upload' && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                    audioFile
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {audioFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-700">
                      <CheckCircleIcon className="w-5 h-5" />
                      <span className="font-medium">{audioFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      <UploadIcon className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <span>Drop audio file here or click to browse</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </label>
        </div>
      </div>
    </div>
  );

  // Step 2: Questions
  const renderStep2 = () => (
    <div className="space-y-6">
      {/* Input Mode Toggle */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
        <button
          onClick={() => setQuestionInputMode('upload')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
            questionInputMode === 'upload'
              ? 'bg-white text-amber-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <DocumentIcon className="w-4 h-4" />
          Upload Document
        </button>
        <button
          onClick={() => setQuestionInputMode('paste')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
            questionInputMode === 'paste'
              ? 'bg-white text-amber-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
          </svg>
          Paste Text
        </button>
      </div>

      {questionInputMode === 'upload' ? (
        /* Document Upload Mode */
        <div className="space-y-4">
          <div
            onClick={() => documentInputRef.current?.click()}
            onDrop={handleDocumentDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
              isParsingDocument
                ? 'border-amber-300 bg-amber-50'
                : documentFile
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50/50'
            }`}
          >
            <input
              ref={documentInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleDocumentChange}
              className="hidden"
              disabled={isParsingDocument}
            />
            {isParsingDocument ? (
              <div className="flex flex-col items-center gap-3">
                <SpinnerIcon className="w-10 h-10 text-amber-600" />
                <p className="text-amber-700 font-medium">Parsing document...</p>
              </div>
            ) : documentFile ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircleIcon className="w-10 h-10 text-emerald-500" />
                <p className="font-medium text-emerald-700">{documentFile.name}</p>
                <p className="text-sm text-emerald-600">Click to upload a different file</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <DocumentIcon className="w-12 h-12 text-slate-400" />
                <div>
                  <p className="text-slate-700 font-medium">Drop document here or click to browse</p>
                  <p className="text-sm text-slate-500 mt-1">PDF, Word (.docx), or Text files</p>
                </div>
              </div>
            )}
          </div>

          {documentParseError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {documentParseError}
            </div>
          )}

          {parseWarnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2">
                <WarningIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium mb-1">Parsing notes:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {parseWarnings.slice(0, 3).map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                    {parseWarnings.length > 3 && (
                      <li>...and {parseWarnings.length - 3} more</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {parsedQuestions.length > 0 && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-emerald-700">
                  Parsed: {parsedQuestions.length} questions
                </span>
                <span className={`text-sm px-2 py-0.5 rounded-full ${
                  parseConfidence >= 80 ? 'bg-emerald-200 text-emerald-800' :
                  parseConfidence >= 50 ? 'bg-amber-200 text-amber-800' :
                  'bg-red-200 text-red-800'
                }`}>
                  {parseConfidence}% confidence
                </span>
              </div>
              <p className="text-sm text-emerald-600">
                Questions have been extracted and added below. Review and edit as needed.
              </p>
            </div>
          )}

          {/* Show extracted questions in editable textarea */}
          {questionsText && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Extracted Questions (editable)
              </label>
              <textarea
                value={questionsText}
                onChange={(e) => setQuestionsText(e.target.value)}
                className="w-full h-48 px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all duration-200 font-mono text-sm resize-none"
              />
            </div>
          )}

          {/* Answer Key Input - Show when questions are parsed but missing answers */}
          {parsedQuestions.length > 0 && (
            <div className="space-y-3">
              {parsedQuestions.filter(q => !q.correctAnswer).length > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <WarningIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700">
                      <span className="font-medium">{parsedQuestions.filter(q => !q.correctAnswer).length} question(s)</span> are missing correct answers. Upload answer key or enter manually.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                    <p className="text-sm text-emerald-700 font-medium">
                      All {parsedQuestions.length} questions have answers!
                    </p>
                  </div>
                </div>
              )}

              {/* Answer Key Upload */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Upload Answer Key Document
                </label>
                <div
                  onClick={() => answerKeyInputRef.current?.click()}
                  onDrop={handleAnswerKeyDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
                    isParsingAnswerKey
                      ? 'border-amber-300 bg-amber-50'
                      : answerKeyFile
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50/50'
                  }`}
                >
                  <input
                    ref={answerKeyInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleAnswerKeyChange}
                    className="hidden"
                    disabled={isParsingAnswerKey}
                  />
                  {isParsingAnswerKey ? (
                    <div className="flex items-center justify-center gap-2">
                      <SpinnerIcon className="w-5 h-5 text-amber-600" />
                      <p className="text-amber-700 text-sm">Parsing answer key...</p>
                    </div>
                  ) : answerKeyFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-700">
                      <CheckCircleIcon className="w-5 h-5" />
                      <span className="text-sm font-medium">{answerKeyFile.name}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <DocumentIcon className="w-5 h-5" />
                      <span className="text-sm">Drop answer key here or click to upload</span>
                    </div>
                  )}
                </div>
                {answerKeyParseError && (
                  <p className="text-sm text-red-600 mt-1">{answerKeyParseError}</p>
                )}
              </div>

              {/* Or manual entry */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-slate-200"></div>
                <span className="text-xs text-slate-400 uppercase">or enter manually</span>
                <div className="flex-1 border-t border-slate-200"></div>
              </div>

              <div>
                <textarea
                  value={answerKeyText}
                  onChange={(e) => {
                    setAnswerKeyText(e.target.value);
                    // Parse and apply answers to parsed questions
                    const answers = parseAnswerKeyInput(e.target.value);
                    if (Object.keys(answers).length > 0) {
                      setParsedQuestions(prev => prev.map((q, i) => ({
                        ...q,
                        correctAnswer: answers[i + 1] || q.correctAnswer || ''
                      })));
                    }
                  }}
                  placeholder="1-B, 2-A, 3-C, 4-D, 5-A  or  1B 2A 3C 4D 5A"
                  className="w-full h-16 px-4 py-2 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all duration-200 font-mono text-sm resize-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Format: 1-B, 2-A, 3-C or 1B 2A 3C (letter = option a/b/c/d)
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Paste Text Mode */
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Paste Questions + Answers <span className="text-red-500">*</span>
            </label>
            <textarea
              value={questionsText}
              onChange={(e) => setQuestionsText(e.target.value)}
              placeholder={`1. What did the speaker say about travel?
a) It's expensive
b) It's educational *
c) It's dangerous
d) It's unnecessary

2. According to the listening, where is the best destination?
a) Paris
b) Tokyo *
c) London
d) New York`}
              className="w-full h-48 px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all duration-200 font-mono text-sm resize-none"
            />
            <p className="text-xs text-slate-500 mt-2">
              Mark correct answers with <code className="bg-slate-100 px-1 rounded">*</code> or provide answer key below
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Answer Key <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              value={answerKeyText}
              onChange={(e) => setAnswerKeyText(e.target.value)}
              placeholder="1-B, 2-A, 3-C, 4-D, 5-A"
              className="w-full h-20 px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all duration-200 font-mono text-sm resize-none"
            />
          </div>
        </div>
      )}

      {questionCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
          <CheckCircleIcon className="w-5 h-5" />
          <span className="font-medium">Detected: {questionCount} questions</span>
        </div>
      )}
    </div>
  );

  // Step 3: Lexis + Summary
  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Paste Vocabulary <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          value={lexisText}
          onChange={(e) => setLexisText(e.target.value)}
          placeholder={`1. itinerary - جدول الرحلة
2. departure - مغادرة
3. destination - وجهة
4. accommodation - سكن
5. currency - عملة`}
          className="w-full h-36 px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all duration-200 font-mono text-sm resize-none"
        />
        <p className="text-xs text-slate-500 mt-2">
          Format: <code className="bg-slate-100 px-1 rounded">word - Arabic translation</code> (one per line)
        </p>
      </div>

      {lexisCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
          <CheckCircleIcon className="w-5 h-5" />
          <span className="font-medium">Detected: {lexisCount} vocabulary items</span>
        </div>
      )}

      {/* Summary */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <line x1="3" x2="21" y1="9" y2="9" />
            <line x1="9" x2="9" y1="21" y2="9" />
          </svg>
          Summary
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Title:</span>
            <span className="font-medium text-slate-700">{title || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Audio:</span>
            <span className="font-medium text-slate-700">
              {audioOption === 'external'
                ? 'External (no upload)'
                : audioFile
                ? audioFile.name
                : 'No file selected'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Questions:</span>
            <span className="font-medium text-slate-700">{questionCount} MCQ</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Vocabulary:</span>
            <span className="font-medium text-slate-700">{lexisCount} items</span>
          </div>
        </div>
      </div>
    </div>
  );

  const stepTitles = ['Setup', 'Questions', 'Vocabulary'];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-slate-900">Import Content</h2>
            <span className="text-sm text-slate-500">Step {currentStep} of 3</span>
          </div>
          <p className="text-slate-500 text-sm">{stepTitles[currentStep - 1]}</p>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-6">
          <StepIndicator />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-all duration-200"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="flex items-center gap-1 px-5 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-all duration-200"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Back
              </button>
            )}

            {currentStep < 3 ? (
              <div className="flex items-center gap-3">
                {currentStep === 1 && !canProceedStep1 && (
                  <span className="text-sm text-amber-600">Enter a title to continue</span>
                )}
                {currentStep === 2 && !canProceedStep2 && (
                  <span className="text-sm text-amber-600">Add at least one question</span>
                )}
                {currentStep === 2 && (
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="px-5 py-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl font-medium transition-all duration-200"
                  >
                    Skip Lexis
                  </button>
                )}
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={currentStep === 1 ? !canProceedStep1 : !canProceedStep2}
                  className="flex items-center gap-1 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-amber-500/30"
                >
                  Next
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleComplete}
                disabled={!canProceedStep2}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-emerald-500/30"
              >
                <CheckCircleIcon className="w-5 h-5" />
                Save Import
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
