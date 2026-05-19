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
    if (isLocal) return `http://${host}:8000`;
    return import.meta.env.VITE_API_URL || `http://${host}:8000`;
};

// 단계 순서 (progress bar용)
const STAGE_PIPELINE = [
    { key: 'initial',        label: '비어있음',   color: '#9ca3af', bg: '#ffffff' },
    { key: 'waiting',        label: '고객대기',   color: '#92400e', bg: '#fef3c7' },
    { key: 'seated',         label: '좌석배정',   color: '#1e40af', bg: '#dbeafe' },
    { key: 'ordered',        label: '주문접수',   color: '#c2410c', bg: '#fed7aa' },
    { key: 'cooking_done',   label: '조리완료',   color: '#6d28d9', bg: '#ede9fe' },
    { key: 'payment_pending',label: '결제대기',   color: '#b91c1c', bg: '#fee2e2' },
    { key: 'payment_done',   label: '결제완료',   color: '#15803d', bg: '#dcfce7' },
    { key: 'closing',        label: '세션종료',   color: '#475569', bg: '#e2e8f0' },
];

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
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [lastTapInfo, setLastTapInfo] = useState<{ id: string; time: number } | null>(null);

    const playDingDong = () => {
        try {
            const audio = new Audio('https://www.orangefreesounds.com/wp-content/uploads/2014/09/Ding-dong.mp3');
            audio.play().catch(() => {});
        } catch {}
    };

    const fetchSeatRequests = useCallback(async () => {
        try {
            const res = await fetch(`${getApiUrl()}/api/seat-requests?store_id=${storeId || 'Total'}`);
            if (!res.ok) return;
            const data: { table_id: string; timestamp: string }[] = await res.json();
            setSeatRequests(prev => {
                const added = data.filter(r => !prev.some(p => p.table_id === r.table_id));
                if (added.length > 0) playDingDong();
                return data;
            });
        } catch {}
    }, [storeId]);

    const fetchSessions = useCallback(async () => {
        try {
            const res = await fetch(`${getApiUrl()}/api/counter/sessions?store_id=${storeId || 'Total'}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                const totalOrders = data.reduce((sum: number, s: any) =>
                    sum + (s.orders || []).filter((o: any) => o.status !== 'cancelled').length, 0);
                const pendingCalls = data.reduce((sum: number, s: any) =>
                    sum + (s.calls || []).filter((c: any) => c.status === 'pending').length, 0);
                if (totalOrders > prevOrderCountRef.current || pendingCalls > prevCallCountRef.current) playDingDong();
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
        fetchSessions();
        const counterTopic = (storeId && storeId !== 'Total') ? `store/${storeId}/counter` : 'store/+/counter';
        const kitchenTopic = (storeId && storeId !== 'Total') ? `store/${storeId}/kitchen` : 'store/+/kitchen';
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
        const unsub1 = subscribeTopic(counterTopic, messageHandler);
        const unsub2 = subscribeTopic(kitchenTopic, messageHandler);
        return () => { unsub1(); unsub2(); };
    }, [storeId, fetchSessions]);

    useEffect(() => { fetchSessions(); }, [bundles, fetchSessions]);
    useEffect(() => { fetchSeatRequests(); }, [fetchSeatRequests]);

    const handleStatusUpdate = async (orderId: string, status: string) => {
        try {
            await fetch(`${getApiUrl()}/api/order/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, status })
            });
            fetchSessions();
        } catch (e) { console.error('Status Update Error:', e); }
    };

    const handleCloseSession = async (sessionId: string) => {
        try {
            const res = await fetch(`${getApiUrl()}/api/session/close`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.status === 'partial' ? data.message : '정산이 완료되었습니다.');
                setSelectedSessionForPay(null);
                setSelectedOrderForPay(null);
                fetchSessions();
            } else {
                throw new Error(data.detail || '정산 실패');
            }
        } catch (e) { console.error('Close Session Error:', e); throw e; }
    };

    const handlePartialPayment = async (orderId: string) => {
        try {
            const res = await fetch(`${getApiUrl()}/api/order/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, status: 'paid' })
            });
            if (res.ok) { setSelectedOrderForPay(null); fetchSessions(); }
            else { const d = await res.json(); throw new Error(d.detail || '결제 실패'); }
        } catch (e) { console.error('Partial Payment Error:', e); throw e; }
    };

    const handleCancelWithRefund = async (order: any) => {
        const isPrepaid = order.payment_status === 'paid' || order.payment_status === 'prepaid';
        const confirmMsg = isPrepaid
            ? `#${order.order_seq}차 주문(${(order.total_price ?? order.total ?? 0).toLocaleString()}원)은 선불 결제된 주문입니다.\n취소 시 토스 환불 처리를 시도합니다.\n계속하시겠습니까?`
            : `#${order.order_seq}차 주문을 취소하시겠습니까?`;
        if (!window.confirm(confirmMsg)) return;
        try {
            if (isPrepaid) {
                const res = await fetch(`${getApiUrl()}/api/payment/cancel`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: order.order_id, cancel_reason: '카운터 취소' })
                });
                const data = await res.json();
                if (data.status === 'success') alert(`✅ ${data.message}`);
                else if (data.status === 'manual_required') alert(`⚠️ 자동 환불 불가\n${data.message}`);
                else alert('주문이 취소되었습니다. (결제키 없음 - 후불 처리)');
            } else {
                await handleStatusUpdate(order.order_id, 'cancelled');
            }
            fetchSessions();
        } catch (e: any) { alert(`취소 처리 중 오류: ${e.message}`); }
    };

    const handleOpenSession = async (directTableId?: string) => {
        if (!directTableId) return;
        try {
            const targetStoreId = (!storeId || storeId === 'Total') ? 'default_store' : storeId;
            const res = await fetch(`${getApiUrl()}/api/session/open`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: targetStoreId, table_id: directTableId })
            });
            if (res.ok) {
                setSeatRequests(prev => prev.filter(r => r.table_id !== directTableId));
                fetchSessions();
            } else {
                alert(`세션 개시 실패: ${await res.text()}`);
            }
        } catch { alert('서버와 통신 중 오류가 발생했습니다.'); }
    };

    const handleResetSession = async (sessionId: string) => {
        if (!window.confirm('정말 이 테이블을 초기화하시겠습니까? (모든 주문이 취소됩니다)')) return;
        try {
            const res = await fetch(`${getApiUrl()}/api/session/reset`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });
            if (res.ok) { fetchSessions(); alert('테이블이 초기화되었습니다.'); }
        } catch { alert('초기화 중 오류가 발생했습니다.'); }
    };

    const getTableStage = useCallback((tableId: string): { label: string; bg: string; color: string; stage: string; hint?: string } => {
        const session = sessions.find(s => s.table_id === tableId);
        const isSeatReq = seatRequests.some(r => r.table_id === tableId);
        if (session?.status === 'closing') return { label: '세션종료', bg: '#e2e8f0', color: '#475569', stage: 'closing', hint: '더블탭→초기화' };
        if (session?.status === 'serving') {
            const orders = (session.orders || []).filter((o: any) => o.status !== 'cancelled');
            const total = orders.reduce((s: number, o: any) => s + (o.total_price ?? o.total ?? 0), 0);
            const paid = orders.filter((o: any) => o.payment_status === 'paid' || o.payment_status === 'prepaid').reduce((s: number, o: any) => s + (o.total_price ?? o.total ?? 0), 0);
            if (total > 0 && paid < total) return { label: '결제대기', bg: '#fee2e2', color: '#b91c1c', stage: 'payment_pending', hint: '더블탭→종료' };
            return { label: '결제완료', bg: '#dcfce7', color: '#15803d', stage: 'payment_done', hint: '더블탭→종료' };
        }
        if (!session && !isSeatReq) return { label: '빈자리', bg: '#ffffff', color: '#9ca3af', stage: 'initial', hint: '더블탭→배정' };
        if (isSeatReq && !session) return { label: '고객대기', bg: '#fef3c7', color: '#92400e', stage: 'waiting' };
        if (session) {
            const active = (session.orders || []).filter((o: any) => o.status !== 'cancelled');
            if (active.length === 0) return { label: '좌석배정', bg: '#dbeafe', color: '#1e40af', stage: 'seated' };
            if (active.some((o: any) => o.status === 'ready')) return { label: '조리완료', bg: '#ede9fe', color: '#6d28d9', stage: 'cooking_done', hint: '더블탭→서빙' };
            return { label: '주문접수', bg: '#fed7aa', color: '#c2410c', stage: 'ordered' };
        }
        return { label: tableId, bg: '#ffffff', color: '#9ca3af', stage: 'initial' };
    }, [sessions, seatRequests]);

    const patchSessionStatus = useCallback(async (tableId: string, status: string) => {
        const s = sessions.find(s => s.table_id === tableId);
        if (!s) return;
        try {
            await fetch(`${getApiUrl()}/api/session/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: s.session_id, status })
            });
            fetchSessions();
        } catch {}
    }, [sessions, fetchSessions]);

    const handleTableTap = useCallback((tableId: string) => {
        setSelectedTableId(tableId);
        const now = Date.now();
        const isDouble = lastTapInfo?.id === tableId && (now - lastTapInfo.time) < 450;
        setLastTapInfo({ id: tableId, time: now });
        if (!isDouble) return;
        const { stage } = getTableStage(tableId);
        setLastTapInfo(null);
        if (stage === 'cooking_done') {
            patchSessionStatus(tableId, 'serving');
        } else if (stage === 'payment_pending' || stage === 'payment_done') {
            patchSessionStatus(tableId, 'closing');
        } else if (stage === 'closing') {
            const s = sessions.find(s => s.table_id === tableId);
            if (s) {
                fetch(`${getApiUrl()}/api/session/close`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: s.session_id, force: true })
                }).then(() => fetchSessions()).catch(() => {});
            }
            setSelectedTableId(null);
        } else if (stage === 'waiting' || stage === 'initial') {
            handleOpenSession(tableId);
        }
    }, [lastTapInfo, getTableStage, patchSessionStatus, sessions, handleOpenSession, fetchSessions]);

    const tables = Array.from({ length: 12 }, (_, i) => i + 1);

    // ── 선택된 테이블 데이터 계산 ──
    const selectedSession = sessions.find((s: any) => s.table_id === selectedTableId);
    const selectedStage = selectedTableId ? getTableStage(selectedTableId) : null;
    const activeOrders = selectedSession
        ? (selectedSession.orders || []).filter((o: any) => o.status !== 'cancelled')
        : [];
    const sessionTotal = activeOrders.reduce((sum: number, o: any) => sum + (o.total_price ?? o.total ?? 0), 0);
    const paidTotal = activeOrders
        .filter((o: any) => o.payment_status === 'paid' || o.payment_status === 'prepaid' || o.status === 'paid')
        .reduce((sum: number, o: any) => sum + (o.total_price ?? o.total ?? 0), 0);
    const unpaidTotal = sessionTotal - paidTotal;
    const isPending = selectedSession?.status === 'pending';
    const isSeatReqSelected = seatRequests.some((r: any) => r.table_id === selectedTableId);

    const currentStageIdx = selectedStage
        ? STAGE_PIPELINE.findIndex(p => p.key === selectedStage.stage)
        : -1;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 146px)', overflow: 'hidden', background: 'var(--bg-main)', padding: '10px', gap: '8px', boxSizing: 'border-box' }}>

            {/* ── 좌석 승인 요청 배너 ── */}
            {seatRequests.length > 0 && (
                <div style={{ padding: '8px 14px', background: 'linear-gradient(135deg,#fff7ed,#ffedd5)', border: '2px solid #f97316', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#c2410c', whiteSpace: 'nowrap' }}>🔔 좌석 승인 요청 ({seatRequests.length}건)</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {seatRequests.map(req => (
                            <div key={req.table_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: '1px solid #fed7aa', borderRadius: '8px', padding: '4px 10px' }}>
                                <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#ea580c' }}>{req.table_id}</span>
                                <span style={{ fontSize: '0.7rem', color: '#9a3412' }}>{new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <button onClick={() => handleOpenSession(req.table_id)} style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: '5px', padding: '3px 8px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' }}>승인</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── 상단: 선택 테이블 상세 ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'auto', minHeight: 0 }}>
                    {selectedTableId && selectedStage ? (
                        <>
                            {/* 헤더 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', borderRadius: '10px', padding: '10px 14px', border: `2px solid ${selectedStage.color}33`, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '1.3rem', fontWeight: '900', color: selectedStage.color }}>
                                    TABLE {selectedTableId}
                                </span>
                                <span style={{ background: selectedStage.bg, color: selectedStage.color, padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: `1px solid ${selectedStage.color}44` }}>
                                    {selectedStage.label}
                                </span>
                                {selectedSession && (
                                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {selectedSession.session_id}
                                    </span>
                                )}
                            </div>

                            {/* ── 진행 그래프 ── */}
                            <div style={{ background: 'var(--surface)', borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>진행 단계</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                                    {STAGE_PIPELINE.filter(s => s.key !== 'initial').map((s, idx, arr) => {
                                        const stageIdx = STAGE_PIPELINE.findIndex(p => p.key === s.key);
                                        const isActive = s.key === selectedStage.stage;
                                        const isPast = currentStageIdx > stageIdx;
                                        const isFuture = currentStageIdx < stageIdx;
                                        return (
                                            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1 }}>
                                                    <div style={{
                                                        width: '28px', height: '28px',
                                                        borderRadius: '50%',
                                                        background: isActive ? s.color : isPast ? s.color + 'aa' : '#e5e7eb',
                                                        border: isActive ? `3px solid ${s.color}` : isPast ? `2px solid ${s.color}77` : '2px solid #d1d5db',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: isActive ? `0 0 10px ${s.color}66` : 'none',
                                                        transition: 'all 0.3s',
                                                        flexShrink: 0,
                                                    }}>
                                                        {isPast && !isActive && (
                                                            <span style={{ fontSize: '0.65rem', color: 'white', fontWeight: '800' }}>✓</span>
                                                        )}
                                                        {isActive && (
                                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'white' }} />
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: '0.5rem', fontWeight: isActive ? '800' : '500', color: isActive ? s.color : isFuture ? '#d1d5db' : '#9ca3af', whiteSpace: 'nowrap', textAlign: 'center' }}>{s.label}</span>
                                                </div>
                                                {idx < arr.length - 1 && (
                                                    <div style={{ height: '2px', flex: 1, background: isPast || isActive ? s.color + '66' : '#e5e7eb', marginBottom: '18px', transition: 'background 0.3s' }} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 좌석 개시 버튼 */}
                            {((isSeatReqSelected && !selectedSession) || isPending) && (
                                <button onClick={() => handleOpenSession(selectedTableId)} style={{ background: '#f97316', border: 'none', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', width: '100%' }}>
                                    🎯 좌석 개시 승인
                                </button>
                            )}

                            {/* ── 주문 목록 (차수별) ── */}
                            {activeOrders.length > 0 && (
                                <div style={{ background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>주문 내역</span>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{activeOrders.length}건</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {[...activeOrders]
                                            .sort((a: any, b: any) => (a.order_seq || 0) - (b.order_seq || 0))
                                            .map((order: any, idx: number) => {
                                                const isPrepaid = order.payment_status === 'prepaid' || order.payment_status === 'paid';
                                                const isPaidFull = order.status === 'paid' || order.status === 'served' || isPrepaid;
                                                const orderAmt = order.total_price ?? order.total ?? 0;
                                                const isReady = order.status === 'ready';
                                                return (
                                                    <div key={order.order_id} style={{ padding: '10px 14px', borderBottom: idx < activeOrders.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {/* 차수 배지 */}
                                                        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: '32px' }}>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)' }}>#{order.order_seq || 1}</div>
                                                            {order.join_order && (
                                                                <div style={{ fontSize: '0.55rem', background: '#e0e7ff', color: '#4338ca', padding: '1px 3px', borderRadius: '3px', fontWeight: '700', marginTop: '2px' }}>합석</div>
                                                            )}
                                                        </div>

                                                        {/* 메뉴 목록 */}
                                                        <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                                                            {(order.items || []).map((item: any) => `${item.name} ${item.quantity || item.qty}개`).join(' · ')}
                                                        </div>

                                                        {/* 금액 */}
                                                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                                            <div style={{ fontSize: '0.88rem', fontWeight: '800', color: isPaidFull ? '#10b981' : 'var(--accent)', whiteSpace: 'nowrap' }}>
                                                                {orderAmt.toLocaleString()}원
                                                            </div>
                                                            <div style={{ fontSize: '0.6rem', fontWeight: '600', color: isPrepaid ? '#10b981' : '#9ca3af' }}>
                                                                {isPrepaid ? '선불' : '후불'}
                                                            </div>
                                                        </div>

                                                        {/* 액션 버튼 */}
                                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                            <button onClick={() => handleCancelWithRefund(order)} style={{ background: 'transparent', border: '1px solid #fca5a5', color: '#ef4444', padding: '4px 8px', borderRadius: '5px', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>취소</button>
                                                            {isReady ? (
                                                                <button onClick={() => handleStatusUpdate(order.order_id, 'served')} style={{ background: '#10b981', border: 'none', color: 'white', padding: '4px 10px', borderRadius: '5px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: '700', whiteSpace: 'nowrap', boxShadow: '0 0 8px rgba(16,185,129,0.4)' }}>
                                                                    🍽️ 서빙
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    disabled={isPaidFull}
                                                                    onClick={() => setSelectedOrderForPay(order)}
                                                                    style={{ background: isPaidFull ? '#e5e7eb' : 'var(--accent)', border: 'none', color: isPaidFull ? '#9ca3af' : 'white', padding: '4px 10px', borderRadius: '5px', fontSize: '0.72rem', cursor: isPaidFull ? 'default' : 'pointer', fontWeight: '700', whiteSpace: 'nowrap' }}
                                                                >
                                                                    {isPrepaid ? '완료' : (order.status === 'paid' || order.payment_status === 'paid') ? '완료' : '결제'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            {selectedSession && activeOrders.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>주문 내역이 없습니다.</div>
                            )}

                            {/* ── 합계 + 세션 액션 바 ── */}
                            {selectedSession && (
                                <div style={{ background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {/* 결제 요약 */}
                                    <div style={{ flex: 1, display: 'flex', gap: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600' }}>결제 완료</div>
                                            <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#10b981' }}>{paidTotal.toLocaleString()}원</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600' }}>미결제</div>
                                            <div style={{ fontSize: '0.95rem', fontWeight: '800', color: unpaidTotal > 0 ? '#ef4444' : '#10b981' }}>
                                                {unpaidTotal > 0 ? `${unpaidTotal.toLocaleString()}원` : activeOrders.length === 0 ? '없음' : '완료'}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600' }}>합계</div>
                                            <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)' }}>{sessionTotal.toLocaleString()}원</div>
                                        </div>
                                    </div>

                                    {/* 액션 버튼 */}
                                    {isPending ? (
                                        <button onClick={() => handleOpenSession(selectedSession.table_id)} style={{ background: '#f97316', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>개시 승인</button>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                            <button onClick={() => handleResetSession(selectedSession.session_id)} style={{ background: 'transparent', border: '1px solid #fca5a5', color: '#ef4444', padding: '7px 12px', borderRadius: '7px', fontWeight: '500', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>초기화</button>
                                            {unpaidTotal === 0 ? (
                                                <button onClick={async () => {
                                                    const msg = activeOrders.length > 0 ? '모든 결제가 완료되었습니다. 세션을 종료하시겠습니까?' : '주문이 없습니다. 세션을 종료하시겠습니까?';
                                                    if (!window.confirm(msg)) return;
                                                    try {
                                                        const r = await fetch(`${getApiUrl()}/api/session/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: selectedSession.session_id, force: true }) });
                                                        if (r.ok) { setSelectedTableId(null); fetchSessions(); }
                                                        else alert('오류가 발생했습니다.');
                                                    } catch { alert('오류가 발생했습니다.'); }
                                                }} style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '7px 16px', borderRadius: '7px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                                    {activeOrders.length === 0 ? '종료' : '결제완료'}
                                                </button>
                                            ) : (
                                                <button onClick={() => setSelectedSessionForPay(selectedSession)} style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '7px 16px', borderRadius: '7px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>전체결제</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', borderRadius: '12px', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.4 }}>🪑</div>
                                <div style={{ fontSize: '0.88rem', fontWeight: '500' }}>테이블을 선택하면 상세 정보가 표시됩니다</div>
                            </div>
                        </div>
                    )}
            </div>

            {/* ── 하단 바: 테이블 그리드 ── */}
            <div style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)', borderRadius: '12px', padding: '10px 12px 8px', flexShrink: 0, boxShadow: '0 -2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>테이블 현황 <span style={{ color: 'var(--accent)' }}>{sessions.length}석 활성</span></span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        {STAGE_PIPELINE.filter(s => s.key !== 'initial').map(s => (
                            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: s.bg, border: `1px solid ${s.color}66`, flexShrink: 0 }} />
                                <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px' }}>
                    {tables.map(num => {
                        const tableId = `T${String(num).padStart(2, '0')}`;
                        const { label, bg, color, hint, stage } = getTableStage(tableId);
                        const isSelected = selectedTableId === tableId;
                        const hasAlert = stage === 'waiting' || stage === 'cooking_done' || stage === 'payment_pending';
                        return (
                            <button
                                key={num}
                                onClick={() => handleTableTap(tableId)}
                                style={{
                                    padding: '8px 4px 7px',
                                    borderRadius: '8px',
                                    border: isSelected ? `2px solid ${color}` : `1.5px solid ${stage === 'initial' ? '#e5e7eb' : color + '55'}`,
                                    background: bg,
                                    color,
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    boxShadow: isSelected ? `0 0 0 3px ${color}22` : hasAlert ? `0 0 6px ${color}44` : 'none',
                                    transition: 'all 0.15s',
                                    animation: hasAlert ? 'pulse-mild 2s infinite' : 'none',
                                }}
                            >
                                <div style={{ fontSize: '0.6rem', fontWeight: '600', opacity: 0.6, marginBottom: '2px' }}>{tableId}</div>
                                <div style={{ lineHeight: 1.2, fontSize: '0.68rem' }}>{label}</div>
                                {hint && <div style={{ fontSize: '0.5rem', opacity: 0.5, marginTop: '2px' }}>{hint}</div>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── 결제 모달 ── */}
            {(selectedSessionForPay || selectedOrderForPay) && (
                <PaymentModal
                    totalPrice={selectedOrderForPay
                        ? (selectedOrderForPay.total_price ?? selectedOrderForPay.total ?? 0)
                        : (selectedSessionForPay?.orders || [])
                            .filter((o: any) => o.payment_status !== 'paid' && o.payment_status !== 'prepaid' && o.status !== 'paid')
                            .reduce((sum: number, o: any) => sum + (o.total_price ?? o.total ?? 0), 0)
                    }
                    onClose={() => { setSelectedSessionForPay(null); setSelectedOrderForPay(null); }}
                    onPayerInfo={(phone, topPercent) => setVipPayerInfo({ phone, topPercent })}
                    onSubmit={async () => {
                        if (selectedOrderForPay) {
                            await handlePartialPayment(selectedOrderForPay.order_id);
                        } else {
                            await handleCloseSession(selectedSessionForPay.session_id);
                        }
                        if (vipPayerInfo && vipPayerInfo.topPercent <= 10) {
                            setVipFlashVisible(true);
                            setTimeout(() => { setVipFlashVisible(false); setVipPayerInfo(null); }, 3000);
                        } else {
                            setVipPayerInfo(null);
                        }
                    }}
                    isCounter={true}
                />
            )}

            {/* ── VIP 플래시 ── */}
            {vipFlashVisible && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ padding: '40px 60px', borderRadius: '24px', background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '3px solid #f59e0b', boxShadow: '0 20px 60px rgba(245,158,11,0.4)', textAlign: 'center', animation: 'vipFlash 0.6s ease-in-out infinite alternate' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>👑</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#92400e', letterSpacing: '0.1em' }}>VIP</div>
                        <div style={{ fontSize: '1rem', color: '#b45309', fontWeight: 700, marginTop: '8px' }}>상위 {vipPayerInfo?.topPercent}% 단골 고객</div>
                    </div>
                    <style>{`
                        @keyframes vipFlash { from { opacity:1; transform:scale(1); } to { opacity:0.6; transform:scale(1.06); } }
                        @keyframes pulse-mild { 0%,100% { box-shadow: none; } 50% { box-shadow: 0 0 8px currentColor; } }
                    `}</style>
                </div>
            )}
        </div>
    );
};
