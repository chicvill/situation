import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStoreFilter } from '../../hooks/useStoreFilter';
import type { BundleData } from '../../types';
import './MobileOrderV2.css';
import { useAIVoice } from '../../hooks/useAIVoice';

interface MobileOrderV2Props {
  bundles: BundleData[];
  storeId: string;
  storeName: string;
}

const MobileOrderV2: React.FC<MobileOrderV2Props> = ({ bundles, storeId, storeName }) => {
  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [cart, setCart] = useState<any[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [tableNo, setTableNo] = useState<string>('T01');
  const [isProcessing, setIsProcessing] = useState(false);
  const { announce, speak, startListening } = useAIVoice();
  const [isAiListening, setIsAiListening] = useState(false);

  // --- Session Sync ---
  const activeSession = useMemo(() => {
    return bundles.find(b => b.type === 'Session' && b.status === 'active' && (b.store_id === storeId || !b.store_id));
  }, [bundles, storeId]);

  const hasActiveSession = !!activeSession;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('table');
    if (t) setTableNo(t.startsWith('T') ? t : `T${t.padStart(2, '0')}`);
  }, []);

  // --- Menu Data Mapping ---
  const menus = useMemo(() => {
    const menuBundle = bundles.find(b => b.type === 'Menus' && (b.store_id === storeId || !b.store_id));
    if (!menuBundle) return [];
    
    return menuBundle.items.map((item: any, idx: number) => ({
      id: `menu-${idx}`,
      name: item.name,
      price: parseInt(item.value.replace(/[^0-9]/g, '') || '0'),
      category: item.category || (idx % 3 === 0 ? '추천' : '식사'),
      image: item.image || `https://source.unsplash.com/featured/?food,${encodeURIComponent(item.name)}`,
      description: item.description || `${item.name}의 풍미를 그대로 느낄 수 있는 대표 메뉴입니다.`
    }));
  }, [bundles, storeId]);

  const categories = useMemo(() => {
    const cats = ['전체', ...new Set(menus.map(m => m.category))];
    return cats;
  }, [menus]);

  const filteredMenus = useMemo(() => {
    if (activeCategory === '전체') return menus;
    return menus.filter(m => m.category === activeCategory);
  }, [menus, activeCategory]);

  const addToCart = useCallback((menu: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === menu.id);
      if (existing) {
        return prev.map(item => item.id === menu.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...menu, qty: 1 }];
    });
  }, []);

  const executeOrderWithPayment = useCallback(async (method: string) => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      const orderData = {
        store_id: storeId,
        store_name: storeName,
        table_id: tableNo,
        items: cart.map(item => ({ name: item.name, quantity: item.qty, price: item.price })),
        total_price: cart.reduce((sum, item) => sum + (item.price * item.qty), 0),
        payment_method: method
      };

      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      const res = await fetch(`${apiUrl}/api/order/immediate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (res.ok) {
        setCart([]);
        setShowCart(false);
        alert('주문이 성공적으로 접수되었습니다!');
      }
    } catch (err) {
      console.error(err);
      alert('주문 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  }, [cart, storeId, storeName, tableNo]);

  // --- AI Concierge ---
  const handleAiListening = useCallback(() => {
    setIsAiListening(true);
    startListening((text) => {
      if (text.includes("추천")) {
        const randomMenu = menus[Math.floor(Math.random() * menus.length)];
        speak(`오늘의 추천 메뉴는 ${randomMenu.name}입니다. 정말 맛있어요!`);
      } else if (text.includes("주문")) {
        const found = menus.find(m => text.includes(m.name));
        if (found) {
          setCart([{ ...found, qty: 1 }]);
          setTimeout(() => {
            executeOrderWithPayment("현금 결제");
            speak(`${found.name} 주문이 즉시 접수되었습니다. 조리를 시작할게요!`);
          }, 500);
        } else {
          speak("어떤 메뉴를 주문할까요? 메뉴 이름을 말씀해 주세요.");
        }
      } else if (text.includes("담아")) {
        const found = menus.find(m => text.includes(m.name));
        if (found) {
          addToCart(found);
          speak(`${found.name}을 장바구니에 담았습니다.`);
        } else {
          speak("어떤 메뉴를 담아드릴까요?");
        }
      } else if (text.includes("결제") || text.includes("장바구니")) {
        setShowCart(true);
        speak("장바구니를 확인해 드릴게요.");
      } else {
        speak("죄송해요, 다시 한번 말씀해 주시겠어요?");
      }
    }, () => setIsAiListening(false));
  }, [menus, addToCart, executeOrderWithPayment, speak, startListening]);

  useEffect(() => {
    if (hasActiveSession && menus.length > 0) {
      announce(`${storeName}에 오신 것을 환영합니다. 무엇을 도와드릴까요?`);
    }
  }, [hasActiveSession, menus.length, storeName, announce]);

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
                onClick={() => (window as any).dispatchEvent(new CustomEvent('navigate', { detail: 'home' }))}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                🏠
              </button>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Table</span>
                <span style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--accent)', lineHeight: 1 }}>{tableNo}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>{storeName}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Smart Concierge Active</div>
            </div>
          </div>
        </div>

        <div className="category-scroll-container">
          <div className="category-scroll">
            {categories.map(cat => (
              <button key={cat} className={`category-pill ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="menu-grid-v2">
        {filteredMenus.map(menu => (
          <div key={menu.id} className="menu-card-v2 animate-fade-in" onClick={() => addToCart(menu)}>
            <div className="menu-image-container">
              <img src={menu.image} alt={menu.name} loading="lazy" />
              <div className="menu-category-tag">{menu.category}</div>
              <button className="add-quick-btn">+</button>
            </div>
            <div className="menu-info">
              <h3 className="menu-name">{menu.name}</h3>
              <p className="menu-desc">{menu.description}</p>
              <div className="menu-footer">
                <span className="menu-price">{menu.price.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Assistant Floating Button */}
      <div className={`ai-concierge-fab ${isAiListening ? 'listening' : ''}`} onClick={handleAiListening}>
        <div className="ai-icon-wrapper">
          {isAiListening ? (
            <div className="ai-wave-anim">
              <span></span><span></span><span></span>
            </div>
          ) : (
            <span className="ai-emoji">🎙️</span>
          )}
        </div>
        <div className="ai-label">{isAiListening ? "듣고 있어요" : "AI 주문비서"}</div>
      </div>

      {/* Cart Summary (Sticky Bottom) */}
      {cart.length > 0 && !showCart && (
        <div className="cart-sticky-summary animate-slide-up" onClick={() => setShowCart(true)}>
          <div className="cart-brief">
            <span className="cart-count">{cart.reduce((a, b) => a + b.qty, 0)}</span>
            <span className="cart-total-price">
              {cart.reduce((a, b) => a + (b.price * b.qty), 0).toLocaleString()}원 결제하기
            </span>
          </div>
          <div className="cart-arrow">→</div>
        </div>
      )}

      {/* Cart Overlay Modal */}
      {showCart && (
        <div className="cart-overlay animate-fade-in">
          <div className="cart-modal animate-slide-up">
            <div className="modal-header">
              <h3>장바구니</h3>
              <button onClick={() => setShowCart(false)}>×</button>
            </div>
            <div className="cart-items-list">
              {cart.map(item => (
                <div key={item.id} className="cart-item-row">
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="item-price">{(item.price * item.qty).toLocaleString()}원</span>
                  </div>
                  <div className="qty-controls">
                    <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i))}>-</button>
                    <span>{item.qty}</span>
                    <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i))}>+</button>
                  </div>
                  <button className="remove-item" onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))}>×</button>
                </div>
              ))}
            </div>
            <div className="cart-footer">
              <div className="total-row">
                <span>총 주문금액</span>
                <span className="total-val">{cart.reduce((a, b) => a + (b.price * b.qty), 0).toLocaleString()}원</span>
              </div>
              <button className="checkout-btn-v2" onClick={() => executeOrderWithPayment("현장 결제")} disabled={isProcessing}>
                {isProcessing ? '처리 중...' : '주문하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileOrderV2;
