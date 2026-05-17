import uuid
import hashlib
from datetime import datetime
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException
from ..state import manager, load_pool, save_pool
from ..database import get_db_conn

router = APIRouter()


# --- 👥 9. 통합 매장 직원 및 근로 관리 (Staff & Labor Management) Endpoints ---
@router.post("/api/staff/direct-register")
async def direct_register_staff(data: Dict):
    store_id = data.get("store_id") or "default_store"
    store_name = data.get("store_name") or "미지정"
    name = data.get("name")
    phone = data.get("phone")  # This is the staff_id / phone number
    role = data.get("role") or "staff"
    hourly_wage = int(data.get("hourly_wage") or 10500)
    temporary_password = data.get("temporary_password") or "1212"
    schedules = data.get("schedules") or []  # List of {day_of_week: int, start_time: str, end_time: str}

    if not name or not phone:
        raise HTTPException(status_code=400, detail="이름과 휴대폰 번호(ID)는 필수 항목입니다.")

    # 1. PersonalInfos 번들 생성/업데이트 (로그인 정보용)
    hashed_pw = hashlib.sha256(temporary_password.encode()).hexdigest()

    signup_bundle = {
        "id": f"USER-{phone}",
        "type": "PersonalInfos",
        "title": f"{name}님 등록 완료 (직원)",
        "items": [
            {"name": "이름", "value": name},
            {"name": "아이디", "value": phone},
            {"name": "비밀번호", "value": hashed_pw},
            {"name": "권한", "value": role}
        ],
        "status": "approved",  # Pre-approved by owner!
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "store": store_name,
        "store_id": store_id
    }

    # 지식 풀에 저장
    pool = load_pool()
    found_bundle = False
    for i, b in enumerate(pool):
        if b.get("type") == "PersonalInfos" and any(item.get("name") == "아이디" and item.get("value") == phone for item in b.get("items", [])):
            pool[i] = signup_bundle
            found_bundle = True
            break
    if not found_bundle:
        pool.append(signup_bundle)

    if not save_pool(pool):
        raise HTTPException(status_code=500, detail="로그인 지식 풀 업데이트 실패")

    # 2. table_staff_accounts에 직원 저장
    staff_data = {
        "staff_id": phone,
        "store_id": store_id,
        "name": name,
        "role": role,
        "hourly_wage": hourly_wage,
        "status": "approved",  # Pre-approved!
        "contract_period": {
            "start": datetime.now().strftime("%Y-%m-%d"),
            "end": "2029-12-31"
        }
    }

    from ..database import save_staff, save_schedule
    if not save_staff(staff_data):
        raise HTTPException(status_code=500, detail="PostgreSQL 직원 계정 저장 실패")

    # 3. 기존의 스케줄이 있다면 먼저 DB에서 삭제하기
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM table_staff_schedules WHERE staff_id = %s AND store_id = %s", (phone, store_id))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Failed to clear old schedules: {e}")

    # 4. 요일별 스케줄 개별 저장
    for s in schedules:
        sched_id = f"SCHED-{uuid.uuid4().hex[:6].upper()}"
        sched_data = {
            "schedule_id": sched_id,
            "staff_id": phone,
            "store_id": store_id,
            "day_of_week": int(s["day_of_week"]),
            "start_time": s["start_time"],
            "end_time": s["end_time"]
        }
        save_schedule(sched_data)

    # 실시간 알림 브로드캐스트
    await manager.broadcast_to_kitchen({
        "type": "POOL_UPDATED",
        "bundle_id": f"EMP-{phone}"
    })

    return {"status": "success", "staff_id": phone}


