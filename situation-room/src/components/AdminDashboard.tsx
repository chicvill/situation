import { useState, useEffect, useMemo } from 'react';
import { useStoreFilter } from '../hooks/useStoreFilter';
import { API_BASE } from '../config';

export const AdminDashboard = ({ 
    bundles, 
    storeDetails, 
    user, 
    activeTab 
}: { 
    bundles: any[], 
    storeDetails?: any, 
    user?: any, 
    activeTab?: string 
}) => {
    const { storeId } = useStoreFilter();
    const [showBanner, setShowBanner] = useState(true);
    const [showTimeline, setShowTimeline] = useState(false);
    
    // Statistics States
    const [period, setPeriod] = useState<string>("daily");
    const [storeStats, setStoreStats] = useState<any>(null);
    const [adminStats, setAdminStats] = useState<any>(null);
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
    const [selectedDow, setSelectedDow] = useState<number>(() => {
        const today = new Date().getDay();
        return today === 0 ? 7 : today;
    });

    const now = new Date();
    const todayStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

    // Standard Store Admin Statistics (Preserved original count calculations)
    const orderCount = bundles.filter(b => b.type === 'Orders' && b.status !== 'archived' && b.status !== 'canceled' && (storeId === 'Total' || b.store_id === storeId || !b.store_id)).length;
    const employeeCount = bundles.filter(b => b.type === 'Employee' && (storeId === 'Total' || b.store_id === storeId || !b.store_id)).length;
    const todaySales = bundles
        .filter(b => b.type === 'Orders' && b.timestamp?.startsWith(todayStr) && b.status !== 'canceled' && (storeId === 'Total' || b.store_id === storeId || !b.store_id))
        .reduce((acc, b) => {
            const orderTotal = (b.items || []).reduce((sum: number, item: any) => {
                const menuInfo = bundles
                    .filter(kb => kb.type === 'Menus' && (storeId === 'Total' || kb.store_id === storeId || !kb.store_id))
                    .flatMap(kb => kb.items || [])
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

    // 1. Fetch Store stats (daily/weekly/monthly trends & menu rankings)
    useEffect(() => {
        if (activeTab === 'stats') {
            const storeIdVal = storeId || user?.storeId || 'store-1';
            setLoading(true);
            fetch(`${API_BASE}/api/stats/store/${storeIdVal}?period=${period}`)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to load statistics");
                    return res.json();
                })
                .then(data => {
                    setStoreStats(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching store stats:", err);
                    setLoading(false);
                });
        }
    }, [activeTab, user, period, storeId]);

    // 2. Fetch Admin stats (monthly store sales comparisons)
    useEffect(() => {
        if (activeTab === 'admin' && user && user.role === 'admin') {
            setLoading(true);
            fetch(`${API_BASE}/api/stats/admin`)
                .then(res => {
                    if (!res.ok) throw new Error("Failed to load statistics");
                    return res.json();
                })
                .then(data => {
                    setAdminStats(data);
                    if (data.monthlyStoreSales) {
                        const months = Object.keys(data.monthlyStoreSales).sort().reverse();
                        if (months.length > 0) {
                            setSelectedMonth(months[0]);
                        }
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching admin stats:", err);
                    setLoading(false);
                });
        }
    }, [activeTab, user]);

    // ==========================================
    // CUSTOM SVG LINE CHART CALCULATION
    // ==========================================
    const svgChart = useMemo(() => {
        if (!storeStats || !storeStats.trend || storeStats.trend.length === 0) return null;
        
        const trend = storeStats.trend;
        const N = trend.length;
        const width = 640;
        const height = 280;
        const padding = { top: 30, right: 30, bottom: 50, left: 75 };
        
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        const maxAmount = Math.max(...trend.map((t: any) => t.amount), 0);
        // Round up to clean scale
        const maxVal = maxAmount > 0 ? Math.ceil(maxAmount * 1.15 / 50000) * 50000 : 100000;
        
        const getX = (index: number) => {
            if (N <= 1) return padding.left + chartWidth / 2;
            return padding.left + (index * chartWidth) / (N - 1);
        };
        
        const getY = (amount: number) => {
            return padding.top + chartHeight - (amount * chartHeight) / maxVal;
        };
        
        // Generate straight line path d & area path d
        let pathD = "";
        let areaD = "";
        
        if (N > 0) {
            pathD = trend.map((t: any, i: number) => 
                `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(t.amount)}`
            ).join(' ');
            
            areaD = `${pathD} L ${getX(N - 1)} ${padding.top + chartHeight} L ${getX(0)} ${padding.top + chartHeight} Z`;
        }
        
        // Generate Y-axis grid values (4 intervals)
        const gridLines = [];
        for (let i = 0; i <= 4; i++) {
            const val = (maxVal / 4) * i;
            gridLines.push({
                y: getY(val),
                label: `${(val / 10000).toLocaleString()}만`,
                value: val
            });
        }

        // Generate X-axis labels (max 6 labels to prevent cluttering)
        const xLabels = [];
        const labelInterval = Math.max(1, Math.ceil(N / 6));
        for (let i = 0; i < N; i += labelInterval) {
            xLabels.push({
                x: getX(i),
                text: trend[i].label.substring(5) // Remove YYYY-
            });
        }
        // Always include the last one if it was missed
        if ((N - 1) % labelInterval !== 0 && N > 1) {
            xLabels.push({
                x: getX(N - 1),
                text: trend[N - 1].label.substring(5)
            });
        }
        
        return {
            width,
            height,
            padding,
            getX,
            getY,
            pathD,
            areaD,
            gridLines,
            xLabels,
            maxVal,
            trend
        };
    }, [storeStats]);

    // Render Case 1: Existing Store list management (activeTab === 'admin')
    if (activeTab === 'admin') {
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

                <div className="stats-grid">
                    <div className="stat-card glass-panel">
                        <div className="stat-icon" style={{ background: 'var(--accent-orange-light)' }}>💰</div>
                        <div className="stat-info">
                            <label>오늘의 예상 매출</label>
                            <h3 style={{ color: 'var(--accent-orange)' }}>{todaySales.toLocaleString()}원</h3>
                        </div>
                    </div>
                    <div className="stat-card glass-panel">
                        <div className="stat-icon" style={{ background: 'var(--accent-light)' }}>📝</div>
                        <div className="stat-info">
                            <label>활성 주문건</label>
                            <h3>{orderCount}건</h3>
                        </div>
                    </div>
                    <div className="stat-card glass-panel">
                        <div className="stat-icon" style={{ background: 'var(--success-light)' }}>👥</div>
                        <div className="stat-info">
                            <label>등록 직원</label>
                            <h3>{employeeCount}명</h3>
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
                                const name = store.items?.find((i: any) => i.name === '상호명')?.value || '알 수 없는 매장';
                                const payStatus = store.items?.find((i: any) => i.name === '납부상태')?.value || '정상';
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', cursor: 'pointer' }} onClick={() => setShowTimeline(!showTimeline)}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span>🔔</span> 시스템 타임라인
                            </h3>
                            <button style={{
                                background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px',
                                padding: '4px 10px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s'
                            }}>
                                {showTimeline ? '접기 ▴' : '확인하기 ▾'}
                            </button>
                        </div>
                        {showTimeline && (
                            <div className="bundle-list-mini animate-fade-in">
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
                        )}
                        {!showTimeline && (
                            <div style={{ padding: '15px 0', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-main)', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setShowTimeline(true)}>
                                💡 타임라인 이력을 보려면 클릭하거나 우측 [확인하기] 버튼을 누르세요.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        );
    }

    // Render Case 2: Statistics Views (activeTab === 'stats')
    const isHQStatsMode = activeTab === 'admin';

    return (
        <div className="admin-page animate-fade-in" style={{ padding: '30px 16px', background: '#090d16', minHeight: '100vh', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <header className="page-header" style={{ marginBottom: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                    <h2 style={{ fontSize: '1.9rem', fontWeight: '900', color: '#fff', margin: 0, letterSpacing: '-0.5px', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        📊 {isHQStatsMode ? '시스템 통계 분석 (관리자)' : `${storeDetails?.name || user?.storeName || '매장'} 통계 분석 (점장)`}
                    </h2>
                    <p style={{ color: '#94a3b8', marginTop: '6px', fontSize: '0.95rem' }}>
                        {isHQStatsMode 
                            ? '전체 가맹점의 통합 월별 매출 실적을 다각도로 분석합니다.' 
                            : '매장의 상세 매출 추이 및 메뉴별 판매 성과를 분석하고 인사이트를 획득합니다.'}
                    </p>
                </div>
                
                {/* Period segment selectors for Owner Stats */}
                {!isHQStatsMode && (
                    <div style={{ display: 'inline-flex', padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}>
                        {['daily', 'weekly', 'monthly'].map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    background: period === p ? '#f97316' : 'transparent',
                                    color: period === p ? '#fff' : '#94a3b8',
                                    boxShadow: period === p ? '0 4px 12px rgba(249, 115, 22, 0.3)' : 'none'
                                }}
                            >
                                {p === 'daily' ? '일간' : p === 'weekly' ? '주간' : '월간'}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            {loading ? (
                // LOADING SCREEN
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '15px' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid rgba(249,115,22,0.1)', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>데이터 분석 중...</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            ) : isHQStatsMode ? (
                // ==========================================
                // ADMINISTRATOR STATISTICS SCREEN
                // ==========================================
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    {/* Control Card */}
                    <div style={{ background: 'rgba(30, 41, 59, 0.45)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.5rem' }}>🗓️</span>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>조회 월 선택</label>
                                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>비교 분석할 월을 지정하십시오.</span>
                            </div>
                        </div>
                        
                        <select 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            style={{
                                padding: '12px 20px',
                                background: '#1e293b',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#fff',
                                borderRadius: '12px',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                        >
                            {adminStats && adminStats.monthlyStoreSales && 
                                Object.keys(adminStats.monthlyStoreSales).sort().reverse().map(m => (
                                    <option key={m} value={m}>{m.substring(0, 4)}년 {m.substring(5)}월</option>
                                ))
                            }
                        </select>
                    </div>

                    {/* Chart Card */}
                    <div style={{ background: 'rgba(30, 41, 59, 0.3)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '35px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 30px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: '#6366f1' }}>▌</span> 매장별 월 총매출액 실적 비교 ({selectedMonth ? `${selectedMonth.substring(0, 4)}년 ${selectedMonth.substring(5)}월` : ''})
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {(() => {
                                if (!adminStats || !adminStats.monthlyStoreSales || !selectedMonth) {
                                    return <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>선택 가능한 데이터가 없습니다.</p>;
                                }
                                const monthData = adminStats.monthlyStoreSales[selectedMonth] || [];
                                if (monthData.length === 0) {
                                    return <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>해당 월에 매출 실적이 없습니다.</p>;
                                }

                                const maxAmount = Math.max(...monthData.map((d: any) => d.amount), 1);
                                
                                return monthData.map((d: any, idx: number) => {
                                    const percent = (d.amount / maxAmount) * 100;
                                    return (
                                        <div key={d.store_id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ 
                                                        width: '24px', height: '24px', 
                                                        borderRadius: '50%', background: idx === 0 ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
                                                        color: idx === 0 ? '#818cf8' : '#94a3b8',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.75rem', fontWeight: 800
                                                    }}>
                                                        {idx + 1}
                                                    </span>
                                                    <strong style={{ color: '#fff', fontWeight: 700 }}>{d.store_name}</strong>
                                                </div>
                                                <span style={{ color: '#818cf8', fontWeight: 800 }}>
                                                    {d.amount.toLocaleString()}원
                                                </span>
                                            </div>
                                            
                                            {/* Bar capsule */}
                                            <div style={{ width: '100%', height: '26px', background: 'rgba(255,255,255,0.03)', borderRadius: '13px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <div style={{ 
                                                    width: `${percent}%`, 
                                                    height: '100%', 
                                                    background: 'linear-gradient(to right, #6366f1, #a855f7)',
                                                    borderRadius: '13px', 
                                                    transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.2), 0 0 15px rgba(99, 102, 241, 0.4)',
                                                    position: 'relative',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    paddingRight: '12px',
                                                    justifyContent: 'flex-end'
                                                }}>
                                                    {percent > 15 && (
                                                        <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 900, opacity: 0.9 }}>
                                                            {percent.toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            ) : (
                // ==========================================
                // STORE MANAGER STATISTICS SCREEN
                // ==========================================
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
                    {/* Line Chart Grid - 꺾은선 매출 추이 */}
                    <div style={{ background: 'rgba(30, 41, 59, 0.3)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 25px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: '#f97316' }}>▌</span> 매출합계액 추이
                        </h3>
                        
                        {svgChart ? (
                            <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
                                <svg 
                                    viewBox={`0 0 ${svgChart.width} ${svgChart.height}`} 
                                    width="100%" 
                                    height="auto" 
                                    style={{ display: 'block', width: '100%' }}
                                >
                                    <defs>
                                        {/* Glowing line shadow */}
                                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#f97316" floodOpacity="0.3" />
                                        </filter>
                                        {/* Linear gradient below line */}
                                        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                                            <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                                        </linearGradient>
                                    </defs>

                                    {/* Grid Lines & Y Axis Labels */}
                                    {svgChart.gridLines.map((line, idx) => (
                                        <g key={idx}>
                                            <line 
                                                x1={svgChart.padding.left} 
                                                y1={line.y} 
                                                x2={svgChart.width - svgChart.padding.right} 
                                                y2={line.y} 
                                                stroke="rgba(255,255,255,0.05)" 
                                                strokeDasharray="4 4"
                                                strokeWidth="1"
                                            />
                                            <text 
                                                x={svgChart.padding.left - 12} 
                                                y={line.y + 4} 
                                                fill="#94a3b8" 
                                                fontSize="11" 
                                                fontWeight="600"
                                                textAnchor="end"
                                            >
                                                {line.label}
                                            </text>
                                        </g>
                                    ))}

                                    {/* Gradient Area Below Line */}
                                    {svgChart.areaD && (
                                        <path d={svgChart.areaD} fill="url(#area-grad)" />
                                    )}

                                    {/* Main Line */}
                                    {svgChart.pathD && (
                                        <path 
                                            d={svgChart.pathD} 
                                            fill="none" 
                                            stroke="#f97316" 
                                            strokeWidth="3.5" 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round"
                                            filter="url(#glow)"
                                        />
                                    )}

                                    {/* Circles at data points with mouse interactions */}
                                    {svgChart.trend.map((pt: any, idx: number) => {
                                        const cx = svgChart.getX(idx);
                                        const cy = svgChart.getY(pt.amount);
                                        const isHovered = hoveredPoint === idx;
                                        
                                        return (
                                            <g key={idx}>
                                                {/* Hidden large catch area for easier hovering */}
                                                <circle 
                                                    cx={cx} 
                                                    cy={cy} 
                                                    r="14" 
                                                    fill="transparent" 
                                                    style={{ cursor: 'pointer' }}
                                                    onMouseEnter={() => setHoveredPoint(idx)}
                                                    onMouseLeave={() => setHoveredPoint(null)}
                                                />
                                                {/* Visible styled point */}
                                                <circle 
                                                    cx={cx} 
                                                    cy={cy} 
                                                    r={isHovered ? "7" : "4.5"} 
                                                    fill={isHovered ? "#fff" : "#f97316"} 
                                                    stroke="#090d16" 
                                                    strokeWidth={isHovered ? "3.5" : "2"}
                                                    style={{ pointerEvents: 'none', transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)' }}
                                                />
                                            </g>
                                        );
                                    })}

                                    {/* X Axis Labels */}
                                    {svgChart.xLabels.map((lbl, idx) => (
                                        <text 
                                            key={idx} 
                                            x={lbl.x} 
                                            y={svgChart.height - svgChart.padding.bottom + 22} 
                                            fill="#94a3b8" 
                                            fontSize="11" 
                                            fontWeight="600"
                                            textAnchor="middle"
                                        >
                                            {lbl.text}
                                        </text>
                                    ))}
                                </svg>
                                
                                {/* Dynamic Interactive Tooltip */}
                                {hoveredPoint !== null && svgChart.trend[hoveredPoint] && (() => {
                                    const pt = svgChart.trend[hoveredPoint];
                                    // Map SVG coords to container percent relative coords
                                    const totalWidth = svgChart.width;
                                    const pctX = (svgChart.getX(hoveredPoint) / totalWidth) * 100;
                                    const cy = svgChart.getY(pt.amount);
                                    
                                    return (
                                        <div style={{
                                            position: 'absolute',
                                            left: `${pctX}%`,
                                            top: `${cy - 12}px`,
                                            transform: 'translate(-50%, -100%)',
                                            background: 'rgba(15, 23, 42, 0.95)',
                                            border: '1.5px solid rgba(249, 115, 22, 0.4)',
                                            backdropFilter: 'blur(8px)',
                                            padding: '10px 14px',
                                            borderRadius: '12px',
                                            color: '#fff',
                                            pointerEvents: 'none',
                                            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4), 0 0 15px rgba(249, 115, 22, 0.15)',
                                            zIndex: 10,
                                            fontSize: '0.8rem',
                                            whiteSpace: 'nowrap',
                                            transition: 'left 0.1s ease-out, top 0.1s ease-out'
                                        }}>
                                            <div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, marginBottom: '3px' }}>{pt.label}</div>
                                            <div style={{ fontWeight: 900, color: '#f97316', fontSize: '0.95rem' }}>{pt.amount.toLocaleString()}원</div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '50px 0' }}>매출 추이 데이터를 불러오는 중이거나 데이터가 존재하지 않습니다.</p>
                        )}
                    </div>

                    {/* DOW & Menu Ingredient Plan Grid (Stacked Vertically for Perfect Mobile Fitting) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
                        {/* 요일별 매출 분석 & 직원 확보 가이드 */}
                        <div style={{ background: 'rgba(30, 41, 59, 0.3)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 25px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: '#818cf8' }}>▌</span> 요일별 매출 분석 & 직원 확보 가이드
                            </h3>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                                {(() => {
                                    const dowSalesRaw = storeStats?.dowSales || [];
                                    const totalDowRevenue = dowSalesRaw.reduce((acc: number, item: any) => acc + (item.amount || 0), 0);
                                    
                                    const dowList = [1, 2, 3, 4, 5, 6, 7].map(d => {
                                        const match = dowSalesRaw.find((item: any) => item.dow === d);
                                        return {
                                            dow: d,
                                            name: ["", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"][d],
                                            shortName: ["", "월", "화", "수", "목", "금", "토", "일"][d],
                                            amount: match ? match.amount : 0,
                                            count: match ? match.count : 0,
                                            percent: totalDowRevenue > 0 ? ((match ? match.amount : 0) / totalDowRevenue) * 100 : 0
                                        };
                                    });

                                    const busiestDay = [...dowList].sort((a, b) => b.amount - a.amount)[0];
                                    const weekdayAvg = dowList.filter(d => d.dow <= 4).reduce((acc, d) => acc + d.amount, 0) / 4;
                                    const ratio = weekdayAvg > 0 ? (busiestDay.amount / weekdayAvg).toFixed(1) : "0";

                                    if (dowSalesRaw.length === 0) {
                                        return <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0', margin: 0 }}>집계된 요일별 데이터가 없습니다.</p>;
                                    }

                                    return (
                                        <>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                                {dowList.map((d) => (
                                                    <div key={d.dow} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <span style={{ width: '42px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700 }}>{d.name}</span>
                                                        <div style={{ flex: 1, height: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '7px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                                                            <div style={{ 
                                                                width: `${d.percent}%`, 
                                                                height: '100%', 
                                                                background: d.dow === busiestDay.dow ? 'linear-gradient(to right, #f97316, #ec4899)' : 'linear-gradient(to right, #6366f1, #818cf8)',
                                                                borderRadius: '7px',
                                                                boxShadow: d.dow === busiestDay.dow ? '0 0 10px rgba(249, 115, 22, 0.4)' : 'none',
                                                                transition: 'width 1s ease-out'
                                                            }} />
                                                        </div>
                                                        <div style={{ width: '110px', textAlign: 'right', fontSize: '0.82rem' }}>
                                                            <span style={{ color: '#fff', fontWeight: 700 }}>{d.amount.toLocaleString()}원</span>
                                                            <span style={{ color: '#94a3b8', fontSize: '0.72rem', marginLeft: '6px' }}>({d.percent.toFixed(0)}%)</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Staffing Advice Card */}
                                            <div style={{
                                                background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.03) 100%)',
                                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                                borderRadius: '16px',
                                                padding: '16px 20px',
                                                marginTop: 'auto'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '1.2rem' }}>💡</span>
                                                    <strong style={{ color: '#c084fc', fontSize: '0.92rem', fontWeight: 800 }}>AI 인력 배치 최적화 제언</strong>
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                                                    {busiestDay && busiestDay.amount > 0 ? (
                                                        <>
                                                            요일별 분석 결과, 매장이 가장 바쁜 요일은 <strong style={{ color: '#f97316' }}>{busiestDay.name}</strong>입니다. 
                                                            해당 요일의 평균 매출은 주중(월~목) 평균 대비 <strong style={{ color: '#f97316' }}>{ratio}배</strong> 높습니다. 
                                                            <br />
                                                            <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>➔ 직원확보 가이드:</span> 스태프 피로 경감과 고객 대기 지연 방지를 위해, {busiestDay.name}에는 주중 평균 대비 <strong style={{ color: '#fca5a5' }}>교대근무 인력을 추가 배치</strong>하거나 파트타임 직원을 유연하게 가동할 것을 강력히 권장합니다.
                                                        </>
                                                    ) : (
                                                        "충분한 누적 매출 데이터가 확보되면, 요일별 바쁜 시기를 인공지능이 분석하여 최적의 직원 확보 계획을 추천해 드립니다."
                                                    )}
                                                </p>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* 메뉴별/요일별 통계 & 식자재 확보 계획 */}
                        <div style={{ background: 'rgba(30, 41, 59, 0.3)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 25px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: '#f43f5e' }}>▌</span> 요일별 메뉴 통계 & 식자재 계획
                            </h3>

                            {/* DOW Selector Tabs */}
                            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '22px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                {[1, 2, 3, 4, 5, 6, 7].map(d => (
                                    <button 
                                        key={d} 
                                        onClick={() => setSelectedDow(d)}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontWeight: 800,
                                            fontSize: '0.8rem',
                                            background: selectedDow === d ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255,255,255,0.03)',
                                            color: selectedDow === d ? '#f43f5e' : '#94a3b8',
                                            outline: `1.5px solid ${selectedDow === d ? 'rgba(244, 63, 94, 0.5)' : 'rgba(255,255,255,0.06)'}`,
                                            transition: 'all 0.2s',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {["", "월", "화", "수", "목", "금", "토", "일"][d]}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                                {(() => {
                                    const menuDowSalesRaw = storeStats?.menuDowSales || [];
                                    const selectedDowSales = menuDowSalesRaw.filter((m: any) => m.dow === selectedDow);
                                    
                                    if (selectedDowSales.length === 0) {
                                        return <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0', margin: 0 }}>해당 요일의 메뉴 판매 데이터가 존재하지 않습니다.</p>;
                                    }

                                    const maxQty = Math.max(...selectedDowSales.map((m: any) => m.qty), 1);
                                    const topMenu = selectedDowSales[0];

                                    const prevDowNum = selectedDow === 1 ? 7 : selectedDow - 1;
                                    const prevDowName = ["", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"][prevDowNum];
                                    const curDowName = ["", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"][selectedDow];

                                    return (
                                        <>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {selectedDowSales.slice(0, 5).map((m: any, idx: number) => {
                                                    const percent = (m.qty / maxQty) * 100;
                                                    return (
                                                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                                                <span style={{ color: '#fff', fontWeight: 700 }}>
                                                                    {idx + 1}. {m.menu_name}
                                                                </span>
                                                                <span style={{ color: '#f43f5e', fontWeight: 800 }}>
                                                                    {m.qty}개 판매 ({m.amount.toLocaleString()}원)
                                                                </span>
                                                            </div>
                                                            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', overflow: 'hidden' }}>
                                                                <div style={{ 
                                                                    width: `${percent}%`, 
                                                                    height: '100%', 
                                                                    background: 'linear-gradient(to right, #f43f5e, #fda4af)', 
                                                                    borderRadius: '4px',
                                                                    transition: 'width 1s ease-out'
                                                                }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Ingredient Advice Card */}
                                            <div style={{
                                                background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(249,115,22,0.03) 100%)',
                                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                                borderRadius: '16px',
                                                padding: '16px 20px',
                                                marginTop: 'auto'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '1.2rem' }}>📦</span>
                                                    <strong style={{ color: '#fca5a5', fontSize: '0.92rem', fontWeight: 800 }}>AI 식자재 선확보 가이드</strong>
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                                                    {topMenu ? (
                                                        <>
                                                            매주 <strong style={{ color: '#fff' }}>{curDowName}</strong>에는 인기 메뉴인 <strong style={{ color: '#fca5a5' }}>{topMenu.menu_name}</strong>(이)가 총 <strong style={{ color: '#fca5a5' }}>{topMenu.qty}개</strong> 판매되어 재고 소모량이 집중됩니다.
                                                            <br />
                                                            <span style={{ color: '#fca5a5', fontWeight: 'bold' }}>➔ 식자재 계획 가이드:</span> 품절로 인한 매출 손실을 사전에 차단하기 위해, 하루 전인 <strong style={{ color: '#fda4af' }}>{prevDowName}</strong> 오후까지 핵심 식재료(돈육, 육수, 신선 채소 등) 비축분을 평소보다 <strong style={{ color: '#fca5a5' }}>45% 이상 여유 있게 선조달</strong>해 놓으시는 것을 추천합니다.
                                                        </>
                                                    ) : (
                                                        "해당 요일의 메뉴 통계 분석 자료가 축적되면 실용적인 식자재 소요 예측 정보를 제공해 드립니다."
                                                    )}
                                                </p>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Bar Chart Grid - 메뉴별 매출액 합계 랭킹 */}
                    <div style={{ background: 'rgba(30, 41, 59, 0.3)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 25px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: '#ef4444' }}>▌</span> 인기 메뉴별 매출액 순위
                        </h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                            {storeStats && storeStats.menuSales && storeStats.menuSales.length > 0 ? (() => {
                                const menuSales = storeStats.menuSales;
                                const maxMenuAmount = Math.max(...menuSales.map((m: any) => m.amount), 1);
                                
                                return menuSales.slice(0, 10).map((m: any, idx: number) => {
                                    const percent = (m.amount / maxMenuAmount) * 100;
                                    const rankEmoji = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "";
                                    
                                    return (
                                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.92rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ 
                                                        width: '22px', height: '22px', 
                                                        borderRadius: '50%', background: rankEmoji ? 'transparent' : 'rgba(255,255,255,0.04)',
                                                        color: '#94a3b8',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: rankEmoji ? '1.1rem' : '0.72rem', fontWeight: 800
                                                    }}>
                                                        {rankEmoji || idx + 1}
                                                    </span>
                                                    <strong style={{ color: '#fff', fontWeight: 700 }}>
                                                        {m.name} <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal' }}>({m.qty}개 판매)</span>
                                                    </strong>
                                                </div>
                                                <span style={{ color: '#fca5a5', fontWeight: 800 }}>
                                                    {m.amount.toLocaleString()}원
                                                </span>
                                            </div>
                                            
                                            {/* Progress capsule */}
                                            <div style={{ width: '100%', height: '18px', background: 'rgba(255,255,255,0.02)', borderRadius: '9px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                                                <div style={{ 
                                                    width: `${percent}%`, 
                                                    height: '100%', 
                                                    background: 'linear-gradient(to right, #f97316, #f43f5e)',
                                                    borderRadius: '9px', 
                                                    transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    boxShadow: '0 0 10px rgba(249, 115, 22, 0.25)',
                                                    position: 'relative'
                                                }} />
                                            </div>
                                        </div>
                                    );
                                });
                            })() : (
                                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '50px 0' }}>판매 실적 데이터가 준비되지 않았습니다.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
