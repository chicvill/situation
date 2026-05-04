import React, { useEffect, useState } from 'react';
import { PaymentModal } from './PaymentModal';
import { useStoreFilter } from '../hooks/useStoreFilter';
import { WS_BASE } from '../config';

interface CounterPadProps {
    storeId?: string;
}

export const CounterPad: React.FC<CounterPadProps> = ({ storeId: propStoreId }) => {
    const { storeId: filterStoreId } = useStoreFilter();
    const storeId = propStoreId || filterStoreId;
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionForPay, setSelectedSessionForPay] = useState<any | null>(null);
    const [selectedOrderForPay, setSelectedOrderForPay] = useState<any | null>(null);
    const [pendingJoins, setPendingJoins] = useState<Record<string, any[]>>({});

    const getApiUrl = () => import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

    const fetchSessions = async () => {
        try {
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/api/counter/sessions?store_id=${storeId || "Total"}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setSessions(data);
            } else {
                setSessions([]);
            }
        } catch (e) {
            console.error('Counter Fetch Error:', e);
            setSessions([]);
        }
    };

    useEffect(() => {
        fetchSessions();
        const ws = new WebSocket(`${WS_BASE}/ws/kitchen`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (['NEW_ORDER', 'STATUS_UPDATE', 'SESSION_CLOSED'].includes(data.type)) {
                fetchSessions();
            }
            if (data.type === 'JOIN_REQUEST') {
                setPendingJoins(prev => ({
                    ...prev,
                    [data.table_id]: [...(prev[data.table_id] || []), data]
                }));
            }
            if (data.type === 'JOIN_RESPONSE') {
                setPendingJoins(prev => {
                    const tableRequests = (prev[data.table_id] || []).filter(r => r.device_id !== data.device_id);
                    return { ...prev, [data.table_id]: tableRequests };
                });
            }
        };
        return () => ws.close();
    }, [storeId]);

    const handleStatusUpdate = async (orderId: string, status: string) => {
        try {
            const apiUrl = getApiUrl();
            await fetch(`${apiUrl}/api/order/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, status })
            });
            fetchSessions();
        } catch (e) {
            console.error('Status Update Error:', e);
        }
    };

    const handleApproveJoin = async (tableId: string, sessionId: string, deviceId: string, approved: boolean) => {
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
        } catch (e) {
            console.error('Join Approval Error:', e);
            alert('승인 처리 중 오류가 발생했습니다.');
        }
    };

    const handleCloseSession = async (sessionId: string) => {
        try {
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/api/session/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });
            const data = await res.json();
            if (res.ok) {
                if (data.status === 'partial') {
                    alert(data.message);
                } else {
                    alert('정산이 완료되었습니다.');
                }
                setSelectedSessionForPay(null);
                setSelectedOrderForPay(null);
                fetchSessions();
            } else {
                throw new Error(data.detail || '정산 실패');
            }
        } catch (e) {
            console.error('Close Session Error:', e);
            throw e;
        }
    };

    const handlePartialPayment = async (orderId: string) => {
        try {
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/api/order/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, status: 'paid' }) // paid로 변경하여 결제 완료 처리
            });
            if (res.ok) {
                // alert 제거하여 흐름 끊김 방지
                setSelectedOrderForPay(null);
                fetchSessions();
            } else {
                const data = await res.json();
                throw new Error(data.detail || '결제 실패');
            }
        } catch (e) {
            console.error('Partial Payment Error:', e);
            throw e;
        }
    };

    const handleUpdateOrderItem = async (orderId: string, items: any[]) => {
        try {
            const filteredItems = items.filter(i => (i.quantity || i.qty || 0) > 0);
            const apiUrl = getApiUrl();
            if (filteredItems.length === 0) {
                await fetch(`${apiUrl}/api/order/status`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: orderId, status: 'cancelled' })
                });
            } else {
                await fetch(`${apiUrl}/api/order/update-items`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: orderId, items: filteredItems })
                });
            }
            fetchSessions();
        } catch (err) { console.error('Update Item Error:', err); }
    };

    const handleOpenSession = async (directTableId?: string) => {
        const tableToOpen = directTableId;
        if (!tableToOpen) return;
        
        try {
            const apiUrl = getApiUrl();
            const targetStoreId = (!storeId || storeId === "Total") ? "default_store" : storeId;
            
            const res = await fetch(`${apiUrl}/api/session/open`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    store_id: targetStoreId,
                    table_id: tableToOpen,
                    device_id: 'counter'
                })
            });
            
            if (res.ok) {
                fetchSessions();
            } else {
                const errorText = await res.text();
                alert(`세션 개시 실패: ${errorText}`);
            }
        } catch (err) {
            console.error("Open Session Error:", err);
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    };

    const handleResetSession = async (sessionId: string) => {
        if (!window.confirm('정말 이 테이블을 초기화하시겠습니까? (모든 주문이 취소됩니다)')) return;
        try {
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/api/session/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });
            if (res.ok) {
                fetchSessions();
                alert('테이블이 초기화되었습니다.');
            }
        } catch (e) {
            console.error('Reset Session Error:', e);
            alert('초기화 중 오류가 발생했습니다.');
        }
    };

    const tables = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="counter-pad-premium" style={{ padding: '20px', background: 'var(--bg-main)', minHeight: 'auto' }}>
            <div style={{ 
                marginBottom: '40px', 
                padding: '30px', 
                background: 'var(--surface)', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '30px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-main)' }}>활성 테이블 선택</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        {tables.map(num => {
                            const tableId = `T${String(num).padStart(2, '0')}`;
                            const isOccupied = sessions.some(s => s.table_id === tableId);
                            
                            return (
                                <button
                                    key={num}
                                    disabled={isOccupied}
                                    onClick={() => handleOpenSession(`T${String(num).padStart(2, '0')}`)}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: isOccupied ? 'var(--border)' : 'var(--surface)',
                                        color: isOccupied ? 'var(--text-muted)' : 'var(--text-main)',
                                        fontWeight: '700',
                                        cursor: isOccupied ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s',
                                        opacity: isOccupied ? 0.5 : 1,
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {num} {isOccupied ? '🔴' : '⚪'}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    실시간 이용 현황
                    <span style={{ fontSize: '1rem', color: 'var(--accent)', fontWeight: '500' }}>Active tables : {sessions.length}</span>
                </h3>
            </div>

            {(selectedSessionForPay || selectedOrderForPay) && (
                <PaymentModal 
                    totalPrice={selectedOrderForPay ? selectedOrderForPay.total_price : selectedSessionForPay.orders.reduce((sum: number, o: any) => sum + o.total_price, 0)}
                    onClose={() => {
                        setSelectedSessionForPay(null);
                        setSelectedOrderForPay(null);
                    }}
                    onSubmit={(_method, _extraData) => {
                        if (selectedOrderForPay) {
                            return handlePartialPayment(selectedOrderForPay.order_id);
                        } else {
                            return handleCloseSession(selectedSessionForPay.session_id);
                        }
                    }}
                    isCounter={true}
                />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                {(!Array.isArray(sessions) || sessions.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '120px 20px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: '500' }}>현재 활성화된 테이블 세션이 없습니다.</div>
                    </div>
                ) : (
                    Array.isArray(sessions) && sessions.map((session) => {
                        const sessionTotal = session.orders.reduce((sum: number, o: any) => sum + o.total_price, 0);
                        const isPending = session.status === 'pending';
                        
                        return (
                            <div key={session.session_id} style={{ 
                                background: 'var(--surface)', 
                                borderRadius: 'var(--radius-lg)', 
                                border: `1px solid ${isPending ? 'var(--warning)' : 'var(--border)'}`,
                                padding: '30px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '20px',
                                boxShadow: isPending ? '0 8px 30px rgba(245, 158, 11, 0.08)' : '0 4px 12px rgba(0,0,0,0.03)'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border)', paddingBottom: '20px', gap: '15px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <span style={{ fontSize: '1.6rem', fontWeight: '800', color: isPending ? 'var(--warning)' : 'var(--primary)' }}>
                                            TABLE {session.table_id}
                                        </span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', wordBreak: 'break-all' }}>{session.session_id}</span>
                                        {isPending && (
                                            <span style={{ 
                                                width: 'fit-content',
                                                background: 'var(--warning)', 
                                                color: 'white', 
                                                padding: '4px 12px', 
                                                borderRadius: 'var(--radius-sm)', 
                                                fontSize: '0.8rem', 
                                                fontWeight: '600',
                                                marginTop: '5px'
                                            }}>
                                                승인 대기 중
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* 합류 요청 알림 (기존 위치 유지 또는 유사 레이아웃) */}
                                    {(pendingJoins[session.table_id] || []).length > 0 && (
                                        <div style={{ 
                                            background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '15px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px'
                                        }}>
                                            {/* ... (합류 요청 UI 생략 - 이전 유지) ... */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                                <div>
                                                    <div style={{ fontWeight: '700', color: '#991b1b', fontSize: '0.9rem' }}>새로운 기기 합류 요청</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => handleApproveJoin(session.table_id, session.session_id, pendingJoins[session.table_id][0].device_id, true)} style={{ background: '#ef4444', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}>승인</button>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>합계금액</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{sessionTotal.toLocaleString()}원</div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                                    {session.orders.map((order: any) => (
                                        <div key={order.order_id} style={{ 
                                            background: 'var(--primary-soft)', 
                                            borderRadius: 'var(--radius-md)', 
                                            padding: '20px',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>#{order.order_seq}차 주문</span>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span style={{ 
                                                        fontSize: '0.75rem', 
                                                        color: order.payment_status === 'prepaid' ? 'var(--danger)' : 'var(--text-muted)',
                                                        fontWeight: '600'
                                                    }}>
                                                        {order.payment_status === 'prepaid' ? 'PREPAID' : 'POSTPAID'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '1.05rem', fontWeight: '500', marginBottom: '15px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                                                {order.items.map((item: any, i: number) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        <span>{item.name}</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                            <button 
                                                                onClick={() => {
                                                                    const newItems = [...order.items];
                                                                    newItems[i] = { ...item, quantity: Math.max(0, (item.quantity || item.qty || 0) - 1) };
                                                                    handleUpdateOrderItem(order.order_id, newItems);
                                                                }}
                                                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: '700' }}
                                                            >-</button>
                                                            <span style={{ fontWeight: '700', minWidth: '20px', textAlign: 'center' }}>{item.quantity || item.qty}</span>
                                                            <button 
                                                                onClick={() => {
                                                                    const newItems = [...order.items];
                                                                    newItems[i] = { ...item, quantity: (item.quantity || item.qty || 0) + 1 };
                                                                    handleUpdateOrderItem(order.order_id, newItems);
                                                                }}
                                                                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: '700' }}
                                                            >+</button>
                                                            <button 
                                                                onClick={() => {
                                                                    const newItems = order.items.filter((_: any, idx: number) => idx !== i);
                                                                    handleUpdateOrderItem(order.order_id, newItems);
                                                                }}
                                                                style={{ marginLeft: '4px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px' }}
                                                            >✕</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--border)' }}>
                                                <span style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{order.total_price.toLocaleString()}원</span>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button 
                                                        onClick={() => {
                                                            if(window.confirm('이 주문을 삭제하시겠습니까?')) {
                                                                 handleStatusUpdate(order.order_id, 'cancelled');
                                                            }
                                                        }}
                                                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--danger)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '500' }}
                                                    >
                                                        삭제
                                                    </button>
                                                    <button 
                                                        disabled={order.status === 'paid'}
                                                        onClick={() => setSelectedOrderForPay(order)}
                                                        style={{ 
                                                            background: order.status === 'paid' ? 'var(--border)' : 'var(--accent)', 
                                                            border: 'none', 
                                                            color: order.status === 'paid' ? 'var(--text-muted)' : 'white', 
                                                            padding: '6px 16px', 
                                                            borderRadius: 'var(--radius-sm)', 
                                                            fontSize: '0.8rem', 
                                                            cursor: order.status === 'paid' ? 'default' : 'pointer',
                                                            fontWeight: '600',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        {order.status === 'paid' ? '결제완료' : '결제'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: '15px', marginTop: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                                    {isPending ? (
                                        <button 
                                            onClick={() => handleOpenSession(session.table_id)}
                                            style={{ background: 'var(--warning)', border: 'none', color: 'white', padding: '12px 40px', borderRadius: 'var(--radius-sm)', fontWeight: '700', fontSize: '1.1rem', cursor: 'pointer' }}
                                        >
                                            세션 개시 승인
                                        </button>
                                    ) : (
                                        <>
                                            <button 
                                                onClick={() => handleResetSession(session.session_id)}
                                                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--danger)', padding: '10px 24px', borderRadius: 'var(--radius-sm)', fontWeight: '500', fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                            >
                                                초기화
                                            </button>
                                            <button 
                                                onClick={() => setSelectedSessionForPay(session)}
                                                style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '10px 32px', borderRadius: 'var(--radius-sm)', fontWeight: '600', fontSize: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                            >
                                                전체 결제
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
