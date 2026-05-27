import re
from typing import Optional, Dict
from fastapi import APIRouter, HTTPException
from ..state import manager, load_pool, save_pool
from ..database import get_db_conn

router = APIRouter()


@router.get("/api/pool")
async def get_pool(store_id: Optional[str] = None):
    pool = list(load_pool())  # _pool_cache를 직접 변형하지 않도록 복사본 사용

    # DB의 활성 주문들을 실시간 번들로 조회하여 통합
    from ..database import get_all_active_orders_as_bundles, get_all_staff_as_bundles, get_all_attendance_as_bundles
    active_order_bundles = get_all_active_orders_as_bundles(store_id)
    pool.extend(active_order_bundles)

    # DB가 권위 있는 소스이므로 JSON pool에 남아있는 Employee/Attendance 번들은 제거 후 대체
    pool = [b for b in pool if b.get("type") not in ("Employee", "Attendance")]
    staff_bundles = get_all_staff_as_bundles(store_id)
    attendance_bundles = get_all_attendance_as_bundles(store_id)
    pool.extend(staff_bundles)
    pool.extend(attendance_bundles)

    if store_id and store_id != "Total":
        # Always include Menus, PersonalInfos, and bundles matching store_id
        return [
            b for b in pool
            if b.get("store_id") == store_id or not b.get("store_id") or b.get("type") in ["Menus", "PersonalInfos"]
        ]
    return pool


@router.put("/api/bundle/{bundle_id}")
async def update_bundle(bundle_id: str, bundle: Dict):
    b_type = bundle.get("type")
    
    # Ensure bundle ID is set properly
    if not bundle.get("id"):
        bundle["id"] = bundle_id
        
    # --- DB 권위형 타입 (Employee, Attendance) 처리 ---
    # JSON pool(knowledge_pool.json)에 기록하지 않고, RDBMS PostgreSQL에 즉시 직접 반영
    if b_type in ("Employee", "Attendance"):
        try:
            store_id = bundle.get("store_id") or "default_store"
            items = bundle.get("items") or []
            
            # Helper to parse items array to dict
            items_dict = {item.get("name"): item.get("value") for item in items if "name" in item}

            if b_type == "Employee":
                staff_id = items_dict.get("아이디")
                name = items_dict.get("이름")
                role_label = items_dict.get("직책")
                role = "manager" if role_label == "점장" else "staff"
                hourly_wage = int(items_dict.get("시급") or 10500)
                status = bundle.get("status") or "active"
                
                contract_val = items_dict.get("계약정보")
                import json
                if isinstance(contract_val, str):
                    try: contract_period = json.loads(contract_val)
                    except: contract_period = {"start": "2026-01-01", "end": "2029-12-31"}
                elif isinstance(contract_val, dict):
                    contract_period = contract_val
                else:
                    contract_period = {"start": "2026-01-01", "end": "2029-12-31"}
                    
                schedule_val = items_dict.get("스케줄")
                schedules_list = []
                if isinstance(schedule_val, str):
                    try: schedules_list = json.loads(schedule_val)
                    except: pass
                elif isinstance(schedule_val, list):
                    schedules_list = schedule_val

                if staff_id and name:
                    staff_data = {
                        "staff_id": staff_id,
                        "store_id": store_id,
                        "name": name,
                        "role": role,
                        "hourly_wage": hourly_wage,
                        "status": status,
                        "contract_period": contract_period
                    }
                    from ..database import save_staff, save_schedule
                    if save_staff(staff_data):
                        # 스케줄 저장
                        conn = get_db_conn()
                        if conn:
                            cur = conn.cursor()
                            cur.execute("DELETE FROM table_staff_schedules WHERE staff_id = %s AND store_id = %s", (staff_id, store_id))
                            conn.commit()
                            cur.close()
                            conn.close()
                            
                        for s in schedules_list:
                            import uuid
                            sched_id = f"SCHED-{uuid.uuid4().hex[:6].upper()}"
                            sched_data = {
                                "schedule_id": sched_id,
                                "staff_id": staff_id,
                                "store_id": store_id,
                                "day_of_week": int(s.get("day_of_week", 0)),
                                "start_time": s.get("start_time", "09:00"),
                                "end_time": s.get("end_time", "18:00")
                            }
                            save_schedule(sched_data)
                        print(f"🔄 Sync Engine [RDBMS Only]: table_staff_accounts 사원 동기화 완료 ({name})")

            elif b_type == "Attendance":
                log_id = bundle.get("id")
                staff_id = items_dict.get("아이디")
                check_in_time = items_dict.get("출근시간")
                check_out_time = items_dict.get("퇴근시간")
                work_minutes = items_dict.get("근무분수")
                if work_minutes is not None:
                    try: work_minutes = int(float(str(work_minutes)))
                    except: work_minutes = None
                    
                status = bundle.get("status") or "completed"
                tardy_label = items_dict.get("지각여부")
                tardy = tardy_label == "지각"
                paid_label = items_dict.get("정산상태")
                paid = paid_label == "지급"
                device_id = bundle.get("device_id") or f"KIOSK-{store_id[:6].upper()}"

                if staff_id and check_in_time:
                    conn = get_db_conn()
                    if conn:
                        cur = conn.cursor()
                        cur.execute("""
                            INSERT INTO table_attendance_logs
                                (log_id, staff_id, store_id, check_in_time, check_out_time, work_minutes, status, tardy, paid, device_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (log_id) DO UPDATE SET
                                check_out_time = COALESCE(EXCLUDED.check_out_time, table_attendance_logs.check_out_time),
                                work_minutes = COALESCE(EXCLUDED.work_minutes, table_attendance_logs.work_minutes),
                                status = EXCLUDED.status,
                                tardy = EXCLUDED.tardy,
                                paid = EXCLUDED.paid
                        """, (log_id, staff_id, store_id, check_in_time, check_out_time, work_minutes, status, tardy, paid, device_id))
                        conn.commit()
                        cur.close()
                        conn.close()
                        print(f"🔄 Sync Engine [RDBMS Only]: table_attendance_logs 근태 동기화 완료 (log_id={log_id})")

        except Exception as sync_err:
            print(f"⚠️ Sync Engine Warning: Failed to sync bundle data to PostgreSQL tables: {sync_err}")
            raise HTTPException(status_code=500, detail=f"Failed to sync bundle data to RDBMS: {sync_err}")

        # 변경 사항 브로드캐스트
        await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": bundle_id})
        return {"status": "success"}

    # --- 기존 JSON pool 관리 타입 (PersonalInfos 등) 처리 ---
    pool = load_pool()
    found = False
    for i, b in enumerate(pool):
        if b.get("id") == bundle_id:
            pool[i] = bundle
            found = True
            break

    if not found:
        pool.append(bundle)

    if save_pool(pool):
        # ── RDBMS PostgreSQL 동적 동기화 엔진 (Sync Engine) ──
        try:
            store_id = bundle.get("store_id") or "default_store"
            items = bundle.get("items") or []
            
            # Helper to parse items array to dict
            items_dict = {item.get("name"): item.get("value") for item in items if "name" in item}

            if b_type == "PersonalInfos":
                username = items_dict.get("아이디")
                password = items_dict.get("비밀번호")
                role = items_dict.get("권한") or "staff"
                full_name = items_dict.get("이름")
                is_approved = bundle.get("status") == "approved"
                
                if username and password:
                    from werkzeug.security import generate_password_hash
                    pw_hash = password
                    if not (password.startswith("pbkdf2:") or password.startswith("scrypt:") or password.startswith("bcrypt:")):
                        pw_hash = generate_password_hash(password)
                        
                    conn = get_db_conn()
                    if conn:
                        cur = conn.cursor()
                        cur.execute("""
                            INSERT INTO users (username, password, role, store_id, full_name, is_approved, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, NOW())
                            ON CONFLICT (username) DO UPDATE SET
                                password = EXCLUDED.password,
                                role = EXCLUDED.role,
                                store_id = EXCLUDED.store_id,
                                full_name = EXCLUDED.full_name,
                                is_approved = EXCLUDED.is_approved
                        """, (username, pw_hash, role, store_id, full_name, is_approved))
                        conn.commit()
                        cur.close()
                        conn.close()
                        print(f"🔄 Sync Engine [JSON + RDBMS]: users 테이블 계정 동기화 완료 ({username})")

        except Exception as sync_err:
            print(f"⚠️ Sync Engine Warning: Failed to sync bundle data to PostgreSQL tables: {sync_err}")

        # 변경 사항 브로드캐스트
        await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": bundle_id})
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to save bundle")


