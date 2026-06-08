import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DATABASE_URL")

conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Find any active orders that are stuck in 'paid' status
cur.execute("UPDATE table_orders SET status = 'served' WHERE status = 'paid' AND payment_status = 'paid'")
fixed_count = cur.rowcount
conn.commit()

print(f"Fixed {fixed_count} orders stuck in 'paid' status by changing them to 'served'.")
cur.close()
conn.close()
