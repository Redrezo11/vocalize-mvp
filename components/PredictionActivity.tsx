import React, { useState } from 'react';
import { PredictionItem, PreviewPredictionResult } from '../types';
import { ClassroomTheme } from './Settings';

interface PredictionActivityProps {
  items: PredictionItem[];
  theme?: ClassroomTheme;
  onComplete: (results: PreviewPredictionResult[]) => void;
  onSkip: () => void;
}

export const PredictionActivity: React.FC<PredictionActivityProps> = ({
  items,
  theme = 'light',
  onComplete,
  onSkip,
}) => {
  const isDark = theme === 'dark';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [id: string]: string }>({});
  const [showArabic, setShowArabic] = useState(false);

  const currentItem = items[currentIndex];
  const isLastItem = currentIndex === items.length - 1;
  const answeredCount = Object.keys(answers).length;
  const progressPercent = (answeredCount / items.length) * 100;

  const handleSelectOption = (option: string) => {
    setAnswers(prev => ({ ...prev, [currentItem.id]: option }));
  };

  const handleNext = () => {
    if (isLastItem) {
      const results: PreviewPredictionResult[] = items.map(item => ({
        itemId: item.id,
        question: item.question,
        selectedOption: answers[item.id] || '',
      }));
      onComplete(results);
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (!currentItem) {
    return null;
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-purple-50 to-indigo-100'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-20 shadow-sm flex-shrink-0 ${isDark ? 'bg-slate-800 border-b border-slate-700' : 'bg-white/90 backdrop-blur border-b border-purple-100'}`}>
        {/* Progress Bar */}
        <div className={`h-1 ${isDark ? 'bg-slate-700' : 'bg-purple-100'}`}>
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-purple-900'}`}>
              Before You Listen
            </h1>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-purple-600'}`}>
              Question {currentIndex + 1} of {items.length}
            </p>
          </div>
          <button
            onClick={onSkip}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-purple-500 hover:bg-purple-50'
            }`}
          >
            Skip
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className={`w-full max-w-md ${isDark ? 'bg-slate-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
          {/* Question */}
          <div className="mb-6">
            <p className={`text-xl font-semibold text-center mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {currentItem.question}
            </p>
            {currentItem.questionArabic && (
              showArabic ? (
                <p className={`text-lg text-center animate-fade-in ${isDark ? 'text-slate-400' : 'text-slate-500'}`} dir="rtl">
                  {currentItem.questionArabic}
                </p>
              ) : (
                <button
                  onClick={() => setShowArabic(true)}
                  className={`mx-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  Translate
                </button>
              )
            )}
          </div>

          {/* Options */}
          <div className="space-y-3 mb-6">
            {currentItem.options.map((option, idx) => {
              const isSelected = answers[currentItem.id] === option;
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(option)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    isSelected
                      ? isDark
                        ? 'bg-purple-600 text-white border-2 border-purple-400'
                        : 'bg-purple-500 text-white border-2 border-purple-300'
                      : isDark
                      ? 'bg-slate-700 text-slate-200 border-2 border-slate-600 hover:border-purple-500'
                      : 'bg-purple-50 text-slate-700 border-2 border-purple-200 hover:border-purple-400'
                  }`}
                >
                  <span className="font-medium">{option}</span>
                </button>
              );
            })}
          </div>

          {/* Hint */}
          <p className={`text-center text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {showArabic
              ? <span dir="rtl">لا توجد إجابة خاطئة — شارك أفكارك!</span>
              : "There's no wrong answer — share your thoughts!"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className={`sticky bottom-0 p-4 flex gap-3 ${isDark ? 'bg-slate-800 border-t border-slate-700' : 'bg-white/90 backdrop-blur border-t border-purple-100'}`}>
        {currentIndex > 0 && (
          <button
            onClick={handlePrevious}
            className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
              isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Previous
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={!answers[currentItem.id]}
          className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
            answers[currentItem.id]
              ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-400 hover:to-indigo-400'
              : isDark
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isLastItem ? 'Continue' : 'Next'}
        </button>
      </div>
    </div>
  );
};
