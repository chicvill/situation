import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { BundleData } from '../types';
import { API_BASE } from '../config';
import { subscribeTopic } from '../services/mqttClient';
import { useStoreFilter } from '../hooks/useStoreFilter';
import { playDingDong } from '../utils/audio';

// 타임스탬프 파싱: 'Z'/'+' 있으면 UTC, 없으면 로컬 시간으로 처리
function parseTimestamp(ts: string): Date {
    if (!ts) return new Date(0);
    return new Date(ts); // Z 없으면 브라우저가 로컬 시간으로 해석 (올바른 동작)
}

// 5분마다 1단계, 총 10단계: 초록 → 노랑 → 빨강
const STAGE_COLORS = [
    '#16a34a', // 0단계 (0~4분)   진초록
    '#22c55e', // 1단계 (5~9분)   초록
    '#65a30d', // 2단계 (10~14분) 연두
    '#ca8a04', // 3단계 (15~19분) 황록
    '#eab308', // 4단계 (20~24분) 노랑
    '#f59e0b', // 5단계 (25~29분) 황색
    '#f97316', // 6단계 (30~34분) 주황
    '#ea580c', // 7단계 (35~39분) 진주황
    '#ef4444', // 8단계 (40~44분) 빨강
    '#b91c1c', // 9단계 (45분+)   진빨강
];

function buttonColor(diffMins: number): string {
    return STAGE_COLORS[Math.min(Math.floor(diffMins / 5), 9)];
}

