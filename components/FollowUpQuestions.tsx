import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ListeningTest, TestSessionLog, FollowUpQuestion, FollowUpFeedbackItem } from '../types';
import { ClassroomTheme, ContentModel } from './Settings';
import { useContentLabel } from '../contexts/ContentLabelContext';
import type { ContentLabel } from '../utils/contentLabels';

interface FollowUpQuestionsProps {
  sessionLog: TestSessionLog;
  transcript: string;
  test: ListeningTest;
  contentModel: ContentModel;
  theme?: ClassroomTheme;
  onBack: () => void;
}

type FollowUpPhase = 'generating' | 'answering' | 'evaluating' | 'feedback' | 'done';

const TYPE_LABELS: Record<FollowUpQuestion['type'], { label: string; color: string; darkColor: string }> = {
  connect: { label: 'Connect', color: 'bg-blue-100 text-blue-700', darkColor: 'bg-blue-900/50 text-blue-300' },
  compare: { label: 'Compare', color: 'bg-violet-100 text-violet-700', darkColor: 'bg-violet-900/50 text-violet-300' },
  judge: { label: 'Judge', color: 'bg-rose-100 text-rose-700', darkColor: 'bg-rose-900/50 text-rose-300' },
};

// Sentence starter chips per question type
const SENTENCE_STARTERS: Record<FollowUpQuestion['type'], string[]> = {
  connect: ['I think...', 'In my life...', 'This reminds me of...'],
  compare: ['The difference is...', 'I noticed that...', 'This is similar to...'],
  judge: ['I agree because...', 'I disagree because...', 'In my opinion...'],
};

// SessionStorage key for discussion state persistence across tab suspension
const getDiscSessionKey = (testId: string) => `st_${testId}_disc`;

interface SavedDiscussionState {
  phase: FollowUpPhase;
  questions: FollowUpQuestion[];
  answers: { [id: string]: string };
  feedback: FollowUpFeedbackItem[];
  currentIndex: number;
  feedbackLang: 'en' | 'ar';
}

// Show chips for A1-B1 only
function shouldShowChips(difficulty?: string): boolean {
  if (!difficulty) return true; // default to showing
  const level = difficulty.toUpperCase();
  return level.startsWith('A') || level === 'B1';
}

// Build a concise summary of what the student got wrong across all phases
function buildWeaknessSummary(log: TestSessionLog): string {
  const parts: string[] = [];

  if (log.match?.items) {
    const struggled = log.match.items.filter(i => i.attemptsBeforeMatch > 1);
    if (struggled.length > 0) {
      parts.push(`Vocabulary match struggles: ${struggled.map(i => `"${i.term}" (${i.attemptsBeforeMatch} attempts)`).join(', ')}`);
    }
  }

  if (log.gapFill?.items) {
    const wrong = log.gapFill.items.filter(i => !i.correct);
    const hinted = log.gapFill.items.filter(i => i.usedHint && i.correct);
    if (wrong.length > 0) {
      parts.push(`Gap-fill incorrect: ${wrong.map(i => `"${i.term}" (chose "${i.selectedAnswer}")`).join(', ')}`);
    }
    if (hinted.length > 0) {
      parts.push(`Gap-fill needed hints: ${hinted.map(i => `"${i.term}"`).join(', ')}`);
    }
  }

  if (log.preview?.trueFalse) {
    const wrong = log.preview.trueFalse.filter(i => !i.correct);
    if (wrong.length > 0) {
      parts.push(`True/false incorrect: ${wrong.map(i => `"${i.statement}"`).join(', ')}`);
    }
  }

  if (log.preview?.wordAssociation) {
    const wrong = log.preview.wordAssociation.filter(i => !i.correct);
    if (wrong.length > 0) {
      parts.push(`Word association mistakes: ${wrong.map(i => `"${i.word}" (${i.inDialogue ? 'missed' : 'false positive'})`).join(', ')}`);
    }
  }

  if (log.questions?.items) {
    const wrong = log.questions.items.filter(i => !i.correct);
    if (wrong.length > 0) {
      parts.push(`Comprehension questions wrong: ${wrong.map(i => `Q: "${i.questionText}" (answered "${i.studentAnswer}", correct: "${i.correctAnswer}")`).join('; ')}`);
    }
  }

  return parts.length > 0 ? parts.join('\n') : 'Student answered everything correctly.';
}

