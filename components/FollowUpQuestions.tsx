import React, { useState } from 'react';
import { ListeningTest, TestSessionLog, FollowUpQuestion, FollowUpFeedbackItem } from '../types';
import { ClassroomTheme, ContentModel } from './Settings';

interface FollowUpQuestionsProps {
  sessionLog: TestSessionLog;
  audioId: string;
  test: ListeningTest;
  contentModel: ContentModel;
  theme?: ClassroomTheme;
}

type FollowUpPhase = 'idle' | 'generating' | 'answering' | 'evaluating' | 'complete';

const TYPE_LABELS: Record<FollowUpQuestion['type'], { label: string; color: string; darkColor: string }> = {
  connect: { label: 'Connect', color: 'bg-blue-100 text-blue-700', darkColor: 'bg-blue-900/50 text-blue-300' },
  compare: { label: 'Compare', color: 'bg-violet-100 text-violet-700', darkColor: 'bg-violet-900/50 text-violet-300' },
  judge: { label: 'Judge', color: 'bg-rose-100 text-rose-700', darkColor: 'bg-rose-900/50 text-rose-300' },
};

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

async function callOpenAI(model: string, instructions: string, input: string): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      reasoning: { effort: 'medium' },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const messageOutput = data.output?.find((o: { type: string }) => o.type === 'message');
  return messageOutput?.content?.[0]?.text || '';
}

async function fetchTranscript(audioId: string): Promise<string> {
  const response = await fetch(`/api/audio-entries/${audioId}`);
  if (!response.ok) throw new Error('Failed to fetch transcript');
  const data = await response.json();
  return data.transcript || '';
}

const GENERATE_INSTRUCTIONS = `You are an EFL post-listening discussion specialist. Your job is to generate exactly 3 open-ended discussion questions about a listening dialogue the student just completed.

QUESTION DESIGN — Bloom's Taxonomy Progression:
- Question 1 (type: "connect"): Apply level. Ask the student to connect something from the dialogue to their own life or experience. Use concrete, personal framing: "Have you ever…", "When was a time you…", "How is this similar to something in your life?"
- Question 2 (type: "compare"): Analyze level. Ask the student to compare, contrast, or explain WHY something happened in the dialogue. Use framing like "Why do you think [character] said…", "What is the difference between…", "How would the conversation change if…"
- Question 3 (type: "judge"): Evaluate level. Ask the student to form an opinion or make a judgment about something in the dialogue. Use framing like "Do you agree with…", "What would you do differently?", "Was [character] right to…"

SCORE-BASED ADAPTATION:
- If mcqScore is 80-100%: Push all 3 questions toward higher Bloom's levels. Q1 can be Analyze, Q2 and Q3 can be Evaluate.
- If mcqScore is 50-79%: Keep the progression as described. Q2 should target the topic area where wrong answers clustered.
- If mcqScore is below 50%: Keep all 3 at Apply/Connect level. Focus on personal connection to basic themes from the dialogue. Use simple vocabulary.

LANGUAGE CONSTRAINTS (based on difficulty/CEFR level):
- A1-A2: Use simple present tense, basic vocabulary (under 1000 word frequency), short sentences. Avoid conditionals or abstract language.
- B1: Use comparatives, simple conditionals ("If you were…"), moderate vocabulary.
- B1+/B2: Use conditionals, opinion language, more nuanced vocabulary.

RULES:
- Every question MUST reference specific content from the dialogue transcript (a character name, event, or detail).
- Avoid abstract or vague phrasing. Keep questions concrete and answerable.
- Provide Arabic translation for each question.
- These are DISCUSSION questions — there is no single correct answer.

Return valid JSON only:
{"questions":[{"id":"q1","type":"connect","question":"...","questionArabic":"..."},{"id":"q2","type":"compare","question":"...","questionArabic":"..."},{"id":"q3","type":"judge","question":"...","questionArabic":"..."}]}`;