export const KitchenDisplay: React.FC = () => {
    const { storeId } = useStoreFilter();
    const [bundles, setBundles] = useState<BundleData[]>([]);
    const [now, setNow]         = useState(Date.now());
    const prevCountRef          = useRef(0);
    const [seatRequests, setSeatRequests] = useState<{ table_id: string; store_id: string; timestamp: string }[]>([]);

    // 1분마다 경과시간·버튼색 갱신
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(t);
    }, []);

    const playDing = useCallback(() => { playDingDong(0.4); }, []);

    const fetchKitchenOrders = useCallback(async () => {
        try {
            const res  = await fetch(`${API_BASE}/api/kitchen/orders?store_id=${storeId || 'Total'}&t=${Date.now()}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                if (data.length > prevCountRef.current) playDing();
                prevCountRef.current = data.length;
                setBundles(data);
            } else {
                prevCountRef.current = 0;
                setBundles([]);
            }
        } catch (e) {
            console.error('Kitchen Fetch Error:', e);
        }
    }, [storeId, playDing]);

    const fetchSeatRequests = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/seat-requests?store_id=${storeId || 'Total'}&t=${Date.now()}`);
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data)) {
                setSeatRequests(prev => {
                    const added = data.filter(r => !prev.some(p => p.table_id === r.table_id));
                    if (added.length > 0) playDing();
                    return data;
                });
            }
        } catch (e) {
            console.error('Seat Requests Fetch Error:', e);
        }
    }, [storeId, playDing]);

    const handleOpenSession = useCallback(async (directTableId: string) => {
        try {
            const targetStoreId = (!storeId || storeId === 'Total') ? 'default_store' : storeId;
            const res = await fetch(`${API_BASE}/api/session/open`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: targetStoreId, table_id: directTableId })
            });
            if (res.ok) {
                setSeatRequests(prev => prev.filter(r => r.table_id !== directTableId));
                fetchKitchenOrders();
                fetchSeatRequests();
            } else {
                alert(`세션 승인 실패: ${await res.text()}`);
            }
        } catch {
            alert('서버와 통신 중 오류가 발생했습니다.');
        }
    }, [storeId, fetchKitchenOrders, fetchSeatRequests]);

    useEffect(() => {
        fetchKitchenOrders();
        fetchSeatRequests();
        const refreshTypes = ['NEW_ORDER', 'STATUS_UPDATE', 'PAYMENT_CONFIRMED', 'STAFF_CALL', 'PARKING_APPLIED', 'WAITING_REGISTERED'];
        const handler = (data: any) => {
            if (data.type === 'SEAT_REQUEST') {
                setSeatRequests(prev => {
                    if (prev.some(r => r.table_id === data.table_id)) return prev;
                    playDing();
                    return [...prev, { table_id: data.table_id, store_id: data.store_id || '', timestamp: data.timestamp || new Date().toISOString() }];
                });
                return;
            }
            if (data.type === 'SESSION_OPENED') {
                setSeatRequests(prev => prev.filter(r => r.table_id !== data.session?.table_id));
                fetchKitchenOrders();
                fetchSeatRequests();
                return;
            }
            if (data.type === 'SESSION_CLOSED') {
                fetchKitchenOrders();
                fetchSeatRequests();
                return;
            }
            if (refreshTypes.includes(data.type)) { playDing(); fetchKitchenOrders(); }
        };
        const topic   = (storeId && storeId !== 'Total') ? `store/${storeId}` : 'store/+';
        const unsub1  = subscribeTopic(topic, handler);
        const unsub2  = topic !== 'store/+' ? subscribeTopic('store/broadcast', handler) : null;
        const poll    = setInterval(() => { fetchKitchenOrders(); fetchSeatRequests(); }, 3000);
        return () => { unsub1(); unsub2?.(); clearInterval(poll); };
    }, [storeId, fetchKitchenOrders, fetchSeatRequests, playDing]);

    const markAsDone = useCallback(async (orderId: string) => {
        setBundles(prev => prev.map(b => (b as any).order_id === orderId ? { ...b, status: 'ready' } : b));
        try {
            const res = await fetch(`${API_BASE}/api/order/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, status: 'ready' })
            });
            if (!res.ok) throw new Error('Update failed');
            fetchKitchenOrders();
        } catch {
            fetchKitchenOrders();
        }
    }, [fetchKitchenOrders]);

    const grouped = useMemo(() => {
        return bundles.reduce((acc, order: any) => {
            const key = order.session_id || 'no-session';
            if (!acc[key]) acc[key] = { table: order.table_id || '미지정', orders: [] };
            acc[key].orders.push(order);
            return acc;
        }, {} as Record<string, { table: string; orders: any[] }>);
    }, [bundles]);

    return (
        <div style={{ padding: '24px 20px', background: 'var(--bg-main)', minHeight: '100vh' }}>
            <style>{`
                .kd-header-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 28px;
                }
                .kd-title {
                    font-size: 1.6rem;
                    font-weight: 800;
                    color: var(--text-main);
                    margin: 0;
                }
                .kd-count-badge {
                    background: var(--surface);
                    padding: 7px 18px;
                    border-radius: 20px;
                    border: 1px solid var(--border);
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--text-muted);
                }
                .kd-count-badge strong { color: var(--accent); }

                .kd-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
                    gap: 24px;
                }

                /* ── 테이블 카드 ── */
                .kd-card {
                    background: var(--surface);
                    border-radius: var(--radius-md);
                    border: 1px solid var(--border);
                    overflow: hidden;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.04);
                }

                /* 테이블 헤더: 작고 조용하게 */
                .kd-table-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 16px;
                    background: var(--primary);
                    color: white;
                }
                .kd-table-name {
                    font-size: 0.85rem;
                    font-weight: 700;
                    opacity: 0.92;
                    letter-spacing: 0.5px;
                }
                .kd-table-count {
                    font-size: 0.75rem;
                    opacity: 0.7;
                    font-weight: 600;
                }

                /* 주문 블록 */
                .kd-order-block {
                    padding: 18px 16px 16px;
                    border-bottom: 1px solid var(--border);
                }
                .kd-order-block:last-child { border-bottom: none; }

                /* 메뉴 아이템 — 주인공 */
                .kd-items-list { margin-bottom: 14px; }
                .kd-item-row {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    padding: 5px 0;
                }
                .kd-item-name {
                    font-size: 1.3rem;
                    font-weight: 800;
                    color: var(--text-main);
                    line-height: 1.2;
                    flex: 1;
                    padding-right: 8px;
                }
                .kd-item-qty {
                    font-size: 1.3rem;
                    font-weight: 900;
                    color: var(--accent);
                    white-space: nowrap;
                }

                /* 메타 정보 — 작게 */
                .kd-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                .kd-order-seq {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }
                .kd-delayed-badge {
                    background: var(--danger);
                    color: white;
                    font-size: 0.62rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                }
                .kd-join-badge {
                    background: #e0e7ff;
                    color: #4338ca;
                    font-size: 0.62rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 800;
                }
                .kd-elapsed {
                    margin-left: auto;
                    font-size: 0.78rem;
                    font-weight: 700;
                }

                /* 조리 완료 버튼 */
                .kd-done-btn {
                    width: 100%;
                    padding: 15px;
                    border: none;
                    border-radius: var(--radius-sm);
                    color: white;
                    font-size: 1rem;
                    font-weight: 800;
                    cursor: pointer;
                    letter-spacing: 0.5px;
                    transition: filter 0.2s ease, transform 0.1s ease;
                }
                .kd-done-btn:hover  { filter: brightness(1.08); }
                .kd-done-btn:active { transform: scale(0.98); }

                /* 빈 상태 */
                .kd-empty {
                    grid-column: 1/-1;
                    text-align: center;
                    padding: 80px 40px;
                    opacity: 0.45;
                }
            `}</style>

            <div className="kd-header-bar">
                <h1 className="kd-title">주방 모니터</h1>
                <div className="kd-count-badge">
                    대기 중인 주문 <strong>{bundles.length}</strong>
                </div>
            </div>

            {/* ── 좌석 승인 요청 배너 ── */}
            {seatRequests.length > 0 && (
                <div style={{
                    padding: '10px 16px',
                    background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
                    border: '2px solid #f97316',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                    boxShadow: '0 4px 12px rgba(249,115,22,0.08)'
                }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#c2410c', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                        🔔 좌석 승인 요청 ({seatRequests.length}건)
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {seatRequests.map(req => (
                            <div key={req.table_id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'white',
                                border: '1px solid #fed7aa',
                                borderRadius: '8px',
                                padding: '4px 12px'
                            }}>
                                <span style={{ fontWeight: '800', fontSize: '0.9rem', color: '#ea580c' }}>
                                    테이블 {req.table_id.replace(/^T/, '')}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: '#9a3412', fontWeight: 600 }}>
                                    {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <button
                                    onClick={() => handleOpenSession(req.table_id)}
                                    style={{
                                        background: '#f97316',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '4px 10px',
                                        fontWeight: '800',
                                        fontSize: '0.78rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 4px rgba(249,115,22,0.2)',
                                        transition: 'all 0.1s'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                                    onMouseOut={e => e.currentTarget.style.filter = 'none'}
                                >
                                    승인
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="kd-grid">
                {Object.entries(grouped).map(([sessionId, group]) => {
                    const isTakeout = group.table === '포장';
                    const tableLabel = isTakeout ? '🛍 포장' : `TABLE ${group.table}`;

                    return (
                        <div key={sessionId} className="kd-card">
                            {/* 테이블 헤더 — 작게 */}
                            <div className="kd-table-header"
                                style={{ background: isTakeout ? 'var(--warning)' : 'var(--primary)' }}>
                                <span className="kd-table-name">{tableLabel}</span>
                                <span className="kd-table-count">{group.orders.length} ORDERS</span>
                            </div>

                            {/* 주문 목록 */}
                            {group.orders
                                .sort((a, b) => (a.order_seq || 0) - (b.order_seq || 0))
                                .map(order => {
                                    const orderDate = parseTimestamp(order.timestamp);
                                    const diffMins  = Math.max(0, Math.floor((now - orderDate.getTime()) / 60000));
                                    const isLate    = diffMins >= 10;
                                    const color     = buttonColor(diffMins);

                                    return (
                                        <div key={order.order_id} className="kd-order-block">
                                            {/* 메뉴 아이템 — 주인공 */}
                                            <div className="kd-items-list">
                                                {(order.items || []).map((item: any, idx: number) => (
                                                    <div key={idx} className="kd-item-row">
                                                        <span className="kd-item-name">{item.name}</span>
                                                        <span className="kd-item-qty">×{item.quantity || item.qty || 1}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* 메타 정보 — 작게 */}
                                            <div className="kd-meta">
                                                <span className="kd-order-seq">ORDER #{order.order_seq || 1}</span>
                                                {isLate && <span className="kd-delayed-badge">DELAYED</span>}
                                                <span className="kd-elapsed"
                                                    style={{ color: diffMins >= 15 ? 'var(--danger)' : diffMins >= 8 ? 'var(--warning)' : 'var(--success)' }}>
                                                    {diffMins}분 경과
                                                </span>
                                            </div>

                                            {/* 조리 완료 버튼 — 5분마다 색 변화 */}
                                            <button
                                                className="kd-done-btn"
                                                style={{ background: color }}
                                                onClick={() => markAsDone(order.order_id)}
                                            >
                                                조리 완료
                                            </button>
                                        </div>
                                    );
                                })}
                        </div>
                    );
                })}

                {bundles.length === 0 && (
                    <div className="kd-empty">
                        <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>😴</div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                            대기 중인 주문이 없습니다
                        </h2>
                    </div>
                )}
            </div>
        </div>
    );
};
