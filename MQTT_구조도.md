# SITUATION SYSTEM — MQTT 중심 구조도

> 작성일: 2026-05-23
> 버전: Mosquitto 로컬 브로커 기준 (TCP :1883 / WebSocket :9001)

---

## 설계 원칙

| 원칙 | 구현 방식 |
|------|-----------|
| **단일 채널** | 모든 이벤트가 `store/{store_id}` 하나로 집결 |
| **자율 필터링** | 각 모듈이 자신에게 필요한 type만 처리 (switch/includes) |
| **자동 모니터링** | `broadcast_to_kitchen()` 호출 시 `_monitor()`가 자동으로 JSON 갱신 |
| **폴링 안전망** | MQTT 실패 대비 3~5초 HTTP 폴링 병행 |
| **고객↔매니저 분리** | 브로드캐스트 토픽(store/…) + 테이블 직통 토픽(store/…/table/…) |

---

## MQTT 토픽 구조

| 토픽 | 용도 | 발행자 | 구독자 |
|------|------|--------|--------|
| `store/{store_id}` | 매장 내 모든 이벤트 (주 토픽) | Backend | CounterPad, KitchenDisplay, WaitingManager, useSituation, useStoreSync |
| `store/broadcast` | store_id 미확정 이벤트 | Backend | 위와 동일 (특정 매장 모드일 때 추가 구독) |
| `store/+` | Total 모드 — store/broadcast 포함 | — | Total 모드 구독자 전체 |
| `store/{sid}/table/{tid}` | 테이블별 개별 메시지 (신규) | Backend | CustomerOrder, MobileOrderV2, Orders(v2), QROrderFlow |
| `situation/table/{tid}` | 레거시 폴백 (store_id 없을 때) | Backend | 위와 동일 (신규 토픽과 병행 구독) |
| `store/+/call` | 모바일 → 백엔드 호출 수신 | Mobile | Backend 전용 구독 |

---

## 전체 구조도

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         MQTT BROKER (Mosquitto)                                 │
│                                                                                 │
│   TCP :1883  ←── Backend (aiomqtt)          WebSocket :9001  ←── Frontend      │
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │  store/{store_id}          ← 매장 내 모든 이벤트 (주 토픽)               │  │
│   │  store/broadcast           ← store_id 미확정 이벤트                     │  │
│   │  store/+                   ← Total 모드 (store/broadcast 포함)           │  │
│   │  store/{sid}/table/{tid}   ← 테이블별 개별 메시지 (신규)                 │  │
│   │  situation/table/{tid}     ← 레거시 폴백 (store_id 없을 때)             │  │
│   │  store/+/call              ← 모바일→백엔드 호출 (백엔드 전용 구독)       │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────────────┘
                                 │
          ┌──────────────────────┴──────────────────────┐
          │ PUBLISH                                     │ SUBSCRIBE
          ▼                                             ▼
