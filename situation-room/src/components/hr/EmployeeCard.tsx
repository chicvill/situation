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

  const handleRowClick = () => {
    onSelect({
      id, name, role, wage, hours, cumulativeWage, paidWage, unpaidWage,
      contract: JSON.parse(contractStr),
      schedule: JSON.parse(scheduleStr)
    });
  };

  return (
    <tr
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        cursor: 'pointer',
        background: isSelected ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'background 0.2s'
      }}
      onClick={handleRowClick}
    >
      <td data-label="사원명(연락처)" style={{ padding: '16px 10px', fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-main)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div>
            👤 {name}
            {isSelected && <span style={{ color: 'var(--accent-orange)', marginLeft: '6px', fontSize: '0.75rem' }}>● 선택됨</span>}
          </div>
          {editingPhoneId === bundle.id ? (
            <input
              autoFocus
              defaultValue={id}
              onBlur={(ev) => onUpdatePhone(bundle, ev.target.value)}
              onKeyDown={(ev) => ev.key === 'Enter' && onUpdatePhone(bundle, (ev.target as HTMLInputElement).value)}
              style={{ width: '130px', background: 'var(--surface)', color: 'var(--text-main)', border: '2px solid var(--accent-orange)', padding: '4px', borderRadius: '6px', fontSize: '0.85rem' }}
            />
          ) : (
            <span
              onClick={(ev) => { ev.stopPropagation(); (userRole === 'owner' || userRole === 'admin') && onEditPhoneStart(bundle.id, id); }}
              style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', cursor: (userRole === 'owner' || userRole === 'admin') ? 'pointer' : 'default', borderBottom: (userRole === 'owner' || userRole === 'admin') ? '1px dashed var(--accent-orange)' : 'none' }}
            >
              📞 {id}
            </span>
          )}
        </div>
      </td>
      <td data-label="직책" style={{ padding: '16px 10px' }}>
        <span className={`role-badge ${role === '점장' ? 'owner-gold' : 'staff-blue'}`} style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '8px' }}>
          {role}
        </span>
      </td>
      <td data-label="계약 시급" style={{ padding: '16px 10px', fontWeight: '700', color: 'var(--text-main)' }}>
        {editingWageId === bundle.id ? (
          <input
            autoFocus
            defaultValue={wage}
            onBlur={(ev) => onUpdateWage(bundle, ev.target.value)}
            onKeyDown={(ev) => ev.key === 'Enter' && onUpdateWage(bundle, (ev.target as HTMLInputElement).value)}
            style={{ width: '80px', background: 'var(--surface)', color: 'var(--text-main)', border: '2px solid var(--accent-orange)', padding: '6px', borderRadius: '6px' }}
          />
        ) : (
          <span
            onClick={(ev) => { ev.stopPropagation(); (userRole === 'owner' || userRole === 'admin') && onEditWageStart(bundle.id, wage); }}
            style={{ borderBottom: '2px dashed var(--accent-orange)', cursor: (userRole === 'owner' || userRole === 'admin') ? 'pointer' : 'default' }}
          >
            {parseInt(wage).toLocaleString()}원
          </span>
        )}
      </td>
      <td data-label="누적 시간" style={{ padding: '16px 10px', opacity: 0.8, color: 'var(--text-main)' }}>{hours}시간</td>
      <td data-label="총 누적임금" style={{ padding: '16px 10px', fontWeight: '700', color: 'var(--text-main)' }}>{parseInt(cumulativeWage).toLocaleString()}원</td>
      <td data-label="지불된 임금" style={{ padding: '16px 10px', color: '#10b981', fontWeight: '800' }}>{parseInt(paidWage).toLocaleString()}원</td>
      <td data-label="미지급 임금" style={{ padding: '16px 10px', color: 'var(--accent-orange)', fontWeight: '900', fontSize: '1.05rem' }}>
        {parseInt(unpaidWage).toLocaleString()}원
      </td>
      <td data-label="관리 옵션" style={{ padding: '16px 10px', textAlign: 'right' }} onClick={(ev) => ev.stopPropagation()}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            onClick={() => onOpenPayroll({ id, name, role, wage, hours, cumulativeWage, paidWage, unpaidWage })}
            style={{ background: 'var(--surface)', color: 'var(--text-main)', border: '1.5px solid var(--border)', borderRadius: '10px', padding: '8px 14px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}
          >
            📄 명세서 확인
          </button>
          {(userRole === 'owner' || userRole === 'admin') && (
            <>
              <button
                onClick={(ev) => onForceAttendance(ev, bundle, 'check-in')}
                style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', borderRadius: '10px', padding: '8px 12px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}
              >
                🏃출근
              </button>
              <button
                onClick={(ev) => onForceAttendance(ev, bundle, 'check-out')}
                style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--accent-orange)', border: '1px solid var(--accent-orange)', borderRadius: '10px', padding: '8px 12px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}
              >
                🏠퇴근
              </button>
            </>
          )}
          {userRole === 'owner' && parseInt(unpaidWage) > 0 && (
            <button
              onClick={() => onPaySalary(id, name)}
              className="confirm-btn success-green"
              style={{ fontSize: '0.8rem', padding: '8px 14px', borderRadius: '10px', fontWeight: '800' }}
            >
              💸 급여 지급
            </button>
          )}
          {userRole === 'owner' && (
            <button onClick={() => onResignEmployee(bundle)} className="del-btn" style={{ fontSize: '0.8rem', padding: '8px 14px', borderRadius: '10px', fontWeight: '800' }}>퇴사</button>
          )}
        </div>
      </td>
    </tr>
  );
};
