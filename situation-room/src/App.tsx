import { useState, useEffect } from 'react';
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
import { useSituation } from './hooks/useSituation';
import './components/ConversationalUI.css';
import './components/SideMenu.css';

type MainTab = 'guide' | 'order' | 'home' | 'kitchen' | 'counter' | 'display' | 'settings' | 'inventory' | 'menu' | 'qr' | 'paper';

function App() {
  const { bundles, handleSendMessage } = useSituation();
  const [activeTab, setActiveTab] = useState<MainTab>('guide');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // 영수증 데이터 상태
  const [receiptData, setReceiptData] = useState<{
    orderId: string;
    totalPrice: number;
    paymentMethod: string;
    items: { name: string; value: string }[];
    receiptUrl?: string;
  } | null>(null);

  // 매장 정보에서 상호명 추출 (방어 코드 추가)
  const safeBundles = Array.isArray(bundles) ? bundles : [];
  const storeBundle = safeBundles.find(b => b.type === 'StoreConfig' && (b.title === '매장 정보' || b.title === '사업자 정보 자동 인식'));
  const storeName = storeBundle?.items.find(i => i.name === '상호명')?.value || '우리식당';

  // 실시간 시계 로직
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // URL 파라미터에 따른 자동 탭 전환 로직 추가
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    
    if (mode === 'customer') {
      setActiveTab('order');
    } else if (mode === 'kitchen') {
      setActiveTab('kitchen');
    } else if (mode === 'counter') {
      setActiveTab('counter');
    } else if (mode === 'waiting') {
      setActiveTab('qr');
    }
  }, []);

  // 토스페이먼츠 결과 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isSuccess = params.get('payment_success') === 'true';
    const isFail = params.get('payment_fail') === 'true';
    const paymentKey = params.get('paymentKey');
    const orderId = params.get('order_id') || params.get('orderId');
    const amount = Number(params.get('amount') || 0);
    const methodType = params.get('method') === '가상계좌' ? '계좌이체' : '신용카드';

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
            // 영수증에 보여줄 아이템 찾기
            const targetBundle = safeBundles.find(b => b.order_code === orderId || b.id === orderId);
            const items = targetBundle?.items.filter(i => i.name !== '결제수단' && i.name !== '테이블') || [];
            
            setReceiptData({
              orderId,
              totalPrice: amount,
              paymentMethod: methodType,
              items: items,
              receiptUrl: `https://dashboard.tosspayments.com/receipt/${paymentKey}` // 데모용 링크
            });

            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (err) {
          console.error("Payment Confirmation Error:", err);
        }
      };
      confirmPayment();
    } else if (isFail) {
      alert("❌ 결제에 실패하였습니다. 다시 시도해 주세요.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [safeBundles]); // bundles가 로드된 후 아이템을 찾을 수 있도록 의존성 추가

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
    { label: '메뉴', icon: '📔', tab: 'menu' },
    { label: '매장', icon: '🏠', tab: 'settings' }
  ];

  const [recognizedText, setRecognizedText] = useState("");
  const [isListening, setIsListening] = useState(false);

  // 음성 인식 설정
  const startVoiceRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("이 브라우저는 음성 인식을 지원하지 않습니다. 크롬을 권장합니다.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true; // 실시간 결과 확인
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setRecognizedText("듣고 있습니다...");
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setRecognizedText(speechToText); // 인식된 텍스트 업데이트

      if (event.results[0].isFinal) {
        // 인식이 완료되면 잠시 보여준 후 전송
        setTimeout(() => {
          handleSendMessage(speechToText, undefined, activeTab);
          setIsListening(false);
          setRecognizedText("");
        }, 1500);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setRecognizedText("");
    };

    recognition.onend = () => {
      // isFinal에서 처리하므로 여기서는 딜레이 없이 닫히지 않게 조절 가능
    };

    recognition.start();
  };

  const isCustomerMode = new URLSearchParams(window.location.search).get('mode') === 'customer';

  const renderContent = () => {
    switch (activeTab) {
      case 'guide': return <ConversationalUI bundles={bundles} storeName={storeName} />;
      case 'order': return <CustomerOrder bundles={bundles} />;
      case 'kitchen': return <KitchenDisplay />;
      case 'counter': return <CounterPad bundles={bundles} messages={[]} onSendMessage={handleSendMessage} />;
      case 'display': return <DisplayBoard bundles={bundles} />;
      case 'menu': return <MenuManager bundles={bundles} />;
      case 'settings': return <StoreManager bundles={bundles} onNavigate={navigateTo as any} />;
      case 'qr': return <QRManager />;
      case 'paper': return <PaperViewer />;
      case 'home': return <AdminDashboard bundles={bundles} />;
      case 'inventory': return <LogicInventory />;
      default: return <ConversationalUI bundles={bundles} storeName={storeName} />;
    }
  };

  return (
    <div className={`saas-container mobile-full-mode ${isCustomerMode ? 'customer-mode' : ''}`}>
      {/* 🧾 영수증 모달 */}
      {receiptData && (
        <ReceiptModal 
          {...receiptData} 
          onClose={() => setReceiptData(null)} 
        />
      )}

      {/* 🎙️ 음성 인식 오버레이 */}
      {isListening && (
        <div className="voice-overlay animate-fade-in" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.95)', zIndex: 99999,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          padding: '40px', textAlign: 'center', backdropFilter: 'blur(15px)'
        }}>
          <div className="voice-wave-premium" style={{ fontSize: '6rem', marginBottom: '30px' }}>🎙️</div>
          <h2 style={{ color: 'white', fontSize: '2rem', marginBottom: '15px' }}>{recognizedText}</h2>
          <p style={{ color: 'var(--accent-orange)', fontSize: '1.2rem', opacity: 0.8 }}>
            {recognizedText === "듣고 있습니다..." ? "원하시는 작업을 말씀해 주세요" : "인식 완료! 잠시 후 처리됩니다."}
          </p>
          <div className="pulse-ring-premium"></div>
        </div>
      )}

      {/* 🌑 사이드 메뉴 패널 (Drawer) - 고객 모드에선 숨김 */}
      {!isCustomerMode && (
        <>
          <div className={`side-menu-drawer ${isMenuOpen ? 'open' : ''}`}>
              <div className="drawer-header">
                  <div className="drawer-logo">{storeName} <span>PRO</span></div>
                  <button className="close-btn" onClick={() => setIsMenuOpen(false)}>×</button>
              </div>
              <nav className="drawer-nav">
                  <div className="nav-group">시스템 관리</div>
                  <button onClick={() => navigateTo('settings')}>⚙️ 매장 마스터 설정</button>
                  <button onClick={() => navigateTo('inventory')}>🧠 AI 지식 인벤토리</button>
                  <button onClick={() => navigateTo('paper')}>📄 AI 운영 시스템 논문 보기</button>
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
        <div className="top-bar-center"><span className="store-name">{storeName}</span></div>
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
            <div 
              key={idx} 
              className={`nav-item-9 ${item.special ? 'mic-special' : ''} ${activeTab === item.tab ? 'active' : ''}`} 
              onClick={() => {
                if (item.special) {
                  startVoiceRecognition();
                } else {
                  navigateTo(item.tab as MainTab);
                }
              }}
            >
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
