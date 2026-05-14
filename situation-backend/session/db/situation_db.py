import json
from datetime import datetime
from psycopg2.extras import RealDictCursor  # type: ignore
from .connection import get_db_conn


def save_situation(data: dict):
    """상황 데이터를 지식 인벤토리에 저장"""
    conn = get_db_conn()
    if not conn: return
    try:
        cur = conn.cursor()
        query = """
            INSERT INTO situation_pool (store_id, type, title, items, timestamp)
            VALUES (%(store_id)s, %(type)s, %(title)s, %(items)s, %(timestamp)s)
        """
        params = {
            'store_id': data.get('store', 'Total'),
            'type': data.get('type', 'Log'),
            'title': data.get('title', 'General Log'),
            'items': json.dumps(data.get('items', [])),
            'timestamp': data.get('timestamp', datetime.now().isoformat())
        }
        cur.execute(query, params)
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Save Situation Error: {e}")

def get_situation_history(store_id: str, limit: int = 50):
    """최근 상황 기록들을 가져옴"""
    conn = get_db_conn()
    if not conn: return []
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if store_id and store_id != "Total":
            cur.execute("""
                SELECT * FROM situation_pool
                WHERE store_id = %(store_id)s
                ORDER BY id DESC LIMIT %(limit)s
            """, {'store_id': store_id, 'limit': limit})
        else:
            cur.execute("""
                SELECT * FROM situation_pool
                ORDER BY id DESC LIMIT %(limit)s
            """, {'limit': limit})
        results = cur.fetchall()
        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Get Situation History Error: {e}")
        return []
