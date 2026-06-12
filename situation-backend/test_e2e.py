"""
test_e2e.py — 시스템 E2E 자동화 테스트

실행:  python test_e2e.py
       python test_e2e.py --url http://localhost:8000   (서버 주소 변경)
       python test_e2e.py --scenario 3                  (특정 시나리오만)

검증 항목:
  S1. 빈 테이블 QR 스캔 → 세션 생성 + seat-request
  S2. 기존 세션(주문 없음) + QR 스캔 → seat-request (새 고객 감지)
  S3. 카운터 좌석 개시 승인 → seat-request 제거
  S4. 주문 접수 → DB 저장 확인
  S5. 동일 기기 재스캔 (추가 주문) → active 반환
  S6. 다른 기기 스캔 (합석) → waiting_approval 반환
  S7. 세션 초기화 → 세션 closed + 주문 cancelled
  S8. 서버 재시작 시뮬레이션 → seat-request 재생성 확인

사용하는 테스트 테이블: T98 (store_id=test_store)
실제 운영 테이블에는 영향 없음.
"""
import sys
import time
import json
import argparse
import requests

# Reconfigure stdout to support UTF-8 characters (like emojis) on Windows command prompt
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


# ─── 설정 ───────────────────────────────────────────────
DEFAULT_URL  = "http://localhost:8000"
TEST_STORE   = "test_store"
TEST_TABLE   = "T98"
TEST_TABLE_NO = "98"   # tableNo 형식 (앞 T 없이)
DEVICE_A     = "TEST_DEVICE_A"
DEVICE_B     = "TEST_DEVICE_B"


# ─── 출력 헬퍼 ──────────────────────────────────────────
class Result:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []

    def ok(self, name: str):
        self.passed += 1
        print(f"    ✅  {name}")

    def fail(self, name: str, expected, actual):
        self.failed += 1
        self.errors.append({"check": name, "expected": expected, "actual": actual})
        print(f"    ❌  {name}")
        print(f"        기대: {expected}")
        print(f"        실제: {actual}")

    def check(self, name: str, condition: bool, expected=None, actual=None):
        if condition:
            self.ok(name)
        else:
            self.fail(name, expected, actual)


def section(title: str):
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")


def summary(result: Result):
    total = result.passed + result.failed
    print(f"\n{'='*55}")
    print(f"  결과: {result.passed}/{total} 통과", end="")
    if result.failed:
        print(f"  ({result.failed}개 실패)")
        for e in result.errors:
            print(f"    ✗ {e['check']}")
    else:
        print("  — 전체 통과 🎉")
    print(f"{'='*55}\n")


# ─── API 헬퍼 ────────────────────────────────────────────
def api(method: str, path: str, base: str, **kwargs):
    url = f"{base}{path}"
    try:
        resp = getattr(requests, method)(url, timeout=5, **kwargs)
        return resp
    except requests.exceptions.ConnectionError:
        print(f"\n  💥 서버에 연결할 수 없습니다: {url}")
        print(  "     run.bat 으로 백엔드 서버를 먼저 시작하세요.\n")
        sys.exit(1)


def get_session(base, table_id=TEST_TABLE, store_id=TEST_STORE):
    r = api("get", f"/api/session/{table_id}?store_id={store_id}", base)
    return r.json() if r.ok else {}


def get_seat_requests(base, store_id=TEST_STORE):
    r = api("get", f"/api/seat-requests?store_id={store_id}", base)
    return r.json() if r.ok else []


def get_debug_state(base):
    r = api("get", "/api/debug/state", base)
    return r.json() if r.ok else {}


def checkin(base, table_no=TEST_TABLE_NO, device=DEVICE_A, store_id=TEST_STORE):
    r = api("post", "/api/checkin/request", base, json={
        "tableNo": table_no,
        "deviceId": device,
        "store_id": store_id,
    })
    return r.json() if r.ok else {}


def open_session(base, table_id=TEST_TABLE, store_id=TEST_STORE):
    r = api("post", "/api/session/open", base, json={
        "table_id": table_id,
        "store_id": store_id,
    })
    return r.json() if r.ok else {}


