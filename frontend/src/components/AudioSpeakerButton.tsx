import React from 'react';
import { Volume2 } from 'lucide-react';
import { speechService } from '../lib/speechService';
import { useAppContext } from '../context/AppContext';

interface AudioSpeakerButtonProps {
  text: string;
  langOverride?: 'mr' | 'hi' | 'en';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

export const AudioSpeakerButton: React.FC<AudioSpeakerButtonProps> = ({
  text,
  langOverride,
  size = 'md',
  className = '',
  title
}) => {
  const { language } = useAppContext();
  const effectiveLang = (langOverride || language) as 'mr' | 'hi' | 'en';
  const defaultTitle = effectiveLang === 'mr' ? 'ऐकून घ्या' : effectiveLang === 'hi' ? 'सुनें' : 'Listen';

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    speechService.speak(text, effectiveLang);
  };

  const sizeClasses = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
    lg: 'p-2.5 text-base'
  };

  const iconSizes = {
    sm: 14,
    md: 17,
    lg: 20
  };

  return (
    <button
      type="button"
      onClick={handleSpeak}
      title={title || defaultTitle}
      className={`inline-flex items-center justify-center rounded-xl bg-accent-50 text-accent-700 hover:bg-accent-100 hover:text-accent-900 border border-accent-200/80 transition-all active:scale-90 shadow-2xs hover:shadow-xs ${sizeClasses[size]} ${className}`}
    >
      <Volume2 size={iconSizes[size]} className="shrink-0" />
    </button>
  );
};
