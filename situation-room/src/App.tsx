import { useState, useEffect } from 'react';
import './App.css';
import { KitchenDisplay } from './components/KitchenDisplay';
import { API_BASE, TOSS_CLIENT_KEY } from './config';
import { AdminDashboard } from './components/AdminDashboard';
import { MenuManager } from './components/MenuManager';
import { DisplayBoard } from './components/DisplayBoard';
import { StoreManager } from './components/StoreManager';
import { CounterPad } from './components/CounterPad';
import { QRManager } from './components/QRManager';
import { WifiQRManager } from './components/WifiQRManager';
import { TechInfo } from './components/TechInfo';
import { PaperViewer } from './components/PaperViewer';
import { LogicInventory } from './components/LogicInventory';
import { ReceiptModal } from './components/ReceiptModal';
import { HRManager } from './components/HRManager';
import { WaitingManager } from './components/WaitingManager';
import { ReservationManager } from './components/ReservationManager';
import { Login } from './components/Login';
import { CallManager } from './components/CallManager';
import { StoreManualEditor } from './components/StoreManualEditor';
import { ParkingManager } from './components/ParkingManager';
import { PointsManager } from './components/PointsManager';
import QROrderFlow from './components/v2/QROrderFlow';
import { AdminStoreManager } from './components/AdminStoreManager';
import { NotificationToast } from './components/NotificationToast';
import { WelcomeHub } from './components/WelcomeHub';
import { useSituation } from './hooks/useSituation';
import { useStoreFilter } from './hooks/useStoreFilter';
import { useStoreSync } from './hooks/useStoreSync';
import { TopBar } from './layout/TopBar';
import { BottomNav } from './layout/BottomNav';
import { SideDrawer } from './layout/SideDrawer';

import './components/ConversationalUI.css';
import './components/SideMenu.css';

type MainTab = 'guide' | 'order' | 'orderV2' | 'home' | 'kitchen' | 'counter' | 'display' | 'settings' | 'inventory' | 'menu' | 'qr' | 'wifi' | 'paper' | 'tech' | 'hr' | 'waiting' | 'reserve' | 'stats' | 'admin' | 'call' | 'manual' | 'parking' | 'points';

