import { useState, useEffect } from 'react';
import './App.css';
import { KitchenDisplay } from './components/KitchenDisplay';
import { TOSS_CLIENT_KEY, API_BASE } from './config';
import { AdminDashboard } from './components/AdminDashboard';
import { MenuManager } from './components/MenuManager';
import { DisplayBoard } from './components/DisplayBoard';
import { StoreManager } from './components/StoreManager';
import { CounterPad } from './components/CounterPad';
import { QRManager } from './components/QRManager';
import { PaperViewer } from './components/PaperViewer';
import { LogicInventory } from './components/LogicInventory';
import { ConversationalUI } from './components/ConversationalUI';
import { ReceiptModal } from './components/ReceiptModal';
import { HRManager } from './components/HRManager';
import { WaitingManager } from './components/WaitingManager';
import { ReservationManager } from './components/ReservationManager';
import { Login } from './components/Login';
import { CallManager } from './components/CallManager';
import { StoreManualEditor } from './components/StoreManualEditor';
import { ParkingManager } from './components/ParkingManager';
import { PointsManager } from './components/PointsManager';
import MobileOrderV2 from './components/v2/MobileOrderV2';
import { AdminStoreManager } from './components/AdminStoreManager';
import { useSituation } from './hooks/useSituation';
import { useStoreFilter } from './hooks/useStoreFilter';
import { useStoreSync } from './hooks/useStoreSync';
import './components/ConversationalUI.css';
import './components/SideMenu.css';

type MainTab = 'guide' | 'order' | 'orderV2' | 'home' | 'kitchen' | 'counter' | 'display' | 'settings' | 'inventory' | 'menu' | 'qr' | 'paper' | 'hr' | 'waiting' | 'reserve' | 'stats' | 'admin' | 'call' | 'manual' | 'parking' | 'points';

