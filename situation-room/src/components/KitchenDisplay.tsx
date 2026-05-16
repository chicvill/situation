import React, { useEffect, useState, useMemo } from 'react';
import type { BundleData } from '../types';
import { API_BASE } from '../config';
import { subscribeTopic } from '../services/mqttClient';
import { useStoreFilter } from '../hooks/useStoreFilter';

export const KitchenDisplay: React.FC = () => {
    const { storeId } = useStoreFilter();
    const [bundles, setBundles] = useState<BundleData[]>([]);

    const fetchKitchenOrders = async () => {
        try {
            const apiUrl = API_BASE;
            const res = await fetch(`${apiUrl}/api/kitchen/orders?store_id=${storeId || "Total"}`);
            const data = await res.json();
            setBundles(data); // data는 이미 필터링된 주문 리스트임
        } catch (e) {
            console.error('Kitchen Fetch Error:', e);
        }
    };

    useEffect(() => {
        fetchKitchenOrders();
        const refreshTypes = ['NEW_ORDER', 'STATUS_UPDATE', 'PAYMENT_CONFIRMED', 'STAFF_CALL', 'PARKING_APPLIED', 'WAITING_REGISTERED'];
        
        // 매장별 토픽 또는 전체 브로드캐스트 구독
        const topic = (storeId && storeId !== 'Total') ? `store/${storeId}/kitchen` : `store/+/kitchen`;
        
        const messageHandler = (data: any) => {
            if (refreshTypes.includes(data.type)) {
                fetchKitchenOrders();
                
                // 가상 테이블 처리 (주차: 98, 대기: 99)
                if (data.type === 'PARKING_APPLIED') {
                    setVirtualOrders(prev => [
                        {
                            order_id: data.parking_id,
                            table_id: '98',
                            session_id: 'SESS-PARK-98',
                            order_seq: 1,
                            timestamp: new Date().toISOString(),
                            items: [{ name: `[주차] ${data.vehicle_number}`, quantity: 1 }]
                        },
                        ...prev
                    ]);
                } else if (data.type === 'WAITING_REGISTERED') {
                    setVirtualOrders(prev => [
                        {
                            order_id: data.waiting_id,
                            table_id: '99',
                            session_id: 'SESS-WAIT-99',
                            order_seq: 1,
                            timestamp: new Date().toISOString(),
                            items: [{ name: `[대기] ${data.phone_number}`, quantity: data.party_size || 1 }]
                        },
                        ...prev
                    ]);
                }
            }
        };

        const unsubscribe1 = subscribeTopic(topic, messageHandler);
        const unsubscribe2 = (storeId && storeId !== 'Total') ? subscribeTopic('store/broadcast/kitchen', messageHandler) : () => {};

        return () => {
            unsubscribe1();
            unsubscribe2();
        };
    }, [storeId]);

    const markAsDone = async (orderId: string) => {
        // 가상 주문인지 확인
        if (virtualOrders.some(vo => vo.order_id === orderId)) {
            setVirtualOrders(prev => prev.filter(vo => vo.order_id !== orderId));
            return;
        }

        try {
            const apiUrl = API_BASE;
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

    // 가상 테이블(98, 99) 및 실시간 가상 주문 상태 관리
    const [virtualOrders, setVirtualOrders] = useState<any[]>([]);
    
    // 주문을 테이블(세션)별로 그룹화
    const groupedOrders = useMemo(() => {
        const acc = bundles.reduce((acc, order: any) => {
            const key = order.session_id || 'no-session';
            if (!acc[key]) {
                acc[key] = {
                    table: order.table_id || '미지정',
                    orders: []
                };
            }
            acc[key].orders.push(order);
            return acc;
        }, {} as Record<string, { table: string, orders: any[] }>);

        // 가상 주문(주차/대기) 병합
        virtualOrders.forEach(vo => {
            const key = vo.session_id;
            if (!acc[key]) {
                acc[key] = {
                    table: vo.table_id,
                    orders: []
                };
            }
            if (!acc[key].orders.some((o: any) => o.order_id === vo.order_id)) {
                acc[key].orders.push(vo);
            }
        });
        
        return acc;
    }, [bundles, virtualOrders]);

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
                            background: group.table === '포장' ? 'var(--warning)' : 
                                       group.table === '98' ? 'var(--accent-orange)' : 
                                       group.table === '99' ? 'var(--accent)' : 'var(--primary)',
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            color: 'white',
                            animation: (group.table === '98' || group.table === '99') ? 'pulse-glow 2s infinite' : 'none'
                        }}>
                            <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>
                                {group.table === '포장' ? '포장 주문' : 
                                 group.table === '98' ? '🚗 주차 할인' :
                                 group.table === '99' ? '🛎️ 대기 접수' : 
                                 (() => {
                                     const num = parseInt(group.table.replace('T', ''));
                                     const cap = !isNaN(num) ? ((num <= 4) ? 4 : (num <= 8) ? 2 : (num <= 10) ? 6 : 4) : null;
                                     return cap ? `TABLE ${group.table}[${cap}]` : `TABLE ${group.table}`;
                                 })()
                                }
                            </span>
                            <span style={{ opacity: 0.9, fontSize: '0.85rem' }}>{group.orders.length} ITEMS</span>
                        </div>

                        {/* 개별 주문 리스트 (순번순 정렬) */}
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {group.orders.sort((a, b) => (a.order_seq || 0) - (b.order_seq || 0)).map(order => {
                                const orderTime = new Date(order.timestamp);
                                const now = new Date();
                                const diffMins = Math.floor((now.getTime() - orderTime.getTime()) / 60000);
                                const isLate = diffMins > 10;

                                return (
                                    <div key={order.order_id} style={{ 
                                        paddingBottom: '20px',
                                        borderBottom: '1px solid var(--border)'
                                    }}>
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
                                            onClick={() => markAsDone(order.order_id)}
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
