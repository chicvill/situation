import sys
import httpx
import asyncio

async def run_test():
    base_url = "http://127.0.0.1:8080"
    print(f"Starting PayApp Cash Receipt Integration Test on {base_url}...")

    # 1. Create a mock unpaid order with cash receipt request
    order_payload = {
        "table_id": "T06",
        "device_id": "test_device",
        "store_id": "default_store",
        "items": [
            {"name": "따뜻한 아메리카노", "quantity": 1, "price": 4500}
        ],
        "total_price": 4500,
        "payment_status": "pending",
        "payment_method": "간편 계좌이체",
        "metadata": {
            "phone": "01099998888",
            "requestCashReceipt": True
        }
    }
    
    print("\n[Step 1] Creating a mock unpaid order with cash receipt metadata...")
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

    # 2. Update payment status to paid (triggers cash receipt)
    print("\n[Step 2] Updating payment status to 'paid' via /api/order/payment-status...")
    status_payload = {
        "order_id": order_id,
        "payment_status": "paid"
    }
    async with httpx.AsyncClient() as client:
        res = await client.post(f"{base_url}/api/order/payment-status", json=status_payload)
        print(f"Status Update Response: {res.status_code} - {res.json()}")
        if res.status_code != 200 or res.json().get("status") != "success":
            print("Failed to update payment status to paid!")
            return

    # 3. Check order payment status in DB
    print("\n[Step 3] Checking final order payment status...")
    async with httpx.AsyncClient() as client:
        res = await client.get(f"{base_url}/api/payment/status/{order_id}")
        data = res.json()
        print(f"Final Status Response: {data}")
        if data.get("payment_status") != "paid":
            print("Order payment status is not paid!")
            return
        print("Payment status successfully confirmed as 'paid' in DB.")
        print("\nCASH RECEIPT TEST TRIGGERED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_test())
