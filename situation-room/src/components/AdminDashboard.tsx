import { useStoreFilter } from '../hooks/useStoreFilter';

export const AdminDashboard: React.FC<{ bundles: any[] }> = ({ bundles }) => {
    const { storeId } = useStoreFilter();
    const now = new Date();
    const todayStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

    const orderCount = bundles.filter(b => b.type === 'Orders' && b.status !== 'archived' && b.status !== 'canceled' && (storeId === 'Total' || b.store_id === storeId || !b.store_id)).length;
    const employeeCount = bundles.filter(b => b.type === 'Employee' && (storeId === 'Total' || b.store_id === storeId || !b.store_id)).length;
    const todaySales = bundles
        .filter(b => b.type === 'Orders' && b.timestamp.startsWith(todayStr) && b.status !== 'canceled' && (storeId === 'Total' || b.store_id === storeId || !b.store_id))
        .reduce((acc, b) => {
            const orderTotal = b.items.reduce((sum: number, item: any) => {
                // Find matching menu in knowledge pool to get its price
                const menuInfo = bundles
                    .filter(kb => kb.type === 'Menus' && (storeId === 'Total' || kb.store_id === storeId || !kb.store_id))
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

            <section className="dashboard-content" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="glass-panel list-section">
                    <h3>매장별 서비스 이용 현황</h3>
                    <div className="store-status-list" style={{ marginTop: '15px' }}>
                        {bundles.filter(b => b.type === 'StoreConfig').map(store => {
                            const name = store.items.find((i: any) => i.name === '상호명')?.value || '알 수 없는 매장';
                            const payStatus = store.items.find((i: any) => i.name === '납부상태')?.value || '정상';
                            return (
                                <div key={store.id} style={{ 
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                    padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)' 
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '20px' }}>🏪</span>
                                        <strong>{name}</strong>
                                    </div>
                                    <span style={{ 
                                        color: payStatus === '미납' ? '#ef4444' : '#10b981',
                                        fontWeight: 'bold',
                                        fontSize: '0.85rem',
                                        background: payStatus === '미납' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                        padding: '4px 12px',
                                        borderRadius: '20px'
                                    }}>
                                        {payStatus === '미납' ? '⚠️ 미납' : '✅ 이용 중'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

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
