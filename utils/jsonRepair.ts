// Robust JSON parsing with hardcoded repair + LLM fallback
// Used across OneShotCreator, JamButton, TestBuilder, bonusGeneration

import { callOpenAI } from '../helpers/bonusGeneration';

/**
 * Extract JSON boundaries using bracket counting (not greedy regex).
 * Finds the outermost { } or [ ] block.
 */
function extractJsonBoundary(text: string): string {
  // Find first { or [
  let startChar = '';
  let startIdx = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' || text[i] === '[') {
      startChar = text[i];
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) throw new Error('No JSON object or array found in text');

  const endChar = startChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === startChar) depth++;
    if (ch === endChar) {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }

  // If we didn't find closing bracket, return from start to end (let JSON.parse give the error)
  return text.slice(startIdx);
}

/**
 * Apply hardcoded fixes for common JSON issues.
 * Returns cleaned JSON string ready for JSON.parse.
 */
function applyHardcodedFixes(text: string): string {
  let cleaned = text;

  // 1. Strip BOM
  cleaned = cleaned.replace(/^\uFEFF/, '');

  // 2. Strip markdown code fences
  cleaned = cleaned.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
  }

  // 3. Extract JSON boundary
  cleaned = extractJsonBoundary(cleaned);

  // 4. Remove single-line comments (outside strings)
  cleaned = removeComments(cleaned);

  // 5. Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // 6. Replace NaN, Infinity, undefined with null (outside strings)
  cleaned = cleaned.replace(/:\s*\b(NaN|Infinity|undefined)\b/g, ': null');

  // 7. Fix unescaped control characters inside strings
  cleaned = fixUnescapedControlChars(cleaned);

  return cleaned;
}

/**
 * Remove single-line (//) and multi-line comments outside of strings.
 */
function removeComments(text: string): string {
  let result = '';
  let inString = false;
  let escape = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (escape) {
      result += ch;
      escape = false;
      i++;
      continue;
    }

    if (ch === '\\' && inString) {
      result += ch;
      escape = true;
      i++;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      i++;
      continue;
    }

    if (!inString) {
      // Single-line comment
      if (ch === '/' && i + 1 < text.length && text[i + 1] === '/') {
        // Skip until newline
        while (i < text.length && text[i] !== '\n') i++;
        continue;
      }
      // Multi-line comment
      if (ch === '/' && i + 1 < text.length && text[i + 1] === '*') {
        i += 2;
        while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++;
        i += 2; // skip */
        continue;
      }
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * Fix unescaped newlines/tabs inside JSON strings.
 */
function fixUnescapedControlChars(text: string): string {
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      result += ch;
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      result += ch;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
    }

    result += ch;
  }

  return result;
}

/**
 * Attempt to parse JSON with hardcoded fixes for common issues.
 * Synchronous — no LLM call.
 * Throws on failure.
 */
export function repairAndParse(text: string): any {
  // First try raw parse (fast path)
  try {
    return JSON.parse(text.trim());
  } catch {
    // Continue to repair
  }

  // Try with hardcoded fixes
  const cleaned = applyHardcodedFixes(text);
  return JSON.parse(cleaned); // throws if still broken
}

/**
 * Use gpt-5-mini to repair severely broken JSON.
 * Returns parsed object.
 */
async function llmRepairJson(brokenJson: string, parseError: string): Promise<any> {
  const instructions = `You are a JSON repair tool. The user will provide broken JSON and the parse error.
Fix the JSON so it is valid. Return ONLY the fixed JSON — no markdown fences, no explanation, no extra text.
Common issues: trailing commas, unescaped quotes, missing brackets, truncated output.`;

  const input = `Parse error: ${parseError}\n\nBroken JSON:\n${brokenJson.slice(0, 8000)}`;

  const response = await callOpenAI('gpt-5-mini', instructions, input);

  // Parse the LLM response with hardcoded fixes too
  return repairAndParse(response);
}

/**
 * Full 3-tier JSON parsing:
 * 1. Hardcoded repair (sync, free)
 * 2. LLM repair via gpt-5-mini (async, costs 1 token)
 * 3. Throw with combined error
 */
export async function robustJsonParse(
  text: string,
  options?: { llmRepair?: boolean }
): Promise<{ result: any; usedLlm: boolean }> {
  // Tier 1: Hardcoded repair
  try {
    const result = repairAndParse(text);
    return { result, usedLlm: false };
  } catch (hardcodedErr) {
    if (!options?.llmRepair) throw hardcodedErr;

    // Tier 2: LLM repair
    try {
      const result = await llmRepairJson(
        text,
        hardcodedErr instanceof Error ? hardcodedErr.message : 'Invalid JSON'
      );
      return { result, usedLlm: true };
    } catch (llmErr) {
      // Tier 3: Both failed
      throw new Error(
        `Parse failed even after AI repair. Original: ${hardcodedErr instanceof Error ? hardcodedErr.message : 'Invalid JSON'}`
      );
    }
  }
}
