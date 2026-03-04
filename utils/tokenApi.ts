// Shared token deduction helpers for frontend components
// Backend routes: POST /api/tokens/use, GET /api/tokens/balance (server/index.js)

const API_BASE = '/api';

interface TokenUsageResponse {
  token_balance?: number;
  unlimited?: boolean;
}

interface AuthUser {
  id: string;
  role: 'admin' | 'teacher';
  tokenBalance: number;
}

/**
 * Report token usage to the backend. Atomically deducts for teachers, logs for admins.
 * Returns the new balance (or unlimited flag for admins).
 * Throws on insufficient tokens (402) or other errors.
 */
export async function reportTokenUsage(
  operation: string,
  tokens: number,
  details?: { provider?: string; model?: string; metadata?: Record<string, unknown> }
): Promise<TokenUsageResponse> {
  const res = await fetch(`${API_BASE}/tokens/use`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, tokens, ...details }),
  });

  if (!res.ok) {
    if (res.status === 402) {
      throw new Error('INSUFFICIENT_TOKENS');
    }
    throw new Error('Token deduction failed');
  }

  return res.json();
}

/**
 * Check if user has enough tokens for an operation.
 * Returns true for: admins (unlimited), null user (unauthenticated), or sufficient balance.
 */
export function hasEnoughTokens(user: AuthUser | null, cost: number): boolean {
  if (!user) return true; // unauthenticated (student) — skip check
  if (user.role === 'admin') return true; // unlimited
  return user.tokenBalance >= cost;
}

/**
 * Report student-side LLM token usage. Fire-and-forget.
 * Bills the presenting teacher (or falls back to test creator on server).
 */
export function reportStudentTokenUsage(
  testId: string,
  operation: 'student_discussion_generation' | 'student_discussion_evaluation' | 'student_bonus_generation',
  model: string,
  presenterId?: string | null
): void {
  fetch(`${API_BASE}/tokens/student-use`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testId, operation, model, presenterId: presenterId || undefined }),
  }).catch(() => {}); // silent fail — never block student experience
}
