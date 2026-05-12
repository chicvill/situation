import React, { useState, useEffect } from 'react';

interface WelcomeHubProps {
  user: any;
  bundles: any[];
  storeName: string;
  storeDetails?: any;
  onReloadStoreDetails?: () => void;
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
  storeDetails,
  onReloadStoreDetails,
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

  // Store Creation Form state (For Owner's "내 집 짓기" flow!)
  const [newStoreId, setNewStoreId] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newBizNo, setNewBizNo] = useState('');
  const [newOpenDate, setNewOpenDate] = useState('');
  const [newTablesConfig, setNewTablesConfig] = useState('1번: 4인석, 2번: 2인석, 3번: 4인석, 4번: 4인석, 5번: 2인석, 6번: 6인석');
  const [isBuildingHouse, setIsBuildingHouse] = useState(false);
  const [buildError, setBuildError] = useState('');

  // QR 인쇄 완료 여부 추적 상태 (localStorage 영구 보존)
  const [isStep3Done, setIsStep3Done] = useState(() => {
    try {
      return localStorage.getItem(`mqnet_step3_done_${user?.id}`) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (user?.id) {
      try {
        setIsStep3Done(localStorage.getItem(`mqnet_step3_done_${user.id}`) === 'true');
      } catch (e) {
        console.error(e);
      }
    }
  }, [user]);

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
      setPassword(''); 
      setEditedStoreName(userBundle.store || storeName || '');
    }
  }, [showEditModal, userBundle, user, storeName]);

  // Pre-populate "내 집 짓기" form using Owner's signup data
  useEffect(() => {
    if (user?.role === 'owner' && userBundle && !storeDetails) {
      const pOwnerName = userBundle.items.find((i: any) => i.name === '이름')?.value || user.name || '';
      const pBizNo = userBundle.items.find((i: any) => i.name === '사업자번호')?.value || '';
      const pOpenDate = userBundle.items.find((i: any) => i.name === '개업일자')?.value || '';
      
      setNewStoreId(userBundle.store_id || `store-${user.id}`);
      setNewStoreName(userBundle.store || '');
      setNewOwnerName(pOwnerName);
      setNewBizNo(pBizNo);
      setNewOpenDate(pOpenDate);
    }
  }, [user, userBundle, storeDetails]);

  const handleBuildHouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuildError('');
    if (!newStoreId.trim() || !newStoreName.trim() || !newOwnerName.trim()) {
      setBuildError('❌ 모든 필수 필드를 채워주세요.');
      return;
    }

    setIsBuildingHouse(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      
      // 1. PostgreSQL DB에 매장 등록 (POST /api/stores)
      const storePayload = {
        store_id: newStoreId,
        store_name: newStoreName,
        owner_name: newOwnerName,
        owner_id: user.id,
        monthly_fee: 50000,
        payment_status: '정상',
        payment_history: [
          {
            date: new Date().toISOString().slice(0, 10),
            amount: 50000,
            status: '완료'
          }
        ]
      };

      const storeRes = await fetch(`${apiUrl}/api/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storePayload)
      });

      if (!storeRes.ok) {
        throw new Error('데이터베이스에 매장 등록을 실패했습니다.');
      }

      // 2. 가맹 매장 세팅(StoreConfig) 번들 생성 (PUT /api/bundle/store-config-{store_id})
      const configPayload = {
        id: `store-config-${newStoreId}`,
        type: 'StoreConfig',
        title: '매장 정보',
        store: newStoreName,
        store_id: newStoreId,
        status: 'approved',
        items: [
          { name: '상호명', value: newStoreName },
          { name: '사업자번호', value: newBizNo },
          { name: '대표자', value: newOwnerName },
          { name: '개업일자', value: newOpenDate },
          { name: '테이블설정', value: newTablesConfig }
        ]
      };

      const configRes = await fetch(`${apiUrl}/api/bundle/${configPayload.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configPayload)
      });

      if (!configRes.ok) {
        throw new Error('매장 설정 번들 생성을 실패했습니다.');
      }

      // 3. 점주 회원가입 PersonalInfos 번들의 store 및 store_id도 최종 연동 업데이트
      if (userBundle) {
        const updatedBundle = {
          ...userBundle,
          store: newStoreName,
          store_id: newStoreId
        };
        await fetch(`${apiUrl}/api/bundle/${userBundle.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedBundle)
        });
      }

      // 4. 로컬 스토리지에 새 가맹점 정보 세팅하여 전역 갱신
      localStorage.setItem('mqnet_store_id', newStoreId);
      localStorage.setItem('mqnet_store_name', newStoreName);
      
      // 사용자 정보에도 storeId 및 storeName 주입하여 로컬 세션 갱신
      const updatedUser = { ...user, storeId: newStoreId, storeName: newStoreName };
      onProfileUpdated(updatedUser);

      // 세션 동기화 이벤트 송출
      window.dispatchEvent(new Event('storage'));

      alert(`🏠 축하합니다! '${newStoreName}' 매장(집)이 성공적으로 건설 및 정식 등록되었습니다.\n최초 1회 메뉴판 생성(온보딩) 단계로 자동 이동합니다.`);
      
      // 부모의 패치 트리거
      onReloadStoreDetails?.();
      
      // 메뉴 생성 탭으로 즉시 자동 온보딩 랜딩 진행
      onNavigate?.('menu');
    } catch (err: any) {
      console.error(err);
      setBuildError(`❌ 오류: ${err.message || '매장 생성 실패'}`);
    } finally {
      setIsBuildingHouse(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userBundle) {
      setError('가입 신청 정보(PersonalInfos)를 데이터베이스에서 찾을 수 없습니다.');
      return;
    }
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
    if (!window.confirm(`✨ ${ownerName} 사장님의 가입 신청을 최종 승인하시겠습니까?\n승인 완료 후 해당 사장님이 본인의 계정으로 직접 로그인하여 매장을 개설 및 설정하게 됩니다.`)) return;

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

      alert(`🎉 ${ownerName} 사장님 가입 승인이 최종 완료되었습니다!\n이제 해당 사장님이 직접 로그인하여 매장(집)을 새로 등록 및 개설하실 수 있습니다.`);
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

  // Real-time Onboarding Data Matching
  const isStep1Done = !!storeDetails;
  
  const isStep2Done = isStep1Done && bundles.some(
    b => b.type === 'Menus' && 
    (b.store_id === user?.storeId || b.store === storeName) && 
    Array.isArray(b.items) && 
    b.items.length > 0
  );

  const isStep4Done = isStep1Done && bundles.some(
    b => b.type === 'PersonalInfos' && 
    b.store_id === user?.storeId && 
    b.items.find((i: any) => i.name === '권한')?.value !== 'owner'
  );
  
  // Total progress percentage
  const totalSteps = 4;
  let completedCount = 0;
  if (isStep1Done) completedCount++;
  if (isStep2Done) completedCount++;
  if (isStep3Done) completedCount++;
  if (isStep4Done) completedCount++;
  
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

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
          {user?.role === 'owner' && !storeDetails ? (
            <span>현재 접속 계정 권한은 <strong style={{ color: 'var(--text-main)' }}>[{getRoleBadge(user?.role)}]</strong> 이며, <strong style={{ color: 'var(--accent-orange)' }}>아직 대표님의 매장(집)이 개설 및 등록되지 않았습니다. 아래 개설 신청서를 작성하여 본인만의 매장을 정식으로 완공하세요!</strong></span>
          ) : (
            <span>현재 접속 계정 권한은 <strong style={{ color: 'var(--text-main)' }}>[{getRoleBadge(user?.role)}]</strong> 이며, <strong style={{ color: 'var(--text-main)' }}>{storeName || '미지정'}</strong> 매장에 연결되어 있습니다.</span>
          )}
        </p>

        <div style={{ display: 'inline-flex', gap: '15px' }}>
          {!(user?.role === 'owner' && !storeDetails) && (
            <button 
              onClick={() => onNavigate('guide')}
              className="confirm-btn success-green"
              style={{ padding: '10px 24px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '800' }}
            >
              🎙️ AI 비서와 대화하기
            </button>
          )}
          <button 
            onClick={onLogout}
            className="del-btn"
            style={{ 
              padding: '10px 20px', 
              borderRadius: '12px', 
              fontSize: '0.9rem', 
              fontWeight: '800', 
              background: 'rgba(239, 68, 68, 0.08)', 
              color: '#ef4444', 
              border: '1px solid rgba(239, 68, 68, 0.2)',
              width: 'auto',
              whiteSpace: 'nowrap'
            }}
          >
            🔓 로그아웃
          </button>
        </div>
      </div>

      {/* 2.15 SMART OPERATION ROADMAP WIZARD (Owner Only Gamified Checklist) */}
      {user?.role === 'owner' && (
        <div 
          className="glass-panel animate-fade-in"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01))',
            borderRadius: '24px',
            padding: '28px',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.06)',
            marginBottom: '35px',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.6rem' }}>🚀</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>
                  스마트 가맹점 개설 및 운영 개시 로드맵 (Checklist)
                </h4>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  아래 4가지 기초 필수 세팅을 단계별로 가이드에 따라 완공하여 스마트 매장 자율 운영을 무결하게 시작하세요!
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: progressPercent === 100 ? '#10b981' : 'var(--accent-orange)' }}>
                {progressPercent}%
              </span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>({completedCount}/4 완료)</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '25px', border: '1px solid var(--border)' }}>
            <div 
              style={{ 
                width: `${progressPercent}%`, 
                height: '100%', 
                background: progressPercent === 100 
                  ? 'linear-gradient(90deg, #10b981, #34d399)' 
                  : 'linear-gradient(90deg, var(--accent-orange), #ea580c)',
                borderRadius: '10px',
                transition: 'width 0.5s ease-in-out'
              }} 
            />
          </div>

          {/* 4 Steps Checklist Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* Step 1: Store Creation */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', background: isStep1Done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(249, 115, 22, 0.04)', padding: '16px', borderRadius: '16px', border: isStep1Done ? '1px solid rgba(16, 185, 129, 0.15)' : '1px dashed rgba(249, 115, 22, 0.25)' }}>
              <div style={{ fontSize: '1.5rem', marginTop: '2px' }}>{isStep1Done ? '✅' : '🏠'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.95rem', color: isStep1Done ? 'var(--text-main)' : 'var(--accent-orange)' }}>
                    1단계: 내 매장 개설 (내 집 짓기 완공)
                  </strong>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '50px', fontWeight: 800, background: isStep1Done ? 'rgba(16, 185, 129, 0.12)' : 'rgba(249, 115, 22, 0.12)', color: isStep1Done ? '#10b981' : 'var(--accent-orange)' }}>
                    {isStep1Done ? '완료됨' : '진행 중'}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  상호명, 개업일자 및 각 테이블 번호별 인석 정보(인쇄 테이블 정보) 등 매장 고유 뼈대를 정식 등록합니다.
                </p>
                {!isStep1Done && (
                  <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--accent-orange)', fontWeight: 700 }}>
                    👇 아래 '내 매장 개설 및 등록' 신청서를 채워 완공해 주세요.
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Menus Creation */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', background: isStep2Done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '16px', border: isStep2Done ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border)', opacity: isStep1Done ? 1 : 0.5 }}>
              <div style={{ fontSize: '1.5rem', marginTop: '2px' }}>{isStep2Done ? '✅' : '📋'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.95rem', color: isStep2Done ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    2단계: 디지털 메뉴 구성 (메뉴판 스캔 완료)
                  </strong>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '50px', fontWeight: 800, background: isStep2Done ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.08)', color: isStep2Done ? '#10b981' : 'var(--text-muted)' }}>
                    {isStep2Done ? '완료됨' : (isStep1Done ? '활성화' : '대기 중')}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  가맹점의 대표 메뉴판, 빌지, 영수증 실물 이미지를 AI 스캔하여 3초 만에 디지털 메뉴 구성을 완공합니다.
                </p>
                {isStep1Done && !isStep2Done && (
                  <button 
                    onClick={() => onNavigate('menu')}
                    className="confirm-btn"
                    style={{ marginTop: '10px', padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '800', background: 'linear-gradient(135deg, var(--accent-orange), #ea580c)', border: 'none', color: 'white', cursor: 'pointer' }}
                  >
                    📸 이미지/메뉴판 AI 스캔 등록 ➔
                  </button>
                )}
              </div>
            </div>

            {/* Step 3: QR Print & Place */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', background: isStep3Done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '16px', border: isStep3Done ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border)', opacity: isStep2Done ? 1 : 0.5 }}>
              <div style={{ fontSize: '1.5rem', marginTop: '2px' }}>{isStep3Done ? '✅' : '🖨️'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.95rem', color: isStep3Done ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    3단계: 스마트 주문용 테이블 QR 코드 인쇄 및 부착
                  </strong>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '50px', fontWeight: 800, background: isStep3Done ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.08)', color: isStep3Done ? '#10b981' : 'var(--text-muted)' }}>
                    {isStep3Done ? '완료됨' : (isStep2Done ? '활성화' : '대기 중')}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  설정한 좌석 규모에 맞게 자리세팅 QR 코드가 마스터 인쇄지로 가변 출력됩니다. 각 손님 자리에 예쁘게 오려 부착해 주세요!
                </p>
                {isStep2Done && !isStep3Done && (
                  <button 
                    onClick={() => {
                      setIsStep3Done(true);
                      try {
                        localStorage.setItem(`mqnet_step3_done_${user?.id}`, 'true');
                      } catch(e){}
                      onNavigate('qr');
                    }}
                    className="confirm-btn"
                    style={{ marginTop: '10px', padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '800', background: 'linear-gradient(135deg, var(--accent-orange), #ea580c)', border: 'none', color: 'white', cursor: 'pointer' }}
                  >
                    🖨️ 인쇄 센터에서 QR 마스터 인쇄하기 ➔
                  </button>
                )}
              </div>
            </div>

            {/* Step 4: Employee Signup */}
            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', background: isStep4Done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '16px', border: isStep4Done ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border)', opacity: isStep1Done ? 1 : 0.5 }}>
              <div style={{ fontSize: '1.5rem', marginTop: '2px' }}>{isStep4Done ? '✅' : '👥'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.95rem', color: isStep4Done ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    4단계: 근무 직원(점원/매니저) 가입 및 최종 권한 승인
                  </strong>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '50px', fontWeight: 800, background: isStep4Done ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.08)', color: isStep4Done ? '#10b981' : 'var(--text-muted)' }}>
                    {isStep4Done ? '완료됨' : (isStep1Done ? '활성화' : '대기 중')}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  함께 일할 첫 직원을 가맹 매장 소속으로 연결하고 권한(시급, 출근 조건)을 세팅합니다.
                </p>
                {isStep1Done && !isStep4Done && (
                  <button 
                    onClick={() => onNavigate('hr')}
                    className="confirm-btn"
                    style={{ marginTop: '10px', padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '800', background: 'linear-gradient(135deg, var(--accent-orange), #ea580c)', border: 'none', color: 'white', cursor: 'pointer' }}
                  >
                    👥 직원 관리 및 권한 세팅하러 가기 ➔
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Celebration Box when 100% complete! */}
          {progressPercent === 100 && (
            <div 
              style={{
                marginTop: '25px',
                padding: '20px',
                borderRadius: '16px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '2px solid #10b981',
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🎉🚀🎊</div>
              <h5 style={{ margin: '0 0 5px 0', fontSize: '1.15rem', fontWeight: 900, color: '#34d399' }}>
                스마트 가맹점 최종 세팅 완료 및 정상 운영 개시!
              </h5>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                축하합니다 대표님! 기초 세팅이 완벽히 수립되었습니다. 이제 손님들은 테이블 QR 코드로 자유롭게 AI 비서와 대화 주문이 가능하며, 주방 상황판과 POS 패드를 통해 자동 주문 관리가 시작됩니다.
              </p>
            </div>
          )}

        </div>
      )}

      {/* 2.2 NEW: Owner Store Creation ("내 집 짓기") Card */}
      {user?.role === 'owner' && !storeDetails && (
        <div 
          className="glass-panel animate-fade-in"
          style={{
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(249, 115, 22, 0.02))',
            border: '2px solid var(--accent-orange)',
            borderRadius: '24px',
            padding: '30px',
            marginBottom: '35px',
            boxShadow: '0 15px 35px rgba(249, 115, 22, 0.08)',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '2rem' }}>🏠</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)' }}>내 매장 개설 및 등록 (내 집 짓기)</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                회원가입 승인을 축하드립니다! 대표님의 매장 정보를 기입하여 가맹점을 정식으로 개설하세요.
              </p>
            </div>
          </div>

          <form onSubmit={handleBuildHouse} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>가맹 상호명</label>
                <input 
                  type="text" 
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="예: 시크빌"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600 }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>가맹점 고유 ID</label>
                <input 
                  type="text" 
                  value={newStoreId}
                  onChange={(e) => setNewStoreId(e.target.value)}
                  placeholder="예: store-chicvill"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600 }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>대표자 성명</label>
                <input 
                  type="text" 
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600 }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>사업자등록번호</label>
                <input 
                  type="text" 
                  value={newBizNo}
                  onChange={(e) => setNewBizNo(e.target.value)}
                  placeholder="숫자 10자리 입력"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>개업 일자</label>
                <input 
                  type="text" 
                  value={newOpenDate}
                  onChange={(e) => setNewOpenDate(e.target.value)}
                  placeholder="예: 20191216"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>테이블 좌석 구성 (QR 인쇄용)</label>
                <input 
                  type="text" 
                  value={newTablesConfig}
                  onChange={(e) => setNewTablesConfig(e.target.value)}
                  placeholder="예: 1번: 4인석, 2번: 2인석, 3번: 4인석"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600 }}
                  required
                />
              </div>
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '-4px', display: 'block' }}>
              ※ 쉼표(,)로 구분하여 필요한 테이블들을 좌석 수와 함께 기재해 주세요. QR 인쇄 센터 및 결제 패드에 동적 매핑됩니다.
            </small>

            {buildError && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, marginTop: '5px' }}>{buildError}</div>
            )}

            <button
              type="submit"
              disabled={isBuildingHouse}
              style={{
                marginTop: '10px',
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, var(--accent-orange) 0%, #ea580c 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                fontSize: '1rem',
                fontWeight: '900',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(249, 115, 22, 0.25)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 12px 25px rgba(249, 115, 22, 0.35)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(249, 115, 22, 0.25)';
              }}
            >
              {isBuildingHouse ? '🏠 내 가맹점 열심히 짓는 중...' : '🏠 내 가맹점(집) 완공 및 등록 완료'}
            </button>
          </form>
        </div>
      )}

      {/* 2.5 Pending Approvals Card (for Owner / Admin) - Hide if new owner is building store */}
      {!(user?.role === 'owner' && !storeDetails) && ((user?.role === 'owner' && pendingStaffList.length > 0) || (user?.role === 'admin' && pendingOwnerList.length > 0)) && (
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
                    ✨ 점주 가입 즉시 승인
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Quick Links Section - Hide if new owner is building store */}
      {!(user?.role === 'owner' && !storeDetails) && (
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
      )}

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
