import urllib.request
import json
import time
import sys
import random

BASE_URL = "http://localhost:8080"

def request(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    req_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
        raise e

def run_test():
    rand_suffix = f"{random.randint(1000, 9999)}"
    phone_num = f"010-9999-{rand_suffix}"
    table_id = f"T{random.randint(10, 80)}"
    
    print(f"Using Phone: {phone_num}, Table: {table_id}")

    print("=== [1] Check-in session ===")
    checkin_res = request("/api/session/check-in", "POST", {
        "store_id": "store-chicvill",
        "table_id": table_id,
        "device_id": "test_device"
    })
    session_id = checkin_res["session"]["session_id"]
    print(f"Session ID: {session_id}")

    print("\n=== [2] Register parking BEFORE having any pending order ===")
    parking_res = request("/api/parking/validate", "POST", {
        "session_id": session_id,
        "vehicle_number": "12가3456",
        "discount_minutes": 120,
        "store_id": "store-chicvill"
    })
    print(f"Parking registered: status={parking_res.get('status')}")
    assert parking_res.get("status") == "applied", "Parking status should be applied immediately."

    print("\n=== [3] Create pending order ===")
    order_res = request("/api/order/direct", "POST", {
        "store_id": "store-chicvill",
        "table_id": table_id,
        "device_id": "test_device",
        "items": [{"name": "명품 한우 갈비살", "price": 1000, "quantity": 1}],
        "total_price": 1000,
        "payment_status": "pending",
        "payment_method": "카드 결제",
        "metadata": {
            "phone": phone_num,
            "usePoints": 0
        }
    })
    order_id = order_res["order_id"]
    print(f"Order ID: {order_id}")

    print("\n=== [4] Verify postponed points and kitchen list ===")
    points_res = request(f"/api/points/{phone_num}?store_id=store-chicvill")
    print(f"Current Points: {points_res.get('usable_points')}")
    assert points_res.get("usable_points") == 0, "Points should NOT be accumulated before payment!"

    kitchen_res = request("/api/kitchen/orders?store_id=store-chicvill")
    order_ids_in_kitchen = [o["order_id"] for o in kitchen_res]
    print(f"Kitchen Orders: {order_ids_in_kitchen}")
    assert order_id not in order_ids_in_kitchen, "Order should NOT be visible in the kitchen before payment!"

    print("\n=== [5] Register parking DURING pending order (should be postponed) ===")
    parking_res2 = request("/api/parking/validate", "POST", {
        "session_id": session_id,
        "vehicle_number": "98나7654",
        "discount_minutes": 120,
        "store_id": "store-chicvill"
    })
    print(f"Parking registered: status={parking_res2.get('status')}")
    assert parking_res2.get("status") == "pending_payment", "Parking status should be pending_payment when there are unpaid orders."

    parking_info = request(f"/api/parking/session/{session_id}")
    print(f"Parking status in DB: {parking_info.get('parking', {}).get('status')}")
    assert parking_info.get("parking", {}).get("status") == "pending_payment", "Parking DB status should be pending_payment."

    print("\n=== [6] Confirm payment ===")
    confirm_res = request("/api/payment/confirm", "POST", {
        "orderId": order_id,
        "amount": 1000,
        "paymentKey": "test-payment-key-1"
    })
    print(f"Confirm payment response: {confirm_res}")

    print("\n=== [7] Verify final registration ===")
    points_res2 = request(f"/api/points/{phone_num}?store_id=store-chicvill")
    print(f"Points after payment: {points_res2.get('usable_points')}")
    assert points_res2.get("usable_points") == 1, f"Expected 1 point, got {points_res2.get('usable_points')}"

    kitchen_res2 = request("/api/kitchen/orders?store_id=store-chicvill")
    order_ids_in_kitchen2 = [o["order_id"] for o in kitchen_res2]
    print(f"Kitchen Orders after payment: {order_ids_in_kitchen2}")
    assert order_id in order_ids_in_kitchen2, "Order should be visible in the kitchen after payment!"

    parking_info2 = request(f"/api/parking/session/{session_id}")
    print(f"Parking status in DB after payment: {parking_info2.get('parking', {}).get('status')}")
    assert parking_info2.get("parking", {}).get("status") == "applied", "Parking DB status should be updated to applied after payment."

    print("\n=== [8] Duplicate payment confirm request (Idempotency check) ===")
    confirm_res_dup = request("/api/payment/confirm", "POST", {
        "orderId": order_id,
        "amount": 1000,
        "paymentKey": "test-payment-key-1"
    })
    print(f"Duplicate Confirm Response: {confirm_res_dup}")
    
    points_res3 = request(f"/api/points/{phone_num}?store_id=store-chicvill")
    print(f"Points after duplicate payment confirm: {points_res3.get('usable_points')}")
    assert points_res3.get("usable_points") == 1, "Points must NOT be accumulated again!"

    print("\n🎉 SUCCESS! All scenario flows have been successfully verified.")

if __name__ == "__main__":
    run_test()
