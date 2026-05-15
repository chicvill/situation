import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message, BundleData } from '../types';
import { API_BASE } from '../config';
import { subscribeTopic } from '../services/mqttClient';

export const useSituation = (storeId: string = "", storeName: string = "") => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [bundles, setBundles] = useState<BundleData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // 300ms 디바운스: 연속 이벤트가 쏟아져도 1회만 fetch
    const debouncedFetch = useCallback(() => {
        if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
        fetchDebounceRef.current = setTimeout(() => {
            fetchInitialData();
        }, 300);
    }, [fetchInitialData]);

    // Initial Data Fetch
    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    // MQTT situation/kitchen 구독으로 실시간 업데이트
    useEffect(() => {
        const unsubscribe = subscribeTopic('situation/kitchen', (data) => {
            const currentStoreId = storeIdRef.current;
            const storeMatches = !data.store_id || data.store_id === currentStoreId || currentStoreId === "Total" || currentStoreId === "";

            const bundleTypes = ['Orders', 'Log', 'Menus', 'StoreConfig', 'PersonalInfos', 'Settlement', 'Employee', 'Attendance', 'Waiting', 'Checkins'];
            if (data.id && bundleTypes.includes(data.type)) {
                if (currentStoreId !== "Total" && currentStoreId !== "" && data.store_id && data.store_id !== currentStoreId) {
                    return;
                }
                setBundles(prev => {
                    const currentPrev = Array.isArray(prev) ? prev : [];
                    const index = currentPrev.findIndex(b => b.id === data.id);
                    if (index !== -1) {
                        const newBundles = [...currentPrev];
                        newBundles[index] = data;
                        return newBundles;
                    }
                    return [data, ...currentPrev];
                });
                return;
            }

            if (data.type === 'STATUS_UPDATED') {
                setBundles(prev => {
                    const currentPrev = Array.isArray(prev) ? prev : [];
                    return currentPrev.map(b =>
                        data.ids?.includes(b.id) ? { ...b, status: data.status } : b
                    );
                });
                return;
            }

            if (data.type === 'STATUS_UPDATE') {
                setBundles(prev => {
                    const currentPrev = Array.isArray(prev) ? prev : [];
                    return currentPrev.map(b =>
                        b.id === data.order_id ? { ...b, status: data.status } : b
                    );
                });
                return;
            }

            if (data.type === 'KITCHEN_DONE') {
                setBundles(prev => {
                    const currentPrev = Array.isArray(prev) ? prev : [];
                    return currentPrev.map(b => b.id === data.bundleId ? { ...b, status: 'ready' } : b);
                });
                return;
            }

            if (storeMatches) {
                debouncedFetch();
            }
        });

        return () => {
            if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
            unsubscribe();
        };
    }, [debouncedFetch]);

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
