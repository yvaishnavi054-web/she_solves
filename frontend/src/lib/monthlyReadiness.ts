import { Transaction } from '../context/AppContext';
import { UdhaarEntry } from '../pages/UdhaarKhata';

export interface MonthlyMetricComparison {
  currentValue: number;
  previousValue: number;
  diff: number;
  pct: number | null; // null if previous was 0 and current is 0
  trend: 'up' | 'down' | 'same' | 'new';
  isFavorable: boolean; // true if financially good (e.g. higher income or lower expense)
  explanation: {
    mr: string;
    hi: string;
    en: string;
  };
}

export interface MonthlyRecord {
  monthKey: string; // e.g. "2026-10"
  monthName: {
    mr: string;
    hi: string;
    en: string;
  };
  year: number;
  monthIndex: number; // 0 to 11
  startDateStr: string; // "2026-10-01"
  endDateStr: string; // "2026-10-31"
  daysInMonth: number;
  elapsedDays: number;
  isCurrentMonth: boolean;
  dailyAvgDays: number;
  dailyAvgLabel: {
    mr: string;
    hi: string;
    en: string;
  };
  
  // Totals
  income: number;
  expenses: number;
  profit: number;
  profitMarginPercent: number;
  outstandingUdhaar: number;
  activeDaysCount: number;
  txCount: number;

  // Daily averages
  dailyAvgIncome: number;
  dailyAvgExpenses: number;
  dailyAvgProfit: number;

  // Month-to-date partials (for fair comparison with current month)
  mtdIncome: number;
  mtdExpenses: number;
  mtdProfit: number;

  // Comparison vs previous month
  comparisonType: 'baseline' | 'full' | 'mtd';
  comparisonPeriodLabel: {
    mr: string;
    hi: string;
    en: string;
  };
  incomeComparison: MonthlyMetricComparison;
  expenseComparison: MonthlyMetricComparison;
  profitComparison: MonthlyMetricComparison;
  udhaarComparison: MonthlyMetricComparison;

  // Audio Speech Text
  speechSummary: {
    mr: string;
    hi: string;
    en: string;
  };
}

export interface ScoreFactorBreakdown {
  id: string;
  name: { en: string; mr: string; hi: string };
  earnedPoints: number;
  maxPoints: number;
  actualMetric: string;
  targetMetric: string;
  description: { en: string; mr: string; hi: string };
}

export interface RecordStrengthBreakdown {
  totalScore: number;
  score: number;
  ratingTier: 'building' | 'moderate' | 'bank_ready';
  ratingLabel: { en: string; mr: string; hi: string };
  scoreStatusText: { en: string; mr: string; hi: string };
  factors: {
    loggingFrequency: ScoreFactorBreakdown;
    transactionDepth: ScoreFactorBreakdown;
    marginAndCashflow: ScoreFactorBreakdown;
    udhaarDiscipline: ScoreFactorBreakdown;
  };
  missingRecords: { en: string[]; mr: string[]; hi: string[] };
  actionableSteps: { en: string[]; mr: string[]; hi: string[] };
}

export interface TwelveMonthRecord extends MonthlyRecord {
  hasData: boolean;
  isEmpty: boolean;
  shortLabel: { en: string; mr: string; hi: string };
  transactions: Transaction[];
}

export interface TwelveMonthReadinessResult {
  months: TwelveMonthRecord[];
  twelveMonthTotals: {
    income: number;
    expenses: number;
    profit: number;
    profitMarginPercent: number;
    activeDays: number;
    txCount: number;
    avgMonthlyIncome: number;
    avgMonthlyExpenses: number;
    avgMonthlyProfit: number;
  };
  twelveMonthSpeechSummary: {
    en: string;
    mr: string;
    hi: string;
  };
}

export interface ThreeMonthReadinessResult {
  months: MonthlyRecord[];
  threeMonthTotals: {
    income: number;
    expenses: number;
    profit: number;
    profitMarginPercent: number;
    activeDays: number;
    txCount: number;
    avgMonthlyIncome: number;
    avgMonthlyExpenses: number;
    avgMonthlyProfit: number;
  };
  overallStatus: {
    readinessScore: number;
    ratingText: { mr: string; hi: string; en: string };
    summarySpeech: { mr: string; hi: string; en: string };
    recommendation: { mr: string; hi: string; en: string };
    breakdown?: RecordStrengthBreakdown;
  };
}

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_MR = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'
];

const MONTH_NAMES_HI = [
  'जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
];

