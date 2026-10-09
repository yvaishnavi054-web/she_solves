/**
 * Dynamic Financial Alerts and Smart Business Suggestions Engine (Challenge 3)
 * Evaluates real transaction logs and Udhaar records to generate explainable alerts:
 * 1. Cash Flow Crunch Alert (Expenses > Income)
 * 2. Uncollected Udhaar Alert (>15 days pending)
 * 3. Spending Spike Alert (Category surge >= 25%)
 * 4. Repeated Loss / Low Margin Alert
 * 5. Smart Business Suggestions (Actionable recommendations grounded in data)
 */

import { Transaction } from '../context/AppContext';
import { UdhaarEntry } from '../pages/UdhaarKhata';

export type AlertSeverity = 'red' | 'amber' | 'blue' | 'green';

export interface FinancialAlert {
  id: string;
  type: 'cash_flow_crunch' | 'uncollected_udhaar' | 'spending_spike' | 'low_margin' | 'smart_suggestion';
  severity: AlertSeverity;
  title: {
    mr: string;
    hi: string;
    en: string;
  };
  description: {
    mr: string;
    hi: string;
    en: string;
  };
  amountOrMetric?: string;
  comparisonPeriod?: string;
  recommendedAction: {
    mr: string;
    hi: string;
    en: string;
  };
  speechText: {
    mr: string;
    hi: string;
    en: string;
  };
  linkTo?: string;
}

