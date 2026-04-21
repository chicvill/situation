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
  const [tableNo] = useState('3');
  const [isOrdered, setIsOrdered] = useState(false);

  // Dynamic Menu Generation from Knowledge Bundles - Deduplicated and Enriched
  const menuItems = useMemo(() => {
    const menuMap = new Map<string, MenuItem>();
    
    // Process bundles in reverse to let newer updates take precedence
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

  const handleSubmit = async (isCall: boolean = false) => {
    const orderItems = isCall 
      ? [{ name: '호출', value: '벨 호출' }]
      : Object.entries(cart)
          .filter(([_, qty]) => qty > 0)
          .map(([id, qty]) => {
            const item = menuItems.find(m => m.id === id);
            return { name: item?.name || 'Unknown', value: `x${qty}` };
          });

    try {
      await fetch('http://localhost:8000/api/order/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNo,
          orderNo: isCall ? 'CALL' : Math.floor(Math.random() * 900 + 100).toString(),
          items: orderItems,
        }),
      });
      setIsOrdered(true);
      setTimeout(() => {
        setIsOrdered(false);
        setCart({});
      }, 3000);
    } catch (err) {
      alert(isCall ? "호출 실패!" : "주문 전송 실패!");
    }
  };

  const myOrders = useMemo(() => {
    return bundles.filter(b => 
      b.type === 'Orders' && 
      b.items.some(i => i.name === '테이블' && i.value === tableNo)
    ).reverse();
  }, [bundles, tableNo]);

  if (isOrdered) {
    return (
      <div className="mobile-app-container flex-center animate-fade-in">
        <div style={{ textAlign: 'center' }}>
          <div className="success-lottie">✅</div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>전송 완료!</h1>
          <p style={{ color: 'var(--text-muted)' }}>요청하신 내역이 즉시 전달되었습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-app-container animate-fade-in">
      <header className="mobile-header">
        <div className="header-top">
          <h1>MQ Premium <span>Order</span></h1>
          <div className="table-tag">Table {tableNo}</div>
        </div>
        <div className="mobile-search-bar">
          <input type="text" placeholder="메뉴를 검색해보세요..." />
        </div>
      </header>

      {/* Category Chips - Scrollable */}
      <div className="category-chips-wrapper">
        <div className="category-chips">
          {DEFAULT_CATEGORIES.map(cat => (
            <div 
              key={cat} 
              className={`chip ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </div>
          ))}
        </div>
      </div>

      <div className="mobile-menu-scroll">
         {/* My Orders Section */}
         {myOrders.length > 0 && (
           <div className="glass-panel my-orders-status animate-pop-in" style={{ marginBottom: '20px', border: '1px solid var(--premium-orange)' }}>
             <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>📋 주문/호출 현황</h4>
             {myOrders.map(o => {
               const isCall = o.items.some(i => i.name === '호출');
               return (
                 <div key={o.id} className="my-order-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                   <div className="order-items-mini">
                      {isCall ? <span>🔔 직원 호출 중...</span> : o.items.map((i, idx) => i.name !== '테이블' && <span key={idx} style={{ marginRight: '8px' }}>{i.name} {i.value}</span>)}
                   </div>
                   <span className={`status-tag ${o.status}`} style={{ fontSize: '0.8rem', color: o.status === 'ready' ? '#10b981' : '#f97316' }}>
                     {isCall ? '' : (o.status === 'ready' ? '🚚 완료' : '🍳 조리중')}
                   </span>
                 </div>
               );
             })}
           </div>
         )}

         {filteredItems.map(item => (
           <div key={item.id} className="mobile-menu-card premium">
              <div className="menu-img-placeholder">{item.emoji}</div>
              <div className="menu-info">
                <h3>{item.name}</h3>
                <div className="price">{item.price.toLocaleString()}원</div>
              </div>
              <div className="qty-pill">
                {cart[item.id] > 0 && (
                  <>
                    <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>-</button>
                    <strong>{cart[item.id]}</strong>
                  </>
                )}
                <button className="qty-btn plus" onClick={() => updateQty(item.id, 1)}>+</button>
              </div>
           </div>
         ))}
         {filteredItems.length === 0 && (
           <div className="empty-state">
             <p>이 카테고리에는 등록된 메뉴가 없습니다.</p>
           </div>
         )}
      </div>

      {totalItems > 0 && (
        <div className="mobile-footer-nav animate-fade-in">
          <div className="cart-summary">
            <div className="qty-total">선택됨 {totalItems}개</div>
            <div className="price-total">{totalPrice.toLocaleString()}원</div>
          </div>
          <button className="order-submit-btn" onClick={() => handleSubmit()}>
            주문 요청하기
          </button>
        </div>
      )}

      <button 
          className="service-call-btn" 
          onClick={() => handleSubmit(true)}
          style={{
              position: 'fixed',
              bottom: totalItems > 0 ? '100px' : '20px',
              right: '20px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '12px 18px',
              borderRadius: '50px',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
              fontWeight: 'bold',
              zIndex: 1000
          }}
      >
          🔔 직원 호출
      </button>
    </div>
  );
};
