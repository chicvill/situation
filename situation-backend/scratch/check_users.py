import os, sys
sys.stdout.reconfigure(encoding='utf-8')
os.environ['DATABASE_URL'] = 'postgresql://postgres.txdpdcarkeecejmsyklu:minkim5053supabase@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres'
import psycopg2
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

cur.execute("SELECT column_name, data_type, ordinal_position FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position")
print('=== users 컬럼 구조 ===')
for r in cur.fetchall():
    print(f"  [{r[2]}] {r[0]} ({r[1]})")

cur.execute("SELECT username, LEFT(password,40), role, store_id, full_name, is_approved FROM users ORDER BY id LIMIT 20")
print('\n=== users 데이터 (username / pw앞40자 / role / store_id / name / approved) ===')
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
