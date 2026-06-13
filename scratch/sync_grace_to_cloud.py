import json
import urllib.request

base_url = "https://situation.chicvill.store/api/bundle"
pw_sha256 = "cbfad02f9ed2a8d1e08d8f74f5303e9eb93637d47f82ab6f1c15871cf8dd0481" # SHA-256 of "1212"

bundles = [
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

print("🚀 공용 클라우드 서버(situation.chicvill.store)에 번들 주입 시작...")

for b in bundles:
    bundle_id = b["id"]
    url = f"{base_url}/{bundle_id}"
    req_body = json.dumps(b, ensure_ascii=False).encode("utf-8")
    
    req = urllib.request.Request(
        url,
        data=req_body,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        method="PUT"
    )
    
    try:
        with urllib.request.urlopen(req) as res:
            res_body = res.read().decode("utf-8")
            print(f"✅ 성공: {bundle_id} -> {res_body}")
    except Exception as e:
        print(f"❌ 실패: {bundle_id} -> {e}")

print("\n🎉 모든 원격 번들 주입 완료!")
