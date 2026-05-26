import os
import sys
import json
import uuid
import random
from datetime import datetime

# backend 경로를 sys.path에 추가하여 module import 가능하게 설정
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'situation-backend')))

from session.db.connection import get_db_conn
from session.db.order_db import save_order
from session.db.session_db import _dumps

def generate_sample_sales():
    conn = get_db_conn()
    if not conn:
        print("❌ DB 연결 실패")
        return

    print("📊 예제 매출 데이터 생성을 시작합니다...")
    store_id = "store-1"
    table_id = "1"
    device_id = "mock-device"
    
    # 1. 활성 세션 하나 만들기 (또는 기존 가져오기)
    cur = conn.cursor()
    cur.execute("SELECT session_id, orders FROM table_sessions WHERE store_id = %s AND status = 'active' LIMIT 1", (store_id,))
    row = cur.fetchone()
    
    if row:
        session_id = row[0]
        existing_orders = row[1] if isinstance(row[1], list) else []
        print(f"✅ 기존 활성 세션 발견: {session_id}")
    else:
        session_id = f"SESS-{uuid.uuid4().hex[:8]}"
        now_str = datetime.now().isoformat()
        cur.execute("""
            INSERT INTO table_sessions (session_id, store_id, table_id, device_id, status, checkin_time, metadata, orders, splits, calls)
            VALUES (%s, %s, %s, %s, 'active', %s, '{}', '[]', '[]', '[]')
        """, (session_id, store_id, table_id, device_id, now_str))
        existing_orders = []
        print(f"✅ 새로운 활성 세션 생성: {session_id}")
    
    conn.commit()

    # 2. 예제 메뉴 아이템 설정
    sample_menus = [
        [{"name": "된장찌개", "quantity": 1}],
        [{"name": "삼겹살", "quantity": 2}, {"name": "공기밥", "quantity": 2}],
        [{"name": "제육볶음", "quantity": 1}, {"name": "소주", "quantity": 1}],
        [{"name": "비빔냉면", "quantity": 2}],
        [{"name": "계란찜", "quantity": 1}, {"name": "맥주", "quantity": 1}]
    ]
    prices = [8000, 32000, 14000, 16000, 9000]

    # 3. 주문 5개 생성 (오늘 날짜)
    new_orders_for_session = []
    
    for i in range(5):
        order_id = f"ORD-{uuid.uuid4().hex[:8]}"
        items = sample_menus[i]
        total_price = prices[i]
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        order_data = {
            'order_id': order_id,
            'session_id': session_id,
            'store_id': store_id,
            'table_id': table_id,
            'device_id': device_id,
            'items': items,
            'total_price': total_price,
            'status': 'served', # AdminDashboard는 active (cooking, ready, served) 주문만 매출로 산정
            'payment_status': 'unpaid',
            'order_seq': i + 1,
            'timestamp': now_str
        }
        
        save_order(order_data)
        print(f"   ➕ 주문 추가 완료: {order_id} ({total_price}원)")
        
        # 세션 orders에도 추가할 형식으로 변환
        session_order_data = {
            "order_id": order_id,
            "items": items,
            "total_price": total_price,
            "status": "served",
            "created_at": now_str
        }
        new_orders_for_session.append(session_order_data)

    # 4. table_sessions 업데이트
    all_orders = existing_orders + new_orders_for_session
    cur.execute("""
        UPDATE table_sessions 
        SET orders = %s::jsonb 
        WHERE session_id = %s
    """, (_dumps(all_orders), session_id))
    
    conn.commit()
    cur.close()
    conn.close()
    
    print("🎉 예제 매출 데이터 생성이 완료되었습니다!")
    print("✅ 관리자 페이지(AdminDashboard)에서 '오늘의 예상 매출'과 '활성 주문건'을 확인해 보세요.")

if __name__ == "__main__":
    generate_sample_sales()
