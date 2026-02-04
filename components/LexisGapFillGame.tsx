import React, { useState, useMemo, useEffect } from 'react';
import { LexisItem } from '../types';
import { ClassroomTheme } from './Settings';

interface LexisGapFillGameProps {
  lexis: LexisItem[];
  theme?: ClassroomTheme;
  onComplete: () => void;
  onSkip: () => void;
}

interface GapFillQuestion {
  id: string;
  lexisItem: LexisItem;
  sentenceWithBlank: string;
  correctAnswer: string;
  options: string[];
}

// Shuffle array using Fisher-Yates
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const LexisGapFillGame: React.FC<LexisGapFillGameProps> = ({
  lexis,
  theme = 'light',
  onComplete,
  onSkip,
}) => {
  const isDark = theme === 'dark';

  // Generate questions from lexis items with examples
  const questions = useMemo(() => {
    // Filter items that have example sentences
    const itemsWithExamples = lexis.filter(item => item.example && item.example.trim());

    if (itemsWithExamples.length === 0) return [];

    // Get all terms for distractors
    const allTerms = lexis.map(item => item.term.toLowerCase());

    return shuffleArray(itemsWithExamples.map(item => {
      // Create blank in the example sentence
      const term = item.term;
      const example = item.example!;

      // Try to find and replace the term in the example (case-insensitive)
      const termRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const sentenceWithBlank = example.replace(termRegex, '_____');

      // If term wasn't found in example, use the example as-is with blank at start
      const finalSentence = sentenceWithBlank === example
        ? `_____ - ${example}`
        : sentenceWithBlank;

      // Generate distractors (other vocab terms)
      const distractors = shuffleArray(
        allTerms.filter(t => t !== term.toLowerCase())
      ).slice(0, 3);

      // Create options array with correct answer and distractors
      const options = shuffleArray([term, ...distractors.map(d =>
        lexis.find(l => l.term.toLowerCase() === d)?.term || d
      )]);

      return {
        id: item.id,
        lexisItem: item,
        sentenceWithBlank: finalSentence,
        correctAnswer: term,
        options,
      } as GapFillQuestion;
    }));
  }, [lexis]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const progressPercent = totalQuestions > 0 ? (answeredQuestions.size / totalQuestions) * 100 : 0;
  const isComplete = answeredQuestions.size === totalQuestions && totalQuestions > 0;
  const allCorrect = correctCount === totalQuestions;

  // Auto-complete when all answered correctly
  useEffect(() => {
    if (isComplete && allCorrect) {
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, allCorrect, onComplete]);

  const handleAnswerSelect = (answer: string) => {
    if (showFeedback) return;

    setSelectedAnswer(answer);
    setShowFeedback(true);

    const isCorrect = answer.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
    }

    setAnsweredQuestions(prev => new Set([...prev, currentQuestion.id]));

    // Auto-advance after feedback
    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setShowFeedback(false);
        setShowHint(false);
      }
    }, 1500);
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setShowHint(false);
    setCorrectCount(0);
    setAnsweredQuestions(new Set());
  };

  // If no questions with examples, skip this game
  if (questions.length === 0) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className={`text-center max-w-md ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <p className="mb-4">No example sentences available for vocabulary practice.</p>
          <button
            onClick={onSkip}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
          >
            Continue to Questions
          </button>
        </div>
      </div>
    );
  }

  // Show completion/retry screen
  if (isComplete && !allCorrect) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className={`text-center max-w-md p-8 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-xl`}>
          <div className="text-5xl mb-4">📝</div>
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {correctCount}/{totalQuestions} Correct
          </h2>
          <p className={`mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            You need 100% to proceed. Try again or skip.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
            >
              Try Again
            </button>
            <button
              onClick={onSkip}
              className={`px-6 py-3 rounded-xl font-medium ${
                isDark
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show success screen briefly before proceeding
  if (isComplete && allCorrect) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className={`text-center max-w-md p-8 rounded-2xl ${
          isDark ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
        }`}>
          <div className="text-5xl mb-4">🎉</div>
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-green-300' : 'text-green-700'}`}>
            Perfect Score!
          </h2>
          <p className={`${isDark ? 'text-green-400' : 'text-green-600'}`}>
            All {totalQuestions} questions correct!
          </p>
          <p className={`mt-4 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Proceeding to questions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-20 shadow-sm ${isDark ? 'bg-slate-800 border-b border-slate-700' : 'bg-white border-b border-slate-200'}`}>
        {/* Progress Bar */}
        <div className={`h-2 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Fill in the Blank
            </h1>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Choose the correct word for each sentence
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                {currentIndex + 1}/{totalQuestions}
              </div>
              <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Question</div>
            </div>
            <button
              onClick={onSkip}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Skip
            </button>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className={`w-full max-w-lg p-6 rounded-2xl shadow-xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
          {/* Sentence with blank */}
          <div className={`text-xl font-medium mb-6 leading-relaxed ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {currentQuestion.sentenceWithBlank.split('_____').map((part, i, arr) => (
              <React.Fragment key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span className={`inline-block min-w-[80px] border-b-2 mx-1 ${
                    showFeedback
                      ? selectedAnswer?.toLowerCase() === currentQuestion.correctAnswer.toLowerCase()
                        ? 'border-green-500 text-green-600'
                        : 'border-red-500 text-red-600'
                      : isDark ? 'border-indigo-500' : 'border-indigo-400'
                  }`}>
                    {showFeedback ? currentQuestion.correctAnswer : '\u00A0\u00A0\u00A0\u00A0'}
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Hint toggle */}
          <div className="mb-6">
            {!showHint ? (
              <button
                onClick={() => setShowHint(true)}
                className={`w-full p-3 rounded-xl text-sm font-medium transition-all duration-200 border-2 border-dashed ${
                  isDark
                    ? 'border-slate-600 text-slate-400 hover:border-amber-500/50 hover:text-amber-400 hover:bg-amber-900/10'
                    : 'border-slate-300 text-slate-400 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50'
                }`}
              >
                💡 Hint / تلميح
              </button>
            ) : (
              <div className={`p-3 rounded-xl transition-all duration-200 ${isDark ? 'bg-amber-900/20 border border-amber-700/40' : 'bg-amber-50 border border-amber-200'}`}>
                <p className={`text-sm ${isDark ? 'text-amber-300/90' : 'text-amber-800'}`}>
                  {currentQuestion.lexisItem.definition}
                </p>
                {currentQuestion.lexisItem.hintArabic && (
                  <p className={`text-sm mt-1 text-right ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`} dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif" }}>
                    {currentQuestion.lexisItem.hintArabic}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={showFeedback}
                  className={`p-4 rounded-xl font-medium text-left transition-all ${
                    showFeedback
                      ? isCorrect
                        ? 'bg-green-500 text-white border-2 border-green-400'
                        : isSelected
                          ? 'bg-red-500 text-white border-2 border-red-400'
                          : isDark
                            ? 'bg-slate-700 text-slate-400 border-2 border-slate-600 opacity-50'
                            : 'bg-slate-100 text-slate-400 border-2 border-slate-200 opacity-50'
                      : isDark
                        ? 'bg-slate-700 text-white border-2 border-slate-600 hover:border-indigo-500 hover:bg-slate-600'
                        : 'bg-slate-50 text-slate-800 border-2 border-slate-200 hover:border-indigo-400 hover:bg-slate-100'
                  }`}
                >
                  <span className={`inline-block w-6 h-6 rounded-full mr-2 text-center text-sm leading-6 ${
                    showFeedback
                      ? isCorrect
                        ? 'bg-white/30'
                        : isSelected
                          ? 'bg-white/30'
                          : isDark ? 'bg-slate-600' : 'bg-slate-200'
                      : isDark ? 'bg-slate-600' : 'bg-slate-200'
                  }`}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {showFeedback && (() => {
            const isCorrect = selectedAnswer?.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();
            return (
              <div className={`mt-4 p-3 rounded-xl ${
                isCorrect
                  ? isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-700'
                  : isDark ? 'bg-red-900/30' : 'bg-red-50'
              }`}>
                <p className={`text-center font-medium ${isCorrect ? '' : isDark ? 'text-red-300' : 'text-red-700'}`}>
                  {isCorrect
                    ? '✓ Correct!'
                    : `✗ The answer is "${currentQuestion.correctAnswer}"`
                  }
                </p>
                {!isCorrect && (currentQuestion.lexisItem.explanation || currentQuestion.lexisItem.explanationArabic) && (
                  <div className={`mt-2 pt-2 border-t ${isDark ? 'border-red-800/40' : 'border-red-200'}`}>
                    {currentQuestion.lexisItem.explanation && (
                      <p className={`text-sm ${isDark ? 'text-red-300/80' : 'text-red-600'}`}>
                        {currentQuestion.lexisItem.explanation}
                      </p>
                    )}
                    {currentQuestion.lexisItem.explanationArabic && (
                      <p className={`text-sm mt-1 text-right ${isDark ? 'text-red-400/70' : 'text-red-500'}`} dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif" }}>
                        {currentQuestion.lexisItem.explanationArabic}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Score indicator */}
      <div className={`px-4 py-3 text-center ${isDark ? 'bg-slate-800 border-t border-slate-700' : 'bg-white border-t border-slate-200'}`}>
        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Score: <span className={`font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{correctCount}</span>/{answeredQuestions.size} correct
        </span>
      </div>
    </div>
  );
};
