import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'knowledge_bundles'")
    columns = cur.fetchall()
    for col in columns:
        print(f"{col[0]}: {col[1]}")
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
