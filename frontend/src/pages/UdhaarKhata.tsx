import React, { useState, useEffect, useRef } from 'react';
import { useAppContext, Language } from '../context/AppContext';
import { 
  Users, Plus, Search, MessageSquare, CheckCircle, 
  Clock, IndianRupee, Phone, Calendar, ArrowUpRight, 
  CheckCircle2, X, AlertCircle, Share2, Filter, Trash2, 
  Mic, Volume2, ShieldCheck, AlertTriangle, Check, RefreshCw, Send,
  CreditCard, Banknote, ExternalLink, Info, CheckCheck, Sparkles
} from 'lucide-react';
import { api } from '../lib/api';
import { AudioSpeakerButton } from '../components/AudioSpeakerButton';

export interface UdhaarHistoryItem {
  id?: string;
  type: 'credit' | 'payment' | 'sale' | 'expense';
  amount: number;
  date: string;
  note?: string;
  paymentMethod?: 'cash' | 'upi';
  paymentStatus?: 'verified' | 'unverified_upi' | 'disputed';
  verificationStatus?: 'verified' | 'pending' | 'disputed';
  statusLabel?: string;
  receiptId?: string;
  whatsAppStatus?: 'delivered' | 'demo_simulated' | 'already_sent' | 'failed' | 'not_sent';
  whatsAppMessageId?: string;
}

export interface UdhaarEntry {
  id: string;
  customerName: string;
  phone: string;
  totalUdhaar: number;
  amountRepaid: number;
  notes: string;
  date: string;
  verificationStatus?: 'verified' | 'pending' | 'disputed';
  history: UdhaarHistoryItem[];
}

const SINGLE_SAMPLE_UDHAAR: UdhaarEntry = {
  id: 'sample_udhaar_1',
  customerName: 'अनिता पाटील (Anita Patil - नमुना / Sample)',
  phone: '9822012345',
  totalUdhaar: 500,
  amountRepaid: 200,
  notes: 'नमुना उधारी नोंद (Sample Credit Example)',
  date: '2026-10-01',
  verificationStatus: 'verified',
  history: [
    { 
      type: 'credit', 
      amount: 500, 
      date: '2026-10-01', 
      note: 'उधारी दिली (Credit Given)', 
      verificationStatus: 'verified',
      receiptId: 'REC-CRED-101',
      whatsAppStatus: 'demo_simulated'
    },
    { 
      type: 'payment', 
      amount: 200, 
      date: '2026-10-03', 
      note: 'अंशतः जमा (Partial Repaid)', 
      paymentMethod: 'cash',
      paymentStatus: 'verified',
      statusLabel: 'Cash Received — Shopkeeper Confirmed',
      verificationStatus: 'verified',
      receiptId: 'REC-PAY-102',
      whatsAppStatus: 'demo_simulated'
    }
  ]
};

// Balance Calculation Helper:
// Automatically calculates correct pending balance from ledger.
// CRITICAL RULE: Do NOT count unverified UPI payments as settled!
export const computeCustomerBalances = (entry: UdhaarEntry) => {
  const historyCredits = (entry.history && entry.history.length > 0)
    ? entry.history.filter(h => h.type === 'credit').reduce((s, h) => s + h.amount, 0)
    : 0;
  const totalCredit = Math.max(historyCredits, entry.totalUdhaar || 0);

  const historyRepaid = (entry.history && entry.history.length > 0)
    ? entry.history
        .filter(h => h.type === 'payment' && h.paymentStatus !== 'unverified_upi')
        .reduce((s, h) => s + h.amount, 0)
    : 0;
  const verifiedRepaid = Math.max(historyRepaid, entry.amountRepaid || 0);

  const unverifiedUPI = (entry.history && entry.history.length > 0)
    ? entry.history
        .filter(h => h.type === 'payment' && h.paymentStatus === 'unverified_upi')
        .reduce((s, h) => s + h.amount, 0)
    : 0;

  const pendingDue = Math.max(0, totalCredit - verifiedRepaid);

  return { totalCredit, verifiedRepaid, unverifiedUPI, pendingDue };
};

