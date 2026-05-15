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

    # DB의 직원 및 근태 기록을 가상 번들로 변환 후 통합
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
    pool = load_pool()
    found = False
    for i, b in enumerate(pool):
        if b.get("id") == bundle_id:
            pool[i] = bundle
            found = True
            break

    if not found:
        bundle["id"] = bundle_id
        pool.append(bundle)

    if save_pool(pool):
        # 변경 사항 브로드캐스트
        await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": bundle_id})
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to save bundle")


@router.delete("/api/bundle/{bundle_id}")
async def delete_bundle(bundle_id: str):
    pool = load_pool()
    original_pool_len = len(pool)
    pool = [b for b in pool if b.get("id") != bundle_id]

    # 근태 기록(Attendance) 삭제 로직 강화
    if "ATT-" in bundle_id:
        try:
            conn = get_db_conn()
            if conn:
                cur = conn.cursor()
                # 모든 "ATT-" 접두어를 제거하여 순수 log_id 확보
                real_log_id = re.sub(r'^(ATT-)+', '', bundle_id)
                search_id = f"ATT-{real_log_id}"
                cur.execute("DELETE FROM table_attendance_logs WHERE log_id = %s OR log_id = %s", (search_id, real_log_id))
                conn.commit()
                cur.close()
                conn.close()
                print(f"🗑️ Attendance log {search_id} deleted from DB.")
        except Exception as e:
            print(f"Error deleting attendance from DB: {e}")

    if len(pool) < original_pool_len or "ATT-" in bundle_id:
        if save_pool(pool):
            await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": bundle_id})
            return {"status": "success"}

    await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": bundle_id})
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
