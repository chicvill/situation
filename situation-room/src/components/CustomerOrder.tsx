import React, { useState, useMemo } from 'react';
import type { BundleData } from '../types';

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

const DEFAULT_CATEGORIES = ['전체', '식사', '안주', '주류', '음료'];

export const CustomerOrder: React.FC<Props> = ({ bundles }) => {
  const [activeCategory, setActiveCategory] = useState('전체');
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [showPayModal, setShowPayModal] = useState(false);
  const [isCartView, setIsCartView] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isOrdered, setIsOrdered] = useState(false);

  const tableNo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('table') || '3';
  }, []);

  // 현재 테이블의 기존 주문 내역 실시간 필터링
  const myOrders = useMemo(() => {
    return bundles.filter(b => 
      b.type === 'Orders' && 
      b.items.some(i => i.name === '테이블' && i.value === tableNo)
    ).reverse();
  }, [bundles, tableNo]);

  const payMethods = {
    pays: [
      { id: 'kakao', name: '📱 카카오페이', color: '#fee500' },
      { id: 'toss', name: '🔵 토스페이', color: '#0064ff' },
      { id: 'naver', name: '🟢 네이버페이', color: '#03c75a' },
      { id: 'zero', name: '⚪ 제로페이', color: '#1a1a1a' }
    ],
    cards: [
      { id: 'samsung', name: '삼성카드' },
      { id: 'hyundai', name: '현대카드' },
      { id: 'shinhan', name: '신한카드' },
      { id: 'kb', name: '국민카드' },
      { id: 'bc', name: 'BC카드' }
    ]
  };

  const menuItems = useMemo(() => {
    const menuMap = new Map<string, MenuItem>();
    [...bundles].reverse().filter(b => b.type === 'Menus').forEach((bundle) => {
      bundle.items.forEach((item, idx) => {
        const priceNum = parseInt(item.value.replace(/[^0-9]/g, '')) || 0;
        const emojiMatch = item.name.match(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/);
        const nameClean = item.name.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/, '').trim();
        if (nameClean && !menuMap.has(nameClean)) {
            menuMap.set(nameClean, {
              id: `${bundle.id}-${idx}`,
              name: nameClean,
              price: priceNum,
              emoji: emojiMatch ? emojiMatch[0] : '🍽️',
              category: '식사', 
              desc: 'MQnet AI가 등록한 메뉴입니다.'
            });
        }
      });
    });
    return Array.from(menuMap.values());
  }, [bundles]);

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
    .filter(([_, qty]) => qty > 0)
    .map(([id, qty]) => {
      const item = menuItems.find(m => m.id === id);
      return { ...item, qty };
    });

  const handleSubmit = async (isCall: boolean = false) => {
    if (!isCall && !selectedMethod && showPayModal) {
      alert("결제 수단을 선택해 주세요!");
      return;
    }

    const orderItems = isCall 
      ? [{ name: '호출', value: '벨 호출' }]
      : cartList.map(item => ({ name: item.name || 'Unknown', value: `x${item.qty}` }));

    try {
      const serverIp = window.location.hostname;
      await fetch(`http://${serverIp}:8000/api/order/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNo,
          orderNo: isCall ? 'CALL' : Math.floor(Math.random() * 900 + 100).toString(),
          items: orderItems,
          payment: isCall ? 'CALL' : selectedMethod
        }),
      });
      setIsOrdered(true);
      setShowPayModal(false);
      setIsCartView(false);
      setSelectedMethod(null);
      setTimeout(() => {
        setIsOrdered(false);
        setCart({});
      }, 3000);
    } catch (err) {
      alert(isCall ? "호출 실패!" : "주문 전송 실패!");
    }
  };

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
              {DEFAULT_CATEGORIES.map(cat => (
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
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{(item.price * item.qty).toLocaleString()}원</div>
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
            <button onClick={() => setIsCartView(false)} style={{ padding: '15px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold' }}>+ 추가주문</button>
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
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-orange)', fontWeight: 'bold', marginTop: '4px', textAlign: 'center', opacity: 0.8 }}>
             장바구니 확인 및 주문하기 👆
          </div>
        </div>
      )}

      {showPayModal && (
        <div className="payment-modal-overlay animate-fade-in" style={{ zIndex: 2000 }}>
          <div className="payment-modal animate-pop-in premium-scroll" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <header>
              <h3>💳 결제 수단 선택</h3>
              <button className="close-btn" onClick={() => setShowPayModal(false)}>×</button>
            </header>

            <div className="pay-section" style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px' }}>간편 결제</p>
              <div className="method-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {payMethods.pays.map(m => (
                  <button key={m.id} className={`method-btn ${selectedMethod === m.id ? 'active' : ''}`} onClick={() => setSelectedMethod(m.id)} style={{ borderColor: selectedMethod === m.id ? m.color : 'rgba(255,255,255,0.1)', background: selectedMethod === m.id ? `${m.color}22` : 'rgba(255,255,255,0.05)', color: selectedMethod === m.id ? 'white' : 'var(--text-muted)', borderWidth: '2px' }}>{m.name}</button>
                ))}
              </div>
            </div>

            <div className="pay-section" style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px' }}>신용카드사 선택</p>
              <div className="method-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {payMethods.cards.map(m => (
                  <button key={m.id} className={`method-btn ${selectedMethod === m.id ? 'active' : ''}`} onClick={() => setSelectedMethod(m.id)} style={{ fontSize: '0.85rem', padding: '10px 5px', borderColor: selectedMethod === m.id ? 'var(--accent-orange)' : 'rgba(255,255,255,0.1)', background: selectedMethod === m.id ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255, 255, 255, 0.05)', color: selectedMethod === m.id ? 'white' : 'var(--text-muted)' }}>{m.name}</button>
                ))}
              </div>
            </div>

            <div className="pay-section" style={{ marginBottom: '20px' }}>
               <button className={`method-btn ${selectedMethod === 'onsite' ? 'active' : ''}`} onClick={() => setSelectedMethod('onsite')} style={{ width: '100%', padding: '12px', borderColor: selectedMethod === 'onsite' ? 'var(--accent-orange)' : 'rgba(255,255,255,0.1)' }}>🏦 카운터에서 직접 결제 (현금/기타)</button>
            </div>

            <button className={`final-pay-btn ${selectedMethod ? 'ready' : ''}`} onClick={() => handleSubmit()} disabled={!selectedMethod} style={{ width: '100%', padding: '18px', borderRadius: '15px', background: selectedMethod ? 'var(--accent-orange)' : '#333', color: 'white', border: 'none', fontWeight: 'bold', fontSize: '1.2rem' }}>
              {selectedMethod ? `${totalPrice.toLocaleString()}원 결제하기` : '결제 수단을 선택해 주세요'}
            </button>
          </div>
        </div>
      )}

      <button className="service-call-btn" onClick={() => handleSubmit(true)} style={{ position: 'fixed', bottom: totalItems > 0 && !isCartView ? '200px' : '30px', right: '20px', zIndex: 90, width: '60px', height: '60px', borderRadius: '50%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>🔔</button>
    </div>
  );
};
