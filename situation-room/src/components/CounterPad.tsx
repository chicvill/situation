import React, { useMemo, useState } from 'react';
import type { BundleData } from '../types';
import { PaymentModal } from './PaymentModal';
import { OrderRow } from './OrderRow';

interface CounterPadProps {
    bundles: BundleData[];
    messages: any[];
    onSendMessage: (text: string, targetId?: string) => void;
}

export const CounterPad: React.FC<CounterPadProps> = ({ bundles }) => {
    const [selectedTableForPay, setSelectedTableForPay] = useState<string | null>(null);

    const checkinRequests = bundles.filter(b => (b.type as string) === 'Checkins' && b.status === 'pending');

    const handleApproveCheckin = async (checkinId: string) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/api/checkin/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ checkinId })
            });
        } catch (e) {
            alert('승인 처리 오류!');
        }
    };

    const menus = safeBundles.filter(b => (b.type as string) === 'Menus').flatMap(b => Array.isArray(b.items) ? b.items : []);

    const tableOrders = useMemo(() => {
        const groups: Record<string, BundleData[]> = {};
        const safeBundlesMemo = Array.isArray(bundles) ? bundles : [];
        safeBundlesMemo.forEach(b => {
            if ((b.type as string) === 'Orders' && b.status !== 'archived' && b.status !== 'canceled') {
                let t = b.table || '';
                if (!t) {
                    const titleMatch = b.title.match(/테이블\s*(\d+)/) || b.title.match(/Table\s*(\d+)/i);
                    if (titleMatch) t = titleMatch[1];
                }
                if (!t) t = (Array.isArray(b.items) ? b.items : []).find(i => i.name === '테이블')?.value || '기타';

                if (!groups[t]) groups[t] = [];
                groups[t].push(b);
            }
        });
        return groups;
    }, [bundles]);

    const calculateTableTotal = (tableName: string) => {
        const orders = tableOrders[tableName] || [];
        return orders.reduce((acc, order) => {
            const safeItems = Array.isArray(order.items) ? order.items : [];
            return acc + safeItems.reduce((sum, item) => {
                const menuNameClean = item.name.replace(/x\d+$/, '').trim();
                const menu = menus.find(m => m.name.includes(menuNameClean) || menuNameClean.includes(m.name));
                const price = menu ? parseInt(menu.value.replace(/[^0-9]/g, '')) : 10000;
                const qtyMatch = item.value.match(/\d+/);
                const qty = qtyMatch ? parseInt(qtyMatch[0]) : 1;
                return sum + (price * qty);
            }, 0);
        }, 0);
    };

    const handleStatusUpdate = async (tableName: string, newStatus: 'serving' | 'archived' | 'canceled' | 'paid', payment?: string) => {
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
        } catch (e) {
            alert('업데이트 오류!');
        }
        setSelectedTableForPay(null);
    };

    return (
        <div className="counter-pad-premium" style={{ padding: '0 2px' }}>
            {/* 체크인 승인 섹션 */}
            {checkinRequests.length > 0 && (
                <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '20px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#f97316' }}>🔔 새로운 체크인 요청 ({checkinRequests.length})</h3>
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
                        {checkinRequests.map(req => (
                            <div key={req.id} style={{ flexShrink: 0, padding: '12px 20px', background: 'white', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                <span style={{ fontWeight: '900', color: '#1e293b' }}>Table {req.table}</span>
                                <button 
                                    onClick={() => handleApproveCheckin(req.id)}
                                    style={{ background: '#f97316', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    승인하기
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {/* 정산 모달 (Table 번호 및 Order No 표시) */}
            {selectedTableForPay && (() => {
                const activeOrder = (bundles || []).find(b => 
                    (b.type as string) === 'Orders' && 
                    (b.table === selectedTableForPay || (b.items || []).some(i => i.name === '테이블' && i.value === selectedTableForPay)) &&
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
                        const isPaid = orders.every(o => o.status === 'paid');
                        const deviceIds = Array.from(new Set(orders.map(o => o.device_id).filter(id => !!id)));
                        const isMultiDevice = deviceIds.length > 1;

                        const itemSummary = orders.flatMap(o => o.items).map(i => `${i.name} ${i.value}`).join(', ');
                        const total = calculateTableTotal(tableKey);

                        const orderCode = orders[0].order_code || `#${orders[0].id.slice(-4).toUpperCase()}`;

                        return (
                            <OrderRow
                                key={tableKey}
                                tableKey={tableKey}
                                orderCode={orderCode}
                                itemSummary={itemSummary}
                                totalPrice={total}
                                hasReady={hasReady}
                                statusBadge={
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                                        {isPaid ? (
                                            <span style={{ fontSize: '0.8rem', background: '#10b981', color: 'white', padding: '4px 12px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}>💰 결제완료</span>
                                        ) : hasReady ? (
                                            <span style={{ fontSize: '0.8rem', background: '#f97316', color: 'white', padding: '4px 12px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(249,115,22,0.3)' }}>✅ 조리완료</span>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}>🍳 조리중</span>
                                        )}
                                        {isMultiDevice && (
                                            <span style={{ fontSize: '0.7rem', background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>⚠️ 다른기기 추가됨</span>
                                        )}
                                    </div>
                                }
                                actionButtons={
                                    <>
                                        <button 
                                            onClick={() => handleStatusUpdate(tableKey, 'archived')}
                                            style={{ 
                                                background: (hasReady || isPaid) ? 'white' : 'rgba(255,255,255,0.1)', 
                                                color: (hasReady || isPaid) ? '#1e293b' : 'rgba(255,255,255,0.6)', 
                                                border: '1px solid rgba(255,255,255,0.2)', 
                                                padding: '10px 22px', 
                                                borderRadius: '14px', 
                                                fontWeight: '900', 
                                                fontSize: '1.1rem', 
                                                cursor: 'pointer', 
                                                boxShadow: (hasReady || isPaid) ? '0 4px 15px rgba(255,255,255,0.2)' : 'none' 
                                            }}
                                        >
                                            {isPaid ? '정리하기' : '서빙완료'}
                                        </button>
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
                                            주문취소
                                        </button>
                                        {!isPaid && (
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
                                        )}
                                    </>
                                }
                            />
                        );
                    })
                )}
            </div>
        </div>
    );
};
