import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { 
  ArrowRight, Mic, Plus, TrendingUp, Calendar, CheckCircle2, 
  ChevronRight, X, AlertCircle, Sparkles, Building2, HelpCircle, 
  Volume2, Share2, Flame, Users, BookOpen, Landmark, FileText, Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CreditJourneyStepper } from '../components/CreditJourneyStepper';
import { businessData } from '../lib/businessData';
import { AudioSpeakerButton } from '../components/AudioSpeakerButton';
import { generateDynamicAlerts, FinancialAlert } from '../lib/alertEngine';
import { UdhaarEntry } from './UdhaarKhata';

export default function Dashboard() {
  const { 
    loc, user, businessContext, transactions, isLoading, 
    financialSummary, addTransaction, language, updateBusinessType, speakText,
    refreshTransactions 
  } = useAppContext();
  const navigate = useNavigate();

  // Refresh latest transactions from database on dashboard mount
  useEffect(() => {
    refreshTransactions();
  }, [refreshTransactions]);

  // Manual Add Modal State
  const [showManualModal, setShowManualModal] = useState(false);
  const [modalType, setModalType] = useState<'sale' | 'expense'>('sale');
  const [modalItem, setModalItem] = useState('');
  const [modalCategory, setModalCategory] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalQuantity, setModalQuantity] = useState('1');
  const [modalDate, setModalDate] = useState(new Date().toISOString().split('T')[0]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500 font-medium">{loc.loading}</div>;
  }

  const {
    todayIncome,
    todayExpenses,
    todayProfit,
    thisWeekIncome,
    thisWeekExpenses,
    thisWeekProfit,
    thisMonthIncome,
    thisMonthExpenses,
    thisMonthProfit,
    profitMarginPercent,
    recordConsistencyDays,
    monthlyBreakdown,
    categoryBreakdown,
    activeDaysCount
  } = financialSummary;

  // Streak calculation
  const hasTodayEntry = todayIncome > 0 || todayExpenses > 0;
  const streakDays = recordConsistencyDays > 0 ? recordConsistencyDays : (hasTodayEntry ? 1 : 0);

  // Chart data from deterministic monthly breakdown
  const chartData = monthlyBreakdown.length > 0 ? monthlyBreakdown : [
    { month: 'Month 1', income: 24000, expenses: 14000, profit: 10000 },
    { month: 'Month 2', income: 28000, expenses: 15500, profit: 12500 },
    { month: 'Month 3', income: 32000, expenses: 16800, profit: 15200 },
  ];

  // Dynamic Insights calculation
  const topExpenseCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0].name : 'Supplies & Groceries';
  const hasGoodConsistency = recordConsistencyDays >= 12;

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(modalAmount);
    if (!amt || amt <= 0 || !modalItem.trim()) return;

    await addTransaction({
      type: modalType,
      item: modalItem.trim(),
      category: modalCategory || (modalType === 'sale' ? 'Sales' : 'General'),
      quantity: modalType === 'sale' ? parseInt(modalQuantity) || 1 : undefined,
      amount: amt,
      date: modalDate,
      source: 'manual'
    });

    setShowManualModal(false);
    setModalItem('');
    setModalAmount('');
  };

  const speakTodaySummary = () => {
    let text = "";
    if (language === 'mr') {
      text = `आजचे उत्पन्न ₹${todayIncome}, खर्च ₹${todayExpenses}, आणि नफा ₹${todayProfit}.`;
    } else if (language === 'hi') {
      text = `आज की कुल आय ₹${todayIncome}, खर्च ₹${todayExpenses}, और शुद्ध लाभ ₹${todayProfit} है।`;
    } else {
      text = `Today's income is ₹${todayIncome}, expenses are ₹${todayExpenses}, and net profit is ₹${todayProfit}.`;
    }
    speakText(text, language);
  };

  const shareToWhatsapp = () => {
    const text = `*Khata se Credit Tak - 3-Month Financial Track Record*\n` +
      `Business: ${user?.business_name || (businessContext.name as any)?.[language] || "Micro-Enterprise"} (${businessContext.id})\n` +
      `Owner: ${user?.name || "Entrepreneur"}\n` +
      `Total Recorded Income: ₹${financialSummary.totalIncome.toLocaleString('en-IN')}\n` +
      `Total Recorded Expenses: ₹${financialSummary.totalExpenses.toLocaleString('en-IN')}\n` +
      `Net Operational Profit: ₹${financialSummary.netProfit.toLocaleString('en-IN')} (${profitMarginPercent}% margin)\n` +
      `Active Days: ${recordConsistencyDays} business days documented\n\n` +
      `Organized business record for bank and government scheme preparation. (Not a credit score)`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Empty state if user has no transactions yet
  if (transactions.length === 0) {
    return (
      <div className="p-4 md:p-8 min-h-[80vh] flex flex-col justify-center items-center text-center">
        <div className="w-20 h-20 bg-rose-50 text-accent-500 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-rose-100">
          <Mic size={38} />
        </div>
        <h1 className="text-3xl font-extrabold mb-2 text-brand-900 tracking-tight">
          {loc.greeting}, {user?.name || "Tai"} 👋
        </h1>
        <p className="text-gray-500 text-base mb-8 max-w-md">
          {loc.dashboardSubtitle} {loc.recordVoicePrompt}
        </p>
        
        <button 
          onClick={() => navigate('/app/voice')}
          className="bg-accent-500 hover:bg-accent-600 text-white w-36 h-36 rounded-full flex flex-col items-center justify-center shadow-2xl transition-transform hover:scale-105 mb-8 cursor-pointer group"
        >
          <Mic size={44} className="group-hover:scale-110 transition-transform" />
          <span className="text-xs font-black mt-2 tracking-wider uppercase">BOLO</span>
        </button>

        <h3 className="font-extrabold text-xl text-brand-900 mb-2">
          {loc.recordVoiceCTA}
        </h3>
        <p className="text-gray-500 mb-8 max-w-sm text-sm">
          {businessContext?.examples?.[language] || businessContext?.examples?.en}
        </p>
        
        <button 
          onClick={() => setShowManualModal(true)}
          className="text-brand-900 font-bold flex items-center gap-2 hover:bg-gray-100 px-5 py-3 rounded-2xl transition border border-gray-200 cursor-pointer"
        >
          <Plus size={18} /> {loc.quickAddManual}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Top Banner with Business Identity, Daily Streak & Big Voice CTA */}
      <div className="bg-gradient-to-r from-brand-900 via-slate-900 to-brand-950 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:justify-between md:items-center relative overflow-hidden gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="inline-flex items-center gap-1.5 bg-white/10 text-accent-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <span>{businessContext.icon}</span>
              <span>{user?.business_name || (businessContext.name as any)?.[language] || "Business Profile"}</span>
            </div>

            {/* Daily Streak Badge */}
            <div className="inline-flex items-center gap-1.5 bg-amber-500/25 border border-amber-400/40 text-amber-300 px-3 py-1 rounded-full text-xs font-extrabold">
              <Flame size={14} className="text-amber-400 fill-amber-400 animate-pulse" />
              <span>{streakDays} {loc.streakDays || "days streak"}</span>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {loc.greeting}, {user?.name} 👋
          </h1>
          <p className="text-gray-300 text-sm mt-1 max-w-md">
            {loc.dashboardSubtitle}
          </p>
        </div>

        {/* Big Bolo Voice CTA Button */}
        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={() => navigate('/app/voice')}
            className="flex items-center gap-3 bg-accent-500 hover:bg-accent-600 text-white px-7 py-4 rounded-2xl font-black text-base transition shadow-2xl hover:scale-105 cursor-pointer ring-4 ring-accent-400/30"
          >
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Mic size={24} className="animate-pulse" />
            </div>
            <div className="text-left">
              <span className="block text-xs uppercase tracking-wider font-extrabold opacity-90">{loc.recordVoiceCTA}</span>
              <span className="text-sm font-black">BOLO (Tap to Speak)</span>
            </div>
          </button>

          <button
            onClick={() => setShowManualModal(true)}
            className="bg-white/10 hover:bg-white/20 text-white p-4 rounded-2xl transition border border-white/10 cursor-pointer"
            title={loc.quickAddManual}
          >
            <Plus size={22} />
          </button>
        </div>
      </div>

      {/* DAILY NUDGE BANNER: "Aaj ka khata baaki hai" OR "Aaj ka khata purna hua" */}
      {!hasTodayEntry ? (
        <div className="bg-amber-50 border-2 border-amber-300/80 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3 text-left w-full sm:w-auto">
            <div className="w-11 h-11 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center text-xl shrink-0">
              ⏳
            </div>
            <div>
              <h3 className="font-extrabold text-amber-950 text-sm sm:text-base">
                {loc.nudgeKhataPending || "आजचा हिशोब बाकी आहे (Aaj ka khata baaki hai)"}
              </h3>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                {language === 'mr' 
                  ? "आजची कमाई आणि खर्च नोंदवा जेणेकरून तुमचे सातत्य टिकून राहील." 
                  : language === 'hi' 
                  ? "आज की आमदनी और खर्च रिकॉर्ड करें ताकि आपका 3 महीने का रिकॉर्ड मजबूत रहे।" 
                  : "Record today's sales and expenses now to maintain your daily streak."}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/app/voice')}
            className="w-full sm:w-auto bg-brand-900 hover:bg-brand-800 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shrink-0 shadow-sm transition cursor-pointer"
          >
            <Mic size={15} /> {loc.recordVoiceCTA}
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs font-semibold text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{loc.nudgeKhataDone || "आजचा हिशोब पूर्ण झाला! उत्कृष्ट सातत्य."}</span>
          </div>
          <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-black">
            +₹{todayIncome.toLocaleString('en-IN')}
          </span>
        </div>
      )}

      {/* QUICK SHORTCUTS GRID */}
      <div className="space-y-2.5">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-extrabold text-sm text-gray-400 uppercase tracking-wider">
            {loc.quickLinksTitle || "Quick Shortcuts"}
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* 1. Voice Khata */}
          <button
            onClick={() => navigate('/app/voice')}
            className="bg-white hover:bg-accent-50/50 p-3.5 rounded-2xl border border-gray-200 hover:border-accent-300 transition text-left flex flex-col justify-between group cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-accent-100 text-accent-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Mic size={18} />
            </div>
            <div>
              <p className="font-extrabold text-xs text-brand-900">{loc.navKhata || "Bolo Khata"}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Record Hisaab</p>
            </div>
          </button>

          {/* 2. Ledger */}
          <button
            onClick={() => navigate('/app/ledger')}
            className="bg-white hover:bg-blue-50/50 p-3.5 rounded-2xl border border-gray-200 hover:border-blue-300 transition text-left flex flex-col justify-between group cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <BookOpen size={18} />
            </div>
            <div>
              <p className="font-extrabold text-xs text-brand-900">{loc.navTransactions || "Roznama"}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">All Transactions</p>
            </div>
          </button>

          {/* 3. Udhaar Khata */}
          <button
            onClick={() => navigate('/app/udhaar')}
            className="bg-white hover:bg-purple-50/50 p-3.5 rounded-2xl border border-gray-200 hover:border-purple-300 transition text-left flex flex-col justify-between group cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Users size={18} />
            </div>
            <div>
              <p className="font-extrabold text-xs text-brand-900">{loc.navUdhaar || "Udhaar Khata"}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Customer Dues</p>
            </div>
          </button>

          {/* 4. Profit & Margins */}
          <button
            onClick={() => navigate('/app/insights')}
            className="bg-white hover:bg-amber-50/50 p-3.5 rounded-2xl border border-gray-200 hover:border-amber-300 transition text-left flex flex-col justify-between group cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="font-extrabold text-xs text-brand-900">{loc.navInsights || "Margins"}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">{profitMarginPercent}% Margin</p>
            </div>
          </button>

          {/* 5. Govt Schemes */}
          <button
            onClick={() => navigate('/app/schemes')}
            className="bg-white hover:bg-emerald-50/50 p-3.5 rounded-2xl border border-gray-200 hover:border-emerald-300 transition text-left flex flex-col justify-between group cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Landmark size={18} />
            </div>
            <div>
              <p className="font-extrabold text-xs text-brand-900">{loc.navSchemes || "Yojana"}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Mudra, Stand-Up</p>
            </div>
          </button>

          {/* 6. Bank Statement */}
          <button
            onClick={() => navigate('/app/readiness')}
            className="bg-white hover:bg-rose-50/50 p-3.5 rounded-2xl border border-gray-200 hover:border-rose-300 transition text-left flex flex-col justify-between group cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <FileText size={18} />
            </div>
            <div>
              <p className="font-extrabold text-xs text-brand-900">{loc.navReadiness || "Statement"}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">Bank-Ready PDF</p>
            </div>
          </button>
        </div>
      </div>

      {/* DEDICATED SELECTED BUSINESS BADGE & DETAILS */}
      <div className="bg-white p-4.5 rounded-3xl shadow-xs border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all duration-200 hover:shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-900 border border-brand-100 flex items-center justify-center text-xl shrink-0 shadow-2xs">
            {businessContext.icon || "🏪"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                {language === 'mr' ? 'निवडलेला व्यवसाय' : language === 'hi' ? 'चयनित व्यवसाय' : 'Active Business'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {language === 'mr' ? 'सक्रिय' : language === 'hi' ? 'सक्रिय' : 'Active'}
              </span>
            </div>
            <h3 className="font-extrabold text-base text-brand-900 mt-0.5">
              {user?.business_name || (businessContext.name as any)?.[language] || businessContext.name?.en || businessContext.id}
              <span className="text-xs font-semibold text-gray-500 ml-2">
                • {businessContext.name?.[language] || businessContext.name?.en || businessContext.id}
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto bg-gray-50 px-3.5 py-2 rounded-2xl border border-gray-200/80">
          <span className="text-xs font-bold text-gray-600">
            {businessContext.categories?.sales?.[0] || 'Direct Sales'}
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-[11px] font-medium text-gray-500">
            {user?.location || 'Local Store'}
          </span>
        </div>
      </div>

      {/* TODAY'S METRICS */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-extrabold text-xl text-brand-900 tracking-tight flex items-center gap-2">
              <span>{loc.todaySales} & {loc.todayExpenses}</span>
            </h2>
            <button
              onClick={speakTodaySummary}
              className="flex items-center gap-1 text-[11px] font-bold text-accent-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-100 transition cursor-pointer"
              title="Listen to today's numbers"
            >
              <Volume2 size={13} />
              <span>{language === 'mr' ? 'ऐका' : language === 'hi' ? 'सुनें' : 'Listen'}</span>
            </button>
          </div>
          <span className="text-xs text-gray-500 font-semibold bg-gray-100 px-3 py-1 rounded-full">
            {new Date().toLocaleDateString(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard 
            title={loc.todaySales} 
            amount={todayIncome} 
            type="income" 
            speechText={language === 'mr' ? `आजचे उत्पन्न ₹${todayIncome} आहे.` : language === 'hi' ? `आज की कुल आय ₹${todayIncome} है।` : `Today's income is ₹${todayIncome}.`}
          />
          <StatCard 
            title={loc.todayExpenses} 
            amount={todayExpenses} 
            type="expense" 
            speechText={language === 'mr' ? `आजचा एकूण खर्च ₹${todayExpenses} आहे.` : language === 'hi' ? `आज का कुल खर्च ₹${todayExpenses} है।` : `Today's total expenses are ₹${todayExpenses}.`}
          />
          <StatCard 
            title={loc.todayProfit} 
            amount={todayProfit} 
            type="profit" 
            speechText={language === 'mr' ? `आजचा निव्वळ नफा ₹${todayProfit} आहे.` : language === 'hi' ? `आज का शुद्ध लाभ ₹${todayProfit} है।` : `Today's net profit is ₹${todayProfit}.`}
          />
        </div>
      </div>

      {/* THIS WEEK'S METRICS (LAST 7 DAYS) */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-xl text-brand-900 tracking-tight">
              {language === 'mr' ? 'या आठवड्याचा हिशोब' : language === 'hi' ? 'इस सप्ताह का हिसाब' : "This Week's Numbers"}
            </h2>
            <span className="text-[10px] font-bold text-accent-700 bg-accent-50 px-2 py-0.5 rounded-md border border-accent-200">
              Last 7 Days
            </span>
          </div>
          <span className="text-xs text-gray-500 font-semibold bg-gray-100 px-3 py-1 rounded-full">
            {language === 'mr' ? 'चालू ७ दिवस' : language === 'hi' ? 'पिछले 7 दिन' : 'Rolling 7 Days'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard 
            title={language === 'mr' ? 'आठवडी विक्री' : language === 'hi' ? 'साप्ताहिक बिक्री' : 'Weekly Sales'} 
            amount={thisWeekIncome} 
            type="income" 
            speechText={language === 'mr' ? `या आठवड्याची विक्री ₹${thisWeekIncome} आहे.` : language === 'hi' ? `इस सप्ताह की बिक्री ₹${thisWeekIncome} है।` : `This week's sales are ₹${thisWeekIncome}.`}
          />
          <StatCard 
            title={language === 'mr' ? 'आठवडी खर्च' : language === 'hi' ? 'साप्ताहिक खर्च' : 'Weekly Expenses'} 
            amount={thisWeekExpenses} 
            type="expense" 
            speechText={language === 'mr' ? `या आठवड्याचा खर्च ₹${thisWeekExpenses} आहे.` : language === 'hi' ? `इस सप्ताह का खर्च ₹${thisWeekExpenses} है।` : `This week's expenses are ₹${thisWeekExpenses}.`}
          />
          <StatCard 
            title={language === 'mr' ? 'आठवडी नफा' : language === 'hi' ? 'साप्ताहिक लाभ' : 'Weekly Profit'} 
            amount={thisWeekProfit} 
            type="profit" 
            speechText={language === 'mr' ? `या आठवड्याचा नफा ₹${thisWeekProfit} आहे.` : language === 'hi' ? `इस सप्ताह का शुद्ध लाभ ₹${thisWeekProfit} है।` : `This week's net profit is ₹${thisWeekProfit}.`}
          />
        </div>
      </div>

      {/* THIS MONTH'S METRICS & PROFIT UNDERSTANDING EQUATION */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-xl text-brand-900 tracking-tight">
              {loc.monthSales} & {loc.monthProfit}
            </h2>
            <span className="text-[10px] font-bold text-brand-700 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
              Calendar Month
            </span>
          </div>
          <span className="text-xs text-gray-500 font-semibold bg-gray-100 px-3 py-1 rounded-full">
            {new Date().toLocaleDateString(language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard 
            title={loc.monthSales} 
            amount={thisMonthIncome} 
            type="income" 
            speechText={language === 'mr' ? `चालू महिन्याची एकूण विक्री ₹${thisMonthIncome} आहे.` : language === 'hi' ? `इस महीने की कुल बिक्री ₹${thisMonthIncome} है।` : `This month's total sales are ₹${thisMonthIncome}.`}
          />
          <StatCard 
            title={loc.monthExpenses} 
            amount={thisMonthExpenses} 
            type="expense" 
            speechText={language === 'mr' ? `चालू महिन्याचा एकूण खर्च ₹${thisMonthExpenses} आहे.` : language === 'hi' ? `इस महीने का कुल खर्च ₹${thisMonthExpenses} है।` : `This month's total expenses are ₹${thisMonthExpenses}.`}
          />
          <StatCard 
            title={loc.monthProfit} 
            amount={thisMonthProfit} 
            type="profit" 
            margin={profitMarginPercent} 
            speechText={language === 'mr' ? `चालू महिन्याचा नफा ₹${thisMonthProfit} असून नफा मार्जिन ${profitMarginPercent} टक्के आहे.` : language === 'hi' ? `इस महीने का लाभ ₹${thisMonthProfit} और मार्जिन ${profitMarginPercent} प्रतिशत है।` : `This month's net profit is ₹${thisMonthProfit} with ${profitMarginPercent}% margin.`}
          />
        </div>

        {/* PROFIT UNDERSTANDING FORMULA WIDGET (Income − Expenses = Profit) */}
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp size={20} />
            </div>
            <div>
              <h4 className="font-bold text-amber-950 text-sm">{loc.profitEquationTitle}</h4>
              <p className="text-xs text-amber-800 font-medium mt-0.5">{loc.formulaExplained}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto bg-white px-4 py-2 rounded-xl border border-amber-200 text-sm font-extrabold shadow-2xs">
            <span className="text-green-600">₹{thisMonthIncome.toLocaleString('en-IN')}</span>
            <span className="text-gray-400">−</span>
            <span className="text-rose-500">₹{thisMonthExpenses.toLocaleString('en-IN')}</span>
            <span className="text-gray-400">=</span>
            <span className="text-brand-900">₹{thisMonthProfit.toLocaleString('en-IN')}</span>
            <span className="text-xs font-bold text-accent-600 bg-accent-50 px-2 py-0.5 rounded-full ml-1">
              ({profitMarginPercent}%)
            </span>
          </div>
        </div>
      </div>

      {/* RECORD CONSISTENCY & DYNAMIC INSIGHTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Record Consistency Tracker */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  {loc.regularTracker}
                </span>
                <h3 className="text-xl font-extrabold text-brand-900 mt-1">
                  {recordConsistencyDays} {loc.daysRecorded}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                <Calendar size={20} />
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
              {hasGoodConsistency ? loc.insightGoodConsistency : "Record daily sales and costs consistently to build an organized 3-month proof of income."}
            </p>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-2">
              <div 
                className="bg-accent-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.round((recordConsistencyDays / 25) * 100))}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-gray-400 font-bold">
              <span>0 days</span>
              <span>Target: 25 days/month</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 text-[11px] text-gray-400 italic">
            * {loc.notCreditScoreNotice}
          </div>
        </div>

        {/* Dynamic Financial Alerts & Smart Suggestions (Challenge 3) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-accent-500" />
                <h3 className="text-base font-extrabold text-brand-900">
                  {language === 'mr' ? 'स्मार्ट आर्थिक सूचना व सल्ला' : language === 'hi' ? 'स्मार्ट वित्तीय अलर्ट और सलाह' : 'Smart Financial Alerts'}
                </h3>
              </div>
              <span className="text-[10px] font-extrabold bg-accent-50 text-accent-700 px-2 py-0.5 rounded-full border border-accent-200">
                AI Driven
              </span>
            </div>

            {/* Dynamic Alerts List */}
            {(() => {
              // Load udhaar entries for alert engine
              let udhaarList: UdhaarEntry[] = [];
              try {
                const storageKey = `khata_udhaar_${user?.email || user?.id || 'default'}`;
                const saved = localStorage.getItem(storageKey);
                if (saved) udhaarList = JSON.parse(saved);
              } catch {}

              const activeAlerts = generateDynamicAlerts(transactions, udhaarList);

              if (activeAlerts.length === 0) {
                return (
                  <div className="p-4 rounded-2xl bg-green-50/70 border border-green-200/80 text-xs text-green-900 font-semibold">
                    ✓ {language === 'mr' ? 'कोणताही आर्थिक धोका नाही. तुमचा हिशोब उत्तम चालला आहे.' : language === 'hi' ? 'कोई वित्तीय खतरा नहीं है। आपका हिसाब बहुत अच्छा चल रहा है।' : 'No financial risks detected. Operations are healthy.'}
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {activeAlerts.slice(0, 2).map((alert: FinancialAlert) => {
                    const isRed = alert.severity === 'red';
                    const isAmber = alert.severity === 'amber';
                    const isGreen = alert.severity === 'green';

                    return (
                      <div 
                        key={alert.id}
                        className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 ${
                          isRed
                            ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                            : isAmber
                            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                            : isGreen
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                            : 'bg-blue-50/80 border-blue-200 text-blue-950'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-extrabold text-xs">
                              {alert.title[language] || alert.title.en}
                            </span>
                            {alert.amountOrMetric && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white/70 border">
                                {alert.amountOrMetric}
                              </span>
                            )}
                          </div>
                          <p className="text-xs opacity-90 leading-relaxed font-medium">
                            {alert.description[language] || alert.description.en}
                          </p>
                          <p className="text-[11px] font-bold mt-1 text-accent-700">
                            👉 {alert.recommendedAction[language] || alert.recommendedAction.en}
                          </p>
                        </div>

                        {/* Speaker button to read alert aloud */}
                        <AudioSpeakerButton
                          text={alert.speechText[language] || alert.speechText.en}
                          size="sm"
                          className="shrink-0 mt-0.5"
                          title={language === 'mr' ? 'अलर्ट ऐका' : language === 'hi' ? 'अलर्ट सुनें' : 'Listen to Alert'}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <button
            onClick={() => navigate('/app/insights')}
            className="mt-4 pt-4 border-t border-gray-100 text-xs font-bold text-accent-600 hover:text-accent-700 flex items-center justify-between cursor-pointer"
          >
            <span>{loc.marginFinderTitle} & {language === 'mr' ? 'खर्च विभागणी' : language === 'hi' ? 'खर्च विभाजन' : 'Expense Breakdown'}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* MONTHLY FINANCIAL TRENDS CHART & CREDIT READINESS JOURNEY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-extrabold text-base text-brand-900">{loc.monthlyTrends}</h3>
              <p className="text-xs text-gray-400">Income vs Profit comparison</p>
            </div>
            <span className="text-xs font-bold text-accent-600 bg-accent-50 px-2.5 py-1 rounded-lg">
              {profitMarginPercent}% Margin
            </span>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip 
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                />
                <Bar dataKey="income" name="Income" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Credit-Readiness Journey Banner */}
        <div 
          onClick={() => navigate('/app/readiness')}
          className="bg-gradient-to-br from-rose-500 to-accent-600 text-white p-6 md:p-8 rounded-3xl shadow-lg flex flex-col justify-between cursor-pointer group hover:shadow-xl transition"
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-extrabold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
                {loc.readinessScoreLabel}
              </span>
              <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
            </div>

            <h3 className="text-2xl font-black mb-2 tracking-tight">
              {loc.readinessTitle}
            </h3>
            <p className="text-white/85 text-xs font-medium leading-relaxed mb-6">
              {loc.readinessSubtitle}
            </p>

            {/* Journey steps preview */}
            <div className="space-y-2 text-xs font-semibold bg-black/15 p-3.5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 text-white">
                <CheckCircle2 size={14} className="text-white shrink-0" />
                <span>1. Record Daily Hisaab (Voice)</span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <CheckCircle2 size={14} className="text-white shrink-0" />
                <span>2. 3-Month Consistent Records</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <div className="w-3.5 h-3.5 rounded-full border border-white/60 flex items-center justify-center text-[9px] shrink-0">3</div>
                <span>3. Download Bank-Ready Statement</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between text-xs font-bold pt-4 border-t border-white/20 gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                shareToWhatsapp();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Share2 size={13} />
              <span>Share via WhatsApp</span>
            </button>
            <span className="underline">Download PDF Statement →</span>
          </div>
        </div>
      </div>

      {/* 8-STEP CREDIT-READINESS PROGRESS JOURNEY */}
      <CreditJourneyStepper />

      {/* QUICK ADD MANUAL MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-gray-100">
            <button
              onClick={() => setShowManualModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 p-2 rounded-full cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-xl font-extrabold text-brand-900 mb-4">{loc.quickAddManual}</h3>
            
            <form onSubmit={handleQuickAdd} className="space-y-4">
              {/* Type Switcher */}
              <div className="flex bg-gray-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setModalType('sale')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                    modalType === 'sale' ? 'bg-white text-green-700 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  + {loc.incomeLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setModalType('expense')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                    modalType === 'expense' ? 'bg-white text-rose-600 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  - {loc.expenseLabel}
                </button>
              </div>

              {/* Item / Service */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Item / Description</label>
                <input
                  type="text"
                  required
                  placeholder={modalType === 'sale' ? "e.g. 20 Tiffins / डबे" : "e.g. Vegetables / भाजी"}
                  value={modalItem}
                  onChange={(e) => setModalItem(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-bold outline-none focus:bg-white focus:border-brand-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Category</label>
                <select
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-semibold outline-none focus:bg-white focus:border-brand-500"
                >
                  {modalType === 'sale' ? (
                    (businessContext?.categories?.sales || ['Sales', 'Orders', 'Services']).map((c: string) => (
                      <option key={c} value={c}>{c}</option>
                    ))
                  ) : (
                    (businessContext?.categories?.expenses || ['Grocery', 'Raw Material', 'Utilities', 'Supplies']).map((c: string) => (
                      <option key={c} value={c}>{c}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 1400"
                    value={modalAmount}
                    onChange={(e) => setModalAmount(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-bold outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-medium outline-none focus:bg-white focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-50 transition text-sm cursor-pointer"
                >
                  {loc.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-brand-900 hover:bg-brand-800 text-white font-extrabold transition shadow-md text-sm cursor-pointer"
                >
                  ✓ {loc.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const StatCard = ({ 
  title, 
  amount, 
  type, 
  margin,
  speechText 
}: { 
  title: string; 
  amount: number; 
  type: 'income' | 'expense' | 'profit'; 
  margin?: number;
  speechText?: string;
}) => {
  return (
    <div className={`p-5 rounded-3xl border shadow-xs transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md relative group cursor-default ${
      type === 'income' 
        ? 'bg-white border-gray-200' 
        : type === 'expense'
        ? 'bg-white border-gray-200'
        : 'bg-gradient-to-br from-brand-900 to-slate-900 text-white border-transparent shadow-md'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold uppercase tracking-wider block ${
          type === 'profit' ? 'text-accent-300' : 'text-gray-400'
        }`}>
          {title}
        </span>
        {speechText && (
          <AudioSpeakerButton 
            text={speechText} 
            size="sm" 
            className={type === 'profit' ? 'bg-white/10 text-white border-white/20 hover:bg-white/20' : ''}
          />
        )}
      </div>
      <div className="flex items-baseline justify-between">
        <span className={`text-2xl md:text-3xl font-black ${
          type === 'income' 
            ? 'text-green-600' 
            : type === 'expense'
            ? 'text-rose-500'
            : 'text-white'
        }`}>
          ₹{amount.toLocaleString('en-IN')}
        </span>
        {margin !== undefined && (
          <span className="text-xs font-bold text-accent-400 bg-white/10 px-2 py-0.5 rounded-full">
            {margin}%
          </span>
        )}
      </div>
    </div>
  );
};
