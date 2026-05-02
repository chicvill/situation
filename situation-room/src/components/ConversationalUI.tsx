import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ConversationalUI.css';
import { CounterPad } from './CounterPad';
import { MenuManager } from './MenuManager';
import { KitchenDisplay } from './KitchenDisplay';
import type { BundleData } from '../types';
import { API_BASE } from '../config';
import { useAIVoice } from '../hooks/useAIVoice';

export interface ConversationalUIProps {
    bundles: BundleData[];
    storeName: string;
    onNavigate?: (tab: string) => void;
}

export const ConversationalUI: React.FC<ConversationalUIProps> = ({ bundles, storeName, onNavigate }) => {
    const [messages, setMessages] = useState<any[]>([]);
    const [isListeningLocal, setIsListeningLocal] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const { speak, startListening } = useAIVoice();

    // 최초 진입 시 인사
    useEffect(() => {
        if (messages.length === 0 && storeName) {
            const greeting = `안녕하세요! ${storeName} AI 비서입니다.\n음성으로 메뉴 추천, 주문 현황, 화면 이동 등을 요청해 보세요.`;
            setMessages([{ id: 1, text: greeting, sender: 'ai', timestamp: '현재' }]);
            speak(greeting);
        }
    }, [storeName]); // eslint-disable-line

    const addAiMessage = useCallback((text: string, richComponent?: string) => {
        // [GOTO:tab] 패턴 감지 → 화면 이동
        const gotoMatch = text.match(/\[GOTO:(\w+)\]/);
        const cleanText = text.replace(/\[GOTO:\w+\]/g, '').trim();
        if (gotoMatch && onNavigate) onNavigate(gotoMatch[1]);
        speak(cleanText);
        setMessages(prev => [...prev, {
            id: Date.now(),
            text: cleanText,
            sender: 'ai',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            richComponent
        }]);
    }, [onNavigate, speak]);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim()) return;
        setMessages(prev => [...prev, {
            id: Date.now(),
            text,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        try {
            const response = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text, history: bundles, store: storeName })
            });
            const data = await response.json();
            if (data.answer) addAiMessage(data.answer);
        } catch {
            addAiMessage('죄송합니다. 메시지 처리 중 오류가 발생했습니다.');
        }
    }, [bundles, storeName, addAiMessage]);

    // 음성 입력
    const handleVoiceInput = useCallback(() => {
        setIsListeningLocal(true);
        startListening(
            (text) => { sendMessage(text); },
            () => setIsListeningLocal(false)
        );
    }, [startListening, sendMessage]);

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
                        {msg.richComponent === 'menu' && <MenuManager bundles={bundles} />}
                        {msg.richComponent === 'kitchen' && <KitchenDisplay />}
                        <div className="msg-time">{msg.timestamp}</div>
                    </div>
                ))}
            </div>
            
            <div className="chat-input-area">
                <input 
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="매장에 대해 궁금한 점을 물어보세요..."
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && inputValue.trim()) {
                            sendMessage(inputValue);
                            setInputValue('');
                        }
                    }}
                />
                {/* 마이크 버튼 */}
                <button
                    className={`voice-btn ${isListeningLocal ? 'listening' : ''}`}
                    onClick={handleVoiceInput}
                    title="음성으로 입력"
                    style={{
                        background: isListeningLocal ? '#ef4444' : 'var(--primary)',
                        color: 'white', border: 'none', borderRadius: '10px',
                        padding: '0 16px', fontSize: '1.2rem', cursor: 'pointer',
                        transition: 'background 0.2s'
                    }}
                >
                    {isListeningLocal ? '🔴' : '🎙️'}
                </button>
                <button className="send-btn" onClick={() => { if (inputValue.trim()) { sendMessage(inputValue); setInputValue(''); } }}>전송</button>
            </div>
        </div>
    );
};
