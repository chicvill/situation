import { useEffect, useState, useMemo } from 'react';
import { WS_BASE } from '../config';

interface Parking {
    parking_id: string;
    session_id: string;
    table_id: string;
    vehicle_number: string;
    discount_minutes: number;
    status: string;
    timestamp: string;
}

interface ParkingManagerProps {
    storeId?: string;
}

export const ParkingManager = ({ storeId }: ParkingManagerProps) => {
    const [parkings, setParkings] = useState<Parking[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const getApiUrl = () => import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

    const fetchParkings = async () => {
        try {
            const apiUrl = getApiUrl();
            const queryParam = storeId && storeId !== "Total" ? `?store_id=${storeId}` : '';
            const res = await fetch(`${apiUrl}/api/parking/active${queryParam}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setParkings(data);
                }
            }
        } catch (e) {
            console.error('Fetch parkings error:', e);
        }
    };

    useEffect(() => {
        fetchParkings();

        // 실시간 주차 등록 웹소켓 바인딩
        const ws = new WebSocket(`${WS_BASE}/ws/kitchen`);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'PARKING_APPLIED') {
                // 다중 매장 데이터 노출 방지 체크
                if (storeId && storeId !== 'Total' && data.store_id && data.store_id !== storeId) {
                    return;
                }

                setParkings(prev => {
                    if (prev.some(p => p.parking_id === data.parking_id)) return prev;
                    return [{
                        parking_id: data.parking_id,
                        session_id: data.session_id,
                        table_id: data.table_id || 'Self',
                        vehicle_number: data.vehicle_number,
                        discount_minutes: data.discount_minutes || 120,
                        status: 'applied',
                        timestamp: new Date().toISOString()
                    }, ...prev];
                });
            }
        };

        return () => ws.close();
    }, [storeId]);

    const filteredParkings = useMemo(() => {
        return parkings.filter(p => 
            p.vehicle_number.includes(searchQuery) ||
            p.table_id.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [parkings, searchQuery]);

    return (
        <div className="admin-page animate-fade-in" style={{ padding: '24px', background: 'var(--bg-main)', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px' }}>🚗 주차 할인 정산 관리</h2>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                        식사 중 스마트 손님이 셀프로 등록한 실시간 무료 주차 리스트입니다.
                    </p>
                </div>
                
                <input
                    type="text"
                    placeholder="차량번호 또는 테이블 검색..."
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
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>정산 번호</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>차량 번호</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>테이블 ID</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>할인 시간</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>신청 일시</th>
                            <th style={{ padding: '16px 24px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right' }}>상태</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredParkings.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                                    🚗 등록된 차량 정산 내역이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            filteredParkings.map((p) => (
                                <tr key={p.parking_id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row-hover">
                                    <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>{p.parking_id}</td>
                                    <td style={{ padding: '16px 24px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{p.vehicle_number}</td>
                                    <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 700 }}>
                                        {p.table_id ? `Table ${p.table_id}` : '원클릭 셀프'}
                                    </td>
                                    <td style={{ padding: '16px 24px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>{p.discount_minutes}분 무료</td>
                                    <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        {new Date(p.timestamp).toLocaleDateString()} {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        <span style={{
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            border: '1px solid rgba(16, 185, 129, 0.2)',
                                            color: '#10b981',
                                            padding: '4px 10px',
                                            borderRadius: '50px',
                                            fontSize: '0.8rem',
                                            fontWeight: 800
                                        }}>
                                            정산완료
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default ParkingManager;
