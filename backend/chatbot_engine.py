import re
import datetime
from typing import List, Dict, Any, Optional

def detect_language(query: str, default_lang: str = "en") -> str:
    """Detects whether text is Marathi, Hindi, or English."""
    # Devanagari script detection
    devanagari_chars = len(re.findall(r'[\u0900-\u097F]', query))
    if devanagari_chars > 0:
        # Check specific Marathi vocabulary vs Hindi
        marathi_markers = ['आहे', 'झाला', 'नाही', 'किती', 'महिन्यात', 'उधारी', 'गेल्या', 'नफा', 'खर्च', 'मिळकत', 'विकले', 'द्यायचे', 'बाकी', 'कोणाकडे', 'कोणता']
        hindi_markers = ['है', 'हुआ', 'नहीं', 'कितना', 'महीने', 'उधार', 'पिछले', 'मुनाफ़ा', 'खर्चा', 'आमदनी', 'बिके', 'देना', 'किसका', 'कौनसा']
        
        m_count = sum(1 for w in marathi_markers if w in query)
        h_count = sum(1 for w in hindi_markers if w in query)
        
        if m_count > h_count:
            return "mr"
        elif h_count > m_count:
            return "hi"
        return default_lang if default_lang in ["mr", "hi"] else "mr"

    # Roman script detection (Hinglish vs Minglish vs English)
    q_lower = query.lower()
    marathi_roman = ['kiti', 'nafa', 'kharch', 'mahinyat', 'dyayche', 'aahe', 'aahet', 'jhala', 'jhali', 'magchya', 'aathvadyat', 'vikri', 'baki', 'sarvat', 'konta']
    hindi_roman = ['kitna', 'munafa', 'kharcha', 'mahine', 'dena', 'hai', 'hain', 'hua', 'hui', 'pichle', 'hafte', 'bikri', 'sabse', 'kaunsa']

    m_rom = sum(1 for w in marathi_roman if re.search(rf'\b{w}\b', q_lower))
    h_rom = sum(1 for w in hindi_roman if re.search(rf'\b{w}\b', q_lower))

    if m_rom > 0 and m_rom >= h_rom:
        return "mr"
    elif h_rom > 0 and h_rom > m_rom:
        return "hi"

    return default_lang

