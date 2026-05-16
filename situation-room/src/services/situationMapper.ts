import type { BundleData } from '../types';

/**
 * 전용 테이블 번호 정의
 */
export const SYSTEM_TABLES = {
    CALL: 'T101',      // 일반 호출
    PARKING: 'T102',   // 주차
    WAITING: 'T103',   // 대기
    POINT: 'T104',     // 포인트
    JOIN: 'T105',      // 합류 요청 (시스템 알림용)
} as const;

/**
 * MQTT 메시지를 분석하여 하나 이상의 BundleData로 변환합니다.
 * @param data MQTT 수신 데이터
 * @returns 변환된 BundleData 배열
 */
export const mapMqttToBundles = (data: any): BundleData[] => {
    const timestamp = new Date().toLocaleTimeString();
    const bundles: BundleData[] = [];

    // 1. 직원 호출 (STAFF_CALL)
    if (data.type === 'STAFF_CALL') {
        const num = parseInt((data.table_id || '').replace('T', ''));
        const cap = !isNaN(num) ? ((num <= 4) ? 4 : (num <= 8) ? 2 : (num <= 10) ? 6 : 4) : null;
        const displayTable = cap ? `${data.table_id}[${cap}]` : (data.table_id || '테이블');

        bundles.push({
            id: String(data.call_id || `CALL-${Date.now()}`),
            type: 'Log',
            title: `🛎️ 직원 호출: ${displayTable}`,
            items: [
                { name: '호출 유형', value: String(data.call_type || '직원호출') },
                { name: '테이블', value: String(data.table_id || '') }
            ],
            timestamp,
            status: 'pending',
            table_id: data.table_id || SYSTEM_TABLES.CALL, // 물리 테이블 번호 우선, 없으면 T101
            store_id: data.store_id ? String(data.store_id) : undefined
        });
    }

    // 2. 대기 접수 (WAITING_REGISTERED)
    if (data.type === 'WAITING_REGISTERED') {
        bundles.push({
            id: String(data.waiting_id || `WAIT-${Date.now()}`),
            type: 'Orders',
            title: `[대기 접수] ${data.phone_number}`,
            table_id: SYSTEM_TABLES.WAITING, // T103 적용
            session_id: `SESS-WAIT-103`,
            items: [
                { name: '연락처', value: String(data.phone_number || '') },
                { name: '인원', value: String(data.party_size || '1') + '명' }
            ],
            timestamp,
            status: 'pending',
            store_id: data.store_id ? String(data.store_id) : undefined
        });
    }

    // 3. 주차 할인 (PARKING_APPLIED)
    if (data.type === 'PARKING_APPLIED') {
        bundles.push({
            id: String(data.parking_id || `PARK-${Date.now()}`),
            type: 'Orders',
            title: `[주차 할인] ${data.vehicle_number}`,
            table_id: SYSTEM_TABLES.PARKING, // T102 적용
            session_id: `SESS-PARK-102`,
            items: [
                { name: '차량 번호', value: String(data.vehicle_number || '') },
                { name: '할인 시간', value: String(data.discount_minutes || '120') + '분' },
                { name: '원테이블', value: String(data.table_id || 'Self') }
            ],
            timestamp,
            status: 'pending',
            store_id: data.store_id ? String(data.store_id) : undefined
        });
    }

    // 4. 합류 요청 (JOIN_*)
    if (['JOIN_REQUEST', 'JOIN_CHECKIN', 'CHECKIN_REQUEST', 'JOIN_SESSION'].includes(data.type)) {
        let tid = String(data.table_id || "").toUpperCase();
        if (tid) {
            if (!tid.startsWith('T')) tid = `T${tid.padStart(2, '0')}`;
            else if (tid.length === 2) tid = `T${tid.substring(1).padStart(2, '0')}`;
        }

        // 체크인 정보 묶음
        bundles.push({
            id: `SESS-${data.session_id}-${Date.now()}`,
            type: 'Checkins',
            title: `👥 [합류 요청] 테이블 ${tid || '미지정'}`,
            table_id: tid || SYSTEM_TABLES.JOIN,
            session_id: data.session_id,
            timestamp,
            items: [
                { name: '요청 기기', value: String(data.device_id || '') },
                { name: '테이블 번호', value: String(tid || '') }
            ],
            status: 'pending'
        });

        // 호출 아이콘 깜빡임을 위한 '호출(Log)' 데이터 추가 (T101 분류)
        bundles.push({
            id: `CALL-JOIN-${data.session_id}-${Date.now()}`,
            type: 'Log',
            title: `🛎️ [합류요청] ${tid || '알 수 없는'} 테이블`,
            table_id: tid || SYSTEM_TABLES.JOIN,
            session_id: data.session_id,
            timestamp,
            status: 'pending',
            items: [
                { name: '메시지', value: `${tid || '??'}번 테이블 합류 요청` }
            ]
        });
    }

    // 5. 포인트 적립 (추후 확장용 미리 정의)
    if (data.type === 'POINT_EVENT') {
        bundles.push({
            id: `POINT-${Date.now()}`,
            type: 'Log',
            title: `💰 포인트 발생: ${data.customer_name || '고객'}`,
            table_id: SYSTEM_TABLES.POINT, // T104 적용
            items: [
                { name: '포인트', value: `${data.amount || 0}P` },
                { name: '구분', value: data.event_type || '적립' }
            ],
            timestamp,
            status: 'pending'
        });
    }

    return bundles;
};
