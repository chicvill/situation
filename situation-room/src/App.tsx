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
import MobileOrderV2 from './components/v2/MobileOrderV2';
import { useSituation } from './hooks/useSituation';
import { useStoreFilter } from './hooks/useStoreFilter';
import './components/ConversationalUI.css';
import './components/SideMenu.css';

type MainTab = 'guide' | 'order' | 'orderV2' | 'home' | 'kitchen' | 'counter' | 'display' | 'settings' | 'inventory' | 'menu' | 'qr' | 'paper' | 'hr' | 'waiting' | 'reserve';

function App() {
  const { storeId, storeName: initialStoreName, updateStore } = useStoreFilter();
  const { bundles, handleSendMessage } = useSituation(storeId, initialStoreName);

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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    
    if (mode === 'customer') {
      const version = params.get('v');
      setActiveTab(version === '2' ? 'orderV2' : 'order');
      setUser({ id: 'guest', name: '손님', role: 'customer' });
    } else if (mode === 'kitchen') {
      setActiveTab('kitchen');
    } else if (mode === 'counter') {
      setActiveTab('counter');
    }
  }, []);

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
              receiptUrl: `https://dashboard.tosspayments.com/sales-receipt?paymentKey=${paymentKey}`
            });
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (err) {
          console.error("Payment Confirmation Error:", err);
        }
      };
      confirmPayment();
    }
  }, [safeBundles]);

  const formatDateTime = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${d} ${hh}:${mm}`;
  };

  const navigateTo = (tab: MainTab) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
  };

  const navItems = [
    { label: '비서', icon: '🎤', tab: 'guide', roles: ['admin', 'owner', 'manager', 'staff'], special: true },
    { label: '주문', icon: '📝', tab: 'order', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '주방', icon: '👨‍🍳', tab: 'kitchen', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '대기', icon: '🛎️', tab: 'waiting', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '예약', icon: '📅', tab: 'reserve', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '카운터', icon: '💰', tab: 'counter', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '전광판', icon: '📢', tab: 'display', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: 'QR 출력', icon: '🖨️', tab: 'qr', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '근태', icon: '👥', tab: 'hr', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '통계', icon: '📊', tab: 'home', roles: ['admin', 'owner'] },
    { label: '메뉴', icon: '📔', tab: 'menu', roles: ['admin', 'owner'] },
    { label: '매장', icon: '🏠', tab: 'settings', roles: ['admin', 'owner'] },
  ].filter(item => item.roles.includes(user?.role));

  const startVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => setRecognizedText(event.results[0][0].transcript);
    recognition.onend = () => {
        setIsListening(false);
        if (recognizedText) handleSendMessage(recognizedText, undefined, activeTab, storeId, storeName);
    };
    recognition.start();
  };

  if (!user) return <Login onLogin={setUser} bundles={bundles} />;

  // 시스템 관리자(Admin)인 경우 매장 선택 화면 노출
  if (user.role === 'admin' && !selectedAdminStore) {
    const stores = safeBundles.filter(b => b.type === 'StoreConfig');
    
    return (
      <div className="admin-store-selector animate-fade-in">
        <div className="glass-panel" style={{ maxWidth: '800px', margin: '100px auto', padding: '40px' }}>
          <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>🏢 매장 관리 센터</h1>
          
          {safeBundles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
              <p>지식 풀에서 매장 정보를 불러오는 중입니다...</p>
            </div>
          ) : stores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ marginBottom: '20px' }}>등록된 매장 정보가 없습니다.</p>
              <button 
                onClick={() => {
                  setSelectedAdminStore('temp-store');
                  updateStore('temp-store', '테스트 매장');
                }}
                className="premium-button"
              >
                테스트 매장으로 시작하기
              </button>
            </div>
          ) : (
            <>
              <p style={{ textAlign: 'center', opacity: 0.7, marginBottom: '40px' }}>점검 및 관리를 진행할 매장을 선택해 주세요.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                {stores.map(store => {
                  const name = store.items.find((i: any) => i.name === '상호명')?.value || '알 수 없는 매장';
                  const payStatus = store.items.find((i: any) => i.name === '납부상태')?.value || '정상';
                  return (
                    <div key={store.id} 
                         onClick={() => {
                           setSelectedAdminStore(store.id);
                           updateStore(store.id, name);
                         }}
                         style={{ 
                           padding: '30px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', 
                           border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.3s',
                           textAlign: 'center'
                         }}
                         className="store-card-hover"
                    >
                      <div style={{ fontSize: '40px', marginBottom: '15px' }}>🏪</div>
                      <h3 style={{ marginBottom: '10px' }}>{name}</h3>
                      <div style={{ 
                        fontSize: '12px', padding: '4px 10px', borderRadius: '10px', 
                        background: payStatus === '미납' ? '#ef4444' : '#10b981', display: 'inline-block' 
                      }}>
                        {payStatus === '미납' ? '❌ 미납' : '✅ 정상'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const isCustomerMode = user.role === 'customer';

  const renderContent = () => {
    switch (activeTab) {
      case 'guide': return <ConversationalUI bundles={bundles} storeName={storeName} />;
      case 'order': 
      case 'orderV2': return <MobileOrderV2 bundles={bundles} storeId={storeId} storeName={storeName} />;
      case 'kitchen': return <KitchenDisplay />;
      case 'counter': return <CounterPad storeId={storeId} />;
      case 'display': return <DisplayBoard bundles={bundles} />;
      case 'menu': return <MenuManager bundles={bundles} />;
      case 'settings': return <StoreManager bundles={bundles} onNavigate={navigateTo as any} />;
      case 'qr': return <QRManager bundles={bundles} />;
      case 'paper': return <PaperViewer />;
      case 'home': return <AdminDashboard bundles={bundles} />;
      case 'inventory': return <LogicInventory />;
      case 'hr': return <HRManager bundles={bundles} user={user} />;
      case 'waiting': return <WaitingManager bundles={bundles} onSendMessage={(txt, sId, sName) => handleSendMessage(txt, undefined, 'waiting', sId, sName)} />;
      case 'reserve': return <ReservationManager bundles={bundles} />;
      default: return <ConversationalUI bundles={bundles} storeName={storeName} />;
    }
  };

  return (
    <div className={`saas-container mobile-full-mode ${isCustomerMode ? 'customer-mode' : ''}`}>
      {receiptData && <ReceiptModal {...receiptData} onClose={() => setReceiptData(null)} />}
      
      {isListening && (
        <div className="voice-overlay animate-fade-in">
          <div className="voice-wave-premium">🎙️</div>
          <h2>{recognizedText || "듣고 있습니다..."}</h2>
          <div className="pulse-ring-premium"></div>
        </div>
      )}

      {!isCustomerMode && (
        <div className={`side-menu-drawer ${isMenuOpen ? 'open' : ''}`}>
          <div className="drawer-header">
            <div className="drawer-logo">{storeName} <span>{user.role.toUpperCase()}</span></div>
            <button onClick={() => setIsMenuOpen(false)}>×</button>
          </div>
          <nav className="drawer-nav">
            {user.role === 'admin' && (
              <>
                <button onClick={() => navigateTo('inventory')}>🧠 AI 지식 인벤토리</button>
                <button onClick={() => navigateTo('paper')}>📄 AI 논문 보기</button>
              </>
            )}
            <button onClick={() => navigateTo('settings')}>⚙️ 매장 설정</button>
            <button onClick={() => setUser(null)} style={{ color: '#ef4444' }}>🔓 로그아웃</button>
          </nav>
        </div>
      )}

      <header className="premium-top-bar">
        {!isCustomerMode && <button className="hamburger-btn" onClick={() => setIsMenuOpen(true)}>≡</button>}
        <div className="top-bar-center">{storeName}</div>
        <div className="top-bar-right">
            {!isCustomerMode && <span className="user-badge">{user.name}</span>}
            <span className="current-datetime">{formatDateTime(currentTime)}</span>
        </div>
      </header>

      <main className="saas-main-full" style={{ paddingBottom: isCustomerMode ? '0' : '90px' }}>
        <div className="view-content">{renderContent()}</div>
      </main>

      {!isCustomerMode && (
        <nav className="bottom-nav-bar-9">
          {navItems.map((item, idx) => (
            <div key={idx} className={`nav-item-9 ${item.special ? 'mic-special' : ''} ${activeTab === item.tab ? 'active' : ''}`} onClick={() => item.special ? startVoiceRecognition() : navigateTo(item.tab as MainTab)}>
              <div className="nav-icon">{item.icon}</div>
              <div className="nav-label">{item.label}</div>
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}

export default App;
