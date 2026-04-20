from flask import Flask, render_template, request, jsonify
import json
import os

app = Flask(__name__)

# [파일 경로]
SCHEMA_DB = 'schema_db.json'
INSTANCE_DB = 'instances_db.json'

# AI 지식 본체 (프론트엔드 전달용)
AI_KNOWLEDGE = {
    "Cafe Management": [
        {"type": "Menu", "fields": "name, price, stock_status", "funcs": "prepare(), serve()"},
        {"type": "Staff", "fields": "name, role, shift_time", "funcs": "clock_in(), handle_order()"},
        {"type": "Payment", "fields": "order_id, amount, status", "funcs": "auth_transaction()"}
    ],
    "Smart Farm": [
        {"type": "Sensor", "fields": "uid, sensor_type, value", "funcs": "calibrate(), capture()"},
        {"type": "Drone", "fields": "uid, battery, status", "funcs": "take_off(), spray()"},
        {"type": "Crop", "fields": "variety, health_score", "funcs": "growth_check()"}
    ],
    "Home Automation": [
        {"type": "Device", "fields": "did, name, room", "funcs": "toggle(), report()"},
        {"type": "Security", "fields": "cam_id, status", "funcs": "record(), detect()"}
    ]
}

@app.route('/')
def index():
    # 이제 외부에 분리된 templates/index.html을 사용합니다.
    return render_template('index.html', ai_knowledge=AI_KNOWLEDGE)

@app.route('/api/save_schema', methods=['POST'])
def save_schema():
    new_s = request.json
    data = []
    if os.path.exists(SCHEMA_DB):
        with open(SCHEMA_DB, 'r', encoding='utf-8') as f:
            data = json.load(f)
    # 이름 중복 제거 logic
    data = [i for i in data if i['type'] != new_s['type']]
    data.append(new_s)
    with open(SCHEMA_DB, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    return jsonify({"status": "success"})

@app.route('/api/delete_schema', methods=['POST'])
def delete_schema():
    t = request.json
    if os.path.exists(SCHEMA_DB):
        with open(SCHEMA_DB, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data = [i for i in data if i['type'] != t['type']]
        with open(SCHEMA_DB, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    return jsonify({"status": "success"})

@app.route('/api/get_schemas')
def get_schemas():
    if not os.path.exists(SCHEMA_DB):
        return jsonify([])
    with open(SCHEMA_DB, 'r', encoding='utf-8') as f:
        return jsonify(json.load(f))

if __name__ == '__main__':
    # 템플릿 변경사항 즉시 반영을 위한 debug 모드 유지
    app.run(host='127.0.0.1', port=5500, debug=True)
