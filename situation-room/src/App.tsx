import { useState, useMemo, useEffect, useRef } from 'react';
import './App.css';
import { KitchenDisplay } from './components/KitchenDisplay';
import { CustomerOrder } from './components/CustomerOrder';
import { AdminDashboard } from './components/AdminDashboard';
import { HRManager } from './components/HRManager';
import { MenuManager } from './components/MenuManager';
import { DisplayBoard } from './components/DisplayBoard';
import { StoreManager } from './components/StoreManager';
import { CounterPad } from './components/CounterPad';
import { WaitingManager } from './components/WaitingManager';
import { QRManager } from './components/QRManager';
import { LogicInventory } from './components/LogicInventory';
import { ConversationalUI } from './components/ConversationalUI';
import { useSituation } from './hooks/useSituation';
import './components/ConversationalUI.css';
import './components/SideMenu.css';

type MainTab = 'guide' | 'order' | 'home' | 'kitchen' | 'counter' | 'display' | 'settings' | 'inventory';

function App() {
  const { bundles, handleSendMessage } = useSituation();
  const [activeTab, setActiveTab] = useState<MainTab>('guide');
  const [isMenuOpen, setIsMenuOpen] = useState(false); // 메뉴 상태 추가
  const [currentTime, setCurrentTime] = useState(new Date());

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

  const navigateTo = (tab: MainTab, setting: string | null = null) => {
    setActiveTab(tab);
    setIsMenuOpen(false); // 이동 시 메뉴 닫기
  };

  const navItems = [
    { label: '주문', icon: '📝', tab: 'order' },
    { label: '주방', icon: '👨‍🍳', tab: 'kitchen' },
    { label: '전광판', icon: '📺', tab: 'display' },
    { label: '카운터', icon: '💰', tab: 'counter' },
    { label: '비서', icon: '🎤', tab: 'guide', special: true },
    { label: 'QR', icon: '📱', tab: 'qr' },
    { label: '통계', icon: '📊', tab: 'home' },
    { label: '메뉴', icon: 'menu', tab: 'menu' },
    { label: '매장', icon: '🏠', tab: 'settings' }
  ];

  const isCustomerMode = new URLSearchParams(window.location.search).get('mode') === 'customer';

  const renderContent = () => {
    switch (activeTab) {
      case 'guide': return <ConversationalUI bundles={bundles} onNavigate={navigateTo as any} />;
      case 'order': return <CustomerOrder bundles={bundles} />;
      case 'kitchen': return <KitchenDisplay />;
      case 'counter': return <CounterPad bundles={bundles} messages={[]} onSendMessage={handleSendMessage} />;
      case 'display': return <DisplayBoard bundles={bundles} />;
      case 'settings': return <StoreManager bundles={bundles} onNavigate={navigateTo as any} />;
      case 'home': return <AdminDashboard bundles={bundles} />;
      case 'inventory': return <LogicInventory />;
      default: return <ConversationalUI bundles={bundles} onNavigate={navigateTo as any} />;
    }
  };

  return (
    <div className={`saas-container mobile-full-mode ${isCustomerMode ? 'customer-mode' : ''}`}>
      {/* 🌑 사이드 메뉴 패널 (Drawer) - 고객 모드에선 숨김 */}
      {!isCustomerMode && (
        <>
          <div className={`side-menu-drawer ${isMenuOpen ? 'open' : ''}`}>
              <div className="drawer-header">
                  <div className="drawer-logo">우리식당 <span>PRO</span></div>
                  <button className="close-btn" onClick={() => setIsMenuOpen(false)}>×</button>
              </div>
              <nav className="drawer-nav">
                  <div className="nav-group">시스템 관리</div>
                  <button onClick={() => navigateTo('settings')}>⚙️ 매장 마스터 설정</button>
                  <button onClick={() => navigateTo('inventory')}>🧠 AI 지식 인벤토리</button>
                  <div className="nav-group">고급 기능</div>
                  <button>🎙️ AI 음성 비서 튜닝</button>
                  <button>📂 운영 로그 분석</button>
                  <button style={{ marginTop: 'auto', color: '#ef4444' }}>🔓 시스템 로그아웃</button>
              </nav>
          </div>
          {isMenuOpen && <div className="drawer-overlay" onClick={() => setIsMenuOpen(false)}></div>}
        </>
      )}

      {/* 🏛️ 전역 상단바 */}
      <header className="premium-top-bar">
        {!isCustomerMode && (
          <div className="top-bar-left">
              <button className="hamburger-btn" onClick={() => setIsMenuOpen(true)}>≡</button>
          </div>
        )}
        <div className="top-bar-center"><span className="store-name">우리식당</span></div>
        <div className="top-bar-right"><span className="current-datetime">{formatDateTime(currentTime)}</span></div>
      </header>

      {/* 🖼️ 메인 콘텐츠 영역 (하단 여백 확보) */}
      <main className="saas-main-full" style={{ paddingBottom: isCustomerMode ? '0' : '90px' }}>
        <div className="view-content">{renderContent()}</div>
      </main>

      {/* 🕹️ 전역 하단바 (Bottom Bar) - 고객 모드에선 숨김 */}
      {!isCustomerMode && (
        <nav className="bottom-nav-bar-9">
          {navItems.map((item, idx) => (
            <div key={idx} className={`nav-item-9 ${item.special ? 'mic-special' : ''}`} onClick={() => navigateTo(item.tab as MainTab)}>
              <div className="nav-icon">{item.label === '메뉴' ? '📔' : item.icon}</div>
              <div className="nav-label">{item.label}</div>
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}

export default App;
