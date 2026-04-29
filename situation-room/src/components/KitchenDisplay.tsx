import React, { useEffect, useState } from 'react';
import type { BundleData } from '../types';
import { OrderRow } from './OrderRow';
import { WS_BASE } from '../config';

export const KitchenDisplay: React.FC = () => {
    const [bundles, setBundles] = useState<BundleData[]>([]);

    const fetchPool = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const res = await fetch(`${apiUrl}/api/pool`);
            const data = await res.json();
            // 주방에서는 'Orders' 중 조리가 필요한 것만 필터링
            setBundles(data.filter((b: BundleData) => b.type === 'Orders' && b.status !== 'ready' && b.status !== 'archived' && b.status !== 'canceled'));
        } catch (e) {
            console.error('Kitchen Fetch Error:', e);
        }
    };

    useEffect(() => {
        fetchPool();
        const ws = new WebSocket(`${WS_BASE}/ws/kitchen`);
        ws.onmessage = () => fetchPool();
        return () => ws.close();
    }, []);

    const markAsDone = async (bundleId: string) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const res = await fetch(`${apiUrl}/api/order/update-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    bundleIds: [bundleId], 
                    status: 'ready' 
                })
            });
            if (!res.ok) throw new Error('Update failed');
        } catch (e) {
            console.error('Mark Done Error:', e);
            alert("조리 완료 처리 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="kitchen-display-premium" style={{ padding: '10px' }}>
            <h2 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                👨‍🍳 주방 조리 현황 <span style={{ fontSize: '1rem', color: 'var(--accent-orange)' }}>{bundles.length}건 대기 중</span>
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {bundles.map(b => {
                    const tableKey = b.table || '기타';
                    const orderCode = b.order_code || b.id.substring(0, 4).toUpperCase();
                    const itemSummary = b.items.filter(i => i.name !== '테이블').map(i => `${i.name} ${i.value}`).join(', ');

                    return (
                        <OrderRow
                            key={b.id}
                            tableKey={tableKey}
                            orderCode={orderCode}
                            itemSummary={itemSummary}
                            hasReady={false}
                            statusBadge={
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{b.timestamp.split('.').pop()}</span>
                                    <span style={{ fontSize: '0.8rem', background: '#3b82f6', color: 'white', padding: '4px 12px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}>🍳 조리중</span>
                                </div>
                            }
                            actionButtons={
                                <button 
                                    onClick={() => markAsDone(b.id)}
                                    style={{ 
                                        padding: '10px 22px', 
                                        borderRadius: '14px', 
                                        background: 'rgba(16, 185, 129, 0.2)', 
                                        border: '1px solid #10b981', 
                                        color: '#10b981', 
                                        fontWeight: '900',
                                        fontSize: '1.1rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ✅ 조리 완료
                                </button>
                            }
                        />
                    );
                })}

                {bundles.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '20px' }}>
                        <div style={{ fontSize: '3rem' }}>💤</div>
                        <h3>현재 조리할 음식이 없습니다.</h3>
                    </div>
                )}
            </div>
        </div>
    );
};
