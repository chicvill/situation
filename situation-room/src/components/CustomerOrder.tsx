import React, { useState, useMemo, useEffect } from 'react';
import { API_BASE } from '../config';
import { subscribeTopic } from '../services/mqttClient';
import type { BundleData } from '../types';
import { PaymentModal } from './PaymentModal';
import { PostPaymentModal } from './PostPaymentModal';

interface Props {
  bundles: BundleData[];
  storeId: string;
  storeName: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
  category: string;
  desc: string;
}

export const CustomerOrder: React.FC<Props> = ({ bundles, storeId, storeName }) => {
  const [activeCategory, setActiveCategory] = useState('전체');
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [showPayModal, setShowPayModal] = useState(false);
  const [showPostPaymentModal, setShowPostPaymentModal] = useState(false);
  const [isCartView, setIsCartView] = useState(false);
  const [isOrdered, setIsOrdered] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [isWaitingForPartyApproval, setIsWaitingForPartyApproval] = useState(false);
  const [pendingJoinRequest, setPendingJoinRequest] = useState<{ deviceId: string; sessionId: string } | null>(null);
  const [isJoinedDevice, setIsJoinedDevice] = useState(false);

  const playDingDong = () => {
    try {
      const audio = new Audio('https://www.orangefreesounds.com/wp-content/uploads/2014/09/Ding-dong.mp3');
      audio.play().catch(() => {});
    } catch {}
  };


  const tableNo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('table') || '3';
    return t.startsWith('T') ? t.replace('T', '') : t; // T03 -> 3
  }, []);
  
  const tableId = useMemo(() => `T${tableNo.padStart(2, '0')}`, [tableNo]);
  const [hasSession, setHasSession] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');


  const deviceId = useMemo(() => {
    let id = localStorage.getItem('mqnet_device_id');
    if (!id) {
      id = 'DEV_' + Math.random().toString(36).substring(2, 11).toUpperCase();
      localStorage.setItem('mqnet_device_id', id);
    }
    return id;
  }, []);

  // 세션 승인 상태 실시간 체크
  const checkSession = async () => {
    try {
      const apiUrl = API_BASE;
      // storeId를 쿼리 파라미터로 명시적으로 전달
      const res = await fetch(`${apiUrl}/api/session/${tableId}?store_id=${storeId}`);
      const data = await res.json();
      if (data && data.session && data.session.status === 'active') {
        // 합류 대기 중이었는데 활성 세션이 확인되면 (승인된 경우)
        if (isWaitingForPartyApproval) {
          setIsWaitingForPartyApproval(false);
        }
        setHasSession(true);
        setSessionId(data.session.session_id);
      } else {
        setHasSession(false);
      }
    } catch (e) {
      console.error("Session check failed", e);
    }
  };

  useEffect(() => {
    checkSession();
    const timer = setInterval(checkSession, 3000); // 3초마다 체크
    
    // 신규(store-scoped) + 레거시(situation/table) 동시 구독
    const tableHandler = (data: any) => {
      try {
        if (data.type === 'SESSION_CLOSED') {
          window.location.reload();
        } else if (data.type === 'JOIN_REQUEST') {
          setPendingJoinRequest({ deviceId: data.device_id, sessionId: data.session_id });
        } else if (data.type === 'JOIN_RESPONSE') {
          if (data.device_id === deviceId) {
            if (data.approved) {
              setIsWaitingForPartyApproval(false);
              setIsJoinedDevice(true);
              setHasSession(true);
              playDingDong();
            } else {
              alert("일행이 합류를 거절했습니다.");
              window.location.href = "/";
            }
          }
        }
      } catch (e) {
        console.error("MQTT Message Error:", e);
      }
    };
    const tableTopicNew = (storeId && storeId !== 'Total') ? `store/${storeId}/table/${tableId}` : `situation/table/${tableId}`;
    const unsubscribeTable = subscribeTopic(tableTopicNew, tableHandler);
    const unsubscribeLegacy = tableTopicNew !== `situation/table/${tableId}`
      ? subscribeTopic(`situation/table/${tableId}`, tableHandler)
      : null;

    return () => {
      clearInterval(timer);
      unsubscribeTable();
      unsubscribeLegacy?.();
    };
  }, [tableId, storeId]);

  const isApproved = hasSession;

  // 접속 시 체크인 요청
  useEffect(() => {
    if (!isApproved && !isWaitingForPartyApproval) {
      fetch(`${API_BASE}/api/checkin/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNo, deviceId, store: storeName, store_id: storeId })
      })
      .then(res => res.json())
      .then(data => {
        if (data.session && data.session.session_id) {
          setSessionId(data.session.session_id);
        }
        if (data.status === 'waiting_party_approval') {
          setIsWaitingForPartyApproval(true);
        } else if (data.is_joined) {
          setIsJoinedDevice(true);
        }
      })
      .catch(err => console.error("Checkin Request Error:", err));
    }
  }, [tableNo, deviceId, storeName, storeId, isApproved, isWaitingForPartyApproval]);

  const handleJoinApproval = async (approved: boolean) => {
    if (!pendingJoinRequest) return;
    try {
      await fetch(`${API_BASE}/api/session/approve-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: pendingJoinRequest.sessionId,
          device_id: pendingJoinRequest.deviceId,
          table_id: tableId,
          approved
        })
      });
      setPendingJoinRequest(null);
    } catch (e) {
      console.error("Join Approval Error:", e);
    }
  };

  // 현재 테이블의 기존 주문 내역 실시간 필터링
  const myOrders = useMemo(() => {
    const safeBundles = Array.isArray(bundles) ? bundles : [];
    return safeBundles.filter(b => 
      b.type === 'Orders' && 
      (Array.isArray(b.items) ? b.items : []).some(i => i.name === '테이블' && i.value === tableNo)
    ).reverse();
  }, [bundles, tableNo]);



  const menuItems = useMemo(() => {
    const menuMap = new Map<string, MenuItem>();
    const safeBundles = Array.isArray(bundles) ? bundles : [];
    const menuBundle = safeBundles.find(b => b.type === 'Menus' && (b.store_id === storeId || !b.store_id));
    
    if (menuBundle) {
      (Array.isArray(menuBundle.items) ? menuBundle.items : []).forEach((item: any) => {
        const priceNum = typeof item.value === 'number'
            ? item.value
            : (parseInt(String(item.value || '').replace(/[^0-9]/g, '')) || 0);
        const emojiMatch = item.name.match(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/);
        const nameClean = String(item.name || '').replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/, '').trim();
        if (nameClean && !menuMap.has(nameClean)) {
            menuMap.set(nameClean, {
              id: nameClean, // 이름 기반 ID로 변경 (안정성 확보)
              name: nameClean,
              price: priceNum,
              emoji: item.icon || (emojiMatch ? emojiMatch[0] : '🍽️'),
              category: item.category || '식사', 
              desc: item.description || 'MQnet AI가 등록한 메뉴입니다.'
            });
        }
      });
    }
    return Array.from(menuMap.values());
  }, [bundles]);

  const dynamicCategories = useMemo(() => {
    const cats = new Set<string>();
    menuItems.forEach(item => {
      if (item.category) cats.add(item.category);
    });
    
    const priority = ['식사', '주메뉴', '메인메뉴', '세트', '안주', '주류', '음료', '사이드', '기타'];
    const sortedCats = Array.from(cats).sort((a, b) => {
        const indexA = priority.indexOf(a);
        const indexB = priority.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    return ['전체', ...sortedCats];
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    if (activeCategory === '전체') return menuItems;
    return menuItems.filter(item => item.category === activeCategory);
  }, [menuItems, activeCategory]);

  const updateQty = (id: string, delta: number) => {
    setCart(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalPrice = Object.entries(cart).reduce((total, [id, qty]) => {
    const item = menuItems.find(m => m.id === id);
    return total + (item ? item.price * qty : 0);
  }, 0);

  const cartList = Object.entries(cart)
    .filter(([id, qty]) => qty > 0 && menuItems.some(m => m.id === id))
    .map(([id, qty]) => {
      const item = menuItems.find(m => m.id === id);
      return { ...item!, qty };
    });

  const handleSubmit = async (method: string | null = null, isCall: boolean = false, extraData?: any) => {
    if (!isCall && !method && showPayModal) {
      alert("결제 수단을 선택해 주세요!");
      return;
    }

    try {
      const items = isCall 
        ? [{ name: '호출', price: 0, quantity: 1 }]
        : cartList.map(item => ({ name: item.name, price: item.price, quantity: item.qty }));
      
      const payload: any = {
        table_id: tableId,
        device_id: deviceId,
        store_id: storeId,
        items,
        total_price: isCall ? 0 : totalPrice,
        payment_status: method ? 'prepaid' : 'unpaid',
        payment_method: method,
        join_order: isJoinedDevice,
        metadata: { phone: extraData?.phone, usePoints: extraData?.usePoints, isTakeout: extraData?.isTakeout }
      };

      if (method === 'self_pay') {
        const finalPrice = Math.max(0, totalPrice - (extraData?.usePoints || 0));
        
        if (finalPrice > 0) {
          const tempOrderId = `TMP-${Date.now()}`;
          const { PaymentService } = await import('../services/paymentService');
          
          PaymentService.requestPayAppPayment('card', {
            amount: finalPrice,
            orderId: tempOrderId,
            orderName: '테이블 주문',
            customerName: '고객'
          });

          // 결제 완료 메시지 대기
          const result = await new Promise<any>((resolve, reject) => {
            const handler = (e: MessageEvent) => {
              if (e.data && e.data.type === 'PAYMENT_FINISHED' && e.data.orderId === tempOrderId) {
                window.removeEventListener('message', handler);
                if (e.data.success) {
                  resolve(e.data);
                } else {
                  reject(new Error('결제가 실패하거나 취소되었습니다.'));
                }
              }
            };
            window.addEventListener('message', handler);
          });

          payload.payment_status = 'paid';
          payload.payment_method = 'payapp';
          payload.metadata.temp_order_id = tempOrderId;
          payload.metadata.payment_key = result.paymentKey;
        } else {
          // 전액 포인트 결제 (0원)
          payload.payment_status = 'paid';
          payload.payment_method = 'points';
        }
      } else if (method === 'call_staff') {
        payload.payment_status = 'pending_payment';
        payload.payment_method = '직원호출';
      }

      const res = await fetch(`${API_BASE}/api/order/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || '주문 전송 실패');
      }

      setIsOrdered(true);
      setShowPayModal(false);
      setIsCartView(false);
      setCart({});
      
      // 결제가 완료되었거나 직원 호출일 경우 주차 등록 모달을 표시
      if (!isCall) {
        setShowPostPaymentModal(true);
      }
    } catch (err: any) {
      alert(err.message || (isCall ? "호출 실패!" : "주문 전송 실패!"));
    }
  };

  if (isOrdered) {
    return (
      <div className="mobile-app-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* 헤더 */}
        <header className="mobile-header">
          <div className="header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0 }}>MQ <span>Premium</span></h1>
            <div className="table-tag" style={{ background: 'var(--accent-orange)', padding: '4px 12px', borderRadius: '50px', fontWeight: 'bold' }}>Table {tableNo}</div>
          </div>
        </header>

        {/* 주문 완료 감사 안내 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          textAlign: 'center',
          gap: '16px'
        }}>
          <div style={{ fontSize: '5rem', lineHeight: 1 }}>✅</div>
          <h2 style={{ fontSize: '1.8rem', margin: '0', fontWeight: '800', color: 'white' }}>주문해 주셔서 감사합니다!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1.7, margin: 0 }}>
            주문이 주방으로 전달되었습니다.<br/>
            잠시만 기다려 주세요. 😊
          </p>
          <div style={{
            marginTop: '12px',
            padding: '16px 24px',
            borderRadius: '16px',
            background: 'rgba(249, 115, 22, 0.08)',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            color: '#f97316',
            fontSize: '0.95rem',
            fontWeight: '600',
            lineHeight: 1.6
          }}>
            추가 주문이 필요하시면<br/>
            아래 <strong>추가주문</strong> 버튼을 눌러주세요.
          </div>
        </div>

        {/* 추가주문 버튼 */}
        <div style={{ padding: '16px 20px 40px' }}>
          <button
            onClick={() => setIsOrdered(false)}
            style={{
              width: '100%',
              padding: '18px',
              borderRadius: '18px',
              background: 'var(--accent-orange)',
              color: 'white',
              border: 'none',
              fontWeight: '800',
              fontSize: '1.2rem',
              boxShadow: '0 6px 20px rgba(249, 115, 22, 0.35)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              letterSpacing: '0.02em'
            }}
          >
            🍽️ 추가주문
          </button>
        </div>
      </div>
    );
  }

  if (isWaitingForPartyApproval) {
    return (
      <div className="mobile-app-container flex-center animate-fade-in" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⏳</div>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>일행 승인 대기 중</h1>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          이미 이용 중인 일행이 있습니다.<br/>
          테이블에 있는 일행이 승인해주면 주문을 시작할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mobile-app-container animate-fade-in">
      {pendingJoinRequest && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 5000,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ background: '#1e293b', borderRadius: '24px', padding: '30px', width: '100%', maxWidth: '320px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>👥</div>
            <h3 style={{ color: 'white', marginBottom: '10px' }}>새로운 일행 합류</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '25px', lineHeight: 1.5 }}>
              누군가 우리 테이블에 합류를 요청했습니다. 일행이 맞으신가요?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                onClick={() => handleJoinApproval(false)}
                style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: '#ef4444', border: 'none', fontWeight: 'bold' }}
              >
                거절
              </button>
              <button 
                onClick={() => handleJoinApproval(true)}
                style={{ padding: '14px', borderRadius: '12px', background: 'var(--accent-orange)', color: 'white', border: 'none', fontWeight: 'bold' }}
              >
                승인
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="mobile-header">
        <div className="header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0 }}>MQ <span>Premium</span></h1>
          <div className="table-tag" style={{ background: 'var(--accent-orange)', padding: '4px 12px', borderRadius: '50px', fontWeight: 'bold' }}>Table {tableNo}</div>
        </div>
      </header>

      {!isCartView ? (
        <>
          <div className="category-chips-wrapper">
            <div className="category-chips">
              {dynamicCategories.map(cat => (
                <div key={cat} className={`chip ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>{cat}</div>
              ))}
            </div>
          </div>

          <div className="mobile-menu-scroll" style={{ height: 'calc(100vh - 250px)' }}>
             {filteredItems.map(item => {
               const cartQty = cart[item.id] || 0;
               const orderedQty = myOrders.reduce((total, order) => {
                 const matchItem = order.items?.find(i => i.name.includes(item.name) || item.name.includes(i.name));
                 if (matchItem) {
                   const val = (matchItem as any).value ? String((matchItem as any).value).match(/\d+/) : null;
                   return total + (val ? parseInt(val[0]) : 0);
                 }
                 return total;
               }, 0);
               const totalDisplayQty = cartQty + orderedQty;

               return (
                 <div key={item.id} className="mobile-menu-card premium">
                    <div className="menu-img-placeholder">{item.emoji}</div>
                    <div className="menu-info">
                      <h3>{item.name}</h3>
                      <div className="price">{item.price.toLocaleString()}원</div>
                    </div>
                    <div className="qty-control-area" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="qty-pill" style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        background: totalDisplayQty > 0 ? 'rgba(249, 115, 22, 0.3)' : 'rgba(255, 255, 255, 0.15)', 
                        padding: '8px 16px', 
                        borderRadius: '50px', 
                        border: totalDisplayQty > 0 ? '2px solid var(--accent-orange)' : '1px solid rgba(255, 255, 255, 0.3)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                      }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateQty(item.id, -1); }} 
                          disabled={cartQty === 0}
                          style={{ background: 'none', border: 'none', color: cartQty > 0 ? 'white' : 'rgba(255,255,255,0.2)', fontSize: '1.4rem', fontWeight: 'bold', padding: '0 8px' }}
                        >
                          -
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '24px' }}>
                          <strong style={{ fontSize: '1.2rem', color: totalDisplayQty > 0 ? 'var(--accent-orange)' : '#ccc' }}>
                            {totalDisplayQty}
                          </strong>
                          {orderedQty > 0 && <span style={{ fontSize: '0.65rem', color: '#10b981', marginTop: '-2px', fontWeight: 'bold' }}>주문됨</span>}
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); updateQty(item.id, 1); }} 
                          style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.4rem', fontWeight: 'bold', padding: '0 8px' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                 </div>
               );
             })}
          </div>
        </>
      ) : (
        <div className="cart-edit-view animate-slide-up" style={{ padding: '20px' }}>
          <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>🛒 장바구니 <span style={{ fontSize: '1rem', color: 'var(--accent-orange)' }}>({totalItems}개)</span></h2>
          <div className="cart-list-scroll" style={{ maxHeight: '60vh', overflowY: 'auto', marginBottom: '20px' }}>
            {cartList.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{item.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{((item.price ?? 0) * item.qty).toLocaleString()}원</div>
                </div>
                <div className="qty-pill" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '5px 12px', borderRadius: '50px' }}>
                  <button onClick={() => updateQty(item.id!, -1)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem' }}>-</button>
                  <strong style={{ fontSize: '1.1rem', minWidth: '20px', textAlign: 'center' }}>{item.qty}</strong>
                  <button onClick={() => updateQty(item.id!, 1)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem' }}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
            <button onClick={() => setIsCartView(false)} style={{ padding: '15px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold', fontSize: '1.4rem' }}>+ 추가주문</button>
            <button 
                onClick={() => setShowPayModal(true)} 
                disabled={!isApproved}
                style={{ 
                    padding: '15px', 
                    borderRadius: '15px', 
                    background: !isApproved ? '#475569' : 'var(--accent-orange)', 
                    color: 'white', 
                    border: 'none', 
                    fontWeight: 'bold', 
                    fontSize: '1.1rem', 
                    boxShadow: !isApproved ? 'none' : '0 4px 15px rgba(249,115,22,0.3)',
                    cursor: !isApproved ? 'not-allowed' : 'pointer'
                }}
            >
                {!isApproved ? '⏳ 직원에게 문의' : `✅ ${totalPrice.toLocaleString()}원 주문하기`}
            </button>
          </div>
        </div>
      )}

      {!isCartView && totalItems > 0 && (
        <div className="cart-floating-summary animate-slide-up" onClick={() => setIsCartView(true)} style={{ position: 'fixed', bottom: '110px', left: '15px', right: '15px', zIndex: 100, background: 'rgba(30,41,59,0.98)', backdropFilter: 'blur(15px)', padding: '18px 20px', borderRadius: '22px', border: '1.5px solid var(--accent-orange)', boxShadow: '0 -10px 30px rgba(0,0,0,0.4)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
             <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flex: 1, overflow: 'hidden' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'white' }}>
                  {cartList.map(i => `${i.name} x${i.qty}`).join(', ')}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  (총 {totalItems}개)
                </span>
             </div>
             
             <div style={{ flex: 1, borderBottom: '2px dotted rgba(255,255,255,0.1)', margin: '0 5px', marginBottom: '5px' }}></div>

             <div style={{ fontSize: '1.25rem', fontWeight: '950', color: 'var(--accent-orange)', whiteSpace: 'nowrap' }}>
                {totalPrice.toLocaleString()}원
             </div>
          </div>
          <div style={{ 
            fontSize: '1.4rem', 
            color: !isApproved ? '#94a3b8' : 'var(--accent-orange)', 
            fontWeight: 'bold', 
            marginTop: '8px', 
            textAlign: 'center', 
            opacity: 0.9, 
            border: `2px solid ${!isApproved ? '#475569' : 'var(--accent-orange)'}`, 
            borderRadius: '12px', 
            padding: '10px', 
            background: !isApproved ? 'rgba(71, 85, 105, 0.1)' : 'rgba(249, 115, 22, 0.1)' 
          }}>
             {isApproved ? '🛒 주 문' : '⏳ 직원에게 문의'}
          </div>
        </div>
      )}

      {showPayModal && (
        <PaymentModal 
          totalPrice={totalPrice}
          onClose={() => setShowPayModal(false)}
          onSubmit={(method) => handleSubmit(method, false)}
          bundles={bundles}
          initialPhone={userPhone}
          onPhoneChange={setUserPhone}
          sessionId={sessionId}
          storeId={storeId}
          tableId={tableId}
        />
      )}

      {showPostPaymentModal && (
        <PostPaymentModal 
           sessionId={sessionId}
           storeId={storeId}
           onClose={() => setShowPostPaymentModal(false)}
        />
      )}

      <button 
        className="service-call-btn" 
        onClick={() => handleSubmit(null, true)} 
        disabled={!isApproved}
        style={{ 
            position: 'fixed', 
            bottom: totalItems > 0 && !isCartView ? '200px' : '30px', 
            right: '20px', 
            zIndex: 90, 
            width: '60px', 
            height: '60px', 
            borderRadius: '50%', 
            background: !isApproved ? '#334155' : '#1e293b', 
            border: '1px solid rgba(255,255,255,0.1)', 
            color: !isApproved ? '#64748b' : 'white', 
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            opacity: !isApproved ? 0.6 : 1,
            cursor: !isApproved ? 'not-allowed' : 'pointer'
        }}
      >
        🔔
      </button>
    </div>
  );
};
