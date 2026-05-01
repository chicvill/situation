import sqlite3
import json

def find_order():
    try:
        conn = sqlite3.connect('situation.db')
        cur = conn.cursor()
        cur.execute("SELECT id, data FROM knowledge_bundles")
        rows = cur.fetchall()
        
        found = False
        for row_id, data_str in rows:
            data = json.loads(data_str)
            # order_code가 7D5F이거나 ID에 포함된 경우
            if data.get('order_code') == '7D5F' or '7D5F' in row_id:
                print(f"=== [검거 성공] 주문 ID: {row_id} ===")
                print(json.dumps(data, indent=4, ensure_ascii=False))
                found = True
                
        if not found:
            print("지식 창고에서 7D5F를 찾을 수 없습니다.")
        conn.close()
    except Exception as e:
        print(f"오류 발생: {e}")

if __name__ == "__main__":
    find_order()
