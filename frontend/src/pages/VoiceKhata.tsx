import React, { useState, useEffect, useRef } from 'react';
import { useAppContext, Transaction } from '../context/AppContext';
import { 
  Mic, CheckCircle, Edit2, X, Plus, Play, HelpCircle, 
  AlertCircle, ArrowRight, RefreshCw, Volume2, VolumeX, 
  Calculator, TrendingUp, Sparkles, Trash2, Calendar, 
  Filter, Check, Clock, ChevronDown, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';

// Polyfill for speech recognition
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function VoiceKhata() {
  const { 
    loc, language, businessContext, addTransaction, addTransactions,
    deleteTransaction, transactions, isDemoMode, speakText 
  } = useAppContext();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0); // 0: Idle, 1: Listening/Processing, 2: Confirmation Card, 3: Success
  const [transcript, setTranscript] = useState('');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDemoVideo, setShowDemoVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Day-wise Ledger Filter below voice component
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'sale' | 'expense'>('all');
  const [editingLedgerTxn, setEditingLedgerTxn] = useState<Transaction | null>(null);
  const [editLedgerItem, setEditLedgerItem] = useState('');
  const [editLedgerAmount, setEditLedgerAmount] = useState('');
  const [editLedgerDate, setEditLedgerDate] = useState('');
  const [editLedgerType, setEditLedgerType] = useState<'sale' | 'expense'>('sale');

  const transcriptRef = useRef<string>('');
  const recognitionRef = useRef<any>(null);

  // Manual fallback text
  const [manualText, setManualText] = useState('');
  const [showManual, setShowManual] = useState(!SpeechRecognition);

  // Toggle Mute / Sound
  const toggleSound = () => {
    if (!isMuted) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
    setIsMuted(!isMuted);
  };

  // Setup Speech Recognition
  useEffect(() => {
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        const langMap: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
        recognition.lang = langMap[language] || 'mr-IN';

        recognition.onresult = (event: any) => {
          let full = '';
          for (let i = 0; i < event.results.length; ++i) {
            full += event.results[i][0].transcript + ' ';
          }
          const cleaned = full.trim();
          transcriptRef.current = cleaned;
          setTranscript(cleaned);
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          if (event.error === 'not-allowed') {
            setErrorMsg(
              language === 'mr' 
                ? "मायक्रोफोन परवानगी मिळालेली नाही. कृपया खाली टाईप करा किंवा चाचणी वाक्य निवडा." 
                : language === 'hi'
                ? "माइक्रोफ़ोन की अनुमति नहीं है। कृपया नीचे टाइप करें या टेस्ट वाक्य चुनें।"
                : "Microphone access blocked. Please type your entry or choose a sample below."
            );
            setShowManual(true);
          }
        };

        recognition.onend = () => {
          if (transcriptRef.current && transcriptRef.current.trim().length > 0) {
            processTranscript(transcriptRef.current);
          } else {
            setStep(0);
          }
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.error("Speech init error", e);
      }
    }
  }, [language]);

  const startListening = () => {
    setErrorMsg('');
    setTranscript('');
    transcriptRef.current = '';
    setStep(1);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Recognition already active", e);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (transcriptRef.current && transcriptRef.current.trim().length > 0) {
      processTranscript(transcriptRef.current);
    } else {
      setStep(0);
    }
  };

  // Cancel / Reset Current Voice Khata Entry
  const handleCancelEntry = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setStep(0);
    setTranscript('');
    setManualText('');
    setExtractedData(null);
    setIsEditing(false);
    setErrorMsg('');
  };

  // Deterministic local extraction as instant parser or fallback
  const processTranscript = async (textToProcess: string) => {
    const query = textToProcess.trim();
    if (!query) {
      setStep(0);
      return;
    }

    setTranscript(query);
    setStep(1);
    setIsProcessing(true);
    setErrorMsg('');

    try {
      // Send to backend parser
      const result = await api.parseSpeech({
        text: query,
        business_type: businessContext?.id || 'Tiffin',
        language: language
      });

      if (result && result.transactions && result.transactions.length > 0) {
        setExtractedData(result);
        const parsedD = result.transactions[0]?.date || new Date().toISOString().split('T')[0];
        setEntryDate(parsedD);
        setStep(2);
        announceTotals(result.transactions);
      } else {
        throw new Error("No transactions extracted from API");
      }
    } catch (err: any) {
      console.warn("Speech parse fallback to client regex:", err);
      // Client-side deterministic fallback:
      const fallbackTxns = extractClientFallback(query);
      setExtractedData({ transactions: fallbackTxns });
      const parsedD = fallbackTxns[0]?.date || new Date().toISOString().split('T')[0];
      setEntryDate(parsedD);
      setStep(2);
      announceTotals(fallbackTxns);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDateChange = (newDate: string) => {
    setEntryDate(newDate);
    if (extractedData && extractedData.transactions) {
      const updated = extractedData.transactions.map((t: any) => ({
        ...t,
        date: newDate
      }));
      setExtractedData({ ...extractedData, transactions: updated });
    }
  };

  // Voice announcement helper
  const announceTotals = (txns: any[]) => {
    if (isMuted) return;
    let inc = 0;
    let exp = 0;
    txns.forEach(t => {
      const a = Number(t.amount) || 0;
      if (t.type === 'sale') inc += a;
      else exp += a;
    });
    const prf = inc - exp;

    let msg = "";
    if (language === 'mr') {
      msg = `मिळकत ${inc} रुपये. एकूण खर्च ${exp} रुपये. निव्वळ नफा ${prf} रुपये.`;
    } else if (language === 'hi') {
      msg = `आमदनी ${inc} रुपये. कुल खर्च ${exp} रुपये. शुद्ध मुनाफ़ा ${prf} रुपये.`;
    } else {
      msg = `Income ${inc} rupees. Expenses ${exp} rupees. Net profit ${prf} rupees.`;
    }
    speakText(msg);
  };

  // Deterministic client regex fallback matching backend parser
  const extractClientFallback = (text: string) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let parsedDate = todayStr;

    const lower = text.toLowerCase();
    if (/\b(parso|parva|परवा|परसों|day before yesterday)\b/i.test(lower)) {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      parsedDate = d.toISOString().split('T')[0];
    } else if (/\b(yesterday|kal|काल|कल)\b/i.test(lower)) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      parsedDate = d.toISOString().split('T')[0];
    }

    const txns: any[] = [];
    if (!text || !text.trim()) return txns;

    let norm = text.toLowerCase()
      .replace(/₹/g, ' ₹ ')
      .replace(/[?|!]/g, ' . ')
      .replace(/,/g, ' , ')
      .replace(/\brupess?\b|\brupes\b|\brupya\b|\brupiya\b|\brs\.?\b|\binr\b/g, ' rupees ')
      .replace(/\bsolde\b/g, 'sold')
      .replace(/\bdaba\b/g, 'dabba')
      .replace(/\btifins?\b/g, 'tiffin')
      .replace(/\bspended\b|\bspend\b/g, 'spent')
      .replace(/ब्लाऊज|ब्लाउझ|ब्लाऊझ/g, 'ब्लाउज');

    // Indian number words
    const numWords: Record<string, number> = {
      "दोन": 2, "दो": 2, "तीन": 3, "चार": 4, "पाच": 5, "पांच": 5,
      "सहा": 6, "छह": 6, "सात": 7, "आठ": 8, "नऊ": 9, "नौ": 9, "दहा": 10, "दस": 10,
      "अकरा": 11, "ग्यारह": 11, "बारा": 12, "बारह": 12, "तेरा": 13, "चौदा": 14, "चौदह": 14,
      "पंधरा": 15, "पंद्रह": 15, "सोळा": 16, "सोलह": 16, "सतरा": 17, "सत्रह": 17,
      "अठरा": 18, "अठारह": 18, "एकोणीस": 19, "उन्नीस": 19, "वीस": 20, "बीस": 20,
      "तीस": 30, "चाळीस": 40, "चालीस": 40, "पन्नास": 50, "पचास": 50,
      "शंभर": 100, "सौ": 100, "दोनशे": 200, "दो सौ": 200, "तीनशे": 300, "तीन सौ": 300,
      "चारशे": 400, "चार सौ": 400, "पाचशे": 500, "पाँच सौ": 500, "सहाशे": 600, "छह सौ": 600,
      "सातशे": 700, "आठशे": 800, "नऊशे": 900, "हजार": 1000, "हज़ार": 1000
    };
    for (const [w, val] of Object.entries(numWords)) {
      norm = norm.replace(new RegExp(`(^|[^a-zA-Z0-9\u0900-\u097f])${w}(?=[^a-zA-Z0-9\u0900-\u097f]|$)`, 'g'), `$1 ${val} `);
    }

    const curRegex = '(?:rupees|rupess|rupes|rupya|rupiya|रुपयांचे|रुपयांचा|रुपयांची|रुपयांच्या|रुपये|रु|₹|rs\\.?|inr)';

    // 1. Detect Unit Rate
    const rateMatch1 = norm.match(new RegExp(`(?:^|\\s)(?:1|one|एक)\\s+([^\\d.,!?।]{1,25}?)\\s*(?:at|@|for|का|चे|ची|च्या|ला|में|प्रती|प्रमाणे)?\\s*${curRegex}?\\s*(\\d+(?:\\.\\d+)?)`, 'i'));
    const rateMatch2 = norm.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${curRegex}?\\s*(?:each|per|का\\s*एक|चा\\s*एक|ची\\s*एक|चे\\s*एक|प्रत्येकी|प्रती|प्रमाणे)`, 'i'));
    const rateMatch3 = norm.match(new RegExp(`(?:each|per|at|@)\\s*${curRegex}?\\s*(\\d+(?:\\.\\d+)?)`, 'i'));

    let rate: number | null = null;
    let rateSpanStart = -1;
    let rateSpanEnd = -1;

    if (rateMatch1 && rateMatch1[2]) {
      rate = parseFloat(rateMatch1[2]);
      rateSpanStart = rateMatch1.index || 0;
      rateSpanEnd = rateSpanStart + rateMatch1[0].length;
    } else if (rateMatch2 && rateMatch2[1]) {
      rate = parseFloat(rateMatch2[1]);
      rateSpanStart = rateMatch2.index || 0;
      rateSpanEnd = rateSpanStart + rateMatch2[0].length;
    } else if (rateMatch3 && rateMatch3[1]) {
      rate = parseFloat(rateMatch3[1]);
      rateSpanStart = rateMatch3.index || 0;
      rateSpanEnd = rateSpanStart + rateMatch3[0].length;
    }

    // 2. Detect Sold Quantity & Product
    let qty: number | null = null;
    let productName = 'वस्तू / Items';
    let productCat = 'Sales';

    const knownItems: [string, string[], string][] = [
      ['ब्लाउज / Blouses', ['ब्लाउज', 'blouse', 'blouses'], 'Tailoring Orders'],
      ['ड्रेस / Dresses', ['ड्रेस', 'dress', 'dresses', 'सूट', 'suit', 'suits', 'कुर्ती', 'kurti'], 'Tailoring Orders'],
      ['साड्या / Sarees', ['साडी', 'साड्या', 'saree', 'sarees'], 'Retail Sales'],
      ['डबे / Tiffins', ['डबे', 'डब्बे', 'डब्बा', 'डबा', 'टिफिन', 'tiffin', 'tiffins', 'dabba', 'dabbas', 'थाळी'], 'Meals'],
      ['केक / Cakes', ['केक', 'cake', 'cakes', 'पेस्ट्री', 'pastry'], 'Bakery Sales'],
      ['फेशिअल / Facials', ['फेशिअल', 'facial', 'facials', 'आयब्रो', 'eyebrow'], 'Salon Services'],
    ];

    for (const [disp, syns, cat] of knownItems) {
      const synRe = syns.join('|');
      const itemRegex = new RegExp(`(\\d+)\\s*(?:of\\s*)?(${synRe})(?:\\s|[.,!?।]|$)`, 'gi');
      let m: RegExpExecArray | null;
      const foundMatches: { qty: number; start: number; end: number }[] = [];
      while ((m = itemRegex.exec(norm)) !== null) {
        foundMatches.push({ qty: parseInt(m[1]), start: m.index, end: m.index + m[0].length });
      }
      if (foundMatches.length > 0) {
        let chosen = foundMatches[0];
        if (foundMatches.length > 1 && chosen.qty === 1 && foundMatches[1].qty > 1) {
          chosen = foundMatches[1];
        } else if (rateSpanStart !== -1 && rateSpanStart <= chosen.start && chosen.end <= rateSpanEnd + 5 && chosen.qty === 1) {
          const others = foundMatches.filter(x => !(rateSpanStart <= x.start && x.end <= rateSpanEnd + 5));
          if (others.length > 0) chosen = others[0];
        }
        qty = chosen.qty;
        productName = disp;
        productCat = cat;
        break;
      }
    }

    if (qty === null) {
      const mVerb = norm.match(/(\d+)\s+([^\d.,!?।]{1,25}?)\s+(?:शिवले|शिवल्या|शिवून दिले|विकले|विकल्या|विकला|विकली|बेचे|बेची|बनाए|बनवले|बनवल्या|दिले|दिल्या|केले|केल्या|तैयार किए|तयार केले|sold|stitched|made|delivered)/i);
      if (mVerb) {
        qty = parseInt(mVerb[1]);
        productName = `${mVerb[2].trim()} / Sales`;
        productCat = 'Sales';
      }
    }

    if (qty === null) {
      const soldAny = norm.match(/(\d+)\s*(?:items?|units?)?\s*(?:sold|beche|vikle|nikle|दिए|सेल)/i);
      if (soldAny) qty = parseInt(soldAny[1]);
    }

    // Calculate sale
    if (qty && rate) {
      const totalSale = Math.round(qty * rate);
      txns.push({
        type: 'sale',
        category: productCat,
        description: `${qty} × ${productName} (₹${rate} each)`,
        quantity: qty,
        unit_price: rate,
        amount: totalSale,
        date: parsedDate
      });
    } else if (qty && !rate) {
      const flatSale = norm.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${curRegex}?\\s*(?:total|me|में|मिले|कमाई|बिक्री|विक्री)`, 'i'));
      if (flatSale) {
        const amt = parseFloat(flatSale[1]);
        txns.push({
          type: 'sale',
          category: productCat,
          description: `${qty} × ${productName}`,
          quantity: qty,
          unit_price: Math.round((amt / qty) * 100) / 100,
          amount: amt,
          date: parsedDate
        });
      }
    } else if (rate && !qty) {
      txns.push({
        type: 'sale',
        category: productCat,
        description: `१ × ${productName}`,
        quantity: 1,
        unit_price: rate,
        amount: rate,
        date: parsedDate
      });
    }

    if (txns.length === 0) {
      const flatOnly = norm.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${curRegex}?\\s*(?:ची\\s*विक्री|की\\s*बिक्री|सेल|sales|मिले|मिळाले|कमाई)`, 'i'))
        || norm.match(/(?:sales|बिक्री|कमाई|विक्री)\s*(\d+(?:\.\d+)?)/i);
      if (flatOnly) {
        const amt = parseFloat(flatOnly[1]);
        txns.push({
          type: 'sale',
          category: 'Sales',
          description: 'दैनिक विक्री / Daily Sales',
          quantity: 1,
          unit_price: amt,
          amount: amt,
          date: parsedDate
        });
      }
    }

    // 3. Detect Itemized Expenses
    const expenseCategories: [string, string[], string][] = [
      ['भाजी / Vegetables', ['vegetables', 'veggies', 'sabzi', 'sabji', 'bhaji', 'भाजी', 'सब्जी', 'भाजीपाला'], 'Grocery'],
      ['गहू / Wheat', ['wheat', 'atta', 'flour', 'गेहूं', 'गहू', 'पीठ'], 'Grocery'],
      ['तेल / Oil', ['oil', 'cooking oil', 'तेल'], 'Grocery'],
      ['मसाले / Spices', ['spices', 'masala', 'मसाला', 'मसाले'], 'Grocery'],
      ['गॅस / Gas Cylinder', ['gas', 'cylinder', 'गॅस', 'गैस'], 'Utilities'],
      ['कापड / Fabric', ['fabric', 'cloth', 'kapda', 'कापड', 'कपड़ा'], 'Raw Material'],
      ['धागा / Thread', ['thread', 'threads', 'धागा'], 'Supplies'],
      ['अस्तर / Lining', ['अस्तर', 'lining', 'astar'], 'Supplies'],
      ['लेस / Lace', ['लेस', 'lace', 'लेसचा'], 'Supplies'],
      ['क्रीम / Cream', ['क्रीम', 'cream'], 'Bakery Supplies'],
      ['मैदा / Flour', ['मैदा', 'maida'], 'Bakery Supplies'],
      ['भाडे / Rent & Travel', ['भाडे', 'भाडा', 'टेम्पो', 'rent', 'auto', 'tempo'], 'Logistics'],
      ['किराणा / Groceries', ['grocery', 'groceries', 'किराणा', 'सामान'], 'Grocery']
    ];

    for (const [dispName, syns, cat] of expenseCategories) {
      const synRe = syns.join('|');
      const p1 = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${curRegex}?\\s*(?:i\\s*)?(?:spent|spend|खर्च|लागत|for|on|की|का|के|चा|चे|ची|च्या)?\\s*(?:on\\s*)?(?:${synRe})(?:\\s|[.,!?।]|$)`, 'i');
      const p2 = new RegExp(`(?:${synRe})\\s*(?:for|cost|worth|of|के|चे|चा)?\\s*${curRegex}?\\s*(\\d+(?:\\.\\d+)?)(?:\\s|[.,!?।]|$)`, 'i');

      const m1 = norm.match(p1);
      const m2 = norm.match(p2);
      if (m1) {
        const amt = parseFloat(m1[1]);
        if (!txns.some(t => t.amount === amt)) {
          txns.push({ type: 'expense', category: cat, description: dispName, amount: amt, date: parsedDate });
        }
      } else if (m2) {
        const amt = parseFloat(m2[1]);
        if (!txns.some(t => t.amount === amt)) {
          txns.push({ type: 'expense', category: cat, description: dispName, amount: amt, date: parsedDate });
        }
      }
    }

    // 4. Generic Expense if no itemized expenses
    if (!txns.some(x => x.type === 'expense')) {
      const genMatch = norm.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${curRegex}?\\s*(?:i\\s*)?(?:चा|चे|ची|च्या|का|के|की|on|for)?\\s*(?:spent|spend|expense|खर्च|लागत)`, 'i'))
        || norm.match(new RegExp(`(?:खर्च|खर्चा|expense|spent)\\s*${curRegex}?\\s*(\\d+(?:\\.\\d+)?)`, 'i'));
      if (genMatch) {
        const amt = parseFloat(genMatch[1]);
        txns.push({
          type: 'expense',
          category: 'Operational',
          description: 'दैनिक खर्च / Expenses',
          amount: amt,
          date: parsedDate
        });
      }
    }

    // Fallback if empty
    if (txns.length === 0) {
      const numMatches = norm.match(/\d+(?:\.\d+)?/g);
      if (numMatches && numMatches.length > 0) {
        const val = parseFloat(numMatches[0]);
        txns.push({
          type: 'sale',
          category: 'Sales',
          description: text.slice(0, 30),
          quantity: 1,
          unit_price: val,
          amount: val,
          date: parsedDate
        });
      } else {
        txns.push({
          type: 'sale',
          category: 'Sales',
          description: text.slice(0, 30),
          quantity: 1,
          unit_price: 1000,
          amount: 1000,
          date: parsedDate
        });
      }
    }

    return txns;
  };

  // Deterministic totals calculation for confirmation card
  const getConfirmationTotals = () => {
    if (!extractedData || !extractedData.transactions) {
      return { totalIncome: 0, totalExpenses: 0, netProfit: 0 };
    }
    let inc = 0;
    let exp = 0;
    extractedData.transactions.forEach((t: any) => {
      const val = parseFloat(t.amount) || 0;
      if (t.type === 'sale') inc += val;
      else exp += val;
    });
    return {
      totalIncome: Math.round(inc),
      totalExpenses: Math.round(exp),
      netProfit: Math.round(inc - exp)
    };
  };

  const handleConfirmAndSave = async () => {
    if (!extractedData || !extractedData.transactions) return;

    setIsSaving(true);
    setErrorMsg('');

    try {
      const validTxns: Omit<Transaction, 'id'>[] = [];
      for (const txn of extractedData.transactions) {
        const amt = parseFloat(txn.amount);
        if (!isNaN(amt) && amt > 0) {
          validTxns.push({
            type: txn.type || 'sale',
            item: txn.description || txn.category || 'Transaction',
            category: txn.category || (txn.type === 'sale' ? 'Sales' : 'Expenses'),
            quantity: txn.quantity ? parseInt(txn.quantity) : undefined,
            unit_price: txn.unit_price ? parseFloat(txn.unit_price) : undefined,
            amount: amt,
            date: txn.date || entryDate || new Date().toISOString().split('T')[0],
            source: isDemoMode ? 'demo' : (manualText ? 'manual' : 'voice'),
            raw_transcript: transcript || manualText
          });
        }
      }

      if (validTxns.length > 0) {
        await addTransactions(validTxns);
      }

      setStep(3);
      setTimeout(() => {
        setStep(0);
        setExtractedData(null);
        setTranscript('');
        setManualText('');
      }, 1800);
    } catch (err: any) {
      console.error("Save error:", err);
      setErrorMsg("Failed to save transaction. Please check values.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditChange = (index: number, field: string, value: any) => {
    const updated = [...extractedData.transactions];
    if (field === 'amount') {
      const parsed = parseFloat(value);
      updated[index][field] = isNaN(parsed) ? 0 : parsed;
    } else if (field === 'quantity') {
      const parsed = parseInt(value);
      updated[index][field] = isNaN(parsed) ? null : parsed;
      if (updated[index].unit_price && parsed) {
        updated[index].amount = Math.round(parsed * updated[index].unit_price);
      }
    } else if (field === 'unit_price') {
      const parsed = parseFloat(value);
      updated[index][field] = isNaN(parsed) ? null : parsed;
      if (updated[index].quantity && parsed) {
        updated[index].amount = Math.round(updated[index].quantity * parsed);
      }
    } else {
      updated[index][field] = value;
    }
    setExtractedData({ ...extractedData, transactions: updated });
  };

  const addEmptyItem = () => {
    const defaultType = extractedData?.transactions?.length > 0 ? 'expense' : 'sale';
    const newItems = [
      ...(extractedData?.transactions || []),
      {
        type: defaultType,
        category: defaultType === 'sale' ? 'Sales' : 'Grocery',
        description: '',
        quantity: null,
        unit_price: null,
        amount: 0,
        date: new Date().toISOString().split('T')[0]
      }
    ];
    setExtractedData({
      ...extractedData,
      transactions: newItems
    });
    setIsEditing(true);
  };

  const removeExtractedItem = (index: number) => {
    if (!extractedData || !extractedData.transactions) return;
    const updated = extractedData.transactions.filter((_: any, i: number) => i !== index);
    if (updated.length === 0) {
      // If no items remain, reset
      handleCancelEntry();
    } else {
      setExtractedData({ ...extractedData, transactions: updated });
    }
  };

  // Day-wise Ledger Actions
  const filteredLedgerTxns = transactions.filter((t: Transaction) => {
    if (ledgerFilter === 'all') return true;
    return t.type === ledgerFilter;
  });

  const handleDeleteLedgerItem = async (id: number | string) => {
    if (window.confirm(loc.deleteConfirm || "Delete this transaction?")) {
      await deleteTransaction(id);
    }
  };

  const handleStartEditLedger = (t: Transaction) => {
    setEditingLedgerTxn(t);
    setEditLedgerItem(t.item || '');
    setEditLedgerAmount(t.amount.toString());
    setEditLedgerDate(t.date || new Date().toISOString().split('T')[0]);
    setEditLedgerType(t.type);
  };

  const handleSaveEditLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLedgerTxn) return;
    const amt = parseFloat(editLedgerAmount);
    if (!amt || amt <= 0 || !editLedgerItem.trim()) return;

    await deleteTransaction(editingLedgerTxn.id);
    await addTransaction({
      type: editLedgerType,
      item: editLedgerItem.trim(),
      category: editingLedgerTxn.category || (editLedgerType === 'sale' ? 'Sales' : 'Expenses'),
      quantity: editingLedgerTxn.quantity,
      unit_price: editingLedgerTxn.quantity ? Math.round((amt / editingLedgerTxn.quantity) * 100) / 100 : undefined,
      amount: amt,
      date: editLedgerDate,
      source: editingLedgerTxn.source || 'manual'
    });
    setEditingLedgerTxn(null);
  };

  const sampleVoicePhrases = [
    ...(language === 'en' ? [
      {
        lang: "English",
        label: "Tiffin Service",
        text: "Sold 20 tiffins at 70 rupees each. Spent 600 on vegetables and 450 on wheat."
      },
      {
        lang: "English",
        label: "Tailoring Work",
        text: "Tailored 3 blouses for 500 each. Spent 400 on cloth and 100 on thread."
      },
      {
        lang: "English",
        label: "General Store / Snacks",
        text: "Earned 1400 from sales today. Spent 500 on groceries and 300 on oil."
      }
    ] : language === 'hi' ? [
      {
        lang: "हिंदी",
        label: "टिफिन सर्विस",
        text: "आज 20 डब्बे बिके, 70 रुपये का एक। 600 रुपये की सब्जी और 450 रुपये का गेहूं लाया।"
      },
      {
        lang: "हिंदी",
        label: "सिलाई काम",
        text: "3 ब्लाउज सिले 500 रुपये के हिसाब से। 400 रुपये का कपड़ा और 100 रुपये का धागा खरीदा।"
      },
      {
        lang: "हिंदी",
        label: "दैनिक बिक्री व खर्च",
        text: "आज 30 डब्बे निकले। एक डब्बा ₹50? खर्च ₹500।"
      }
    ] : [
      {
        lang: "मराठी",
        label: "डबेवाला / टिफिन व्यवसाय",
        text: "आज 20 डबे विकले, 70 रुपये प्रत्येकी. 600 रुपयांची भाजी आणि 450 रुपयांचा गहू आणला."
      },
      {
        lang: "मराठी",
        label: "शिलाई काम / Tailoring",
        text: "3 ब्लाउज शिवले 500 रुपये प्रमाणे. 400 रुपयांचे कापड आणि 100 रुपयांचा धागा आणला."
      },
      {
        lang: "मराठी",
        label: "दुकान / नाश्ता केंद्र",
        text: "आज 1400 रुपयांची विक्री झाली. 500 रुपयांचे दूध आणि 300 रुपयांचे तेल आणले."
      }
    ])
  ];

  const { totalIncome, totalExpenses, netProfit } = getConfirmationTotals();

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 min-h-[85vh]">
      {/* Top Header with Sound Toggle & Demo Guide */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-900 tracking-tight">{loc.voiceKhataTitle}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{loc.voiceKhataSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sound On / Off Toggle */}
          <button
            onClick={toggleSound}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition shadow-2xs cursor-pointer ${
              isMuted 
                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
            title={isMuted ? "Sound is Off. Click to unmute." : "Sound is On. Click to mute."}
          >
            {isMuted ? (
              <>
                <VolumeX size={15} className="text-rose-600" />
                <span>{loc.soundOff || "Sound Off"}</span>
              </>
            ) : (
              <>
                <Volume2 size={15} className="text-emerald-600" />
                <span>{loc.soundOn || "Sound On"}</span>
              </>
            )}
          </button>

          {/* Watch Demo Guide */}
          <button
            onClick={() => setShowDemoVideo(true)}
            className="flex items-center gap-1.5 bg-accent-50 text-accent-600 hover:bg-accent-100 px-3.5 py-2 rounded-xl text-xs font-bold border border-accent-200 transition shadow-2xs cursor-pointer"
          >
            <Play size={14} className="fill-accent-500" /> {loc.watchDemoGuide}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 0 & 1: Microphone Listening Screen */}
        {step <= 1 && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-white p-6 md:p-10 rounded-3xl shadow-xl border border-gray-100 text-center relative overflow-hidden"
          >
            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-3.5 rounded-2xl text-sm mb-6 font-medium border border-red-200 flex items-center gap-2 text-left">
                <AlertCircle size={18} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!showManual ? (
              <>
                {/* Big Bolo Voice Button with Live Animation */}
                <div className="relative mb-8 flex justify-center mt-4">
                  {step === 1 && (
                    <div className="absolute inset-0 bg-accent-500/20 rounded-full animate-ping scale-150 mx-auto w-36 h-36"></div>
                  )}
                  <button
                    onClick={step === 1 ? stopListening : startListening}
                    className={`relative z-10 w-36 h-36 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all cursor-pointer ${
                      step === 1 
                        ? 'bg-accent-500 scale-105 shadow-[0_0_35px_rgba(244,63,94,0.5)]' 
                        : 'bg-brand-900 hover:bg-brand-800 hover:scale-105'
                    }`}
                  >
                    <Mic className={`w-14 h-14 ${step === 1 && !isProcessing ? 'animate-pulse' : ''}`} />
                    <span className="text-xs font-extrabold mt-1 uppercase tracking-wider">
                      {step === 1 ? loc.stopAndParse : loc.tapToSpeak}
                    </span>
                  </button>
                </div>

                {/* Status Bar */}
                <div className="min-h-24 flex flex-col items-center justify-center">
                  {step === 1 ? (
                    <div className="w-full max-w-lg">
                      <p className="text-accent-600 font-bold text-lg mb-2 flex items-center justify-center gap-2">
                        {isProcessing ? (
                          <>
                            <RefreshCw size={18} className="animate-spin" /> {loc.processing}
                          </>
                        ) : (
                          <>
                            <Volume2 size={18} className="animate-bounce" /> {loc.listening}
                          </>
                        )}
                      </p>

                      {transcript ? (
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-brand-900 font-semibold italic text-base shadow-inner">
                          "{transcript}"
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">
                          {businessContext?.examples?.[language] || businessContext?.examples?.en}
                        </p>
                      )}

                      <div className="flex justify-center gap-3 mt-4">
                        <button
                          onClick={handleCancelEntry}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer"
                        >
                          {loc.cancelKhata || "Cancel"}
                        </button>
                        <button
                          onClick={stopListening}
                          className="bg-brand-900 hover:bg-brand-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-sm cursor-pointer"
                        >
                          ✓ {loc.stopAndParse}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-gray-400 font-bold uppercase tracking-wider text-xs mb-2">
                        {loc.recordVoicePrompt}
                      </p>
                      <button
                        onClick={() => setShowManual(true)}
                        className="text-accent-600 font-bold text-sm hover:underline cursor-pointer"
                      >
                        {loc.typeManualPrompt}
                      </button>
                    </>
                  )}
                </div>

                {/* 1-Click Test Phrases (Instant Voice Simulation) */}
                {step === 0 && (
                  <div className="mt-8 border-t border-gray-100 pt-6 text-left">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-accent-500" />
                      <span>{loc.quickTestSamplesTitle}</span>
                    </p>
                    <div className="grid gap-2">
                      {sampleVoicePhrases.map((sample, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setTranscript(sample.text);
                            processTranscript(sample.text);
                          }}
                          className="w-full p-3.5 text-left rounded-xl bg-surface-50 hover:bg-accent-50/50 border border-gray-200 hover:border-accent-300 transition flex items-center justify-between text-xs md:text-sm font-medium text-gray-700 group cursor-pointer"
                        >
                          <div className="truncate pr-2">
                            <span className="font-bold text-brand-900 mr-2">[{sample.lang}]</span>
                            <span className="text-gray-500 text-xs mr-2">({sample.label})</span>
                            <span className="italic font-semibold text-brand-800">"{sample.text}"</span>
                          </div>
                          <ArrowRight size={15} className="text-gray-400 group-hover:text-accent-500 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Manual Input Mode */
              <div className="text-left mt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <label className="block text-sm font-bold text-gray-700">
                    {loc.typeWhatYouSaid}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                      <Calendar size={13} className="text-brand-600" />
                      {language === 'mr' ? 'तारीख:' : language === 'hi' ? 'तारीख:' : 'Date:'}
                    </span>
                    <input
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="bg-white border border-gray-300 rounded-xl px-2.5 py-1 text-xs font-bold text-brand-900 outline-none focus:border-brand-500 cursor-pointer"
                    />
                  </div>
                </div>
                <textarea
                  className="w-full border-gray-300 rounded-2xl p-4 border bg-gray-50 outline-none min-h-[110px] mb-4 text-base focus:border-brand-500 focus:bg-white transition"
                  placeholder='उदा. "आज 20 डबे विकले, 70 रुपये का एक. 600 रुपये की सब्जी और 450 रुपये का गेहूं लाया."'
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowManual(false);
                      setManualText('');
                      setErrorMsg('');
                    }}
                    className="flex-1 py-3.5 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition text-base cursor-pointer"
                  >
                    {loc.cancelKhata || "Cancel"}
                  </button>
                  <button
                    onClick={() => processTranscript(manualText)}
                    disabled={!manualText.trim() || isProcessing}
                    className="flex-2 py-3.5 rounded-xl font-bold text-white bg-accent-500 hover:bg-accent-600 disabled:opacity-50 transition shadow-lg text-base flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" /> {loc.processing}
                      </>
                    ) : (
                      `✓ ${loc.stopAndParse}`
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 2: The Exact Financial Confirmation Card */}
        {step === 2 && extractedData && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100"
          >
            {errorMsg && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 font-medium border border-red-200">
                {errorMsg}
              </div>
            )}

            {/* What You Said */}
            <div className="mb-6 bg-surface-50 p-4 rounded-2xl border border-gray-200">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
                {loc.whatYouSaid}
              </span>
              <p className="text-brand-900 font-semibold italic text-base">
                "{transcript || manualText}"
              </p>
            </div>

            {/* CONFIRMATION CARD: Income = ₹1400, Expenses = ₹1050, Profit = ₹350 */}
            <div className="bg-gradient-to-br from-brand-900 to-slate-900 text-white rounded-3xl p-6 mb-6 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs font-bold text-accent-400 uppercase tracking-wider">
                    {loc.diagnosedSummary}
                  </span>
                  <h3 className="text-xl font-extrabold text-white mt-0.5">
                    {loc.isThisCorrect}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSound}
                    className={`p-2 rounded-xl transition cursor-pointer ${isMuted ? 'bg-rose-500/30 text-rose-300' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    title={isMuted ? (language === 'mr' ? "आवाज बंद आहे" : language === 'hi' ? "आवाज़ बंद है" : "Sound Muted") : (language === 'mr' ? "आवाज चालू आहे" : language === 'hi' ? "आवाज़ चालू है" : "Sound Active")}
                  >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <button
                    onClick={() => announceTotals(extractedData.transactions)}
                    className="bg-accent-500 hover:bg-accent-600 px-3 py-1.5 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title={language === 'mr' ? "हिशोब ऐका" : language === 'hi' ? "हिसाब सुनें" : "Listen to Summary"}
                  >
                    <Volume2 size={15} />
                    <span>{language === 'mr' ? 'ऐका' : language === 'hi' ? 'सुनें' : 'Listen'}</span>
                  </button>
                </div>
              </div>

              {/* 3 Prominent Stat Boxes */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10">
                  <span className="text-xs text-gray-300 block font-medium">{loc.incomeLabel}</span>
                  <span className="text-2xl font-black text-green-400">
                    ₹{totalIncome.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="bg-white/10 rounded-2xl p-3.5 border border-white/10">
                  <span className="text-xs text-gray-300 block font-medium">{loc.expenseLabel}</span>
                  <span className="text-2xl font-black text-rose-400">
                    ₹{totalExpenses.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="bg-accent-500/20 rounded-2xl p-3.5 border border-accent-400/30">
                  <span className="text-xs text-accent-300 block font-bold">{loc.netProfitLabel}</span>
                  <span className="text-2xl font-black text-accent-400">
                    ₹{netProfit.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Transaction Date Selector (Allows picking past date) */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <label className="text-xs font-bold text-amber-900 block">
                    {language === 'mr' ? 'नोंदीची तारीख (मागील तारीखही निवडू शकता)' : language === 'hi' ? 'लेनदेन की तारीख (पिछली तारीख भी चुन सकते हैं)' : 'Transaction Date (Pick any past date)'}
                  </label>
                  <span className="text-[11px] text-amber-700">
                    {language === 'mr' ? 'उदा. काल किंवा परवाचा हिशोब असल्यास तारीख बदला' : language === 'hi' ? 'उदा. कल या परसों का हिसाब हो तो तारीख बदलें' : 'e.g. Change if recording for yesterday or earlier'}
                  </span>
                </div>
              </div>
              <input
                type="date"
                max={new Date().toISOString().split('T')[0]}
                value={entryDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-white border border-amber-300 rounded-xl px-3 py-2 text-sm font-bold text-brand-900 shadow-2xs focus:ring-2 focus:ring-amber-400 outline-none cursor-pointer self-start sm:self-auto"
              />
            </div>

            {/* Itemized Transactions Breakdown */}
            <div className="mb-6 space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {language === 'mr' ? `नोंदवलेले घटक (${extractedData.transactions.length})` : language === 'hi' ? `दर्ज मदें (${extractedData.transactions.length})` : `Itemized Entries (${extractedData.transactions.length})`}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={addEmptyItem}
                    className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} /> {loc.addAnotherItem || "+ Add Item"}
                  </button>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-xs text-accent-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 size={13} /> {isEditing ? (language === 'mr' ? "बदल पूर्ण" : language === 'hi' ? "संपादन पूर्ण" : "Done Editing") : loc.editBeforeSave}
                  </button>
                </div>
              </div>

              {extractedData.transactions.map((txn: any, i: number) => (
                <div
                  key={i}
                  className={`p-4 rounded-2xl border transition relative ${
                    txn.type === 'sale' 
                      ? 'bg-green-50/50 border-green-200' 
                      : 'bg-rose-50/40 border-rose-200'
                  }`}
                >
                  {!isEditing ? (
                    /* Display Mode */
                    <div className="flex justify-between items-center">
                      <div className="pr-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded font-extrabold uppercase ${
                            txn.type === 'sale' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {txn.type === 'sale' 
                              ? (language === 'mr' ? '+ मिळकत' : language === 'hi' ? '+ आमदनी' : '+ Income') 
                              : (language === 'mr' ? '- खर्च' : language === 'hi' ? '- खर्च' : '- Expense')}
                          </span>
                          <span className="text-xs text-gray-400 font-medium">{txn.category || 'General'}</span>
                        </div>
                        <p className="font-bold text-brand-900 text-base mt-1">
                          {txn.description || 'Transaction'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xl font-extrabold ${txn.type === 'sale' ? 'text-green-600' : 'text-rose-600'}`}>
                          {txn.type === 'sale' ? '+' : '-'}₹{Number(txn.amount).toLocaleString('en-IN')}
                        </span>
                        <button
                          onClick={() => removeExtractedItem(i)}
                          className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Remove this item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Edit Mode */
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex gap-2 flex-1">
                          <select
                            className="bg-white border border-gray-300 rounded-xl p-2 text-sm font-bold"
                            value={txn.type}
                            onChange={(e) => handleEditChange(i, 'type', e.target.value)}
                          >
                            <option value="sale">✓ Income / Sale</option>
                            <option value="expense">✗ Expense / Cost</option>
                          </select>
                          <input
                            type="date"
                            className="bg-white border border-gray-300 rounded-xl p-2 text-sm font-medium"
                            value={txn.date || new Date().toISOString().split('T')[0]}
                            onChange={(e) => handleEditChange(i, 'date', e.target.value)}
                          />
                        </div>
                        <button
                          onClick={() => removeExtractedItem(i)}
                          className="text-gray-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition ml-2 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1">Item / Description</label>
                          <input
                            type="text"
                            className="w-full bg-white border border-gray-300 rounded-xl p-2 text-sm font-semibold"
                            value={txn.description || ''}
                            onChange={(e) => handleEditChange(i, 'description', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1">Amount (₹)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-gray-300 rounded-xl p-2 text-sm font-bold"
                            value={txn.amount || ''}
                            onChange={(e) => handleEditChange(i, 'amount', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add extra item button */}
            <button
              onClick={addEmptyItem}
              className="w-full mb-6 py-2.5 border-2 border-dashed border-gray-200 hover:border-accent-300 hover:bg-accent-50/20 rounded-xl text-xs font-bold text-gray-600 hover:text-accent-600 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Plus size={15} /> {loc.addAnotherItem || "+ Add another item to this entry"}
            </button>

            {/* Primary Action Buttons: [Cancel] [Edit Details] [Confirm & Save] */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCancelEntry}
                className="py-3.5 px-5 rounded-xl border border-gray-300 hover:border-rose-300 font-bold text-gray-600 hover:text-rose-600 hover:bg-rose-50/50 transition text-sm flex items-center justify-center gap-1.5 cursor-pointer order-3 sm:order-1"
              >
                <X size={16} />
                <span>{loc.cancelKhata || "Cancel"}</span>
              </button>

              <button
                onClick={() => setIsEditing(!isEditing)}
                className="py-3.5 px-5 rounded-xl border border-gray-300 font-bold text-gray-700 hover:bg-gray-50 transition text-sm flex items-center justify-center gap-2 cursor-pointer order-2"
              >
                <Edit2 size={16} />
                <span>{isEditing ? "Done Editing" : loc.editBeforeSave}</span>
              </button>

              <button
                onClick={handleConfirmAndSave}
                disabled={isSaving || extractedData.transactions.some((t: any) => !t.amount || t.amount <= 0)}
                className="flex-1 py-3.5 px-6 rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-extrabold transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-base cursor-pointer order-1 sm:order-3"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" /> {loc.savingWait}
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} /> {loc.confirmAndSave}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Success Confirmation Screen */}
        {step === 3 && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-50 border border-green-200 p-10 rounded-3xl flex flex-col items-center text-center shadow-lg"
          >
            <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mb-4 shadow-lg">
              <CheckCircle size={44} />
            </div>
            <h2 className="text-2xl font-black text-green-900 mb-2">{loc.saveSuccess}</h2>
            <p className="text-green-700 text-sm max-w-sm">
              Your Khata ledger, daily history, and Credit-Readiness statement have been updated.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DAY-WISE LEDGER LIST WITH FILTERS AND EDIT/DELETE */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-brand-900 tracking-tight flex items-center gap-2">
              <Calendar size={20} className="text-accent-500" />
              <span>{loc.ledgerTitle || "Day-wise Khata Ledger"}</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Review and manage all recorded transactions by day
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setLedgerFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                ledgerFilter === 'all' ? 'bg-white text-brand-900 shadow-xs' : 'text-gray-500 hover:text-brand-900'
              }`}
            >
              {loc.allEntries || "All"} ({transactions.length})
            </button>
            <button
              onClick={() => setLedgerFilter('sale')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                ledgerFilter === 'sale' ? 'bg-white text-green-700 shadow-xs' : 'text-gray-500 hover:text-green-700'
              }`}
            >
              {loc.salesOnly || "Income"}
            </button>
            <button
              onClick={() => setLedgerFilter('expense')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                ledgerFilter === 'expense' ? 'bg-white text-rose-600 shadow-xs' : 'text-gray-500 hover:text-rose-600'
              }`}
            >
              {loc.expensesOnly || "Expenses"}
            </button>
          </div>
        </div>

        {/* Ledger Entries List */}
        {filteredLedgerTxns.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {loc.noEntriesFound || "No transactions recorded yet."}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto pr-1">
            {filteredLedgerTxns.slice(0, 30).map((t: Transaction) => (
              <div 
                key={t.id} 
                className="py-3.5 flex items-center justify-between hover:bg-surface-50/80 px-2 rounded-xl transition group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${
                    t.type === 'sale' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {t.type === 'sale' ? '+' : '-'}
                  </div>
                  <div>
                    <p className="font-bold text-brand-900 text-sm">
                      {t.quantity && t.quantity > 1 ? `${t.quantity} × ` : ''}{t.item || t.category}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium mt-0.5">
                      <span>{t.date}</span>
                      <span>•</span>
                      <span>{t.category || (t.type === 'sale' ? 'Sales' : 'General')}</span>
                      {t.source && (
                        <>
                          <span>•</span>
                          <span className="text-accent-600 font-semibold">{t.source}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`font-black text-base ${
                    t.type === 'sale' ? 'text-green-600' : 'text-rose-600'
                  }`}>
                    {t.type === 'sale' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN')}
                  </span>
                  
                  <div className="flex items-center gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEditLedger(t)}
                      className="p-1.5 text-gray-400 hover:text-brand-900 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                      title={loc.edit || "Edit"}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteLedgerItem(t.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title={loc.delete || "Delete"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Ledger Item Modal */}
      {editingLedgerTxn && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-gray-100">
            <button
              onClick={() => setEditingLedgerTxn(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-brand-900 mb-4">{loc.edit || "Edit Transaction"}</h3>
            <form onSubmit={handleSaveEditLedger} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Type</label>
                <select
                  value={editLedgerType}
                  onChange={(e: any) => setEditLedgerType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-bold outline-none"
                >
                  <option value="sale">✓ Income / Sale</option>
                  <option value="expense">✗ Expense / Cost</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Item / Description</label>
                <input
                  type="text"
                  value={editLedgerItem}
                  onChange={(e) => setEditLedgerItem(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-semibold outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={editLedgerAmount}
                  onChange={(e) => setEditLedgerAmount(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-bold outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Date</label>
                <input
                  type="date"
                  value={editLedgerDate}
                  onChange={(e) => setEditLedgerDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-sm font-medium outline-none"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLedgerTxn(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  {loc.cancelKhata || "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-xl text-sm font-bold"
                >
                  {loc.save || "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Demo Walkthrough Modal */}
      {showDemoVideo && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl relative border border-gray-100"
          >
            <button
              onClick={() => setShowDemoVideo(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent-100 text-accent-600 flex items-center justify-center">
                <Play size={20} className="fill-accent-500" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-brand-900">{loc.watchDemoGuide}</h3>
                <p className="text-xs text-gray-500">How Meena Tai records her tiffin business</p>
              </div>
            </div>

            <div className="bg-brand-900 text-white rounded-2xl p-5 mb-6 shadow-inner">
              <p className="text-xs text-accent-400 font-bold mb-1">Meena Tai Speaks (मराठी):</p>
              <p className="font-bold text-sm text-green-300 mb-4 bg-brand-800/80 p-3 rounded-xl">
                "आज 20 डबे विकले, 70 रुपये प्रत्येकी. 600 रुपयांची भाजी आणि 450 रुपयांचा गहू आणला."
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between bg-brand-800/80 p-2 rounded-lg">
                  <span>🍱 Income: 20 Tiffins × ₹70</span>
                  <span className="font-bold text-green-400">+₹1,400</span>
                </div>
                <div className="flex justify-between bg-brand-800/80 p-2 rounded-lg">
                  <span>🥬 Vegetables + Wheat</span>
                  <span className="font-bold text-rose-400">-₹1,050</span>
                </div>
                <div className="flex justify-between bg-accent-950 p-2 rounded-lg font-bold border border-accent-800/50">
                  <span>Calculated Net Profit</span>
                  <span className="text-accent-300">+₹350 (25% margin)</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setShowDemoVideo(false);
                const testPhrase = "आज 20 डबे विकले, 70 रुपये प्रत्येकी. 600 रुपयांची भाजी आणि 450 रुपयांचा गहू आणला.";
                setTranscript(testPhrase);
                processTranscript(testPhrase);
              }}
              className="w-full bg-accent-500 hover:bg-accent-600 text-white font-extrabold py-3.5 rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              Test This Exact Sentence Now <ArrowRight size={18} />
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