@router.post("/api/staff/register")
async def register_staff(data: Dict):
    staff_id = f"STF-{uuid.uuid4().hex[:4].upper()}"
    store_id = data.get("store_id") or "default_store"
    name = data.get("name")
    role = data.get("role") or "staff"  # staff or manager
    hourly_wage = int(data.get("hourly_wage") or 10500)
    contract_start = data.get("contract_start") or datetime.now().strftime("%Y-%m-%d")
    contract_end = data.get("contract_end") or "2026-12-31"

    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    staff_data = {
        "staff_id": staff_id,
        "store_id": store_id,
        "name": name,
        "role": role,
        "hourly_wage": hourly_wage,
        "status": "pending",
        "contract_period": {
            "start": contract_start,
            "end": contract_end
        }
    }

    from ..database import save_staff
    if save_staff(staff_data):
        await manager.broadcast_to_kitchen({
            "type": "STAFF_REGISTERED",
            "staff_id": staff_id,
            "name": name,
            "role": role
        })
        return staff_data
    raise HTTPException(status_code=500, detail="Failed to register staff account")


@router.get("/api/staff/list")
async def get_staff_list(store_id: str = "default_store"):
    from ..database import get_active_staff_list
    return get_active_staff_list(store_id)


@router.post("/api/staff/approve")
async def approve_staff(data: Dict):
    staff_id = data.get("staff_id")
    status = data.get("status") or "approved"  # approved, retired

    if not staff_id:
        raise HTTPException(status_code=400, detail="staff_id is required")

    from ..database import update_staff_status
    if update_staff_status(staff_id, status):
        await manager.broadcast_to_kitchen({
            "type": "STAFF_STATUS_UPDATED",
            "staff_id": staff_id,
            "status": status
        })
        return {"status": "success"}
    raise HTTPException(status_code=500, detail="Failed to update staff status")


@router.post("/api/staff/schedule")
async def register_staff_schedule(data: Dict):
    staff_id = data.get("staff_id")
    day_of_week = int(data.get("day_of_week", 0))  # 0: Monday, ..., 6: Sunday
    start_time = data.get("start_time")  # format "HH:MM"
    end_time = data.get("end_time")  # format "HH:MM"

    if not staff_id or start_time is None or end_time is None:
        raise HTTPException(status_code=400, detail="staff_id, start_time, and end_time are required")

    schedule_id = f"SCHED-{uuid.uuid4().hex[:4].upper()}"
    sched_data = {
        "schedule_id": schedule_id,
        "staff_id": staff_id,
        "day_of_week": day_of_week,
        "start_time": start_time,
        "end_time": end_time
    }

    from ..database import save_schedule
    if save_schedule(sched_data):
        return sched_data
    raise HTTPException(status_code=500, detail="Failed to register schedule")


@router.get("/api/staff/schedule/{staff_id}")
async def get_staff_schedules_endpoint(staff_id: str):
    from ..database import get_staff_schedules
    return get_staff_schedules(staff_id)


