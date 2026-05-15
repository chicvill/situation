import React, { useState } from 'react';
import type { BundleData } from '../types';

import { useStoreFilter } from '../hooks/useStoreFilter';

interface ReservationManagerProps {
    bundles: BundleData[];
    onSendMessage: (text: string, store_id: string, storeName: string) => void;
}

export const ReservationManager: React.FC<ReservationManagerProps> = ({ bundles, onSendMessage }) => {
    const { storeId, storeName } = useStoreFilter();
    const params = new URLSearchParams(window.location.search);
    const isRegistrationMode = params.get('mode') === 'reserve' && params.get('action') === 'register';

    const [regName, setRegName] = useState('');
    const [regPhone, setRegPhone] = useState('');
    const [regDateTime, setRegDateTime] = useState('');
    const [regCount, setRegCount] = useState('2');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regPhone || !regDateTime) return alert('연락처와 예약 일시를 입력해주세요.');
        setIsSubmitting(true);
        try {
            const cleanPhone = regPhone.replace(/[^0-9]/g, '');
            // AI가 파싱하기 좋게 자연어로 전송
            const message = `${regName || '손님'} ${cleanPhone} ${regDateTime} ${regCount}명 예약 신청`;
            onSendMessage(message, storeId, storeName);
            alert('예약 신청이 접수되었습니다! 매장에서 확인 후 확정해 드릴 예정입니다.');
            setRegName('');
            setRegPhone('');
            setRegDateTime('');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isRegistrationMode) {
        return (
            <div className="customer-reserve-registration animate-fade-in" style={{ padding: '40px 20px', background: 'var(--bg-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '30px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '1.6rem', fontWeight: 900 }}>📅 예약 신청</h2>
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '30px', fontSize: '0.9rem' }}>{storeName} 방문 예약을 도와드립니다.</p>
                    
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>예약자 성함 (필수)</label>
                            <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="성함을 입력해주세요" style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)' }} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>연락처 (필수)</label>
                            <input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="010-0000-0000" style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)' }} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>예약 일시</label>
                            <input type="datetime-local" value={regDateTime} onChange={e => setRegDateTime(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)' }} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>방문 인원</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {['1', '2', '3', '4', '5', '6+'].map(c => (
                                    <button key={c} type="button" onClick={() => setRegCount(c)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: regCount === c ? '2px solid var(--accent-orange)' : '1px solid var(--border)', background: regCount === c ? 'var(--accent-orange)' : 'transparent', color: regCount === c ? 'white' : 'var(--text-main)', fontWeight: 800 }}>{c}</button>
                                ))}
                            </div>
                        </div>
                        <button type="submit" disabled={isSubmitting} style={{ marginTop: '10px', padding: '18px', borderRadius: '15px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}>{isSubmitting ? '신청 중...' : '예약 신청하기'}</button>
                    </form>
                </div>
            </div>
        );
    }

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
                    const name = r.items?.find(i => i.name === '예약자' || i.name === '이름')?.value || '무명 고객';
                    const phone = r.items?.find(i => i.name === '전화번호' || i.name === '연락처')?.value || '';
                    const time = r.items?.find(i => i.name === '예약시간' || i.name === '일시')?.value || '시간 미지정';
                    const dayOfWeek = r.items?.find(i => i.name === '요일')?.value || '';
                    const people = r.items?.find(i => i.name === '예상인원' || i.name === '인원' || i.name.includes('명'))?.value || '2명';
                    const memo = r.items?.find(i => i.name === '메모')?.value || '';
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
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '1.1rem' }}>{time}</span>
                                    {dayOfWeek && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>({dayOfWeek})</span>}
                                </div>
                                <span style={{ 
                                     padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800',
                                     background: 'var(--primary-soft)',
                                     color: (statusColors as any)[status] || 'var(--text-muted)',
                                     height: 'fit-content'
                                }}>{status.toUpperCase()}</span>
                            </div>
 
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                                {name} 
                            </h3>
                            
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                                {phone && <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>📞 {phone}</div>}
                                <div style={{ fontSize: '0.9rem', color: 'var(--accent-orange)', fontWeight: '700' }}>👥 예상: {people}</div>
                            </div>
                            
                            {memo && (
                                <div style={{ 
                                    background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', 
                                    fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', 
                                    lineHeight: 1.5, borderLeft: '3px solid var(--border)'
                                }}>
                                    {memo}
                                </div>
                            )}
                            
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