const EVALUATE_INSTRUCTIONS = `You are a warm, encouraging EFL teacher giving feedback on student discussion answers about a listening dialogue. These are open-ended discussion questions — there is no single "correct" answer. Your job is to acknowledge the student's thinking, connect it to test content, and help them grow.

For EACH question, provide 4 feedback components:

1. "acknowledge" — Summarize and recast the student's idea in correct, natural English. If their English has errors, gently model the correct form without pointing out the mistake. If they wrote in Arabic or mixed languages, acknowledge the effort and provide the English version of what they expressed. (2-3 sentences)

2. "connectToTest" — Link the student's answer to the listening content. If the student got a related comprehension question wrong, gently clarify that misunderstanding using their discussion answer as an entry point — but NEVER say "you got question X wrong" or reference question numbers. If they got it right, reinforce their understanding. (1-2 sentences)

3. "extendThinking" — Offer one new idea, perspective, or detail from the listening that the student didn't mention. Frame it as "You might also think about…" or "Another interesting point is…". This should genuinely add something, not repeat what they said. (1-2 sentences)

4. "vocabularyWord" / "vocabularyDefinition" / "vocabularySentence" — Pick ONE word from the test's vocabulary list that is relevant to the student's answer or the question topic. Provide: the word, its definition, and a model sentence using the word in context related to the dialogue.

TONE RULES:
- NEVER use "wrong", "incorrect", "error", "mistake"
- NEVER reference MCQ question numbers
- Be warm, specific, and encouraging — avoid empty superlatives like "Great job!" without substance
- If the student's answer is very short or off-topic, still find something to acknowledge and build on
- Each question's total feedback should be 65-100 words (excluding vocabulary)

Return valid JSON only:
{"feedback":[{"questionId":"q1","acknowledge":"...","connectToTest":"...","extendThinking":"...","vocabularyWord":"...","vocabularyDefinition":"...","vocabularySentence":"..."},{"questionId":"q2",...},{"questionId":"q3",...}]}`;

