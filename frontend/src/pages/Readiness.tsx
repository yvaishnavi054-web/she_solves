import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  ShieldCheck, Download, CheckCircle, AlertCircle, TrendingUp, 
  Share2, Printer, FileText, Building2, Calendar, Award, 
  CheckCircle2, Volume2, ArrowUpRight, ArrowDownRight, Sparkles, Clock,
  HelpCircle, X, ChevronRight, ChevronLeft, Info, Layers, PieChart, Activity
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { CreditJourneyStepper } from '../components/CreditJourneyStepper';
import { AudioSpeakerButton } from '../components/AudioSpeakerButton';
import { 
  computeThreeMonthReadiness, 
  MonthlyRecord,
  computeRecordStrengthBreakdown,
  computeTwelveMonthReadiness,
  TwelveMonthRecord,
  RecordStrengthBreakdown
} from '../lib/monthlyReadiness';
import { UdhaarEntry } from './UdhaarKhata';

export default function Readiness() {
  const { loc, user, businessContext, transactions, financialSummary, language, speakText } = useAppContext();
  const [copiedToast, setCopiedToast] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  // Load Udhaar records from local storage for accurate monthly udhaar calculation
  const udhaarEntries = useMemo<UdhaarEntry[]>(() => {
    try {
      const storageKey = `khata_udhaar_${user?.email || user?.id || 'default'}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [user]);

  // Compute deterministic 3-month performance data with exact calendar bounds and upward/downward movement
  const readinessData = useMemo(() => {
    return computeThreeMonthReadiness(transactions, udhaarEntries, new Date());
  }, [transactions, udhaarEntries]);

  // Compute detailed Record Strength breakdown explaining factors for score (e.g. 45/100)
  const scoreBreakdown = useMemo(() => {
    return computeRecordStrengthBreakdown(transactions, udhaarEntries, new Date());
  }, [transactions, udhaarEntries]);

  // Compute complete 12-Month Financial History and Trend Overview
  const twelveMonthData = useMemo(() => {
    return computeTwelveMonthReadiness(transactions, udhaarEntries, new Date());
  }, [transactions, udhaarEntries]);

  const selectedMonthRecord = useMemo(() => {
    if (!selectedMonthKey) return null;
    return twelveMonthData.months.find(m => m.monthKey === selectedMonthKey) || null;
  }, [selectedMonthKey, twelveMonthData]);

  const { months, threeMonthTotals, overallStatus } = readinessData;

  const {
    income: totalIncome,
    expenses: totalExpenses,
    profit: netProfit,
    profitMarginPercent,
    activeDays: activeDaysCount,
    txCount: transactionCount,
    avgMonthlyIncome,
    avgMonthlyExpenses,
    avgMonthlyProfit
  } = threeMonthTotals;

  const consistencyScore = overallStatus.readinessScore;

  // Generate downloadable PDF using jsPDF
  const generatePdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Header Banner
      doc.setFillColor(15, 23, 42); // slate-900 / brand-900
      doc.rect(0, 0, 210, 36, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text("Khata se Credit Tak", 14, 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(244, 63, 94); // accent-500
      doc.text("BANK-READY BUSINESS FINANCIAL STATEMENT", 14, 23);

      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text("Structured Operational Track Record for Women Micro-Entrepreneurs", 14, 29);

      const generatedDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.text(`Generated: ${generatedDate}`, 155, 29);

      // Section 1: Business Profile Box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 42, 182, 32, 3, 3, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text("1. Business & Entrepreneur Profile", 18, 50);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Proprietor: ${user?.name || "Meena Tai"}`, 18, 57);
      doc.text(`Business Name: ${user?.business_name || "Home Enterprise"}`, 18, 63);
      doc.text(`Activity Type: ${user?.business_type || "Micro-Enterprise"}`, 18, 69);

      doc.text(`Reporting Period: Past 90 Days (3 Calendar Months)`, 110, 57);
      doc.text(`Total Recorded Entries: ${transactionCount} transactions`, 110, 63);
      doc.text(`Active Days Documented: ${activeDaysCount} business days`, 110, 69);

      // Section 2: 3-Month Financial Summary
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("2. 3-Month Financial Performance Summary", 14, 82);

      // 3 Stat Boxes
      // Box 1: Total Income
      doc.setFillColor(240, 253, 244); // green-50
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(14, 86, 56, 24, 2, 2, 'FD');
      doc.setFontSize(8);
      doc.setTextColor(22, 101, 52);
      doc.text("TOTAL RECORDED INCOME", 18, 93);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`INR ${totalIncome.toLocaleString('en-IN')}`, 18, 103);

      // Box 2: Total Expenses
      doc.setFillColor(255, 241, 242); // rose-50
      doc.setDrawColor(254, 205, 211);
      doc.roundedRect(77, 86, 56, 24, 2, 2, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(159, 18, 57);
      doc.text("TOTAL RECORDED EXPENSES", 81, 93);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`INR ${totalExpenses.toLocaleString('en-IN')}`, 81, 103);

      // Box 3: Net Profit
      doc.setFillColor(241, 245, 249); // slate-100
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(140, 86, 56, 24, 2, 2, 'FD');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(`NET OPERATIONAL PROFIT (${profitMarginPercent}%)`, 144, 93);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`INR ${netProfit.toLocaleString('en-IN')}`, 144, 103);

      // Section 3: Monthly Breakdown Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("3. Monthly Operations Breakdown (Exact Calendar Months)", 14, 120);

      // Table Header
      doc.setFillColor(226, 232, 240);
      doc.rect(14, 124, 182, 8, 'F');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text("MONTH & BOUNDARY", 20, 129);
      doc.text("GROSS INCOME (INR)", 70, 129);
      doc.text("RECORDED EXPENSES (INR)", 115, 129);
      doc.text("NET PROFIT (INR)", 160, 129);

      let tableY = 138;
      months.forEach((m) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(`${m.monthName.en} (${m.isCurrentMonth ? 'MTD' : 'Full'})`, 20, tableY);
        doc.setTextColor(22, 101, 52);
        doc.text(`INR ${m.income.toLocaleString('en-IN')}`, 70, tableY);
        doc.setTextColor(159, 18, 57);
        doc.text(`INR ${m.expenses.toLocaleString('en-IN')}`, 115, tableY);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text(`INR ${m.profit.toLocaleString('en-IN')}`, 160, tableY);

        doc.setDrawColor(241, 245, 249);
        doc.line(14, tableY + 3, 196, tableY + 3);
        tableY += 8;
      });

      // Section 4: Declaration Box
      const declY = tableY + 6;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, declY, 182, 38, 3, 3, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("Self-Attestation & Record Declaration", 18, declY + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `"I hereby confirm that the transactions recorded in Khata se Credit Tak represent the genuine operational activity`,
        18,
        declY + 13
      );
      doc.text(
        `of my business enterprise over the documented 3-month reporting cycle."`,
        18,
        declY + 18
      );

      // Signatures
      doc.line(14, declY + 30, 80, declY + 30);
      doc.text("Entrepreneur Signature / Thumbprint", 14, declY + 34);

      doc.line(130, declY + 30, 196, declY + 30);
      doc.text("Bank / SHG / Facilitator Stamp", 130, declY + 34);

      // Disclaimer Footer
      doc.setFillColor(241, 245, 249);
      doc.rect(0, 276, 210, 21, 'F');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(
        "IMPORTANT NOTICE: This document is an organized operational record summary created to assist micro-entrepreneurs in presenting",
        14,
        282
      );
      doc.text(
        "structured accounts. It is NOT a credit score, does NOT guarantee loan approval or credit sanctions. Loan sanctioning decisions",
        14,
        286
      );
      doc.text(
        "remain at the sole discretion of the lending financial institutions under official government scheme norms (e.g., PM MUDRA, PMEGP).",
        14,
        290
      );

      doc.save(`Khata_Statement_${user?.name?.replace(/\s+/g, '_') || 'Entrepreneur'}.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
      window.print();
    }
  };

  // Copy statement text to clipboard
  const copySummaryText = () => {
    const text = `
========================================
KHATA SE CREDIT TAK - BANK-READY STATEMENT
========================================
Entrepreneur: ${user?.name || "Meena Tai"}
Business: ${user?.business_name || "Enterprise"} (${user?.business_type || "Food"})
Reporting Period: 3 Calendar Months

FINANCIAL METRICS:
- Total Recorded Income: ₹${totalIncome.toLocaleString('en-IN')}
- Total Recorded Expenses: ₹${totalExpenses.toLocaleString('en-IN')}
- Net Profit: ₹${netProfit.toLocaleString('en-IN')} (${profitMarginPercent}% margin)

MONTHLY BREAKDOWN:
${months.map(m => `- ${m.monthName.en}: Income ₹${m.income.toLocaleString('en-IN')}, Expenses ₹${m.expenses.toLocaleString('en-IN')}, Profit ₹${m.profit.toLocaleString('en-IN')} (${m.dailyAvgLabel.en})`).join('\n')}

MONTHLY AVERAGES:
- Avg. Monthly Income: ₹${avgMonthlyIncome.toLocaleString('en-IN')}
- Avg. Monthly Expenses: ₹${avgMonthlyExpenses.toLocaleString('en-IN')}
- Avg. Monthly Profit: ₹${avgMonthlyProfit.toLocaleString('en-IN')}
- Active Recorded Days: ${activeDaysCount} days
- Total Entries: ${transactionCount} records

DISCLAIMER: This is an organized business record summary to facilitate bank and scheme handoff. It is NOT a credit score and does not guarantee loan approval.
========================================
`;
    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3000);
  };

  const shareOnWhatsapp = () => {
    const text = `*Khata se Credit Tak - 3-Month Bank-Ready Statement*\n` +
      `Proprietor: ${user?.name || "Entrepreneur"}\n` +
      `Business: ${user?.business_name || "Enterprise"} (${user?.business_type || "Micro-Enterprise"})\n` +
      `Total Recorded Income: ₹${totalIncome.toLocaleString('en-IN')}\n` +
      `Total Recorded Expenses: ₹${totalExpenses.toLocaleString('en-IN')}\n` +
      `Net Operational Profit: ₹${netProfit.toLocaleString('en-IN')} (${profitMarginPercent}% margin)\n` +
      `Avg Monthly Income: ₹${avgMonthlyIncome.toLocaleString('en-IN')}\n` +
      `Avg Monthly Net Profit: ₹${avgMonthlyProfit.toLocaleString('en-IN')}\n` +
      `Active Documented Days: ${activeDaysCount} days\n\n` +
      `*Important Notice:* This is an organized operational financial statement for approaching banks, MUDRA/PMEGP schemes, or SHG support. It is NOT a credit score.`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Top Header with dedicated 3-Month Audio Speaker Button (Challenge 1 & Requirement 2) */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-brand-900 tracking-tight">
              {loc.readinessTitle}
            </h1>
            {/* Speaker Button beside 3-Month Summary Header */}
            <AudioSpeakerButton
              text={overallStatus.summarySpeech[language] || overallStatus.summarySpeech.en}
              size="md"
              title={loc.listenSummary || "Listen to 3-Month Credit Readiness Summary"}
            />
          </div>
          <p className="text-gray-500 text-sm mt-1">{loc.readinessSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => speakText(overallStatus.summarySpeech[language] || overallStatus.summarySpeech.en, language)}
            className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-accent-700 px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            title={loc.listenSummary || "Listen to 3-Month Summary"}
          >
            <Volume2 size={15} />
            <span>{language === 'mr' ? 'अहवाल ऐका' : language === 'hi' ? 'रिपोर्ट सुनें' : 'Listen Report'}</span>
          </button>
          <button
            onClick={shareOnWhatsapp}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
          >
            <Share2 size={15} /> WhatsApp
          </button>
          <button
            onClick={copySummaryText}
            className="bg-white hover:bg-gray-50 border border-gray-200 text-brand-900 px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
          >
            <Share2 size={15} /> {loc.shareSummaryBtn}
          </button>
          <button 
            onClick={generatePdf}
            className="bg-brand-900 hover:bg-brand-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-md cursor-pointer"
          >
            <Download size={16} /> {loc.downloadPdfBtn}
          </button>
        </div>
      </div>

      {copiedToast && (
        <div className="bg-green-100 border border-green-300 text-green-900 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle size={16} className="text-green-600" />
          <span>{loc.statementCopiedNotice}</span>
        </div>
      )}

      {/* RECORD STRENGTH & 3-MONTH AVERAGES OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Record Strength Badge */}
        <div className="bg-gradient-to-br from-brand-900 to-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
          
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-accent-400 uppercase tracking-wider">
                {loc.readinessScoreLabel}
              </span>
              <Award size={22} className="text-accent-400" />
            </div>

            <div className="flex items-baseline justify-between gap-1 my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black">{consistencyScore}</span>
                <span className="text-xl text-gray-400 font-bold">/100</span>
              </div>
              <button
                type="button"
                onClick={() => setShowScoreModal(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-accent-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition cursor-pointer border border-white/10 btn-press"
                title={loc.howIsThisCalculated || "How is this calculated?"}
              >
                <HelpCircle size={14} className="text-accent-400 shrink-0" />
                <span>{loc.howIsThisCalculated || "How is this calculated?"}</span>
              </button>
            </div>

            <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-white/10 text-accent-300 mb-2">
              {overallStatus.ratingText[language] || overallStatus.ratingText.en}
            </span>

            <p className="text-xs text-gray-300 font-medium leading-relaxed mt-1">
              {loc.readinessExplanation}
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-xs">
            <span className="text-gray-400">{loc.activeDaysCount}:</span>
            <span className="font-bold text-white">{activeDaysCount} days documented</span>
          </div>
        </div>

        {/* 3-Month Averages Breakdown */}
        <div className="md:col-span-2 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-extrabold text-base text-brand-900">
                {loc.threeMonthAverage} ({loc.reportingPeriodLabel})
              </h3>
              <span className="text-xs font-bold text-accent-600 bg-accent-50 px-2.5 py-1 rounded-lg border border-accent-100">
                {profitMarginPercent}% Net Margin
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50/60 border border-green-200/80 rounded-2xl p-4">
                <span className="text-xs font-bold text-green-800 uppercase block mb-1">
                  {loc.avgMonthlyIncome}
                </span>
                <span className="text-2xl font-black text-green-700">
                  ₹{avgMonthlyIncome.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4">
                <span className="text-xs font-bold text-rose-800 uppercase block mb-1">
                  {loc.avgMonthlyExpense}
                </span>
                <span className="text-2xl font-black text-rose-600">
                  ₹{avgMonthlyExpenses.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="bg-brand-50/60 border border-brand-200/80 rounded-2xl p-4">
                <span className="text-xs font-bold text-brand-900 uppercase block mb-1">
                  {loc.avgMonthlyProfit}
                </span>
                <span className="text-2xl font-black text-brand-900">
                  ₹{avgMonthlyProfit.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Scheme Recommendation Box */}
            <div className="bg-accent-50/70 border border-accent-200/80 rounded-2xl p-4 flex items-start gap-3">
              <Sparkles size={18} className="text-accent-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-accent-900 block mb-0.5">
                  {language === 'mr' ? 'बँक व सरकारी योजनेसाठी शिफारस:' : language === 'hi' ? 'बैंक एवं सरकारी योजना हेतु अनुशंसा:' : 'Bank & Scheme Recommendation:'}
                </span>
                <p className="text-xs text-accent-800 leading-relaxed font-medium">
                  {overallStatus.recommendation[language] || overallStatus.recommendation.en}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-4 pt-3 border-t border-gray-100">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            <span>Calculated from {transactionCount} confirmed transactions across {activeDaysCount} business days.</span>
          </div>
        </div>
      </div>

      {/* INDIVIDUAL MONTHLY SUMMARIES (LAST 3 MONTHS) — REQUIREMENTS 3 & 4 */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            <h2 className="text-xl font-extrabold text-brand-900 tracking-tight flex items-center gap-2">
              <Calendar size={22} className="text-accent-600" />
              <span>{loc.monthlyPerformanceTitle || "Individual Monthly Summaries (Last 3 Months)"}</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {loc.monthlyPerformanceSub || "Independent month-by-month financial summary with calendar boundaries, daily averages, and movement indicators."}
            </p>
          </div>
        </div>

        {/* 3 Separate Monthly Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {months.map((month, idx) => {
            const isCurrent = month.isCurrentMonth;
            const isBaseline = month.comparisonType === 'baseline';

            return (
              <div 
                key={month.monthKey}
                className={`rounded-3xl p-5 md:p-6 border transition-all flex flex-col justify-between shadow-xs ${
                  isCurrent
                    ? 'bg-gradient-to-b from-white to-amber-50/40 border-amber-300 ring-2 ring-amber-300/30'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>
                  {/* Card Header: Month Name + Badge + Speaker */}
                  <div className="flex justify-between items-start pb-4 border-b border-gray-100 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-lg text-brand-900">
                          {month.monthName[language] || month.monthName.en}
                        </h3>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isCurrent
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isBaseline
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {isCurrent ? (loc.monthToDateBadge || "MTD") : isBaseline ? (loc.baselineMonthBadge || "BASELINE") : (loc.fullMonthBadge || "FULL MONTH")}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 font-medium block mt-0.5">
                        {month.startDateStr} → {isCurrent ? `${month.year}-${String(month.monthIndex + 1).padStart(2, '0')}-${String(month.elapsedDays).padStart(2, '0')}` : month.endDateStr}
                      </span>
                    </div>

                    {/* Dedicated Speaker Button for this Month */}
                    <AudioSpeakerButton
                      text={month.speechSummary[language] || month.speechSummary.en}
                      size="sm"
                      title={loc.listenMonth || "Listen to this month's summary"}
                    />
                  </div>

                  {/* 4 Financial Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Income */}
                    <div className="p-3 rounded-2xl bg-green-50/60 border border-green-200/80">
                      <span className="text-[11px] font-bold text-green-900 block mb-0.5">
                        {loc.incomeLabel}
                      </span>
                      <span className="text-lg font-black text-green-700 block">
                        ₹{month.income.toLocaleString('en-IN')}
                      </span>
                      
                      {/* Movement Indicator */}
                      <div className="mt-1">
                        {isBaseline ? (
                          <span className="text-[10px] font-semibold text-gray-400">
                            {loc.baselineMonthBadge || "Baseline"}
                          </span>
                        ) : month.incomeComparison.diff > 0 ? (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded flex items-center gap-0.5 w-fit">
                            <ArrowUpRight size={12} /> +₹{Math.abs(month.incomeComparison.diff).toLocaleString('en-IN')} {month.incomeComparison.pct !== null ? `(+${month.incomeComparison.pct}%)` : ''}
                          </span>
                        ) : month.incomeComparison.diff < 0 ? (
                          <span className="text-[10px] font-black text-rose-700 bg-rose-100/70 px-1.5 py-0.5 rounded flex items-center gap-0.5 w-fit">
                            <ArrowDownRight size={12} /> -₹{Math.abs(month.incomeComparison.diff).toLocaleString('en-IN')} {month.incomeComparison.pct !== null ? `(-${Math.abs(month.incomeComparison.pct)}%)` : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-400">0%</span>
                        )}
                      </div>
                    </div>

                    {/* Expenses */}
                    <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200/80">
                      <span className="text-[11px] font-bold text-rose-900 block mb-0.5">
                        {loc.expenseLabel}
                      </span>
                      <span className="text-lg font-black text-rose-600 block">
                        ₹{month.expenses.toLocaleString('en-IN')}
                      </span>

                      {/* Movement Indicator (Lower expense is favorable/green!) */}
                      <div className="mt-1">
                        {isBaseline ? (
                          <span className="text-[10px] font-semibold text-gray-400">
                            {loc.baselineMonthBadge || "Baseline"}
                          </span>
                        ) : month.expenseComparison.diff < 0 ? (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded flex items-center gap-0.5 w-fit" title="Cost savings!">
                            <ArrowDownRight size={12} /> -₹{Math.abs(month.expenseComparison.diff).toLocaleString('en-IN')} {month.expenseComparison.pct !== null ? `(-${Math.abs(month.expenseComparison.pct)}%)` : ''}
                          </span>
                        ) : month.expenseComparison.diff > 0 ? (
                          <span className="text-[10px] font-black text-rose-700 bg-rose-100/70 px-1.5 py-0.5 rounded flex items-center gap-0.5 w-fit">
                            <ArrowUpRight size={12} /> +₹{month.expenseComparison.diff.toLocaleString('en-IN')} {month.expenseComparison.pct !== null ? `(+${month.expenseComparison.pct}%)` : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-400">0%</span>
                        )}
                      </div>
                    </div>

                    {/* Net Profit */}
                    <div className="p-3 rounded-2xl bg-brand-50/60 border border-brand-200/80">
                      <span className="text-[11px] font-bold text-brand-900 block mb-0.5">
                        {loc.netProfitLabel}
                      </span>
                      <span className="text-lg font-black text-brand-900 block">
                        ₹{month.profit.toLocaleString('en-IN')}
                      </span>

                      {/* Movement Indicator */}
                      <div className="mt-1">
                        {isBaseline ? (
                          <span className="text-[10px] font-semibold text-gray-400">
                            {month.profitMarginPercent}% margin
                          </span>
                        ) : month.profitComparison.diff > 0 ? (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded flex items-center gap-0.5 w-fit">
                            <ArrowUpRight size={12} /> +₹{Math.abs(month.profitComparison.diff).toLocaleString('en-IN')} {month.profitComparison.pct !== null ? `(+${month.profitComparison.pct}%)` : ''}
                          </span>
                        ) : month.profitComparison.diff < 0 ? (
                          <span className="text-[10px] font-black text-rose-700 bg-rose-100/70 px-1.5 py-0.5 rounded flex items-center gap-0.5 w-fit">
                            <ArrowDownRight size={12} /> -₹{Math.abs(month.profitComparison.diff).toLocaleString('en-IN')} {month.profitComparison.pct !== null ? `(-${Math.abs(month.profitComparison.pct)}%)` : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-400">0%</span>
                        )}
                      </div>
                    </div>

                    {/* Outstanding Udhaar */}
                    <div className="p-3 rounded-2xl bg-surface-50 border border-gray-200">
                      <span className="text-[11px] font-bold text-gray-600 block mb-0.5">
                        {loc.outstandingCreditLabel || "Outstanding Udhaar"}
                      </span>
                      <span className="text-lg font-black text-brand-900 block">
                        ₹{month.outstandingUdhaar.toLocaleString('en-IN')}
                      </span>

                      {/* Movement Indicator (Lower udhaar is green!) */}
                      <div className="mt-1">
                        {isBaseline ? (
                          <span className="text-[10px] font-semibold text-gray-400">
                            {month.activeDaysCount} active days
                          </span>
                        ) : month.udhaarComparison.diff < 0 ? (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded flex items-center gap-0.5 w-fit">
                            <ArrowDownRight size={12} /> -₹{Math.abs(month.udhaarComparison.diff).toLocaleString('en-IN')} (Recovered)
                          </span>
                        ) : month.udhaarComparison.diff > 0 ? (
                          <span className="text-[10px] font-black text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded flex items-center gap-0.5 w-fit">
                            <ArrowUpRight size={12} /> +₹{month.udhaarComparison.diff.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-400">Steady</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Daily Averages Row with Clear Elapsed/Full Day Label */}
                  <div className="bg-gray-50/90 rounded-2xl p-3 border border-gray-200/80 mb-3 text-xs">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-extrabold text-brand-900 text-[11px] flex items-center gap-1">
                        <Clock size={12} className="text-accent-600" />
                        {loc.dailyAverageLabel || "Daily Average"}:
                      </span>
                      <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                        {month.dailyAvgLabel[language] || month.dailyAvgLabel.en}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-gray-200/50">
                      <div>
                        <span className="text-[10px] text-gray-400 block font-medium">Income/Day</span>
                        <span className="font-extrabold text-green-700 text-xs">₹{month.dailyAvgIncome.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block font-medium">Expense/Day</span>
                        <span className="font-extrabold text-rose-600 text-xs">₹{month.dailyAvgExpenses.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block font-medium">Profit/Day</span>
                        <span className="font-extrabold text-brand-900 text-xs">₹{month.dailyAvgProfit.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Short Narrative Explanation Box */}
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-brand-900 leading-relaxed">
                    👉 {month.profitComparison.explanation[language] || month.profitComparison.explanation.en}
                  </p>
                  <span className="text-[10px] font-medium text-gray-400 block mt-0.5">
                    {month.comparisonPeriodLabel[language] || month.comparisonPeriodLabel.en}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CREDIT-READINESS PROGRESS ROADMAP */}
      <CreditJourneyStepper />

      {/* 12-MONTH FINANCIAL HISTORY & TREND OVERVIEW */}
      <div className="space-y-6 pt-2">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-extrabold text-brand-900 tracking-tight flex items-center gap-2">
                <TrendingUp size={22} className="text-accent-600" />
                <span>{loc.twelveMonthHistoryTitle || "12-Month Financial History & Trend Overview"}</span>
              </h2>
              {/* Audio Speaker for 12-Month Trend */}
              <AudioSpeakerButton
                text={twelveMonthData.twelveMonthSpeechSummary[language] || twelveMonthData.twelveMonthSpeechSummary.en}
                size="sm"
                title={loc.listenSummary || "Listen to 12-Month Financial Summary"}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {loc.twelveMonthHistorySubtitle || "Explore your complete 12 calendar months with income, expenses, profit margin, Udhaar, and month-by-month changes."}
            </p>
          </div>

          {selectedMonthKey && (
            <button
              onClick={() => setSelectedMonthKey(null)}
              className="bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto btn-press"
            >
              <ChevronLeft size={16} />
              <span>{loc.backToTwelveMonthOverview || "← Back to 12-Month Overview"}</span>
            </button>
          )}
        </div>

        {/* MODE A: 12-MONTH OVERVIEW (when no month is drilled down) */}
        {!selectedMonthKey ? (
          <div className="space-y-6 animate-fade-in">
            {/* Visual 12-Month Trend Bar Strip */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-xs">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-brand-900 flex items-center gap-1.5">
                  <Activity size={14} className="text-accent-500" />
                  {language === 'mr' ? '१२-महिन्यांची नफा व उलाढाल पट्टी' : language === 'hi' ? '12-माह लाभ एवं बिक्री रुझान पट्टी' : '12-Month Profit & Revenue Trajectory'}
                </span>
                <span className="text-[11px] text-gray-400 font-medium">
                  {language === 'mr' ? 'तपशील पाहण्यासाठी महिन्यावर क्लिक करा' : language === 'hi' ? 'विस्तार देखने के लिए किसी भी महीने पर क्लिक करें' : 'Click any month card to view its daily ledger'}
                </span>
              </div>

              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 sm:gap-2 pt-2">
                {twelveMonthData.months.map((m) => {
                  const hasProfit = m.profit > 0;
                  const isCurrent = m.isCurrentMonth;
                  const isEmpty = m.isEmpty;
                  return (
                    <button
                      key={m.monthKey}
                      type="button"
                      onClick={() => setSelectedMonthKey(m.monthKey)}
                      className={`group flex flex-col items-center justify-end p-1.5 sm:p-2 rounded-xl transition cursor-pointer border text-center ${
                        isCurrent 
                          ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300' 
                          : isEmpty 
                          ? 'bg-gray-50/60 border-gray-100 hover:bg-gray-100/60' 
                          : 'bg-slate-50 border-gray-200 hover:bg-blue-50/50 hover:border-blue-300'
                      }`}
                      title={`${m.monthName.en}: ₹${m.profit.toLocaleString('en-IN')} net profit`}
                    >
                      <div className="h-12 sm:h-16 w-full flex items-end justify-center pb-1">
                        {isEmpty ? (
                          <div className="w-2.5 sm:w-3.5 h-1.5 bg-gray-200 rounded-xs"></div>
                        ) : (
                          <div
                            className={`w-2.5 sm:w-3.5 rounded-xs transition-all group-hover:scale-105 ${
                              hasProfit ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                            style={{
                              height: `${Math.max(10, Math.min(56, Math.round((m.income / (Math.max(...twelveMonthData.months.map(x => x.income)) || 1)) * 56)))}px`
                            }}
                          ></div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-gray-600 block truncate max-w-full">
                        {m.shortLabel[language] || m.shortLabel.en}
                      </span>
                      <span className={`text-[9px] font-extrabold block truncate max-w-full ${isEmpty ? 'text-gray-300' : hasProfit ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {isEmpty ? '-' : `₹${Math.round(m.profit / 1000)}k`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 12 Month Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4.5">
              {twelveMonthData.months.map((m) => {
                const isCurrent = m.isCurrentMonth;
                const isBaseline = m.comparisonType === 'baseline';
                const isEmpty = m.isEmpty;

                return (
                  <div
                    key={m.monthKey}
                    className={`rounded-3xl p-5 border transition-all flex flex-col justify-between card-hover shadow-xs ${
                      isCurrent
                        ? 'bg-gradient-to-b from-white to-amber-50/30 border-amber-300 ring-2 ring-amber-300/20'
                        : isEmpty
                        ? 'bg-gray-50/40 border-gray-200/70 text-gray-400'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div>
                      {/* Month Header */}
                      <div className="flex justify-between items-start pb-3 border-b border-gray-100 mb-3">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className={`font-extrabold text-base ${isEmpty ? 'text-gray-600' : 'text-brand-900'}`}>
                              {m.monthName[language] || m.monthName.en}
                            </h3>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                              isCurrent
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : isEmpty
                                ? 'bg-gray-100 text-gray-500'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {isCurrent ? (loc.monthToDateBadge || "MTD") : isEmpty ? (language === 'mr' ? 'नोंद नाही' : language === 'hi' ? 'कोई गतिविधि नहीं' : 'No Activity') : (loc.fullMonthBadge || "FULL MONTH")}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium block mt-0.5">
                            {m.startDateStr} → {m.endDateStr}
                          </span>
                        </div>

                        {!isEmpty && (
                          <AudioSpeakerButton
                            text={m.speechSummary[language] || m.speechSummary.en}
                            size="sm"
                            title={loc.listenMonth || "Listen to this month's summary"}
                          />
                        )}
                      </div>

                      {/* Content: Empty State vs Active Month */}
                      {isEmpty ? (
                        <div className="py-6 text-center space-y-1.5 bg-white/60 rounded-2xl border border-dashed border-gray-200 my-2">
                          <Clock size={18} className="mx-auto text-gray-300" />
                          <p className="text-xs font-semibold text-gray-500 px-3">
                            {loc.noRecordedTransactions || "No recorded transactions for this month"}
                          </p>
                          <span className="text-[10px] text-gray-400 block">
                            ₹0 income · ₹0 expenses
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {/* Financial Metric Pairs */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 rounded-2xl bg-green-50/60 border border-green-200/80">
                              <span className="text-[10px] font-bold text-green-900 block">{loc.incomeLabel}</span>
                              <span className="text-base font-black text-green-700 block">₹{m.income.toLocaleString('en-IN')}</span>
                              <div className="mt-0.5">
                                {isBaseline ? (
                                  <span className="text-[9px] font-semibold text-gray-400">Baseline</span>
                                ) : m.incomeComparison.diff > 0 ? (
                                  <span className="text-[9px] font-bold text-emerald-700 flex items-center">
                                    <ArrowUpRight size={10} /> +₹{Math.abs(m.incomeComparison.diff).toLocaleString('en-IN')}
                                  </span>
                                ) : m.incomeComparison.diff < 0 ? (
                                  <span className="text-[9px] font-bold text-rose-700 flex items-center">
                                    <ArrowDownRight size={10} /> -₹{Math.abs(m.incomeComparison.diff).toLocaleString('en-IN')}
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-semibold text-gray-400">0%</span>
                                )}
                              </div>
                            </div>

                            <div className="p-2.5 rounded-2xl bg-rose-50/60 border border-rose-200/80">
                              <span className="text-[10px] font-bold text-rose-900 block">{loc.expenseLabel}</span>
                              <span className="text-base font-black text-rose-600 block">₹{m.expenses.toLocaleString('en-IN')}</span>
                              <div className="mt-0.5">
                                {isBaseline ? (
                                  <span className="text-[9px] font-semibold text-gray-400">Baseline</span>
                                ) : m.expenseComparison.diff < 0 ? (
                                  <span className="text-[9px] font-bold text-emerald-700 flex items-center">
                                    <ArrowDownRight size={10} /> -₹{Math.abs(m.expenseComparison.diff).toLocaleString('en-IN')}
                                  </span>
                                ) : m.expenseComparison.diff > 0 ? (
                                  <span className="text-[9px] font-bold text-rose-700 flex items-center">
                                    <ArrowUpRight size={10} /> +₹{m.expenseComparison.diff.toLocaleString('en-IN')}
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-semibold text-gray-400">0%</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 rounded-2xl bg-brand-50/60 border border-brand-200/80">
                              <span className="text-[10px] font-bold text-brand-900 block">{loc.netProfitLabel}</span>
                              <span className="text-base font-black text-brand-900 block">₹{m.profit.toLocaleString('en-IN')}</span>
                              <span className="text-[9px] font-bold text-accent-600 block">{m.profitMarginPercent}% margin</span>
                            </div>

                            <div className="p-2.5 rounded-2xl bg-surface-50 border border-gray-200">
                              <span className="text-[10px] font-bold text-gray-600 block">{loc.outstandingCreditLabel || "Udhaar"}</span>
                              <span className="text-base font-black text-brand-900 block">₹{m.outstandingUdhaar.toLocaleString('en-IN')}</span>
                              <span className="text-[9px] font-semibold text-gray-400 block">{m.activeDaysCount} active days</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Drilldown Button */}
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] text-gray-500 font-semibold">
                        {isEmpty ? '0 entries' : `${m.txCount} transactions`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedMonthKey(m.monthKey)}
                        className="text-xs font-bold text-brand-900 hover:text-accent-600 flex items-center gap-1 transition cursor-pointer"
                      >
                        <span>{loc.viewMonthLedger || "View Month Ledger"}</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* MODE B: DETAILED DRILLDOWN INTO SELECTED MONTH */
          selectedMonthRecord && (
            <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-sm space-y-6 animate-fade-in">
              {/* Drilldown Header */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-6 border-b border-gray-100 gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-2xl font-black text-brand-900">
                      {selectedMonthRecord.monthName[language] || selectedMonthRecord.monthName.en}
                    </h3>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      selectedMonthRecord.isCurrentMonth
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : selectedMonthRecord.isEmpty
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {selectedMonthRecord.isCurrentMonth ? (loc.monthToDateBadge || "MTD") : selectedMonthRecord.isEmpty ? 'No Activity' : (loc.fullMonthBadge || "FULL MONTH")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {selectedMonthRecord.startDateStr} → {selectedMonthRecord.endDateStr} · {selectedMonthRecord.daysInMonth} calendar days ({selectedMonthRecord.activeDaysCount} active business days)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <AudioSpeakerButton
                    text={selectedMonthRecord.speechSummary[language] || selectedMonthRecord.speechSummary.en}
                    size="md"
                    title={loc.listenMonth || "Listen to this month's summary"}
                  />
                  <button
                    onClick={() => setSelectedMonthKey(null)}
                    className="bg-gray-100 hover:bg-gray-200 text-brand-900 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <ChevronLeft size={16} />
                    <span>{loc.backToTwelveMonthOverview || "Back to 12-Month Overview"}</span>
                  </button>
                </div>
              </div>

              {/* 4 Financial Highlight Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-green-50/70 border border-green-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-green-900 uppercase block mb-1">{loc.incomeLabel}</span>
                  <span className="text-2xl font-black text-green-700">₹{selectedMonthRecord.income.toLocaleString('en-IN')}</span>
                  <span className="text-[11px] text-gray-500 block mt-1">Avg ₹{selectedMonthRecord.dailyAvgIncome}/day</span>
                </div>

                <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-rose-900 uppercase block mb-1">{loc.expenseLabel}</span>
                  <span className="text-2xl font-black text-rose-600">₹{selectedMonthRecord.expenses.toLocaleString('en-IN')}</span>
                  <span className="text-[11px] text-gray-500 block mt-1">Avg ₹{selectedMonthRecord.dailyAvgExpenses}/day</span>
                </div>

                <div className="bg-brand-50/70 border border-brand-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-brand-900 uppercase block mb-1">{loc.netProfitLabel}</span>
                  <span className="text-2xl font-black text-brand-900">₹{selectedMonthRecord.profit.toLocaleString('en-IN')}</span>
                  <span className="text-[11px] font-bold text-accent-600 block mt-1">{selectedMonthRecord.profitMarginPercent}% Net Margin</span>
                </div>

                <div className="bg-surface-50 border border-gray-200 rounded-2xl p-4">
                  <span className="text-xs font-bold text-gray-600 uppercase block mb-1">{loc.outstandingCreditLabel || "Udhaar Balance"}</span>
                  <span className="text-2xl font-black text-brand-900">₹{selectedMonthRecord.outstandingUdhaar.toLocaleString('en-IN')}</span>
                  <span className="text-[11px] text-gray-500 block mt-1">{selectedMonthRecord.txCount} transactions</span>
                </div>
              </div>

              {/* Date-wise Transaction Ledger Table */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-extrabold text-sm text-brand-900 flex items-center gap-2">
                    <FileText size={16} className="text-accent-600" />
                    <span>{loc.dateWiseLedgerTitle || "Date-wise Transaction Ledger"}</span>
                  </h4>
                  <span className="text-xs text-gray-400 font-semibold">
                    {selectedMonthRecord.transactions.length} entries in this month
                  </span>
                </div>

                {selectedMonthRecord.transactions.length === 0 ? (
                  <div className="py-10 text-center bg-gray-50/70 rounded-2xl border border-dashed border-gray-200">
                    <FileText size={24} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm font-bold text-gray-600">
                      {loc.noRecordedTransactions || "No recorded transactions for this month"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {language === 'mr' ? 'या महिन्यातील व्हॉइस किंवा मॅन्युअल नोंदी येथे दिसतील.' : language === 'hi' ? 'इस महीने के आवाज़ या मैन्युअल लेन-देन यहाँ दिखाई देंगे।' : 'Transactions recorded for this calendar month will appear here.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-gray-200">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase font-bold tracking-wider">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Description / Item</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-semibold">
                        {selectedMonthRecord.transactions.map((tx: any, idx: number) => {
                          const isIncome = tx.type === 'income';
                          return (
                            <tr key={tx.id || idx} className="hover:bg-gray-50/50">
                              <td className="py-3 px-4 font-mono text-gray-600">
                                {tx.date ? new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                              </td>
                              <td className="py-3 px-4 font-bold text-brand-900">
                                {tx.description || tx.item || 'Business Transaction'}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  isIncome ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {isIncome ? 'Income / विक्री' : 'Expense / खर्च'}
                                </span>
                              </td>
                              <td className={`py-3 px-4 text-right font-black ${isIncome ? 'text-green-700' : 'text-rose-600'}`}>
                                {isIncome ? `+₹${tx.amount?.toLocaleString('en-IN')}` : `-₹${tx.amount?.toLocaleString('en-IN')}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* BANK-READY STATEMENT PREVIEW CARD */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-6 mb-6 border-b border-gray-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-900 text-white rounded-2xl flex items-center justify-center font-black text-xl">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-brand-900">{loc.bankStatementTitle}</h3>
                <span className="text-[10px] font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  VERIFIED FORMAT
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{loc.bankStatementSubtitle}</p>
            </div>
          </div>

          <button
            onClick={generatePdf}
            className="flex items-center gap-2 bg-brand-900 hover:bg-brand-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-sm cursor-pointer"
          >
            <Download size={15} /> {loc.downloadPdfBtn}
          </button>
        </div>

        {/* Statement Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-surface-50 border border-gray-200 mb-6 text-xs">
          <div>
            <span className="text-gray-400 font-semibold block">{loc.proprietorLabel}:</span>
            <span className="font-bold text-brand-900 text-sm mt-0.5 block">{user?.name || "Meena Tai"}</span>
          </div>
          <div>
            <span className="text-gray-400 font-semibold block">{loc.businessNameLabel}:</span>
            <span className="font-bold text-brand-900 text-sm mt-0.5 block">{user?.business_name || "Tiffin Business"}</span>
          </div>
          <div>
            <span className="text-gray-400 font-semibold block">{loc.businessTypeLabel}:</span>
            <span className="font-bold text-brand-900 text-sm mt-0.5 block">{user?.business_type || "Food / Tiffin"}</span>
          </div>
          <div>
            <span className="text-gray-400 font-semibold block">{loc.reportingPeriodLabel}:</span>
            <span className="font-bold text-brand-900 text-sm mt-0.5 block">Past 90 Days</span>
          </div>
        </div>

        {/* Monthly Operations Table (Exact 3 Calendar Months) */}
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 uppercase font-bold tracking-wider">
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Gross Income</th>
                <th className="py-3 px-4">Recorded Expenses</th>
                <th className="py-3 px-4 text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-semibold">
              {months.map((m, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="py-3 px-4 font-bold text-brand-900">
                    {m.monthName[language] || m.monthName.en}
                    <span className="text-[10px] text-gray-400 block font-normal">
                      {m.startDateStr} → {m.endDateStr} {m.isCurrentMonth ? '(MTD)' : ''}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-green-700">₹{m.income.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 text-rose-600">-₹{m.expenses.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 text-right font-bold text-brand-900">₹{m.profit.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-extrabold text-sm text-brand-900 bg-gray-50/50">
                <td className="py-3 px-4">Total 90-Day Summary</td>
                <td className="py-3 px-4 text-green-700">₹{totalIncome.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 text-rose-600">-₹{totalExpenses.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 text-right text-brand-900">₹{netProfit.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Declaration Statement */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs text-gray-600 leading-relaxed italic">
          "{loc.statementDeclaration}" — <strong>{user?.name || "Entrepreneur"}</strong>
        </div>
      </div>

      {/* MANDATORY TRANSPARENT DISCLAIMER BANNER */}
      <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start text-amber-900 text-xs leading-relaxed font-medium">
        <AlertCircle size={20} className="mr-3 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <p className="font-bold mb-1">Important Transparency & Regulatory Disclaimer:</p>
          <p>{loc.notCreditScoreNotice} {loc.disclaimer}</p>
        </div>
      </div>

      {/* RECORD STRENGTH CALCULATION EXPLANATION MODAL */}
      {showScoreModal && (
        <div className="fixed inset-0 z-50 bg-brand-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl border border-gray-100 relative space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <Award size={22} className="text-accent-600" />
                  <h3 className="text-xl font-extrabold text-brand-900">
                    {loc.recordStrengthBreakdownTitle || "Record Strength Breakdown & Scoring Factors"}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'mr' ? 'तुमचा सध्याचा स्कोअर ४५/१०० का आहे आणि तो कसा मोजला जातो याचे स्पष्टीकरण.' : language === 'hi' ? 'आपका वर्तमान स्कोर 45/100 क्यों है और इसकी गणना कैसे की जाती है, इसका स्पष्ट विवरण।' : 'Exact breakdown explaining why your current score is 45/100 and how each factor contributes.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowScoreModal(false)}
                className="text-gray-400 hover:text-brand-900 p-1.5 rounded-xl hover:bg-gray-100 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Total Score Banner */}
            <div className="bg-gradient-to-r from-brand-900 to-slate-900 text-white rounded-2xl p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <span className="text-xs font-bold text-accent-400 uppercase tracking-wider block">
                  {loc.scoreTotalOutOf || "Total Record Strength Score"}
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-4xl font-black">{scoreBreakdown.totalScore}</span>
                  <span className="text-lg text-gray-400 font-bold">/ 100</span>
                </div>
                <p className="text-xs text-gray-300 mt-2 font-medium leading-relaxed">
                  {scoreBreakdown.scoreStatusText[language] || scoreBreakdown.scoreStatusText.en}
                </p>
              </div>
              <div className="bg-white/10 border border-white/10 rounded-xl p-3 text-center sm:min-w-[140px]">
                <span className="text-[10px] text-gray-300 block font-semibold uppercase">Current Tier</span>
                <span className="text-sm font-extrabold text-accent-300 block mt-0.5">
                  {scoreBreakdown.totalScore >= 80 ? (loc.scoreStatusBankReady || 'Bank-Ready') : scoreBreakdown.totalScore >= 50 ? (loc.scoreStatusProgressing || 'Building Track') : (loc.scoreStatusEarly || 'Early Starter')}
                </span>
              </div>
            </div>

            {/* 4 Contributing Scoring Factors */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold text-brand-900 uppercase tracking-wider">
                {language === 'mr' ? '४ मुख्य मूल्यमापन घटक (Scoring Factors):' : language === 'hi' ? '4 मुख्य मूल्यांकन कारक (Scoring Factors):' : '4 Core Scoring Factors:'}
              </h4>

              <div className="grid grid-cols-1 gap-3">
                {/* Factor 1: Active Logging Frequency */}
                <div className="p-4 rounded-2xl bg-surface-50 border border-gray-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-brand-900">
                      {loc.scoreFactorLoggingTitle || "1. Active Logging Frequency (Consistency)"}
                    </span>
                    <span className="font-black text-accent-600 bg-accent-50 px-2 py-0.5 rounded-md border border-accent-100">
                      {scoreBreakdown.factors.loggingFrequency.earnedPoints} / {scoreBreakdown.factors.loggingFrequency.maxPoints} pts
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-accent-500 h-2 rounded-full transition-all"
                      style={{ width: `${(scoreBreakdown.factors.loggingFrequency.earnedPoints / scoreBreakdown.factors.loggingFrequency.maxPoints) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-gray-500">
                    <span>{scoreBreakdown.factors.loggingFrequency.description[language] || scoreBreakdown.factors.loggingFrequency.description.en}</span>
                    <span className="font-bold text-brand-900 shrink-0 ml-2">{scoreBreakdown.factors.loggingFrequency.actualMetric}</span>
                  </div>
                </div>

                {/* Factor 2: Transaction Completeness & Depth */}
                <div className="p-4 rounded-2xl bg-surface-50 border border-gray-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-brand-900">
                      {loc.scoreFactorDepthTitle || "2. Transaction Completeness & Depth"}
                    </span>
                    <span className="font-black text-accent-600 bg-accent-50 px-2 py-0.5 rounded-md border border-accent-100">
                      {scoreBreakdown.factors.transactionDepth.earnedPoints} / {scoreBreakdown.factors.transactionDepth.maxPoints} pts
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-accent-500 h-2 rounded-full transition-all"
                      style={{ width: `${(scoreBreakdown.factors.transactionDepth.earnedPoints / scoreBreakdown.factors.transactionDepth.maxPoints) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-gray-500">
                    <span>{scoreBreakdown.factors.transactionDepth.description[language] || scoreBreakdown.factors.transactionDepth.description.en}</span>
                    <span className="font-bold text-brand-900 shrink-0 ml-2">{scoreBreakdown.factors.transactionDepth.actualMetric}</span>
                  </div>
                </div>

                {/* Factor 3: Operational Cashflow & Net Margin */}
                <div className="p-4 rounded-2xl bg-surface-50 border border-gray-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-brand-900">
                      {loc.scoreFactorCashflowTitle || "3. Operational Cashflow & Net Margin"}
                    </span>
                    <span className="font-black text-accent-600 bg-accent-50 px-2 py-0.5 rounded-md border border-accent-100">
                      {scoreBreakdown.factors.marginAndCashflow.earnedPoints} / {scoreBreakdown.factors.marginAndCashflow.maxPoints} pts
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-accent-500 h-2 rounded-full transition-all"
                      style={{ width: `${(scoreBreakdown.factors.marginAndCashflow.earnedPoints / scoreBreakdown.factors.marginAndCashflow.maxPoints) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-gray-500">
                    <span>{scoreBreakdown.factors.marginAndCashflow.description[language] || scoreBreakdown.factors.marginAndCashflow.description.en}</span>
                    <span className="font-bold text-brand-900 shrink-0 ml-2">{scoreBreakdown.factors.marginAndCashflow.actualMetric}</span>
                  </div>
                </div>

                {/* Factor 4: Udhaar Collection & Discipline */}
                <div className="p-4 rounded-2xl bg-surface-50 border border-gray-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-brand-900">
                      {loc.scoreFactorDisciplineTitle || "4. Udhaar Collection & Discipline"}
                    </span>
                    <span className="font-black text-accent-600 bg-accent-50 px-2 py-0.5 rounded-md border border-accent-100">
                      {scoreBreakdown.factors.udhaarDiscipline.earnedPoints} / {scoreBreakdown.factors.udhaarDiscipline.maxPoints} pts
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-accent-500 h-2 rounded-full transition-all"
                      style={{ width: `${(scoreBreakdown.factors.udhaarDiscipline.earnedPoints / scoreBreakdown.factors.udhaarDiscipline.maxPoints) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-gray-500">
                    <span>{scoreBreakdown.factors.udhaarDiscipline.description[language] || scoreBreakdown.factors.udhaarDiscipline.description.en}</span>
                    <span className="font-bold text-brand-900 shrink-0 ml-2">{scoreBreakdown.factors.udhaarDiscipline.actualMetric}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Missing Records Section */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4.5 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 text-xs font-extrabold">
                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                <span>{loc.scoreMissingRecordsTitle || "What records or activities are missing?"}</span>
              </div>
              <ul className="text-xs text-amber-950 space-y-1.5 pl-6 list-disc font-medium">
                {(scoreBreakdown.missingRecords[language] || scoreBreakdown.missingRecords.en).map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Actionable Steps to reach 80+ */}
            <div className="bg-green-50/80 border border-green-200/80 rounded-2xl p-4.5 space-y-2">
              <div className="flex items-center gap-2 text-green-900 text-xs font-extrabold">
                <Sparkles size={16} className="text-green-600 shrink-0" />
                <span>{loc.scoreImprovementStepsTitle || "How to increase your score to 80+ for Bank readiness:"}</span>
              </div>
              <ul className="text-xs text-green-950 space-y-1.5 pl-6 list-disc font-medium">
                {(scoreBreakdown.actionableSteps[language] || scoreBreakdown.actionableSteps.en).map((step: string, i: number) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>

            {/* Close Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScoreModal(false)}
                className="bg-brand-900 hover:bg-brand-800 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer btn-press"
              >
                {language === 'mr' ? 'समजले, बंद करा' : language === 'hi' ? 'समझ गए, बंद करें' : 'Got it, Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
