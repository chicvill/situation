import sys
import os
import json
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
    with open(img_path, 'rb') as f:
        image_bytes = f.read()
        
    prompt = """식당이나 카페의 메뉴판 이미지입니다. 보이는 모든 메뉴를 추출하여 다음 JSON 형식으로 반환하세요:
{"menus": [{"name": "메뉴이름", "price": "가격(숫자만 또는 '12,000원' 형식)"}, ...]}
메뉴가 없거나 읽을 수 없으면 {"menus": []} 를 반환하세요."""
    
    image_part = {
        'mime_type': 'image/jpeg',
        'data': image_bytes
    }
    
    model = genai.GenerativeModel('gemini-2.5-flash')
    response = model.generate_content(
        [prompt, image_part],
        generation_config={"response_mime_type": "application/json"}
    )
    
    # Save the raw text to a UTF-8 file
    out_path = os.path.join(os.path.dirname(__file__), 'gemini_raw_response.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(response.text)
        
    print(f"Saved response to {out_path}")
    
    # Load and parse to verify JSON validity and check contents
    try:
        data = json.loads(response.text)
        print("Successfully parsed JSON!")
        # Print representation of first few menus to verify Korean chars
        for m in data.get("menus", [])[:5]:
            print(f"Menu: {repr(m['name'])} - Price: {m['price']}")
    except Exception as e:
        print("Failed to parse JSON:", e)

if __name__ == '__main__':
    main()
