import React, { useMemo, useState } from 'react';
import type { BundleData } from '../types';
import { PaymentModal } from './PaymentModal';

interface CounterPadProps {
    bundles: BundleData[];
    messages: any[];
    onSendMessage: (text: string, targetId?: string) => void;
}

export const CounterPad: React.FC<CounterPadProps> = ({ bundles }) => {
    const [selectedTableForPay, setSelectedTableForPay] = useState<string | null>(null);
    const [localHiddenTables, setLocalHiddenTables] = useState<string[]>([]);

    const menus = bundles.filter(b => b.type === 'Menus').flatMap(b => b.items);

    const tableOrders = useMemo(() => {
        const groups: Record<string, BundleData[]> = {};
        bundles.forEach(b => {
            if (b.type === 'Orders' && b.status !== 'archived' && b.status !== 'canceled' && !localHiddenTables.includes(b.table || '')) {
                let t = b.table || '';
                if (!t) {
                    const titleMatch = b.title.match(/테이블\s*(\d+)/) || b.title.match(/Table\s*(\d+)/i);
                    if (titleMatch) t = titleMatch[1];
                }
                if (!t) t = b.items.find(i => i.name === '테이블')?.value || '기타';

                if (!groups[t]) groups[t] = [];
                groups[t].push(b);
            }
        });
        return groups;
    }, [bundles, localHiddenTables]);

    const calculateTableTotal = (tableName: string) => {
        const orders = tableOrders[tableName] || [];
        return orders.reduce((acc, order) => {
            return acc + order.items.reduce((sum, item) => {
                const menuNameClean = item.name.replace(/x\d+$/, '').trim();
                const menu = menus.find(m => m.name.includes(menuNameClean) || menuNameClean.includes(m.name));
                const price = menu ? parseInt(menu.value.replace(/[^0-9]/g, '')) : 10000;
                const qtyMatch = item.value.match(/\d+/);
                const qty = qtyMatch ? parseInt(qtyMatch[0]) : 1;
                return sum + (price * qty);
            }, 0);
        }, 0);
    };

    const handleStatusUpdate = async (tableName: string, newStatus: 'serving' | 'archived' | 'canceled', payment?: string) => {
        const orders = tableOrders[tableName] || [];
        const orderIds = orders.map(o => o.id);
        
        if (orderIds.length === 0) {
            alert("처리할 주문이 없습니다.");
            return;
        }

        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/api/order/update-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    bundleIds: orderIds, 
                    status: newStatus,
                    payment: payment
                })
            });

            if (newStatus === 'archived') {
                setLocalHiddenTables(prev => [...prev, tableName]);
            }
        } catch (e) {
            alert('업데이트 오류!');
        }
        setSelectedTableForPay(null);
    };

    return (
        <div className="counter-pad-premium" style={{ padding: '0 2px' }}>
            {/* 정산 모달 (Table 번호 및 Order No 표시) */}
            {selectedTableForPay && (() => {
                const activeOrder = bundles.find(b => 
                    b.type === 'Orders' && 
                    (b.table === selectedTableForPay || b.items.some(i => i.name === '테이블' && i.value === selectedTableForPay)) &&
                    b.status !== 'archived' && b.status !== 'canceled'
                );
                
                let orderNo = '----';
                let prepaidMethod = null;
                if (activeOrder) {
                    orderNo = activeOrder.order_code || `#${activeOrder.id.slice(-4).toUpperCase()}`;
                    prepaidMethod = activeOrder.payment;
                }
                const totalPrice = calculateTableTotal(selectedTableForPay);

                return (
                    <PaymentModal 
                        totalPrice={totalPrice}
                        onClose={() => setSelectedTableForPay(null)}
                        onSubmit={(method) => handleStatusUpdate(selectedTableForPay, 'archived', method)}
                        isCounter={true}
                        prepaidMethod={prepaidMethod}
                        tableNo={selectedTableForPay}
                        orderNo={orderNo}
                    />
                );
            })()}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.keys(tableOrders).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '20px', color: '#94a3b8' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>✨</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>진행 중인 주문이 없습니다.</div>
                    </div>
                ) : (
                    Object.entries(tableOrders).map(([tableKey, orders]) => {
                        const hasReady = orders.some(o => o.status === 'ready');
                        const itemSummary = orders.flatMap(o => o.items).map(i => `${i.name} ${i.value}`).join(', ');
                        const total = calculateTableTotal(tableKey);

                        return (
                            <div key={tableKey} style={{ 
                                background: hasReady ? 'rgba(249, 115, 22, 0.08)' : 'rgba(30, 41, 59, 0.5)', 
                                border: hasReady ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)', 
                                borderRadius: '18px', padding: '14px' 
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                            <span style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white' }}>
                                                {tableKey === '포장' ? 'Table : [포장]' : `Table : ${tableKey}`}
                                            </span>
                                            <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.4)' }}>|</span>
                                            <span style={{ fontSize: '1.1rem', color: 'var(--accent-orange)', fontWeight: 'bold' }}>
                                                Order No : {
                                                    orders[0].order_code || 
                                                    `#${orders[0].id.slice(-4).toUpperCase()}`
                                                }
                                            </span>
                                        </div>
                                        {hasReady && <span style={{ fontSize: '0.8rem', background: '#f97316', color: 'white', padding: '3px 10px', borderRadius: '6px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(249,115,22,0.3)' }}>조리완료</span>}
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        {hasReady && (
                                            <button 
                                                onClick={() => handleStatusUpdate(tableKey, 'serving')}
                                                style={{ background: 'white', color: '#1e293b', border: 'none', padding: '10px 22px', borderRadius: '14px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(255,255,255,0.2)' }}
                                            >
                                                서빙하기
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => {
                                                if(window.confirm(`Table ${tableKey}의 전체 주문을 취소하시겠습니까?\n이 작업은 복구할 수 없습니다.`)) {
                                                    handleStatusUpdate(tableKey, 'canceled', '취소됨');
                                                }
                                            }}
                                            style={{ 
                                                background: 'rgba(239, 68, 68, 0.1)', 
                                                color: '#ef4444', 
                                                border: '1px solid #ef4444', 
                                                padding: '10px 22px', 
                                                borderRadius: '14px', 
                                                fontWeight: '900', 
                                                fontSize: '1.1rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            취소
                                        </button>
                                        <button 
                                            onClick={() => setSelectedTableForPay(tableKey)}
                                            style={{ 
                                                background: hasReady ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.2)', 
                                                color: '#10b981', 
                                                border: '1px solid #10b981', 
                                                padding: '10px 22px', 
                                                borderRadius: '14px', 
                                                fontWeight: '900', 
                                                fontSize: '1.1rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {hasReady ? '결제(정산)' : '정산하기'}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '1.1rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>🍱 {itemSummary}</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: '900', color: hasReady ? 'white' : '#10b981' }}>{total.toLocaleString()}원</div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
