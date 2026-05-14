import React from 'react';

interface KioskPanelProps {
  kioskPhone: string;
  isScanningQr: boolean;
  onPhoneChange: (value: string) => void;
  onSubmit: (actionType: 'check-in' | 'check-out') => void;
}

export const KioskPanel: React.FC<KioskPanelProps> = ({
  kioskPhone,
  isScanningQr,
  onPhoneChange,
  onSubmit,
}) => {
  return (
    <div className="admin-page animate-fade-in" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '40px 30px', borderRadius: '24px', border: '1.5px solid rgba(249, 115, 22, 0.3)', textAlign: 'center' }}>
        <div style={{ marginBottom: '30px' }}>
          <span style={{ fontSize: '3.5rem' }}>⏰</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '15px', color: 'var(--text-main)' }}>출퇴근 기록 단말기</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            본인의 전화번호(ID)를 입력하고<br/>원하는 버튼을 눌러주세요.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <input
            type="tel"
            placeholder="전화번호 (예: 01012345678)"
            value={kioskPhone}
            onChange={(e) => onPhoneChange(e.target.value)}
            style={{
              width: '100%', padding: '16px', borderRadius: '12px',
              background: 'var(--background)', border: '1.5px solid var(--border)',
              color: 'var(--text-main)', fontSize: '1.1rem', textAlign: 'center', letterSpacing: '2px', outline: 'none'
            }}
            autoFocus
          />

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => onSubmit('check-in')}
              disabled={isScanningQr}
              style={{
                flex: 1, padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem',
                background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1.5px solid #10b981',
                cursor: isScanningQr ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
              }}
            >
              🏃 출 근
            </button>
            <button
              onClick={() => onSubmit('check-out')}
              disabled={isScanningQr}
              style={{
                flex: 1, padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem',
                background: 'rgba(249, 115, 22, 0.15)', color: 'var(--accent-orange)', border: '1.5px solid var(--accent-orange)',
                cursor: isScanningQr ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
              }}
            >
              🏠 퇴 근
            </button>
          </div>
        </div>
        {isScanningQr && <p style={{ marginTop: '20px', fontSize: '0.85rem', color: 'var(--accent-orange)' }}>인증 처리 중입니다...</p>}
      </div>
    </div>
  );
};