export const FollowUpQuestions: React.FC<FollowUpQuestionsProps> = ({
  sessionLog,
  audioId,
  test,
  contentModel,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const [phase, setPhase] = useState<FollowUpPhase>('idle');
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [answers, setAnswers] = useState<{ [id: string]: string }>({});
  const [feedback, setFeedback] = useState<FollowUpFeedbackItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');

  const model = contentModel === 'gpt-5.2' ? 'gpt-5.2' : 'gpt-5-mini';

  const handleGenerate = async () => {
    setPhase('generating');
    setError(null);

    try {
      // Fetch transcript on first use
      let currentTranscript = transcript;
      if (!currentTranscript) {
        currentTranscript = await fetchTranscript(audioId);
        setTranscript(currentTranscript);
      }

      const weaknesses = buildWeaknessSummary(sessionLog);
      const mcqResults = buildMCQResults(sessionLog);
      const vocabulary = buildVocabulary(test);
      const mcqScore = sessionLog.questions?.score ?? 0;

      const input = JSON.stringify({
        difficulty: test.difficulty || 'B1',
        transcript: currentTranscript.slice(0, 3000),
        mcqResults,
        mcqScore,
        vocabulary,
        weaknessSummary: weaknesses,
      });

      const text = await callOpenAI(model, GENERATE_INSTRUCTIONS, input);
      console.log('[FollowUp] Generate response:', text);

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]);
      const qs: FollowUpQuestion[] = parsed.questions || [];

      if (qs.length === 0) throw new Error('No questions generated');

      setQuestions(qs);
      setPhase('answering');
    } catch (err) {
      console.error('[FollowUp] Generate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate questions');
      setPhase('idle');
    }
  };

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
        transcript: transcript.slice(0, 3000),
        questionsAndAnswers,
        mcqResults,
        vocabulary,
      });

      const text = await callOpenAI(model, EVALUATE_INSTRUCTIONS, input);
      console.log('[FollowUp] Evaluate response:', text);

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]);
      const fb: FollowUpFeedbackItem[] = parsed.feedback || [];

      setFeedback(fb);
      setPhase('complete');
    } catch (err) {
      console.error('[FollowUp] Evaluate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to evaluate answers');
      setPhase('answering');
    }
  };

  const answeredCount = Object.values(answers).filter((a): a is string => typeof a === 'string' && a.trim().length > 0).length;

  // Idle — show start button
  if (phase === 'idle') {
    return (
      <div className="px-3 pb-4">
        <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-indigo-50 border border-indigo-200'}`}>
          <p className={`text-sm mb-1 font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Discussion Questions
          </p>
          <p className={`text-sm mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Think deeper about what you heard. 3 open-ended questions based on your results.
          </p>
          <button
            onClick={handleGenerate}
            className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-400 hover:to-purple-400 transition-all"
          >
            Start Discussion
          </button>
          {error && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // Loading states
  if (phase === 'generating' || phase === 'evaluating') {
    return (
      <div className="px-3 pb-4">
        <div className={`rounded-xl p-6 text-center ${isDark ? 'bg-slate-800' : 'bg-white border border-slate-200'}`}>
          <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {phase === 'generating' ? 'Creating discussion questions...' : 'Reading your responses...'}
          </p>
        </div>
      </div>
    );
  }

  // Answering phase
  if (phase === 'answering') {
    return (
      <div className="px-3 pb-4 space-y-3">
        <div className={`rounded-xl p-3 ${isDark ? 'bg-indigo-900/30 border border-indigo-700' : 'bg-indigo-50 border border-indigo-200'}`}>
          <p className={`text-sm font-semibold text-center ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
            Discussion Questions
          </p>
          <p className={`text-xs text-center mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            There are no wrong answers — share your thoughts!
          </p>
        </div>

        {questions.map((q, idx) => {
          const typeInfo = TYPE_LABELS[q.type] || TYPE_LABELS.connect;
          return (
            <div key={q.id} className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-start gap-2 mb-2">
                <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isDark ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${isDark ? typeInfo.darkColor : typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                  </div>
                  <p className={`text-sm leading-snug ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {q.question}
                  </p>
                  {q.questionArabic && (
                    <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} dir="rtl">
                      {q.questionArabic}
                    </p>
                  )}
                </div>
              </div>
              <textarea
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Write your thoughts..."
                rows={3}
                className={`w-full px-3 py-2 rounded-lg border text-sm resize-y ${
                  isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-indigo-500' : 'bg-slate-50 border-slate-200 placeholder-slate-400 focus:border-indigo-500'
                } focus:outline-none`}
              />
            </div>
          );
        })}

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <button
          onClick={handleEvaluate}
          disabled={answeredCount === 0}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
            answeredCount > 0
              ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-400 hover:to-purple-400'
              : isDark
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          Submit Responses ({answeredCount}/{questions.length})
        </button>
      </div>
    );
  }

  // Complete — show 4-component feedback
  return (
    <div className="px-3 pb-4 space-y-3">
      <div className={`rounded-xl p-3 ${isDark ? 'bg-indigo-900/30 border border-indigo-700' : 'bg-indigo-50 border border-indigo-200'}`}>
        <p className={`text-sm font-semibold text-center ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
          Discussion Feedback
        </p>
      </div>

      {questions.map((q, idx) => {
        const fb = feedback.find(f => f.questionId === q.id);
        const typeInfo = TYPE_LABELS[q.type] || TYPE_LABELS.connect;

        return (
          <div key={q.id} className={`rounded-xl border p-3 ${
            isDark ? 'border-indigo-800 bg-slate-800' : 'border-indigo-200 bg-white'
          }`}>
            {/* Question header */}
            <div className="flex items-start gap-2 mb-2">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isDark ? 'bg-indigo-600 text-white' : 'bg-indigo-500 text-white'
              }`}>
                {idx + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${isDark ? typeInfo.darkColor : typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                </div>
                <p className={`text-sm leading-snug ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {q.question}
                </p>
              </div>
            </div>

            {/* Student's answer */}
            <div className={`ml-8 mb-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <p className="italic">"{answers[q.id] || '(no answer)'}"</p>
            </div>

            {/* 4-component feedback */}
            {fb && (
              <div className="ml-8 space-y-2">
                {/* Acknowledge & Recast */}
                <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <p>{fb.acknowledge}</p>
                </div>

                {/* Connect to Test */}
                <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <p>{fb.connectToTest}</p>
                </div>

                {/* Extend Thinking */}
                <div className={`text-sm italic ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                  <p>{fb.extendThinking}</p>
                </div>

                {/* Vocabulary Reinforcement */}
                {fb.vocabularyWord && (
                  <div className={`rounded-lg p-2.5 ${isDark ? 'bg-slate-700/80' : 'bg-indigo-50'}`}>
                    <p className={`text-xs font-semibold uppercase mb-1 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`}>
                      Vocabulary
                    </p>
                    <p className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      <span className="font-bold">{fb.vocabularyWord}</span>
                      {fb.vocabularyDefinition && (
                        <span className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}> — {fb.vocabularyDefinition}</span>
                      )}
                    </p>
                    {fb.vocabularySentence && (
                      <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        "{fb.vocabularySentence}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
