import React, { useState, useRef, useEffect } from 'react';
import './ConversationalUI.css';
import { CounterPad } from './CounterPad';
import { MenuManager } from './MenuManager';
import { KitchenDisplay } from './KitchenDisplay';
import type { BundleData } from '../types';

interface ConversationalUIProps {
    bundles: BundleData[];
    storeName: string;
}

export const ConversationalUI: React.FC<ConversationalUIProps> = ({ bundles, storeName }) => {
    const [messages, setMessages] = useState<any[]>([]);

    useEffect(() => {
        // 첫 인사 메시지 설정 (storeName이 로드되었을 때만)
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

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="conversational-ui-container full-width-mode">
            {/* 메인 대화창 */}
            <div className="chat-content" ref={scrollRef}>
                {messages.map(msg => (
                    <div key={msg.id} className={`message-bubble ${msg.sender}`}>
                        <div className="msg-text">{msg.text}</div>
                        {msg.richComponent === 'counter' && <CounterPad bundles={bundles} messages={[]} onSendMessage={addAiMessage} />}
                        {msg.richComponent === 'menu' && <MenuManager bundles={bundles} onUpdate={() => {}} />}
                        {msg.richComponent === 'kitchen' && <KitchenDisplay />}
                        <div className="msg-time">{msg.timestamp}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
