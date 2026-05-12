import React, { useState, useRef, useEffect } from 'react';
import './ConversationalUI.css';
import type { BundleData } from '../types';
import { API_BASE } from '../config';

export interface ConversationalUIProps {
    bundles: BundleData[];
    storeName: string;
    onNavigate?: (tab: string) => void;
}

export const ConversationalUI: React.FC<ConversationalUIProps> = ({ bundles, storeName, onNavigate }) => {
    // Parse table and store parameters from URL
    const params = new URLSearchParams(window.location.search);
    const tableNo = params.get('table') || '3';
    const storeId = params.get('store_id') || params.get('storeId') || 'default_store';
    const initialPaymentSuccess = params.get('payment_success') === 'true';
    const initialAmount = params.get('amount') || '12,000';

    const [messages, setMessages] = useState<any[]>([]);
    const [cart, setCart] = useState<any[]>([]);
    const [orderStep, setOrderStep] = useState<string>('welcome'); // welcome, menu_selection, point_guide, cash_invoice_guide, payment_method_selection, paying, paid
    const [isPaying, setIsPaying] = useState<boolean>(false);
    const [isListening, setIsListening] = useState<boolean>(false);

    const [hasSession, setHasSession] = useState<boolean>(false);
    const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
    const wasApproved = useRef<boolean>(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const hasSpokenWelcome = useRef(false);

    const tableId = `T${tableNo.padStart(2, '0')}`;

    // 카운터의 실시간 좌석 배정 및 이용 승인 여부 동적 조회
    const checkSession = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/session/${tableId}?store_id=${storeId}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.session && data.session.status === 'active') {
                    setHasSession(true);
                } else {
                    setHasSession(false);
                }
            } else {
                setHasSession(false);
            }
        } catch (e) {
            console.error("Session check failed in ConversationalUI:", e);
            setHasSession(false);
        } finally {
            setIsCheckingSession(false);
        }
    };

    useEffect(() => {
        checkSession();
        const interval = setInterval(checkSession, 3000); // 3초 주기 실시간 연동
        return () => clearInterval(interval);
    }, [tableId, storeId]);

    // 좌석 배정 승인이 카운터에서 이뤄지는 순간 환영 오디오를 들려줌
    useEffect(() => {
        if (hasSession && !wasApproved.current) {
            wasApproved.current = true;
            if (messages.length > 0 || hasSpokenWelcome.current) {
                speak("반갑습니다! 자리가 배정되어 대화식 주문창이 정상 활성화되었습니다. 마이크 단추나 키패드로 편하게 주문해 보세요.");
            }
        } else if (!hasSession) {
            wasApproved.current = false;
        }
    }, [hasSession, messages.length]);

    // Speak helper for text-to-speech
    const speak = (text: string) => {
        if (!window.speechSynthesis) return;
        // 다음 상황으로 빠르게 넘어가면 이전 음성을 즉각 중단(cancel)하여 설명 싱크 지연 해결!
        window.speechSynthesis.cancel();
        const speechText = text.replace(/\[GOTO:(\w+)\]/g, '').trim();
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

    // Extract menus from bundles dynamically using the ultra-robust defensive matching strategy
    const menus = (() => {
        const safeBundles = Array.isArray(bundles) ? bundles : [];
        
        // 1. Try matching by exact store_id
        let menuBundle = safeBundles.find(b => b.type === 'Menus' && b.store_id === storeId);
        
        // 2. Try exact store name match
        if (!menuBundle && storeName) {
            menuBundle = safeBundles.find(b => b.type === 'Menus' && b.store === storeName);
        }
        
        // 3. Try partial store name match (e.g., '초당' or '이탈리아' keywords)
        if (!menuBundle && storeName) {
            const cleanStoreName = storeName.replace(/\s+/g, '');
            menuBundle = safeBundles.find(b => {
                if (b.type !== 'Menus' || !b.store) return false;
                const cleanBStoreName = b.store.replace(/\s+/g, '');
                return cleanStoreName.includes(cleanBStoreName) || cleanBStoreName.includes(cleanStoreName);
            });
        }
        
        // 4. Absolute fallback to first available Menus bundle
        if (!menuBundle) {
            menuBundle = safeBundles.find(b => b.type === 'Menus');
        }
        
        if (!menuBundle) return [];
        
        return menuBundle.items.map((item: any) => ({
            name: String(item.name || '').trim(),
            price: typeof item.value === 'number' ? item.value : (parseInt(String(item.value || '').replace(/[^0-9]/g, '')) || 0),
            category: item.category || '기타',
            desc: item.description || '',
            image: item.icon && (item.icon.startsWith('http://') || item.icon.startsWith('https://')) ? item.icon : ''
        })).filter((m: any) => m.name);
    })();

    // Initial Welcome Message or Post-Payment Restoration Dialog
    useEffect(() => {
        if (messages.length === 0) {
            if (initialPaymentSuccess) {
                setOrderStep('paid');
                setMessages([
                    {
                        id: 1,
                        sender: 'ai',
                        text: `🎉 성공적으로 ${Number(initialAmount).toLocaleString()}원의 결제가 완료되었습니다!\n주방에 즉시 소중한 주문이 안전하게 전달되었습니다. 🍲🔥\n\n💡 주문하신 메뉴의 특별한 특징을 소개해 드릴게요:\n- 저희 매장의 시그니처 찌개류는 30년 비법 천연 발효 육수로 조리하여 유산균이 풍부하고 속을 매우 편안하게 해주는 효과가 있습니다.\n- 원두 커피류는 당일 로스팅한 스페셜티 생두만 사용하여 고소하고 깊은 아로마를 자랑합니다.`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        showFollowUps: true
                    }
                ]);
                if (!hasSpokenWelcome.current) {
                    speak(`성공적으로 ${Number(initialAmount).toLocaleString()}원의 결제가 완료되었습니다! 주방에 소중한 주문이 안전하게 전달되었습니다.`);
                    hasSpokenWelcome.current = true;
                }
            } else {
                setMessages([
                    {
                        id: 1,
                        sender: 'ai',
                        text: `반갑습니다! 😊 ${storeName}의 AI 스마트 비서입니다.\n\n키오스크 앞에서 어려워하실 필요 없이, 저와 친구처럼 편하게 대화하면서 주문을 진행해 보세요.\n\n🎙️ 아래 마이크 버튼을 탭하고 편하게 원하시는 메뉴를 말씀하시거나, 아래의 [📋 음식 주문할게요!] 버튼을 터치해 주세요.`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                ]);
                if (!hasSpokenWelcome.current) {
                    speak(`반갑습니다! ${storeName}의 에이아이 스마트 비서입니다. 저와 편하게 대화하면서 주문을 진행해 보세요.`);
                    hasSpokenWelcome.current = true;
                }
            }
        }
    }, [storeName, messages.length, initialPaymentSuccess, initialAmount]);

    // Auto-scroll when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, cart, orderStep, isPaying]);

    const handleCloseWindow = () => {
        addAiMessage(`이용해 주셔서 진심으로 감사합니다. 😊\n곧 스마트 브라우저 대화창이 종료됩니다. 즐거운 하루 되세요! 안녕히 가세요!`);
        setTimeout(() => {
            window.close();
            // 브라우저의 일반 탭 보안(스크립트로 열지 않은 창은 자바스크립트로 직접 닫을 수 없음)을 고려한 안전 안내 장치
            alert("식사가 안전하게 종료되었습니다. 이제 스마트폰 브라우저 창을 닫으셔도 좋습니다! 🚪👋");
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
        addAiMessage(`네! 저희 매장의 최고 인기 메뉴들입니다. 😊\n원하시는 메뉴의 [+ 담기]를 클릭하신 후 아래에서 [결제 진행하기] 버튼을 터치해 주세요.`, { isMenuCarousel: true });
    };

    // Add to local dialogue cart
    const handleAddCart = (menu: any) => {
        setCart(prev => {
            const existing = prev.find(item => item.name === menu.name);
            if (existing) {
                return prev.map(item => item.name === menu.name ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { ...menu, qty: 1 }];
        });
        speak(`${menu.name}을 장바구니에 담았습니다.`);
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // 2. Go to Points step
    const handleProceedToPoints = () => {
        setOrderStep('point_guide');
        addAiMessage(`💳 포인트를 적립해 드릴까요?\n\n적립을 위해 휴대폰 번호를 대화창에 입력해 주시거나, 적립을 원하지 않으시면 아래 [적립 건너뛰기]를 터치해 주세요.`, { isPointGuide: true });
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

        addAiMessage(`🧾 현금영수증 발행이 필요하신가요?\n\n소득공제용 번호(휴대폰 번호 등)를 입력하시거나, 발행하지 않으시려면 아래 버튼을 눌러주세요.`, { isCashInvoiceGuide: true });
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

        addAiMessage(`💵 결제 수단을 터치해 주세요.\n대화 형식 그대로 안전하게 승인해 드릴게요!`, { isPaymentMethodGuide: true });
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

        addAiMessage(`안전한 승인을 시작합니다. 아래 단말기 아이콘 영역에 IC 카드를 대거나 [카드 투입] 버튼을 클릭하시면 승인이 완료됩니다!`, { isCardTerminalSim: true });
    };

    // Simulate safe checkout card terminal action
    const handleExecutePaymentSim = () => {
        setIsPaying(true);
        speak("카드가 감지되었습니다. 결제를 승인하는 중입니다. 잠시만 기다려 주세요.");
        
        setTimeout(() => {
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

            const successText = `🎉 성공적으로 ${cartTotal.toLocaleString()}원의 결제가 완료되었습니다!\n주방에 즉시 소중한 주문이 안전하게 전달되었습니다. 🍲🔥\n\n💡 주문하신 메뉴의 특별한 특징과 효과를 설명해 드릴게요:\n${features || '- [주문된 메뉴]: 엄선된 신선한 최고급 재료만 사용하여 건강하고 속이 편안한 풍미를 보장합니다.'}`;
            
            addAiMessage(successText, { showFollowUps: true });
            
            // Clear local cart for next session if any
            setCart([]);
        }, 2200);
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
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const res = await fetch(`${apiUrl}/api/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    table_id: `Table ${tableNo}`,
                    call_type: callType,
                    store_id: storeId
                })
            });
            if (res.ok) {
                addAiMessage(`🔔 카운터와 직원 웨어러블에 신호를 정상 전송했습니다!\n물티슈나 반찬 리필 등 직원이 신속하게 고객님 테이블로 가실 수 있도록 조치했습니다. 잠시만 기다려 주세요! 😊`);
            } else {
                addAiMessage(`벨 호출은 접수되었으나 일시적인 네트워크 지연이 발생했습니다. 직원이 눈치채지 못할 경우 지나가는 직원에게 손을 들어주세요! 🙏`);
            }
        } catch (e) {
            addAiMessage(`🔔 직원 벨 신호가 전송되었습니다. 곧 직원이 가겠습니다!`);
        }
    };

    // --- PARKING REGISTRATION FLOW ---
    const triggerParkingFlow = () => {
        addAiMessage(`🚗 고객님의 무료 주차 인증을 도와드릴게요.\n차량번호 뒤 4자리를 아래 입력칸에 기입하고 [등록] 버튼을 선택해 주세요.`, { showParkingCard: true });
    };

    const handleRegisterParkingChat = async (plateNo: string) => {
        setMessages(prev => [...prev, {
            id: Date.now() + 30,
            sender: 'user',
            text: `🚗 차량 번호 [${plateNo}] 주차 등록 요청`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const res = await fetch(`${apiUrl}/api/parking/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    store_id: storeId,
                    car_number: plateNo,
                    table_id: `Table ${tableNo}`
                })
            });
            if (res.ok) {
                addAiMessage(`✅ 차량번호 [${plateNo}] 등록이 완료되었습니다!\n무료 주차 2시간 혜택이 적용되었으니 안심하시고 즐거운 식사 되세요! 🚙✨`);
            } else {
                addAiMessage(`차량 등록 중 사소한 점검이 있었습니다. 걱정하지 마시고 나가실 때 카운터 직원에게 [${plateNo}]를 말씀해 주시면 즉시 처리해 드릴게요!`);
            }
        } catch (e) {
            addAiMessage(`✅ [${plateNo}] 주차 승인이 안전하게 전송되었습니다. 즐거운 주말 보내세요!`);
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

    // 장난 주문 방지를 위해 카운터 좌석 승인이 나지 않은 미배정 테이블일 때 대기 차단막 노출
    // 단, 결제 성공 완료 화면은 세션 만료 후에도 고객이 정상 확인해야 하므로 예외 처리 적용!
    if (!hasSession && !initialPaymentSuccess) {
        return (
            <div className="conversational-ui-container" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                background: '#0f172a', 
                color: 'white', 
                height: '100vh', 
                fontFamily: 'Inter, sans-serif',
                padding: '20px',
                boxSizing: 'border-box'
            }}>
                <div style={{ 
                    background: 'rgba(30, 41, 59, 0.7)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '40px 30px', 
                    borderRadius: '24px', 
                    maxWidth: '420px', 
                    width: '100%', 
                    textAlign: 'center',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    <div className="seat-pulse-circle" style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(234, 179, 8, 0.15)',
                        border: '2px solid #eab308',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        margin: '0 auto 25px auto',
                        animation: 'pulse 2s infinite'
                    }}>
                        🪑
                    </div>
                    
                    <div style={{
                        background: 'rgba(234, 179, 8, 0.1)',
                        color: '#facc15',
                        padding: '4px 16px',
                        borderRadius: '50px',
                        fontSize: '0.8rem',
                        fontWeight: '800',
                        display: 'inline-block',
                        marginBottom: '15px',
                        letterSpacing: '1px',
                        border: '1px solid rgba(234, 179, 8, 0.2)'
                    }}>
                        Table {tableNo}
                    </div>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: '900', margin: '0 0 12px 0', color: '#f8fafc' }}>
                        좌석 배정 대기 중 ⏳
                    </h2>
                    
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.7', margin: '0 0 30px 0', wordBreak: 'keep-all' }}>
                        장난 주문을 방지하고 질서 있는 매장 운영을 위해 <strong style={{ color: '#facc15' }}>카운터의 좌석 승인</strong>이 필요합니다.<br/><br/>
                        카운터 직원에게 테이블 배정을 정식 요청해 주시면 이 화면이 **자동으로 활성화**되어 AI 비서와 대화형 주문을 진행할 수 있습니다.
                    </p>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '0.8rem',
                        color: '#10b981',
                        fontWeight: '700',
                        background: 'rgba(16, 185, 129, 0.08)',
                        padding: '8px 16px',
                        borderRadius: '12px',
                        border: '1px solid rgba(16, 185, 129, 0.15)'
                    }}>
                        <span className="live-dot" style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#10b981',
                            display: 'inline-block',
                            animation: 'pulseGreen 1.5s infinite'
                        }}></span>
                        카운터 실시간 연동 대기 중...
                    </div>
                </div>

                <style>{`
                    @keyframes pulse {
                        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.4); }
                        70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(234, 179, 8, 0); }
                        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); }
                    }
                    @keyframes pulseGreen {
                        0% { opacity: 0.3; }
                        50% { opacity: 1; }
                        100% { opacity: 0.3; }
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(15px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="conversational-ui-container full-width-mode">
            {/* Soft, beautiful Kakao-style Header */}
            <div className="chat-header-banner" style={{
                background: 'linear-gradient(135deg, #fef08a, #fde047)',
                padding: '12px 20px',
                borderBottom: '1px solid #facc15',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 10px rgba(0,0,0,0.03)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '22px' }}>🤖</div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>{storeName} AI비서</div>
                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>[Table {tableNo}] 실시간 대화창</div>
                    </div>
                </div>
                <button 
                    onClick={() => onNavigate && onNavigate('orderV2')}
                    style={{
                        padding: '6px 12px',
                        background: 'rgba(0,0,0,0.06)',
                        border: 'none',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#1e293b',
                        cursor: 'pointer'
                    }}
                >
                    📋 일반 판형 전환
                </button>
            </div>

            {/* Chat Messages Log */}
            <div className="chat-content" ref={scrollRef} style={{ background: '#f8fafc', padding: '15px 15px 100px' }}>
                {messages.map((msg, index) => (
                    <div key={msg.id || index} className={`message-bubble ${msg.sender}`} style={{
                        alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        width: 'auto',
                        padding: '12px 16px',
                        borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: msg.sender === 'user' ? '#fde047' : '#ffffff',
                        color: '#1e293b',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        border: msg.sender === 'user' ? '1px solid #facc15' : '1px solid #e2e8f0',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-line',
                        marginBottom: '8px'
                    }}>
                        {/* Sender Avatar */}
                        {msg.sender === 'ai' && (
                            <div style={{ display: 'flex', gap: '3px', alignItems: 'center', marginBottom: '4px', fontSize: '11px', fontWeight: 800, color: '#64748b' }}>
                                ☕ {storeName} AI 점장
                            </div>
                        )}
                        
                        <div style={{ color: '#0f172a', fontWeight: msg.sender === 'user' ? 600 : 500 }}>{msg.text}</div>

                        {/* --- Dynamic Conversational Elements --- */}

                        {/* Menu Selection Carousel */}
                        {msg.isMenuCarousel && orderStep === 'menu_selection' && (
                            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '12px 0 5px', width: '100%', scrollbarWidth: 'none' }} className="no-scrollbar">
                                {menus.map((item, idx) => (
                                    <div key={idx} style={{
                                        width: '160px', flexShrink: 0, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px'
                                    }}>
                                        {item.image && <img src={item.image} style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '10px' }} alt={item.name} />}
                                        <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b' }}>{item.name}</div>
                                        <div style={{ fontSize: '10px', color: '#64748b', height: '30px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.desc}</div>
                                        <div style={{ fontWeight: 900, fontSize: '12px', color: '#f97316' }}>{item.price.toLocaleString()}원</div>
                                        <button 
                                            onClick={() => handleAddCart(item)}
                                            style={{
                                                width: '100%', padding: '6px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '11px', cursor: 'pointer'
                                            }}
                                        >
                                            + 담기
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Cart inside Menu Selection Bubble */}
                        {msg.isMenuCarousel && orderStep === 'menu_selection' && cart.length > 0 && (
                            <div style={{ marginTop: '12px', background: 'rgba(249, 115, 22, 0.04)', border: '1px dashed rgba(249, 115, 22, 0.3)', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: '#ea580c' }}>🧺 실시간 장바구니</div>
                                {cart.map((cartItem, cIdx) => (
                                    <div key={cIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#334155' }}>
                                        <span>{cartItem.name} x {cartItem.qty}</span>
                                        <span style={{ fontWeight: 700 }}>{(cartItem.price * cartItem.qty).toLocaleString()}원</span>
                                    </div>
                                ))}
                                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '13px', color: '#ea580c' }}>
                                    <span>총 결제액</span>
                                    <span>{cartTotal.toLocaleString()}원</span>
                                </div>
                                <button 
                                    onClick={handleProceedToPoints}
                                    style={{
                                        marginTop: '6px', width: '100%', padding: '10px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '12px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(249,115,22,0.15)'
                                    }}
                                >
                                    💳 총 {cartTotal.toLocaleString()}원 결제 진행하기 ➔
                                </button>
                            </div>
                        )}

                        {/* Point accumulation action buttons */}
                        {msg.isPointGuide && orderStep === 'point_guide' && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                                <button onClick={() => handleSelectPoints('010-1234-5678')} style={{ flex: 1, padding: '8px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#3b82f6' }}>
                                    📱 010-1234-5678로 적립
                                </button>
                                <button onClick={() => handleSelectPoints('skip')} style={{ flex: 1, padding: '8px 12px', background: '#f1f5f9', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#64748b' }}>
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

                        {/* Payment Method selector buttons */}
                        {msg.isPaymentMethodGuide && orderStep === 'payment_method_selection' && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                                <button onClick={() => handleSelectPaymentMethod('신용카드')} style={{ flex: 1, minWidth: '110px', padding: '10px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    💳 신용카드 결제
                                </button>
                                <button onClick={() => handleSelectPaymentMethod('토스페이')} style={{ flex: 1, minWidth: '110px', padding: '10px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    🔵 토스페이 결제
                                </button>
                                <button onClick={() => triggerStaffCallFlow('카운터 현금결제')} style={{ flex: 1, minWidth: '110px', padding: '10px', background: '#f1f5f9', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    🏦 카운터 현금
                                </button>
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
                             <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                                 <button onClick={startOrderingFlow} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '11px', fontWeight: 800, color: '#eab308', cursor: 'pointer' }}>
                                     ➕ 추가 주문하기
                                 </button>
                                 <button onClick={() => triggerStaffCallFlow('직원호출')} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '11px', fontWeight: 800, color: '#ef4444', cursor: 'pointer' }}>
                                     🔔 직원 호출 벨
                                 </button>
                                 <button onClick={triggerParkingFlow} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '11px', fontWeight: 800, color: '#2563eb', cursor: 'pointer' }}>
                                     🚗 주차 무료 인증
                                 </button>
                                 <button onClick={handleCloseWindow} style={{ flex: 1, padding: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '11px', fontWeight: 800, color: '#475569', cursor: 'pointer' }}>
                                     🚪 대화 종료 (닫기)
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
            <div className="chat-suggestions-container" style={{ padding: '10px 15px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <div className="suggestions-scroll" style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {orderStep === 'welcome' && (
                        <>
                            <button onClick={startOrderingFlow} className="suggestion-chip special" style={{ border: '1px solid #facc15', background: '#fef9c3', fontWeight: 800, color: '#854d0e', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                📋 음식 주문할게요!
                            </button>
                            <button onClick={() => triggerStaffCallFlow('직원호출')} className="suggestion-chip" style={{ border: '1px solid #fca5a5', background: '#fee2e2', fontWeight: 800, color: '#991b1b', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                🔔 직원 호출 벨
                            </button>
                            <button onClick={triggerParkingFlow} className="suggestion-chip" style={{ border: '1px solid #93c5fd', background: '#dbeafe', fontWeight: 800, color: '#1e40af', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                🚗 주차 할인 등록
                            </button>
                            <button onClick={handleCloseWindow} className="suggestion-chip" style={{ border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                🚪 대화 종료
                            </button>
                        </>
                    )}
                    {orderStep === 'menu_selection' && (
                        <>
                            {cart.length > 0 && (
                                <button onClick={handleProceedToPoints} className="suggestion-chip special" style={{ border: '1px solid #facc15', background: '#fef9c3', fontWeight: 800, color: '#ea580c', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                    💳 장바구니 확인 및 결제 진행
                                </button>
                            )}
                            <button onClick={() => { setOrderStep('welcome'); addAiMessage('처음으로 돌아왔습니다. 무엇을 도와드릴까요?'); }} className="suggestion-chip" style={{ border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                ⏪ 대화 처음으로
                            </button>
                        </>
                    )}
                    {orderStep === 'point_guide' && (
                        <>
                            <button onClick={() => handleSelectPoints('010-1234-5678')} className="suggestion-chip special" style={{ border: '1px solid #facc15', background: '#fef9c3', fontWeight: 800, color: '#1e40af', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                📱 010-1234-5678 (적립)
                            </button>
                            <button onClick={() => handleSelectPoints('skip')} className="suggestion-chip" style={{ border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                적립 안 함 ⏩
                            </button>
                        </>
                    )}
                    {orderStep === 'cash_invoice_guide' && (
                        <>
                            <button onClick={() => handleSelectCashReceipt('👤 개인소득공제용')} className="suggestion-chip" style={{ border: '1px solid #cbd5e1', background: 'white', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                개인소득공제 👤
                            </button>
                            <button onClick={() => handleSelectCashReceipt('🏢 사업자증빙용')} className="suggestion-chip" style={{ border: '1px solid #cbd5e1', background: 'white', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                사업자증빙용 🏢
                            </button>
                            <button onClick={() => handleSelectCashReceipt('미발행')} className="suggestion-chip" style={{ border: '1px solid #cbd5e1', background: '#f1f5f9', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                영수증 미발행 ⏩
                            </button>
                        </>
                    )}
                    {orderStep === 'payment_method_selection' && (
                        <>
                            <button onClick={() => handleSelectPaymentMethod('신용카드')} className="suggestion-chip special" style={{ border: '1px solid #10b981', background: '#ecfdf5', color: '#065f46', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                💳 신용카드 결제
                            </button>
                            <button onClick={() => handleSelectPaymentMethod('토스페이')} className="suggestion-chip special" style={{ border: '1px solid #3b82f6', background: '#eff6ff', color: '#1e40af', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                🔵 토스페이 결제
                            </button>
                            <button onClick={() => triggerStaffCallFlow('카운터 현금결제')} className="suggestion-chip" style={{ border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                🏦 카운터 현금 결제
                            </button>
                        </>
                    )}
                    {orderStep === 'paid' && (
                        <>
                            <button onClick={startOrderingFlow} className="suggestion-chip special" style={{ border: '1px solid #facc15', background: '#fef9c3', fontWeight: 800, color: '#a16207', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                ➕ 추가 주문 진행하기
                            </button>
                            <button onClick={() => triggerStaffCallFlow('직원호출')} className="suggestion-chip" style={{ border: '1px solid #fca5a5', background: '#fee2e2', color: '#991b1b', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                🔔 추가 직원 요청
                            </button>
                            <button onClick={triggerParkingFlow} className="suggestion-chip" style={{ border: '1px solid #cbd5e1', background: 'white', color: '#1e40af', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', cursor: 'pointer' }}>
                                🚗 주차 등록 갱신
                            </button>
                            <button onClick={handleCloseWindow} className="suggestion-chip" style={{ border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#ef4444', padding: '6px 12px', borderRadius: '15px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                                🚪 대화 종료
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Premium Chat Input Area */}
            <div className="chat-input-area" style={{ padding: '10px 15px 15px', background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Voice Microphone Toggle Button */}
                <button 
                    onClick={toggleVoiceOrdering}
                    style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: isListening ? '#ef4444' : '#fde047',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        cursor: 'pointer',
                        boxShadow: isListening ? '0 0 10px rgba(239, 68, 68, 0.4)' : '0 2px 6px rgba(0,0,0,0.1)',
                        transition: 'all 0.3s'
                    }}
                >
                    {isListening ? '🔊' : '🎙️'}
                </button>
                <input 
                    type="text" 
                    placeholder={isListening ? "말씀해 주시면 텍스트로 자동 변환됩니다..." : "AI 점장에게 편하게 채팅으로 말씀해 주세요..."}
                    style={{
                        flex: 1,
                        padding: '10px 15px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '24px',
                        fontSize: '13px',
                        background: '#f8fafc',
                        color: '#1e293b',
                        outline: 'none'
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            handleSendMessage(e.currentTarget.value);
                            e.currentTarget.value = '';
                        }
                    }}
                />
                <button 
                    className="send-btn" 
                    style={{
                        padding: '10px 18px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '24px',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer'
                    }}
                    onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        if (input.value.trim()) {
                            handleSendMessage(input.value);
                            input.value = '';
                        }
                    }}
                >
                    전송
                </button>
            </div>
        </div>
    );
};
