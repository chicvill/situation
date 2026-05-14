import psycopg2  # type: ignore
import os
import json
from dotenv import load_dotenv, find_dotenv

# Load .env
load_dotenv(find_dotenv())
DATABASE_URL = os.getenv("DATABASE_URL")

print("==================================================")
print("🚀 MQnet - Force Database Seeding Tool (시크빌 복구)")
print("==================================================")

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not found in .env file!")
    exit(1)

try:
    print("🔌 Connecting to PostgreSQL (Supabase)...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # 1. Check if store-chicvill exists
    cur.execute("SELECT 1 FROM stores WHERE id = 'store-chicvill' LIMIT 1")
    has_chicvill = cur.fetchone() is not None
    
    if not has_chicvill:
        print("🌱 Seeding '시크빌' (store-chicvill)...")
        cur.execute("""
            INSERT INTO stores (id, name, ceo_name, signature_owner, monthly_fee, payment_status, payment_history, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO NOTHING
        """, ("store-chicvill", "시크빌", "미지정 점주", "owner-store-chicvill", 50000, "정상", json.dumps([])))
        print("✅ Successfully seeded '시크빌'!")
    else:
        print("ℹ️ '시크빌' already exists in the stores table.")

    # 2. Check if store-1 (시크앤프레시) exists
    cur.execute("SELECT 1 FROM stores WHERE id = 'store-1' LIMIT 1")
    has_store1 = cur.fetchone() is not None
    
    if not has_store1:
        print("🌱 Seeding '시크앤프레시' (store-1)...")
        cur.execute("""
            INSERT INTO stores (id, name, ceo_name, signature_owner, monthly_fee, payment_status, payment_history, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO NOTHING
        """, ("store-1", "시크앤프레시", "미지정 점주", "owner-store-1", 50000, "정상", json.dumps([])))
        print("✅ Successfully seeded '시크앤프레시'!")
    else:
        print("ℹ️ '시크앤프레시' already exists in the stores table.")

    conn.commit()
    cur.close()
    conn.close()
    print("\n🎉 Seeding process completed successfully!")
    
except Exception as e:
    print(f"\n❌ Database error occurred: {e}")

print("==================================================")
