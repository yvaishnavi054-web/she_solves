import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { locales } from '../lib/locales';
import { businessData } from '../lib/businessData';
import { api } from '../lib/api';
import { speechService } from '../lib/speechService';

export type Language = 'en' | 'hi' | 'mr';

export interface Transaction {
  id: number | string;
  type: 'sale' | 'expense';
  item: string;
  category?: string;
  quantity?: number;
  unit_price?: number;
  amount: number;
  date: string;
  source?: 'voice' | 'manual' | 'demo';
  raw_transcript?: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPercent: number;
  todayIncome: number;
  todayExpenses: number;
  todayProfit: number;
  thisWeekIncome: number;
  thisWeekExpenses: number;
  thisWeekProfit: number;
  thisMonthIncome: number;
  thisMonthExpenses: number;
  thisMonthProfit: number;
  activeDaysCount: number;
  transactionCount: number;
  recordConsistencyDays: number;
  monthlyBreakdown: Array<{
    month: string;
    income: number;
    expenses: number;
    profit: number;
  }>;
  categoryBreakdown: Array<{
    name: string;
    value: number;
  }>;
}

export interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  loc: typeof locales.en;
  user: any;
  setUser: (user: any) => void;
  businessContext: any;
  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction, 'id'>) => Promise<void>;
  addTransactions: (items: Omit<Transaction, 'id'>[]) => Promise<void>;
  deleteTransaction: (id: number | string) => Promise<void>;
  refreshTransactions: () => Promise<void>;
  loadDemoData: () => void;
  loadUserTransactions: (userId?: string | number, email?: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  financialSummary: FinancialSummary;
  speakText: (text: string, langOverride?: Language) => void;
  pauseSpeech: () => void;
  resumeSpeech: () => void;
  stopSpeech: () => void;
  updateBusinessType: (type: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Language persistence from localStorage
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("khata_lang");
    if (saved === 'mr' || saved === 'hi' || saved === 'en') return saved;
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("khata_lang", lang);
  };

  // 2. User & Demo Mode
  const [user, setUserState] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("khata_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setUser = (u: any) => {
    setUserState(u);
    if (u) {
      localStorage.setItem("khata_user", JSON.stringify(u));
    } else {
      localStorage.removeItem("khata_user");
    }
  };

  // Local browser date helper (e.g. 2026-10-06 in IST)
  const getLocalDateStr = (d = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const transactionsRef = useRef<Transaction[]>([]);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem("khata_is_demo") === "true";
  });

  // Local storage helper key for persistent transactions
  const getUserTxnKey = useCallback((currentUser: any) => {
    if (!currentUser) return "khata_txns_guest";
    return `khata_txns_${currentUser.email || currentUser.id || "default"}`;
  }, []);

  // Fetch transactions from backend and sync with persistent local cache
  const loadUserTransactions = useCallback(async (userId?: string | number, userEmail?: string) => {
    const activeKey = userEmail ? `khata_txns_${userEmail}` : (user ? getUserTxnKey(user) : "khata_txns_guest");
    
    // First read from local cache so user immediately sees their records
    const cached = localStorage.getItem(activeKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          transactionsRef.current = parsed;
          setTransactions(parsed);
        }
      } catch (e) {
        console.warn("Cached txns parse failed", e);
        transactionsRef.current = [];
        setTransactions([]);
      }
    } else {
      // Clear in-memory transactions so fresh users or other accounts don't show old user's data
      transactionsRef.current = [];
      setTransactions([]);
    }

    // Then attempt backend fetch if token exists
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const remoteTxns = await api.getTransactions();
        if (Array.isArray(remoteTxns)) {
          transactionsRef.current = remoteTxns;
          setTransactions(remoteTxns);
          localStorage.setItem(activeKey, JSON.stringify(remoteTxns));
        }
      } catch (err) {
        console.warn("Remote transaction fetch failed, relying on local cache:", err);
      }
    }
  }, [user, getUserTxnKey]);

  const refreshTransactions = useCallback(async () => {
    await loadUserTransactions(user?.id, user?.email);
  }, [loadUserTransactions, user]);

  // Initial Auth Boot
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      const isDemo = localStorage.getItem("khata_is_demo") === "true";

      if (isDemo) {
        loadDemoData();
        setIsLoading(false);
        return;
      }

      if (token) {
        try {
          const userData = await api.getMe();
          setUser(userData);
          if (userData.language && (userData.language === 'mr' || userData.language === 'hi' || userData.language === 'en')) {
            setLanguageState(userData.language as Language);
          }
          await loadUserTransactions(userData.id, userData.email);
        } catch (e) {
          console.warn("Auto-login token expired or offline", e);
          // Don't wipe local user immediately if offline
          if (user) {
            await loadUserTransactions(user.id, user.email);
          }
        }
      } else if (user) {
        await loadUserTransactions(user.id, user.email);
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const loc = locales[language] || locales.en;

  // Business Context state & switcher
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>(() => {
    return localStorage.getItem("khata_biz_type") || "";
  });

  const updateBusinessType = (newType: string) => {
    setSelectedBusinessType(newType);
    localStorage.setItem("khata_biz_type", newType);
    if (user) {
      const updated = { ...user, business_type: newType };
      setUser(updated);
    }
  };

  // If logged in, prioritize user's actual registered business profile
  // selectedBusinessType is only for previewing other trade examples
  const currentType = (user && user.business_type) || selectedBusinessType || 'Tiffin';
  
  const typeMapping: Record<string, string> = {
    'Tiffin Service': 'Tiffin',
    'Tiffin': 'Tiffin',
    'Tailoring': 'Tailoring',
    'Tailoring & Boutique': 'Tailoring',
    'Home Bakery': 'Bakery',
    'Bakery': 'Bakery',
    'Beauty / Parlour': 'Parlour',
    'Parlour': 'Parlour',
    'Handicrafts': 'Handicrafts',
    'Handicrafts & Art': 'Handicrafts',
    'Small Shop': 'Tiffin'
  };

  const mapped = typeMapping[currentType] || currentType;
  let businessContext: any;
  if (businessData[mapped]) {
    businessContext = businessData[mapped];
  } else {
    // Dynamic context for custom business types entered by user (e.g. Dairy, Kirana, Poultry)
    businessContext = {
      id: currentType,
      name: { en: currentType, hi: currentType, mr: currentType },
      icon: "🏪",
      categories: {
        sales: [`${currentType} Sales`, "Direct Sales", "Daily Orders", "Bulk Orders"],
        expenses: ["Stock / Raw Material", "Utilities", "Rent & Space", "Transport", "Supplies", "Daily Expenses"]
      },
      examples: {
        en: `Say: "Sold items of ${currentType} for ₹800. Spent ₹300 on supplies."`,
        hi: `बोलें: "आज ${currentType} की ₹800 की बिक्री हुई. ₹300 का खर्च हुआ."`,
        mr: `बोला: "आज ${currentType} ची ₹800 ची विक्री झाली. ₹300 चा खर्च झाला."`
      },
      marginData: {
        product: { en: `1 Unit ${currentType}`, hi: `1 यूनिट ${currentType}`, mr: `१ नग ${currentType}` },
        sellingPrice: 100,
        estimatedCost: 50,
        marginText: { en: "50% Margin", hi: "50% मार्जिन", mr: "50% नफा" }
      }
    };
  }

  // Deterministic Batch Add Transactions (Atomic & Closure-Safe)
  const addTransactions = async (items: Omit<Transaction, 'id'>[]) => {
    if (!items || items.length === 0) return;

    const newEntries: Transaction[] = items.map(t => ({
      ...t,
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      amount: Math.round(Number(t.amount) * 100) / 100,
      date: t.date || getLocalDateStr()
    }));

    // Update state and ref immediately with ALL new entries at once
    const updated = [...newEntries, ...transactionsRef.current];
    transactionsRef.current = updated;
    setTransactions(updated);

    const key = getUserTxnKey(user);
    localStorage.setItem(key, JSON.stringify(updated));

    if (!isDemoMode && localStorage.getItem("token")) {
      try {
        for (const entry of newEntries) {
          const res = await api.addTransaction({
            type: entry.type,
            category: entry.category || entry.item,
            description: entry.item,
            quantity: entry.quantity,
            unit_price: entry.quantity ? Math.round((entry.amount / entry.quantity) * 100) / 100 : null,
            amount: entry.amount,
            transaction_date: entry.date,
            source: entry.source || 'voice',
            raw_transcript: entry.raw_transcript
          });
          if (res && res.id) {
            transactionsRef.current = transactionsRef.current.map(it => it.id === entry.id ? { ...it, id: res.id } : it);
          }
        }
        setTransactions([...transactionsRef.current]);
        localStorage.setItem(key, JSON.stringify(transactionsRef.current));
      } catch (e) {
        console.warn("Backend add sync failed; persistent local storage preserved.", e);
      }
    }
  };

  // Deterministic Add Single Transaction
  const addTransaction = async (t: Omit<Transaction, 'id'>) => {
    await addTransactions([t]);
  };

  // Deterministic Delete Transaction
  const deleteTransaction = async (id: number | string) => {
    const updated = transactionsRef.current.filter(t => t.id !== id);
    transactionsRef.current = updated;
    setTransactions(updated);

    const key = getUserTxnKey(user);
    localStorage.setItem(key, JSON.stringify(updated));

    if (!isDemoMode && typeof id === 'number' && localStorage.getItem("token")) {
      try {
        await api.deleteTransaction(id);
      } catch (e) {
        console.warn("Backend delete sync failed", e);
      }
    }
  };

  // Demo Data Generator (Meena Tai - 90 Days)
  const loadDemoData = () => {
    setIsDemoMode(true);
    localStorage.setItem("khata_is_demo", "true");
    
    const demoUser = {
      id: 999,
      name: "Meena Tai",
      business_name: "Meena Tiffin Center (Pune)",
      business_type: "Tiffin Service",
      language: "mr"
    };
    setUser(demoUser);

    const now = new Date();
    const demoTx: Transaction[] = [];

    // Realistic Pune Tiffin history across 90 days
    for (let dayOffset = 90; dayOffset >= 0; dayOffset--) {
      const curDate = new Date(now);
      curDate.setDate(curDate.getDate() - dayOffset);
      const dateStr = curDate.toISOString().split('T')[0];

      // Sunday has catering or slightly lower daily tiffins
      const isSunday = curDate.getDay() === 0;
      
      // Sales
      const tiffinsSold = isSunday ? 12 : Math.floor(Math.random() * 8) + 16; // 16 to 24 tiffins
      const unitRate = 70;
      const salesAmt = tiffinsSold * unitRate;

      demoTx.push({
        id: `demo_sale_${dayOffset}`,
        type: 'sale',
        item: `${tiffinsSold} × डबे / Tiffins (₹70 each)`,
        category: 'Meals',
        quantity: tiffinsSold,
        unit_price: unitRate,
        amount: salesAmt,
        date: dateStr,
        source: 'voice',
        raw_transcript: `आज ${tiffinsSold} डबे 70 रुपयांना विकले.`
      });

      // Daily vegetable expense
      const vegAmt = Math.floor(Math.random() * 200) + 450; // 450 to 650
      demoTx.push({
        id: `demo_veg_${dayOffset}`,
        type: 'expense',
        item: 'भाजीपाला / Vegetables',
        category: 'Grocery',
        amount: vegAmt,
        date: dateStr,
        source: 'voice',
        raw_transcript: `भाजीसाठी ${vegAmt} रुपये खर्च झाले.`
      });

      // Weekly grain/gas expense
      if (dayOffset % 7 === 2) {
        const grainAmt = Math.floor(Math.random() * 300) + 700;
        demoTx.push({
          id: `demo_grain_${dayOffset}`,
          type: 'expense',
          item: 'गहू व तांदूळ / Wheat & Rice',
          category: 'Grocery',
          amount: grainAmt,
          date: dateStr,
          source: 'voice'
        });
      }

      if (dayOffset % 25 === 5) {
        demoTx.push({
          id: `demo_gas_${dayOffset}`,
          type: 'expense',
          item: 'गॅस सिलिंडर / Gas Cylinder Refill',
          category: 'Utilities',
          amount: 1100,
          date: dateStr,
          source: 'manual'
        });
      }
    }

    demoTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(demoTx);
    localStorage.setItem("khata_txns_demo", JSON.stringify(demoTx));
  };

  // Safe Logout: Clears current active session, keeps DB and local storage safe!
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("khata_user");
    localStorage.removeItem("khata_is_demo");
    setUserState(null);
    setTransactions([]);
    setIsDemoMode(false);
  };

  // 3. Deterministic Financial Calculator
  const localToday = getLocalDateStr();
  const utcToday = new Date().toISOString().split('T')[0];
  const currentMonthIdx = new Date().getMonth();
  const currentYearVal = new Date().getFullYear();

  let totalIncome = 0;
  let totalExpenses = 0;
  let todayIncome = 0;
  let todayExpenses = 0;
  let thisWeekIncome = 0;
  let thisWeekExpenses = 0;
  let thisMonthIncome = 0;
  let thisMonthExpenses = 0;

  const nowTime = new Date();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const weekStart = new Date(nowTime.getTime() - 6 * MS_PER_DAY);
  weekStart.setHours(0, 0, 0, 0);

  const activeDatesSet = new Set<string>();
  const categoryTotals: Record<string, number> = {};
  const monthBuckets: Record<string, { income: number; expenses: number; profit: number }> = {};

  transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    const isSale = t.type?.toLowerCase() === 'sale' || t.type?.toLowerCase() === 'income';
    const tDate = t.date ? t.date.slice(0, 10) : localToday;
    const dateObj = new Date(tDate + 'T00:00:00');

    // Track active days
    activeDatesSet.add(tDate);

    // Totals
    if (isSale) {
      totalIncome += amt;
    } else {
      totalExpenses += amt;
      const cat = t.category || 'General Expense';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    }

    // Today (matches local date e.g. IST or UTC date)
    if (tDate === localToday || tDate === utcToday) {
      if (isSale) todayIncome += amt;
      else todayExpenses += amt;
    }

    // This Week (last 7 rolling days)
    if (dateObj >= weekStart && dateObj <= nowTime) {
      if (isSale) thisWeekIncome += amt;
      else thisWeekExpenses += amt;
    }

    // This Month
    if (dateObj.getMonth() === currentMonthIdx && dateObj.getFullYear() === currentYearVal) {
      if (isSale) thisMonthIncome += amt;
      else thisMonthExpenses += amt;
    }

    // Month Buckets for trends
    const monthKey = `${dateObj.toLocaleString('en-US', { month: 'short' })} ${dateObj.getFullYear()}`;
    if (!monthBuckets[monthKey]) {
      monthBuckets[monthKey] = { income: 0, expenses: 0, profit: 0 };
    }
    if (isSale) {
      monthBuckets[monthKey].income += amt;
    } else {
      monthBuckets[monthKey].expenses += amt;
    }
    monthBuckets[monthKey].profit = monthBuckets[monthKey].income - monthBuckets[monthKey].expenses;
  });

  const netProfit = totalIncome - totalExpenses;
  const profitMarginPercent = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 1000) / 10 : 0;
  const todayProfit = todayIncome - todayExpenses;
  const thisWeekProfit = thisWeekIncome - thisWeekExpenses;
  const thisMonthProfit = thisMonthIncome - thisMonthExpenses;

  // Monthly breakdown array (sorted chronologically)
  const monthlyBreakdown = Object.entries(monthBuckets).map(([month, data]) => ({
    month,
    income: Math.round(data.income),
    expenses: Math.round(data.expenses),
    profit: Math.round(data.profit)
  })).slice(-4); // Last 4 months

  // Category breakdown array for pie chart
  const categoryBreakdown = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value: Math.round(value)
  })).sort((a, b) => b.value - a.value);

  // Consistency count this month
  const thisMonthDaysRecorded = Array.from(activeDatesSet).filter(d => {
    const dObj = new Date(d);
    return dObj.getMonth() === currentMonthIdx && dObj.getFullYear() === currentYearVal;
  }).length;

  const financialSummary: FinancialSummary = {
    totalIncome: Math.round(totalIncome),
    totalExpenses: Math.round(totalExpenses),
    netProfit: Math.round(netProfit),
    profitMarginPercent,
    todayIncome: Math.round(todayIncome),
    todayExpenses: Math.round(todayExpenses),
    todayProfit: Math.round(todayProfit),
    thisWeekIncome: Math.round(thisWeekIncome),
    thisWeekExpenses: Math.round(thisWeekExpenses),
    thisWeekProfit: Math.round(thisWeekProfit),
    thisMonthIncome: Math.round(thisMonthIncome),
    thisMonthExpenses: Math.round(thisMonthExpenses),
    thisMonthProfit: Math.round(thisMonthProfit),
    activeDaysCount: activeDatesSet.size,
    transactionCount: transactions.length,
    recordConsistencyDays: thisMonthDaysRecorded || (isDemoMode ? 24 : activeDatesSet.size),
    monthlyBreakdown,
    categoryBreakdown
  };

  // 4. Web Speech Synthesis Audio Assistant via Universal SpeechService
  const speakText = (text: string, langOverride?: Language) => {
    speechService.speak(text, (langOverride || language) as 'mr' | 'hi' | 'en');
  };

  const pauseSpeech = () => speechService.pause();
  const resumeSpeech = () => speechService.resume();
  const stopSpeech = () => speechService.stop();

  return (
    <AppContext.Provider value={{
      language,
      setLanguage,
      loc,
      user,
      setUser,
      businessContext,
      transactions,
      addTransaction,
      addTransactions,
      deleteTransaction,
      refreshTransactions,
      loadDemoData,
      loadUserTransactions,
      logout,
      isLoading,
      isDemoMode,
      setIsDemoMode,
      financialSummary,
      speakText,
      pauseSpeech,
      resumeSpeech,
      stopSpeech,
      updateBusinessType
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};
