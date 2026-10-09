/**
 * Deterministic Financial Analysis Engine (Challenge 2)
 * Computes:
 * - Week-over-Week (WoW) comparison with percentage changes
 * - Month-over-Month (MoMo) comparison
 * - Highest spending categories
 * - Peak sales days (weekdays with highest revenue)
 * - Safely handles zero denominators and missing historical data
 */

import { Transaction } from '../context/AppContext';

export interface CategoryComparison {
  category: string;
  currentAmount: number;
  previousAmount: number;
  absoluteChange: number;
  percentageChange: number | null; // null if previousAmount is 0 (new spending)
  trend: 'up' | 'down' | 'same' | 'new';
}

export interface PeriodAnalysis {
  currentPeriodLabel: { mr: string; hi: string; en: string };
  previousPeriodLabel: { mr: string; hi: string; en: string };
  currentIncome: number;
  previousIncome: number;
  incomeChangePct: number | null;
  currentExpense: number;
  previousExpense: number;
  expenseChangePct: number | null;
  currentProfit: number;
  previousProfit: number;
  categoryComparisons: CategoryComparison[];
  peakSalesDay: {
    dayName: string;
    dayRevenue: number;
    shareOfWeeklyRevenue: number;
  } | null;
  insightsNarrative: {
    mr: string[];
    hi: string[];
    en: string[];
  };
  hasSufficientData: boolean;
}

