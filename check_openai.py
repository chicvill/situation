import os
from dotenv import load_dotenv
import openai

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

if api_key:
    print(f"OPENAI_API_KEY found: {api_key[:10]}...")
    try:
        client = openai.OpenAI(api_key=api_key)
        # We won't actually call the API to save credits, just check connectivity/setup
        print("OpenAI client initialized successfully.")
    except Exception as e:
        print(f"Error initializing OpenAI client: {e}")
else:
    print("OPENAI_API_KEY NOT found in .env file.")