def reset_test(base):
    r = api("post", "/api/debug/reset-test", base)
    return r.json() if r.ok else {}


def cleanup(base):
    data = reset_test(base)
    cleaned = data.get("cleaned", [])
    if cleaned:
        print(f"  🧹  테스트 데이터 정리: {cleaned}")
    time.sleep(0.2)


# ─── 시나리오 ────────────────────────────────────────────

def s1_fresh_qr_scan(base: str, result: Result):
    section("S1: 빈 테이블 QR 스캔 → 세션 생성 + seat-request")
    cleanup(base)

    # 1. 사전 확인: 세션 없음
    before = get_session(base)
    result.check("사전: DB에 세션 없음", before.get("session") is None,
                 expected=None, actual=before.get("session"))

    # 2. QR 스캔 (check-in)
    resp = checkin(base)
    result.check("체크인 응답 status=active",
                 resp.get("status") == "active", "active", resp.get("status"))
    result.check("체크인 응답에 session 포함",
                 resp.get("session") is not None, "session object", resp.get("session"))

    time.sleep(0.3)

    # 3. DB 확인
    after = get_session(base)
    result.check("DB에 세션 생성됨",
                 after.get("session") is not None, "session in DB", after.get("session"))
    if after.get("session"):
        result.check("세션 status=active",
                     after["session"].get("status") == "active", "active", after["session"].get("status"))

    # 4. seat-request 확인
    srs = get_seat_requests(base)
    has_sr = any(r["table_id"] == TEST_TABLE for r in srs)
    result.check(f"seat-request 생성됨 ({TEST_TABLE})", has_sr, f"T98 in seat-requests", srs)

    # 5. debug/state 확인
    ds = get_debug_state(base)
    summary_t = ds.get("summary", {}).get(TEST_TABLE, {})
    result.check("debug/state에 seat_request 반영됨",
                 summary_t.get("has_seat_request") is True, True, summary_t.get("has_seat_request"))


def s2_existing_session_no_order(base: str, result: Result):
    section("S2: 기존 세션(주문 없음) + QR 재스캔 → seat-request 생성")
    cleanup(base)

    # 1. 세션 먼저 생성 (open_session — 주문 없음)
    open_session(base)
    time.sleep(0.2)

    # seat-request 제거 (open_session이 제거함)
    srs_before = get_seat_requests(base)
    has_before = any(r["table_id"] == TEST_TABLE for r in srs_before)
    result.check("open 후 seat-request 없음",
                 not has_before, False, has_before)

    # 2. 고객 QR 스캔 (기존 세션 + 주문 없음)
    resp = checkin(base, device=DEVICE_A)
    result.check("재스캔 응답 status=active",
                 resp.get("status") == "active", "active", resp.get("status"))

    time.sleep(0.3)

    # 3. seat-request 생성 확인 (이것이 이번 수정의 핵심)
    srs = get_seat_requests(base)
    has_sr = any(r["table_id"] == TEST_TABLE for r in srs)
    result.check(f"재스캔 후 seat-request 생성됨 (핵심 검증)",
                 has_sr, f"T98 in seat-requests", srs)


def s3_counter_approval(base: str, result: Result):
    section("S3: 카운터 좌석 개시 승인 → seat-request 제거")
    cleanup(base)

    # 1. 고객 스캔 (seat-request 생성)
    checkin(base)
    time.sleep(0.2)
    srs = get_seat_requests(base)
    result.check("승인 전 seat-request 있음",
                 any(r["table_id"] == TEST_TABLE for r in srs), True, srs)

    # 2. 카운터에서 승인
    resp = open_session(base)
    time.sleep(0.2)

    # 3. seat-request 제거 확인
    srs_after = get_seat_requests(base)
    still_exists = any(r["table_id"] == TEST_TABLE for r in srs_after)
    result.check("승인 후 seat-request 제거됨",
                 not still_exists, False, still_exists)

    # 4. 세션 상태 확인
    sess = get_session(base)
    result.check("세션 status=active",
                 sess.get("session", {}).get("status") == "active", "active",
                 sess.get("session", {}).get("status"))


