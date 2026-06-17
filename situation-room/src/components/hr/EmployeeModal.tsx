import React, { useState, useEffect } from 'react';
import type { Bundle, EmployeeDetail } from './types';
import { apiFetch } from '../../utils/apiFetch';
import { formatPhone, formatJuminNo } from '../../utils/formatters';

interface EmployeeModalProps {
  employee: EmployeeDetail;
  userRole: string;
  storeId: string;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  onClose: () => void;
  employeeAttendance: Bundle[];
  handleForceAttendance: (ev: React.MouseEvent, bundle: Bundle, action: 'check-in' | 'check-out') => void;
  handleResignEmployee: (bundle: Bundle) => void;
  handleDeleteLog: (ev: React.MouseEvent, bundleId: string) => void;
  setPayrollModal: (payroll: any) => void;
  onRefresh?: () => void;
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  employee,
  userRole,
  storeId,
  isProcessing,
  setIsProcessing,
  onClose,
  employeeAttendance,
  handleForceAttendance,
  handleResignEmployee,
  handleDeleteLog,
  setPayrollModal,
  onRefresh,
}) => {
  const [isEditingAll, setIsEditingAll] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('staff');
  const [editWage, setEditWage] = useState('10500');
  const [editGender, setEditGender] = useState('미지정');
  const [editBirthDate, setEditBirthDate] = useState('1995-01-01');
  const [editResidentNo, setEditResidentNo] = useState('');
  const [editContractStart, setEditContractStart] = useState('2026-05-01');
  const [editContractEnd, setEditContractEnd] = useState('2029-12-31');
  const [editEmploymentType, setEditEmploymentType] = useState('알바');
  const [editSeveranceEligible, setEditSeveranceEligible] = useState('미대상');
  const [editSchedules, setEditSchedules] = useState<{ [key: number]: { active: boolean; start: string; end: string } }>({});

  const [expandStats, setExpandStats] = useState(false);
  const [expandPersonal, setExpandPersonal] = useState(false);
  const [expandSchedule, setExpandSchedule] = useState(false);
  const [expandLogs, setExpandLogs] = useState(false);

  useEffect(() => {
    setEditName(employee.name || '');
    setEditRole(employee.role === '점장' ? 'manager' : 'staff');
    setEditWage(employee.wage || '10500');
    setEditGender(employee.contract?.gender || '미지정');
    setEditBirthDate(employee.contract?.birth_date || '1995-01-01');
    setEditResidentNo(employee.contract?.resident_no || '');
    setEditContractStart(employee.contract?.start || '2026-05-01');
    setEditContractEnd(employee.contract?.end || '2029-12-31');
    setEditEmploymentType(employee.contract?.employment_type || (employee.contract?.end === '9999-12-31' ? '정규직' : '알바'));
    // 퇴직금 대상 자동 판단: 계속근로 1년 이상 AND 주 소정근로 15시간 이상
    const weeklyScheduledHrs = employee.schedule?.reduce((sum, s) => {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
    }, 0) || 0;
    const contractStartDate = employee.contract?.start ? new Date(employee.contract.start) : null;
    const hasOneYearPlus = contractStartDate
      ? (Date.now() - contractStartDate.getTime()) >= 365 * 24 * 60 * 60 * 1000
      : false;
    const autoSeverance = (hasOneYearPlus && weeklyScheduledHrs >= 15) ? '대상' : '미대상';
    setEditSeveranceEligible(employee.contract?.severance_eligible || autoSeverance);

    // Initialize schedules
    const initialSchedules: { [key: number]: { active: boolean; start: string; end: string } } = {
      0: { active: false, start: '09:00', end: '18:00' },
      1: { active: false, start: '09:00', end: '18:00' },
      2: { active: false, start: '09:00', end: '18:00' },
      3: { active: false, start: '09:00', end: '18:00' },
      4: { active: false, start: '09:00', end: '18:00' },
      5: { active: false, start: '09:00', end: '18:00' },
      6: { active: false, start: '09:00', end: '18:00' },
    };
    employee.schedule?.forEach((s: any) => {
      initialSchedules[s.day_of_week] = {
        active: true,
        start: s.start_time || '09:00',
        end: s.end_time || '18:00',
      };
    });
    setEditSchedules(initialSchedules);
    setIsEditingAll(false);
  }, [employee]);

  const handleSaveAllDetails = async () => {
    setIsProcessing(true);
    try {
      const schedulesList = Object.entries(editSchedules)
        .filter(([_key, val]) => val.active)
        .map(([day, val]) => ({
          day_of_week: parseInt(day),
          start_time: val.start,
          end_time: val.end,
        }));

      const response = await apiFetch(`/api/staff/update-all`, {
        method: 'POST',
        body: JSON.stringify({
          staff_id: employee.id,
          new_staff_id: employee.id, // ID는 변경 불가 — 항상 원본 유지
          name: editName.trim(),
          role: editRole,
          hourly_wage: parseInt(editWage.replace(/[^0-9]/g, '') || '10500'),
          status: employee.rawBundle?.status || 'approved',
          store_id: storeId === 'Total' ? 'store-korean' : storeId,
          gender: editGender,
          birth_date: editBirthDate,
          contract_start: editContractStart,
          contract_end: editContractEnd,
          employment_type: editEmploymentType,
          severance_eligible: editSeveranceEligible,
          resident_no: editResidentNo.replace(/[^0-9]/g, ''), // 숫자만 백엔드로 전송
          schedules: schedulesList,
        }),
      });

      if (response.ok) {
        alert('✅ 직원의 개인정보, 계약조건 및 스케줄이 모두 성공적으로 업데이트되었습니다.');
        setIsEditingAll(false);
        if (onRefresh) onRefresh();
      } else {
        const errResult = await response.json();
        alert(`❌ 저장 실패: ${errResult.detail || '오류 발생'}`);
      }
    } catch (err: any) {
      alert(`❌ 서버 연동 에러: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        backdropFilter: 'blur(6px)',
        padding: '10px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '16px',
          borderRadius: '16px',
          boxSizing: 'border-box',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          color: '#1e293b',
          position: 'relative',
          fontFamily: 'system-ui, sans-serif',
        }}
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 200px', minWidth: 0 }}>
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>👤</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'normal', wordBreak: 'keep-all' }}>
                {employee.name} ({employee.role}) {isEditingAll ? '수정' : '상세'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b', whiteSpace: 'normal', wordBreak: 'keep-all' }}>
                사원 마스터 데이터 관리
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            {isEditingAll ? (
              <button onClick={() => setIsEditingAll(false)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#1e293b', fontSize: '0.85rem', fontWeight: 800, borderRadius: '8px', padding: '6px 14px', cursor: 'pointer' }}>
                수정 닫기
              </button>
            ) : (
              <>
                {(userRole === 'owner' || userRole === 'admin') && (
                  <button
                    onClick={() => setIsEditingAll(true)}
                    style={{
                      background: '#f1f5f9',
                      color: '#1e293b',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    ⚙️ 정보 수정
                  </button>
                )}
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.5rem', cursor: 'pointer', padding: '4px' }}>✕</button>
              </>
            )}
          </div>
        </div>

        {/* ── 구형 ID 경고 배너 ── */}
        {!/^01[0-9]{8,9}$/.test(employee.id) && (
          <div style={{
            marginBottom: '16px', padding: '12px 16px', borderRadius: '12px',
            background: 'rgba(249,115,22,0.08)', border: '1.5px solid rgba(249,115,22,0.35)',
            display: 'flex', gap: '10px', alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>⚠️</span>
            <div style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: '1.6' }}>
              <strong style={{ color: '#c2410c', display: 'block', marginBottom: '2px' }}>구형 ID — QR 출퇴근 불가</strong>
              이 직원의 ID(<code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: '4px' }}>{employee.id}</code>)는
              전화번호 형식이 아니므로 QR 키오스크 및 스마트폰 출퇴근이 작동하지 않습니다.<br />
              <strong>퇴사 처리 후 전화번호로 신규 등록</strong>하면 정상 이용 가능합니다.
            </div>
          </div>
        )}

        {isEditingAll ? (
          /* ─── [수정 모드] 통합 마스터 정보 및 스케줄 수정 폼 ─── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 1. 개인 신상 정보 */}
            <div style={{ padding: '14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', borderLeft: '3px solid #f97316', paddingLeft: '8px' }}>
                1. 인적 사항 및 개인정보
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>이름 (실명)</label>
                  <input type="text" value={editName} onChange={(ev) => setEditName(ev.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                    연락처 (ID) <span style={{ fontWeight: 400, color: '#94a3b8' }}>— 수정 불가</span>
                  </label>
                  <div style={{
                    padding: '10px 12px', borderRadius: '8px', fontSize: '0.88rem',
                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                    color: '#64748b', fontWeight: 600, letterSpacing: '0.3px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    🔒 {employee.id}
                  </div>
                  <span style={{ fontSize: '0.71rem', color: '#94a3b8', lineHeight: '1.5' }}>
                    ID는 출퇴근·급여 정산의 기준 키입니다. 변경이 필요하면 퇴사 처리 후 신규 등록하세요.
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>성별</label>
                  <select value={editGender} onChange={(ev) => setEditGender(ev.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: 'white' }}>
                    <option value="미지정">미지정</option>
                    <option value="남성">남성</option>
                    <option value="여성">여성</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>생년월일</label>
                  <input type="date" value={editBirthDate} onChange={(ev) => setEditBirthDate(ev.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>주민등록번호</label>
                  <input type="text" value={editResidentNo} onChange={(ev) => setEditResidentNo(formatJuminNo(ev.target.value))} placeholder="xxxxxx-xxxxxxx" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }} maxLength={14} />
                </div>
              </div>
            </div>

            {/* 2. 계약 근로 조건 */}
            <div style={{ padding: '14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', borderLeft: '3px solid #f97316', paddingLeft: '8px' }}>
                2. 근무 및 계약 근로 조건
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>직책</label>
                  <select value={editRole} onChange={(ev) => setEditRole(ev.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: 'white' }}>
                    <option value="staff">점원 (Staff)</option>
                    <option value="manager">점장 (Manager)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>계약 시급 (원)</label>
                  <input
                    type="text"
                    value={editWage}
                    onChange={(ev) => setEditWage(ev.target.value.replace(/[^0-9]/g, ''))}
                    style={{
                      padding: '10px 12px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 'bold',
                      border: `1px solid ${parseInt(editWage) < 10030 ? '#f87171' : '#cbd5e1'}`,
                    }}
                    required
                  />
                  {parseInt(editWage) < 10030 && (
                    <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>
                      ⚠️ 2025년 최저임금(10,030원) 미만입니다
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>근무 구분</label>
                  <select value={editEmploymentType} onChange={(ev) => setEditEmploymentType(ev.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: 'white' }}>
                    <option value="알바">임시/단기 알바생</option>
                    <option value="정규직">정규 근로자</option>
                    <option value="계약직">계약 근로자</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>퇴직금 지급 대상 여부</label>
                  <select value={editSeveranceEligible} onChange={(ev) => setEditSeveranceEligible(ev.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', background: 'white' }}>
                    <option value="미대상">❌ 미대상 (누적근무 부족)</option>
                    <option value="대상">✅ 지급 대상 (주 15시간 이상)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>계약 시작일</label>
                  <input type="date" value={editContractStart} onChange={(ev) => setEditContractStart(ev.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>계약 종료일</label>
                  <input type="date" value={editContractEnd} onChange={(ev) => setEditContractEnd(ev.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }} />
                </div>
              </div>
            </div>

            {/* 3. 주간 출퇴근 근로 스케줄 */}
            <div style={{ padding: '14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', borderLeft: '3px solid #f97316', paddingLeft: '8px' }}>
                3. 주간 출퇴근 근로 스케줄
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {["월", "화", "수", "목", "금", "토", "일"].map((dayName, idx) => {
                  const daySched = editSchedules[idx] || { active: false, start: '09:00', end: '18:00' };
                  return (
                    <div key={dayName} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px', padding: '8px 12px', background: daySched.active ? '#eff6ff' : 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100px' }}>
                        <input
                          type="checkbox"
                          checked={daySched.active}
                          onChange={(ev) => setEditSchedules({ ...editSchedules, [idx]: { ...daySched, active: ev.target.checked } })}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#f97316' }}
                        />
                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{dayName}요일</span>
                      </div>
                      {daySched.active ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input type="time" value={daySched.start} onChange={(ev) => setEditSchedules({ ...editSchedules, [idx]: { ...daySched, start: ev.target.value } })} style={{ padding: '4px 8px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                          <span style={{ color: '#64748b' }}>~</span>
                          <input type="time" value={daySched.end} onChange={(ev) => setEditSchedules({ ...editSchedules, [idx]: { ...daySched, end: ev.target.value } })} style={{ padding: '4px 8px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>휴무</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 수정 모드 확인 버튼 */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                onClick={() => setIsEditingAll(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                수정 닫기
              </button>
              <button
                onClick={handleSaveAllDetails}
                style={{
                  padding: '10px 30px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#f97316',
                  color: 'white',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(249,115,22,0.2)',
                }}
                disabled={isProcessing}
              >
                {isProcessing ? '저장 중...' : '💾 마스터 정보 저장'}
              </button>
            </div>
          </div>
        ) : (
          /* ─── [일반 모드] 정보 조회 및 근태 로그 ─── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* 맨 위에 강제출근/퇴근 버튼 */}
            {(userRole === 'owner' || userRole === 'admin') && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={(ev) => handleForceAttendance(ev, employee.rawBundle, 'check-in')}
                  style={{ flex: '1 1 130px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '12px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}
                >
                  🏃 강제 출근 등록
                </button>
                <button
                  onClick={(ev) => handleForceAttendance(ev, employee.rawBundle, 'check-out')}
                  style={{ flex: '1 1 130px', background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', borderRadius: '10px', padding: '12px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}
                >
                  🏠 강제 퇴근 등록
                </button>
              </div>
            )}

            {/* Accordion 1: 급여명세서 확인 */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#ffffff' }}>
              <button onClick={() => setExpandStats(!expandStats)} style={{ width: '100%', padding: '16px', background: expandStats ? '#f8fafc' : '#ffffff', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', cursor: 'pointer' }}>
                <span>💰 급여명세서 확인 및 요약 통계</span>
                <span style={{ color: '#94a3b8' }}>{expandStats ? '▲' : '▼'}</span>
              </button>
              {expandStats && (
                <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                    <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>계약 시급</div>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>{parseInt(employee.wage).toLocaleString()}원</div>
                    </div>
                    <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>누적 근무 시간</div>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>{employee.hours}시간</div>
                    </div>
                    <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>총 누적 임금 (기본급)</div>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>{parseInt(employee.cumulativeWage).toLocaleString()}원</div>
                    </div>
                    <div style={{ padding: '16px', background: parseInt(employee.unpaidWage) > 0 ? '#fff7ed' : '#f0fdf4', border: `1px solid ${parseInt(employee.unpaidWage) > 0 ? '#ffedd5' : '#bbf7d0'}`, borderRadius: '12px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>미지급 잔액</div>
                      <div style={{ fontWeight: 900, fontSize: '1.2rem', color: parseInt(employee.unpaidWage) > 0 ? '#ea580c' : '#16a34a' }}>{parseInt(employee.unpaidWage).toLocaleString()}원</div>
                    </div>
                  </div>
                  {/* 주휴수당 안내 배너 */}
                  {(() => {
                    const wkHrs = employee.schedule?.reduce((sum, s) => {
                      const [sh, sm] = s.start_time.split(':').map(Number);
                      const [eh, em] = s.end_time.split(':').map(Number);
                      return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
                    }, 0) || 0;
                    if (wkHrs < 15) return null;
                    const wkHolPay = Math.floor((wkHrs / 40) * 8 * parseInt(employee.wage));
                    return (
                      <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '12px 16px', fontSize: '0.8rem', lineHeight: '1.6', color: '#92400e' }}>
                        <strong>⚠️ 주휴수당 미포함 안내</strong><br />
                        주 {wkHrs.toFixed(1)}시간 근무 → 주휴수당 발생 조건 충족 (주 15시간 이상)<br />
                        주당 지급액: <strong>{wkHolPay.toLocaleString()}원</strong>
                        <span style={{ fontSize: '0.72rem', display: 'block', marginTop: '4px', color: '#a16207' }}>
                          주휴수당 = 주간 소정근로시간({wkHrs.toFixed(1)}h) ÷ 40 × 8 × 시급({parseInt(employee.wage).toLocaleString()}원)<br />
                          ※ 위 기본급에 미포함 — 급여 명세서에서 확인 가능
                        </span>
                      </div>
                    );
                  })()}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setPayrollModal({
                        id: employee.id, name: employee.name, role: employee.role, wage: employee.wage, hours: employee.hours,
                        cumulativeWage: employee.cumulativeWage, paidWage: employee.paidWage, unpaidWage: employee.unpaidWage,
                        employmentType: employee.contract?.employment_type,
                        schedule: employee.schedule,
                        contractStart: employee.contract?.start,
                      })}
                      style={{ background: '#f8fafc', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 16px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', flex: 1 }}
                    >
                      📄 급여 명세서 상세 확인
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: 개인 신상 및 계약조건 */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#ffffff' }}>
              <button onClick={() => setExpandPersonal(!expandPersonal)} style={{ width: '100%', padding: '16px', background: expandPersonal ? '#f8fafc' : '#ffffff', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', cursor: 'pointer' }}>
                <span>📋 개인 신상 및 계약조건</span>
                <span style={{ color: '#94a3b8' }}>{expandPersonal ? '▲' : '▼'}</span>
              </button>
              {expandPersonal && (
                <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ color: '#64748b', fontWeight: 600, flexShrink: 0, marginRight: '16px' }}>성명 (실명)</span>
                    <span style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-all', textAlign: 'right' }}>{employee.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ color: '#64748b', fontWeight: 600, flexShrink: 0, marginRight: '16px' }}>연락처 (ID)</span>
                    <span style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-all', textAlign: 'right' }}>📞 {formatPhone(employee.id)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ color: '#64748b', fontWeight: 600, flexShrink: 0, marginRight: '16px' }}>성별</span>
                    <span style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-all', textAlign: 'right' }}>{employee.contract?.gender || '미지정'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ color: '#64748b', fontWeight: 600, flexShrink: 0, marginRight: '16px' }}>생년월일</span>
                    <span style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-all', textAlign: 'right' }}>{employee.contract?.birth_date || '1995-01-01'}</span>
                  </div>
                  {employee.contract?.resident_no && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f8fafc' }}>
                      <span style={{ color: '#64748b', fontWeight: 600, flexShrink: 0, marginRight: '16px' }}>주민등록번호</span>
                      <span style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-all', textAlign: 'right' }}>{formatJuminNo(employee.contract.resident_no)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ color: '#64748b', fontWeight: 600, flexShrink: 0, marginRight: '16px' }}>직책 / 권한</span>
                    <span style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-all', textAlign: 'right' }}>{employee.role}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ color: '#64748b', fontWeight: 600, flexShrink: 0, marginRight: '16px' }}>계약 근로 기간</span>
                    <span style={{ fontWeight: 600, color: '#0f172a', wordBreak: 'break-all', textAlign: 'right' }}>{employee.contract?.start || '2026-05-01'} ~ {employee.contract?.end || '2029-12-31'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f8fafc' }}>
                    <span style={{ color: '#64748b', fontWeight: 600, flexShrink: 0, marginRight: '16px' }}>근무 구분</span>
                    <span style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-all', textAlign: 'right' }}>{employee.contract?.employment_type || (employee.contract?.end === '9999-12-31' ? '정규 근로자' : '임시/단기 알바생')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b', fontWeight: 600, flexShrink: 0, marginRight: '16px' }}>퇴직금 대상</span>
                    <span style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-all', textAlign: 'right' }}>{employee.contract?.severance_eligible || (parseFloat(employee.hours) >= 60 ? '✅ 지급 대상' : '❌ 미대상')}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: 요일별 출퇴근 약정 스케줄 */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#ffffff' }}>
              <button onClick={() => setExpandSchedule(!expandSchedule)} style={{ width: '100%', padding: '16px', background: expandSchedule ? '#f8fafc' : '#ffffff', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', cursor: 'pointer' }}>
                <span>📅 요일별 출퇴근 약정 스케줄</span>
                <span style={{ color: '#94a3b8' }}>{expandSchedule ? '▲' : '▼'}</span>
              </button>
              {expandSchedule && (
                <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b' }}>
                        <th style={{ padding: '6px 4px', fontWeight: 600 }}>근무 요일</th>
                        <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>근무 시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["월", "화", "수", "목", "금", "토", "일"].map((day, idx) => {
                        const sched = employee.schedule?.find((s) => s.day_of_week === idx);
                        return (
                          <tr key={day} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '8px 4px', fontWeight: 700, color: '#334155' }}>{day}요일</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right', color: sched ? '#0f172a' : '#cbd5e1', fontWeight: sched ? 600 : 400 }}>
                              {sched ? `⏰ ${sched.start_time} ~ ${sched.end_time}` : '휴무'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Accordion 4: 일별 출퇴근 현황 로그 */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#ffffff' }}>
              <button onClick={() => setExpandLogs(!expandLogs)} style={{ width: '100%', padding: '16px', background: expandLogs ? '#f8fafc' : '#ffffff', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', cursor: 'pointer' }}>
                <span>🕒 일별 출퇴근 현황 로그</span>
                <span style={{ color: '#94a3b8' }}>{expandLogs ? '▲' : '▼'}</span>
              </button>
              {expandLogs && (
                <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {employeeAttendance.length > 0 ? (
                      employeeAttendance.map((a) => {
                        const checkinRaw = a.items?.find((i: any) => i.name === '출근시간')?.value || '';
                        const checkoutRaw = a.items?.find((i: any) => i.name === '퇴근시간')?.value || '';
                        const workMinutes = parseInt(a.items?.find((i: any) => i.name === '근무분수')?.value || '0');
                        const tardy = a.items?.find((i: any) => i.name === '지각여부')?.value === '지각';
                        const paid = a.items?.find((i: any) => i.name === '정산상태')?.value === '지급';
                        const isWorking = a.status === 'working';
    
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
                        const workHours = workMinutes > 0 ? `${Math.floor(workMinutes / 60)}시간 ${workMinutes % 60}분` : null;
    
                        return (
                          <div
                            key={a.id}
                            style={{
                              padding: '12px 16px',
                              background: '#f8fafc',
                              border: `1px solid ${isWorking ? '#bbf7d0' : '#e2e8f0'}`,
                              borderRadius: '10px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '10px',
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{fmtDate(checkinRaw)}</span>
                                {isWorking && <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>근무중</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                                <span style={{ color: '#334155' }}>
                                  🏃 <strong style={{ color: '#16a34a' }}>{fmtTime(checkinRaw)}</strong>
                                </span>
                                <span style={{ color: '#cbd5e1' }}>→</span>
                                <span style={{ color: '#334155' }}>
                                  🏠 <strong style={{ color: isWorking ? '#94a3b8' : '#ea580c' }}>{isWorking ? '퇴근 전' : fmtTime(checkoutRaw)}</strong>
                                </span>
                                {workHours && <span style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 600 }}>({workHours})</span>}
                              </div>
                              <div style={{ display: 'flex', gap: '5px', marginTop: '4px', flexWrap: 'wrap' }}>
                                {tardy && <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>⚠️ 지각</span>}
                                <span style={{ background: paid ? '#dcfce7' : '#fef3c7', color: paid ? '#16a34a' : '#d97706', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                                  {paid ? '정산완료' : '미정산'}
                                </span>
                              </div>
                            </div>
                            {(userRole === 'owner' || userRole === 'admin') && (
                              <button
                                onClick={(ev) => handleDeleteLog(ev, a.id)}
                                style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '4px 8px', borderRadius: '6px', fontSize: '0.68rem', cursor: 'pointer', flexShrink: 0, fontWeight: 700 }}
                              >
                                기록 삭제
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ textAlign: 'center', padding: '30px', opacity: 0.5, fontSize: '0.8rem', color: '#64748b' }}>기록된 출퇴근 로그가 없습니다.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 퇴사 처리 버튼 */}
            {userRole === 'owner' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => handleResignEmployee(employee.rawBundle)}
                  style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', fontSize: '0.85rem', padding: '10px 16px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}
                >
                  🚫 사원 퇴사 처리
                </button>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
};
