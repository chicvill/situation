/**
 * 공통 알림 모듈 — 호출/주차/대기/포인트/더치페이 등 모든 실시간 이벤트에 사용
 *
 * VIRTUAL_TABLE  : 테이블 미지정 시 사용할 임시 번호 상수
 * sendNotify     : 이벤트 전송 (POST /api/notify)
 * subscribeToStore : 이벤트 수신 (MQTT, store_id 필터 포함)
 */

import { subscribeTopic } from './mqttClient';
import { API_BASE } from '../config';

/**
 * 테이블 번호가 없는 이벤트에 할당하는 임시(가상) 테이블 번호.
 * MERGE(더치페이)는 QR에 테이블 번호가 이미 포함되므로 여기에 없음.
 */
export const VIRTUAL_TABLE = {
    STAFF_CALL: 'T101',         // 직원 호출 (입구 등 테이블 미지정)
    PARKING:    'T102',         // 주차 할인 신청
    WAITING:    'T103',         // 대기 등록 (착석 전)
    POINT:      'T104',         // 포인트 적립
    JOIN:       'T105',         // 합류 요청 (table_id 없을 때 안전망)
} as const;

/** CallManager 에서 가상 테이블을 사람이 읽기 좋은 이름으로 표시 */
export const VIRTUAL_TABLE_LABEL: Record<string, string> = {
    T101: '직원호출 (입구)',
    T102: '주차 할인',
    T103: '대기 등록',
    T104: '포인트 적립',
    T105: '합류 요청',
};

export interface NotifyEvent {
    type: string;
    store_id?: string;
    table_id?: string;
    [key: string]: any;
}

/**
 * 스토어 이벤트 구독.
 * situation/kitchen + store/{storeId}/kitchen 를 동시에 구독하며
 * store_id 불일치 메시지를 한 곳에서 필터링한다.
 */
export function subscribeToStore(
    storeId: string,
    onEvent: (event: NotifyEvent) => void
): () => void {
    const handle = (data: NotifyEvent) => {
        const blocked =
            !!(storeId && storeId !== 'Total' &&
            data.store_id &&
            data.store_id !== storeId &&
            data.store_id !== 'Total');

        console.log(
            `[CP-F1] MQTT 수신 type=${data.type}` +
            ` | 메시지 store_id=${data.store_id ?? '(없음)'}` +
            ` | 구독자 storeId=${storeId || '(없음)'}` +
            ` | ${blocked ? '❌ 차단' : '✅ 통과'}`
        );

        if (blocked) return;
        onEvent(data);
    };

    const storeTopic = storeId && storeId !== 'Total'
        ? `store/${storeId}/kitchen`
        : 'store/+/kitchen';

    const unsub1 = subscribeTopic('situation/kitchen', handle);
    const unsub2 = subscribeTopic(storeTopic, handle);
    return () => { unsub1(); unsub2(); };
}

/**
 * 알림 전송 — POST /api/notify
 * table_id 가 없으면 이벤트 타입에 맞는 가상 테이블 번호를 자동 할당한다.
 */
export async function sendNotify(
    type: string,
    payload: Omit<NotifyEvent, 'type'>
): Promise<void> {
    // MERGE(더치페이)는 QR에서 테이블 번호가 오므로 fallback 없음
    const fallback =
        type === 'STAFF_CALL'         ? VIRTUAL_TABLE.STAFF_CALL :
        type === 'PARKING_APPLIED'    ? VIRTUAL_TABLE.PARKING :
        type === 'WAITING_REGISTERED' ? VIRTUAL_TABLE.WAITING :
        type === 'POINT_EVENT'        ? VIRTUAL_TABLE.POINT :
        type === 'JOIN_REQUEST'       ? VIRTUAL_TABLE.JOIN : '';

    const body: NotifyEvent = {
        type,
        ...payload,
        ...(fallback && !payload.table_id ? { table_id: fallback } : {}),
    };

    try {
        await fetch(`${API_BASE}/api/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    } catch (e) {
        console.error(`[notify] 전송 실패: type=${type}`, e);
    }
}