@router.delete("/api/bundle/{bundle_id}")
async def delete_bundle(bundle_id: str):
    pool = load_pool()
    original_pool_len = len(pool)
    pool = [b for b in pool if b.get("id") != bundle_id]

    # 근태 기록(Attendance) 삭제 로직 - ATT-XXXX 또는 LOG-XXXX 형식 모두 처리
    if "ATT-" in bundle_id or "LOG-" in bundle_id:
        try:
            conn = get_db_conn()
            if conn:
                cur = conn.cursor()
                # bundle_id 자체가 log_id 일 수도 있고 ATT-{log_id} 형식일 수도 있음
                # 두 형태 모두 시도
                bare_id = re.sub(r'^(ATT-)+', '', bundle_id)  # ATT-ATT-XXX → XXX
                cur.execute(
                    "DELETE FROM table_attendance_logs WHERE log_id = %s OR log_id = %s OR log_id = %s",
                    (bundle_id, f"ATT-{bare_id}", bare_id)
                )
                deleted = cur.rowcount
                conn.commit()
                cur.close()
                conn.close()
                print(f"🗑️ Attendance log deleted (bundle_id={bundle_id}, rows={deleted})")
        except Exception as e:
            print(f"Error deleting attendance from DB: {e}")

    if len(pool) < original_pool_len or "ATT-" in bundle_id or "LOG-" in bundle_id:
        save_pool(pool)

    await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": bundle_id, "deleted": True})
    return {"status": "success"}


@router.delete("/api/pool")
async def reset_pool(store_id: Optional[str] = None):
    if not store_id or store_id == "Total":
        save_pool([])
    else:
        pool = load_pool()
        pool = [b for b in pool if b.get("store_id") != store_id]
        save_pool(pool)
    return {"status": "success"}
