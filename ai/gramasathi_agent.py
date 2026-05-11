import os
import re
import json
import uuid
import pandas as pd
import requests
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from google import genai

# =====================================================
# 🔐 ENVIRONMENT SETUP
# =====================================================

load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")
BACKEND_URL = os.getenv("BACKEND_URL")  # e.g. https://your-backend.up.railway.app/ai-response

if not API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment variables")

if not BACKEND_URL:
    raise ValueError("BACKEND_URL not found in environment variables")

client = genai.Client(api_key=API_KEY)
app = Flask(__name__)

# =====================================================
# 📂 LOAD INTENT SCHEMA
# =====================================================

INTENT_SCHEMA_FILE = "intent_schema.csv"

intent_df = pd.read_csv(INTENT_SCHEMA_FILE)
intent_df.columns = intent_df.columns.str.strip().str.lower()

# =====================================================
# 🧠 SESSION MEMORY
# =====================================================

user_sessions = {}

# =====================================================
# 🗣 USER FRIENDLY FIELD LABELS (Malayalam)
# =====================================================

FIELD_LABELS = {
    "name": "പേര്",
    "full_name": "പൂർണ്ണ പേര്",
    "aadhaar_number": "ആധാർ നമ്പർ",
    "phone": "ഫോൺ നമ്പർ",
    "ward_number": "വാർഡ് നമ്പർ",
    "address": "വിലാസം",
    "age": "വയസ്",
    "bank_account": "ബാങ്ക് അക്കൗണ്ട് നമ്പർ"
}

# =====================================================
# 🧩 HELPER FUNCTIONS
# =====================================================

def get_required_fields(intent):
    row = intent_df[intent_df["intent"] == intent]
    if row.empty:
        return []
    fields = row.iloc[0]["required_fields"]
    return [f.strip() for f in str(fields).split("|") if f.strip()]


def keyword_intent_match(message):
    message = message.lower()

    for _, row in intent_df.iterrows():
        keywords = str(row["keywords"]).lower().split("|")
        for word in keywords:
            if word.strip() and word.strip() in message:
                return row["intent"]

    return None


def detect_intent_llm(message):
    intent_list = intent_df["intent"].tolist()

    prompt = f"""
You are a gramasathi a village secretary and an intent classifier.

Available intents:
{intent_list}

User message:
"{message}"

Return ONLY one exact intent from the list.
If no match, return NONE.
also your personality:
- Warm, respectful, and empathetic.
- Always greet politely.
- Use simple Malayalam or bilingual Malayalam-English when helpful.
- Never assume intent without sufficient clarity.
- If message is greeting only, respond warmly and ask how to help.
- If message is unclear, politely ask clarification.
- Only map to a government service when strong intent evidence exists.
- Never classify greetings, thanks, or casual talk as complaints.
- Guide users step-by-step in providing required details.
- Use culturally respectful tone (like a village secretary).

Intent Handling Rules:
1. Greetings → respond politely, do NOT assign service intent.
2. Thanks → respond politely.
3. Casual conversation → respond naturally.
4. Service request → match only if clear keywords exist.
5. Low confidence → ask clarification instead of guessing.
6. Never default to general complaint.

When collecting required fields:
- Ask only missing fields.
- Confirm details before submission.
- Encourage politely.
- Use structured JSON when required.

You serve with patience and dignity.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    detected = response.text.strip()

    if detected in intent_list:
        return detected

    return None


def validate_field(field_name, value):
    cleaned_value = re.sub(r"\D", "", value)

    if field_name == "phone":
        return len(cleaned_value) >= 10

    if field_name == "aadhaar_number":
        return len(cleaned_value) == 12

    if field_name == "ward_number":
        return cleaned_value.isdigit()

    return True


# =====================================================
# 🚀 MAIN ANALYZE ROUTE
# =====================================================

@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json(force=True)

        user_id = data.get("user_id")
        message = data.get("message")

        if not user_id or not message:
            return jsonify({"error": "user_id and message required"}), 400

        print(f"\n🟢 Incoming message from {user_id}: {message}")

        # -----------------------------------------
        # 1️⃣ Initialize session
        # -----------------------------------------

        if user_id not in user_sessions:
            user_sessions[user_id] = {
                "intent": None,
                "user_data": {},
                "pending_field": None
            }

        session = user_sessions[user_id]

        # -----------------------------------------
        # 2️⃣ Save response to pending field
        # -----------------------------------------

        if session["pending_field"] is not None:
            field_name = session["pending_field"]

            if not validate_field(field_name, message):
                return jsonify({
                    "reply_to_user": f"Invalid {field_name}. Please enter valid value."
                })

            session["user_data"][field_name] = message
            session["pending_field"] = None

        # -----------------------------------------
        # 3️⃣ Detect intent (if not already detected)
        # -----------------------------------------

        if session["intent"] is None:
            detected_intent = keyword_intent_match(message)

            if not detected_intent:
                detected_intent = detect_intent_llm(message)

            if not detected_intent:
                return jsonify({
                    "reply_to_user": "ദയവായി നിങ്ങളുടെ ആവശ്യത്തെ കൂടുതൽ വ്യക്തമാക്കാമോ?"
                })

            session["intent"] = detected_intent
            print(f"🎯 Detected intent: {detected_intent}")

        intent = session["intent"]
        required_fields = get_required_fields(intent)

        # -----------------------------------------
        # 4️⃣ Ask for missing fields
        # -----------------------------------------

        for field in required_fields:
            if field not in session["user_data"]:
                session["pending_field"] = field
                label = FIELD_LABELS.get(field, field)
                return jsonify({
                    "reply_to_user": f"ദയവായി നിങ്ങളുടെ {label} നൽകാമോ?"
                })

        # -----------------------------------------
        # 5️⃣ All fields collected → Send to backend (Railway URL)
        # -----------------------------------------

        final_json = {
            "intent": intent,
            "user_data": session["user_data"],
            "confidence": 0.95,
            "ticket_id": str(uuid.uuid4())
        }

        print(f"📡 Sending to backend at: {BACKEND_URL}")
        print("📦 Payload:", final_json)

        backend_response = requests.post(
            BACKEND_URL,
            json=final_json,
            timeout=15
        )

        backend_json = {}
        try:
            backend_json = backend_response.json()
        except Exception:
            backend_json = {"raw_response": backend_response.text}

        # Reset session after completion
        user_sessions.pop(user_id, None)

        return jsonify({
            "ai_output": final_json,
            "backend_status": backend_response.status_code,
            "backend_response": backend_json
        }), backend_response.status_code

    except Exception as e:
        print("❌ ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# =====================================================
# ▶ RUN SERVER (Railway compatible)
# =====================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 6000))
    app.run(host="0.0.0.0", port=port, debug=False)
