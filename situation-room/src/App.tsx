import { useState, useMemo, useEffect, useRef } from 'react';
import './App.css';
import { SituationConsole } from './components/SituationConsole';
import { BucketManager } from './components/BucketManager';
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
import { DebugPanel } from './components/DebugPanel';
import { useSituation } from './hooks/useSituation';

type MainTab = 'order' | 'home' | 'kitchen' | 'counter' | 'display' | 'settings';
type SettingTab = 'store' | 'menu' | 'hr' | 'qr' | 'console' | 'stats';

function App() {
  const { messages, bundles, handleSendMessage } = useSituation();
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [activeSetting, setActiveSetting] = useState<SettingTab | null>(null);
  const [showSettingsBalloon, setShowSettingsBalloon] = useState(false);
  const [activePostIt, setActivePostIt] = useState<{ title: string; content: string } | null>(null);

  // For multi-click detection
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'kitchen') setActiveTab('kitchen');
    if (mode === 'customer') setActiveTab('order');
    if (mode === 'display') setActiveTab('display');
  }, []);

  const storeName = useMemo(() => {
    const storeBundle = bundles.find(b => b.type === 'StoreConfig');
    return storeBundle?.items.find((i: any) => i.name.includes('상호'))?.value || 'MQnet';
  }, [bundles]);

  const hasCall = useMemo(() => bundles.some(b => b.type === 'Orders' && b.items.some((i: any) => i.name === '호출')), [bundles]);
  const hasWaiting = useMemo(() => bundles.some(b => b.type === 'Waiting'), [bundles]);

  const navigateTo = (tab: MainTab, setting: SettingTab | null = null) => {
    setActiveTab(tab);
    setActiveSetting(setting);
    setShowSettingsBalloon(false);
  };

  const handleCounterClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    clickTimerRef.current = setTimeout(() => {
        const count = clickCountRef.current;
        clickCountRef.current = 0;

        if (count === 1) {
            navigateTo('counter');
        } else if (count === 2) {
            const oldestOrder = [...bundles].reverse().find(b => b.type === 'Orders' && b.status !== 'ready');
            if (oldestOrder) {
                setActivePostIt({
                    title: `🔔 최신 알림 (${oldestOrder.timestamp})`,
                    content: oldestOrder.items.map((i: any) => `${i.name}: ${i.value}`).join('\n')
                });
            } else {
                alert('진행 중인 알림이 없습니다.');
            }
        } else if (count === 3) {
            const oldestWaiting = [...bundles].reverse().find(b => b.type === 'Waiting');
            if (oldestWaiting) {
                setActivePostIt({
                    title: `🛎️ 최신 대기 (${oldestWaiting.timestamp})`,
                    content: oldestWaiting.items.map((i: any) => `${i.name}: ${i.value}`).join('\n')
                });
            } else {
                alert('현재 대기 인원이 없습니다.');
            }
        }
    }, 300);
  };

  const renderContent = () => {
    if (activeTab === 'order') return <CustomerOrder bundles={bundles} />;
    
    if (activeTab === 'settings' && activeSetting) {
        return (
            <div className="animate-fade-in">
                <button 
                  onClick={() => setActiveSetting(null)} 
                  style={{ marginBottom: '15px', background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', fontWeight: 'bold' }}>
                  ← 설정 메뉴로 돌아가기
                </button>
                {activeSetting === 'store' && <StoreManager bundles={bundles} onNavigate={navigateTo as any} />}
                {activeSetting === 'menu' && <MenuManager bundles={bundles} onNavigate={navigateTo as any} />}
                {activeSetting === 'hr' && <HRManager bundles={bundles} />}
                {activeSetting === 'qr' && <QRManager />}
                {activeSetting === 'console' && (
                    <div className="console-split">
                        <div className="panel left"><SituationConsole messages={messages} onSendMessage={handleSendMessage} /></div>
                        <div className="panel right"><BucketManager bundles={bundles} /></div>
                    </div>
                )}
                {activeSetting === 'stats' && <AdminDashboard bundles={bundles} />}
            </div>
        );
    }

    switch (activeTab) {
      case 'home':    return <AdminDashboard bundles={bundles} />;
      case 'kitchen': return <KitchenDisplay />;
      case 'counter': return (
        <div className="animate-fade-in">
            <CounterPad bundles={bundles} messages={messages} onSendMessage={handleSendMessage} />
            <div style={{ marginTop: '30px' }}>
                <WaitingManager bundles={bundles} onSendMessage={handleSendMessage} />
            </div>
        </div>
      );
      case 'display': return <DisplayBoard bundles={bundles} />;
      case 'settings': return (
        <div className="admin-page animate-fade-in">
            <header className="page-header">
                <h2>⚙️ 통합 설정 센터</h2>
                <p>시스템 운영 및 마스터 데이터를 관리합니다.</p>
            </header>
            <div className="settings-menu-grid">
                {[
                    { id: 'store', label: '매장 관리', icon: '🏬' },
                    { id: 'menu',  label: '메뉴 관리', icon: '📒' },
                    { id: 'hr',    label: '인사 관리', icon: '👥' },
                    { id: 'qr',    label: 'QR 코드',  icon: '🔳' },
                    { id: 'console', label: '상황 콘솔', icon: '🔮' },
                    { id: 'stats',  label: '고급 통계', icon: '📈' },
                ].map(item => (
                    <div key={item.id} className="settings-option-card" onClick={() => setActiveSetting(item.id as SettingTab)}>
                        <div className="icon">{item.icon}</div>
                        <div className="label">{item.label}</div>
                    </div>
                ))}
            </div>
        </div>
      );
      default: return <AdminDashboard bundles={bundles} />;
    }
  };

  return (
    <div className="saas-container">
      <aside className="sidebar">
        <div className="sidebar-logo">{storeName}<span>SaaS</span></div>
        <nav className="sidebar-nav">
          <button className={activeTab === 'order' ? 'active' : ''} onClick={() => setActiveTab('order')}>🛍️ 주문하기</button>
          <button className={activeTab === 'home' ? 'active' : ''} onClick={() => navigateTo('home')}>📊 대시보드</button>
          <button className={activeTab === 'counter' ? 'active' : ''} onClick={() => navigateTo('counter')}>📟 카운터</button>
          <button className={activeTab === 'kitchen' ? 'active' : ''} onClick={() => navigateTo('kitchen')}>👨‍🍳 주방</button>
          <button className={activeTab === 'display' ? 'active' : ''} onClick={() => navigateTo('display')}>📺 전광판</button>
          <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => navigateTo('settings')}>⚙️ 설정</button>
        </nav>
      </aside>

      <main className="saas-main">
        <div className="view-content">
            {renderContent()}
        </div>
      </main>

      {/* Floating Bottom Tab Bar */}
      <nav className="floating-tab-bar">
        <button className={`tab-item ${activeTab === 'order' ? 'active' : ''}`} onClick={() => setActiveTab('order')}>
            <span className="icon">🛍️</span>
            <span>주문</span>
        </button>
        <button className={`tab-item ${activeTab === 'kitchen' ? 'active' : ''}`} onClick={() => navigateTo('kitchen')}>
            <span className="icon">👨‍🍳</span>
            <span>주방</span>
        </button>
        <button 
          className={`tab-item ${activeTab === 'counter' ? 'active' : ''} ${hasCall ? 'call-active' : ''} ${hasWaiting ? 'waiting-active' : ''}`} 
          onClick={handleCounterClick}
        >
            <span className="icon">📟</span>
            <span>카운터</span>
        </button>
        <button className={`tab-item ${activeTab === 'display' ? 'active' : ''}`} onClick={() => navigateTo('display')}>
            <span className="icon">📺</span>
            <span>전광판</span>
        </button>
        <button className="tab-item" onClick={() => setShowSettingsBalloon(!showSettingsBalloon)}>
            <span className="icon">⚙️</span>
            <span>설정</span>
        </button>

        {showSettingsBalloon && (
            <div className="settings-balloon">
                <div className="balloon-item" onClick={() => navigateTo('settings', 'store')}>🏬 매장 관리</div>
                <div className="balloon-item" onClick={() => navigateTo('settings', 'menu')}>📒 메뉴 관리</div>
                <div className="balloon-item" onClick={() => navigateTo('settings', 'hr')}>👥 인사 관리</div>
                <div className="balloon-item" onClick={() => navigateTo('settings', 'qr')}>🔳 QR 코드</div>
                <div className="balloon-item" onClick={() => navigateTo('settings', 'stats')}>📈 통계 페이지</div>
            </div>
        )}
      </nav>

      {activePostIt && (
          <div className="post-it-popup">
              <button className="post-it-close" onClick={() => setActivePostIt(null)}>×</button>
              <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px dashed #ca8a04' }}>{activePostIt.title}</h3>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, margin: 0 }}>{activePostIt.content}</p>
          </div>
      )}

      <DebugPanel />
    </div>
  );
}

export default App;
