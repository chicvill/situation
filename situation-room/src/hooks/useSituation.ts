import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message, BundleData } from '../types';
import { API_BASE } from '../config';
import { subscribeTopic } from '../services/mqttClient';
import { mapMqttToBundles } from '../services/situationMapper';
import { playDingDong } from '../utils/audio';

export const useSituation = (storeId: string = "", storeName: string = "") => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [bundles, setBundles] = useState<BundleData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const storeIdRef = useRef(storeId);
    useEffect(() => { storeIdRef.current = storeId; }, [storeId]);

    const fetchInitialData = useCallback(async () => {
        try {
            const queryParams = new URLSearchParams();
            if (storeId && storeId !== "Total") queryParams.append('store_id', storeId);

            const url = queryParams.toString() ? `${API_BASE}/api/pool?${queryParams.toString()}` : `${API_BASE}/api/pool`;
            const response = await fetch(url);
            const data = await response.json();
            if (Array.isArray(data)) {
                setBundles(data);
            } else {
                console.error("Pool data is not an array:", data);
                setBundles([]);
            }
        } catch (err) {
            console.error("Initial fetch failed:", err);
            setBundles([]);
        }
    }, [storeId]);

    // Initial Data Fetch
    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    // MQTT store/{store_id} 구독으로 타겟팅 업데이트
    useEffect(() => {
        const currentStoreId = storeIdRef.current;
        // Total이거나 빈 값이면(어드민) 모든 매장(store/+) 구독, 아니면 특정 매장만 구독
        const topic = (currentStoreId && currentStoreId !== "Total")
            ? `store/${currentStoreId}`
            : `store/+`;

        // playDingDong: utils/audio.ts 상단 import에서 가져옴

        // 딩동을 울려야 하는 이벤트 (고객/외부 발생, useStoreSync가 처리하지 않는 것만)
        const DING_EVENTS = [
            'NEW_ORDER', 'ORDER_PLACED', 'NEW_ORDER_DIRECT', 'ORDER_UPDATED',
            'STATUS_UPDATE', 'STATUS_UPDATED', 'KITCHEN_DONE',
            'SEAT_REQUEST', 'SESSION_OPENED', 'SESSION_CLOSED',
            'JOIN_REQUEST', 'STAFF_CALL', 'PARKING_APPLIED',
            // 'WAITING_REGISTERED' → useStoreSync가 담당 (중복 방지)
            // 'WAITING_UPDATED'    → 매니저 호출 액션, 카운터 딩동 불필요
            'PAYMENT_CONFIRMED', 'PARTIAL_SETTLEMENT',
        ];
        // 화면 데이터 갱신이 필요한 이벤트 (딩동 여부와 무관)
        const REFRESH_EVENTS = [...DING_EVENTS, 'WAITING_REGISTERED', 'WAITING_UPDATED', 'POOL_UPDATED', 'STAFF_ATTENDANCE_UPDATE'];

        const messageHandler = (data: any) => {
            console.log(`[CHECKPOINT - 수신] MQTT 메시지 도착 (type: ${data.type}):`, data);
            if (DING_EVENTS.includes(data.type)) {
                playDingDong();
            }
            if (REFRESH_EVENTS.includes(data.type)) {
                fetchInitialData();
            }
            
            const bundleTypes = ['Orders', 'Log', 'Menus', 'StoreConfig', 'PersonalInfos', 'Settlement', 'Employee', 'Attendance', 'Waiting', 'Checkins', 'Reservations', 'Analysis'];
            
            if (data.id && typeof data.type === 'string' && bundleTypes.includes(data.type)) {
                console.log(`[CHECKPOINT - 매칭] 기존 bundleTypes로 처리됨: ${data.type}`);
                // 브로커에서 이미 필터링되어 오므로 클라이언트 사이드 거름망 로직 생략
                setBundles(prev => {
                    const currentPrev = Array.isArray(prev) ? prev : [];
                    const index = currentPrev.findIndex(b => b.id === data.id);
                    if (index !== -1) {
                        const newBundles = [...currentPrev];
                        newBundles[index] = data as BundleData;
                        return newBundles;
                    }
                    return [data as BundleData, ...currentPrev];
                });
                return;
            }

            if (data.type === 'STATUS_UPDATED') {
                console.log(`[CHECKPOINT - 매칭] STATUS_UPDATED 처리됨`);
                setBundles(prev => {
                    const currentPrev = Array.isArray(prev) ? prev : [];
                    return currentPrev.map(b =>
                        (Array.isArray(data.ids) && data.ids.includes(b.id)) ? { ...b, status: data.status } : b
                    );
                });
                return;
            }

            if (data.type === 'STATUS_UPDATE') {
                console.log(`[CHECKPOINT - 매칭] STATUS_UPDATE 처리됨`);
                setBundles(prev => {
                    const currentPrev = Array.isArray(prev) ? prev : [];
                    return currentPrev.map(b =>
                        b.id === data.order_id ? { ...b, status: data.status } : b
                    );
                });
                return;
            }

            if (data.type === 'KITCHEN_DONE') {
                console.log(`[CHECKPOINT - 매칭] KITCHEN_DONE 처리됨`);
                setBundles(prev => {
                    const currentPrev = Array.isArray(prev) ? prev : [];
                    return currentPrev.map(b => b.id === data.bundleId ? { ...b, status: 'ready' } : b);
                });
                return;
            }

            // 1. 공통 매퍼(SituationMapper)를 통한 신규 이벤트 생성 (T101, T102, T103 등)
            const mappedBundles = mapMqttToBundles(data);
            if (mappedBundles.length > 0) {
                console.log(`[CHECKPOINT - 매칭] SituationMapper에서 ${mappedBundles.length}개의 번들 생성됨`);
                setBundles(prev => [...mappedBundles, ...(Array.isArray(prev) ? prev : [])]);
                return;
            }

            // 2. 기존 항목 업데이트 로직 (대기 상태 변경 등)
            if (data.type === 'WAITING_UPDATED') {
                console.log(`[CHECKPOINT - 매칭] WAITING_UPDATED 처리됨`);
                setBundles(prev => {
                    const currentPrev = Array.isArray(prev) ? prev : [];
                    return currentPrev.map(b => b.id === data.waiting_id ? { ...b, status: data.status } : b);
                });
                return;
            }

            // 그 외 알 수 없는 포맷의 데이터는 부분 병합 시도
            if (data.id && typeof data.type === 'string' && !['STATUS_UPDATED', 'STATUS_UPDATE', 'KITCHEN_DONE'].includes(data.type)) {
                console.log(`[CHECKPOINT - 매칭] 알 수 없는 타입 부분 병합 시도: ${data.type}`);
                setBundles(prev => {
                    const currentPrev = Array.isArray(prev) ? prev : [];
                    const index = currentPrev.findIndex(b => b.id === data.id);
                    if (index !== -1) {
                        const newBundles = [...currentPrev];
                        newBundles[index] = { ...newBundles[index], ...data };
                        return newBundles;
                    }
                    return [data as BundleData, ...currentPrev];
                });
                return;
            }

            console.warn(`[CHECKPOINT - 🚨 누락 경고 🚨] 어떤 조건에도 맞지 않아 화면에 반영되지 않은 메시지!`, data);
        };

        const handleMessage = (data: any) => {
            if (data.store_id && storeId && storeId !== 'Total' && data.store_id !== storeId) return;
            messageHandler(data);
        };

        // store/+ (Total 모드): 와일드카드가 store/broadcast 포함 → 단일 구독
        // store/{id} (특정 매장): store/broadcast 별도 추가 구독
        const unsubscribe1 = subscribeTopic(topic, handleMessage);
        const unsubscribe2 = topic !== 'store/+'
            ? subscribeTopic('store/broadcast', handleMessage)
            : null;

        return () => {
            unsubscribe1();
            unsubscribe2?.();
        };
    }, [storeId, fetchInitialData]); // 필수 의존성 통합

    // API Situation Handler
    const handleSendMessage = useCallback(async (text: string, targetId?: string, context?: string, overrideStoreId?: string, overrideStoreName?: string) => {
        if (!targetId) {
            setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user', timestamp: new Date().toLocaleTimeString() }]);
        }

        const loadingMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: loadingMsgId, text: "지식 풀 분석 중... 🧠", sender: 'ai', timestamp: new Date().toLocaleTimeString() }]);
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE}/api/situation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text, 
                    targetId, 
                    context, 
                    store_id: overrideStoreId || storeId,
                    store: overrideStoreName || storeName 
                }),
            });
            const result = await response.json();

            if (result.type === 'Analysis') {
                setMessages(prev => prev.map(msg => msg.id === loadingMsgId ? { ...msg, text: result.answer } : msg));
            } else if (result.type === 'SelectionRequired') {
                setMessages(prev => prev.map(msg => msg.id === loadingMsgId ? { 
                    ...msg, 
                    text: "중복 확인 필요", 
                    selection: result // Pass full result to UI for rendering
                } : msg));
            } else {
                setMessages(prev => prev.map(msg => msg.id === loadingMsgId ? { 
                    ...msg, 
                    text: targetId ? `업데이트 완료!` : `지식 풀 저장됨!`,
                    selection: null 
                } : msg));
            }
        } catch (error) {
            setMessages(prev => prev.map(msg => msg.id === loadingMsgId ? { ...msg, text: "서버 오류 😢" } : msg));
        } finally {
            setIsLoading(false);
        }
    }, [storeId, storeName]); // storeId, storeName 의존성 추가

    return {
        messages,
        bundles,
        isLoading,
        handleSendMessage,
        setMessages,
        setBundles
    };
};
