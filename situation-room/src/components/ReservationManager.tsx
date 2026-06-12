import React, { useState, useEffect, useCallback } from 'react';
import { useStoreFilter } from '../hooks/useStoreFilter';
import { CustomDateTimePicker } from './CustomDateTimePicker';
import { subscribeToStore } from '../services/notifications';
import { API_BASE } from '../config';
import { formatPhone } from '../utils/formatters';

const getApiUrl = () => API_BASE;

interface Reservation {
    reservation_id: string;
    customer_name: string;
    phone_number: string;
    party_size: number;
    reserved_time: string;
    table_id: string;
    status: string;
    contact_confirmed_1day: boolean;
    contact_confirmed_3hour: boolean;
    notes: string;
}

const STATUS_LABEL: Record<string, string> = {
    requested: '접수 대기',
    confirmed: '예약 확정',
    arrived: '입장 완료',
    cancelled: '취소',
    finished: '종료',
};

const STATUS_COLOR: Record<string, string> = {
    requested: '#f59e0b',
    confirmed: '#3b82f6',
    arrived: '#10b981',
    cancelled: '#ef4444',
    finished: '#6b7280',
};



const emptyForm = (): Partial<Reservation> => ({
    customer_name: '', phone_number: '', party_size: 2,
    reserved_time: '', table_id: '', notes: '', status: 'requested',
});

