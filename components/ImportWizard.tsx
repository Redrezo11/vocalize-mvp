import React, { useState, useRef } from 'react';

type AudioOption = 'external' | 'upload';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
              <>
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
              </>
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
