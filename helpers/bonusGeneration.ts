import { TestQuestion } from '../types';
import { repairAndParse } from '../utils/jsonRepair';

const API_BASE = '/api';

// OpenAI Responses API helper
export async function callOpenAI(model: string, instructions: string, input: string): Promise<string> {
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

export function buildBonusPrompt(count: number, difficulty: string, isReading: boolean): string {
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

/**
 * Fire-and-forget: generate 10 bonus questions and save them to the test.
 * Called after test creation in OneShotCreator and JamButton.
 */
export async function generateBonusForTest(
  testId: string,
  transcript: string,
  difficulty: string,
  isReading: boolean,
  existingQuestions: string[],
  contentModel: string
): Promise<void> {
  const input = JSON.stringify({
    transcript: transcript.slice(0, 4000),
    existingQuestions,
  });

  const text = await callOpenAI(contentModel, buildBonusPrompt(10, difficulty, isReading), input);
  let parsed: any;
  try {
    parsed = repairAndParse(text);
  } catch {
    return; // silent fail — bonus generation is fire-and-forget
  }
  const qs: TestQuestion[] = (parsed.questions || []).map((q: any, i: number) => ({
    ...q,
    id: `pregen-${i}`,
  }));

  if (qs.length > 0) {
    await fetch(`${API_BASE}/tests/${testId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bonusQuestions: qs }),
    });
  }
}
