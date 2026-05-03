import os
import json
from datetime import datetime
from dotenv import load_dotenv
import base64
import openai
import google.generativeai as genai

load_dotenv()

# --- AI Engine Configuration ---
openai_key = os.getenv("OPENAI_API_KEY")
gemini_key = os.getenv("GEMINI_API_KEY")

# OpenAI Client
client = None
if openai_key and not openai_key.startswith("MY_"):
    client = openai.OpenAI(api_key=openai_key)
    openai_model = "gpt-4o-mini"
    print("✅ OpenAI Engine Ready.")

# Gemini Client (Disabled as per user request)
gemini_model = None
print("ℹ️ Gemini Engine Disabled. Using ChatGPT only.")

if not client:
    print("⚠️ Warning: OpenAI API key not found. Please check your .env file.")

def analyze_document_image(image_bytes: bytes, doc_type: str) -> dict:
    if not client:
        return {"error": "OpenAI API Key missing. Please check your .env file."}
    
    prompts = {
        "reg": """사업자등록증 이미지입니다. 다음 필드를 JSON 객체로 추출하세요:
{"brand": "상호명", "regNo": "사업자등록번호(예:000-00-00000)", "address": "사업장주소", "owner": "대표자명"}
만약 특정 필드를 읽을 수 없으면 빈 문자열로 넣으세요.""",
        "menu": """식당이나 카페의 메뉴판 이미지입니다. 보이는 모든 메뉴를 추출하여 다음 JSON 형식으로 반환하세요:
{"menus": [{"name": "메뉴이름", "price": "가격(숫자만 또는 '12,000원' 형식)"}, ...]}
메뉴가 없거나 읽을 수 없으면 {"menus": []} 를 반환하세요."""
    }
    
    try:
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        response = client.chat.completions.create(
            model=openai_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompts.get(doc_type, "텍스트를 추출하세요.")},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ],
                }
            ],
            response_format={"type": "json_object"}
        )
        parsed = json.loads(response.choices[0].message.content)
        return parsed
    except Exception as e:
        print(f"🚨 Vision Analysis Error (OpenAI): {str(e)}")
        return {"error": str(e)}

# --- 목표(Goal) 정의 ---
# ... (GOALS definition remains same)

def parse_situation_text(text: str, store: str = "Total", context: str = "") -> dict:
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not client:
        return {"type": "Log", "title": "API 키 필요", "items": [{"name": "입력", "value": text}]}

    prompt = f"..." # (Prompt construction remains same)
    
    try:
        response = client.chat.completions.create(
            model=openai_model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        result["timestamp"] = time_str
        return result
    except Exception as e:
        return {"type": "Log", "title": "AI 분석 오류", "items": [{"name": "에러", "value": str(e)}]}

def analyze_history(query: str, history: list, store: str = "Total") -> str:
    if not client:
        return "ChatGPT API 엔진이 설정되지 않았습니다. .env 파일을 확인해 주세요!"

    # context construction remains same...
    context = ""
    for b in history[:50]:
        try: items_str = ", ".join([f"{i.name}:{i.value}" for i in b.items])
        except: items_str = ", ".join([f"{i['name']}:{i['value']}" for i in b.items])
        context += f"[{b.timestamp}] {b.type}({b.title}): {items_str}\n"

    prompt = f"""
[지식 창고 데이터 요약 (매장: {store})]
{context}

[사용자 질문]
"{query}"

[답변 지침]
1. 답변은 한국어로, 핵심 위주로 명확하게 하세요. 마크다운 형식을 사용하세요.
2. 만약 사용자의 질문이 특정 화면으로 이동하거나 기능을 확인하려는 의도라면, 답변 끝에 반드시 `[GOTO:탭이름]` 형식을 포함하세요.
   - 통계/홈: [GOTO:home]
   - 주문 관리: [GOTO:order]
   - 주방/조리: [GOTO:kitchen]
   - 카운터/결제: [GOTO:counter]
   - 메뉴 관리/가격수정: [GOTO:menu]
   - 매장 설정/정보수정: [GOTO:settings]
   - 지식 인벤토리: [GOTO:inventory]
   - 대기 관리: [GOTO:waiting]
   - 예약 관리: [GOTO:reserve]
   - QR 출력: [GOTO:qr]
3. 데이터에 없는 내용은 추측하지 말고 데이터가 더 필요하다고 답하세요.
"""
    try:
        response = client.chat.completions.create(
            model=openai_model,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"ChatGPT 분석 중 오류가 발생했습니다: {str(e)}"
