import React, { useEffect, useState } from 'react';
import type { BundleData } from '../types';

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
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
        const ws = new WebSocket(`${wsUrl}/ws/kitchen`);
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
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                {bundles.map(b => {
                    // 고도화된 데이터 구조 활용
                    const tableDisplay = b.table === '포장' ? 'Table : [포장]' : `Table : ${b.table}`;
                    const orderCode = b.order_code || b.id.substring(0, 4).toUpperCase();

                    return (
                        <div key={b.id} className="kitchen-card glass-panel animate-pop-in" style={{ 
                            padding: '12px', 
                            background: 'rgba(30, 41, 59, 0.7)', 
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '900', color: 'white', fontSize: '1.1rem' }}>{tableDisplay}</span>
                                    <span style={{ fontWeight: '900', color: 'var(--accent-orange)', fontSize: '1.1rem' }}>#{orderCode}</span>
                                </div>
                                <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{b.timestamp.split('.').pop()}</span>
                            </div>

                            <div className="kitchen-items" style={{ minHeight: '60px', marginBottom: '15px' }}>
                                {b.items.map((item, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{item.name}</span>
                                        <span style={{ fontSize: '1.2rem', color: 'var(--accent-orange)', fontWeight: '900' }}>{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            <button 
                                onClick={() => markAsDone(b.id)}
                                style={{ 
                                    width: '100%', 
                                    padding: '12px', 
                                    borderRadius: '12px', 
                                    background: 'linear-gradient(to bottom, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.1))', 
                                    border: '1px solid #10b981', 
                                    color: '#10b981', 
                                    fontWeight: '900',
                                    fontSize: '1rem'
                                }}
                            >
                                ✅ 조리 완료
                            </button>
                        </div>
                    );
                })}

                {bundles.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '50px', color: '#94a3b8', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '20px' }}>
                        <div style={{ fontSize: '3rem' }}>💤</div>
                        <h3>현재 조리할 음식이 없습니다.</h3>
                    </div>
                )}
            </div>
        </div>
    );
};
