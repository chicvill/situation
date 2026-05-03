import React, { useState } from 'react';
import './Login.css';

interface LoginProps {
    onLogin: (user: any) => void;
    bundles: any[];
}

export const Login: React.FC<LoginProps> = ({ onLogin, bundles }) => {
    const [id, setId] = useState('');
    const [pw, setPw] = useState('');
    const [error, setError] = useState('');
    const [isSignup, setIsSignup] = useState(false);
    
    // 회원가입 필드
    const [name, setName] = useState('');
    const [role, setRole] = useState('staff');
    const [storeName, setStoreName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        // 지식 풀에서 사용자 정보 검색 (PersonalInfos 타입)
        const userBundle = bundles.find(b => 
            b.type === 'PersonalInfos' && 
            b.items.find((i: any) => i.name === '아이디')?.value === id &&
            b.items.find((i: any) => i.name === '비밀번호')?.value === pw
        );

        if (userBundle) {
            const status = userBundle.status || 'pending';
            const userRole = userBundle.items.find((i: any) => i.name === '권한')?.value || 'staff';
            const userName = userBundle.items.find((i: any) => i.name === '이름')?.value || id;

            if (status !== 'approved' && userRole !== 'admin') {
                if (userRole === 'owner') {
                    setError('점주 계정은 시스템 관리자(Admin)의 승인이 필요합니다.');
                } else {
                    setError('점장/점원 계정은 매장 점주(Owner)의 승인이 필요합니다.');
                }
                return;
            }

            onLogin({ id, name: userName, role: userRole, storeId: userBundle.store_id, storeName: userBundle.store });
        } else if (id === 'admin' && pw === '1212') {
            // 마스터 계정 (초기용)
            onLogin({ id: 'admin', name: '마스터관리자', role: 'admin' });
        } else {
            setError('아이디 또는 비밀번호가 일치하지 않습니다.');
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        setError('');

        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            
            // 중복 아이디 확인
            const existing = bundles.find(b => 
                b.type === 'PersonalInfos' && 
                b.items.find((i: any) => i.name === '아이디')?.value === id
            );

            if (existing) {
                setError('이미 존재하는 아이디입니다.');
                setIsProcessing(false);
                return;
            }

            const signupBundle = {
                id: `USER-${Date.now()}`,
                type: 'PersonalInfos',
                title: `${name}님 가입 신청`,
                items: [
                    { name: '이름', value: name },
                    { name: '아이디', value: id },
                    { name: '비밀번호', value: pw },
                    { name: '권한', value: role }
                ],
                status: 'pending',
                timestamp: new Date().toLocaleString(),
                store: storeName || '미지정',
                store_id: role === 'owner' ? `store-${id}` : '' // 점주는 자신의 ID 기반 매장 ID 가짐
            };

            const response = await fetch(`${apiUrl}/api/bundle/${signupBundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signupBundle),
            });

            if (response.ok) {
                alert('✅ 회원가입 신청이 완료되었습니다.\n승인 후 이용 가능합니다.');
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
                                onChange={(e) => setName(e.target.value)} 
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
                                <input 
                                    type="text" 
                                    value={storeName} 
                                    onChange={(e) => setStoreName(e.target.value)} 
                                    placeholder="매장 이름을 입력하세요"
                                    required 
                                />
                            </div>
                        </>
                    )}
                    
                    {error && <div className="login-error">{error}</div>}
                    
                    <button type="submit" className="login-btn" disabled={isProcessing}>
                        {isProcessing ? '처리 중...' : (isSignup ? '회원 가입 신청' : '로그인')}
                    </button>
                    
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
        </div>
    );
};
