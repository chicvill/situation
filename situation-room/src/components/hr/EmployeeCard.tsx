import React from 'react';
import type { Bundle, EmployeeDetail, PayrollInfo } from './types';

interface EmployeeCardProps {
  bundle: Bundle;
  isSelected: boolean;
  userRole: string;
  editingWageId: string | null;
  editingPhoneId: string | null;
  isProcessing: boolean;
  onSelect: (detail: EmployeeDetail) => void;
  onEditWageStart: (bundleId: string, wage: string) => void;
  onEditPhoneStart: (bundleId: string, phone: string) => void;
  onUpdateWage: (bundle: Bundle, newWage: string) => void;
  onUpdatePhone: (bundle: Bundle, newPhone: string) => void;
  onForceAttendance: (ev: React.MouseEvent, bundle: Bundle, action: 'check-in' | 'check-out') => void;
  onPaySalary: (staffId: string, name: string) => void;
  onResignEmployee: (bundle: Bundle) => void;
  onOpenPayroll: (info: PayrollInfo) => void;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  bundle,
  isSelected,
  userRole,
  editingWageId,
  editingPhoneId,
  isProcessing: _isProcessing,
  onSelect,
  onEditWageStart,
  onEditPhoneStart,
  onUpdateWage,
  onUpdatePhone,
  onForceAttendance,
  onPaySalary,
  onResignEmployee,
  onOpenPayroll,
}) => {
  const name = bundle.items?.find((i) => i.name === '이름')?.value || '-';
  const id = bundle.items?.find((i) => i.name === '아이디')?.value || bundle.id;
  const role = bundle.items?.find((i) => i.name === '직책')?.value || '점원';
  const wage = bundle.items?.find((i) => i.name === '시급')?.value || '10,000';
  const hours = bundle.items?.find((i) => i.name === '누적시간')?.value || '0.0';
  const cumulativeWage = bundle.items?.find((i) => i.name === '누적임금')?.value || '0';
  const paidWage = bundle.items?.find((i) => i.name === '지불된임금')?.value || '0';
  const unpaidWage = bundle.items?.find((i) => i.name === '미지급임금')?.value || '0';
  const contractStr = bundle.items?.find((i) => i.name === '계약정보')?.value || '{}';
  const scheduleStr = bundle.items?.find((i) => i.name === '스케줄')?.value || '[]';

  const handleCardClick = () => {
    onSelect({
      id, name, role, wage, hours, cumulativeWage, paidWage, unpaidWage,
      contract: JSON.parse(contractStr),
      schedule: JSON.parse(scheduleStr)
    });
  };

  return (
    <div
      onClick={handleCardClick}
      style={{
        padding: '16px',
        border: `1.5px solid ${isSelected ? 'var(--accent-orange)' : 'var(--border)'}`,
        borderRadius: '16px',
        background: isSelected ? 'rgba(249,115,22,0.04)' : 'rgba(255,255,255,0.015)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {/* 상단: 이름, 직책, 연락처 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
            👤 {name}
            {isSelected && <span style={{ color: 'var(--accent-orange)', marginLeft: '6px', fontSize: '0.72rem' }}>● 선택됨</span>}
          </div>
          {editingPhoneId === bundle.id ? (
            <input
              autoFocus
              defaultValue={id}
              onBlur={(ev) => onUpdatePhone(bundle, ev.target.value)}
              onKeyDown={(ev) => ev.key === 'Enter' && onUpdatePhone(bundle, (ev.target as HTMLInputElement).value)}
              onClick={(ev) => ev.stopPropagation()}
              style={{ width: '160px', background: 'var(--surface)', color: 'var(--text-main)', border: '2px solid var(--accent-orange)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.82rem' }}
            />
          ) : (
            <span
              onClick={(ev) => { ev.stopPropagation(); (userRole === 'owner' || userRole === 'admin') && onEditPhoneStart(bundle.id, id); }}
              style={{ fontSize: '0.82rem', color: 'var(--text-muted)', cursor: (userRole === 'owner' || userRole === 'admin') ? 'pointer' : 'default', borderBottom: (userRole === 'owner' || userRole === 'admin') ? '1px dashed var(--accent-orange)' : 'none', width: 'fit-content' }}
            >
              📞 {id}
            </span>
          )}
        </div>
        <span className={`role-badge ${role === '점장' ? 'owner-gold' : 'staff-blue'}`} style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '8px', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '8px' }}>
          {role}
        </span>
      </div>

      {/* 중단: 임금 통계 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
        <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>계약 시급</div>
          {editingWageId === bundle.id ? (
            <input
              autoFocus
              defaultValue={wage}
              onBlur={(ev) => onUpdateWage(bundle, ev.target.value)}
              onKeyDown={(ev) => ev.key === 'Enter' && onUpdateWage(bundle, (ev.target as HTMLInputElement).value)}
              onClick={(ev) => ev.stopPropagation()}
              style={{ width: '90px', background: 'var(--surface)', color: 'var(--text-main)', border: '2px solid var(--accent-orange)', padding: '4px', borderRadius: '6px', fontSize: '0.85rem' }}
            />
          ) : (
            <div
              onClick={(ev) => { ev.stopPropagation(); (userRole === 'owner' || userRole === 'admin') && onEditWageStart(bundle.id, wage); }}
              style={{ fontWeight: 700, fontSize: '0.9rem', borderBottom: '2px dashed var(--accent-orange)', cursor: (userRole === 'owner' || userRole === 'admin') ? 'pointer' : 'default', width: 'fit-content' }}
            >
              {parseInt(wage).toLocaleString()}원
            </div>
          )}
        </div>
        <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>누적 근무</div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{hours}시간</div>
        </div>
        <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>총 누적임금</div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{parseInt(cumulativeWage).toLocaleString()}원</div>
        </div>
        <div style={{ padding: '8px 10px', background: parseInt(unpaidWage) > 0 ? 'rgba(249,115,22,0.07)' : 'rgba(0,0,0,0.2)', borderRadius: '10px', border: parseInt(unpaidWage) > 0 ? '1px solid rgba(249,115,22,0.2)' : 'none' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>미지급 잔액</div>
          <div style={{ fontWeight: 900, fontSize: '0.95rem', color: parseInt(unpaidWage) > 0 ? 'var(--accent-orange)' : '#10b981' }}>
            {parseInt(unpaidWage).toLocaleString()}원
          </div>
        </div>
      </div>

      {/* 하단: 액션 버튼 */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} onClick={(ev) => ev.stopPropagation()}>
        <button
          onClick={() => onOpenPayroll({ id, name, role, wage, hours, cumulativeWage, paidWage, unpaidWage })}
          style={{ background: 'var(--surface)', color: 'var(--text-main)', border: '1.5px solid var(--border)', borderRadius: '8px', padding: '7px 12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
        >
          📄 명세서
        </button>
        {(userRole === 'owner' || userRole === 'admin') && (
          <>
            <button
              onClick={(ev) => onForceAttendance(ev, bundle, 'check-in')}
              style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', borderRadius: '8px', padding: '7px 12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
            >
              🏃 출근
            </button>
            <button
              onClick={(ev) => onForceAttendance(ev, bundle, 'check-out')}
              style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--accent-orange)', border: '1px solid var(--accent-orange)', borderRadius: '8px', padding: '7px 12px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
            >
              🏠 퇴근
            </button>
          </>
        )}
        {userRole === 'owner' && parseInt(unpaidWage) > 0 && (
          <button
            onClick={() => onPaySalary(id, name)}
            className="confirm-btn success-green"
            style={{ fontSize: '0.78rem', padding: '7px 12px', borderRadius: '8px', fontWeight: 800 }}
          >
            💸 급여 지급
          </button>
        )}
        {userRole === 'owner' && (
          <button onClick={() => onResignEmployee(bundle)} className="del-btn" style={{ fontSize: '0.78rem', padding: '7px 12px', borderRadius: '8px', fontWeight: 800 }}>퇴사</button>
        )}
      </div>
    </div>
  );
};
