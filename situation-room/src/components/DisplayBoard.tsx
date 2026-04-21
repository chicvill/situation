import React from 'react';

export const DisplayBoard: React.FC<{ bundles: any[] }> = ({ bundles }) => {
    const orders = bundles.filter(b => b.type === 'Orders');
    const cooking = orders.filter(o => o.status === 'cooking' || !o.status);
    const ready = orders.filter(o => o.status === 'ready');

    return (
        <div className="display-board-screen flex-center animate-fade-in">
            <header className="display-header">
                <h1>NOW SERVING</h1>
                <div className="live-pill">LIVE</div>
            </header>

            <div className="display-grid">
                <div className="display-section ready-section">
                    <h2 className="section-title">🔔 CALL (수령하세요)</h2>
                    <div className="number-grid">
                        {ready.map(o => {
                            const orderNum = o.items.find((i: any) => i.name === '주문번호')?.value || 'New';
                            return <div key={o.id} className="order-number ready-number pulse-large">{orderNum}</div>;
                        })}
                        {ready.length === 0 && <div className="empty-msg">서빙 준비 중입니다.</div>}
                    </div>
                </div>

                <div className="display-separator"></div>

                <div className="display-section cooking-section">
                    <h2 className="section-title">👨‍🍳 PREPARING (준비 중)</h2>
                    <div className="number-grid">
                        {cooking.map(o => {
                            const orderNum = o.items.find((i: any) => i.name === '주문번호')?.value || 'New';
                            return <div key={o.id} className="order-number cooking-number">{orderNum}</div>;
                        })}
                        {cooking.length === 0 && <div className="empty-msg">주문 대기 중...</div>}
                    </div>
                </div>
            </div>

            <footer className="display-footer">
                <p>주문번호가 표시되면 음식을 수령해 주세요. 감사합니다!</p>
            </footer>
        </div>
    );
};
