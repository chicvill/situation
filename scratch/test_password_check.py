import sys
import os
import hashlib
from werkzeug.security import check_password_hash

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "situation-backend"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "situation-backend", ".env"))

from session.db.connection import get_db_conn

conn = get_db_conn()
if conn:
    cur = conn.cursor()
    cur.execute("SELECT password FROM users WHERE username = '01000000005'")
    db_password = cur.fetchone()[0]
    cur.close()
    conn.close()

    raw_pw = "1212"
    sha_pw = hashlib.sha256(raw_pw.encode()).hexdigest()

    match_raw = check_password_hash(db_password, raw_pw)
    match_sha = check_password_hash(db_password, sha_pw)

    print(f"Stored Hash: {db_password[:50]}...")
    print(f"Matches RAW '1212': {match_raw}")
    print(f"Matches SHA-256 of '1212': {match_sha}")
else:
    print("Could not connect to database")
