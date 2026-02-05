import React, { useState } from 'react';
import { TrueFalseItem } from '../types';
import { ClassroomTheme } from './Settings';

interface TrueFalseActivityProps {
  items: TrueFalseItem[];
  theme?: ClassroomTheme;
  onComplete: () => void;
  onSkip: () => void;
}

export const TrueFalseActivity: React.FC<TrueFalseActivityProps> = ({
  items,
  theme = 'light',
  onComplete,
  onSkip,
}) => {
  const isDark = theme === 'dark';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [id: string]: boolean | null }>({});
  const [showResult, setShowResult] = useState(false);

  const currentItem = items[currentIndex];
  const isLastItem = currentIndex === items.length - 1;
  const answeredCount = Object.values(answers).filter(a => a !== null).length;
  const progressPercent = (answeredCount / items.length) * 100;
  const currentAnswer = answers[currentItem?.id];

  const handleAnswer = (answer: boolean) => {
    if (showResult) return;

    setAnswers(prev => ({ ...prev, [currentItem.id]: answer }));
    setShowResult(true);
  };

  const handleContinue = () => {
    setShowResult(false);
    if (isLastItem) {
      onComplete();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0 && !showResult) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (!currentItem) {
    return null;
  }

  const isCorrect = showResult && currentAnswer === currentItem.correctAnswer;

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-orange-50 to-amber-100'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-20 shadow-sm flex-shrink-0 ${isDark ? 'bg-slate-800 border-b border-slate-700' : 'bg-white/90 backdrop-blur border-b border-orange-100'}`}>
        {/* Progress Bar */}
        <div className={`h-1 ${isDark ? 'bg-slate-700' : 'bg-orange-100'}`}>
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-orange-900'}`}>
              True or False?
            </h1>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-orange-600'}`}>
              Predict: Statement {currentIndex + 1} of {items.length}
            </p>
          </div>
          <button
            onClick={onSkip}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-orange-500 hover:bg-orange-50'
            }`}
          >
            Skip
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className={`px-4 py-3 ${isDark ? 'bg-slate-800/50' : 'bg-white/60'}`}>
        <p className={`text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Do you think this will be true or false in the dialogue?
        </p>
        <p className={`text-center text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`} dir="rtl">
          هل تعتقد أن هذه العبارة صحيحة أم خاطئة في الحوار؟
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className={`w-full max-w-md ${
          showResult
            ? isCorrect
              ? isDark ? 'bg-green-900/50 border-green-500' : 'bg-green-50 border-green-400'
              : isDark ? 'bg-amber-900/50 border-amber-500' : 'bg-amber-50 border-amber-400'
            : isDark ? 'bg-slate-800' : 'bg-white'
        } rounded-2xl shadow-xl p-6 border-2 ${
          showResult ? '' : isDark ? 'border-slate-700' : 'border-transparent'
        } transition-all`}>
          {/* Statement */}
          <div className="mb-6">
            <p className={`text-xl font-semibold text-center mb-3 ${
              isDark ? 'text-white' : 'text-slate-800'
            }`}>
              "{currentItem.statement}"
            </p>
            {currentItem.statementArabic && (
              <p className={`text-lg text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`} dir="rtl">
                "{currentItem.statementArabic}"
              </p>
            )}
          </div>

          {/* Result Feedback */}
          {showResult && (
            <div className={`text-center mb-4 p-3 rounded-xl ${
              isCorrect
                ? isDark ? 'bg-green-800/50' : 'bg-green-100'
                : isDark ? 'bg-amber-800/50' : 'bg-amber-100'
            }`}>
              <p className={`font-bold text-lg ${
                isCorrect
                  ? isDark ? 'text-green-400' : 'text-green-700'
                  : isDark ? 'text-amber-400' : 'text-amber-700'
              }`}>
                {isCorrect ? 'Great prediction!' : 'Interesting choice!'}
              </p>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                The answer is: <span className="font-bold">{currentItem.correctAnswer ? 'TRUE' : 'FALSE'}</span>
              </p>
            </div>
          )}

          {/* True/False Buttons */}
          {!showResult && (
            <div className="flex gap-4">
              <button
                onClick={() => handleAnswer(true)}
                className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
                  currentAnswer === true
                    ? 'bg-green-500 text-white scale-105'
                    : isDark
                    ? 'bg-green-900/50 text-green-400 hover:bg-green-800/50 border-2 border-green-700'
                    : 'bg-green-100 text-green-700 hover:bg-green-200 border-2 border-green-300'
                }`}
              >
                TRUE
              </button>
              <button
                onClick={() => handleAnswer(false)}
                className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
                  currentAnswer === false
                    ? 'bg-red-500 text-white scale-105'
                    : isDark
                    ? 'bg-red-900/50 text-red-400 hover:bg-red-800/50 border-2 border-red-700'
                    : 'bg-red-100 text-red-700 hover:bg-red-200 border-2 border-red-300'
                }`}
              >
                FALSE
              </button>
            </div>
          )}

          {/* Continue Button after showing result */}
          {showResult && (
            <button
              onClick={handleContinue}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                isDark
                  ? 'bg-orange-600 text-white hover:bg-orange-500'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-400 hover:to-amber-400'
              }`}
            >
              {isLastItem ? 'Continue' : 'Next'}
            </button>
          )}
        </div>
      </div>

      {/* Navigation (only show previous when not on first item and not showing result) */}
      {currentIndex > 0 && !showResult && (
        <div className={`sticky bottom-0 p-4 ${isDark ? 'bg-slate-800 border-t border-slate-700' : 'bg-white/90 backdrop-blur border-t border-orange-100'}`}>
          <button
            onClick={handlePrevious}
            className={`w-full py-3 rounded-xl font-semibold transition-colors ${
              isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Previous
          </button>
        </div>
      )}
    </div>
  );
};