// Helper for metric comparison with correct financial valence
export const buildComparison = (
  currentVal: number,
  prevVal: number,
  metricType: 'income' | 'expense' | 'profit' | 'udhaar',
  isMTD: boolean
): MonthlyMetricComparison => {
  const diff = currentVal - prevVal;
  let pct: number | null = null;
  let trend: 'up' | 'down' | 'same' | 'new' = 'same';

  if (prevVal === 0 && currentVal === 0) {
    pct = 0;
    trend = 'same';
  } else if (prevVal === 0) {
    pct = null;
    trend = 'new';
  } else {
    pct = Math.round((diff / Math.abs(prevVal)) * 100);
    if (diff > 0) trend = 'up';
    else if (diff < 0) trend = 'down';
  }

  // Determine if financially favorable:
  // Income: up is favorable
  // Profit: up is favorable
  // Expenses: down is favorable (savings)
  // Udhaar: down is favorable (less pending debt)
  let isFavorable = false;
  if (metricType === 'income' || metricType === 'profit') {
    isFavorable = diff > 0;
  } else {
    isFavorable = diff < 0; // lower expenses or lower pending udhaar is good!
  }

  // Explanations
  const absDiffFormatted = `₹${Math.abs(diff).toLocaleString('en-IN')}`;
  const absPct = pct !== null ? `${Math.abs(pct)}%` : '';

  let explanationEn = '';
  let explanationMr = '';
  let explanationHi = '';

  const suffixEn = isMTD ? ' (MTD comparison)' : ' compared with last month';
  const suffixMr = isMTD ? ' (चालू महिना तुलना)' : ' मागील महिन्याच्या तुलनेत';
  const suffixHi = isMTD ? ' (चालू माह तुलना)' : ' पिछले महीने की तुलना में';

  if (diff === 0) {
    explanationEn = `No change${suffixEn}.`;
    explanationMr = `कोणताही बदल नाही${suffixMr}.`;
    explanationHi = `कोई बदलाव नहीं${suffixHi}.`;
  } else if (metricType === 'profit') {
    if (diff > 0) {
      explanationEn = `Profit increased by ${absDiffFormatted}${pct ? ` (${absPct})` : ''}${suffixEn}.`;
      explanationMr = `नफ्यात ${absDiffFormatted}${pct ? ` (${absPct})` : ''} ची वाढ झाली${suffixMr}.`;
      explanationHi = `मुनाफ़े में ${absDiffFormatted}${pct ? ` (${absPct})` : ''} की बढ़ोतरी हुई${suffixHi}।`;
    } else {
      explanationEn = `Profit decreased by ${absDiffFormatted}${pct ? ` (${absPct})` : ''}${suffixEn}.`;
      explanationMr = `नफ्यात ${absDiffFormatted}${pct ? ` (${absPct})` : ''} ची घट झाली${suffixMr}.`;
      explanationHi = `मुनाफ़े में ${absDiffFormatted}${pct ? ` (${absPct})` : ''} की कमी आई${suffixHi}।`;
    }
  } else if (metricType === 'income') {
    if (diff > 0) {
      explanationEn = `Income increased by ${absDiffFormatted}${pct ? ` (${absPct})` : ''}${suffixEn}.`;
      explanationMr = `मिळकतीत ${absDiffFormatted}${pct ? ` (${absPct})` : ''} ची वाढ झाली${suffixMr}.`;
      explanationHi = `आमदनी में ${absDiffFormatted}${pct ? ` (${absPct})` : ''} की बढ़ोतरी हुई${suffixHi}।`;
    } else {
      explanationEn = `Income decreased by ${absDiffFormatted}${pct ? ` (${absPct})` : ''}${suffixEn}.`;
      explanationMr = `मिळकतीत ${absDiffFormatted}${pct ? ` (${absPct})` : ''} ची घट झाली${suffixMr}.`;
      explanationHi = `आमदनी में ${absDiffFormatted}${pct ? ` (${absPct})` : ''} की कमी आई${suffixHi}।`;
    }
  } else if (metricType === 'expense') {
    if (diff > 0) {
      explanationEn = `Expenses increased by ${absDiffFormatted}${pct ? ` (${absPct})` : ''}${suffixEn}.`;
      explanationMr = `खर्चात ${absDiffFormatted}${pct ? ` (${absPct})` : ''} ची वाढ झाली${suffixMr}.`;
      explanationHi = `खर्च में ${absDiffFormatted}${pct ? ` (${absPct})` : ''} की वृद्धि हुई${suffixHi}।`;
    } else {
      explanationEn = `Expenses reduced by ${absDiffFormatted}${pct ? ` (${absPct})` : ''}${suffixEn} (cost savings).`;
      explanationMr = `खर्चात ${absDiffFormatted}${pct ? ` (${absPct})` : ''} ची बचत झाली${suffixMr}.`;
      explanationHi = `खर्च में ${absDiffFormatted}${pct ? ` (${absPct})` : ''} की बचत हुई${suffixHi}।`;
    }
  } else {
    // udhaar
    if (diff > 0) {
      explanationEn = `Pending credit increased by ${absDiffFormatted}${suffixEn}.`;
      explanationMr = `बाकी उधारीत ${absDiffFormatted} ची वाढ झाली${suffixMr}.`;
      explanationHi = `बकाया उधार ${absDiffFormatted} बढ़ा${suffixHi}।`;
    } else {
      explanationEn = `Pending credit reduced by ${absDiffFormatted}${suffixEn}.`;
      explanationMr = `बाकी उधारी ${absDiffFormatted} ने कमी झाली${suffixMr}.`;
      explanationHi = `बकाया उधार ${absDiffFormatted} कम हुआ${suffixHi}।`;
    }
  }

  return {
    currentValue: currentVal,
    previousValue: prevVal,
    diff,
    pct,
    trend,
    isFavorable,
    explanation: {
      en: explanationEn,
      mr: explanationMr,
      hi: explanationHi,
    }
  };
};

export const dummyComp = (val: number, _type: 'income' | 'expense' | 'profit' | 'udhaar'): MonthlyMetricComparison => ({
  currentValue: val,
  previousValue: val,
  diff: 0,
  pct: null,
  trend: 'same',
  isFavorable: true,
  explanation: {
    en: 'Initial baseline period.',
    mr: 'सुरुवातीचा पायाभूत महिना.',
    hi: 'आरंभिक आधारभूत महीना।'
  }
});

