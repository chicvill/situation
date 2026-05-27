import React, { useState, useMemo } from 'react';
import { API_BASE } from '../config';
import { apiFetch } from '../utils/apiFetch';
import { EditProfileModal } from './welcome/EditProfileModal';

interface StaffDashboardProps {
  user: any;
  bundles: any[];
  storeName: string;
  onProfileUpdated: (updatedUser: any) => void;
  onLogout: () => void;
  onRefresh?: () => void;
}

const hashPassword = async (pw: string): Promise<string> => {
  if (!crypto?.subtle) return pw;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const getDeviceId = (): string => {
  let id = localStorage.getItem('mqnet_kiosk_device_id');
  if (!id) {
    id = 'STAFF_' + Math.random().toString(36).substring(2, 9).toUpperCase();
    localStorage.setItem('mqnet_kiosk_device_id', id);
  }
  return id;
};

const fmtTime = (raw: string) => {
  if (!raw) return '-';
  try { return new Date(raw).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return raw.slice(11, 16) || '-'; }
};
const fmtDate = (raw: string) => {
  if (!raw) return '';
  try { return new Date(raw).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }); }
  catch { return raw.slice(0, 10); }
};

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  user, bundles, storeName, onProfileUpdated, onLogout, onRefresh,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  /* ── 개인정보 수정 state ─────────────────────── */
  const [editName, setEditName] = useState('');
  const [editPw, setEditPw] = useState('');
  const [editStoreName, setEditStoreName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');

  /* ── 데이터 조회 ─────────────────────────────── */
  const userBundle = useMemo(() =>
    bundles.find(b =>
      b.type === 'PersonalInfos' &&
      b.items?.find((i: any) => i.name === '아이디')?.value === user?.id
    ), [bundles, user]);

  const employeeBundle = useMemo(() =>
    bundles.find(b =>
      b.type === 'Employee' &&
      b.items?.find((i: any) => i.name === '아이디')?.value === user?.id
    ), [bundles, user]);

  const storeId = employeeBundle?.store_id || user?.storeId || 'store-korean';
  const wage      = parseInt(employeeBundle?.items?.find((i: any) => i.name === '시급')?.value || '0');
  const cumHours  = employeeBundle?.items?.find((i: any) => i.name === '누적시간')?.value || '0';
  const unpaid    = parseInt(employeeBundle?.items?.find((i: any) => i.name === '미지급임금')?.value || '0');

  /* 내 근태 로그 (최신순) */
  const myAttendance = useMemo(() =>
    bundles
      .filter(b => {
        if (b.type !== 'Attendance') return false;
        const id = b.items?.find((i: any) => i.name === '아이디')?.value || '';
        return id === user?.id || id === (user?.id || '').replace(/[^0-9]/g, '');
      })
      .sort((a, b) => {
        const ta = a.items?.find((i: any) => i.name === '출근시간')?.value || '';
        const tb = b.items?.find((i: any) => i.name === '출근시간')?.value || '';
        return tb.localeCompare(ta);
      }),
    [bundles, user]);

  const latestRecord = myAttendance[0];
  const isWorking = latestRecord?.status === 'working';

  /* ── 출퇴근 API ──────────────────────────────── */
  const callAttendance = async (action: 'check-in' | 'check-out') => {
    const label = action === 'check-in' ? '출근' : '퇴근';
    if (!window.confirm(`${label} 처리하시겠습니까?`)) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/staff/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: user.id, store_id: storeId, device_id: getDeviceId() }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert(`🚨 ${label} 오류\n\n${result.detail || '스케줄 시간이 아닙니다.'}`);
      } else {
        const timeKey = action === 'check-in' ? result.check_in_time : result.check_out_time;
        const timeStr = timeKey ? new Date(timeKey).toLocaleTimeString() : '';
        const msg = action === 'check-in'
          ? `🏃 출근 완료!\n${result.tardy ? '⚠️ 지각 출근입니다.' : '✨ 정상 출근 처리되었습니다.'}${timeStr ? `\n기록 시각: ${timeStr}` : ''}`
          : `🏠 퇴근 완료!\n${timeStr ? `기록 시각: ${timeStr}` : ''}`;
        alert(msg);
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      alert(`❌ 서버 오류: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /* ── 개인정보 수정 ────────────────────────────── */
  const openEditModal = () => {
    setEditName(userBundle?.items?.find((i: any) => i.name === '이름')?.value || user.name || '');
    setEditPw('');
    setEditStoreName(userBundle?.store || storeName || '');
    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userBundle) { setEditError('계정 정보를 찾을 수 없습니다.'); return; }
    if (!editName.trim()) { setEditError('이름을 입력해 주세요.'); return; }
    if (editPw.trim()) {
      if (
        editPw.length < 8 ||
        !/[a-zA-Z]/.test(editPw) ||
        !/[0-9]/.test(editPw) ||
        !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(editPw)
      ) {
        setEditError('비밀번호: 영문 + 숫자 + 특수문자 포함 8자 이상');
        return;
      }
    }
    setIsSaving(true);
    setEditError('');
    try {
      const currentPw = userBundle.items?.find((i: any) => i.name === '비밀번호')?.value || '';
      const finalPw = editPw.trim() ? await hashPassword(editPw) : currentPw;
      const updatedItems = userBundle.items?.map((item: any) => {
        if (item.name === '이름') return { ...item, value: editName };
        if (item.name === '비밀번호') return { ...item, value: finalPw };
        return item;
      });
      const updatedBundle = { ...userBundle, title: `${editName}님 가입 정보 (수정)`, items: updatedItems, timestamp: new Date().toLocaleString() };
      const res = await apiFetch(`/api/bundle/${userBundle.id}`, { method: 'PUT', body: JSON.stringify(updatedBundle) });
      if (!res.ok) throw new Error('업데이트 실패');
      onProfileUpdated({ ...user, name: editName });
      alert('✨ 개인정보가 수정되었습니다!');
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.message || '서버 오류');
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabel = user.role === 'manager' ? '점장' : '점원';
  const roleColor = user.role === 'manager' ? '#f59e0b' : '#818cf8';
  const roleBg    = user.role === 'manager' ? 'rgba(245,158,11,0.12)' : 'rgba(129,140,248,0.12)';

  return (
    <div className="admin-page animate-fade-in" style={{ paddingBottom: '80px', maxWidth: '560px', margin: '0 auto' }}>

      {/* ── 헤더 ──────────────────────────── */}
      <div style={{ textAlign: 'center', padding: '24px 0 20px', marginBottom: '20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '3.2rem', marginBottom: '10px' }}>👤</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)' }}>
          안녕하세요, {user.name}님
        </h2>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.06)', padding: '4px 12px', borderRadius: '20px', color: 'var(--text-muted)' }}>
            🏪 {storeName}
          </span>
          <span style={{ fontSize: '0.8rem', background: roleBg, padding: '4px 12px', borderRadius: '20px', color: roleColor, fontWeight: 700 }}>
            {roleLabel}
          </span>
          <span style={{
            fontSize: '0.8rem', padding: '4px 12px', borderRadius: '20px', fontWeight: 700,
            background: isWorking ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
            color: isWorking ? '#10b981' : 'var(--text-muted)',
          }}>
            {isWorking ? '🟢 근무중' : '⚫ 퇴근'}
          </span>
        </div>
      </div>

      {/* ── 출퇴근 버튼 ───────────────────── */}
      <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '22px', marginBottom: '14px', border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          ⏱ 출퇴근
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* 출근 */}
          <button
            onClick={() => callAttendance('check-in')}
            disabled={isProcessing || isWorking}
            style={{
              padding: '20px 12px', borderRadius: '16px', border: 'none',
              background: isWorking ? 'rgba(255,255,255,0.03)' : '#059669',
              color: isWorking ? 'var(--text-muted)' : '#fff',
              fontWeight: 800, fontSize: '1.05rem',
              cursor: isWorking ? 'not-allowed' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              boxShadow: isWorking ? 'none' : '0 6px 16px rgba(5,150,105,0.35)',
              transition: 'all 0.2s', opacity: isWorking ? 0.4 : 1,
            }}
          >
            <span style={{ fontSize: '1.8rem' }}>🏃</span>
            출 근
          </button>
          {/* 퇴근 */}
          <button
            onClick={() => callAttendance('check-out')}
            disabled={isProcessing || !isWorking}
            style={{
              padding: '20px 12px', borderRadius: '16px', border: 'none',
              background: !isWorking ? 'rgba(255,255,255,0.03)' : '#ea580c',
              color: !isWorking ? 'var(--text-muted)' : '#fff',
              fontWeight: 800, fontSize: '1.05rem',
              cursor: !isWorking ? 'not-allowed' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              boxShadow: !isWorking ? 'none' : '0 6px 16px rgba(234,88,12,0.35)',
              transition: 'all 0.2s', opacity: !isWorking ? 0.4 : 1,
            }}
          >
            <span style={{ fontSize: '1.8rem' }}>🏠</span>
            퇴 근
          </button>
        </div>
        {isWorking && latestRecord && (
          <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            출근 시각:&nbsp;
            <strong style={{ color: '#10b981' }}>
              {fmtTime(latestRecord.items?.find((i: any) => i.name === '출근시간')?.value || '')}
            </strong>
          </div>
        )}
      </div>

      {/* ── 급여 요약 ──────────────────────── */}
      {employeeBundle && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
          {[
            { label: '계약 시급', value: wage > 0 ? `${wage.toLocaleString()}원` : '-' },
            { label: '누적 근무', value: `${parseFloat(cumHours).toFixed(1)}시간` },
            { label: '미지급 잔액', value: `${unpaid.toLocaleString()}원`, alert: unpaid > 0 },
          ].map(({ label, value, alert: isAlert }) => (
            <div key={label} style={{
              background: 'var(--surface)', borderRadius: '14px', padding: '14px 10px',
              border: `1px solid ${isAlert ? 'rgba(249,115,22,0.3)' : 'var(--border)'}`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>{label}</div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isAlert ? '#f97316' : 'var(--text-main)' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── 근태 로그 ──────────────────────── */}
      <div style={{ background: 'var(--surface)', borderRadius: '20px', padding: '20px', marginBottom: '14px', border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          🕒 최근 출퇴근 기록
        </h3>
        {myAttendance.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>출퇴근 기록이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {myAttendance.slice(0, 7).map(a => {
              const inRaw  = a.items?.find((i: any) => i.name === '출근시간')?.value || '';
              const outRaw = a.items?.find((i: any) => i.name === '퇴근시간')?.value || '';
              const mins   = parseInt(a.items?.find((i: any) => i.name === '근무분수')?.value || '0');
              const tardy  = a.items?.find((i: any) => i.name === '지각여부')?.value === '지각';
              const paid   = a.items?.find((i: any) => i.name === '정산상태')?.value === '지급';
              const working = a.status === 'working';
              const dur = mins > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : null;
              return (
                <div key={a.id} style={{
                  padding: '12px 14px', background: 'var(--bg-main)', borderRadius: '12px',
                  border: `1px solid ${working ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>{fmtDate(inRaw)}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {tardy  && <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>⚠️ 지각</span>}
                      {working && <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>근무중</span>}
                      <span style={{ fontSize: '0.65rem', background: paid ? '#dcfce7' : '#fef3c7', color: paid ? '#16a34a' : '#d97706', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        {paid ? '정산완료' : '미정산'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.88rem', flexWrap: 'wrap' }}>
                    <span>🏃 <strong style={{ color: '#16a34a' }}>{fmtTime(inRaw)}</strong></span>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <span>🏠 <strong style={{ color: working ? 'var(--text-muted)' : '#ea580c' }}>{working ? '퇴근 전' : fmtTime(outRaw)}</strong></span>
                    {dur && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({dur})</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 개인정보 수정 / 로그아웃 ─────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button
          onClick={openEditModal}
          style={{
            padding: '15px', borderRadius: '14px',
            border: '1.5px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text-main)', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
          }}
        >
          ✏️ 개인정보 수정
        </button>
        <button
          onClick={onLogout}
          style={{
            padding: '15px', borderRadius: '14px', border: 'none',
            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
            fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
          }}
        >
          🚪 로그아웃
        </button>
      </div>

      {/* ── 개인정보 수정 모달 ───────────── */}
      {showEditModal && (
        <EditProfileModal
          user={user}
          name={editName}
          password={editPw}
          editedStoreName={editStoreName}
          isSaving={isSaving}
          error={editError}
          onNameChange={setEditName}
          onPasswordChange={setEditPw}
          onStoreNameChange={setEditStoreName}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleSaveProfile}
        />
      )}
    </div>
  );
};
