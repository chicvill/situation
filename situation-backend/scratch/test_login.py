import os, sys
sys.stdout.reconfigure(encoding='utf-8')
os.environ['DATABASE_URL'] = 'postgresql://postgres.txdpdcarkeecejmsyklu:minkim5053supabase@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres'
from werkzeug.security import check_password_hash
import psycopg2

conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

test_cases = [
    ('chicvill02', '1212'),
    ('admin', '1212'),
]

for username, pw in test_cases:
    cur.execute("SELECT username, password, role, store_id, full_name, is_approved FROM users WHERE username=%s", (username,))
    row = cur.fetchone()
    if not row:
        print(f"[{username}] ❌ 사용자 없음")
        continue
    _, db_pw, role, store_id, name, approved = row
    valid = check_password_hash(db_pw, pw)
    print(f"[{username}/{pw}] {'✅ 로그인 성공' if valid else '❌ 비밀번호 불일치'} | role={role} store={store_id} name={name} approved={approved}")

cur.close()
conn.close()
