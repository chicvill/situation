import { useState, useEffect, useMemo } from 'react';
import './App.css';
import { KitchenDisplay } from './components/KitchenDisplay';
import { CustomerOrder } from './components/CustomerOrder';
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
import { Login } from './components/Login';
import { useSituation } from './hooks/useSituation';
import './components/ConversationalUI.css';
import './components/SideMenu.css';

type MainTab = 'guide' | 'order' | 'home' | 'kitchen' | 'counter' | 'display' | 'settings' | 'inventory' | 'menu' | 'qr' | 'paper' | 'hr';

function App() {
  const { bundles, handleSendMessage } = useSituation();
  const [user, setUser] = useState<any>(null);
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

  const requestedStoreName = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('store') || '';
  }, []);

  const safeBundles = Array.isArray(bundles) ? bundles : [];
  const storeBundle = safeBundles.find(b => b.type === 'StoreConfig' && (b.store === requestedStoreName || !b.store));
  const storeName = storeBundle?.items.find(i => i.name === '상호명')?.value || requestedStoreName || '우리식당';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    
    if (mode === 'customer') {
      setActiveTab('order');
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
              receiptUrl: `https://dashboard.tosspayments.com/receipt/${paymentKey}`
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
    { label: '카운터', icon: '💰', tab: 'counter', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '근태', icon: '👥', tab: 'hr', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '통계', icon: '📊', tab: 'home', roles: ['admin', 'owner', 'manager'] },
    { label: '메뉴', icon: '📔', tab: 'menu', roles: ['admin', 'owner', 'manager'] },
    { label: '매장', icon: '🏠', tab: 'settings', roles: ['admin', 'owner'] },
    { label: 'QR', icon: '📱', tab: 'qr', roles: ['admin', 'owner'] },
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
        if (recognizedText) handleSendMessage(recognizedText, undefined, activeTab, requestedStoreName);
    };
    recognition.start();
  };

  if (!user) return <Login onLogin={setUser} bundles={bundles} />;

  const isCustomerMode = user.role === 'customer';

  const renderContent = () => {
    switch (activeTab) {
      case 'guide': return <ConversationalUI bundles={bundles} storeName={storeName} />;
      case 'order': return <CustomerOrder bundles={bundles} storeName={storeName} />;
      case 'kitchen': return <KitchenDisplay />;
      case 'counter': return <CounterPad bundles={bundles} messages={[]} onSendMessage={handleSendMessage} />;
      case 'display': return <DisplayBoard bundles={bundles} />;
      case 'menu': return <MenuManager bundles={bundles} storeName={storeName} />;
      case 'settings': return <StoreManager bundles={bundles} onNavigate={navigateTo as any} storeName={storeName} />;
      case 'qr': return <QRManager bundles={bundles} />;
      case 'paper': return <PaperViewer />;
      case 'home': return <AdminDashboard bundles={bundles} />;
      case 'inventory': return <LogicInventory />;
      case 'hr': return <HRManager bundles={bundles} user={user} storeName={storeName} />;
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
