import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './MobileOrderV2.css';
import type { BundleData } from '../../types';
import { WS_BASE, API_BASE } from '../../config';
import { PaymentModal } from '../PaymentModal';

interface Props {
  bundles: BundleData[];
  storeId: string;
  storeName: string;
  onNavigate?: (tab: any) => void;
}

interface MenuItem {
  name: string;
  price: number;
  icon: string;
  category: string;
  description: string;
  qty?: number;
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  qty?: number;
}

interface Order {
  order_id: string;
  order_seq: number;
  total_price: number;
  status: string;
  payment_status: string;
  items: OrderItem[];
}

const MobileOrderV2: React.FC<Props> = ({ bundles, storeId, storeName, onNavigate }) => {
  // --- States ---
  const [cart, setCart] = useState<MenuItem[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [isOrdering, setIsOrdering] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [cartPos, setCartPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [userPhone] = useState('');
  const [aiStoryContent, setAiStoryContent] = useState({ title: '', body: '', icon: '🍽️' });

  // --- Memos & Config ---
  const tableNo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('table') || '3';
  }, []);
  
  const tableId = useMemo(() => `T${tableNo.padStart(2, '0')}`, [tableNo]);

  const deviceId = useMemo(() => {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = 'DEV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      localStorage.setItem('device_id', id);
    }
    return id;
  }, []);

  const menus = useMemo(() => {
    const safeBundles = Array.isArray(bundles) ? bundles : [];
    const menuBundle = safeBundles.find(b => b.type === 'Menus' && (b.store_id === storeId || !b.store_id));
    if (!menuBundle) return [];
    
    return menuBundle.items.map((item: any) => {
        const priceNum = parseInt(item.value.replace(/[^0-9]/g, '')) || 0;
        const nameClean = item.name.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/, '').trim();
        
        // --- Image Selection Logic ---
        let photoUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=200&h=200"; // Default
        if (nameClean.includes('에스프레소')) photoUrl = "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=200&h=200";
        else if (nameClean.includes('아메리카노')) photoUrl = "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=200&h=200";
        else if (nameClean.includes('스테이크')) photoUrl = "https://images.unsplash.com/photo-1546241072-48010ad2862c?auto=format&fit=crop&q=80&w=200&h=200";
        else if (nameClean.includes('파스타')) photoUrl = "https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&q=80&w=200&h=200";
        else if (nameClean.includes('와인')) photoUrl = "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=200&h=200";
        else if (nameClean.includes('커피')) photoUrl = "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=200&h=200";

        return {
            name: nameClean,
            price: priceNum,
            icon: photoUrl, // Reusing icon field for image URL for simplicity
            category: item.category || '추천',
            description: item.description || '최고의 재료로 만든 시그니처 메뉴'
        };
    });
  }, [bundles, storeId]);

  const categories = useMemo(() => ['전체', ...new Set(menus.map(m => m.category))], [menus]);
  const totalPrice = useMemo(() => cart.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0), [cart]);
  const sessionTotal = useMemo(() => myOrders.reduce((sum, order: Order) => sum + order.total_price, 0), [myOrders]);

  // --- Functions ---
  const fetchMySession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/session/${tableId}?store_id=${storeId}`);
      const data = await res.json();
      if (data && data.session && data.session.status === 'active') {
        setHasActiveSession(true);
        setMyOrders(data.orders || []);
      } else {
        setHasActiveSession(false);
      }
    } catch (err) {
      console.error("Session sync failed", err);
    }
  }, [tableId, storeId]);

  const addToCart = useCallback((menu: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.name === menu.name);
      if (existing) {
        return prev.map(c => c.name === menu.name ? { ...c, qty: (c.qty || 0) + 1 } : c);
      }
      return [...prev, { ...menu, qty: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((name: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.name === name);
      if (existing && (existing.qty || 0) > 1) {
        return prev.map(c => c.name === name ? { ...c, qty: (c.qty || 0) - 1 } : c);
      }
      return prev.filter(c => c.name !== name);
    });
  }, []);

  const deleteFromCart = useCallback((name: string) => {
    setCart(prev => prev.filter(c => c.name !== name));
  }, []);

  // --- Effects ---
  useEffect(() => {
    fetchMySession();
    const wsUrl = `${WS_BASE}/ws/table/${tableId}`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (['STATUS_UPDATE', 'NEW_ORDER', 'SESSION_OPENED'].includes(data.type)) {
        fetchMySession();
      } else if (data.type === 'SESSION_CLOSED') {
        window.location.reload();
      }
    };
    const timer = setInterval(fetchMySession, 5000);
    return () => { ws.close(); clearInterval(timer); };
  }, [tableId, storeId, fetchMySession]);

  // --- Payment Result Handling ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isSuccess = params.get('payment_success') === 'true';
    const isFail = params.get('payment_fail') === 'true';

    if (isSuccess) {
      // 결제 성공 시 메시지 표시 및 화면 갱신
      setTimeout(() => {
        alert('✅ 결제가 완료되었습니다.\n주문이 정상적으로 접수되어 조리를 시작합니다.');
        fetchMySession();
        setShowProgress(true); // 진행 현황 화면 표시
        
        // URL 파라미터 제거 (중복 알림 방지)
        const newUrl = window.location.pathname + window.location.search.replace(/[?&]payment_success=true[^&]*/, '').replace(/[?&]order_id=[^&]*/, '').replace(/[?&]amount=[^&]*/, '');
        window.history.replaceState({}, '', newUrl || '/');
      }, 500);
    } else if (isFail) {
      // 결제 실패 시 메시지 표시
      setTimeout(() => {
        alert('❌ 결제에 실패하였습니다.\n네트워크 상태를 확인하시거나 카드 정보를 다시 확인해 주세요.');
        
        const newUrl = window.location.pathname + window.location.search.replace(/[?&]payment_fail=true[^&]*/, '').replace(/[?&]order_id=[^&]*/, '');
        window.history.replaceState({}, '', newUrl || '/');
      }, 500);
    }
  }, [fetchMySession]);

  // --- Draggable Cart Logic ---
  const handleDragStart = (e: any) => {
    isDragging.current = false;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartPos.current = { x: clientX - cartPos.x, y: clientY - cartPos.y };
    
    const moveHandler = (me: any) => {
      isDragging.current = true;
      const mX = me.touches ? me.touches[0].clientX : me.clientX;
      const mY = me.touches ? me.touches[0].clientY : me.clientY;
      setCartPos({
        x: mX - dragStartPos.current.x,
        y: mY - dragStartPos.current.y
      });
    };
    
    const endHandler = () => {
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', endHandler);
      window.removeEventListener('touchmove', moveHandler);
      window.removeEventListener('touchend', endHandler);
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', endHandler);
    window.addEventListener('touchmove', moveHandler, { passive: false });
    window.addEventListener('touchend', endHandler);
  };

  // --- Android/Browser Back Button Handling ---
  useEffect(() => {
    const handlePopState = () => {
      // 만약 서브 뷰가 열려있다면 닫고 브라우저 이동은 막음
      if (showHistory || showProgress) {
        setShowHistory(false);
        setShowProgress(false);
      }
    };

    if (showHistory || showProgress) {
      window.history.pushState({ subView: true }, '');
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.addEventListener('popstate', handlePopState);
  }, [showHistory, showProgress]);

  useEffect(() => {
    fetch(`${API_BASE}/api/checkin/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNo, deviceId, store: storeName, store_id: storeId })
    }).catch(err => console.error("Checkin Error:", err));
  }, [tableNo, deviceId, storeName, storeId]);

  const generateAiStory = useCallback((items: MenuItem[]) => {
    if (items.length === 0) return;
    const firstItem = items[0];
    const stories: any = {
      '스테이크': { title: '🥩 왕의 요리, 스테이크', body: '스테이크의 어원은 "구운 고기"를 뜻하는 스칸디나비아어 "steik"에서 유래했습니다. 고단백 영양소뿐만 아니라 철분이 풍부해 활력을 불어넣어 주죠.', icon: '🥩' },
      '파스타': { title: '🍝 이탈리아의 자부심, 파스타', body: '파스타는 13세기 마르코 폴로가 중국에서 가져왔다는 설이 유명하지만, 사실 고대 로마 시대부터 즐겨 먹던 요리입니다. 듀럼밀 세몰리나로 만들어 천천히 소화되는 건강한 탄수화물이죠.', icon: '🍝' },
      '커피': { title: '☕ 에티오피아의 눈물, 커피', body: '9세기 에티오피아의 목동 칼디가 발견한 커피는 전 세계에서 가장 사랑받는 음료가 되었습니다. 적당한 카페인은 집중력을 높여주고 항산화 성분이 풍부합니다.', icon: '☕' },
      '와인': { title: '🍷 신의 물방울, 와인', body: '인류 역사와 함께해온 와인은 항산화제인 레스베라트롤이 풍부해 심혈관 건강에 도움을 줄 수 있습니다. 주문하신 메뉴와 환상적인 조화를 이룰 거예요.', icon: '🍷' }
    };
    const foundKey = Object.keys(stories).find(key => firstItem.name.includes(key));
    if (foundKey) {
      setAiStoryContent(stories[foundKey]);
    } else {
      setAiStoryContent({
        title: `✨ ${firstItem.name}의 미식 이야기`,
        body: `주문하신 ${firstItem.name}은(는) 셰프님이 가장 정성을 들여 준비하는 메뉴 중 하나입니다. 신선한 재료와 완벽한 조리법으로 최고의 맛을 선사해 드릴게요.`,
        icon: '🍳'
      });
    }
  }, []);

  const handleUpdateOrderItem = useCallback(async (orderId: string, items: OrderItem[]) => {
    try {
      const filteredItems = items.filter(i => (i.quantity || i.qty || 0) > 0);
      if (filteredItems.length === 0) {
        await fetch(`${API_BASE}/api/order/status`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId, status: 'cancelled' })
        });
      } else {
        await fetch(`${API_BASE}/api/order/update-items`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId, items: filteredItems })
        });
      }
      fetchMySession();
    } catch (err) { console.error('Update Item Error:', err); }
  }, [fetchMySession]);

  const executeOrderWithPayment = useCallback(async (method: string, extraData?: any) => {
    setIsOrdering(true);
    setShowPayModal(false);
    try {
      const currentCart = [...cart];
      
      // 1. 주문 생성 요청
      const res = await fetch(`${API_BASE}/api/order/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId, device_id: deviceId, store_id: storeId,
          items: cart.map(c => ({ name: c.name, quantity: c.qty || 1, price: c.price, qty: c.qty || 1 })),
          total_price: totalPrice,
          // 카운터 결제는 unpaid, 카드는 결제 대기(pending) 상태로 시작
          payment_status: (method === '카운터에서 결제' || method === '현금 결제' || method === 'cash') ? 'unpaid' : 'pending',
          payment_method: method,
          metadata: extraData
        })
      });

      if (res.ok) {
        const orderData = await res.json();
        const orderId = orderData.order_id;

        // 2. 결제 수단별 분기 처리
        if (method === '카운터에서 결제' || method === '현금 결제' || method === 'cash') {
          // 카운터에서 결제 (현금 등) -> 즉시 완료 단계로 이동
          setCart([]);
          fetchMySession();
          generateAiStory(currentCart);
          setShowProgress(true);
        } else {
          // 카드 / 계좌이체 -> 토스 결제창 호출
          const tossPayments = (window as any).TossPayments('test_ck_D5b4Zne68wxL1Pn6k0m8rlzYWBn1');
          const tossMethod = method.includes('카드') ? '카드' : '계좌이체';
          
          await tossPayments.requestPayment(tossMethod, {
            amount: totalPrice,
            orderId: orderId,
            orderName: `${currentCart[0].name}${currentCart.length > 1 ? ` 외 ${currentCart.length-1}건` : ''}`,
            customerName: '손님',
            successUrl: `${window.location.origin}${window.location.pathname}?payment_success=true&order_id=${orderId}&amount=${totalPrice}`,
            failUrl: `${window.location.origin}${window.location.pathname}?payment_fail=true&order_id=${orderId}`,
          });
        }
      }
    } catch (err) { 
      console.error("Order process failed", err);
      alert('주문 처리 중 오류가 발생했습니다.');
    } finally { 
      setIsOrdering(false); 
    }
  }, [tableId, deviceId, storeId, cart, totalPrice, fetchMySession, generateAiStory]);

  // --- Render Functions ---

  const renderProgressScreen = () => {
    const latestOrder = myOrders.length > 0 ? myOrders[myOrders.length - 1] : null;
    const status = latestOrder?.status || 'pending';
    const isPaid = latestOrder?.payment_status === 'paid' || latestOrder?.payment_status === 'prepaid';

    const steps = [
      { label: '좌석', icon: '🪑', active: true },
      { label: '주문', icon: '📝', active: true },
      { label: '조리', icon: '🔥', active: status === 'cooking' || status === 'ready' || status === 'served' || isPaid, pulse: status === 'cooking' },
      { label: '서빙', icon: '🚚', active: status === 'served' || isPaid, pulse: status === 'served' && !isPaid },
      { label: '결제', icon: '✅', active: isPaid, pulse: isPaid }
    ];

    return (
      <div className="payment-modal-overlay" style={{ zIndex: 11000, overflowY: 'auto', padding: '20px 10px' }}>
        <div className="glass-panel animate-pop-in" style={{ 
          width: '100%', maxWidth: '450px', padding: '25px', 
          background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid rgba(249,115,22,0.3)',
          borderRadius: '30px'
        }}>
          <h2 style={{ color: '#f97316', fontSize: '1.4rem', fontWeight: 900, marginBottom: '25px', textAlign: 'center' }}>주문 진행 현황</h2>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', padding: '0 10px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '15px', left: '10%', right: '10%', height: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 0 }}></div>
            {steps.map((step, i) => (
              <div key={i} style={{ textAlign: 'center', zIndex: 1, flex: 1 }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  background: step.active ? '#f97316' : '#270c40ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', margin: '0 auto 8px',
                  boxShadow: step.pulse ? '0 0 15px #f97316' : 'none',
                  animation: step.pulse ? 'pulse-light 2s infinite' : 'none',
                  transition: 'all 0.5s'
                }}>
                  {step.icon}
                </div>
                <div style={{ fontSize: '10px', color: step.active ? 'white' : '#64748b', fontWeight: step.active ? 800 : 400 }}>{step.label}</div>
              </div>
            ))}
          </div>

          <div className="glass-card" style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
            <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '10px' }}>{aiStoryContent.icon}</div>
            <h3 style={{ color: '#f97316', textAlign: 'center', margin: '0 0 10px 0', fontSize: '1.2rem' }}>{aiStoryContent.title}</h3>
            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6, textAlign: 'center', margin: 0 }}>
              {aiStoryContent.body}
            </p>
          </div>

          <div style={{ background: 'rgba(249,115,22,0.1)', padding: '15px', borderRadius: '20px', border: '1px dashed rgba(249,115,22,0.4)', marginBottom: '25px' }}>
            <h4 style={{ color: 'white', fontSize: '14px', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>🎙️ 말로 더 주문해 보세요!</h4>
            <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
              마이크를 누르고 <strong>"콜라 하나 더"</strong> 또는 <strong>"물 좀 주세요"</strong>라고 말씀해 보세요.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setShowProgress(false); setShowHistory(true); }}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '12px', borderRadius: '15px', fontWeight: 700 }}>
              주문현황 보기
            </button>
            <button onClick={() => setShowProgress(false)}
              style={{ flex: 1, background: '#f97316', border: 'none', color: 'white', padding: '12px', borderRadius: '15px', fontWeight: 800 }}>
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryView = () => (
    <div className="history-view animate-fade-in" style={{ fontSize: '0.65rem', padding: '15px 15px 100px' }}>
      <h2 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '15px', textAlign: 'center' }}>내 주문 현황</h2>
      <div className="orders-stack">
        {myOrders.length === 0 ? <p style={{ textAlign:'center', opacity:0.5 }}>주문 내역이 없습니다.</p> : 
          myOrders.map((order: Order, idx) => {
            const isPaid = order.payment_status === 'paid' || order.payment_status === 'prepaid';
            const borderColor = isPaid ? '#EF4444' : (order.status === 'served' ? '#10B981' : '#F59E0B');
            return (
              <div key={idx} className="glass-card order-card" style={{ borderLeft: `3px solid ${borderColor}`, padding: '10px', marginBottom: '10px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                  <span style={{ color: borderColor, fontWeight: 800 }}>{order.order_seq}차 주문 {isPaid && ' (결제완료)'}</span>
                  <span style={{ color: borderColor, fontWeight: 900 }}>{order.status === 'cooking' ? '🔥 조리중' : '✅ 서빙완료'}</span>
                </div>
                {order.items.map((item: OrderItem, i: number) => {
                  const qty = item.quantity || item.qty || 0;
                  const isPending = order.status === 'pending' || order.status === 'pending_payment';
                  return (
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{item.name}</div>
                      </div>
                      
                      {isPending ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '8px' }}>
                          <button onClick={() => {
                            const newItems = [...order.items];
                            newItems[i] = { ...item, quantity: Math.max(0, qty - 1) };
                            handleUpdateOrderItem(order.order_id, newItems);
                          }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px' }}>-</button>
                          <span style={{ fontWeight: 800, minWidth: '15px', textAlign: 'center' }}>{qty}</span>
                          <button onClick={() => {
                            const newItems = [...order.items];
                            newItems[i] = { ...item, quantity: qty + 1 };
                            handleUpdateOrderItem(order.order_id, newItems);
                          }} style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '14px' }}>+</button>
                          <button onClick={() => {
                            const newItems = order.items.filter((_: OrderItem, idx: number) => idx !== i);
                            handleUpdateOrderItem(order.order_id, newItems);
                          }} style={{ marginLeft: '5px', background: 'none', border: 'none', color: '#ef4444', fontSize: '10px' }}>✕</button>
                        </div>
                      ) : (
                        <span style={{ fontWeight: '600' }}>{qty}개 | {(item.price * qty).toLocaleString()}원</span>
                      )}
                    </div>
                  );
                })}
                <div style={{ textAlign:'right', marginTop:'8px', borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:'5px', fontWeight:900 }}>
                  합계: {order.total_price.toLocaleString()}원
                </div>
              </div>
            );
          })
        }
        <div className="total-summary-card" style={{ textAlign:'center', padding:'20px' }}>
          <div style={{ fontSize: '1.2rem', color: '#94a3b8', marginBottom: '10px' }}>총 합계</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f97316' }}>{sessionTotal.toLocaleString()}원</div>
          
          <button 
            onClick={() => setShowHistory(false)}
            className="premium-button"
            style={{ marginTop: '25px', width: '100%', padding: '20px', fontSize: '1.2rem', borderRadius: '40px' }}
          >
            ➕ 추가 주문
          </button>
        </div>
      </div>
    </div>
  );

  const renderCartView = () => (
    <div className="cart-view animate-fade-in" style={{ padding: '20px 20px 180px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px' }}>
        <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '1.2rem', cursor: 'pointer' }}>❮</button>
        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>장바구니 확인</h2>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: '24px', padding: '20px', border: '1px solid var(--border)', marginBottom: '30px' }}>
        {cart.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: idx === cart.length - 1 ? 0 : '20px', paddingBottom: idx === cart.length - 1 ? 0 : '20px', borderBottom: idx === cart.length - 1 ? 'none' : '1px solid var(--border)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
              <div style={{ color: 'var(--accent)', fontWeight: 600 }}>{(item.price * (item.qty || 1)).toLocaleString()}원</div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--primary-soft)', padding: '4px 8px', borderRadius: '8px' }}>
                <button onClick={() => removeFromCart(item.name)} style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '16px', fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}>-</button>
                <span style={{ fontWeight: 800, minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
                <button onClick={() => addToCart(item)} style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '16px', fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}>+</button>
              </div>
              <button onClick={() => deleteFromCart(item.name)} style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', border: '1px solid #ef4444', borderRadius: '4px', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', padding: '20px', borderTop: '1px solid var(--border)', maxWidth: '500px', margin: '0 auto', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>총 주문금액</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--accent)' }}>{totalPrice.toLocaleString()}원</span>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setShowCart(false)} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', background: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
            추가 주문
          </button>
          <button 
            onClick={() => {
              setShowCart(false);
              setShowPayModal(true);
            }} 
            style={{ flex: 1.6, padding: '16px', borderRadius: '16px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 8px 20px rgba(30, 41, 59, 0.2)' }}
          >
            결제
          </button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (showCart) return renderCartView();
    if (showHistory) return renderHistoryView();
    if (showProgress) return renderProgressScreen();
    
    return (
      <>
        <div className="menu-grid">
          {menus.filter(m => activeCategory === '전체' || m.category === activeCategory).map((item, idx) => {
            const cartItem = cart.find(c => c.name === item.name);
            return (
              <div key={idx} className="menu-item-card" onClick={() => addToCart(item)}>
                <img src={item.icon} alt={item.name} className="menu-image" />
                <div className="menu-details">
                  <div className="name">{item.name}</div>
                  <div className="desc">{item.description}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <div className="price">
                      {cartItem 
                        ? `${item.price.toLocaleString()}원 x ${cartItem.qty}` 
                        : `${item.price.toLocaleString()}원`
                      }
                    </div>
                    {cartItem && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFromCart(item.name);
                        }}
                        style={{ 
                          width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'white', border: '1px solid #ef4444', borderRadius: '4px', color: '#ef4444', 
                          fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' 
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {cart.length > 0 && (
          <div 
            className="floating-cart animate-slide-up" 
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onClick={() => {
              if (!isDragging.current) setShowCart(true);
            }}
            style={{
              position: 'fixed',
              bottom: '40px',
              right: '20px',
              left: 'auto',
              width: '180px',
              height: '60px',
              transform: `translate(${cartPos.x}px, ${cartPos.y}px)`,
              zIndex: 2000,
              cursor: 'move',
              boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
              margin: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', color: 'white' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, whiteSpace: 'nowrap' }}>주문하기</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 900, whiteSpace: 'nowrap' }}>{totalPrice.toLocaleString()}원</span>
            </div>
          </div>
        )}
      </>
    );
  };

  if (!hasActiveSession) {
    return (
      <div className="mobile-v2-container flex-center">
        <div className="premium-waiting-card animate-slide-up">
          <div className="glow-circle"></div>
          <div className="waiting-content">
            <h1 className="main-title">Welcome to<br/>{storeName}</h1>
            <div className="table-badge">Table {tableNo}</div>
            <div className="status-box"><div className="spinner-small"></div><p>스마트 오더 연결 중...</p></div>
            <p className="sub-text">좌석 확인이 완료되면 자동으로 메뉴판이 활성화됩니다.</p>
            <button className="inquiry-btn-large" onClick={() => alert('직원을 호출했습니다.')}>🔔 직원 문의</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-v2-container unified-mode">
      <header className="glass-card sticky-header" style={{ padding: '0', minHeight: '160px', display: 'flex', flexDirection: 'column', zIndex: 1001 }}>
        <div style={{ padding: '20px 24px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                onClick={() => onNavigate ? onNavigate('home') : window.dispatchEvent(new CustomEvent('changeTab', { detail: 'home' }))}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-main)', padding: 0 }}
              >
                ✕
              </button>
              <h1 style={{ fontSize: '22px', margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>{storeName}</h1>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>{new Date().toLocaleDateString()} {new Date().getHours()}:{new Date().getMinutes().toString().padStart(2, '0')}</div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>[Table {tableNo}]</div>
            
            <button 
              onClick={() => setShowHistory(true)}
              style={{ 
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', 
                padding: '6px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              💳 주문내역 / 결제 (출구)
            </button>
          </div>
        </div>

        <div className="category-scroll no-scrollbar" style={{ padding: '10px 20px 15px', background: 'transparent', borderTop: '1px solid var(--border)' }}>
          {['전체', '추천', '커피', '쥬스', '주류', '음료', '기타', ...categories.filter(c => !['전체', '추천', '커피', '쥬스', '주류', '음료', '기타'].includes(c))].map(cat => (
            <button key={cat} className={`category-pill ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="mobile-main">
        {renderContent()}
      </main>

      {isOrdering && <div className="loading-overlay"><div className="spinner"></div><h3>주문 전송 중...</h3></div>}
      
      {showPayModal && (
        <PaymentModal
          totalPrice={totalPrice}
          onClose={() => setShowPayModal(false)}
          onSubmit={executeOrderWithPayment}
          initialPhone={userPhone}
          bundles={bundles}
        />
      )}
    </div>
  );
};

export default MobileOrderV2;
