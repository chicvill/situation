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

# Gemini Client
gemini_model = None
if gemini_key and not gemini_key.startswith("MY_"):
    genai.configure(api_key=gemini_key)
    # Using gemini-1.5-flash for speed and efficiency
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')
    print("✅ Gemini Engine Ready.")

if not client and not gemini_model:
    print("⚠️ Warning: No valid AI API keys found. Using mock responses.")

def analyze_document_image(image_bytes: bytes, doc_type: str) -> dict:
    print(f"[DEBUG] 📥 analyze_document_image 진입 (타입: {doc_type})")
    if not client:
        print("[DEBUG] ❌ client가 초기화되지 않았습니다. API 키를 확인하세요.")
        return {"error": "API Key missing. Please check your .env file."}
    
    print("[DEBUG] 🔄 이미지를 Base64로 인코딩 중...")
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    
    prompts = {
        "reg": """사업자등록증 이미지입니다. 다음 필드를 JSON 객체로 추출하세요:
{"brand": "상호명", "regNo": "사업자등록번호(예:000-00-00000)", "address": "사업장주소", "owner": "대표자명"}
만약 특정 필드를 읽을 수 없으면 빈 문자열로 넣으세요.""",
        "menu": """식당이나 카페의 메뉴판 이미지입니다. 보이는 모든 메뉴를 추출하여 다음 JSON 형식으로 반환하세요:
{"menus": [{"name": "메뉴이름", "price": "가격(숫자만 또는 '12,000원' 형식)"}, ...]}
메뉴가 없거나 읽을 수 없으면 {"menus": []} 를 반환하세요."""
    }
    
    try:
        if gemini_model:
            print(f"[DEBUG] 🚀 Gemini Vision API 호출 중...")
            img = {
                'mime_type': 'image/jpeg',
                'data': image_bytes
            }
            prompt = prompts.get(doc_type, "Extract text from image.") + "\nReturn ONLY a JSON object."
            response = gemini_model.generate_content([prompt, img], generation_config={"response_mime_type": "application/json"})
            parsed = json.loads(response.text)
            print("[DEBUG] ✅ Gemini Vision 파싱 성공")
            return parsed
        
        elif client:
            print(f"[DEBUG] 🚀 OpenAI Vision API 호출 중...")
            # ... (Existing OpenAI Vision logic)
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
        print(f"[DEBUG] 🚨 Vision Analysis Error: {str(e)}")
        return {"error": str(e)}

# --- 목표(Goal) 정의 ---
GOALS = {
    "Orders": {
        "description": "주문 발생 및 조리 관련",
        "required": ["메뉴", "테이블"],
        "optional": ["주문번호", "수량", "요청사항"]
    },
    "Settlement": {
        "description": "결제 및 정산, 고객 퇴장",
        "required": ["테이블" or "주문번호"],
        "optional": ["결제금액", "결제수단"]
    },
    "Attendance": {
        "description": "직원 출퇴근 및 근태",
        "required": ["직원명", "액션(출근/퇴근)"],
        "optional": ["시간"]
    },
    "Employee": {
        "description": "사원 등록 및 근로 조건 설정",
        "required": ["직원명", "시급"],
        "optional": ["연락처", "근로기간"]
    },
    "StoreConfig": {
        "description": "매장 정보 및 사업자 설정",
        "required": ["상호명", "사업자번호"],
        "optional": ["주소", "대표자"]
    },
    "Log": {
        "description": "기타 일반 기록",
        "required": ["내용"],
        "optional": []
    }
}

def parse_situation_text(text: str) -> dict:
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if not client:
        return {
            "type": "Log",
            "title": "임시 AI 분석 결과 (API 키 필요)",
            "items": [{"name": "입력 텍스트", "value": text}],
            "timestamp": time_str
        }

    goals_summary = "\n".join([f"- {k}: {v['description']} (필수: {', '.join(v['required'])})" for k, v in GOALS.items()])

    prompt = f"""
당신은 매장의 '상황 지능형 엔진'입니다. 
사용자의 입력을 분석하여 '목표 처리 결과'를 얻는 데 필요한 **핵심 정보만 필터링**하여 JSON으로 변환하세요.

현재 시간: {time_str}
입력된 상황: "{text}"

[분석 목표(Goals) 목록]
{goals_summary}

[지침]
1. 위 목표 중 가장 적합한 하나를 선택하세요.
2. 선택한 목표의 '필수 정보'를 포함하지 못하는 노이즈 정보는 과감히 삭제하세요.
3. 'items'는 [{{"name": "...", "value": "..."}}] 형식으로 구성하며, 필드명은 위 필수/선택 항목의 키워드를 최대한 활용하세요.
4. 'title'은 분석된 목표와 핵심 내용을 담은 짧은 제목으로 작성하세요.
5. 결과는 오직 JSON 객체만 반환하세요.
"""

    try:
        if gemini_model:
            response = gemini_model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
            result = json.loads(response.text)
            result["timestamp"] = time_str
            return result
        elif client:
            response = client.chat.completions.create(
                model=openai_model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            result["timestamp"] = time_str
            return result
        else:
            return {"type": "Log", "title": "AI 엔진 미설정", "items": [{"name": "입력", "value": text}], "timestamp": time_str}
            
    except Exception as e:
        print(f"AI API Error: {e}")
        return {
            "type": "Log",
            "title": "AI 엔진 오류",
            "items": [{"name": "에러", "value": str(e)}],
            "timestamp": time_str
        }

def analyze_history(query: str, history: list) -> str:
    """지식 창고(history)를 분석하여 질문에 대답합니다."""
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if not client and not gemini_model:
        return "AI 엔진이 설정되지 않아 실제 분석을 수행할 수 없습니다. .env 파일을 확인해 주세요!"

    # 지식 창고 데이터를 텍스트로 요약 (최근 50개만)
    context = ""
    for b in history[:50]:
        try:
            items_str = ", ".join([f"{i.name}:{i.value}" for i in b.items])
        except AttributeError:
            items_str = ", ".join([f"{i['name']}:{i['value']}" for i in b.items])
            
        context += f"[{b.timestamp}] {b.type}({b.title}): {items_str}\n"

    prompt = f"""
당신은 매장의 '경영 분석가'입니다. 아래의 '지식 창고' 데이터를 바탕으로 사용자의 질문에 친절하고 정확하게 답변하세요.
데이터에 없는 내용은 추측하지 말고 모른다고 하거나, 데이터가 더 필요하다고 답하세요.

[지식 창고 데이터 요약]
{context}

[사용자 질문]
"{query}"

답변은 한국어로, 핵심 위주로 명확하게 하세요. 마크다운 형식을 사용하여 가독성 있게 답변하세요.
"""
    
    try:
        if gemini_model:
            response = gemini_model.generate_content(prompt)
            return response.text
        elif client:
            response = client.chat.completions.create(
                model=openai_model,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content
    except Exception as e:
        print(f"Analysis Error: {e}")
        return f"분석 중 오류가 발생했습니다: {str(e)}"
