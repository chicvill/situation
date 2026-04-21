import React from 'react';
import type { BundleData } from '../types';

interface WaitingManagerProps {
    bundles: BundleData[];
    onSendMessage: (text: string) => void;
}

export const WaitingManager: React.FC<WaitingManagerProps> = ({ bundles, onSendMessage }) => {
    const waitingList = bundles.filter(b => b.type === 'Waiting');

    const handleCall = (waitingNo: string) => {
        onSendMessage(`대기 ${waitingNo}번 손님 호출`);
    };

    const handleEnter = (waitingNo: string) => {
        if (window.confirm(`${waitingNo}번 손님을 입장 처리하시겠습니까?`)) {
            onSendMessage(`대기 ${waitingNo}번 입장 완료`);
        }
    };

    const handleCancel = (waitingNo: string) => {
        if (window.confirm(`${waitingNo}번 대기를 취소하시겠습니까?`)) {
            onSendMessage(`대기 ${waitingNo}번 취소`);
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
                            const idInfo = w.items.find(i => i.name.includes('번호') || i.name.includes('이름'))?.value || (idx + 1).toString();
                            const headCount = w.items.find(i => i.name.includes('인원'))?.value || '2명';
                            
                            return (
                                <tr key={w.id} className="animate-pop-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                                    <td><span className="id-badge">{idx + 1}</span></td>
                                    <td style={{ fontWeight: 'bold' }}>{idInfo}</td>
                                    <td>{headCount}</td>
                                    <td>{w.timestamp} (약 15분 전)</td>
                                    <td style={{ textAlign: 'right', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                        <button className="confirm-btn premium-orange" onClick={() => handleCall(idInfo)}>🔔 호출</button>
                                        <button className="confirm-btn success-green" onClick={() => handleEnter(idInfo)}>🚀 입장</button>
                                        <button className="del-btn" onClick={() => handleCancel(idInfo)} style={{ width: '40px' }}>×</button>
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
