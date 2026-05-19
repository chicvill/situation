import { useEffect, useState, useCallback, useRef } from 'react';
import { PaymentModal } from './PaymentModal';
import { useStoreFilter } from '../hooks/useStoreFilter';
import { subscribeTopic } from '../services/mqttClient';

interface CounterPadProps {
    storeId?: string;
    bundles?: any[];
}

const getApiUrl = () => {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
    if (isLocal) {
        return `http://${host}:8000`;
    }
    return import.meta.env.VITE_API_URL || `http://${host}:8000`;
};

export const CounterPad = ({ storeId: propStoreId, bundles = [] }: CounterPadProps) => {
    const { storeId: filterStoreId } = useStoreFilter();
    const storeId = propStoreId || filterStoreId;
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionForPay, setSelectedSessionForPay] = useState<any | null>(null);
    const [selectedOrderForPay, setSelectedOrderForPay] = useState<any | null>(null);
    const [seatRequests, setSeatRequests] = useState<{ table_id: string; timestamp: string }[]>([]);
    const [vipPayerInfo, setVipPayerInfo] = useState<{ phone: string; topPercent: number } | null>(null);
    const [vipFlashVisible, setVipFlashVisible] = useState(false);
    const prevOrderCountRef = useRef(0);
    const prevCallCountRef = useRef(0);

    const playDingDong = () => {
        try {
            const audio = new Audio('https://www.orangefreesounds.com/wp-content/uploads/2014/09/Ding-dong.mp3');
            audio.play().catch(() => {});
        } catch {}
    };

    const fetchSeatRequests = useCallback(async () => {
        try {
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/api/seat-requests?store_id=${storeId || 'Total'}`);
            if (!res.ok) return;
            const data: { table_id: string; timestamp: string }[] = await res.json();
            setSeatRequests(prev => {
                const newIds = data.map(r => r.table_id);
                const prevIds = prev.map(r => r.table_id);
                const added = newIds.filter(id => !prevIds.includes(id));
                if (added.length > 0) playDingDong();
                return data;
            });
        } catch {}
    }, [storeId]);

    const fetchSessions = useCallback(async () => {
        try {
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/api/counter/sessions?store_id=${storeId || "Total"}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                const totalOrders = data.reduce((sum: number, s: any) =>
                    sum + (s.orders || []).filter((o: any) => o.status !== 'cancelled').length, 0);
                const pendingCalls = data.reduce((sum: number, s: any) =>
                    sum + (s.calls || []).filter((c: any) => c.status === 'pending').length, 0);
                if (totalOrders > prevOrderCountRef.current || pendingCalls > prevCallCountRef.current) {
                    playDingDong();
                }
                prevOrderCountRef.current = totalOrders;
                prevCallCountRef.current = pendingCalls;
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
            if (data.type === 'SEAT_REQUEST') {
                setSeatRequests(prev => {
                    if (prev.some(r => r.table_id === data.table_id)) return prev;
                    playDingDong();
                    return [...prev, { table_id: data.table_id, timestamp: data.timestamp }];
                });
                return;
            }
            if (data.type === 'SESSION_OPENED') {
                setSeatRequests(prev => prev.filter(r => r.table_id !== data.session?.table_id));
                fetchSessions();
                return;
            }
            if ([
                'NEW_ORDER', 'STATUS_UPDATE', 'ORDER_UPDATED', 'ORDER_PLACED', 'NEW_ORDER_DIRECT',
                'SESSION_CLOSED', 'PAYMENT_CONFIRMED', 'PARTIAL_SETTLEMENT',
                'STAFF_CALL', 'PARKING_APPLIED', 'WAITING_REGISTERED'
            ].includes(data.type)) {
                fetchSessions();
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
        fetchSessions();
    }, [bundles, fetchSessions]);

    // 좌석 요청 3초 폴링 (MQTT 보완)
    useEffect(() => {
        fetchSeatRequests();
        const interval = setInterval(fetchSeatRequests, 3000);
        return () => clearInterval(interval);
    }, [fetchSeatRequests]);

    // 주문·호출·주차 5초 폴링 (MQTT 미연결 환경 보완)
    useEffect(() => {
        const interval = setInterval(fetchSessions, 5000);
        return () => clearInterval(interval);
    }, [fetchSessions]);



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
            ? `#${order.order_seq}차 주문(${(order.total_price ?? order.total ?? 0).toLocaleString()}원)은 선불 결제된 주문입니다.\n취소 시 토스 환불 처리를 시도합니다.\n계속하시겠습니까?`
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
                setSeatRequests(prev => prev.filter(r => r.table_id !== tableToOpen));
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
        <div className="counter-pad-premium" style={{ padding: '14px', background: 'var(--bg-main)', minHeight: 'auto' }}>

            {seatRequests.length > 0 && (
                <div style={{
                    marginBottom: '12px',
                    padding: '10px 14px',
                    background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
                    border: '2px solid #f97316',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 20px rgba(249,115,22,0.15)',
                }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#c2410c', marginBottom: '8px' }}>
                        🔔 좌석 승인 요청 ({seatRequests.length}건)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {seatRequests.map(req => (
                            <div key={req.table_id} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'white', border: '1px solid #fed7aa',
                                borderRadius: '8px', padding: '6px 12px',
                            }}>
                                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#ea580c' }}>
                                    TABLE {req.table_id}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: '#9a3412' }}>
                                    {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <button
                                    onClick={() => handleOpenSession(req.table_id)}
                                    style={{
                                        background: '#f97316', color: 'white',
                                        border: 'none', borderRadius: '6px',
                                        padding: '4px 10px', fontWeight: '700',
                                        fontSize: '0.8rem', cursor: 'pointer',
                                    }}
                                >
                                    승인
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{
                marginBottom: '14px',
                padding: '12px 14px',
                background: 'var(--surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)' }}>테이블 선택</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: '600' }}>활성 {sessions.length}석</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
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
                                    padding: '7px 4px',
                                    borderRadius: '7px',
                                    border: '1px solid var(--border)',
                                    background: isOccupied ? 'var(--border)' : 'var(--surface)',
                                    color: isOccupied ? 'var(--text-muted)' : 'var(--text-main)',
                                    fontWeight: '700',
                                    fontSize: '0.78rem',
                                    cursor: isOccupied ? 'not-allowed' : 'pointer',
                                    opacity: isOccupied ? 0.5 : 1,
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {tableId}[{capacity}]{isOccupied ? '🔴' : '⚪'}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>실시간 이용 현황</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: '600' }}>Active {sessions.length}</span>
            </div>

            {(selectedSessionForPay || selectedOrderForPay) && (
                <PaymentModal
                    totalPrice={selectedOrderForPay
                        ? (selectedOrderForPay.total_price ?? selectedOrderForPay.total ?? 0)
                        : (selectedSessionForPay?.orders || [])
                            .filter((o: any) => o.payment_status !== 'paid' && o.payment_status !== 'prepaid' && o.status !== 'paid')
                            .reduce((sum: number, o: any) => sum + (o.total_price ?? o.total ?? 0), 0)
                    }
                    onClose={() => {
                        setSelectedSessionForPay(null);
                        setSelectedOrderForPay(null);
                    }}
                    onPayerInfo={(phone, topPercent) => setVipPayerInfo({ phone, topPercent })}
                    onSubmit={async () => {
                        if (selectedOrderForPay) {
                            await handlePartialPayment(selectedOrderForPay.order_id);
                        } else {
                            await handleCloseSession(selectedSessionForPay.session_id);
                        }
                        if (vipPayerInfo && vipPayerInfo.topPercent <= 10) {
                            setVipFlashVisible(true);
                            setTimeout(() => {
                                setVipFlashVisible(false);
                                setVipPayerInfo(null);
                            }, 3000);
                        } else {
                            setVipPayerInfo(null);
                        }
                    }}
                    isCounter={true}
                />
            )}

            {vipFlashVisible && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        padding: '40px 60px',
                        borderRadius: '24px',
                        background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                        border: '3px solid #f59e0b',
                        boxShadow: '0 20px 60px rgba(245,158,11,0.4)',
                        textAlign: 'center',
                        animation: 'vipFlash 0.6s ease-in-out infinite alternate',
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>👑</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#92400e', letterSpacing: '0.1em' }}>VIP</div>
                        <div style={{ fontSize: '1rem', color: '#b45309', fontWeight: 700, marginTop: '8px' }}>
                            상위 {vipPayerInfo?.topPercent}% 단골 고객
                        </div>
                    </div>
                    <style>{`
                        @keyframes vipFlash {
                            from { opacity: 1; transform: scale(1); }
                            to { opacity: 0.6; transform: scale(1.06); }
                        }
                    `}</style>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(!Array.isArray(sessions) || sessions.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>현재 활성화된 테이블 세션이 없습니다.</div>
                    </div>
                ) : (
                    Array.isArray(sessions) && sessions.map((session) => {
                        const activeOrders = (session.orders || []).filter((o: any) => o.status !== 'cancelled');
                        const sessionTotal = activeOrders.reduce((sum: number, o: any) => sum + (o.total_price ?? o.total ?? 0), 0);
                        const unpaidTotal = activeOrders
                            .filter((o: any) => o.payment_status !== 'paid' && o.payment_status !== 'prepaid' && o.status !== 'paid')
                            .reduce((sum: number, o: any) => sum + (o.total_price ?? o.total ?? 0), 0);
                        const isAllPrepaid = unpaidTotal === 0;
                        const isPending = session.status === 'pending';
                        const hasReady = (session.orders || []).some((o: any) => o.status === 'ready');
                        const cap = (() => { const n = parseInt(session.table_id.replace('T','')); return isNaN(n)?'':`[${(n<=4)?4:(n<=8)?2:(n<=10)?6:4}]`; })();

                        return (
                            <div key={session.session_id} style={{
                                background: 'var(--surface)',
                                borderRadius: 'var(--radius-lg)',
                                border: `1.5px solid ${isPending ? 'var(--warning)' : hasReady ? '#10b981' : 'var(--border)'}`,
                                padding: '14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                boxShadow: isPending ? '0 4px 16px rgba(245,158,11,0.08)' : '0 2px 8px rgba(0,0,0,0.03)'
                            }}>
                                {/* 헤더: 테이블명 + 상태뱃지 + 세션ID 한 줄 */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '1.15rem', fontWeight: '800', color: isPending ? 'var(--warning)' : 'var(--primary)', whiteSpace: 'nowrap' }}>
                                        TABLE {session.table_id}{cap}
                                    </span>
                                    {isPending && (
                                        <span style={{ background: 'var(--warning)', color: 'white', padding: '2px 8px', borderRadius: '5px', fontSize: '0.72rem', fontWeight: '700' }}>승인대기</span>
                                    )}
                                    {hasReady && (
                                        <span style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', padding: '2px 8px', borderRadius: '5px', fontSize: '0.72rem', fontWeight: '700', boxShadow: '0 0 8px rgba(16,185,129,0.35)' }}>🍽️ 서빙대기</span>
                                    )}
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{session.session_id}</span>
                                </div>

                                {/* 주문 목록 */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {activeOrders.map((order: any) => {
                                        const isPrepaid = order.payment_status === 'prepaid' || order.payment_status === 'paid';
                                        const isPaidOrServed = order.status === 'paid' || order.status === 'served' || isPrepaid;
                                        return (
                                            <div key={order.order_id} style={{
                                                background: 'var(--primary-soft)',
                                                borderRadius: '10px',
                                                padding: '10px 12px',
                                            }}>
                                                {/* 주문 헤더 */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)' }}>#{order.order_seq}차</span>
                                                    <span style={{ fontSize: '0.72rem', color: isPrepaid ? '#10b981' : 'var(--text-muted)', fontWeight: '700', background: isPrepaid ? 'rgba(16,185,129,0.1)' : 'transparent', padding: '1px 6px', borderRadius: '4px' }}>
                                                        {isPrepaid ? '선불' : '후불'}
                                                    </span>
                                                    <span style={{ marginLeft: 'auto', fontWeight: '800', fontSize: '0.95rem', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                                                        {(order.total_price ?? order.total ?? 0).toLocaleString()}원
                                                    </span>
                                                </div>

                                                {/* 아이템 목록 */}
                                                {isPrepaid ? (
                                                    /* 선불: 한 줄 요약 */
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px', lineHeight: 1.4 }}>
                                                        {(order.items || []).map((item: any) => `${item.name} ${item.quantity || item.qty}개`).join(' · ')}
                                                    </div>
                                                ) : (
                                                    /* 후불: 수량 조절 버튼 */
                                                    <div style={{ marginBottom: '8px' }}>
                                                        {(order.items || []).map((item: any, i: number) => (
                                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{item.name}</span>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface)', padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                                                    <button onClick={() => { const ni=[...(order.items||[])]; ni[i]={...item,quantity:Math.max(0,(item.quantity||item.qty||0)-1)}; handleUpdateOrderItem(order.order_id,ni); }} style={{ background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontWeight:'700',fontSize:'1rem',lineHeight:1,padding:'0 2px' }}>−</button>
                                                                    <span style={{ fontWeight:'700',minWidth:'18px',textAlign:'center',fontSize:'0.85rem' }}>{item.quantity||item.qty}</span>
                                                                    <button onClick={() => { const ni=[...(order.items||[])]; ni[i]={...item,quantity:(item.quantity||item.qty||0)+1}; handleUpdateOrderItem(order.order_id,ni); }} style={{ background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontWeight:'700',fontSize:'1rem',lineHeight:1,padding:'0 2px' }}>+</button>
                                                                    <button onClick={() => { const ni=(order.items||[]).filter((_:any,idx:number)=>idx!==i); handleUpdateOrderItem(order.order_id,ni); }} style={{ background:'none',border:'none',color:'var(--danger)',cursor:'pointer',fontSize:'11px',padding:'0 2px' }}>✕</button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* 액션 버튼 */}
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                                                    <button onClick={() => handleCancelWithRefund(order)} style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--danger)', padding:'4px 10px', borderRadius:'6px', fontSize:'0.75rem', cursor:'pointer', fontWeight:'500' }}>
                                                        삭제
                                                    </button>
                                                    {order.status === 'ready' ? (
                                                        <button onClick={() => handleStatusUpdate(order.order_id, 'served')} style={{ background:'linear-gradient(135deg,#10b981,#059669)', border:'none', color:'white', padding:'4px 14px', borderRadius:'6px', fontSize:'0.75rem', cursor:'pointer', fontWeight:'700', whiteSpace:'nowrap', boxShadow:'0 0 10px rgba(16,185,129,0.4)' }}>
                                                            🍽️ 서빙완료
                                                        </button>
                                                    ) : (
                                                        <button disabled={isPaidOrServed} onClick={() => setSelectedOrderForPay(order)} style={{ background: isPaidOrServed ? 'var(--border)' : 'var(--accent)', border:'none', color: isPaidOrServed ? 'var(--text-muted)' : 'white', padding:'4px 14px', borderRadius:'6px', fontSize:'0.75rem', cursor: isPaidOrServed ? 'default' : 'pointer', fontWeight:'600', whiteSpace:'nowrap' }}>
                                                            {isPrepaid ? '선불완료' : (order.status==='paid'||order.payment_status==='paid') ? '결제완료' : '결제'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* 합계 + 세션 액션 */}
                                <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'var(--primary-soft)', padding:'10px 12px', borderRadius:'10px', border:'1px solid var(--border)' }}>
                                    <div style={{ flex:1 }}>
                                        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:'600' }}>선결제 / 총액</div>
                                        <div style={{ fontSize:'0.95rem', fontWeight:'800', color:'var(--text-main)', whiteSpace:'nowrap' }}>
                                            {(sessionTotal-unpaidTotal).toLocaleString()}원 / {sessionTotal.toLocaleString()}원
                                        </div>
                                    </div>
                                    <div style={{ textAlign:'right', marginRight:'8px' }}>
                                        <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:'600' }}>미결제</div>
                                        <div style={{ fontSize:'1.1rem', fontWeight:'900', color: unpaidTotal>0 ? '#ef4444' : '#10b981', whiteSpace:'nowrap' }}>
                                            {unpaidTotal>0 ? `${unpaidTotal.toLocaleString()}원` : activeOrders.length===0 ? '활성화' : '완료'}
                                        </div>
                                    </div>
                                    {isPending ? (
                                        <button onClick={() => handleOpenSession(session.table_id)} style={{ background:'var(--warning)', border:'none', color:'white', padding:'8px 16px', borderRadius:'8px', fontWeight:'700', fontSize:'0.85rem', cursor:'pointer', whiteSpace:'nowrap' }}>
                                            개시 승인
                                        </button>
                                    ) : (
                                        <div style={{ display:'flex', gap:'6px' }}>
                                            <button onClick={() => handleResetSession(session.session_id)} style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--danger)', padding:'7px 10px', borderRadius:'7px', fontWeight:'500', fontSize:'0.78rem', cursor:'pointer', whiteSpace:'nowrap' }}>
                                                초기화
                                            </button>
                                            {isAllPrepaid ? (
                                                <button onClick={async () => {
                                                    const msg = activeOrders.length>0 ? '모든 결제가 완료되었습니다. 세션을 종료하시겠습니까?' : '주문이 없습니다. 세션을 종료하시겠습니까?';
                                                    if (!window.confirm(msg)) return;
                                                    try {
                                                        const r = await fetch(`${getApiUrl()}/api/session/close`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:session.session_id,force:true})});
                                                        if(r.ok){alert('테이블이 초기화되었습니다.');fetchSessions();}else{alert('오류가 발생했습니다.');}
                                                    } catch(e){alert('오류가 발생했습니다.');}
                                                }} style={{ background:'var(--accent)', border:'none', color:'white', padding:'7px 14px', borderRadius:'7px', fontWeight:'600', fontSize:'0.85rem', cursor:'pointer', whiteSpace:'nowrap' }}>
                                                    {activeOrders.length===0 ? '종료' : '결제완료'}
                                                </button>
                                            ) : (
                                                <button onClick={() => setSelectedSessionForPay(session)} style={{ background:'var(--primary)', border:'none', color:'white', padding:'7px 14px', borderRadius:'7px', fontWeight:'600', fontSize:'0.85rem', cursor:'pointer', whiteSpace:'nowrap' }}>
                                                    전체결제
                                                </button>
                                            )}
                                        </div>
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
