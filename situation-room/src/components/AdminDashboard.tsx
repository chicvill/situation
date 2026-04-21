import React from 'react';

export const AdminDashboard: React.FC<{ bundles: any[] }> = ({ bundles }) => {
    const orderCount = bundles.filter(b => b.type === 'Orders').length;
    const employeeCount = bundles.filter(b => b.type === 'Employee').length;
    const todaySales = bundles
        .filter(b => b.type === 'Orders')
        .reduce((acc, b) => {
            const orderTotal = b.items.reduce((sum: number, item: any) => {
                // Find matching menu in knowledge pool to get its price
                const menuInfo = bundles
                    .filter(kb => kb.type === 'Menus')
                    .flatMap(kb => kb.items)
                    .find(ki => ki.name.includes(item.name));
                
                const price = menuInfo ? parseInt(menuInfo.value.replace(/[^0-9]/g, '')) : 0;
                const qtyMatch = item.value.match(/\d+/);
                const qty = qtyMatch ? parseInt(qtyMatch[0]) : 1;
                return sum + (price * qty);
            }, 0);
            return acc + orderTotal;
        }, 0);

    return (
        <div className="admin-page animate-fade-in">
            <header className="page-header">
                <h2>📊 스토어 통합 현황</h2>
                <p>매장의 모든 지식 풀 데이터를 실시간으로 모니터링합니다.</p>
            </header>

            <div className="stats-grid">
                <div className="glass-panel stat-card">
                    <div className="stat-icon">💰</div>
                    <div className="stat-info">
                        <label>오늘의 예상 매출</label>
                        <h3>{todaySales.toLocaleString()}원</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div className="stat-icon">📝</div>
                    <div className="stat-info">
                        <label>활성 주문건</label>
                        <h3>{orderCount}건</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-info">
                        <label>출근 직원</label>
                        <h3>{employeeCount}명</h3>
                    </div>
                </div>
            </div>

            <section className="dashboard-content">
                <div className="glass-panel list-section">
                    <h3>최근 발생 상황 (지식 풀)</h3>
                    <div className="bundle-list-mini">
                        {bundles.slice(0, 5).map(b => (
                            <div key={b.id} className="mini-bundle-item">
                                <span className="timestamp">{b.timestamp}</span>
                                <span className="type-badge" data-type={b.type}>{b.type}</span>
                                <span className="title">{b.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};
