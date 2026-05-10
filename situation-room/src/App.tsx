import { useState, useEffect } from 'react';
import './App.css';
import { KitchenDisplay } from './components/KitchenDisplay';
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
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('mqnet_user');
  };

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
        // 저장된 탭 정보가 있다면 복구 (선택 사항)
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
              receiptUrl: `https://dashboard.tosspayments.com/receipt/helper?paymentKey=${paymentKey}`
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

          window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (err) {
          console.error("Payment Confirmation Error:", err);
        }
      };
      confirmPayment();
    }
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

  // 시스템 관리자(Admin)인 경우 매장 선택 및 관리 화면 노출
  if (user?.role === 'admin' && !selectedAdminStore) {
    return (
      <AdminStoreManager 
        onSelectStore={(id, name) => {
          setSelectedAdminStore(id);
          updateStore(id, name);
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

export default App;
