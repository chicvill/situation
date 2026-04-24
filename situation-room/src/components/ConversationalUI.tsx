import React, { useState, useRef, useEffect } from 'react';
import './ConversationalUI.css';
import { CounterPad } from './CounterPad';
import { MenuManager } from './MenuManager';
import { KitchenDisplay } from './KitchenDisplay';
import type { BundleData } from '../types';

interface ConversationalUIProps {
    onNavigate: (tab: string) => void;
    bundles: BundleData[];
}

export const ConversationalUI: React.FC<ConversationalUIProps> = ({ onNavigate, bundles }) => {
    const [messages, setMessages] = useState<any[]>([
        { id: 1, text: "사장님, 우리식당의 지능형 비서입니다. 오늘도 힘차게 시작해볼까요?", sender: "ai", timestamp: "현재" }
    ]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const scrollRef = useRef<HTMLDivElement>(null);

    // 실시간 시계 로직
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatDateTime = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${y}.${m}.${d} ${hh}:${mm}`;
    };

    const addAiMessage = (text: string, richComponent?: string) => {
        setMessages(prev => [...prev, {
            id: Date.now(),
            text,
            sender: "ai",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            richComponent
        }]);
    };

    const handleAction = (type: string) => {
        switch(type) {
            case '주문': addAiMessage("실시간 주문 현황입니다.", "orders"); break;
            case '주방': addAiMessage("주방 조리 대기열을 불러왔습니다.", "kitchen"); break;
            case '전광판': addAiMessage("매장 전광판 설정 화면입니다.", "display"); break;
            case '카운터': addAiMessage("카운터 정산 마스터를 가동합니다.", "counter"); break;
            case 'QR': addAiMessage("QR 주문지 인쇄 및 관리 화면입니다.", "qr"); break;
            case '통계': addAiMessage("지식 창고 기반 매출 통계 분석입니다.", "stats"); break;
            case '메뉴': addAiMessage("AI 메뉴 카탈로그 관리 화면입니다.", "menu"); break;
            case '매장': addAiMessage("매장 정보 및 시스템 설정입니다.", "settings"); break;
            case '마이크': addAiMessage("🎙️ 음성 인식 대기 중... 말씀해 주세요."); break;
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const navItems = [
        { label: '주문', icon: '📝' },
        { label: '주방', icon: '👨‍🍳' },
        { label: '전광판', icon: '📺' },
        { label: '카운터', icon: '💰' },
        { label: '마이크', icon: '🎤', special: true },
        { label: 'QR', icon: '📱' },
        { label: '통계', icon: '📊' },
        { label: '메뉴', icon: '📔' },
        { label: '매장', icon: '🏠' }
    ];

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
