import React from 'react';
import type { Bundle } from './types';

interface QrScannerModalProps {
  employees: Bundle[];
  currentTime: Date;
  isScanningQr: boolean;
  selectedStaffForQr: string;
  selectedActionForQr: 'check-in' | 'check-out';
  onClose: () => void;
  onStaffSelect: (staffId: string) => void;
  onActionSelect: (action: 'check-in' | 'check-out') => void;
  onSubmit: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  employees,
  currentTime,
  isScanningQr,
  selectedStaffForQr,
  selectedActionForQr,
  onClose,
  onStaffSelect,
  onActionSelect,
  onSubmit,
}) => {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(8px)'
    }}>
      <div className="glass-panel" style={{
        width: '450px', padding: '30px', borderRadius: '24px',
        border: '2px solid rgba(249, 115, 22, 0.3)', position: 'relative',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '2.5rem' }}>📷</span>
          <h4 style={{ margin: '10px 0 4px 0', fontSize: '1.2rem', fontWeight: 800 }}>출퇴근 QR코드 단말기</h4>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>스케줄 시각 전후 5분 내 인증 필수</p>
        </div>

        {/* 디지털 시계 피드 */}
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)', padding: '15px', borderRadius: '14px', textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>현재 매장 서버 시각</span>
          <span style={{ color: 'var(--accent-orange)', fontSize: '1.6rem', fontWeight: '900', fontFamily: 'monospace', marginTop: '4px', display: 'block' }}>
            {currentTime.toLocaleTimeString()}
          </span>
        </div>

        {/* 모의 카메라 스캔 영역 */}
        <div style={{
          width: '100%', height: '180px', background: '#000', borderRadius: '16px',
          marginBottom: '20px', position: 'relative', overflow: 'hidden',
          border: isScanningQr ? '2px solid var(--accent-orange)' : '1px solid rgba(255,255,255,0.1)'
        }}>
          {isScanningQr ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: '60px', height: '60px', border: '4px solid rgba(249, 115, 22, 0.2)',
                borderTopColor: 'var(--accent-orange)', borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--accent-orange)', fontWeight: 'bold' }}>
                [QR 코드 정밀 해독 중...]
              </span>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {/* QR 과녁 라인 과 광원 연출 */}
              <div style={{
                width: '120px', height: '120px', border: '2px dashed rgba(255,255,255,0.3)',
                borderRadius: '8px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{
                  position: 'absolute', width: '100%', height: '2px',
                  background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
                  top: '50%', transform: 'translateY(-50%)',
                  animation: 'pulse 1.5s infinite'
                }} />
                📱 QR CODE
              </div>
              <span style={{ marginTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>매장 모바일 QR코드를 과녁에 비춰주세요</span>
            </div>
          )}
        </div>

        {/* 입력 설정 폼 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>근무 사원 선택</label>
            <select
              value={selectedStaffForQr}
              onChange={(e) => onStaffSelect(e.target.value)}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                background: '#111', border: '1.5px solid var(--border)',
                color: '#fff', outline: 'none'
              }}
            >
              <option value="">사원을 선택해 주세요</option>
              {employees.map(emp => {
                const name = emp.items?.find((i) => i.name === '이름')?.value || '-';
                const id = emp.items?.find((i) => i.name === '아이디')?.value || emp.id;
                const role = emp.items?.find((i) => i.name === '직책')?.value || '점원';
                return (
                  <option key={id} value={id}>{name} ({role})</option>
                );
              })}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>인증 구분</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => onActionSelect('check-in')}
                style={{
                  padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer',
                  border: '1.5px solid ' + (selectedActionForQr === 'check-in' ? 'var(--accent-orange)' : 'var(--border)'),
                  background: selectedActionForQr === 'check-in' ? 'rgba(249,115,22,0.1)' : 'transparent',
                  color: selectedActionForQr === 'check-in' ? 'var(--accent-orange)' : 'var(--text-muted)'
                }}
              >
                🏃 출근 등록
              </button>
              <button
                type="button"
                onClick={() => onActionSelect('check-out')}
                style={{
                  padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer',
                  border: '1.5px solid ' + (selectedActionForQr === 'check-out' ? 'var(--accent-orange)' : 'var(--border)'),
                  background: selectedActionForQr === 'check-out' ? 'rgba(249,115,22,0.1)' : 'transparent',
                  color: selectedActionForQr === 'check-out' ? 'var(--accent-orange)' : 'var(--text-muted)'
                }}
              >
                🏠 퇴근 등록
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onSubmit}
          className="confirm-btn premium-orange"
          style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold' }}
          disabled={isScanningQr}
        >
          {isScanningQr ? '출퇴근 매칭 분석 중...' : 'QR코드 인증 및 타임카드 서명'}
        </button>
      </div>
    </div>
  );
};
