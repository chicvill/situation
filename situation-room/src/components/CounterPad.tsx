import React, { useEffect, useState } from 'react';
import { PaymentModal } from './PaymentModal';
import { useStoreFilter } from '../hooks/useStoreFilter';
import { WS_BASE } from '../config';

interface CounterPadProps {
    storeId?: string; // 추가
}

export const CounterPad: React.FC<CounterPadProps> = ({ storeId: propStoreId }) => {
    const { storeId: filterStoreId } = useStoreFilter();
    const storeId = propStoreId || filterStoreId; // Prop을 우선 사용
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionForPay, setSelectedSessionForPay] = useState<any | null>(null);

    const fetchSessions = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
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
        };
        return () => ws.close();
    }, [storeId]);

    const handleStatusUpdate = async (orderId: string, status: string) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
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
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
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
                fetchSessions();
            }
        } catch (e) {
            console.error('Close Session Error:', e);
        }
    };

    const handleOpenSession = async (directTableId?: string) => {
        const tableToOpen = directTableId || targetTable;
        if (!tableToOpen) return;
        
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
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
                setTargetTable(""); // 초기화
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
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
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

    const [selectedTable, setSelectedTable] = useState<number>(1);
    const [targetTable, setTargetTable] = useState<string>("");
    const tables = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="counter-pad-premium" style={{ padding: '20px' }}>
            {/* 상단 테이블 개시 섹션 (풀다운 방식) */}
            <div style={{ 
                marginBottom: '30px', 
                padding: '25px', 
                background: 'rgba(30, 41, 59, 0.7)', 
                borderRadius: '24px', 
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', fontWeight: '900' }}>🏢 신규 세션 개시</h3>
                    <p style={{ margin: 0, opacity: 0.6, fontSize: '0.9rem' }}>고객 입장 및 좌석 배정 후 테이블을 선택해 주세요.</p>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select 
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(Number(e.target.value))}
                        style={{ 
                            background: '#1e293b', color: 'white', border: '1px solid #3b82f6', 
                            padding: '12px 20px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold',
                            outline: 'none', minWidth: '150px'
                        }}
                    >
                        {tables.map(num => {
                            const tableId = `T${String(num).padStart(2, '0')}`;
                            const isOccupied = sessions.some(s => s.table_id === tableId);
                            return (
                                <option key={num} value={num} disabled={isOccupied}>
                                    Table {num} {isOccupied ? '(이용 중)' : ''}
                                </option>
                            );
                        })}
                    </select>
                    
                    <button 
                        onClick={() => handleOpenSession(`T${String(selectedTable).padStart(2, '0')}`)}
                        style={{ 
                            background: '#3b82f6', color: 'white', border: 'none', 
                            padding: '12px 30px', borderRadius: '12px', fontSize: '1.1rem', 
                            fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 15px rgba(59,130,246,0.4)'
                        }}
                    >
                        세션 개시
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '1.5rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    📋 실시간 이용 현황 <span style={{ fontSize: '0.9rem', color: '#3b82f6' }}>{sessions.length}개 테이블</span>
                </h3>
            </div>

            {selectedSessionForPay && (
                <PaymentModal 
                    totalPrice={selectedSessionForPay.orders.reduce((sum: number, o: any) => sum + o.total_price, 0)}
                    onClose={() => setSelectedSessionForPay(null)}
                    onSubmit={() => handleCloseSession(selectedSessionForPay.session_id)}
                    isCounter={true}
                    tableNo={selectedSessionForPay.table_id}
                    orderNo={selectedSessionForPay.session_id.split('-')[1]}
                />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {(!Array.isArray(sessions) || sessions.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '100px 20px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '20px', color: '#94a3b8' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '15px' }}>✨</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>현재 활성화된 테이블 세션이 없습니다.</div>
                    </div>
                ) : (
                    Array.isArray(sessions) && sessions.map((session) => {
                        const sessionTotal = session.orders.reduce((sum: number, o: any) => sum + o.total_price, 0);
                        
                        return (
                            <div key={session.session_id} style={{ 
                                background: session.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(30, 41, 59, 0.5)', 
                                borderRadius: '24px', 
                                border: session.status === 'pending' ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                                padding: '20px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '15px',
                                boxShadow: session.status === 'pending' ? '0 0 20px rgba(245, 158, 11, 0.2)' : 'none'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <span style={{ fontSize: '1.8rem', fontWeight: '900', color: session.status === 'pending' ? '#f59e0b' : '#3b82f6' }}>
                                            TABLE {session.table_id}
                                        </span>
                                        {session.status === 'pending' && (
                                            <span style={{ 
                                                background: '#f59e0b', 
                                                color: 'white', 
                                                padding: '4px 12px', 
                                                borderRadius: '10px', 
                                                fontSize: '0.85rem', 
                                                fontWeight: 'bold',
                                                animation: 'pulse 2s infinite'
                                            }}>
                                                🔔 승인 대기
                                            </span>
                                        )}
                                        <span style={{ opacity: 0.5, fontSize: '0.9rem' }}>ID: {session.session_id}</span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.9rem', opacity: 0.5 }}>합계 금액</div>
                                        <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#10b981' }}>{sessionTotal.toLocaleString()}원</div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                                    {session.orders.map((order: any) => (
                                        <div key={order.order_id} style={{ 
                                            background: 'rgba(255,255,255,0.05)', 
                                            borderRadius: '16px', 
                                            padding: '15px',
                                            border: '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#94a3b8' }}>#{order.order_seq}차 주문</span>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <span style={{ 
                                                        fontSize: '0.75rem', 
                                                        background: order.payment_status === 'prepaid' ? '#EF4444' : 'rgba(255,255,255,0.1)',
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        fontWeight: 'bold',
                                                        color: 'white'
                                                    }}>
                                                        {order.payment_status === 'prepaid' ? '💳 선불완료' : '💰 후불'}
                                                    </span>
                                                    <span style={{ 
                                                        fontSize: '0.75rem', 
                                                        background: order.payment_status === 'prepaid' ? '#EF4444' : (order.status === 'served' ? '#10b981' : '#f59e0b'),
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {order.payment_status === 'prepaid' ? '결제완료' : (order.status === 'served' ? '서빙완료' : (order.status === 'ready' ? '🔔 조리완료' : '🔥 조리중'))}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#e2e8f0' }}>
                                                {order.items.map((i: any) => `${i.name} x${i.quantity || i.qty}`).join(', ')}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                                                <span style={{ fontWeight: '900', fontSize: '1.2rem', color: '#10b981' }}>{order.total_price.toLocaleString()}원</span>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button 
                                                        onClick={() => {
                                                            if(window.confirm('이 주문을 취소하시겠습니까?')) {
                                                                handleStatusUpdate(order.order_id, 'cancelled');
                                                            }
                                                        }}
                                                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 15px', borderRadius: '10px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}
                                                    >
                                                        주문취소
                                                    </button>
                                                    <button 
                                                        disabled={order.status !== 'ready'}
                                                        onClick={() => handleStatusUpdate(order.order_id, 'served')}
                                                        style={{ 
                                                            background: order.status === 'ready' ? '#3b82f6' : 'rgba(255,255,255,0.05)', 
                                                            border: 'none', 
                                                            color: order.status === 'ready' ? 'white' : 'rgba(255,255,255,0.3)', 
                                                            padding: '8px 25px', 
                                                            borderRadius: '10px', 
                                                            fontSize: '0.85rem', 
                                                            cursor: order.status === 'ready' ? 'pointer' : 'not-allowed',
                                                            fontWeight: 'bold',
                                                            boxShadow: order.status === 'ready' ? '0 4px 10px rgba(59,130,246,0.3)' : 'none'
                                                        }}
                                                    >
                                                        {order.status === 'served' ? '서빙완료' : '서빙하기'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: '15px', marginTop: '15px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px' }}>
                                    {session.status === 'pending' ? (
                                        <button 
                                            onClick={() => handleOpenSession(session.table_id)}
                                            style={{ background: '#f59e0b', border: 'none', color: 'white', padding: '15px 50px', borderRadius: '15px', fontWeight: '900', fontSize: '1.4rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(245,158,11,0.4)', animation: 'pulse 1.5s infinite' }}
                                        >
                                            ⚡ 지금 승인하기
                                        </button>
                                    ) : (
                                        <>
                                            <button 
                                                onClick={() => handleResetSession(session.session_id)}
                                                style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#ef4444', padding: '12px 25px', borderRadius: '15px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
                                            >
                                                세션 취소 (변심/장난)
                                            </button>
                                            <button 
                                                onClick={() => setSelectedSessionForPay(session)}
                                                style={{ background: '#10b981', border: 'none', color: 'white', padding: '12px 40px', borderRadius: '15px', fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }}
                                            >
                                                테이블 정산 및 결제
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
