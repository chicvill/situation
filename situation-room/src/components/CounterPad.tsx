import { useEffect, useState, useCallback, useRef } from 'react';
import { PaymentModal } from './PaymentModal';
import { useStoreFilter } from '../hooks/useStoreFilter';
import { subscribeTopic } from '../services/mqttClient';
import { playDingDong } from '../utils/audio';
import { usePadMode } from '../hooks/usePadMode';

interface CounterPadProps {
    storeId?: string;
    bundles?: any[];
}

const getApiUrl = () => {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');
    if (isLocal) return `http://${host}:8080`;
    return import.meta.env.VITE_API_URL || `http://${host}:8080`;
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
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const initialSelectionDone = useRef(false);
    const [showCardTouchOverlay, setShowCardTouchOverlay] = useState(false);
    const [cardTouchCallback, setCardTouchCallback] = useState<(() => Promise<void>) | null>(null);
    const [cardTouchAmount, setCardTouchAmount] = useState<number>(0);
    const [cardTouchOrderId, setCardTouchOrderId] = useState<string>('');
    const [cardTouchTableId, setCardTouchTableId] = useState<string>('');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // ── 구두 주문 추가를 위한 상태 ──
    const [showAddOrder, setShowAddOrder] = useState(false);
    const [selectedMenuName, setSelectedMenuName] = useState('');
    const [selectedMenuQty, setSelectedMenuQty] = useState(1);
    const [isSubmittingManualOrder, setIsSubmittingManualOrder] = useState(false);

    const [lastTapInfo, setLastTapInfo] = useState<{ id: string; time: number } | null>(null);
    const { padMode } = usePadMode('counter');

    // playDingDong: utils/audio.ts 상단 import에서 가져옴

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
            const res = await fetch(`${getApiUrl()}/api/counter/sessions?store_id=${storeId || 'Total'}&t=${Date.now()}`);
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
                if (!initialSelectionDone.current) {
                    initialSelectionDone.current = true;
                    if (data.length > 0) {
                        const first = [...data].sort((a, b) => a.table_id.localeCompare(b.table_id))[0];
                        setSelectedTableId(first.table_id);
                    } else {
                        setSelectedTableId('T01');
                    }
                }
            } else {
                setSessions([]);
                if (!initialSelectionDone.current) {
                    initialSelectionDone.current = true;
                    setSelectedTableId('T01');
                }
            }
        } catch (e) {
            console.error('Counter Fetch Error:', e);
            setSessions([]);
            if (!initialSelectionDone.current) {
                initialSelectionDone.current = true;
                setSelectedTableId('T01');
            }
        }
    }, [storeId]);

    // ── 카운터 구두 추가 주문 접수 로직 ──
    const handleManualOrderSubmit = async () => {
        if (!selectedSession) return;
        if (!selectedMenuName) {
            alert('메뉴를 선택해 주세요.');
            return;
        }
        
        // bundles에서 Menus 찾기
        const menuBundle = bundles?.find((b: any) => b.type === 'Menus' && (storeId === 'Total' || !storeId || b.store_id === storeId));
        const menuItems = menuBundle?.items ?? [];
        const menu = menuItems.find((m: any) => m.name === selectedMenuName);
        if (!menu) return;
        
        const rawPrice = menu.value;
        const priceNum = typeof rawPrice === 'number' ? rawPrice : parseInt(String(rawPrice).replace(/[^0-9]/g, '')) || 0;
        
        setIsSubmittingManualOrder(true);
        try {
            const response = await fetch(`${getApiUrl()}/api/order/direct`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    store_id: storeId || 'default_store',
                    table_id: selectedTableId,
                    device_id: 'counter',  // 카운터 직접 구두 주문
                    payment_status: 'unpaid', // 구두 주문은 기본 후불(미결제)
                    payment_method: '현금/후불',
                    total_price: priceNum * selectedMenuQty,
                    items: [{
                        name: selectedMenuName,
                        price: priceNum,
                        quantity: selectedMenuQty
                    }]
                })
            });
            
            if (response.ok) {
                alert('구두 추가 주문이 정식 접수되어 주방으로 전송되었습니다.');
                setShowAddOrder(false);
                setSelectedMenuName('');
                setSelectedMenuQty(1);
                fetchSessions(); // 세션 리로드하여 화면 갱신
            } else {
                alert('주문 등록에 실패했습니다.');
            }
        } catch (e) {
            console.error('Manual order submit error:', e);
            alert('서버 오류가 발생했습니다.');
        } finally {
            setIsSubmittingManualOrder(false);
        }
    };

    useEffect(() => {
        fetchSessions();
        const storeTopic  = (storeId && storeId !== 'Total') ? `store/${storeId}` : 'store/+';
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
                playDingDong();
                setSeatRequests(prev => prev.filter(r => r.table_id !== data.session?.table_id));
                fetchSessions();
                return;
            }
            // 외부(고객/주방)에서 발생한 이벤트 → 딩동 + 화면 갱신
            // WAITING_REGISTERED는 App 레벨 useStoreSync가 처리하므로 제외 (중복 딩동 방지)
            const externalEvents = [
                'NEW_ORDER', 'ORDER_PLACED', 'NEW_ORDER_DIRECT', 'ORDER_UPDATED',
                'STATUS_UPDATE', 'SESSION_CLOSED', 'PAYMENT_CONFIRMED', 'PARTIAL_SETTLEMENT',
                'STAFF_CALL', 'PARKING_APPLIED'
            ];
            if (externalEvents.includes(data.type)) {
                playDingDong();
                fetchSessions();
            }
        };
        const unsub1 = subscribeTopic(storeTopic, messageHandler);
        // Total 모드: store/+ 가 broadcast 포함. 특정 매장: broadcast 별도 구독
        const unsub2 = storeTopic !== 'store/+' ? subscribeTopic('store/broadcast', messageHandler) : null;
        return () => { unsub1(); unsub2?.(); };
    }, [storeId, fetchSessions]);

    // 폴링 안전망: MQTT 독립적으로 3초마다 자동 갱신 (토픽 불일치 방어)
    useEffect(() => {
        const interval = setInterval(() => { fetchSessions(); }, 3000);
        return () => clearInterval(interval);
    }, [fetchSessions]);

    // 좌석요청 폴링: MQTT 수신 실패 시 fallback
    useEffect(() => {
        fetchSeatRequests();
        const interval = setInterval(() => { fetchSeatRequests(); }, 3000);
        return () => clearInterval(interval);
    }, [fetchSeatRequests]);

    useEffect(() => { fetchSessions(); }, [bundles, fetchSessions]);


    const handleStatusUpdate = async (orderId: string, status: string) => {
        setSessions(prev => prev.map(s => ({
            ...s,
            orders: s.orders?.map((o: any) => o.order_id === orderId ? { ...o, status } : o)
        })));
        try {
            await fetch(`${getApiUrl()}/api/order/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, status })
            });
            fetchSessions();
        } catch (e) { 
            console.error('Status Update Error:', e); 
            fetchSessions();
        }
    };

    const handleCloseSession = async (sessionId: string, silent = false) => {
        try {
            const res = await fetch(`${getApiUrl()}/api/session/close`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });
            const data = await res.json();
            if (res.ok) {
                if (!silent) {
                    alert(data.status === 'partial' ? data.message : '정산이 완료되었습니다.');
                }
                setSelectedSessionForPay(null);
                setSelectedOrderForPay(null);
                fetchSessions();
            } else {
                throw new Error(data.detail || '정산 실패');
            }
        } catch (e) {
            console.error('Close Session Error:', e);
            if (!silent) alert('정산 중 오류가 발생했습니다.');
            throw e;
        }
    };

    const resolvePendingCardCalls = async (sessionId: string) => {
        const session = sessions.find((s: any) => s.session_id === sessionId);
        if (!session) return;
        const pendingCardCalls = (session.calls || []).filter(
            (c: any) => c.call_type === '실물 카드 결제' && c.status === 'pending'
        );
        for (const call of pendingCardCalls) {
            try {
                await fetch(`${getApiUrl()}/api/call/status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ call_id: call.call_id, status: 'completed' })
                });
            } catch (e) {
                console.error('Failed to auto-resolve card call:', e);
            }
        }
    };

    const handlePartialPayment = async (orderId: string) => {
        setSessions(prev => prev.map(s => ({
            ...s,
            orders: s.orders?.map((o: any) => o.order_id === orderId ? { ...o, payment_status: 'paid' } : o)
        })));
        try {
            const res = await fetch(`${getApiUrl()}/api/order/payment-status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, payment_status: 'paid' })
            });
            if (res.ok) { setSelectedOrderForPay(null); fetchSessions(); }
            else { const d = await res.json(); throw new Error(d.detail || '결제 실패'); }
        } catch (e) { 
            console.error('Partial Payment Error:', e); 
            fetchSessions();
            throw e; 
        }
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
                setSelectedTableId(directTableId); // 승인된 테이블 자동 선택 및 포커싱
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
        if (session?.status === 'closing') return { label: '세션종료', bg: '#e2e8f0', color: '#475569', stage: 'closing' };
        
        if (!session && !isSeatReq) return { label: '빈자리', bg: '#ffffff', color: '#9ca3af', stage: 'initial' };
        if (isSeatReq && !session) return { label: '고객대기', bg: '#fef3c7', color: '#92400e', stage: 'waiting' };
        
        if (session) {
            const active = (session.orders || []).filter((o: any) => o.status !== 'cancelled');
            
            // 1. 주문이 아직 없는 신규 세션인 경우
            if (active.length === 0) {
                if (isSeatReq) return { label: '고객대기', bg: '#fef3c7', color: '#92400e', stage: 'waiting' };
                return { label: '주문중', bg: '#dbeafe', color: '#1e40af', stage: 'seated' };
            }
            
            // 2. 조리 중인 주문이 있는 경우 -> 조리중 (최우선순위)
            if (active.some((o: any) => o.status === 'cooking')) {
                return { label: '조리중', bg: '#e0f2fe', color: '#0284c7', stage: 'cooking' };
            }
            
            // 3. 조리 완료되어 서빙 대기 중인 주문이 있는 경우 -> 조리완료
            if (active.some((o: any) => o.status === 'ready')) {
                return { label: '조리완료', bg: '#ede9fe', color: '#6d28d9', stage: 'cooking_done' };
            }
            
            // 4. 새로운 주문 접수 (대기 상태의 미조리 주문이 하나라도 있는 경우) -> 주문접수
            const isUnprocessed = active.some((o: any) => 
                o.status === 'waiting_pin' || 
                o.status === 'pending_payment' || 
                o.status === 'ordered' ||
                (!['cooking', 'ready', 'served', 'paid'].includes(o.status))
            );
            if (isUnprocessed) {
                return { label: '주문접수', bg: '#fed7aa', color: '#c2410c', stage: 'ordered' };
            }
            
            // 5. 모든 주문이 조리 완료되어 서빙되었거나 이미 결제된 경우 -> 결제대기 또는 결제완료
            const total = active.reduce((s: number, o: any) => s + (o.total_price ?? o.total ?? 0), 0);
            const paid = active.filter((o: any) => o.payment_status === 'paid' || o.payment_status === 'prepaid' || o.status === 'paid').reduce((s: number, o: any) => s + (o.total_price ?? o.total ?? 0), 0);
            
            if (total > 0 && paid < total) {
                return { label: '결제대기', bg: '#fee2e2', color: '#b91c1c', stage: 'payment_pending' };
            }
            return { label: '종료', bg: '#dcfce7', color: '#15803d', stage: 'payment_done' };
        }
        
        return { label: tableId, bg: '#ffffff', color: '#9ca3af', stage: 'initial' };
    }, [sessions, seatRequests]);

    const patchSessionStatus = useCallback(async (tableId: string, status: string) => {
        const s = sessions.find(s => s.table_id === tableId);
        if (!s) return;
        setSessions(prev => prev.map(sess => sess.table_id === tableId ? { ...sess, status } : sess));
        try {
            await fetch(`${getApiUrl()}/api/session/status`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: s.session_id, status })
            });
            fetchSessions();
        } catch {
            fetchSessions();
        }
    }, [sessions, fetchSessions]);

    const handleTableTap = useCallback((tableId: string) => {
        setSelectedTableId(tableId);
        const now = Date.now();
        const isDouble = lastTapInfo?.id === tableId && (now - lastTapInfo.time) < 450;
        setLastTapInfo({ id: tableId, time: now });
        if (!isDouble) return;
        const { stage } = getTableStage(tableId);
        setLastTapInfo(null);
        if (stage === 'payment_pending' || stage === 'payment_done') {
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
    const hasCookingOrder = activeOrders.some((o: any) => o.status === 'cooking');
    const sessionTotal = activeOrders.reduce((sum: number, o: any) => sum + (o.total_price ?? o.total ?? 0), 0);
    const paidTotal = activeOrders
        .filter((o: any) => o.payment_status === 'paid' || o.payment_status === 'prepaid' || o.status === 'paid')
        .reduce((sum: number, o: any) => sum + (o.total_price ?? o.total ?? 0), 0);
    const unpaidTotal = sessionTotal - paidTotal;
    const isPending = selectedSession?.status === 'pending';
    const isSeatReqSelected = seatRequests.some((r: any) => r.table_id === selectedTableId);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 110px)', overflow: 'hidden', background: 'var(--bg-main)', padding: '4px 4px 0', gap: '4px', boxSizing: 'border-box', zoom: padMode ? 1.35 : 1 } as React.CSSProperties}>

            {/* ── 좌석 승인 요청 배너 제거 (선결제 도입으로 점주 승인 불필요) ── */}


            {/* ── 상단 바: 테이블 그리드 ── */}
            <div style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)', borderRadius: '12px', padding: '4px 8px 4px', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>현황: <span style={{ color: 'var(--accent)' }}>{sessions.length}석 활성</span></span>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px' }}>
                    {tables.map(num => {
                        const tableId = `T${String(num).padStart(2, '0')}`;
                        const { label, bg, color, stage } = getTableStage(tableId);
                        const isSelected = selectedTableId === tableId;
                        const isWaiting = stage === 'waiting';
                        const hasAlert = isWaiting || stage === 'cooking_done' || stage === 'payment_pending';

                        // Determine background, text color, and border based on selection and state
                        const buttonBg = isSelected
                            ? (stage === 'initial' ? '#475569' : color)
                            : (stage === 'initial' ? '#ffffff' : bg);

                        const buttonColor = isSelected
                            ? '#ffffff'
                            : (stage === 'initial' ? '#475569' : color);

                        const buttonBorder = isSelected
                            ? `3.5px solid #0f172a`
                            : isWaiting 
                                ? `3.5px solid ${color}` 
                                : `2.5px solid ${stage === 'initial' ? '#94a3b8' : color}`;

                        return (
                            <button
                                key={num}
                                onClick={() => handleTableTap(tableId)}
                                className={isWaiting ? 'table-seat-waiting' : ''}
                                style={{
                                    padding: '3px 2px',
                                    borderRadius: '6px',
                                    border: buttonBorder,
                                    background: buttonBg,
                                    color: buttonColor,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    boxShadow: isSelected ? `0 0 0 2px ${color}22` : (!isWaiting && hasAlert) ? `0 0 6px ${color}44` : 'none',
                                    transition: isWaiting ? 'none' : 'all 0.15s',
                                    ...(isWaiting ? {} : { animation: hasAlert ? 'pulse-mild 2s infinite' : 'none' }),
                                }}
                            >
                                <div style={{ fontSize: '0.7rem', fontWeight: '900', color: 'inherit', whiteSpace: 'nowrap' }}>{tableId}</div>
                                <div style={{ lineHeight: 1.1, fontSize: '0.58rem', fontWeight: '800', color: 'inherit', whiteSpace: 'nowrap' }}>{label}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── 하단: 선택 테이블 상세 ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'auto', minHeight: 0 }}>
                    {selectedTableId && selectedStage ? (
                        <>
                            {/* 헤더 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface)', borderRadius: '8px', padding: '4px 8px', border: `1px solid ${selectedStage.color}33`, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: '900', color: selectedStage.color }}>
                                    TABLE {selectedTableId}
                                </span>
                                <span style={{ background: selectedStage.bg, color: selectedStage.color, padding: '1px 5px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700', border: `1px solid ${selectedStage.color}44` }}>
                                    {selectedStage.label}
                                </span>
                                {selectedSession && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                                        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {selectedSession.session_id}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* 좌석 개시 버튼 */}
                            {((isSeatReqSelected && !selectedSession) || isPending) && (
                                <button onClick={() => handleOpenSession(selectedTableId)} style={{ background: '#f97316', border: 'none', color: 'white', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', width: '100%' }}>
                                    🎯 좌석 개시 승인
                                </button>
                            )}

                            {/* ── 실물카드 결제 퀵 버튼 ── */}
                            {selectedSession && (() => {
                                const pendingCardCall = (selectedSession.calls || []).find((c: any) => c.call_type === '실물 카드 결제' && c.status === 'pending');
                                if (pendingCardCall && unpaidTotal > 0) {
                                    return (
                                        <button
                                            onClick={async () => {
                                                setCardTouchCallback(() => async () => {
                                                    await handleCloseSession(selectedSession.session_id, true);
                                                    await fetch(`${getApiUrl()}/api/call/status`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ call_id: pendingCardCall.call_id, status: 'completed' })
                                                    });
                                                });
                                                setShowCardTouchOverlay(true);
                                            }}
                                            style={{
                                                background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                                                border: 'none',
                                                color: 'white',
                                                padding: '12px',
                                                borderRadius: '8px',
                                                fontWeight: '900',
                                                fontSize: '0.92rem',
                                                cursor: 'pointer',
                                                width: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)',
                                                marginBottom: '6px',
                                                animation: 'pulse-pink 2s infinite ease-in-out'
                                            }}
                                        >
                                            💳 대기중인 실물카드 결제 받기 ({unpaidTotal.toLocaleString()}원)
                                        </button>
                                    );
                                }
                                return null;
                            })()}

                            {/* ── 주문 목록 (차수별) ── */}
                            {selectedSession && (
                                <div style={{ background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                                    <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)' }}>주문 내역</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{activeOrders.length}건</span>
                                            <button 
                                                onClick={() => setShowAddOrder(!showAddOrder)} 
                                                style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                            >
                                                {showAddOrder ? '✕ 닫기' : '➕ 구두 주문 추가'}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* ── 구두 주문 수동 추가 폼 ── */}
                                    {showAddOrder && (
                                        <div style={{ padding: '14px', background: 'rgba(249,115,22,0.03)', borderBottom: '1px solid rgba(249,115,22,0.15)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                <div style={{ flex: 1, minWidth: '150px' }}>
                                                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>메뉴 선택 (풀다운)</label>
                                                    <select 
                                                        value={selectedMenuName}
                                                        onChange={(e) => setSelectedMenuName(e.target.value)}
                                                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: '700', outline: 'none' }}
                                                    >
                                                        <option value="">-- 메뉴를 선택해 주세요 --</option>
                                                        {(bundles?.find((b: any) => b.type === 'Menus' && (storeId === 'Total' || !storeId || b.store_id === storeId))?.items ?? []).map((m: any) => {
                                                            const val = typeof m.value === 'number' ? m.value : parseInt(String(m.value).replace(/[^0-9]/g, '')) || 0;
                                                            return (
                                                                <option key={m.name} value={m.name}>{m.name} ({val.toLocaleString()}원)</option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>
                                                
                                                <div style={{ width: '100px' }}>
                                                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>수량</label>
                                                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '8px', background: 'white', overflow: 'hidden' }}>
                                                        <button 
                                                            onClick={() => setSelectedMenuQty(q => Math.max(1, q - 1))}
                                                            style={{ width: '28px', height: '32px', border: 'none', background: 'none', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
                                                        >
                                                            -
                                                        </button>
                                                        <span style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)' }}>{selectedMenuQty}</span>
                                                        <button 
                                                            onClick={() => setSelectedMenuQty(q => q + 1)}
                                                            style={{ width: '28px', height: '32px', border: 'none', background: 'none', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                <button 
                                                    disabled={isSubmittingManualOrder}
                                                    onClick={handleManualOrderSubmit}
                                                    style={{ marginTop: '16px', background: '#f97316', border: 'none', color: 'white', padding: '10px 16px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', flexShrink: 0, height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    {isSubmittingManualOrder ? '등록 중...' : '확인 (주문 등록)'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
                                        {activeOrders.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>주문 내역이 없습니다.</div>
                                        ) : (
                                            [...activeOrders]
                                                .sort((a: any, b: any) => (a.order_seq || 0) - (b.order_seq || 0))
                                                .map((order: any, idx: number) => {
                                                    const isPrepaid = order.payment_status === 'prepaid' || order.payment_status === 'paid';
                                                    const isPaidFull = order.status === 'paid' || order.status === 'served' || isPrepaid;
                                                    const orderAmt = order.total_price ?? order.total ?? 0;
                                                    const isReady = order.status === 'ready';
                                                return (
                                                    <div key={order.order_id} style={{
                                                        padding: '4px 8px',
                                                        borderBottom: idx < activeOrders.length - 1 ? '1px solid var(--border)' : 'none',
                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                        background: 'transparent',
                                                        borderLeft: '3px solid transparent',
                                                    }}>
                                                        {/* 차수 배지 */}
                                                        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: '28px' }}>
                                                            <div style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--text-muted)' }}>#{order.order_seq || 1}</div>
                                                        </div>

                                                        {/* 메뉴 목록 */}
                                                        <div style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.3 }}>
                                                            {(order.items || []).map((item: any) => `${item.name} ${item.quantity || item.qty}개`).join(' · ')}
                                                        </div>

                                                        {/* 금액 */}
                                                        <div style={{ flexShrink: 0, textAlign: 'right', marginRight: '4px' }}>
                                                            <div style={{ fontSize: '0.82rem', fontWeight: '800', color: isPaidFull ? '#10b981' : 'var(--accent)', whiteSpace: 'nowrap' }}>
                                                                {orderAmt.toLocaleString()}원
                                                            </div>
                                                            <div style={{ fontSize: '0.58rem', fontWeight: '600', color: isPrepaid ? '#10b981' : '#9ca3af' }}>
                                                                {isPrepaid ? '선불' : '후불'}
                                                            </div>
                                                        </div>

                                                        {/* 액션 버튼 */}
                                                        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                                                            <button onClick={() => handleCancelWithRefund(order)} style={{ background: 'transparent', border: '1px solid #fca5a5', color: '#ef4444', padding: '3px 5px', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>취소</button>
                                                            {isReady ? (
                                                                <button onClick={() => handleStatusUpdate(order.order_id, 'served')} style={{ background: '#10b981', border: 'none', color: 'white', padding: '3px 6px', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: '700', whiteSpace: 'nowrap', boxShadow: '0 0 6px rgba(16,185,129,0.3)' }}>
                                                                    서빙
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    disabled={isPaidFull}
                                                                    onClick={() => {
                                                                        setCardTouchCallback(() => async () => {
                                                                            await handlePartialPayment(order.order_id);
                                                                            if (selectedSession?.session_id) await resolvePendingCardCalls(selectedSession.session_id);
                                                                        });
                                                                        setShowCardTouchOverlay(true);
                                                                    }}
                                                                    style={{ background: isPaidFull ? '#e5e7eb' : 'var(--accent)', border: 'none', color: isPaidFull ? '#9ca3af' : 'white', padding: '3px 6px', borderRadius: '4px', fontSize: '0.65rem', cursor: isPaidFull ? 'default' : 'pointer', fontWeight: '700', whiteSpace: 'nowrap' }}
                                                                >
                                                                    {isPrepaid ? '완료' : '결제'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── 합계 + 세션 액션 바 ── */}
                            {selectedSession && (
                                <div style={{ background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'space-between' }}>
                                    {/* 결제 요약 */}
                                    <div style={{ flex: 1, display: 'flex', gap: '4px', minWidth: 0 }}>
                                        <div style={{ whiteSpace: 'nowrap', minWidth: 0 }}>
                                            <div style={{ fontSize: '0.52rem', color: 'var(--text-muted)', fontWeight: '700', whiteSpace: 'nowrap' }}>완료</div>
                                            <div style={{ fontSize: '0.78rem', fontWeight: '900', color: '#10b981', whiteSpace: 'nowrap' }}>{paidTotal.toLocaleString()}원</div>
                                        </div>
                                        <div style={{ whiteSpace: 'nowrap', minWidth: 0 }}>
                                            <div style={{ fontSize: '0.52rem', color: 'var(--text-muted)', fontWeight: '700', whiteSpace: 'nowrap' }}>미결</div>
                                            <div style={{ fontSize: '0.78rem', fontWeight: '900', color: unpaidTotal > 0 ? '#ef4444' : '#10b981', whiteSpace: 'nowrap' }}>
                                                {unpaidTotal > 0 ? `${unpaidTotal.toLocaleString()}원` : activeOrders.length === 0 ? '없음' : '완료'}
                                            </div>
                                        </div>
                                        <div style={{ whiteSpace: 'nowrap', minWidth: 0 }}>
                                            <div style={{ fontSize: '0.52rem', color: 'var(--text-muted)', fontWeight: '700', whiteSpace: 'nowrap' }}>합계</div>
                                            <div style={{ fontSize: '0.78rem', fontWeight: '900', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{sessionTotal.toLocaleString()}원</div>
                                        </div>
                                    </div>
 
                                    {/* 액션 버튼 */}
                                    {isPending ? (
                                        <button onClick={() => handleOpenSession(selectedSession.table_id)} style={{ background: '#f97316', border: 'none', color: 'white', padding: '4px 6px', borderRadius: '4px', fontWeight: '700', fontSize: '0.68rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>개시 승인</button>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                            <button onClick={() => handleResetSession(selectedSession.session_id)} style={{ background: 'transparent', border: '1px solid #fca5a5', color: '#ef4444', padding: '4px 5px', borderRadius: '4px', fontWeight: '600', fontSize: '0.68rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>초기화</button>
                                            {unpaidTotal === 0 ? (
                                                <button 
                                                    disabled={hasCookingOrder}
                                                    title={hasCookingOrder ? "주방에서 조리 중인 주문이 있어 세션을 종료할 수 없습니다." : ""}
                                                    onClick={async () => {
                                                        const msg = activeOrders.length > 0 ? '모든 결제가 완료되었습니다. 세션을 종료하시겠습니까?' : '주문이 없습니다. 세션을 종료하시겠습니까?';
                                                        if (!window.confirm(msg)) return;
                                                        try {
                                                            const r = await fetch(`${getApiUrl()}/api/session/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: selectedSession.session_id, force: true }) });
                                                            if (r.ok) { setSelectedTableId(null); fetchSessions(); }
                                                            else alert('오류가 발생했습니다.');
                                                        } catch { alert('오류가 발생했습니다.'); }
                                                    }} 
                                                    style={{ 
                                                        background: hasCookingOrder ? '#cbd5e1' : 'var(--accent)', 
                                                        border: 'none', 
                                                        color: hasCookingOrder ? '#64748b' : 'white', 
                                                        padding: '4px 6px', 
                                                        borderRadius: '4px', 
                                                        fontWeight: '700', 
                                                        fontSize: '0.68rem', 
                                                        cursor: hasCookingOrder ? 'not-allowed' : 'pointer', 
                                                        whiteSpace: 'nowrap',
                                                        opacity: hasCookingOrder ? 0.65 : 1
                                                    }}
                                                >
                                                    종료
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => {
                                                        setCardTouchCallback(() => async () => {
                                                            await handleCloseSession(selectedSession.session_id, true);
                                                            await resolvePendingCardCalls(selectedSession.session_id);
                                                        });
                                                        setShowCardTouchOverlay(true);
                                                    }} 
                                                    style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '4px', fontWeight: '700', fontSize: '0.68rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                >
                                                    전체결제
                                                </button>
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
                    onSubmit={async (method) => {
                        const active = selectedSessionForPay || (selectedOrderForPay ? sessions.find(s => s.orders?.some((o: any) => o.order_id === selectedOrderForPay.order_id)) : null);
                        const amount = selectedOrderForPay
                            ? (selectedOrderForPay.total_price ?? selectedOrderForPay.total ?? 0)
                            : (active?.orders || [])
                                .filter((o: any) => o.payment_status !== 'paid' && o.payment_status !== 'prepaid' && o.status !== 'paid')
                                .reduce((sum: number, o: any) => sum + (o.total_price ?? o.total ?? 0), 0);
                        const orderId = selectedOrderForPay?.order_id || (active ? `SESS-CLOSE-${active.session_id}` : `REF-${Date.now()}`);
                        const tableId = active?.table_id || '';

                        if (method === '폰 to 폰 결제') {
                            if (active) {
                                try {
                                    const res = await fetch(`${getApiUrl()}/api/payment/request-phone-to-phone`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            session_id: active.session_id,
                                            order_id: selectedOrderForPay?.order_id || null,
                                            amount: amount
                                        })
                                    });
                                    if (res.ok) {
                                        alert('📲 고객 휴대폰으로 폰 to 폰 원격 결제 요청을 전송했습니다. 고객이 휴대폰에서 최종 결제하면 이 화면도 자동으로 완료 갱신됩니다.');
                                        setSelectedSessionForPay(null);
                                        setSelectedOrderForPay(null);
                                    } else {
                                        alert('결제 요청 전송 실패: ' + await res.text());
                                    }
                                } catch (e) {
                                    alert('서버와 통신 중 오류가 발생했습니다.');
                                }
                            }
                            return;
                        }

                        const executePayment = async () => {
                            const sessionId = active?.session_id || null;
                            if (selectedOrderForPay) {
                                await handlePartialPayment(selectedOrderForPay.order_id);
                            } else if (selectedSessionForPay) {
                                await handleCloseSession(selectedSessionForPay.session_id);
                            }
                            if (sessionId) {
                                await resolvePendingCardCalls(sessionId);
                            }
                            if (vipPayerInfo && vipPayerInfo.topPercent <= 10) {
                                setVipFlashVisible(true);
                                setTimeout(() => { setVipFlashVisible(false); setVipPayerInfo(null); }, 3000);
                            } else {
                                setVipPayerInfo(null);
                            }
                        };

                        if (method.includes('실물카드')) {
                            setCardTouchAmount(amount);
                            setCardTouchOrderId(orderId);
                            setCardTouchTableId(tableId);
                            setCardTouchCallback(() => executePayment);
                            setShowCardTouchOverlay(true);
                        } else {
                            await executePayment();
                        }
                    }}
                    isCounter={true}
                />
            )}

            {/* ── 전역 애니메이션 (seat-blink는 App.css에 정의) ── */}
            <style>{`
                @keyframes vipFlash { from { opacity:1; transform:scale(1); } to { opacity:0.6; transform:scale(1.06); } }
                @keyframes pulse-mild { 0%,100% { box-shadow: none; } 50% { box-shadow: 0 0 8px currentColor; } }
                @keyframes pulse-pink {
                    0%, 100% { box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4); }
                    50% { box-shadow: 0 4px 22px rgba(236, 72, 153, 0.8), 0 0 8px rgba(236, 72, 153, 0.4); transform: scale(1.01); }
                }
            `}</style>

            {/* ── VIP 플래시 ── */}
            {vipFlashVisible && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ padding: '40px 60px', borderRadius: '24px', background: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '3px solid #f59e0b', boxShadow: '0 20px 60px rgba(245,158,11,0.4)', textAlign: 'center', animation: 'vipFlash 0.6s ease-in-out infinite alternate' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>👑</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#92400e', letterSpacing: '0.1em' }}>VIP</div>
                        <div style={{ fontSize: '1rem', color: '#b45309', fontWeight: 700, marginTop: '8px' }}>상위 {vipPayerInfo?.topPercent}% 단골 고객</div>
                    </div>
                </div>
            )}
            {showCardTouchOverlay && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 11000,
                    background: 'rgba(15, 23, 42, 0.95)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '30px'
                }}>
                    <div className="glass-card animate-fade-in" style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '24px',
                        padding: '40px 30px',
                        maxWidth: '380px',
                        width: '100%',
                        textAlign: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{ fontSize: '5rem', marginBottom: '20px', animation: 'cardTouchBlink 1.5s infinite alternate' }}>📲💳</div>
                        
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white', marginBottom: '12px' }}>실물카드 터치</h2>
                        <p style={{ fontSize: '0.92rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '30px' }}>
                            실물카드를 휴대폰 뒷면(NFC 영역)에<br/>
                            대고 잠시만 기다려 주세요.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {isMobile && (
                                <button 
                                    onClick={() => {
                                        const goodName = `${cardTouchTableId || '테이블'} 실물카드 결제`;
                                        const returnUri = encodeURIComponent(`${window.location.origin}/counter/payapp-callback?order_id=${cardTouchOrderId}`);
                                        const payappScheme = `payapp://request?reqType=CARD&goodPrice=${cardTouchAmount}&goodName=${encodeURIComponent(goodName)}&var1=${cardTouchOrderId}&returnUri=${returnUri}&smsuse=n`;
                                        
                                        const startTime = Date.now();
                                        window.location.href = payappScheme;
                                        
                                        setTimeout(() => {
                                            if (Date.now() - startTime < 1500) {
                                                window.location.href = "market://details?id=com.udid.payapp";
                                            }
                                        }, 1200);
                                    }}
                                    style={{
                                        width: '100%', padding: '16px', borderRadius: '14px',
                                        background: 'linear-gradient(135deg, #ec4899, #db2777)',
                                        color: 'white', border: 'none', fontWeight: 800,
                                        fontSize: '1.05rem', cursor: 'pointer',
                                        boxShadow: '0 8px 20px rgba(236, 72, 153, 0.3)',
                                        marginBottom: '6px'
                                    }}
                                >
                                    📲 페이앱 결제 실행 (태깅)
                                </button>
                            )}
                            <button 
                                onClick={async () => {
                                    setShowCardTouchOverlay(false);
                                    if (cardTouchCallback) {
                                        await cardTouchCallback();
                                        setCardTouchCallback(null);
                                    }
                                }}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: '14px',
                                    background: 'linear-gradient(135deg, #f97316, #ea580c)',
                                    color: 'white', border: 'none', fontWeight: 800,
                                    fontSize: '1.05rem', cursor: 'pointer',
                                    boxShadow: '0 8px 20px rgba(249, 115, 22, 0.3)'
                                }}
                             >
                                💳 결제 완료 처리 (수동 승인)
                            </button>
                            <button 
                                onClick={() => {
                                    setShowCardTouchOverlay(false);
                                    setCardTouchCallback(null);
                                }}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '12px',
                                    background: 'transparent', color: '#94a3b8',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer'
                                }}
                            >
                                취소
                            </button>
                        </div>
                    </div>
                    
                    <style>{`
                        @keyframes cardTouchBlink {
                            0% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 5px rgba(249,115,22,0.2)); }
                            100% { transform: translateY(-8px) scale(1.05); filter: drop-shadow(0 0 20px rgba(249,115,22,0.6)); }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
};
