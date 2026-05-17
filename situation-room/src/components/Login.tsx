import React, { useState } from 'react';
import './Login.css';
import { OwnerOnboardingChat } from './OwnerOnboardingChat';

interface LoginProps {
    onLogin: (user: any) => void;
    bundles: any[];
}

const hashPassword = async (password: string): Promise<string> => {
    if (!crypto?.subtle) return password; // HTTP(비보안) 환경 폴백: 평문 그대로 반환
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const Login: React.FC<LoginProps> = ({ onLogin, bundles }) => {
    const [id, setId] = useState('');
    const [pw, setPw] = useState('');
    const [error, setError] = useState('');
    const [isSignup, setIsSignup] = useState(false);
    const [showOnboardingChat, setShowOnboardingChat] = useState(() => {
        return localStorage.getItem('situation_show_onboarding_chat') === 'true';
    });
    
    // 회원가입 필드
    const [name, setName] = useState('');
    const [role, setRole] = useState('staff');
    const [storeName, setStoreName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // 사업자 인증 필드 (점주용)
    const [regNo, setRegNo] = useState('');
    const [openDate, setOpenDate] = useState('');
    const [isVerified, setIsVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    // bundles에서 동적으로 매장 목록 수집
    const availableStores = React.useMemo(() => {
        const storesMap = new Map<string, string>(); // storeName -> storeId
        bundles.forEach(b => {
            if (b.store && b.store !== 'Total' && b.store_id) {
                storesMap.set(b.store, b.store_id);
            }
        });
        return Array.from(storesMap.entries()).map(([name, id]) => ({ name, id }));
    }, [bundles]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const hashedPw = await hashPassword(pw);

        // 1. 서버에서 JWT 발급 (자격증명 검증 + 토큰 발급)
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const res = await fetch(`${apiUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, password: hashedPw }),
            });

            if (res.ok) {
                const { token, role, store_id, name: userName } = await res.json();
                localStorage.setItem('mqnet_token', token);
                const matchedBundle = bundles.find(b => b.type === 'PersonalInfos' && b.store_id === store_id);
                onLogin({ id, name: userName, role, storeId: store_id, storeName: matchedBundle?.store ?? '' });
                return;
            }

            const err = await res.json().catch(() => ({}));
            // 403 = 승인 대기
            if (res.status === 403) {
                setError(err.detail || '승인 대기 중인 계정입니다.');
                return;
            }
        } catch {
            // 서버 미응답 시 로컬 번들로 폴백
        }

        // 2. 폴백: 서버 연결 실패 시 번들에서 로컬 검증
        const userBundle = bundles.find(b => {
            if (b.type !== 'PersonalInfos') return false;
            const bId = b.items?.find((i: any) => i.name === '아이디')?.value;
            const bPw = b.items?.find((i: any) => i.name === '비밀번호')?.value;
            return bId === id && (bPw === hashedPw || bPw === pw);
        });

        if (userBundle) {
            const status = userBundle.status || 'pending';
            const userRole = userBundle.items?.find((i: any) => i.name === '권한')?.value || 'staff';
            const userName = userBundle.items?.find((i: any) => i.name === '이름')?.value || id;

            if (status !== 'approved' && userRole !== 'admin') {
                setError(userRole === 'owner'
                    ? '점주 계정은 시스템 관리자(Admin)의 승인이 필요합니다.'
                    : '점장/점원 계정은 매장 점주(Owner)의 승인이 필요합니다.');
                return;
            }

            onLogin({ id, name: userName, role: userRole, storeId: userBundle.store_id, storeName: userBundle.store });
        } else {
            setError('아이디 또는 비밀번호가 일치하지 않습니다.');
        }
    };

    const handleVerifyBusiness = async () => {
        const cleanRegNo = regNo.replace(/[^0-9]/g, '').trim();
        const cleanOpenDate = openDate.replace(/[^0-9]/g, '').trim();
        const cleanOwnerName = name.trim();

        if (!cleanRegNo || !cleanOpenDate || !cleanOwnerName) {
            alert("⚠️ 사업자번호, 개업일자, 대표자명(이름)이 모두 필요합니다.");
            return;
        }

        if (cleanRegNo.length !== 10) {
            alert("⚠️ 사업자등록번호는 하이픈 제외 반드시 10자리 숫자여야 국세청 조회가 가능합니다. 입력값(현재 " + cleanRegNo.length + "자리)을 확인해 주세요.");
            return;
        }

        if (cleanOpenDate.length !== 8) {
            alert("⚠️ 개업연월일은 반드시 YYYYMMDD 형태의 8자리 숫자여야 국세청 조회가 가능합니다. 입력값(현재 " + cleanOpenDate.length + "자리)을 확인해 주세요.");
            return;
        }

        setIsVerifying(true);
        await new Promise(r => setTimeout(r, 1800));

        try {
            const SERVICE_KEY = import.meta.env.VITE_DATA_GO_KR_SERVICE_KEY;
            
            if (!SERVICE_KEY || SERVICE_KEY === "your_key_here") {
                setIsVerified(true);
                console.log("Business verified (Test Mode)");
                alert("✅ [테스트 모드] 사업자 정보가 확인되었습니다.");
                return;
            }

            const encodedKey = encodeURIComponent(SERVICE_KEY);
            const cleanStoreName = (storeName || '').trim();

            const response = await fetch(`https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=${encodedKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businesses: [{
                        b_no: cleanRegNo,
                        start_dt: cleanOpenDate,
                        p_nm: cleanOwnerName,
                        b_nm: cleanStoreName,
                        p_nm2: '',
                        corp_no: '',
                        b_sector: '',
                        b_type: ''
                    }]
                })
            });

            const result = await response.json();
            if (result.data && result.data[0].valid === '01') {
                setIsVerified(true);
                console.log("Business verified (NTS API)");
                alert("✅ 사업자 정보가 국세청 데이터를 통해 검증되었습니다.");
            } else {
                console.warn("Business verification failed:", result);
                const errMsg = result.message || (result.data && result.data[0].valid_msg) || "입력하신 정보를 다시 확인해 주세요.";
                alert(`⚠️ 사업자 정보가 국세청 데이터와 일치하지 않습니다.\n\n${errMsg}`);
            }
        } catch (err) {
            alert("⚠️ 국세청 API 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        if (role === 'owner' && !isVerified) {
            console.error("Signup blocked: Business not verified");
            setError('점주 가입을 위해 먼저 사업자 진위 확인을 완료해 주세요.');
            return;
        }

        setIsProcessing(true);
        setError('');

        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            
            // 중복 아이디 확인
            const existing = bundles.find(b => 
                b.type === 'PersonalInfos' && 
                b.items?.find((i: any) => i.name === '아이디')?.value === id
            );

            if (existing) {
                setError('이미 존재하는 아이디입니다.');
                setIsProcessing(false);
                return;
            }

            // 선택된 매장의 store_id 정밀 연동 및 대입 (점장/직원 회원가입 매칭)
            let finalStoreId = '';
            if (role === 'owner') {
                finalStoreId = `store-${id}`;
            } else {
                const matchedStore = availableStores.find(st => st.name === storeName);
                finalStoreId = matchedStore ? matchedStore.id : '';
            }

            const hashedSignupPw = await hashPassword(pw);

            const signupBundle = {
                id: `USER-${Date.now()}`,
                type: 'PersonalInfos',
                title: role === 'owner' ? `${name}님 가입 완료 (점주)` : `${name}님 가입 신청`,
                items: [
                    { name: '이름', value: name },
                    { name: '아이디', value: id },
                    { name: '비밀번호', value: hashedSignupPw },
                    { name: '권한', value: role },
                    { name: '사업자번호', value: regNo },
                    { name: '개업일자', value: openDate }
                ],
                status: role === 'owner' ? 'approved' : 'pending',
                timestamp: new Date().toLocaleString(),
                store: storeName || '미지정',
                store_id: finalStoreId
            };

            const response = await fetch(`${apiUrl}/api/bundle/${signupBundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signupBundle),
            });

            if (response.ok) {
                if (role === 'owner') {
                    alert('🎉 회원가입이 완료되었습니다!\n바로 로그인하여 나만의 매장을 개설(내 집 짓기)하세요.');
                } else {
                    alert('✅ 사원 가입 신청이 완료되었습니다.\n점주님의 최종 승인 후 대시보드 로그인이 가능합니다.');
                }
                setIsSignup(false);
                setPw('');
            } else {
                throw new Error('Server error');
            }
        } catch (err) {
            setError('회원가입 처리 중 오류가 발생했습니다.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="login-container animate-fade-in">
            <div className="login-glass-panel">
                <div className="login-header">
                    <div className="logo-icon">🔒</div>
                    <h1>MQnet <span>service</span></h1>
                    <p>지능형 매장 운영 시스템 로그인</p>
                </div>

                <form onSubmit={isSignup ? handleSignup : handleLogin}>
                    {isSignup && (
                        <div className="input-group">
                            <label>이름</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={(e) => { setName(e.target.value); setIsVerified(false); }} 
                                placeholder="실명을 입력하세요"
                                required 
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <label>아이디</label>
                        <input 
                            type="text" 
                            value={id} 
                            onChange={(e) => setId(e.target.value)} 
                            placeholder="ID를 입력하세요"
                            required 
                        />
                    </div>
                    <div className="input-group">
                        <label>비밀번호</label>
                        <input 
                            type="password" 
                            value={pw} 
                            onChange={(e) => setPw(e.target.value)} 
                            placeholder="••••••••"
                            required 
                        />
                    </div>

                    {isSignup && (
                        <>
                            <div className="input-group">
                                <label>계정 권한</label>
                                <select 
                                    className="role-select"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                >
                                    <option value="owner">점주 (Admin 승인)</option>
                                    <option value="manager">점장 (Owner 승인)</option>
                                    <option value="staff">점원 (Owner 승인)</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>{role === 'owner' ? '신규 매장명' : '소속 매장명'}</label>
                                {role === 'owner' ? (
                                    <input 
                                        type="text" 
                                        value={storeName} 
                                        onChange={(e) => setStoreName(e.target.value)} 
                                        placeholder="매장 이름을 직접 입력하세요"
                                        required 
                                    />
                                ) : (
                                    <select
                                        className="role-select"
                                        value={storeName}
                                        onChange={(e) => {
                                            setStoreName(e.target.value);
                                        }}
                                        required
                                    >
                                        <option value="">-- 소속 매장을 선택하세요 --</option>
                                        {availableStores.map((st, idx) => (
                                            <option key={idx} value={st.name}>
                                                {st.name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {role === 'owner' && (
                                <>
                                    <div className="input-group">
                                        <label>사업자 등록번호</label>
                                        <input 
                                            type="text" 
                                            value={regNo} 
                                            onChange={(e) => { setRegNo(e.target.value); setIsVerified(false); }} 
                                            placeholder="000-00-00000"
                                            required 
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>개업연월일</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input 
                                                type="text" 
                                                value={openDate} 
                                                onChange={(e) => { setOpenDate(e.target.value); setIsVerified(false); }} 
                                                placeholder="YYYYMMDD (8자리)"
                                                style={{ flex: 1 }}
                                                required 
                                            />
                                            <button 
                                                type="button"
                                                onClick={handleVerifyBusiness}
                                                disabled={isVerifying || isVerified}
                                                style={{ 
                                                    padding: '0 15px', borderRadius: 'var(--radius-sm)', border: 'none',
                                                    background: isVerified ? 'var(--success)' : 'var(--primary)',
                                                    color: 'white', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {isVerifying ? '확인 중...' : isVerified ? '✅ 완료' : '진위 확인'}
                                            </button>
                                        </div>
                                    </div>
                                    {isVerified && <p style={{ fontSize: '0.8rem', color: 'var(--success)', margin: '5px 0 0 0', textAlign: 'left' }}>✅ 국세청 데이터와 일치함이 확인되었습니다.</p>}
                                </>
                            )}
                        </>
                    )}
                    
                    {error && <div className="login-error">{error}</div>}
                    
                    <button type="submit" className="login-btn" disabled={isProcessing}>
                        {isProcessing ? '처리 중...' : (isSignup ? '회원 가입 신청' : '로그인')}
                    </button>

                    {!isSignup && (
                        <button 
                            type="button" 
                            className="onboarding-launch-btn" 
                            onClick={() => {
                                setShowOnboardingChat(true);
                                localStorage.setItem('situation_show_onboarding_chat', 'true');
                            }}
                            style={{
                                width: '100%',
                                marginTop: '12px',
                                padding: '16px',
                                background: '#FEE500',
                                color: '#191919',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.95rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                boxShadow: '0 4px 15px rgba(254, 229, 0, 0.12)',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            🎙️ AI 비서와 새로운 매장 개설하기 (3분 완공)
                        </button>
                    )}
                    
                    <div className="signup-toggle">
                        {isSignup ? (
                            <>이미 계정이 있으신가요? <span onClick={() => setIsSignup(false)}>로그인하기</span></>
                        ) : (
                            <>처음이신가요? <span onClick={() => setIsSignup(true)}>회원 가입하기</span></>
                        )}
                    </div>

                    <div style={{ marginTop: '25px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        mqnet@naver.com
                    </div>
                </form>

                <div className="login-footer">
                    <p>계정 분실 시 관리자에게 문의하세요.</p>
                </div>
            </div>

            {showOnboardingChat && (
                <OwnerOnboardingChat 
                    onClose={() => {
                        setShowOnboardingChat(false);
                        localStorage.setItem('situation_show_onboarding_chat', 'false');
                    }}
                    onOnboardingComplete={(userProfile) => {
                        // 🌟 회원가입/개설이 완료되면 관련된 모든 onboarding 캐시를 완전히 청소합니다.
                        Object.keys(localStorage).forEach(key => {
                            if (key.startsWith('mqonboard_')) {
                                localStorage.removeItem(key);
                            }
                        });
                        localStorage.setItem('situation_show_onboarding_chat', 'false');
                        setShowOnboardingChat(false);
                        onLogin(userProfile);
                    }}
                    bundles={bundles}
                />
            )}
        </div>
    );
};
