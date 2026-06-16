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
            
            # 모든 JSON pool에 저장되는 bundles (Menus, StoreConfig, PersonalInfos 등)를 PostgreSQL의 knowledge_bundles에도 추가/갱신
            import json
            conn = get_db_conn()
            if conn:
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO knowledge_bundles (id, type, store_id, title, items, timestamp)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        type = EXCLUDED.type,
                        store_id = EXCLUDED.store_id,
                        title = EXCLUDED.title,
                        items = EXCLUDED.items,
                        timestamp = NOW()
                """, (
                    bundle_id,
                    b_type,
                    store_id,
                    bundle.get("title", ""),
                    json.dumps(items, ensure_ascii=False)
                ))
                conn.commit()
                cur.close()
                conn.close()
                print(f"🔄 Sync Engine [JSON + RDBMS]: knowledge_bundles 테이블 동기화 완료 (bundle_id={bundle_id})")

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

                # 점주 가입 신청 시 빈 매장 뼈대 자동 생성 연동 (RDBMS 및 JSON Pool 동시 반영)
                if role == "owner" and store_id:
                    store_name = bundle.get("store") or "새로운 매장"
                    # 요금 옵션 파싱 (기본료 10,000 + 옵션 개수 * 1,000)
                    use_call = items_dict.get("옵션_호출") == "Y"
                    use_waiting = items_dict.get("옵션_대기") == "Y"
                    use_parking = items_dict.get("옵션_주차") == "Y"
                    use_points = items_dict.get("옵션_포인트") == "Y"
                    use_staff = items_dict.get("옵션_직원") == "Y"
                    
                    active_options = sum([use_call, use_waiting, use_parking, use_points, use_staff])
                    monthly_fee = 10000 + (active_options * 1000)
                    
                    biz_no = items_dict.get("사업자번호") or ""
                    open_date = items_dict.get("개업일자") or ""
                    table_count_val = items_dict.get("테이블수")
                    try:
                        table_count = int(table_count_val) if table_count_val else 12
                    except:
                        table_count = 12
                    
                    # 1. stores 에 매장 생성
                    conn_store = get_db_conn()
                    if conn_store:
                        cur_store = conn_store.cursor()
                        cur_store.execute("SELECT id FROM stores WHERE id = %s", (store_id,))
                        if not cur_store.fetchone():
                            cur_store.execute("""
                                INSERT INTO stores (id, name, ceo_name, signature_owner, monthly_fee, payment_status, payment_history, created_at, table_count, use_call, use_waiting, use_parking, use_points, use_staff)
                                VALUES (%s, %s, %s, %s, %s, '정상', '[]', NOW(), %s, %s, %s, %s, %s, %s)
                            """, (store_id, store_name, full_name, username, monthly_fee, table_count, use_call, use_waiting, use_parking, use_points, use_staff))
                            conn_store.commit()
                            print(f"🏠 신규 점주 빈 매장 개설 완료: {store_name} ({store_id})")
                        cur_store.close()
                        conn_store.close()
                        
                    # 2. RDBMS knowledge_bundles 에 빈 Menus 및 StoreConfig 번들 생성
                    menu_bundle_id = f"MENUS_{store_id}"
                    config_bundle_id = f"store-config-{store_id}"
                    config_items = [
                        {"name": "상호명", "value": store_name},
                        {"name": "사업자번호", "value": biz_no},
                        {"name": "대표자", "value": full_name},
                        {"name": "개업일자", "value": open_date},
                        {"name": "테이블설정", "value": f"1번부터 {table_count}번까지 기본 배치"}
                    ]
                    
                    import json
                    conn_bundles = get_db_conn()
                    if conn_bundles:
                        cur_b = conn_bundles.cursor()
                        # Menus
                        cur_b.execute("""
                            INSERT INTO knowledge_bundles (id, type, store_id, title, items, timestamp)
                            VALUES (%s, 'Menus', %s, '메뉴 정보', '[]', NOW())
                            ON CONFLICT (id) DO NOTHING
                        """, (menu_bundle_id, store_id))
                        # StoreConfig
                        cur_b.execute("""
                            INSERT INTO knowledge_bundles (id, type, store_id, title, items, timestamp)
                            VALUES (%s, 'StoreConfig', %s, '매장 정보', %s, NOW())
                            ON CONFLICT (id) DO NOTHING
                        """, (config_bundle_id, store_id, json.dumps(config_items, ensure_ascii=False)))
                        conn_bundles.commit()
                        cur_b.close()
                        conn_bundles.close()
                        
                    # 3. JSON pool(knowledge_pool.json) 파일에도 Menus와 StoreConfig 추가 후 저장
                    current_pool = list(load_pool())
                    has_menus = any(x.get("id") == menu_bundle_id for x in current_pool)
                    has_config = any(x.get("id") == config_bundle_id for x in current_pool)
                    pool_changed = False
                    
                    if not has_menus:
                        current_pool.append({
                            "id": menu_bundle_id,
                            "type": "Menus",
                            "title": "메뉴 정보",
                            "store_id": store_id,
                            "store": store_name,
                            "timestamp": bundle.get("timestamp") or "",
                            "items": []
                        })
                        pool_changed = True
                    if not has_config:
                        current_pool.append({
                            "id": config_bundle_id,
                            "type": "StoreConfig",
                            "title": "매장 정보",
                            "store_id": store_id,
                            "store": store_name,
                            "status": "approved",
                            "timestamp": bundle.get("timestamp") or "",
                            "items": config_items
                        })
                        pool_changed = True
                        
                    if pool_changed:
                        save_pool(current_pool)
                        print(f"📁 JSON Pool에 Menus/StoreConfig 추가 완료 ({store_id})")

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

    # knowledge_bundles 테이블에서 삭제
    try:
        conn = get_db_conn()
        if conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM knowledge_bundles WHERE id = %s", (bundle_id,))
            conn.commit()
            cur.close()
            conn.close()
            print(f"🗑️ knowledge_bundles deleted (bundle_id={bundle_id})")
    except Exception as e:
        print(f"Error deleting bundle from knowledge_bundles: {e}")

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

    # DB에서도 번들 초기화
    try:
        conn = get_db_conn()
        if conn:
            cur = conn.cursor()
            if not store_id or store_id == "Total":
                cur.execute("DELETE FROM knowledge_bundles")
            else:
                cur.execute("DELETE FROM knowledge_bundles WHERE store_id = %s", (store_id,))
            conn.commit()
            cur.close()
            conn.close()
            print(f"🗑️ knowledge_bundles reset (store_id={store_id})")
    except Exception as e:
        print(f"Error resetting knowledge_bundles from DB: {e}")

    return {"status": "success"}
