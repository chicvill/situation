# database.py — compatibility shim
# All logic has been moved to the db/ package (domain-driven modules).
# This file re-exports every public symbol so that existing imports in
# main.py and other callers continue to work without modification.

from .db.connection import (
    SafeConnectionWrapper,
    SafeCursorWrapper,
    get_db_conn,
    init_db_v2,
)
from .db.situation_db import (
    save_situation,
    get_situation_history,
)
from .db.session_db import (
    save_session,
    get_active_session,
    get_session_by_id,
    update_session_status,
    update_session_device_id,
    get_all_active_sessions,
)
from .db.order_db import (
    save_order,
    get_orders_by_session,
    update_order_items,
    update_order_status,
    update_order_payment_status,
    get_max_order_seq,
    get_kitchen_orders,
    get_all_active_orders_as_bundles,
)
from .db.staff_db import (
    save_staff,
    get_staff,
    get_active_staff_list,
    update_staff_status,
    save_schedule,
    get_staff_schedules,
    get_all_staff_as_bundles,
)
from .db.attendance_db import (
    save_attendance_checkin,
    get_today_checkin,
    save_attendance_checkout,
    get_today_checkout,
    get_active_attendance_log,
    get_staff_attendance_logs,
    get_all_attendance_as_bundles,
)
from .db.operations_db import (
    save_waiting,
    get_active_waitings,
    update_waiting_status,
    save_call,
    get_active_calls,
    update_call_status,
    save_reservation,
    get_active_reservations,
    update_reservation_status,
    save_parking,
    complete_parking,
    get_parking_by_session,
    get_active_parkings_db,
)
from .db.points_db import (
    get_customer_points,
    update_customer_points,
    get_points_list_db,
)
from .db.store_db import (
    get_stores_db,
    add_store_db,
    update_store_db,
    delete_store_db,
)

__all__ = [
    # connection
    "SafeConnectionWrapper",
    "SafeCursorWrapper",
    "get_db_conn",
    "init_db_v2",
    # situation
    "save_situation",
    "get_situation_history",
    # session
    "save_session",
    "get_active_session",
    "get_session_by_id",
    "update_session_status",
    "get_all_active_sessions",
    # order
    "save_order",
    "get_orders_by_session",
    "update_order_items",
    "update_order_status",
    "update_order_payment_status",
    "get_max_order_seq",
    "get_kitchen_orders",
    "get_all_active_orders_as_bundles",
    # staff
    "save_staff",
    "get_staff",
    "get_active_staff_list",
    "update_staff_status",
    "save_schedule",
    "get_staff_schedules",
    "get_all_staff_as_bundles",
    # attendance
    "save_attendance_checkin",
    "get_today_checkin",
    "save_attendance_checkout",
    "get_today_checkout",
    "get_active_attendance_log",
    "get_staff_attendance_logs",
    "get_all_attendance_as_bundles",
    # operations
    "save_waiting",
    "get_active_waitings",
    "update_waiting_status",
    "save_call",
    "get_active_calls",
    "update_call_status",
    "save_reservation",
    "get_active_reservations",
    "update_reservation_status",
    "save_parking",
    "complete_parking",
    "get_parking_by_session",
    "get_active_parkings_db",
    # points
    "get_customer_points",
    "update_customer_points",
    "get_points_list_db",
    # store
    "get_stores_db",
    "add_store_db",
    "update_store_db",
    "delete_store_db",
]
