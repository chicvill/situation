import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("DATABASE_URL")
conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Waitings
cur.execute("SELECT waiting_id, phone_number, party_size, status, timestamp FROM table_waitings")
waitings = cur.fetchall()
print(f"Total waitings: {len(waitings)}")
for w in waitings:
    print(f"  Waiting: {w[0]} | Phone: {w[1]} | Size: {w[2]} | Status: {w[3]} | Time: {w[4]}")

# Reservations
cur.execute("SELECT reservation_id, customer_name, phone_number, party_size, reserved_time, table_id, status FROM table_reservations")
reservations = cur.fetchall()
print(f"\nTotal reservations: {len(reservations)}")
for r in reservations:
    print(f"  Reservation: {r[0]} | Name: {r[1]} | Phone: {r[2]} | Size: {r[3]} | Time: {r[4]} | Table: {r[5]} | Status: {r[6]}")

cur.close()
conn.close()