export function computeFinancialAnalysis(
  transactions: Transaction[],
  mode: 'wow' | 'momo' = 'wow'
): PeriodAnalysis {
  if (!transactions || transactions.length === 0) {
    return {
      currentPeriodLabel: {
        en: mode === 'wow' ? 'This Week (Last 7 Days)' : 'Current Month (Last 30 Days)',
        mr: mode === 'wow' ? 'चालू आठवडा (शेवटचे ७ दिवस)' : 'चालू महिना (शेवटचे ३० दिवस)',
        hi: mode === 'wow' ? 'चालू सप्ताह (अंतिम 7 दिन)' : 'चालू माह (अंतिम 30 दिन)',
      },
      previousPeriodLabel: {
        en: mode === 'wow' ? 'Last Week (Prior 7 Days)' : 'Previous Month (Prior 30 Days)',
        mr: mode === 'wow' ? 'मागील आठवडा (मागील ७ दिवस)' : 'मागील महिना (मागील ३० दिवस)',
        hi: mode === 'wow' ? 'पिछला सप्ताह (पूर्व 7 दिन)' : 'पिछला माह (पूर्व 30 दिन)',
      },
      currentIncome: 0,
      previousIncome: 0,
      incomeChangePct: null,
      currentExpense: 0,
      previousExpense: 0,
      expenseChangePct: null,
      currentProfit: 0,
      previousProfit: 0,
      categoryComparisons: [],
      peakSalesDay: null,
      insightsNarrative: { mr: [], hi: [], en: [] },
      hasSufficientData: false
    };
  }

  const now = new Date();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  // Define date windows
  let currStart: Date;
  let currEnd: Date;
  let prevStart: Date;
  let prevEnd: Date;

  let currentPeriodLabel = {
    en: mode === 'wow' ? 'This Week (Last 7 Days)' : 'Current Month (Last 30 Days)',
    mr: mode === 'wow' ? 'चालू आठवडा (शेवटचे ७ दिवस)' : 'चालू महिना (शेवटचे ३० दिवस)',
    hi: mode === 'wow' ? 'चालू सप्ताह (अंतिम 7 दिन)' : 'चालू माह (अंतिम 30 दिन)',
  };
  let previousPeriodLabel = {
    en: mode === 'wow' ? 'Last Week (Prior 7 Days)' : 'Previous Month (Prior 30 Days)',
    mr: mode === 'wow' ? 'मागील आठवडा (मागील ७ दिवस)' : 'मागील महिना (मागील ३० दिवस)',
    hi: mode === 'wow' ? 'पिछला सप्ताह (पूर्व 7 दिन)' : 'पिछला माह (पूर्व 30 दिन)',
  };

  if (mode === 'wow') {
    // Current period = Last 7 days
    currEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    currStart = new Date(currEnd.getTime() - 6 * MS_PER_DAY);
    currStart.setHours(0, 0, 0, 0);

    // Previous period = 7 days before current period
    prevEnd = new Date(currStart.getTime() - 1);
    prevStart = new Date(prevEnd.getTime() - 6 * MS_PER_DAY);
    prevStart.setHours(0, 0, 0, 0);
  } else {
    // MoMo: Current 30 days vs Previous 30 days
    currEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    currStart = new Date(currEnd.getTime() - 29 * MS_PER_DAY);
    currStart.setHours(0, 0, 0, 0);

    prevEnd = new Date(currStart.getTime() - 1);
    prevStart = new Date(prevEnd.getTime() - 29 * MS_PER_DAY);
    prevStart.setHours(0, 0, 0, 0);
  }

  const parseTxDate = (t: Transaction): Date => {
    return new Date(t.date + 'T00:00:00');
  };

  const currTxns = transactions.filter(t => {
    const d = parseTxDate(t);
    return d >= currStart && d <= currEnd;
  });

  const prevTxns = transactions.filter(t => {
    const d = parseTxDate(t);
    return d >= prevStart && d <= prevEnd;
  });

  const hasSufficientData = currTxns.length > 0 || prevTxns.length > 0;

  // Calculate totals
  const currentIncome = currTxns.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
  const previousIncome = prevTxns.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);

  const currentExpense = currTxns.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const previousExpense = prevTxns.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  const currentProfit = currentIncome - currentExpense;
  const previousProfit = previousIncome - previousExpense;

  const calcPct = (curr: number, prev: number): number | null => {
    if (prev === 0) return null;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const incomeChangePct = calcPct(currentIncome, previousIncome);
  const expenseChangePct = calcPct(currentExpense, previousExpense);

  // Category-wise expenses
  const currCatTotals: Record<string, number> = {};
  currTxns.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category || 'General';
    currCatTotals[cat] = (currCatTotals[cat] || 0) + t.amount;
  });

  const prevCatTotals: Record<string, number> = {};
  prevTxns.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category || 'General';
    prevCatTotals[cat] = (prevCatTotals[cat] || 0) + t.amount;
  });

  const allCategories = Array.from(new Set([...Object.keys(currCatTotals), ...Object.keys(prevCatTotals)]));

  const categoryComparisons: CategoryComparison[] = allCategories.map(cat => {
    const cVal = currCatTotals[cat] || 0;
    const pVal = prevCatTotals[cat] || 0;
    const diff = cVal - pVal;
    let pct: number | null = null;
    let trend: 'up' | 'down' | 'same' | 'new' = 'same';

    if (pVal === 0 && cVal > 0) {
      trend = 'new';
    } else if (pVal > 0) {
      pct = Math.round((diff / pVal) * 100);
      if (diff > 0) trend = 'up';
      else if (diff < 0) trend = 'down';
    }

    return {
      category: cat,
      currentAmount: Math.round(cVal),
      previousAmount: Math.round(pVal),
      absoluteChange: Math.round(diff),
      percentageChange: pct,
      trend
    };
  }).sort((a, b) => b.currentAmount - a.currentAmount);

  // Peak sales day calculation (by weekday)
  const weekdayTotals: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const weekdayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayNamesMr = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  const weekdayNamesHi = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];

  currTxns.filter(t => t.type === 'sale').forEach(t => {
    const d = parseTxDate(t);
    weekdayTotals[d.getDay()] += t.amount;
  });

  let bestDayIdx = -1;
  let bestDayAmt = 0;
  Object.entries(weekdayTotals).forEach(([dStr, amt]) => {
    const day = parseInt(dStr);
    if (amt > bestDayAmt) {
      bestDayAmt = amt;
      bestDayIdx = day;
    }
  });

  let peakSalesDay = null;
  if (bestDayIdx >= 0 && currentIncome > 0) {
    const share = Math.round((bestDayAmt / currentIncome) * 100);
    peakSalesDay = {
      dayName: weekdayNamesEn[bestDayIdx],
      dayRevenue: Math.round(bestDayAmt),
      shareOfWeeklyRevenue: share
    };
  }

  // Generate deterministic multilingual narratives
  const narrativesMr: string[] = [];
  const narrativesHi: string[] = [];
  const narrativesEn: string[] = [];

  // 1. Income narrative
  if (incomeChangePct !== null && incomeChangePct !== 0) {
    if (incomeChangePct > 0) {
      narrativesMr.push(`मागील कालावधीच्या तुलनेत उत्पन्नात ${incomeChangePct}% ची वाढ झाली आहे.`);
      narrativesHi.push(`पिछले समय की तुलना में बिक्री में ${incomeChangePct}% की बढ़त दर्ज की गई है।`);
      narrativesEn.push(`Revenue increased by ${incomeChangePct}% compared to the previous period.`);
    } else {
      narrativesMr.push(`मागील कालावधीच्या तुलनेत उत्पन्नात ${Math.abs(incomeChangePct)}% ची घट झाली आहे.`);
      narrativesHi.push(`पिछले समय की तुलना में बिक्री में ${Math.abs(incomeChangePct)}% की कमी आई है।`);
      narrativesEn.push(`Revenue dropped by ${Math.abs(incomeChangePct)}% compared to the previous period.`);
    }
  }

  // 2. Rising expense narrative
  const risingExpense = categoryComparisons.find(c => c.trend === 'up' && c.percentageChange && c.percentageChange >= 15);
  if (risingExpense) {
    narrativesMr.push(`${risingExpense.category} चा खर्च ${risingExpense.percentageChange}% ने वाढला आहे (₹${risingExpense.previousAmount} वरून ₹${risingExpense.currentAmount}).`);
    narrativesHi.push(`${risingExpense.category} का खर्च ${risingExpense.percentageChange}% बढ़ा है (₹${risingExpense.previousAmount} से ₹${risingExpense.currentAmount})।`);
    narrativesEn.push(`${risingExpense.category} spending surged by ${risingExpense.percentageChange}% (from ₹${risingExpense.previousAmount} to ₹${risingExpense.currentAmount}).`);
  }

  // 3. Peak sales day narrative
  if (peakSalesDay && bestDayIdx >= 0) {
    narrativesMr.push(`${weekdayNamesMr[bestDayIdx]} हा सर्वाधिक विक्रीचा दिवस ठरला असून एकूण उत्पन्नाच्या ${peakSalesDay.shareOfWeeklyRevenue}% कमाई झाली.`);
    narrativesHi.push(`${weekdayNamesHi[bestDayIdx]} को सबसे अधिक बिक्री हुई, जो कुल आय का ${peakSalesDay.shareOfWeeklyRevenue}% है।`);
    narrativesEn.push(`${peakSalesDay.dayName} was your peak sales day, contributing ${peakSalesDay.shareOfWeeklyRevenue}% of total revenue.`);
  }

  return {
    currentPeriodLabel,
    previousPeriodLabel,
    currentIncome: Math.round(currentIncome),
    previousIncome: Math.round(previousIncome),
    incomeChangePct,
    currentExpense: Math.round(currentExpense),
    previousExpense: Math.round(previousExpense),
    expenseChangePct,
    currentProfit: Math.round(currentProfit),
    previousProfit: Math.round(previousProfit),
    categoryComparisons,
    peakSalesDay,
    insightsNarrative: {
      mr: narrativesMr,
      hi: narrativesHi,
      en: narrativesEn
    },
    hasSufficientData
  };
}
