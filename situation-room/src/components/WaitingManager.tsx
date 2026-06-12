import React from 'react';
import { subscribeToStore } from '../services/notifications';
import { useStoreFilter } from '../hooks/useStoreFilter';
import { playDingDong } from '../utils/audio';
import { API_BASE } from '../config';
import { formatPhone } from '../utils/formatters';

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
    // localStorage로 복구: 창을 닫거나 새로고침해도 대기 ID 유지
    const [waitingId, setWaitingId] = React.useState<string | null>(
        () => localStorage.getItem('waiting_id')
    );
    const [hasCalled, setHasCalled] = React.useState(false);
    const [waitingList, setWaitingList] = React.useState<WaitingEntry[]>([]);
    // 호출 완료된 waiting_id 집합 — 중복 호출 방지
    const [calledIds, setCalledIds] = React.useState<Set<string>>(new Set());

    const getApiUrl = () => API_BASE;

    // playDingDong: utils/audio.ts 상단 import에서 가져옴

    // --- 고객: 첫 터치 시 모바일 브라우저 오디오 권한 해제(Unlock) ---
    const unlockAudio = () => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            // 무음 오실레이터를 0.01초간 켜서 브라우저의 오디오 권한을 영구적으로 획득합니다.
            const osc = ctx.createOscillator();
            osc.connect(ctx.destination);
            osc.start(0);
            osc.stop(ctx.currentTime + 0.01);
        } catch (e) {}
    };

    // --- 고객: 대기 등록 제출 ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regPhone) return alert('연락처를 입력해주세요.');
        
        // 터치 이벤트 컨텍스트 내부에서 오디오 락 해제
        unlockAudio();

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
                localStorage.setItem('waiting_id', data.waiting_id);
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

    // --- 고객: MQTT 구독 + HTTP 폴링 안전망으로 입장 알림 수신 ---
    React.useEffect(() => {
        if (!waitingId || hasCalled) return;

        const triggerEntry = () => {
            setHasCalled(true);
            playDingDong();
            localStorage.removeItem('waiting_id');
        };

        // MQTT: 실시간 수신
        const unsub = subscribeToStore(storeId || '', (data) => {
            if (
                (data.type === 'WAITING_UPDATED' || data.type === 'WAITING_STATUS_CHANGED') &&
                data.waiting_id === waitingId &&
                (data.status === 'finished' || data.status === 'called')
            ) {
                triggerEntry();
            }
        });

        // HTTP 폴링 안전망: MQTT 누락 시 3초마다 직접 확인
        // registeredAt: 등록 직후 !mine 오탐 방지를 위해 10초 이후부터 !mine 판단
        const registeredAt = Date.now();

        const checkStatus = async () => {
            try {
                const res = await fetch(`${getApiUrl()}/api/waiting/active${storeId && storeId !== 'Total' ? `?store_id=${storeId}` : ''}`);
                if (!res.ok) return;
                const list: WaitingEntry[] = await res.json();
                const mine = list.find(w => w.waiting_id === waitingId);
                const elapsed = Date.now() - registeredAt;
                if (mine?.status === 'called' || mine?.status === 'finished') {
                    triggerEntry();
                } else if (!mine && elapsed > 10000) {
                    // 10초 경과 후에도 목록에 없으면 입장 처리 (finished/cancelled로 삭제됨)
                    triggerEntry();
                }
            } catch { /* 네트워크 오류 무시 */ }
        };

        const poll = setInterval(checkStatus, 3000);

        // 모바일 브라우저 탭 활성화 시 즉시 체크 (백그라운드 복귀 대응)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkStatus();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => { 
            unsub(); 
            clearInterval(poll); 
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [waitingId, storeId, hasCalled]);

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
        // 이미 호출된 항목 중복 방지
        if (status === 'called' && calledIds.has(wid)) return;

        try {
            const res = await fetch(`${getApiUrl()}/api/waiting/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ waiting_id: wid, status }),
            });
            if (res.ok) {
                if (status === 'called') {
                    // 호출 완료 표시 — 버튼 비활성화
                    setCalledIds(prev => new Set(prev).add(wid));
                } else if (status === 'finished' || status === 'cancelled') {
                    setCalledIds(prev => { const s = new Set(prev); s.delete(wid); return s; });
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
                            <input type="tel" value={regPhone} onChange={e => setRegPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', boxSizing: 'border-box' }} required />
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
            <div id="customer-waiting-container" className={`customer-waiting-status ${hasCalled ? 'entry-flash' : ''}`} style={{
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
                <div id="customer-glass-panel" className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '40px 30px', borderRadius: '30px', textAlign: 'center', border: `2px solid ${hasCalled ? '#d32f2f' : 'var(--premium-orange)'}`, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
                    {!hasCalled ? (
                        <>
                            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⏳</div>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '10px' }}>대기 접수 완료!</h2>
                            <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 700 }}>{regName || '손님'}님, 잠시만 기다려주세요.</p>
                            <div style={{ margin: '30px 0', padding: '20px', background: 'rgba(249, 115, 22, 0.1)', borderRadius: '15px' }}>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--premium-orange)', fontWeight: 800 }}>📢 대기 접수 안내</p>
                                <p style={{ margin: '10px 0 0', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                                    입장 순서가 되면 실시간 알림음이 울립니다.<br />
                                    <span style={{ color: '#60a5fa', fontWeight: 'bold', display: 'block', marginTop: '6px' }}>💡 화면이 닫혀도 QR 코드를 다시 스캔하시면<br />대기 정보와 현황판이 그대로 복구됩니다.</span>
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
                                onClick={() => {
                                    localStorage.removeItem('waiting_id');
                                    try { window.close(); } catch (_) {}
                                    // 브라우저 닫기 실패 시 최종 안내 화면으로 전환하기 위해 상태 변경 (임시 변수 대신 window.location이나 HTML 변경 고려)
                                    // 여기서는 컴포넌트 최상단 렌더링에 isFinished 관련 뷰를 추가하기 어려우므로, 바로 내용물을 교체합니다.
                                    const panel = document.getElementById('customer-glass-panel');
                                    const container = document.getElementById('customer-waiting-container');
                                    if (container) container.style.background = 'var(--bg-main)';
                                    if (panel) {
                                        panel.style.borderColor = 'var(--premium-orange)';
                                        panel.innerHTML = `
                                            <div style="font-size: 4rem; margin-bottom: 20px;">✅</div>
                                            <h2 style="font-size: 1.8rem; font-weight: 900; margin-bottom: 15px; color: var(--success);">안내가 종료되었습니다</h2>
                                            <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 30px; line-height: 1.6; color: var(--text-main);">이용해 주셔서 감사합니다.<br />열려있는 브라우저 창(크롬, 사파리 등)을<br />직접 닫아주세요.</p>
                                        `;
                                    }
                                }}
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
                                <button
                                    className="confirm-btn premium-orange"
                                    onClick={() => handleStatusUpdate(w.waiting_id, 'called')}
                                    disabled={calledIds.has(w.waiting_id)}
                                    style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', cursor: calledIds.has(w.waiting_id) ? 'default' : 'pointer', opacity: calledIds.has(w.waiting_id) ? 0.45 : 1 }}
                                >
                                    {calledIds.has(w.waiting_id) ? '✅ 호출됨' : '🔔 호출'}
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
