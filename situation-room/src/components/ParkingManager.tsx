import { useEffect, useState, useMemo } from 'react';
import { subscribeToStore } from '../services/notifications';

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
            const queryParam = storeId && storeId !== 'Total' ? `?store_id=${storeId}` : '';
            const res = await fetch(`${getApiUrl()}/api/parking/active${queryParam}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setParkings(data);
            }
        } catch (e) {
            console.error('Fetch parkings error:', e);
        }
    };

    useEffect(() => {
        fetchParkings();
        const messageHandler = (data: any) => {
            if (data.type === 'PARKING_APPLIED') {
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
        return subscribeToStore(storeId || '', messageHandler);
    }, [storeId]);

    const filteredParkings = useMemo(() =>
        parkings.filter(p =>
            p.vehicle_number?.includes(searchQuery) ||
            p.table_id?.toLowerCase().includes(searchQuery.toLowerCase())
        ), [parkings, searchQuery]);

    const formatTime = (ts: string) => {
        try {
            const d = new Date(ts);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${mm}.${dd} ${hh}:${min}`;
        } catch { return '-'; }
    };

    const elapsedMin = (ts: string) => {
        try {
            return Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 60000));
        } catch { return 0; }
    };

    return (
        <div className="admin-page animate-fade-in" style={{ padding: '24px', background: 'var(--bg-main)', minHeight: '100vh' }}>

            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px' }}>
                        🚗 주차 할인 정산
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                        고객 셀프 무료 주차 등록 현황
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.25)',
                        color: '#10b981',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                    }}>
                        총 {filteredParkings.length}건
                    </div>
                    <input
                        type="text"
                        placeholder="차량번호 · 테이블 검색"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            padding: '10px 16px',
                            borderRadius: '10px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text-main)',
                            outline: 'none',
                            fontSize: '0.9rem',
                            width: '200px',
                        }}
                    />
                </div>
            </div>

            {/* 카드 그리드 */}
            {filteredParkings.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '80px 20px',
                    background: 'var(--surface)', borderRadius: '16px',
                    border: '1px dashed var(--border)', color: 'var(--text-muted)'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🚗</div>
                    <h3 style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text-main)' }}>등록된 주차 내역이 없습니다.</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>고객이 주문 화면에서 주차 할인을 신청하면 여기에 표시됩니다.</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: '16px',
                }}>
                    {filteredParkings.map((p, idx) => {
                        const mins = elapsedMin(p.timestamp);
                        const isNew = mins < 5;
                        return (
                            <div key={p.parking_id} className="animate-pop-in" style={{
                                animationDelay: `${idx * 0.04}s`,
                                background: 'var(--surface)',
                                border: `1px solid ${isNew ? 'rgba(16,185,129,0.4)' : 'var(--border)'}`,
                                borderRadius: '16px',
                                padding: '20px',
                                boxShadow: isNew ? '0 4px 20px rgba(16,185,129,0.1)' : '0 2px 8px rgba(0,0,0,0.03)',
                                position: 'relative',
                                overflow: 'hidden',
                            }}>
                                {/* 신규 배지 */}
                                {isNew && (
                                    <span style={{
                                        position: 'absolute', top: '12px', right: '12px',
                                        background: '#10b981', color: 'white',
                                        fontSize: '0.7rem', fontWeight: 800,
                                        padding: '3px 8px', borderRadius: '20px',
                                    }}>NEW</span>
                                )}

                                {/* 차량번호 */}
                                <div style={{
                                    fontSize: '1.6rem', fontWeight: 900,
                                    color: 'var(--text-main)', letterSpacing: '0.06em',
                                    marginBottom: '12px',
                                }}>
                                    {p.vehicle_number}
                                </div>

                                {/* 정보 행 */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                                    <Row label="테이블" value={p.table_id ? `TABLE ${p.table_id}` : '셀프 주차'} accent />
                                    <Row label="할인 시간" value={`${p.discount_minutes}분 무료`} />
                                    <Row label="신청 시각" value={formatTime(p.timestamp)} />
                                    <Row label="경과" value={mins === 0 ? '방금 전' : `${mins}분 전`} />
                                </div>

                                {/* 정산번호 + 상태 */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                        #{p.parking_id}
                                    </span>
                                    <span style={{
                                        background: 'rgba(16,185,129,0.1)',
                                        border: '1px solid rgba(16,185,129,0.25)',
                                        color: '#10b981',
                                        padding: '3px 10px',
                                        borderRadius: '20px',
                                        fontSize: '0.78rem',
                                        fontWeight: 800,
                                    }}>
                                        정산완료
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const Row = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: accent ? 'var(--accent)' : 'var(--text-main)', fontWeight: accent ? 700 : 500 }}>{value}</span>
    </div>
);

export default ParkingManager;
