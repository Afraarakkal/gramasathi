from flask import Flask, request, Response
import requests
import html

app = Flask(__name__)

TWILIO_ACCOUNT_SID = "===="
TWILIO_AUTH_TOKEN = "====="
COLAB_TRANSCRIBE_URL = "https://=============.ngrok-free.app/transcribe"

@app.route("/webhook", methods=["POST"])
def webhook():
    media_url = request.form.get("MediaUrl0")

    if not media_url:
        return "No media", 200


    twilio_resp = requests.get(
        media_url,
        auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    )
    if twilio_resp.status_code != 200:
        return "Error fetching audio", 500

  
    files = {
        "audio": ("audio.ogg", twilio_resp.content, "audio/ogg")
    }
    colab_resp = requests.post(
        COLAB_TRANSCRIBE_URL,
        files=files,
        timeout=300
    )

    if colab_resp.status_code != 200:
        return "Colab error", 500

   
    data = colab_resp.json()
    message = data.get("message", "")              
    reply_to_user = data.get("reply_to_user", "")  

    print("Transcription:", message)
    print("AI Reply:", reply_to_user)


    reply_to_user = html.escape(reply_to_user)
    message = html.escape(message)

   
    if reply_to_user:
        twiml = f"""
        <Response>
            <Message>{reply_to_user}</Message>
        </Response>
        """
        return Response(twiml, mimetype="application/xml")

    twiml = f"""
    <Response>
        <Message>{message}</Message>
    </Response>
    """
    return Response(twiml, mimetype="application/xml")


if __name__ == "__main__":
    app.run(port=5000)

