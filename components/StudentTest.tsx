import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ListeningTest, TestQuestion, TestSessionLog, MatchPhaseResult, GapFillPhaseResult, PreviewPhaseResult, QuestionsItemResult } from '../types';
import { CheckCircleIcon } from './Icons';
import { ClassroomTheme, ContentModel } from './Settings';
import { LexisMatchGame } from './LexisMatchGame';
import { LexisGapFillGame } from './LexisGapFillGame';
import { PreviewPhase } from './PreviewPhase';
import { FollowUpQuestions } from './FollowUpQuestions';
import { useAppMode } from '../contexts/AppModeContext';
import { ContentLabelProvider } from '../contexts/ContentLabelContext';
import { getContentLabels } from '../utils/contentLabels';

interface StudentTestProps {
  test: ListeningTest;
  theme?: ClassroomTheme;
  isPreview?: boolean;
  onExitPreview?: () => void;
  contentModel?: ContentModel;
}

// SessionStorage key for tracking completed pre-test activities per test
const getActivitiesCompletedKey = (testId: string) => `test-activities-done-${testId}`;

// SessionStorage key for full session state persistence across tab suspension
const getSessionKey = (testId: string) => `st_${testId}`;

interface SavedSessionState {
  testPhase: TestPhase;
  answers: { [questionId: string]: string };
  isSubmitted: boolean;
  score: number | null;
  showDiscussion: boolean;
  sessionLog: TestSessionLog;
}

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

// OpenAI Responses API helper (same pattern as FollowUpQuestions)
async function callOpenAI(model: string, instructions: string, input: string): Promise<string> {
  const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    throw new Error('OpenAI API key not configured');
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, instructions, input }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }
  const data = await response.json();
  const messageOutput = data.output?.find((o: { type: string }) => o.type === 'message');
  return messageOutput?.content?.[0]?.text || '';
}

function buildBonusPrompt(count: number, difficulty: string, isReading: boolean): string {
  const contentType = isReading ? 'reading passage' : 'listening transcript';
  return `You are an ESL test question generator. Generate exactly ${count} NEW multiple-choice comprehension questions based on the provided ${contentType}.

## Rules
- Each question must have exactly 4 options (A, B, C, D)
- "correctAnswer" must match one option exactly (character-for-character)
- Test a variety of skills: main ideas, specific details, inferences, vocabulary in context, speaker/author intent
- Include an "explanation" in English explaining why the correct answer is right
- Include an "explanationArabic" with an Arabic explanation
- Do NOT repeat any of the existing questions provided
- Difficulty level: ${difficulty}
- Questions should be progressively challenging within the set

## Output format
Return ONLY valid JSON:
{
  "questions": [
    {
      "questionText": "What is the main idea of...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      "explanation": "English explanation of why this is correct",
      "explanationArabic": "شرح بالعربية"
    }
  ]
}`;
}

