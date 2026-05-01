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
        <div className="kitchen-display-v2" style={{ padding: '20px', background: '#0f172a', minHeight: '100vh', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h1 style={{ fontSize: '2.2rem', fontWeight: '900', margin: 0 }}>
                    👨‍🍳 주방 모니터
                </h1>
                <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '10px 20px', borderRadius: '15px', border: '1px solid #3b82f6' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>총 {bundles.length}건 대기</span>
                </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '25px' }}>
                {Object.entries(groupedOrders).map(([sessionId, group]) => (
                    <div key={sessionId} style={{ 
                        background: 'rgba(255, 255, 255, 0.03)', 
                        borderRadius: '24px', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* 테이블 헤더 */}
                        <div style={{ 
                            padding: '15px 20px', 
                            background: group.table === '포장' ? '#f59e0b' : '#3b82f6',
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: '900' }}>
                                {group.table === '포장' ? '📦 포장 주문' : `🪑 TABLE ${group.table}`}
                            </span>
                            <span style={{ opacity: 0.8, fontSize: '0.9rem' }}>{group.orders.length}개 주문</span>
                        </div>

                        {/* 개별 주문 리스트 (순번순 정렬) */}
                        <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {group.orders.sort((a, b) => (a.order_seq || 0) - (b.order_seq || 0)).map(order => (
                                <div key={order.order_id} style={{ 
                                    background: 'rgba(255,255,255,0.05)', 
                                    borderRadius: '16px', 
                                    padding: '15px',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <span style={{ 
                                            background: 'rgba(255,255,255,0.1)', 
                                            padding: '4px 10px', 
                                            borderRadius: '8px',
                                            fontSize: '0.9rem',
                                            fontWeight: 'bold'
                                        }}>
                                            #{order.order_seq || 1}차 주문
                                        </span>
                                        <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>{order.timestamp.split('T')[1]?.split('.')[0] || order.timestamp}</span>
                                    </div>
                                    
                                    <div style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '15px', color: '#e2e8f0' }}>
                                        {order.items.map((item: any) => `${item.name} x${item.quantity || item.qty}`).join(', ')}
                                    </div>

                                    <button 
                                        onClick={() => markAsDone(order.order_id)}
                                        style={{ 
                                            width: '100%',
                                            padding: '12px', 
                                            borderRadius: '12px', 
                                            background: order.payment_status === 'prepaid' ? '#EF4444' : '#10b981', 
                                            border: 'none', 
                                            color: 'white', 
                                            fontWeight: '900',
                                            fontSize: '1rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {order.payment_status === 'prepaid' ? '💳 선불완료 (조리완료)' : '조리 완료'}
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
