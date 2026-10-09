import re
import datetime
from typing import List, Dict, Any, Optional

NUMBER_WORDS = {
    'दोन': 2, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाच': 5, 'पांच': 5,
    'सहा': 6, 'छह': 6, 'सात': 7, 'आठ': 8, 'नऊ': 9, 'नौ': 9, 'दहा': 10, 'दस': 10,
    'अकरा': 11, 'ग्यारह': 11, 'बारा': 12, 'बारह': 12, 'तेरा': 13, 'चौदा': 14, 'चौदह': 14,
    'पंधरा': 15, 'पंद्रह': 15, 'सोळा': 16, 'सोलह': 16, 'सतरा': 17, 'सत्रह': 17,
    'अठरा': 18, 'अठारह': 18, 'एकोणीस': 19, 'उन्नीस': 19, 'वीस': 20, 'बीस': 20,
    'तीस': 30, 'चाळीस': 40, 'चालीस': 40, 'पन्नास': 50, 'पचास': 50,
    'शंभर': 100, 'सौ': 100, 'दोनशे': 200, 'दो सौ': 200, 'तीनशे': 300, 'तीन सौ': 300,
    'चारशे': 400, 'चार सौ': 400, 'पाचशे': 500, 'पाँच सौ': 500, 'सहाशे': 600, 'छह सौ': 600,
    'सातशे': 700, 'आठशे': 800, 'नऊशे': 900, 'हजार': 1000, 'हज़ार': 1000
}

CURRENCY_REGEX = r'(?:rupees|rupess|rupes|rupya|rupiya|रुपयांचे|रुपयांचा|रुपयांची|रुपयांच्या|रुपये|रु|₹|rs\.?|inr)'

def normalize_speech_text(text: str) -> str:
    t = text.lower()
    t = t.replace('₹', ' ₹ ').replace('?', ' . ').replace('।', ' . ').replace('!', ' . ').replace(',', ' , ')
    t = re.sub(r'\brupess?\b|\brupes\b|\brupya\b|\brupiya\b|\brs\.?\b|\binr\b', ' rupees ', t)
    t = re.sub(r'\bsolde\b', 'sold', t)
    t = re.sub(r'\bdaba\b', 'dabba', t)
    t = re.sub(r'\btifins?\b', 'tiffin', t)
    t = re.sub(r'\bspended\b|\bspend\b', 'spent', t)
    t = re.sub(r'ब्लाऊज|ब्लाउझ|ब्लाऊझ', 'ब्लाउज', t)

    for w, val in NUMBER_WORDS.items():
        t = re.sub(rf'(?:^|(?<=[^a-zA-Z0-9\u0900-\u097f])){re.escape(w)}(?=[^a-zA-Z0-9\u0900-\u097f]|$)', f' {val} ', t)
    return t

