import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  PieChart as PieChartIcon, TrendingUp, TrendingDown, CheckCircle, 
  Sparkles, DollarSign, Percent, Calendar, ArrowUpRight, ArrowDownRight, 
  HelpCircle, Volume2, ShieldAlert
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { computeFinancialAnalysis } from '../lib/financialAnalysis';
import { generateDynamicAlerts, FinancialAlert } from '../lib/alertEngine';
import { AudioSpeakerButton } from '../components/AudioSpeakerButton';
import { UdhaarEntry } from './UdhaarKhata';

export default function Insights() {
  const { loc, businessContext, language, financialSummary, transactions, user } = useAppContext();
  const [analysisMode, setAnalysisMode] = useState<'wow' | 'momo'>('wow');

  const {
    totalIncome,
    totalExpenses,
    netProfit,
    profitMarginPercent,
    categoryBreakdown
  } = financialSummary;

  // Run Deterministic Period Analysis (Challenge 2)
  const analysis = computeFinancialAnalysis(transactions, analysisMode);

  // Load Udhaar for Alerts (Challenge 3)
  let udhaarList: UdhaarEntry[] = [];
  try {
    const storageKey = `khata_udhaar_${user?.email || user?.id || 'default'}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) udhaarList = JSON.parse(saved);
  } catch {}

  const dynamicAlerts = generateDynamicAlerts(transactions, udhaarList);

  // Category breakdown for Pie Chart
  const pieData = categoryBreakdown.length > 0 
    ? categoryBreakdown 
    : (businessContext?.categories?.expenses || ['Raw Material', 'Supplies', 'Utilities']).map((c: string, idx: number) => ({
        name: c,
        value: (idx + 1) * 800
      }));

  const COLORS = ['#f43f5e', '#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

  // Unit Margin calculation
  const salesWithQty = transactions.filter(t => t.type === 'sale' && t.quantity && t.quantity > 0);
  const totalQtySold = salesWithQty.reduce((acc, t) => acc + (t.quantity || 0), 0);
  const totalSalesRevenue = salesWithQty.reduce((acc, t) => acc + t.amount, 0);
  
  const avgSellingPrice = totalQtySold > 0 ? Math.round(totalSalesRevenue / totalQtySold) : (businessContext?.marginData?.sellingPrice || 70);
  const estimatedCostPerUnit = totalQtySold > 0 ? Math.round((totalExpenses / totalQtySold)) : (businessContext?.marginData?.estimatedCost || 35);
  const estimatedUnitProfit = Math.max(0, avgSellingPrice - estimatedCostPerUnit);
  const actualMarginPercent = avgSellingPrice > 0 ? Math.round((estimatedUnitProfit / avgSellingPrice) * 100) : 50;

  const recordedProduct = salesWithQty.length > 0
    ? salesWithQty[0].item.replace(/^\d+\s*[×x]\s*/, '').replace(/\(.*?\)/g, '').trim()
    : null;
  const displayProductName = recordedProduct || (businessContext?.marginData?.product?.[language] || businessContext?.marginData?.product?.en || "Standard Unit");

  const highestExpenseCat = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-900 tracking-tight">{loc.insightsTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">{loc.insightsSubtitle}</p>
        </div>

        {/* Period Selector Toggle (WoW vs MoMo) */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-gray-200 shadow-xs self-start md:self-auto">
          <button
            onClick={() => setAnalysisMode('wow')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              analysisMode === 'wow'
                ? 'bg-brand-900 text-white shadow-xs'
                : 'text-gray-600 hover:text-brand-900'
            }`}
          >
            आठवडा तुलना (Week-over-Week)
          </button>
          <button
            onClick={() => setAnalysisMode('momo')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              analysisMode === 'momo'
                ? 'bg-brand-900 text-white shadow-xs'
                : 'text-gray-600 hover:text-brand-900'
            }`}
          >
            महिना तुलना (Month-over-Month)
          </button>
        </div>
      </div>

      {/* CHALLENGE 2: DETERMINISTIC PERIOD COMPARISON CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Income Card */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {analysisMode === 'wow' 
                ? (language === 'mr' ? 'आठवडी विक्री' : language === 'hi' ? 'साप्ताहिक बिक्री' : 'Weekly Sales')
                : (language === 'mr' ? 'मासिक विक्री' : language === 'hi' ? 'मासिक बिक्री' : 'Monthly Sales')}
            </span>
            <AudioSpeakerButton
              text={
                language === 'mr'
                  ? `चालू कालावधीत विक्री ₹${analysis.currentIncome} झाली असून मागील कालावधीत ₹${analysis.previousIncome} होती.`
                  : language === 'hi'
                  ? `चालू अवधि में बिक्री ₹${analysis.currentIncome} रही, जबकि पिछली अवधि में ₹${analysis.previousIncome} थी।`
                  : `Current period sales were ₹${analysis.currentIncome} compared to ₹${analysis.previousIncome} previously.`
              }
              size="sm"
            />
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-brand-900">
              ₹{analysis.currentIncome.toLocaleString('en-IN')}
            </span>
            {analysis.incomeChangePct !== null ? (
              <span className={`text-xs font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                analysis.incomeChangePct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}>
                {analysis.incomeChangePct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(analysis.incomeChangePct)}%
              </span>
            ) : (
              <span className="text-[11px] text-gray-400 font-semibold">New Data</span>
            )}
          </div>
          <span className="text-[11px] text-gray-400 block mt-1">
            Previous: ₹{analysis.previousIncome.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Expense Card */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {analysisMode === 'wow' 
                ? (language === 'mr' ? 'आठवडी खर्च' : language === 'hi' ? 'साप्ताहिक खर्च' : 'Weekly Expenses')
                : (language === 'mr' ? 'मासिक खर्च' : language === 'hi' ? 'मासिक खर्च' : 'Monthly Expenses')}
            </span>
            <AudioSpeakerButton
              text={
                language === 'mr'
                  ? `चालू कालावधीत खर्च ₹${analysis.currentExpense} झाला आहे.`
                  : language === 'hi'
                  ? `चालू अवधि में कुल खर्च ₹${analysis.currentExpense} रहा।`
                  : `Current period expenses were ₹${analysis.currentExpense}.`
              }
              size="sm"
            />
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-rose-600">
              ₹{analysis.currentExpense.toLocaleString('en-IN')}
            </span>
            {analysis.expenseChangePct !== null ? (
              <span className={`text-xs font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                analysis.expenseChangePct <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}>
                {analysis.expenseChangePct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(analysis.expenseChangePct)}%
              </span>
            ) : (
              <span className="text-[11px] text-gray-400 font-semibold">{language === 'mr' ? 'नवीन खर्च' : language === 'hi' ? 'नया खर्च' : 'New Spending'}</span>
            )}
          </div>
          <span className="text-[11px] text-gray-400 block mt-1">
            {language === 'mr' ? 'मागील:' : language === 'hi' ? 'पिछला:' : 'Previous:'} ₹{analysis.previousExpense.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Net Profit Card */}
        <div className="bg-gradient-to-br from-brand-900 to-slate-900 text-white p-5 rounded-3xl shadow-md flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-accent-300 uppercase tracking-wider">
              {language === 'mr' ? 'निव्वळ नफा' : language === 'hi' ? 'शुद्ध मुनाफ़ा' : 'Net Profit'}
            </span>
            <AudioSpeakerButton
              text={
                language === 'mr'
                  ? `या कालावधीत निव्वळ नफा ₹${analysis.currentProfit} राहिला आहे.`
                  : language === 'hi'
                  ? `इस अवधि में शुद्ध लाभ ₹${analysis.currentProfit} रहा।`
                  : `Net profit for this period is ₹${analysis.currentProfit}.`
              }
              size="sm"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            />
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-white">
              ₹{analysis.currentProfit.toLocaleString('en-IN')}
            </span>
            <span className="text-xs font-bold text-accent-400 bg-white/10 px-2.5 py-0.5 rounded-full">
              {profitMarginPercent}% Margin
            </span>
          </div>
          <span className="text-[11px] text-gray-300 block mt-1">
            Previous: ₹{analysis.previousProfit.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* CHALLENGE 2: "WHAT CHANGED?" SPENDING PATTERN SHIFTS & PEAK SALES DAYS */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-accent-500" />
            <h3 className="font-extrabold text-brand-900 text-lg">
              {language === 'mr' ? 'खर्चात व विक्रीत काय बदल झाला?' : language === 'hi' ? 'खर्च और बिक्री में क्या बदलाव हुआ?' : 'Spending & Sales Pattern Changes'}
            </h3>
          </div>
          <span className="text-xs text-gray-400 font-semibold">
            {analysis.currentPeriodLabel[language] || analysis.currentPeriodLabel.en} vs {analysis.previousPeriodLabel[language] || analysis.previousPeriodLabel.en}
          </span>
        </div>

        {/* Narrative Insights List */}
        {analysis.insightsNarrative[language]?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {analysis.insightsNarrative[language].map((narrative, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-surface-50 border border-gray-200 flex items-start justify-between gap-3">
                <p className="text-xs font-semibold text-brand-900 leading-relaxed">
                  💡 {narrative}
                </p>
                <AudioSpeakerButton text={narrative} size="sm" className="shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-gray-50 text-xs text-gray-500 text-center font-medium">
            नोंदी वाढल्यावर अधिक अचूक ट्रेंड दिसतील (Record more daily transactions to unlock deeper spending patterns).
          </div>
        )}

        {/* Detailed Category Shifts Table */}
        {analysis.categoryComparisons.length > 0 && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-extrabold">
                  <th className="py-2.5">Category</th>
                  <th className="py-2.5">Current Spend</th>
                  <th className="py-2.5">Previous Spend</th>
                  <th className="py-2.5">Change</th>
                  <th className="py-2.5 text-right">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analysis.categoryComparisons.map((cat, i) => (
                  <tr key={i} className="hover:bg-gray-50/60 transition">
                    <td className="py-2.5 font-bold text-brand-900">{cat.category}</td>
                    <td className="py-2.5 font-semibold text-gray-800">₹{cat.currentAmount.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 text-gray-500">₹{cat.previousAmount.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 font-extrabold">
                      {cat.trend === 'new' ? (
                        <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">New Spending</span>
                      ) : cat.percentageChange !== null ? (
                        <span className={cat.percentageChange > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          {cat.percentageChange > 0 ? `+${cat.percentageChange}%` : `${cat.percentageChange}%`}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {cat.trend === 'up' && <span className="text-rose-600 font-bold">▲ Increased</span>}
                      {cat.trend === 'down' && <span className="text-emerald-600 font-bold">▼ Decreased</span>}
                      {cat.trend === 'same' && <span className="text-gray-400">Stable</span>}
                      {cat.trend === 'new' && <span className="text-blue-600">First Time</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CHALLENGE 3: FULL ACTIONABLE FINANCIAL ALERTS & SMART BUSINESS COACH */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-amber-500" />
            <h3 className="font-extrabold text-brand-900 text-lg">
              {language === 'mr' ? 'सक्रिय आर्थिक अलर्ट व व्यवसाय सल्ला' : language === 'hi' ? 'सक्रिय वित्तीय अलर्ट और व्यापार सलाह' : 'Active Financial Alerts & Business Suggestions'}
            </h3>
          </div>
          <span className="text-xs font-bold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
            {dynamicAlerts.length} {language === 'mr' ? 'अलर्ट' : language === 'hi' ? 'अलर्ट' : 'Alerts'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dynamicAlerts.map(alert => {
            const isRed = alert.severity === 'red';
            const isAmber = alert.severity === 'amber';
            const isGreen = alert.severity === 'green';

            return (
              <div
                key={alert.id}
                className={`p-5 rounded-2xl border flex flex-col justify-between gap-3 ${
                  isRed
                    ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                    : isAmber
                    ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                    : isGreen
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-blue-50/80 border-blue-200 text-blue-950'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-black text-sm">
                      {alert.title[language] || alert.title.en}
                    </span>
                    <AudioSpeakerButton
                      text={alert.speechText[language] || alert.speechText.en}
                      size="sm"
                      title={language === 'mr' ? 'अलर्ट ऐका' : language === 'hi' ? 'अलर्ट सुनें' : 'Listen to Alert'}
                    />
                  </div>

                  <p className="text-xs opacity-90 leading-relaxed font-medium">
                    {alert.description[language] || alert.description.en}
                  </p>
                </div>

                <div className="pt-2 border-t border-black/10 flex items-center justify-between text-xs font-bold text-accent-700">
                  <span>👉 {alert.recommendedAction[language] || alert.recommendedAction.en}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MARGIN FINDER & EXPENSE PIE CHART */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Real Item Margin Finder */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-extrabold text-brand-900 text-lg flex items-center gap-2">
                <Percent className="w-5 h-5 text-accent-500" />
                <span>{loc.marginFinderTitle}</span>
              </h3>
              <span className="text-[11px] font-bold bg-green-50 text-green-700 px-2.5 py-1 rounded-lg border border-green-200">
                Calculated from Records
              </span>
            </div>

            <div className="bg-surface-50 p-6 rounded-2xl mb-6 border border-gray-200 space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-500 uppercase text-xs tracking-wider">Product / Service</span>
                <span className="font-bold text-brand-900 text-base">
                  {displayProductName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-500 uppercase text-xs tracking-wider">Avg. Selling Price</span>
                <span className="font-extrabold text-green-700 text-lg">₹{avgSellingPrice}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-500 uppercase text-xs tracking-wider">Direct Operational Cost</span>
                <span className="font-extrabold text-rose-500 text-lg">- ₹{estimatedCostPerUnit}</span>
              </div>
              <div className="border-t border-gray-300 pt-4 flex justify-between items-center">
                <span className="font-extrabold text-brand-900 text-sm uppercase tracking-wider">{loc.profitMarginLabel}</span>
                <div className="text-right">
                  <span className="font-black text-accent-600 text-2xl">{actualMarginPercent}%</span>
                  <span className="text-xs text-gray-500 block font-medium">(₹{estimatedUnitProfit} per unit)</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 italic">
            * Margin is computed using your recorded unit quantities and expense ratios.
          </p>
        </div>

        {/* Real Expense Category Breakdown Pie Chart */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-brand-900 text-lg mb-6 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-brand-900" />
              <span>{loc.expenseBreakdownTitle}</span>
            </h3>

            <div className="h-56 flex justify-center items-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-extrabold text-brand-900 text-lg">₹{totalExpenses.toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-gray-400 uppercase font-bold">Total Costs</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 mt-4">
              {pieData.map((entry: any, index: number) => (
                <div key={index} className="flex items-center text-xs font-semibold text-gray-600 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                  <div className="w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span>{entry.name}: ₹{entry.value.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>

          {highestExpenseCat && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-600 flex items-center gap-2">
              <Sparkles size={14} className="text-accent-500 shrink-0" />
              <span><strong>{highestExpenseCat.name}</strong> accounts for the largest share of your expenses.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
