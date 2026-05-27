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
