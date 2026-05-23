import sys
sys.path.append('.')
from session.db.connection import get_db_conn
conn = get_db_conn()
cur = conn.cursor()
cur.execute('SELECT * FROM table_reservations')
print(cur.fetchall())
