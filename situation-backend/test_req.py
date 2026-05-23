import urllib.request
import json
try:
    req = urllib.request.Request('http://127.0.0.1:8000/api/reservation/request', data=json.dumps({"store_id":"chicvill/situation","customer_name":"\uc190\ub2d8","phone_number":"01012345678","party_size":2,"reserved_time":"2026-05-24T12:00","table_id":"T01"}).encode('utf-8'), headers={'Content-Type': 'application/json'})
    resp = urllib.request.urlopen(req)
    print(resp.read())
except urllib.error.HTTPError as e:
    print('HTTPError:', e.code, e.read())
except Exception as e:
    print('Error:', e)
