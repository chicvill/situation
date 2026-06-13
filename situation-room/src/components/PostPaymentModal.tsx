import React, { useState } from 'react';
import { API_BASE } from '../config';

interface PostPaymentModalProps {
  sessionId: string;
  storeId: string;
  onClose: () => void;
}

export const PostPaymentModal: React.FC<PostPaymentModalProps> = ({ sessionId, storeId, onClose }) => {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!vehicleNumber.trim()) {
      alert('차량 번호를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/parking/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          vehicle_number: vehicleNumber,
          store_id: storeId,
          discount_minutes: 120 // 기본 2시간 주차
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || '주차 등록 실패');
      }

      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      alert(err.message || '주차 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:5000,
      background:'rgba(0,0,0,0.85)', backdropFilter:'blur(10px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding: '20px'
    }}>
      <div className="animate-pop-in" style={{
        width: '100%', maxWidth: '380px', borderRadius: '24px',
        background: 'var(--surface)', padding: '32px 24px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.2)', textAlign: 'center'
      }}>
        {isSuccess ? (
          <div className="animate-fade-in">
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🚗</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px', margin: 0 }}>
              주차 등록 완료!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px' }}>
              2시간 무료 주차가 정상적으로 적용되었습니다.
            </p>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚗</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '12px', margin: 0 }}>
              주차 할인 등록
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.5 }}>
              차량번호를 입력하시면<br />기본 2시간 무료 주차가 자동 적용됩니다.
            </p>
            
            <input
              type="text"
              placeholder="차량번호 뒷자리 (예: 1234)"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              style={{
                width: '100%', padding: '16px', borderRadius: '12px',
                border: '1px solid var(--border)', background: 'var(--bg-main)',
                color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 700,
                textAlign: 'center', marginBottom: '20px', boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  padding: '16px', borderRadius: '14px', background: 'transparent',
                  border: '1px solid var(--border)', color: 'var(--text-main)',
                  fontWeight: 700, fontSize: '1rem', cursor: 'pointer'
                }}
              >
                건너뛰기
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  padding: '16px', borderRadius: '14px', background: 'var(--accent-orange)',
                  border: 'none', color: 'white', fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(249,115,22,0.3)'
                }}
              >
                {isSubmitting ? '등록 중...' : '주차 혜택 적용'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
