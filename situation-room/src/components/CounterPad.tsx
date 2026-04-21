import React, { useMemo } from 'react';
import { SituationConsole } from './SituationConsole';
import type { BundleData } from '../types';

interface CounterPadProps {
    bundles: BundleData[];
    messages: any[];
    onSendMessage: (text: string, targetId?: string) => void;
}

export const CounterPad: React.FC<CounterPadProps> = ({ bundles, messages, onSendMessage }) => {
    const [selectedTableForPay, setSelectedTableForPay] = React.useState<string | null>(null);

    // 1. Calculate Stats
    const activeOrders = bundles.filter(b => b.type === 'Orders' && b.status !== 'archived');
    const menus = bundles.filter(b => b.type === 'Menus').flatMap(b => b.items);

    const tableOrders = useMemo(() => {
        const groups: { [key: string]: BundleData[] } = {};
        activeOrders.forEach(o => {
            const tableItem = o.items.find(i => i.name === '테이블');
            const table = tableItem ? tableItem.value : '기타/포장';
            if (!groups[table]) groups[table] = [];
            groups[table].push(o);
        });
        return groups;
    }, [activeOrders]);

    const calculateTableTotal = (tableName: string) => {
        const orders = tableOrders[tableName] || [];
        return orders.reduce((acc, order) => {
            const total = order.items.reduce((sum, item) => {
                const menu = menus.find(m => m.name.includes(item.name));
                const price = menu ? parseInt(menu.value.replace(/[^0-9]/g, '')) : 0;
                const qtyMatch = item.value.match(/\d+/);
                const qty = qtyMatch ? parseInt(qtyMatch[0]) : 1;
                return sum + (price * qty);
            }, 0);
            return acc + total;
        }, 0);
    };

    const handlePaymentComplete = (method: string) => {
        if (!selectedTableForPay) return;
        const total = calculateTableTotal(selectedTableForPay);
        onSendMessage(`${selectedTableForPay}번 테이블 ${method}로 ${total}원 결제 완료. 테이블 정리해줘.`);
        setSelectedTableForPay(null);
    };

    const todaySales = useMemo(() => {
        return activeOrders.reduce((acc, order) => {
            const total = order.items.reduce((sum, item) => {
                const menu = menus.find(m => m.name.includes(item.name));
                const price = menu ? parseInt(menu.value.replace(/[^0-9]/g, '')) : 0;
                const qtyMatch = item.value.match(/\d+/);
                const qty = qtyMatch ? parseInt(qtyMatch[0]) : 1;
                return sum + (price * qty);
            }, 0);
            return acc + total;
        }, 0);
    }, [activeOrders, menus]);

    return (
        <div className="counter-pad animate-fade-in">
            {/* Payment Modal */}
            {selectedTableForPay && (
                <div className="modal-overlay flex-center">
                    <div className="glass-panel payment-modal animate-pop-in">
                        <h2>💳 {selectedTableForPay}번 테이블 결제</h2>
                        <div className="receipt-content">
                            {tableOrders[selectedTableForPay]?.map(o => (
                                <div key={o.id} className="receipt-order">
                                    {o.items.map((item, idx) => item.name !== '테이블' && (
                                        <div key={idx} className="receipt-row">
                                            <span>{item.name}</span>
                                            <span>{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                            <div className="receipt-total">
                                <span>최종 결제 금액</span>
                                <h3>{calculateTableTotal(selectedTableForPay).toLocaleString()}원</h3>
                            </div>
                        </div>
                        <div className="payment-methods">
                            <button className="confirm-btn premium-orange" onClick={() => handlePaymentComplete('신용카드')}>💳 신용카드</button>
                            <button className="confirm-btn success-green" onClick={() => handlePaymentComplete('현금')}>💵 현금결제</button>
                            <button className="retry-btn" onClick={() => setSelectedTableForPay(null)}>닫기</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Insight Bar */}
            <header className="counter-header glass-panel">
                <div className="insight-item">
                    <label>💰 누적 매출</label>
                    <div className="value">{todaySales.toLocaleString()}원</div>
                </div>
                <div className="insight-item">
                    <label>🥘 활성 테이블</label>
                    <div className="value">{Object.keys(tableOrders).length}개</div>
                </div>
                <div className="insight-item">
                    <label>🛎️ 대기 중</label>
                    <div className="value">{bundles.filter(b => b.type === 'Waiting').length}팀</div>
                </div>
                <div className="insight-item">
                    <label>👥 출근 인원</label>
                    <div className="value">{bundles.filter(b => b.type === 'Attendance').length}명</div>
                </div>
                <div className="pad-clock">{new Date().toLocaleTimeString()}</div>
            </header>

            <div className="pad-body">
                {/* Main: Table Grid */}
                <div className="table-grid-area">
                    {Object.keys(tableOrders).length === 0 && (
                        <div className="glass-panel empty-msg flex-center">
                            <h2>✨ 현재 비어있는 테이블이 없습니다.</h2>
                            <p>주문이 들어오면 실시간으로 여기에 대시보드가 구성됩니다.</p>
                        </div>
                    )}
                    {Object.entries(tableOrders).map(([table, orders]) => (
                        <div key={table} className="table-card glass-panel animate-pop-in">
                            <div className="card-top">
                                <div className="table-info">
                                    <span className="table-no">No. {table}</span>
                                    <div className="table-balance">{calculateTableTotal(table).toLocaleString()}원</div>
                                </div>
                                <button className="set-btn" onClick={() => setSelectedTableForPay(table)}>정산</button>
                            </div>
                            <div className="order-content">
                                {orders.map(o => {
                                    const isCall = o.items.some(i => i.name === '호출');
                                    return (
                                        <div key={o.id} className={`order-bundle ${isCall ? 'call-alert pulse-red' : ''}`}>
                                            {isCall && <div className="alert-badge">🛎️ 호출 응대 요망</div>}
                                            {o.items.map((item, idx) => (
                                                item.name !== '테이블' && (
                                                    <div key={idx} className="order-row">
                                                        <span className="name">{item.name}</span>
                                                        <span className="val">{item.value}</span>
                                                    </div>
                                                )
                                            ))}
                                            <div className="order-meta">
                                                <span className="time">{o.timestamp}</span>
                                                <span className="status" data-status={o.status}>{o.status === 'ready' ? '조리완료' : '조리중'}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Sidebar: AI Command Center */}
                <aside className="pad-sidebar">
                    <div className="glass-panel console-container">
                        <h3>🔮 실시간 상황 AI 콘솔</h3>
                        <SituationConsole messages={messages} onSendMessage={onSendMessage} />
                    </div>
                </aside>
            </div>
        </div>
    );
};