function App() {
  const { storeId, storeName: initialStoreName, updateStore } = useStoreFilter();
  const { bundles, handleSendMessage } = useSituation(storeId, initialStoreName);
  const { flashingTabs, resetFlash } = useStoreSync(storeId);

  const [user, setUser] = useState<any>(null);
  const [selectedAdminStore, setSelectedAdminStore] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('guide');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recognizedText, setRecognizedText] = useState("");
  const [isListening, setIsListening] = useState(false);

  const [receiptData, setReceiptData] = useState<{
    orderId: string;
    totalPrice: number;
    paymentMethod: string;
    items: { name: string; value: string }[];
    receiptUrl?: string;
  } | null>(null);

  const safeBundles = Array.isArray(bundles) ? bundles : [];
  const isCustomerMode = user?.role === 'customer';
  
  // 지식 번들에서 상호명을 찾아 storeName 업데이트 (필요한 경우)
  const storeBundle = safeBundles.find(b => b.type === 'StoreConfig' && (b.store_id === storeId || !b.store_id));
  const resolvedStoreName = storeBundle?.items.find(i => i.name === '상호명' || i.name === 'brand')?.value || initialStoreName || '우리식당';

  // storeName이 변경되었으면 동기화
  useEffect(() => {
    if (resolvedStoreName && resolvedStoreName !== initialStoreName && storeId) {
      updateStore(storeId, resolvedStoreName);
    }
  }, [resolvedStoreName, initialStoreName, storeId, updateStore]);

  const storeName = resolvedStoreName;

  const handleLogin = (u: any) => {
    setUser(u);
    if (u.storeId && u.storeName) {
      updateStore(u.storeId, u.storeName);
    }
    if (u.role !== 'customer') {
      localStorage.setItem('mqnet_user', JSON.stringify(u));
      setActiveTab('counter');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('mqnet_user');
  };

  const [storeDetails, setStoreDetails] = useState<any>(null);

  useEffect(() => {
    if (storeId && user && user.role !== 'customer') {
      fetch(`${API_BASE}/api/stores`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const currentStore = data.find((s: any) => s.store_id === storeId);
            if (currentStore) {
              setStoreDetails(currentStore);
            }
          }
        })
        .catch(err => console.error('Error fetching store details:', err));
    }
  }, [storeId, user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    
    // 1. URL 모드 체크 (고객 주문 및 고객 대기 등록 등)
    if (mode === 'customer' || mode === 'waiting') {
      const guest = { id: 'guest', name: '손님', role: 'customer' };
      setActiveTab(mode === 'waiting' ? 'guide' : 'orderV2');
      setUser(guest);
      return;
    } 

    // 2. 저장된 세션 복구 (영구 로그인)
    const savedUser = localStorage.getItem('mqnet_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        if (u.role !== 'customer') {
          setActiveTab('counter');
        }
      } catch (e) {
        localStorage.removeItem('mqnet_user');
      }
    }

    if (mode === 'kitchen') {
      setActiveTab('kitchen');
    } else if (mode === 'counter') {
      setActiveTab('counter');
    }
  }, []);

  // --- Global Back Button Handling ---
  useEffect(() => {
    const handlePopState = () => {
      // 오버레이가 열려있다면 닫음
      if (isMenuOpen) {
        setIsMenuOpen(false);
        return;
      }
      if (receiptData) {
        setReceiptData(null);
        return;
      }
      if (isListening) {
        setIsListening(false);
        return;
      }

      // 탭이 'guide'가 아니면 홈으로 이동 (모바일 전용이 아닐 때)
      if (activeTab !== 'guide' && !isCustomerMode) {
        setActiveTab('guide');
      }
    };

    // 오버레이가 열릴 때 히스토리 추가
    if (isMenuOpen || receiptData || isListening) {
      window.history.pushState({ overlay: true }, '');
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMenuOpen, receiptData, isListening, activeTab, isCustomerMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isSuccess = params.get('payment_success') === 'true';
    const paymentKey = params.get('paymentKey');
    const orderId = params.get('order_id') || params.get('orderId');
    const amount = Number(params.get('amount') || 0);

    if (isSuccess && orderId) {
      const confirmPayment = async () => {
        try {
          const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
          const res = await fetch(`${apiUrl}/api/payment/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentKey, orderId, amount })
          });
          const result = await res.json();
          if (result.status === 'success') {
            const targetBundle = safeBundles.find(b => b.order_code === orderId || b.id === orderId);
            const items = targetBundle?.items.filter(i => i.name !== '결제수단' && i.name !== '테이블') || [];
            
          setReceiptData({
              orderId,
              totalPrice: amount,
              paymentMethod: '카드',
              items: items,
              receiptUrl: paymentKey && (paymentKey.startsWith('tviva') || paymentKey.startsWith('test'))
                ? undefined
                : `https://dashboard.tosspayments.com/receipt/helper?paymentKey=${paymentKey}`
          });

          // URL 정제 (중복 처리 방지)
          const newParams = new URLSearchParams(window.location.search);
          ['payment_success', 'payment_fail', 'order_id', 'amount', 'paymentKey'].forEach(p => newParams.delete(p));
          const newSearch = newParams.toString();
          window.history.replaceState({}, '', window.location.pathname + (newSearch ? '?' + newSearch : ''));
          
          // 하위 컴포넌트(MobileOrderV2 등)가 마운트될 시간을 주기 위해 약간의 지연 후 신호 전달
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('payment_finished', { detail: { orderId, success: true } }));
          }, 500);

          }
        } catch (err) {
          console.error("Payment Confirmation Error:", err);
        }
      };
      confirmPayment();
    }
  }, [safeBundles]);

  // 팝업 창으로부터 결제 완료 수신을 대기하는 글로벌 메시지 이벤트 리스너 (부모 창 상태 완전 보존)
  useEffect(() => {
    const handlePaymentMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PAYMENT_FINISHED') {
        const { orderId, amount, paymentKey, success } = event.data;
        if (success) {
          const targetBundle = safeBundles.find(b => b.order_code === orderId || b.id === orderId);
          const items = targetBundle?.items.filter(i => i.name !== '결제수단' && i.name !== '테이블') || [];
          
          setReceiptData({
            orderId,
            totalPrice: amount,
            paymentMethod: '카드',
            items: items,
            receiptUrl: paymentKey && (paymentKey.startsWith('tviva') || paymentKey.startsWith('test'))
              ? undefined
              : `https://dashboard.tosspayments.com/receipt/helper?paymentKey=${paymentKey}`
          });

          // 하위 UI 컴포넌트에 즉시 결제 완료 시그널 전파 (새로고침 없이 실시간 UI 전환!)
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('payment_finished', { detail: { orderId, success: true } }));
          }, 500);
        } else {
          window.dispatchEvent(new CustomEvent('payment_finished', { detail: { orderId, success: false } }));
        }
      }
    };

    window.addEventListener('message', handlePaymentMessage);
    return () => window.removeEventListener('message', handlePaymentMessage);
  }, [safeBundles]);


  const navigateTo = (tab: MainTab) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
    resetFlash(tab);
  };

  const navItems = [
    { label: '주문', icon: '📝', tab: 'orderV2', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '주방', icon: '👨‍🍳', tab: 'kitchen', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '카운터', icon: '💰', tab: 'counter', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '호출', icon: '🔔', tab: 'call', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '대기', icon: '🛎️', tab: 'waiting', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '주차', icon: '🚗', tab: 'parking', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '포인트', icon: '🪙', tab: 'points', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '비서', icon: '🎤', tab: 'guide', roles: ['admin', 'owner', 'manager', 'staff'], special: true }, // 중앙 마이크
    { label: '홈', icon: '🏠', tab: 'home', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '예약', icon: '📅', tab: 'reserve', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: 'QR인쇄', icon: '🖨️', tab: 'qr', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '전광판', icon: '📢', tab: 'display', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '통계', icon: '📊', tab: 'stats', roles: ['admin', 'owner'] },
  ].filter(item => item.roles.includes(user?.role));

  const startVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("이 브라우저에서는 음성 인식을 지원하지 않거나, HTTPS 연결이 필요합니다.\n(아이폰은 Safari, 안드로이드는 Chrome을 권장합니다)");
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setRecognizedText(text);
        
        // 특정 키워드 인식 시 즉시 이동
        if (text.includes("주문")) {
            navigateTo("orderV2");
            recognition.stop();
        } else if (text.includes("카운터")) {
            navigateTo("counter");
            recognition.stop();
        }
    };
    recognition.onend = () => {
        setIsListening(false);
        if (recognizedText && !recognizedText.includes("주문") && !recognizedText.includes("카운터")) {
            handleSendMessage(recognizedText, undefined, activeTab, storeId, storeName);
        }
    };
    recognition.start();
  };

  // 토스 결제용 팝업 창 처리 분기 (대화창의 세션/상태 유지를 위해 완전히 독립된 창으로 가동)
  const queryParams = new URLSearchParams(window.location.search);
  const isPayPopup = queryParams.get('mode') === 'pay_popup';
  const isPopupSuccessOrFail = queryParams.get('is_popup') === 'true';

  if (isPayPopup || isPopupSuccessOrFail) {
    return <PaymentPopupHandler safeBundles={safeBundles} />;
  }

  // 시스템 관리자(Admin)인 경우 매장 선택 및 관리 화면 노출
  if (user?.role === 'admin' && !selectedAdminStore) {
    return (
      <AdminStoreManager 
        onSelectStore={(id, name) => {
          setSelectedAdminStore(id);
          updateStore(id, name);
          setActiveTab('counter');
        }}
        onLogout={handleLogout}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'guide': return <ConversationalUI bundles={bundles} storeName={storeName} onNavigate={navigateTo as any} />;
      case 'orderV2': return <MobileOrderV2 bundles={bundles} storeId={storeId} storeName={storeName} onNavigate={navigateTo as any} />;
      case 'kitchen': return <KitchenDisplay />;
      case 'counter': return <CounterPad storeId={storeId} />;
      case 'display': return <DisplayBoard bundles={bundles} />;
      case 'menu': return <MenuManager bundles={bundles} />;
      case 'settings': return <StoreManager bundles={bundles} onNavigate={navigateTo as any} />;
      case 'qr': return <QRManager bundles={bundles} storeId={storeId} />;
      case 'paper': return <PaperViewer />;
      case 'stats':
      case 'admin':
      case 'home': return <AdminDashboard bundles={bundles} />;
      case 'call': return <CallManager storeId={storeId} />;
      case 'inventory': return <LogicInventory />;
      case 'manual': return <StoreManualEditor storeId={storeId} />;
      case 'hr': return <HRManager bundles={bundles} user={user} />;
      case 'waiting': return <WaitingManager bundles={bundles} onSendMessage={(txt, sId, sName) => handleSendMessage(txt, undefined, 'waiting', sId, sName)} />;
      case 'reserve': return <ReservationManager bundles={bundles} />;
      case 'parking': return <ParkingManager storeId={storeId} />;
      case 'points': return <PointsManager storeId={storeId} />;
      default: return <ConversationalUI bundles={bundles} storeName={storeName} onNavigate={navigateTo as any} />;
    }
  };


  return (
    <div className={`saas-container mobile-full-mode ${isCustomerMode ? 'customer-mode' : ''}`}>
      {receiptData && (
        <ReceiptModal 
          {...receiptData} 
          onClose={() => {
            setReceiptData(null);
            // alert 제거: 결제 완료 후 바로 진행 현황판으로 연결되도록 함
          }} 
        />
      )}
      
      {isListening && (
        <div className="voice-overlay animate-fade-in">
          <div className="voice-wave-premium">🎙️</div>
          <h2>{recognizedText || "듣고 있습니다..."}</h2>
          <div className="pulse-ring-premium"></div>
        </div>
      )}

      {!isCustomerMode && user && (
        <div className={`side-menu-drawer ${isMenuOpen ? 'open' : ''}`}>
          <div className="drawer-header">
            <div className="drawer-logo">{storeName} <span>{user.role.toUpperCase()}</span></div>
            <button onClick={() => setIsMenuOpen(false)}>×</button>
          </div>
          <nav className="drawer-nav">
            <button onClick={() => navigateTo('manual')}>📜 AI 전용 매뉴얼 설정</button>
            <button onClick={() => navigateTo('settings')}>⚙️ 매장 설정</button>
            <button onClick={() => navigateTo('menu')}>📔 메뉴 설정</button>
            <button onClick={() => navigateTo('hr')}>👥 직원관리 (직원 등록, 근태관리 등)</button>
            {user.role === 'admin' && (
              <>
                <button onClick={() => navigateTo('admin')}>🏢 매장관리 (관리자 전용)</button>
                <button onClick={() => navigateTo('inventory')}>🧠 AI 지식 인벤토리</button>
                <button onClick={() => navigateTo('paper')}>📄 AI 논문 보기</button>
              </>
            )}
            <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid rgba(0,0,0,0.05)' }} />
            <button onClick={() => handleLogout()} style={{ color: '#ef4444' }}>🔓 로그아웃</button>
          </nav>
        </div>
      )}

      <header className="premium-top-bar" style={{ 
          padding: '15px 20px', 
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 1000
      }}>
        {/* Line 1: Hamburger + Store Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {!isCustomerMode && user && (
            <button className="hamburger-btn" onClick={() => setIsMenuOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color: 'var(--text-main)', padding: 0 }}>
              ☰
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
              {storeName || '우리식당'}
            </div>
            {user?.role === 'admin' && (
              <button 
                onClick={() => setSelectedAdminStore(null)}
                style={{ 
                  background: 'rgba(255,255,255,0.08)', 
                  border: '1px solid var(--border)', 
                  color: 'var(--accent-orange)', 
                  padding: '4px 10px', 
                  borderRadius: '6px', 
                  fontSize: '0.75rem', 
                  fontWeight: '700', 
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              >
                🔄 매장 전환
              </button>
            )}
          </div>
        </div>

        {/* Line 2: Manager + Date/Time */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!isCustomerMode && user && (
            <div style={{ 
              background: '#e2e8f0', color: 'var(--text-main)', padding: '4px 12px', 
              borderRadius: '6px', fontSize: '0.85rem', fontWeight: '800' 
            }}>
              관리자
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: '700' }}>
              {currentTime.getFullYear()}.{String(currentTime.getMonth()+1).padStart(2,'0')}.{String(currentTime.getDate()).padStart(2,'0')}
            </div>
            <div style={{ color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: '900' }}>
              {String(currentTime.getHours()).padStart(2,'0')}:{String(currentTime.getMinutes()).padStart(2,'0')}
            </div>
          </div>
        </div>

        {/* 가맹비 및 구독 정산 배너 (1개월 무료 체험 & 미납/연체 경고 알림) */}
        {!isCustomerMode && user && storeDetails && (
          <div style={{
            background: storeDetails.payment_status === '연체' 
              ? 'rgba(239, 68, 68, 0.08)' 
              : storeDetails.payment_status === '미납' 
                ? 'rgba(245, 158, 11, 0.08)' 
                : 'rgba(16, 185, 129, 0.08)',
            border: `1px solid ${
              storeDetails.payment_status === '연체' 
                ? 'rgba(239, 68, 68, 0.2)' 
                : storeDetails.payment_status === '미납' 
                  ? 'rgba(245, 158, 11, 0.2)' 
                  : 'rgba(16, 185, 129, 0.2)'
            }`,
            borderRadius: '12px',
            padding: '10px 15px',
            marginTop: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '0.8rem',
            color: 'var(--text-main)',
            animation: 'fadeIn 0.5s ease-in-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
              <span style={{ fontSize: '1.1rem' }}>
                {storeDetails.payment_status === '연체' ? '🚨' : storeDetails.payment_status === '미납' ? '⚠️' : '🎁'}
              </span>
              <span>
                {storeDetails.payment_status === '연체' 
                  ? `[가맹비 연체] 플랫폼 이용료 정산이 지연되고 있습니다. 관리자에게 납부 문의바랍니다.`
                  : storeDetails.payment_status === '미납'
                    ? `[수납 안내] 미확인된 월 가맹 요금이 있습니다. 입금 정보를 확인해 주세요.`
                    : `현재 1개월 무료 체험 혜택을 이용 중입니다! (다음 납부 예정일: ${
                        (() => {
                          const regDateStr = storeDetails.created_at || storeDetails.timestamp;
                          const regDate = regDateStr ? new Date(regDateStr) : new Date();
                          const nextPay = new Date(regDate.setMonth(regDate.getMonth() + 1));
                          return `${nextPay.getFullYear()}년 ${String(nextPay.getMonth() + 1).padStart(2, '0')}월 ${String(nextPay.getDate()).padStart(2, '0')}일`;
                        })()
                      })`
                }
              </span>
            </div>
            <div style={{ 
              background: storeDetails.payment_status === '연체' ? '#ef4444' : storeDetails.payment_status === '미납' ? '#f59e0b' : '#10b981',
              color: 'white',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontWeight: 800,
              whiteSpace: 'nowrap'
            }}>
              {storeDetails.payment_status === '연체' 
                ? '서비스 제한 대기' 
                : storeDetails.payment_status === '미납' 
                  ? '정산 확인 필요' 
                  : (() => {
                      const regDateStr = storeDetails.created_at || storeDetails.timestamp;
                      const regDate = regDateStr ? new Date(regDateStr) : new Date();
                      const nextPay = new Date(regDate.setMonth(regDate.getMonth() + 1));
                      const diffTime = nextPay.getTime() - new Date().getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      return `체험 종료 D-${diffDays > 0 ? diffDays : 0}`;
                    })()
              }
            </div>
          </div>
        )}
      </header>

      <main className="saas-main-full" style={{ paddingBottom: isCustomerMode ? '0' : '90px' }}>
        <div className="view-content">
          {user ? renderContent() : <Login onLogin={handleLogin} bundles={bundles} />}
        </div>
      </main>

      {!isCustomerMode && user && activeTab !== 'order' && activeTab !== 'orderV2' && (
        <nav className="bottom-nav-bar-9" style={{ display: 'flex', overflowX: 'auto', gap: '5px', padding: '10px 15px', background: 'var(--surface)', borderTop: '1px solid var(--border)', justifyContent: 'space-between', alignItems: 'center' }}>
          {navItems.map((item, idx) => {
            const shouldBlink = 
              (item.tab === 'call' && flashingTabs.call && activeTab !== 'call') ||
              (item.tab === 'waiting' && flashingTabs.waiting && activeTab !== 'waiting') ||
              (item.tab === 'reserve' && flashingTabs.reserve && activeTab !== 'reserve') ||
              (item.tab === 'parking' && flashingTabs.parking && activeTab !== 'parking') ||
              (item.tab === 'points' && flashingTabs.points && activeTab !== 'points');

            return (
              <div 
                key={idx} 
                className={`nav-item-9 ${item.special ? 'mic-special-centered' : ''} ${activeTab === item.tab ? 'active' : ''} ${shouldBlink ? 'blink-call-bell' : ''}`} 
                onClick={() => item.special ? startVoiceRecognition() : navigateTo(item.tab as MainTab)} 
                style={{ minWidth: item.special ? '70px' : '50px', textAlign: 'center' }}
              >
                <div className="nav-icon" style={{ fontSize: item.special ? '1.8rem' : '1.2rem' }}>{item.icon}</div>
                <div className="nav-label" style={{ fontSize: '0.65rem', marginTop: '4px', whiteSpace: 'nowrap' }}>{item.label}</div>
              </div>
            );
          })}
        </nav>
      )}
    </div>
  );
}

// --- 토스 결제 및 승인 대행용 슬릭 팝업 핸들러 컴포넌트 ---
function PaymentPopupHandler({ safeBundles }: { safeBundles: any[] }) {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const isPopup = params.get('is_popup') === 'true';
  const isSuccess = params.get('payment_success') === 'true';
  const isFail = params.get('payment_fail') === 'true';
  const orderId = params.get('orderId') || params.get('order_id') || '';
  const amount = Number(params.get('amount') || 0);
  const orderName = params.get('orderName') || '주문 결제';
  const customerName = params.get('customerName') || '고객';
  const method = params.get('method') || '카드';
  const paymentKey = params.get('paymentKey') || '';

  const [statusText, setStatusText] = useState('결제 시스템을 준비 중입니다...');
  const [errorText, setErrorText] = useState<string | null>(null);

  // 1. 결제 모듈 호출 (Popup Loader)
  useEffect(() => {
    if (mode === 'pay_popup') {
      const initiateToss = async () => {
        try {
          setStatusText('토스 안전 결제 화면으로 이동 중입니다...');
          
          // 백엔드로부터 동적 Toss Client Key 조회
          const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
          const configRes = await fetch(`${apiUrl}/api/config/toss-key`);
          const configData = await configRes.json();
          const clientKey = configData.clientKey || TOSS_CLIENT_KEY;

          if (!(window as any).TossPayments) {
            throw new Error('토스 결제 모듈이 로드되지 않았습니다. 잠시만 기다려 주세요.');
          }

          const toss = (window as any).TossPayments(clientKey);
          const baseUrl = `${window.location.origin}${window.location.pathname}`;

          // 팝업 내부의 최종 분기 주소 설정 (is_popup=true 포함하여 팝업 내부 유지)
          const successUrl = `${baseUrl}?payment_success=true&is_popup=true&order_id=${orderId}&amount=${amount}`;
          const failUrl = `${baseUrl}?payment_fail=true&is_popup=true&order_id=${orderId}`;

          await toss.requestPayment(method, {
            amount,
            orderId,
            orderName,
            customerName,
            successUrl,
            failUrl
          });
        } catch (err: any) {
          setErrorText(err.message || '결제 창 호출 과정에서 오류가 발생했습니다.');
        }
      };

      if (!(window as any).TossPayments) {
        const script = document.createElement('script');
        script.src = 'https://js.tosspayments.com/v1/payment';
        script.onload = () => initiateToss();
        script.onerror = () => setErrorText('토스 라이브러리 스크립트 로드에 실패했습니다.');
        document.head.appendChild(script);
      } else {
        initiateToss();
      }
    }
  }, [mode]);

  // 2. 결제 최종 승인 검증 (Backend Sync)
  useEffect(() => {
    if (isSuccess && isPopup && orderId) {
      const confirmPayment = async () => {
        try {
          setStatusText('결제 승인을 완료하는 중입니다. 안전한 거래를 위해 창을 닫지 마세요...');
          const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
          const res = await fetch(`${apiUrl}/api/payment/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentKey, orderId, amount })
          });
          const result = await res.json();
          if (result.status === 'success') {
            setStatusText('🎉 결제가 정상 완료되었습니다! 본 창은 곧 자동으로 닫힙니다.');
            
            // 부모 창에 성공 신호 전달 (포스트메시지 활용하여 대화창 즉각 업데이트!)
            if (window.opener) {
              window.opener.postMessage({
                type: 'PAYMENT_FINISHED',
                orderId,
                amount,
                paymentKey,
                success: true
              }, '*');
            }
            
            setTimeout(() => {
              window.close();
            }, 1200);
          } else {
            throw new Error(result.message || '결제 검증 처리에 실패했습니다.');
          }
        } catch (err: any) {
          setErrorText(err.message || '서버 승인 과정에서 에러가 발생했습니다.');
          if (window.opener) {
            window.opener.postMessage({
              type: 'PAYMENT_FINISHED',
              orderId,
              success: false
            }, '*');
          }
        }
      };
      confirmPayment();
    }
  }, [isSuccess, isPopup, orderId]);

  // 3. 결제 실패/취소 팝업 자동 청소
  useEffect(() => {
    if (isFail && isPopup) {
      setErrorText('결제가 취소되었거나 오류가 발생했습니다.');
      if (window.opener) {
        window.opener.postMessage({
          type: 'PAYMENT_FINISHED',
          orderId,
          success: false
        }, '*');
      }
      setTimeout(() => {
        window.close();
      }, 2500);
    }
  }, [isFail, isPopup]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px',
      textAlign: 'center'
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: '24px',
        padding: '40px 32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid #334155',
        maxWidth: '400px',
        width: '100%'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '24px' }}>
          {errorText ? '❌' : isSuccess ? '✅' : '💳'}
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
          {errorText ? '결제 실패' : '안전한 토스 결제'}
        </h2>
        <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px' }}>
          {errorText || statusText}
        </p>
        {!errorText && !isSuccess && (
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #3b82f6',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
        )}
        {errorText && (
          <button 
            onClick={() => window.close()}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            창 닫기
          </button>
        )}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default App;