@router.post("/api/staff/check-in")
async def staff_check_in(data: Dict):
    staff_id = data.get("staff_id")
    store_id = data.get("store_id") or "default_store"
    device_id = data.get("device_id") or "unknown"

    if not staff_id:
        raise HTTPException(status_code=400, detail="staff_id required")

    from ..database import get_staff, get_staff_schedules, save_attendance_checkin, get_active_attendance_log, get_today_checkin, get_recent_device_scan

    # ── 대리 출퇴근 방지: 동일 기기 5분 쿨다운 ──
    force = data.get("force", False)
    if not force:
        recent = get_recent_device_scan(device_id, minutes=5)
        if recent:
            last_time = recent.get("check_out_time") or recent.get("check_in_time") or ""
            try:
                last_dt = datetime.fromisoformat(str(last_time))
                remaining_sec = max(0, int(300 - (datetime.now() - last_dt).total_seconds()))
                remaining_min = remaining_sec // 60
                remaining_s   = remaining_sec % 60
                time_label = f"{remaining_min}분 {remaining_s}초" if remaining_min else f"{remaining_s}초"
            except Exception:
                time_label = "잠시"
            raise HTTPException(
                status_code=429,
                detail=f"DEVICE_COOLDOWN|이 기기에서 최근 5분 이내에 출퇴근이 처리되었습니다.\n대리 출퇴근 방지를 위해 잠금 중입니다.\n잠금 해제까지 약 {time_label} 남았습니다."
            )

    staff = get_staff(staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff account not found")

    if staff['status'] != 'approved':
        raise HTTPException(status_code=400, detail="승인된 직원만 출퇴근이 가능합니다. 점주의 승인을 받으세요.")

    # 계약 기간 확인
    today_str = datetime.now().strftime("%Y-%m-%d")
    contract = staff['contract_period']
    if not (contract.get("start") <= today_str <= contract.get("end")):
        raise HTTPException(status_code=400, detail="근로계약 기간 외 출퇴근은 불가합니다. 계약 기간을 확인하세요.")

    force = data.get("force", False)

    # 당일 중복 출근 방지 (디바이스 무관, 퇴근 후 재출근 포함 차단)
    if not force:
        today_log = get_today_checkin(staff_id)
        if today_log:
            reg_device = today_log.get('device_id') or '알 수 없음'
            reg_time = str(today_log.get('check_in_time', ''))[:19]
            tardy_flag = " (지각 기록됨)" if today_log.get('tardy') else ""
            raise HTTPException(
                status_code=400,
                detail=f"오늘 이미 출근이 등록되어 있습니다. 동일 시간대 중복 스캔은 허용되지 않습니다{tardy_flag}.\n최초 등록: {reg_time} / 단말기: {reg_device}"
            )

    # 이미 출근 중인지 확인
    active_log = get_active_attendance_log(staff_id)
    if active_log:
        raise HTTPException(status_code=400, detail="이미 출근 상태입니다.")

    # 요일별 스케줄 체크 (0: 월요일, ..., 6: 일요일)
    current_weekday = datetime.now().weekday()
    schedules = get_staff_schedules(staff_id)
    today_schedule = next((s for s in schedules if s['day_of_week'] == current_weekday), None)

    now = datetime.now()

    if not today_schedule:
        if not force:
            raise HTTPException(status_code=400, detail="오늘 배정된 근무 일정이 없습니다. 점주 수동 등록이 필요합니다.")
        tardy = False  # 강제 출근 시 스케줄이 없으면 지각 아님
    else:
        # 10분 가드 계산
        sched_start_str = today_schedule['start_time']  # e.g., "10:00"
        try:
            shour, smin = map(int, sched_start_str.split(":"))
            sched_time = now.replace(hour=shour, minute=smin, second=0, microsecond=0)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"스케줄 형식 오류: {e}")

        diff_minutes = (now - sched_time).total_seconds() / 60.0

        # 가드 분배 (전후 5분 수립)
        if not force:
            if diff_minutes < -5.0:
                raise HTTPException(status_code=400, detail=f"출근 스케줄 시작 5분 전부터만 출근 등록이 가능합니다. (출근예정: {sched_start_str})")
            elif diff_minutes > 5.0:
                raise HTTPException(status_code=400, detail=f"출근 허용 시간(5분)을 초과했습니다. 점주 수동 승인을 받으세요. (출근예정: {sched_start_str})")

        tardy = diff_minutes >= 1.0  # 1분 넘게 늦었으면 지각 처리

    log_id = f"ATT-{uuid.uuid4().hex[:6].upper()}"
    check_in_time = now.isoformat()

    if save_attendance_checkin(log_id, staff_id, store_id, check_in_time, tardy, device_id):
        # UI 타임라인에 표시하기 위해 pool에 bundle 추가
        att_bundle = {
            "id": log_id,
            "type": "Attendance",
            "title": f"[{staff['name']}] 출근 완료",
            "items": [
                {"name": "사원명", "value": staff['name']},
                {"name": "지각여부", "value": "지각" if tardy else "정상"},
                {"name": "정산상태", "value": "미정산"}
            ],
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "store_id": store_id
        }
        msg = {
            "type": "STAFF_ATTENDANCE_UPDATE",
            "staff_id": staff_id,
            "name": staff['name'],
            "action": "check-in",
            "tardy": tardy,
            "timestamp": check_in_time
        }
        await manager.broadcast_to_kitchen(msg)
        await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": log_id, "bundle_type": "Attendance", "store_id": store_id})
        return {"status": "success", "tardy": tardy, "check_in_time": check_in_time}
    raise HTTPException(status_code=500, detail="출근 저장 실패")


