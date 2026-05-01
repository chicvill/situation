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
  const [showAiStory, setShowAiStory] = useState(false);
  const [aiStoryContent, setAiStoryContent] = useState({ title: '', body: '', icon: '🍽️' });

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

  const generateAiStory = (items: any[]) => {
    if (items.length === 0) return;
    const firstItem = items[0];
    const stories: any = {
      '스테이크': { title: '🥩 왕의 요리, 스테이크', body: '스테이크의 어원은 "구운 고기"를 뜻하는 스칸디나비아어 "steik"에서 유래했습니다. 고단백 영양소뿐만 아니라 철분이 풍부해 활력을 불어넣어 주죠.', icon: '🥩' },
      '파스타': { title: '🍝 이탈리아의 자부심, 파스타', body: '파스타는 13세기 마르코 폴로가 중국에서 가져왔다는 설이 유명하지만, 사실 고대 로마 시대부터 즐겨 먹던 요리입니다. 듀럼밀 세몰리나로 만들어 천천히 소화되는 건강한 탄수화물이죠.', icon: '🍝' },
      '커피': { title: '☕ 에티오피아의 눈물, 커피', body: '9세기 에티오피아의 목동 칼디가 발견한 커피는 전 세계에서 가장 사랑받는 음료가 되었습니다. 적당한 카페인은 집중력을 높여주고 항산화 성분이 풍부합니다.', icon: '☕' },
      '와인': { title: '🍷 신의 물방울, 와인', body: '인류 역사와 함께해온 와인은 항산화제인 레스베라트롤이 풍부해 심혈관 건강에 도움을 줄 수 있습니다. 주문하신 메뉴와 환상적인 조화를 이룰 거예요.', icon: '🍷' }
    };

    // 메뉴명에 키워드가 포함되어 있는지 확인
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
  };

  const handleUpdateOrderItem = async (orderId: string, items: any[]) => {
    try {
      const filteredItems = items.filter(i => (i.quantity || i.qty) > 0);
      if (filteredItems.length === 0) {
        // 모든 항목 삭제 시 주문 취소 처리
        await fetch(`${API_BASE}/api/order/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId, status: 'cancelled' })
        });
      } else {
        await fetch(`${API_BASE}/api/order/update-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId, items: filteredItems })
        });
      }
      fetchMySession();
    } catch (err) {
      console.error('Update Item Error:', err);
    }
  };

  const executeOrderWithPayment = async (method: string, extraData?: any) => {
    setIsOrdering(true);
    setShowPayModal(false);
    try {
      const currentCart = [...cart]; // 백업
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
        generateAiStory(currentCart); // 스토리 생성
        setTimeout(() => setShowAiStory(true), 800); // 약간의 시차 후 팝업
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
                      {order.items.map((item: any, i: number) => {
                        const qty = item.quantity || item.qty;
                        const isPending = order.status === 'pending';
                        
                        return (
                          <div key={i} className="item-row" style={{ alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{item.name}</div>
                              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                                {item.price.toLocaleString()}원
                              </div>
                            </div>
                            
                            {isPending ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '12px' }}>
                                <button 
                                  onClick={() => {
                                    const newItems = [...order.items];
                                    newItems[i] = { ...item, quantity: Math.max(0, qty - 1) };
                                    handleUpdateOrderItem(order.order_id, newItems);
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', padding: '0 5px' }}
                                >-</button>
                                <span style={{ fontWeight: 800, minWidth: '20px', textAlign: 'center' }}>{qty}</span>
                                <button 
                                  onClick={() => {
                                    const newItems = [...order.items];
                                    newItems[i] = { ...item, quantity: qty + 1 };
                                    handleUpdateOrderItem(order.order_id, newItems);
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#f97316', fontSize: '18px', padding: '0 5px' }}
                                >+</button>
                                <button 
                                  onClick={() => {
                                    const newItems = order.items.filter((_: any, idx: number) => idx !== i);
                                    handleUpdateOrderItem(order.order_id, newItems);
                                  }}
                                  style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#ef4444', fontSize: '14px' }}
                                >✕</button>
                              </div>
                            ) : (
                              <span style={{ fontWeight: '600' }}>{qty}개 | {(item.price * qty).toLocaleString()}원</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="order-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ opacity: 0.6, fontSize: '13px' }}>주문합계:</span>
                        <div style={{ color: borderColor, fontWeight: '900', fontSize: '18px' }}>{order.total_price.toLocaleString()}원</div>
                      </div>
                      {order.status !== 'pending' && (
                        <button 
                          onClick={() => setShowHistory(false)}
                          style={{ 
                            background: 'rgba(249, 115, 22, 0.1)', border: '1px solid #f97316', color: '#f97316',
                            padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 800
                          }}
                        >
                          ➕ 추가 주문하기
                        </button>
                      )}
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

      {showAiStory && (
        <div className="payment-modal-overlay" style={{ zIndex: 11000 }}>
          <div className="glass-panel animate-pop-in" style={{ 
            width: '90%', maxWidth: '400px', padding: '30px', textAlign: 'center', 
            background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid #f97316'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>{aiStoryContent.icon}</div>
            <h2 style={{ color: '#f97316', marginBottom: '15px', fontWeight: 900 }}>{aiStoryContent.title}</h2>
            <p style={{ lineHeight: 1.6, color: '#94a3b8', fontSize: '15px', marginBottom: '30px' }}>
              {aiStoryContent.body}
            </p>
            
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '20px', marginBottom: '25px' }}>
              <p style={{ fontSize: '13px', margin: '0 0 10px 0', opacity: 0.7 }}>추가 주문이 필요하신가요?</p>
              <button 
                onClick={() => { setShowAiStory(false); (window as any).startVoiceOrdering && (window as any).startVoiceOrdering(); }}
                style={{ 
                  background: 'linear-gradient(135deg, #f97316, #ea580c)', border: 'none', color: 'white', 
                  padding: '12px 25px', borderRadius: '50px', fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto'
                }}
              >
                🎙️ 말로 주문하기
              </button>
            </div>

            <button 
              onClick={() => setShowAiStory(false)}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px 20px', borderRadius: '12px', fontSize: '14px' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileOrderV2;