def rule_based_extract(text: str) -> List[Dict[str, Any]]:
    today = datetime.date.today()
    today_str = today.isoformat()
    if not text or not text.strip():
        return []

    norm = normalize_speech_text(text)
    
    # Detect spoken relative date or past date
    date_val = today_str
    if re.search(r'(?:^|\s)(?:yesterday|काल|कल)(?:\s|[.,!?।]|$)', norm):
        date_val = (today - datetime.timedelta(days=1)).isoformat()
    elif re.search(r'(?:^|\s)(?:parso|परवा|परसों)(?:\s|[.,!?।]|$)', norm):
        date_val = (today - datetime.timedelta(days=2)).isoformat()
    else:
        m_day = re.search(r'(\d{1,2})\s*(?:तारीख|तारखेला|तारीखला|tarikh|date|th|st|nd|rd)\b', norm)
        if m_day:
            day_num = int(m_day.group(1))
            if 1 <= day_num <= 31:
                try:
                    date_val = today.replace(day=day_num).isoformat()
                except ValueError:
                    pass

    txns = []

    # 1. Rate detection
    rate = None
    rate_span = None

    # Pattern A: '1/one/एक <product> ₹ 400' or '1 dabba at 70'
    m_rateA = re.search(
        rf'(?:(?:^|\s)(?:1|one|एक)\s+([^\d.,!?।]{{1,25}}?)\s*(?:at|@|for|का|चे|ची|च्या|ला|में|प्रती|प्रमाणे)?\s*{CURRENCY_REGEX}?\s*(\d+(?:\.\d+)?))',
        norm
    )
    # Pattern B: '400 प्रमाणे' / '70 रुपये चा एक' / '70 each' / '80 rs per tiffin'
    m_rateB = re.search(
        rf'(\d+(?:\.\d+)?)\s*{CURRENCY_REGEX}?\s*(?:each|per|का\s*एक|चा\s*एक|ची\s*एक|चे\s*एक|प्रत्येकी|प्रती|प्रमाणे)',
        norm
    )
    # Pattern C: 'each 80' / 'per 70' / '@ 50'
    m_rateC = re.search(
        rf'(?:each|per|at|@)\s*{CURRENCY_REGEX}?\s*(\d+(?:\.\d+)?)',
        norm
    )

    if m_rateA:
        rate = float(m_rateA.group(2))
        rate_span = m_rateA.span()
    elif m_rateB:
        rate = float(m_rateB.group(1))
        rate_span = m_rateB.span()
    elif m_rateC:
        rate = float(m_rateC.group(1))
        rate_span = m_rateC.span()

    # 2. Quantity & Product
    qty = None
    product_name = 'वस्तू / Items'
    product_cat = 'Sales'

    KNOWN_ITEMS = [
        ('ब्लाउज / Blouses', ['ब्लाउज', 'blouse', 'blouses'], 'Tailoring Orders'),
        ('ड्रेस / Dresses', ['ड्रेस', 'dress', 'dresses', 'सूट', 'suit', 'suits', 'कुर्ती', 'kurti'], 'Tailoring Orders'),
        ('साड्या / Sarees', ['साडी', 'साड्या', 'saree', 'sarees'], 'Retail Sales'),
        ('डबे / Tiffins', ['डबे', 'डब्बे', 'डब्बा', 'डबा', 'टिफिन', 'tiffin', 'tiffins', 'dabba', 'dabbas', 'थाळी'], 'Meals'),
        ('केक / Cakes', ['केक', 'cake', 'cakes', 'पेस्ट्री', 'pastry'], 'Bakery Sales'),
        ('फेशिअल / Facials', ['फेशिअल', 'facial', 'facials', 'आयब्रो', 'eyebrow'], 'Salon Services'),
    ]

    for disp, syns, cat in KNOWN_ITEMS:
        syn_re = '|'.join(syns)
        matches = list(re.finditer(rf'(\d+)\s*(?:of\s*)?({syn_re})(?:\s|[.,!?।]|$)', norm))
        if matches:
            chosen = matches[0]
            if len(matches) > 1 and chosen.group(1) == '1' and int(matches[1].group(1)) > 1:
                chosen = matches[1]
            elif rate_span and rate_span[0] <= chosen.start() and chosen.end() <= rate_span[1] + 5 and chosen.group(1) == '1':
                other_matches = [m for m in matches if not (rate_span[0] <= m.start() and m.end() <= rate_span[1] + 5)]
                if other_matches:
                    chosen = other_matches[0]
            qty = int(chosen.group(1))
            product_name = disp
            product_cat = cat
            break

    # If no known item, search verb pattern
    if qty is None:
        m_verb = re.search(
            r'(\d+)\s+([^\d.,!?।]{1,25}?)\s+(?:शिवले|शिवल्या|शिवून दिले|विकले|विकल्या|विकला|विकली|बेचे|बेची|बनाए|बनवले|बनवल्या|दिले|दिल्या|केले|केल्या|तैयार किए|तयार केले|sold|stitched|made|delivered)',
            norm
        )
        if m_verb:
            q_val = int(m_verb.group(1))
            noun = m_verb.group(2).strip()
            qty = q_val
            product_name = f'{noun} / Sales'
            product_cat = 'Sales'

    # If still no qty, search any '<number> sold / beche / vikle'
    if qty is None:
        m_gen_qty = re.search(r'(\d+)\s*(?:items?|units?)?\s*(?:sold|beche|vikle|nikle|दिए|सेल)', norm)
        if m_gen_qty:
            qty = int(m_gen_qty.group(1))

    # Calculate sale
    if qty and rate:
        total = round(qty * rate, 2)
        txns.append({
            'type': 'sale',
            'category': product_cat,
            'description': f'{qty} × {product_name} (₹{int(rate) if rate.is_integer() else rate} each)',
            'quantity': qty,
            'unit_price': rate,
            'amount': total,
            'date': date_val
        })
    elif qty and not rate:
        m_flat = re.search(rf'(\d+(?:\.\d+)?)\s*{CURRENCY_REGEX}?\s*(?:total|me|में|मिले|कमाई|बिक्री|विक्री)', norm)
        if m_flat:
            amt = float(m_flat.group(1))
            txns.append({
                'type': 'sale',
                'category': product_cat,
                'description': f'{qty} × {product_name}',
                'quantity': qty,
                'unit_price': round(amt / qty, 2),
                'amount': amt,
                'date': date_val
            })
    elif rate and not qty:
        txns.append({
            'type': 'sale',
            'category': product_cat,
            'description': f'१ × {product_name}',
            'quantity': 1,
            'unit_price': rate,
            'amount': rate,
            'date': date_val
        })

    # Flat sale fallback
    if not txns:
        m_flat_only = re.search(rf'(\d+(?:\.\d+)?)\s*{CURRENCY_REGEX}?\s*(?:ची\s*विक्री|की\s*बिक्री|सेल|sales|मिले|मिळाले|कमाई)', norm)
        if not m_flat_only:
            m_flat_only = re.search(rf'(?:sales|बिक्री|कमाई|विक्री)\s*(\d+(?:\.\d+)?)', norm)
        if m_flat_only:
            amt = float(m_flat_only.group(1))
            txns.append({
                'type': 'sale',
                'category': 'Sales',
                'description': 'दैनिक विक्री / Daily Sales',
                'quantity': 1,
                'unit_price': amt,
                'amount': amt,
                'date': date_val
            })

    # 3. Detect Itemized Expenses
    EXPENSE_CATEGORIES = [
        ('भाजी / Vegetables', ['vegetables', 'veggies', 'sabzi', 'sabji', 'bhaji', 'भाजी', 'सब्जी', 'भाजीपाला'], 'Grocery'),
        ('गहू / Wheat', ['wheat', 'atta', 'flour', 'गेहूं', 'गहू', 'पीठ'], 'Grocery'),
        ('तेल / Oil', ['oil', 'cooking oil', 'तेल'], 'Grocery'),
        ('मसाले / Spices', ['spices', 'masala', 'मसाला', 'मसाले'], 'Grocery'),
        ('गॅस / Gas Cylinder', ['gas', 'cylinder', 'गॅस', 'गैस'], 'Utilities'),
        ('कापड / Fabric', ['fabric', 'cloth', 'kapda', 'कापड', 'कपड़ा'], 'Raw Material'),
        ('धागा / Thread', ['thread', 'threads', 'धागा'], 'Supplies'),
        ('अस्तर / Lining', ['अस्तर', 'lining', 'astar'], 'Supplies'),
        ('लेस / Lace', ['लेस', 'lace', 'लेसचा'], 'Supplies'),
        ('क्रीम / Cream', ['क्रीम', 'cream'], 'Bakery Supplies'),
        ('मैदा / Flour', ['मैदा', 'maida'], 'Bakery Supplies'),
        ('भाडे / Rent & Travel', ['भाडे', 'भाडा', 'टेम्पो', 'rent', 'auto', 'tempo'], 'Logistics'),
        ('किराणा / Groceries', ['grocery', 'groceries', 'किराणा', 'सामान'], 'Grocery')
    ]

    for disp_name, syns, cat in EXPENSE_CATEGORIES:
        syn_re = '|'.join(syns)
        p1 = rf'(\d+(?:\.\d+)?)\s*{CURRENCY_REGEX}?\s*(?:i\s*)?(?:spent|spend|खर्च|लागत|for|on|की|का|के|चा|चे|ची|च्या)?\s*(?:on\s*)?(?:{syn_re})(?:\s|[.,!?।]|$)'
        p2 = rf'(?:{syn_re})\s*(?:for|cost|worth|of|के|चे|चा)?\s*{CURRENCY_REGEX}?\s*(\d+(?:\.\d+)?)(?:\s|[.,!?।]|$)'
        m1 = re.search(p1, norm)
        m2 = re.search(p2, norm)
        if m1:
            amt = float(m1.group(1))
            if not any(t['amount'] == amt for t in txns):
                txns.append({'type': 'expense', 'category': cat, 'description': disp_name, 'amount': amt, 'date': date_val})
        elif m2:
            amt = float(m2.group(1))
            if not any(t['amount'] == amt for t in txns):
                txns.append({'type': 'expense', 'category': cat, 'description': disp_name, 'amount': amt, 'date': date_val})

    # 4. Generic Expense if no itemized expenses
    if not any(x['type'] == 'expense' for x in txns):
        m_gen = re.search(rf'(\d+(?:\.\d+)?)\s*{CURRENCY_REGEX}?\s*(?:i\s*)?(?:चा|चे|ची|च्या|का|के|की|on|for)?\s*(?:spent|spend|expense|खर्च|लागत)', norm)
        if not m_gen:
            m_gen = re.search(rf'(?:खर्च|खर्चा|expense|spent)\s*{CURRENCY_REGEX}?\s*(\d+(?:\.\d+)?)', norm)
        if m_gen:
            amt = float(m_gen.group(1))
            txns.append({
                'type': 'expense',
                'category': 'Operational',
                'description': 'दैनिक खर्च / Expenses',
                'amount': amt,
                'date': date_val
            })

    # Fallback if text has at least one number
    if not txns:
        num_matches = re.findall(r'\d+(?:\.\d+)?', norm)
        if num_matches:
            val = float(num_matches[0])
            txns.append({
                'type': 'sale',
                'category': 'Sales',
                'description': text[:35],
                'quantity': 1,
                'unit_price': val,
                'amount': val,
                'date': date_val
            })

    return txns

