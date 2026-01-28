import React from 'react';

export type CreationMethod = 'audio' | 'transcript' | 'import';

interface HomePageProps {
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


export const HomePage: React.FC<HomePageProps> = ({
  onSelect,
}) => {
  const methods = [
    {
      id: 'audio' as CreationMethod,
      title: 'Generate Audio',
      description: 'Create from text with AI voices. Perfect for creating custom listening materials.',
      icon: MicrophoneIcon,
      gradient: 'from-indigo-500 to-violet-500',
      hoverGradient: 'hover:from-indigo-400 hover:to-violet-400',
      shadow: 'shadow-indigo-500/30',
    },
    {
      id: 'transcript' as CreationMethod,
      title: 'Text Only',
      description: 'Add a transcript without generating audio. Use your own audio source.',
      icon: FileTextIcon,
      gradient: 'from-emerald-500 to-teal-500',
      hoverGradient: 'hover:from-emerald-400 hover:to-teal-400',
      shadow: 'shadow-emerald-500/30',
    },
    {
      id: 'import' as CreationMethod,
      title: 'Import Content',
      description: 'Import existing questions and vocabulary from your teaching materials.',
      icon: ImportIcon,
      gradient: 'from-amber-500 to-orange-500',
      hoverGradient: 'hover:from-amber-400 hover:to-orange-400',
      shadow: 'shadow-amber-500/30',
    },
  ];

  return (
    <main className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-violet-900 bg-clip-text text-transparent mb-4">
            Create Listening Content
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Choose how you'd like to create your EFL listening materials
          </p>
        </div>

        {/* Method Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {methods.map((method) => (
            <button
              key={method.id}
              onClick={() => onSelect(method.id)}
              className={`group relative p-8 rounded-3xl bg-gradient-to-br ${method.gradient} ${method.hoverGradient} text-white transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl ${method.shadow} active:scale-[0.98]`}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  <method.icon className="w-10 h-10" />
                </div>
                <h3 className="font-bold text-xl mb-2">{method.title}</h3>
                <p className="text-sm text-white/80 leading-relaxed">{method.description}</p>
              </div>
            </button>
          ))}
        </div>

      </div>
    </main>
  );
};