const fmtDT = (dt: string) => {
    if (!dt) return '-';
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const getDiffLabel = (dt: string) => {
    const diff = new Date(dt).getTime() - Date.now();
    if (diff <= 0) return null;
    const h = diff / 3600000;
    if (h < 1) return `${Math.ceil(diff / 60000)}분 후`;
    if (h < 24) return `${Math.round(h)}시간 후`;
    return `${Math.round(h / 24)}일 후`;
};

// ─── Customer-facing registration form ───────────────────────────────────────
const CustomerRegistrationForm: React.FC<{ storeId: string; storeName: string }> = ({ storeId, storeName }) => {
    const [form, setForm] = useState({ name: '', phone: '', datetime: '', count: '2' });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [settings, setSettings] = useState({ start: '11:00', end: '20:00' });

    useEffect(() => {
        if (!storeId || storeId === 'Total') return;
        fetch(`${getApiUrl()}/api/stores/${storeId}/settings`)
            .then(r => r.json())
            .then(d => { 
                if (d.reservation_settings) {
                    setSettings(typeof d.reservation_settings === 'string' ? JSON.parse(d.reservation_settings) : d.reservation_settings);
                }
            })
            .catch(() => {});
    }, [storeId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.phone || !form.datetime) return alert('연락처와 예약 일시를 입력해주세요.');

        const selectedDate = new Date(form.datetime);
        const timeStr = `${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`;
        
        if (settings.start === settings.end) {
            return alert('현재 매장 설정상 예약을 접수하지 않습니다.');
        }
        
        const isValidTime = settings.start <= settings.end 
            ? (timeStr >= settings.start && timeStr <= settings.end)
            : (timeStr >= settings.start || timeStr <= settings.end);

        if (!isValidTime) {
            return alert(`예약 가능 시간은 ${settings.start} ~ ${settings.end} 입니다.`);
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${getApiUrl()}/api/reservation/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    store_id: storeId,
                    customer_name: form.name || '손님',
                    phone_number: form.phone.replace(/[^0-9]/g, ''),
                    party_size: Number(form.count.replace('+', '')) || 2,
                    reserved_time: form.datetime,
                    table_id: 'T01',
                }),
            });
            if (res.ok) setSubmitted(true);
            else throw new Error();
        } catch {
            alert('예약 신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        const isToday = new Date(form.datetime).toDateString() === new Date().toDateString();
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
                    <h2 style={{ color: 'var(--text-main)', fontWeight: 900 }}>예약 신청 완료</h2>
                    <p style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
                        {storeName} 방문 예약이 접수되었습니다.<br />
                        {isToday 
                            ? '당일 예약이 정상적으로 접수되었습니다. 매장 상황에 따라 곧 안내해 드리겠습니다.' 
                            : '입력하신 전화번호로 점장님이 확인 후 연락을 드려 최종 확정될 예정입니다.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '40px 20px', background: 'var(--bg-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '450px', background: 'var(--surface)', padding: '30px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '1.6rem', fontWeight: 900 }}>📅 예약 신청</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '28px', fontSize: '0.9rem' }}>{storeName}</p>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>예약자 성함
                        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="성함을 입력해주세요" required
                            style={{ display: 'block', marginTop: '8px', width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>연락처
                        <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))} placeholder="010-0000-0000" required
                            style={{ display: 'block', marginTop: '8px', width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                    </label>
                    <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>예약 일시
                        <div style={{ marginTop: '8px' }}>
                            <CustomDateTimePicker value={form.datetime} onChange={v => setForm(f => ({ ...f, datetime: v }))} />
                        </div>
                    </label>
                    <label style={{ fontWeight: 700, fontSize: '0.9rem' }}>방문 인원
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            {['1', '2', '3', '4', '5', '6+'].map(c => (
                                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, count: c }))}
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: form.count === c ? 'none' : '1px solid var(--border)', background: form.count === c ? 'var(--accent-orange)' : 'transparent', color: form.count === c ? 'white' : 'var(--text-main)', fontWeight: 800, cursor: 'pointer' }}>
                                    {c}
                                </button>
                            ))}
                        </div>
                    </label>
                    <button type="submit" disabled={submitting}
                        style={{ padding: '18px', borderRadius: '15px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', marginTop: '8px' }}>
                        {submitting ? '신청 중...' : '예약 신청하기'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ─── Main management view ─────────────────────────────────────────────────────
export const ReservationManager: React.FC<{ userRole?: string; bundles?: any[] }> = ({ userRole, bundles = [] }) => {
    const { storeId, storeName } = useStoreFilter();

    const dynamicTableCount = React.useMemo(() => {
        const storeBundle = bundles.find(b => b.type === 'StoreConfig' && (b.store_id === storeId || !b.store_id));
        const tableSetup = storeBundle?.items?.find((i: any) => i.name === '테이블설정' || i.name === '테이블 수' || i.name === 'table_count')?.value;
        if (tableSetup) {
            if (typeof tableSetup === 'string' && tableSetup.includes('번:')) {
                return tableSetup.split(',').length;
            } else if (!isNaN(Number(tableSetup))) {
                return Number(tableSetup);
            }
        }
        return 12;
    }, [bundles, storeId]);

    const TABLES = React.useMemo(() => Array.from({ length: dynamicTableCount }, (_, i) => `T${String(i + 1).padStart(2, '0')}`), [dynamicTableCount]);

    const params = new URLSearchParams(window.location.search);
    const isRegistrationMode = params.get('mode') === 'reserve' && params.get('action') === 'register' && (!userRole || userRole === 'customer');

    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [reservationSettings, setReservationSettings] = useState({ start: '11:00', end: '20:00' });

    const [editOpen, setEditOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Reservation>>(emptyForm());

    const [arrivalOpen, setArrivalOpen] = useState(false);
    const [arrivalRes, setArrivalRes] = useState<Reservation | null>(null);
    const [arrivalTable, setArrivalTable] = useState('');

    const fetchReservations = useCallback(async () => {
        try {
            const url = storeId && storeId !== 'Total' ? `${getApiUrl()}/api/reservation/all?store_id=${storeId}` : `${getApiUrl()}/api/reservation/all`;
            const res = await fetch(url);
            const data = await res.json();
            if (Array.isArray(data)) setReservations(data);
        } catch (e) {
            console.error('Fetch reservations error:', e);
        }
    }, [storeId]);

    useEffect(() => {
        fetchReservations();
        
        if (!storeId || storeId === 'Total') return;
        const unsub = subscribeToStore(storeId, (data) => {
            if (data.type === 'RESERVATION_UPDATED') {
                fetchReservations();
            }
        });
        return () => unsub();
    }, [fetchReservations, storeId]);

    useEffect(() => {
        if (!storeId || storeId === 'Total') return;
        fetch(`${getApiUrl()}/api/stores/${storeId}/settings`)
            .then(r => r.json())
            .then(d => {
                if (d.reservation_settings) {
                    setReservationSettings(typeof d.reservation_settings === 'string' ? JSON.parse(d.reservation_settings) : d.reservation_settings);
                }
            })
            .catch(() => {});
    }, [storeId]);

    const handleSaveSettings = async () => {
        if (!storeId || storeId === 'Total') return alert('특정 매장을 선택한 후 설정하세요.');
        try {
            await fetch(`${getApiUrl()}/api/stores/${storeId}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservation_settings: reservationSettings }),
            });
            alert('설정이 저장되었습니다.');
        } catch {
            alert('설정 저장 중 오류가 발생했습니다.');
        }
    };

    const handleConfirm = async (r: Reservation) => {
        try {
            await fetch(`${getApiUrl()}/api/reservation/${r.reservation_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...r, status: 'confirmed' }),
            });
            fetchReservations();
        } catch (e) { console.error(e); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('예약을 삭제하시겠습니까?')) return;
        try {
            await fetch(`${getApiUrl()}/api/reservation/${id}`, { method: 'DELETE' });
            fetchReservations();
        } catch (e) { console.error(e); }
    };

    const handleSaveEdit = async () => {
        if (!editForm.customer_name || !editForm.reserved_time) return alert('이름과 예약 일시는 필수입니다.');
        try {
            if (isNew) {
                const res = await fetch(`${getApiUrl()}/api/reservation/request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        store_id: storeId,
                        customer_name: editForm.customer_name,
                        phone_number: editForm.phone_number,
                        party_size: editForm.party_size,
                        reserved_time: editForm.reserved_time,
                        table_id: editForm.table_id || 'T01',
                    }),
                });
                if (!res.ok) throw new Error();
            } else {
                await fetch(`${getApiUrl()}/api/reservation/${editId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editForm),
                });
            }
            setEditOpen(false);
            setIsNew(false);
            setEditForm(emptyForm());
            fetchReservations();
        } catch {
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    const handleArrival = (r: Reservation) => {
        setArrivalRes(r);
        setArrivalTable(r.table_id || '');
        setArrivalOpen(true);
    };

    const handleConfirmArrival = async () => {
        if (!arrivalRes || !arrivalTable) return alert('테이블을 선택해주세요.');
        try {
            const apiUrl = getApiUrl();
            await fetch(`${apiUrl}/api/session/open`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ store_id: storeId || 'default_store', table_id: arrivalTable }),
            });
            await fetch(`${apiUrl}/api/reservation/${arrivalRes.reservation_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...arrivalRes, status: 'arrived', table_id: arrivalTable }),
            });
            setArrivalOpen(false);
            setArrivalRes(null);
            fetchReservations();
        } catch {
            alert('입장 처리 중 오류가 발생했습니다.');
        }
    };

    const handleContactConfirm = async (r: Reservation, type: '1day' | '3hour') => {
        try {
            await fetch(`${getApiUrl()}/api/reservation/contact-confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservation_id: r.reservation_id, contact_type: type }),
            });
            fetchReservations();
        } catch (e) { console.error(e); }
    };

    const filtered = reservations.filter(r => {
        if (filterStatus === 'active') return ['requested', 'confirmed'].includes(r.status);
        if (filterStatus === 'arrived') return r.status === 'arrived';
        if (filterStatus === 'cancelled') return r.status === 'cancelled' || r.status === 'finished';
        return true;
    });

    if (isRegistrationMode) {
        return <CustomerRegistrationForm storeId={storeId} storeName={storeName} />;
    }

    const FILTER_TABS = [
        { key: 'active', label: `대기/확정 (${reservations.filter(r => ['requested','confirmed'].includes(r.status)).length})` },
        { key: 'arrived', label: '입장 완료' },
        { key: 'cancelled', label: '취소/종료' },
        { key: 'all', label: '전체' },
    ];

    return (
        <div style={{ padding: '16px', paddingBottom: '120px', background: 'var(--bg-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>📅 예약 관리</h2>
                <button
                    onClick={() => { setIsNew(true); setEditId(null); setEditForm(emptyForm()); setEditOpen(true); }}
                    style={{ padding: '9px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
                >
                    + 새 예약
                </button>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {FILTER_TABS.map(t => (
                    <button key={t.key} onClick={() => setFilterStatus(t.key)} style={{
                        padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap',
                        background: filterStatus === t.key ? 'var(--primary)' : 'var(--surface)',
                        color: filterStatus === t.key ? 'white' : 'var(--text-muted)',
                    }}>{t.label}</button>
                ))}
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2.2rem', marginBottom: '10px', opacity: 0.5 }}>📅</div>
                    <p style={{ fontWeight: 600, margin: 0 }}>해당 예약이 없습니다.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filtered.map(r => {
                        const diffMs = new Date(r.reserved_time).getTime() - Date.now();
                        const diffH = diffMs / 3600000;
                        const isUrgent = diffH > 0 && diffH <= 3;
                        const isSoon = diffH > 0 && diffH <= 24;
                        const diffLabel = getDiffLabel(r.reserved_time);

                        return (
                            <div key={r.reservation_id} style={{
                                background: 'var(--surface)', borderRadius: '14px', padding: '14px 14px 14px 18px',
                                border: `1.5px solid ${isUrgent ? '#fca5a5' : isSoon ? '#fcd34d' : 'var(--border)'}`,
                                position: 'relative', overflow: 'hidden',
                            }}>
                                {/* 좌측 상태 컬러 바 */}
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: STATUS_COLOR[r.status] || 'var(--border)' }} />

                                {/* 1행: 날짜 + 상태 뱃지 + D-tag */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                                        {fmtDT(r.reserved_time)}
                                    </span>
                                    <span style={{
                                        fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '8px', whiteSpace: 'nowrap',
                                        background: 'var(--primary-soft)', color: STATUS_COLOR[r.status] || 'var(--text-muted)'
                                    }}>
                                        {STATUS_LABEL[r.status] || r.status}
                                    </span>
                                    {diffLabel && (
                                        <span style={{
                                            fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap',
                                            background: isUrgent ? '#fee2e2' : isSoon ? '#fef3c7' : 'rgba(0,0,0,0.05)',
                                            color: isUrgent ? '#dc2626' : isSoon ? '#92400e' : 'var(--text-muted)'
                                        }}>
                                            {diffLabel}
                                        </span>
                                    )}
                                </div>

                                {/* 2행: 고객 정보 */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: r.notes ? '4px' : '12px' }}>
                                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                                        {r.customer_name}
                                    </span>
                                    {r.phone_number && (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                            📞 {formatPhone(r.phone_number)}
                                        </span>
                                    )}
                                    <span style={{ color: 'var(--accent-orange)', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                        👥 {r.party_size}명
                                    </span>
                                    {r.table_id && (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                            🪑 {r.table_id}
                                        </span>
                                    )}
                                </div>

                                {/* 메모 */}
                                {r.notes && (
                                    <div style={{ marginBottom: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        💬 {r.notes}
                                    </div>
                                )}

                                {/* 3행: 액션 버튼 */}
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {r.status === 'requested' && (
                                        <button onClick={() => handleConfirm(r)} style={{
                                            flex: 1, padding: '9px 0', background: '#3b82f6', color: 'white', minWidth: '70px',
                                            border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem'
                                        }}>확정</button>
                                    )}
                                    {new Date(r.reserved_time).toDateString() !== new Date().toDateString() && r.status !== 'cancelled' && r.status !== 'finished' && (
                                        <button onClick={() => handleContactConfirm(r, '1day')} style={{
                                            flex: 1, padding: '9px 0', background: r.contact_confirmed_1day ? 'var(--bg-main)' : '#8b5cf6', color: r.contact_confirmed_1day ? 'var(--text-muted)' : 'white', minWidth: '90px',
                                            border: r.contact_confirmed_1day ? '1px solid var(--border)' : 'none', borderRadius: '8px', fontWeight: 700, cursor: r.contact_confirmed_1day ? 'default' : 'pointer', fontSize: '0.82rem'
                                        }} disabled={r.contact_confirmed_1day}>
                                            {r.contact_confirmed_1day ? '✅ 전화확인됨' : '📞 전화 확인'}
                                        </button>
                                    )}
                                    {(r.status === 'requested' || r.status === 'confirmed') && (
                                        <button onClick={() => handleArrival(r)} style={{
                                            flex: 2, padding: '9px 0', background: '#10b981', color: 'white', minWidth: '90px',
                                            border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem'
                                        }}>입장 처리</button>
                                    )}
                                    <button onClick={() => { setIsNew(false); setEditId(r.reservation_id); setEditForm({ ...r }); setEditOpen(true); }} style={{
                                        flex: 1, padding: '9px 0', background: 'var(--bg-main)', color: 'var(--text-main)', minWidth: '70px',
                                        border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem'
                                    }}>수정</button>
                                    <button onClick={() => handleDelete(r.reservation_id)} style={{
                                        flex: 1, padding: '9px 0', background: 'transparent', color: '#ef4444', minWidth: '70px',
                                        border: '1px solid #fca5a5', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem'
                                    }}>삭제</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            </div>

            {/* ── Settings ── */}
            <div style={{ position: 'sticky', bottom: '80px', margin: 'auto -16px -16px -16px', padding: '16px 20px', background: 'var(--surface)', borderTop: '1px solid var(--border)', zIndex: 100, boxShadow: '0 -10px 20px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '600px', margin: '0 auto' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>⚙️ 당일 예약 가능 시간 설정</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select value={reservationSettings.start} onChange={e => setReservationSettings(prev => ({ ...prev, start: e.target.value }))}
                            style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600, outline: 'none' }}>
                            {Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span style={{ fontWeight: 800, color: 'var(--text-muted)' }}>~</span>
                        <select value={reservationSettings.end} onChange={e => setReservationSettings(prev => ({ ...prev, end: e.target.value }))}
                            style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600, outline: 'none' }}>
                            {Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button onClick={handleSaveSettings} style={{ padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem', marginLeft: '4px', whiteSpace: 'nowrap' }}>저장</button>
                    </div>
                </div>
            </div>

            {/* ── Edit / New Modal ── */}
            {editOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.2rem' }}>{isNew ? '새 예약 등록' : '예약 수정'}</h3>
                            <button onClick={() => { setEditOpen(false); setIsNew(false); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {([
                                { label: '예약자 이름', key: 'customer_name', type: 'text', placeholder: '성함을 입력해주세요' },
                                { label: '연락처', key: 'phone_number', type: 'tel', placeholder: '010-0000-0000' },
                                { label: '예약 일시', key: 'reserved_time', type: 'datetime-local', placeholder: '' },
                            ] as { label: string; key: keyof Reservation; type: string; placeholder: string }[]).map(f => (
                                <label key={f.key} style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>{f.label}
                                    {f.type === 'datetime-local' ? (
                                        <div style={{ marginTop: '6px' }}>
                                            <CustomDateTimePicker value={(editForm[f.key] as string) || ''} onChange={v => setEditForm(prev => ({ ...prev, [f.key]: v }))} />
                                        </div>
                                    ) : (
                                        <input type={f.type} value={(editForm[f.key] as string) || ''} placeholder={f.placeholder}
                                            onChange={e => {
                                                const val = f.type === 'tel' ? formatPhone(e.target.value) : e.target.value;
                                                setEditForm(prev => ({ ...prev, [f.key]: val }));
                                            }}
                                            style={{ display: 'block', width: '100%', marginTop: '6px', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                                    )}
                                </label>
                            ))}
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>인원수
                                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                                        <button key={n} type="button" onClick={() => setEditForm(f => ({ ...f, party_size: n }))}
                                            style={{ flex: 1, padding: '9px 2px', borderRadius: '8px', border: editForm.party_size === n ? 'none' : '1px solid var(--border)', background: editForm.party_size === n ? 'var(--primary)' : 'var(--bg-main)', color: editForm.party_size === n ? 'white' : 'var(--text-main)', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </label>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>지정 테이블 (선택)
                                <select value={editForm.table_id || ''} onChange={e => setEditForm(f => ({ ...f, table_id: e.target.value }))}
                                    style={{ display: 'block', width: '100%', marginTop: '6px', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
                                    <option value="">미지정</option>
                                    {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </label>
                            {!isNew && (
                                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>상태
                                    <select value={editForm.status || 'confirmed'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                                        style={{ display: 'block', width: '100%', marginTop: '6px', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
                                        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </label>
                            )}
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>메모
                                <textarea value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                                    style={{ display: 'block', width: '100%', marginTop: '6px', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', resize: 'vertical', boxSizing: 'border-box' }} />
                            </label>
                            <button onClick={handleSaveEdit}
                                style={{ padding: '16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', marginTop: '8px' }}>
                                {isNew ? '예약 등록' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Arrival Modal ── */}
            {arrivalOpen && arrivalRes && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '420px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)', fontSize: '1.2rem' }}>🚶 입장 처리</h3>
                            <button onClick={() => setArrivalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                        </div>
                        <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '4px' }}>{arrivalRes.customer_name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>👥 {arrivalRes.party_size}명 · {fmtDT(arrivalRes.reserved_time)}</div>
                        </div>
                        <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px' }}>안내할 테이블을 선택하세요 ({arrivalRes.party_size}명 수용 가능 테이블 권장)</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '24px' }}>
                            {TABLES.map(t => (
                                <button key={t} onClick={() => setArrivalTable(t)} style={{
                                    padding: '12px 4px', borderRadius: '8px',
                                    border: arrivalTable === t ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    background: arrivalTable === t ? 'var(--primary)' : 'var(--bg-main)',
                                    color: arrivalTable === t ? 'white' : 'var(--text-main)',
                                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.15s',
                                }}>{t}</button>
                            ))}
                        </div>
                        <button onClick={handleConfirmArrival} disabled={!arrivalTable}
                            style={{ width: '100%', padding: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '1rem', cursor: arrivalTable ? 'pointer' : 'not-allowed', opacity: arrivalTable ? 1 : 0.5 }}>
                            {arrivalTable ? `${arrivalTable} 테이블로 입장 완료` : '테이블 선택 후 처리'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReservationManager;
