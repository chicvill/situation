import React from 'react';
import { useSituation } from '../hooks/useSituation';

export const KitchenDisplay: React.FC = () => {
    const { bundles, setBundles } = useSituation();

    // Only show active orders that are NOT archived and NOT yet finished (opt-in based on status)
    const kitchenOrders = bundles.filter(b => b.type === 'Orders' && b.status !== 'archived');

    const removeOrder = (id: string) => {
        // Broadcast the done signal
        const host = window.location.hostname;
        const socket = new WebSocket(`ws://${host}:8000/ws/kitchen`);
        socket.onopen = () => {
            socket.send(JSON.stringify({
                type: 'KITCHEN_DONE',
                bundleId: id
            }));
            socket.close();
        };
        // Local Optimistic Update
        setBundles(prev => prev.map(b => b.id === id ? { ...b, status: 'ready' } : b));
    };

    return (
        <div className="kds-container animate-fade-in">
            <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#10b981' }}>KITCHEN DISPLAY</h1>
                    <p style={{ margin: 0, color: '#94a3b8' }}>실시간 주방 주문 현황</p>
                </div>
            </div>

            <div className="kds-grid">
                {kitchenOrders.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                        <div style={{ fontSize: '4rem' }}>🍳</div>
                        <h2>현재 들어온 주문이 없습니다.</h2>
                    </div>
                ) : (
                    kitchenOrders.map(order => {
                        const isReady = order.status === 'ready';
                        const orderNum = order.items.find(i => i.name.includes('번호'))?.value || 'New';
                        const tableNum = order.items.find(i => i.name.includes('테이블'))?.value || '-';
                        const menuItems = order.items.filter(i => i.name.includes('메뉴') || (!i.name.includes('테이블') && !i.name.includes('번호')));

                        return (
                            <div key={order.id} className={`glass-panel order-card ${isReady ? 'is-ready' : ''}`} style={{ opacity: isReady ? 0.4 : 1 }}>
                                <div className="order-card-header">
                                    <span className="order-number">#{orderNum}</span>
                                    <span className="table-number">Table {tableNum}</span>
                                </div>
                                <div className="order-card-body">
                                    {menuItems.map((item, idx) => (
                                        <div key={idx} className="order-item-row">
                                            <span>{item.value}</span>
                                            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{item.name}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="order-card-footer">
                                    <span>{order.timestamp}</span>
                                    {!isReady && (
                                        <button 
                                            className="complete-btn" 
                                            onClick={() => removeOrder(order.id)}
                                            style={{ background: '#10b981', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                        >
                                            조리 완료
                                        </button>
                                    )}
                                    {isReady && <span style={{ color: '#10b981', fontWeight: 'bold' }}>✅ 준비됨</span>}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
