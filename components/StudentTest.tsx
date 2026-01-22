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
    // Calculate score
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

  // Get test type label
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Preview Banner */}
      {isPreview && (
        <div className="sticky top-0 z-20 bg-amber-500 text-white px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-4">
            <span className="font-medium">Preview Mode - This is how students will see the test</span>
            <button
              onClick={onExitPreview}
              className="px-4 py-1.5 bg-white text-amber-600 rounded-lg font-medium hover:bg-amber-50 transition-colors"
            >
              Exit Preview
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center">
            <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-3">
              {getTestTypeLabel(test.type)}
            </span>
            <h1 className="text-2xl font-bold text-slate-900">{test.title}</h1>
            <p className="text-slate-500 mt-2">
              {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} - Listen to the audio played by your instructor
            </p>
          </div>
        </div>
      </div>

      {/* Score Display (after submission) */}
      {isSubmitted && score !== null && (
        <div className="max-w-3xl mx-auto px-6 mt-6">
          <div className={`rounded-2xl p-6 text-center ${
            score >= 70 ? 'bg-green-50 border-2 border-green-200' : 'bg-amber-50 border-2 border-amber-200'
          }`}>
            <p className="text-lg font-bold mb-1">
              {score >= 70 ? 'Great job!' : 'Keep practicing!'}
            </p>
            <p className="text-4xl font-bold mb-2">
              {score}%
            </p>
            <p className="text-sm text-slate-600">
              You got {test.questions.filter(q => getAnswerStatus(q.id) === 'correct').length} out of {totalQuestions} correct
            </p>
            <button
              onClick={handleRetry}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-6 space-y-6">
            {test.questions.map((question, index) => {
              const status = getAnswerStatus(question.id);

              return (
                <div
                  key={question.id}
                  className={`p-5 rounded-xl border-2 transition-colors ${
                    status === 'correct'
                      ? 'border-green-300 bg-green-50'
                      : status === 'incorrect'
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  {/* Question Number and Text */}
                  <div className="flex items-start gap-4 mb-4">
                    <span className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                      status === 'correct'
                        ? 'bg-green-500 text-white'
                        : status === 'incorrect'
                        ? 'bg-red-500 text-white'
                        : 'bg-slate-900 text-white'
                    }`}>
                      {index + 1}
                    </span>
                    <p className="text-lg font-medium text-slate-900 pt-1.5">{question.questionText}</p>
                  </div>

                  {/* Multiple Choice Options */}
                  {test.type === 'listening-comprehension' && question.options && (
                    <div className="ml-14 space-y-2">
                      {question.options.map((option, optIndex) => {
                        const letter = String.fromCharCode(65 + optIndex);
                        const isSelected = answers[question.id] === option;
                        const isCorrectAnswer = option === question.correctAnswer;

                        return (
                          <button
                            key={optIndex}
                            onClick={() => updateAnswer(question.id, option)}
                            disabled={isSubmitted}
                            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                              isSubmitted
                                ? isCorrectAnswer
                                  ? 'border-green-400 bg-green-100'
                                  : isSelected
                                  ? 'border-red-400 bg-red-100'
                                  : 'border-slate-200 bg-white opacity-50'
                                : isSelected
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                            } ${isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                              isSubmitted
                                ? isCorrectAnswer
                                  ? 'bg-green-500 text-white'
                                  : isSelected
                                  ? 'bg-red-500 text-white'
                                  : 'bg-slate-200 text-slate-600'
                                : isSelected
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                              {letter}
                            </span>
                            <span className="text-slate-700">{option}</span>
                            {isSubmitted && isCorrectAnswer && (
                              <CheckCircleIcon className="w-5 h-5 text-green-500 ml-auto" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Fill in Blank / Dictation Input */}
                  {(test.type === 'fill-in-blank' || test.type === 'dictation') && (
                    <div className="ml-14">
                      <input
                        type="text"
                        value={answers[question.id] || ''}
                        onChange={(e) => updateAnswer(question.id, e.target.value)}
                        disabled={isSubmitted}
                        placeholder="Type your answer..."
                        className={`w-full p-4 rounded-xl border-2 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                          isSubmitted
                            ? status === 'correct'
                              ? 'bg-green-100 border-green-400'
                              : 'bg-red-100 border-red-400'
                            : 'bg-white border-slate-200 focus:border-indigo-500'
                        }`}
                      />
                      {isSubmitted && status === 'incorrect' && (
                        <p className="mt-2 text-sm text-green-600">
                          Correct answer: <strong>{question.correctAnswer}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Explanation */}
                  {isSubmitted && status === 'incorrect' && question.explanation && (
                    <div className="ml-14 mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-sm text-amber-800">
                        <strong>Explanation:</strong> {question.explanation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit Button */}
          {!isSubmitted && (
            <div className="p-6 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <p className="text-slate-600">
                  {answeredCount}/{totalQuestions} answered
                </p>
                <button
                  onClick={handleSubmitClick}
                  disabled={answeredCount === 0}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Answers
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Submit Test?</h2>
            <p className="text-slate-600 mb-6">
              You have answered {answeredCount} out of {totalQuestions} questions.
              {answeredCount < totalQuestions && (
                <span className="block mt-2 text-amber-600 font-medium">
                  Warning: You have {totalQuestions - answeredCount} unanswered question{totalQuestions - answeredCount !== 1 ? 's' : ''}.
                </span>
              )}
            </p>
            <p className="text-slate-500 text-sm mb-6">
              Once submitted, you cannot change your answers. Are you sure you want to continue?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelSubmit}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmSubmit}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
