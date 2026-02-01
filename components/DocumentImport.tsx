import React, { useState, useRef } from 'react';
import { TestQuestion } from '../types';

interface ParsedResult {
  success: boolean;
  questions: TestQuestion[];
  transcript?: string;
  vocabulary?: string;
  confidence: number;
  warnings: string[];
  questionCount: number;
  rawText?: string;
  error?: string;
}

interface DocumentImportProps {
  onImport: (questions: TestQuestion[]) => void;
  onCancel: () => void;
}

// Upload icon component
const UploadIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

// Document icon
const DocumentIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

// Warning icon
const WarningIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// Spinner icon
const SpinnerIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export const DocumentImport: React.FC<DocumentImportProps> = ({ onImport, onCancel }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setResult(null);

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

      setResult(data);
      // Select all questions by default
      if (data.questions) {
        setSelectedQuestions(new Set(data.questions.map((q: TestQuestion) => q.id)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleQuestion = (id: string) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedQuestions(newSelected);
  };

  const selectAll = () => {
    if (result?.questions) {
      setSelectedQuestions(new Set(result.questions.map(q => q.id)));
    }
  };

  const selectNone = () => {
    setSelectedQuestions(new Set());
  };

  const handleImport = () => {
    if (result?.questions) {
      const questionsToImport = result.questions.filter(q => selectedQuestions.has(q.id));
      onImport(questionsToImport);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 50) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <DocumentIcon className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Import from Document</h2>
              <p className="text-sm text-slate-500">Upload PDF, Word, or text files with test questions</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!result ? (
            // Upload area
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isUploading ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isUploading}
                />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <SpinnerIcon className="w-10 h-10 text-indigo-600" />
                    <p className="text-slate-600">Parsing document...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <UploadIcon className="w-12 h-12 text-slate-400" />
                    <div>
                      <p className="text-slate-700 font-medium">Click to upload or drag and drop</p>
                      <p className="text-sm text-slate-500 mt-1">PDF, DOCX, or TXT (max 10MB)</p>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-medium text-slate-900 mb-2">Supported Formats</h3>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Questions numbered as: 1. or Q1. or Question 1:</li>
                  <li>• Options as: A) B) C) D) or A. B. C. D.</li>
                  <li>• Correct answers marked with * or in separate Answer Key section</li>
                </ul>
              </div>
            </div>
          ) : (
            // Results
            <div className="space-y-4">
              {/* Confidence indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(result.confidence)}`}>
                    {result.confidence}% confidence
                  </span>
                  <span className="text-slate-500 text-sm">
                    {result.questionCount} questions found
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    Select all
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={selectNone}
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    Select none
                  </button>
                </div>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <WarningIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-700">
                      <p className="font-medium mb-1">Parsing warnings:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {result.warnings.slice(0, 5).map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                        {result.warnings.length > 5 && (
                          <li>...and {result.warnings.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Low confidence AI suggestion */}
              {result.confidence < 50 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-blue-900">Low confidence parsing</p>
                      <p className="text-sm text-blue-700 mt-1">
                        The document format wasn't fully recognized. You can still import the questions found,
                        or try AI-assisted parsing for better results.
                      </p>
                      <button
                        className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                        onClick={() => {
                          // TODO: Implement AI-assisted parsing with user consent
                          alert('AI-assisted parsing will be available in a future update. This will use your daily AI quota.');
                        }}
                      >
                        Try AI-assisted parsing →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Questions list */}
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {result.questions.map((question, index) => (
                  <div
                    key={question.id}
                    onClick={() => toggleQuestion(question.id)}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedQuestions.has(question.id)
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        selectedQuestions.has(question.id)
                          ? 'border-indigo-500 bg-indigo-500'
                          : 'border-slate-300'
                      }`}>
                        {selectedQuestions.has(question.id) && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm">
                          {index + 1}. {question.questionText || '(No question text)'}
                        </p>
                        {question.options && question.options.length > 0 && (
                          <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                            {question.options.map((opt, i) => (
                              <p key={i} className={question.correctAnswer === opt ? 'text-green-600 font-medium' : ''}>
                                {String.fromCharCode(65 + i)}) {opt} {question.correctAnswer === opt && '✓'}
                              </p>
                            ))}
                          </div>
                        )}
                        {!question.correctAnswer && (
                          <p className="text-xs text-amber-600 mt-1">⚠ No correct answer specified</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {result.questions.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p>No questions could be extracted from this document.</p>
                  <p className="text-sm mt-1">Try a different format or use manual entry.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <button
            onClick={result ? () => setResult(null) : onCancel}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
          >
            {result ? 'Upload Different File' : 'Cancel'}
          </button>

          {result ? (
            <button
              onClick={handleImport}
              disabled={selectedQuestions.size === 0}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import {selectedQuestions.size} Question{selectedQuestions.size !== 1 ? 's' : ''}
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="px-5 py-2 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentImport;
