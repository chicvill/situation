import os
import json
from datetime import datetime
from dotenv import load_dotenv
import base64
import openai

load_dotenv()

# --- AI Engine Configuration ---
openai_key = os.getenv("OPENAI_API_KEY")
openai_model = "gpt-4o-mini"

# OpenAI Client
client = None
if openai_key and not openai_key.startswith("MY_"):
    client = openai.OpenAI(api_key=openai_key)
    print("✅ OpenAI Engine Ready.")

# Gemini Client (Explicitly Disabled)
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
GOALS = {
    "Orders": {"description": "주문 발생 및 조리 관련", "required": ["메뉴", "테이블"]},
    "Settlement": {"description": "결제 및 정산, 고객 퇴장", "required": ["테이블"]},
    "Attendance": {"description": "직원 출퇴근 및 근태", "required": ["직원명", "액션"]},
    "Employee": {"description": "사원 등록 및 설정", "required": ["직원명", "시급"]},
    "StoreConfig": {"description": "매장 정보 및 설정", "required": ["상호명", "사업자번호"]},
    "Waiting": {"description": "대기 등록", "required": ["인원"]},
    "Reservations": {"description": "식당 예약 등록", "required": ["예약자", "예약시간", "인원"]},
    "Log": {"description": "기타 일반 기록", "required": ["내용"]}
}

def parse_situation_text(text: str, store: str = "Total", context: str = "") -> dict:
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not client:
        return {"type": "Log", "title": "API 키 필요", "items": [{"name": "입력", "value": text}], "timestamp": time_str}

    goals_summary = "\n".join([f"- {k}: {v['description']}" for k, v in GOALS.items()])
    
    prompt = f"""
당신은 매장의 '상황 지능형 엔진'입니다. 입력된 상황을 분석하여 JSON으로 변환하세요.
현재 시간: {time_str} | 매장: {store} | 현재 화면: {context if context else '알 수 없음'}

입력 상황: "{text}"

[분석 목표]
{goals_summary}

결과는 반드시 {{"type": "...", "title": "...", "items": [{{"name": "...", "value": "..."}}], "store": "{store}"}} 형식을 따르세요.
"""
    
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
        return {"type": "Log", "title": "AI 분석 오류", "items": [{"name": "에러", "value": str(e)}], "timestamp": time_str}

def analyze_history(query: str, history: list, store: str = "Total", manual: str = "") -> str:
    if not client:
        return "ChatGPT API 엔진이 설정되지 않았습니다."

    context = ""
    for b in history[:50]:
        try: items_str = ", ".join([f"{i.name}:{i.value}" for i in b.items])
        except: items_str = ", ".join([f"{i['name']}:{i['value']}" for i in b.items])
        context += f"[{b.timestamp}] {b.type}({b.title}): {items_str}\n"

    prompt = f"""
[매장 고정 매뉴얼 및 원칙]
{manual if manual else "설정된 매뉴얼이 없습니다."}

[지식 창고 데이터 요약 (최근 운영 이력)]
{context}

[사용자 질문]
"{query}"

[답변 지침]
1. 사장님이 설정하신 [매장 고정 매뉴얼 및 원칙]을 최우선으로 준수하여 답변하세요.
2. 매뉴얼에 없는 구체적인 운영 데이터는 [지식 창고 데이터 요약]을 참고하세요.
3. 답변은 한국어로, 핵심 위주로 명확하게 하세요. 마크다운 형식을 사용하세요.
4. 특정 화면 이동이 필요하다면 답변 끝에 `[GOTO:탭이름]` 형식을 포함하세요.
   (home, order, kitchen, counter, menu, settings, inventory, waiting, reserve, qr)
"""
    try:
        response = client.chat.completions.create(
            model=openai_model,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"ChatGPT 분석 중 오류가 발생했습니다: {str(e)}"

# Build Trigger: 2026-05-03 12:31
