import os
import requests
from dotenv import load_dotenv
from rapidfuzz import fuzz, process
from fastapi import FastAPI
from pydantic import BaseModel
from cachetools import TTLCache
from tenacity import retry, stop_after_attempt, wait_fixed
import google.generativeai as genai

# ==============================
# 🔑 Setup
# ==============================
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-pro")

app = FastAPI(title="GramaSathi M1 Agent")

# Cache for KB lookups
kb_cache = TTLCache(maxsize=100, ttl=300)

# ==============================
# 📚 Load Knowledge Base
# ==============================
knowledge_base = {
    "health camp": "Next health camp is at PHC on Monday.",
    "ration card": "Visit Akshaya center with Aadhaar."
}

complaint_keywords = ["vellam", "water", "jalam", "വെള്ളം"]

# ==============================
# 📦 Request/Response Models
# ==============================
class UserMessage(BaseModel):
    message: str

class AgentResponse(BaseModel):
    intent_name: str
    entities: dict
    confidence_score: float
    reply_to_user: str
    m3_status: dict | None

# ==============================
# 🧠 Intent Detection
# ==============================
def detect_intent(text):
    text_lower = text.lower()

    for kw in complaint_keywords:
        if fuzz.partial_ratio(kw, text_lower) > 80:
            return "water_complaint", {"problem": "water issue"}, 0.9

    if text_upper := [w for w in text.split() if w.upper().startswith("KWA")]:
        return "complaint_status", {"complaint_id": text_upper[0]}, 0.95

    if text in kb_cache:
        return "local_information", {"topic": text}, 0.85

    match = process.extractOne(text, knowledge_base.keys(), scorer=fuzz.partial_ratio)
    if match and match[1] > 70:
        kb_cache[text] = True
        return "local_information", {"topic": match[0]}, 0.8

    # AI classification fallback
    ai_intent = model.generate_content(
        f"Classify intent: pension_application, elderly_help, health_info, other.\nMessage: {text}"
    ).text.strip()

    return ai_intent, {}, 0.75

# ==============================
# 🗣️ Reply Generator
# ==============================
@retry(stop=stop_after_attempt(3), wait=wait_fixed(2))
def generate_reply(text):
    return model.generate_content(
        f"You are GramaSathi AI. Reply in Malayalam: {text}"
    ).text

# ==============================
# 🔗 M3 Action Trigger
# ==============================
def call_m3(intent, entities, message):
    try:
        r = requests.post("http://127.0.0.1:6000/action", json={
            "intent": intent,
            "entities": entities,
            "message": message
        })
        return r.json()
    except:
        return {"status": "M3 offline"}

# ==============================
# 🌐 Main Endpoint
# ==============================
@app.post("/analyze", response_model=AgentResponse)
def analyze(user: UserMessage):
    intent, entities, confidence = detect_intent(user.message)
    reply = generate_reply(user.message)

    m3_response = None
    if intent not in ["local_information", "other"]:
        m3_response = call_m3(intent, entities, user.message)

    return {
        "intent_name": intent,
        "entities": entities,
        "confidence_score": confidence,
        "reply_to_user": reply,
        "m3_status": m3_response
    }
