import httpx

ports = [8000, 8001]
for port in ports:
    url = f"http://localhost:{port}/api/stats/store/store-chicvill?period=daily"
    print(f"\n===========================================")
    print(f"📡 Testing GET {url}")
    print(f"===========================================")
    try:
        r = httpx.get(url, timeout=5.0)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print("Keys in response:", list(data.keys()))
            print(f"Trend count: {len(data.get('trend', []))}")
            print(f"DOW sales count: {len(data.get('dowSales', []))}")
            print(f"Menu DOW sales count: {len(data.get('menuDowSales', []))}")
            if data.get('trend'):
                print("Sample trend:", data['trend'][0])
            else:
                print("Trend list is EMPTY!")
        else:
            print("Error body:", r.text)
    except Exception as e:
        print(f"Connection failed: {e}")
