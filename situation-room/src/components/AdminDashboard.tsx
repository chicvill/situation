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
        <div className="admin-page animate-fade-in" style={{ padding: '40px', background: 'var(--bg-main)', minHeight: '100vh' }}>
            <header className="page-header" style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>스토어 통합 현황</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>매장의 운영 데이터를 실시간으로 모니터링합니다.</p>
            </header>

            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', marginBottom: '40px' }}>
                <div className="stat-card" style={{ 
                    background: 'var(--surface)', padding: '30px', borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '20px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                }}>
                    <div className="stat-icon" style={{ fontSize: '2rem' }}>💰</div>
                    <div className="stat-info">
                        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '500', marginBottom: '4px' }}>오늘의 예상 매출</label>
                        <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '700', color: 'var(--accent)' }}>{todaySales.toLocaleString()}원</h3>
                    </div>
                </div>
                <div className="stat-card" style={{ 
                    background: 'var(--surface)', padding: '30px', borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '20px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                }}>
                    <div className="stat-icon" style={{ fontSize: '2rem' }}>📝</div>
                    <div className="stat-info">
                        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '500', marginBottom: '4px' }}>활성 주문건</label>
                        <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '700', color: 'var(--primary)' }}>{orderCount}건</h3>
                    </div>
                </div>
                <div className="stat-card" style={{ 
                    background: 'var(--surface)', padding: '30px', borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '20px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                }}>
                    <div className="stat-icon" style={{ fontSize: '2rem' }}>👥</div>
                    <div className="stat-info">
                        <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '500', marginBottom: '4px' }}>출근 직원</label>
                        <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '700', color: 'var(--primary)' }}>{employeeCount}명</h3>
                    </div>
                </div>
            </div>

            <section className="dashboard-content" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                <div className="list-section" style={{ background: 'var(--surface)', padding: '30px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 20px 0' }}>매장별 서비스 이용 현황</h3>
                    <div className="store-status-list">
                        {bundles.filter(b => b.type === 'StoreConfig').map(store => {
                            const name = store.items.find((i: any) => i.name === '상호명')?.value || '알 수 없는 매장';
                            const payStatus = store.items.find((i: any) => i.name === '납부상태')?.value || '정상';
                            return (
                                <div key={store.id} style={{ 
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                    padding: '15px 0', borderBottom: '1px solid var(--border)' 
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '1.2rem' }}>🏪</span>
                                        <strong style={{ fontWeight: '600' }}>{name}</strong>
                                    </div>
                                    <span style={{ 
                                        color: payStatus === '미납' ? 'var(--danger)' : 'var(--success)',
                                        fontWeight: '600',
                                        fontSize: '0.8rem',
                                        background: payStatus === '미납' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                                        padding: '4px 12px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: `1px solid ${payStatus === '미납' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}`
                                    }}>
                                        {payStatus === '미납' ? '납부 대기' : '정상 운영'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="list-section" style={{ background: 'var(--surface)', padding: '30px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 20px 0' }}>최근 시스템 로그</h3>
                    <div className="bundle-list-mini">
                        {bundles.slice(0, 5).map(b => (
                            <div key={b.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', width: '80px' }}>{b.timestamp.split('T')[1]?.split('.')[0] || b.timestamp}</span>
                                <span style={{ 
                                    fontSize: '0.7rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', 
                                    background: 'var(--primary-soft)', color: 'var(--text-muted)'
                                }}>{b.type}</span>
                                <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '500' }}>{b.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};
