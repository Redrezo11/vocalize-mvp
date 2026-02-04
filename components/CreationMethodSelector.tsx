import React from 'react';

export type CreationMethod = 'audio' | 'transcript' | 'import' | 'oneshot';

interface CreationMethodSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (method: CreationMethod) => void;
}

// Icons for the cards
const MicrophoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const FileTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
    <line x1="10" x2="8" y1="9" y2="9" />
  </svg>
);

const ImportIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

const ZapIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const CreationMethodSelector: React.FC<CreationMethodSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  if (!isOpen) return null;

  const methods = [
    {
      id: 'audio' as CreationMethod,
      title: 'Generate Audio',
      description: 'Create from text with TTS voices',
      icon: MicrophoneIcon,
      gradient: 'from-indigo-500 to-violet-500',
      hoverGradient: 'hover:from-indigo-400 hover:to-violet-400',
      shadow: 'shadow-indigo-500/30',
    },
    {
      id: 'transcript' as CreationMethod,
      title: 'Text Only',
      description: 'Transcript without audio',
      icon: FileTextIcon,
      gradient: 'from-emerald-500 to-teal-500',
      hoverGradient: 'hover:from-emerald-400 hover:to-teal-400',
      shadow: 'shadow-emerald-500/30',
    },
    {
      id: 'import' as CreationMethod,
      title: 'Import Content',
      description: 'Existing questions & vocabulary',
      icon: ImportIcon,
      gradient: 'from-amber-500 to-orange-500',
      hoverGradient: 'hover:from-amber-400 hover:to-orange-400',
      shadow: 'shadow-amber-500/30',
    },
    {
      id: 'oneshot' as CreationMethod,
      title: 'One Shot',
      description: 'Complete test in one step',
      icon: ZapIcon,
      gradient: 'from-rose-500 to-pink-500',
      hoverGradient: 'hover:from-rose-400 hover:to-pink-400',
      shadow: 'shadow-rose-500/30',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Create New Content</h2>
          <p className="text-slate-500 mt-2">Choose how you'd like to create your listening material</p>
        </div>

        {/* Method Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {methods.map((method) => (
            <button
              key={method.id}
              onClick={() => onSelect(method.id)}
              className={`group relative p-6 rounded-2xl bg-gradient-to-br ${method.gradient} ${method.hoverGradient} text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-xl ${method.shadow} active:scale-[0.98]`}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <method.icon className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg mb-1">{method.title}</h3>
                <p className="text-sm text-white/80">{method.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Cancel Button */}
        <div className="mt-8 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl font-medium transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