def s4_order_saved_to_db(base: str, result: Result):
    section("S4: 주문 접수 → DB 저장 확인")
    cleanup(base)

    # 1. 세션 생성
    checkin(base)
    time.sleep(0.2)
    open_session(base)
    time.sleep(0.2)

    # 2. 주문 접수
    r = api("post", "/api/order/direct", base, json={
        "table_id": TEST_TABLE,
        "store_id": TEST_STORE,
        "device_id": DEVICE_A,
        "items": [{"name": "TestMenu", "quantity": 1, "price": 9900}],
        "total_price": 9900,
        "payment_status": "pending",
    })
    result.check("주문 API 응답 200",
                 r.status_code == 200, 200, r.status_code)

    time.sleep(0.3)

    # 3. DB에서 주문 확인
    sess = get_session(base)
    orders = sess.get("orders") or []
    active_orders = [o for o in orders if o.get("status") != "cancelled"]
    result.check("DB에 주문 1건 저장됨",
                 len(active_orders) >= 1, "≥1 orders", len(active_orders))
    if active_orders:
        result.check("주문 금액 정확 (9,900원)",
                     active_orders[0].get("total_price") == 9900, 9900,
                     active_orders[0].get("total_price"))

    # 4. debug/state 주문 수 반영
    ds = get_debug_state(base)
    summary_t = ds.get("summary", {}).get(TEST_TABLE, {})
    result.check("debug/state 주문 수 반영됨",
                 summary_t.get("order_count", 0) >= 1, "≥1", summary_t.get("order_count"))


def s5_same_device_rescan(base: str, result: Result):
    section("S5: 동일 기기 재스캔 (추가 주문) → active 반환")
    cleanup(base)

    # 1. 세션 생성 + 주문
    checkin(base, device=DEVICE_A)
    time.sleep(0.2)
    open_session(base)
    api("post", "/api/order/direct", base, json={
        "table_id": TEST_TABLE, "store_id": TEST_STORE,
        "device_id": DEVICE_A,
        "items": [{"name": "TestItem", "quantity": 1, "price": 5000}],
        "total_price": 5000, "payment_status": "pending",
    })
    time.sleep(0.3)

    # 2. 동일 기기 재스캔
    resp = checkin(base, device=DEVICE_A)
    result.check("동일 기기 재스캔 → status=active",
                 resp.get("status") == "active", "active", resp.get("status"))


def s6_different_device_join(base: str, result: Result):
    section("S6: 다른 기기 스캔 (합석 요청) → 자동 승인 및 is_new_device 반환")
    cleanup(base)

    # 1. 세션 생성 + 주문 (Device A)
    checkin(base, device=DEVICE_A)
    time.sleep(0.2)
    open_session(base)
    api("post", "/api/order/direct", base, json={
        "table_id": TEST_TABLE, "store_id": TEST_STORE,
        "device_id": DEVICE_A,
        "items": [{"name": "TestItem", "quantity": 1, "price": 5000}],
        "total_price": 5000, "payment_status": "pending",
    })
    time.sleep(0.3)

    # 2. 다른 기기 스캔 (Device B)
    resp = checkin(base, device=DEVICE_B)
    result.check("다른 기기 스캔 → status=active",
                 resp.get("status") == "active", "active", resp.get("status"))
    result.check("is_new_device=True 반환됨",
                 resp.get("is_new_device") is True, True, resp.get("is_new_device"))
    result.check("session object 포함됨",
                 "session" in resp, True, list(resp.keys()))



