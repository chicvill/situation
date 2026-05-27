import sys
import os
import json
import shutil

# Ensure situation-backend is in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "situation-backend"))

os.environ["PYTHONUTF8"] = "1"

# Explicitly load .env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "situation-backend", ".env"))

from fastapi.testclient import TestClient
from session.main import app
from session.state import POOL_FILE, load_pool, save_pool
from session.db.connection import get_db_conn

# 1. Backup knowledge_pool.json
pool_backup = POOL_FILE + ".bak"
if os.path.exists(POOL_FILE):
    shutil.copy2(POOL_FILE, pool_backup)
    print(f"🎒 Backed up knowledge_pool.json to {pool_backup}")

client = TestClient(app)

try:
    print("\n🔬 [Test 1] Testing PUT /api/bundle/{bundle_id} with PersonalInfos")
    personal_info_bundle = {
        "id": "USER-testphone01",
        "type": "PersonalInfos",
        "title": "테스트 계정",
        "store_id": "store-chicvill",
        "status": "approved",
        "items": [
            {"name": "이름", "value": "테스트유저"},
            {"name": "아이디", "value": "01099998888"},
            {"name": "비밀번호", "value": "1212"},
            {"name": "권한", "value": "staff"}
        ]
    }
    
    # Send PUT request
    response = client.put("/api/bundle/USER-testphone01", json=personal_info_bundle)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    print("✅ PUT PersonalInfos request successful!")
    
    # Verify it is in knowledge_pool.json
    pool = load_pool()
    matching_in_json = [b for b in pool if b.get("id") == "USER-testphone01"]
    assert len(matching_in_json) > 0, "PersonalInfos bundle must be saved in knowledge_pool.json"
    print("✅ PersonalInfos bundle successfully found in knowledge_pool.json!")

    # Verify it is in PostgreSQL users table
    conn = get_db_conn()
    if conn:
        cur = conn.cursor()
        cur.execute("SELECT username, full_name FROM users WHERE username = '01099998888'")
        res = cur.fetchone()
        assert res is not None, "PersonalInfos must be synced to PostgreSQL users table"
        print(f"✅ PersonalInfos synced to PostgreSQL successfully: {res}")
        
        # Clean up database entry
        cur.execute("DELETE FROM users WHERE username = '01099998888'")
        conn.commit()
        cur.close()
        conn.close()

    print("\n🔬 [Test 2] Testing PUT /api/bundle/{bundle_id} with Employee (Should bypass JSON, write to DB)")
    employee_bundle = {
        "id": "EMP-01099998888",
        "type": "Employee",
        "title": "테스트 사원",
        "store_id": "store-chicvill",
        "status": "active",
        "items": [
            {"name": "이름", "value": "테스트사원"},
            {"name": "아이디", "value": "01099998888"},
            {"name": "직책", "value": "점원"},
            {"name": "시급", "value": "12000"},
            {"name": "계약정보", "value": '{"start": "2026-01-01", "end": "2029-12-31"}'},
            {"name": "스케줄", "value": "[]"}
        ]
    }
    
    # Send PUT request
    response = client.put("/api/bundle/EMP-01099998888", json=employee_bundle)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    print("✅ PUT Employee request successful!")
    
    # Verify it is NOT in knowledge_pool.json
    pool = load_pool()
    matching_in_json = [b for b in pool if b.get("id") == "EMP-01099998888"]
    assert len(matching_in_json) == 0, "Employee bundle MUST NOT be saved in knowledge_pool.json"
    print("✅ Employee bundle was NOT saved in knowledge_pool.json (Bypassed successfully!)")

    # Verify it is in PostgreSQL table_staff_accounts
    conn = get_db_conn()
    if conn:
        cur = conn.cursor()
        cur.execute("SELECT staff_id, name FROM table_staff_accounts WHERE staff_id = '01099998888'")
        res = cur.fetchone()
        assert res is not None, "Employee must be saved to PostgreSQL table_staff_accounts"
        print(f"✅ Employee saved to PostgreSQL successfully: {res}")
        
        # Clean up database entry
        cur.execute("DELETE FROM table_staff_schedules WHERE staff_id = '01099998888'")
        cur.execute("DELETE FROM table_staff_accounts WHERE staff_id = '01099998888'")
        conn.commit()
        cur.close()
        conn.close()

    print("\n🔬 [Test 3] Testing GET /api/pool with store_id=store-chicvill")
    # Even though Employee was deleted, we can test that GET /api/pool correctly works.
    response = client.get("/api/pool?store_id=store-chicvill")
    assert response.status_code == 200
    pool_data = response.json()
    print(f"✅ GET /api/pool returned {len(pool_data)} bundles.")

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY!")

finally:
    # Restore knowledge_pool.json backup
    if os.path.exists(pool_backup):
        shutil.copy2(pool_backup, POOL_FILE)
        os.remove(pool_backup)
        print("🎒 Restored knowledge_pool.json from backup.")
