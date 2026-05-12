import React, { useState, useEffect } from 'react';

interface WelcomeHubProps {
  user: any;
  bundles: any[];
  storeName: string;
  onNavigate: (tab: any) => void;
  onProfileUpdated: (updatedUser: any) => void;
  onLogout: () => void;
}

const hashPassword = async (password: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const WelcomeHub: React.FC<WelcomeHubProps> = ({
  user,
  bundles,
  storeName,
  onNavigate,
  onProfileUpdated,
  onLogout
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // Editable fields
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [editedStoreName, setEditedStoreName] = useState('');

  // Find the user's corresponding PersonalInfos bundle
  const userBundle = bundles.find(
    (b) =>
      b.type === 'PersonalInfos' &&
      b.items.find((i: any) => i.name === '아이디')?.value === user?.id
  );

  // Initialize fields on modal open
  useEffect(() => {
    if (showEditModal && userBundle) {
      const currentName = userBundle.items.find((i: any) => i.name === '이름')?.value || user.name || '';
      setName(currentName);
      setPassword(''); // 보안 강화를 위해 비밀번호 입력창은 항상 비워둔 뒤 변경 시에만 가로챕니다.
      setEditedStoreName(userBundle.store || storeName || '');
    }
  }, [showEditModal, userBundle, user, storeName]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    if (!password.trim()) {
      setError('비밀번호를 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      
      const currentHashedPw = userBundle.items.find((i: any) => i.name === '비밀번호')?.value || '';
      const finalHashedPw = password.trim() ? await hashPassword(password) : currentHashedPw;

      // Update items inside PersonalInfos bundle
      const updatedItems = userBundle.items.map((item: any) => {
        if (item.name === '이름') return { ...item, value: name };
        if (item.name === '비밀번호') return { ...item, value: finalHashedPw };
        return item;
      });

      const updatedBundle = {
        ...userBundle,
        title: `${name}님 가입 정보 (수정)`,
        items: updatedItems,
        store: editedStoreName,
        timestamp: new Date().toLocaleString()
      };

      // Save to server
      const response = await fetch(`${apiUrl}/api/bundle/${userBundle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBundle)
      });

      if (!response.ok) {
        throw new Error('프로필 업데이트에 실패했습니다.');
      }

      // Update React session state in App.tsx
      const updatedUserSession = {
        ...user,
        name: name,
        storeName: editedStoreName
      };
      
      onProfileUpdated(updatedUserSession);
      alert('✨ 개인정보 수정이 완료되었습니다!');
      setShowEditModal(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '서버 통신 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter pending staff/managers for this store (for owner role)
  const pendingStaffList = React.useMemo(() => {
    if (user?.role !== 'owner') return [];
    return bundles.filter(b => {
      if (b.type !== 'PersonalInfos' || b.status === 'approved') return false;
      // Filter for managers and staff of the owner's store
      if (b.store_id !== user.storeId) return false;
      const role = b.items.find((i: any) => i.name === '권한')?.value;
      return role === 'manager' || role === 'staff';
    });
  }, [bundles, user]);

  // Filter pending owners (for admin role)
  const pendingOwnerList = React.useMemo(() => {
    if (user?.role !== 'admin') return [];
    return bundles.filter(b => {
      if (b.type !== 'PersonalInfos' || b.status === 'approved') return false;
      const role = b.items.find((i: any) => i.name === '권한')?.value;
      return role === 'owner';
    });
  }, [bundles, user]);

  const handleApproveStaff = async (bundle: any) => {
    const staffName = bundle.items.find((i: any) => i.name === '이름')?.value || '-';
    if (!window.confirm(`✨ ${staffName} 사원의 가입 신청을 승인하시겠습니까?`)) return;

    setIsProcessing(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      
      // Update the PersonalInfos bundle status to approved
      const response = await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bundle,
          status: 'approved',
          store: user.storeName || bundle.store,
          store_id: user.storeId || bundle.store_id
        }),
      });

      if (!response.ok) {
        throw new Error('가입 승인 처리에 실패했습니다.');
      }

      alert(`🎉 ${staffName} 사원의 가입 승인이 완료되었습니다!\n이제 해당 사원은 본인 계정으로 출퇴근 및 근무 관리가 가능합니다.`);
    } catch (err: any) {
      console.error(err);
      alert(`❌ 오류: ${err.message || '가입 승인 중 통신 실패'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveOwner = async (bundle: any) => {
    const ownerName = bundle.items.find((i: any) => i.name === '이름')?.value || '-';
    if (!window.confirm(`✨ ${ownerName} 사장님의 가입 신청을 승인하고 매장 등록 페이지로 이동하시겠습니까?`)) return;

    setIsProcessing(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      
      const response = await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bundle, status: 'approved' }),
      });

      if (!response.ok) {
        throw new Error('점주 가입 승인 처리에 실패했습니다.');
      }

      alert(`🎉 ${ownerName} 사장님 가입 승인이 완료되었습니다!\n신규 매장 생성을 완료하기 위해 매장 등록 화면으로 이동합니다.`);
      onNavigate('admin'); // Navigate to the AdminStoreManager
    } catch (err: any) {
      console.error(err);
      alert(`❌ 오류: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Get dynamic greeting based on time of day
  const getGreetingMessage = () => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 11) return '🌞 상쾌하고 기분 좋은 아침입니다!';
    if (hours >= 11 && hours < 17) return '☕ 활기차고 파이팅 넘치는 오후입니다!';
    if (hours >= 17 && hours < 22) return '✨ 오늘 하루도 수고 많으셨습니다, 저녁 시간 화이팅!';
    return '🌙 차분하고 평온한 밤입니다. 밤샘 근무 화이팅!';
  };

  // Role names mapping
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return '시스템 최고관리자';
      case 'owner': return '가맹점주';
      case 'manager': return '매장 매니저';
      case 'staff': return '매장 점원';
      default: return '사용자';
    }
  };

  // List of quick actions based on roles
  const getQuickLinks = () => {
    const links = [];
    
    // Core navigation
    links.push({ label: '📝 실시간 주문 접수', tab: 'orderV2', desc: '고객 주문 상태 및 결제 승인', icon: '🛒' });
    links.push({ label: '👨‍🍳 주방 모니터', tab: 'kitchen', desc: '실시간 요리 현황 및 제조 대기', icon: '🍲' });
    links.push({ label: '🔔 매장 호출 접수', tab: 'call', desc: '테이블 벨 및 직원 긴급 호출', icon: '🛎️' });
    links.push({ label: '📜 매장 운영 매뉴얼', tab: 'manual', desc: '편의시설 비번 및 가이드 확인', icon: '📖' });

    if (user.role === 'owner' || user.role === 'admin') {
      links.push({ label: '💰 카운터 POS 패드', tab: 'counter', desc: '테이블 결제 완료 및 세션 관리', icon: '💵' });
      links.push({ label: '👥 인적 자원 관리', tab: 'hr', desc: '사원 등록, 시급 세팅 및 출퇴근 확인', icon: '👥' });
      links.push({ label: '🖨️ QR 간편 인쇄', tab: 'qr', desc: '테이블 주문용 QR 코드 자동 생성', icon: '🔳' });
      links.push({ label: '🚗 셀프 주차 관리', tab: 'parking', desc: '무료 주차 등록 및 차량 조회', icon: '🅿️' });
    }

    if (user.role === 'admin') {
      links.push({ label: '🧠 AI 지식 인벤토리', tab: 'inventory', desc: '상황 판단 추론 룰 관리', icon: '⚡' });
      links.push({ label: '🏢 플랫폼 매장 관리', tab: 'admin', desc: '가맹점 요금 상태 및 등록 매장 제어', icon: '🏛️' });
    }

    return links;
  };

  return (
    <div className="welcome-hub-container animate-fade-in" style={{ padding: '25px', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* 1. Header with Edit Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '900', margin: 0, background: 'linear-gradient(135deg, var(--text-main), var(--accent-orange))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            MQnet Welcome Hub
          </h2>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>스마트 매장 통합 상황실에 오신 것을 환영합니다</p>
        </div>
        <button 
          onClick={() => setShowEditModal(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(249, 115, 22, 0.05))',
            border: '1.5px solid var(--accent-orange)',
            color: 'var(--accent-orange)',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 15px rgba(249, 115, 22, 0.05)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(249, 115, 22, 0.25), rgba(249, 115, 22, 0.1))';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(249, 115, 22, 0.05))';
          }}
        >
          👤 개인정보 편집
        </button>
      </div>

      {/* 2. Welcome Banner Card */}
      <div 
        className="glass-panel" 
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01))',
          borderRadius: '24px',
          padding: '30px',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.06)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '35px',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🍀</div>
        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', margin: '0 0 10px 0', color: 'var(--text-main)' }}>
          반갑습니다, <span style={{ color: 'var(--accent-orange)' }}>{user?.name || '직원'}</span>님!
        </h3>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', margin: '0 0 20px 0', lineHeight: '1.5' }}>
          {getGreetingMessage()}<br />
          현재 접속 계정 권한은 <strong style={{ color: 'var(--text-main)' }}>[{getRoleBadge(user?.role)}]</strong> 이며, <strong style={{ color: 'var(--text-main)' }}>{storeName || '미지정'}</strong> 매장에 연결되어 있습니다.
        </p>

        <div style={{ display: 'inline-flex', gap: '15px' }}>
          <button 
            onClick={() => onNavigate('guide')}
            className="confirm-btn success-green"
            style={{ padding: '10px 24px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '800' }}
          >
            🎙️ AI 비서와 대화하기
          </button>
          <button 
            onClick={onLogout}
            className="del-btn"
            style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '800', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            🔓 로그아웃
          </button>
        </div>
      </div>

      {/* 2.5 Pending Approvals Card (for Owner / Admin) */}
      {((user?.role === 'owner' && pendingStaffList.length > 0) || (user?.role === 'admin' && pendingOwnerList.length > 0)) && (
        <div 
          className="glass-panel animate-fade-in"
          style={{
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(249, 115, 22, 0.04))',
            border: '2px solid var(--accent-orange)',
            borderRadius: '24px',
            padding: '24px',
            marginBottom: '35px',
            boxShadow: '0 12px 30px rgba(249, 115, 22, 0.1)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Subtle glow/sparkle animation background element */}
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.15)', filter: 'blur(30px)', pointerEvents: 'none' }}></div>
          
          <h4 style={{ fontSize: '1.15rem', fontWeight: '900', margin: '0 0 16px 0', color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span> 신규 회원 가입 승인 대기중
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {user?.role === 'owner' && pendingStaffList.map(b => {
              const staffName = b.items.find((i: any) => i.name === '이름')?.value || '-';
              const requestedRole = b.items.find((i: any) => i.name === '권한')?.value === 'manager' ? '점장' : '점원';
              const signupId = b.items.find((i: any) => i.name === '아이디')?.value || '-';
              
              return (
                <div 
                  key={b.id}
                  style={{
                    background: 'rgba(0,0,0,0.15)',
                    padding: '16px 20px',
                    borderRadius: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid rgba(249, 115, 22, 0.15)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{staffName}님 가입 신청</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '10px' }}>
                      <span>희망직책: <strong style={{ color: 'var(--accent-orange)' }}>{requestedRole}</strong></span>
                      <span>•</span>
                      <span>아이디: <strong style={{ color: 'var(--text-main)' }}>{signupId}</strong></span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleApproveStaff(b)}
                    disabled={isProcessing}
                    style={{
                      background: 'var(--success)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 18px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    ✨ 즉시 승인
                  </button>
                </div>
              );
            })}

            {user?.role === 'admin' && pendingOwnerList.map(b => {
              const ownerNameVal = b.items.find((i: any) => i.name === '이름')?.value || '-';
              const signupId = b.items.find((i: any) => i.name === '아이디')?.value || '-';
              const businessNo = b.items.find((i: any) => i.name === '사업자번호')?.value || '-';
              
              return (
                <div 
                  key={b.id}
                  style={{
                    background: 'rgba(0,0,0,0.15)',
                    padding: '16px 20px',
                    borderRadius: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid rgba(249, 115, 22, 0.15)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{ownerNameVal}님 가입 신청 (점주)</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '10px' }}>
                      <span>아이디: <strong style={{ color: 'var(--text-main)' }}>{signupId}</strong></span>
                      <span>•</span>
                      <span>사업자번호: <strong style={{ color: 'var(--text-main)' }}>{businessNo}</strong></span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleApproveOwner(b)}
                    disabled={isProcessing}
                    style={{
                      background: 'var(--success)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '8px 18px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    ✨ 즉시 승인 및 매장 등록
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Quick Links Section */}
      <div>
        <h4 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 20px 0', color: 'var(--text-main)' }}>
          ⚡ 역할 맞춤형 원클릭 이동
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          {getQuickLinks().map((link, idx) => (
            <div 
              key={idx}
              onClick={() => onNavigate(link.tab)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '16px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = 'var(--accent-orange)';
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(249, 115, 22, 0.06)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.02)';
              }}
            >
              <span style={{ fontSize: '1.8rem' }}>{link.icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)' }}>{link.label}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{link.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Beautiful Glassmorphism Edit Profile Modal */}
      {showEditModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div 
            className="glass-panel"
            style={{
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: '24px',
              padding: '30px',
              width: '100%',
              maxWidth: '450px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
          >
            <button 
              onClick={() => setShowEditModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '1.2rem',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: '1.3rem', fontWeight: '900', margin: '0 0 10px 0', color: 'var(--text-main)', textAlign: 'center' }}>
              👤 개인 정보 수정
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 25px 0' }}>
              계정 정보를 안전하게 수정하고 저장할 수 있습니다.
            </p>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' }}>
              
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>아이디 (수정 불가)</label>
                <input 
                  type="text" 
                  value={user?.id || ''} 
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    fontSize: '0.9rem',
                    cursor: 'not-allowed'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>이름</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="새로운 이름을 입력해 주세요"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'var(--surface)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent-orange)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>비밀번호</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="기존 비밀번호 유지 (변경할 때만 입력)"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'var(--surface)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent-orange)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              {user?.role !== 'admin' && user?.role !== 'owner' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>근무 매장</label>
                  <input 
                    type="text" 
                    value={editedStoreName} 
                    onChange={(e) => setEditedStoreName(e.target.value)}
                    placeholder="소속 매장명을 입력해 주세요"
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '12px',
                      background: 'var(--surface)',
                      border: '1.5px solid var(--border)',
                      color: 'var(--text-main)',
                      fontSize: '0.9rem',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent-orange)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              )}

              {error && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: '700', textAlign: 'center', margin: '5px 0' }}>
                  ⚠️ {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSaving}
                className="confirm-btn success-green"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: '800',
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isSaving ? '저장하는 중...' : '💾 개인정보 저장하기'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
