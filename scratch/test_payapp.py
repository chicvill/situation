import sys
import httpx
import asyncio

async def run_test():
    base_url = "http://127.0.0.1:8080"
    print(f"Starting PayApp End-to-End API Integration Test on {base_url}...")

    # 1. Create a mock unpaid order using the direct order API
    order_payload = {
        "table_id": "T05",
        "device_id": "test_device",
        "store_id": "default_store",
        "items": [
            {"name": "테스트 커피", "quantity": 1, "price": 1000}
        ],
        "total_price": 1000,
        "payment_status": "pending",
        "payment_method": "카드",
        "metadata": {
            "phone": "01012345678"
        }
    }
    
    print("\n[Step 1] Creating a mock unpaid order...")
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(f"{base_url}/api/order/direct", json=order_payload)
            if res.status_code != 200:
                print(f"Failed to create order: {res.status_code} - {res.text}")
                return
            order_data = res.json()
            order_id = order_data["order_id"]
            print(f"Order created successfully: {order_id}")
        except Exception as e:
            print(f"Connection error. Is the backend server running on port 8080? Details: {e}")
            return

    # 2. Check initial status
    print("\n[Step 2] Checking initial order status...")
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{base_url}/api/payment/status/{order_id}")
        print(f"Initial Status Response: {res.json()}")

    # 3. Simulate PayApp Webhook (feedbackurl)
    print("\n[Step 3] Sending simulated PayApp payment callback (feedback)...")
    webhook_data = {
        "userid": "payapp_test_id",
        "linkkey": "test_linkkey",
        "linkval": "test_linkval",
        "goodname": "테스트 커피",
        "price": "1000",
        "pay_state": "4",       # 4 = Payment Completed
        "var1": order_id,       # var1 is mapped to order_id
        "mul_no": "987654321"   # PayApp transaction ID
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{base_url}/api/payment/payapp/feedback",
            data=webhook_data
        )
        print(f"Webhook Status Code: {res.status_code}")
        print(f"Webhook Plain Response: '{res.text}' (Expected: 'SUCCESS')")
        if res.text != "SUCCESS":
            print("Webhook failed to return SUCCESS text!")
            return
        print("Webhook processed successfully and returned SUCCESS.")

    # 4. Check status after webhook
    print("\n[Step 4] Verifying order status is now paid...")
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{base_url}/api/payment/status/{order_id}")
        data = res.json()
        print(f"Status Response: {data}")
        if data.get("payment_status") != "paid":
            print("Order payment status is not paid!")
            return
        print("Payment status updated to 'paid' in DB.")

    # 5. Cancel and refund via PayApp cancel API
    print("\n[Step 5] Triggering order cancellation (refund)...")
    cancel_payload = {
        "order_id": order_id,
        "cancel_reason": "테스트로 인한 결제 취소"
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{base_url}/api/payment/cancel",
            json=cancel_payload
        )
        print(f"Cancel Response: {res.json()}")
        
    # 6. Verify refunded status
    print("\n[Step 6] Verifying order status is now refunded...")
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{base_url}/api/payment/status/{order_id}")
        data = res.json()
        print(f"Final Status Response: {data}")
        if data.get("payment_status") != "refunded":
            print("Order payment status is not refunded!")
            return
        print("Payment status successfully reverted to 'refunded'.")
        print("\nALL TESTS PASSED! PayApp Integration works perfectly!")

if __name__ == "__main__":
    asyncio.run(run_test())
