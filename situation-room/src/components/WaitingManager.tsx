import React from 'react';
import type { BundleData } from '../types';

import { useStoreFilter } from '../hooks/useStoreFilter';

interface WaitingManagerProps {
    bundles: BundleData[];
    onSendMessage: (text: string, store_id: string, storeName: string) => void;
}

export const WaitingManager: React.FC<WaitingManagerProps> = ({ bundles, onSendMessage }) => {
    const { storeId, storeName } = useStoreFilter();
    const params = new URLSearchParams(window.location.search);
    const isRegistrationMode = params.get('mode') === 'waiting' && params.get('action') === 'register';
    
    const [regName, setRegName] = React.useState('');
    const [regPhone, setRegPhone] = React.useState('');
    const [regCount, setRegCount] = React.useState('2');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isRegistered, setIsRegistered] = React.useState(false);
    const [myWaitingId, setMyWaitingId] = React.useState<string | null>(null);
    const [hasCalled, setHasCalled] = React.useState(false);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    // 효과음 초기화
    React.useEffect(() => {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regPhone) return alert('연락처를 입력해주세요.');
        setIsSubmitting(true);
        try {
            const cleanPhone = regPhone.replace(/[^0-9]/g, '');
            const tempId = `WAIT-${cleanPhone}-${Date.now()}`;
            const message = `${regName || '손님'} ${cleanPhone} ${regCount}명 대기 등록`;
            onSendMessage(message, storeId, storeName);
            
            setMyWaitingId(tempId);
            setIsRegistered(true);
            // alert 대신 UI 전환으로 대응
        } finally {
            setIsSubmitting(false);
        }
    };

    // 실시간 상태 감시 (호출 및 입장 체크)
    React.useEffect(() => {
        if (!isRegistered || !regPhone) return;

        const cleanPhone = regPhone.replace(/[^0-9]/g, '');
        // 내 전화번호가 포함된 대기 번들 찾기
        const myBundle = bundles.find(b => 
            (b.type === 'Waiting' || (b.type === 'Orders' && b.table_id === 'T102')) && 
            b.items?.some(i => i.value?.toString().includes(cleanPhone))
        );

        if (myBundle) {
            // 1. 입장 완료 처리된 경우
            if (myBundle.status === 'finished' || myBundle.status === 'seated') {
                if (!hasCalled) {
                    triggerEntryAlert();
                }
            }
            // 2. 호출 상태인 경우 (관리자가 호출 버튼 누름)
            const statusItem = myBundle.items?.find(i => i.name === '상태');
            if (statusItem?.value?.toString().includes('호출') || myBundle.status === 'called') {
                if (!hasCalled) {
                    triggerEntryAlert();
                }
            }
        }
    }, [bundles, isRegistered, regPhone, hasCalled]);

    const triggerEntryAlert = () => {
        setHasCalled(true);
        // 소리 재생
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        }
        // 탭 제목 깜빡이기
        let blink = true;
        const originTitle = document.title;
        const interval = setInterval(() => {
            document.title = blink ? "🔔 [입장 요청] 🔔" : "!!! 지금 입장하세요 !!!";
            blink = !blink;
        }, 500);
        
        // 10초 후 타이틀 복구
        setTimeout(() => {
            clearInterval(interval);
            document.title = originTitle;
        }, 10000);
    };

    if (isRegistrationMode) {
        return (
            <div className="customer-waiting-registration animate-fade-in" style={{ padding: '40px 20px', background: 'var(--bg-main)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '30px', borderRadius: '24px', border: '1px solid var(--border)' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '10px', fontSize: '1.6rem', fontWeight: 900 }}>🛎️ 대기 등록</h2>
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '30px', fontSize: '0.9rem' }}>{storeName} 방문을 환영합니다.</p>
                    
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>이름 (선택)</label>
                            <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="성함을 입력해주세요" style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>연락처 (필수)</label>
                            <input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="010-0000-0000" style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)' }} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 700 }}>인원</label>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {['1', '2', '3', '4', '5+'].map(c => (
                                    <button key={c} type="button" onClick={() => setRegCount(c)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: regCount === c ? '2px solid var(--accent-orange)' : '1px solid var(--border)', background: regCount === c ? 'var(--accent-orange)' : 'transparent', color: regCount === c ? 'white' : 'var(--text-main)', fontWeight: 800 }}>{c}</button>
                                ))}
                            </div>
                        </div>
                        <button type="submit" disabled={isSubmitting} style={{ marginTop: '10px', padding: '18px', borderRadius: '15px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 900, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}>{isSubmitting ? '등록 중...' : '대기 등록하기'}</button>
                    </form>
                </div>
            </div>
        );
    }

    // --- 고객용 대기 상태 화면 ---
    if (isRegistered) {
        return (
            <div className={`customer-waiting-status ${hasCalled ? 'entry-flash' : ''}`} style={{ 
                padding: '40px 20px', 
                background: hasCalled ? '#ff4d4d' : 'var(--bg-main)', 
                minHeight: '100vh', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                transition: 'background 0.5s ease'
            }}>
                <style>{`
                    @keyframes flash-bg {
                        0% { background-color: #ff4d4d; }
                        50% { background-color: #ffffff; }
                        100% { background-color: #ff4d4d; }
                    }
                    .entry-flash {
                        animation: flash-bg 0.8s infinite;
                    }
                `}</style>

                <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '40px 30px', borderRadius: '30px', textAlign: 'center', border: '2px solid var(--premium-orange)', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
                    {!hasCalled ? (
                        <>
                            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⏳</div>
                            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '10px' }}>대기 접수 완료!</h2>
                            <p style={{ color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 700 }}>{regName || '손님'}님, 잠시만 기다려주세요.</p>
                            
                            <div style={{ margin: '30px 0', padding: '20px', background: 'rgba(249, 115, 22, 0.1)', borderRadius: '15px' }}>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--premium-orange)', fontWeight: 800 }}>📢 중요 안내</p>
                                <p style={{ margin: '10px 0 0', fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                                    **현재 브라우저 창을 닫지 마세요!**<br/>
                                    다른 앱을 사용하셔도 되지만, 이 페이지를 유지해야 입장 순서에 **딩동 소리**를 들으실 수 있습니다.
                                </p>
                            </div>
                            
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>순서가 되면 소리와 함께 알림이 뜹니다.</p>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: '5rem', marginBottom: '20px' }}>📢</div>
                            <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#d32f2f', marginBottom: '15px' }}>지금 입장하세요!</h2>
                            <p style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '30px' }}>매장 입구로 오셔서<br/>직원에게 이 화면을 보여주세요.</p>
                            <button onClick={() => window.location.reload()} style={{ padding: '15px 30px', borderRadius: '15px', border: 'none', background: '#000', color: '#fff', fontWeight: 900, fontSize: '1.1rem' }}>확인했습니다</button>
                        </>
                    )}
                </div>
            </div>
        );
    }
    
    // 대기 번들 중 진짜 활성화된(취소/완료되지 않은) 목록만 필터링 (역사적 사건 로그 제외)
    const waitingList = bundles.filter(b => {
        if (b.type !== 'Waiting' && !(b.type === 'Orders' && b.table_id === 'T99')) return false;
        
        // 1. 매장 필터링
        const storeMatch = storeId === 'Total' || b.store_id === storeId || !b.store_id;
        if (!storeMatch) return false;
        
        // 2. 루트 status 필터링
        if (b.status === 'canceled' || b.status === 'finished' || b.status === 'seated') return false;
        
        // 3. 타이틀 키워드 필터링 (취소/입장/완료 사건 로그 제외)
        const title = b.title || '';
        if (title.includes('취소') || title.includes('입장') || title.includes('완료') || title.includes('퇴장')) {
            return false;
        }
        
        // 4. 세부 아이템(items) 내부의 '상태' 필터링 (AI가 세부 항목으로 상태를 기입한 경우 보호)
        const statusItem = b.items?.find(i => i.name === '상태' || i.name.includes('조치') || i.name.includes('진행'));
        if (statusItem) {
            const val = statusItem.value?.toString() || '';
            if (val.includes('취소') || val.includes('완료') || val.includes('입장') || val.includes('종료')) {
                return false;
            }
        }
        
        return true;
    });

    const handleCall = async (bundle: BundleData, waitingNo: string) => {
        const cleanNo = waitingNo.startsWith('대기 ') ? waitingNo : `대기 ${waitingNo}`;
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            // 상태를 'called'로 업데이트하여 손님 앱이 즉시 반응하게 함
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, status: 'called', store: storeName, store_id: storeId }),
            });
            onSendMessage(`${cleanNo} 손님 호출`, storeId, storeName);
        } catch (err) {
            console.error("Failed to call waiting:", err);
        }
    };

    const handleEnter = async (bundle: BundleData, waitingNo: string) => {
        const cleanNo = waitingNo.startsWith('대기 ') ? waitingNo : `대기 ${waitingNo}`;
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, status: 'finished', store: storeName, store_id: storeId }),
            });
            onSendMessage(`${cleanNo} 입장 완료`, storeId, storeName);
        } catch (err) {
            console.error("Failed to enter waiting:", err);
        }
    };

    const handleCancel = async (bundle: BundleData, waitingNo: string) => {
        const cleanNo = waitingNo.startsWith('대기 ') ? waitingNo : `대기 ${waitingNo}`;
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, status: 'canceled', store: storeName, store_id: storeId }),
            });
            onSendMessage(`${cleanNo} 취소`, storeId, storeName);
        } catch (err) {
            console.error("Failed to cancel waiting:", err);
        }
    };

    return (
        <div className="admin-page animate-fade-in" style={{ padding: '15px' }}>
            <header className="page-header-mobile" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>🛎️ 실시간 대기 명단</h2>
                    <div style={{ 
                        background: 'rgba(249, 115, 22, 0.1)', 
                        color: 'var(--premium-orange)', 
                        padding: '6px 14px', 
                        borderRadius: '20px', 
                        fontSize: '0.85rem', 
                        fontWeight: '800' 
                    }}>
                        대기 {waitingList.length}팀
                    </div>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '5px 0 0 0' }}>고객님의 호출 및 입장 상태를 직관적으로 관리합니다.</p>
            </header>

            <div className="waiting-cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {waitingList.map((w, idx) => {
                    const nameItem = w.items?.find(i => i.name === '이름' || i.name === '예약자' || i.name.includes('고객명'));
                    const phoneItem = w.items?.find(i => i.name.includes('연락처') || i.name.includes('번호') || i.name.includes('전화'));
                    
                    // 1. 만약 한글/영문 이름이 있으면 이름 우선 표시
                    let idInfo = nameItem?.value || '';
                    
                    // 2. 만약 이름이 없고 연락처 뒷자리 등이 있으면 그것을 표시
                    if (!idInfo && phoneItem && isNaN(Number(phoneItem.value)) === false) {
                        idInfo = `손님 (${phoneItem.value.slice(-4)})`;
                    }
                    
                    // 3. 만약 이름도 연락처도 없거나 그냥 단일 숫자라면, 고유한 4자리 영숫자 티켓 번호를 결합하여 절대 중복되지 않게 생성!
                    if (!idInfo || !isNaN(Number(idInfo))) {
                        const shortId = (w.id.includes('-') ? w.id.split('-')[1] : w.id).substring(0, 4).toUpperCase();
                        const numberPrefix = idInfo ? `${idInfo}번` : `${idx + 1}번`;
                        idInfo = `대기 ${numberPrefix} [${shortId}]`;
                    }
                    
                    const headCount = w.items?.find(i => i.name.includes('인원'))?.value || '2명';
                    
                    return (
                        <div key={w.id} className="waiting-card animate-pop-in" style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                            position: 'relative'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="id-badge-new" style={{
                                        background: 'var(--primary-soft)',
                                        color: 'var(--text-main)',
                                        fontWeight: '800',
                                        fontSize: '0.8rem',
                                        padding: '4px 8px',
                                        borderRadius: '6px'
                                    }}>{idx + 1}</span>
                                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{idInfo}</strong>
                                </div>
                                <span style={{ fontSize: '0.85rem', color: 'var(--premium-orange)', fontWeight: '700' }}>
                                    👥 {headCount}
                                </span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span>🕒 {w.timestamp}</span>
                                <span style={{ opacity: 0.7 }}>(약 15분 전)</span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button className="confirm-btn premium-orange" onClick={() => handleCall(w, idInfo)} style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                                    🔔 호출
                                </button>
                                <button className="confirm-btn success-green" onClick={() => handleEnter(w, idInfo)} style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                                    🚀 입장
                                </button>
                                <button className="del-btn" onClick={() => handleCancel(w, idInfo)} style={{ width: '44px', height: '38px', padding: 0, fontSize: '1.2rem', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
                        <p style={{ fontSize: '0.8rem', margin: 0 }}>AI 콘솔에 "3명 대기 등록"과 같이 입력하면 추가됩니다.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
