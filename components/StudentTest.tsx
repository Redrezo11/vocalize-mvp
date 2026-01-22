import React, { useState, useEffect } from 'react';
import { ListeningTest } from '../types';
import { CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';

interface StudentTestProps {
  test: ListeningTest;
  isPreview?: boolean;
  onExitPreview?: () => void;
}

export const StudentTest: React.FC<StudentTestProps> = ({ test, isPreview = false, onExitPreview }) => {
  const [answers, setAnswers] = useState<{ [questionId: string]: string }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');

  // Detect if device is mobile based on screen width
  useEffect(() => {
    const checkMobile = () => {
      setViewMode(window.innerWidth < 768 ? 'single' : 'all');
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    setCurrentQuestionIndex(0);
  };

  const getTestTypeLabel = (type: string): string => {
    switch (type) {
      case 'listening-comprehension': return 'Listening Comprehension';
      case 'fill-in-blank': return 'Fill in the Blank';
      case 'dictation': return 'Dictation';
      default: return type;
    }
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = test.questions.length;
  const progressPercent = (answeredCount / totalQuestions) * 100;
  const currentQuestion = test.questions[currentQuestionIndex];

  const goToNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const goToPrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  // Render a single question (used in mobile single-question view)
  const renderQuestion = (question: typeof currentQuestion, index: number, isMobile = false) => {
    const status = getAnswerStatus(question.id);

    return (
      <div
        key={question.id}
        className={`rounded-2xl border-2 transition-all duration-200 ${
          status === 'correct'
            ? 'border-green-400 bg-green-50'
            : status === 'incorrect'
            ? 'border-red-400 bg-red-50'
            : 'border-slate-200 bg-white'
        } ${isMobile ? 'p-4' : 'p-5'}`}
      >
        {/* Question Number and Text */}
        <div className={`flex items-start gap-3 ${isMobile ? 'mb-4' : 'mb-5'}`}>
          <span className={`flex-shrink-0 rounded-full flex items-center justify-center font-bold ${
            isMobile ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-lg'
          } ${
            status === 'correct'
              ? 'bg-green-500 text-white'
              : status === 'incorrect'
              ? 'bg-red-500 text-white'
              : 'bg-indigo-600 text-white'
          }`}>
            {index + 1}
          </span>
          <p className={`font-medium text-slate-900 pt-1 ${isMobile ? 'text-base leading-relaxed' : 'text-lg'}`}>
            {question.questionText}
          </p>
        </div>

        {/* Multiple Choice Options */}
        {test.type === 'listening-comprehension' && question.options && (
          <div className="space-y-2">
            {question.options.map((option, optIndex) => {
              const letter = String.fromCharCode(65 + optIndex);
              const isSelected = answers[question.id] === option;
              const isCorrectAnswer = option === question.correctAnswer;

              return (
                <button
                  key={optIndex}
                  onClick={() => updateAnswer(question.id, option)}
                  disabled={isSubmitted}
                  className={`w-full flex items-center gap-3 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                    isMobile ? 'p-3 min-h-[52px]' : 'p-4'
                  } ${
                    isSubmitted
                      ? isCorrectAnswer
                        ? 'border-green-400 bg-green-100'
                        : isSelected
                        ? 'border-red-400 bg-red-100'
                        : 'border-slate-200 bg-slate-50 opacity-60'
                      : isSelected
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 active:bg-slate-50'
                  } ${isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className={`flex-shrink-0 rounded-lg flex items-center justify-center font-bold ${
                    isMobile ? 'w-8 h-8 text-sm' : 'w-9 h-9 text-sm'
                  } ${
                    isSubmitted
                      ? isCorrectAnswer
                        ? 'bg-green-500 text-white'
                        : isSelected
                        ? 'bg-red-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                      : isSelected
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {letter}
                  </span>
                  <span className={`flex-1 text-slate-700 ${isMobile ? 'text-base' : ''}`}>{option}</span>
                  {isSubmitted && isCorrectAnswer && (
                    <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Fill in Blank / Dictation Input */}
        {(test.type === 'fill-in-blank' || test.type === 'dictation') && (
          <div>
            <input
              type="text"
              value={answers[question.id] || ''}
              onChange={(e) => updateAnswer(question.id, e.target.value)}
              disabled={isSubmitted}
              placeholder="Type your answer..."
              className={`w-full rounded-xl border-2 focus:outline-none transition-all ${
                isMobile ? 'p-3 text-base' : 'p-4 text-lg'
              } ${
                isSubmitted
                  ? status === 'correct'
                    ? 'bg-green-100 border-green-400'
                    : 'bg-red-100 border-red-400'
                  : 'bg-white border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
              }`}
            />
            {isSubmitted && status === 'incorrect' && (
              <p className="mt-2 text-sm text-green-700 font-medium">
                Correct answer: {question.correctAnswer}
              </p>
            )}
          </div>
        )}

        {/* Explanation */}
        {isSubmitted && question.explanation && (
          <div className={`mt-3 p-3 rounded-xl ${
            status === 'correct' ? 'bg-green-100/50' : 'bg-amber-50'
          }`}>
            <p className={`text-sm ${status === 'correct' ? 'text-green-800' : 'text-amber-800'}`}>
              <strong>Explanation:</strong> {question.explanation}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Preview Banner */}
      {isPreview && (
        <div className="bg-amber-500 text-white px-4 py-2.5 text-center flex-shrink-0">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="font-medium text-sm">Preview Mode</span>
            <button
              onClick={onExitPreview}
              className="px-3 py-1 bg-white/20 backdrop-blur rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
            >
              Exit
            </button>
          </div>
        </div>
      )}

      {/* Sticky Header with Progress */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        {/* Progress Bar */}
        <div className="h-1 bg-slate-200">
          <div
            className="h-full bg-indigo-500 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Title & Info */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-slate-900 truncate text-base md:text-lg">{test.title}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="inline-flex items-center gap-1">
                  <span className="font-medium text-indigo-600">{answeredCount}</span>
                  <span>/</span>
                  <span>{totalQuestions}</span>
                  <span className="hidden sm:inline ml-1">answered</span>
                </span>
              </p>
            </div>

            {/* View Toggle (desktop) */}
            <div className="hidden md:flex items-center gap-2 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                One at a time
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All questions
              </button>
            </div>
          </div>
        </div>

        {/* Question Navigator (mobile single view) */}
        {viewMode === 'single' && (
          <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
            {test.questions.map((q, idx) => {
              const status = getAnswerStatus(q.id);
              const isAnswered = !!answers[q.id];
              const isCurrent = idx === currentQuestionIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`flex-shrink-0 w-9 h-9 rounded-lg font-medium text-sm transition-all ${
                    status === 'correct'
                      ? 'bg-green-500 text-white'
                      : status === 'incorrect'
                      ? 'bg-red-500 text-white'
                      : isCurrent
                      ? 'bg-indigo-600 text-white shadow-md'
                      : isAnswered
                      ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-200'
                      : 'bg-slate-100 text-slate-500 border-2 border-slate-200'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Score Display (after submission) */}
      {isSubmitted && score !== null && (
        <div className="px-4 pt-4 flex-shrink-0">
          <div className={`rounded-2xl p-5 text-center ${
            score >= 70 ? 'bg-green-500' : 'bg-amber-500'
          } text-white shadow-lg`}>
            <p className="text-white/90 font-medium text-sm mb-1">
              {score >= 70 ? 'Great job!' : 'Keep practicing!'}
            </p>
            <p className="text-4xl font-bold mb-1">
              {score}%
            </p>
            <p className="text-white/80 text-sm">
              {test.questions.filter(q => getAnswerStatus(q.id) === 'correct').length} of {totalQuestions} correct
            </p>
            <button
              onClick={handleRetry}
              className="mt-4 px-6 py-2.5 bg-white/20 backdrop-blur rounded-xl font-medium hover:bg-white/30 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 max-w-2xl mx-auto">
          {viewMode === 'single' ? (
            // Single Question View (Mobile-optimized)
            <div className="space-y-4">
              {renderQuestion(currentQuestion, currentQuestionIndex, true)}
            </div>
          ) : (
            // All Questions View (Desktop)
            <div className="space-y-4">
              {test.questions.map((question, index) => renderQuestion(question, index, false))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar - Thumb Zone Optimized */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 px-4 py-3 flex-shrink-0 safe-area-inset-bottom">
        {!isSubmitted ? (
          viewMode === 'single' ? (
            // Mobile Navigation + Submit
            <div className="flex items-center gap-3">
              <button
                onClick={goToPrevQuestion}
                disabled={currentQuestionIndex === 0}
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed active:bg-slate-200 transition-colors"
                aria-label="Previous question"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>

              <button
                onClick={currentQuestionIndex === totalQuestions - 1 ? handleSubmitClick : goToNextQuestion}
                className={`flex-1 h-12 rounded-xl font-semibold text-base transition-all active:scale-[0.98] ${
                  currentQuestionIndex === totalQuestions - 1
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {currentQuestionIndex === totalQuestions - 1 ? 'Submit' : 'Next'}
              </button>

              <button
                onClick={goToNextQuestion}
                disabled={currentQuestionIndex === totalQuestions - 1}
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed active:bg-slate-200 transition-colors"
                aria-label="Next question"
              >
                <ChevronRightIcon className="w-6 h-6" />
              </button>
            </div>
          ) : (
            // Desktop Submit
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              <p className="text-slate-600 text-sm">
                <span className="font-semibold text-indigo-600">{answeredCount}</span> of {totalQuestions} answered
              </p>
              <button
                onClick={handleSubmitClick}
                disabled={answeredCount === 0}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 active:scale-[0.98]"
              >
                Submit Answers
              </button>
            </div>
          )
        ) : (
          // Post-submission navigation
          <div className="flex items-center justify-center gap-3">
            {viewMode === 'single' && (
              <>
                <button
                  onClick={goToPrevQuestion}
                  disabled={currentQuestionIndex === 0}
                  className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <span className="text-slate-600 font-medium px-4">
                  {currentQuestionIndex + 1} / {totalQuestions}
                </span>
                <button
                  onClick={goToNextQuestion}
                  disabled={currentQuestionIndex === totalQuestions - 1}
                  className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md p-6 shadow-2xl animate-slide-up">
            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mb-6 sm:hidden" />

            <h2 className="text-xl font-bold text-slate-900 mb-2">Submit Test?</h2>
            <p className="text-slate-600 mb-4">
              You have answered <span className="font-semibold text-indigo-600">{answeredCount}</span> out of <span className="font-semibold">{totalQuestions}</span> questions.
            </p>

            {answeredCount < totalQuestions && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-amber-700 text-sm font-medium">
                  {totalQuestions - answeredCount} question{totalQuestions - answeredCount !== 1 ? 's' : ''} unanswered
                </p>
              </div>
            )}

            <p className="text-slate-500 text-sm mb-6">
              Once submitted, you cannot change your answers.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCancelSubmit}
                className="flex-1 px-4 py-3.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors active:scale-[0.98] order-2 sm:order-1"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="flex-1 px-4 py-3.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors active:scale-[0.98] order-1 sm:order-2"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom styles for animations and safe area */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .safe-area-inset-bottom {
          padding-bottom: max(12px, env(safe-area-inset-bottom));
        }
      `}</style>
    </div>
  );
};
