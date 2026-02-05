import React, { useState, useCallback } from 'react';
import { ListeningTest } from '../types';
import { CheckCircleIcon } from './Icons';
import { ClassroomTheme } from './Settings';
import { LexisMatchGame } from './LexisMatchGame';
import { LexisGapFillGame } from './LexisGapFillGame';
import { PreviewPhase } from './PreviewPhase';

interface StudentTestProps {
  test: ListeningTest;
  theme?: ClassroomTheme;
  isPreview?: boolean;
  onExitPreview?: () => void;
}

// SessionStorage key for tracking completed pre-test activities per test
const getActivitiesCompletedKey = (testId: string) => `test-activities-done-${testId}`;

// Test phase: match → gapfill → preview → questions
type TestPhase = 'match' | 'gapfill' | 'preview' | 'questions';

const getInitialTestPhase = (test: ListeningTest, isPreview: boolean): TestPhase => {
  // For preview mode, always start fresh - don't check sessionStorage
  // For students (not preview), check sessionStorage to skip completed activities
  if (!isPreview) {
    const storageKey = getActivitiesCompletedKey(test.id);
    try {
      if (sessionStorage.getItem(storageKey) === 'true') {
        return 'questions';
      }
    } catch { /* sessionStorage unavailable */ }
  }

  // Check what activities are available
  const hasMatch = test.lexis && test.lexis.some(item => item.definitionArabic);
  if (hasMatch) return 'match';

  const hasGapFill = test.lexis && test.lexis.some(item => item.example);
  if (hasGapFill) return 'gapfill';

  const hasPreview = test.preview && test.preview.length > 0;
  if (hasPreview) return 'preview';

  return 'questions';
};