function App() {
  const { storeId, storeName: initialStoreName, updateStore } = useStoreFilter();
  const { bundles, handleSendMessage } = useSituation(storeId, initialStoreName);
  const { flashingTabs, callCount, waitingCount, parkingCount, reservationCount, callFlashing, waitingFlashing, parkingFlashing, resetFlash, decrementCall, decrementWaiting, decrementParking } = useStoreSync(storeId);

  const [user, setUser] = useState<any>(null);
  const [reminderQueue, setReminderQueue] = useState<any[]>([]);
  const [selectedAdminStore, setSelectedAdminStore] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('storeId') || null;
  });
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    return (localStorage.getItem('situation_active_tab') as MainTab) || 'guide';
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user || user.role === 'customer') return;
    const check = async () => {
      try {
        const url = storeId && storeId !== 'Total' ? `${API_BASE}/api/reservation/all?store_id=${storeId}` : `${API_BASE}/api/reservation/all`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const now = Date.now();
        const reminders = data
          .filter((r: any) => {
            if (!['requested', 'confirmed'].includes(r.status)) return false;
            
            const isToday = new Date(r.reserved_time).toDateString() === new Date().toDateString();
            if (isToday) return false;

            const diffH = (new Date(r.reserved_time).getTime() - now) / 3600000;
            if (diffH <= 0) return false;
            if (diffH <= 3 && !r.contact_confirmed_3hour) return true;
            if (diffH <= 24 && !r.contact_confirmed_1day) return true;
            return false;
          })
          .sort((a: any, b: any) => new Date(a.reserved_time).getTime() - new Date(b.reserved_time).getTime());
        setReminderQueue(reminders);
      } catch {}
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [user]);

  const handleContactConfirm = async (r: any) => {
    const diffH = (new Date(r.reserved_time).getTime() - Date.now()) / 3600000;
    const contactType = diffH <= 3 ? '3hour' : '1day';
    try {
      await fetch(`${API_BASE}/api/reservation/contact-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: r.reservation_id, contact_type: contactType }),
      });
      setReminderQueue(prev => prev.filter((x: any) => x.reservation_id !== r.reservation_id));
    } catch {}
  };

  // 🌟 활성 대시보드 탭이 변경될 때마다 브라우저 로컬 저장소에 기억하여 F5 새로고침 시 화면을 복원합니다.
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('situation_active_tab', activeTab);
    }
  }, [activeTab]);

  const [receiptData, setReceiptData] = useState<{
    orderId: string;
    totalPrice: number;
    paymentMethod: string;
    items: { name: string; value: string }[];
    receiptUrl?: string;
  } | null>(null);

  const [storeDetails, setStoreDetails] = useState<any>(null);

  const fetchStoreDetails = () => {
    if (storeId && user && user.role !== 'customer') {
      fetch(`${API_BASE}/api/stores`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const currentStore = data.find((s: any) => s.store_id === storeId);
            if (currentStore) {
              setStoreDetails(currentStore);
            } else {
              setStoreDetails(null);
            }
          }
        })
        .catch(err => console.error('Error fetching store details:', err));
    }
  };

  useEffect(() => {
    fetchStoreDetails();
  }, [storeId, user]);

  const safeBundles = Array.isArray(bundles) ? bundles : [];
  const isCustomerMode = user?.role === 'customer';
  
  // 지식 번들에서 상호명을 찾아 storeName 업데이트 (필요한 경우)
  const storeBundle = safeBundles.find(b => b.type === 'StoreConfig' && (b.store_id === storeId || !b.store_id));
  const resolvedStoreName = storeBundle?.items?.find(i => i.name === '상호명' || i.name === 'brand')?.value || storeDetails?.store_name || user?.storeName || initialStoreName || '우리식당';

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
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      if (mode === 'kitchen' || mode === 'counter' || mode === 'hr' || mode === 'qr') {
        setActiveTab(mode as MainTab);
      } else {
        setActiveTab('home');
      }
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('mqnet_user');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    
    // 1. URL 모드 체크 (고객 주문 및 고객 대기 등록 등)
    if (mode === 'customer') {
      const guest = { id: 'guest', name: '손님', role: 'customer' };
      setActiveTab('orderV2');
      setUser(guest);
      return;
    } else if (mode === 'waiting' || mode === 'reserve') {
      const guest = { id: 'guest', name: '손님', role: 'customer' };
      setActiveTab(mode as MainTab);
      setUser(guest);
      return;
    } else if (mode === 'manual' || (mode === 'hr' && params.get('action') === 'checkin')) {
      // 매뉴얼 QR 스캔 또는 출퇴근 QR 스캔 시 관리자 로그인을 거치지 않고 프리패스로 가상 직원 역할 부여!
      const staffGuest = { id: 'staff_guest', name: '직원', role: 'staff' };
      setUser(staffGuest);
      setActiveTab(mode === 'manual' ? 'manual' : 'hr');
      return;
    } 

    // 2. 저장된 세션 복구 (영구 로그인)
    const savedUser = localStorage.getItem('mqnet_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        if (u.role !== 'customer') {
          // URL 파라미터로 명시적인 목적지(mode)가 있다면 home 대신 해당 탭 유지
          if (mode === 'kitchen' || mode === 'counter' || mode === 'hr' || mode === 'qr') {
            // 아래의 mode 체크 로직에서 처리하도록 둠
          } else {
            setActiveTab('home');
          }
        }
      } catch (e) {
        localStorage.removeItem('mqnet_user');
      }
    }

    if (mode === 'kitchen') {
      setActiveTab('kitchen');
    } else if (mode === 'counter') {
      setActiveTab('counter');
    } else if (mode === 'hr') {
      setActiveTab('hr');
    }
  }, []);

  // 앱 마운트 시 히스토리 항목 확보 (back 버튼이 앱을 이탈하지 않도록)
  useEffect(() => {
    window.history.pushState({ type: 'app' }, '');
  }, []);

  // --- Global Back Button Handling ---
  useEffect(() => {
    const handlePopState = () => {
      // 소모된 히스토리 항목을 즉시 보충하여 다음 back도 앱 안에서 처리
      window.history.pushState({ type: 'app' }, '');

      if (isMenuOpen) { setIsMenuOpen(false); return; }
      if (receiptData) { setReceiptData(null); return; }
      if (isListening) { setIsListening(false); return; }
      if (!isCustomerMode) { setActiveTab('counter'); }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMenuOpen, receiptData, isListening, isCustomerMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isSuccess = params.get('payment_success') === 'true';
    const paymentKey = params.get('paymentKey');
    const orderId = params.get('order_id') || params.get('orderId');
    const amount = Number(params.get('amount') || 0);

    if (isSuccess && orderId) {
      const confirmPayment = async () => {
        try {
          const apiUrl = API_BASE;
          const res = await fetch(`${apiUrl}/api/payment/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentKey, orderId, amount })
          });
          const result = await res.json();
          if (result.status === 'success') {
            localStorage.setItem('payment_success_flag', 'true');
            // localStorage에 미리 저장한 장바구니 items를 복원 (bundle 타이밍 문제 방지)
            const savedItems = localStorage.getItem('receipt_items_' + orderId);
            const items = savedItems ? JSON.parse(savedItems) : [];
            localStorage.removeItem('receipt_items_' + orderId);
            
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
          localStorage.setItem('payment_success_flag', 'true');
          // localStorage에 미리 저장한 장바구니 items를 복원
          const savedItems = localStorage.getItem('receipt_items_' + orderId);
          const items = savedItems ? JSON.parse(savedItems) : [];
          localStorage.removeItem('receipt_items_' + orderId);
          
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
    
    // Scroll to top when changing tabs
    setTimeout(() => {
      const mainContent = document.querySelector('.saas-main-full');
      if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'instant' });
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }, 0);
  };

  const navItems = [
    { label: '호출', icon: '🔔', tab: 'call', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '대기', icon: '🛎️', tab: 'waiting', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '비서', icon: '🎤', tab: 'guide', roles: ['admin', 'owner', 'manager', 'staff'], special: true },
    { label: '주차', icon: '🚗', tab: 'parking', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '포인트', icon: '🪙', tab: 'points', roles: ['admin', 'owner', 'manager', 'staff'] },
    { label: '예약', icon: '📅', tab: 'reserve', roles: ['admin', 'owner', 'manager', 'staff'] },
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
            navigateTo("counter");
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

  if (user?.role === 'admin' && !selectedAdminStore) {
    return (
      <AdminStoreManager 
        onSelectStore={(id, name) => {
          setSelectedAdminStore(id);
          updateStore(id, name);
          setActiveTab('counter');
        }}
        onLogout={handleLogout}
        bundles={bundles}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'guide':
      case 'orderV2': {
        const urlStoreId = new URLSearchParams(window.location.search).get('storeId');
        const effectiveStoreId = storeId || urlStoreId || '';
        return <QROrderFlow bundles={bundles} storeId={effectiveStoreId} storeName={storeName} onNavigate={navigateTo as any} />;
      }
      case 'kitchen': return <KitchenDisplay />;
      case 'counter': return <CounterPad storeId={storeId} bundles={bundles} />;
      case 'display': return <DisplayBoard bundles={bundles} />;
      case 'menu': return <MenuManager bundles={bundles} onNavigate={navigateTo as any} />;
      case 'settings': return <StoreManager bundles={bundles} user={user} onNavigate={navigateTo as any} />;
      case 'qr': return <QRManager bundles={bundles} storeId={storeId} storeName={storeName} />;
      case 'wifi': return <WifiQRManager />;
      case 'tech': return <TechInfo />;
      case 'paper': return <PaperViewer />;
      case 'stats':
      case 'admin': return <AdminDashboard bundles={bundles} storeDetails={storeDetails} user={user} activeTab={activeTab} />;
      case 'home':
        return (
          <WelcomeHub
            user={user}
            bundles={bundles}
            storeName={storeName}
            storeDetails={storeDetails}
            onReloadStoreDetails={fetchStoreDetails}
            onNavigate={navigateTo as any}
            onProfileUpdated={(updatedUser) => {
              setUser(updatedUser);
              localStorage.setItem('mqnet_user', JSON.stringify(updatedUser));
            }}
            onLogout={handleLogout}
          />
        );
      case 'call': return <CallManager storeId={storeId} bundles={bundles} onComplete={decrementCall} />;
      case 'inventory': return <LogicInventory />;
      case 'manual': return <StoreManualEditor storeId={storeId} user={user} />;
      case 'hr': return <HRManager bundles={bundles} user={user} storeDetails={storeDetails} />;
      case 'waiting': return <WaitingManager bundles={bundles} onSendMessage={(txt, sId, sName) => handleSendMessage(txt, undefined, 'waiting', sId, sName)} onComplete={decrementWaiting} />;
      case 'reserve': return <ReservationManager userRole={user?.role} bundles={bundles} />;
      case 'parking': return <ParkingManager storeId={storeId} onComplete={decrementParking} />;
      case 'points': return <PointsManager storeId={storeId} />;
      default: return <QROrderFlow bundles={bundles} storeId={storeId} storeName={storeName} onNavigate={navigateTo as any} />;
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

      {reminderQueue.length > 0 && !isCustomerMode && user && (() => {
        const r = reminderQueue[0];
        const diffH = (new Date(r.reserved_time).getTime() - Date.now()) / 3600000;
        const is3h = diffH <= 3;
        const dtStr = (() => {
          const d = new Date(r.reserved_time);
          return `${d.getMonth()+1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        })();
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
            <div style={{ background: 'var(--surface)', borderRadius: '24px', padding: '32px', width: '100%', maxWidth: '420px', border: `2px solid ${is3h ? '#ef4444' : '#f59e0b'}`, boxShadow: `0 20px 60px ${is3h ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <span style={{ fontSize: '2rem' }}>{is3h ? '🚨' : '📞'}</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '1.1rem', color: is3h ? '#dc2626' : '#92400e' }}>
                    {is3h ? '3시간 전 예약 확인 필요' : '1일 전 예약 확인 필요'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    고객에게 전화로 예약을 확인해 주세요
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-main)', borderRadius: '14px', padding: '18px', marginBottom: '20px', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '8px' }}>{r.customer_name}</div>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <span>🕐 {dtStr}</span>
                  {r.phone_number && <span>📞 {r.phone_number}</span>}
                  <span>👥 {r.party_size}명</span>
                  {r.table_id && <span>🪑 {r.table_id}</span>}
                </div>
                {r.notes && <div style={{ marginTop: '8px', fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>💬 {r.notes}</div>}
              </div>
              {reminderQueue.length > 1 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '12px' }}>
                  외 {reminderQueue.length - 1}건 추가 알림 대기 중
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setReminderQueue(prev => prev.slice(1))}
                  style={{ flex: 1, padding: '14px', background: 'var(--bg-main)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                  나중에
                </button>
                <button
                  onClick={() => handleContactConfirm(r)}
                  style={{ flex: 2, padding: '14px', background: is3h ? '#ef4444' : '#f59e0b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' }}>
                  ✓ 전화 확인 완료
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {isListening && (
        <div className="voice-overlay animate-fade-in">
          <div className="voice-wave-premium">🎙️</div>
          <h2>{recognizedText || "듣고 있습니다..."}</h2>
          <div className="pulse-ring-premium"></div>
        </div>
      )}

      {/* ── Side Drawer (includes overlay) ── */}
      {!isCustomerMode && user && (
        <SideDrawer
          isOpen={isMenuOpen}
          storeName={storeName}
          user={user}
          onClose={() => setIsMenuOpen(false)}
          onNavigate={(tab) => navigateTo(tab as MainTab)}
          onLogout={handleLogout}
          onSwitchStore={() => {
            setSelectedAdminStore(null);
            setIsMenuOpen(false);
          }}
        />
      )}

      {/* ── Top Bar ── */}
      <TopBar
        storeName={storeName}
        user={user}
        currentTime={currentTime}
        isCustomerMode={isCustomerMode}
        onMenuOpen={() => setIsMenuOpen(true)}
        onSwitchStore={() => setSelectedAdminStore(null)}
      />

      <main className="saas-main-full" style={{ paddingBottom: isCustomerMode ? '0' : '80px' }}>
        <div className="view-content">
          {user ? renderContent() : <Login onLogin={handleLogin} bundles={bundles} />}
        </div>
      </main>

      {!isCustomerMode && user && activeTab !== 'order' && activeTab !== 'orderV2' && (
        <BottomNav
          navItems={navItems}
          activeTab={activeTab}
          flashingTabs={flashingTabs}
          callCount={callCount}
          waitingCount={waitingCount}
          parkingCount={parkingCount}
          reservationCount={reservationCount}
          callFlashing={callFlashing}
          waitingFlashing={waitingFlashing}
          parkingFlashing={parkingFlashing}
          onNavigate={(tab) => navigateTo(tab as MainTab)}
          onVoice={startVoiceRecognition}
        />
      )}

      {!isCustomerMode && user && (
        <NotificationToast
          storeId={storeId}
          onNavigate={(tab) => navigateTo(tab as MainTab)}
        />
      )}
    </div>
  );
}

// --- 토스 결제 및 승인 대행용 슬릭 팝업 핸들러 컴포넌트 ---
function PaymentPopupHandler({ safeBundles }: { safeBundles: any[] }) {
  if (safeBundles.length < 0) console.log(safeBundles);
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
          const apiUrl = API_BASE;
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
          const apiUrl = API_BASE;
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
