import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LexisItem, MatchPhaseResult } from '../types';
import { ClassroomTheme } from './Settings';

interface LexisMatchGameProps {
  lexis: LexisItem[];
  theme?: ClassroomTheme;
  onComplete: (results: MatchPhaseResult) => void;
  onSkip: (results: MatchPhaseResult) => void;
}

interface Card {
  id: string;
  content: string;
  pairId: string;
  type: 'english' | 'arabic';
}

export const LexisMatchGame: React.FC<LexisMatchGameProps> = ({
  lexis,
  theme = 'light',
  onComplete,
  onSkip,
}) => {
  const isDark = theme === 'dark';

  // Generate shuffled cards from lexis items
  const cards = useMemo(() => {
    const cardList: Card[] = [];

    lexis.forEach((item) => {
      // Only include items that have Arabic translation
      if (item.definitionArabic) {
        // English card
        cardList.push({
          id: `${item.id}-en`,
          content: item.term,
          pairId: item.id,
          type: 'english',
        });
        // Arabic card
        cardList.push({
          id: `${item.id}-ar`,
          content: item.definitionArabic,
          pairId: item.id,
          type: 'arabic',
        });
      }
    });

    // Shuffle cards using Fisher-Yates
    const shuffled = [...cardList];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }, [lexis]);

  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [incorrectPair, setIncorrectPair] = useState<[string, string] | null>(null);
  const [attempts, setAttempts] = useState(0);

  // Track wrong-guess count per pair for session log
  const pairAttemptCounts = useRef<Map<string, number>>(new Map());

  const buildResults = (completed: boolean): MatchPhaseResult => ({
    completed,
    totalAttempts: attempts,
    items: lexis
      .filter(item => item.definitionArabic)
      .map(item => ({
        lexisItemId: item.id,
        term: item.term,
        attemptsBeforeMatch: pairAttemptCounts.current.get(item.id) || 0,
        matched: matchedPairs.has(item.id),
      })),
  });

  const totalPairs = cards.length / 2;
  const matchedCount = matchedPairs.size;
  const progressPercent = totalPairs > 0 ? (matchedCount / totalPairs) * 100 : 0;
  const isComplete = matchedCount === totalPairs && totalPairs > 0;

  // Auto-complete callback when all matched
  useEffect(() => {
    if (isComplete) {
      // Small delay before calling complete to show final state
      const timer = setTimeout(() => {
        onComplete(buildResults(true));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, onComplete]);

  const handleCardClick = (cardId: string) => {
    const clickedCard = cards.find(c => c.id === cardId);
    if (!clickedCard) return;

    // Don't allow clicking already matched cards
    if (matchedPairs.has(clickedCard.pairId)) return;

    // Don't allow clicking same card twice
    if (selectedCard === cardId) return;

    // Don't allow clicking during incorrect animation
    if (incorrectPair) return;

    if (!selectedCard) {
      // First card selected
      setSelectedCard(cardId);
    } else {
      // Second card selected - check for match
      const firstCard = cards.find(c => c.id === selectedCard);
      if (!firstCard) return;

      setAttempts(prev => prev + 1);

      if (firstCard.pairId === clickedCard.pairId && firstCard.type !== clickedCard.type) {
        // Match found!
        setMatchedPairs(prev => new Set([...prev, firstCard.pairId]));
        setSelectedCard(null);
      } else {
        // No match - track wrong guesses per pair
        pairAttemptCounts.current.set(firstCard.pairId, (pairAttemptCounts.current.get(firstCard.pairId) || 0) + 1);
        pairAttemptCounts.current.set(clickedCard.pairId, (pairAttemptCounts.current.get(clickedCard.pairId) || 0) + 1);
        // Show error briefly
        setIncorrectPair([selectedCard, cardId]);
        setTimeout(() => {
          setIncorrectPair(null);
          setSelectedCard(null);
        }, 800);
      }
    }
  };

  const getCardState = (card: Card): 'default' | 'selected' | 'matched' | 'incorrect' => {
    if (matchedPairs.has(card.pairId)) return 'matched';
    if (incorrectPair?.includes(card.id)) return 'incorrect';
    if (selectedCard === card.id) return 'selected';
    return 'default';
  };

  // If no lexis with Arabic translations, show skip prompt
  if (cards.length === 0) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className={`text-center max-w-md ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <p className="mb-4">No vocabulary items with translations available for this test.</p>
          <button
            onClick={() => onSkip(buildResults(false))}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
          >
            Continue to Questions
          </button>
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
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Vocabulary Match
            </h1>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Match English words with Arabic translations
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {matchedCount}/{totalPairs}
              </div>
              <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Matched</div>
            </div>
            <button
              onClick={() => onSkip(buildResults(false))}
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

      {/* Game Board */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto">
          {/* Instructions */}
          {matchedCount === 0 && (
            <div className={`mb-4 p-3 rounded-xl text-center text-lg ${
              isDark ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
            }`} dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif" }}>
              اضغط على الكلمة الإنجليزية، ثم اضغط على ترجمتها العربية للمطابقة!
            </div>
          )}

          {/* Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {cards.map((card) => {
              const state = getCardState(card);
              const isArabic = card.type === 'arabic';

              return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card.id)}
                  disabled={state === 'matched'}
                  className={`
                    relative p-4 rounded-xl text-center font-medium transition-all duration-200
                    min-h-[80px] flex items-center justify-center
                    ${isArabic ? 'font-arabic text-lg' : 'text-sm'}
                    ${state === 'matched'
                      ? isDark
                        ? 'bg-green-900/50 border-2 border-green-500 text-green-300 scale-95 opacity-70'
                        : 'bg-green-100 border-2 border-green-400 text-green-700 scale-95 opacity-70'
                      : state === 'selected'
                      ? isDark
                        ? 'bg-indigo-600 border-2 border-indigo-400 text-white scale-105 shadow-lg shadow-indigo-500/30'
                        : 'bg-indigo-500 border-2 border-indigo-400 text-white scale-105 shadow-lg shadow-indigo-500/30'
                      : state === 'incorrect'
                      ? isDark
                        ? 'bg-red-900/50 border-2 border-red-500 text-red-300 animate-shake'
                        : 'bg-red-100 border-2 border-red-400 text-red-700 animate-shake'
                      : isDark
                        ? 'bg-slate-800 border-2 border-slate-600 text-slate-200 hover:border-slate-500 hover:bg-slate-700 active:scale-95'
                        : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:scale-95'
                    }
                  `}
                  dir={isArabic ? 'rtl' : 'ltr'}
                >
                  {card.content}
                  {state === 'matched' && (
                    <span className="absolute top-1 right-1 text-green-500">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Completion Message */}
          {isComplete && (
            <div className={`mt-6 p-6 rounded-2xl text-center ${
              isDark ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
            }`}>
              <div className="text-4xl mb-2">🎉</div>
              <h2 className={`text-xl font-bold mb-1 ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                All Matched!
              </h2>
              <p className={`text-sm mb-3 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                You completed in {attempts} attempts
              </p>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Proceeding to questions...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add shake animation style */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5px); }
          40%, 80% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
        .font-arabic {
          font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
        }
      `}</style>
    </div>
  );
};
