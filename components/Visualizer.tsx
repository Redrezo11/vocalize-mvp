import React from 'react';

interface VisualizerProps {
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isPlaying }) => {
  return (
    <div className="flex items-center justify-center gap-[3px] h-12 w-full">
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full transition-all duration-300 ${
            isPlaying 
              ? 'bg-gradient-to-t from-indigo-500 to-purple-400 animate-pulse' 
              : 'bg-slate-700 h-1'
          }`}
          style={{
            height: isPlaying ? `${Math.max(15, Math.random() * 100)}%` : '4px',
            animationDelay: `${i * 0.04}s`,
            animationDuration: '0.5s',
            opacity: isPlaying ? 1 : 0.3
          }}
        />
      ))}
    </div>
  );
};

export default Visualizer;