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
        <div className="admin-page animate-fade-in" style={{ padding: '40px', background: 'var(--bg-main)', minHeight: '100vh' }}>
            <header className="page-header" style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>예약 관리 시스템</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>실시간 예약 현황을 효율적으로 관리합니다.</p>
            </header>

            <div className="reservation-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' }}>
                {reservations.map((r) => {
                    const name = r.items.find(i => i.name === '예약자')?.value || '무명 고객';
                    const time = r.items.find(i => i.name === '예약시간')?.value || '시간 미지정';
                    const people = r.items.find(i => i.name === '인원')?.value || '2명';
                    const memo = r.items.find(i => i.name === '메모')?.value || '';
                    const status: string = (r.status as string) || 'pending';

                    const statusColors = {
                        confirmed: 'var(--success)',
                        canceled: 'var(--danger)',
                        pending: 'var(--warning)',
                        finished: 'var(--text-muted)'
                    };

                    return (
                        <div key={r.id} style={{ 
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border)',
                            padding: '25px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: (statusColors as any)[status] || 'var(--border)' }}></div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <span style={{ fontWeight: '600', color: 'var(--accent)', fontSize: '0.95rem' }}>{time}</span>
                                <span style={{ 
                                    padding: '2px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '700',
                                    background: 'var(--primary-soft)',
                                    color: (statusColors as any)[status] || 'var(--text-muted)',
                                    textTransform: 'uppercase'
                                }}>{status}</span>
                            </div>

                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)' }}>
                                {name} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '400' }}>({people})</span>
                            </h3>
                            
                            {memo && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '25px', lineHeight: 1.5 }}>{memo}</p>}
                            
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {status === 'pending' && (
                                    <button 
                                        onClick={() => handleAction(r, 'confirmed')} 
                                        style={{ 
                                            flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', 
                                            background: 'var(--primary)', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem'
                                        }} 
                                        disabled={isProcessing}
                                    >
                                        확정하기
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleAction(r, 'canceled')} 
                                    style={{ 
                                        flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', 
                                        background: 'transparent', color: 'var(--danger)', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem'
                                    }} 
                                    disabled={isProcessing}
                                >
                                    {status === 'canceled' ? '내역 삭제' : '예약 취소'}
                                </button>
                            </div>
                        </div>
                    );
                })}

                {reservations.length === 0 && (
                    <div style={{ 
                        gridColumn: '1 / -1', padding: '100px', textAlign: 'center', 
                        background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' 
                    }}>
                        <h3 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>등록된 예약 정보가 없습니다.</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>AI 비서에게 예약을 등록해 달라고 요청해 보세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
