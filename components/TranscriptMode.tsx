import React, { useState, useMemo } from 'react';
import { parseDialogue } from '../utils/parser';
import { FileTextIcon, ArrowRightIcon } from './Icons';

interface TranscriptModeProps {
  onCreateTest: (title: string, transcript: string) => void;
  onBack: () => void;
}

export const TranscriptMode: React.FC<TranscriptModeProps> = ({ onCreateTest, onBack }) => {
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');

  const analysis = useMemo(() => parseDialogue(transcript), [transcript]);

  const handleCreateTest = () => {
    if (!transcript.trim()) {
      alert('Please enter a transcript first.');
      return;
    }
    const finalTitle = title.trim() || 'Untitled Transcript';
    onCreateTest(finalTitle, transcript);
  };

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          &larr; Back
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <FileTextIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Text-Only Mode</h1>
            <p className="text-sm text-slate-500">Create tests from transcript without storing audio</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for this transcript..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
              Transcript
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste or type your transcript here...

Example dialogue format:
Speaker A: Hello, how are you?
Speaker B: I'm fine, thank you!"
              className="w-full min-h-[350px] bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {analysis.isDialogue && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
              <span className="font-medium">{analysis.speakers.length} speakers detected:</span>
              <span className="text-emerald-700">{analysis.speakers.join(', ')}</span>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleCreateTest}
              disabled={!transcript.trim()}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Create Test from Transcript</span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>
            <p className="text-xs text-slate-400 text-center mt-3">
              No audio will be stored. Play audio from your own device during tests.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default TranscriptMode;
