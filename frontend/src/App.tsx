import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { AppProvider, useAppContext, Language } from './context/AppContext';
import { Home, Mic, BookOpen, PieChart, ShieldCheck, FileText, Globe, LogOut, Sparkles, Building2, Users, Volume2, Bot } from 'lucide-react';
import { GlobalAudioBar } from './components/GlobalAudioBar';
import { AskKhataAI } from './components/AskKhataAI';


// Pages
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import VoiceKhata from './pages/VoiceKhata';
import Transactions from './pages/Transactions';
import Insights from './pages/Insights';
import Readiness from './pages/Readiness';
import Schemes from './pages/Schemes';
import UdhaarKhata from './pages/UdhaarKhata';
import Login from './pages/Login';
import Register from './pages/Register';

const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { language, setLanguage } = useAppContext();
  
  const langs: { code: Language; label: string }[] = [
    { code: 'mr', label: 'मराठी' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'en', label: 'EN' }
  ];

  return (
    <div className={`flex items-center rounded-xl bg-gray-100 p-1 border border-gray-200/80 shadow-inner ${compact ? 'text-xs' : 'text-sm'}`}>
      <Globe size={compact ? 13 : 15} className="text-gray-400 mx-1.5 shrink-0" />
      {langs.map(l => (
        <button
          key={l.code}
          onClick={() => setLanguage(l.code)}
          className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
            language === l.code 
              ? 'bg-brand-900 text-white shadow-sm scale-100' 
              : 'text-gray-600 hover:text-brand-900 hover:bg-gray-200/50'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { 
    loc, language, setLanguage, user, logout, isDemoMode, 
    transactions, financialSummary, speakText 
  } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [isChatOpen, setIsChatOpen] = useState(false);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const navItems = [
    { path: '/app', icon: <Home size={20} />, label: loc.navDashboard },
    { path: '/app/voice', icon: <Mic size={20} />, label: loc.navKhata },
    { path: '/app/ledger', icon: <BookOpen size={20} />, label: loc.navTransactions },
    { path: '/app/udhaar', icon: <Users size={20} />, label: loc.navUdhaar },
    { path: '/app/insights', icon: <PieChart size={20} />, label: loc.navInsights },
    { path: '/app/readiness', icon: <ShieldCheck size={20} />, label: loc.navReadiness },
    { path: '/app/schemes', icon: <FileText size={20} />, label: loc.navSchemes },
  ];

  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden font-sans text-brand-900">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 hidden md:flex flex-col h-full shadow-lg z-20 shrink-0">
        <div className="p-5 flex flex-col gap-3 border-b border-gray-100">
          <Link to="/" className="flex items-center gap-2.5 text-brand-900 font-extrabold text-xl tracking-tight">
            <div className="w-9 h-9 rounded-xl bg-accent-500 text-white flex items-center justify-center shadow-md">
              <Mic size={20} />
            </div>
            <span>Khata <span className="text-accent-500 text-sm font-normal">se Credit Tak</span></span>
          </Link>
          
          {/* Global Language Selector in Sidebar */}
          <LanguageSelector />
        </div>

        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map(item => (
            <Link 
              key={item.path} 
              to={item.path}
              className={`w-full flex items-center p-3 rounded-xl transition-all font-semibold ${
                location.pathname === item.path 
                ? 'bg-accent-50 text-accent-600 font-bold border border-accent-200 shadow-sm' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-brand-900'
              }`}
            >
              <span className={`mr-3 ${location.pathname === item.path ? 'text-accent-600' : 'text-gray-400'}`}>
                {item.icon}
              </span>
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/70 flex justify-between items-center">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <Building2 size={13} className="text-gray-400 shrink-0" />
              <p className="font-bold text-sm text-brand-900 truncate">
                {user.business_name || user.name}
              </p>
            </div>
            <p className="text-xs text-accent-600 font-semibold truncate">
              {user.business_type || 'Micro-Enterprise'}
            </p>
            {isDemoMode && (
              <span className="inline-block mt-0.5 text-[10px] font-extrabold bg-accent-100 text-accent-700 px-1.5 py-0.2 rounded">
                DEMO
              </span>
            )}
          </div>
          <button 
            onClick={() => { logout(); navigate('/'); }} 
            className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition shrink-0" 
            title={loc.logout}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Top Header (Desktop & Mobile) */}
        <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-3.5 shadow-xs flex justify-between items-center z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="md:hidden flex items-center gap-2 font-bold text-brand-900">
              <div className="w-7 h-7 rounded-lg bg-accent-500 text-white flex items-center justify-center">
                <Mic size={16} />
              </div>
              <span className="text-base">Khata</span>
            </div>

            <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
              <span className="font-bold text-brand-900">{user.business_name || user.name}</span>
              <span>•</span>
              <span className="text-accent-600 font-semibold">{user.business_type}</span>
              {isDemoMode && (
                <span className="flex items-center gap-1 bg-rose-50 text-rose-600 text-xs px-2.5 py-0.5 rounded-full font-bold border border-rose-200">
                  <Sparkles size={12} /> {loc.demoModeBadge}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Universal Page Audio Listen Button */}
            <button
              onClick={() => {
                const currentPath = location.pathname;
                let pageText = '';
                if (currentPath.includes('/voice')) {
                  pageText = language === 'mr'
                    ? "आवाज खाता पान. येथे तुम्ही बोलून तुमचा दिवसभराचा व्यवहार नोंदवू शकता."
                    : language === 'hi'
                    ? "वॉइस खाता पेज। यहां आप बोलकर दिनभर के लेन-देन दर्ज कर सकते हैं।"
                    : "Voice Khata page. Tap the microphone and speak your daily sales and expenses.";
                } else if (currentPath.includes('/ledger')) {
                  const saleTotal = transactions.filter(t => t.type === 'sale').reduce((s, t) => s + t.amount, 0);
                  const expTotal = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                  pageText = language === 'mr'
                    ? `व्यवहार नोंदवही. एकूण विक्री ₹${saleTotal}, आणि एकूण खर्च ₹${expTotal}. एकूण ${transactions.length} नोंदी आहेत.`
                    : language === 'hi'
                    ? `खाता बही पेज। कुल बिक्री ₹${saleTotal}, और कुल खर्च ₹${expTotal}। कुल ${transactions.length} लेन-देन दर्ज हैं।`
                    : `Business Ledger. Total sales ₹${saleTotal}, total expenses ₹${expTotal}. Total ${transactions.length} records.`;
                } else if (currentPath.includes('/udhaar')) {
                  pageText = language === 'mr'
                    ? "उधार खाते पान. येथे तुम्ही ग्राहकांची उधारी आणि प्रलंबित वसुली पाहू शकता."
                    : language === 'hi'
                    ? "उधार खाता पेज। यहां आप ग्राहकों की बकाया उधारी और भुगतान देख सकते हैं।"
                    : "Customer Credit Ledger. Review customer balances and collect pending payments.";
                } else if (currentPath.includes('/insights')) {
                  pageText = language === 'mr'
                    ? `व्यवसाय विश्लेषण पान. निव्वळ नफा ₹${financialSummary.netProfit}, नफा मार्जिन ${financialSummary.profitMarginPercent} टक्के आहे.`
                    : language === 'hi'
                    ? `बिजनेस इनसाइट्स पेज। शुद्ध लाभ ₹${financialSummary.netProfit}, और प्रॉफिट मार्जिन ${financialSummary.profitMarginPercent} प्रतिशत है।`
                    : `Business Insights page. Net profit is ₹${financialSummary.netProfit}, with a ${financialSummary.profitMarginPercent}% margin.`;
                } else if (currentPath.includes('/readiness')) {
                  pageText = language === 'mr'
                    ? "बँक पत पात्रता पान. येथून तुम्ही मुद्रा कर्जासाठी ३ महिन्यांचे बँक स्टेटमेंट डाउनलोड करू शकता."
                    : language === 'hi'
                    ? "बैंक लोन पात्रता पेज। यहां से आप मुद्रा लोन के लिए 3 महीने का बैंक स्टेटमेंट डाउनलोड कर सकते हैं।"
                    : "Credit Readiness page. Download your 3-month bank-ready financial statement for loan applications.";
                } else if (currentPath.includes('/schemes')) {
                  pageText = language === 'mr'
                    ? "सरकारी योजना दालन. येथे मुद्रा आणि इतर सरकारी व्यवसाय कर्जांची माहिती उपलब्ध आहे."
                    : language === 'hi'
                    ? "सरकारी योजनाएं। यहां मुद्रा और अन्य बिजनेस लोन योजनाओं की जानकारी उपलब्ध है।"
                    : "Government Schemes directory. Explore MUDRA, Stand-Up India, and MSME loan schemes.";
                } else {
                  // Default Dashboard
                  pageText = language === 'mr'
                    ? `आजचे उत्पन्न ₹${financialSummary.todayIncome}, आजचा खर्च ₹${financialSummary.todayExpenses}, आणि नफा ₹${financialSummary.todayProfit}. चालू महिन्याचे उत्पन्न ₹${financialSummary.thisMonthIncome} आहे.`
                    : language === 'hi'
                    ? `आज की कुल आय ₹${financialSummary.todayIncome}, आज का खर्च ₹${financialSummary.todayExpenses}, और लाभ ₹${financialSummary.todayProfit} है। चालू महीने की आय ₹${financialSummary.thisMonthIncome} है।`
                    : `Today's income is ₹${financialSummary.todayIncome}, expenses are ₹${financialSummary.todayExpenses}, and net profit is ₹${financialSummary.todayProfit}. This month's total income is ₹${financialSummary.thisMonthIncome}.`;
                }
                speakText(pageText);
              }}
              className="flex items-center gap-1.5 bg-accent-50 hover:bg-accent-100 text-brand-900 border border-accent-200/80 px-2.5 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 shadow-2xs cursor-pointer"
              title={language === 'mr' ? 'ऐकून घ्या' : language === 'hi' ? 'पेज सारांश सुनें' : 'Listen Page Summary'}
            >
              <Volume2 size={15} className="text-accent-600 shrink-0" />
              <span className="font-bold">
                {language === 'mr' ? 'ऐकून घ्या' : language === 'hi' ? 'सुनें' : 'Listen'}
              </span>
            </button>

            {/* Ask Khata AI Chatbot Launcher Button */}
            <button
              onClick={() => setIsChatOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-accent-500 to-accent-600 hover:from-accent-600 hover:to-accent-700 text-white px-3 py-1.5 rounded-xl font-black text-xs transition active:scale-95 shadow-sm cursor-pointer"
              title={language === 'mr' ? 'AI सहाय्यकाला विचारा' : language === 'hi' ? 'AI सहायक से पूछें' : 'Ask Khata AI'}
            >
              <Sparkles size={14} className="text-white animate-pulse" />
              <span>{language === 'mr' ? 'Ask AI' : language === 'hi' ? 'Ask AI' : 'Ask AI'}</span>
            </button>

            {/* Language Selector */}
            <LanguageSelector compact />

            {/* Logout on mobile header */}
            <button 
              onClick={() => { logout(); navigate('/'); }} 
              className="md:hidden text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-gray-100"
              title={loc.logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Floating Global Audio Player Bar */}
        <GlobalAudioBar />

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto relative pb-24 md:pb-8 scroll-smooth bg-surface-50">
          <div className="max-w-5xl mx-auto h-full">
            {children}
          </div>
        </main>

        {/* Floating AI Assistant Trigger Button */}
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-20 md:bottom-8 right-5 z-40 bg-brand-900 hover:bg-brand-850 text-white p-3.5 rounded-full shadow-2xl flex items-center gap-2 border-2 border-accent-400 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          title="Ask Khata AI (स्मार्ट आवाज सहाय्यक)"
        >
          <div className="relative">
            <Bot size={22} className="text-accent-400 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent-400 rounded-full animate-ping" />
          </div>
          <span className="text-xs font-black pr-1 hidden sm:inline">Ask AI</span>
        </button>

        {/* Multilingual Voice Chatbot Drawer */}
        <AskKhataAI isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />


        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 pb-safe shadow-lg z-30">
          {navItems.map(item => (
            <Link 
              key={item.path} 
              to={item.path}
              className={`flex flex-col items-center p-2 rounded-xl transition ${
                location.pathname === item.path ? 'text-accent-600 font-bold bg-accent-50/50' : 'text-gray-400'
              }`}
            >
              {React.cloneElement(item.icon, { size: 20, className: location.pathname === item.path ? 'stroke-2 text-accent-600' : 'stroke-[1.5]' })}
              <span className="text-[10px] mt-1 truncate max-w-[55px]">{item.label.split(' ')[0]}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/app" element={<AppShell><Dashboard /></AppShell>} />
          <Route path="/app/dashboard" element={<AppShell><Dashboard /></AppShell>} />
          <Route path="/app/voice" element={<AppShell><VoiceKhata /></AppShell>} />
          <Route path="/app/ledger" element={<AppShell><Transactions /></AppShell>} />
          <Route path="/app/transactions" element={<AppShell><Transactions /></AppShell>} />
          <Route path="/app/udhaar" element={<AppShell><UdhaarKhata /></AppShell>} />
          <Route path="/app/insights" element={<AppShell><Insights /></AppShell>} />
          <Route path="/app/readiness" element={<AppShell><Readiness /></AppShell>} />
          <Route path="/app/statement" element={<AppShell><Readiness /></AppShell>} />
          <Route path="/app/schemes" element={<AppShell><Schemes /></AppShell>} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
