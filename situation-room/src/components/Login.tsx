import React, { useState } from 'react';
import './Login.css';
import { OwnerOnboardingChat } from './OwnerOnboardingChat';
import { API_BASE } from '../config';

interface LoginProps {
    onLogin: (user: any) => void;
    bundles: any[];
    onGoToSignup: () => void;
}

const hashPassword = async (password: string): Promise<string> => {
    if (!crypto?.subtle) return password; // HTTP fallback
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const Login: React.FC<LoginProps> = ({ onLogin, bundles, onGoToSignup }) => {
    const [id, setId] = useState('');
    const [pw, setPw] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showOnboardingChat, setShowOnboardingChat] = useState(() => {
        return localStorage.getItem('situation_show_onboarding_chat') === 'true';
    });

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoggingIn(true);

        const hashedPw = await hashPassword(pw);

        // 1. 서버에서 JWT 발급
        try {
            const apiUrl = API_BASE;
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
                setIsLoggingIn(false);
                return;
            }

            const err = await res.json().catch(() => ({}));
            if (res.status === 403) {
                setError(err.detail || '승인 대기 중인 계정입니다.');
                setIsLoggingIn(false);
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
                const msg =
                    userRole === 'owner'   ? '점주 계정은 시스템 관리자(Admin)의 승인이 필요합니다.' :
                    userRole === 'manager' ? '점장 계정은 매장 점주의 승인이 필요합니다.' :
                                            '점원 계정은 매장 점주 또는 점장의 승인이 필요합니다.';
                setError(msg);
                setIsLoggingIn(false);
                return;
            }

            onLogin({ id, name: userName, role: userRole, storeId: userBundle.store_id, storeName: userBundle.store });
        } else {
            setError('아이디 또는 비밀번호가 일치하지 않습니다.');
        }
        setIsLoggingIn(false);
    };

    return (
        <div className="login-container animate-fade-in">
            <div className="login-glass-panel">
                <div className="login-header">
                    <div className="logo-icon">🔒</div>
                    <h1>MQnet <span>service</span></h1>
                    <p>지능형 매장 운영 시스템 로그인</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label>아이디 (휴대폰 번호)</label>
                        <input
                            type="tel"
                            value={id}
                            onChange={(e) => setId(e.target.value)}
                            placeholder="휴대폰 번호 입력"
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

                    {error && <div className="login-error">{error}</div>}

                    <button type="submit" className="login-btn" disabled={isLoggingIn}>
                        {isLoggingIn ? '로그인 중...' : '로그인'}
                    </button>

                    <div style={{ margin: '24px 0 16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '20px' }}>
                        <p style={{ margin: '0 0 12px', fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', textAlign: 'center' }}>
                            처음이신가요? 3분만에 매장을 개설해 보세요
                        </p>
                        
                        <button 
                            type="button" 
                            className="login-btn" 
                            onClick={onGoToSignup}
                            style={{
                                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                boxShadow: '0 4px 15px rgba(29, 78, 216, 0.25)',
                                marginBottom: '10px'
                            }}
                        >
                            ✍️ 전자계약 및 매장 개설 (3분 완료)
                        </button>

                        <button 
                            type="button" 
                            className="onboarding-launch-btn" 
                            onClick={() => {
                                setShowOnboardingChat(true);
                                localStorage.setItem('situation_show_onboarding_chat', 'true');
                            }}
                            style={{
                                width: '100%',
                                padding: '14px',
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
                            🎙️ AI 비서와 매장 개설 (음성 대화)
                        </button>
                    </div>

                    <div style={{ marginTop: '25px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
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
