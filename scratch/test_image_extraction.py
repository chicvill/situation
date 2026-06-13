import sys
import os

# Adjust path to import ai_engine
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'situation-backend'))

import ai_engine

def main():
    print("Testing image analysis...")
    print(f"OPENAI_API_KEY from os.getenv: {os.getenv('OPENAI_API_KEY')[:15] if os.getenv('OPENAI_API_KEY') else None}...")
    print(f"ai_engine.openai_key: {ai_engine.openai_key[:15] if ai_engine.openai_key else None}...")
    print(f"ai_engine.client: {ai_engine.client}")
    
    img_path = os.path.join(os.path.dirname(__file__), '..', '그레이스 커피.jpg')
    if not os.path.exists(img_path):
        print(f"Image not found at {img_path}")
        return
        
    with open(img_path, 'rb') as f:
        image_bytes = f.read()
        
    print("Calling analyze_document_image with 'menu' doc_type...")
    result = ai_engine.analyze_document_image(image_bytes, 'menu')
    print("Result:")
    print(result)

if __name__ == '__main__':
    main()