┌─────────────────────┐                   ┌───────────────────────────────────────┐
│   BACKEND (FastAPI) │                   │         FRONTEND (React + Vite)        │
│                     │                   │                                        │
│  ┌───────────────┐  │                   │  ┌──────────────────────────────────┐  │
│  │  Routers      │  │                   │  │  [ 매니저 화면 ]                  │  │
│  │               │  │                   │  │                                  │  │
│  │ /api/order    │  │  store/{sid}      │  │  CounterPad                      │  │
│  │ /api/notify   │──┼──────────────────►│  │  └ store/{sid} + store/broadcast │  │
│  │ /api/waiting  │  │  store/broadcast  │  │    NEW_ORDER, STAFF_CALL,        │  │
│  │ /api/parking  │  │  store/{sid}/     │  │    WAITING_*, PARKING_APPLIED,   │  │
│  │ /api/session  │  │    table/{tid}    │  │    SESSION_*, PAYMENT_*          │  │
│  │ /api/kitchen  │  │  situation/       │  │                                  │  │
│  └──────┬────────┘  │    table/{tid}   │  │  KitchenDisplay                  │  │
│         │           │                   │  │  └ store/{sid} + store/broadcast │  │
│  ┌──────▼────────┐  │                   │  │    NEW_ORDER, STATUS_UPDATE,     │  │
│  │ConnectionMgr  │  │                   │  │    PAYMENT_CONFIRMED             │  │
│  │ (state.py)    │  │                   │  │                                  │  │
│  │               │  │                   │  │  useStoreSync (공통 훅)           │  │
│  │broadcast_to_  │  │                   │  │  └ store/{sid} (subscribeToStore)│  │
│  │  kitchen()    │  │                   │  │    STAFF_CALL → 호출탭 깜빡임    │  │
│  │send_to_table()│  │                   │  │    WAITING_REGISTERED → 대기탭   │  │
│  └──────┬────────┘  │                   │  │    PARKING_APPLIED → 주차탭      │  │
│         │           │                   │  │    딩동 + 카운트 배지 실시간     │  │
│  ┌──────▼────────┐  │                   │  │                                  │  │
│  │ mqtt_handler  │  │                   │  │  WaitingManager                  │  │
│  │  (aiomqtt)    │  │                   │  │  └ subscribeToStore()            │  │
│  │               │◄─┼── store/+/call    │  │    WAITING_REGISTERED,           │  │
│  │ store/+/call  │  │  (모바일 호출수신)│  │    WAITING_UPDATED               │  │
│  └──────┬────────┘  │                   │  │                                  │  │
│         │           │                   │  │  useSituation (SituationConsole) │  │
│  ┌──────▼────────┐  │                   │  │  └ store/{sid} 또는 store/+      │  │
│  │  PostgreSQL   │  │                   │  │    모든 이벤트 → knowledge pool  │  │
│  │  (psycopg2)   │  │                   └──┼──────────────────────────────────┘  │
│  │               │  │                   │  │                                      │
│  │  sessions     │  │                   │  │  ┌──────────────────────────────┐   │
│  │  orders       │  │                   │  │  │  [ 고객 화면 (모바일 QR) ]   │   │
│  │  calls        │  │                   │  │  │                              │   │
│  │  waitings     │  │                   │  │  │  CustomerOrder               │   │
│  │  parkings     │  │                   │  │  │  MobileOrderV2               │   │
│  │  points       │  │                   │  │  │  Orders (v2)                 │   │
│  │  reservations │  │                   │  │  │  QROrderFlow                 │   │
│  └───────────────┘  │                   │  │  │                              │   │
│                     │                   │  │  │  └ store/{sid}/table/{tid}   │   │
│  ┌───────────────┐  │                   │  │  │    + situation/table/{tid}   │   │
│  │ debug_writer  │  │                   │  │  │    SESSION_OPENED,           │   │
│  │               │  │                   │  │  │    JOIN_RESPONSE,            │   │
│  │ session.json  │◄─┤  _monitor()       │  │  │    SESSION_CLOSED,           │   │
│  │ state.json    │  │  (자동 기록)      │  │  │    STATUS_UPDATE             │   │
│  └───────────────┘  │                   │  │  └──────────────────────────────┘   │
└─────────────────────┘                   └───────────────────────────────────────┘
```

---

## 주요 이벤트 흐름

### ① 고객 주문
```
고객 모바일 → POST /api/order/direct
           → DB 저장 (orders 테이블)
           → broadcast_to_kitchen(NEW_ORDER)
           → MQTT store/{sid}
           → CounterPad / KitchenDisplay / session.json
```

### ② 직원 호출
```
고객 모바일 → POST /api/notify (type: STAFF_CALL)
           → DB 저장 (calls 테이블)
           → broadcast_to_kitchen(STAFF_CALL)
           → MQTT store/{sid}
           → CounterPad 호출탭 깜빡임 / useStoreSync 딩동 / state.json
```

### ③ 대기 등록
```
고객 모바일 → POST /api/waiting
           → DB 저장 (waitings 테이블)
           → broadcast_to_kitchen(WAITING_REGISTERED)
           → MQTT store/{sid}
           → WaitingManager / useStoreSync 딩동 / state.json
