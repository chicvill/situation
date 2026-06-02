import React, { useState, useRef, useEffect, useMemo } from 'react';
import './ConversationalUI.css';
import type { BundleData } from '../types';
import { API_BASE } from '../config';

export interface ConversationalUIProps {
    bundles: BundleData[];
    storeId: string;
    storeName: string;
    onNavigate?: (tab: string) => void;
    sessionPreApproved?: boolean; // MobileOrderV2에서 임베드 시 이미 세션 확인됨 → 내부 체크 스킵
}

export const ConversationalUI: React.FC<ConversationalUIProps> = ({ bundles, storeId, storeName, onNavigate, sessionPreApproved = false }) => {
    // Parse table and store parameters from URL
    const params = new URLSearchParams(window.location.search);
    const tableNo = params.get('table') || '3';
    // storeId는 이제 prop으로 직접 받음
    const initialPaymentSuccess = params.get('payment_success') === 'true';
    const initialAmount = params.get('amount') || '12,000';

    const [messages, setMessages] = useState<any[]>([]);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [cart, setCart] = useState<any[]>([]);
    const [orderStep, setOrderStep] = useState<string>('welcome'); // welcome, menu_selection, point_guide, cash_invoice_guide, payment_method_selection, paying, paid
    const [isPaying, setIsPaying] = useState<boolean>(false);
    const [isListening, setIsListening] = useState<boolean>(false);
    const [sessionId, setSessionId] = useState<string>('');

    // sessionPreApproved=true이면 부모(MobileOrderV2)가 이미 세션을 확인했으므로 즉시 활성 상태로 시작
    const [hasSession, setHasSession] = useState<boolean>(sessionPreApproved);
    const [isCheckingSession, setIsCheckingSession] = useState<boolean>(!sessionPreApproved);
    const wasApproved = useRef<boolean>(sessionPreApproved);

    const scrollRef = useRef<HTMLDivElement>(null);   // chat messages container
    const messagesEndRef = useRef<HTMLDivElement>(null); // sentinel for auto-scroll
    const hasSpokenWelcome = useRef(false);

    const tableId = `T${tableNo.padStart(2, '0')}`;

    // 카운터의 실시간 좌석 배정 및 이용 승인 여부 동적 조회 (임베드 모드에서는 스킵)
    const checkSession = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/session/${tableId}?store_id=${storeId}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.session && data.session.status === 'active') {
                    setHasSession(true);
                    setSessionId(data.session.session_id);
                } else {
                    setHasSession(false);
                    setSessionId('');
                }
            } else {
                setHasSession(false);
            }
        } catch (e) {
            console.error("Session check failed in ConversationalUI:", e);
            // 네트워크 오류 시 hasSession을 false로 바꾸지 않음 (깜빡임 방지)
        } finally {
            setIsCheckingSession(false);
        }
    };

    useEffect(() => {
        if (sessionPreApproved) return; // 부모가 세션 확인 → 내부 폴링 불필요
        checkSession();
        const interval = setInterval(checkSession, 3000); // 3초 주기 실시간 연동
        return () => clearInterval(interval);
    }, [tableId, storeId, sessionPreApproved]);

    // 좌석 배정 승인이 카운터에서 이뤄지는 순간 환영 오디오를 들려줌
    useEffect(() => {
        if (hasSession && !wasApproved.current) {
            wasApproved.current = true;
            if (messages.length > 0 || hasSpokenWelcome.current) {
                speak("자리가 배정되었습니다. 주문을 시작해 주세요.");
            }
        } else if (!hasSession) {
            wasApproved.current = false;
        }
    }, [hasSession, messages.length]);

    // Speak helper for text-to-speech
    const speak = (text: string) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        
        // Remove [GOTO] tags, emojis, and icons for clean TTS
        const speechText = text.replace(/\[GOTO:(\w+)\]/g, '')
                               .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}]/gu, '')
                               .replace(/[☕🎉🍱🥩🎨🍲🍶🥤🍦🥛🥞🍰🍳🍜🥣🌶️🥗🌯🍚🧀🐖🍤🫓🍖🐚🍺🧇🍹🍳]/g, '')
                               .trim();
        
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
    };

    // 컴포넌트 이탈(일반 판형 전환 등 화면 전환) 시 흘러나오던 AI 음성을 즉시 안전 중단
    useEffect(() => {
        return () => {
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    
    const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0), [cart]);


    // Initial Welcome Message or Post-Payment Restoration Dialog
    useEffect(() => {
        if (messages.length === 0) {
            if (initialPaymentSuccess) {
                setOrderStep('paid');
                setMessages([
                    {
                        id: 1,
                        sender: 'ai',
                        text: `결제가 완료되었습니다! 🎉 ${Number(initialAmount).toLocaleString()}원\n주방에 주문이 전달되었습니다.`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        showFollowUps: true
                    }
                ]);
                if (!hasSpokenWelcome.current) {
                    speak(`결제가 완료되었습니다. 주방에 주문이 전달되었습니다.`);
                    hasSpokenWelcome.current = true;
                }
            } else {
                setMessages([
                    {
                        id: 1,
                        sender: 'ai',
                        text: `안녕하세요! ${storeName} AI 주문 도우미입니다. 😊\n\n원하시는 메뉴를 말씀하시거나, 아래 버튼을 눌러 시작해 주세요.`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                ]);
                if (!hasSpokenWelcome.current) {
                    speak(`안녕하세요! ${storeName} AI 주문 도우미입니다. 메뉴를 말씀하시거나 버튼을 눌러 시작해 주세요.`);
                    hasSpokenWelcome.current = true;
                }
            }
        }
    }, [storeName, messages.length, initialPaymentSuccess, initialAmount]);

    // Auto-scroll when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, cart, orderStep, isPaying]);

    const handleCloseWindow = () => {
        addAiMessage(`이용해 주셔서 감사합니다. 즐거운 시간 되세요! 😊`);
        setTimeout(() => {
            window.close();
            alert("창을 닫아 주세요.");
        }, 1500);
    };

    // Send generic user input
    const handleSendMessage = async (text: string) => {
        if (!text.trim()) return;

        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, userMsg]);

        // Intercept trigger keywords for conversational flow
        if (text.includes('종료') || text.includes('닫기') || text.includes('나갈래') || text.includes('종료할래')) {
            handleCloseWindow();
            return;
        }
        if (text.includes('주문') || text.includes('메뉴') || text.toLowerCase() === 'start') {
            startOrderingFlow();
            return;
        }
        if (text.includes('주차') || text.includes('차량')) {
            triggerParkingFlow();
            return;
        }
        if (text.includes('호출') || text.includes('직원') || text.includes('벨')) {
            triggerStaffCallFlow("직원호출");
            return;
        }

        // Default: Fallback to AI API endpoint
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
            addAiMessage("죄송합니다. 메시지를 이해하는 도중 잠시 혼선이 있었습니다. 다시 한번 말씀해 주시겠어요?");
        }
    };

    // Helper to add AI message
    const addAiMessage = (text: string, props = {}) => {
        speak(text);
        setMessages(prev => [...prev, {
            id: Date.now(),
            sender: 'ai',
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            ...props
        }]);
    };

    // --- CONVERSATIONAL STEPS IMPLEMENTATION ---

    // 1. Start Menu Selection Step
    const startOrderingFlow = () => {
        setOrderStep('menu_selection');
        addAiMessage(`메뉴를 선택해 주세요. 담은 후 결제 버튼을 눌러주세요. 😊`, { isMenuCarousel: true });
    };

    // 2. Go to Points step
    const handleProceedToPoints = () => {
        setOrderStep('point_guide');
        addAiMessage(`포인트 적립을 원하시면 휴대폰 번호를 입력해 주세요. 건너뛰려면 아래 버튼을 눌러주세요.`, { isPointGuide: true });
    };

    // Select point accumulation option
    const handleSelectPoints = (choice: string) => {
        setOrderStep('cash_invoice_guide');
        const userText = choice === 'skip' ? '적립 건너뛰기 ⏩' : `${choice} 적립 선택`;
        setMessages(prev => [...prev, {
            id: Date.now() + 1,
            sender: 'user',
            text: userText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        addAiMessage(`현금영수증이 필요하신가요? 아래에서 선택해 주세요.`, { isCashInvoiceGuide: true });
    };

    // Select cash receipt option
    const handleSelectCashReceipt = (choice: string) => {
        setOrderStep('payment_method_selection');
        setMessages(prev => [...prev, {
            id: Date.now() + 2,
            sender: 'user',
            text: choice,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        addAiMessage(`결제 수단을 선택해 주세요.`, { isPaymentMethodGuide: true });
    };

    // Select payment method and show card terminal mockup
    const handleSelectPaymentMethod = (method: string) => {
        setOrderStep('paying');
        setMessages(prev => [...prev, {
            id: Date.now() + 3,
            sender: 'user',
            text: `💳 ${method} 선택`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        addAiMessage(`아래 단말기에 카드를 삽입하거나 버튼을 눌러 결제를 완료해 주세요.`, { isCardTerminalSim: true });
    };

    // Simulate safe checkout card terminal action
    const handleExecutePaymentSim = async () => {
        setIsPaying(true);
        speak("카드가 감지되었습니다. 결제를 승인하는 중입니다. 잠시만 기다려 주세요.");
        
        try {
            // 1. 서버에 실제 주문 내역 전송 (표준 엔드포인트: /api/order/direct)
            const orderPayload = {
                store_id: storeId,
                table_id: tableId,
                device_id: `MOBILE-${tableId}-CHAT`, // 채팅창 전용 기기 식별자
                items: cart.map(item => ({
                    name: item.name,
                    price: item.price,
                    quantity: item.qty || 1 // 서버 규격: quantity
                })),
                total_price: cartTotal,
                payment_status: 'paid', // 결제 완료 상태로 전송
                payment_method: 'Card/App',
                metadata: { source: 'conversational_ai' }
            };
            
            console.log("📍 [Checkpoint 1] 모바일에서 백엔드로 전송하는 Payload:", JSON.stringify(orderPayload, null, 2));

            const orderRes = await fetch(`${API_BASE}/api/order/direct`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            console.log("📍 [Checkpoint 2] 백엔드 응답 상태 코드:", orderRes.status);

            if (!orderRes.ok) {
                const errorData = await orderRes.text();
                console.error("📍 [Checkpoint 2 Failed] 백엔드에서 주문 거부:", errorData);
                throw new Error(`Order submission failed: ${orderRes.status}`);
            }

            console.log("📍 [Checkpoint 7] 프론트엔드 결제 완료 처리 진입");

            // 2. 승인 지연 시뮬레이션
            await new Promise(resolve => setTimeout(resolve, 2000));

            setIsPaying(false);
            setOrderStep('paid');
            
            // Generate list of menu features/descriptions
            const features = cart.map(item => {
                const spec = item.desc ? `: ${item.desc}` : '는 저희 매장의 정성이 담긴 수제 대표 메뉴입니다.';
                return `- [${item.name}]${spec}`;
            }).join('\n');

            setMessages(prev => [...prev, {
                id: Date.now() + 10,
                sender: 'user',
                text: `${cartTotal.toLocaleString()}원 결제를 완료했습니다. 💳`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);

            const successText = `결제가 완료되었습니다! 🎉 주방에 주문이 전달되었습니다.\n\n${features || ''}`;
            
            addAiMessage(successText, { showFollowUps: true });
            
            // Clear local cart for next session if any
            setCart([]);
        } catch (err) {
            console.error("Order payment error:", err);
            addAiMessage("⚠️ 결제 승인 처리 중 오류가 발생했습니다. 카운터로 문의해 주세요.");
            setIsPaying(false);
        }
    };

    // --- CALL STAFF FLOW ---
    const triggerStaffCallFlow = async (callType: string = "직원호출") => {
        setMessages(prev => [...prev, {
            id: Date.now() + 20,
            sender: 'user',
            text: `🔔 ${callType} 벨 누름`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        try {
            const res = await fetch(`${API_BASE}/api/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    table_id: tableId,
                    call_type: callType,
                    store_id: storeId
                })
            });
            if (res.ok) {
                addAiMessage(`직원을 호출했습니다. 잠시만 기다려 주세요! 🔔`);
            } else {
                addAiMessage(`호출이 접수되었습니다. 곧 직원이 가겠습니다.`);
            }
        } catch (e) {
            addAiMessage(`호출 신호를 전송했습니다. 곧 직원이 가겠습니다.`);
        }
    };

    // --- PARKING REGISTRATION FLOW ---
    const triggerParkingFlow = () => {
        addAiMessage(`차량번호 뒤 4자리를 입력하고 등록 버튼을 눌러주세요. 🚗`, { showParkingCard: true });
    };

    const handleRegisterParkingChat = async (plateNo: string) => {
        setMessages(prev => [...prev, {
            id: Date.now() + 30,
            sender: 'user',
            text: `🚗 차량 번호 [${plateNo}] 주차 등록 요청`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        try {
            const res = await fetch(`${API_BASE}/api/parking/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    vehicle_number: plateNo,
                    discount_minutes: 120
                })
            });
            if (res.ok) {
                addAiMessage(`[${plateNo}] 주차 등록이 완료되었습니다. ✅`);
            } else {
                addAiMessage(`주차 등록 요청이 전송되었습니다.`);
            }
        } catch (e) {
            addAiMessage(`[${plateNo}] 주차 등록 요청이 전송되었습니다.`);
        }
    };

    // --- STT VOICE RECOGNITION ---
    const toggleVoiceOrdering = () => {
        if (isListening) {
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("이 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 권장합니다.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (e: any) => {
            const txt = e.results[0][0].transcript;
            handleSendMessage(txt);
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    if (isCheckingSession) {
        return (
            <div className="conversational-ui-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="premium-loader" style={{ fontSize: '3rem', animation: 'spin 2s linear infinite', marginBottom: '15px' }}>⏳</div>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>시스템 상태를 정밀 체크 중입니다...</p>
                </div>
            </div>
        );
    }

    // 장난 주문 방지 차단막 제거 (선결제 도입으로 즉시 사용 가능)


    return (
        <div className="conversational-ui-container full-width-mode" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
            {/* ── AI 비서 헤더 (아코디언 토글) ── */}
            <div 
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                    color: '#ffffff', cursor: 'pointer', borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    userSelect: 'none', WebkitUserSelect: 'none',
                    transition: 'all 0.2s'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.1rem' }}>🤖</span>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '-0.3px' }}>{storeName} AI 음성 주문 비서</span>
                    {isListening && <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 800, padding: '2px 6px', background: 'rgba(239,68,68,0.15)', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)' }}>듣고 있는 중...</span>}
                </div>
                <button style={{
                    background: 'transparent', border: 'none', color: '#94a3b8',
                    fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                    {isCollapsed ? '대화창 열기 ▾' : '대화창 접기 ▴'}
                </button>
            </div>

            <div style={{ display: isCollapsed ? 'none' : 'block' }}>
                {/* Chat Messages Log */}
                <div className="chat-content" ref={scrollRef} style={{ background: '#eef1f5', padding: '16px 14px 16px' }}>
                {messages.map((msg, index) => (
                    <div key={msg.id || index} className={`message-bubble ${msg.sender}`} style={{
                        alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        width: 'auto',
                        padding: '11px 15px',
                        borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
                        background: msg.sender === 'user' ? '#2563eb' : '#ffffff',
                        color: msg.sender === 'user' ? '#ffffff' : '#1e293b',
                        boxShadow: msg.sender === 'user' ? '0 2px 8px rgba(37,99,235,0.2)' : '0 1px 4px rgba(0,0,0,0.07)',
                        border: msg.sender === 'user' ? 'none' : '1px solid #e4e8ed',
                        fontSize: '14px',
                        lineHeight: '1.65',
                        whiteSpace: 'pre-line',
                        marginBottom: '8px'
                    }}>
                        {/* Sender label */}
                        {msg.sender === 'ai' && (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '5px', fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
                                {storeName} AI
                            </div>
                        )}

                        <div style={{ color: msg.sender === 'user' ? '#ffffff' : '#0f172a', fontWeight: msg.sender === 'user' ? 500 : 400 }}>{msg.text}</div>

                        {/* --- Dynamic Conversational Elements --- */}


                        {/* Phone Number Entry Card (Point Guide) */}
                        {msg.isPointGuide && orderStep === 'point_guide' && (
                            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '15px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '220px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: '#ea580c' }}>📱 포인트 적립 / 번호 입력</div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input 
                                        type="tel" 
                                        placeholder="01012345678" 
                                        id={`chat-phone-input-${msg.id}`}
                                        style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none', fontWeight: 700 }}
                                    />
                                    <button 
                                        onClick={() => {
                                            const inputEl = document.getElementById(`chat-phone-input-${msg.id}`) as HTMLInputElement;
                                            if (inputEl && inputEl.value.length >= 10) {
                                                handleSelectPoints(inputEl.value);
                                            } else {
                                                alert("올바른 전화번호를 입력해 주세요!");
                                            }
                                        }}
                                        style={{ padding: '8px 16px', background: '#ea580c', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                                    >
                                        확인
                                    </button>
                                </div>
                                <button 
                                    onClick={() => handleSelectPoints('skip')}
                                    style={{ padding: '6px', background: 'none', border: 'none', color: '#64748b', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer' }}
                                >
                                    건너뛰기 ⏩
                                </button>
                            </div>
                        )}

                        {/* Cash receipt invoice action buttons */}
                        {msg.isCashInvoiceGuide && orderStep === 'cash_invoice_guide' && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                                <button onClick={() => handleSelectCashReceipt('👤 개인소득공제용')} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}>
                                    👤 개인소득공제
                                </button>
                                <button onClick={() => handleSelectCashReceipt('🏢 사업자증빙용')} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', color: '#0f172a' }}>
                                    🏢 사업자증빙
                                </button>
                                <button onClick={() => handleSelectCashReceipt('미발행')} style={{ flex: 1, padding: '8px', background: '#f1f5f9', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', color: '#64748b' }}>
                                    미발행 ⏩
                                </button>
                            </div>
                        )}

                        {/* Payment Method Selection Dropdown */}
                        {msg.isPaymentMethodGuide && orderStep === 'payment_method_selection' && (
                            <div style={{ marginTop: '10px', minWidth: '220px' }}>
                                <select 
                                    onChange={(e) => {
                                        if (e.target.value) handleSelectPaymentMethod(e.target.value);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '10px',
                                        border: '2px solid #3b82f6',
                                        background: 'white',
                                        fontSize: '14px',
                                        fontWeight: 700,
                                        color: '#1e293b',
                                        outline: 'none',
                                        appearance: 'none',
                                        backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231e293b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 12px top 50%',
                                        backgroundSize: '12px auto'
                                    }}
                                >
                                    <option value="">결제 수단 선택...</option>
                                    <option value="계좌이체">🏦 계좌이체</option>
                                    <option value="카드/페이">💳 카드 / 페이 결제</option>
                                    <option value="카운터결제">🏪 카운터에서 결제</option>
                                    <option value="가상 결제 (테스트)">⚡ 가상 결제 (테스트)</option>
                                </select>
                            </div>
                        )}

                        {/* Card terminal safe checkout simulated terminal */}
                        {msg.isCardTerminalSim && orderStep === 'paying' && (
                            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '14px', padding: '15px', color: 'white', marginTop: '10px', minWidth: '240px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#38bdf8', marginBottom: '8px', borderBottom: '1px solid #1e293b', paddingBottom: '4px' }}>
                                    <span>SMART TERMINAL</span>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPaying ? '#eab308' : '#22c55e' }}></span>
                                </div>
                                <div style={{ background: '#020617', borderRadius: '8px', padding: '10px', textAlign: 'center', marginBottom: '10px' }}>
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>승인 대기 금액</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#38bdf8' }}>{cartTotal.toLocaleString()}원</div>
                                    <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontWeight: 700 }}>
                                        {isPaying ? '🔄 카드 칩 인증 및 승인 진행 중...' : '💳 카드를 투입구에 삽입해 주세요.'}
                                    </div>
                                </div>
                                {!isPaying ? (
                                    <button 
                                        onClick={handleExecutePaymentSim}
                                        style={{ width: '100%', padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '12px' }}
                                    >
                                        📥 IC 카드 투입 (결제 승인)
                                    </button>
                                ) : (
                                    <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748b' }}>단말기가 주방으로 실시간 전송 정보를 인증하는 중...</div>
                                )}
                            </div>
                        )}

                        {/* Parking Card Inline Widget */}
                        {msg.showParkingCard && (
                            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb' }}>🚗 주차 할인 자동 등록</div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <input 
                                        type="text" 
                                        placeholder="차량번호 뒤 4자리" 
                                        id={`chat-park-input-${msg.id}`}
                                        maxLength={4}
                                        style={{ flex: 1, padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', outline: 'none' }}
                                    />
                                    <button 
                                        onClick={() => {
                                            const inputEl = document.getElementById(`chat-park-input-${msg.id}`) as HTMLInputElement;
                                            if (inputEl && inputEl.value.length === 4) {
                                                handleRegisterParkingChat(inputEl.value);
                                            } else {
                                                alert("차량번호 뒤 4자리를 정교하게 입력해 주세요!");
                                            }
                                        }}
                                        style={{ padding: '6px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        등록
                                    </button>
                                </div>
                            </div>
                        )}

                         {/* Follow up Action buttons (Always accessible on completed orders) */}
                         {msg.showFollowUps && (
                             <div style={{ display: 'flex', gap: '6px', marginTop: '14px', flexWrap: 'wrap' }}>
                                 <button onClick={startOrderingFlow} style={{ flex: 1, padding: '8px 6px', background: '#2563eb', border: 'none', borderRadius: '10px', fontSize: '11px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                                     ➕ 추가 주문
                                 </button>
                                 <button onClick={() => triggerStaffCallFlow('직원호출')} style={{ flex: 1, padding: '8px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                                     🔔 직원 호출
                                 </button>
                                 <button onClick={triggerParkingFlow} style={{ flex: 1, padding: '8px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                                     🚗 주차 등록
                                 </button>
                                 <button onClick={handleCloseWindow} style={{ flex: 1, padding: '8px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px', fontWeight: 600, color: '#94a3b8', cursor: 'pointer' }}>
                                     종료
                                 </button>
                             </div>
                         )}

                        <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '6px', textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
                            {msg.timestamp}
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick action chips above input */}
            <div className="chat-suggestions-container" style={{ padding: '10px 14px 8px', background: '#ffffff', borderTop: '1px solid #e4e8ed' }}>
                <div className="suggestions-scroll" style={{ display: 'flex', gap: '7px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {orderStep === 'welcome' && (
                        <>
                            <button onClick={() => onNavigate && onNavigate('orderV2')} className="suggestion-chip" style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                📋 주문하기
                            </button>
                            <button onClick={() => triggerStaffCallFlow('직원호출')} className="suggestion-chip" style={{ background: '#fff', color: '#334155', border: '1px solid #dde3ea', fontWeight: 600, padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                🔔 직원 호출
                            </button>
                            <button onClick={triggerParkingFlow} className="suggestion-chip" style={{ background: '#fff', color: '#334155', border: '1px solid #dde3ea', fontWeight: 600, padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                🚗 주차 등록
                            </button>
                            <button onClick={handleCloseWindow} className="suggestion-chip" style={{ background: '#fff', color: '#94a3b8', border: '1px solid #dde3ea', padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                종료
                            </button>
                        </>
                    )}
                    {orderStep === 'menu_selection' && (
                        <>
                            {cart.length > 0 && (
                                <button onClick={handleProceedToPoints} className="suggestion-chip" style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    💳 결제 진행 ({cartTotal.toLocaleString()}원)
                                </button>
                            )}
                            <button onClick={() => { setOrderStep('welcome'); addAiMessage('처음으로 돌아왔습니다. 무엇을 도와드릴까요?'); }} className="suggestion-chip" style={{ background: '#fff', color: '#334155', border: '1px solid #dde3ea', padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                ← 처음으로
                            </button>
                        </>
                    )}
                    {orderStep === 'point_guide' && (
                        <>
                            <button onClick={() => handleSelectPoints('skip')} className="suggestion-chip" style={{ background: '#fff', color: '#334155', border: '1px solid #dde3ea', padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                적립 건너뛰기
                            </button>
                        </>
                    )}
                    {orderStep === 'cash_invoice_guide' && (
                        <>
                            <button onClick={() => handleSelectCashReceipt('👤 개인소득공제용')} className="suggestion-chip" style={{ background: '#fff', color: '#334155', border: '1px solid #dde3ea', padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                개인소득공제
                            </button>
                            <button onClick={() => handleSelectCashReceipt('🏢 사업자증빙용')} className="suggestion-chip" style={{ background: '#fff', color: '#334155', border: '1px solid #dde3ea', padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                사업자증빙
                            </button>
                            <button onClick={() => handleSelectCashReceipt('미발행')} className="suggestion-chip" style={{ background: '#fff', color: '#94a3b8', border: '1px solid #dde3ea', padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                미발행
                            </button>
                        </>
                    )}
                    {orderStep === 'payment_method_selection' && (
                        <>
                            <button onClick={() => handleSelectPaymentMethod('신용카드')} className="suggestion-chip" style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                💳 카드 결제
                            </button>
                            <button onClick={() => handleSelectPaymentMethod('토스페이')} className="suggestion-chip" style={{ background: '#fff', color: '#334155', border: '1px solid #dde3ea', padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                토스페이
                            </button>
                            <button onClick={() => handleSelectPaymentMethod('카카오페이')} className="suggestion-chip" style={{ background: '#fff', color: '#334155', border: '1px solid #dde3ea', padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                카카오페이
                            </button>
                            <button onClick={() => triggerStaffCallFlow('카운터 현금결제')} className="suggestion-chip" style={{ background: '#fff', color: '#94a3b8', border: '1px solid #dde3ea', padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                카운터 결제
                            </button>
                        </>
                    )}
                    {orderStep === 'paid' && (
                        <>
                            <button onClick={startOrderingFlow} className="suggestion-chip" style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                ➕ 추가 주문
                            </button>
                            <button onClick={() => triggerStaffCallFlow('직원호출')} className="suggestion-chip" style={{ background: '#fff', color: '#334155', border: '1px solid #dde3ea', padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                🔔 직원 호출
                            </button>
                            <button onClick={triggerParkingFlow} className="suggestion-chip" style={{ background: '#fff', color: '#334155', border: '1px solid #dde3ea', padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                🚗 주차 등록
                            </button>
                            <button onClick={handleCloseWindow} className="suggestion-chip" style={{ background: '#fff', color: '#94a3b8', border: '1px solid #dde3ea', padding: '7px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                종료
                            </button>
                        </>
                    )}
                </div>
                {/* auto-scroll sentinel */}
                <div ref={messagesEndRef} style={{ height: 0 }} />
            </div>

            {/* Standalone mic button */}
            <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                padding: '8px 14px calc(8px + env(safe-area-inset-bottom))',
                background: '#ffffff',
                borderTop: '1px solid #e4e8ed',
                position: 'sticky', bottom: 0, zIndex: 1000,
                boxShadow: '0 -2px 10px rgba(0,0,0,0.04)'
            }}>
                <button
                    onClick={toggleVoiceOrdering}
                    style={{
                        width: '48px', height: '48px',
                        borderRadius: '50%',
                        background: isListening ? '#ef4444' : '#2563eb',
                        border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '22px',
                        cursor: 'pointer',
                        boxShadow: isListening ? '0 0 14px rgba(239,68,68,0.5)' : '0 2px 10px rgba(37,99,235,0.35)',
                        transition: 'all 0.3s'
                    }}
                >
                    {isListening ? '🔊' : '🎙️'}
                </button>
                {isListening && (
                    <span style={{ marginLeft: '10px', fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>말씀해 주세요...</span>
                )}
            </div>
            </div>

        </div>
    );
};
