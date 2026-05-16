import React, { useEffect, useState } from 'react';
import { subscribeTopic } from '../services/mqttClient';

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
}

export const CallManager: React.FC<CallManagerProps> = ({ storeId, bundles = [] }) => {
    const [calls, setCalls] = useState<Call[]>([]);

    const getApiUrl = () => import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

    const fetchCalls = async () => {
        try {
            const apiUrl = getApiUrl();
            const queryParam = storeId && storeId !== "Total" ? `?store_id=${storeId}` : '';
            const res = await fetch(`${apiUrl}/api/call/active${queryParam}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setCalls(data);
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
                // UI에서 즉시 피드백 제공하기 위해 로컬 상태에서 제거
                setCalls(prev => prev.filter(c => c.call_id !== callId));
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
            if (data.type === 'STAFF_CALL') {
                if (storeId && storeId !== 'Total' && data.store_id && data.store_id !== storeId) {
                    return;
                }
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
                try {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
                    audio.volume = 0.5;
                    audio.play();
                } catch (_) {}
            } else if (['JOIN_REQUEST', 'JOIN_CHECKIN', 'CHECKIN_REQUEST', 'JOIN_SESSION'].includes(data.type)) {
                if (storeId && storeId !== 'Total' && data.store_id && data.store_id !== storeId) return;

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
                try {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
                    audio.volume = 0.5;
                    audio.play();
                } catch (_) {}
            } else if (data.type === 'CALL_STATUS_UPDATED') {
                if (data.status === 'completed' || data.status === 'cancelled') {
                    setCalls(prev => prev.filter(c => c.call_id !== data.call_id));
                }
            } else if (data.type === 'JOIN_RESPONSE') {
                const callIdMatch = `JOIN-${data.session_id}-${data.device_id}`;
                setCalls(prev => prev.filter(c => c.call_id !== callIdMatch));
            }
        };

        // situation/kitchen 과 store 토픽 모두 구독 (JOIN_REQUEST는 store 토픽으로 발행됨)
        const unsubscribe1 = subscribeTopic('situation/kitchen', handleMessage);
        const storeTopic = (storeId && storeId !== 'Total') ? `store/${storeId}/kitchen` : `store/+/kitchen`;
        const unsubscribe2 = subscribeTopic(storeTopic, handleMessage);

        return () => { unsubscribe1(); unsubscribe2(); };
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
                            timestamp: b.timestamp ? new Date(b.timestamp).toISOString() : new Date().toISOString()
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
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🛎️ 실시간 직원 호출 모니터
                    </h2>
                    <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)' }}>각 테이블 고객이 패널 및 음성 오더로 요청한 직원 호출을 실시간으로 확인하고 관리합니다.</p>
                </div>
                <div className="waiting-stats glass-panel" style={{ padding: '10px 20px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="stat" style={{ textAlign: 'center' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>대기 중 호출</label>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>{calls.length}건</div>
                    </div>
                </div>
            </header>

            <div className="calls-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '20px'
            }}>
                {calls.map((call, idx) => {
                    const timeElapsed = Math.max(0, Math.floor((new Date().getTime() - new Date(call.timestamp).getTime()) / 1000 / 60));
                    
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
                                        {call.table_id.startsWith('T') ? `TABLE ${parseInt(call.table_id.substring(1))}` : `TABLE ${call.table_id}`}
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
                        padding: '100px 20px',
                        background: 'var(--surface)',
                        border: '1px dashed var(--border)',
                        borderRadius: '20px',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🍵</div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>대기 중인 호출이 없습니다.</h3>
                        <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>현재 접수된 고객 요청 사항이 없습니다. 평온한 상태입니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
export default CallManager;