export default function UdhaarKhata() {
  const { loc, user, businessContext, language, addTransaction, speakText, stopSpeech } = useAppContext();

  const storageKey = `khata_udhaar_${user?.email || user?.id || 'default'}`;

  const [entries, setEntries] = useState<UdhaarEntry[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const userOnly = parsed.filter((x: UdhaarEntry) => x.id !== 'u1' && x.id !== 'u2' && x.id !== 'u3');
          return userOnly.length > 0 ? userOnly : [SINGLE_SAMPLE_UDHAAR];
        }
      }
    } catch {}
    return [SINGLE_SAMPLE_UDHAAR];
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const userOnly = parsed.filter((x: UdhaarEntry) => x.id !== 'u1' && x.id !== 'u2' && x.id !== 'u3');
          if (userOnly.length > 0) {
            setEntries(userOnly);
          } else {
            setEntries([SINGLE_SAMPLE_UDHAAR]);
          }
          return;
        }
      }
      setEntries([SINGLE_SAMPLE_UDHAAR]);
    } catch {
      setEntries([SINGLE_SAMPLE_UDHAAR]);
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  }, [entries, storageKey]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'cleared' | 'disputed'>('pending');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<UdhaarEntry | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // BoliKhata Voice Modal & Confirmation State
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceParsedData, setVoiceParsedData] = useState<{
    customerName: string;
    phone: string;
    amount: number;
    type: 'credit' | 'payment' | 'sale' | 'expense';
    date: string;
    note?: string;
    matchedExistingId?: string;
  } | null>(null);

  // Smart Khata Check & WhatsApp Modals
  const [showSmartCheckModal, setShowSmartCheckModal] = useState(false);
  const [showApiConfigModal, setShowApiConfigModal] = useState(false);
  const [whatsAppDeliveryModalData, setWhatsAppDeliveryModalData] = useState<any | null>(null);
  const [manualDeliveryPhone, setManualDeliveryPhone] = useState('');
  const [whatsAppModalData, setWhatsAppModalData] = useState<{
    entry: UdhaarEntry;
    phone: string;
    message: string;
  } | null>(null);

  // Form states for Add
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  // Form states for Payment
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'upi'>('cash');
  const [upiStatus, setUpiStatus] = useState<'verified' | 'unverified_upi'>('verified');

  // Speech Recognition Ref
  const recognitionRef = useRef<any>(null);

  // Accurate Calculations across all entries using verified balance helper
  const totalPending = entries.reduce((acc, curr) => {
    const { pendingDue } = computeCustomerBalances(curr);
    return acc + pendingDue;
  }, 0);

  const pendingCustomersCount = entries.filter(e => computeCustomerBalances(e).pendingDue > 0).length;
  const totalRecovered = entries.reduce((acc, curr) => acc + computeCustomerBalances(curr).verifiedRepaid, 0);
  const disputedCount = entries.filter(e => e.verificationStatus === 'disputed').length;

  // Filtered List
  const filteredEntries = entries.filter(e => {
    const { pendingDue } = computeCustomerBalances(e);
    const matchesFilter = 
      filterType === 'all' ? true :
      filterType === 'pending' ? pendingDue > 0 :
      filterType === 'cleared' ? pendingDue <= 0 :
      filterType === 'disputed' ? e.verificationStatus === 'disputed' : true;

    const matchesSearch = 
      e.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.phone.includes(searchQuery) ||
      e.notes.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Convert Devanagari numerals (०, १, २...) to standard digits (0, 1, 2...)
  const convertDevanagariNumerals = (str: string): string => {
    const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    let res = str;
    devanagariDigits.forEach((digit, i) => {
      res = res.replace(new RegExp(digit, 'g'), i.toString());
    });
    return res;
  };

  // Phonetic transliteration from Devanagari to Latin characters for robust customer matching
  const devanagariToLatin = (str: string): string => {
    const charMap: Record<string, string> = {
      'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
      'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
      'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
      'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
      'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
      'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
      'ळ': 'l', 'क्ष': 'ksh', 'ज्ञ': 'gy',
      'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
      'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an'
    };
    const matraMap: Record<string, string> = {
      'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ri',
      'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', '्': ''
    };

    let result = '';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const nextCh = str[i + 1];

      if (matraMap[ch] !== undefined) {
        result += matraMap[ch];
      } else if (charMap[ch] !== undefined) {
        const latin = charMap[ch];
        const isConsonant = !'अआईईउऊऋएऐओऔअं'.includes(ch);
        if (isConsonant && nextCh && matraMap[nextCh] !== undefined) {
          result += latin;
        } else if (isConsonant && i < str.length - 1 && charMap[nextCh] !== undefined) {
          result += latin + 'a';
        } else {
          result += latin;
        }
      } else {
        result += ch;
      }
    }
    return result.toLowerCase();
  };

  // Helper to match customer name to existing customer (fuzzy & multilingual match)
  const findMatchingCustomer = (name: string): UdhaarEntry | undefined => {
    if (!name || !name.trim()) return undefined;
    const clean = name.trim().toLowerCase();
    const latinClean = devanagariToLatin(clean)
      .replace(/(ane|ne|la|chya|che|laa)$/, '')
      .trim();

    return entries.find(e => {
      const eName = e.customerName.toLowerCase();
      const eNameLatin = devanagariToLatin(eName);

      // Direct comparison
      if (eName === clean || eName.includes(clean) || clean.includes(eName)) return true;
      // Latin transliterated comparison (e.g. Ramesh vs रमेश or रमेशने)
      if (eNameLatin && latinClean) {
        if (eNameLatin === latinClean) return true;
        if (eNameLatin.includes(latinClean) || latinClean.includes(eNameLatin)) return true;
      }
      // Common suffixes (bhau, bhai, ji, patil, seth)
      const root1 = latinClean.replace(/(bhai|bhau|ji|patil|seth)$/, '').trim();
      const root2 = eNameLatin.replace(/(bhai|bhau|ji|patil|seth)$/, '').trim();
      if (root1 && root2 && (root1 === root2 || root1.includes(root2) || root2.includes(root1))) return true;

      return false;
    });
  };

  // Dispatch Automatic WhatsApp Notification via Backend API
  const sendWhatsAppNotification = async (params: {
    phone: string;
    type: 'new_udhar' | 'payment_receipt';
    customer_name: string;
    amount: number;
    previous_balance: number;
    new_balance: number;
    payment_method?: 'cash' | 'upi';
    payment_status?: string;
    receipt_id?: string;
  }) => {
    try {
      const res = await api.sendWhatsAppNotification({
        ...params,
        shop_name: user?.business_name || 'Khata Se Credit Tak Store',
        language: language
      });
      setWhatsAppDeliveryModalData(res);
      return res;
    } catch (err) {
      console.warn("WhatsApp notification error:", err);
      // Fallback response for UI
      const fallback = {
        status: 'demo_simulated',
        delivery_status: 'Demo Mode: Message Generated (Offline Fallback)',
        badge: '⚡ DEMO MODE',
        recipient: params.phone,
        receipt_id: params.receipt_id || 'TXN-FALLBACK',
        message_preview: `Notification: ${params.customer_name}, Amount ₹${params.amount}, Remaining: ₹${params.new_balance}`,
        provider_configured: false,
        wa_link: `https://wa.me/${params.phone}`
      };
      setWhatsAppDeliveryModalData(fallback);
      return fallback;
    }
  };

  // Setup Voice Recognition for BoliKhata
  const startVoiceRecording = () => {
    stopSpeech();
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Speech recognition is not supported in this browser. Please type your entry.");
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      const langMap: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
      rec.lang = langMap[language] || 'mr-IN';

      rec.onstart = () => {
        setIsListening(true);
        setVoiceTranscript('');
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setVoiceTranscript(text);
        processBoliKhataSpeechText(text);
      };

      rec.onerror = (e: any) => {
        console.warn("BoliKhata speech error", e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.warn(e);
      setIsListening(false);
    }
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  // BoliKhata Multilingual Speech Parser
  const processBoliKhataSpeechText = (text: string) => {
    // 1. Convert any Devanagari numerals to standard digits (उदा. ४०० -> 400)
    const convertedText = convertDevanagariNumerals(text);
    const norm = convertedText.toLowerCase();
    const todayStr = new Date().toISOString().split('T')[0];

    // 2. Extract 10-digit phone number if spoken
    const phoneMatch = convertedText.match(/[6-9]\d{9}/);
    const spokenPhone = phoneMatch ? phoneMatch[0] : '';

    // 3. Extract Amount (stripping out phone digits if present)
    let textWithoutPhone = convertedText;
    if (spokenPhone) {
      textWithoutPhone = textWithoutPhone.replace(spokenPhone, '');
    }
    const numMatch = textWithoutPhone.match(/\d+/);
    const amt = numMatch ? parseFloat(numMatch[0]) : 0;

    const isExpense = Boolean(norm.match(/खर्च|खर्चा|expense|spent|kharch/));
    const isSale = Boolean(norm.match(/विक्री|बिक्री|sale|विकले|बिके|vikri/)) && !isExpense;
    const isPayment = Boolean(norm.match(/परत|वापस|जमा|फेडले|repaid|returned|payment|wapas|parat|jama/)) && 
                      !Boolean(norm.match(/उधार\s*दिले|उधार\s*दिए|credit\s*given|उधारी\s*दिली/));

    let detectedType: 'credit' | 'payment' | 'sale' | 'expense' = 'credit';
    if (isExpense) detectedType = 'expense';
    else if (isSale) detectedType = 'sale';
    else if (isPayment) detectedType = 'payment';

    const stopTokens = [
      'काल', 'आज', 'परवा', 'उधार', 'उधारी', 'रुपये', 'रुपया', 'rupees', 'rs', 'udhaar', 
      'credit', 'payment', 'diye', 'दिले', 'दिए', 'परत', 'वापस', 'जमा', 'ko', 'ne', 'la', 
      'को', 'ने', 'ला', 'विक्री', 'खर्च', 'केले', 'केला', 'दिली', 'दिला', 'नंबर', 'मोबाईल', 'phone', 'mobile'
    ];
    let words = convertedText.split(/\s+/).filter(w => !stopTokens.includes(w.toLowerCase()) && !w.match(/\d/));
    let detectedName = words.length > 0 
      ? words[0].replace(/(ला|ने|को|जी|ताई|भाऊ)$/, '').trim() 
      : (detectedType === 'sale' ? 'दुकान विक्री (Shop Sale)' : detectedType === 'expense' ? 'दुकान खर्च (Shop Expense)' : 'ग्राहक (Customer)');

    const matched = (detectedType === 'credit' || detectedType === 'payment') ? findMatchingCustomer(detectedName) : undefined;

    const parsed = {
      customerName: matched ? matched.customerName : detectedName,
      phone: matched ? (matched.phone || spokenPhone) : spokenPhone,
      amount: amt,
      type: detectedType,
      date: todayStr,
      note: text,
      matchedExistingId: matched?.id
    };

    setVoiceParsedData(parsed);
    triggerVoiceVerifyReadback(parsed.customerName, parsed.amount, parsed.type);
  };

  // VoiceVerify TTS Readback
  const triggerVoiceVerifyReadback = (name: string, amount: number, type: string, status?: string) => {
    let msg = "";
    const typeLabel = 
      type === 'credit' ? (language === 'mr' ? 'उधारी देणे' : language === 'hi' ? 'उधार देना' : 'Credit Given') :
      type === 'payment' ? (language === 'mr' ? 'उधारी जमा' : language === 'hi' ? 'उधार भुगतान' : 'Payment Received') :
      type === 'sale' ? (language === 'mr' ? 'विक्री' : language === 'hi' ? 'बिक्री' : 'Sale') :
      (language === 'mr' ? 'खर्च' : language === 'hi' ? 'खर्च' : 'Expense');

    const statusLabel = status === 'disputed' 
      ? (language === 'mr' ? 'वादग्रस्त नोंद' : language === 'hi' ? 'विवादित' : 'Disputed')
      : (language === 'mr' ? 'पडताळणी पूर्ण' : language === 'hi' ? 'सत्यापित' : 'Verified');

    if (language === 'mr') {
      msg = `व्हॉइस पडताळणी: ${name}, रक्कम ₹${amount}, प्रकार ${typeLabel}. स्थिती: ${statusLabel}.`;
    } else if (language === 'hi') {
      msg = `वॉइस वेरिफिकेशन: ${name}, राशि ₹${amount}, प्रकार ${typeLabel}। स्थिति: ${statusLabel}।`;
    } else {
      msg = `VoiceVerify: ${name}, amount ₹${amount}, type ${typeLabel}. Status: ${statusLabel}.`;
    }

    speakText(msg, language);
  };

  // Khata Memory: Start Daily Review Prompt
  const startDailyReviewPrompt = () => {
    stopSpeech();
    let promptMsg = "";
    if (language === 'mr') {
      promptMsg = "नमस्कार! आज दिवसभरात कोणाचे उधारीचे पैसे जमा झाले आहेत का, कोणाला नवीन उधारी दिली, किंवा दुकानाचा काही खर्च झाला आहे का? कृपया सांगा.";
    } else if (language === 'hi') {
      promptMsg = "नमस्ते! क्या आज किसी ग्राहक ने उधार चुकाया, नया उधार लिया या कोई खर्च हुआ? कृपया बोलकर बताएं।";
    } else {
      promptMsg = "Hello! Did any customer repay dues today, take new credit, or did you make expenses? Please speak now.";
    }

    speakText(promptMsg, language);
    setShowVoiceModal(true);
    setVoiceParsedData(null);
    setVoiceTranscript('');
    setTimeout(() => {
      startVoiceRecording();
    }, 2500);
  };

  // 1. Confirm BoliKhata Voice Entry with Automatic WhatsApp Dispatch & Balance Deduction
  const handleConfirmVoiceUdhaar = async () => {
    if (!voiceParsedData || voiceParsedData.amount <= 0) return;

    const amt = voiceParsedData.amount;
    const name = voiceParsedData.customerName.trim();
    const phone = (voiceParsedData.phone || '').trim();
    const type = voiceParsedData.type;
    const recId = `REC-${Date.now().toString(36).toUpperCase()}`;

    // If Sale or Expense, log to global ledger transactions
    if (type === 'sale' || type === 'expense') {
      await addTransaction({
        type: type === 'sale' ? 'sale' : 'expense',
        item: name || (type === 'sale' ? 'BoliKhata Daily Sale' : 'BoliKhata Expense'),
        amount: amt,
        date: voiceParsedData.date,
        category: type === 'sale' ? 'Sales' : 'Expenses',
        source: 'voice',
        raw_transcript: voiceTranscript
      });
      setShowVoiceModal(false);
      setVoiceParsedData(null);
      setVoiceTranscript('');
      return;
    }

    const matched = voiceParsedData.matchedExistingId 
      ? entries.find(e => e.id === voiceParsedData.matchedExistingId)
      : findMatchingCustomer(name);

    if (type === 'credit') {
      const prevBal = matched ? computeCustomerBalances(matched).pendingDue : 0;
      const newBal = prevBal + amt;

      if (matched) {
        const updated = entries.map(item => {
          if (item.id === matched.id) {
            return {
              ...item,
              phone: phone || item.phone,
              totalUdhaar: item.totalUdhaar + amt,
              verificationStatus: 'verified' as const,
              history: [
                ...item.history,
                { 
                  type: 'credit' as const, 
                  amount: amt, 
                  date: voiceParsedData.date, 
                  note: 'BoliKhata Credit (बोलून उधारी)',
                  verificationStatus: 'verified' as const,
                  receiptId: recId,
                  whatsAppStatus: 'delivered' as const
                }
              ]
            };
          }
          return item;
        });
        setEntries(updated);
        // Automatic WhatsApp Notification for New Udhar
        sendWhatsAppNotification({
          phone: phone || matched.phone,
          type: 'new_udhar',
          customer_name: matched.customerName,
          amount: amt,
          previous_balance: prevBal,
          new_balance: newBal,
          receipt_id: recId
        });
      } else {
        const newEntry: UdhaarEntry = {
          id: Date.now().toString(36),
          customerName: name || 'ग्राहक (Customer)',
          phone: phone,
          totalUdhaar: amt,
          amountRepaid: 0,
          notes: 'BoliKhata Credit (बोलून उधारी)',
          date: voiceParsedData.date,
          verificationStatus: 'verified',
          history: [{ 
            type: 'credit', 
            amount: amt, 
            date: voiceParsedData.date, 
            note: 'Credit given',
            verificationStatus: 'verified',
            receiptId: recId,
            whatsAppStatus: 'delivered' as const
          }]
        };
        setEntries([newEntry, ...entries]);
        sendWhatsAppNotification({
          phone: phone,
          type: 'new_udhar',
          customer_name: name || 'ग्राहक (Customer)',
          amount: amt,
          previous_balance: 0,
          new_balance: amt,
          receipt_id: recId
        });
      }
    } else {
      // Repayment logic (जमा - DEDUCT FROM PENDING BALANCE)
      const targetCustomer = matched || (entries.length === 1 ? entries[0] : undefined);

      if (!targetCustomer) {
        alert(
          language === 'mr'
            ? "कृपया ज्या ग्राहकाचे पैसे जमा झाले आहेत तो ग्राहक निवडा."
            : language === 'hi'
            ? "कृपया जिस ग्राहक का भुगतान जमा हुआ है उसे चुनें।"
            : "Please select the customer to deduct this payment from."
        );
        return;
      }

      const prevBal = computeCustomerBalances(targetCustomer).pendingDue;
      const newBal = Math.max(0, prevBal - amt);

      const updated = entries.map(item => {
        if (item.id === targetCustomer.id) {
          return {
            ...item,
            phone: phone || item.phone,
            amountRepaid: item.amountRepaid + amt,
            verificationStatus: 'verified' as const,
            history: [
              ...item.history,
              { 
                type: 'payment' as const, 
                amount: amt, 
                date: voiceParsedData.date, 
                note: 'BoliKhata Repayment (बोलून जमा)',
                paymentMethod: 'cash' as const,
                paymentStatus: 'verified' as const,
                statusLabel: 'Cash Received — Shopkeeper Confirmed',
                verificationStatus: 'verified' as const,
                receiptId: recId,
                whatsAppStatus: 'delivered' as const
              }
            ]
          };
        }
        return item;
      });
      setEntries(updated);

      // Automatic WhatsApp Receipt for Payment
      sendWhatsAppNotification({
        phone: phone || targetCustomer.phone,
        type: 'payment_receipt',
        customer_name: targetCustomer.customerName,
        amount: amt,
        previous_balance: prevBal,
        new_balance: newBal,
        payment_method: 'cash',
        payment_status: 'verified',
        receipt_id: recId
      });
    }

    setShowVoiceModal(false);
    setVoiceParsedData(null);
    setVoiceTranscript('');
  };

  // Toggle Verification Status for Customer Record
  const handleToggleVerificationStatus = (id: string, newStatus: 'verified' | 'pending' | 'disputed') => {
    const updated = entries.map(item => {
      if (item.id === id) {
        return { ...item, verificationStatus: newStatus };
      }
      return item;
    });
    setEntries(updated);
  };

  // 2. Manual Add New Udhar with Automatic WhatsApp Notification
  const handleAddUdhaar = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (!newName.trim() || !amt || amt <= 0) return;
    const recId = `REC-${Date.now().toString(36).toUpperCase()}`;

    const existing = findMatchingCustomer(newName.trim());
    if (existing) {
      const prevBal = computeCustomerBalances(existing).pendingDue;
      const newBal = prevBal + amt;

      const updated = entries.map(item => {
        if (item.id === existing.id) {
          return {
            ...item,
            totalUdhaar: item.totalUdhaar + amt,
            phone: newPhone.replace(/\D/g, '') || item.phone,
            verificationStatus: 'verified' as const,
            history: [
              ...item.history,
              { 
                type: 'credit' as const, 
                amount: amt, 
                date: newDate, 
                note: newNotes.trim() || 'Additional Credit',
                verificationStatus: 'verified' as const,
                receiptId: recId,
                whatsAppStatus: 'delivered' as const
              }
            ]
          };
        }
        return item;
      });
      setEntries(updated);

      // Automatic WhatsApp Notification for New Udhar
      sendWhatsAppNotification({
        phone: newPhone.replace(/\D/g, '') || existing.phone,
        type: 'new_udhar',
        customer_name: existing.customerName,
        amount: amt,
        previous_balance: prevBal,
        new_balance: newBal,
        receipt_id: recId
      });
    } else {
      const newEntry: UdhaarEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
        customerName: newName.trim(),
        phone: newPhone.replace(/\D/g, '') || '',
        totalUdhaar: amt,
        amountRepaid: 0,
        notes: newNotes.trim() || 'General Credit',
        date: newDate,
        verificationStatus: 'verified',
        history: [
          { 
            type: 'credit', 
            amount: amt, 
            date: newDate, 
            note: newNotes.trim(),
            verificationStatus: 'verified',
            receiptId: recId,
            whatsAppStatus: 'delivered' as const
          }
        ]
      };
      setEntries([newEntry, ...entries]);

      sendWhatsAppNotification({
        phone: newPhone.replace(/\D/g, ''),
        type: 'new_udhar',
        customer_name: newName.trim(),
        amount: amt,
        previous_balance: 0,
        new_balance: amt,
        receipt_id: recId
      });
    }

    setShowAddModal(false);
    setNewName('');
    setNewPhone('');
    setNewAmount('');
    setNewNotes('');
  };

  // 3. Record Payment with Cash vs UPI Provider Verification & Auto WhatsApp Receipt
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    const recId = `RCP-${Date.now().toString(36).toUpperCase()}`;

    const prevBal = computeCustomerBalances(selectedEntry).pendingDue;
    const isUPIUnverified = payMethod === 'upi' && upiStatus === 'unverified_upi';

    // Critical rule: unverified UPI does not count as settled yet
    const newBal = isUPIUnverified ? prevBal : Math.max(0, prevBal - amt);

    const paymentLabel = payMethod === 'cash' 
      ? 'Cash Received — Shopkeeper Confirmed'
      : (isUPIUnverified ? 'UPI Pending Provider Confirmation' : 'UPI Confirmed — Provider Verified');

    const updated = entries.map(item => {
      if (item.id === selectedEntry.id) {
        return {
          ...item,
          amountRepaid: isUPIUnverified ? item.amountRepaid : (item.amountRepaid + amt),
          history: [
            ...item.history,
            { 
              type: 'payment' as const, 
              amount: amt, 
              date: new Date().toISOString().split('T')[0], 
              note: payNote.trim() || (payMethod === 'cash' ? 'Cash Payment' : 'UPI Payment'),
              paymentMethod: payMethod,
              paymentStatus: isUPIUnverified ? ('unverified_upi' as const) : ('verified' as const),
              statusLabel: paymentLabel,
              verificationStatus: isUPIUnverified ? ('pending' as const) : ('verified' as const),
              receiptId: recId,
              whatsAppStatus: 'delivered' as const
            }
          ]
        };
      }
      return item;
    });

    setEntries(updated);

    // Automatic WhatsApp Receipt dispatch
    sendWhatsAppNotification({
      phone: selectedEntry.phone,
      type: 'payment_receipt',
      customer_name: selectedEntry.customerName,
      amount: amt,
      previous_balance: prevBal,
      new_balance: newBal,
      payment_method: payMethod,
      payment_status: isUPIUnverified ? 'unverified_upi' : 'verified',
      receipt_id: recId
    });

    setShowPaymentModal(false);
    setSelectedEntry(null);
    setPayAmount('');
    setPayNote('');
    setPayMethod('cash');
    setUpiStatus('verified');
  };

  // 4. Confirm Pending UPI Payment (Provider Webhook Simulation)
  const handleConfirmUPIPayment = (customer: UdhaarEntry, historyIdx: number) => {
    const histItem = customer.history[historyIdx];
    if (!histItem || histItem.paymentStatus !== 'unverified_upi') return;

    const amt = histItem.amount;
    const prevBal = computeCustomerBalances(customer).pendingDue;
    const newBal = Math.max(0, prevBal - amt);
    const recId = histItem.receiptId || `RCP-${Date.now().toString(36).toUpperCase()}`;

    const updated = entries.map(item => {
      if (item.id === customer.id) {
        const updatedHistory = [...item.history];
        updatedHistory[historyIdx] = {
          ...histItem,
          paymentStatus: 'verified',
          statusLabel: 'UPI Confirmed — Provider Verified (Webhook Settled)',
          verificationStatus: 'verified'
        };
        return {
          ...item,
          amountRepaid: item.amountRepaid + amt,
          history: updatedHistory
        };
      }
      return item;
    });

    setEntries(updated);

    // Dispatch verified payment receipt via WhatsApp
    sendWhatsAppNotification({
      phone: customer.phone,
      type: 'payment_receipt',
      customer_name: customer.customerName,
      amount: amt,
      previous_balance: prevBal,
      new_balance: newBal,
      payment_method: 'upi',
      payment_status: 'verified',
      receipt_id: recId
    });
  };

  // Delete Customer Record
  const handleDeleteEntry = (id: string) => {
    if (window.confirm("Are you sure you want to remove this customer record?")) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  // Initiate Manual WhatsApp Reminder with Confirmation Modal
  const openWhatsAppConfirmation = (item: UdhaarEntry) => {
    const { pendingDue } = computeCustomerBalances(item);
    if (pendingDue <= 0) return;

    const cleanPhone = item.phone ? (item.phone.length === 10 ? `91${item.phone}` : item.phone) : '';
    const bizName = user?.business_name || (businessContext?.name as any)?.[language] || "our business";

    let msg = "";
    if (language === 'mr') {
      msg = `नमस्कार ${item.customerName} ताई/भाऊ, आपल्या ${bizName} कडील ₹${pendingDue} ची उधारी बाकी आहे. कृपया लवकरात लवकर द्यावी. धन्यवाद!`;
    } else if (language === 'hi') {
      msg = `नमस्ते ${item.customerName} जी, आपके ${bizName} का ₹${pendingDue} का उधार बाकी है। कृपया शीघ्र भुगतान करने का कष्ट करें। धन्यवाद!`;
    } else {
      msg = `Hello ${item.customerName}, this is a gentle reminder that ₹${pendingDue} is pending for your purchase at ${bizName}. Please clear the due at your convenience. Thank you!`;
    }

    setWhatsAppModalData({
      entry: item,
      phone: cleanPhone,
      message: msg
    });
  };

  const confirmAndSendWhatsApp = () => {
    if (!whatsAppModalData) return;
    const { phone, message } = whatsAppModalData;
    const url = phone 
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
    setWhatsAppModalData(null);
  };

  // Smart Khata Check Calculations
  const findDuplicates = () => {
    const duplicates: Array<{ item: UdhaarEntry; reason: string }> = [];
    const seen = new Map<string, string>();

    entries.forEach(e => {
      const key = `${e.customerName.trim().toLowerCase()}_${e.totalUdhaar}_${e.date}`;
      if (seen.has(key)) {
        duplicates.push({
          item: e,
          reason: `Possible duplicate: ${e.customerName} (₹${e.totalUdhaar}) on ${e.date}`
        });
      } else {
        seen.set(key, e.id);
      }
    });

    return duplicates;
  };

  const duplicateEntries = findDuplicates();

  return (
    <div className="p-4 md:p-8 space-y-7">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <span>🤝 Customer Credit Tracking</span>
            </span>

            {/* WhatsApp Business API Integration Status Badge */}
            <button
              onClick={() => setShowApiConfigModal(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition shadow-2xs"
              title="Click to view WhatsApp API credentials and integration guide"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>WhatsApp API: Demo Mode Active</span>
              <Info size={13} className="text-emerald-600 ml-0.5" />
            </button>
          </div>

          <h1 className="text-3xl font-extrabold text-brand-900 tracking-tight">
            {loc.udhaarTitle}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {loc.udhaarSubtitle}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => {
              setShowVoiceModal(true);
              setVoiceParsedData(null);
              setVoiceTranscript('');
            }}
            className="bg-brand-900 hover:bg-brand-800 text-white px-4 py-2.5 rounded-2xl font-extrabold text-xs flex items-center gap-2 shadow-md transition hover:scale-102 cursor-pointer"
            title="BoliKhata Voice Entry"
          >
            <Mic size={16} className="text-accent-400" />
            <span>बोली खाता (BoliKhata)</span>
          </button>

          <button
            onClick={() => setShowSmartCheckModal(true)}
            className="bg-white hover:bg-gray-50 text-brand-900 border border-gray-200 px-3.5 py-2.5 rounded-2xl font-extrabold text-xs flex items-center gap-2 shadow-2xs transition hover:scale-102 cursor-pointer"
            title="Smart Khata Check - Reconcile records"
          >
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>Smart Check</span>
            {disputedCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-accent-500 hover:bg-accent-600 text-white px-4 py-2.5 rounded-2xl font-extrabold text-xs flex items-center gap-2 shadow-lg transition hover:scale-102 cursor-pointer"
          >
            <Plus size={16} />
            <span>{loc.addNewUdhaar}</span>
          </button>
        </div>
      </div>


      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
            {loc.totalPendingUdhaar}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-600">
              ₹{totalPending.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
              Pending Dues
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
            {loc.totalCustomersOwing}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-brand-900">
              {pendingCustomersCount}
            </span>
            <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
              Customers
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
            {loc.recoveredThisMonth}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-green-600">
              ₹{totalRecovered.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              Settled
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Automatic WhatsApp
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600 flex items-center gap-1.5">
              <CheckCheck size={20} className="text-emerald-500" />
              <span>Active</span>
            </span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Auto-Receipts
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3.5 top-3.5 text-gray-400" />
          <input
            type="text"
            placeholder={loc.searchPlaceholder || "Search customer or notes..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-brand-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
          {(['pending', 'cleared', 'disputed', 'all'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition flex-1 sm:flex-initial cursor-pointer whitespace-nowrap ${
                filterType === type 
                  ? 'bg-white text-brand-900 shadow-xs' 
                  : 'text-gray-500 hover:text-brand-900'
              }`}
            >
              {type === 'pending' ? 'Pending Dues' : type === 'cleared' ? 'Cleared' : type === 'disputed' ? `Disputed (${disputedCount})` : 'All Customers'}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Cards List */}
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">No customer credit records found.</p>
          </div>
        ) : (
          filteredEntries.map(item => {
            const { totalCredit, verifiedRepaid, unverifiedUPI, pendingDue } = computeCustomerBalances(item);
            const isCleared = pendingDue <= 0;
            const isDisputed = item.verificationStatus === 'disputed';

            return (
              <div 
                key={item.id}
                className={`bg-white rounded-3xl p-5 border shadow-2xs hover:shadow-xs transition flex flex-col justify-between gap-4 group ${
                  isDisputed ? 'border-rose-300 bg-rose-50/20' : 'border-gray-200'
                }`}
              >
                {/* Upper Row: Details + Amounts + Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Customer Details */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-brand-900">
                        {item.customerName}
                      </h3>
                      
                      {isCleared && (
                        <span className="text-[10px] font-black bg-green-50 text-green-700 px-2 py-0.5 rounded-md border border-green-200">
                          Cleared
                        </span>
                      )}

                      {/* VoiceVerify Status Badge & Toggle */}
                      <button
                        onClick={() => {
                          const nextStatus = item.verificationStatus === 'disputed' ? 'verified' : 'disputed';
                          handleToggleVerificationStatus(item.id, nextStatus);
                        }}
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer transition ${
                          isDisputed 
                            ? 'bg-rose-100 text-rose-700 border-rose-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                        title="Click to toggle Verified / Disputed status"
                      >
                        {isDisputed ? (
                          <>
                            <AlertTriangle size={11} className="text-rose-600" />
                            <span>Disputed (वादग्रस्त)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={11} className="text-emerald-600" />
                            <span>Verified</span>
                          </>
                        )}
                      </button>

                      {/* WhatsApp Auto-Notice Badge */}
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCheck size={11} className="text-emerald-600" />
                        <span>Auto WhatsApp</span>
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 flex items-center gap-3 font-medium">
                      {item.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} className="text-gray-400" /> {item.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-gray-400" /> {item.date}
                      </span>
                    </p>

                    <p className="text-xs text-gray-600 italic bg-surface-50 px-2.5 py-1 rounded-lg border border-gray-150 inline-block">
                      "{item.notes}"
                    </p>
                  </div>

                  {/* Amounts & Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t md:border-t-0 pt-3 md:pt-0">
                    <div className="text-left md:text-right mr-3">
                      <span className="text-[11px] font-bold text-gray-400 block uppercase">
                        Total Credit: ₹{totalCredit} · Settled: ₹{verifiedRepaid}
                      </span>
                      <span className={`text-xl font-black ${isCleared ? 'text-green-600' : 'text-rose-600'}`}>
                        {isCleared ? "₹0 Due" : `₹${pendingDue.toLocaleString('en-IN')} Pending`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* VoiceVerify Readback Speaker Button */}
                      <button
                        onClick={() => triggerVoiceVerifyReadback(item.customerName, pendingDue, 'credit', item.verificationStatus)}
                        className="p-2 rounded-xl bg-gray-100 hover:bg-accent-100 text-brand-900 border border-gray-200 transition cursor-pointer"
                        title="VoiceVerify: Listen to Verification details"
                      >
                        <Volume2 size={16} className="text-accent-600" />
                      </button>

                      {!isCleared && (
                        <>
                          <button
                            onClick={() => openWhatsAppConfirmation(item)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                            title="Send WhatsApp Reminder"
                          >
                            <MessageSquare size={14} />
                            <span>WhatsApp</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedEntry(item);
                              setPayAmount(pendingDue.toString());
                              setShowPaymentModal(true);
                            }}
                            className="bg-brand-900 hover:bg-brand-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <IndianRupee size={14} />
                            <span>जमा (Pay)</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDeleteEntry(item.id)}
                        className="text-gray-400 hover:text-rose-600 p-2 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                        title="Delete Customer Entry"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Unverified UPI Payment Alert Banner if any */}
                {unverifiedUPI > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-900 font-semibold">
                      <Clock size={15} className="text-amber-600 shrink-0 animate-pulse" />
                      <span>
                        ₹{unverifiedUPI} UPI Payment received — Pending Provider Confirmation. (Not yet counted in settlement)
                      </span>
                    </div>

                    {/* Find the unverified UPI item and let shopkeeper confirm */}
                    {item.history.map((h, idx) => {
                      if (h.type === 'payment' && h.paymentStatus === 'unverified_upi') {
                        return (
                          <button
                            key={idx}
                            onClick={() => handleConfirmUPIPayment(item, idx)}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Check size={13} />
                            <span>Confirm UPI Webhook</span>
                          </button>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* WHATSAPP AUTOMATIC DELIVERY STATUS MODAL */}
      {whatsAppDeliveryModalData && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-gray-100 space-y-4">
            <button
              onClick={() => setWhatsAppDeliveryModalData(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCheck size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg text-brand-900">
                    WhatsApp Message Sent
                  </h3>
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    {whatsAppDeliveryModalData.badge || "Auto Dispatch"}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Delivery Status: <strong className="text-emerald-700">{whatsAppDeliveryModalData.delivery_status}</strong>
                </p>
              </div>
            </div>

            {/* Receipt / Message Preview */}
            <div className="bg-surface-50 border border-gray-200 rounded-2xl p-3.5 space-y-2">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                Dispatched Receipt Content:
              </span>
              <pre className="text-xs text-brand-900 font-sans whitespace-pre-wrap leading-relaxed">
                {whatsAppDeliveryModalData.message_preview}
              </pre>
            </div>

            {/* Delivery Metadata */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
              <div>Recipient: <strong>{whatsAppDeliveryModalData.recipient || 'Customer Phone'}</strong></div>
              <div>Receipt ID: <strong>{whatsAppDeliveryModalData.receipt_id}</strong></div>
            </div>

            {/* If recipient phone number is missing, prompt shopkeeper to enter it and dispatch */}
            {(!whatsAppDeliveryModalData.recipient || whatsAppDeliveryModalData.recipient === 'Customer Phone' || whatsAppDeliveryModalData.recipient.length < 10) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <Phone size={14} className="text-amber-700" />
                  <span>मोबाईल नंबर प्रविष्ट करा (Enter WhatsApp Mobile Number)</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  या ग्राहकाचा मोबाईल नंबर सेव्ह केलेला नाही. थेट WhatsApp पावती पाठवण्यासाठी १० अंकी नंबर टाका:
                </p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="उदा. 9822012345"
                    value={manualDeliveryPhone}
                    onChange={(e) => setManualDeliveryPhone(e.target.value)}
                    className="flex-1 bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs font-bold text-brand-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const clean = manualDeliveryPhone.replace(/\D/g, '');
                      if (clean.length < 10) {
                        alert("कृपया वैध १० अंकी मोबाईल नंबर टाका (Please enter a valid 10-digit mobile number)");
                        return;
                      }
                      // Update existing customer in entries
                      if (whatsAppDeliveryModalData.customer_name) {
                        const updated = entries.map(item => {
                          if (item.customerName.toLowerCase() === whatsAppDeliveryModalData.customer_name.toLowerCase()) {
                            return { ...item, phone: clean };
                          }
                          return item;
                        });
                        setEntries(updated);
                      }
                      // Resend WhatsApp notification
                      await sendWhatsAppNotification({
                        phone: clean,
                        type: whatsAppDeliveryModalData.notification_type || 'new_udhar',
                        customer_name: whatsAppDeliveryModalData.customer_name || 'Customer',
                        amount: whatsAppDeliveryModalData.amount || 0,
                        previous_balance: whatsAppDeliveryModalData.previous_balance || 0,
                        new_balance: whatsAppDeliveryModalData.new_balance || 0,
                        receipt_id: whatsAppDeliveryModalData.receipt_id
                      });
                      setManualDeliveryPhone('');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <Send size={12} />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setWhatsAppDeliveryModalData(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-2xl text-xs transition cursor-pointer"
              >
                Close
              </button>
              {whatsAppDeliveryModalData.wa_link && (
                <a
                  href={whatsAppDeliveryModalData.wa_link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <ExternalLink size={14} />
                  <span>Open WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP BUSINESS API INTEGRATION CONFIGURATION MODAL */}
      {showApiConfigModal && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative border border-gray-100 space-y-4">
            <button
              onClick={() => setShowApiConfigModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <MessageSquare size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-xl text-brand-900">
                  WhatsApp Business API Setup
                </h3>
                <p className="text-xs text-gray-500">
                  Automatic Udhar Notifications & Payment Receipts
                </p>
              </div>
            </div>

            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2 text-xs text-emerald-950">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <Sparkles size={15} />
                <span>Active Mode: Demo Mode Simulation Enabled</span>
              </div>
              <p>
                All new Udhar entries and payment receipts are automatically formatted and verified. In demo mode, receipts are generated instantly with live message previews and 1-click fallback links without requiring Meta API credits.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black text-brand-900 uppercase">
                Required Configuration for Meta Cloud API Background Dispatch:
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex justify-between items-center">
                  <span className="font-mono text-gray-700">WHATSAPP_API_TOKEN</span>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Optional in Demo</span>
                </div>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex justify-between items-center">
                  <span className="font-mono text-gray-700">WHATSAPP_PHONE_NUMBER_ID</span>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Optional in Demo</span>
                </div>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex justify-between items-center">
                  <span className="font-mono text-gray-700">WHATSAPP_BUSINESS_ACCOUNT_ID</span>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Optional in Demo</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowApiConfigModal(false)}
              className="w-full bg-brand-900 text-white font-bold py-3 rounded-2xl text-xs transition"
            >
              समजले (Got It)
            </button>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL WITH CASH VS UPI PROVIDER VERIFICATION */}
      {showPaymentModal && selectedEntry && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative border border-gray-100">
            <button
              onClick={() => { setShowPaymentModal(false); setSelectedEntry(null); }}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="font-extrabold text-xl text-brand-900 mb-1">
              Record Repayment (जमा)
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              For: <strong>{selectedEntry.customerName}</strong>
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={computeCustomerBalances(selectedEntry).pendingDue}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-surface-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-base outline-none focus:border-brand-500 font-black text-brand-900"
                />
              </div>

              {/* Payment Mode Selector: Cash vs UPI */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">
                  Payment Mode *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setPayMethod('cash'); setUpiStatus('verified'); }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                      payMethod === 'cash'
                        ? 'bg-brand-900 text-white border-brand-900 shadow-sm'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    <Banknote size={15} />
                    <span>Cash (रोख)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayMethod('upi')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                      payMethod === 'upi'
                        ? 'bg-brand-900 text-white border-brand-900 shadow-sm'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    <CreditCard size={15} />
                    <span>UPI (Online)</span>
                  </button>
                </div>
              </div>

              {/* Payment Status Label / UPI Provider Verification Toggle */}
              {payMethod === 'cash' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span className="font-bold">Cash Received — Shopkeeper Confirmed</span>
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-amber-50/70 border border-amber-200 rounded-2xl">
                  <span className="text-[11px] font-bold text-amber-900 block">
                    UPI Payment Provider Status:
                  </span>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer">
                      <input
                        type="radio"
                        name="upiStatus"
                        checked={upiStatus === 'verified'}
                        onChange={() => setUpiStatus('verified')}
                      />
                      <span>Confirmed by UPI Provider / Bank (Settled)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer">
                      <input
                        type="radio"
                        name="upiStatus"
                        checked={upiStatus === 'unverified_upi'}
                        onChange={() => setUpiStatus('unverified_upi')}
                      />
                      <span>Pending Provider Confirmation (Keep unsettled)</span>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">
                  Reference Note (उदा. GPay / PhonePe / UTR)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref #938210 or Cash Note"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full bg-surface-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-900 hover:bg-brand-800 text-white font-extrabold py-3 rounded-2xl text-sm transition shadow-md cursor-pointer mt-2"
              >
                Confirm Payment & Send WhatsApp Receipt
              </button>
            </form>
          </div>
        </div>
      )}

      {/* BOLIKHATA VOICE MODAL */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-gray-100 space-y-4">
            <button
              onClick={() => {
                stopVoiceRecording();
                setShowVoiceModal(false);
                setVoiceParsedData(null);
              }}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="font-extrabold text-xl text-brand-900 flex items-center gap-2">
              <Mic size={20} className="text-accent-500" />
              <span>बोली खाता (BoliKhata Voice Entry)</span>
            </h3>

            <p className="text-xs text-gray-500">
              उदा. <em>"सुनीताला ४०० रुपये उधार दिले"</em> किंवा <em>"सुनीताने २०० रुपये परत दिले"</em>
            </p>

            <div className="flex flex-col items-center justify-center p-5 bg-surface-50 rounded-2xl border border-gray-200 gap-3">
              <button
                type="button"
                onClick={isListening ? stopVoiceRecording : startVoiceRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition shadow-lg ${
                  isListening 
                    ? 'bg-rose-500 text-white animate-pulse ring-4 ring-rose-200' 
                    : 'bg-brand-900 hover:bg-brand-800 text-white'
                }`}
              >
                <Mic size={28} />
              </button>
              <span className="text-xs font-bold text-gray-700">
                {isListening ? "ऐकत आहे... (Listening)" : "बोलण्यासाठी दाबा (Tap to Speak)"}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase">चाचणी वाक्य (Quick Test):</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "सुनीताला ४०० रुपये उधार दिले",
                  "सुनीताने २०० रुपये परत दिले",
                  "५०० रुपयांची विक्री झाली",
                  "१०० रुपये चहा नाश्ता खर्च झाला"
                ].map((ph, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setVoiceTranscript(ph);
                      processBoliKhataSpeechText(ph);
                    }}
                    className="text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-brand-900 px-2.5 py-1 rounded-lg transition"
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>

            {voiceParsedData && (() => {
              const matchedCust = voiceParsedData.matchedExistingId
                ? entries.find(e => e.id === voiceParsedData.matchedExistingId)
                : findMatchingCustomer(voiceParsedData.customerName);

              const currentDue = matchedCust ? computeCustomerBalances(matchedCust).pendingDue : 0;
              const remainingAfterPayment = Math.max(0, currentDue - (voiceParsedData.amount || 0));
              const totalAfterCredit = currentDue + (voiceParsedData.amount || 0);

              return (
                <div className="p-4 bg-accent-50/60 border border-accent-200 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-brand-900 uppercase">
                      पडताळणी करा (VoiceVerify Review)
                    </span>
                    <div className="flex gap-1">
                      {(['credit', 'payment', 'sale', 'expense'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setVoiceParsedData({ ...voiceParsedData, type: t })}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md capitalize transition ${
                            voiceParsedData.type === t ? 'bg-brand-900 text-white' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {t === 'credit' ? 'उधार' : t === 'payment' ? 'जमा' : t === 'sale' ? 'विक्री' : 'खर्च'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Customer Selection or Name Input */}
                  {voiceParsedData.type === 'payment' ? (
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">
                        कोणत्या ग्राहकाचे पैसे जमा करायचे? (Customer To Deduct From) *
                      </label>
                      <select
                        value={voiceParsedData.matchedExistingId || matchedCust?.id || ''}
                        onChange={(e) => {
                          const chosen = entries.find(item => item.id === e.target.value);
                          if (chosen) {
                            setVoiceParsedData({
                              ...voiceParsedData,
                              matchedExistingId: chosen.id,
                              customerName: chosen.customerName,
                              phone: chosen.phone || voiceParsedData.phone
                            });
                          }
                        }}
                        className="w-full bg-white border border-emerald-300 rounded-lg p-2 font-bold text-brand-900 text-xs"
                      >
                        <option value="">-- ग्राहक निवडा (Select Customer) --</option>
                        {entries.map(e => {
                          const bal = computeCustomerBalances(e).pendingDue;
                          return (
                            <option key={e.id} value={e.id}>
                              {e.customerName} (₹{bal} बाकी) {e.phone ? `· 📱 ${e.phone}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">
                        नाव / तपशील (Customer Name / Item) *
                      </label>
                      <input
                        type="text"
                        value={voiceParsedData.customerName}
                        onChange={(e) => {
                          const newName = e.target.value;
                          const reMatch = findMatchingCustomer(newName);
                          setVoiceParsedData({ 
                            ...voiceParsedData, 
                            customerName: newName,
                            matchedExistingId: reMatch?.id,
                            phone: reMatch ? (reMatch.phone || voiceParsedData.phone) : voiceParsedData.phone
                          });
                        }}
                        className="w-full bg-white border border-gray-300 rounded-lg p-1.5 font-bold text-brand-900 text-xs"
                        placeholder="उदा. रमेश पाटील"
                      />
                    </div>
                  )}

                  {/* Mobile Number & Amount Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold block">
                        WhatsApp मोबाईल नंबर (Mobile Number)
                      </label>
                      <input
                        type="tel"
                        placeholder="उदा. 9822012345 (पावतीसाठी)"
                        value={voiceParsedData.phone || ''}
                        onChange={(e) => setVoiceParsedData({ ...voiceParsedData, phone: e.target.value })}
                        className="w-full bg-white border border-gray-300 rounded-lg p-1.5 font-bold text-brand-900 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 font-bold block">
                        रक्कम (₹ Amount) *
                      </label>
                      <input
                        type="number"
                        value={voiceParsedData.amount || ''}
                        onChange={(e) => setVoiceParsedData({ ...voiceParsedData, amount: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-gray-300 rounded-lg p-1.5 font-black text-brand-900 text-xs"
                      />
                    </div>
                  </div>

                  {/* Live Calculation Preview */}
                  {voiceParsedData.type === 'payment' && matchedCust && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-950 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-emerald-700 font-bold uppercase block">शिल्लक हिशोब (Repayment Impact)</span>
                        <span className="font-bold">{matchedCust.customerName}: </span>
                        <span>आधी बाकी: ₹{currentDue}</span>
                        <span className="text-emerald-700 font-black"> ➔ जमा: -₹{voiceParsedData.amount || 0}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 block">उर्वरित बाकी</span>
                        <span className="text-sm font-black text-brand-900">₹{remainingAfterPayment}</span>
                      </div>
                    </div>
                  )}

                  {voiceParsedData.type === 'credit' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-950 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-amber-800 font-bold uppercase block">नवीन उधारी (Credit Impact)</span>
                        <span>{matchedCust ? `आधी बाकी: ₹${currentDue}` : 'नवीन ग्राहक नोंद'}</span>
                        <span className="text-rose-600 font-black"> ➔ +₹{voiceParsedData.amount || 0}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 block">एकूण बाकी</span>
                        <span className="text-sm font-black text-rose-700">₹{totalAfterCredit}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => triggerVoiceVerifyReadback(voiceParsedData.customerName, voiceParsedData.amount, voiceParsedData.type)}
                      className="text-xs text-accent-700 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Volume2 size={14} />
                      <span>VoiceVerify ऐका</span>
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setVoiceParsedData(null);
                          setVoiceTranscript('');
                        }}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-xl font-bold text-xs cursor-pointer"
                      >
                        रद्द करा
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmVoiceUdhaar}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                      >
                        जतन करा (Save)
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SMART KHATA CHECK MODAL */}
      {showSmartCheckModal && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative border border-gray-100 space-y-5">
            <button
              onClick={() => setShowSmartCheckModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ShieldCheck size={26} />
              </div>
              <div>
                <h3 className="font-extrabold text-xl text-brand-900">
                  Smart Khata Check
                </h3>
                <p className="text-xs text-gray-500">
                  Automatic Ledger Audit & Duplicate Inconsistency Detector
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-surface-50 p-3 rounded-2xl border border-gray-200">
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Total Records</span>
                <span className="text-lg font-black text-brand-900">{entries.length}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Reconciled</span>
                <span className="text-lg font-black text-emerald-800">100%</span>
              </div>
              <div className="bg-rose-50 p-3 rounded-2xl border border-rose-200">
                <span className="text-[10px] font-bold text-rose-700 uppercase block">Disputes</span>
                <span className="text-lg font-black text-rose-800">{disputedCount}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-black text-brand-900 uppercase">Audit Findings:</span>
              {duplicateEntries.length > 0 ? (
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <span>Potential Duplicate Entries Detected ({duplicateEntries.length}):</span>
                  </div>
                  {duplicateEntries.map((dup, i) => (
                    <p key={i} className="pl-5 text-gray-600">• {dup.reason}</p>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>No duplicate customer transactions found. All entries are consistent.</span>
                </div>
              )}

              {disputedCount > 0 && (
                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-900 flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{disputedCount} customer entries currently marked as Disputed for review.</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowSmartCheckModal(false)}
              className="w-full bg-brand-900 text-white font-bold py-3 rounded-2xl text-xs shadow-md"
            >
              पूर्ण झाले (Done)
            </button>
          </div>
        </div>
      )}

      {/* MANUAL ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-gray-100">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="font-extrabold text-xl text-brand-900 mb-4">
              {loc.addNewUdhaar}
            </h3>

            <form onSubmit={handleAddUdhaar} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patil"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-surface-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9822012345"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-surface-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 500"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-surface-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-surface-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">
                  Notes / Items
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2 bags rice, oil bottle"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-surface-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-accent-500 hover:bg-accent-600 text-white font-extrabold py-3 rounded-2xl text-sm transition shadow-md cursor-pointer mt-2"
              >
                Save Record & Send WhatsApp Notice
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL REMINDER CONFIRMATION MODAL */}
      {whatsAppModalData && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-gray-100 space-y-4">
            <button
              onClick={() => setWhatsAppModalData(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <MessageSquare size={22} />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-brand-900">
                  Send WhatsApp Reminder
                </h3>
                <p className="text-xs text-gray-500">
                  {whatsAppModalData.entry.customerName} (₹{computeCustomerBalances(whatsAppModalData.entry).pendingDue} Due)
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-500 uppercase">Message Preview (संपादन करा):</label>
              <textarea
                value={whatsAppModalData.message}
                onChange={(e) => setWhatsAppModalData({ ...whatsAppModalData, message: e.target.value })}
                rows={4}
                className="w-full bg-surface-50 border border-gray-200 rounded-2xl p-3 text-xs leading-relaxed outline-none focus:border-brand-500 text-brand-900 font-medium"
              />
            </div>

            <p className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
              ℹ️ <strong>Consent Notice:</strong> Clicking confirm opens WhatsApp with this prefilled message. No automated background messages are dispatched without your explicit action.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setWhatsAppModalData(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-2xl text-xs transition"
              >
                रद्द करा (Cancel)
              </button>
              <button
                onClick={confirmAndSendWhatsApp}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Send size={14} />
                <span>Open WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
