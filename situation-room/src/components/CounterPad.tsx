import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PaymentModal } from './PaymentModal';
import { useStoreFilter } from '../hooks/useStoreFilter';
import { subscribeTopic } from '../services/mqttClient';

interface CounterPadProps {
    storeId?: string;
    bundles?: any[];
}

export const CounterPad: React.FC<CounterPadProps> = ({ storeId: propStoreId, bundles = [] }) => {
    const { storeId: filterStoreId } = useStoreFilter();
    const storeId = propStoreId || filterStoreId;
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionForPay, setSelectedSessionForPay] = useState<any | null>(null);
    const [selectedOrderForPay, setSelectedOrderForPay] = useState<any | null>(null);
    const [pendingJoins, setPendingJoins] = useState<Record<string, any[]>>({});

    const getApiUrl = () => {
        const host = window.location.hostname;
        const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
        if (isLocal) {
            return `http://${host}:8000`;
        }
        return import.meta.env.VITE_API_URL || `http://${host}:8000`;
    };

    const fetchSessions = useCallback(async () => {
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
    }, [storeId]); 

    useEffect(() => {
        // 1. 초기 로드
        fetchSessions();

        // 2. MQTT 구독으로 실시간 갱신
        const topic = (storeId && storeId !== 'Total') ? `store/${storeId}/kitchen` : `store/+/kitchen`;
        
        const messageHandler = (data: any) => {
            if ([
                'NEW_ORDER', 'STATUS_UPDATE', 'ORDER_UPDATED', 'ORDER_PLACED', 'NEW_ORDER_DIRECT',
                'SESSION_CLOSED', 'PAYMENT_CONFIRMED', 'PARTIAL_SETTLEMENT',
                'STAFF_CALL', 'PARKING_APPLIED', 'WAITING_REGISTERED', 'SESSION_OPENED'
            ].includes(data.type)) {
                fetchSessions();
            }
            if (data.type === 'JOIN_REQUEST' || data.type === 'JOIN_CHECKIN' || data.type === 'CHECKIN_REQUEST' || data.type === 'JOIN_SESSION') {
                // Normalize table_id (e.g. "3" -> "T03", "T3" -> "T03")
                let tid = String(data.table_id || "").toUpperCase();
                if (tid) {
                    if (!tid.startsWith('T')) {
                        tid = `T${tid.padStart(2, '0')}`;
                    } else if (tid.length === 2) {
                        tid = `T${tid.substring(1).padStart(2, '0')}`;
                    }
                    
                    setPendingJoins(prev => ({
                        ...prev,
                        [tid]: [...(prev[tid] || []), data]
                    }));
                }
            }
            if (data.type === 'JOIN_RESPONSE') {
                let tid = String(data.table_id || "").toUpperCase();
                if (!tid.startsWith('T')) tid = `T${tid.padStart(2, '0')}`;
                else if (tid.length === 2) tid = `T${tid.substring(1).padStart(2, '0')}`;

                setPendingJoins(prev => {
                    const tableRequests = (prev[tid] || []).filter(r => r.device_id !== data.device_id);
                    return { ...prev, [tid]: tableRequests };
                });
            }
        };

        const unsubscribe1 = subscribeTopic(topic, messageHandler);
        const unsubscribe2 = subscribeTopic('situation/kitchen', messageHandler);
        const unsubscribe3 = (storeId && storeId !== 'Total') ? subscribeTopic('store/broadcast/kitchen', messageHandler) : () => {};

        return () => {
            unsubscribe1();
            unsubscribe2();
            unsubscribe3();
        };
    }, [storeId, fetchSessions]); // fetchSessions 의존성 추가

    useEffect(() => {
        // Refetch detailed sessions whenever global bundles update (fallback for MQTT misses)
        fetchSessions();
    }, [bundles, fetchSessions]); // fetchSessions 의존성 추가


    useEffect(() => {
        // Sync pending joins from bundles (persisted data)
        const joinRequests = bundles.filter(b => 
            (b.type === 'Checkins' || b.type === 'PersonalInfos') && 
            b.status === 'pending' && 
            (b.id.startsWith('join-') || b.id.startsWith('SESS-'))
        );
        const newJoins: Record<string, any[]> = {};
        
        joinRequests.forEach(b => {
            let tid = String(b.table_id || "").toUpperCase();
            if (tid) {
                if (!tid.startsWith('T')) tid = `T${tid.padStart(2, '0')}`;
                else if (tid.length === 2) tid = `T${tid.substring(1).padStart(2, '0')}`;
                
                const deviceId = b.items?.find((i: any) => i.name === '기기ID')?.value;
                if (!newJoins[tid]) newJoins[tid] = [];
                newJoins[tid].push({ table_id: tid, device_id: deviceId, session_id: b.session_id });
            }
        });
        
        setPendingJoins(prev => ({ ...prev, ...newJoins }));
    }, [bundles]);

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
            
            // 승인 성공 시 로컬 상태에서 즉시 제거 (즉각적인 UI 반응 제공)
            setPendingJoins(prev => {
                const tableRequests = (prev[tableId] || []).filter(r => r.device_id !== deviceId);
                return { ...prev, [tableId]: tableRequests };
            });
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
                body: JSON.stringify({ order_id: orderId, status: 'paid' })
            });
            if (res.ok) {
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

    // 선불 주문 취소 + 환불 처리
    const handleCancelWithRefund = async (order: any) => {
        const isPrepaid = order.payment_status === 'paid' || order.payment_status === 'prepaid';
        const confirmMsg = isPrepaid
            ? `#${order.order_seq}차 주문(${order.total_price.toLocaleString()}원)은 선불 결제된 주문입니다.\n취소 시 토스 환불 처리를 시도합니다.\n계속하시겠습니까?`
            : `#${order.order_seq}차 주문을 취소하시겠습니까?\n취소 후에는 되돌릴 수 없습니다.`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const apiUrl = getApiUrl();
            if (isPrepaid) {
                // 선불: 환불 API 호출
                const res = await fetch(`${apiUrl}/api/payment/cancel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: order.order_id, cancel_reason: '카운터 취소' })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    alert(`✅ ${data.message}`);
                } else if (data.status === 'manual_required') {
                    alert(`⚠️ 자동 환불 불가\n${data.message}\n\n토스 대시보드에서 수동 처리해주세요:\n${data.dashboard_url || ''}`);
                } else {
                    // 취소는 됐지만 환불키 없음
                    alert('주문이 취소되었습니다. (결제키 없음 - 후불 처리)');
                }
            } else {
                // 후불: 상태만 cancelled로
                await handleStatusUpdate(order.order_id, 'cancelled');
            }
            fetchSessions();
        } catch (e: any) {
            console.error('Cancel/Refund Error:', e);
            alert(`취소 처리 중 오류가 발생했습니다: ${e.message}`);
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
                    table_id: tableToOpen
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
                            const capacity = (num <= 4) ? 4 : (num <= 8) ? 2 : (num <= 10) ? 6 : 4;
                            
                            return (
                                <button
                                    key={num}
                                    disabled={isOccupied}
                                    onClick={() => handleOpenSession(tableId)}
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
                                    {tableId}[{capacity}] {isOccupied ? '🔴' : '⚪'}
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
                    totalPrice={selectedOrderForPay 
                        ? selectedOrderForPay.total_price 
                        : selectedSessionForPay.orders
                            .filter((o: any) => o.payment_status !== 'paid' && o.payment_status !== 'prepaid' && o.status !== 'paid')
                            .reduce((sum: number, o: any) => sum + o.total_price, 0)
                    }
                    onClose={() => {
                        setSelectedSessionForPay(null);
                        setSelectedOrderForPay(null);
                    }}
                    onSubmit={() => {
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
                        const activeOrders = session.orders.filter((o: any) => o.status !== 'cancelled');
                        const sessionTotal = activeOrders.reduce((sum: number, o: any) => sum + o.total_price, 0);
                        const unpaidTotal = activeOrders
                            .filter((o: any) => o.payment_status !== 'paid' && o.payment_status !== 'prepaid' && o.status !== 'paid')
                            .reduce((sum: number, o: any) => sum + o.total_price, 0);
                        const isAllPrepaid = unpaidTotal === 0;
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <span style={{ fontSize: '1.6rem', fontWeight: '800', color: isPending ? 'var(--warning)' : 'var(--primary)' }}>
                                            TABLE {session.table_id}{(() => {
                                                const num = parseInt(session.table_id.replace('T', ''));
                                                if (isNaN(num)) return '';
                                                const cap = (num <= 4) ? 4 : (num <= 8) ? 2 : (num <= 10) ? 6 : 4;
                                                return `[${cap}]`;
                                            })()}
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
                                        {session.orders.some((o: any) => o.status === 'ready') && (
                                            <span style={{ 
                                                width: 'fit-content',
                                                background: 'linear-gradient(135deg, #10b981, #059669)', 
                                                color: 'white', 
                                                padding: '4px 12px', 
                                                borderRadius: 'var(--radius-sm)', 
                                                fontSize: '0.8rem', 
                                                fontWeight: '700',
                                                marginTop: '5px',
                                                boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                🍽️ 서빙 대기 중
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
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {session.orders.filter((order: any) => order.status !== 'cancelled').map((order: any) => (
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
                                                        color: (order.payment_status === 'prepaid' || order.payment_status === 'paid') ? '#10b981' : 'var(--text-muted)',
                                                        fontWeight: '600'
                                                    }}>
                                                        {(order.payment_status === 'prepaid' || order.payment_status === 'paid') ? '선불' : '후불'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '1.05rem', fontWeight: '500', marginBottom: '15px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                                                {order.items.map((item: any, i: number) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        <span>{item.name}</span>
                                                        {(order.payment_status === 'prepaid' || order.payment_status === 'paid') ? (
                                                            <div style={{ 
                                                                fontSize: '0.8rem', 
                                                                color: 'var(--text-muted)', 
                                                                background: 'rgba(16, 185, 129, 0.08)', 
                                                                padding: '4px 10px', 
                                                                borderRadius: '6px', 
                                                                fontWeight: '600',
                                                                border: '1px solid rgba(16, 185, 129, 0.2)'
                                                            }}>
                                                                {item.quantity || item.qty}개 (수정불가)
                                                            </div>
                                                        ) : (
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
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--border)' }}>
                                                <span style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{order.total_price.toLocaleString()}원</span>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button 
                                                        onClick={() => handleCancelWithRefund(order)}
                                                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--danger)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '500' }}
                                                    >
                                                        삭제
                                                    </button>
                                                    {order.status === 'ready' ? (
                                                        <button 
                                                            onClick={() => handleStatusUpdate(order.order_id, 'served')}
                                                            style={{ 
                                                                background: 'linear-gradient(135deg, #10b981, #059669)', 
                                                                border: 'none', 
                                                                color: 'white', 
                                                                padding: '6px 16px', 
                                                                borderRadius: 'var(--radius-sm)', 
                                                                fontSize: '0.8rem', 
                                                                cursor: 'pointer',
                                                                fontWeight: '700',
                                                                whiteSpace: 'nowrap',
                                                                boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)',
                                                                transform: 'scale(1.05)',
                                                                transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            🍽️ 서빙완료
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            disabled={
                                                                order.status === 'paid' || 
                                                                order.status === 'served' ||
                                                                order.payment_status === 'prepaid' ||
                                                                order.payment_status === 'paid'
                                                            }
                                                            onClick={() => setSelectedOrderForPay(order)}
                                                            style={{ 
                                                                background: (order.status === 'paid' || order.status === 'served' || order.payment_status === 'prepaid' || order.payment_status === 'paid')
                                                                    ? 'var(--border)' 
                                                                    : 'var(--accent)', 
                                                                border: 'none', 
                                                                color: (order.status === 'paid' || order.status === 'served' || order.payment_status === 'prepaid' || order.payment_status === 'paid')
                                                                    ? 'var(--text-muted)' 
                                                                    : 'white', 
                                                                padding: '6px 16px', 
                                                                borderRadius: 'var(--radius-sm)', 
                                                                fontSize: '0.8rem', 
                                                                cursor: (order.status === 'paid' || order.status === 'served' || order.payment_status === 'prepaid' || order.payment_status === 'paid')
                                                                    ? 'default' 
                                                                    : 'pointer',
                                                                fontWeight: '600',
                                                                whiteSpace: 'nowrap'
                                                             }}
                                                         >
                                                             {(order.payment_status === 'prepaid') 
                                                                ? '선불완료' 
                                                                : (order.status === 'paid' || order.payment_status === 'paid') 
                                                                    ? '결제완료' 
                                                                    : '결제'}
                                                         </button>
                                                     )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ 
                                    display: 'flex', 
                                    gap: '20px', 
                                    background: 'var(--primary-soft)',
                                    padding: '20px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1.5px solid var(--border)',
                                    marginTop: '10px',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap'
                                }}>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>선결제 금액</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>
                                            {(sessionTotal - unpaidTotal).toLocaleString()}원
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                            총 이용 금액: {sessionTotal.toLocaleString()}원
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>미결제 금액</div>
                                        <div style={{
                                            fontSize: '1.75rem',
                                            fontWeight: '900',
                                            color: unpaidTotal > 0 ? '#ef4444' : '#10b981',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {unpaidTotal > 0
                                                ? `${unpaidTotal.toLocaleString()}원`
                                                : session.orders.length === 0
                                                    ? '활성화'
                                                    : '결제 완료'}
                                        </div>
                                    </div>
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
                                            {isAllPrepaid ? (
                                                <button 
                                                    onClick={async () => {
                                                        const confirmMsg = session.orders.length > 0 
                                                            ? '모든 주문의 결제가 완료되었습니다. 테이블 세션을 종료하고 초기화하시겠습니까?' 
                                                            : '주문 내역이 없는 테이블입니다. 세션을 종료하고 초기화하시겠습니까?';
                                                        if (window.confirm(confirmMsg)) {
                                                            try {
                                                                const apiUrl = getApiUrl();
                                                                const res = await fetch(`${apiUrl}/api/session/close`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ session_id: session.session_id, force: true })
                                                                });
                                                                if (res.ok) {
                                                                    alert('테이블이 초기화되었습니다.');
                                                                    fetchSessions();
                                                                } else {
                                                                    alert('종료 처리 중 오류가 발생했습니다.');
                                                                }
                                                            } catch (e) {
                                                                console.error(e);
                                                                alert('종료 처리 중 오류가 발생했습니다.');
                                                            }
                                                        }
                                                    }}
                                                    style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '10px 32px', borderRadius: 'var(--radius-sm)', fontWeight: '600', fontSize: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                >
                                                    {session.orders.length === 0 ? '세션 종료' : '결제완료'}
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => setSelectedSessionForPay(session)}
                                                    style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '10px 32px', borderRadius: 'var(--radius-sm)', fontWeight: '600', fontSize: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                >
                                                    전체 결제
                                                </button>
                                            )}
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
