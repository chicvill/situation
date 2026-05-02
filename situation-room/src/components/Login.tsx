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

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        
        // 지식 풀에서 사용자 정보 검색 (PersonalInfos 타입)
        const userBundle = bundles.find(b => 
            b.type === 'PersonalInfos' && 
            b.items.find((i: any) => i.name === '아이디')?.value === id &&
            b.items.find((i: any) => i.name === '비밀번호')?.value === pw
        );

        if (userBundle) {
            const status = userBundle.status || 'pending';
            const role = userBundle.items.find((i: any) => i.name === '권한')?.value || 'staff';
            const name = userBundle.items.find((i: any) => i.name === '이름')?.value || id;

            if (status !== 'approved' && role !== 'admin') {
                if (role === 'owner') {
                    setError('점주 계정은 시스템 관리자(Admin)의 승인이 필요합니다.');
                } else {
                    setError('점장/점원 계정은 매장 점주(Owner)의 승인이 필요합니다.');
                }
                return;
            }

            onLogin({ id, name, role, storeId: userBundle.store_id, storeName: userBundle.store });
        } else if (id === 'admin' && pw === '1212') {
            // 마스터 계정 (초기용)
            onLogin({ id: 'admin', name: '마스터관리자', role: 'admin' });
        } else {
            setError('아이디 또는 비밀번호가 일치하지 않습니다.');
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

                <form onSubmit={handleLogin}>
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
                    
                    {error && <div className="login-error">{error}</div>}
                    
                    <button type="submit" className="login-btn">로그인</button>
                    <div style={{ marginTop: '15px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
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