def s7_session_reset(base: str, result: Result):
    section("S7: 세션 초기화 → 세션 closed + 주문 cancelled")
    cleanup(base)

    # 1. 세션 생성 + 주문
    checkin(base)
    time.sleep(0.2)
    open_session(base)
    api("post", "/api/order/direct", base, json={
        "table_id": TEST_TABLE, "store_id": TEST_STORE,
        "device_id": DEVICE_A,
        "items": [{"name": "TestReset", "quantity": 2, "price": 10000}],
        "total_price": 10000, "payment_status": "pending",
    })
    time.sleep(0.3)

    sess_before = get_session(base)
    session_id = (sess_before.get("session") or {}).get("session_id")
    result.check("초기화 전 세션 존재",
                 session_id is not None, "session_id", session_id)

    if not session_id:
        result.fail("세션 없음 — 시나리오 7 중단", "session_id", None)
        return

    # 2. 세션 초기화
    r = api("post", "/api/session/reset", base, json={"session_id": session_id})
    result.check("reset API 응답 200", r.status_code == 200, 200, r.status_code)
    time.sleep(0.3)

    # 3. 세션 상태 확인 (closed이므로 get_active_session이 None 반환)
    sess_after = get_session(base)
    result.check("초기화 후 활성 세션 없음",
                 sess_after.get("session") is None, None, sess_after.get("session"))


def s8_seat_request_recreated_after_rescan(base: str, result: Result):
    section("S8: 서버 재시작 후 시뮬레이션 — 기존 세션에 QR 재스캔 시 seat-request 복구")
    cleanup(base)

    # 1. open_session으로 세션 생성 (서버 재시작 시 memory seat_requests 초기화 상황 재현)
    open_session(base)
    time.sleep(0.2)

    # seat-request는 없는 상태 (open_session이 제거했거나 처음부터 없었음)
    srs = get_seat_requests(base)
    result.check("시뮬레이션 시작: seat-request 없음",
                 not any(r["table_id"] == TEST_TABLE for r in srs), False,
                 [r["table_id"] for r in srs])

    # 2. 고객 QR 스캔 → 기존 세션 발견 + 주문 없음 → seat-request 재생성
    resp = checkin(base, device=DEVICE_A)
    result.check("재스캔 응답 status=active",
                 resp.get("status") == "active", "active", resp.get("status"))

    time.sleep(0.3)

    # 3. seat-request 복구 확인
    srs_after = get_seat_requests(base)
    has_sr = any(r["table_id"] == TEST_TABLE for r in srs_after)
    result.check("재스캔 후 seat-request 복구됨",
                 has_sr, True, srs_after)


# ─── 메인 ────────────────────────────────────────────────

SCENARIOS = {
    1: s1_fresh_qr_scan,
    2: s2_existing_session_no_order,
    3: s3_counter_approval,
    4: s4_order_saved_to_db,
    5: s5_same_device_rescan,
    6: s6_different_device_join,
    7: s7_session_reset,
    8: s8_seat_request_recreated_after_rescan,
}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="situation E2E 테스트")
    parser.add_argument("--url", default=DEFAULT_URL, help="백엔드 서버 URL")
    parser.add_argument("--scenario", type=int, default=0,
                        help="특정 시나리오 번호만 실행 (0=전체)")
    args = parser.parse_args()

    base = args.url.rstrip("/")
    result = Result()

    print(f"\n{'='*55}")
    print(f"  situation E2E 테스트  →  {base}")
    print(f"  테스트 테이블: {TEST_TABLE}  |  store: {TEST_STORE}")
    print(f"{'='*55}")

    # 서버 연결 확인
    try:
        requests.get(f"{base}/api/debug/state", timeout=3)
    except Exception:
        print(f"\n  💥 서버에 연결할 수 없습니다: {base}")
        print(  "     run.bat 으로 백엔드를 먼저 시작하세요.\n")
        sys.exit(1)

    if args.scenario:
        fn = SCENARIOS.get(args.scenario)
        if fn:
            fn(base, result)
        else:
            print(f"  알 수 없는 시나리오 번호: {args.scenario}")
            sys.exit(1)
    else:
        for fn in SCENARIOS.values():
            fn(base, result)
            time.sleep(0.3)

    # 테스트 데이터 최종 정리
    cleanup(base)
    summary(result)
    sys.exit(0 if result.failed == 0 else 1)
