from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import google.generativeai as genai
from dotenv import load_dotenv
import json
import datetime
from sqlalchemy.orm import Session

from database import get_db, User, BusinessProfile, Transaction, Base, engine
from auth import verify_password, get_password_hash, create_access_token, decode_access_token
from parser import rule_based_extract, parse_udhaar_speech
from chatbot_engine import answer_financial_query, detect_language
from whatsapp_service import send_whatsapp_message


load_dotenv()
app = FastAPI(title="Khata se Credit Tak API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok", "message": "Khata se Credit Tak Backend API is running"}


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# --- Schemas ---
class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    business_name: str
    business_type: str
    language: str
    location: str

class UserLogin(BaseModel):
    email: str
    password: str

class TxnCreate(BaseModel):
    type: str
    category: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    unit_price: Optional[float] = None
    amount: float
    transaction_date: str
    source: str = "manual"
    raw_transcript: Optional[str] = None

class SpeechRequest(BaseModel):
    text: str
    business_type: str
    language: str

class ChatRequest(BaseModel):
    query: str
    language: Optional[str] = "en"
    context: Optional[dict] = None
    history: Optional[List[dict]] = None

class WhatsAppNotificationRequest(BaseModel):
    phone: str
    type: str
    customer_name: str
    amount: float
    previous_balance: float
    new_balance: float
    payment_method: Optional[str] = "cash"
    payment_status: Optional[str] = "verified"
    receipt_id: Optional[str] = None
    shop_name: Optional[str] = "Khata Se Credit Tak Store"
    language: Optional[str] = "mr"



# --- Auth Dependency ---
def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized: No token provided")

    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        user_id = int(payload["sub"])
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid user ID in token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- Endpoints ---

@app.post("/auth/register")
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    new_profile = BusinessProfile(
        user_id=new_user.id,
        business_name=user_data.business_name,
        business_type=user_data.business_type,
        language=user_data.language,
        location=user_data.location,
        start_date=datetime.date.today()
    )
    db.add(new_profile)
    db.commit()
    
    token = create_access_token({"sub": str(new_user.id)})
    return {
        "access_token": token,
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "business_name": new_profile.business_name,
            "business_type": new_profile.business_type,
            "language": new_profile.language,
            "location": new_profile.location
        }
    }

@app.post("/auth/login")
def login(creds: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == creds.email).first()
    if not user or not verify_password(creds.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "business_name": user.profile.business_name if user.profile else "My Business",
            "business_type": user.profile.business_type if user.profile else "Other",
            "language": user.profile.language if user.profile else "en",
            "location": user.profile.location if user.profile else ""
        }
    }

@app.get("/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "business_name": user.profile.business_name if user.profile else "My Business",
        "business_type": user.profile.business_type if user.profile else "Other",
        "language": user.profile.language if user.profile else "en",
        "location": user.profile.location if user.profile else ""
    }

from parser import rule_based_extract

