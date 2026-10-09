/**
 * Universal Speech Service for Khata se Credit Tak
 * Supports multilingual TTS (Marathi, Hindi, English) with Pause, Resume, and Stop controls.
 */

export interface SpeechState {
  isPlaying: boolean;
  isPaused: boolean;
  currentText: string;
  language: string;
}

type SpeechListener = (state: SpeechState) => void;

class UniversalSpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private listeners: Set<SpeechListener> = new Set();
  private state: SpeechState = {
    isPlaying: false,
    isPaused: false,
    currentText: '',
    language: 'mr'
  };

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public subscribe(listener: SpeechListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn({ ...this.state }));
  }

  public isAvailable(): boolean {
    return this.synth !== null;
  }

  public speak(text: string, lang: 'mr' | 'hi' | 'en' = 'mr', onEndCallback?: () => void) {
    if (!this.synth) {
      console.warn("Speech synthesis not supported in this browser.");
      return;
    }

    // Cancel any ongoing speech immediately before starting new text
    this.stop();

    if (!text || !text.trim()) return;

    const cleanText = text.trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Map language code to Indian locales
    const langMap: Record<string, string> = {
      mr: 'mr-IN',
      hi: 'hi-IN',
      en: 'en-IN'
    };
    utterance.lang = langMap[lang] || 'mr-IN';
    utterance.rate = 0.95; // Slightly slower for clear Indian pronunciation
    utterance.pitch = 1.0;

    // Attach native voice if available
    try {
      const voices = this.synth.getVoices();
      const preferredVoice = voices.find(v => 
        v.lang === utterance.lang || 
        v.lang.replace('_', '-').toLowerCase() === utterance.lang.toLowerCase()
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    } catch {}

    utterance.onstart = () => {
      this.state = {
        isPlaying: true,
        isPaused: false,
        currentText: cleanText,
        language: lang
      };
      this.notify();
    };

    utterance.onpause = () => {
      this.state.isPaused = true;
      this.notify();
    };

    utterance.onresume = () => {
      this.state.isPaused = false;
      this.notify();
    };

    utterance.onend = () => {
      this.state = {
        isPlaying: false,
        isPaused: false,
        currentText: '',
        language: lang
      };
      this.currentUtterance = null;
      this.notify();
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis error event:", e);
      this.state = {
        isPlaying: false,
        isPaused: false,
        currentText: '',
        language: lang
      };
      this.currentUtterance = null;
      this.notify();
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  public pause() {
    if (this.synth && this.state.isPlaying && !this.state.isPaused) {
      this.synth.pause();
      this.state.isPaused = true;
      this.notify();
    }
  }

  public resume() {
    if (this.synth && this.state.isPlaying && this.state.isPaused) {
      this.synth.resume();
      this.state.isPaused = false;
      this.notify();
    }
  }

  public stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
      this.state = {
        isPlaying: false,
        isPaused: false,
        currentText: '',
        language: this.state.language
      };
      this.currentUtterance = null;
      this.notify();
    }
  }

  public getState(): SpeechState {
    return { ...this.state };
  }
}

export const speechService = new UniversalSpeechService();