export function generateDynamicAlerts(
  transactions: Transaction[],
  udhaarEntries: UdhaarEntry[] = []
): FinancialAlert[] {
  const alerts: FinancialAlert[] = [];
  if (!transactions || transactions.length === 0) return alerts;

  const now = new Date();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  // 1. Current Month Cash Flow Crunch Check
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthTxns = transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear;
  });

  const monthIncome = thisMonthTxns.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
  const monthExpense = thisMonthTxns.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  if (monthExpense > monthIncome && thisMonthTxns.length >= 3) {
    const deficit = monthExpense - monthIncome;
    alerts.push({
      id: 'alert_cash_crunch',
      type: 'cash_flow_crunch',
      severity: 'red',
      title: {
        mr: 'रोख प्रवाह तुटवडा (Cash Flow Crunch)',
        hi: 'कैश फ्लो कमी चेतावनी (Cash Flow Crunch)',
        en: 'Cash Flow Crunch Alert'
      },
      description: {
        mr: `या महिन्यात तुमचा खर्च (₹${monthExpense}) हा उत्पन्नापेक्षा (₹${monthIncome}) ₹${deficit} ने जास्त आहे.`,
        hi: `इस महीने आपका खर्च (₹${monthExpense}) कुल आय (₹${monthIncome}) से ₹${deficit} अधिक है।`,
        en: `Your recorded expenses (₹${monthExpense}) exceed total income (₹${monthIncome}) by ₹${deficit} this month.`
      },
      amountOrMetric: `-₹${deficit}`,
      comparisonPeriod: 'या महिन्यात (This Month)',
      recommendedAction: {
        mr: 'नवीन मोठी खरेदी करण्यापूर्वी तात्पुरता अनावश्यक खर्च थांबवा आणि उधारी वसूल करा.',
        hi: 'नया सामान खरीदने से पहले गैर-जरूरी खर्च रोकें और लंबित उधारी वसूलें।',
        en: 'Pause non-essential raw material purchases and prioritize pending customer collections.'
      },
      speechText: {
        mr: `सावधान. या महिन्यात तुमचा खर्च उत्पन्नापेक्षा ₹${deficit} रुपयांनी जास्त आहे. कृपया तात्पुरता अनावश्यक खर्च थांबवा.`,
        hi: `चेतावनी. इस महीने आपका कुल खर्च आमदनी से ₹${deficit} रुपये अधिक है। कृपया अनावश्यक खर्च नियंत्रित करें।`,
        en: `Warning. Your expenses exceed your revenue by ₹${deficit} this month. Please pause non-essential spending.`
      },
      linkTo: '/app/ledger'
    });
  }

  // 2. Uncollected Udhaar Alert (>15 days pending)
  const overdueCustomers = udhaarEntries.filter(u => {
    const due = u.totalUdhaar - u.amountRepaid;
    if (due <= 0) return false;
    const entryDate = new Date(u.date + 'T00:00:00');
    const daysOld = Math.floor((now.getTime() - entryDate.getTime()) / MS_PER_DAY);
    return daysOld >= 15;
  });

  if (overdueCustomers.length > 0) {
    const totalOverdueAmount = overdueCustomers.reduce((sum, u) => sum + (u.totalUdhaar - u.amountRepaid), 0);
    const topCustomer = overdueCustomers[0];
    alerts.push({
      id: 'alert_overdue_udhaar',
      type: 'uncollected_udhaar',
      severity: 'amber',
      title: {
        mr: 'प्रलंबित उधारी आठवण (Overdue Customer Credit)',
        hi: 'पुरानी उधारी चेतावनी (Overdue Customer Credit)',
        en: 'Uncollected Customer Udhaar'
      },
      description: {
        mr: `${overdueCustomers.length} ग्राहकांकडे एकूण ₹${totalOverdueAmount} ची उधारी मागील १५ दिवसांपेक्षा जास्त काळ प्रलंबित आहे (उदा. ${topCustomer.customerName}).`,
        hi: `${overdueCustomers.length} ग्राहकों से ₹${totalOverdueAmount} की उधारी पिछले 15 दिनों से अटकी हुई है (जैसे ${topCustomer.customerName})।`,
        en: `₹${totalOverdueAmount} across ${overdueCustomers.length} customers has remained unpaid for more than 15 days (e.g. ${topCustomer.customerName}).`
      },
      amountOrMetric: `₹${totalOverdueAmount}`,
      comparisonPeriod: '> 15 दिवस जुनी (Overdue)',
      recommendedAction: {
        mr: 'उधार खात्यात जाऊन १-क्लिक WhatsApp आठवण मेसेज पाठवून वसुली करा.',
        hi: 'उधार खाते में जाकर 1-क्लिक WhatsApp रिमाइंडर भेजें।',
        en: 'Send polite 1-click WhatsApp reminders via Udhaar Khata to accelerate recovery.'
      },
      speechText: {
        mr: `लक्ष द्या. १५ दिवसांपेक्षा जुनी ₹${totalOverdueAmount} रुपयांची उधारी बाकी आहे. कृपया ग्राहकांना WhatsApp आठवण पाठवा.`,
        hi: `ध्यान दें। 15 दिनों से अधिक समय से ₹${totalOverdueAmount} की उधारी बाकी है। कृपया ग्राहकों को व्हाट्सएप पर याद दिलाएं।`,
        en: `Attention. ₹${totalOverdueAmount} in customer credit is pending for over 15 days. Send a WhatsApp reminder to collect.`
      },
      linkTo: '/app/udhaar'
    });
  }

  // 3. Spending Spike Alert (Compare last 7 days vs previous 7 days)
  const last7DaysStart = new Date(now.getTime() - 7 * MS_PER_DAY);
  const prev7DaysStart = new Date(now.getTime() - 14 * MS_PER_DAY);

  const currExpMap: Record<string, number> = {};
  const prevExpMap: Record<string, number> = {};

  transactions.filter(t => t.type === 'expense').forEach(t => {
    const d = new Date(t.date + 'T00:00:00');
    const cat = t.category || 'General';
    if (d >= last7DaysStart && d <= now) {
      currExpMap[cat] = (currExpMap[cat] || 0) + t.amount;
    } else if (d >= prev7DaysStart && d < last7DaysStart) {
      prevExpMap[cat] = (prevExpMap[cat] || 0) + t.amount;
    }
  });

  let maxSpikeCat = '';
  let maxSpikePct = 0;
  let maxSpikeCurr = 0;
  let maxSpikePrev = 0;

  Object.entries(currExpMap).forEach(([cat, cVal]) => {
    const pVal = prevExpMap[cat] || 0;
    if (pVal > 0 && cVal > pVal) {
      const pct = Math.round(((cVal - pVal) / pVal) * 100);
      if (pct >= 25 && pct > maxSpikePct) {
        maxSpikePct = pct;
        maxSpikeCat = cat;
        maxSpikeCurr = cVal;
        maxSpikePrev = pVal;
      }
    }
  });

  if (maxSpikeCat) {
    alerts.push({
      id: 'alert_spending_spike',
      type: 'spending_spike',
      severity: 'amber',
      title: {
        mr: `खर्चात अनपेक्षित वाढ (${maxSpikeCat})`,
        hi: `खर्च में असामान्य वृद्धि (${maxSpikeCat})`,
        en: `Cost Surge in ${maxSpikeCat}`
      },
      description: {
        mr: `मागील ७ दिवसांत ${maxSpikeCat} चा खर्च ${maxSpikePct}% ने वाढला आहे (₹${maxSpikePrev} वरून ₹${maxSpikeCurr}).`,
        hi: `पिछले 7 दिनों में ${maxSpikeCat} का खर्च ${maxSpikePct}% बढ़ गया है (₹${maxSpikePrev} से ₹${maxSpikeCurr})।`,
        en: `${maxSpikeCat} spending spiked by ${maxSpikePct}% this week (from ₹${maxSpikePrev} to ₹${maxSpikeCurr}).`
      },
      amountOrMetric: `+${maxSpikePct}%`,
      comparisonPeriod: 'या आठवड्यात (This Week)',
      recommendedAction: {
        mr: 'घाऊक बाजारात दर तपासा किंवा स्थानिक पुरवठादारांशी दर वाटाघाटी करा.',
        hi: 'थोक बाजार में भाव जांचें या सप्लायर से बेहतर दरों पर बात करें।',
        en: 'Verify supplier wholesale rates or seek volume discounts on high-frequency supplies.'
      },
      speechText: {
        mr: `मागील आठवड्याच्या तुलनेत ${maxSpikeCat} चा खर्च ${maxSpikePct} टक्क्यांनी वाढला आहे. कृपया खरेदी दर तपासा.`,
        hi: `पिछले हफ्ते की तुलना में ${maxSpikeCat} का खर्च ${maxSpikePct} प्रतिशत बढ़ा है। कृपया दरों की समीक्षा करें।`,
        en: `Your ${maxSpikeCat} expenses increased by ${maxSpikePct} percent this week. Check your supplier pricing.`
      },
      linkTo: '/app/insights'
    });
  }

  // 4. Positive Performance & Smart Business Suggestion
  if (monthIncome > monthExpense && monthIncome > 5000) {
    const profitMargin = Math.round(((monthIncome - monthExpense) / monthIncome) * 100);
    alerts.push({
      id: 'alert_smart_growth',
      type: 'smart_suggestion',
      severity: 'green',
      title: {
        mr: 'उत्कृष्ट नफा व बँक पत पात्रता (Strong Financial Health)',
        hi: 'मजबूत लाभ और लोन पात्रता (Strong Financial Health)',
        en: 'Solid Profit & Credit Readiness'
      },
      description: {
        mr: `या महिन्यात तुमचा निव्वळ नफा मार्जिन ${profitMargin}% आहे. ही रोख प्रवाह स्थिरता मुद्रा (MUDRA) कर्जासाठी अनुकूल आहे.`,
        hi: `इस महीने आपका नेट प्रॉफिट मार्जिन ${profitMargin}% है। यह स्थिरता मुद्रा लोन के लिए अत्यंत अनुकूल है।`,
        en: `Your net profit margin is ${profitMargin}% this month. Consistent cash flows strengthen MUDRA loan approval.`
      },
      amountOrMetric: `${profitMargin}% Margin`,
      comparisonPeriod: '३० दिवस (Past 30 Days)',
      recommendedAction: {
        mr: 'क्रेडिट पात्रता पानावरून ३ महिन्यांचे बँक-मान्य स्टेटमेंट डाउनलोड करून जतन करा.',
        hi: 'क्रेडिट पात्रता पेज से 3 महीने का बैंक स्टेटमेंट पीडीएफ डाउनलोड करें।',
        en: 'Download your 3-Month Bank-Ready Financial Statement PDF for formal credit applications.'
      },
      speechText: {
        mr: `छान. या महिन्यात तुमचा नफा मार्जिन ${profitMargin} टक्के आहे. तुम्ही मुद्रा कर्जासाठी बँक स्टेटमेंट डाउनलोड करू शकता.`,
        hi: `बधाई हो। इस महीने आपका प्रॉफिट मार्जिन ${profitMargin} प्रतिशत है। आप मुद्रा लोन के लिए स्टेटमेंट डाउनलोड कर सकते हैं।`,
        en: `Great job. Your net margin is ${profitMargin} percent this month. You can download your bank statement now.`
      },
      linkTo: '/app/readiness'
    });
  }

  return alerts;
}
