import React, { useState, useEffect, useRef } from 'react';
import { useAppContext, Language } from '../context/AppContext';
import { 
  Bot, Mic, Send, X, Volume2, Square, Sparkles, 
  ArrowRight, RefreshCw, MessageSquare, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { api } from '../lib/api';
import { AudioSpeakerButton } from './AudioSpeakerButton';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  language?: string;
  timestamp: string;
  metrics?: Record<string, any>;
  suggestedFollowups?: string[];
}

interface AskKhataAIProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AskKhataAI: React.FC<AskKhataAIProps> = ({ isOpen, onClose }) => {
  const { 
    language, financialSummary, user, 
    speakText, stopSpeech 
  } = useAppContext();

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Initial friendly greeting in current language
    const getInitialGreeting = (lang: Language) => {
      if (lang === 'mr') {
        return {
          id: 'welcome_1',
          sender: 'assistant' as const,
          text: 'नमस्कार! मी तुमचा आवाज सहाय्यक आहे. उधारी, नफा, खर्च किंवा क्रेडिट स्कोअरबद्दल मला विचारा.',
          language: 'mr',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedFollowups: [
            'उधार किती बाकी आहे?',
            'या महिन्यात किती नफा झाला?',
            'नफा वाढतोय का कमी होतोय?',
            'सर्वात जास्त उधारी कोणाकडे आहे?'
          ]
        };
      } else if (lang === 'hi') {
        return {
          id: 'welcome_1',
          sender: 'assistant' as const,
          text: 'नमस्ते! मैं आपका आवाज़ सहायक हूँ। उधार, मुनाफ़ा, खर्च या क्रेडिट स्कोर के बारे में मुझसे कोई भी सवाल पूछें।',
          language: 'hi',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedFollowups: [
            'कुल कितना उधार बाकी है?',
            'इस महीने कितना मुनाफ़ा हुआ?',
            'मुनाफ़ा बढ़ रहा है या घट रहा है?',
            'सबसे अधिक उधार किसका है?'
          ]
        };
      } else {
        return {
          id: 'welcome_1',
          sender: 'assistant' as const,
          text: 'Hello! I am your AI Khata Assistant. Ask me anything about your Udhaar, profit, expenses, or credit readiness.',
          language: 'en',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedFollowups: [
            'How much Udhaar is remaining?',
            'How much profit this month?',
            'Is my profit increasing or decreasing?',
            'Which customer owes me the most money?'
          ]
        };
      }
    };
    return [getInitialGreeting(language)];
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Read Udhaar entries from localStorage to ground answers
  const getUdhaarEntries = () => {
    try {
      const storageKey = `khata_udhaar_${user?.email || user?.id || 'default'}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  };

  // Build live context payload
  const buildContext = () => {
    const udhaarList = getUdhaarEntries();
    let totalUdhaarPending = 0;
    udhaarList.forEach((u: any) => {
      const tot = u.totalUdhaar || 0;
      const rep = u.amountRepaid || 0;
      totalUdhaarPending += Math.max(0, tot - rep);
    });

    return {
      todayIncome: financialSummary.todayIncome,
      todayExpenses: financialSummary.todayExpenses,
      todayProfit: financialSummary.todayProfit,
      thisWeekIncome: financialSummary.thisWeekIncome,
      thisWeekExpenses: financialSummary.thisWeekExpenses,
      thisWeekProfit: financialSummary.thisWeekProfit,
      thisMonthIncome: financialSummary.thisMonthIncome,
      thisMonthExpenses: financialSummary.thisMonthExpenses,
      thisMonthProfit: financialSummary.thisMonthProfit,
      totalIncome: financialSummary.totalIncome,
      totalExpenses: financialSummary.totalExpenses,
      netProfit: financialSummary.netProfit,
      profitMarginPercent: financialSummary.profitMarginPercent,
      activeDaysCount: financialSummary.activeDaysCount,
      monthlyBreakdown: financialSummary.monthlyBreakdown,
      categoryBreakdown: financialSummary.categoryBreakdown,
      totalUdhaarPending,
      totalUdhaar: totalUdhaarPending,
      udhaarEntries: udhaarList,
      readinessScore: Math.min(95, Math.max(65, Math.round((financialSummary.activeDaysCount / 20) * 100)))
    };
  };

  // Send query handler
  const handleSend = async (queryText?: string) => {
    const query = (queryText || inputText).trim();
    if (!query || isLoading) return;

    stopVoiceListening();
    setInputText('');
    setSpeechError(null);

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-4).map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        text: m.text
      }));

      const contextPayload = buildContext();

      const response = await api.askChat({
        query,
        language,
        context: contextPayload,
        history: historyPayload
      });

      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: response.answer,
        language: response.language || language,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        metrics: response.metrics,
        suggestedFollowups: response.suggested_followups
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Automatically speak the answer in its detected language
      if (assistantMsg.text) {
        speakText(assistantMsg.text, (assistantMsg.language as Language) || language);
      }
    } catch (err: any) {
      console.warn("Backend chat failed, using local fallback", err);
      // Deterministic Client-side Fallback
      const context = buildContext();
      let answer = "";
      let followups: string[] = [];

      const q = query.toLowerCase();
      if (q.includes('udhaar') || q.includes('उधार') || q.includes('बाकी')) {
        answer = language === 'mr' 
          ? `तुमच्याकडे एकूण ₹${context.totalUdhaarPending.toLocaleString('en-IN')} उधारी बाकी आहे.`
          : language === 'hi'
          ? `कुल ₹${context.totalUdhaarPending.toLocaleString('en-IN')} का उधार बकाया है।`
          : `You have a total of ₹${context.totalUdhaarPending.toLocaleString('en-IN')} in outstanding Udhaar.`;
        followups = [
          language === 'mr' ? 'या महिन्यात किती नफा झाला?' : language === 'hi' ? 'इस महीने कितना मुनाफ़ा हुआ?' : 'How much profit this month?',
          language === 'mr' ? 'क्रेडिट रेडीनेस स्कोअर काय आहे?' : language === 'hi' ? 'क्रेडिट स्कोर क्या है?' : 'What is my credit score?'
        ];
      } else if (q.includes('profit') || q.includes('नफा') || q.includes('मुनाफ़ा')) {
        answer = language === 'mr'
          ? `चालू महिन्यात तुमचा नफा ₹${context.thisMonthProfit.toLocaleString('en-IN')} आहे (उत्पन्न ₹${context.thisMonthIncome.toLocaleString('en-IN')}, खर्च ₹${context.thisMonthExpenses.toLocaleString('en-IN')}).`
          : language === 'hi'
          ? `चालू महीने में आपका मुनाफ़ा ₹${context.thisMonthProfit.toLocaleString('en-IN')} है (आय ₹${context.thisMonthIncome.toLocaleString('en-IN')}, खर्च ₹${context.thisMonthExpenses.toLocaleString('en-IN')})।`
          : `Your net profit for this month is ₹${context.thisMonthProfit.toLocaleString('en-IN')} (income ₹${context.thisMonthIncome.toLocaleString('en-IN')}, expenses ₹${context.thisMonthExpenses.toLocaleString('en-IN')}).`;
        followups = [
          language === 'mr' ? 'नफा वाढतोय का कमी होतोय?' : language === 'hi' ? 'मुनाफ़ा बढ़ रहा है या घट रहा है?' : 'Is my profit increasing or decreasing?',
          language === 'mr' ? 'उधार किती बाकी आहे?' : language === 'hi' ? 'कुल कितना उधार बाकी है?' : 'How much Udhaar is remaining?'
        ];
      } else {
        answer = language === 'mr'
          ? `तुमच्या नोंदीनुसार चालू महिन्याचे उत्पन्न ₹${context.thisMonthIncome.toLocaleString('en-IN')}, खर्च ₹${context.thisMonthExpenses.toLocaleString('en-IN')}, आणि नफा ₹${context.thisMonthProfit.toLocaleString('en-IN')} आहे.`
          : language === 'hi'
          ? `आपके रिकॉर्ड के अनुसार इस महीने की आय ₹${context.thisMonthIncome.toLocaleString('en-IN')}, खर्च ₹${context.thisMonthExpenses.toLocaleString('en-IN')}, और शुद्ध मुनाफ़ा ₹${context.thisMonthProfit.toLocaleString('en-IN')} है।`
          : `According to your records, this month's income is ₹${context.thisMonthIncome.toLocaleString('en-IN')}, expenses are ₹${context.thisMonthExpenses.toLocaleString('en-IN')}, and net profit is ₹${context.thisMonthProfit.toLocaleString('en-IN')}.`;
      }

      const fallbackMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: answer,
        language,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedFollowups: followups
      };
      setMessages(prev => [...prev, fallbackMsg]);
      speakText(answer, language);
    } finally {
      setIsLoading(false);
    }
  };

  // Speech Recognition Handling
  const startVoiceListening = () => {
    stopSpeech();
    setSpeechError(null);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError(
        language === 'mr' 
          ? "आपल्या ब्राउझरमध्ये व्हॉइस इनपुट उपलब्ध नाही. कृपया Chrome वापरा." 
          : language === 'hi'
          ? "आपके ब्राउज़र में वॉइस इनपुट समर्थित नहीं है। कृपया Chrome उपयोग करें।"
          : "Speech recognition is not supported in this browser. Please use Chrome."
      );
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn("Chat speech error", event.error);
        setIsListening(false);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setSpeechError(`Voice error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.warn("Could not start recognition", e);
      setIsListening(false);
    }
  };

  const stopVoiceListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brand-900/40 backdrop-blur-xs transition-opacity animate-fade-in">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Container */}
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 z-50">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-brand-900 via-brand-850 to-brand-900 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent-500 text-white flex items-center justify-center shadow-inner">
              <Bot size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base tracking-tight text-white">
                  Ask Khata AI
                </h2>
                <span className="text-[10px] font-bold bg-accent-400 text-brand-950 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                  <Sparkles size={10} /> Smart Assistant
                </span>
              </div>
              <p className="text-xs text-gray-300 font-medium">
                {language === 'mr' 
                  ? 'उधारी, नफा आणि बँक पात्रतेबाबत विचारा' 
                  : language === 'hi'
                  ? 'उधार, मुनाफ़ा और बैंक पात्रता के बारे में पूछें'
                  : 'Ask about Udhaar, profits & loan readiness'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => stopSpeech()}
              className="text-gray-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition cursor-pointer"
              title="Stop audio speech"
            >
              <Square size={16} />
            </button>
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition cursor-pointer"
              title="Close chat"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick Example Questions Tray */}
        <div className="bg-gray-100/90 border-b border-gray-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0 shadow-inner">
          <span className="text-[10px] font-extrabold text-gray-500 uppercase shrink-0 pl-1">
            {language === 'mr' ? 'उदा.' : language === 'hi' ? 'उदा.' : 'Ex:'}
          </span>
          {(language === 'mr' ? [
            'उधार किती बाकी आहे?',
            'या महिन्यात किती नफा झाला?',
            'नफा वाढतोय का कमी होतोय?',
            'सर्वात जास्त उधारी कोणाकडे आहे?',
            'या महिन्यात किती मिळवले आणि खर्च केले?',
            'कोणाचे देणे बाकी आहे?',
            'माझा सर्वोत्तम महिना कोणता?',
            'या आठवड्यात विक्री किती झाली?',
            'मागच्या महिन्यापेक्षा या महिन्यात खर्च किती वाढला?',
            'Sunita ne ajun kiti paise dyayche aahet?',
            'क्रेडिट रेडीनेस कसा वाढवायचा?'
          ] : language === 'hi' ? [
            'कुल कितना उधार बाकी है?',
            'इस महीने कितना मुनाफ़ा हुआ?',
            'मुनाफ़ा बढ़ रहा है या घट रहा है?',
            'सबसे अधिक उधार किसका है?',
            'इस महीने कितनी कमाई और खर्च हुआ?',
            'किसका भुगतान बकाया है?',
            'मेरा सबसे अच्छा महीना कौन सा था?',
            'इस सप्ताह की कुल बिक्री कितनी है?',
            'पिछले महीने से खर्च कितना बढ़ा?',
            'सुनीता का कितना उधार बाकी है?',
            'क्रेडिट स्कोर कैसे सुधारें?'
          ] : [
            'How much Udhaar is remaining?',
            'How much profit this month?',
            'Is my profit increasing or decreasing?',
            'Which customer owes me the most money?',
            'How much money did I earn and spend this month?',
            'Who has overdue payments?',
            'Which month was my best?',
            'What are my total sales this week?',
            'How much did expenses increase compared to last month?',
            'Sunita ne ajun kiti paise dyayche aahet?',
            'What should I do to improve my credit readiness?'
          ]).map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(q)}
              className="text-[11px] font-bold bg-white hover:bg-accent-50 text-brand-900 border border-gray-200/90 hover:border-accent-400 px-3 py-1 rounded-full whitespace-nowrap shadow-2xs transition active:scale-95 cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-50/70">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-3xl p-4 shadow-2xs ${
                  m.sender === 'user'
                    ? 'bg-brand-900 text-white rounded-tr-xs'
                    : 'bg-white text-gray-800 border border-gray-200/80 rounded-tl-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {m.text}
                  </div>

                  {m.sender === 'assistant' && (
                    <div className="shrink-0 pt-0.5">
                      <AudioSpeakerButton
                        text={m.text}
                        langOverride={(m.language as Language) || language}
                        size="sm"
                        title="Read aloud"
                      />
                    </div>
                  )}
                </div>

                <div
                  className={`text-[10px] mt-2 font-semibold ${
                    m.sender === 'user' ? 'text-gray-300 text-right' : 'text-gray-400 text-left'
                  }`}
                >
                  {m.timestamp}
                </div>
              </div>

              {/* Assistant Follow-up Suggestions */}
              {m.sender === 'assistant' && m.suggestedFollowups && m.suggestedFollowups.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[90%]">
                  {m.suggestedFollowups.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(suggestion)}
                      className="text-xs bg-white hover:bg-accent-50 text-brand-900 hover:text-accent-700 font-semibold px-3 py-1.5 rounded-full border border-gray-200/80 hover:border-accent-300 shadow-2xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer text-left"
                    >
                      <span>{suggestion}</span>
                      <ArrowRight size={11} className="text-accent-500 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500 bg-white p-3.5 rounded-2xl border border-gray-200 max-w-xs shadow-2xs">
              <RefreshCw size={16} className="animate-spin text-accent-500" />
              <span className="text-xs font-bold">
                {language === 'mr' 
                  ? 'खात्याची गणना करत आहे...' 
                  : language === 'hi' 
                  ? 'बहीखाता जांच रहे हैं...' 
                  : 'Analyzing ledger records...'}
              </span>
            </div>
          )}

          {speechError && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-2xl border border-rose-200 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{speechError}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3.5 bg-white border-t border-gray-200 space-y-2">
          {/* Active Voice Listening Banner */}
          {isListening && (
            <div className="flex items-center justify-between bg-accent-50 border border-accent-200 px-3.5 py-2 rounded-xl text-xs text-accent-800 font-bold animate-pulse">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent-500 animate-ping" />
                <span>
                  {language === 'mr' ? 'ऐकत आहे... बोला' : language === 'hi' ? 'सुन रहा हूँ... बोलिए' : 'Listening... Speak now'}
                </span>
              </div>
              <button
                onClick={stopVoiceListening}
                className="text-accent-700 hover:text-accent-900 underline text-[11px]"
              >
                Done
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={isListening ? stopVoiceListening : startVoiceListening}
              className={`p-3 rounded-2xl transition shadow-xs cursor-pointer ${
                isListening
                  ? 'bg-rose-500 text-white animate-bounce'
                  : 'bg-accent-50 text-accent-600 hover:bg-accent-100 border border-accent-200'
              }`}
              title={isListening ? "Stop listening" : "Ask by Voice"}
            >
              <Mic size={20} />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder={
                language === 'mr'
                  ? 'येथे प्रश्न विचारा किंवा बोला...'
                  : language === 'hi'
                  ? 'यहाँ प्रश्न पूछें या बोलें...'
                  : 'Ask a question or speak...'
              }
              className="flex-1 bg-surface-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-500 focus:bg-white transition"
              disabled={isLoading}
            />

            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isLoading}
              className="p-3 bg-brand-900 hover:bg-brand-800 disabled:opacity-40 text-white rounded-2xl transition shadow-xs cursor-pointer"
              title="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
