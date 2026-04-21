import os
import json
from datetime import datetime
from dotenv import load_dotenv
import base64
import openai

load_dotenv()

# Set up OpenAI
api_key = os.getenv("OPENAI_API_KEY")
client = None
if api_key:
    client = openai.OpenAI(api_key=api_key)
    model_name = "gpt-4o-mini" # Vision-capable
else:
    print("Warning: OPENAI_API_KEY is not set. Using mock responses.")

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
    
    print(f"[DEBUG] 🚀 OpenAI Vision API 호출 중... (모델: {model_name})")
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompts.get(doc_type, "텍스트를 추출하세요.")},
                        {
                            "type": "image_url",
                            "image_url": { "url": f"data:image/jpeg;base64,{base64_image}" }
                        }
                    ],
                }
            ],
            response_format={ "type": "json_object" }
        )
        
        raw_content = response.choices[0].message.content
        print(f"[DEBUG] 📥 OpenAI 응답 수신 성공: {raw_content[:100]}...")
        
        parsed = json.loads(raw_content)
        print("[DEBUG] ✅ JSON 파싱 성공")
        return parsed
        
    except Exception as e:
        print(f"[DEBUG] 🚨 Vision Analysis Error: {str(e)}")
        return {"error": str(e)}

def parse_situation_text(text: str) -> dict:
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if not client:
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
1. 상황을 분석하여 다음 타입 중 가장 적절한 것을 고르세요:
   - "Orders": 주문 발생, 조리 완료 등 주문 관련 상황.
   - "Settlement": 결제 완료, 퇴장 등 데이터 정리 상황 (예: "1번 테이블 계산", "나감").
   - "Menus": 메뉴 등록, 가격 변경 (예: "삼겹살 15,000원, 목살 14,000원 등록").
     * 중요: 여러 메뉴가 나열된 경우, 각각을 개별 아이템으로 분리하여 items 리스트에 넣으세요.
     * 형식: {{"name": "메뉴명", "value": "가격"}}
   - "Employee": 사원 등록, 근로 조건 (예: "알바생 홍길동 시급 만원으로 등록").
   - "Attendance": 출퇴근 기록 (예: "나 출근했어", "퇴근한다").
   - "StoreConfig": 매장 정보, 사업자 정보 (예: "우리 매장 상호는 MQ카페야").
     * 중요: 반드시 '상호명', '사업자번호', '주소', '대표자'라는 키워드를 사용하여 items를 구성하세요.
   - "Log": 일상적인 기록 및 기타 상황.

2. 'title'은 상황을 요약하는 짧은 제목으로 만드세요.
3. 'items'는 핵심 정보들을 [{{"name": "...", "value": "..."}}] 형식으로 구성하세요.
   - 주문(Orders)의 경우:
     * 메뉴: (예: 아메리카노 2잔)
     * 테이블: (예: 5번) - 언급 없으면 "포장" 혹은 "확인불가"
     * 주문번호: (예: 102) - 언급 없으면 "신규"

4. 응답은 오직 JSON 구조에 맞는 데이터만 반환하세요.
"""

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        try:
            result = json.loads(response.choices[0].message.content)
            result["timestamp"] = time_str
            return result
        except json.JSONDecodeError:
            return {
                "type": "Log",
                "title": "JSON 파싱 에러",
                "items": [{"name": "원문", "value": response.choices[0].message.content}],
                "timestamp": time_str
            }
    except Exception as e:
        print(f"OpenAI API Error: {e}")
        return {
            "type": "Log",
            "title": "AI 엔진 오류",
            "items": [{"name": "에러", "value": str(e)}],
            "timestamp": time_str
        }

def analyze_history(query: str, history: list) -> str:
    """지식 창고(history)를 분석하여 질문에 대답합니다."""
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if not client:
        return "OPENAI_API_KEY가 설정되지 않아 실제 분석을 수행할 수 없습니다. .env 파일을 확인해 주세요!"

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
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Analysis Error: {e}")
        return f"분석 중 오류가 발생했습니다: {str(e)}"