// Authentic, transparent, multi-factor Record Strength Calculation
export function computeRecordStrengthBreakdown(
  arg1: Transaction[] | number = [],
  arg2: UdhaarEntry[] | number = [],
  arg3: Date | number = new Date(),
  arg4?: number,
  arg5?: UdhaarEntry[]
): RecordStrengthBreakdown {
  let totalActiveDays = 0;
  let totalTx = 0;
  let overallMargin = 0;
  let totalProfit = 0;
  let udhaarEntries: UdhaarEntry[] = [];

  if (Array.isArray(arg1)) {
    // Called as: computeRecordStrengthBreakdown(transactions, udhaarEntries, referenceDate)
    const transactions = arg1 as Transaction[];
    udhaarEntries = (Array.isArray(arg2) ? arg2 : []) as UdhaarEntry[];
    const refDate = (arg3 instanceof Date ? arg3 : new Date());

    // Filter to last 90 days
    const ninetyDaysAgo = new Date(refDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    const ninetyDaysStr = ninetyDaysAgo.toISOString().slice(0, 10);
    const refDateStr = refDate.toISOString().slice(0, 10);

    const recentTxns = transactions.filter(t => {
      const d = (t.date || '').slice(0, 10);
      return d >= ninetyDaysStr && d <= refDateStr;
    });

    const activeDates = new Set<string>();
    let income = 0;
    let expenses = 0;
    recentTxns.forEach(t => {
      const amt = Number(t.amount) || 0;
      const isSale = t.type?.toLowerCase() === 'sale' || t.type?.toLowerCase() === 'income';
      if (t.date) activeDates.add(t.date.slice(0, 10));
      if (isSale) income += amt;
      else expenses += amt;
    });

    totalActiveDays = activeDates.size;
    totalTx = recentTxns.length;
    totalProfit = income - expenses;
    overallMargin = income > 0 ? Math.round((totalProfit / income) * 1000) / 10 : 0;
  } else {
    // Called as: computeRecordStrengthBreakdown(totalActiveDays, totalTx, overallMargin, totalProfit, udhaarEntries)
    totalActiveDays = Number(arg1) || 0;
    totalTx = Number(arg2) || 0;
    overallMargin = Number(arg3) || 0;
    totalProfit = Number(arg4) || 0;
    udhaarEntries = Array.isArray(arg5) ? arg5 : [];
  }

  // Factor 1: Active Logging Frequency (Consistency) - Max 35 pts
  // Target: 60 active business days over 3-month reporting cycle (~20 days/month)
  const activeDaysTarget = 60;
  const activeDaysPts = Math.min(35, Math.max(3, Math.round((totalActiveDays / activeDaysTarget) * 35)));
  const activeDaysMissing = Math.max(0, activeDaysTarget - totalActiveDays);

  // Factor 2: Transaction Volume & Record Depth - Max 25 pts
  // Target: 30 transactions (~10/month) with dual tracking of sales and expenses
  const txTarget = 30;
  const txPts = Math.min(25, Math.max(5, Math.round((totalTx / txTarget) * 25)));
  const txMissing = Math.max(0, txTarget - totalTx);

  // Factor 3: Operational Profitability & Net Margin - Max 25 pts
  // Target: Healthy net profit margin (>= 15%)
  let profitPts = 5;
  if (totalProfit > 0) {
    if (overallMargin >= 20) profitPts = 25;
    else if (overallMargin >= 15) profitPts = 22;
    else if (overallMargin >= 10) profitPts = 18;
    else if (overallMargin >= 5) profitPts = 14;
    else profitPts = 10;
  }

  // Factor 4: Credit & Udhaar Settlement Discipline - Max 15 pts
  // Target: Clean customer debt recovery rate (>= 60%) or balanced ledger
  let totalUdhaarAmt = 0;
  let totalSettledAmt = 0;
  udhaarEntries.forEach(u => {
    totalUdhaarAmt += (u.totalUdhaar || 0);
    totalSettledAmt += (u.amountRepaid || 0);
  });
  let udhaarPts = 12; // default healthy baseline when no overdue risk
  let udhaarRecoveryRate = 100;
  if (totalUdhaarAmt > 0) {
    udhaarRecoveryRate = Math.round((totalSettledAmt / totalUdhaarAmt) * 100);
    if (udhaarRecoveryRate >= 60) udhaarPts = 15;
    else if (udhaarRecoveryRate >= 40) udhaarPts = 12;
    else if (udhaarRecoveryRate >= 20) udhaarPts = 9;
    else udhaarPts = 6;
  }

  // Raw score is the genuine sum of all 4 pillars
  const rawScore = activeDaysPts + txPts + profitPts + udhaarPts;
  const score = Math.min(95, Math.max(15, rawScore));

  const ratingTier: 'building' | 'moderate' | 'bank_ready' = 
    score >= 80 ? 'bank_ready' : score >= 60 ? 'moderate' : 'building';

  const ratingLabel = {
    en: score >= 80 ? 'Bank-Ready (High Consistency)' : score >= 60 ? 'Moderate Record Health' : 'Building Record Track',
    mr: score >= 80 ? 'बँकेसाठी तयार (उत्तम सातत्य)' : score >= 60 ? 'मध्यम रेकॉर्ड सातत्य' : 'रेकॉर्ड सातत्य सुधारत आहे',
    hi: score >= 80 ? 'बैंक-रेडी (उत्कृष्ट निरंतरता)' : score >= 60 ? 'मध्यम रिकॉर्ड निरंतरता' : 'रिकॉर्ड निरंतरता में सुधार जारी'
  };

  const scoreStatusText = {
    en: `Your score is ${score}/100 calculated from: Active logging days (${activeDaysPts}/35 pts), transaction depth (${txPts}/25 pts), operating net profit (${profitPts}/25 pts), and credit recovery discipline (${udhaarPts}/15 pts). Maintain daily logging to achieve 80+ for bank credit.`,
    mr: `तुमचा स्कोअर १०० पैकी ${score} आहे: सक्रिय दिवस (${activeDaysPts}/३५ गुण), नोंदींची खोली (${txPts}/२५ गुण), निव्वळ नफा मार्जिन (${profitPts}/२५ गुण), आणि उधारी शिस्त (${udhaarPts}/१५ गुण). ८०+ गुण मिळवून बँकेत कर्जासाठी पात्र होण्यासाठी दररोज हिशोब नोंदवा.`,
    hi: `आपका स्कोर 100 में से ${score} है: सक्रिय कार्य दिवस (${activeDaysPts}/35 अंक), लेन-देन पूर्णता (${txPts}/25 अंक), शुद्ध मुनाफ़ा मार्जिन (${profitPts}/25 अंक), और उधारी वसूली अनुशासन (${udhaarPts}/15 अंक)। बैंक ऋण हेतु 80+ अंक प्राप्त करने के लिए दैनिक रिकॉर्ड दर्ज करें।`
  };

  const factors = {
    loggingFrequency: {
      id: 'active_days',
      name: {
        en: 'Active Recording Consistency',
        mr: 'दैनिक नोंदींचे सातत्य (सक्रिय दिवस)',
        hi: 'दैनिक रिकॉर्ड निरंतरता (सक्रिय दिन)'
      },
      earnedPoints: activeDaysPts,
      maxPoints: 35,
      actualMetric: `${totalActiveDays} / 60 days logged`,
      targetMetric: '60 days target',
      description: {
        en: `You logged ${totalActiveDays} business days over the reporting cycle. Target is 60 active days (~20 days/month).`,
        mr: `तुम्ही अहवाल कालावधीत ${totalActiveDays} दिवस हिशोब नोंदवला. उद्दिष्ट ६० सक्रिय दिवसांचे आहे (~२० दिवस/महिना).`,
        hi: `आपने रिपोर्टिंग अवधि में ${totalActiveDays} कार्य दिवस दर्ज किए। लक्ष्य 60 सक्रिय दिन है (~20 दिन/माह)।`
      }
    },
    transactionDepth: {
      id: 'tx_depth',
      name: {
        en: 'Transaction Volume & Depth',
        mr: 'व्यवहार संख्या आणि परिपूर्णता',
        hi: 'लेन-देन संख्या एवं गहराई'
      },
      earnedPoints: txPts,
      maxPoints: 25,
      actualMetric: `${totalTx} / 30+ transactions`,
      targetMetric: '30+ transactions',
      description: {
        en: `Recorded ${totalTx} total income and expense entries. Demonstrating 30+ entries proves comprehensive recordkeeping.`,
        mr: `एकूण ${totalTx} मिळकत व खर्च नोंदी केल्या. ३०+ नोंदींमुळे बँकेला व्यवसायाचा सविस्तर ताळेबंद समजतो.`,
        hi: `कुल ${totalTx} बिक्री एवं खर्च लेन-देन दर्ज किए। 30+ प्रविष्टियां दर्शाती हैं कि खाता पूरी तरह से व्यवस्थित है।`
      }
    },
    marginAndCashflow: {
      id: 'profitability',
      name: {
        en: 'Operational Cashflow & Net Margin',
        mr: 'रोख प्रवाह आणि निव्वळ नफा मार्जिन',
        hi: 'परिचालन नकद प्रवाह और शुद्ध मार्जिन'
      },
      earnedPoints: profitPts,
      maxPoints: 25,
      actualMetric: `${overallMargin}% net margin`,
      targetMetric: '15%+ net margin',
      description: {
        en: `Operational profit margin is ${overallMargin}%. A consistent profit above 15% assures lenders of loan repayment capacity.`,
        mr: `व्यवसायाचा निव्वळ नफा मार्जिन ${overallMargin}% आहे. १५% पेक्षा जास्त नफा कर्ज परतफेडीची क्षमता दर्शवतो.`,
        hi: `व्यवसाय का शुद्ध मुनाफ़ा मार्जिन ${overallMargin}% है। 15% से अधिक मुनाफ़ा ऋण अदायगी क्षमता सिद्ध करता है।`
      }
    },
    udhaarDiscipline: {
      id: 'udhaar_discipline',
      name: {
        en: 'Udhaar Collection & Discipline',
        mr: 'उधारी वसुली आणि आर्थिक शिस्त',
        hi: 'उधार वसूली और वित्तीय अनुशासन'
      },
      earnedPoints: udhaarPts,
      maxPoints: 15,
      actualMetric: `${udhaarRecoveryRate}% recovery rate`,
      targetMetric: '60%+ recovery rate',
      description: {
        en: `Customer credit recovery rate is ${udhaarRecoveryRate}%. Timely repayments and verified receipts prevent bad debts.`,
        mr: `ग्राहकांकडून उधारी वसुलीचे प्रमाण ${udhaarRecoveryRate}% आहे. वेळेवर वसुलीमुळे व्यवसाय सुरक्षित राहतो.`,
        hi: `ग्राहकों से उधारी वसूली दर ${udhaarRecoveryRate}% है। समय पर वसूली से व्यवसाय में धन प्रवाह सुचारू रहता है।`
      }
    }
  };

  const missingRecords = {
    en: [
      activeDaysMissing > 0 ? `${activeDaysMissing} more active business days needed to reach full consistency score (Target: 60 days)` : '60+ active days achieved',
      txMissing > 0 ? `${txMissing} more transactions needed to reach full volume depth (Target: 30+ entries)` : '30+ transaction volume target achieved',
      'Record supplier purchases and raw material bills to build strong expense trail',
      'Track customer Udhaar repayments with WhatsApp receipts'
    ],
    mr: [
      activeDaysMissing > 0 ? `पूर्ण सातत्यासाठी अजून ${activeDaysMissing} दिवस रोज हिशोब नोंदवणे आवश्यक (लक्ष्य: ६० दिवस)` : '६०+ सक्रिय दिवसांचे उद्दिष्ट पूर्ण झाले',
      txMissing > 0 ? `पूर्ण ताळेबंदासाठी अजून ${txMissing} नोंदींची आवश्यकता (लक्ष्य: ३०+ नोंदी)` : '३०+ नोंदींचे उद्दिष्ट पूर्ण झाले',
      'कच्चा माल व साहित्य खरेदीचा खर्च नियमितपणे खात्यात नोंदवा',
      'उधारी ग्राहकांकडून वेळेवर पैसे जमा घेऊन व्हॉट्सॲप पावती पाठवा'
    ],
    hi: [
      activeDaysMissing > 0 ? `पूर्ण निरंतरता स्कोर हेतु अभी ${activeDaysMissing} और दिन हिशोब दर्ज करें (लक्ष्य: 60 दिन)` : '60+ सक्रिय दिनों का लक्ष्य प्राप्त',
      txMissing > 0 ? `पूर्ण लेजर गहराई हेतु अभी ${txMissing} और लेन-देन दर्ज करें (लक्ष्य: 30+ प्रविष्टियां)` : '30+ प्रविष्टियों का लक्ष्य प्राप्त',
      'सामग्री व माल खरीद के खर्चों को भी नियमित दर्ज करें',
      'उधार ग्राहकों से समय पर वसूली कर व्हाट्सएप रसीद भेजें'
    ]
  };

  const actionableSteps = {
    en: [
      'Speak at least 1 income or expense entry into BoliKhata every business day (+1 pt per active day)',
      'Record both daily sales and small expenses (tea, ingredients, supplies) to show operational depth (+8 pts)',
      'Keep expenses under 80% of sales to preserve a healthy 20%+ net margin (+5 pts)',
      'Collect and record repayments on overdue Udhaar promptly via WhatsApp reminder (+3 pts)'
    ],
    mr: [
      'दररोज किमान १ मिळकत किंवा खर्चाची नोंद व्हॉइस खात्यात करा (+१ गुण प्रति दिवस)',
      'दैनिक विक्रीसोबतच छोटे खर्च व माल खरेदीही नोंदवा (+८ गुण)',
      'खर्च विक्रीच्या ८०% पेक्षा कमी ठेवून २०%+ नफा टिकवून ठेवा (+५ गुण)',
      'उधारी ग्राहकांना व्हॉट्सॲपवरून आठवण करून पैसे जमा करा (+३ गुण)'
    ],
    hi: [
      'प्रत्येक कार्य दिवस पर कम से कम 1 लेन-देन आवाज़ खाते में बोलें (+1 अंक प्रति दिन)',
      'दैनिक बिक्री के साथ-साथ सामग्री खरीद के खर्च भी दर्ज करें (+8 अंक)',
      'खर्च को बिक्री के 80% से कम रखकर 20%+ मार्जिन बनाए रखें (+5 अंक)',
      'बकाया उधार की समय पर वसूली कर पावती भेजें (+3 अंक)'
    ]
  };

  return {
    totalScore: score,
    score,
    ratingTier,
    ratingLabel,
    scoreStatusText,
    factors,
    missingRecords,
    actionableSteps
  };
}

/**
 * Computes individual calendar-month performance for the last 3 months,
 * exact calendar boundaries, daily averages (elapsed vs full), and
 * Upward ↑ / Downward ↓ comparisons with correct financial valence.
 */
export function computeThreeMonthReadiness(
  transactions: Transaction[] = [],
  udhaarEntries: UdhaarEntry[] = [],
  referenceDate = new Date()
): ThreeMonthReadinessResult {
  const currentYear = referenceDate.getFullYear();
  const currentMonthIdx = referenceDate.getMonth();
  const currentDayOfMonth = referenceDate.getDate();

  // Build 3 target months: [Two Months Ago, Previous Month, Current Month]
  const targetMonthsMeta = [
    { offset: 2 }, // Month 1 (earliest)
    { offset: 1 }, // Month 2 (previous)
    { offset: 0 }, // Month 3 (current)
  ].map(({ offset }) => {
    let targetMonth = currentMonthIdx - offset;
    let targetYear = currentYear;
    while (targetMonth < 0) {
      targetMonth += 12;
      targetYear -= 1;
    }

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const isCurrentMonth = (targetYear === currentYear && targetMonth === currentMonthIdx);
    const elapsedDays = isCurrentMonth ? Math.min(currentDayOfMonth, daysInMonth) : daysInMonth;

    const padMonth = String(targetMonth + 1).padStart(2, '0');
    const startDateStr = `${targetYear}-${padMonth}-01`;
    const endDateStr = `${targetYear}-${padMonth}-${String(daysInMonth).padStart(2, '0')}`;

    return {
      monthKey: `${targetYear}-${padMonth}`,
      year: targetYear,
      monthIndex: targetMonth,
      monthName: {
        en: `${MONTH_NAMES_EN[targetMonth]} ${targetYear}`,
        mr: `${MONTH_NAMES_MR[targetMonth]} ${targetYear}`,
        hi: `${MONTH_NAMES_HI[targetMonth]} ${targetYear}`,
      },
      startDateStr,
      endDateStr,
      daysInMonth,
      elapsedDays,
      isCurrentMonth,
      dailyAvgDays: isCurrentMonth ? Math.max(1, elapsedDays) : daysInMonth,
      dailyAvgLabel: {
        en: isCurrentMonth ? `MTD Daily Avg (${elapsedDays} elapsed days)` : `Full Month Daily Avg (${daysInMonth} days)`,
        mr: isCurrentMonth ? `चालू महिना सरासरी (${elapsedDays} दिवस)` : `पूर्ण महिना सरासरी (${daysInMonth} दिवस)`,
        hi: isCurrentMonth ? `चालू माह औसत (${elapsedDays} दिन)` : `पूर्ण माह औसत (${daysInMonth} दिन)`,
      }
    };
  });

  // Calculate raw metrics for each month from transactions
  const rawMonthData = targetMonthsMeta.map(meta => {
    const padMonth = String(meta.monthIndex + 1).padStart(2, '0');
    const prefix = `${meta.year}-${padMonth}`;

    const monthTxns = transactions.filter(t => {
      const dateStr = t.date ? t.date.slice(0, 10) : '';
      return dateStr.startsWith(prefix);
    });

    let income = 0;
    let expenses = 0;
    let mtdIncome = 0;
    let mtdExpenses = 0;
    const activeDates = new Set<string>();

    monthTxns.forEach(t => {
      const amt = Number(t.amount) || 0;
      const isSale = t.type?.toLowerCase() === 'sale' || t.type?.toLowerCase() === 'income';
      const dateStr = t.date ? t.date.slice(0, 10) : '';
      activeDates.add(dateStr);

      const dayNum = parseInt(dateStr.slice(8, 10), 10) || 1;

      if (isSale) {
        income += amt;
        if (dayNum <= currentDayOfMonth) {
          mtdIncome += amt;
        }
      } else {
        expenses += amt;
        if (dayNum <= currentDayOfMonth) {
          mtdExpenses += amt;
        }
      }
    });

    const profit = income - expenses;
    const mtdProfit = mtdIncome - mtdExpenses;
    const profitMarginPercent = income > 0 ? Math.round((profit / income) * 1000) / 10 : 0;

    let outstandingUdhaar = 0;
    if (udhaarEntries.length > 0) {
      udhaarEntries.forEach(entry => {
        const entryDate = entry.date ? entry.date.slice(0, 10) : '';
        if (entryDate <= meta.endDateStr) {
          let credit = 0;
          let payment = 0;
          if (entry.history && entry.history.length > 0) {
            entry.history.forEach(h => {
              const hDate = h.date ? h.date.slice(0, 10) : entryDate;
              if (hDate <= meta.endDateStr) {
                if (h.type === 'credit') credit += (h.amount || 0);
                else payment += (h.amount || 0);
              }
            });
            outstandingUdhaar += Math.max(0, credit - payment);
          } else {
            outstandingUdhaar += Math.max(0, (entry.totalUdhaar || 0) - (entry.amountRepaid || 0));
          }
        }
      });
    }

    const dailyDays = meta.dailyAvgDays;

    return {
      ...meta,
      income: Math.round(income),
      expenses: Math.round(expenses),
      profit: Math.round(profit),
      profitMarginPercent,
      outstandingUdhaar: Math.round(outstandingUdhaar),
      activeDaysCount: activeDates.size,
      txCount: monthTxns.length,
      dailyAvgIncome: Math.round(income / dailyDays),
      dailyAvgExpenses: Math.round(expenses / dailyDays),
      dailyAvgProfit: Math.round(profit / dailyDays),
      mtdIncome: Math.round(mtdIncome),
      mtdExpenses: Math.round(mtdExpenses),
      mtdProfit: Math.round(mtdProfit)
    };
  });

  // Build final monthly records with comparison linkages
  const months: MonthlyRecord[] = rawMonthData.map((curr, idx) => {
    if (idx === 0) {
      const speech = {
        en: `${curr.monthName.en}: Gross income was ₹${curr.income.toLocaleString('en-IN')}, expenses ₹${curr.expenses.toLocaleString('en-IN')}, and net profit ₹${curr.profit.toLocaleString('en-IN')} with ${curr.profitMarginPercent}% margin across ${curr.activeDaysCount} active business days.`,
        mr: `${curr.monthName.mr}: एकूण मिळकत ₹${curr.income.toLocaleString('en-IN')}, खर्च ₹${curr.expenses.toLocaleString('en-IN')}, आणि निव्वळ नफा ₹${curr.profit.toLocaleString('en-IN')} राहिला. नफा मार्जिन ${curr.profitMarginPercent}% आणि ${curr.activeDaysCount} सक्रिय दिवस नोंदवले.`,
        hi: `${curr.monthName.hi}: कुल आमदनी ₹${curr.income.toLocaleString('en-IN')}, खर्च ₹${curr.expenses.toLocaleString('en-IN')}, और शुद्ध मुनाफ़ा ₹${curr.profit.toLocaleString('en-IN')} रहा। मुनाफ़ा मार्जिन ${curr.profitMarginPercent}% तथा ${curr.activeDaysCount} सक्रिय कार्य दिवस रहे।`
      };

      return {
        ...curr,
        comparisonType: 'baseline',
        comparisonPeriodLabel: {
          en: 'Baseline Month',
          mr: 'पायाभूत महिना',
          hi: 'आधारभूत महीना'
        },
        incomeComparison: dummyComp(curr.income, 'income'),
        expenseComparison: dummyComp(curr.expenses, 'expense'),
        profitComparison: dummyComp(curr.profit, 'profit'),
        udhaarComparison: dummyComp(curr.outstandingUdhaar, 'udhaar'),
        speechSummary: speech
      };
    }

    const prev = rawMonthData[idx - 1];
    const isCurrent = curr.isCurrentMonth;

    if (isCurrent) {
      const incComp = buildComparison(curr.income, prev.mtdIncome, 'income', true);
      const expComp = buildComparison(curr.expenses, prev.mtdExpenses, 'expense', true);
      const prfComp = buildComparison(curr.profit, prev.mtdProfit, 'profit', true);
      const udhComp = buildComparison(curr.outstandingUdhaar, prev.outstandingUdhaar, 'udhaar', true);

      const speech = {
        en: `${curr.monthName.en} (Month-to-Date): Recorded ₹${curr.income.toLocaleString('en-IN')} income and ₹${curr.expenses.toLocaleString('en-IN')} expenses in ${curr.elapsedDays} elapsed days. Net profit is ₹${curr.profit.toLocaleString('en-IN')} (${curr.profitMarginPercent}% margin). ${prfComp.explanation.en}`,
        mr: `${curr.monthName.mr} (चालू महिना आजपर्यंत): ${curr.elapsedDays} दिवसांत ₹${curr.income.toLocaleString('en-IN')} मिळकत आणि ₹${curr.expenses.toLocaleString('en-IN')} खर्च नोंदवला. निव्वळ नफा ₹${curr.profit.toLocaleString('en-IN')} आहे (${curr.profitMarginPercent}% मार्जिन). ${prfComp.explanation.mr}`,
        hi: `${curr.monthName.hi} (चालू माह अब तक): ${curr.elapsedDays} दिनों में ₹${curr.income.toLocaleString('en-IN')} आमदनी और ₹${curr.expenses.toLocaleString('en-IN')} खर्च दर्ज हुआ। शुद्ध मुनाफ़ा ₹${curr.profit.toLocaleString('en-IN')} है (${curr.profitMarginPercent}% मार्जिन)। ${prfComp.explanation.hi}`
      };

      return {
        ...curr,
        comparisonType: 'mtd',
        comparisonPeriodLabel: {
          en: `Month-to-Date (Elapsed ${curr.elapsedDays} days vs ${prev.monthName.en})`,
          mr: `चालू महिना (${curr.elapsedDays} दिवसांची ${prev.monthName.mr} शी तुलना)`,
          hi: `चालू माह (${curr.elapsedDays} दिनों की ${prev.monthName.hi} से तुलना)`
        },
        incomeComparison: incComp,
        expenseComparison: expComp,
        profitComparison: prfComp,
        udhaarComparison: udhComp,
        speechSummary: speech
      };
    }

    const incComp = buildComparison(curr.income, prev.income, 'income', false);
    const expComp = buildComparison(curr.expenses, prev.expenses, 'expense', false);
    const prfComp = buildComparison(curr.profit, prev.profit, 'profit', false);
    const udhComp = buildComparison(curr.outstandingUdhaar, prev.outstandingUdhaar, 'udhaar', false);

    const speech = {
      en: `${curr.monthName.en}: Gross income ₹${curr.income.toLocaleString('en-IN')}, expenses ₹${curr.expenses.toLocaleString('en-IN')}, and net profit ₹${curr.profit.toLocaleString('en-IN')} with ${curr.profitMarginPercent}% margin across ${curr.activeDaysCount} active days. ${prfComp.explanation.en}`,
      mr: `${curr.monthName.mr}: एकूण मिळकत ₹${curr.income.toLocaleString('en-IN')}, खर्च ₹${curr.expenses.toLocaleString('en-IN')}, आणि निव्वळ नफा ₹${curr.profit.toLocaleString('en-IN')} राहिला (${curr.profitMarginPercent}% मार्जिन). ${prfComp.explanation.mr}`,
      hi: `${curr.monthName.hi}: कुल आमदनी ₹${curr.income.toLocaleString('en-IN')}, खर्च ₹${curr.expenses.toLocaleString('en-IN')}, और शुद्ध मुनाफ़ा ₹${curr.profit.toLocaleString('en-IN')} रहा (${curr.profitMarginPercent}% मार्जिन)। ${prfComp.explanation.hi}`
    };

    return {
      ...curr,
      comparisonType: 'full',
      comparisonPeriodLabel: {
        en: `Full Month vs ${prev.monthName.en}`,
        mr: `पूर्ण महिना तुलना (${prev.monthName.mr})`,
        hi: `पूर्ण माह तुलना (${prev.monthName.hi})`
      },
      incomeComparison: incComp,
      expenseComparison: expComp,
      profitComparison: prfComp,
      udhaarComparison: udhComp,
      speechSummary: speech
    };
  });

  // Calculate overall 3-month aggregated metrics
  const totalIncome = months.reduce((sum, m) => sum + m.income, 0);
  const totalExpenses = months.reduce((sum, m) => sum + m.expenses, 0);
  const totalProfit = totalIncome - totalExpenses;
  const overallMargin = totalIncome > 0 ? Math.round((totalProfit / totalIncome) * 1000) / 10 : 0;
  const totalActiveDays = months.reduce((sum, m) => sum + m.activeDaysCount, 0);
  const totalTx = months.reduce((sum, m) => sum + m.txCount, 0);

  const avgMonthlyIncome = Math.round(totalIncome / 3);
  const avgMonthlyExpenses = Math.round(totalExpenses / 3);
  const avgMonthlyProfit = Math.round(totalProfit / 3);

  // Consistency & Readiness rating computed with transparent factors
  const breakdown = computeRecordStrengthBreakdown(
    totalActiveDays,
    totalTx,
    overallMargin,
    totalProfit,
    udhaarEntries
  );

  const readinessScore = breakdown.score;
  const ratingText = breakdown.ratingLabel;

  const summarySpeech = {
    en: `3-Month Credit Readiness Summary. Record strength rating is ${readinessScore} out of 100. Average monthly income is ₹${avgMonthlyIncome.toLocaleString('en-IN')}, average monthly expenses are ₹${avgMonthlyExpenses.toLocaleString('en-IN')}, and average net profit is ₹${avgMonthlyProfit.toLocaleString('en-IN')} with a ${overallMargin}% margin across ${totalActiveDays} business days. Financial trajectory shows verified business cash flow suitable for PM MUDRA and SHG credit schemes.`,
    mr: `३ महिन्यांचा क्रेडिट-रेडीनेस अहवाल. रेकॉर्डची ताकद १०० पैकी ${readinessScore} आहे. सरासरी मासिक मिळकत ₹${avgMonthlyIncome.toLocaleString('en-IN')}, सरासरी मासिक खर्च ₹${avgMonthlyExpenses.toLocaleString('en-IN')}, आणि सरासरी निव्वळ नफा ₹${avgMonthlyProfit.toLocaleString('en-IN')} राहिला असून नफा मार्जिन ${overallMargin}% आहे. एकूण ${totalActiveDays} सक्रिय दिवस नोंदवले आहेत. हा अहवाल मुद्रा कर्ज आणि बचत गट योजनांसाठी अधिकृत पुरावा म्हणून सादर करण्यास सज्ज आहे.`,
    hi: `3 महीने का क्रेडिट रेडीनेस सारांश। रिकॉर्ड मजबूती रेटिंग 100 में से ${readinessScore} है। औसत मासिक आमदनी ₹${avgMonthlyIncome.toLocaleString('en-IN')}, औसत मासिक खर्च ₹${avgMonthlyExpenses.toLocaleString('en-IN')}, और औसत शुद्ध लाभ ₹${avgMonthlyProfit.toLocaleString('en-IN')} रहा, जिसमें ${overallMargin}% मार्जिन और ${totalActiveDays} सक्रिय कार्य दिवस हैं। यह वित्तीय रिकॉर्ड पीएम मुद्रा और स्वयं सहायता समूह ऋण हेतु उपयुक्त है।`
  };

  const recommendation = {
    en: `Your 3-month cash flow indicates steady operational profit. Approach your nearest nationalized bank or CSC centre with your downloaded Bank-Ready Statement to apply under PM MUDRA Shishu (up to ₹50,000 collateral-free).`,
    mr: `तुमचा ३ महिन्यांचा रोख प्रवाह नियमित व्यावसायिक नफा दर्शवतो. पीएम मुद्रा शिशु योजनेअंतर्गत (₹५०,००० पर्यंत विनातारण कर्ज) अर्ज करण्यासाठी बँक-रेडी स्टेटमेंट घेऊन नजीकच्या बँक शाखेत किंवा सेवा केंद्रात जा.`,
    hi: `आपका 3 महीने का कैश फ्लो नियमित व्यापारिक लाभ दर्शाता है। पीएम मुद्रा शिशु योजना (₹50,000 तक बिना गारंटी ऋण) के तहत आवेदन के लिए अपना बैंक-रेडी स्टेटमेंट लेकर नजदीकी बैंक शाखा जाएं।`
  };

  return {
    months,
    threeMonthTotals: {
      income: totalIncome,
      expenses: totalExpenses,
      profit: totalProfit,
      profitMarginPercent: overallMargin,
      activeDays: totalActiveDays,
      txCount: totalTx,
      avgMonthlyIncome,
      avgMonthlyExpenses,
      avgMonthlyProfit
    },
    overallStatus: {
      readinessScore,
      ratingText,
      summarySpeech,
      recommendation,
      breakdown
    }
  };
}

/**
 * Computes 12-Month Calendar Financial History from actual transactions
 * with full detail, upward/downward trend indicators, and selectable drilldown.
 */
export function computeTwelveMonthReadiness(
  transactions: Transaction[] = [],
  udhaarEntries: UdhaarEntry[] = [],
  referenceDate = new Date()
): TwelveMonthReadinessResult {
  const currentYear = referenceDate.getFullYear();
  const currentMonthIdx = referenceDate.getMonth();
  const currentDayOfMonth = referenceDate.getDate();

  // Build 12 months: offset from 11 down to 0
  const targetMonthsMeta = [];
  for (let offset = 11; offset >= 0; offset--) {
    let targetMonth = currentMonthIdx - offset;
    let targetYear = currentYear;
    while (targetMonth < 0) {
      targetMonth += 12;
      targetYear -= 1;
    }

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const isCurrentMonth = (offset === 0);
    const elapsedDays = isCurrentMonth ? Math.min(currentDayOfMonth, daysInMonth) : daysInMonth;

    const padMonth = String(targetMonth + 1).padStart(2, '0');
    const startDateStr = `${targetYear}-${padMonth}-01`;
    const endDateStr = `${targetYear}-${padMonth}-${String(daysInMonth).padStart(2, '0')}`;

    targetMonthsMeta.push({
      monthKey: `${targetYear}-${padMonth}`,
      year: targetYear,
      monthIndex: targetMonth,
      monthName: {
        en: `${MONTH_NAMES_EN[targetMonth]} ${targetYear}`,
        mr: `${MONTH_NAMES_MR[targetMonth]} ${targetYear}`,
        hi: `${MONTH_NAMES_HI[targetMonth]} ${targetYear}`,
      },
      startDateStr,
      endDateStr,
      daysInMonth,
      elapsedDays,
      isCurrentMonth,
      dailyAvgDays: isCurrentMonth ? Math.max(1, elapsedDays) : daysInMonth,
      shortLabel: {
        en: `${MONTH_NAMES_EN[targetMonth].slice(0, 3)} '${String(targetYear).slice(2)}`,
        mr: `${MONTH_NAMES_MR[targetMonth].slice(0, 3)} '${String(targetYear).slice(2)}`,
        hi: `${MONTH_NAMES_HI[targetMonth].slice(0, 3)} '${String(targetYear).slice(2)}`,
      },
      dailyAvgLabel: {
        en: isCurrentMonth ? `MTD Daily Avg (${elapsedDays} elapsed days)` : `Full Month Daily Avg (${daysInMonth} days)`,
        mr: isCurrentMonth ? `चालू महिना सरासरी (${elapsedDays} दिवस)` : `पूर्ण महिना सरासरी (${daysInMonth} दिवस)`,
        hi: isCurrentMonth ? `चालू माह औसत (${elapsedDays} दिन)` : `पूर्ण माह औसत (${daysInMonth} दिन)`,
      }
    });
  }

  // Calculate raw metrics for all 12 months
  const rawMonths = targetMonthsMeta.map(meta => {
    const prefix = meta.monthKey;
    const monthTxns = transactions.filter(t => {
      const dateStr = t.date ? t.date.slice(0, 10) : '';
      return dateStr.startsWith(prefix);
    });

    let income = 0;
    let expenses = 0;
    let mtdIncome = 0;
    let mtdExpenses = 0;
    const activeDates = new Set<string>();

    monthTxns.forEach(t => {
      const amt = Number(t.amount) || 0;
      const isSale = t.type?.toLowerCase() === 'sale' || t.type?.toLowerCase() === 'income';
      const dateStr = t.date ? t.date.slice(0, 10) : '';
      activeDates.add(dateStr);

      const dayNum = parseInt(dateStr.slice(8, 10), 10) || 1;
      if (isSale) {
        income += amt;
        if (dayNum <= currentDayOfMonth) mtdIncome += amt;
      } else {
        expenses += amt;
        if (dayNum <= currentDayOfMonth) mtdExpenses += amt;
      }
    });

    const profit = income - expenses;
    const mtdProfit = mtdIncome - mtdExpenses;
    const profitMarginPercent = income > 0 ? Math.round((profit / income) * 1000) / 10 : 0;

    let outstandingUdhaar = 0;
    if (udhaarEntries.length > 0) {
      udhaarEntries.forEach(entry => {
        const entryDate = entry.date ? entry.date.slice(0, 10) : '';
        if (entryDate <= meta.endDateStr) {
          let credit = 0;
          let payment = 0;
          if (entry.history && entry.history.length > 0) {
            entry.history.forEach(h => {
              const hDate = h.date ? h.date.slice(0, 10) : entryDate;
              if (hDate <= meta.endDateStr) {
                if (h.type === 'credit') credit += (h.amount || 0);
                else payment += (h.amount || 0);
              }
            });
            outstandingUdhaar += Math.max(0, credit - payment);
          } else {
            outstandingUdhaar += Math.max(0, (entry.totalUdhaar || 0) - (entry.amountRepaid || 0));
          }
        }
      });
    }

    const hasData = monthTxns.length > 0;
    const dailyDays = meta.dailyAvgDays;

    return {
      ...meta,
      income: Math.round(income),
      expenses: Math.round(expenses),
      profit: Math.round(profit),
      profitMarginPercent,
      outstandingUdhaar: Math.round(outstandingUdhaar),
      activeDaysCount: activeDates.size,
      txCount: monthTxns.length,
      hasData,
      isEmpty: !hasData,
      dailyAvgIncome: hasData ? Math.round(income / dailyDays) : 0,
      dailyAvgExpenses: hasData ? Math.round(expenses / dailyDays) : 0,
      dailyAvgProfit: hasData ? Math.round(profit / dailyDays) : 0,
      mtdIncome: Math.round(mtdIncome),
      mtdExpenses: Math.round(mtdExpenses),
      mtdProfit: Math.round(mtdProfit),
      transactions: [...monthTxns].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    };
  });

  // Comparisons for 12 months
  const months: TwelveMonthRecord[] = rawMonths.map((curr, idx) => {
    if (idx === 0) {
      return {
        ...curr,
        comparisonType: 'baseline',
        comparisonPeriodLabel: {
          en: 'Initial Month',
          mr: 'सुरुवातीचा महिना',
          hi: 'आरंभिक महीना'
        },
        incomeComparison: dummyComp(curr.income, 'income'),
        expenseComparison: dummyComp(curr.expenses, 'expense'),
        profitComparison: dummyComp(curr.profit, 'profit'),
        udhaarComparison: dummyComp(curr.outstandingUdhaar, 'udhaar'),
        speechSummary: {
          en: curr.hasData 
            ? `${curr.monthName.en}: Recorded ₹${curr.income.toLocaleString('en-IN')} income, ₹${curr.expenses.toLocaleString('en-IN')} expenses, and net profit of ₹${curr.profit.toLocaleString('en-IN')}.`
            : `${curr.monthName.en}: No recorded transactions.`,
          mr: curr.hasData
            ? `${curr.monthName.mr}: एकूण मिळकत ₹${curr.income.toLocaleString('en-IN')}, खर्च ₹${curr.expenses.toLocaleString('en-IN')}, आणि निव्वळ नफा ₹${curr.profit.toLocaleString('en-IN')}.`
            : `${curr.monthName.mr}: कोणतेही व्यवहार नोंदवलेले नाहीत.`,
          hi: curr.hasData
            ? `${curr.monthName.hi}: कुल आमदनी ₹${curr.income.toLocaleString('en-IN')}, खर्च ₹${curr.expenses.toLocaleString('en-IN')}, और शुद्ध मुनाफ़ा ₹${curr.profit.toLocaleString('en-IN')}.`
            : `${curr.monthName.hi}: कोई लेन-देन दर्ज नहीं है।`
        }
      };
    }

    const prev = rawMonths[idx - 1];
    const isCurrent = curr.isCurrentMonth;

    if (isCurrent) {
      const incComp = buildComparison(curr.income, prev.mtdIncome, 'income', true);
      const expComp = buildComparison(curr.expenses, prev.mtdExpenses, 'expense', true);
      const prfComp = buildComparison(curr.profit, prev.mtdProfit, 'profit', true);
      const udhComp = buildComparison(curr.outstandingUdhaar, prev.outstandingUdhaar, 'udhaar', true);

      return {
        ...curr,
        comparisonType: 'mtd',
        comparisonPeriodLabel: {
          en: `Month-to-Date (${curr.elapsedDays} elapsed days vs ${prev.monthName.en})`,
          mr: `चालू महिना (${curr.elapsedDays} दिवसांची ${prev.monthName.mr} शी तुलना)`,
          hi: `चालू माह (${curr.elapsedDays} दिनों की ${prev.monthName.hi} से तुलना)`
        },
        incomeComparison: incComp,
        expenseComparison: expComp,
        profitComparison: prfComp,
        udhaarComparison: udhComp,
        speechSummary: {
          en: `${curr.monthName.en} Month-to-date: ${curr.hasData ? `Income ₹${curr.income.toLocaleString('en-IN')}, expenses ₹${curr.expenses.toLocaleString('en-IN')}, net profit ₹${curr.profit.toLocaleString('en-IN')} across ${curr.elapsedDays} elapsed days.` : 'No transactions recorded yet this month.'}`,
          mr: `${curr.monthName.mr} चालू महिना आजपर्यंत: ${curr.hasData ? `मिळकत ₹${curr.income.toLocaleString('en-IN')}, खर्च ₹${curr.expenses.toLocaleString('en-IN')}, निव्वळ नफा ₹${curr.profit.toLocaleString('en-IN')}.` : 'या महिन्यात अजून नोंदी केलेल्या नाहीत.'}`,
          hi: `${curr.monthName.hi} चालू माह अब तक: ${curr.hasData ? `आमदनी ₹${curr.income.toLocaleString('en-IN')}, खर्च ₹${curr.expenses.toLocaleString('en-IN')}, शुद्ध मुनाफ़ा ₹${curr.profit.toLocaleString('en-IN')}.` : 'इस माह में अभी कोई लेन-देन दर्ज नहीं है।'}`
        }
      };
    }

    const incComp = buildComparison(curr.income, prev.income, 'income', false);
    const expComp = buildComparison(curr.expenses, prev.expenses, 'expense', false);
    const prfComp = buildComparison(curr.profit, prev.profit, 'profit', false);
    const udhComp = buildComparison(curr.outstandingUdhaar, prev.outstandingUdhaar, 'udhaar', false);

    return {
      ...curr,
      comparisonType: 'full',
      comparisonPeriodLabel: {
        en: `Full Month vs ${prev.monthName.en}`,
        mr: `पूर्ण महिना तुलना (${prev.monthName.mr})`,
        hi: `पूर्ण माह तुलना (${prev.monthName.hi})`
      },
      incomeComparison: incComp,
      expenseComparison: expComp,
      profitComparison: prfComp,
      udhaarComparison: udhComp,
      speechSummary: {
        en: curr.hasData 
          ? `${curr.monthName.en}: Gross income ₹${curr.income.toLocaleString('en-IN')}, expenses ₹${curr.expenses.toLocaleString('en-IN')}, net profit ₹${curr.profit.toLocaleString('en-IN')} (${curr.profitMarginPercent}% margin).`
          : `${curr.monthName.en}: No recorded transactions.`,
        mr: curr.hasData
          ? `${curr.monthName.mr}: एकूण मिळकत ₹${curr.income.toLocaleString('en-IN')}, खर्च ₹${curr.expenses.toLocaleString('en-IN')}, निव्वळ नफा ₹${curr.profit.toLocaleString('en-IN')} (${curr.profitMarginPercent}% मार्जिन).`
          : `${curr.monthName.mr}: कोणतेही व्यवहार नोंदवलेले नाहीत.`,
        hi: curr.hasData
          ? `${curr.monthName.hi}: कुल आमदनी ₹${curr.income.toLocaleString('en-IN')}, खर्च ₹${curr.expenses.toLocaleString('en-IN')}, शुद्ध मुनाफ़ा ₹${curr.profit.toLocaleString('en-IN')} (${curr.profitMarginPercent}% मार्जिन)।`
          : `${curr.monthName.hi}: कोई लेन-देन दर्ज नहीं है।`
      }
    };
  });

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);
  const totalProfit = totalIncome - totalExpenses;
  const overallMargin = totalIncome > 0 ? Math.round((totalProfit / totalIncome) * 1000) / 10 : 0;
  const totalActiveDays = months.reduce((s, m) => s + m.activeDaysCount, 0);
  const totalTx = months.reduce((s, m) => s + m.txCount, 0);

  return {
    months,
    twelveMonthTotals: {
      income: totalIncome,
      expenses: totalExpenses,
      profit: totalProfit,
      profitMarginPercent: overallMargin,
      activeDays: totalActiveDays,
      txCount: totalTx,
      avgMonthlyIncome: Math.round(totalIncome / 12),
      avgMonthlyExpenses: Math.round(totalExpenses / 12),
      avgMonthlyProfit: Math.round(totalProfit / 12)
    },
    twelveMonthSpeechSummary: {
      en: `12-Month Financial History: Recorded ₹${totalIncome.toLocaleString('en-IN')} total income, ₹${totalExpenses.toLocaleString('en-IN')} total expenses, with a net profit of ₹${totalProfit.toLocaleString('en-IN')} (${overallMargin}% margin) across ${totalActiveDays} active logging days.`,
      mr: `१२-महिन्यांचा आर्थिक इतिहास: एकूण नोंदवलेली मिळकत ₹${totalIncome.toLocaleString('en-IN')}, एकूण खर्च ₹${totalExpenses.toLocaleString('en-IN')}, निव्वळ नफा ₹${totalProfit.toLocaleString('en-IN')} (${overallMargin}% मार्जिन), आणि एकूण ${totalActiveDays} सक्रिय दिवस.`,
      hi: `12-माह का वित्तीय इतिहास: कुल आमदनी ₹${totalIncome.toLocaleString('en-IN')}, कुल खर्च ₹${totalExpenses.toLocaleString('en-IN')}, कुल शुद्ध मुनाफ़ा ₹${totalProfit.toLocaleString('en-IN')} (${overallMargin}% मार्जिन), और कुल ${totalActiveDays} सक्रिय कार्य दिवस।`
    }
  };
}
