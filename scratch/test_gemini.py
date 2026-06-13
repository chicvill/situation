import sys
import os

# Adjust path to import dotenv
from dotenv import load_dotenv
load_dotenv()

import google.generativeai as genai

def main():
    print("Testing Gemini API...")
    gemini_key = os.getenv("GEMINI_API_KEY")
    print(f"GEMINI_API_KEY: {gemini_key[:10] if gemini_key else None}...")
    
    if not gemini_key:
        print("Gemini API Key missing")
        return
        
    genai.configure(api_key=gemini_key)
    
    # Try listing models to see if API works
    try:
        models = genai.list_models()
        print("Models list success! Available models:")
        for model in models:
            if 'generateContent' in model.supported_generation_methods:
                print(f" - {model.name}")
    except Exception as e:
        print("Failed to list models or verify API key:", e)
        return

    # Try simple generation
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content("Hello! What is your name?")
        print("Generate response:")
        print(response.text)
    except Exception as e:
        print("Failed to generate content with gemini-2.5-flash:", e)

if __name__ == '__main__':
    main()