@router.post("/api/staff/check-out")
async def staff_check_out(data: Dict):
    staff_id = data.get("staff_id")
    store_id = data.get("store_id", "default_store")
    if not staff_id:
        raise HTTPException(status_code=400, detail="staff_id required")

    device_id = data.get("device_id") or "unknown"
    force = data.get("force", False)

    from ..database import get_staff, get_staff_schedules, save_attendance_checkout, get_active_attendance_log, get_today_checkout, get_recent_device_scan

    # ── 대리 출퇴근 방지: 동일 기기 5분 쿨다운 ──
    if not force:
        recent = get_recent_device_scan(device_id, minutes=5)
        if recent:
            last_time = recent.get("check_out_time") or recent.get("check_in_time") or ""
            try:
                last_dt = datetime.fromisoformat(str(last_time))
                remaining_sec = max(0, int(300 - (datetime.now() - last_dt).total_seconds()))
                remaining_min = remaining_sec // 60
                remaining_s   = remaining_sec % 60
                time_label = f"{remaining_min}분 {remaining_s}초" if remaining_min else f"{remaining_s}초"
            except Exception:
                time_label = "잠시"
            raise HTTPException(
                status_code=429,
                detail=f"DEVICE_COOLDOWN|이 기기에서 최근 5분 이내에 출퇴근이 처리되었습니다.\n대리 출퇴근 방지를 위해 잠금 중입니다.\n잠금 해제까지 약 {time_label} 남았습니다."
            )

    staff = get_staff(staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff account not found")

    if not force:
        today_log = get_today_checkout(staff_id)
        if today_log:
            reg_device = today_log.get('device_id') or '알 수 없음'
            reg_time = str(today_log.get('check_out_time', ''))[:19]
            raise HTTPException(
                status_code=400,
                detail=f"오늘 이미 퇴근이 등록되어 있습니다. 동일 시간대 중복 스캔은 허용되지 않습니다.\n최초 등록: {reg_time} / 단말기: {reg_device}"
            )

    active_log = get_active_attendance_log(staff_id)
    if not active_log:
        raise HTTPException(status_code=400, detail="현재 출근 상태가 아닙니다. 먼저 출근 등록을 완료하세요.")

    # 요일별 스케줄 체크
    current_weekday = datetime.now().weekday()
    schedules = get_staff_schedules(staff_id)
    today_schedule = next((s for s in schedules if s['day_of_week'] == current_weekday), None)

    now = datetime.now()

    if today_schedule:
        sched_end_str = today_schedule['end_time']  # e.g., "18:00"
        try:
            ehour, emin = map(int, sched_end_str.split(":"))
            sched_time = now.replace(hour=ehour, minute=emin, second=0, microsecond=0)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"스케줄 형식 오류: {e}")

        diff_minutes = (now - sched_time).total_seconds() / 60.0

        # 전후 5분 수립
        if not force:
            if diff_minutes < -5.0:
                raise HTTPException(status_code=400, detail=f"퇴근 스케줄 종료 5분 전부터만 퇴근 등록이 가능합니다. (퇴근예정: {sched_end_str})")
            elif diff_minutes > 5.0:
                raise HTTPException(status_code=400, detail=f"퇴근 허용 시간(5분)을 초과했습니다. 점주 수동 연장 승인을 받으세요. (퇴근예정: {sched_end_str})")
    elif not force:
        raise HTTPException(status_code=400, detail="오늘 배정된 근무 일정이 없습니다. 점주 수동 등록/퇴근이 필요합니다.")

    # 근무시간 계산
    check_in_dt = datetime.fromisoformat(active_log['check_in_time'])
    work_minutes = int((now - check_in_dt).total_seconds() / 60)
    if work_minutes < 0:
        work_minutes = 0

    check_out_time = now.isoformat()
    if save_attendance_checkout(staff_id, active_log['log_id'], check_out_time, work_minutes, device_id):
        # UI 타임라인에 표시하기 위해 pool에 bundle 추가
        att_bundle = {
            "id": f"ATT-OUT-{uuid.uuid4().hex[:4].upper()}",
            "type": "Attendance",
            "title": f"[{staff['name']}] 퇴근 완료 (근무 {work_minutes}분)",
            "items": [
                {"name": "사원명", "value": staff['name']},
                {"name": "근무시간", "value": f"{work_minutes}분"},
                {"name": "정산상태", "value": "미정산"}
            ],
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "store_id": store_id
        }
        msg = {
            "type": "STAFF_ATTENDANCE_UPDATE",
            "staff_id": staff_id,
            "name": staff['name'],
            "action": "check-out",
            "work_minutes": work_minutes,
            "timestamp": check_out_time
        }
        await manager.broadcast_to_kitchen(msg)
        await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": att_bundle['id'], "bundle_type": "Attendance", "store_id": store_id})
        return {"status": "success", "work_minutes": work_minutes, "check_out_time": check_out_time}
    raise HTTPException(status_code=500, detail="퇴근 저장 실패")