function buildMCQResults(log: TestSessionLog) {
  if (!log.questions?.items) return [];
  return log.questions.items.map(i => ({
    question: i.questionText,
    correctAnswer: i.correctAnswer,
    studentAnswer: i.studentAnswer,
    correct: i.correct,
  }));
}

function buildVocabulary(test: ListeningTest) {
  if (!test.lexis) return [];
  return test.lexis.map(l => ({
    term: l.term,
    definition: l.definition,
    definitionArabic: l.definitionArabic || '',
  }));
}

async function callOpenAI(model: string, instructions: string, input: string, reasoning?: { effort: string }): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    throw new Error('OpenAI API key not configured');
  }

  const body: Record<string, unknown> = { model, instructions, input };
  if (reasoning) body.reasoning = reasoning;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const messageOutput = data.output?.find((o: { type: string }) => o.type === 'message');
  return messageOutput?.content?.[0]?.text || '';
}

const getGenerateInstructions = (label: ContentLabel) => {
  const contentType = label.type;
  const activityType = label.verb === 'read' ? 'post-reading' : 'post-listening';
  const refType = label.theType;
  const changeFrame = label.verb === 'read' ? 'How would the meaning change if…' : 'How would the conversation change if…';

  return `You are an EFL ${activityType} discussion specialist. Your job is to generate exactly 3 open-ended discussion questions about a ${contentType} the student just completed.

QUESTION DESIGN — Bloom's Taxonomy Progression:
- Question 1 (type: "connect"): Apply level. Ask the student to connect something from ${refType} to their own life or experience. Use concrete, personal framing: "Have you ever…", "When was a time you…", "How is this similar to something in your life?"
- Question 2 (type: "compare"): Analyze level. Ask the student to compare, contrast, or explain WHY something happened in ${refType}. Use framing like "Why do you think [the author/character] said…", "What is the difference between…", "${changeFrame}"
- Question 3 (type: "judge"): Evaluate level. Ask the student to form an opinion or make a judgment about something in ${refType}. Use framing like "Do you agree with…", "What would you do differently?", "Was [the author/character] right to…"

SCORE-BASED ADAPTATION:
- If mcqScore is 80-100%: Push all 3 questions toward higher Bloom's levels. Q1 can be Analyze, Q2 and Q3 can be Evaluate.
- If mcqScore is 50-79%: Keep the progression as described. Q2 should target the topic area where wrong answers clustered.
- If mcqScore is below 50%: Keep all 3 at Apply/Connect level. Focus on personal connection to basic themes from ${refType}. Use simple vocabulary.

LANGUAGE CONSTRAINTS (based on difficulty/CEFR level):
- A1-A2: Use simple present tense, basic vocabulary (under 1000 word frequency), short sentences. Avoid conditionals or abstract language.
- B1: Use comparatives, simple conditionals ("If you were…"), moderate vocabulary.
- B1+/B2: Use conditionals, opinion language, more nuanced vocabulary.

RULES:
- Every question MUST reference specific content from the transcript (a character name, event, or detail).
- Avoid abstract or vague phrasing. Keep questions concrete and answerable.
- Provide Arabic translation for each question.
- These are DISCUSSION questions — there is no single correct answer.

SENTENCE STARTERS:
- For each question, provide exactly 3 short sentence starters (3-6 words each, ending with "...") that help the student begin their answer.
- Starters must be specific to the question content and text context — not generic phrases like "I think..." or "In my opinion...".
- For A1-A2 levels, use simple vocabulary in starters. For B1+, starters can use moderate vocabulary.
- Starters should offer different angles or approaches to answering the question.

Return valid JSON only:
{"questions":[{"id":"q1","type":"connect","question":"...","questionArabic":"...","starters":["...","...","..."]},{"id":"q2","type":"compare","question":"...","questionArabic":"...","starters":["...","...","..."]},{"id":"q3","type":"judge","question":"...","questionArabic":"...","starters":["...","...","..."]}]}`;
};

