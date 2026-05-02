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
    onNavigate?: (tab: string) => void;
}

export const ConversationalUI: React.FC<ConversationalUIProps> = ({ bundles, storeName, onNavigate }) => {
    const [messages, setMessages] = useState<any[]>([]);

    const speak = (text: string) => {
        if (!window.speechSynthesis) return;
        // 기존 음성 대기열을 모두 삭제하여 엉킴 방지
        window.speechSynthesis.cancel();
        
        // GOTO 태그 등 특수 문구 제거 후 읽기
        const speechText = text.replace(/\[GOTO:(\w+)\]/g, '').trim();
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    };

    useEffect(() => {
        if (messages.length === 0 && storeName) {
            const greeting = "Ai비서는 음성 지원합니다.\n주문이라고 말해 보세요.";
            setMessages([
                { id: 1, text: greeting, sender: "ai", timestamp: "현재" }
            ]);
            // 첫 진입 시에도 사용자의 상호작용이 있었다면 음성 출력
            speak(greeting);
        }
    }, [storeName, messages.length]);

    const scrollRef = useRef<HTMLDivElement>(null);

    const addAiMessage = (text: string, richComponent?: string) => {
        let cleanText = text;
        
        // [GOTO:tab_name] 패턴 감지 및 추출
        const gotoMatch = text.match(/\[GOTO:(\w+)\]/);
        if (gotoMatch && onNavigate) {
            const targetTab = gotoMatch[1];
            onNavigate(targetTab);
            // 텍스트에서는 태그 제거
            cleanText = text.replace(/\[GOTO:(\w+)\]/g, '').trim();
        }

        // 음성 출력 호출
        speak(cleanText);

        setMessages(prev => [...prev, {
            id: Date.now(),
            text: cleanText,
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
                        {msg.richComponent === 'counter' && <CounterPad />}
                        {msg.richComponent === 'menu' && <MenuManager bundles={bundles} onUpdate={() => {}} />}
                        {msg.richComponent === 'kitchen' && <KitchenDisplay />}
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
