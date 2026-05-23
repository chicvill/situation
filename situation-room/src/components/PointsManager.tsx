import { useEffect, useState, useMemo } from 'react';
import { subscribeToStore } from '../services/notifications';
import { API_BASE } from '../config';

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

    const getApiUrl = () => API_BASE;

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

    const thStyle: React.CSSProperties = {
        padding: '12px 10px',
        fontWeight: 700,
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        whiteSpace: 'nowrap',
        textAlign: 'left',
    };
    const tdStyle: React.CSSProperties = {
        padding: '14px 10px',
        whiteSpace: 'nowrap',
    };

    return (
        <div className="admin-page animate-fade-in" style={{ padding: '16px', background: 'var(--bg-main)', minHeight: '100vh' }}>
            {/* 헤더 */}
            <div style={{ marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px' }}>🪙 멤버십 포인트</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                    결제 시 번호 입력으로 실시간 적립된 고객 포인트 현황
                </p>
                <input
                    type="text"
                    placeholder="고객 연락처 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text-main)',
                        outline: 'none',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                    }}
                />
            </div>

            {/* 테이블 */}
            <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border)' }}>
                                <th style={thStyle}>#</th>
                                <th style={thStyle}>연락처</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>사용P</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>누적P</th>
                                <th style={thStyle}>등급</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>사용</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPoints.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        🪙 적립된 포인트 내역이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                filteredPoints.map((p, index) => {
                                    const acc = p.accumulated_points || 0;
                                    const topPct = p.top_percent_accumulated ?? 100;
                                    const canUse = p.points > 0;

                                    let tier = '일반';
                                    let tierColor = 'var(--text-muted)';
                                    if (acc >= 50000) { tier = '👑VVIP+'; tierColor = '#ef4444'; }
                                    else if (acc >= 20000) { tier = '✨VVIP'; tierColor = '#f59e0b'; }
                                    else if (acc >= 10000) { tier = '💎VIP'; tierColor = '#3b82f6'; }
                                    else if (acc >= 5000) { tier = '🥇골드'; tierColor = '#a855f7'; }

                                    return (
                                        <tr key={p.phone} style={{ borderBottom: '1px solid var(--border)' }} className="table-row-hover">
                                            <td style={{ ...tdStyle, color: 'var(--accent)', fontWeight: 800, fontSize: '0.85rem' }}>#{index + 1}</td>
                                            <td style={{ ...tdStyle, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{p.phone}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: 'var(--accent)', fontSize: '0.95rem' }}>{p.points.toLocaleString()}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: '#8b5cf6', fontSize: '0.95rem' }}>{acc.toLocaleString()}</td>
                                            <td style={{ ...tdStyle }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    <span style={{ fontWeight: 800, color: tierColor, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{tier}</span>
                                                    {acc > 0 && (
                                                        <span style={{ fontSize: '0.7rem', color: topPct <= 10 ? '#92400e' : 'var(--text-muted)', fontWeight: 600 }}>
                                                            상위 {topPct}%
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                {canUse ? (
                                                    <button
                                                        onClick={async () => {
                                                            const useAmount = prompt(`${p.phone} 고객님\n보유: ${p.points}P\n사용할 포인트 입력`, String(p.points));
                                                            if (!useAmount || isNaN(Number(useAmount)) || Number(useAmount) <= 0) return;
                                                            if (Number(useAmount) > p.points) return alert('보유 포인트 초과');
                                                            try {
                                                                const apiUrl = getApiUrl();
                                                                await fetch(`${apiUrl}/api/points/use`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ phone: p.phone, points: Number(useAmount), store_id: storeId })
                                                                });
                                                                alert(`${Number(useAmount).toLocaleString()}P 사용 완료`);
                                                                fetchPoints();
                                                            } catch { alert('오류 발생'); }
                                                        }}
                                                        style={{ padding: '6px 12px', borderRadius: '8px', background: 'var(--accent)', color: 'white', border: 'none', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                    >
                                                        사용
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>
                                                )}
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
