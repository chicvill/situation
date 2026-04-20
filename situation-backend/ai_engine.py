import os
import json
import google.generativeai as genai
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Set up Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)
    # Use Gemini Flash for speed
    model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"response_mime_type": "application/json"})
else:
    model = None
    print("Warning: GEMINI_API_KEY is not set. Using mock responses.")

def parse_situation_text(text: str) -> dict:
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if not model:
        # Fallback Mock if no API key
        return {
            "type": "Log",
            "title": "임시 AI 분석 결과 (API 키 필요)",
            "items": [{"name": "입력 텍스트", "value": text}],
            "timestamp": time_str
        }

    prompt = f"""
당신은 매장의 '상황 지능형 엔진'입니다.
사용자가 매장에서 발생한 상황을 텍스트로 입력하면, 이를 분석하여 지정된 JSON 구조로 변환해야 합니다.

현재 시간: {time_str}
입력된 상황: "{text}"

지침:
1. 상황을 분석하여 다음 4가지 타입 중 가장 적절한 것을 고르세요:
   - "Orders": 주문 발생, 조리 완료, 서빙 등 주문과 관련된 상황
   - "Menus": 새로운 메뉴 등록, 가격 변경, 품절 등 메뉴와 관련된 상황
   - "PersonalInfos": 알바생, 고객 등 인물과 관련된 정보
   - "Log": 그 외 일상적인 기록, 기기 센서 값, 매출 확인, 정보 교환 등

2. 'title'은 상황을 요약하는 짧은 제목으로 만드세요. (예: "아메리카노 주문", "신규 직원 등록")
3. 'items'는 추출해 낼 수 있는 핵심 정보들을 이름(name)과 값(value)의 배열로 구성하세요.
4. 응답은 오직 아래 JSON 스키마를 준수하는 JSON 문자열만 반환해야 합니다. 마크다운 블록(```json)을 사용하지 말고 순수 JSON만 반환하세요.

JSON 구조 예시:
{{
  "type": "Orders",
  "title": "아메리카노 2잔 주문",
  "items": [
    {{"name": "메뉴", "value": "아메리카노"}},
    {{"name": "수량", "value": "2잔"}}
  ]
}}
"""

    try:
        response = model.generate_content(prompt)
        try:
            result = json.loads(response.text)
            result["timestamp"] = time_str
            return result
        except json.JSONDecodeError:
            return {
                "type": "Log",
                "title": "JSON 파싱 에러",
                "items": [{"name": "원문", "value": response.text}],
                "timestamp": time_str
            }
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return {
            "type": "Log",
            "title": "AI 엔진 오류",
            "items": [{"name": "에러", "value": str(e)}],
            "timestamp": time_str
        }
