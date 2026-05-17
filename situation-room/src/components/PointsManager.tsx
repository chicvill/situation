import { useEffect, useState, useMemo } from 'react';
import { subscribeToStore } from '../services/notifications';

interface CustomerPoint {
    phone: string;
    points: number;
    accumulated_points: number;
    top_percent_accumulated: number;
    top_percent_usable: number;
    last_updated: string;
}

interface PointsManagerProps {
    storeId?: string;
}

export const PointsManager = ({ storeId }: PointsManagerProps) => {
    const [points, setPoints] = useState<CustomerPoint[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const getApiUrl = () => import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

    const fetchPoints = async () => {
        try {
            const apiUrl = getApiUrl();
            const queryParam = storeId && storeId !== "Total" ? `?store_id=${storeId}` : '';
            const res = await fetch(`${apiUrl}/api/points/list${queryParam}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setPoints(data);
                }
            }
        } catch (e) {
            console.error('Fetch points list error:', e);
        }
    };

    useEffect(() => {
        fetchPoints();

        const unsubscribe = subscribeToStore(storeId || '', (data) => {
            if (data.type === 'POINTS_UPDATED') {
                setPoints(prev => {
                    const exists = prev.find(p => p.phone === data.phone);
                    if (exists) {
                        return prev.map(p => p.phone === data.phone ? {
                            ...p,
                            points: p.points + data.points,
                            accumulated_points: (p.accumulated_points || 0) + data.points,
                            last_updated: new Date().toISOString()
                        } : p);
                    } else {
                        return [{
                            phone: data.phone,
                            points: data.points,
                            accumulated_points: data.points,
                            top_percent_accumulated: 100,
                            top_percent_usable: 100,
                            last_updated: new Date().toISOString()
                        }, ...prev];
                    }
                });
            }
        });

        return unsubscribe;
    }, [storeId]);

    const filteredPoints = useMemo(() => {
        return points
            .filter(p => p.phone.includes(searchQuery))
            .sort((a, b) => a.phone.localeCompare(b.phone));
    }, [points, searchQuery]);

    return (
        <div className="admin-page animate-fade-in" style={{ padding: '24px', background: 'var(--bg-main)', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px' }}>🪙 매장 멤버십 포인트 관리</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                        결제 시 번호 입력을 통해 실시간 적립된 단골 고객 포인트 현황판입니다.
                    </p>
                </div>
                
                <input
                    type="text"
                    placeholder="고객 연락처 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        padding: '12px 18px',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text-main)',
                        outline: 'none',
                        width: '260px',
                        fontSize: '0.9rem',
                        boxShadow: 'var(--shadow-sm)'
                    }}
                />
            </div>

            <div className="glass-card" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>순위</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>고객 연락처</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>사용 가능 P</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>누적 합계 P</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>최종 적립 일시</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>등급 / 상위</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPoints.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                                    🪙 적립된 포인트 내역이 없습니다.
                                </td>
                            </tr>
                        ) : (
                             filteredPoints.map((p, index) => {
                                 const acc = p.accumulated_points || 0;
                                 const topPct = p.top_percent_accumulated ?? 100;
                                 const canUse = p.points > 0;

                                 let tier = '일반회원';
                                 let tierColor = 'var(--text-muted)';
                                 if (acc >= 50000) { tier = '👑 TOP VVIP'; tierColor = '#ef4444'; }
                                 else if (acc >= 20000) { tier = '✨ VVIP'; tierColor = '#f59e0b'; }
                                 else if (acc >= 10000) { tier = '💎 VIP'; tierColor = '#3b82f6'; }
                                 else if (acc >= 5000) { tier = '골드'; tierColor = '#a855f7'; }

                                 return (
                                     <tr key={p.phone} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row-hover">
                                         <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 800 }}>#{index + 1}</td>
                                         <td style={{ padding: '16px 24px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.5px' }}>{p.phone}</td>
                                         <td style={{ padding: '16px 24px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent)' }}>{p.points.toLocaleString()} P</td>
                                         <td style={{ padding: '16px 24px', fontSize: '1.05rem', fontWeight: 800, color: '#8b5cf6' }}>{acc.toLocaleString()} P</td>
                                         <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                             {new Date(p.last_updated).toLocaleDateString()} {new Date(p.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                         </td>
                                         <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                                 <span style={{ fontWeight: 800, color: tierColor, fontSize: '0.9rem' }}>{tier}</span>
                                                 {acc > 0 && (
                                                     <span style={{
                                                         fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                                                         background: topPct <= 10 ? '#fde68a' : 'rgba(0,0,0,0.05)',
                                                         color: topPct <= 10 ? '#92400e' : 'var(--text-muted)'
                                                     }}>
                                                         상위 {topPct}%
                                                     </span>
                                                 )}
                                                 {canUse ? (
                                                     <button
                                                         onClick={async () => {
                                                             const useAmount = prompt(`${p.phone} 고객님의 포인트를 얼마나 사용하시겠습니까? (보유: ${p.points}P)`, String(p.points));
                                                             if (!useAmount || isNaN(Number(useAmount)) || Number(useAmount) <= 0) return;
                                                             if (Number(useAmount) > p.points) return alert('보유 포인트보다 많이 사용할 수 없습니다.');
                                                             try {
                                                                 const apiUrl = getApiUrl();
                                                                 await fetch(`${apiUrl}/api/points/use`, {
                                                                     method: 'POST',
                                                                     headers: { 'Content-Type': 'application/json' },
                                                                     body: JSON.stringify({ phone: p.phone, points: Number(useAmount), store_id: storeId })
                                                                 });
                                                                 alert(`${Number(useAmount).toLocaleString()} 포인트가 성공적으로 사용되었습니다.`);
                                                                 fetchPoints();
                                                             } catch (e) { alert('포인트 사용 처리 중 오류가 발생했습니다.'); }
                                                         }}
                                                         style={{ padding: '4px 10px', borderRadius: '6px', background: 'var(--accent)', color: 'white', border: 'none', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                                     >
                                                         포인트 사용
                                                     </button>
                                                 ) : (
                                                     <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>적립 없음</span>
                                                 )}
                                             </div>
                                         </td>
                                     </tr>
                                 );
                             })
                        )}
                    </tbody>
                </table>
                </div>
            </div>
        </div>
    );
};
export default PointsManager;
