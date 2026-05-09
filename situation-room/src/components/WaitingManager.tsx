import React from 'react';
import type { BundleData } from '../types';

import { useStoreFilter } from '../hooks/useStoreFilter';

interface WaitingManagerProps {
    bundles: BundleData[];
    onSendMessage: (text: string, store_id: string, storeName: string) => void;
}

export const WaitingManager: React.FC<WaitingManagerProps> = ({ bundles, onSendMessage }) => {
    const { storeId, storeName } = useStoreFilter();
    
    // 대기 번들 중 활성화된(취소/완료되지 않은) 목록만 필터링
    const waitingList = bundles.filter(b => 
        b.type === 'Waiting' && 
        b.status !== 'canceled' && 
        b.status !== 'finished' && 
        b.status !== 'seated' &&
        (storeId === 'Total' || b.store_id === storeId || !b.store_id)
    );

    const handleCall = (waitingNo: string) => {
        const cleanNo = waitingNo.startsWith('대기 ') ? waitingNo : `대기 ${waitingNo}`;
        onSendMessage(`${cleanNo} 손님 호출`, storeId, storeName);
    };

    const handleEnter = async (bundle: BundleData, waitingNo: string) => {
        const cleanNo = waitingNo.startsWith('대기 ') ? waitingNo : `대기 ${waitingNo}`;
        if (window.confirm(`${cleanNo} 손님을 입장 처리하시겠습니까?`)) {
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
        }
    };

    const handleCancel = async (bundle: BundleData, waitingNo: string) => {
        const cleanNo = waitingNo.startsWith('대기 ') ? waitingNo : `대기 ${waitingNo}`;
        if (window.confirm(`${cleanNo}을 취소하시겠습니까?`)) {
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
        }
    };

    return (
        <div className="admin-page animate-fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>🛎️ 실시간 대기 명단 관리</h2>
                    <p>현재 대기 중인 고객님의 호출 및 입장 상태를 관리합니다.</p>
                </div>
                <div className="waiting-stats glass-panel" style={{ padding: '10px 20px', display: 'flex', gap: '20px' }}>
                    <div className="stat">
                        <label style={{ fontSize: '0.8rem', opacity: 0.7 }}>총 대기</label>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--premium-orange)' }}>{waitingList.length}팀</div>
                    </div>
                </div>
            </header>

            <div className="glass-panel" style={{ padding: '0' }}>
                <table className="employee-table">
                    <thead>
                        <tr>
                            <th>순번</th>
                            <th>식별 정보/이름</th>
                            <th>인원</th>
                            <th>대기 시간</th>
                            <th style={{ textAlign: 'right' }}>액션</th>
                        </tr>
                    </thead>
                    <tbody>
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
                                <tr key={w.id} className="animate-pop-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                                    <td><span className="id-badge">{idx + 1}</span></td>
                                    <td style={{ fontWeight: 'bold' }}>{idInfo}</td>
                                    <td>{headCount}</td>
                                    <td>{w.timestamp} (약 15분 전)</td>
                                    <td style={{ textAlign: 'right', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                        <button className="confirm-btn premium-orange" onClick={() => handleCall(idInfo)}>🔔 호출</button>
                                        <button className="confirm-btn success-green" onClick={() => handleEnter(w, idInfo)}>🚀 입장</button>
                                        <button className="del-btn" onClick={() => handleCancel(w, idInfo)} style={{ width: '40px' }}>×</button>
                                    </td>
                                </tr>
                            );
                        })}
                        {waitingList.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ padding: '100px', textAlign: 'center', opacity: 0.5 }}>
                                    <h3>🍵 현재 대기 중인 손님이 없습니다.</h3>
                                    <p>AI 콘솔에 "3명 대기 등록"과 같이 입력하면 자동으로 추가됩니다.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
