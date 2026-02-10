import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load your .env file (make sure GOOGLE_API_KEY is saved there)
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# List all available models for your account
for m in genai.list_models():
    print(m.name)