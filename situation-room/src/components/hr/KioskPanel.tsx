import React, { useState, useMemo, useEffect } from 'react';
import { apiFetch } from '../../utils/apiFetch';

interface KioskPanelProps {
  kioskPhone: string;
  isScanningQr: boolean;
  onPhoneChange: (value: string) => void;
  onSubmit: (actionType: 'check-in' | 'check-out', customPhone?: string) => Promise<void> | void;
  bundles: any[];
  onRefresh?: () => void;
}

/** SHA-256 해시 연산 (비밀번호 검증 및 저장용) */
const hashPassword = async (password: string): Promise<string> => {
  if (!crypto?.subtle) return password; // HTTP 비보안 환경 폴백
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const fmtTime = (raw: string) => {
  if (!raw) return '-';
  try {
    return new Date(raw).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return raw.slice(11, 16) || '-';
  }
};

const fmtDate = (raw: string) => {
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' });
  } catch {
    return raw.slice(0, 10);
  }
};

const fmtDuration = (workMinutes: number) => {
  if (workMinutes <= 0) return '';
  const hrs = Math.floor(workMinutes / 60);
  const mins = workMinutes % 60;
  return hrs > 0 ? `${hrs}시간 ${mins}분` : `${mins}분`;
};

export const KioskPanel: React.FC<KioskPanelProps> = ({
  kioskPhone: _kioskPhone,
  isScanningQr,
  onPhoneChange: _onPhoneChange,
  onSubmit,
  bundles,
  onRefresh,
}) => {
  // 로그인 입력 상태
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 로그인된 세션 상태
  const [loggedInPhone, setLoggedInPhone] = useState(() => {
    return localStorage.getItem('mqnet_kiosk_logged_in_phone') || '';
  });

  // 비밀번호 수정 모달 상태
  const [showEditModal, setShowEditModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // 호버 스타일용 상태들
  const [hoverBtn, setHoverBtn] = useState<'in' | 'out' | 'edit' | 'logout' | 'login' | null>(null);

  // 1. 로그인 계정 탐색 (PersonalInfos bundle 중 승인된 계정)
  const staffAccount = useMemo(() => {
    if (!loggedInPhone) return null;
    return bundles.find(b =>
      b.type === 'PersonalInfos' &&
      b.items?.find((i: any) => i.name === '아이디')?.value === loggedInPhone &&
      b.status === 'approved'
    );
  }, [bundles, loggedInPhone]);

  // 2. 직원 상세 번들 탐색 (Employee bundle)
  const employeeBundle = useMemo(() => {
    if (!loggedInPhone) return null;
    return bundles.find(b =>
      b.type === 'Employee' &&
      b.items?.find((i: any) => i.name === '아이디')?.value === loggedInPhone &&
      b.status !== 'resigned'
    );
  }, [bundles, loggedInPhone]);

  // 자동 로그아웃 정비 (만약 캐싱된 폰이 있으나 번들 목록에 승인된 계정이 없다면 로그아웃 유도)
  useEffect(() => {
    if (loggedInPhone && bundles.length > 0 && !staffAccount) {
      localStorage.removeItem('mqnet_kiosk_logged_in_phone');
      setLoggedInPhone('');
    }
  }, [bundles, loggedInPhone, staffAccount]);

  // 3. 근태 내역 조회 및 내림차순 정렬
  const sortedAttendanceLogs = useMemo(() => {
    if (!loggedInPhone) return [];
    const logs = bundles.filter(b =>
      b.type === 'Attendance' &&
      b.items?.find((i: any) => i.name === '아이디')?.value === loggedInPhone
    );
    return [...logs].sort((a, b) => {
      const timeA = a.items?.find((i: any) => i.name === '출근시간')?.value || '';
      const timeB = b.items?.find((i: any) => i.name === '출근시간')?.value || '';
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  }, [bundles, loggedInPhone]);

  // 로그인 핸들러
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const cleanPhone = loginPhone.replace(/[^0-9]/g, '').trim();
    if (!cleanPhone || !loginPassword.trim()) {
      setLoginError('전화번호와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const hashedPw = await hashPassword(loginPassword.trim());
      const account = bundles.find(b => {
        if (b.type !== 'PersonalInfos') return false;
        const bId = b.items?.find((i: any) => i.name === '아이디')?.value;
        const bPw = b.items?.find((i: any) => i.name === '비밀번호')?.value;
        return bId === cleanPhone && (bPw === hashedPw || bPw === loginPassword.trim());
      });

      if (account) {
        if (account.status !== 'approved') {
          setLoginError('승인 대기 중이거나 중단된 계정입니다. 점주에게 문의하세요.');
          setIsLoggingIn(false);
          return;
        }
        // 로그인 성공! 세션 캐싱
        localStorage.setItem('mqnet_kiosk_logged_in_phone', cleanPhone);
        setLoggedInPhone(cleanPhone);
        setLoginPassword('');
      } else {
        setLoginError('아이디(전화번호) 또는 비밀번호가 일치하지 않습니다.');
      }
    } catch (err: any) {
      setLoginError('로그인 처리 중 에러가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 로그아웃 핸들러
  const handleLogout = () => {
    if (!window.confirm('정말 로그아웃 하시겠습니까?')) return;
    localStorage.removeItem('mqnet_kiosk_logged_in_phone');
    setLoggedInPhone('');
    setLoginPhone('');
    setLoginPassword('');
  };

  // 비밀번호 변경 핸들러
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    if (newPassword.length < 4) {
      setEditError('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setEditError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const personalBundle = bundles.find(b =>
        b.type === 'PersonalInfos' &&
        b.items?.find((i: any) => i.name === '아이디')?.value === loggedInPhone
      );

      if (!personalBundle) {
        setEditError('계정 정보 번들을 찾을 수 없습니다.');
        setIsUpdatingPassword(false);
        return;
      }

      const hashedNewPw = await hashPassword(newPassword.trim());
      const updatedItems = personalBundle.items.map((item: any) => {
        if (item.name === '비밀번호') {
          return { ...item, value: hashedNewPw };
        }
        return item;
      });

      const response = await apiFetch(`/api/bundle/${personalBundle.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...personalBundle,
          items: updatedItems,
          timestamp: new Date().toLocaleString(),
        }),
      });

      if (response.ok) {
        alert('✨ 비밀번호가 성공적으로 수정되었습니다.');
        setShowEditModal(false);
        setNewPassword('');
        setConfirmPassword('');
        if (onRefresh) onRefresh();
      } else {
        const errResult = await response.json();
        setEditError(errResult.detail || '비밀번호 변경에 실패했습니다.');
      }
    } catch (err: any) {
      setEditError(`서버 연동 에러: ${err.message}`);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // 1. 미로그인 상태 -> 로그인 폼 렌더링
  if (!loggedInPhone || !staffAccount) {
    return (
      <div className="admin-page animate-fade-in" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: '20px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '30px 24px', borderRadius: '24px', border: '1.5px solid rgba(249, 115, 22, 0.3)', textAlign: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '3.2rem' }}>⏰</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: '12px', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>출퇴근 기록 로그인</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.4 }}>
              본인의 전화번호(ID)와 비밀번호를<br/>입력하여 로그인 후 출퇴근을 인증해 주세요.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>전화번호 (ID)</label>
              <input
                type="tel"
                placeholder="01012345678"
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={11}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '10px',
                  background: 'var(--background)', border: '1.5px solid var(--border)',
                  color: 'var(--text-main)', fontSize: '0.98rem', outline: 'none',
                  boxSizing: 'border-box'
                }}
                required
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '10px',
                  background: 'var(--background)', border: '1.5px solid var(--border)',
                  color: 'var(--text-main)', fontSize: '0.98rem', outline: 'none',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            {loginError && (
              <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#ef4444', fontWeight: 700, textAlign: 'left' }}>
                ⚠️ {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              onMouseEnter={() => setHoverBtn('login')}
              onMouseLeave={() => setHoverBtn(null)}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px', fontWeight: '800', fontSize: '0.95rem',
                background: hoverBtn === 'login' ? 'var(--accent-orange)' : 'rgba(249, 115, 22, 0.15)',
                color: hoverBtn === 'login' ? 'white' : 'var(--accent-orange)',
                border: '1.5px solid var(--accent-orange)',
                cursor: isLoggingIn ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                marginTop: '8px'
              }}
            >
              {isLoggingIn ? '인증 확인 중...' : '🔓 로그온 및 대시보드 진입'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. 로그인 완료 -> 직원 정보 추출 및 대시보드 렌더링
  const staffName = staffAccount.items?.find((i: any) => i.name === '이름')?.value || '직원';
  const staffRole = staffAccount.items?.find((i: any) => i.name === '권한')?.value || 'staff';
  const roleLabel = staffRole === 'manager' ? '점장' : '점원';

  // 급여 통계 수치
  const rawWage = employeeBundle?.items?.find((i: any) => i.name === '시급')?.value || '0';
  const rawHours = employeeBundle?.items?.find((i: any) => i.name === '누적시간')?.value || '0.0';
  const rawUnpaid = employeeBundle?.items?.find((i: any) => i.name === '미지급임금')?.value || '0';

  const numWage = parseInt(rawWage.replace(/[^0-9]/g, '') || '0');
  const numUnpaid = parseInt(rawUnpaid.replace(/[^0-9]/g, '') || '0');

  return (
    <div className="admin-page animate-fade-in" style={{ minHeight: '100%', background: 'var(--background)', padding: '16px', boxSizing: 'border-box' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', margin: '0 auto', padding: '16px', borderRadius: '20px', border: '1.5px solid rgba(249, 115, 22, 0.25)', boxSizing: 'border-box' }}>
        
        {/* 상단 프로필 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '1.8rem' }}>👤</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{staffName}</strong>
                <span className={staffRole === 'manager' ? 'role-badge owner-gold' : 'role-badge staff-blue'} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  {roleLabel}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>📞 {loggedInPhone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            onMouseEnter={() => setHoverBtn('logout')}
            onMouseLeave={() => setHoverBtn(null)}
            style={{
              background: hoverBtn === 'logout' ? 'rgba(239, 68, 68, 0.15)' : 'none',
              border: hoverBtn === 'logout' ? '1px solid #ef4444' : '1px solid var(--border)',
              borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 800,
              color: hoverBtn === 'logout' ? '#ef4444' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap'
            }}
          >
            🔒 로그아웃
          </button>
        </div>

        {/* 출퇴근 및 정보수정 버튼 영역 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => onSubmit('check-in', loggedInPhone)}
              disabled={isScanningQr}
              onMouseEnter={() => setHoverBtn('in')}
              onMouseLeave={() => setHoverBtn(null)}
              style={{
                flex: 1, padding: '14px 10px', borderRadius: '12px', fontWeight: '900', fontSize: '1.05rem',
                background: hoverBtn === 'in' ? '#10b981' : 'rgba(16, 185, 129, 0.12)',
                color: hoverBtn === 'in' ? 'white' : '#10b981',
                border: '1.5px solid #10b981',
                cursor: isScanningQr ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                boxShadow: hoverBtn === 'in' ? '0 4px 12px rgba(16,185,129,0.3)' : 'none'
              }}
            >
              🏃 출 근
            </button>
            <button
              onClick={() => onSubmit('check-out', loggedInPhone)}
              disabled={isScanningQr}
              onMouseEnter={() => setHoverBtn('out')}
              onMouseLeave={() => setHoverBtn(null)}
              style={{
                flex: 1, padding: '14px 10px', borderRadius: '12px', fontWeight: '900', fontSize: '1.05rem',
                background: hoverBtn === 'out' ? 'var(--accent-orange)' : 'rgba(249, 115, 22, 0.12)',
                color: hoverBtn === 'out' ? 'white' : 'var(--accent-orange)',
                border: '1.5px solid var(--accent-orange)',
                cursor: isScanningQr ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                boxShadow: hoverBtn === 'out' ? '0 4px 12px rgba(249,115,22,0.3)' : 'none'
              }}
            >
              🏠 퇴 근
            </button>
          </div>

          <button
            onClick={() => setShowEditModal(true)}
            onMouseEnter={() => setHoverBtn('edit')}
            onMouseLeave={() => setHoverBtn(null)}
            style={{
              width: '100%', padding: '11px', borderRadius: '10px', fontWeight: '800', fontSize: '0.85rem',
              background: hoverBtn === 'edit' ? 'var(--bg-secondary)' : 'var(--surface)',
              color: 'var(--text-main)', border: '1.5px solid var(--border)',
              cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            ✏️ 개인정보 (비밀번호) 수정
          </button>
        </div>

        {/* 계약 스펙 및 통계 지표 */}
        <div style={{ background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border)', padding: '12px 14px', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>📊 나의 근로 요건 및 정산 통계</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div style={{ background: 'var(--background)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>계약시급</div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{numWage.toLocaleString()}원</strong>
            </div>
            <div style={{ background: 'var(--background)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>누적근무</div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{parseFloat(rawHours).toFixed(1)}H</strong>
            </div>
            <div style={{ background: 'var(--background)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '2px' }}>미지급액</div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--accent-orange)' }}>{numUnpaid.toLocaleString()}원</strong>
            </div>
          </div>
        </div>

        {/* 하단 근태 역사 타임라인 */}
        <div style={{ background: 'var(--surface)', borderRadius: '14px', border: '1px solid var(--border)', padding: '12px 14px', boxSizing: 'border-box' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>🕒 최근 나의 출퇴근 기록 (최신순)</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {sortedAttendanceLogs.length > 0 ? (
              sortedAttendanceLogs.map((a) => {
                const checkinRaw = a.items?.find((i: any) => i.name === '출근시간')?.value || '';
                const checkoutRaw = a.items?.find((i: any) => i.name === '퇴근시간')?.value || '';
                const workMinutes = parseInt(a.items?.find((i: any) => i.name === '근무분수')?.value || '0');
                const tardy = a.items?.find((i: any) => i.name === '지각여부')?.value === '지각';
                const paid = a.items?.find((i: any) => i.name === '정산상태')?.value === '지급';
                const isWorking = a.status === 'working';

                return (
                  <div
                    key={a.id}
                    style={{
                      padding: '8px 10px',
                      background: 'var(--background)',
                      border: `1.2px solid ${isWorking ? '#10b981' : 'var(--border)'}`,
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.78rem'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>{fmtDate(checkinRaw)}</span>
                        {isWorking && <span style={{ fontSize: '0.6rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>근무중</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                        <span>🏃 <strong style={{ color: '#10b981' }}>{fmtTime(checkinRaw)}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <span>🏠 <strong style={{ color: isWorking ? 'var(--text-muted)' : 'var(--accent-orange)' }}>{isWorking ? '퇴근 전' : fmtTime(checkoutRaw)}</strong></span>
                        {workMinutes > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({fmtDuration(workMinutes)})</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                      {tardy && <span style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>지각</span>}
                      <span style={{
                        background: paid ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.12)',
                        color: paid ? '#10b981' : 'var(--accent-orange)',
                        fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', fontWeight: 700
                      }}>
                        {paid ? '정산완료' : '미정산'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', opacity: 0.4, padding: '24px 0', fontSize: '0.78rem' }}>출퇴근 기록이 아직 없습니다.</div>
            )}
          </div>
        </div>

      </div>

      {/* ✏️ 개인정보 비밀번호 수정 모달 */}
      {showEditModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
            padding: '16px', boxSizing: 'border-box'
          }}
          onClick={() => setShowEditModal(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: '380px', background: 'var(--background)',
              border: '1.5px solid var(--border)', borderRadius: '20px', padding: '22px',
              boxShadow: 'var(--shadow-xl)', position: 'relative', boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>✏️ 개인 정보 수정</h3>
            <p style={{ margin: '0 0 18px 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              로그인 시 사용할 비밀번호를 수정하고 저장할 수 있습니다.
            </p>

            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>새 비밀번호</label>
                <input
                  type="password"
                  placeholder="4자 이상 입력"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    background: 'var(--background)', border: '1px solid var(--border)',
                    color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>비밀번호 확인</label>
                <input
                  type="password"
                  placeholder="새 비밀번호 다시 입력"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    background: 'var(--background)', border: '1px solid var(--border)',
                    color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              {editError && (
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>
                  ⚠️ {editError}
                </p>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text-muted)', fontSize: '0.82rem',
                    fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  style={{
                    flex: 2, padding: '10px', borderRadius: '8px', border: 'none',
                    background: 'var(--accent-orange)', color: 'white', fontSize: '0.82rem',
                    fontWeight: 800, cursor: isUpdatingPassword ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isUpdatingPassword ? '저장 중...' : '💾 변경 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