const getEvaluateInstructions = (label: ContentLabel) => {
  const contentType = label.type;
  const contentRef = label.verb === 'read' ? 'reading content' : 'listening content';
  const detailRef = label.theType;

  return `You are a warm, encouraging EFL teacher giving feedback on student discussion answers about a ${contentType}. These are open-ended discussion questions — there is no single "correct" answer. Your job is to acknowledge the student's thinking, connect it to test content, and help them grow.

For EACH question, provide 4 feedback components IN BOTH ENGLISH AND ARABIC:

1. "acknowledge" / "acknowledgeArabic" — Summarize and recast the student's idea in correct, natural English. If their English has errors, gently model the correct form without pointing out the mistake. If they wrote in Arabic or mixed languages, acknowledge the effort and provide the English version of what they expressed. (2-3 sentences) The Arabic version should be a natural, idiomatic Arabic translation of the English feedback.

2. "connectToTest" / "connectToTestArabic" — Link the student's answer to the ${contentRef}. If the student got a related comprehension question wrong, gently clarify that misunderstanding using their discussion answer as an entry point — but NEVER say "you got question X wrong" or reference question numbers. If they got it right, reinforce their understanding. (1-2 sentences) Provide Arabic translation.

3. "extendThinking" / "extendThinkingArabic" — Offer one new idea, perspective, or detail from ${detailRef} that the student didn't mention. Frame it as "You might also think about…" or "Another interesting point is…". This should genuinely add something, not repeat what they said. (1-2 sentences) Provide Arabic translation.

4. "vocabularyWord" / "vocabularyDefinition" / "vocabularyDefinitionArabic" / "vocabularySentence" / "vocabularySentenceArabic" — Pick ONE word from the test's vocabulary list that is relevant to the student's answer or the question topic. Provide: the word (always in English), its definition in English and Arabic, and a model sentence in English and Arabic using the word in context related to ${detailRef}.

TONE RULES:
- NEVER use "wrong", "incorrect", "error", "mistake"
- NEVER reference MCQ question numbers
- Be warm, specific, and encouraging — avoid empty superlatives like "Great job!" without substance
- If the student's answer is very short or off-topic, still find something to acknowledge and build on
- Each question's total feedback should be 65-100 words (excluding vocabulary)
- Arabic translations should be natural and idiomatic, not word-for-word

Return valid JSON only:
{"feedback":[{"questionId":"q1","acknowledge":"...","acknowledgeArabic":"...","connectToTest":"...","connectToTestArabic":"...","extendThinking":"...","extendThinkingArabic":"...","vocabularyWord":"...","vocabularyDefinition":"...","vocabularyDefinitionArabic":"...","vocabularySentence":"...","vocabularySentenceArabic":"..."},{"questionId":"q2",...},{"questionId":"q3",...}]}`;
};