export const StudentTest: React.FC<StudentTestProps> = ({ test, theme = 'light', isPreview = false, onExitPreview }) => {
  const isDark = theme === 'dark';
  const [answers, setAnswers] = useState<{ [questionId: string]: string }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  // Single state machine for test phase: match → gapfill → preview → questions
  const [testPhase, setTestPhase] = useState<TestPhase>(() => getInitialTestPhase(test, isPreview));

  // Check what activities are available
  const hasLexisGapFillGame = test.lexis && test.lexis.some(item => item.example);
  const hasPreviewActivities = test.preview && test.preview.length > 0;

  // In preview mode, don't persist to sessionStorage
  const markActivitiesDone = useCallback(() => {
    if (isPreview) return; // Don't persist in preview mode
    try {
      sessionStorage.setItem(getActivitiesCompletedKey(test.id), 'true');
    } catch { /* sessionStorage unavailable */ }
  }, [test.id, isPreview]);

  const advanceFromMatch = useCallback(() => {
    if (hasLexisGapFillGame) {
      setTestPhase('gapfill');
    } else if (hasPreviewActivities) {
      setTestPhase('preview');
    } else {
      setTestPhase('questions');
      markActivitiesDone();
    }
  }, [hasLexisGapFillGame, hasPreviewActivities, markActivitiesDone]);

  const advanceFromGapFill = useCallback(() => {
    if (hasPreviewActivities) {
      setTestPhase('preview');
    } else {
      setTestPhase('questions');
      markActivitiesDone();
    }
  }, [hasPreviewActivities, markActivitiesDone]);

  const advanceFromPreview = useCallback(() => {
    setTestPhase('questions');
    markActivitiesDone();
  }, [markActivitiesDone]);

  const updateAnswer = (questionId: string, answer: string) => {
    if (isSubmitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmit = () => {
    let correct = 0;
    test.questions.forEach(q => {
      const userAnswer = answers[q.id]?.toLowerCase().trim() || '';
      const correctAnswer = q.correctAnswer.toLowerCase().trim();
      if (userAnswer === correctAnswer) {
        correct++;
      }
    });

    const finalScore = Math.round((correct / test.questions.length) * 100);
    setScore(finalScore);
    setIsSubmitted(true);
    setShowConfirmDialog(false);
  };

  const handleCancelSubmit = () => {
    setShowConfirmDialog(false);
  };

  const getAnswerStatus = (questionId: string) => {
    if (!isSubmitted) return null;
    const question = test.questions.find(q => q.id === questionId);
    if (!question) return null;
    const userAnswer = answers[questionId]?.toLowerCase().trim() || '';
    const correctAnswer = question.correctAnswer.toLowerCase().trim();
    return userAnswer === correctAnswer ? 'correct' : 'incorrect';
  };

  const handleRetry = () => {
    setAnswers({});
    setIsSubmitted(false);
    setScore(null);
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = test.questions.length;
  const progressPercent = (answeredCount / totalQuestions) * 100;

  // Phase 1: Show Lexis Match Game first (English ↔ Arabic)
  if (testPhase === 'match' && test.lexis) {
    return (
      <LexisMatchGame
        lexis={test.lexis}
        theme={theme}
        onComplete={advanceFromMatch}
        onSkip={advanceFromMatch}
      />
    );
  }

  // Phase 2: Show Gap-Fill Game second (fill in the blank with vocab)
  if (testPhase === 'gapfill' && test.lexis) {
    return (
      <LexisGapFillGame
        lexis={test.lexis}
        theme={theme}
        onComplete={advanceFromGapFill}
        onSkip={advanceFromGapFill}
      />
    );
  }

  // Phase 3: Show Preview Activities (prediction, word association, true/false)
  if (testPhase === 'preview' && test.preview && test.preview.length > 0) {
    return (
      <PreviewPhase
        activities={test.preview}
        theme={theme}
        onComplete={advanceFromPreview}
        onSkip={advanceFromPreview}
      />
    );
  }

  // Phase 4: Questions (main test)

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Preview Banner */}
      {isPreview && (
        <div className="bg-amber-500 text-white px-3 py-2 text-center flex-shrink-0">
          <div className="flex items-center justify-center gap-3">
            <span className="text-sm font-medium">Preview Mode</span>
            <button
              onClick={onExitPreview}
              className="px-3 py-1 bg-white/20 rounded text-sm font-medium hover:bg-white/30"
            >
              Exit
            </button>
          </div>
        </div>
      )}

      {/* Compact Header */}
      <div className={`sticky top-0 z-20 shadow-sm flex-shrink-0 ${isDark ? 'bg-slate-800 border-b border-slate-700' : 'bg-white border-b border-slate-200'}`}>
        {/* Progress Bar */}
        <div className={`h-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="px-4 py-2 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{test.title}</h1>
          </div>
          <div className="flex items-center gap-3 ml-3">
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="font-medium text-indigo-400">{answeredCount}</span>/{totalQuestions}
            </span>
            {!isSubmitted && (
              <button
                onClick={handleSubmitClick}
                disabled={answeredCount === 0}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Score Banner (after submission) */}
      {isSubmitted && score !== null && (
        <div className={`px-4 py-3 flex-shrink-0 ${score >= 70 ? 'bg-green-500' : 'bg-amber-500'} text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-lg">{score}%</span>
              <span className="ml-2 text-sm opacity-90">
                ({test.questions.filter(q => getAnswerStatus(q.id) === 'correct').length}/{totalQuestions} correct)
              </span>
            </div>
            <button
              onClick={handleRetry}
              className="px-3 py-1 bg-white/20 rounded text-sm font-medium hover:bg-white/30"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Questions List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3 space-y-2 max-w-2xl mx-auto">
          {test.questions.map((question, index) => {
            const status = getAnswerStatus(question.id);

            return (
              <div
                key={question.id}
                className={`rounded-xl border transition-colors ${
                  status === 'correct'
                    ? isDark ? 'border-green-600 bg-green-900/30' : 'border-green-300 bg-green-50'
                    : status === 'incorrect'
                    ? isDark ? 'border-red-600 bg-red-900/30' : 'border-red-300 bg-red-50'
                    : isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
                }`}
              >
                {/* Question Header - Compact */}
                <div className="px-3 py-2 flex items-start gap-2">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    status === 'correct'
                      ? 'bg-green-500 text-white'
                      : status === 'incorrect'
                      ? 'bg-red-500 text-white'
                      : isDark ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white'
                  }`}>
                    {index + 1}
                  </span>
                  <p className={`text-sm leading-snug pt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{question.questionText}</p>
                </div>

                {/* Multiple Choice - Compact Grid */}
                {test.type === 'listening-comprehension' && question.options && (
                  <div className="px-3 pb-2 grid grid-cols-2 gap-1.5">
                    {question.options.map((option, optIndex) => {
                      const letter = String.fromCharCode(65 + optIndex);
                      const isSelected = answers[question.id] === option;
                      const isCorrectAnswer = option === question.correctAnswer;

                      return (
                        <button
                          key={optIndex}
                          onClick={() => updateAnswer(question.id, option)}
                          disabled={isSubmitted}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-sm transition-all ${
                            isSubmitted
                              ? isCorrectAnswer
                                ? isDark ? 'border-green-600 bg-green-900/40' : 'border-green-400 bg-green-100'
                                : isSelected
                                ? isDark ? 'border-red-600 bg-red-900/40' : 'border-red-400 bg-red-100'
                                : isDark ? 'border-slate-600 bg-slate-700 opacity-50' : 'border-slate-200 bg-slate-50 opacity-50'
                              : isSelected
                              ? isDark ? 'border-indigo-500 bg-indigo-900/40' : 'border-indigo-500 bg-indigo-50'
                              : isDark ? 'border-slate-600 bg-slate-700 hover:border-slate-500' : 'border-slate-200 bg-slate-50 hover:border-slate-300 active:bg-slate-100'
                          } ${isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <span className={`flex-shrink-0 w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                            isSubmitted
                              ? isCorrectAnswer
                                ? 'bg-green-500 text-white'
                                : isSelected
                                ? 'bg-red-500 text-white'
                                : isDark ? 'bg-slate-600 text-slate-400' : 'bg-slate-300 text-slate-600'
                              : isSelected
                              ? 'bg-indigo-500 text-white'
                              : isDark ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {letter}
                          </span>
                          <span className={`flex-1 text-sm leading-tight truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{option}</span>
                          {isSubmitted && isCorrectAnswer && (
                            <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Fill in Blank / Dictation - Compact Input */}
                {(test.type === 'fill-in-blank' || test.type === 'dictation') && (
                  <div className="px-3 pb-2">
                    <input
                      type="text"
                      value={answers[question.id] || ''}
                      onChange={(e) => updateAnswer(question.id, e.target.value)}
                      disabled={isSubmitted}
                      placeholder="Type answer..."
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isSubmitted
                          ? status === 'correct'
                            ? isDark ? 'bg-green-900/40 border-green-600 text-white' : 'bg-green-100 border-green-400'
                            : isDark ? 'bg-red-900/40 border-red-600 text-white' : 'bg-red-100 border-red-400'
                          : isDark ? 'bg-slate-700 border-slate-600 text-white focus:border-indigo-500 focus:outline-none' : 'bg-slate-50 border-slate-200 focus:border-indigo-500 focus:outline-none'
                      }`}
                    />
                    {isSubmitted && status === 'incorrect' && (
                      <p className="mt-1 text-xs text-green-700">
                        Answer: <strong>{question.correctAnswer}</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Explanation - Only show for incorrect answers */}
                {isSubmitted && status === 'incorrect' && (question.explanation || question.explanationArabic) && (
                  <div className="mx-3 mb-2 px-2 py-1.5 rounded text-xs bg-amber-100 text-amber-800">
                    {question.explanation && question.explanationArabic ? (
                      <div className="space-y-1">
                        <p>{question.explanation}</p>
                        <p className="text-right" dir="rtl">{question.explanationArabic}</p>
                      </div>
                    ) : (
                      <p className={question.explanationArabic ? 'text-right' : ''} dir={question.explanationArabic ? 'rtl' : 'ltr'}>
                        {question.explanation || question.explanationArabic}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom padding for safe area */}
        <div className="h-4" />
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Submit Test?</h2>
            <p className="text-slate-600 text-sm mb-1">
              Answered: <span className="font-semibold text-indigo-600">{answeredCount}</span> / {totalQuestions}
            </p>
            {answeredCount < totalQuestions && (
              <p className="text-amber-600 text-sm mb-4">
                {totalQuestions - answeredCount} unanswered
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCancelSubmit}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
