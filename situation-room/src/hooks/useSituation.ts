import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message, BundleData } from '../types';
import { API_BASE, WS_BASE } from '../config';

export const useSituation = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [bundles, setBundles] = useState<BundleData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);

    const fetchInitialData = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/pool`);
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
    }, []);

    // Initial Data Fetch
    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    // WebSocket Connection
    useEffect(() => {
        const connectWS = () => {
            const socket = new WebSocket(`${WS_BASE}/ws/kitchen`);
            socketRef.current = socket;
            
            socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                // Handle Bundle Updates
                const bundleTypes = ['Orders', 'Log', 'Menus', 'StoreConfig', 'PersonalInfos', 'Settlement', 'Employee', 'Attendance', 'Waiting', 'Checkins'];
                if (data.id && bundleTypes.includes(data.type)) {
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
                }

                // Internal App Events
                if (data.type === 'STATUS_UPDATED') {
                    setBundles(prev => {
                        const currentPrev = Array.isArray(prev) ? prev : [];
                        return currentPrev.map(b => 
                            data.ids.includes(b.id) ? { ...b, status: data.status } : b
                        );
                    });
                } else if (data.type === 'KITCHEN_DONE') {
                    setBundles(prev => {
                        const currentPrev = Array.isArray(prev) ? prev : [];
                        return currentPrev.map(b => b.id === data.bundleId ? { ...b, status: 'ready' } : b);
                    });
                } else if (data.type === 'POOL_CLEARED') {
                    const subject = data.subject;
                    setBundles(prev => {
                        const currentPrev = Array.isArray(prev) ? prev : [];
                        return currentPrev.filter(b => !(b.items || []).some(i => i.value === subject));
                    });
                } else if (data.type === 'POOL_UPDATED') {
                    console.log("Pool updated from server. Refreshing...");
                    fetchInitialData();
                }
            };

            socket.onclose = () => {
                console.log("WS Closed. Reconnecting...");
                setTimeout(connectWS, 3000);
            };
            return socket;
        };

        const ws = connectWS();
        return () => ws.close();
    }, []);

    // API Situation Handler
    const handleSendMessage = useCallback(async (text: string, targetId?: string, context?: string) => {
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
                body: JSON.stringify({ text, targetId, context }),
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
