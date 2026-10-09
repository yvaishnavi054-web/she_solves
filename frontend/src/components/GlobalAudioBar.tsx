import React, { useEffect, useState } from 'react';
import { speechService, SpeechState } from '../lib/speechService';
import { useAppContext } from '../context/AppContext';
import { Play, Pause, Square, Volume2 } from 'lucide-react';

export const GlobalAudioBar: React.FC = () => {
  const { language } = useAppContext();
  const [speechState, setSpeechState] = useState<SpeechState>(speechService.getState());

  useEffect(() => {
    const unsubscribe = speechService.subscribe(setSpeechState);
    return () => {
      unsubscribe();
    };
  }, []);

  if (!speechState.isPlaying && !speechState.isPaused) {
    return null;
  }

  const truncatedText = speechState.currentText.length > 95
    ? speechState.currentText.substring(0, 92) + '...'
    : speechState.currentText;

  const statusLabel = speechState.isPaused
    ? (language === 'mr' ? 'आवाज थांबवला' : language === 'hi' ? 'आवाज़ रुकी हुई' : 'Audio Paused')
    : (language === 'mr' ? 'बोलत आहे...' : language === 'hi' ? 'बोल रहा है...' : 'Speaking...');

  const resumeLabel = language === 'mr' ? 'पुढे चालू' : language === 'hi' ? 'जारी रखें' : 'Resume';
  const pauseLabel = language === 'mr' ? 'थांबवा' : language === 'hi' ? 'रोकें' : 'Pause';
  const stopLabel = language === 'mr' ? 'बंद करा' : language === 'hi' ? 'बंद करें' : 'Stop';

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-[94%] max-w-2xl bg-brand-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-brand-700 flex items-center justify-between gap-3 animate-fade-in transition-all">
      {/* Icon & Animated Sound Waves */}
      <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
        <div className="p-2 bg-accent-500 rounded-xl text-brand-900 flex-shrink-0 animate-pulse">
          <Volume2 className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-accent-400">
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-gray-200 truncate font-medium mt-0.5">
            "{truncatedText}"
          </p>
        </div>
      </div>

      {/* Audio Controls: Pause/Resume + Stop */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {speechState.isPaused ? (
          <button
            onClick={() => speechService.resume()}
            className="flex items-center gap-1.5 bg-accent-500 hover:bg-accent-400 text-brand-900 px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 shadow-md cursor-pointer"
            title={resumeLabel}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{resumeLabel}</span>
          </button>
        ) : (
          <button
            onClick={() => speechService.pause()}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-brand-900 px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 shadow-md cursor-pointer"
            title={pauseLabel}
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>{pauseLabel}</span>
          </button>
        )}

        <button
          onClick={() => speechService.stop()}
          className="p-2 bg-red-600/90 hover:bg-red-500 text-white rounded-xl transition active:scale-95 shadow-md cursor-pointer"
          title={stopLabel}
        >
          <Square className="w-3.5 h-3.5 fill-current" />
        </button>
      </div>
    </div>
  );
};
