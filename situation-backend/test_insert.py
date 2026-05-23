import sys
sys.path.append('.')
from session.db.operations_db import save_reservation
res_data = {'reservation_id': 'TEST-1234', 'store_id': 'chicvill', 'customer_name': 'test', 'phone_number': '01011112222', 'party_size': 2, 'reserved_time': '2026-05-24T12:00', 'table_id': 'T01'}
print('Result:', save_reservation(res_data))
