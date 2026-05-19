import React, { useEffect, useState } from 'react';
import { subscribeToStore, VIRTUAL_TABLE_LABEL } from '../services/notifications';

interface Call {
    call_id: string;
    table_id: string;
    session_id: string;
    call_type: string;
    status: string;
    timestamp: string;
    device_id?: string;
}

interface CallManagerProps {
    storeId?: string;
    bundles?: any[];
    onComplete?: () => void;
}

export const CallManager: React.FC<CallManagerProps> = ({ storeId, bundles = [], onComplete }) => {
    const [calls, setCalls] = useState<Call[]>([]);

    const getApiUrl = () => import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

    const fetchCalls = async () => {
        try {
            const apiUrl = getApiUrl();
            const queryParam = storeId && storeId !== "Total" ? `?store_id=${storeId}` : '';
            const res = await fetch(`${apiUrl}/api/call/active${queryParam}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                // 합류 요청의 device_id는 call_id에서 파싱: "JOIN-{session_id}-{device_id}"
                const processed = data.map((c: any) => {
                    if (c.call_type === '기기 합류 요청' && c.call_id?.startsWith('JOIN-') && c.session_id) {
                        const prefix = `JOIN-${c.session_id}-`;
                        return { ...c, device_id: c.call_id.startsWith(prefix) ? c.call_id.slice(prefix.length) : '' };
                    }
                    return c;
                });
                setCalls(processed);
            }
        } catch (e) {
            console.error('Fetch active calls error:', e);
        }
    };

    const handleCompleteCall = async (callId: string) => {
        try {
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/api/call/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ call_id: callId, status: 'completed' })
            });
            if (res.ok) {
                setCalls(prev => prev.filter(c => c.call_id !== callId));
                onComplete?.();
            }
        } catch (e) {
            console.error('Complete call error:', e);
        }
    };

    const handleApproveJoin = async (tableId: string, sessionId: string, deviceId: string, approved: boolean, callId: string) => {
        try {
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/api/session/approve-join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    device_id: deviceId,
                    table_id: tableId,
                    approved
                })
            });
            if (!res.ok) throw new Error('Approval failed');
            
            // 승인 성공 시 로컬 상태에서 즉시 제거
            setCalls(prev => prev.filter(c => c.call_id !== callId));
        } catch (e) {
            console.error('Join Approval Error:', e);
            alert('승인 처리 중 오류가 발생했습니다.');
        }
    };

    useEffect(() => {
        fetchCalls();

        const handleMessage = (data: any) => {
            // store_id 필터는 subscribeToStore 에서 처리됨
            if (data.type === 'STAFF_CALL') {
                setCalls(prev => {
                    if (prev.some(c => c.call_id === data.call_id)) return prev;
                    return [...prev, {
                        call_id: data.call_id,
                        table_id: data.table_id,
                        session_id: data.session_id || 'SESS-NONE',
                        call_type: data.call_type || '직원호출',
                        status: 'pending',
                        timestamp: new Date().toISOString()
                    }];
                });
            } else if (['JOIN_REQUEST', 'JOIN_CHECKIN', 'CHECKIN_REQUEST', 'JOIN_SESSION'].includes(data.type)) {

                let tid = String(data.table_id || "").toUpperCase();
                if (!tid.startsWith('T')) tid = `T${tid.padStart(2, '0')}`;
                else if (tid.length === 2) tid = `T${tid.substring(1).padStart(2, '0')}`;

                setCalls(prev => {
                    const callId = `JOIN-${data.session_id}-${data.device_id}`;
                    if (prev.some(c => c.call_id === callId)) return prev;
                    return [...prev, {
                        call_id: callId,
                        table_id: tid,
                        session_id: data.session_id || 'SESS-NONE',
                        device_id: data.device_id,
                        call_type: '기기 합류 요청',
                        status: 'pending',
                        timestamp: new Date().toISOString()
                    }];
                });
            } else if (data.type === 'CALL_STATUS_UPDATED') {
                if (data.status === 'completed' || data.status === 'cancelled') {
                    setCalls(prev => prev.filter(c => c.call_id !== data.call_id));
                }
            } else if (data.type === 'JOIN_RESPONSE') {
                const callIdMatch = `JOIN-${data.session_id}-${data.device_id}`;
                setCalls(prev => prev.filter(c => c.call_id !== callIdMatch));
            }
        };

        return subscribeToStore(storeId || '', handleMessage);
    }, [storeId]);

    useEffect(() => {
        // bundles에서 pending 상태인 합류 요청(Checkins)을 추출하여 호출 리스트에 표시
        const joinRequests = bundles.filter(b => 
            (b.type === 'Checkins' || b.type === 'PersonalInfos') && 
            b.status === 'pending' && 
            (b.id.startsWith('join-') || b.id.startsWith('SESS-'))
        );
        
        if (joinRequests.length > 0) {
            setCalls(prev => {
                const newCalls = [...prev];
                let added = false;
                
                joinRequests.forEach(b => {
                    let tid = String(b.table_id || "").toUpperCase();
                    if (!tid.startsWith('T')) tid = `T${tid.padStart(2, '0')}`;
                    else if (tid.length === 2) tid = `T${tid.substring(1).padStart(2, '0')}`;
                    
                    const deviceId = b.items?.find((i: any) => i.name === '기기ID' || i.name === '요청 기기')?.value;
                    const callId = `JOIN-${b.session_id}-${deviceId}`;
                    
                    if (!newCalls.some(c => c.call_id === callId) && deviceId) {
                        newCalls.push({
                            call_id: callId,
                            table_id: tid,
                            session_id: b.session_id || 'SESS-NONE',
                            device_id: deviceId,
                            call_type: '기기 합류 요청',
                            status: 'pending',
                            timestamp: (() => { try { const d = new Date(b.timestamp); return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); } catch { return new Date().toISOString(); } })()
                        });
                        added = true;
                    }
                });
                
                return added ? newCalls : prev;
            });
        }
    }, [bundles]);

    return (
        <div className="admin-page animate-fade-in" style={{ padding: '24px', background: 'var(--bg-main)' }}>
            <header className="page-header" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                        🛎️ 실시간 직원 호출
                    </h2>
                    {calls.length > 0 && (
                        <span style={{
                            background: '#ef4444',
                            color: 'white',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            padding: '2px 10px',
                            borderRadius: '50px',
                        }}>
                            {calls.length}건 대기 중
                        </span>
                    )}
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    고객 호출을 실시간으로 확인하고 처리합니다.
                </p>
            </header>

            <div className="calls-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px'
            }}>
                {calls.map((call, idx) => {
                    const tsMs = new Date(call.timestamp).getTime();
                    const timeElapsed = isNaN(tsMs) ? 0 : Math.max(0, Math.floor((new Date().getTime() - tsMs) / 1000 / 60));
                    
                    return (
                        <div key={call.call_id} className="animate-pop-in" style={{
                            animationDelay: `${idx * 0.05}s`,
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '16px',
                            padding: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--accent)' }}></div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <span style={{
                                        fontSize: '1.4rem',
                                        fontWeight: 900,
                                        color: 'var(--text-main)'
                                    }}>
                                        {VIRTUAL_TABLE_LABEL[call.table_id] ?? (call.table_id.startsWith('T') ? `TABLE ${parseInt(call.table_id.substring(1))}` : `TABLE ${call.table_id}`)}
                                    </span>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        color: 'var(--accent)',
                                        padding: '4px 10px',
                                        borderRadius: '50px',
                                        fontWeight: 700
                                    }}>
                                        {timeElapsed === 0 ? '방금 전' : `${timeElapsed}분 전`}
                                    </span>
                                </div>
                                <div style={{
                                    fontSize: '1.1rem',
                                    fontWeight: 800,
                                    color: 'var(--primary)',
                                    marginBottom: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    🔔 {call.call_type}
                                </div>
                            </div>
                            {call.call_type === '기기 합류 요청' ? (
                                <button
                                    onClick={() => handleApproveJoin(call.table_id, call.session_id, call.device_id!, true, call.call_id)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: '#ef4444',
                                        border: 'none',
                                        borderRadius: '10px',
                                        color: 'white',
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                                >
                                    ✅ 합류 승인하기
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleCompleteCall(call.call_id)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: 'var(--primary)',
                                        border: 'none',
                                        borderRadius: '10px',
                                        color: 'white',
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(30, 41, 59, 0.15)',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#0f172a')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--primary)')}
                                >
                                    서비스 처리 완료
                                </button>
                            )}
                        </div>
                    );
                })}
                {calls.length === 0 && (
                    <div style={{
                        gridColumn: '1 / -1',
                        textAlign: 'center',
                        padding: '80px 20px',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{ fontSize: '2.8rem', marginBottom: '12px', opacity: 0.6 }}>🍵</div>
                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>대기 중인 호출이 없습니다</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', opacity: 0.6 }}>고객 호출이 접수되면 여기에 표시됩니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
export default CallManager;
