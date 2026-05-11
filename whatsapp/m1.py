from flask import Flask, request, Response
import requests
import html
import os

app = Flask(__name__)


TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
COLAB_TRANSCRIBE_URL = os.getenv("COLAB_TRANSCRIBE_URL")
M2_URL = os.getenv("ai-service-production-31b0.up.railway.app")
# =====================================
# 🚀 WEBHOOK
# =====================================

@app.route("/webhook", methods=["POST"])
def webhook():
    try:
        print("\n🔔 Incoming request from Twilio")

        media_url = request.form.get("MediaUrl0")
        from_number = request.form.get("From")

        if not from_number:
            return Response("Invalid request", mimetype="text/plain"), 200

        # =====================================
        # 🎙️ STEP 1: FETCH AUDIO FROM TWILIO
        # =====================================

        if media_url:
            print("📥 Fetching audio from Twilio...")

            twilio_resp = requests.get(
                media_url,
                auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
                timeout=30
            )

            if twilio_resp.status_code != 200:
                print("❌ Failed to fetch audio")
                return Response("Audio fetch error", mimetype="text/plain")

            files = {
                "audio": ("audio.ogg", twilio_resp.content, "audio/ogg")
            }

            print("🧠 Sending audio to Colab for transcription...")

            colab_resp = requests.post(
                COLAB_TRANSCRIBE_URL,
                files=files,
                timeout=300
            )

            if colab_resp.status_code != 200:
                print("❌ Colab transcription failed")
                return Response("Transcription error", mimetype="text/plain")

            data = colab_resp.json()
            message = html.escape(data.get("text", "").strip())

            print("📝 Transcribed text:", message)

            if not message:
                return Response("Could not understand audio.", mimetype="text/plain")

        # =====================================
        # 💬 STEP 2: HANDLE TEXT MESSAGE
        # =====================================

        else:
            message = request.form.get("Body", "").strip()
            print("📝 Text message received:", message)

            if not message:
                return Response("Empty message.", mimetype="text/plain")

        # =====================================
        # 🤖 STEP 3: SEND TO M2
        # =====================================

        print("📡 Sending to M2 agent...")

        m2_resp = requests.post(
            M2_URL,
            json={
                "user_id": from_number,
                "message": message
            },
            timeout=60
        )

        print("M2 STATUS:", m2_resp.status_code)
        print("M2 RAW RESPONSE:", m2_resp.text)

        if m2_resp.status_code != 200:
            return Response(
                "ക്ഷമിക്കണം, സെർവർ പ്രശ്നം.",
                mimetype="text/plain"
            )

        m2_data = m2_resp.json()

        # =====================================
        # 🎯 STEP 4: HANDLE M2 RESPONSE TYPES
        # =====================================

        if "reply_to_user" in m2_data:
            reply = m2_data["reply_to_user"]

        elif "backend_status" in m2_data:

            if m2_data["backend_status"] == 200:
                reply = "താങ്കളുടെ അപേക്ഷ വിജയകരമായി സമർപ്പിച്ചിരിക്കുന്നു. നന്ദി 🙏"

            else:
                backend_error = (
                    m2_data.get("backend_response", {})
                    .get("error", "സമർപ്പണം പരാജയപ്പെട്ടു.")
                )

                reply = f"ക്ഷമിക്കണം, {backend_error}"

        elif "error" in m2_data:
            print("⚠️ M2 ERROR:", m2_data["error"])
            reply = "ക്ഷമിക്കണം, സിസ്റ്റത്തിൽ പ്രശ്നം ഉണ്ടായി."

        else:
            reply = "ക്ഷമിക്കണം, പ്രശ്നം സംഭവിച്ചു."

        print("📤 Sending reply to user:", reply)

        return Response(reply, mimetype="text/plain"), 200

    except Exception as e:
        print("🔥 CRITICAL ERROR:", str(e))
        return Response(
            "ക്ഷമിക്കണം, സിസ്റ്റത്തിൽ പ്രശ്നം ഉണ്ടായി.",
            mimetype="text/plain"
        ), 200


# =====================================
# ▶ RUN
# =====================================

if __name__ == "__main__":
    app.run(port=5000, debug=True)