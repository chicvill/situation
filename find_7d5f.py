import psycopg2
import json
import os
from dotenv import load_dotenv

def find_order_in_cloud():
    # .env 파일 로드
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        print("오류: .env 파일에서 DATABASE_URL을 찾을 수 없습니다.")
        return

    print(f"☁️ 클라우드 지식 창고(Supabase)에 접속 중...")
    
    try:
        # PostgreSQL 접속
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # 1. order_code가 7D5F인 것 검색
        print("🔍 '#7D5F' 주문을 찾는 중...")
        cur.execute("SELECT id, status, order_code, \"table\", items FROM knowledge_bundles WHERE order_code = '7D5F' OR id LIKE '%7D5F%'")
        rows = cur.fetchall()
        
        if not rows:
            # 2. 대소문자 구분 없이 검색
            print("🔍 유사한 코드가 있는지 재검색 중...")
            cur.execute("SELECT id, status, order_code, \"table\", items FROM knowledge_bundles WHERE order_code ILIKE '%7D5%'")
            rows = cur.fetchall()

        if rows:
            for row in rows:
                row_id, status, code, table, items = row
                print(f"\n=== [검거 성공] 주문 ID: {row_id} ===")
                print(f"📍 상태(Status): {status}")
                print(f"📍 주문코드(Code): {code}")
                print(f"📍 테이블(Table): {table}")
                print(f"📍 상세항목(Items): {json.dumps(items, ensure_ascii=False)}")
                print("-" * 40)
        else:
            print("\n❌ 클라우드 지식 창고에서 해당 주문을 찾을 수 없습니다.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"\n❌ 데이터베이스 접속 오류: {e}")

if __name__ == "__main__":
    find_order_in_cloud()
