# db package — re-exports all public symbols for convenience
from .connection import (
    SafeConnectionWrapper,
    SafeCursorWrapper,
    get_db_conn,
    init_db_v2,
)
from .situation_db import (
    save_situation,
    get_situation_history,
)
from .session_db import (
    # session CRUD
    save_session,
    get_session,
    get_session_by_id,
    get_active_session,
    get_all_active_sessions,
    update_session_status,
    update_session_device_id,
    close_session_and_archive,
    # orders
    append_order,
    save_order,
    get_orders_by_session,
    update_order_items,
    update_order_status,
    update_order_payment_status,
    update_order_payment_key,
    get_order_by_id,
    get_max_order_seq,
    get_kitchen_orders,
    get_all_active_orders_as_bundles,
    # calls
    append_call,
    save_call,
    get_active_calls,
    update_call_status,
    update_call_in_session,
    # parking
    set_parking,
    save_parking,
    complete_parking,
    get_parking_by_session,
    get_active_parkings_db,
    update_parking_status,
    # point
    set_point,
    get_point,
    # splits
    append_split,
    update_split_status,
    get_splits,
)
from .staff_db import (
    save_staff,
    get_staff,
    get_active_staff_list,
    update_staff_status,
    save_schedule,
    get_staff_schedules,
    get_all_staff_as_bundles,
)
from .attendance_db import (
    save_attendance_checkin,
    get_today_checkin,
    save_attendance_checkout,
    get_today_checkout,
    get_active_attendance_log,
    get_staff_attendance_logs,
    get_all_attendance_as_bundles,
)
from .operations_db import (
    save_waiting,
    get_active_waitings,
    update_waiting_status,
    save_reservation,
    get_active_reservations,
    update_reservation_status,
)
from .points_db import (
    get_customer_points,
    update_customer_points,
    get_points_list_db,
)
from .store_db import (
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
    "get_session",
    "get_session_by_id",
    "get_active_session",
    "get_all_active_sessions",
    "update_session_status",
    "update_session_device_id",
    "close_session_and_archive",
    # orders
    "append_order",
    "save_order",
    "get_orders_by_session",
    "update_order_items",
    "update_order_status",
    "update_order_payment_status",
    "update_order_payment_key",
    "get_order_by_id",
    "get_max_order_seq",
    "get_kitchen_orders",
    "get_all_active_orders_as_bundles",
    # calls
    "append_call",
    "save_call",
    "get_active_calls",
    "update_call_status",
    "update_call_in_session",
    # parking
    "set_parking",
    "save_parking",
    "complete_parking",
    "get_parking_by_session",
    "get_active_parkings_db",
    "update_parking_status",
    # point
    "set_point",
    "get_point",
    # splits
    "append_split",
    "update_split_status",
    "get_splits",
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
    # operations (waiting / reservation only)
    "save_waiting",
    "get_active_waitings",
    "update_waiting_status",
    "save_reservation",
    "get_active_reservations",
    "update_reservation_status",
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