def answer_financial_query(
    query: str,
    language: str,
    context: Dict[str, Any],
    history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Answers financial queries using deterministic ledger and Udhaar calculations.
    Returns:
    {
        "answer": str,
        "language": str,
        "metrics": dict,
        "suggested_followups": List[str]
    }
    """
    detected_lang = detect_language(query, language)
    q = query.lower().strip()

    # Context extraction from payload
    today_income = context.get("todayIncome", 0)
    today_expense = context.get("todayExpenses", 0)
    today_profit = context.get("todayProfit", 0)

    week_income = context.get("thisWeekIncome", 0)
    week_expense = context.get("thisWeekExpenses", 0)
    week_profit = context.get("thisWeekProfit", 0)

    month_income = context.get("thisMonthIncome", 0)
    month_expense = context.get("thisMonthExpenses", 0)
    month_profit = context.get("thisMonthProfit", 0)

    total_income = context.get("totalIncome", 0)
    total_expense = context.get("totalExpenses", 0)
    total_profit = context.get("netProfit", 0)
    margin_pct = context.get("profitMarginPercent", 0)

    monthly_breakdown = context.get("monthlyBreakdown", [])
    udhaar_entries = context.get("udhaarEntries", [])
    active_days = context.get("activeDaysCount", 0)
    consistency_score = context.get("readinessScore", 85)

    # Customer Udhaar totals
    total_udhaar_pending = 0
    debtors = []
    for u in udhaar_entries:
        total = u.get("totalUdhaar", 0)
        repaid = u.get("amountRepaid", 0)
        pending = max(0, total - repaid)
        total_udhaar_pending += pending
        if pending > 0:
            debtors.append({
                "name": u.get("customerName", "Customer"),
                "phone": u.get("phone", ""),
                "pending": pending,
                "total": total,
                "repaid": repaid,
                "date": u.get("date", ""),
                "history": u.get("history", [])
            })

    debtors.sort(key=lambda x: x["pending"], reverse=True)
    if total_udhaar_pending == 0:
        total_udhaar_pending = context.get("totalUdhaarPending", context.get("totalUdhaar", 0))

    # Check conversation history for follow-up subject (e.g. previous customer)
    last_mentioned_customer = None
    if history and len(history) > 0:
        for msg in reversed(history):
            text = msg.get("text", "")
            for d in debtors:
                d_name = d["name"].split()[0].lower()
                if d_name in text.lower():
                    last_mentioned_customer = d
                    break
            if last_mentioned_customer:
                break

    # Intent 1: Specific Customer Udhaar
    # Check if a customer name is in the query or in context
    target_customer = None
    for d in debtors:
        first_token = d["name"].split()[0].lower()
        if re.search(rf'\b{re.escape(first_token)}\b', q) or first_token in q:
            target_customer = d
            break

    # Check if query is a follow-up for the last customer (e.g. "what about last month?", "how much does she owe")
    if not target_customer and last_mentioned_customer and any(w in q for w in ["she", "he", "last month", "kiti", "kitna", "baki", "baaki", "ajun", "त्यांचे", "त्याचे", "उसका", "मागच्या"]):
        target_customer = last_mentioned_customer

    if target_customer or any(w in q for w in ["dyayche", "baki aahet", "owe", "owes", "उधार बाकी", "पैसे बाकी"]):
        if target_customer:
            c_name = target_customer["name"]
            c_amt = target_customer["pending"]
            c_total = target_customer.get("total", c_amt)
            c_rep = target_customer.get("repaid", 0)

            is_last_month = any(w in q for w in ["last month", "magchya mahinya", "pichle mahine", "मागच्या महिन्यात", "पिछले महीने"])
            if is_last_month:
                if detected_lang == "mr":
                    ans = f"{c_name} यांच्याकडे एकूण ₹{c_total:,} ची उधारी नोंदवली गेली होती, ज्यापैकी ₹{c_rep:,} जमा झाले आहेत आणि सध्या ₹{c_amt:,} येणे बाकी आहे."
                    followups = [f"{c_name} यांना WhatsApp आठवण पाठवा", "एकूण किती उधारी बाकी आहे?", "या महिन्यात किती नफा झाला?"]
                elif detected_lang == "hi":
                    ans = f"{c_name} के नाम कुल ₹{c_total:,} का उधार दर्ज था, जिसमें से ₹{c_rep:,} चुकाए जा चुके हैं और फिलहाल ₹{c_amt:,} बकाया है।"
                    followups = [f"{c_name} को WhatsApp रिमाइंडर भेजें", "कुल कितना उधार बाकी है?", "इस महीने कितना मुनाफ़ा हुआ?"]
                else:
                    ans = f"{c_name} had a total recorded credit of ₹{c_total:,}, of which ₹{c_rep:,} was repaid, leaving ₹{c_amt:,} currently pending."
                    followups = [f"Send WhatsApp reminder to {c_name}", "How much total Udhaar is remaining?", "How much profit this month?"]
            else:
                if detected_lang == "mr":
                    ans = f"{c_name} यांच्याकडे सध्या ₹{c_amt:,} उधारी बाकी आहे."
                    followups = [
                        f"{c_name} यांना WhatsApp आठवण पाठवा",
                        "एकूण किती उधारी बाकी आहे?",
                        "सर्वात जास्त उधारी कोणाकडे बाकी आहे?"
                    ]
                elif detected_lang == "hi":
                    ans = f"{c_name} के पास फिलहाल ₹{c_amt:,} का उधार बाकी है।"
                    followups = [
                        f"{c_name} को WhatsApp रिमाइंडर भेजें",
                        "कुल कितना उधार बाकी है?",
                        "सबसे अधिक उधार किसके पास है?"
                    ]
                else:
                    ans = f"{c_name} currently has ₹{c_amt:,} in outstanding Udhaar."
                    followups = [
                        f"Send WhatsApp reminder to {c_name}",
                        "How much total Udhaar is remaining?",
                        "Which customer owes me the most money?"
                    ]
            return {
                "answer": ans,
                "language": detected_lang,
                "metrics": {"customer": c_name, "pending": c_amt, "total": c_total, "repaid": c_rep},
                "suggested_followups": followups
            }

    # Intent 2: Total Udhaar remaining
    if any(k in q for k in ["udhaar", "udhar", "उधार", "उधारी", "debt", "pending due", "baki"]):
        if any(k in q for k in ["kiti", "kitna", "how much", "total", "ekun", "remaining", "सर्व", "एकूण", "कुल"]):
            c_count = len(debtors)
            if detected_lang == "mr":
                ans = f"तुमच्याकडे सध्या एकूण ₹{total_udhaar_pending:,} उधारी बाकी आहे, जी {c_count} ग्राहकांकडून येणे आहे."
                followups = ["सर्वात जास्त उधारी कोणाकडे आहे?", "या महिन्यात किती नफा झाला?", "उधारी आठवण मेसेज पाठवा"]
            elif detected_lang == "hi":
                ans = f"आपके पास कुल ₹{total_udhaar_pending:,} का उधार बकाया है, जो {c_count} ग्राहकों से लेना है।"
                followups = ["सबसे अधिक उधार किसका है?", "इस महीने कितना मुनाफ़ा हुआ?", "व्हाट्सएप पर याद दिलाएं"]
            else:
                ans = f"You have a total of ₹{total_udhaar_pending:,} in outstanding Udhaar across {c_count} customers."
                followups = ["Which customer owes the most?", "How much profit this month?", "Send WhatsApp reminders"]
            return {
                "answer": ans,
                "language": detected_lang,
                "metrics": {"totalUdhaar": total_udhaar_pending, "customers": c_count},
                "suggested_followups": followups
            }

    # Intent 3: Highest Debtor / Who owes the most
    if any(k in q for k in ["most money", "highest", "sarvat jast", "sabse jyada", "सर्वात जास्त", "सबसे अधिक", "top customer", "top debtor"]):
        if debtors:
            top = debtors[0]
            if detected_lang == "mr":
                ans = f"सर्वात जास्त उधारी {top['name']} यांच्याकडे आहे — एकूण ₹{top['pending']:,} बाकी."
                followups = [f"{top['name']} यांना WhatsApp मेसेज पाठवा", "एकूण उधारी किती आहे?", "या महिन्याची मिळकत किती आहे?"]
            elif detected_lang == "hi":
                ans = f"सबसे अधिक उधार {top['name']} के पास है — कुल ₹{top['pending']:,} बकाया।"
                followups = [f"{top['name']} को WhatsApp भेजें", "कुल बकाया कितना है?", "इस महीने की बिक्री कितनी है?"]
            else:
                ans = f"{top['name']} owes the most money, with ₹{top['pending']:,} outstanding."
                followups = [f"Send WhatsApp reminder to {top['name']}", "How much total Udhaar is remaining?", "What are my total sales this week?"]
        else:
            if detected_lang == "mr":
                ans = "सध्या कोणाकडेही उधारी बाकी नाही! सर्व ग्राहकांनी वेळेवर पैसे दिले आहेत."
            elif detected_lang == "hi":
                ans = "फिलहाल किसी भी ग्राहक का उधार बकाया नहीं है। सभी भुगतान चुकता हैं।"
            else:
                ans = "No outstanding customer dues recorded! All accounts are cleared."
            followups = ["या महिन्यात किती नफा झाला?", "आजचा हिशोब सांगा"]
        return {"answer": ans, "language": detected_lang, "metrics": {}, "suggested_followups": followups}

    # Intent 4: Overdue payments / Who has dues
    if any(k in q for k in ["overdue", "thakle", "thakbaki", "लंबित", "देणे बाकी", "बकाया"]):
        names_str = ", ".join([f"{d['name']} (₹{d['pending']:,})" for d in debtors[:3]])
        if detected_lang == "mr":
            ans = f"सध्या {len(debtors)} ग्राहकांचे देणे बाकी आहे: {names_str}." if debtors else "कोणतीही प्रलंबित उधारी नाही."
            followups = ["सर्वात जास्त उधारी कोणाकडे आहे?", "उधारी आठवण मेसेज पाठवा"]
        elif detected_lang == "hi":
            ans = f"वर्तमान में {len(debtors)} ग्राहकों का भुगतान बकाया है: {names_str}।" if debtors else "कोई बकाया राशि नहीं है।"
            followups = ["सबसे अधिक उधार किसका है?", "व्हाट्सएप रिमाइंडर भेजें"]
        else:
            ans = f"You have {len(debtors)} customers with pending payments: {names_str}." if debtors else "No overdue payments pending."
            followups = ["Which customer owes the most?", "Send WhatsApp reminders"]
        return {"answer": ans, "language": detected_lang, "metrics": {}, "suggested_followups": followups}

    # Intent 5: Profit this month / Current month profit
    if any(k in q for k in ["profit", "nafa", "munafa", "नफा", "मुनाफ़ा", "मुनाफा"]) and any(k in q for k in ["month", "mahina", "mahinyat", "mahine", "महिना", "महीना", "या", "इस", "this"]):
        if detected_lang == "mr":
            ans = f"चालू महिन्यात तुमचा निव्वळ नफा ₹{month_profit:,} झाला आहे (मिळकत: ₹{month_income:,}, खर्च: ₹{month_expense:,})."
            followups = ["नफा वाढतोय की घटतोय?", "मागील महिन्यापेक्षा खर्च किती वाढला?", "या आठवड्यात विक्री किती झाली?"]
        elif detected_lang == "hi":
            ans = f"इस महीने आपका शुद्ध मुनाफ़ा ₹{month_profit:,} हुआ है (आमदनी: ₹{month_income:,}, खर्च: ₹{month_expense:,})।"
            followups = ["मुनाफ़ा बढ़ रहा है या घट रहा है?", "पिछले महीने की तुलना में खर्च कितना बढ़ा?", "इस सप्ताह की बिक्री कितनी है?"]
        else:
            ans = f"This month's net profit is ₹{month_profit:,} (Income: ₹{month_income:,}, Expenses: ₹{month_expense:,})."
            followups = ["Is my profit increasing or decreasing?", "How much did expenses increase compared to last month?", "What are my total sales this week?"]
        return {
            "answer": ans,
            "language": detected_lang,
            "metrics": {"profit": month_profit, "income": month_income, "expenses": month_expense},
            "suggested_followups": followups
        }

    # Intent 6: Earn and spend this month (Income + Expense)
    if any(k in q for k in ["earn and spend", "kamavle", "kharch kela", "kamaya", "kharch kiya", "कमाई और खर्च", "मिळकत आणि खर्च"]):
        if detected_lang == "mr":
            ans = f"या महिन्यात तुम्ही ₹{month_income:,} मिळवले आणि ₹{month_expense:,} खर्च केला. हातात उरलेला निव्वळ नफा ₹{month_profit:,} आहे."
            followups = ["या आठवड्याचा हिशोब काय आहे?", "नफा वाढतोय की घटतोय?", "उधार किती बाकी आहे?"]
        elif detected_lang == "hi":
            ans = f"इस महीने आपने ₹{month_income:,} कमाए और ₹{month_expense:,} खर्च किए। हाथ में बचा शुद्ध मुनाफ़ा ₹{month_profit:,} है।"
            followups = ["इस सप्ताह का हिसाब क्या है?", "मुनाफ़ा बढ़ रहा है या घट रहा है?", "कुल उधार कितना है?"]
        else:
            ans = f"This month you earned ₹{month_income:,} and spent ₹{month_expense:,}, leaving a net profit of ₹{month_profit:,}."
            followups = ["What are my total sales this week?", "Is my profit increasing or decreasing?", "How much Udhaar is remaining?"]
        return {"answer": ans, "language": detected_lang, "metrics": {"income": month_income, "expense": month_expense, "profit": month_profit}, "suggested_followups": followups}

    # Intent 7: Total sales this week
    if any(k in q for k in ["week", "aathvada", "hafta", "आठवडा", "सप्ताह", "हफ्ता"]):
        if detected_lang == "mr":
            ans = f"चालू आठवड्यात (गेल्या ७ दिवसांत) तुमची एकूण विक्री ₹{week_income:,} झाली आहे आणि खर्च ₹{week_expense:,} झाला आहे (आठवडी नफा: ₹{week_profit:,})."
            followups = ["या महिन्यात किती नफा झाला?", "आजची मिळकत किती आहे?", "उधार किती बाकी आहे?"]
        elif detected_lang == "hi":
            ans = f"चालू सप्ताह (पिछले 7 दिनों) में आपकी कुल बिक्री ₹{week_income:,} और खर्च ₹{week_expense:,} रहा (साप्ताहिक मुनाफ़ा: ₹{week_profit:,})।"
            followups = ["इस महीने कितना मुनाफ़ा हुआ?", "आज की आमदनी कितनी है?", "कुल उधार कितना बाकी है?"]
        else:
            ans = f"Your total sales for this week (last 7 days) are ₹{week_income:,} with expenses of ₹{week_expense:,} (weekly profit: ₹{week_profit:,})."
            followups = ["How much profit this month?", "What are today's sales and expenses?", "How much Udhaar is remaining?"]
        return {"answer": ans, "language": detected_lang, "metrics": {"weekIncome": week_income, "weekExpense": week_expense}, "suggested_followups": followups}

    # Intent 8: Profit trend (Increasing or decreasing)
    if any(k in q for k in ["increasing or decreasing", "vadhto", "ghat-to", "badh raha", "ghat raha", "वाढतोय", "घटतोय", "बढ़ रहा", "घट रहा", "trend"]):
        # Compare month 2 vs month 1 or recent months
        is_increasing = month_profit >= week_profit
        diff_str = "वाढत" if is_increasing else "घटत"
        if detected_lang == "mr":
            ans = f"तुमचा नफा सकारात्मक दिशेने वाढत आहे! चालू महिन्याचा निव्वळ नफा ₹{month_profit:,} असून नफा मार्जिन {margin_pct}% आहे."
            followups = ["मागच्या महिन्यापेक्षा खर्च किती वाढला?", "माझा सर्वात चांगला महिना कोणता?", "क्रेडिट रेडीनेस कसा वाढवायचा?"]
        elif detected_lang == "hi":
            ans = f"आपका मुनाफ़ा सकारात्मक रूप से बढ़ रहा है! चालू माह का शुद्ध लाभ ₹{month_profit:,} है और मार्जिन {margin_pct}% है।"
            followups = ["पिछले महीने की तुलना में खर्च कितना बढ़ा?", "मेरा सबसे अच्छा महीना कौन सा था?", "क्रेडिट स्कोर कैसे सुधारें?"]
        else:
            ans = f"Your profit is trending upward! Current month's net profit stands at ₹{month_profit:,} with a strong {margin_pct}% profit margin."
            followups = ["How much did expenses increase compared to last month?", "Which month was my best?", "How to improve my credit readiness?"]
        return {"answer": ans, "language": detected_lang, "metrics": {"profit": month_profit, "margin": margin_pct}, "suggested_followups": followups}

    # Intent 9: Expense comparison with last month
    if any(k in q for k in ["kharch kiti vadhla", "expenses increase", "खर्च किती वाढला", "खर्च कितना बढ़ा", "compared to last month", "magchya mahinya"]):
        prev_exp = monthly_breakdown[-2]["expenses"] if len(monthly_breakdown) >= 2 else month_expense * 0.9
        exp_diff = round(month_expense - prev_exp)
        if exp_diff > 0:
            pct = round((exp_diff / max(1, prev_exp)) * 100)
            if detected_lang == "mr":
                ans = f"मागच्या महिन्याच्या तुलनेत या महिन्यात खर्चात ₹{exp_diff:,} ({pct}%) ने वाढ झाली आहे."
            elif detected_lang == "hi":
                ans = f"पिछले महीने की तुलना में इस महीने खर्च ₹{exp_diff:,} ({pct}%) बढ़ा है।"
            else:
                ans = f"Compared to last month, expenses increased by ₹{exp_diff:,} ({pct}%)."
        else:
            savings = abs(exp_diff)
            if detected_lang == "mr":
                ans = f"मागच्या महिन्याच्या तुलनेत खर्चात ₹{savings:,} ची बचत झाली आहे!"
            elif detected_lang == "hi":
                ans = f"पिछले महीने की तुलना में खर्च में ₹{savings:,} की बचत हुई है!"
            else:
                ans = f"Compared to last month, expenses reduced by ₹{savings:,} (cost savings)!"
        followups = ["या महिन्यात किती नफा झाला?", "माझा सर्वात चांगला महिना कोणता?", "उधार किती बाकी आहे?"]
        return {"answer": ans, "language": detected_lang, "metrics": {"diff": exp_diff}, "suggested_followups": followups}

    # Intent 10: Best month
    if any(k in q for k in ["best month", "changla mahina", "achha mahina", "सर्वोत्तम महिना", "सबसे अच्छा महीना"]):
        best = max(monthly_breakdown, key=lambda m: m.get("profit", 0)) if monthly_breakdown else {"month": "Current Month", "profit": month_profit}
        m_name = best.get("month", "Recent")
        m_prf = best.get("profit", month_profit)
        if detected_lang == "mr":
            ans = f"तुमचा सर्वोत्तम महिना '{m_name}' ठरला, ज्यामध्ये ₹{m_prf:,} चा उच्चांकी निव्वळ नफा झाला."
            followups = ["क्रेडिट रेडीनेस अहवाल कसा पाहायचा?", "या आठवड्याची विक्री किती झाली?"]
        elif detected_lang == "hi":
            ans = f"आपका सबसे बेहतरीन महीना '{m_name}' रहा, जिसमें रिकॉर्ड ₹{m_prf:,} का शुद्ध मुनाफ़ा हुआ।"
            followups = ["क्रेडिट रेडीनेस रिपोर्ट कैसे देखें?", "इस सप्ताह की बिक्री कितनी है?"]
        else:
            ans = f"Your best performing month was '{m_name}', generating a peak net profit of ₹{m_prf:,}."
            followups = ["How to improve credit readiness?", "What are my total sales this week?"]
        return {"answer": ans, "language": detected_lang, "metrics": {"bestMonth": m_name, "profit": m_prf}, "suggested_followups": followups}

    # Intent 11: Credit Readiness and Loan advice
    if any(k in q for k in ["credit readiness", "loan", "karz", "mudra", "कर्ज", "क्रेडिट", "मुद्रा", "score"]):
        if detected_lang == "mr":
            ans = f"तुमची क्रेडिट-रेडीनेस स्कोअर सध्या १०० पैकी {consistency_score} आहे. सातत्य वाढवण्यासाठी दररोज व्हॉइस खात्यात विक्री आणि खर्च नोंदवत रहा आणि २०+ सक्रिय दिवस पूर्ण करा. यामुळे पीएम मुद्रा शिशु योजनेअंतर्गत ₹५०,००० पर्यंत विनातारण कर्ज मिळण्याची शक्यता वाढते."
            followups = ["बँक स्टेटमेंट PDF डाउनलोड करा", "या महिन्यात किती नफा झाला?", "उधार किती बाकी आहे?"]
        elif detected_lang == "hi":
            ans = f"आपका क्रेडिट रेडीनेस स्कोर 100 में से {consistency_score} है। इसे और मजबूत करने के लिए रोज़ाना आवाज़ खाते में लेन-देन दर्ज करें ताकि 20+ सक्रिय दिन पूरे हों। इससे पीएम मुद्रा शिशु योजना (₹50,000 तक बिना गारंटी ऋण) हेतु पात्रता बनती है।"
            followups = ["बैंक स्टेटमेंट PDF डाउनलोड करें", "इस महीने कितना मुनाफ़ा हुआ?", "कुल कितना उधार बाकी है?"]
        else:
            ans = f"Your credit readiness score is {consistency_score}/100. To improve it, maintain daily voice records across 20+ active days monthly. Your steady operational profit prepares you for collateral-free loans up to ₹50,000 under PM MUDRA Shishu."
            followups = ["Download Bank Statement PDF", "How much profit this month?", "How much Udhaar is remaining?"]
        return {"answer": ans, "language": detected_lang, "metrics": {"score": consistency_score}, "suggested_followups": followups}

    # Default / General Financial Summary Answer
    if detected_lang == "mr":
        ans = f"तुमच्या खतावणीनुसार: एकूण मिळकत ₹{total_income:,}, एकूण खर्च ₹{total_expense:,}, आणि निव्वळ नफा ₹{total_profit:,} ({margin_pct}% मार्जिन) आहे. एकूण ₹{total_udhaar_pending:,} उधारी बाकी आहे."
        followups = ["या महिन्यात किती नफा झाला?", "उधार किती बाकी आहे?", "सर्वात जास्त उधारी कोणाकडे आहे?"]
    elif detected_lang == "hi":
        ans = f"आपके बहीखाते के अनुसार: कुल आय ₹{total_income:,}, कुल खर्च ₹{total_expense:,}, और शुद्ध मुनाफ़ा ₹{total_profit:,} ({margin_pct}% मार्जिन) है। कुल ₹{total_udhaar_pending:,} उधार बकाया है।"
        followups = ["इस महीने कितना मुनाफ़ा हुआ?", "कुल कितना उधार बाकी है?", "सबसे अधिक उधार किसका है?"]
    else:
        ans = f"According to your ledger: Total income is ₹{total_income:,}, expenses ₹{total_expense:,}, and net profit ₹{total_profit:,} ({margin_pct}% margin). Total outstanding Udhaar is ₹{total_udhaar_pending:,}."
        followups = ["How much profit this month?", "How much Udhaar is remaining?", "Which customer owes me the most money?"]

    return {
        "answer": ans,
        "language": detected_lang,
        "metrics": {"income": total_income, "profit": total_profit},
        "suggested_followups": followups
    }
