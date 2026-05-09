import React from 'react';
import type { BundleData } from '../types';

import { useStoreFilter } from '../hooks/useStoreFilter';

interface WaitingManagerProps {
    bundles: BundleData[];
    onSendMessage: (text: string, store_id: string, storeName: string) => void;
}

export const WaitingManager: React.FC<WaitingManagerProps> = ({ bundles, onSendMessage }) => {
    const { storeId, storeName } = useStoreFilter();
    
    // 대기 번들 중 진짜 활성화된(취소/완료되지 않은) 목록만 필터링 (역사적 사건 로그 제외)
    const waitingList = bundles.filter(b => {
        if (b.type !== 'Waiting') return false;
        
        // 1. 매장 필터링
        const storeMatch = storeId === 'Total' || b.store_id === storeId || !b.store_id;
        if (!storeMatch) return false;
        
        // 2. 루트 status 필터링
        if (b.status === 'canceled' || b.status === 'finished' || b.status === 'seated') return false;
        
        // 3. 타이틀 키워드 필터링 (취소/입장/완료 사건 로그 제외)
        const title = b.title || '';
        if (title.includes('취소') || title.includes('입장') || title.includes('완료') || title.includes('퇴장')) {
            return false;
        }
        
        // 4. 세부 아이템(items) 내부의 '상태' 필터링 (AI가 세부 항목으로 상태를 기입한 경우 보호)
        const statusItem = b.items?.find(i => i.name === '상태' || i.name.includes('조치') || i.name.includes('진행'));
        if (statusItem) {
            const val = statusItem.value?.toString() || '';
            if (val.includes('취소') || val.includes('완료') || val.includes('입장') || val.includes('종료')) {
                return false;
            }
        }
        
        return true;
    });

    const handleCall = (waitingNo: string) => {
        const cleanNo = waitingNo.startsWith('대기 ') ? waitingNo : `대기 ${waitingNo}`;
        onSendMessage(`${cleanNo} 손님 호출`, storeId, storeName);
    };

    const handleEnter = async (bundle: BundleData, waitingNo: string) => {
        const cleanNo = waitingNo.startsWith('대기 ') ? waitingNo : `대기 ${waitingNo}`;
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, status: 'finished', store: storeName, store_id: storeId }),
            });
            onSendMessage(`${cleanNo} 입장 완료`, storeId, storeName);
        } catch (err) {
            console.error("Failed to enter waiting:", err);
        }
    };

    const handleCancel = async (bundle: BundleData, waitingNo: string) => {
        const cleanNo = waitingNo.startsWith('대기 ') ? waitingNo : `대기 ${waitingNo}`;
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, status: 'canceled', store: storeName, store_id: storeId }),
            });
            onSendMessage(`${cleanNo} 취소`, storeId, storeName);
        } catch (err) {
            console.error("Failed to cancel waiting:", err);
        }
    };

    return (
        <div className="admin-page animate-fade-in" style={{ padding: '15px' }}>
            <header className="page-header-mobile" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>🛎️ 실시간 대기 명단</h2>
                    <div style={{ 
                        background: 'rgba(249, 115, 22, 0.1)', 
                        color: 'var(--premium-orange)', 
                        padding: '6px 14px', 
                        borderRadius: '20px', 
                        fontSize: '0.85rem', 
                        fontWeight: '800' 
                    }}>
                        대기 {waitingList.length}팀
                    </div>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '5px 0 0 0' }}>고객님의 호출 및 입장 상태를 직관적으로 관리합니다.</p>
            </header>

            <div className="waiting-cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {waitingList.map((w, idx) => {
                    const nameItem = w.items?.find(i => i.name === '이름' || i.name === '예약자' || i.name.includes('고객명'));
                    const phoneItem = w.items?.find(i => i.name.includes('연락처') || i.name.includes('번호') || i.name.includes('전화'));
                    
                    // 1. 만약 한글/영문 이름이 있으면 이름 우선 표시
                    let idInfo = nameItem?.value || '';
                    
                    // 2. 만약 이름이 없고 연락처 뒷자리 등이 있으면 그것을 표시
                    if (!idInfo && phoneItem && isNaN(Number(phoneItem.value)) === false) {
                        idInfo = `손님 (${phoneItem.value.slice(-4)})`;
                    }
                    
                    // 3. 만약 이름도 연락처도 없거나 그냥 단일 숫자라면, 고유한 4자리 영숫자 티켓 번호를 결합하여 절대 중복되지 않게 생성!
                    if (!idInfo || !isNaN(Number(idInfo))) {
                        const shortId = (w.id.includes('-') ? w.id.split('-')[1] : w.id).substring(0, 4).toUpperCase();
                        const numberPrefix = idInfo ? `${idInfo}번` : `${idx + 1}번`;
                        idInfo = `대기 ${numberPrefix} [${shortId}]`;
                    }
                    
                    const headCount = w.items?.find(i => i.name.includes('인원'))?.value || '2명';
                    
                    return (
                        <div key={w.id} className="waiting-card animate-pop-in" style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                            position: 'relative'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="id-badge-new" style={{
                                        background: 'var(--primary-soft)',
                                        color: 'var(--text-main)',
                                        fontWeight: '800',
                                        fontSize: '0.8rem',
                                        padding: '4px 8px',
                                        borderRadius: '6px'
                                    }}>{idx + 1}</span>
                                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{idInfo}</strong>
                                </div>
                                <span style={{ fontSize: '0.85rem', color: 'var(--premium-orange)', fontWeight: '700' }}>
                                    👥 {headCount}
                                </span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span>🕒 {w.timestamp}</span>
                                <span style={{ opacity: 0.7 }}>(약 15분 전)</span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button className="confirm-btn premium-orange" onClick={() => handleCall(idInfo)} style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                                    🔔 호출
                                </button>
                                <button className="confirm-btn success-green" onClick={() => handleEnter(w, idInfo)} style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                                    🚀 입장
                                </button>
                                <button className="del-btn" onClick={() => handleCancel(w, idInfo)} style={{ width: '44px', height: '38px', padding: 0, fontSize: '1.2rem', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    ×
                                </button>
                            </div>
                        </div>
                    );
                })}

                {waitingList.length === 0 && (
                    <div style={{ padding: '60px 20px', textAlign: 'center', opacity: 0.5 }}>
                        <span style={{ fontSize: '3rem' }}>🍵</span>
                        <h3 style={{ margin: '15px 0 5px', fontSize: '1.1rem' }}>현재 대기 중인 손님이 없습니다.</h3>
                        <p style={{ fontSize: '0.8rem', margin: 0 }}>AI 콘솔에 "3명 대기 등록"과 같이 입력하면 추가됩니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
