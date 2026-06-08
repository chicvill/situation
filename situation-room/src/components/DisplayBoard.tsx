import React, { useMemo, useEffect, useState } from 'react';
import { useStoreFilter } from '../hooks/useStoreFilter';
import type { BundleData } from '../types';

interface DisplayBoardProps {
    bundles: BundleData[];
}

function parseUtcTimestamp(ts: string): Date {
    if (!ts) return new Date();
    return new Date(ts); // Z 있으면 UTC, 없으면 로컬 시간으로 해석
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getElapsedMinutes(date: Date, nowTime: number): number {
    return Math.floor((nowTime - date.getTime()) / 60000);
}

export const DisplayBoard: React.FC<DisplayBoardProps> = ({ bundles }) => {
    const { storeId } = useStoreFilter();
    const [now, setNow] = useState(Date.now());
    const [padMode, setPadMode] = useState(() => localStorage.getItem('displayPadMode') === 'true');

    const togglePadMode = () => {
        setPadMode(prev => {
            const next = !prev;
            localStorage.setItem('displayPadMode', next.toString());
            return next;
        });
    };

    // 1분마다 경과시간 갱신
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(t);
    }, []);

    const readyOrders = useMemo(() => {
        return bundles
            .filter(b => b.type === 'Orders' && b.status === 'ready' && (storeId === 'Total' || b.store_id === storeId || !b.store_id))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp)); // 오래된 순 (먼저 나온 것 위)
    }, [bundles, storeId]);

    const getTableLabel = (order: BundleData) => {
        if (order.table && order.table !== 'null') {
            return order.table === '포장' ? '포장' : `${order.table}번`;
        }
        const titleMatch = order.title.match(/테이블\s*(\d+)/) || order.title.match(/Table\s*(\d+)/i);
        if (titleMatch) return `${titleMatch[1]}번`;
        if (order.title.includes('포장')) return '포장';
        const tableItem = order.items?.find(i => i.name === '테이블' || i.name === 'table');
        if (tableItem) return `${tableItem.value}번`;
        return '-';
    };

    const isTakeout = (order: BundleData) => getTableLabel(order) === '포장';

    const getMenuItems = (order: BundleData) => {
        return (order.items || []).filter(item => {
            const lowerName = item.name.toLowerCase();
            const excluded = ['결제수단', '테이블', 'table', 'brand', '상호명', '납부상태', '대표자', '사업자번호', '주소', 'payment', 'session_id', 'store_id', 'device_id'];
            if (excluded.some(kw => lowerName.includes(kw))) return false;
            if ((lowerName === '메뉴' || lowerName === 'menu') && item.value.includes('디지털 주문')) return false;
            return true;
        });
    };

    return (
        <div className="db-root" style={{ zoom: padMode ? 1.35 : 1 } as React.CSSProperties}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&family=Noto+Sans+KR:wght@400;700;900&display=swap');

                .db-root {
                    font-family: 'Outfit', 'Noto Sans KR', sans-serif;
                    min-height: 100vh;
                    background: radial-gradient(circle at 50% 30%, #080711 0%, #020105 100%);
                    position: relative;
                    overflow-x: hidden;
                }
                .db-root::before {
                    content: '';
                    position: fixed;
                    inset: 0;
                    background-image:
                        linear-gradient(to right, rgba(0,242,254,0.018) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(0,242,254,0.018) 1px, transparent 1px);
                    background-size: 50px 50px;
                    pointer-events: none;
                    z-index: 0;
                }

                /* ── 헤더 ── */
                .db-header {
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 28px;
                    background: rgba(8,7,17,0.85);
                    backdrop-filter: blur(14px);
                    border-bottom: 1px solid rgba(0,242,254,0.1);
                }
                .db-header-title {
                    font-size: 1.25rem;
                    font-weight: 900;
                    background: linear-gradient(135deg,#00f2fe,#4facfe);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    letter-spacing: 1px;
                }
                .db-header-sub {
                    color: rgba(255,255,255,0.4);
                    font-size: 0.85rem;
                    font-weight: 500;
                }
                .db-header-count {
                    background: rgba(0,242,254,0.1);
                    border: 1px solid rgba(0,242,254,0.25);
                    color: #00f2fe;
                    padding: 4px 14px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 700;
                }

                /* ── 그리드 ── */
                .db-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 20px;
                    padding: 24px 20px 40px;
                    max-width: 1440px;
                    margin: 0 auto;
                    position: relative;
                    z-index: 1;
                }

                /* ── 카드 ── */
                .db-card {
                    background: rgba(13,11,26,0.75);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(0,242,254,0.12);
                    border-radius: 24px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
                }
                .db-card:hover {
                    transform: translateY(-4px);
                    border-color: rgba(0,242,254,0.35);
                    box-shadow: 0 16px 40px rgba(0,242,254,0.12);
                }
                .db-card.takeout {
                    border-color: rgba(249,115,22,0.14);
                }
                .db-card.takeout:hover {
                    border-color: rgba(249,115,22,0.4);
                    box-shadow: 0 16px 40px rgba(249,115,22,0.12);
                }
                .db-card.urgent {
                    border-color: rgba(239,68,68,0.3);
                    animation: urgent-pulse 2s ease-in-out infinite;
                }
                @keyframes urgent-pulse {
                    0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
                    50%      { box-shadow: 0 0 0 6px rgba(239,68,68,0.12); }
                }

                /* ── 카드 헤더 ── */
                .db-card-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 18px 20px 14px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .db-table-label {
                    display: flex;
                    align-items: baseline;
                    gap: 6px;
                }
                .db-table-icon { font-size: 1rem; }
                .db-table-word {
                    font-size: 0.9rem;
                    color: rgba(255,255,255,0.45);
                    font-weight: 600;
                }
                .db-table-num {
                    font-size: 2rem;
                    font-weight: 900;
                    color: #ffffff;
                    letter-spacing: -0.5px;
                    line-height: 1;
                }
                .db-table-unit {
                    font-size: 0.9rem;
                    color: rgba(255,255,255,0.5);
                    font-weight: 600;
                    align-self: flex-end;
                    margin-bottom: 3px;
                }
                .db-order-badge {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 3px;
                }
                .db-order-num {
                    font-size: 1.5rem;
                    font-weight: 900;
                    color: rgba(0,242,254,0.85);
                    letter-spacing: 1px;
                    line-height: 1;
                }
                .db-order-num.takeout-num { color: rgba(249,115,22,0.85); }
                .db-order-label {
                    font-size: 0.65rem;
                    color: rgba(255,255,255,0.3);
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                /* ── 메뉴 목록 ── */
                .db-items {
                    flex: 1;
                    padding: 14px 20px;
                    overflow-y: auto;
                    max-height: 200px;
                }
                .db-items::-webkit-scrollbar { width: 3px; }
                .db-items::-webkit-scrollbar-thumb {
                    background: rgba(0,242,254,0.2);
                    border-radius: 2px;
                }
                .db-item-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 9px 12px;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.025);
                    margin-bottom: 6px;
                    border: 1px solid rgba(255,255,255,0.04);
                }
                .db-item-name {
                    color: rgba(255,255,255,0.88);
                    font-weight: 600;
                    font-size: 0.95rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    padding-right: 10px;
                }
                .db-item-qty {
                    background: linear-gradient(135deg,rgba(0,242,254,0.1),rgba(157,78,223,0.1));
                    border: 1px solid rgba(0,242,254,0.28);
                    color: #00f2fe;
                    padding: 2px 10px;
                    border-radius: 16px;
                    font-size: 0.82rem;
                    font-weight: 800;
                    flex-shrink: 0;
                }
                .db-item-qty.takeout-qty {
                    background: linear-gradient(135deg,rgba(249,115,22,0.1),rgba(236,72,153,0.1));
                    border-color: rgba(249,115,22,0.28);
                    color: #f97316;
                }

                /* ── 카드 푸터 ── */
                .db-card-footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 20px 14px;
                    border-top: 1px solid rgba(255,255,255,0.04);
                }
                .db-ready-dot {
                    display: inline-block;
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: #10b981;
                    box-shadow: 0 0 0 0 rgba(16,185,129,0.7);
                    animation: dot-pulse 1.5s infinite;
                    margin-right: 7px;
                    vertical-align: middle;
                    flex-shrink: 0;
                }
                .db-ready-dot.takeout-dot {
                    background: #f97316;
                    box-shadow: 0 0 0 0 rgba(249,115,22,0.7);
                    animation: dot-pulse-orange 1.5s infinite;
                }
                @keyframes dot-pulse {
                    0%   { transform:scale(.95); box-shadow:0 0 0 0 rgba(16,185,129,.7); }
                    70%  { transform:scale(1);   box-shadow:0 0 0 8px rgba(16,185,129,0); }
                    100% { transform:scale(.95); box-shadow:0 0 0 0 rgba(16,185,129,0); }
                }
                @keyframes dot-pulse-orange {
                    0%   { transform:scale(.95); box-shadow:0 0 0 0 rgba(249,115,22,.7); }
                    70%  { transform:scale(1);   box-shadow:0 0 0 8px rgba(249,115,22,0); }
                    100% { transform:scale(.95); box-shadow:0 0 0 0 rgba(249,115,22,0); }
                }
                .db-status-text {
                    font-size: 0.78rem;
                    font-weight: 700;
                    color: #10b981;
                    vertical-align: middle;
                }
                .db-status-text.takeout-text { color: #f97316; }
                .db-elapsed {
                    font-size: 0.78rem;
                    color: rgba(255,255,255,0.35);
                    font-weight: 600;
                }
                .db-elapsed.warn { color: #f59e0b; }
                .db-elapsed.urgent { color: #ef4444; font-weight: 700; }

                /* ── 빈 상태 ── */
                .db-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 60vh;
                    color: rgba(255,255,255,0.4);
                    text-align: center;
                    padding: 40px;
                    position: relative;
                    z-index: 1;
                }
                .db-empty-icon {
                    font-size: 4rem;
                    margin-bottom: 20px;
                    filter: drop-shadow(0 0 16px rgba(0,242,254,0.2));
                    animation: float 3s ease-in-out infinite;
                }
                @keyframes float {
                    0%,100% { transform: translateY(0); }
                    50%     { transform: translateY(-10px); }
                }
                .db-empty-title {
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: rgba(255,255,255,0.6);
                    margin-bottom: 10px;
                }
                .db-empty-sub {
                    font-size: 0.95rem;
                    color: rgba(255,255,255,0.3);
                    line-height: 1.6;
                }
            `}</style>

            {/* ── 헤더 ── */}
            <div className="db-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div>
                        <div className="db-header-title">📢 음식이 준비되었습니다</div>
                        <div className="db-header-sub">테이블 번호를 확인 후 가져가 주세요</div>
                    </div>
                    <button onClick={togglePadMode} style={{ background: padMode ? '#00f2fe' : 'transparent', border: '1px solid #00f2fe', color: padMode ? '#080711' : '#00f2fe', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', marginLeft: '12px' }}>
                        {padMode ? 'PAD 화면' : 'HP 화면'}
                    </button>
                </div>
                <div className="db-header-count">
                    {readyOrders.length > 0 ? `${readyOrders.length}건 대기` : '대기 없음'}
                </div>
            </div>

            {readyOrders.length > 0 ? (
                <div className="db-grid">
                    {readyOrders.map(order => {
                        const takeout = isTakeout(order);
                        const menuItems = getMenuItems(order);
                        const tableLabel = getTableLabel(order);
                        const tableNum = tableLabel.replace(/번$/, '');
                        const isTakeoutOrder = tableLabel === '포장';
                        const displayCode = order.order_code
                            ? `No.${order.order_code}`
                            : order.id.replace(/^ORD-/, '').substring(0, 5);

                        const orderDate = parseUtcTimestamp(order.timestamp);
                        const timeStr = formatTime(orderDate);
                        const elapsed = Math.max(0, getElapsedMinutes(orderDate, now));
                        const isUrgent = elapsed >= 15;
                        const isWarn = elapsed >= 8;

                        return (
                            <div
                                key={order.id}
                                className={`db-card${takeout ? ' takeout' : ''}${isUrgent ? ' urgent' : ''}`}
                            >
                                {/* 카드 헤더: 테이블 번호 + 주문 번호 */}
                                <div className="db-card-header">
                                    <div className="db-table-label">
                                        <span className="db-table-icon">{isTakeoutOrder ? '🛍️' : '🪑'}</span>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                            {isTakeoutOrder ? (
                                                <span className="db-table-num" style={{ fontSize: '1.6rem' }}>포장</span>
                                            ) : (
                                                <>
                                                    <span className="db-table-word">테이블</span>
                                                    <span className="db-table-num">{tableNum}</span>
                                                    <span className="db-table-unit">번</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="db-order-badge">
                                        <span className={`db-order-num${takeout ? ' takeout-num' : ''}`}>
                                            {displayCode}
                                        </span>
                                        <span className="db-order-label">주문번호</span>
                                    </div>
                                </div>

                                {/* 메뉴 목록 */}
                                <div className="db-items">
                                    {menuItems.length > 0 ? menuItems.map((item, idx) => (
                                        <div key={idx} className="db-item-row">
                                            <span className="db-item-name">{item.name}</span>
                                            <span className={`db-item-qty${takeout ? ' takeout-qty' : ''}`}>
                                                ×{item.value}
                                            </span>
                                        </div>
                                    )) : (
                                        <div style={{ textAlign: 'center', padding: '16px 0', color: 'rgba(255,255,255,0.25)', fontSize: '0.9rem' }}>
                                            상세 항목 없음
                                        </div>
                                    )}
                                </div>

                                {/* 푸터: 상태 + 경과시간 */}
                                <div className="db-card-footer">
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span className={`db-ready-dot${takeout ? ' takeout-dot' : ''}`} />
                                        <span className={`db-status-text${takeout ? ' takeout-text' : ''}`}>
                                            조리 완료
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem' }}>{timeStr}</span>
                                        <span className={`db-elapsed${isUrgent ? ' urgent' : isWarn ? ' warn' : ''}`}>
                                            {elapsed < 1 ? '방금' : `${elapsed}분 경과`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="db-empty">
                    <div className="db-empty-icon">👨‍🍳</div>
                    <div className="db-empty-title">주방에서 열심히 조리 중</div>
                    <div className="db-empty-sub">
                        준비된 음식이 생기면 이 화면에 안내됩니다
                    </div>
                </div>
            )}
        </div>
    );
};
