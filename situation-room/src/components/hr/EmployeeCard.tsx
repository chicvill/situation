import React from 'react';
import type { Bundle, EmployeeDetail } from './types';
import { formatPhone } from '../../utils/formatters';

interface EmployeeCardProps {
  bundle: Bundle;
  isSelected: boolean;
  onSelect: (detail: EmployeeDetail) => void;
}

export const EmployeeCard: React.FC<EmployeeCardProps> = ({
  bundle,
  isSelected,
  onSelect,
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
  /** 전화번호 형식이 아닌 구형 ID 여부 */
  const isLegacyId = !/^01[0-9]{8,9}$/.test(id.replace(/[^0-9]/g, ''));

  const handleCardClick = () => {
    onSelect({
      id, name, role, wage, hours, cumulativeWage, paidWage, unpaidWage,
      contract: JSON.parse(contractStr),
      schedule: JSON.parse(scheduleStr),
      rawBundle: bundle
    });
  };

  return (
    <div
      onClick={handleCardClick}
      style={{
        padding: '14px 20px',
        border: `1.5px solid ${isSelected ? 'var(--accent-orange)' : 'var(--border)'}`,
        borderRadius: '12px',
        background: isSelected ? 'rgba(249,115,22,0.06)' : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <span style={{ fontSize: '1.2rem' }}>{isLegacyId ? '⚠️' : '👤'}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{name}</strong>
          <span style={{ fontSize: '0.78rem', color: isLegacyId ? '#f97316' : 'var(--text-muted)' }}>
            {isLegacyId ? `🔧 구형ID: ${id}` : `📞 ${formatPhone(id)}`}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <span className={`role-badge ${role === '점장' ? 'owner-gold' : 'staff-blue'}`} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '8px', fontWeight: 600 }}>
          {role}
        </span>
        {isLegacyId && (
          <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '6px', fontWeight: 700, background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
            재등록 필요
          </span>
        )}
      </div>
    </div>
  );
};
