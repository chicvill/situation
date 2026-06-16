import React from 'react';

interface PendingBundle {
  id: string;
  items: { name: string; value: string }[];
}

interface PendingApprovalsProps {
  userRole: string;
  pendingStaffList: PendingBundle[];
  pendingOwnerList: PendingBundle[];
  isProcessing: boolean;
  onApproveStaff: (bundle: PendingBundle) => void;
  onApproveOwner: (bundle: PendingBundle) => void;
}

export const PendingApprovals: React.FC<PendingApprovalsProps> = ({
  userRole,
  pendingStaffList,
  pendingOwnerList,
  isProcessing,
  onApproveStaff,
  onApproveOwner,
}) => {
  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(249, 115, 22, 0.04))',
        border: '1.5px solid var(--accent-orange)',
        borderRadius: '16px',
        padding: '14px 16px',
        marginBottom: '14px',
        boxShadow: '0 6px 20px rgba(249, 115, 22, 0.06)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Subtle glow element */}
      <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.15)', filter: 'blur(30px)', pointerEvents: 'none' }}></div>

      <h4 style={{ fontSize: '1.15rem', fontWeight: '900', margin: '0 0 10px 0', color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>⚠️</span> 가입 승인 대기
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {userRole === 'owner' && pendingStaffList.map(b => {
          const staffName = b.items?.find((i) => i.name === '이름')?.value || '-';
          const requestedRole = b.items?.find((i) => i.name === '권한')?.value === 'manager' ? '점장' : '점원';
          const signupId = b.items?.find((i) => i.name === '아이디')?.value || '-';

          return (
            <div
              key={b.id}
              style={{
                background: 'var(--surface)',
                padding: '10px 14px',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid rgba(249, 115, 22, 0.2)',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>{staffName}님 가입 신청</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '10px' }}>
                  <span>희망직책: <strong style={{ color: 'var(--accent-orange)' }}>{requestedRole}</strong></span>
                  <span>•</span>
                  <span>아이디: <strong style={{ color: 'var(--text-main)' }}>{signupId}</strong></span>
                </div>
              </div>

              <button
                onClick={() => onApproveStaff(b)}
                disabled={isProcessing}
                style={{
                  background: 'var(--success)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                ✨ 승인
              </button>
            </div>
          );
        })}

        {userRole === 'admin' && pendingOwnerList.map(b => {
          const ownerNameVal = b.items?.find((i) => i.name === '이름')?.value || '-';
          const signupId = b.items?.find((i) => i.name === '아이디')?.value || '-';
          const businessNo = b.items?.find((i) => i.name === '사업자번호')?.value || '-';
          const storeNameVal = (b as any).store || '-';
          
          const agreeProxy = b.items?.find((i) => i.name === '약관동의_대행')?.value === 'Y';
          const agreeFee = b.items?.find((i) => i.name === '약관동의_수수료')?.value === 'Y';
          const agreeHold = b.items?.find((i) => i.name === '약관동의_정산보류')?.value === 'Y';
          const agreeOverdue = b.items?.find((i) => i.name === '약관동의_가맹비연체')?.value === 'Y';
          const allAgreed = agreeProxy && agreeFee && agreeHold && agreeOverdue;

          return (
            <div
              key={b.id}
              style={{
                background: 'var(--surface)',
                padding: '14px 18px',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                border: '1.5px solid rgba(249, 115, 22, 0.25)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {ownerNameVal} 사장님 가입 신청 ({storeNameVal})
                  </strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span>아이디: <strong style={{ color: 'var(--text-main)' }}>{signupId}</strong></span>
                    <span>•</span>
                    <span>사업자번호: <strong style={{ color: 'var(--text-main)' }}>{businessNo}</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => onApproveOwner(b)}
                  disabled={isProcessing}
                  style={{
                    background: 'var(--success)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  ✨ 대행 승인 및 활성화
                </button>
              </div>

              {/* 📑 약관 및 서약 상태 */}
              <div style={{
                background: 'rgba(249, 115, 22, 0.04)',
                border: '1px solid rgba(249, 115, 22, 0.15)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.78rem',
                color: 'var(--text-muted)'
              }}>
                <div style={{ fontWeight: 800, color: 'var(--accent-orange)', marginBottom: '6px' }}>
                  📄 전자 이용계약 및 PayApp 대행 서약 현황
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontWeight: 600 }}>
                  <span style={{ color: agreeProxy ? '#10b981' : '#ef4444' }}>{agreeProxy ? '✓' : '✗'} PayApp 대행 동의</span>
                  <span style={{ color: agreeFee ? '#10b981' : '#ef4444' }}>{agreeFee ? '✓' : '✗'} 결제수수료 확인</span>
                  <span style={{ color: agreeHold ? '#10b981' : '#ef4444' }}>{agreeHold ? '✓' : '✗'} 정산보류 동의</span>
                  <span style={{ color: agreeOverdue ? '#10b981' : '#ef4444' }}>{agreeOverdue ? '✓' : '✗'} 연체정지 동의</span>
                </div>
                {allAgreed && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900 }}>서명완료</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>본인인증 및 전자 서명 날인 제출됨</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
