import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message, BundleData } from '../types';
import { API_BASE } from '../config';
import { subscribeTopic } from '../services/mqttClient';

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

    // MQTT store/{store_id}/kitchen 구독으로 타겟팅 업데이트
    useEffect(() => {
        const currentStoreId = storeIdRef.current;
        // Total이거나 빈 값이면(어드민) 모든 매장(store/+/kitchen) 구독, 아니면 특정 매장만 구독
        const topic = (currentStoreId && currentStoreId !== "Total") 
            ? `store/${currentStoreId}/kitchen` 
            : `store/+/kitchen`;

        const messageHandler = (data: any) => {
            console.log(`[CHECKPOINT - 수신] MQTT 메시지 도착 (type: ${data.type}):`, data);
            
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

            // 직원 호출(STAFF_CALL) 등 특수 이벤트도 API 폴링 없이 로컬에서 BundleData로 즉시 변환하여 반영
            if (data.type === 'STAFF_CALL') {
                console.log(`[CHECKPOINT - 매칭] STAFF_CALL 처리됨`);
                const num = parseInt((data.table_id || '').replace('T', ''));
                const cap = !isNaN(num) ? ((num <= 4) ? 4 : (num <= 8) ? 2 : (num <= 10) ? 6 : 4) : null;
                const displayTable = cap ? `${data.table_id}[${cap}]` : (data.table_id || '테이블');

                const newCall: BundleData = {
                    id: String(data.call_id || Date.now()),
                    type: 'Log',
                    title: `🛎️ 직원 호출: ${displayTable}`,
                    items: [
                        { name: '호출 유형', value: String(data.call_type || '직원호출') },
                        { name: '테이블', value: String(data.table_id || '') }
                    ],
                    timestamp: new Date().toLocaleTimeString(),
                    status: 'pending',
                    store_id: data.store_id ? String(data.store_id) : undefined
                };
                setBundles(prev => {
                    const currentPrev = Array.isArray(prev) ? prev : [];
                    return [newCall, ...currentPrev];
                });
                return;
            }

            if (data.type === 'WAITING_REGISTERED') {
                console.log(`[CHECKPOINT - 매칭] WAITING_REGISTERED 처리됨 (Table 99)`);
                const newWaiting: BundleData = {
                    id: String(data.waiting_id || Date.now()),
                    type: 'Orders', // Orders 타입으로 설정하여 주방/카운터 목록에 노출
                    title: `[대기 접수] ${data.phone_number}`,
                    table_id: 'T99', // 대기는 99번 테이블로 고정
                    session_id: `SESS-WAIT-99`,
                    items: [
                        { name: '연락처', value: String(data.phone_number || '') },
                        { name: '인원', value: String(data.party_size || '1') + '명' }
                    ],
                    timestamp: new Date().toLocaleTimeString(),
                    status: 'pending', // 깜빡임 유도를 위해 pending 상태 사용
                    store_id: data.store_id ? String(data.store_id) : undefined
                };
                setBundles(prev => [newWaiting, ...(Array.isArray(prev) ? prev : [])]);
                return;
            }

            if (data.type === 'WAITING_UPDATED') {
                console.log(`[CHECKPOINT - 매칭] WAITING_UPDATED 처리됨`);
                setBundles(prev => {
                    const currentPrev = Array.isArray(prev) ? prev : [];
                    return currentPrev.map(b => b.id === data.waiting_id ? { ...b, status: data.status } : b);
                });
                return;
            }

            if (data.type === 'PARKING_APPLIED') {
                console.log(`[CHECKPOINT - 매칭] PARKING_APPLIED 처리됨 (Table 98)`);
                const newParking: BundleData = {
                    id: String(data.parking_id || Date.now()),
                    type: 'Orders', // 카운터/주방 모니터에서 즉시 눈에 띄게 Orders 타입 사용
                    title: `[주차 할인] ${data.vehicle_number}`,
                    table_id: 'T98', // 주차는 98번 테이블로 고정
                    session_id: `SESS-PARK-98`,
                    items: [
                        { name: '차량 번호', value: String(data.vehicle_number || '') },
                        { name: '할인 시간', value: String(data.discount_minutes || '120') + '분' },
                        { name: '원테이블', value: String(data.table_id || 'Self') }
                    ],
                    timestamp: new Date().toLocaleTimeString(),
                    status: 'pending', // 깜빡임 유도를 위해 pending 상태 사용
                    store_id: data.store_id ? String(data.store_id) : undefined
                };
                setBundles(prev => [newParking, ...(Array.isArray(prev) ? prev : [])]);
                return;
            }

            if (data.type === 'JOIN_REQUEST') {
                console.log(`[CHECKPOINT - 매칭] JOIN_REQUEST 처리됨`);
                const newJoin: BundleData = {
                    id: `SESS-${data.session_id}-${Date.now()}`,
                    type: 'Orders', // Orders 타입으로 설정하여 주방/카운터 목록에 노출
                    title: `합류 승인 대기 (${data.table_id})`,
                    table_id: data.table_id,
                    session_id: data.session_id,
                    timestamp: new Date().toLocaleTimeString(),
                    items: [
                        { name: '요청 기기', value: String(data.device_id || '') },
                        { name: '테이블 번호', value: String(data.table_id || '') }
                    ],
                    status: 'pending'
                };
                setBundles(prev => [newJoin, ...(Array.isArray(prev) ? prev : [])]);
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

        const unsubscribe1 = subscribeTopic(topic, messageHandler);
        let unsubscribe2 = () => {};
        
        // 특정 매장 구독인 경우, store_id가 누락된 공통 브로드캐스트 메시지도 놓치지 않도록 추가 구독
        if (topic !== 'store/+/kitchen') {
            unsubscribe2 = subscribeTopic('store/broadcast/kitchen', messageHandler);
        }

        return () => {
            unsubscribe1();
            unsubscribe2();
        };
    }, []);

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
    }, []);

    return {
        messages,
        bundles,
        isLoading,
        handleSendMessage,
        setMessages,
        setBundles
    };
};
