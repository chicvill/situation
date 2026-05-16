import React from 'react';
import { subscribeToStore } from '../services/notifications';
import { useStoreFilter } from '../hooks/useStoreFilter';

interface WaitingEntry {
    waiting_id: string;
    store_id: string;
    phone_number: string;
    party_size: number;
    status: string;
    timestamp: string;
}

interface WaitingManagerProps {
    bundles?: any[];
    onSendMessage?: (text: string, store_id: string, storeName: string) => void;
    onComplete?: () => void;
}

export const WaitingManager: React.FC<WaitingManagerProps> = ({ onComplete }) => {
    const { storeId, storeName } = useStoreFilter();
    const params = new URLSearchParams(window.location.search);
    const isRegistrationMode = params.get('mode') === 'waiting' && params.get('action') === 'register';

    const [regName, setRegName] = React.useState('');
    const [regPhone, setRegPhone] = React.useState('');
    const [regCount, setRegCount] = React.useState('2');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [waitingId, setWaitingId] = React.useState<string | null>(null);
    const [hasCalled, setHasCalled] = React.useState(false);
    const [waitingList, setWaitingList] = React.useState<WaitingEntry[]>([]);

    const getApiUrl = () => import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

    const playDingDong = () => {
        try {
            const audio = new Audio('https://www.orangefreesounds.com/wp-content/uploads/2014/09/Ding-dong.mp3');
            audio.volume = 0.8;
            audio.play().catch(() => {});
        } catch (_) {}
    };

    // --- 고객: 대기 등록 제출 ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regPhone) return alert('연락처를 입력해주세요.');
        setIsSubmitting(true);
        try {
            const cleanPhone = regPhone.replace(/[^0-9]/g, '');
            const res = await fetch(`${getApiUrl()}/api/waiting/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: cleanPhone,
                    party_size: parseInt(regCount) || 2,
                    store_id: storeId,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setWaitingId(data.waiting_id);
            } else {
                alert('등록에 실패했습니다. 다시 시도해주세요.');
            }
        } catch {
            alert('네트워크 오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- 고객: MQTT 구독으로 입장 알림 수신 ---
    React.useEffect(() => {
        if (!waitingId) return;
        return subscribeToStore(storeId || '', (data) => {
            if (
                (data.type === 'WAITING_UPDATED' || data.type === 'WAITING_STATUS_CHANGED') &&
                data.waiting_id === waitingId &&
                (data.status === 'finished' || data.status === 'called')
            ) {
                setHasCalled(true);
                playDingDong();
            }
        });
    }, [waitingId, storeId]);

    // --- 매니저: 대기 목록 초기 로드 ---
    const fetchWaitings = React.useCallback(async () => {
        try {
            const queryParam = storeId && storeId !== 'Total' ? `?store_id=${storeId}` : '';
            const res = await fetch(`${getApiUrl()}/api/waiting/active${queryParam}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setWaitingList(data);
            }
        } catch (e) {
            console.error('Fetch waitings error:', e);
        }
    }, [storeId]);

    // --- 매니저: MQTT 구독으로 실시간 동기화 ---
    React.useEffect(() => {
        if (isRegistrationMode) return;
        fetchWaitings();
        return subscribeToStore(storeId || '', (data) => {
            if (data.type === 'WAITING_REGISTERED') {
                setWaitingList(prev => {
                    if (prev.some(w => w.waiting_id === data.waiting_id)) return prev;
                    return [{
                        waiting_id: data.waiting_id,
                        store_id: data.store_id || storeId,
                        phone_number: data.phone_number,
                        party_size: data.party_size || 1,
                        status: 'waiting',
                        timestamp: new Date().toISOString(),
                    }, ...prev];
                });
            } else if (data.type === 'WAITING_UPDATED' || data.type === 'WAITING_STATUS_CHANGED') {
                if (data.status === 'finished' || data.status === 'cancelled') {
                    setWaitingList(prev => prev.filter(w => w.waiting_id !== data.waiting_id));
                }
            }
        });
    }, [storeId, isRegistrationMode, fetchWaitings]);

    // --- 매니저: 상태 변경 처리 ---
    const handleStatusUpdate = async (wid: string, status: string) => {
        try {
            const res = await fetch(`${getApiUrl()}/api/waiting/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ waiting_id: wid, status }),
            });
            if (res.ok) {
                if (status === 'finished' || status === 'cancelled') {
                    setWaitingList(prev => prev.filter(w => w.waiting_id !== wid));
                    onComplete?.();
                }
            }
        } catch (e) {
            console.error('Update waiting status error:', e);
        }
    };

    const formatTime = (ts: string) => {
        try {
            const d = new Date(ts);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        } catch { return '-'; }
    };

    const elapsedMin = (ts: string) => {
        try { return Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 60000)); }
        catch { return 0; }
    };

    const maskPhone = (phone: string) =>
        phone.length >= 8 ? '*'.repeat(phone.length - 4) + phone.slice(-4) : phone;

    // --- 고객: 등록 폼 ---
    if (isRegistrationMode && !waitingId) {
        return (
            <div className="customer-waiting-registration animate-fade-in" style={{ padding: '40px 20px', background: 'var(--bg-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '30px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '1.6rem', fontWeight: 900 }}>🛎️ 대기 등록</h2>
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '30px', fontSize: '0.9rem' }}>{storeName} 방문을 환영합니다.</p>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>이름 (선택)</label>
                            <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="성함을 입력해주세요" style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>연락처 (필수)</label>
                            <input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="010-0000-0000" style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>인원</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {['1', '2', '3', '4', '5+'].map(c => (
                                    <button key={c} type="button" onClick={() => setRegCount(c)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: regCount === c ? '2px solid var(--accent-orange)' : '1px solid var(--border)', background: regCount === c ? 'var(--accent-orange)' : 'transparent', color: regCount === c ? 'white' : 'var(--text-main)', fontWeight: 800, cursor: 'pointer' }}>{c}</button>
                                ))}
                            </div>
                        </div>
                        <button type="submit" disabled={isSubmitting} style={{ marginTop: '10px', padding: '18px', borderRadius: '15px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 900, fontSize: '1.1rem', cursor: isSubmitting ? 'default' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
                            {isSubmitting ? '등록 중...' : '대기 등록하기'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // --- 고객: 입장 대기 화면 ---
    if (isRegistrationMode && waitingId) {
        return (
            <div className={`customer-waiting-status ${hasCalled ? 'entry-flash' : ''}`} style={{
                padding: '40px 20px',
                background: hasCalled ? '#ff4d4d' : 'var(--bg-main)',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transition: 'background 0.5s ease',
            }}>
                <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes flash-bg {
                        0% { background-color: #ff4d4d; }
                        50% { background-color: #ffffff; }
                        100% { background-color: #ff4d4d; }
                    }
                    .entry-flash { animation: flash-bg 0.8s infinite; }
                ` }} />
                <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '40px 30px', borderRadius: '30px', textAlign: 'center', border: `2px solid ${hasCalled ? '#d32f2f' : 'var(--premium-orange)'}`, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
                    {!hasCalled ? (
                        <>
                            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⏳</div>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '10px' }}>대기 접수 완료!</h2>
                            <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 700 }}>{regName || '손님'}님, 잠시만 기다려주세요.</p>
                            <div style={{ margin: '30px 0', padding: '20px', background: 'rgba(249, 115, 22, 0.1)', borderRadius: '15px' }}>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--premium-orange)', fontWeight: 800 }}>📢 중요 안내</p>
                                <p style={{ margin: '10px 0 0', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                                    현재 브라우저 창을 닫지 마세요!<br />
                                    입장 순서가 되면 소리와 함께 알림이 뜹니다.
                                </p>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>대기 번호: {waitingId}</p>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: '5rem', marginBottom: '20px' }}>📢</div>
                            <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#d32f2f', marginBottom: '15px' }}>지금 입장하세요!</h2>
                            <p style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '30px' }}>
                                매장 입구로 오셔서<br />직원에게 이 화면을 보여주세요.
                            </p>
                            <button
                                onClick={() => { try { window.close(); } catch (_) {} }}
                                style={{ padding: '15px 30px', borderRadius: '15px', border: 'none', background: '#000', color: '#fff', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer' }}
                            >
                                확인했습니다
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // --- 매니저: 대기 명단 ---
    return (
        <div className="admin-page animate-fade-in" style={{ padding: '15px' }}>
            <header className="page-header-mobile" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>🛎️ 실시간 대기 명단</h2>
                    <div style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--premium-orange)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '800' }}>
                        대기 {waitingList.length}팀
                    </div>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '5px 0 0 0' }}>고객님의 호출 및 입장 상태를 실시간으로 관리합니다.</p>
            </header>

            <div className="waiting-cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {waitingList.map((w, idx) => {
                    const mins = elapsedMin(w.timestamp);
                    return (
                        <div key={w.waiting_id} className="waiting-card animate-pop-in" style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ background: 'var(--primary-soft)', color: 'var(--text-main)', fontWeight: '800', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '6px' }}>{idx + 1}</span>
                                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{maskPhone(w.phone_number)}</strong>
                                </div>
                                <span style={{ fontSize: '0.85rem', color: 'var(--premium-orange)', fontWeight: '700' }}>👥 {w.party_size}명</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span>🕒 {formatTime(w.timestamp)}</span>
                                <span>{mins === 0 ? '방금 전' : `${mins}분 전`}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button className="confirm-btn premium-orange" onClick={() => handleStatusUpdate(w.waiting_id, 'called')} style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    🔔 호출
                                </button>
                                <button className="confirm-btn success-green" onClick={() => handleStatusUpdate(w.waiting_id, 'finished')} style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    🚀 입장
                                </button>
                                <button className="del-btn" onClick={() => handleStatusUpdate(w.waiting_id, 'cancelled')} style={{ width: '44px', height: '38px', padding: 0, fontSize: '1.2rem', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}>
                                    ×
                                </button>
                            </div>
                        </div>
                    );
                })}
                {waitingList.length === 0 && (
                    <div style={{ padding: '60px 20px', textAlign: 'center', opacity: 0.5 }}>
                        <span style={{ fontSize: '3rem' }}>🍵</span>
                        <h3 style={{ margin: '15px 0 5px', fontSize: '1.1rem' }}>현재 대기 중인 손님이 없습니다.</h3>
                        <p style={{ fontSize: '0.8rem', margin: 0 }}>QR 코드로 대기 등록하면 여기에 표시됩니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WaitingManager;
