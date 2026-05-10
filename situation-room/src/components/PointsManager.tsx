import { useEffect, useState, useMemo } from 'react';
import { WS_BASE } from '../config';

interface CustomerPoint {
    phone: string;
    points: number;
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

        // 실시간 포인트 적립 웹소켓 바인딩
        const ws = new WebSocket(`${WS_BASE}/ws/kitchen`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'POINTS_UPDATED') {
                // 다중 매장 데이터 노출 방지 체크
                if (storeId && storeId !== 'Total' && data.store_id && data.store_id !== storeId) {
                    return;
                }

                setPoints(prev => {
                    const exists = prev.find(p => p.phone === data.phone);
                    if (exists) {
                        return prev.map(p => p.phone === data.phone ? {
                            ...p,
                            points: p.points + data.points,
                            last_updated: new Date().toISOString()
                        } : p);
                    } else {
                        return [{
                            phone: data.phone,
                            points: data.points,
                            last_updated: new Date().toISOString()
                        }, ...prev];
                    }
                });
            }
        };

        return () => ws.close();
    }, [storeId]);

    const filteredPoints = useMemo(() => {
        return points.filter(p => 
            p.phone.includes(searchQuery)
        );
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
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>순위</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>고객 연락처</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>적립 포인트</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>최종 적립 일시</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>등급</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPoints.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                                    🪙 적립된 포인트 내역이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            filteredPoints.map((p, index) => {
                                let tier = '일반회원';
                                let tierColor = 'var(--text-muted)';
                                if (p.points >= 5000) {
                                    tier = '👑 VVIP';
                                    tierColor = '#f59e0b';
                                } else if (p.points >= 2000) {
                                    tier = '✨ VIP';
                                    tierColor = '#3b82f6';
                                } else if (p.points >= 500) {
                                    tier = '💎 골드';
                                    tierColor = '#a855f7';
                                }

                                return (
                                    <tr key={p.phone} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row-hover">
                                        <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 800 }}>#{index + 1}</td>
                                        <td style={{ padding: '16px 24px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.5px' }}>{p.phone}</td>
                                        <td style={{ padding: '16px 24px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent)' }}>{p.points.toLocaleString()} P</td>
                                        <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {new Date(p.last_updated).toLocaleDateString()} {new Date(p.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 800, color: tierColor, fontSize: '0.9rem' }}>
                                            {tier}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default PointsManager;