// Step dots component
const StepDots: React.FC<{ total: number; current: number; isDark: boolean }> = ({ total, current, isDark }) => (
  <div className="flex items-center gap-2">
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
          i < current
            ? 'bg-indigo-500'
            : i === current
            ? 'bg-indigo-500 scale-125'
            : isDark ? 'bg-slate-600' : 'bg-slate-300'
        }`}
      />
    ))}
  </div>
);

// Progress stages for generating and evaluating
const GENERATE_STAGES = [
  { threshold: 0, label: 'Preparing your results...' },
  { threshold: 15, label: 'Analyzing your answers...' },
  { threshold: 40, label: 'Creating discussion questions...' },
  { threshold: 75, label: 'Almost ready...' },
];

const EVALUATE_STAGES = [
  { threshold: 0, label: 'Reading your responses...' },
  { threshold: 15, label: 'Generating feedback...' },
  { threshold: 40, label: 'Crafting personalized insights...' },
  { threshold: 75, label: 'Almost ready...' },
];

// Animated progress loader with timed stages
const ProgressLoader: React.FC<{
  mode: 'generating' | 'evaluating';
  isDark: boolean;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}> = ({ mode, isDark, error, onRetry, onBack }) => {
  const [progress, setProgress] = useState(0);
  const startTime = useRef(Date.now());
  const stages = mode === 'generating' ? GENERATE_STAGES : EVALUATE_STAGES;

  useEffect(() => {
    startTime.current = Date.now();
    setProgress(0);
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      // Non-linear easing: fast start, slow crawl
      let p: number;
      if (elapsed < 0.8) p = (elapsed / 0.8) * 15;                    // 0-15% in 0.8s
      else if (elapsed < 3) p = 15 + ((elapsed - 0.8) / 2.2) * 25;    // 15-40% in 2.2s
      else if (elapsed < 8) p = 40 + ((elapsed - 3) / 5) * 35;        // 40-75% in 5s
      else if (elapsed < 20) p = 75 + ((elapsed - 8) / 12) * 15;      // 75-90% in 12s
      else p = 90 + Math.min((elapsed - 20) / 30, 1) * 5;             // 90-95% crawl
      setProgress(Math.min(p, 95));
    }, 100);
    return () => clearInterval(interval);
  }, [mode]);

  // Determine current stage label
  const currentLabel = [...stages].reverse().find(s => progress >= s.threshold)?.label || stages[0].label;
  // Determine which step (0-2) for the dots
  const stepIndex = progress < 15 ? 0 : progress < 75 ? 1 : 2;

  return (
    <>
      {/* Back button */}
      <div className={`px-4 py-3 ${isDark ? 'bg-slate-800' : 'bg-white/80 backdrop-blur'}`}>
        <button onClick={onBack} className={`text-sm font-medium ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
          ← Back to Results
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-xs text-center px-4">
          {/* Progress bar */}
          <div className={`h-2 rounded-full overflow-hidden mb-4 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Status text */}
          <p className={`text-sm font-medium mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {currentLabel}
          </p>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-3 mb-2">
            {['Prepare', 'Generate', 'Done'].map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  i < stepIndex
                    ? 'bg-indigo-500'
                    : i === stepIndex
                    ? 'bg-indigo-500 scale-125'
                    : isDark ? 'bg-slate-600' : 'bg-slate-300'
                }`} />
                <span className={`text-[10px] ${
                  i <= stepIndex
                    ? isDark ? 'text-indigo-400' : 'text-indigo-600'
                    : isDark ? 'text-slate-600' : 'text-slate-400'
                }`}>{label}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4">
              <p className="text-sm text-red-500 mb-2">{error}</p>
              <button
                onClick={onRetry}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-400"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// Arabic font style for RTL content
const arabicFontStyle = { fontFamily: "'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif" };

// Accordion section for feedback (bilingual)
const FeedbackSection: React.FC<{
  title: string;
  titleArabic: string;
  icon: string;
  content: string;
  contentArabic: string;
  language: 'en' | 'ar';
  defaultOpen?: boolean;
  borderColor: string;
  isDark: boolean;
}> = ({ title, titleArabic, icon, content, contentArabic, language, defaultOpen = false, borderColor, isDark }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isAr = language === 'ar';
  const displayTitle = isAr ? titleArabic : title;
  const displayContent = isAr ? (contentArabic || content) : content;

  return (
    <div className={`rounded-lg border-l-4 ${borderColor} overflow-hidden ${isDark ? 'bg-slate-700/50' : 'bg-white'}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2.5 flex items-center justify-between text-left ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`} style={isAr ? arabicFontStyle : undefined}>
          {icon} {displayTitle}
        </span>
        <span className={`text-xs transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          ▼
        </span>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div
          className={`px-3 pb-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
          dir={isAr ? 'rtl' : 'ltr'}
          style={isAr ? arabicFontStyle : undefined}
        >
          {displayContent}
        </div>
      </div>
    </div>
  );
};

// Full-screen layout wrapper — defined outside component to avoid remount on every render
const FullScreen: React.FC<{ isDark: boolean; children: React.ReactNode }> = ({ isDark, children }) => (
  <div className={`min-h-screen flex flex-col ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-indigo-50 to-purple-50'}`}>
    {children}
  </div>
);

export const FollowUpQuestions: React.FC<FollowUpQuestionsProps> = ({
  sessionLog,
  transcript: transcriptProp,
  test,
  contentModel,
  theme = 'light',
  onBack,
}) => {
  const isDark = theme === 'dark';
  const contentLabel = useContentLabel();

  // Try to restore discussion state from sessionStorage (survives tab suspension)
  const savedDisc = useMemo<SavedDiscussionState | null>(() => {
    try {
      const raw = sessionStorage.getItem(getDiscSessionKey(test.id));
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }, [test.id]);

  // If restoring to 'evaluating' (transient API phase), fall back to 'answering'
  const restoredPhase = savedDisc?.phase || 'generating';
  const [phase, setPhase] = useState<FollowUpPhase>(
    restoredPhase === 'evaluating' ? 'answering' : restoredPhase
  );
  const [questions, setQuestions] = useState<FollowUpQuestion[]>(savedDisc?.questions || []);
  const [answers, setAnswers] = useState<{ [id: string]: string }>(savedDisc?.answers || {});
  const [feedback, setFeedback] = useState<FollowUpFeedbackItem[]>(savedDisc?.feedback || []);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(savedDisc?.currentIndex || 0);
  const [feedbackLang, setFeedbackLang] = useState<'en' | 'ar'>(savedDisc?.feedbackLang || 'en');
  // Skip auto-generate if we restored to a non-generating phase
  const generatedRef = useRef(!!savedDisc && savedDisc.phase !== 'generating');

  const model = contentModel === 'gpt-5.2' ? 'gpt-5.2' : 'gpt-5-mini';
  const showChips = shouldShowChips(test.difficulty);

  const handleGenerate = useCallback(async () => {
    setPhase('generating');
    setError(null);

    try {
      const weaknesses = buildWeaknessSummary(sessionLog);
      const mcqResults = buildMCQResults(sessionLog);
      const vocabulary = buildVocabulary(test);
      const mcqScore = sessionLog.questions?.score ?? 0;

      const input = JSON.stringify({
        difficulty: test.difficulty || 'B1',
        transcript: (transcriptProp || '').slice(0, 3000),
        mcqResults,
        mcqScore,
        vocabulary,
        weaknessSummary: weaknesses,
      });

      // No reasoning for generation — speed over depth
      const text = await callOpenAI(model, getGenerateInstructions(contentLabel), input);
      console.log('[FollowUp] Generate response:', text);

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]);
      const qs: FollowUpQuestion[] = parsed.questions || [];

      if (qs.length === 0) throw new Error('No questions generated');

      setQuestions(qs);
      setCurrentIndex(0);
      setPhase('answering');
    } catch (err) {
      console.error('[FollowUp] Generate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate questions');
    }
  }, [model, sessionLog, test, transcriptProp]);

  // Auto-generate on mount
  useEffect(() => {
    if (!generatedRef.current) {
      generatedRef.current = true;
      handleGenerate();
    }
  }, [handleGenerate]);

  // Persist discussion state to sessionStorage on changes (survives tab suspension)
  useEffect(() => {
    const state: SavedDiscussionState = {
      phase, questions, answers, feedback, currentIndex, feedbackLang,
    };
    try {
      sessionStorage.setItem(getDiscSessionKey(test.id), JSON.stringify(state));
    } catch {}
  }, [phase, questions, answers, feedback, currentIndex, feedbackLang, test.id]);

  const handleEvaluate = async () => {
    setPhase('evaluating');
    setError(null);

    try {
      const mcqResults = buildMCQResults(sessionLog);
      const vocabulary = buildVocabulary(test);

      const questionsAndAnswers = questions.map(q => ({
        id: q.id,
        type: q.type,
        question: q.question,
        studentAnswer: answers[q.id] || '',
      }));

      const input = JSON.stringify({
        difficulty: test.difficulty || 'B1',
        transcript: (transcriptProp || '').slice(0, 3000),
        questionsAndAnswers,
        mcqResults,
        vocabulary,
      });

      // Low reasoning for evaluation — needs some thought for quality feedback
      const text = await callOpenAI(model, getEvaluateInstructions(contentLabel), input, { effort: 'low' });
      console.log('[FollowUp] Evaluate response:', text);

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]);
      const fb: FollowUpFeedbackItem[] = parsed.feedback || [];

      setFeedback(fb);
      setCurrentIndex(0);
      setPhase('feedback');
    } catch (err) {
      console.error('[FollowUp] Evaluate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to evaluate answers');
      setPhase('answering');
    }
  };

  const handleChipTap = (starter: string) => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;
    const current = answers[currentQ.id] || '';
    // Only insert if textarea is empty or starts with existing starter
    const currentStarters = currentQ.starters?.length ? currentQ.starters : (SENTENCE_STARTERS[currentQ.type] || []);
    if (current.trim() === '' || currentStarters.some(s => current.startsWith(s))) {
      setAnswers(prev => ({ ...prev, [currentQ.id]: starter }));
    } else {
      // Append at cursor position (simple: prepend if not empty)
      setAnswers(prev => ({ ...prev, [currentQ.id]: starter + ' ' + current }));
    }
  };

  const currentAnswer = questions[currentIndex] ? (answers[questions[currentIndex].id] || '') : '';
  const hasCurrentAnswer = currentAnswer.trim().length > 0;
  const isLastQuestion = currentIndex === questions.length - 1;

  // Loading state (generating or evaluating)
  if (phase === 'generating' || phase === 'evaluating') {
    return (
      <FullScreen isDark={isDark}>
        <ProgressLoader
          mode={phase}
          isDark={isDark}
          error={error}
          onRetry={handleGenerate}
          onBack={onBack}
        />
      </FullScreen>
    );
  }

  // Answering phase — one question per screen
  if (phase === 'answering') {
    const currentQ = questions[currentIndex];
    if (!currentQ) return null;
    const typeInfo = TYPE_LABELS[currentQ.type] || TYPE_LABELS.connect;
    const starters = currentQ.starters?.length ? currentQ.starters : (SENTENCE_STARTERS[currentQ.type] || SENTENCE_STARTERS.connect);

    return (
      <FullScreen isDark={isDark}>
        {/* Header */}
        <div className={`sticky top-0 z-20 ${isDark ? 'bg-slate-800 border-b border-slate-700' : 'bg-white/90 backdrop-blur border-b border-indigo-100'}`}>
          <div className="px-4 py-3 flex items-center justify-between">
            <button onClick={onBack} className={`text-sm font-medium ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
              ← Results
            </button>
            <StepDots total={questions.length} current={currentIndex} isDark={isDark} />
            <span className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {currentIndex + 1}/{questions.length}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col p-4 max-w-lg mx-auto w-full">
          {/* Question */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                isDark ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white'
              }`}>
                {currentIndex + 1}
              </span>
              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${isDark ? typeInfo.darkColor : typeInfo.color}`}>
                {typeInfo.label}
              </span>
            </div>
            <p className={`text-base leading-relaxed ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {currentQ.question}
            </p>
            {currentQ.questionArabic && (
              <p className={`text-sm mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} dir="rtl">
                {currentQ.questionArabic}
              </p>
            )}
          </div>

          {/* Sentence starter chips (A1-B1 only) */}
          {showChips && (
            <div className="mb-3">
              <p className={`text-xs mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} dir="rtl">
                اضغط على عبارة لبدء إجابتك ↓
              </p>
              <p className={`text-xs mb-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                Tap a phrase to start your answer
              </p>
              <div className="flex flex-wrap gap-1.5">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    onClick={() => handleChipTap(starter)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 chip-pulse ${
                      isDark
                        ? 'bg-indigo-900/40 text-indigo-300 border-indigo-700 hover:bg-indigo-800/50'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Auto-growing textarea */}
          <div className="mb-2 grid">
            <textarea
              value={currentAnswer}
              onChange={(e) => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value.slice(0, 300) }))}
              placeholder="Write your thoughts..."
              className={`[grid-area:1/1] w-full px-3 py-3 rounded-xl border text-sm resize-none overflow-hidden min-h-[84px] ${
                isDark
                  ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-indigo-500'
                  : 'bg-white border-slate-200 placeholder-slate-400 focus:border-indigo-500'
              } focus:outline-none`}
            />
            <div className="[grid-area:1/1] invisible whitespace-pre-wrap px-3 py-3 text-sm min-h-[84px]">
              {currentAnswer + ' '}
            </div>
          </div>

          {/* Character count */}
          <div className="flex justify-end mb-4">
            <span className={`text-xs ${
              currentAnswer.length > 280
                ? 'text-red-500'
                : currentAnswer.length > 240
                ? 'text-amber-500'
                : isDark ? 'text-slate-600' : 'text-slate-400'
            }`}>
              {currentAnswer.length}/300
            </span>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center mb-3">{error}</p>
          )}

          {/* No wrong answers hint */}
          <p className={`text-xs text-center mb-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            There are no wrong answers — share your thoughts!
          </p>
        </div>

        {/* Bottom navigation */}
        <div className={`sticky bottom-0 p-4 ${isDark ? 'bg-slate-800 border-t border-slate-700' : 'bg-white/90 backdrop-blur border-t border-indigo-100'}`}>
          <div className="flex gap-3 max-w-lg mx-auto">
            {currentIndex > 0 && (
              <button
                onClick={() => setCurrentIndex(prev => prev - 1)}
                className={`px-4 py-3 rounded-xl font-medium text-sm ${
                  isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Previous
              </button>
            )}
            <button
              onClick={() => {
                if (isLastQuestion) {
                  handleEvaluate();
                } else {
                  setCurrentIndex(prev => prev + 1);
                }
              }}
              disabled={!hasCurrentAnswer}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                hasCurrentAnswer
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-400 hover:to-purple-400'
                  : isDark
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isLastQuestion ? 'Submit All' : 'Next'}
            </button>
          </div>
        </div>

        {/* Pulse animation for chips */}
        <style>{`
          .chip-pulse {
            animation: chipPulse 1.5s ease-in-out 3;
          }
          @keyframes chipPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
            50% { box-shadow: 0 0 0 6px rgba(99,102,241,0); }
          }
        `}</style>
      </FullScreen>
    );
  }

  // Feedback phase — one question at a time with accordion
  if (phase === 'feedback') {
    const currentQ = questions[currentIndex];
    if (!currentQ) return null;
    const fb = feedback.find(f => f.questionId === currentQ.id);
    const typeInfo = TYPE_LABELS[currentQ.type] || TYPE_LABELS.connect;
    const isLastFeedback = currentIndex === questions.length - 1;
    const isAr = feedbackLang === 'ar';

    return (
      <FullScreen isDark={isDark}>
        {/* Header */}
        <div className={`sticky top-0 z-20 ${isDark ? 'bg-slate-800 border-b border-slate-700' : 'bg-white/90 backdrop-blur border-b border-indigo-100'}`}>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className={`text-sm font-semibold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
              {isAr ? 'التعليقات' : 'Feedback'}
            </span>

            {/* Language toggle */}
            <div className={`flex rounded-lg overflow-hidden border ${isDark ? 'border-slate-600' : 'border-indigo-200'}`}>
              <button
                onClick={() => setFeedbackLang('en')}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  !isAr
                    ? isDark ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white'
                    : isDark ? 'bg-slate-700 text-slate-400 hover:text-slate-200' : 'bg-white text-slate-500 hover:text-slate-700'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setFeedbackLang('ar')}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  isAr
                    ? isDark ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white'
                    : isDark ? 'bg-slate-700 text-slate-400 hover:text-slate-200' : 'bg-white text-slate-500 hover:text-slate-700'
                }`}
                style={arabicFontStyle}
              >
                عربي
              </button>
            </div>

            <span className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {currentIndex + 1}/{questions.length}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
          {/* Question */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                isDark ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white'
              }`}>
                {currentIndex + 1}
              </span>
              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${isDark ? typeInfo.darkColor : typeInfo.color}`}>
                {typeInfo.label}
              </span>
            </div>
            <p
              className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
              dir={isAr ? 'rtl' : 'ltr'}
              style={isAr ? arabicFontStyle : undefined}
            >
              {isAr && currentQ.questionArabic ? currentQ.questionArabic : currentQ.question}
            </p>
          </div>

          {/* Student's answer */}
          <div className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} dir={isAr ? 'rtl' : 'ltr'} style={isAr ? arabicFontStyle : undefined}>
              {isAr ? 'إجابتك:' : 'Your answer:'}
            </p>
            <p className={`text-sm italic ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              "{answers[currentQ.id] || '(no answer)'}"
            </p>
          </div>

          {/* Feedback sections */}
          {fb && (
            <div className="space-y-2">
              <FeedbackSection
                title="What You Said"
                titleArabic="ما قلته"
                icon="💬"
                content={fb.acknowledge}
                contentArabic={fb.acknowledgeArabic}
                language={feedbackLang}
                defaultOpen={true}
                borderColor="border-blue-400"
                isDark={isDark}
              />
              <FeedbackSection
                title="Connection"
                titleArabic="الربط"
                icon="🔗"
                content={fb.connectToTest}
                contentArabic={fb.connectToTestArabic}
                language={feedbackLang}
                defaultOpen={false}
                borderColor="border-purple-400"
                isDark={isDark}
              />
              <FeedbackSection
                title="Think Further"
                titleArabic="فكّر أكثر"
                icon="💡"
                content={fb.extendThinking}
                contentArabic={fb.extendThinkingArabic}
                language={feedbackLang}
                defaultOpen={false}
                borderColor="border-indigo-400"
                isDark={isDark}
              />

              {/* Vocabulary — always visible */}
              {fb.vocabularyWord && (
                <div className={`rounded-lg border-l-4 border-teal-400 p-3 ${isDark ? 'bg-slate-700/50' : 'bg-teal-50'}`}>
                  <p className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} dir={isAr ? 'rtl' : 'ltr'} style={isAr ? arabicFontStyle : undefined}>
                    {isAr ? '📖 المفردات' : '📖 Vocabulary'}
                  </p>
                  <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`} dir={isAr ? 'rtl' : 'ltr'} style={isAr ? arabicFontStyle : undefined}>
                    <span className="font-bold">{fb.vocabularyWord}</span>
                    {(isAr ? fb.vocabularyDefinitionArabic || fb.vocabularyDefinition : fb.vocabularyDefinition) && (
                      <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}> — {isAr ? (fb.vocabularyDefinitionArabic || fb.vocabularyDefinition) : fb.vocabularyDefinition}</span>
                    )}
                  </p>
                  {(isAr ? fb.vocabularySentenceArabic || fb.vocabularySentence : fb.vocabularySentence) && (
                    <p className={`text-sm mt-1 italic ${isDark ? 'text-slate-400' : 'text-slate-600'}`} dir={isAr ? 'rtl' : 'ltr'} style={isAr ? arabicFontStyle : undefined}>
                      "{isAr ? (fb.vocabularySentenceArabic || fb.vocabularySentence) : fb.vocabularySentence}"
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom navigation */}
        <div className={`sticky bottom-0 p-4 ${isDark ? 'bg-slate-800 border-t border-slate-700' : 'bg-white/90 backdrop-blur border-t border-indigo-100'}`}>
          <div className="flex gap-3 max-w-lg mx-auto">
            {currentIndex > 0 && (
              <button
                onClick={() => setCurrentIndex(prev => prev - 1)}
                className={`px-4 py-3 rounded-xl font-medium text-sm ${
                  isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                style={isAr ? arabicFontStyle : undefined}
              >
                {isAr ? 'السابق' : 'Previous'}
              </button>
            )}
            <button
              onClick={() => {
                if (isLastFeedback) {
                  setPhase('done');
                  // Clear persisted discussion state — session complete
                  try { sessionStorage.removeItem(getDiscSessionKey(test.id)); } catch {}
                } else {
                  setCurrentIndex(prev => prev + 1);
                }
              }}
              className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-400 hover:to-purple-400 transition-all"
              style={isAr ? arabicFontStyle : undefined}
            >
              {isLastFeedback ? (isAr ? 'إنهاء' : 'Finish') : (isAr ? 'التالي' : 'Next')}
            </button>
          </div>
        </div>
      </FullScreen>
    );
  }

  // Done — completion screen
  const isAr = feedbackLang === 'ar';
  return (
    <FullScreen isDark={isDark}>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isDark ? 'bg-indigo-600' : 'bg-indigo-500'
          }`}>
            <span className="text-2xl text-white">✓</span>
          </div>
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`} style={isAr ? arabicFontStyle : undefined}>
            {isAr ? 'اكتملت المناقشة' : 'Discussion Complete'}
          </h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} dir={isAr ? 'rtl' : 'ltr'} style={isAr ? arabicFontStyle : undefined}>
            {isAr
              ? `لقد تأملت في ${questions.length} أسئلة حول ${contentLabel.verb === 'read' ? 'نص القراءة' : 'حوار الاستماع'}. استمر في التفكير في هذه الأفكار — المناقشات الجيدة تبني الفهم!`
              : `You reflected on ${questions.length} questions about the ${contentLabel.type}. Keep thinking about these ideas — great discussions build understanding!`
            }
          </p>
          <button
            onClick={onBack}
            className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
              isDark
                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                : 'bg-indigo-500 text-white hover:bg-indigo-400'
            }`}
            style={isAr ? arabicFontStyle : undefined}
          >
            {isAr ? 'العودة إلى النتائج' : 'Back to Results'}
          </button>
        </div>
      </div>
    </FullScreen>
  );
};
