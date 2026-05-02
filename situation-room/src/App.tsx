import { useState, useEffect, useRef, useCallback } from 'react';
// Build trigger: 2026-05-03 Optimization Update
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
import { VoiceManager } from './components/VoiceManager';
import MobileOrderV2 from './components/v2/MobileOrderV2';
import { useSituation } from './hooks/useSituation';
import { useStoreFilter } from './hooks/useStoreFilter';
import './components/ConversationalUI.css';
import './components/SideMenu.css';

type MainTab = 'guide' | 'order' | 'orderV2' | 'home' | 'kitchen' | 'counter' | 'display' | 'settings' | 'inventory' | 'menu' | 'qr' | 'paper' | 'hr' | 'waiting' | 'reserve' | 'stats' | 'call' | 'voice';

function App() {
  const { storeId, storeName: initialStoreName, updateStore } = useStoreFilter();
  const { bundles, handleSendMessage } = useSituation(storeId, initialStoreName);

  const [user, setUser] = useState<any>(null);
  const [selectedAdminStore, setSelectedAdminStore] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('guide');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isListening, setIsListening] = useState(false);
  const recognizedTextRef = useRef("");
  const [displayRecognizedText, setDisplayRecognizedText] = useState("");

  const [receiptData, setReceiptData] = useState<any>(null);

  const safeBundles = Array.isArray(bundles) ? bundles : [];
  const isCustomerMode = user?.role === 'customer';
  
  const storeBundle = safeBundles.find(b => b.type === 'StoreConfig' && (b.store_id === storeId || !b.store_id));
  const resolvedStoreName = storeBundle?.items.find((i: any) => i.name === '상호명' || i.name === 'brand')?.value || initialStoreName || '우리식당';

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
      setActiveTab('orderV2');
      setUser({ id: 'guest', name: '손님', role: 'customer' });
    } else if (mode === 'kitchen') {
      setActiveTab('kitchen');
    } else if (mode === 'counter') {
      setActiveTab('counter');
    }
  }, []);

  const navigateTo = useCallback((tab: MainTab) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
  }, []);

  const startVoiceRecognition = () => {
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("이 브라우저는 음성 인식을 지원하지 않습니다.");
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.onstart = () => {
        setIsListening(true);
        recognizedTextRef.current = "";
    };
    recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        recognizedTextRef.current = text;
        setDisplayRecognizedText(text);
        
        const defaultMap: Record<string, MainTab> = {
            "주문": "orderV2", "주방": "kitchen", "카운터": "counter", "결제": "counter",
            "호출": "call", "대기": "waiting", "비서": "guide", "홈": "home",
            "메인": "home", "예약": "reserve", "큐알": "qr", "인쇄": "qr",
            "전광판": "display", "통계": "stats", "직원": "hr", "설정": "settings",
            "인벤토리": "inventory", "논문": "paper"
        };

        const customMap: Record<string, MainTab> = {};
        safeBundles.filter(b => b.type === 'VoiceConfig').forEach(b => {
            b.items.forEach((item: any) => {
                customMap[item.name] = item.value as MainTab;
            });
        });

        const combinedMap = { ...defaultMap, ...customMap };
        for (const keyword in combinedMap) {
            if (text.includes(keyword)) {
                navigateTo(combinedMap[keyword]);
                recognition.stop();
                return;
            }
        }
    };
    recognition.onend = () => {
        setIsListening(false);
        setDisplayRecognizedText("");
        const finalContent = recognizedTextRef.current;
        if (finalContent && !finalContent.includes("주문")) {
            handleSendMessage(finalContent, undefined, activeTab, storeId, storeName);
        }
    };
    recognition.start();
  };

  useEffect(() => {
    const handleNav = (e: any) => { if (e.detail) navigateTo(e.detail as MainTab); };
    window.addEventListener('navigate', handleNav);
    return () => window.removeEventListener('navigate', handleNav);
  }, [navigateTo]);

  if (!user) return <Login onLogin={setUser} bundles={safeBundles} />;

  if (user.role === 'admin' && !selectedAdminStore) {
    const stores = safeBundles.filter(b => b.type === 'StoreConfig');
    return (
      <div className="admin-store-selector" style={{ background: 'var(--bg-main)', minHeight: '100vh', padding: '100px 20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h1 style={{ textAlign: 'center', marginBottom: '60px' }}>MQNET SERVICE</h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
            {stores.map(store => {
              const name = store.items.find((i: any) => i.name === '상호명')?.value || '알 수 없는 매장';
              return (
                <div key={store.id} onClick={() => { setSelectedAdminStore(store.id); updateStore(store.id, name); }} className="store-card-hover" style={{ padding: '50px 30px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'center' }}>
                  <h3 style={{ margin: 0 }}>{name}</h3>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    const props = { bundles: safeBundles, storeId, storeName };
    switch (activeTab) {
      case 'guide': return <ConversationalUI {...props} onNavigate={navigateTo as any} />;
      case 'order': 
      case 'orderV2': return <MobileOrderV2 {...props} />;
      case 'kitchen': return <KitchenDisplay />;
      case 'counter': return <CounterPad storeId={storeId} />;
      case 'stats': 
      case 'home': return <AdminDashboard bundles={safeBundles} />;
      case 'voice': return <VoiceManager bundles={safeBundles} storeId={storeId} />;
      case 'display': return <DisplayBoard bundles={safeBundles} />;
      case 'menu': return <MenuManager bundles={safeBundles} />;
      case 'settings': return <StoreManager bundles={safeBundles} onNavigate={navigateTo as any} />;
      case 'qr': return <QRManager bundles={safeBundles} />;
      case 'paper': return <PaperViewer />;
      case 'inventory': return <LogicInventory />;
      case 'hr': return <HRManager bundles={safeBundles} user={user} />;
      case 'waiting': return <WaitingManager bundles={safeBundles} onSendMessage={(txt, sId, sName) => handleSendMessage(txt, undefined, 'waiting', sId, sName)} />;
      case 'reserve': return <ReservationManager bundles={safeBundles} />;
      default: return <ConversationalUI {...props} onNavigate={navigateTo as any} />;
    }
  };

  return (
    <div className={`saas-container mobile-full-mode ${isCustomerMode ? 'customer-mode' : ''}`}>
      {receiptData && <ReceiptModal {...receiptData} onClose={() => setReceiptData(null)} />}
      {isListening && (
        <div className="voice-overlay animate-fade-in">
          <div className="voice-wave-premium">🎙️</div>
          <h2>{displayRecognizedText || "듣고 있습니다..."}</h2>
          <div className="pulse-ring-premium"></div>
        </div>
      )}
      <header className="premium-top-bar" style={{ height: '85px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!isCustomerMode && <button className="hamburger-btn" onClick={() => setIsMenuOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.8rem' }}>☰</button>}
          <div style={{ fontSize: '1.2rem', fontWeight: '800' }}>{storeName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>{currentTime.toLocaleDateString()}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '900' }}>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </header>
      <main className="saas-main-full" style={{ paddingBottom: isCustomerMode ? '0' : '90px' }}>
        <div className="view-content">{renderContent()}</div>
      </main>
      {!isCustomerMode && (activeTab !== 'order' && activeTab !== 'orderV2') && (
        <nav className="bottom-nav-bar-9" style={{ display: 'flex', position: 'fixed', bottom: 0, left: 0, right: 0, height: '80px', background: 'var(--surface)', borderTop: '1px solid var(--border)', justifyContent: 'space-around', alignItems: 'center', zIndex: 1000 }}>
          <div className="nav-item-9" onClick={() => navigateTo('home')}>🏠<div>홈</div></div>
          <div className="nav-item-9" onClick={() => navigateTo('kitchen')}>👨‍🍳<div>주방</div></div>
          <div className="nav-item-9 mic-special-centered" onClick={() => startVoiceRecognition()}>🎙️<div>비서</div></div>
          <div className="nav-item-9" onClick={() => navigateTo('counter')}>💰<div>카운터</div></div>
          <div className="nav-item-9" onClick={() => setIsMenuOpen(true)}>☰<div>메뉴</div></div>
        </nav>
      )}
      {/* Side Menu Drawer */}
      {isMenuOpen && (
        <div className="side-menu-drawer open" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 2000 }}>
           <div style={{ width: '280px', height: '100%', background: 'var(--surface)', padding: '30px' }}>
              <button onClick={() => setIsMenuOpen(false)} style={{ float: 'right' }}>×</button>
              <nav style={{ marginTop: '50px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <button onClick={() => navigateTo('orderV2')}>📝 주문관리</button>
                <button onClick={() => navigateTo('hr')}>👥 직원관리</button>
                <button onClick={() => navigateTo('stats')}>📊 매출통계</button>
                <button onClick={() => navigateTo('voice')}>🎙️ 음성설정</button>
                <button onClick={() => setUser(null)} style={{ color: 'red', marginTop: '30px' }}>로그아웃</button>
              </nav>
           </div>
        </div>
      )}
    </div>
  );
}

export default App;
