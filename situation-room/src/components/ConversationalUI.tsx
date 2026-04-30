import React, { useState, useRef, useEffect } from 'react';
import './ConversationalUI.css';
import { CounterPad } from './CounterPad';
import { MenuManager } from './MenuManager';
import { KitchenDisplay } from './KitchenDisplay';
import type { BundleData } from '../types';
import { API_BASE } from '../config';

export interface ConversationalUIProps {
    bundles: BundleData[];
    storeName: string;
}

export const ConversationalUI: React.FC<ConversationalUIProps> = ({ bundles, storeName }) => {
    const [messages, setMessages] = useState<any[]>([]);

    useEffect(() => {
        if (messages.length === 0 && storeName) {
            setMessages([
                { id: 1, text: `사장님, ${storeName}의 지능형 비서입니다. 오늘도 힘차게 시작해볼까요?`, sender: "ai", timestamp: "현재" }
            ]);
        }
    }, [storeName, messages.length]);

    const scrollRef = useRef<HTMLDivElement>(null);

    const addAiMessage = (text: string, richComponent?: string) => {
        setMessages(prev => [...prev, {
            id: Date.now(),
            text,
            sender: "ai",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            richComponent
        }]);
    };

    // 메세지 전송 함수 (지능형 비서에게 메시지 전달)
    const sendMessage = async (text: string) => {
        // 사용자 메시지 추가
        const userMsg = { id: Date.now(), text, sender: "user", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        setMessages(prev => [...prev, userMsg]);

        try {
            const response = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    query: text, 
                    history: bundles,
                    store: storeName 
                })
            });
            const data = await response.json();
            if (data.answer) {
                addAiMessage(data.answer);
            }
        } catch (error) {
            console.error("AI Chat error:", error);
            addAiMessage("죄송합니다. 메시지 처리 중 오류가 발생했습니다.");
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="conversational-ui-container full-width-mode">
            <div className="chat-content" ref={scrollRef}>
                {messages.map(msg => (
                    <div key={msg.id} className={`message-bubble ${msg.sender}`}>
                        <div className="msg-text">{msg.text}</div>
                        {msg.richComponent === 'counter' && <CounterPad bundles={bundles} messages={[]} onSendMessage={addAiMessage} />}
                        {msg.richComponent === 'menu' && <MenuManager bundles={bundles} storeName={storeName} onUpdate={() => {}} />}
                        {msg.richComponent === 'kitchen' && <KitchenDisplay storeName={storeName} />}
                        <div className="msg-time">{msg.timestamp}</div>
                    </div>
                ))}
            </div>
            
            <div className="chat-input-area">
                <input 
                    type="text" 
                    placeholder="매장에 대해 궁금한 점을 물어보세요..."
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            sendMessage(e.currentTarget.value);
                            e.currentTarget.value = '';
                        }
                    }}
                />
                <button className="send-btn" onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    if (input.value.trim()) {
                        sendMessage(input.value);
                        input.value = '';
                    }
                }}>전송</button>
            </div>
        </div>
    );
};
