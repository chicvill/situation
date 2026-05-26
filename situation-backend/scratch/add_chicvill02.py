import os, sys
sys.stdout.reconfigure(encoding='utf-8')
os.environ['DATABASE_URL'] = 'postgresql://postgres.txdpdcarkeecejmsyklu:minkim5053supabase@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres'
from werkzeug.security import generate_password_hash
import psycopg2
from datetime import datetime

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

pw_hash = generate_password_hash('1212')
now = datetime.now()

cur.execute(
    "INSERT INTO users (username, password, role, store_id, full_name, is_approved, created_at) "
    "VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (username) DO UPDATE SET password=EXCLUDED.password",
    ('chicvill02', pw_hash, 'owner', 'store-chicvill', '시크빌 사장', True, now)
)
conn.commit()
print("chicvill02 계정 추가 완료")

cur.execute("SELECT username, role, store_id, full_name, is_approved FROM users WHERE username='chicvill02'")
print(cur.fetchone())

cur.close()
conn.close()
