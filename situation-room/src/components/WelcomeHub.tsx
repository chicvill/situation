import React, { useState, useEffect } from 'react';
import { OnboardingRoadmap } from './welcome/OnboardingRoadmap';
import { StoreCreationForm } from './welcome/StoreCreationForm';
import { PendingApprovals } from './welcome/PendingApprovals';
import { QuickLinks } from './welcome/QuickLinks';
import { EditProfileModal } from './welcome/EditProfileModal';
import { API_BASE } from '../config';

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

  // Store Creation Form state
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
      b.items?.find((i: any) => i.name === '아이디')?.value === user?.id
  );

  // Initialize fields on modal open
  useEffect(() => {
    if (showEditModal && userBundle) {
      const currentName = userBundle.items?.find((i: any) => i.name === '이름')?.value || user.name || '';
      setName(currentName);
      setPassword('');
      setEditedStoreName(userBundle.store || storeName || '');
    }
  }, [showEditModal, userBundle, user, storeName]);

  // Pre-populate "내 집 짓기" form using Owner's signup data
  useEffect(() => {
    if (user?.role === 'owner' && userBundle && !storeDetails) {
      const pOwnerName = userBundle.items?.find((i: any) => i.name === '이름')?.value || user.name || '';
      const pBizNo = userBundle.items?.find((i: any) => i.name === '사업자번호')?.value || '';
      const pOpenDate = userBundle.items?.find((i: any) => i.name === '개업일자')?.value || '';

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
      const apiUrl = API_BASE;

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

      localStorage.setItem('mqnet_store_id', newStoreId);
      localStorage.setItem('mqnet_store_name', newStoreName);

      const updatedUser = { ...user, storeId: newStoreId, storeName: newStoreName };
      onProfileUpdated(updatedUser);

      window.dispatchEvent(new Event('storage'));

      alert(`🏠 축하합니다! '${newStoreName}' 매장(집)이 성공적으로 건설 및 정식 등록되었습니다.\n최초 1회 메뉴판 생성(온보딩) 단계로 자동 이동합니다.`);

      onReloadStoreDetails?.();
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
      const apiUrl = API_BASE;
      const currentHashedPw = userBundle.items?.find((i: any) => i.name === '비밀번호')?.value || '';
      const finalHashedPw = password.trim() ? await hashPassword(password) : currentHashedPw;

      const updatedItems = userBundle.items?.map((item: any) => {
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

      const response = await fetch(`${apiUrl}/api/bundle/${userBundle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBundle)
      });

      if (!response.ok) {
        throw new Error('프로필 업데이트에 실패했습니다.');
      }

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
      if (b.store_id !== user.storeId) return false;
      const role = b.items?.find((i: any) => i.name === '권한')?.value;
      return role === 'manager' || role === 'staff';
    });
  }, [bundles, user]);

  // Filter pending owners (for admin role)
  const pendingOwnerList = React.useMemo(() => {
    if (user?.role !== 'admin') return [];
    return bundles.filter(b => {
      if (b.type !== 'PersonalInfos' || b.status === 'approved') return false;
      const role = b.items?.find((i: any) => i.name === '권한')?.value;
      return role === 'owner';
    });
  }, [bundles, user]);

  const handleApproveStaff = async (bundle: any) => {
    const staffName = bundle.items?.find((i: any) => i.name === '이름')?.value || '-';
    if (!window.confirm(`✨ ${staffName} 사원의 가입 신청을 승인하시겠습니까?`)) return;

    setIsProcessing(true);
    try {
      const apiUrl = API_BASE;

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
    const ownerName = bundle.items?.find((i: any) => i.name === '이름')?.value || '-';
    if (!window.confirm(`✨ ${ownerName} 사장님의 가입 신청을 최종 승인하시겠습니까?\n승인 완료 후 해당 사장님이 본인의 계정으로 직접 로그인하여 매장을 개설 및 설정하게 됩니다.`)) return;

    setIsProcessing(true);
    try {
      const apiUrl = API_BASE;

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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return '시스템 최고관리자';
      case 'owner': return '가맹점주';
      case 'manager': return '매장 매니저';
      case 'staff': return '매장 점원';
      default: return '사용자';
    }
  };

  const getQuickLinks = () => {
    const links = [];

    links.push({ label: '💰 카운터 주문 관리', tab: 'counter', desc: '고객 주문 상태 및 결제 승인', icon: '🛒' });
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
    (b.items?.length || 0) > 0
  );

  const isStep4Done = isStep1Done && bundles.some(
    b => b.type === 'PersonalInfos' &&
    b.store_id === user?.storeId &&
    b.items?.find((i: any) => i.name === '권한')?.value !== 'owner'
  );

  let completedCount = 0;
  if (isStep1Done) completedCount++;
  if (isStep2Done) completedCount++;
  if (isStep3Done) completedCount++;
  if (isStep4Done) completedCount++;

  const progressPercent = Math.round((completedCount / 4) * 100);

  const isNewOwnerBuildingStore = user?.role === 'owner' && !storeDetails;
  const showPendingApprovals =
    !isNewOwnerBuildingStore &&
    ((user?.role === 'owner' && pendingStaffList.length > 0) || (user?.role === 'admin' && pendingOwnerList.length > 0));

  return (
    <div className="welcome-hub-container animate-fade-in" style={{ padding: '12px 14px', maxWidth: '560px', margin: '0 auto' }}>

      {/* 1. Header with Edit Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0, background: 'linear-gradient(135deg, var(--text-main), var(--accent-orange))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Welcome Hub
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>스마트 매장 통합 상황실</p>
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(249, 115, 22, 0.05))',
            border: '1.5px solid var(--accent-orange)',
            color: 'var(--accent-orange)',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 2px 8px rgba(249, 115, 22, 0.03)',
            transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(249, 115, 22, 0.22), rgba(249, 115, 22, 0.08))';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(249, 115, 22, 0.05))';
          }}
        >
          👤 정보 수정
        </button>
      </div>

      {/* 2. Welcome Banner Card */}
      <div
        className="glass-panel"
        style={{
          background: 'linear-gradient(135deg, #fff9f5, #fff)',
          borderRadius: '16px',
          padding: '16px 20px',
          border: '1px solid rgba(249,115,22,0.15)',
          boxShadow: '0 4px 16px rgba(249,115,22,0.03)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '14px',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🍀</div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: '900', margin: '0 0 6px 0', color: 'var(--text-main)' }}>
          반갑습니다, <span style={{ color: 'var(--accent-orange)' }}>{user?.name || '직원'}</span>님!
        </h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 14px 0', lineHeight: '1.4' }}>
          {getGreetingMessage()}<br />
          {isNewOwnerBuildingStore ? (
            <span>권한: <strong style={{ color: 'var(--text-main)' }}>[{getRoleBadge(user?.role)}]</strong> / <strong style={{ color: 'var(--accent-orange)' }}>대표님 매장 미등록. 아래 개설 신청서를 작성하여 매장을 완공하세요!</strong></span>
          ) : (
            <span>권한: <strong style={{ color: 'var(--text-main)' }}>[{getRoleBadge(user?.role)}]</strong> / <strong style={{ color: 'var(--text-main)' }}>{storeName || '미지정'}</strong> 매장 연결됨</span>
          )}
        </p>

        <div style={{ display: 'inline-flex', gap: '15px' }}>
          {!isNewOwnerBuildingStore && (
            <button
              onClick={() => onNavigate('guide')}
              className="confirm-btn success-green"
              style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '800' }}
            >
              🎙️ AI 대화
            </button>
          )}
          <button
            onClick={onLogout}
            className="del-btn"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
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

      {/* Onboarding Roadmap (Owner Only) */}
      {user?.role === 'owner' && (
        <OnboardingRoadmap
          isStep1Done={isStep1Done}
          isStep2Done={isStep2Done}
          isStep3Done={isStep3Done}
          isStep4Done={isStep4Done}
          progressPercent={progressPercent}
          completedCount={completedCount}
          userId={user?.id || ''}
          onNavigate={onNavigate}
          onStep3Complete={() => {
            setIsStep3Done(true);
            try {
              localStorage.setItem(`mqnet_step3_done_${user?.id}`, 'true');
            } catch (e) {}
          }}
        />
      )}

      {/* Store Creation Form (new owner without store) */}
      {isNewOwnerBuildingStore && (
        <StoreCreationForm
          newStoreId={newStoreId}
          newStoreName={newStoreName}
          newOwnerName={newOwnerName}
          newBizNo={newBizNo}
          newOpenDate={newOpenDate}
          newTablesConfig={newTablesConfig}
          isBuildingHouse={isBuildingHouse}
          buildError={buildError}
          onStoreIdChange={setNewStoreId}
          onStoreNameChange={setNewStoreName}
          onOwnerNameChange={setNewOwnerName}
          onBizNoChange={setNewBizNo}
          onOpenDateChange={setNewOpenDate}
          onTablesConfigChange={setNewTablesConfig}
          onSubmit={handleBuildHouse}
        />
      )}

      {/* Pending Approvals */}
      {showPendingApprovals && (
        <PendingApprovals
          userRole={user?.role}
          pendingStaffList={pendingStaffList}
          pendingOwnerList={pendingOwnerList}
          isProcessing={isProcessing}
          onApproveStaff={handleApproveStaff}
          onApproveOwner={handleApproveOwner}
        />
      )}

      {/* Quick Links */}
      {!isNewOwnerBuildingStore && (
        <QuickLinks links={getQuickLinks()} onNavigate={onNavigate} />
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <EditProfileModal
          user={user}
          name={name}
          password={password}
          editedStoreName={editedStoreName}
          isSaving={isSaving}
          error={error}
          onNameChange={setName}
          onPasswordChange={setPassword}
          onStoreNameChange={setEditedStoreName}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleSaveProfile}
        />
      )}

    </div>
  );
};