```

### ④ 대기자 입장 호출
```
매니저 → PATCH /api/waiting/status (called)
       → DB 업데이트
       → broadcast_to_kitchen(WAITING_UPDATED) → MQTT store/{sid} → WaitingManager
       → send_to_table(ENTRY_NOTICE, T103)
         → MQTT store/{sid}/table/T103
         → 고객 모바일 (딩동 + 입장 안내 문구)
```

### ⑤ 합석 승인
```
기존 고객 → POST /api/session/approve-join
          → DB 업데이트
          → send_to_table(JOIN_RESPONSE)
          → MQTT store/{sid}/table/{tid}
          → 합류 요청 고객 모바일 (승인/거절 화면 전환)
```

### ⑥ 조리 완료
```
주방 → POST /api/order/status (status: ready)
     → broadcast_to_kitchen(STATUS_UPDATE)
     → MQTT store/{sid}
     → CounterPad / KitchenDisplay (카드 제거) / session.json
```

### ⑦ 결제 완료
```
카운터 → POST /api/payment
       → DB 저장 (settlements 테이블)
       → broadcast_to_kitchen(PAYMENT_CONFIRMED)
       → MQTT store/{sid}
       → CounterPad / session.json
```

---

## 모니터링 파일 자동 갱신 트리거

### session.json — 세션·주문·결제 흐름
- `SEAT_REQUEST_ADDED` / `SEAT_REQUEST_REMOVED`
- `SESSION_OPENED` / `SESSION_CLOSED`
- `NEW_ORDER` / `ORDER_UPDATED` / `STATUS_UPDATE`
- `PAYMENT_CONFIRMED` / `PARTIAL_SETTLEMENT`
- `JOIN_REQUEST` / `JOIN_SESSION`

### state.json — 독립 데이터 (호출·대기·주차·포인트·예약)
- `STAFF_CALL` / `CALL_SAVED` / `CALL_STATUS_UPDATED`
- `WAITING_REGISTERED` / `WAITING_UPDATED` / `WAITING_STATUS_CHANGED`
- `PARKING_APPLIED`
- `RESERVATION_UPDATED`
- `POINTS_UPDATED`

> 두 파일 모두 `broadcast_to_kitchen()` → `_monitor()` → `debug_writer.record_event()` 경로로  
> 자동 갱신되며, 별도 호출 코드 없이 MQTT 발행과 동시에 기록된다.

---

## 파일별 MQTT 구독 현황

| 파일 | 구독 토픽 | 처리 이벤트 |
|------|-----------|------------|
| `CounterPad.tsx` | `store/{sid}`, `store/broadcast` | NEW_ORDER, STAFF_CALL, SESSION_*, PAYMENT_*, WAITING_*, PARKING_* |
| `KitchenDisplay.tsx` | `store/{sid}`, `store/broadcast` | NEW_ORDER, STATUS_UPDATE, PAYMENT_CONFIRMED, STAFF_CALL, PARKING_APPLIED, WAITING_REGISTERED |
| `WaitingManager.tsx` | `store/{sid}` (via subscribeToStore) | WAITING_REGISTERED, WAITING_UPDATED |
| `useStoreSync.ts` | `store/{sid}` (via subscribeToStore) | STAFF_CALL, WAITING_REGISTERED, PARKING_APPLIED, RESERVATION_UPDATED, POINTS_UPDATED, JOIN_* |
| `useSituation.ts` | `store/{sid}` 또는 `store/+` | 전체 이벤트 → knowledge pool 갱신 |
| `CustomerOrder.tsx` | `store/{sid}/table/{tid}`, `situation/table/{tid}` | SESSION_CLOSED, JOIN_REQUEST, JOIN_RESPONSE |
| `MobileOrderV2.tsx` | `store/{sid}/table/{tid}`, `situation/table/{tid}` | SESSION_OPENED/CLOSED, JOIN_RESPONSE |
| `Orders.tsx` (v2) | `store/{sid}/table/{tid}`, `situation/table/{tid}` | SESSION_*, STATUS_UPDATE, NEW_ORDER, PAYMENT_* |
| `QROrderFlow.tsx` | `store/{sid}/table/{tid}`, `situation/table/{tid}` | 전체 테이블 이벤트 |
| `mqtt_handler.py` | `store/+/call` | 모바일 호출 수신 → DB 저장 → 재발행 |
