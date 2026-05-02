import React, { useState, useEffect } from 'react';
import { useStoreFilter } from '../hooks/useStoreFilter';

export const AdminDashboard: React.FC<{ bundles: any[] }> = ({ bundles }) => {
    const { storeId } = useStoreFilter();
    const [aiMessage, setAiMessage] = useState("매장 현황을 분석 중입니다...");
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

    useEffect(() => {
        const brief = `사장님, 현재 활성 주문은 ${orderCount}건이며, 오늘 예상 매출은 ${todaySales.toLocaleString()}원입니다. ${orderCount > 0 ? '주문창으로 이동해서 조리 현황을 체크하시겠어요?' : '현재 대기 중인 주문은 없습니다.'}`;
        setAiMessage(brief);
        
        // 음성 브리핑 (TTS)
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(brief);
            utterance.lang = 'ko-KR';
            window.speechSynthesis.speak(utterance);
        }
    }, [orderCount, todaySales]);

    return (
        <div className="admin-page animate-fade-in" style={{ padding: '40px', background: 'var(--bg-main)', minHeight: '100vh' }}>
            {/* AI Agent Briefing Bar */}
            <div className="ai-agent-bar" style={{ 
                background: '#f0f9ff', border: '1px solid #bae6fd', padding: '20px 25px', 
                borderRadius: '16px', marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '20px',
                boxShadow: '0 4px 15px rgba(186, 230, 253, 0.2)'
            }}>
                <div style={{ fontSize: '2.5rem' }}>🤖</div>
                <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0369a1', fontWeight: '800', marginBottom: '4px' }}>AI 오퍼레이터 브리핑</h4>
                    <p style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: '600', lineHeight: 1.5 }}>
                        {aiMessage}
                    </p>
                </div>
                <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'order' }))}
                    style={{ 
                        background: '#0ea5e9', color: 'white', border: 'none', padding: '10px 20px', 
                        borderRadius: '8px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                >
                    주문창 이동
                </button>
            </div>

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
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', width: '70px', fontWeight: '500' }}>{b.timestamp.split('T')[1]?.split('.')[0] || 'Recently'}</span>
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
