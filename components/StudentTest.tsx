import React, { useState } from 'react';
import { ListeningTest } from '../types';
import { CheckCircleIcon } from './Icons';

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        {/* Progress Bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="px-4 py-2 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-slate-900 text-sm truncate">{test.title}</h1>
          </div>
          <div className="flex items-center gap-3 ml-3">
            <span className="text-xs text-slate-500">
              <span className="font-medium text-indigo-600">{answeredCount}</span>/{totalQuestions}
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
                    ? 'border-green-300 bg-green-50'
                    : status === 'incorrect'
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {/* Question Header - Compact */}
                <div className="px-3 py-2 flex items-start gap-2">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    status === 'correct'
                      ? 'bg-green-500 text-white'
                      : status === 'incorrect'
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-800 text-white'
                  }`}>
                    {index + 1}
                  </span>
                  <p className="text-sm text-slate-800 leading-snug pt-0.5">{question.questionText}</p>
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
                                ? 'border-green-400 bg-green-100'
                                : isSelected
                                ? 'border-red-400 bg-red-100'
                                : 'border-slate-200 bg-slate-50 opacity-50'
                              : isSelected
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300 active:bg-slate-100'
                          } ${isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <span className={`flex-shrink-0 w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                            isSubmitted
                              ? isCorrectAnswer
                                ? 'bg-green-500 text-white'
                                : isSelected
                                ? 'bg-red-500 text-white'
                                : 'bg-slate-300 text-slate-600'
                              : isSelected
                              ? 'bg-indigo-500 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {letter}
                          </span>
                          <span className="flex-1 text-slate-700 text-sm leading-tight truncate">{option}</span>
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
                            ? 'bg-green-100 border-green-400'
                            : 'bg-red-100 border-red-400'
                          : 'bg-slate-50 border-slate-200 focus:border-indigo-500 focus:outline-none'
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
                {isSubmitted && status === 'incorrect' && question.explanation && (
                  <div className="mx-3 mb-2 px-2 py-1.5 rounded text-xs bg-amber-100 text-amber-800">
                    {question.explanation}
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
