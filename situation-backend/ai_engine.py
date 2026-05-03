import os
import json
from datetime import datetime
from dotenv import load_dotenv
import base64
import openai

load_dotenv()

# --- AI Engine (OpenAI Only) ---
openai_key = os.getenv("OPENAI_API_KEY")
client = None
openai_model = "gpt-4o-mini"

if openai_key and not openai_key.startswith("MY_"):
    client = openai.OpenAI(api_key=openai_key)
    print("✅ OpenAI Engine Ready.")
else:
    print("⚠️ Warning: OPENAI_API_KEY not set.")

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
        if client:
            print(f"[DEBUG] 🚀 OpenAI Vision API 호출 중...")
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
        else:
            return {"error": "AI client not initialized."}
        
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
    "Waiting": {
        "description": "실시간 매장 대기 등록",
        "required": ["인원"],
        "optional": ["전화번호", "이름"]
    },
    "Reservations": {
        "description": "식당 예약 등록 및 관리",
        "required": ["예약자", "예약시간", "인원"],
        "optional": ["연락처", "메모"]
    },
    "Log": {
        "description": "기타 일반 기록",
        "required": ["내용"],
        "optional": []
    }
}

def parse_situation_text(text: str, store: str = "Total", context: str = "") -> dict:
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if not client:
        return {
            "type": "Log",
            "title": "임시 AI 분석 결과 (API 키 필요)",
            "items": [{"name": "입력 텍스트", "value": text}],
            "timestamp": time_str
        }

    goals_summary = "\n".join([f"- {k}: {v['description']} (필수: {', '.join(v['required'])})" for k, v in GOALS.items()])

    # 화면 문맥에 따른 가이드 추가
    context_guide = ""
    if context == 'menu':
        context_guide = "사용자는 현재 '메뉴 관리' 화면을 보고 있습니다. 입력된 텍스트는 메뉴 가격 수정, 품절 처리, 또는 신규 메뉴 추가에 관한 것일 확률이 매우 높습니다."
    elif context == 'order':
        context_guide = "사용자는 현재 '주문' 화면을 보고 있습니다. 입력된 텍스트는 특정 메뉴의 주문 생성이나 수량 변경일 확률이 높습니다."
    elif context == 'settings':
        context_guide = "사용자는 현재 '매장 설정' 화면을 보고 있습니다. 입력된 텍스트는 사업자 정보, 상호명, 전화번호 등 매장 정보 수정일 확률이 높습니다."
    elif context == 'kitchen':
        context_guide = "사용자는 현재 '주방' 화면을 보고 있습니다. 특정 주문의 조리 완료 처리나 상태 변경일 확률이 높습니다."

    prompt = f"""
당신은 매장의 '상황 지능형 엔진'입니다. 
사용자의 입력을 분석하여 '목표 처리 결과'를 얻는 데 필요한 **핵심 정보만 필터링**하여 JSON으로 변환하세요.

현재 시간: {time_str}
현재 매장: {store}
현재 화면 상황: {context if context else '알 수 없음'}
{context_guide}

입력된 상황: "{text}"

[분석 목표(Goals) 목록]
{goals_summary}

[지침]
1. 사용자가 현재 화면({context})의 내용을 지칭하는 경우(예: 메뉴 이름만 말하거나 가격만 말하는 경우), 이를 해당 화면의 문맥에 맞게 해석하세요.
2. 위 목표 중 가장 적합한 하나를 선택하세요.
3. 선택한 목표의 '필수 정보'를 포함하지 못하는 노이즈 정보는 과감히 삭제하세요.
4. 'items'는 [{{"name": "...", "value": "..."}}] 형식으로 구성하며, 필드명은 위 필수/선택 항목의 키워드를 최대한 활용하세요.
5. 'title'은 분석된 목표와 핵심 내용을 담은 짧은 제목으로 작성하세요.
6. 'store' 필드에 해당 매장 이름("{store}")을 반드시 포함하세요.
7. 결과는 오직 JSON 객체만 반환하세요.
"""

    print(f"\n[DEBUG] >>> AI 분석 시작: '{text[:20]}...'")
    try:
        if client:
            print("[DEBUG] OpenAI 엔진 시도 중...")
            response = client.chat.completions.create(
                model=openai_model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            result = json.loads(response.choices[0].message.content)
            if isinstance(result, list):
                result = {"items": result, "type": "Log", "title": "분석된 상황"}
            result["timestamp"] = time_str
            print("✅ [DEBUG] OpenAI 분석 성공!")
            return result
        
        return {
            "type": "Log",
            "title": "AI 엔진 없음",
            "items": [{"name": "원인", "value": "OPENAI_API_KEY가 설정되지 않았습니다."}],
            "timestamp": time_str
        }
    except Exception as e:
        print(f"🚨 [DEBUG] 분석 오류: {e}")
        return {
            "type": "Log",
            "title": "AI 오류",
            "items": [{"name": "에러", "value": str(e)}],
            "timestamp": time_str
        }

def analyze_history(query: str, history: list, store: str = "Total") -> str:
    """지식 창고(history)를 분석하여 질문에 대답합니다."""
    if not client:
        return "AI 엔진이 설정되지 않아 분석을 수행할 수 없습니다."

    context = ""
    for b in history[:50]:
        if not isinstance(b, dict):
            continue
        items = b.get("items", [])
        items_str = ", ".join([f"{i.get('name')}:{i.get('value')}" for i in items if isinstance(i, dict)])
        context += f"[{b.get('timestamp', 'N/A')}] {b.get('type', 'Log')}({b.get('title', 'Untitled')}): {items_str}\n"

    prompt = f"""
[지식 창고 데이터 요약 (매장: {store})]
{context}

[사용자 질문]
"{query}"

[답변 지침]
1. 답변은 한국어로, 핵심 위주로 명확하게 하세요. 마크다운 형식을 사용하세요.
2. 만약 사용자의 질문이 특정 화면으로 이동하거나 기능을 확인하려는 의도라면, 답변 끝에 반드시 `[GOTO:탭이름]` 형식을 포함하세요.
   - 통계/홈: [GOTO:home] | 주문: [GOTO:order] | 주방: [GOTO:kitchen]
   - 카운터: [GOTO:counter] | 메뉴: [GOTO:menu] | 설정: [GOTO:settings]
   - 대기: [GOTO:waiting] | 예약: [GOTO:reserve] | QR: [GOTO:qr]
3. 데이터에 없는 내용은 추측하지 말고 데이터가 더 필요하다고 답하세요.
"""
    try:
        response = client.chat.completions.create(
            model=openai_model,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Analysis Error: {e}")
        return f"분석 중 오류가 발생했습니다: {str(e)}"
