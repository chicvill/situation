import React, { useState } from 'react';
import type { BundleData } from '../types';

import { useStoreFilter } from '../hooks/useStoreFilter';

interface ReservationManagerProps {
    bundles: BundleData[];
}

export const ReservationManager: React.FC<ReservationManagerProps> = ({ bundles }) => {
    const { storeId, storeName } = useStoreFilter();
    const [isProcessing, setIsProcessing] = useState(false);
    
    // 현재 매장의 예약 정보만 필터링
    const reservations = bundles.filter(b => b.type === 'Reservations' && (storeId === 'Total' || b.store_id === storeId || !b.store_id));

    const handleAction = async (bundle: any, action: 'confirmed' | 'canceled' | 'finished') => {
        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, status: action, store: storeName, store_id: storeId }),
            });
            alert(`예약이 ${action === 'confirmed' ? '확정' : action === 'canceled' ? '취소' : '종료'} 처리되었습니다.`);
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
    };

    return (
        <div className="admin-page animate-fade-in">
            <header className="page-header">
                <h2>📅 {storeName} 예약 관리 시스템</h2>
                <p>전화 및 온라인으로 접수된 예약 현황을 실시간으로 관리합니다.</p>
            </header>

            <div className="reservation-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {reservations.map((r, idx) => {
                    const name = r.items.find(i => i.name === '예약자')?.value || '무명 고객';
                    const time = r.items.find(i => i.name === '예약시간')?.value || '시간 미지정';
                    const people = r.items.find(i => i.name === '인원')?.value || '2명';
                    const memo = r.items.find(i => i.name === '메모')?.value || '';
                    const status = r.status || 'pending';

                    return (
                        <div key={r.id} className="glass-panel reservation-card" style={{ 
                            borderLeft: `5px solid ${status === 'confirmed' ? '#22c55e' : status === 'canceled' ? '#ef4444' : '#f97316'}`,
                            padding: '20px'
                        }}>
                            <div className="card-top" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                <span className="time" style={{ fontWeight: 'bold', color: 'var(--accent-orange)' }}>⏰ {time}</span>
                                <span className={`status-badge ${status}`} style={{ 
                                    padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem',
                                    background: status === 'confirmed' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(249, 115, 22, 0.1)',
                                    color: status === 'confirmed' ? '#22c55e' : '#f97316'
                                }}>{status.toUpperCase()}</span>
                            </div>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem' }}>{name} <small style={{ opacity: 0.6 }}>({people})</small></h3>
                            {memo && <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '20px' }}>📝 {memo}</p>}
                            
                            <div className="card-actions" style={{ display: 'flex', gap: '10px' }}>
                                {status === 'pending' && (
                                    <button onClick={() => handleAction(r, 'confirmed')} className="confirm-btn success-green" style={{ flex: 1 }} disabled={isProcessing}>예약 확정</button>
                                )}
                                <button onClick={() => handleAction(r, 'canceled')} className="del-btn" style={{ flex: 1, padding: '10px' }} disabled={isProcessing}>예약 취소</button>
                            </div>
                        </div>
                    );
                })}

                {reservations.length === 0 && (
                    <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '100px', textAlign: 'center', opacity: 0.5 }}>
                        <h3>📅 등록된 예약 정보가 없습니다.</h3>
                        <p>AI 비서에게 "내일 오후 2시 홍길동님 4명 예약 등록해줘"라고 말씀해 보세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
