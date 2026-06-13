import sys
import os
from dotenv import load_dotenv
load_dotenv()

import google.generativeai as genai

def main():
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        print("Gemini API Key missing")
        return
    genai.configure(api_key=gemini_key)
    
    img_path = os.path.join(os.path.dirname(__file__), '..', '그레이스 커피.jpg')
    if not os.path.exists(img_path):
        print(f"Image not found at {img_path}")
        return
        
    with open(img_path, 'rb') as f:
        image_bytes = f.read()
        
    prompt = """식당이나 카페의 메뉴판 이미지입니다. 보이는 모든 메뉴를 추출하여 다음 JSON 형식으로 반환하세요:
{"menus": [{"name": "메뉴이름", "price": "가격(숫자만 또는 '12,000원' 형식)"}, ...]}
메뉴가 없거나 읽을 수 없으면 {"menus": []} 를 반환하세요."""
    
    # In google-generativeai:
    # We can pass raw image bytes as a dictionary:
    # {'mime_type': 'image/jpeg', 'data': image_bytes}
    image_part = {
        'mime_type': 'image/jpeg',
        'data': image_bytes
    }
    
    print("Testing gemini-2.5-flash with image...")
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            [prompt, image_part],
            generation_config={"response_mime_type": "application/json"}
        )
        print("Response received:")
        print(response.text)
    except Exception as e:
        print("Gemini image analysis failed:", e)

if __name__ == '__main__':
    main()