export const StudentTest: React.FC<StudentTestProps> = ({ test, theme = 'light', isPreview = false, onExitPreview, contentModel = 'gpt-5-mini' }) => {
  const isDark = theme === 'dark';
  const appMode = useAppMode();
  const isReading = appMode === 'reading';
  const contentLabel = useMemo(() => getContentLabels(test.speakerCount, appMode), [test.speakerCount, appMode]);
  const [passageExpanded, setPassageExpanded] = useState(true);
  const [passageFullscreen, setPassageFullscreen] = useState(false);
  const [passageFontSize, setPassageFontSize] = useState(1.125); // rem (~text-lg)

  // Try to restore session state from sessionStorage (survives tab suspension)
  const savedState = useMemo<SavedSessionState | null>(() => {
    try {
      const raw = sessionStorage.getItem(getSessionKey(test.id));
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }, [test.id]);

  const [answers, setAnswers] = useState<{ [questionId: string]: string }>(savedState?.answers || {});
  const [isSubmitted, setIsSubmitted] = useState(savedState?.isSubmitted || false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [score, setScore] = useState<number | null>(savedState?.score ?? null);
  const [showDiscussion, setShowDiscussion] = useState(savedState?.showDiscussion || false);

  // Bonus practice rounds
  const [bonusRounds, setBonusRounds] = useState<TestQuestion[][]>([]);
  const [bonusAnswers, setBonusAnswers] = useState<{ [questionId: string]: string }>({});
  const [bonusSubmitted, setBonusSubmitted] = useState<Set<number>>(new Set());
  const [bonusScores, setBonusScores] = useState<{ score: number; correct: number; total: number }[]>([]);
  const [isGeneratingBonus, setIsGeneratingBonus] = useState(false);
  const [bonusError, setBonusError] = useState<string | null>(null);

  // Single state machine for test phase: match → gapfill → preview → questions
  const [testPhase, setTestPhase] = useState<TestPhase>(
    savedState?.testPhase || (() => getInitialTestPhase(test, isPreview))
  );

  // Pre-fetch transcript/source text on mount so it's ready when discussion starts
  const [transcript, setTranscript] = useState(test.sourceText || '');
  useEffect(() => {
    // Reading tests already have sourceText; listening tests fetch from audio entry
    if (test.sourceText) {
      setTranscript(test.sourceText);
    } else if (test.audioId) {
      fetch(`/api/audio-entries/${test.audioId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.transcript) setTranscript(data.transcript); })
        .catch(() => {}); // Silent fail — FollowUpQuestions has its own fallback
    }
  }, [test.audioId, test.sourceText]);

  // Session performance log — restore from saved state if available
  const sessionLog = useRef<TestSessionLog>(savedState?.sessionLog || { testId: test.id });

  // Persist session state to sessionStorage on changes (survives tab suspension)
  useEffect(() => {
    const state: SavedSessionState = {
      testPhase, answers, isSubmitted, score, showDiscussion,
      sessionLog: sessionLog.current,
    };
    try {
      sessionStorage.setItem(getSessionKey(test.id), JSON.stringify(state));
    } catch {}
  }, [testPhase, answers, isSubmitted, score, showDiscussion, test.id]);

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

  const advanceFromMatch = useCallback((results: MatchPhaseResult) => {
    sessionLog.current.match = results;
    if (hasLexisGapFillGame) {
      setTestPhase('gapfill');
    } else if (hasPreviewActivities) {
      setTestPhase('preview');
    } else {
      setTestPhase('questions');
      markActivitiesDone();
    }
  }, [hasLexisGapFillGame, hasPreviewActivities, markActivitiesDone]);

  const advanceFromGapFill = useCallback((results: GapFillPhaseResult) => {
    sessionLog.current.gapFill = results;
    if (hasPreviewActivities) {
      setTestPhase('preview');
    } else {
      setTestPhase('questions');
      markActivitiesDone();
    }
  }, [hasPreviewActivities, markActivitiesDone]);

  const advanceFromPreview = useCallback((results: PreviewPhaseResult) => {
    sessionLog.current.preview = results;
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
    const questionResults: QuestionsItemResult[] = [];
    let correct = 0;
    test.questions.forEach(q => {
      const userAnswer = answers[q.id]?.toLowerCase().trim() || '';
      const correctAnswer = q.correctAnswer.toLowerCase().trim();
      const isCorrect = userAnswer === correctAnswer;
      if (isCorrect) correct++;
      questionResults.push({
        questionId: q.id,
        questionText: q.questionText,
        correctAnswer: q.correctAnswer,
        studentAnswer: answers[q.id] || '',
        correct: isCorrect,
      });
    });

    const finalScore = Math.round((correct / test.questions.length) * 100);

    // Store questions phase in session log
    sessionLog.current.questions = { score: finalScore, items: questionResults };
    console.log('[SessionLog]', sessionLog.current);

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

  const handleStartDiscussion = () => {
    setShowDiscussion(true);
  };

  const handleBackFromDiscussion = () => {
    setShowDiscussion(false);
  };

  // Bonus practice: generate additional questions
  const handleGenerateBonus = useCallback(async (count: 5 | 10) => {
    setIsGeneratingBonus(true);
    setBonusError(null);
    try {
      const allExistingQuestions = [
        ...test.questions.map(q => q.questionText),
        ...bonusRounds.flat().map(q => q.questionText),
      ];

      const input = JSON.stringify({
        transcript: (transcript || test.sourceText || '').slice(0, 4000),
        existingQuestions: allExistingQuestions,
      });

      const text = await callOpenAI(
        contentModel,
        buildBonusPrompt(count, test.difficulty || 'B1', isReading),
        input,
      );

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]);
      const qs: TestQuestion[] = (parsed.questions || []).map((q: any, i: number) => ({
        ...q,
        id: `bonus-${bonusRounds.length}-${i}`,
      }));

      if (qs.length === 0) throw new Error('No questions generated');

      setBonusRounds(prev => [...prev, qs]);
    } catch (err) {
      console.error('[Bonus] Generate error:', err);
      setBonusError(err instanceof Error ? err.message : 'Failed to generate questions');
    } finally {
      setIsGeneratingBonus(false);
    }
  }, [test, transcript, contentModel, isReading, bonusRounds]);

  // Bonus practice: submit a round
  const handleSubmitBonus = useCallback((roundIndex: number) => {
    const round = bonusRounds[roundIndex];
    if (!round) return;
    let correct = 0;
    for (const q of round) {
      const userAnswer = (bonusAnswers[q.id] || '').toLowerCase().trim();
      const correctAnswer = q.correctAnswer.toLowerCase().trim();
      if (userAnswer === correctAnswer) correct++;
    }
    const scoreVal = Math.round((correct / round.length) * 100);
    setBonusScores(prev => {
      const updated = [...prev];
      updated[roundIndex] = { score: scoreVal, correct, total: round.length };
      return updated;
    });
    setBonusSubmitted(prev => new Set(prev).add(roundIndex));
  }, [bonusRounds, bonusAnswers]);

  // Bonus answer status helper
  const getBonusAnswerStatus = (questionId: string, roundIndex: number) => {
    if (!bonusSubmitted.has(roundIndex)) return null;
    const round = bonusRounds[roundIndex];
    const question = round?.find(q => q.id === questionId);
    if (!question) return null;
    const userAnswer = (bonusAnswers[questionId] || '').toLowerCase().trim();
    return userAnswer === question.correctAnswer.toLowerCase().trim() ? 'correct' : 'incorrect';
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
      <ContentLabelProvider label={contentLabel}>
        <PreviewPhase
          activities={test.preview}
          theme={theme}
          onComplete={advanceFromPreview}
          onSkip={advanceFromPreview}
        />
      </ContentLabelProvider>
    );
  }

  // Phase 4: Questions (main test)

  // Full-screen discussion mode (after clicking "Continue to Discussion")
  if (isSubmitted && showDiscussion) {
    return (
      <ContentLabelProvider label={contentLabel}>
        <FollowUpQuestions
          sessionLog={sessionLog.current}
          transcript={transcript}
          test={test}
          contentModel={contentModel}
          theme={theme}
          onBack={handleBackFromDiscussion}
        />
      </ContentLabelProvider>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Fullscreen Reading Passage Overlay */}
      {passageFullscreen && test.sourceText && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{
            background: isDark ? '#0f172a' : '#fffbeb',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 flex-shrink-0 border-b ${isDark ? 'border-slate-700' : 'border-amber-200'}`}>
            <span className={`font-semibold text-sm ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
              Reading Passage
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPassageFontSize(s => Math.max(0.75, +(s - 0.125).toFixed(3)))}
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${
                  isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
              >
                A-
              </button>
              <button
                onClick={() => setPassageFontSize(s => Math.min(2.0, +(s + 0.125).toFixed(3)))}
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${
                  isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
              >
                A+
              </button>
              <button
                onClick={() => setPassageFullscreen(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
          {/* Scrollable passage body */}
          <div
            className="flex-1 overflow-y-auto px-5 py-6"
            style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
          >
            <div
              className={`max-w-2xl mx-auto leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
              style={{ fontSize: `${passageFontSize}rem` }}
            >
              {test.sourceText}
            </div>
          </div>
        </div>
      )}

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
              {bonusScores.length > 0 && (
                <span className="ml-2 text-sm opacity-90">
                  + Bonus: {bonusScores[bonusScores.length - 1].score}%
                </span>
              )}
            </div>
            <button
              onClick={handleStartDiscussion}
              className="px-3 py-1 bg-white/20 rounded text-sm font-medium hover:bg-white/30"
            >
              {isReading ? 'Post-Reading Task' : 'Post-Listening Task'}
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Questions List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3 space-y-2 max-w-2xl mx-auto">
          {/* Reading Passage Panel — shown for reading tests */}
          {isReading && test.sourceText && (
            <div className={`rounded-xl border mb-3 ${isDark ? 'border-emerald-700 bg-emerald-900/20' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className={`w-full px-4 py-3 flex items-center justify-between ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                <button
                  onClick={() => setPassageExpanded(!passageExpanded)}
                  className="font-semibold text-sm flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                  Reading Passage
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${passageExpanded ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <button
                  onClick={() => setPassageFullscreen(true)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                  title="Fullscreen reader"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </button>
              </div>
              {passageExpanded && (
                <div className={`px-4 pb-4 text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {test.sourceText}
                </div>
              )}
            </div>
          )}

          {/* Bonus Practice Section — only after submission */}
          {isSubmitted && (
            <>
              {/* CTA card */}
              {!isGeneratingBonus && (
                <div className={`rounded-xl border mb-3 p-4 text-center ${isDark ? 'border-indigo-700 bg-indigo-900/20' : 'border-indigo-200 bg-indigo-50'}`}>
                  <p className={`font-medium text-sm mb-3 ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>
                    Want more practice?
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => handleGenerateBonus(5)}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                    >
                      +5 Questions
                    </button>
                    <button
                      onClick={() => handleGenerateBonus(10)}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                    >
                      +10 Questions
                    </button>
                  </div>
                  {bonusError && (
                    <p className="text-xs text-red-500 mt-2">{bonusError}</p>
                  )}
                </div>
              )}

              {/* Loading state */}
              {isGeneratingBonus && (
                <div className={`rounded-xl border mb-3 p-6 text-center ${isDark ? 'border-indigo-700 bg-indigo-900/20' : 'border-indigo-200 bg-indigo-50'}`}>
                  <svg className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className={`text-sm font-medium ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                    Generating new questions...
                  </p>
                </div>
              )}

              {/* Bonus rounds (newest first) */}
              {[...bonusRounds].reverse().map((round, revIdx) => {
                const roundIndex = bonusRounds.length - 1 - revIdx;
                const roundSubmitted = bonusSubmitted.has(roundIndex);
                const roundScore = bonusScores[roundIndex];
                const allAnswered = round.every(q => bonusAnswers[q.id]?.trim());

                return (
                  <div key={roundIndex} className="mb-3">
                    {/* Round header */}
                    <div className={`flex items-center justify-between px-2 py-1.5 mb-1.5 ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Bonus Round {roundIndex + 1}
                        {roundSubmitted && roundScore && (
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                            roundScore.score >= 70 ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
                          }`}>
                            {roundScore.score}% ({roundScore.correct}/{roundScore.total})
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Questions in this round */}
                    <div className="space-y-2">
                      {round.map((question, qIdx) => {
                        const status = getBonusAnswerStatus(question.id, roundIndex);
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
                            <div className="px-3 py-2 flex items-start gap-2">
                              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                status === 'correct' ? 'bg-green-500 text-white'
                                : status === 'incorrect' ? 'bg-red-500 text-white'
                                : isDark ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white'
                              }`}>
                                {qIdx + 1}
                              </span>
                              <p className={`text-sm leading-snug pt-0.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                {question.questionText}
                              </p>
                            </div>
                            {/* Options */}
                            {question.options && (
                              <div className="px-3 pb-2 grid grid-cols-2 gap-1.5">
                                {question.options.map((option, optIndex) => {
                                  const letter = String.fromCharCode(65 + optIndex);
                                  const isSelected = bonusAnswers[question.id] === option;
                                  const isCorrectAnswer = option === question.correctAnswer;
                                  return (
                                    <button
                                      key={optIndex}
                                      onClick={() => {
                                        if (!roundSubmitted) {
                                          setBonusAnswers(prev => ({ ...prev, [question.id]: option }));
                                        }
                                      }}
                                      disabled={roundSubmitted}
                                      className={`p-2 rounded-lg border text-left text-xs transition-colors ${
                                        roundSubmitted
                                          ? isCorrectAnswer
                                            ? isDark ? 'border-green-500 bg-green-900/40 text-green-300' : 'border-green-400 bg-green-100 text-green-800'
                                            : isSelected && !isCorrectAnswer
                                            ? isDark ? 'border-red-500 bg-red-900/40 text-red-300' : 'border-red-400 bg-red-100 text-red-800'
                                            : isDark ? 'border-slate-700 bg-slate-800/50 text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-400'
                                          : isSelected
                                          ? isDark ? 'border-indigo-500 bg-indigo-900/50 text-white' : 'border-indigo-500 bg-indigo-50 text-indigo-900'
                                          : isDark ? 'border-slate-600 bg-slate-700/50 text-slate-300 hover:border-indigo-500' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-400'
                                      }`}
                                    >
                                      <span className="font-medium mr-1">{letter}.</span>
                                      {option}
                                      {roundSubmitted && isCorrectAnswer && (
                                        <span className="ml-1 text-green-500"><CheckCircleIcon /></span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {/* Explanation for incorrect answers */}
                            {roundSubmitted && status === 'incorrect' && (question.explanation || question.explanationArabic) && (
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

                    {/* Submit button for this round */}
                    {!roundSubmitted && (
                      <button
                        onClick={() => handleSubmitBonus(roundIndex)}
                        disabled={!allAnswered}
                        className={`w-full mt-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                          allAnswered
                            ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                            : isDark ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        Submit Bonus Round {roundIndex + 1}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}

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
                {(test.type === 'listening-comprehension' || test.type === 'reading-comprehension') && question.options && (
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
                          className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left text-sm transition-all ${
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
                          <span className={`flex-1 text-sm leading-snug ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{option}</span>
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
