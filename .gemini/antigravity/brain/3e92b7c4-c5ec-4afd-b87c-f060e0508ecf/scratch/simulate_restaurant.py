import requests
import json
import time

BASE_URL = "http://localhost:8000"

def simulate():
    print("🚀 가상 식당 시뮬레이션 데이터 전송 시작...")

    # 1. 1번 테이블 주문
    requests.post(f"{BASE_URL}/api/order/direct", json={
        "tableNo": "1",
        "items": [{"name": "광어회", "value": "x1"}, {"name": "소주", "value": "x2"}]
    })
    print("✅ 1번 테이블: 광어회, 소주 주문 완료")

    # 2. 3번 테이블 주문
    requests.post(f"{BASE_URL}/api/order/direct", json={
        "tableNo": "3",
        "items": [{"name": "연어초밥", "value": "x2"}, {"name": "맥주", "value": "x1"}]
    })
    print("✅ 3번 테이블: 연어초밥, 맥주 주문 완료")

    # 3. 5번 테이블 호출
    requests.post(f"{BASE_URL}/api/order/direct", json={
        "tableNo": "5",
        "items": [{"name": "호출", "value": "물 좀 주세요"}]
    })
    print("✅ 5번 테이블: 물 호출 완료")

    # 4. AI 상황 전송 (재료 소진)
    requests.post(f"{BASE_URL}/api/situation", json={
        "text": "방금 연어가 다 떨어졌어. 오늘 연어 들어간 메뉴는 다 품절이야."
    })
    print("✅ AI 상황실: 연어 품절 공지 완료")

    print("\n✨ 모든 시뮬레이션 데이터가 전송되었습니다. 화면을 확인해 보세요!")

if __name__ == "__main__":
    simulate()
