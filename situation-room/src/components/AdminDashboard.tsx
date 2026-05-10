import { useState } from 'react';
import { useStoreFilter } from '../hooks/useStoreFilter';

export const AdminDashboard = ({ bundles, storeDetails }: { bundles: any[], storeDetails?: any }) => {
    const { storeId } = useStoreFilter();
    const [showBanner, setShowBanner] = useState(true);
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
                
                const price = menuInfo
                    ? (typeof menuInfo.value === 'number'
                        ? menuInfo.value
                        : (parseInt(String(menuInfo.value || '').replace(/[^0-9]/g, '')) || 0))
                    : 0;
                const qtyMatch = String(item.value || '').match(/\d+/);
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

            {storeDetails && showBanner && (
                <div 
                    onClick={() => setShowBanner(false)}
                    title="터치하면 이 알림 배너가 닫힙니다"
                    style={{
                        background: storeDetails.payment_status === '연체' 
                            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04))' 
                            : storeDetails.payment_status === '미납' 
                                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))' 
                                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))',
                        border: `1.5px dashed ${
                            storeDetails.payment_status === '연체' 
                                ? '#ef4444' 
                                : storeDetails.payment_status === '미납' 
                                    ? '#f59e0b' 
                                    : '#10b981'
                        }`,
                        borderRadius: '16px',
                        padding: '16px 20px',
                        marginBottom: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        fontSize: '0.9rem',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.04)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.07)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.04)';
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
                        <span style={{ fontSize: '1.4rem' }}>
                            {storeDetails.payment_status === '연체' ? '🚨' : storeDetails.payment_status === '미납' ? '⚠️' : '🎁'}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)' }}>
                                {storeDetails.payment_status === '연체' 
                                    ? '[플랫폼 가입요금 연체 안내]' 
                                    : storeDetails.payment_status === '미납'
                                        ? '[플랫폼 정산 대기 상태 알림]'
                                        : '🎁 1개월 무료 체험 혜택 이용 중!'
                                }
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {storeDetails.payment_status === '연체' 
                                    ? '플랫폼 이용료 정산이 지연되고 있습니다. 서비스 제한 예정 대기 중이오니 납부 조치를 진행해 주세요.'
                                    : storeDetails.payment_status === '미납'
                                        ? '미납된 월 가맹요금이 수납대기 중입니다. 관리자 계좌 정보를 확인하고 입금을 진행해 주세요.'
                                        : `현재 본 식당은 프리미엄 스마트 오더 상용 모드를 무료로 체험하고 계십니다! (다음 납부 예정일: ${
                                            (() => {
                                                const regDateStr = storeDetails.created_at || storeDetails.timestamp;
                                                const regDate = regDateStr ? new Date(regDateStr) : new Date();
                                                const nextPay = new Date(regDate.setMonth(regDate.getMonth() + 1));
                                                return `${nextPay.getFullYear()}년 ${String(nextPay.getMonth() + 1).padStart(2, '0')}월 ${String(nextPay.getDate()).padStart(2, '0')}일`;
                                            })()
                                        })`
                                }
                            </span>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                            background: storeDetails.payment_status === '연체' ? '#ef4444' : storeDetails.payment_status === '미납' ? '#f59e0b' : '#10b981',
                            color: 'white',
                            padding: '6px 14px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                        }}>
                            {storeDetails.payment_status === '연체' 
                                ? '서비스 제한 대기' 
                                : storeDetails.payment_status === '미납' 
                                    ? '수납 필요' 
                                    : (() => {
                                        const regDateStr = storeDetails.created_at || storeDetails.timestamp;
                                        const regDate = regDateStr ? new Date(regDateStr) : new Date();
                                        const nextPay = new Date(regDate.setMonth(regDate.getMonth() + 1));
                                        const diffTime = nextPay.getTime() - new Date().getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        return `체험 종료 D-${diffDays > 0 ? diffDays : 0}`;
                                    })()
                            }
                        </div>
                        <div style={{
                            fontSize: '1.1rem',
                            color: 'var(--text-muted)',
                            fontWeight: 'bold',
                            background: 'rgba(0,0,0,0.04)',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }} title="닫기">
                            ✕
                        </div>
                    </div>
                </div>
            )}

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

            <section className="dashboard-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
                <div className="list-section" style={{ background: 'var(--surface)', padding: '30px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📊</span> 매장별 운영 현황
                    </h3>
                    <div className="store-status-list">
                        {bundles.filter(b => b.type === 'StoreConfig').map(store => {
                            const name = store.items.find((i: any) => i.name === '상호명')?.value || '알 수 없는 매장';
                            const payStatus = store.items.find((i: any) => i.name === '납부상태')?.value || '정상';
                            const isHealthy = payStatus !== '미납';
                            
                            return (
                                <div key={store.id} style={{ padding: '20px 0', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <strong style={{ fontWeight: '700', fontSize: '1.05rem' }}>{name}</strong>
                                        </div>
                                        <span style={{ 
                                            color: isHealthy ? 'var(--success)' : 'var(--danger)',
                                            fontWeight: '700', fontSize: '0.75rem',
                                            padding: '4px 10px', borderRadius: '4px',
                                            background: isHealthy ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                            textTransform: 'uppercase'
                                        }}>
                                            {isHealthy ? 'Healthy' : 'Payment Due'}
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: 'var(--primary-soft)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: isHealthy ? '100%' : '30%', height: '100%', background: isHealthy ? 'var(--success)' : 'var(--danger)', transition: 'width 1s ease-out' }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="list-section" style={{ background: 'var(--surface)', padding: '30px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>🔔</span> 시스템 타임라인
                    </h3>
                    <div className="bundle-list-mini">
                        {bundles.slice(0, 7).map(b => (
                            <div key={b.id} style={{ padding: '15px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', width: '70px', fontWeight: '500' }}>{b.timestamp?.split('T')[1]?.split('.')[0] || b.timestamp || 'Recently'}</span>
                                <span style={{ 
                                    fontSize: '0.65rem', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', 
                                    background: 'var(--primary)', color: 'white', letterSpacing: '0.5px'
                                }}>{b.type.toUpperCase()}</span>
                                <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};
