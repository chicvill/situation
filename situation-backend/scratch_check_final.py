import psycopg2

try:
    conn = psycopg2.connect('dbname=chicvill user=chicvill password=chicvill host=localhost')
    cur = conn.cursor()
    cur.execute("SELECT session_id, table_id, status FROM table_sessions WHERE table_id IN ('T89', 'T90', 'T91')")
    rows = cur.fetchall()
    print("--- Active Sessions for T89-T91 ---")
    for r in rows:
        print(f"SessionID: {r[0]}, TableID: {r[1]}, Status: {r[2]}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"DB Error: {e}")
