import React, { useState, useMemo, useEffect } from 'react';
import type { BundleData } from '../types';
import { PaymentModal } from './PaymentModal';

interface Props {
  bundles: BundleData[];
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  emoji: string;
  category: string;
  desc: string;
}

export const CustomerOrder: React.FC<Props> = ({ bundles }) => {
  const [activeCategory, setActiveCategory] = useState('전체');
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [showPayModal, setShowPayModal] = useState(false);
  const [isCartView, setIsCartView] = useState(false);
  const [isOrdered, setIsOrdered] = useState(false);
  const [userPhone, setUserPhone] = useState('');


  const tableNo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('table') || '3';
  }, []);

  const deviceId = useMemo(() => {
    let id = localStorage.getItem('mqnet_device_id');
    if (!id) {
      id = 'DEV_' + Math.random().toString(36).substring(2, 11).toUpperCase();
      localStorage.setItem('mqnet_device_id', id);
    }
    return id;
  }, []);

  const storeName = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('store') || 'Unknown';
  }, []);

  // 체크인 승인 상태 관리
  const isApproved = useMemo(() => {
    return bundles.some(b => 
      b.type === 'Checkins' && 
      b.table === tableNo && 
      b.device_id === deviceId && 
      b.status === 'approved'
    );
  }, [bundles, tableNo, deviceId]);

  // 접속 시 체크인 요청
  useEffect(() => {
    if (!isApproved) {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      fetch(`${apiUrl}/api/checkin/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNo, deviceId, store: storeName })
      }).catch(err => console.error("Checkin Request Error:", err));
    }
  }, [tableNo, deviceId, storeName, isApproved]);

  // 현재 테이블의 기존 주문 내역 실시간 필터링
  const myOrders = useMemo(() => {
    return bundles.filter(b => 
      b.type === 'Orders' && 
      b.items.some(i => i.name === '테이블' && i.value === tableNo)
    ).reverse();
  }, [bundles, tableNo]);



  const menuItems = useMemo(() => {
    const menuMap = new Map<string, MenuItem>();
    const menuBundle = bundles.find(b => b.type === 'Menus');
    
    if (menuBundle) {
      menuBundle.items.forEach((item: any) => {
        const priceNum = parseInt(item.value.replace(/[^0-9]/g, '')) || 0;
        const emojiMatch = item.name.match(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/);
        const nameClean = item.name.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/, '').trim();
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

  const handleSubmit = async (method: string | null = null, isCall: boolean = false) => {
    if (!isCall && !method && showPayModal) {
      alert("결제 수단을 선택해 주세요!");
      return;
    }

    const orderItems = isCall 
      ? [{ name: '호출', value: '벨 호출' }]
      : cartList.map(item => ({ name: item.name || 'Unknown', value: `x${item.qty}` }));

    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      await fetch(`${apiUrl}/api/order/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNo,
          orderNo: isCall ? 'CALL' : Math.floor(Math.random() * 900 + 100).toString(),
          items: orderItems,
          payment: isCall ? 'CALL' : method,
          deviceId,
          store: storeName
        }),
      });
      setIsOrdered(true);
      setShowPayModal(false);
      setIsCartView(false);
      setTimeout(() => {
        setIsOrdered(false);
        setCart({});
      }, 3000);
    } catch (err) {
      alert(isCall ? "호출 실패!" : "주문 전송 실패!");
    }
  };

  if (!isApproved) {
    return (
      <div className="mobile-app-container flex-center animate-fade-in" style={{ background: '#020617', padding: '20px' }}>
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⏳</div>
          <h1 style={{ fontSize: '1.8rem', color: 'white', marginBottom: '10px' }}>체크인 대기 중</h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', lineHeight: '1.6' }}>
            {storeName} 매장에 방문하신 것을 환영합니다!<br/>
            현재 <strong>{tableNo}번 테이블</strong> 승인을 기다리고 있습니다.<br/>
            직원이 확인 후 주문 기능을 열어드립니다.
          </p>
          <div className="loading-dots" style={{ marginTop: '30px' }}>
             <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
          </div>
        </div>
      </div>
    );
  }

  if (isOrdered) {
    return (
      <div className="mobile-app-container flex-center animate-fade-in">
        <div style={{ textAlign: 'center' }}>
          <div className="success-lottie" style={{ fontSize: '4rem' }}>✅</div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>주문 전송 완료!</h1>
          <p style={{ color: 'var(--text-muted)' }}>주방으로 주문이 전달되었습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-app-container animate-fade-in">
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
                 const matchItem = order.items.find(i => i.name.includes(item.name) || item.name.includes(i.name));
                 if (matchItem) {
                   const val = matchItem.value.match(/\d+/);
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
            <button onClick={() => setShowPayModal(true)} style={{ padding: '15px', borderRadius: '15px', background: 'var(--accent-orange)', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(249,115,22,0.3)' }}>✅ {totalPrice.toLocaleString()}원 주문하기</button>
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
          <div style={{ fontSize: '1.4rem', color: 'var(--accent-orange)', fontWeight: 'bold', marginTop: '8px', textAlign: 'center', opacity: 0.9, border: '2px solid var(--accent-orange)', borderRadius: '12px', padding: '10px', background: 'rgba(249, 115, 22, 0.1)' }}>
             🛒 주 문
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
        />


      )}

      <button className="service-call-btn" onClick={() => handleSubmit(null, true)} style={{ position: 'fixed', bottom: totalItems > 0 && !isCartView ? '200px' : '30px', right: '20px', zIndex: 90, width: '60px', height: '60px', borderRadius: '50%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>🔔</button>
    </div>
  );
};
