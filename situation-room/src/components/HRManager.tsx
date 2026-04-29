import React, { useState } from 'react';

export const HRManager: React.FC<{ bundles: any[], user: any }> = ({ bundles, user }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const employees = bundles.filter(b => b.type === 'Employee');
    const attendance = bundles.filter(b => b.type === 'Attendance');
    
    // 승인 대기 계정 필터링 (계층적 승인)
    const pendingAccounts = bundles.filter(b => {
        if (b.type !== 'PersonalInfos' || b.status === 'approved') return false;
        const role = b.items.find((i: any) => i.name === '권한')?.value;
        
        if (user.role === 'admin') {
            // 전체 관리자는 점주(owner)만 승인
            return role === 'owner';
        } else if (user.role === 'owner') {
            // 점주는 자신의 매장 점장/점원 승인
            return role === 'manager' || role === 'staff';
        }
        return false;
    });

    const handleAttendance = async (type: '출근' | '퇴근') => {
        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const text = `근태 기록: ${user.name}님 ${type} 처리 완료.`;
            await fetch(`${apiUrl}/api/situation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, context: 'hr' }),
            });
            alert(`${type} 처리가 완료되었습니다.`);
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApproveAccount = async (bundle: any) => {
        if (!window.confirm(`${bundle.title} 계정을 승인하시겠습니까?`)) return;
        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const response = await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...bundle, 
                    status: 'approved' 
                }),
            });
            if (response.ok) {
                alert('✅ 계정이 승인되었습니다.');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="admin-page animate-fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>👥 인적 자원 및 계정 관리</h2>
                    <p>{user.role === 'admin' ? '전체 매장 점주 승인 및 관리' : '매장 사원 권한 및 근태 관리'}</p>
                </div>
                {user.role === 'staff' && (
                    <div className="attendance-actions" style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleAttendance('출근')} className="confirm-btn success-green" disabled={isProcessing}>🏃 출근하기</button>
                        <button onClick={() => handleAttendance('퇴근')} className="confirm-btn premium-orange" disabled={isProcessing}>🏠 퇴근하기</button>
                    </div>
                )}
            </header>

            <div className="hr-grid" style={{ display: 'grid', gridTemplateColumns: pendingAccounts.length > 0 ? '1fr 1fr' : '1fr', gap: '25px' }}>
                {/* 1. 승인 대기 계정 (관리자/점주 전용) */}
                {pendingAccounts.length > 0 && (
                    <div className="glass-panel pending-section" style={{ border: '2px solid var(--accent-orange)' }}>
                        <h3 style={{ color: 'var(--accent-orange)' }}>⚠️ 승인 대기 중인 계정</h3>
                        <div className="pending-list">
                            {pendingAccounts.map(b => {
                                const name = b.items.find((i: any) => i.name === '이름')?.value || '-';
                                const role = b.items.find((i: any) => i.name === '권한')?.value || '-';
                                return (
                                    <div key={b.id} className="pending-item" style={{ background: 'rgba(249, 115, 22, 0.05)', padding: '15px', borderRadius: '12px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <strong style={{ color: 'white' }}>{name}</strong> 
                                            <span style={{ fontSize: '0.85rem', opacity: 0.7, marginLeft: '8px' }}>({role})</span>
                                        </div>
                                        <button 
                                            onClick={() => handleApproveAccount(b)} 
                                            className="confirm-btn success-green" 
                                            style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                                            disabled={isProcessing}
                                        >승인하기</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 2. 사원 명부 */}
                <div className="glass-panel employee-list">
                    <h3>사원 명부</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>이름</th>
                                <th>직책</th>
                                <th>시급</th>
                                <th>상태</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(e => {
                                const name = e.items.find((i: any) => i.name === '이름')?.value || '-';
                                const role = e.items.find((i: any) => i.name === '직책')?.value || '점원';
                                const wage = e.items.find((i: any) => i.name === '시급')?.value || '10,000';
                                return (
                                    <tr key={e.id}>
                                        <td>{name}</td>
                                        <td><span className="role-badge">{role}</span></td>
                                        <td>{wage}원</td>
                                        <td><span className="status-dot online"></span> 근무중</td>
                                    </tr>
                                );
                            })}
                            {employees.length === 0 && (
                                <tr><td colSpan={4} style={{textAlign: 'center', opacity: 0.5, padding: '40px'}}>등록된 사원이 없습니다.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="glass-panel attendance-logs" style={{ marginTop: '25px' }}>
                <h3>실시간 출퇴근 로그</h3>
                <div className="log-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {attendance.length > 0 ? attendance.map(a => (
                        <div key={a.id} className="log-item" style={{ padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                            <span className="action" style={{ color: 'white', fontWeight: '500' }}>{a.title}</span>
                            <span className="time" style={{ opacity: 0.5, fontSize: '0.9rem' }}>{a.timestamp}</span>
                        </div>
                    )) : (
                        <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>기록된 로그가 없습니다.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
