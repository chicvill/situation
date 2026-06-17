import React from 'react';
import type { PayrollInfo, ScheduleEntry } from './types';

interface PayrollModalProps {
  payrollModal: PayrollInfo;
  isProcessing: boolean;
  userRole: string;
  onClose: () => void;
  onPaySalary: (staffId: string, name: string) => void;
}

/** 주간 소정근로시간 계산 (분 → 시간) */
const calcWeeklyHours = (schedule?: ScheduleEntry[]): number => {
  if (!schedule || schedule.length === 0) return 0;
  return schedule.reduce((sum, s) => {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return sum + Math.max(0, mins / 60);
  }, 0);
};

/**
 * 주휴수당 (주당) 계산
 * 공식: 주간 소정근로시간 / 40 × 8 × 시급  (주 15시간 이상 조건)
 */
const calcWeeklyHolidayPay = (weeklyHours: number, hourlyWage: number): number => {
  if (weeklyHours < 15) return 0;
  return Math.floor((weeklyHours / 40) * 8 * hourlyWage);
};

/** 근무 주수 추산 (누적시간 / 주간소정시간) */
const estimateWeeks = (totalHours: number, weeklyHours: number): number => {
  if (weeklyHours <= 0) return 0;
  return Math.max(1, Math.round(totalHours / weeklyHours));
};

const Row: React.FC<{ label: string; value: string; color?: string; small?: boolean }> = ({
  label, value, color, small,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    fontSize: small ? '0.78rem' : '0.85rem' }}>
    <span style={{ color: '#9ca3af' }}>{label}</span>
    <strong style={{ color: color || '#e5e7eb' }}>{value}</strong>
  </div>
);

const Divider: React.FC<{ dashed?: boolean }> = ({ dashed }) => (
  <hr style={{ border: 'none',
    borderTop: `1px ${dashed ? 'dashed' : 'solid'} rgba(255,255,255,0.08)`,
    margin: '8px 0' }} />
);

