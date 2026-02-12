 import os
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from rapidfuzz import fuzz, process
from flask import Flask, request, jsonify
import requests
import google.generativeai as genai
from google.generativeai import configure, GenerativeModel
load_dotenv()
configure(api_key=os.getenv("GOOGLE_API_KEY"))

model = GenerativeModel(
    model_name="models/gemini-2.5-flash-lite"
)
app = Flask(__name__)

# ==============================
# 🔑 Setup
# ==============================

 

complaint_file = "complaints.csv"
chat_log_file = "chat_log.csv"

# ==============================
# 📚 Load Knowledge Base
# ==============================
kb_df = pd.read_csv("knowledge_base.csv", encoding="utf-8")
knowledge_base = dict(zip(kb_df["keyword"], kb_df["answer"]))

# ==============================
# 🔎 Complaint Keywords
# ==============================
complaint_keywords = [
    "പരാതി", "വെള്ളം", "ജലം", "കുടിവെള്ളം",
    "vellam", "vellam illa", "jalam"
]

def is_complaint(text):
    for kw in complaint_keywords:
        if fuzz.partial_ratio(kw, text.lower()) > 80:
            return True
    return False

def check_status(text):
    for word in text.split():
        if word.upper().startswith("KWA"):
            return word.upper()
    return None

def fuzzy_kb_lookup(text):
    match = process.extractOne(text, knowledge_base.keys(), scorer=fuzz.partial_ratio)
    if match and match[1] > 70:
        return knowledge_base[match[0]]
    return None

# ==============================
# 🤖 Send to M3 (Action Server)
# ==============================
def send_to_m3(intent, entities, message):
    try:
        res = requests.post("http://127.0.0.1:6000/action", json={
            "intent": intent,
            "entities": entities,
            "message": message
        })
        return res.json()
    except:
        return {"status": "M3 not reachable"}

# ==============================
# 🧠 Agent Brain
# ==============================
def analyze_message(user_input):
    intent = "unknown"
    entities = {}
    confidence = 0.5

    # Rule-based detection
    if is_complaint(user_input):
        intent = "water_complaint"
        entities["problem"] = "water issue"
        confidence = 0.9

    complaint_id = check_status(user_input)
    if complaint_id:
        intent = "complaint_status"
        entities["complaint_id"] = complaint_id
        confidence = 0.95

    kb_answer = fuzzy_kb_lookup(user_input)
    if kb_answer:
        intent = "local_information"
        confidence = 0.85

    # AI detection if unknown
    if intent == "unknown":
        ai_intent = model.generate_content(
            f"Classify intent: health_info, pension_application, elderly_help, school_dropout_help, other.\nMessage: {user_input}"
        ).text.strip()
        intent = ai_intent
        confidence = 0.75

    # Generate user reply
    reply = model.generate_content(
        f"You are GramaSathi, Kerala village AI. Reply in Malayalam kindly to: {user_input}"
    ).text

    # Send to M3 if action needed
    m3_response = None
    if intent not in ["local_information", "other"]:
        m3_response = send_to_m3(intent, entities, user_input)

    return {
        "intent_name": intent,
        "entities": entities,
        "confidence_score": confidence,
        "reply_to_user": reply,
        "m3_status": m3_response
    }

# ==============================
# 🌐 API Endpoint (M2 calls this)
# ==============================
@app.route("/analyze", methods=["POST"])
def analyze():
    message = request.json.get("message")
    result = analyze_message(message)
    return jsonify(result)

# ==============================
# 🚀 Run Server
# ==============================
if __name__ == "__main__":
    app.run(port=5000)
