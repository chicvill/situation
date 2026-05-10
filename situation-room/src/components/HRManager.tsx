import React, { useState } from 'react';
import { useStoreFilter } from '../hooks/useStoreFilter';

export const HRManager: React.FC<{ bundles: any[], user: any, storeDetails?: any }> = ({ bundles, user, storeDetails }) => {
    const { storeId, storeName } = useStoreFilter();
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingWage, setEditingWage] = useState<{ id: string, wage: string } | null>(null);
    const [showBanner, setShowBanner] = useState(true);

    // 현재 매장의 직원 및 근태 정보만 필터링
    const employees = bundles.filter(b => b.type === 'Employee' && (storeId === 'Total' || b.store_id === storeId || !b.store_id));
    const attendance = bundles.filter(b => b.type === 'Attendance' && (storeId === 'Total' || b.store_id === storeId || !b.store_id));
    
    // 승인 대기 계정 필터링 (계층적 승인 + 매장 격리)
    const pendingAccounts = bundles.filter(b => {
        if (b.type !== 'PersonalInfos' || b.status === 'approved') return false;
        // 점주는 자신의 매장 직원만 승인 가능
        if (user.role === 'owner' && (storeId !== 'Total' && b.store_id !== storeId)) return false;
        
        const role = b.items.find((i: any) => i.name === '권한')?.value;
        if (user.role === 'admin') return role === 'owner';
        if (user.role === 'owner') return role === 'manager' || role === 'staff';
        return false;
    });

    const handleUpdateWage = async (bundle: any, newWage: string) => {
        if (!newWage) return setEditingWage(null);
        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const updatedItems = bundle.items.map((i: any) => 
                i.name === '시급' ? { ...i, value: newWage.replace(/[^0-9]/g, '') } : i
            );
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, items: updatedItems, store: storeName, store_id: storeId }),
            });
            setEditingWage(null);
            alert('✅ 시급 정보가 업데이트되었습니다.');
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
    };

    const handleResignEmployee = async (bundle: any) => {
        if (!window.confirm(`${bundle.title} 사원의 퇴사 처리를 진행하시겠습니까? 로그인 권한이 즉시 차단됩니다.`)) return;
        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, status: 'resigned', store: storeName, store_id: storeId }),
            });
            alert('🚫 퇴사 처리가 완료되었습니다.');
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
    };

    const handleAttendance = async (type: '출근' | '퇴근') => {
        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const text = `근태 기록: ${user.name}님 ${type} 처리 완료. (매장: ${storeName})`;
            await fetch(`${apiUrl}/api/situation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, context: 'hr', store: storeName, store_id: storeId }),
            });
            alert(`${type} 처리가 완료되었습니다.`);
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
    };

    const handleApproveAccount = async (bundle: any) => {
        if (!window.confirm(`${bundle.title} 계정을 승인하시겠습니까?`)) return;
        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, status: 'approved', store: storeName, store_id: storeId }),
            });
            alert('✅ 계정이 승인되었습니다.');
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
    };

    return (
        <div className="admin-page animate-fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>👥 {storeName} 인적 자원 관리</h2>
                    <p>{user.role === 'owner' ? '매장 임금 및 근태 통합 관리' : '실시간 근태 현황'}</p>
                </div>
                {(user.role === 'staff' || user.role === 'manager') && (
                    <div className="attendance-actions" style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleAttendance('출근')} className="confirm-btn success-green" disabled={isProcessing}>🏃 출근하기</button>
                        <button onClick={() => handleAttendance('퇴근')} className="confirm-btn premium-orange" disabled={isProcessing}>🏠 퇴근하기</button>
                    </div>
                )}
            </header>

            {storeDetails && showBanner && (
                <div 
                    onClick={() => setShowBanner(false)}
                    title="터치하면 이 알림 배너가 닫힙니다"
                    style={{
                        background: storeDetails.payment_status === '연체' 
                            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04))' 
                            : storeDetails.payment_status === '미납' 
                                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))' 
                                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))',
                        border: `1.5px dashed ${
                            storeDetails.payment_status === '연체' 
                                ? '#ef4444' 
                                : storeDetails.payment_status === '미납' 
                                    ? '#f59e0b' 
                                    : '#10b981'
                        }`,
                        borderRadius: '16px',
                        padding: '16px 20px',
                        marginBottom: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        fontSize: '0.9rem',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.04)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.07)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.04)';
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
                        <span style={{ fontSize: '1.4rem' }}>
                            {storeDetails.payment_status === '연체' ? '🚨' : storeDetails.payment_status === '미납' ? '⚠️' : '🎁'}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)' }}>
                                {storeDetails.payment_status === '연체' 
                                    ? '[플랫폼 가입요금 연체 안내]' 
                                    : storeDetails.payment_status === '미납'
                                        ? '[플랫폼 정산 대기 상태 알림]'
                                        : '🎁 1개월 무료 체험 혜택 이용 중!'
                                }
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {storeDetails.payment_status === '연체' 
                                    ? '플랫폼 이용료 정산이 지연되고 있습니다. 서비스 제한 예정 대기 중이오니 납부 조치를 진행해 주세요.'
                                    : storeDetails.payment_status === '미납'
                                        ? '미납된 월 가맹요금이 수납대기 중입니다. 관리자 계좌 정보를 확인하고 입금을 진행해 주세요.'
                                        : `현재 본 식당은 프리미엄 스마트 오더 상용 모드를 무료로 체험하고 계십니다! (다음 납부 예정일: ${
                                            (() => {
                                                const regDateStr = storeDetails.created_at || storeDetails.timestamp;
                                                const regDate = regDateStr ? new Date(regDateStr) : new Date();
                                                const nextPay = new Date(regDate.setMonth(regDate.getMonth() + 1));
                                                return `${nextPay.getFullYear()}년 ${String(nextPay.getMonth() + 1).padStart(2, '0')}월 ${String(nextPay.getDate()).padStart(2, '0')}일`;
                                            })()
                                        })`
                                }
                            </span>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                            background: storeDetails.payment_status === '연체' ? '#ef4444' : storeDetails.payment_status === '미납' ? '#f59e0b' : '#10b981',
                            color: 'white',
                            padding: '6px 14px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                        }}>
                            {storeDetails.payment_status === '연체' 
                                ? '서비스 제한 대기' 
                                : storeDetails.payment_status === '미납' 
                                    ? '수납 필요' 
                                    : (() => {
                                        const regDateStr = storeDetails.created_at || storeDetails.timestamp;
                                        const regDate = regDateStr ? new Date(regDateStr) : new Date();
                                        const nextPay = new Date(regDate.setMonth(regDate.getMonth() + 1));
                                        const diffTime = nextPay.getTime() - new Date().getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        return `체험 종료 D-${diffDays > 0 ? diffDays : 0}`;
                                    })()
                            }
                        </div>
                        <div style={{
                            fontSize: '1.1rem',
                            color: 'var(--text-muted)',
                            fontWeight: 'bold',
                            background: 'rgba(0,0,0,0.04)',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }} title="닫기">
                            ✕
                        </div>
                    </div>
                </div>
            )}

            <div className="hr-grid" style={{ display: 'grid', gridTemplateColumns: pendingAccounts.length > 0 ? '1fr 1fr' : '1fr', gap: '25px' }}>
                {pendingAccounts.length > 0 && (
                    <div className="glass-panel pending-section" style={{ border: '2px solid var(--accent-orange)' }}>
                        <h3 style={{ color: 'var(--accent-orange)' }}>⚠️ 승인 대기 중인 계정</h3>
                        <div className="pending-list">
                            {pendingAccounts.map(b => {
                                const name = b.items.find((i: any) => i.name === '이름')?.value || '-';
                                const role = b.items.find((i: any) => i.name === '권한')?.value || '-';
                                return (
                                    <div key={b.id} className="pending-item" style={{ background: 'rgba(249, 115, 22, 0.05)', padding: '15px', borderRadius: '12px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div><strong>{name}</strong> <span style={{ opacity: 0.7 }}>({role})</span></div>
                                        <button onClick={() => handleApproveAccount(b)} className="confirm-btn success-green" style={{ padding: '8px 16px', fontSize: '0.9rem' }} disabled={isProcessing}>승인하기</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="glass-panel employee-list">
                    <h3>사원 명부 및 임금 관리</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>이름</th>
                                <th>직책</th>
                                <th>시급</th>
                                <th>관리</th>
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
                                        <td>
                                            {editingWage?.id === e.id ? (
                                                <input 
                                                    autoFocus
                                                    defaultValue={wage} 
                                                    onBlur={(ev) => handleUpdateWage(e, ev.target.value)}
                                                    onKeyDown={(ev) => ev.key === 'Enter' && handleUpdateWage(e, (ev.target as any).value)}
                                                    style={{ width: '80px', background: '#000', color: '#fff', border: '1px solid var(--accent-orange)', padding: '4px' }}
                                                />
                                            ) : (
                                                <span onClick={() => user.role === 'owner' && setEditingWage({ id: e.id, wage })} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--accent-orange)' }}>
                                                    {parseInt(wage).toLocaleString()}원
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {user.role === 'owner' && (
                                                <button onClick={() => handleResignEmployee(e)} className="del-btn" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>퇴사</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {employees.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', opacity: 0.5, padding: '40px' }}>등록된 사원이 없습니다.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="glass-panel attendance-logs" style={{ marginTop: '25px' }}>
                <h3>실시간 근태 로그 ({storeName})</h3>
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
