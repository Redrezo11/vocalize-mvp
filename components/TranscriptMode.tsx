import React, { useState, useMemo } from 'react';
import { parseDialogue } from '../utils/parser';
import { FileTextIcon, SaveIcon } from './Icons';

interface TranscriptModeProps {
  onSave: (title: string, transcript: string, speakers: string[]) => void;
  onBack: () => void;
  isSaving?: boolean;
}

export const TranscriptMode: React.FC<TranscriptModeProps> = ({ onSave, onBack, isSaving }) => {
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');

  const analysis = useMemo(() => parseDialogue(transcript), [transcript]);

  const handleSave = () => {
    if (!transcript.trim()) {
      alert('Please enter a transcript first.');
      return;
    }
    const finalTitle = title.trim() || 'Untitled Transcript';
    onSave(finalTitle, transcript, analysis.speakers);
  };

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all duration-200"
        >
          &larr; Back to Editor
        </button>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-slate-200/60 p-6 sm:p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-12 w-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <FileTextIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Text-Only Mode</h1>
            <p className="text-sm text-slate-500">Save transcripts to your library without audio</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for this transcript..."
              className="w-full bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Transcript
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste or type your transcript here...

Example dialogue format:
Speaker A: Hello, how are you?
Speaker B: I'm fine, thank you!"
              className="w-full min-h-[350px] bg-slate-50/80 border border-slate-200 rounded-xl p-4 text-slate-700 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200 placeholder:text-slate-400"
            />
          </div>

          {analysis.isDialogue && (
            <div className="flex items-center gap-2 text-sm text-indigo-700 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 rounded-xl border border-indigo-100">
              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
              <span className="font-semibold">{analysis.speakers.length} speakers detected:</span>
              <span className="text-indigo-600">{analysis.speakers.join(', ')}</span>
            </div>
          )}

          <div className="pt-5 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={!transcript.trim() || isSaving}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <SaveIcon className="w-4 h-4" />
                  <span>Save to Library</span>
                </>
              )}
            </button>
            <p className="text-xs text-slate-400 text-center mt-4">
              No audio will be stored. Create tests from your library.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default TranscriptMode;
