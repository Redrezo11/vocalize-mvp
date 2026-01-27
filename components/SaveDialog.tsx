import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SaveDialogProps {
  isOpen: boolean;
  transcript: string;
  initialTitle: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}

// Simple function to generate a title from transcript (fallback)
const generateAutoTitle = (transcript: string): string => {
  if (!transcript.trim()) return 'Untitled Audio';

  // Remove speaker labels (e.g., "John:", "Narrator:")
  const withoutSpeakers = transcript.replace(/^[A-Za-z]+:\s*/gm, '');

  // Get first meaningful sentence or phrase
  const cleaned = withoutSpeakers
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Take first ~50 chars, try to end at a word boundary
  if (cleaned.length <= 50) return cleaned;

  const truncated = cleaned.slice(0, 50);
  const lastSpace = truncated.lastIndexOf(' ');
  const title = lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated;

  return title + '...';
};

// Simple cache for AI-generated titles to avoid repeated API calls
const titleCache = new Map<string, string>();

// Rate limiting - track last API call time
let lastApiCallTime = 0;
const MIN_API_INTERVAL = 2000; // 2 seconds between API calls

// Generate title using OpenAI GPT-5-Nano (fast, low-cost model)
const generateAITitle = async (transcript: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Create a cache key from first 200 chars of transcript
  const cacheKey = transcript.slice(0, 200);

  // Check cache first
  if (titleCache.has(cacheKey)) {
    return titleCache.get(cacheKey)!;
  }

  // Rate limiting check
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTime;
  if (timeSinceLastCall < MIN_API_INTERVAL) {
    const waitTime = MIN_API_INTERVAL - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastApiCallTime = Date.now();

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      input: `Generate a short, descriptive title (max 8 words) for this audio transcript. Return ONLY the title, no quotes or explanation:\n\n${transcript.slice(0, 1000)}`,
      reasoning: {
        effort: 'low'
      }
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  // Extract text from Responses API structure: output[1].content[0].text
  const messageOutput = data.output?.find((o: { type: string }) => o.type === 'message');
  const rawTitle = messageOutput?.content?.[0]?.text?.trim() || generateAutoTitle(transcript);
  // Take first line only (model may return multiple suggestions)
  const title = rawTitle.split('\n')[0].replace(/^[-•]\s*/, '');
  // Remove any quotes that might be included
  const cleanTitle = title.replace(/^["']|["']$/g, '');

  // Cache the result
  titleCache.set(cacheKey, cleanTitle);

  return cleanTitle;
};

export const SaveDialog: React.FC<SaveDialogProps> = ({
  isOpen,
  transcript,
  initialTitle,
  onSave,
  onCancel,
}) => {
  const [titleMode, setTitleMode] = useState<'ai' | 'auto' | 'manual'>('auto');
  const [manualTitle, setManualTitle] = useState(initialTitle);
  const [autoTitle, setAutoTitle] = useState('');
  const [aiTitle, setAiTitle] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Track if we've already generated a title for this transcript
  const lastTranscriptRef = useRef<string>('');
  const hasGeneratedRef = useRef(false);

  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const hasAIKey = !!openaiKey && openaiKey !== 'PLACEHOLDER_API_KEY';

  const handleGenerateAITitle = useCallback(async (forceRegenerate = false) => {
    // Skip if already generating
    if (isGeneratingAI) return;

    // Skip if we've already generated for this transcript (unless forced)
    if (!forceRegenerate && hasGeneratedRef.current && lastTranscriptRef.current === transcript) {
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);
    lastTranscriptRef.current = transcript;
    hasGeneratedRef.current = true;

    try {
      const title = await generateAITitle(transcript);
      setAiTitle(title);
    } catch (error: any) {
      console.error('Failed to generate AI title:', error);
      const errorMsg = error?.message || String(error) || 'Unknown error';
      setAiError(`Failed: ${errorMsg}`);
      setAiTitle(generateAutoTitle(transcript));
    } finally {
      setIsGeneratingAI(false);
    }
  }, [transcript, isGeneratingAI]);

  useEffect(() => {
    if (isOpen) {
      setAutoTitle(generateAutoTitle(transcript));
      setManualTitle(initialTitle === 'Untitled Audio' ? '' : initialTitle);
      // Always default to auto title - user must click AI option to generate
      setTitleMode('auto');

      // Only reset AI state if transcript changed
      if (lastTranscriptRef.current !== transcript) {
        setAiTitle('');
        setAiError(null);
        hasGeneratedRef.current = false;
      }
    }
  }, [isOpen, transcript, initialTitle]);

  if (!isOpen) return null;

  const handleSave = () => {
    let finalTitle: string;
    if (titleMode === 'ai') {
      finalTitle = aiTitle || autoTitle;
    } else if (titleMode === 'auto') {
      finalTitle = autoTitle;
    } else {
      finalTitle = manualTitle.trim() || 'Untitled Audio';
    }
    onSave(finalTitle);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-slate-200/50">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Save to Library</h2>
              <p className="text-sm text-slate-500">Choose how to title your audio</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">

          {/* Title Mode Selection */}
          <div className="space-y-3 mb-6">
            {/* AI Title Option */}
            {hasAIKey && (
              <label
                className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                  titleMode === 'ai'
                    ? 'border-emerald-500 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                  titleMode === 'ai' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                }`}>
                  {titleMode === 'ai' && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <input
                  type="radio"
                  name="titleMode"
                  checked={titleMode === 'ai'}
                  onChange={() => {
                    setTitleMode('ai');
                    // Only generate if we haven't generated yet for this transcript
                    if (!hasGeneratedRef.current || lastTranscriptRef.current !== transcript) {
                      handleGenerateAITitle();
                    }
                  }}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">AI-generated title</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded">GPT-5</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Smart title using GPT-5-Nano</p>
                  {titleMode === 'ai' && (
                    <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                      {isGeneratingAI ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm text-slate-500">Generating title...</span>
                        </div>
                      ) : aiError ? (
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-slate-700">{aiTitle}</p>
                          <button
                            onClick={(e) => { e.preventDefault(); handleGenerateAITitle(true); }}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                            disabled={isGeneratingAI}
                          >
                            Retry
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-700">{aiTitle}</p>
                          <button
                            onClick={(e) => { e.preventDefault(); handleGenerateAITitle(true); }}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                            disabled={isGeneratingAI}
                          >
                            Regenerate
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </label>
            )}

            {/* Auto Title Option */}
            <label
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                titleMode === 'auto'
                  ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-violet-50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                titleMode === 'auto' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
              }`}>
                {titleMode === 'auto' && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <input
                type="radio"
                name="titleMode"
                checked={titleMode === 'auto'}
                onChange={() => setTitleMode('auto')}
                className="sr-only"
              />
              <div className="flex-1">
                <span className="font-semibold text-slate-900">Use first line</span>
                <p className="text-sm text-slate-500 mt-1">First words of your transcript</p>
                {titleMode === 'auto' && (
                  <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-sm font-medium text-slate-700">{autoTitle}</p>
                  </div>
                )}
              </div>
            </label>

            {/* Manual Title Option */}
            <label
              className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                titleMode === 'manual'
                  ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-violet-50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                titleMode === 'manual' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
              }`}>
                {titleMode === 'manual' && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <input
                type="radio"
                name="titleMode"
                checked={titleMode === 'manual'}
                onChange={() => setTitleMode('manual')}
                className="sr-only"
              />
              <div className="flex-1">
                <span className="font-semibold text-slate-900">Enter title manually</span>
                <p className="text-sm text-slate-500 mt-1">Type your own custom title</p>
                {titleMode === 'manual' && (
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="Enter title..."
                    className="mt-3 w-full p-3 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all duration-200 shadow-sm"
                    autoFocus
                    autoComplete="off"
                  />
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100/80 border-t border-slate-200/60">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 text-slate-600 font-semibold rounded-xl hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-indigo-500/30"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
