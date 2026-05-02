import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { BundleData } from '../types';
import { WS_BASE } from '../config';
import { useStoreFilter } from '../hooks/useStoreFilter';
import { useAIVoice } from '../hooks/useAIVoice';

export const KitchenDisplay: React.FC = () => {
    const { storeId } = useStoreFilter();
    const [bundles, setBundles] = useState<BundleData[]>([]);
    const prevCountRef = useRef(0);
    const { announce, speak } = useAIVoice();

    const fetchKitchenOrders = useCallback(async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const res = await fetch(`${apiUrl}/api/kitchen/orders?store_id=${storeId || "Total"}`);
            const data = await res.json();
            // 새 주문 감지 시 음성 알림
            if (data.length > prevCountRef.current && prevCountRef.current > 0) {
                const diff = data.length - prevCountRef.current;
                announce(`새로운 주문 ${diff}건이 들어왔습니다. 확인해 주세요.`);
            }
            prevCountRef.current = data.length;
            setBundles(data);
        } catch (e) {
            console.error('Kitchen Fetch Error:', e);
        }
    }, [storeId, announce]);

    useEffect(() => {
        fetchKitchenOrders();
        // 진입 시 브리핑
        announce('주방 모니터입니다. 대기 중인 주문을 확인해 주세요.');
        const ws = new WebSocket(`${WS_BASE}/ws/kitchen`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'NEW_ORDER' || data.type === 'STATUS_UPDATE') {
                fetchKitchenOrders();
            }
        };
        return () => ws.close();
    }, [storeId, fetchKitchenOrders, announce]);

    const markAsDone = async (orderId: string, tableId: string) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const res = await fetch(`${apiUrl}/api/order/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, status: 'ready' })
            });
            if (!res.ok) throw new Error('Update failed');
            speak(`${tableId} 조리 완료. 서빙 준비해 주세요.`);
            fetchKitchenOrders();
        } catch (e) {
            console.error('Mark Done Error:', e);
        }
    };

    // 주문을 테이블(세션)별로 그룹화
    const groupedOrders = bundles.reduce((acc, order: any) => {
        const key = order.session_id;
        if (!acc[key]) {
            acc[key] = { table: order.table_id || '미지정', orders: [] };
        }
        acc[key].orders.push(order);
        return acc;
    }, {} as Record<string, { table: string, orders: any[] }>);

    return (
        <div className="kitchen-display-v2" style={{ padding: '40px', background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-main)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: '700', margin: 0 }}>주방 모니터</h1>
                <div style={{ background: 'var(--surface)', padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-muted)' }}>
                        대기 중인 주문 <strong style={{ color: 'var(--accent)' }}>{bundles.length}</strong>
                    </span>
                    {/* AI 음성 요약 버튼 */}
                    <button
                        onClick={() => {
                            if (bundles.length === 0) {
                                speak('현재 대기 중인 주문이 없습니다.');
                            } else {
                                const tables = Object.values(groupedOrders).map(g => g.table).join(', ');
                                speak(`현재 ${bundles.length}건의 주문이 대기 중입니다. 테이블 ${tables}을 확인해 주세요.`);
                            }
                        }}
                        style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}
                    >
                        🎙️ AI 요약
                    </button>
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

                        {/* 개별 주문 리스트 */}
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {group.orders.sort((a, b) => (a.order_seq || 0) - (b.order_seq || 0)).map(order => {
                                const orderTime = new Date(order.timestamp);
                                const now = new Date();
                                const diffMins = Math.floor((now.getTime() - orderTime.getTime()) / 60000);
                                const isLate = diffMins > 10;

                                return (
                                    <div key={order.order_id} style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '700' }}>ORDER #{order.order_seq || 1}</span>
                                                {isLate && <span style={{ background: 'var(--danger)', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>DELAYED</span>}
                                            </div>
                                            <span style={{ color: isLate ? 'var(--danger)' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '600' }}>{diffMins}분 경과</span>
                                        </div>
                                        
                                        <div style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '20px', color: 'var(--text-main)', lineHeight: 1.3 }}>
                                            {order.items.map((item: any) => `${item.name} x${item.quantity || item.qty}`).join(', ')}
                                        </div>

                                        <button 
                                            onClick={() => markAsDone(order.order_id, group.table)}
                                            style={{ 
                                                width: '100%',
                                                padding: '14px', 
                                                borderRadius: 'var(--radius-sm)', 
                                                background: isLate ? 'var(--danger)' : 'var(--success)', 
                                                border: 'none',
                                                color: 'white', 
                                                fontWeight: '700',
                                                fontSize: '0.95rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                                            }}
                                        >
                                            조리 완료
                                        </button>
                                    </div>
                                );
                            })}
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
