import os
import json

pool_path = r"C:\Users\USER\Desktop\Workstation\situation\situation-backend\knowledge_pool.json"
pw_sha256 = "cbfad02f9ed2a8d1e08d8f74f5303e9eb93637d47f82ab6f1c15871cf8dd0481" # SHA-256 of "1212"

new_bundles = [
    # 1. 메뉴 정보 번들
    {
        "id": "MENUS_store-grace",
        "type": "Menus",
        "store_id": "store-grace",
        "store": "그레이스 하이테크 커피",
        "title": "메뉴 정보",
        "timestamp": "2026-06-01 00:00:00",
        "items": [
            {"name": "아메리카노", "value": 4500, "icon": "☕", "category": "음료", "description": "원두(Arabica) 에스프레소에 뜨거운 물을 더해 깊고 풍부한 맛의 기본 커피"},
            {"name": "카페라떼", "value": 5000, "icon": "☕", "category": "음료", "description": "에스프레소에 고소하고 신선한 스팀 우유를 더해 부드러운 맛의 커피"},
            {"name": "크루아상", "value": 4000, "icon": "🥐", "category": "디저트", "description": "프랑스산 고메 버터향이 풍부한 겉바속촉 크루아상"}
        ]
    },
    # 2. 점주 계정 정보 번들
    {
        "id": "USER-01000000006",
        "type": "PersonalInfos",
        "store_id": "store-grace",
        "store": "그레이스 하이테크 커피",
        "title": "한그레이스님 계정 (점주)",
        "status": "approved",
        "timestamp": "2026-06-01 00:00:00",
        "items": [
            {"name": "이름", "value": "한그레이스"},
            {"name": "아이디", "value": "01000000006"},
            {"name": "비밀번호", "value": pw_sha256},
            {"name": "권한", "value": "owner"}
        ]
    },
    # 3. 점장 계정 정보 번들
    {
        "id": "USER-01011000006",
        "type": "PersonalInfos",
        "store_id": "store-grace",
        "store": "그레이스 하이테크 커피",
        "title": "이지원님 계정 (점장)",
        "status": "approved",
        "timestamp": "2026-06-01 00:00:00",
        "items": [
            {"name": "이름", "value": "이지원"},
            {"name": "아이디", "value": "01011000006"},
            {"name": "비밀번호", "value": pw_sha256},
            {"name": "권한", "value": "manager"}
        ]
    },
    # 4. 점원 계정 정보 번들
    {
        "id": "USER-01022000006",
        "type": "PersonalInfos",
        "store_id": "store-grace",
        "store": "그레이스 하이테크 커피",
        "title": "최다솜님 계정 (점원)",
        "status": "approved",
        "timestamp": "2026-06-01 00:00:00",
        "items": [
            {"name": "이름", "value": "최다솜"},
            {"name": "아이디", "value": "01022000006"},
            {"name": "비밀번호", "value": pw_sha256},
            {"name": "권한", "value": "staff"}
        ]
    }
]

print("📖 로컬 knowledge_pool.json 읽는 중...")
if os.path.exists(pool_path):
    with open(pool_path, "r", encoding="utf-8") as f:
        try:
            pool = json.load(f)
        except Exception as e:
            print(f"❌ JSON 파싱 에러: {e}")
            pool = []
else:
    pool = []

# 중복 제거 후 추가
existing_ids = {b.get("id") for b in pool if "id" in b}
added_count = 0

for b in new_bundles:
    if b["id"] not in existing_ids:
        pool.append(b)
        added_count += 1
        print(f"➕ 로컬 풀에 추가됨: {b['id']}")
    else:
        print(f"ℹ️ 이미 로컬 풀에 존재함: {b['id']}")

if added_count > 0:
    with open(pool_path, "w", encoding="utf-8") as f:
        json.dump(pool, f, ensure_ascii=False, indent=2)
    print("💾 로컬 knowledge_pool.json 저장 성공!")
else:
    print("ℹ️ 추가할 새로운 번들이 없습니다.")