@app.post("/transactions")
def add_transaction(txn: TxnCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        dt_str = txn.transaction_date[:10] if txn.transaction_date else datetime.date.today().isoformat()
        dt = datetime.datetime.strptime(dt_str, "%Y-%m-%d").date()
    except Exception:
        dt = datetime.date.today()

    new_txn = Transaction(
        user_id=user.id,
        type=txn.type or 'sale',
        category=txn.category or 'General',
        description=txn.description or 'Entry',
        quantity=txn.quantity,
        unit_price=txn.unit_price,
        amount=float(txn.amount) if txn.amount is not None else 0.0,
        transaction_date=dt,
        source=txn.source or 'manual',
        raw_transcript=txn.raw_transcript,
        confirmed=True
    )
    db.add(new_txn)
    db.commit()
    db.refresh(new_txn)
    return {"id": new_txn.id, "message": "Transaction saved"}

@app.get("/transactions")
def get_transactions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txns = db.query(Transaction).filter(Transaction.user_id == user.id).order_by(Transaction.transaction_date.desc()).all()
    return [{
        "id": t.id,
        "type": t.type,
        "item": t.description or t.category or "Transaction",
        "category": t.category,
        "quantity": t.quantity,
        "amount": t.amount,
        "date": t.transaction_date.isoformat(),
        "source": t.source,
        "raw_transcript": t.raw_transcript
    } for t in txns]

@app.delete("/transactions/{txn_id}")
def delete_transaction(txn_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == txn_id, Transaction.user_id == user.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(txn)
    db.commit()
    return {"message": "Deleted"}

@app.post("/api/speech/parse")
def parse_speech(req: SpeechRequest):
    # Try Gemini if API key is present
    if GEMINI_API_KEY:
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = f"""
            Extract the sales and expenses from this user's speech.
            Business Type: {req.business_type}
            Language: {req.language}
            Speech: "{req.text}"
            
            Extract multiple transactions if present. If information is missing, return null for that field. Do NOT invent quantities, prices or categories.
            Return ONLY a JSON object exactly matching this schema:
            {{
                "transactions": [
                    {{
                        "type": "sale" or "expense",
                        "category": "category name",
                        "description": "item description",
                        "quantity": integer or null,
                        "unit_price": float or null,
                        "amount": float or null,
                        "date": "YYYY-MM-DD"
                    }}
                ]
            }}
            Do not include any markdown formatting or comments.
            """
            response = model.generate_content(prompt)
            clean_text = response.text.replace('```json', '').replace('```', '').strip()
            data = json.loads(clean_text)
            if data and "transactions" in data and len(data["transactions"]) > 0:
                return data
        except Exception:
            pass

    # Intelligent fallback: Multilingual Rule-Based Parser (Works completely offline!)
    extracted = rule_based_extract(req.text)
    if extracted:
        return {"transactions": extracted}

    # Ultimate fallback: return a single template with text as description so user can confirm/edit
    return {
        "transactions": [
            {
                "type": "sale",
                "category": req.business_type or "Sales",
                "description": req.text[:40],
                "quantity": 1,
                "unit_price": None,
                "amount": None,
                "date": datetime.date.today().isoformat()
            }
        ]
    }

@app.post("/api/speech/parse-udhaar")
def parse_udhaar_endpoint(req: SpeechRequest):
    parsed = parse_udhaar_speech(req.text)
    if parsed:
        return parsed
    return {
        "customer_name": "नवीन ग्राहक (New Customer)",
        "amount": 0,
        "type": "credit",
        "date": datetime.date.today().isoformat(),
        "raw_transcript": req.text
    }

@app.post("/api/chat/ask")
def chat_ask(req: ChatRequest):
    context = req.context or {}
    result = answer_financial_query(
        query=req.query,
        language=req.language or "en",
        context=context,
        history=req.history
    )
    
    if GEMINI_API_KEY:
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            sys_prompt = f"""
            You are a helpful, respectful multilingual financial assistant for an Indian small business owner in 'Khata Se Credit Tak'.
            User asked: "{req.query}"
            Target language code: "{result['language']}" (mr = Marathi, hi = Hindi, en = English).
            
            Exact verified financial figures and ground truth calculated by the ledger:
            "{result['answer']}"
            
            Instructions:
            - Respond in the detected language ({result['language']}). If Marathi, use clear natural Marathi. If Hindi, use natural Hindi. If English, clear simple English.
            - Keep the response concise, encouraging, and accurate.
            - You MUST strictly preserve all numbers, rupees (₹), percentages, and customer names exactly as given in the verified ground truth. Do not invent any numbers.
            """
            ai_res = model.generate_content(sys_prompt)
            if ai_res and ai_res.text and len(ai_res.text.strip()) > 10:
                result["answer"] = ai_res.text.strip()
        except Exception:
            pass

    return result

@app.post("/api/whatsapp/send-notification")
def send_whatsapp_notification(req: WhatsAppNotificationRequest):
    return send_whatsapp_message(
        phone=req.phone,
        msg_type=req.type,
        customer_name=req.customer_name,
        amount=req.amount,
        previous_balance=req.previous_balance,
        new_balance=req.new_balance,
        payment_method=req.payment_method,
        payment_status=req.payment_status,
        receipt_id=req.receipt_id,
        shop_name=req.shop_name or "Khata Se Credit Tak Store",
        language=req.language or "mr"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