export const PayrollModal: React.FC<PayrollModalProps> = ({
  payrollModal, isProcessing, userRole, onClose, onPaySalary,
}) => {
  const hourlyWage   = Math.floor(Number(payrollModal.wage) || 0);
  const grossWage    = Math.floor(Number(payrollModal.cumulativeWage) || 0);
  const paidWage     = Math.floor(Number(payrollModal.paidWage) || 0);
  const unpaidWage   = Math.floor(Number(payrollModal.unpaidWage) || 0);
  const totalHours   = parseFloat(payrollModal.hours) || 0;

  const isAlba = !payrollModal.employmentType || payrollModal.employmentType === '알바';
  const weeklyHours    = calcWeeklyHours(payrollModal.schedule);
  const weeklyHolPay   = calcWeeklyHolidayPay(weeklyHours, hourlyWage);
  const estimatedWeeks = estimateWeeks(totalHours, weeklyHours);
  const totalHolPay    = weeklyHolPay * estimatedWeeks;

  // ── 공제 계산 ──────────────────────────────────────────
  type TaxLine = { label: string; rate: string; amount: number };
  let taxLines: TaxLine[];
  let totalDeduction: number;

  if (isAlba) {
    const tax = Math.floor(grossWage * 0.033);
    taxLines = [{ label: '원천세 (소득세 3% + 지방세 0.3%)', rate: '3.3%', amount: tax }];
    totalDeduction = tax;
  } else {
    // 정규직 / 계약직 — 4대보험 (근로자 부담분)
    const pension    = Math.floor(grossWage * 0.045);
    const health     = Math.floor(grossWage * 0.03545);
    const longCare   = Math.floor(grossWage * 0.00435);
    const employment = Math.floor(grossWage * 0.009);
    taxLines = [
      { label: '국민연금', rate: '4.5%',  amount: pension },
      { label: '건강보험', rate: '3.545%', amount: health },
      { label: '장기요양보험', rate: '0.435%', amount: longCare },
      { label: '고용보험', rate: '0.9%',  amount: employment },
    ];
    totalDeduction = pension + health + longCare + employment;
  }

  const netWage = grossWage - totalDeduction;

  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const text = `🧾 급여명세서 (PAYROLL STATEMENT)
----------------------------------------
• 대상자: ${payrollModal.name} (${payrollModal.role} · ${isAlba ? '단기 알바' : payrollModal.employmentType || '직원'})
• 시급: ${hourlyWage.toLocaleString()}원
• 누적 근무시간: ${payrollModal.hours}시간
${weeklyHours > 0 ? `• 주간 소정근로: ${weeklyHours.toFixed(1)}시간/주\n` : ''}----------------------------------------
• 기본급 (시스템 누적): ${grossWage.toLocaleString()}원
${weeklyHolPay > 0 ? `• 주휴수당 (별도 추산): ${totalHolPay.toLocaleString()}원 (주 ${weeklyHours.toFixed(1)}h 기준, 시스템 기본급 미포함)\n` : ''}• 공제 내역 (${isAlba ? '알바 원천세' : '4대보험 근로자 부담'}):
${taxLines.map(t => `  - ${t.label} (${t.rate}): -${t.amount.toLocaleString()}원`).join('\n')}
• 공제 합계: -${totalDeduction.toLocaleString()}원
----------------------------------------
• 실수령 누적금액: ${netWage.toLocaleString()}원
• 이미 지급된 금액: ${paidWage.toLocaleString()}원
• 미지급 잔액: ${unpaidWage.toLocaleString()}원
----------------------------------------
※ 급여의 지급은 점주만의 권한입니다.`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Copy failed:', err);
      alert('복사에 실패했습니다.');
    });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, backdropFilter: 'blur(6px)',
      padding: '16px', boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto',
        padding: '28px', borderRadius: '24px',
        background: '#111827', border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
        color: '#e5e7eb', fontFamily: 'monospace',
        boxSizing: 'border-box',
      }}>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', borderBottom: '1.5px dashed rgba(255,255,255,0.12)',
          paddingBottom: '18px', marginBottom: '18px', position: 'relative' }}>
          
          <button 
            onClick={handleCopy}
            title="클립보드 복사"
            style={{
              position: 'absolute', right: '0px', top: '0px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', cursor: 'pointer', padding: '6px 10px',
              fontSize: '0.8rem', color: copied ? '#10b981' : '#e5e7eb',
              display: 'flex', alignItems: 'center', gap: '4px',
              transition: 'all 0.2s', fontWeight: 700
            }}
            onMouseOver={(e) => {
              if (!copied) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = 'var(--accent-orange)';
              }
            }}
            onMouseOut={(e) => {
              if (!copied) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = '#e5e7eb';
              }
            }}
          >
            {copied ? '✅ 복사 완료' : '📋 텍스트 복사'}
          </button>

          <span style={{ fontSize: '1.8rem' }}>🧾</span>
          <h4 style={{ margin: '8px 0 2px', fontSize: '1.1rem', fontWeight: 800,
            letterSpacing: '1.5px', color: '#f3f4f6' }}>PAYROLL STATEMENT</h4>
          <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
            {payrollModal.name} ({payrollModal.role}) · {isAlba ? '단기 알바' : payrollModal.employmentType}
          </span>
        </div>

        {/* ① 근무 현황 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '14px' }}>
          <Row label="계약 시급" value={`${hourlyWage.toLocaleString()}원`} />
          <Row label="누적 근무시간" value={`${payrollModal.hours}시간`} />
          {weeklyHours > 0 && (
            <Row label="주간 소정근로 (계약)" value={`${weeklyHours.toFixed(1)}시간/주`} small />
          )}
        </div>
        <Divider />

        {/* ② 기본급 & 주휴수당 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px',
          marginTop: '12px', marginBottom: '14px' }}>
          <Row label="기본급 (시스템 누적)" value={`${grossWage.toLocaleString()}원`} />

          {weeklyHolPay > 0 ? (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                  ⚠️ 주휴수당 추산 (별도 지급 필요)
                </span>
                <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                  {totalHolPay.toLocaleString()}원
                </span>
              </div>
              <span style={{ fontSize: '0.68rem', color: '#9ca3af', lineHeight: '1.4' }}>
                주 {weeklyHours.toFixed(1)}h ÷ 40 × 8 × 시급 = {weeklyHolPay.toLocaleString()}원/주 × 약 {estimatedWeeks}주
                <br />※ 현재 시스템 기본급에 미포함 · 별도 지급 권장
              </span>
            </div>
          ) : weeklyHours > 0 && weeklyHours < 15 ? (
            <div style={{ fontSize: '0.72rem', color: '#6b7280', paddingLeft: '4px' }}>
              주 {weeklyHours.toFixed(1)}시간 근무 → 주휴수당 미해당 (15시간 미만)
            </div>
          ) : null}
        </div>
        <Divider />

        {/* ③ 공제 내역 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px',
          marginTop: '12px', marginBottom: '14px' }}>
          <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700,
            letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            공제 내역 ({isAlba ? '알바 원천세' : '4대보험 근로자 부담'})
          </span>
          {taxLines.map(t => (
            <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between',
              fontSize: '0.82rem' }}>
              <span style={{ color: '#9ca3af' }}>{t.label} ({t.rate})</span>
              <span style={{ color: '#f87171' }}>−{t.amount.toLocaleString()}원</span>
            </div>
          ))}
          {!isAlba && (
            <div style={{ fontSize: '0.7rem', color: '#6b7280', paddingLeft: '4px' }}>
              ※ 근로소득세 별도 (연간 소득 기준 연말정산)
            </div>
          )}
        </div>
        <Divider dashed />

        {/* ④ 실수령 및 정산 현황 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px',
          marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            fontSize: '1rem', fontWeight: 'bold' }}>
            <span style={{ color: '#f97316' }}>실수령 누적금액</span>
            <span style={{ color: '#f97316' }}>{netWage.toLocaleString()}원</span>
          </div>
          <Row label="이미 지급된 금액" value={`${paidWage.toLocaleString()}원`} color="#10b981" small />
          <div style={{ display: 'flex', justifyContent: 'space-between',
            fontSize: '0.88rem', fontWeight: 800,
            padding: '10px 12px',
            background: unpaidWage > 0 ? 'rgba(249,115,22,0.08)' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${unpaidWage > 0 ? 'rgba(249,115,22,0.2)' : 'rgba(16,185,129,0.2)'}`,
            borderRadius: '8px' }}>
            <span style={{ color: unpaidWage > 0 ? '#f97316' : '#10b981' }}>미지급 잔액</span>
            <span style={{ color: unpaidWage > 0 ? '#f97316' : '#10b981' }}>
              {unpaidWage.toLocaleString()}원
            </span>
          </div>
          {weeklyHolPay > 0 && unpaidWage > 0 && (
            <div style={{ fontSize: '0.68rem', color: '#6b7280', textAlign: 'right', lineHeight: '1.5' }}>
              ※ 주휴수당({totalHolPay.toLocaleString()}원)은 미포함 — 지급 시 합산 권장
            </div>
          )}
          <div style={{ fontSize: '0.68rem', color: '#9ca3af', textAlign: 'right', marginTop: '4px', lineHeight: '1.5' }}>
            ※ 급여의 지급은 점주만의 권한입니다.
          </div>
          <div style={{ fontSize: '0.68rem', color: '#60a5fa', textAlign: 'right', marginTop: '4px', lineHeight: '1.5', fontWeight: 600 }}>
            ※ 급여 이체 후 급여 명세서를 복사하여 본인에게 메시지 등으로 꼭 알려주세요.
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ marginTop: '22px', display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#e5e7eb', fontWeight: 700, cursor: 'pointer' }}>
            닫 기
          </button>
          {userRole === 'owner' && unpaidWage > 0 && (
            <button onClick={() => onPaySalary(payrollModal.id, payrollModal.name)}
              disabled={isProcessing}
              className="confirm-btn success-green"
              style={{ flex: 1.2, padding: '12px', borderRadius: '10px', fontWeight: 800 }}>
              💸 급여 지급 처리
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
