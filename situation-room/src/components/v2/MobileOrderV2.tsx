import React, { useState, useEffect, useMemo } from 'react';
import '../../MobileV2.css';
import type { BundleData } from '../../types';
import { WS_BASE, API_BASE } from '../../config';
import { PaymentModal } from '../PaymentModal';



interface Props {
  bundles: BundleData[];
  storeId: string;
  storeName: string;
}

const MobileOrderV2: React.FC<Props> = ({ bundles, storeId, storeName }) => {
  const [cart, setCart] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [isOrdering, setIsOrdering] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [userPhone, setUserPhone] = useState('');

  // URL에서 테이블 번호 추출
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

  // 지식 번들에서 메뉴 추출 (Admin에서 등록한 최신 정보 사용)
  const menus = useMemo(() => {
    const safeBundles = Array.isArray(bundles) ? bundles : [];
    const menuBundle = safeBundles.find(b => b.type === 'Menus' && (b.store_id === storeId || !b.store_id));
    if (!menuBundle) return [];
    
    return menuBundle.items.map((item: any) => {
        const priceNum = parseInt(item.value.replace(/[^0-9]/g, '')) || 0;
        const emojiMatch = item.name.match(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/);
        const nameClean = item.name.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/, '').trim();
        return {
            name: nameClean,
            price: priceNum,
            icon: item.icon || (emojiMatch ? emojiMatch[0] : '🍽️'),
            category: item.category || '추천',
            description: item.description || '최고의 재료로 만든 시그니처 메뉴'
        };
    });
  }, [bundles, storeId]);

  const categories = useMemo(() => ['전체', ...new Set(menus.map(m => m.category))], [menus]);

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
    
    const timer = setInterval(fetchMySession, 5000); // 폴링 병행 (안정성)

    return () => {
        ws.close();
        clearInterval(timer);
    };
  }, [tableId, storeId]);

  // 접속 시 자동 체크인 요청
  useEffect(() => {
    fetch(`${API_BASE}/api/checkin/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableNo, deviceId, store: storeName, store_id: storeId })
    }).catch(err => console.error("Checkin Request Error:", err));
  }, [tableNo, deviceId, storeName, storeId]);

  const fetchMySession = async () => {
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
  };

  const addToCart = (menu: any) => {
    const existing = cart.find(c => c.name === menu.name);
    if (existing) {
      setCart(cart.map(c => c.name === menu.name ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { ...menu, qty: 1 }]);
    }
  };

  const handleOrder = () => {
    if (cart.length === 0 || !hasActiveSession) return;
    setShowPayModal(true);
  };

  const executeOrderWithPayment = async (method: string, extraData?: any) => {
    setIsOrdering(true);
    setShowPayModal(false);
    try {
      const res = await fetch(`${API_BASE}/api/order/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId,
          device_id: deviceId,
          store_id: storeId,
          items: cart.map(c => ({ name: c.name, quantity: c.qty, price: c.price })),
          total_price: cart.reduce((sum, item) => sum + (item.price * item.qty), 0),
          payment_status: method === '현금 결제' ? 'unpaid' : 'prepaid',
          payment_method: method,
          metadata: extraData
        })
      });
      if (res.ok) {
        setCart([]);
        fetchMySession();
        alert('주문과 결제가 완료되었습니다!');
      }
    } catch (err) {
      alert('주문 실패. 서버 상태를 확인해주세요.');
    } finally {
      setIsOrdering(false);
    }
  };


  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const sessionTotal = useMemo(() => myOrders.reduce((sum, order: any) => sum + order.total_price, 0), [myOrders]);

  if (!hasActiveSession) {
    return (
      <div className="mobile-v2-container unified-mode flex-center">
        <div className="premium-waiting-card animate-slide-up">
          <div className="glow-circle"></div>
          <div className="waiting-content">
            <div className="icon-wrap">✨</div>
            <h1 className="main-title">Welcome to<br/>{storeName}</h1>
            <div className="table-badge">Table {tableNo}</div>
            
            <div className="status-box">
              <div className="spinner-small"></div>
              <p>스마트 오더 연결 중...</p>
            </div>

            <p className="sub-text">
              좌석 확인이 완료되면<br/>
              자동으로 메뉴판이 활성화됩니다.
            </p>

            <button className="inquiry-btn-large" onClick={() => alert('직원을 호출했습니다. 잠시만 기다려주세요.')}>
              🔔 직원에게 문의
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-v2-container unified-mode">
      <header className="glass-card sticky-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '22px', margin: 0, fontWeight: 800 }}>{storeName}</h1>
            <p style={{ opacity: 0.6, fontSize: '13px' }}>Table {tableNo} | Enjoy your meal</p>
          </div>
          <button onClick={() => setShowHistory(!showHistory)} className="history-btn">
            {showHistory ? '메뉴보기' : '주문내역'}
          </button>
        </div>
      </header>

      {showHistory ? (
        <div className="history-view animate-fade-in">
          <h2 className="section-title">내 주문 현황</h2>
          {myOrders.length === 0 ? (
            <div className="glass-card empty-state">
              <p>주문 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="orders-stack">
              {myOrders.map((order: any, idx) => {
                const isPaid = order.payment_status === 'paid' || order.payment_status === 'prepaid';
                const borderColor = isPaid ? '#EF4444' : (order.status === 'served' ? '#10B981' : '#F59E0B');
                
                return (
                  <div key={idx} className="glass-card order-card" style={{ 
                    borderLeft: `5px solid ${borderColor}`,
                    background: isPaid ? 'rgba(239, 68, 68, 0.03)' : 'rgba(255, 255, 255, 0.03)'
                  }}>
                    <div className="order-header">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="order-seq" style={{ color: borderColor, opacity: 0.8 }}>{order.order_seq}차 주문</span>
                        {isPaid && <span style={{ fontSize: '10px', background: '#EF4444', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>PAID</span>}
                      </div>
                      <span className="status-badge" style={{ color: borderColor, fontWeight: '900', fontSize: '14px' }}>
                        {isPaid ? '✅ 결제완료' : (order.status === 'cooking' ? '🔥 조리중' : order.status === 'ready' ? '🔔 조리완료' : '✅ 서빙완료')}
                      </span>
                    </div>
                    <div className="items-list">
                      {order.items.map((item: any, i: number) => (
                        <div key={i} className="item-row">
                          <span style={{ color: 'rgba(255,255,255,0.9)' }}>{item.name} x {item.quantity || item.qty}</span>
                          <span style={{ fontWeight: '600' }}>{(item.price * (item.quantity || item.qty)).toLocaleString()}원</span>
                        </div>
                      ))}
                    </div>
                    <div className="order-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', marginTop: '10px' }}>
                      <span style={{ opacity: 0.6 }}>주문합계:</span>
                      <span style={{ color: borderColor, fontWeight: '900', fontSize: '16px' }}>{order.total_price.toLocaleString()}원</span>
                    </div>
                  </div>
                );
              })}
              <div className="total-summary-card">
                <span className="label">전체 결제 예정 금액: </span>
                <span className="amount">{sessionTotal.toLocaleString()}원</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="category-scroll no-scrollbar">
            {categories.map(cat => (
              <button key={cat} className={`category-pill ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>
                {cat}
              </button>
            ))}
          </div>

          <div className="menu-grid">
            {menus.filter(m => activeCategory === '전체' || m.category === activeCategory).map((item, idx) => (
              <div key={idx} className="glass-card menu-item-card" onClick={() => addToCart(item)}>
                <div className="menu-icon">{item.icon}</div>
                <div className="menu-details">
                  <div className="name">{item.name}</div>
                  <div className="desc">{item.description}</div>
                  <div className="price">{item.price.toLocaleString()}원</div>
                </div>
                <div className="add-badge">+</div>
              </div>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="floating-cart animate-slide-up" onClick={handleOrder}>
              <div className="cart-info">
                <div className="count">{cart.length}</div>
                <span className="label">주문하기</span>
              </div>
              <div className="total-price">{totalPrice.toLocaleString()}원</div>
            </div>
          )}
        </>
      )}

      {isOrdering && (
        <div className="loading-overlay">
          <div className="glass-card loading-card">
            <div className="spinner"></div>
            <h3>주문을 전송 중입니다...</h3>
          </div>
        </div>
      )}

      {showPayModal && (
        <PaymentModal
          totalPrice={totalPrice}
          onClose={() => setShowPayModal(false)}
          onSubmit={executeOrderWithPayment}
          tableNo={tableNo}
          bundles={bundles}
          initialPhone={userPhone}
          onPhoneChange={setUserPhone}
        />
      )}
    </div>
  );
};

export default MobileOrderV2;