@router.get("/api/staff/payroll/{staff_id}")
async def get_staff_payroll(staff_id: str, month: Optional[str] = None):
    """지정 직원의 특정 월(Format YYYY-MM) 급여 산출 리포트"""
    from ..database import get_staff, get_staff_attendance_logs
    staff = get_staff(staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    logs = get_staff_attendance_logs(staff_id, month)

    total_minutes = sum(log['work_minutes'] or 0 for log in logs)
    total_hours = total_minutes / 60.0
    hourly_wage = staff['hourly_wage']

    base_wage = int(total_hours * hourly_wage)

    # 주휴수당 간단 연산식 (주 15시간 이상 기준 보정)
    weekly_holiday_allowance = 0
    if total_hours >= 60.0:  # 한 달 누계 60시간(주 15시간 이상) 기준
        weekly_holiday_allowance = int((total_hours / 40.0) * 8.0 * hourly_wage)

    net_payroll = int((base_wage + weekly_holiday_allowance) * 0.967)  # 3.3% 사업소득세 원천징수 적용

    return {
        "staff_id": staff_id,
        "name": staff['name'],
        "month": month or "All",
        "hourly_wage": hourly_wage,
        "total_hours": round(total_hours, 1),
        "total_minutes": total_minutes,
        "base_wage": base_wage,
        "weekly_holiday_allowance": weekly_holiday_allowance,
        "tax_deduction": int((base_wage + weekly_holiday_allowance) * 0.033),
        "net_payroll": net_payroll,
        "attendance_logs": logs
    }


@router.post("/api/attendance/pay/{staff_id}")
async def pay_staff_endpoint(staff_id: str):
    from ..database import get_db_conn
    conn = get_db_conn()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cur = conn.cursor()
        cur.execute("UPDATE table_attendance_logs SET paid = TRUE WHERE staff_id = %s", (staff_id,))
        conn.commit()
        cur.close()
        conn.close()
        # Broadcast refresh
        await manager.broadcast_to_kitchen({"type": "POOL_UPDATED", "bundle_id": f"EMP-{staff_id}"})
        return {"status": "success", "message": f"Successfully paid all logs for staff {staff_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
