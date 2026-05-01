import React, { useEffect, useState } from 'react';
import type { BundleData } from '../types';

import { WS_BASE } from '../config';

import { useStoreFilter } from '../hooks/useStoreFilter';

export const KitchenDisplay: React.FC = () => {
    const { storeId } = useStoreFilter();
    const [bundles, setBundles] = useState<BundleData[]>([]);

    const fetchKitchenOrders = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const res = await fetch(`${apiUrl}/api/kitchen/orders?store_id=${storeId || "Total"}`);
            const data = await res.json();
            setBundles(data); // data는 이미 필터링된 주문 리스트임
        } catch (e) {
            console.error('Kitchen Fetch Error:', e);
        }
    };

    useEffect(() => {
        fetchKitchenOrders();
        const ws = new WebSocket(`${WS_BASE}/ws/kitchen`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            // 모든 신규 주문이나 상태 업데이트 시 리프레시
            if (data.type === 'NEW_ORDER' || data.type === 'STATUS_UPDATE') {
                fetchKitchenOrders();
            }
        };
        return () => ws.close();
    }, [storeId]);

    const markAsDone = async (orderId: string) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const res = await fetch(`${apiUrl}/api/order/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, status: 'ready' }) // served 대신 ready 사용
            });
            if (!res.ok) throw new Error('Update failed');
            fetchKitchenOrders(); 
        } catch (e) {
            console.error('Mark Done Error:', e);
        }
    };

    // 주문을 테이블(세션)별로 그룹화
    const groupedOrders = bundles.reduce((acc, order: any) => {
        const key = order.session_id;
        if (!acc[key]) {
            acc[key] = {
                table: order.table_id || '미지정',
                orders: []
            };
        }
        acc[key].orders.push(order);
        return acc;
    }, {} as Record<string, { table: string, orders: any[] }>);

    return (
        <div className="kitchen-display-v2" style={{ padding: '40px', background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-main)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: '700', margin: 0 }}>
                    주방 모니터
                </h1>
                <div style={{ background: 'var(--surface)', padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-muted)' }}>대기 중인 주문 <strong style={{ color: 'var(--accent)' }}>{bundles.length}</strong></span>
                </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '30px' }}>
                {Object.entries(groupedOrders).map(([sessionId, group]) => (
                    <div key={sessionId} style={{ 
                        background: 'var(--surface)', 
                        borderRadius: 'var(--radius-md)', 
                        border: '1px solid var(--border)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* 테이블 헤더 */}
                        <div style={{ 
                            padding: '20px', 
                            background: group.table === '포장' ? 'var(--warning)' : 'var(--primary)',
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            color: 'white'
                        }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                                {group.table === '포장' ? '포장 주문' : `TABLE ${group.table}`}
                            </span>
                            <span style={{ opacity: 0.9, fontSize: '0.85rem' }}>{group.orders.length} ITEMS</span>
                        </div>

                        {/* 개별 주문 리스트 (순번순 정렬) */}
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {group.orders.sort((a, b) => (a.order_seq || 0) - (b.order_seq || 0)).map(order => (
                                <div key={order.order_id} style={{ 
                                    paddingBottom: '20px',
                                    borderBottom: '1px solid var(--border)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <span style={{ 
                                            color: 'var(--text-muted)',
                                            fontSize: '0.8rem',
                                            fontWeight: '600'
                                        }}>
                                            ORDER #{order.order_seq || 1}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{order.timestamp.split('T')[1]?.split('.')[0] || order.timestamp}</span>
                                    </div>
                                    
                                    <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '20px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                                        {order.items.map((item: any) => `${item.name} x${item.quantity || item.qty}`).join(', ')}
                                    </div>

                                    <button 
                                        onClick={() => markAsDone(order.order_id)}
                                        style={{ 
                                            width: '100%',
                                            padding: '12px', 
                                            borderRadius: 'var(--radius-sm)', 
                                            background: 'transparent', 
                                            border: `1px solid ${order.payment_status === 'prepaid' ? 'var(--danger)' : 'var(--success)'}`, 
                                            color: order.payment_status === 'prepaid' ? 'var(--danger)' : 'var(--success)', 
                                            fontWeight: '600',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {order.payment_status === 'prepaid' ? '선불 결제 완료 - 조리완료 처리' : '조리 완료'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {bundles.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>😴</div>
                        <h2>대기 중인 주문이 없습니다.</h2>
                    </div>
                )}
            </div>
        </div>
    );
};
