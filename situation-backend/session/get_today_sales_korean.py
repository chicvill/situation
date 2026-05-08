import os
import sys
import json
from datetime import datetime

# 패키지 로컬 경로 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from database import get_db_conn
except ImportError:
    print("❌ database.py 모듈을 불러오지 못했습니다. 경로를 확인해 주세요.")
    sys.exit(1)

def query_today_sales():
    conn = get_db_conn()
    if not conn:
        print("❌ 데이터베이스 연결에 실패했습니다.")
        sys.exit(1)
        
    try:
        from psycopg2.extras import RealDictCursor # type: ignore
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 오늘 날짜 (YYYY-MM-DD 형식)
        today_str = datetime.now().strftime("%Y-%m-%d")
        print(f"🔍 오늘({today_str}) '대장금 수라간' 매출 내역 조회 중...")
        
        # table_orders에서 store-korean 매장의 결제 완료(paid/prepaid) 또는 전체 오늘 주문 조회
        # timestamp 필드가 ISO 포맷 문자열이므로 LIKE 'YYYY-MM-DD%' 조건 활용
        cur.execute("""
            SELECT order_id, table_id, items, total_price, payment_status, payment_method, timestamp 
            FROM table_orders 
            WHERE store_id = 'store-korean' AND timestamp LIKE %(today_pattern)s
            ORDER BY timestamp ASC
        """, {'today_pattern': f"{today_str}%"})
        
        orders = cur.fetchall()
        cur.close()
        conn.close()
        
        print("\n" + "🍲" * 15 + " [대장금 수라간 오늘 매출 집계 보고서] " + "🍲" * 15)
        print(f"기준 일자: {today_str} (실시간 조회 기준)\n")
        
        if not orders:
            print("💡 오늘 등록된 주문 결제 내역이 아직 존재하지 않습니다.")
            print("   (고객 태블릿 화면에서 주문을 넣거나 결제를 완료하시면 여기에 실시간으로 집계됩니다!)")
            print("\n💡 [테스트 주문 방법]")
            print("   1. 브라우저에서 아래 링크에 접속하여 메뉴를 주문합니다.")
            print("      http://localhost:5173/?mode=customer&table=3&storeId=store-korean&store=대장금%20수라간")
            print("   2. 주문이 완료되면 이 스크립트를 다시 실행하여 실시간 동기화를 확인해 보세요.")
            print("="*75 + "\n")
            return
            
        total_sales = 0
        total_count = 0
        paid_sales = 0
        unpaid_sales = 0
        
        item_sales_map = {}
        
        print(f"{'주문 시각':19} | {'테이블':5} | {'결제 상태':5} | {'결제 수단':6} | {'주문 금액':>10}")
        print("-" * 75)
        
        for ord in orders:
            # 시간 형식 파싱
            ts = ord['timestamp']
            try:
                dt = datetime.fromisoformat(ts)
                time_str = dt.strftime("%Y-%m-%d %H:%M:%S")
            except:
                time_str = ts[:19]
                
            total_price = ord['total_price']
            payment_status = ord['payment_status']
            payment_method = ord['payment_method'] or '미지정'
            
            status_kor = "결제완료" if payment_status in ('paid', 'prepaid') else "결제대기"
            
            print(f"{time_str} | {ord['table_id'] + '번':5} | {status_kor:5} | {payment_method:6} | {total_price:10,}원")
            
            total_count += 1
            total_sales += total_price
            if payment_status in ('paid', 'prepaid'):
                paid_sales += total_price
            else:
                unpaid_sales += total_price
                
            # 아이템 집계
            items = ord['items']
            if isinstance(items, str):
                try:
                    items = json.loads(items)
                except:
                    items = []
            
            if isinstance(items, list):
                for item in items:
                    name = item.get('name', '알 수 없는 메뉴')
                    qty = item.get('qty', 1)
                    price = item.get('price', 0)
                    
                    if name in item_sales_map:
                        item_sales_map[name]['qty'] += qty
                        item_sales_map[name]['total'] += (price * qty)
                    else:
                        item_sales_map[name] = {
                            'qty': qty,
                            'total': (price * qty)
                        }
                        
        print("-" * 75)
        print(f"📊 [오늘의 실시간 요약 통계]")
        print(f" - 총 주문 건수 : {total_count:,} 건")
        print(f" - 누적 결제금액 : {paid_sales:,} 원 (매출 확정)")
        print(f" - 결제 대기금액 : {unpaid_sales:,} 원")
        print(f" - 총 매출 합계 : {total_sales:,} 원")
        
        if item_sales_map:
            print("\n🍱 [품목별 판매 수량 랭킹]")
            sorted_items = sorted(item_sales_map.items(), key=lambda x: x[1]['qty'], reverse=True)
            for idx, (name, data) in enumerate(sorted_items, 1):
                print(f"   {idx}위. {name:16} | {data['qty']:3}개 판매 | 누적 {data['total']:10,}원")
                
        print("="*75 + "\n")
        
    except Exception as e:
        print(f"❌ 매출 쿼리 중 오류가 발생했습니다: {e}")

if __name__ == "__main__":
    query_today_sales()
