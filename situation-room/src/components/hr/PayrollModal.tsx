import React from 'react';
import type { PayrollInfo } from './types';

interface PayrollModalProps {
  payrollModal: PayrollInfo;
  isProcessing: boolean;
  userRole: string;
  onClose: () => void;
  onPaySalary: (staffId: string, name: string) => void;
}

export const PayrollModal: React.FC<PayrollModalProps> = ({
  payrollModal,
  isProcessing,
  userRole,
  onClose,
  onPaySalary,
}) => {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(6px)'
    }}>
      <div style={{
        width: '380px', padding: '30px', borderRadius: '24px',
        background: '#151515', border: '1px solid rgba(255,255,255,0.08)',
        position: 'relative', boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
        color: '#eee', fontFamily: 'monospace'
      }}>
        {/* 영수증 상단 데코 */}
        <div style={{ textAlign: 'center', borderBottom: '1.5px dashed rgba(255,255,255,0.15)', paddingBottom: '20px', marginBottom: '20px' }}>
          <span style={{ fontSize: '1.8rem' }}>🧾</span>
          <h4 style={{ margin: '10px 0 4px 0', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '1px' }}>PAYROLL STATEMENT</h4>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>식당 통합 정산 센터 영수증</span>
        </div>

        {/* 디테일 리스트 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>성 명 (사원명):</span>
            <strong>{payrollModal.name} ({payrollModal.role})</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>계약 시급:</span>
            <strong>{Math.floor(Number(payrollModal.wage) || 0).toLocaleString()}원</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>당월 누적근무시간:</span>
            <strong>{payrollModal.hours}시간</strong>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '4px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>기본 근로 소득:</span>
            <span>{Math.floor((Number(payrollModal.wage) || 0) * (Number(payrollModal.hours) || 0)).toLocaleString()}원</span>
          </div>

          {parseFloat(payrollModal.hours) >= 60 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
              <span>주휴수당 가산 (상용):</span>
              <span>+{Math.floor(((Number(payrollModal.hours) || 0) / 40.0) * 8.0 * (Number(payrollModal.wage) || 0)).toLocaleString()}원</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
            <span>원천세 징수 (3.3%):</span>
            <span>-{Math.floor((Number(payrollModal.cumulativeWage) || 0) * 0.033).toLocaleString()}원</span>
          </div>

          <hr style={{ border: 'none', borderTop: '1.5px dashed rgba(255,255,255,0.15)', margin: '10px 0' }} />

          {/* 최종 실 수령 누적액 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold' }}>
            <span style={{ color: 'var(--accent-orange)' }}>실수령 누적금액:</span>
            <span style={{ color: 'var(--accent-orange)' }}>
              {Math.floor((Number(payrollModal.cumulativeWage) || 0) * 0.967).toLocaleString()}원
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>이미 지불된 금액:</span>
            <span style={{ color: '#10b981' }}>{Math.floor(Number(payrollModal.paidWage) || 0).toLocaleString()}원</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '700' }}>
            <span style={{ color: 'var(--text-muted)' }}>당월 미지급 잔액:</span>
            <span style={{ color: 'var(--accent-orange)' }}>{Math.floor(Number(payrollModal.unpaidWage) || 0).toLocaleString()}원</span>
          </div>
        </div>

        {/* 닫기 버튼 */}
        <div style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
              color: '#fff', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            닫 기
          </button>
          {userRole === 'owner' && parseInt(payrollModal.unpaidWage) > 0 && (
            <button
              onClick={() => onPaySalary(payrollModal.id, payrollModal.name)}
              disabled={isProcessing}
              className="confirm-btn success-green"
              style={{ flex: 1.2, padding: '12px', borderRadius: '10px', fontWeight: 'bold' }}
            >
              💸 급여 지금 처리
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