def parse_udhaar_speech(text: str) -> Optional[Dict[str, Any]]:
    """
    Parses voice-based customer credit (Udhaar) transactions.
    Supports Hindi, Marathi, and English phrases like:
    - 'सुनीताला ४०० रुपये उधार दिले' / 'Sunita ko 400 udhaar diye' (credit)
    - 'सुनीताने ४०० रुपये परत दिले' / 'Sunita ne 400 wapas diye' (repayment)
    - 'Anita gave 500 repayment' / 'Gave 300 credit to Ramesh'
    """
    if not text or not text.strip():
        return None

    today_str = datetime.date.today().isoformat()
    norm = normalize_speech_text(text)

    # 1. Detect relative dates
    date_val = today_str
    if re.search(r'(?:^|\s)(?:yesterday|काल|कल)(?:\s|[.,!?।]|$)', norm):
        date_val = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    elif re.search(r'(?:^|\s)(?:parso|परवा|परसों)(?:\s|[.,!?।]|$)', norm):
        date_val = (datetime.date.today() - datetime.timedelta(days=2)).isoformat()

    # 2. Extract Amount
    amt_match = re.search(rf'(\d+(?:\.\d+)?)\s*{CURRENCY_REGEX}?', norm)
    if not amt_match:
        # Check any number
        nums = re.findall(r'\d+(?:\.\d+)?', norm)
        if nums:
            amt = float(nums[0])
        else:
            return None
    else:
        amt = float(amt_match.group(1))

    # 3. Detect Transaction Type (Credit Given vs Repayment / Payment Received)
    # Repayment cues: परत, वापस, जमा, फेडले, repaid, returned, payment, back, de diye
    is_payment = bool(re.search(r'(?:परत|वापस|जमा|फेडले|दिले|दिये|repaid|returned|payment|received|wapas|parat|jama)', norm)) and not bool(re.search(r'(?:उधार\s*दिले|उधार\s*दिए|credit\s*given|उधारी\s*दिली)', norm))
    if re.search(r'(?:ने\s*\d+.*(?:दिले|दिए|जमा)|paid\s*back|gave\s*back|वापस\s*किए|वापस\s*दि|परत\s*केले)', norm):
        is_payment = True

    # 4. Extract Customer Name
    stopwords = {'काल', 'आज', 'परवा', 'उधार', 'उधारी', 'रुपये', 'रुपया', 'रुपयांचा', 'रुपयांची', 'rupees', 'rs', 'udhaar', 'credit', 'payment', 'diye', 'vikle', 'दिले', 'दिए', 'परत', 'वापस', 'जमा', 'wapas', 'parat', 'jama', 'yesterday', 'today'}
    raw_name = ""
    # Look for name before postposition first: "Sunita ko", "सुनीताला", "सुनीताने"
    m_name_pre = re.search(r'([a-zA-Z\u0900-\u097f]+?)(?:ला|ने|को|कडून|से|\s+ko|\s+la|\s+ne)\b', text, re.IGNORECASE)
    if m_name_pre:
        cand = m_name_pre.group(1).strip()
        if cand.lower() not in stopwords and not re.search(r'[\d०-९]', cand) and len(cand) >= 2:
            raw_name = cand

    if not raw_name:
        name_patterns = [
            r'([a-zA-Z\u0900-\u097f]+)\s*(?:ko|la|ne|ने|ला|को|कडून|से)',
            r'(?:to|ko|la|ने|ला|को)\s*([a-zA-Z\u0900-\u097f]+)',
            r'(?:उधार|credit|repayment)\s*(?:to|for)?\s*([a-zA-Z\u0900-\u097f]+)',
            r'(?:from|कडून|से)\s*([a-zA-Z\u0900-\u097f]+)'
        ]
        for pat in name_patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                cand = m.group(1).strip()
                if cand.lower() not in stopwords and not re.search(r'[\d०-९]', cand) and len(cand) >= 2:
                    raw_name = cand
                    break

    if not raw_name:
        words = [w for w in text.split() if w.lower() not in stopwords and not re.search(r'[\d०-९]', w)]
        if words:
            raw_name = words[0].strip()
        else:
            raw_name = "ग्राहक (Customer)"

    # Clean name (remove trailing postpositions like ने, ला, को, etc.)
    clean_name = re.sub(r'(?:ला|ने|को|जी|ताई|भाऊ)$', '', raw_name).strip()
    if not clean_name:
        clean_name = raw_name

    return {
        "customer_name": clean_name,
        "amount": amt,
        "type": "payment" if is_payment else "credit",
        "date": date_val,
        "raw_transcript": text
    }
