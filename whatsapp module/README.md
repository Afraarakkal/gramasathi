# WhatsApp Voice AI Bot (Twilio + Flask + Colab)

This project enables **WhatsApp voice message transcription and AI-powered replies** using **Twilio WhatsApp**, **Flask**, and **Google Colab**.

Users send a voice note on WhatsApp → it gets transcribed in Colab → processed by AI → and replied back automatically on WhatsApp.

---

## Features
- WhatsApp voice note support
- No audio saved locally (memory-only processing)
- Fast replies using TwiML
- AI logic fully decoupled
- Works on low-end local machines (Colab handles heavy work)

---

##  System Flow

WhatsApp User
↓
Twilio Webhook
↓
Flask Server (/webhook)
↓
Google Colab (Transcription + AI)
↓
reply_to_user
↓
WhatsApp Reply

├── app.py # Flask webhook server
├── README.md
└── transcribe.ipynb # Google Colab notebook


