import React, { useState, useMemo } from 'react';
import { WordAssociationItem, PreviewWordAssocResult } from '../types';
import { ClassroomTheme } from './Settings';
import { useContentLabel } from '../contexts/ContentLabelContext';

interface WordAssociationActivityProps {
  items: WordAssociationItem[];
  theme?: ClassroomTheme;
  onComplete: (results: PreviewWordAssocResult[]) => void;
  onSkip: () => void;
}

export const WordAssociationActivity: React.FC<WordAssociationActivityProps> = ({
  items,
  theme = 'light',
  onComplete,
  onSkip,
}) => {
  const isDark = theme === 'dark';
  const label = useContentLabel();
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);

  // Shuffle words for display
  const shuffledItems = useMemo(() => {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [items]);

  const inDialogueCount = items.filter(i => i.inDialogue).length;
  const selectedCount = selectedWords.size;

  const handleWordClick = (word: string) => {
    if (showResults) return;

    setSelectedWords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(word)) {
        newSet.delete(word);
      } else {
        newSet.add(word);
      }
      return newSet;
    });
  };

  const handleCheckAnswers = () => {
    setShowResults(true);
  };

  const getWordStatus = (item: WordAssociationItem) => {
    if (!showResults) return 'neutral';
    const isSelected = selectedWords.has(item.word);
    if (isSelected && item.inDialogue) return 'correct';
    if (isSelected && !item.inDialogue) return 'incorrect';
    if (!isSelected && item.inDialogue) return 'missed';
    return 'neutral';
  };

  const correctCount = items.filter(i => i.inDialogue && selectedWords.has(i.word)).length;
  const scorePercent = inDialogueCount > 0 ? Math.round((correctCount / inDialogueCount) * 100) : 0;

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-teal-50 to-cyan-100'}`}>
      {/* Header */}
      <div className={`sticky top-0 z-20 shadow-sm flex-shrink-0 ${isDark ? 'bg-slate-800 border-b border-slate-700' : 'bg-white/90 backdrop-blur border-b border-teal-100'}`}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-teal-900'}`}>
              Word Prediction
            </h1>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-teal-600'}`}>
              Which words will you {label.verb} in {label.theType}?
            </p>
          </div>
          <button
            onClick={onSkip}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-teal-500 hover:bg-teal-50'
            }`}
          >
            Skip
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className={`px-4 py-3 ${isDark ? 'bg-slate-800/50' : 'bg-white/60'}`}>
        <p className={`text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Tap the words you think will appear in {label.theType}
        </p>
        <p className={`text-center text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`} dir="rtl">
          اضغط على الكلمات التي تعتقد أنها ستظهر في {label.verb === 'read' ? 'النص' : 'الحوار'}
        </p>
      </div>

      {/* Words Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
          {shuffledItems.map((item) => {
            const isSelected = selectedWords.has(item.word);
            const status = getWordStatus(item);

            let bgClass = '';
            let textClass = '';
            let borderClass = '';

            if (showResults) {
              switch (status) {
                case 'correct':
                  bgClass = isDark ? 'bg-green-600' : 'bg-green-500';
                  textClass = 'text-white';
                  borderClass = 'border-transparent';
                  break;
                case 'incorrect':
                  bgClass = isDark ? 'bg-red-600' : 'bg-red-500';
                  textClass = 'text-white';
                  borderClass = 'border-transparent';
                  break;
                case 'missed':
                  bgClass = isDark ? 'bg-slate-700' : 'bg-amber-100';
                  textClass = isDark ? 'text-amber-400' : 'text-amber-700';
                  borderClass = isDark ? 'border-amber-500' : 'border-amber-400';
                  break;
                default:
                  bgClass = isDark ? 'bg-slate-700' : 'bg-white';
                  textClass = isDark ? 'text-slate-400' : 'text-slate-400';
                  borderClass = isDark ? 'border-slate-600' : 'border-slate-200';
              }
            } else {
              if (isSelected) {
                bgClass = isDark ? 'bg-teal-600' : 'bg-teal-500';
                textClass = 'text-white';
                borderClass = 'border-transparent';
              } else {
                bgClass = isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-white hover:bg-teal-50';
                textClass = isDark ? 'text-slate-200' : 'text-slate-700';
                borderClass = isDark ? 'border-slate-600 hover:border-teal-500' : 'border-teal-200 hover:border-teal-400';
              }
            }

            return (
              <button
                key={item.id}
                onClick={() => handleWordClick(item.word)}
                disabled={showResults}
                className={`px-4 py-2 rounded-full font-medium text-sm border-2 transition-all ${bgClass} ${textClass} ${borderClass} ${
                  showResults ? 'cursor-default' : ''
                }`}
              >
                {item.word}
                {showResults && status === 'correct' && ' ✓'}
                {showResults && status === 'incorrect' && ' ✗'}
                {showResults && status === 'missed' && ' ○'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Banner */}
      {showResults && (
        <div className={`px-4 py-4 ${scorePercent >= 70 ? 'bg-green-500' : 'bg-amber-500'} text-white`}>
          <div className="text-center">
            <p className="font-bold text-xl">{correctCount} / {inDialogueCount} correct</p>
            <p className="text-sm opacity-90">Now {label.verb} and see how many you got right!</p>
          </div>
        </div>
      )}

      {/* Bottom Action */}
      <div className={`sticky bottom-0 p-4 ${isDark ? 'bg-slate-800 border-t border-slate-700' : 'bg-white/90 backdrop-blur border-t border-teal-100'}`}>
        {!showResults ? (
          <div className="flex gap-3">
            <div className={`flex-1 text-center py-3 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-teal-50'}`}>
              <span className={`font-semibold ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>
                {selectedCount} words selected
              </span>
            </div>
            <button
              onClick={handleCheckAnswers}
              disabled={selectedCount === 0}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                selectedCount > 0
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-400 hover:to-cyan-400'
                  : isDark
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Check Predictions
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              const results: PreviewWordAssocResult[] = items.map(item => ({
                itemId: item.id,
                word: item.word,
                inDialogue: item.inDialogue,
                studentSelected: selectedWords.has(item.word),
                correct: item.inDialogue === selectedWords.has(item.word),
              }));
              onComplete(results);
            }}
            className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-teal-500 to-cyan-500 text-white"
          >
            Continue to {label.imperative}ing
          </button>
        )}
      </div>
    </div>
  );
};
