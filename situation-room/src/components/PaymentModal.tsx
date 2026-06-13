import React from 'react';
import type { BundleData } from '../types';
import { API_BASE } from '../config';
import { formatPhone } from '../utils/formatters';

interface PaymentModalProps {
  totalPrice: number;
  onClose: () => void;
  onSubmit: (method: string, extraData?: any) => void | Promise<void>;
  isCounter?: boolean;
  prepaidMethod?: string | null;
  bundles?: BundleData[];
  initialPhone?: string;
  onPhoneChange?: (val: string) => void;
  onPayerInfo?: (phone: string, topPercentAccumulated: number) => void;
  cart?: any[];
  sessionId?: string;
  storeId?: string;
  tableId?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  totalPrice, onClose, onSubmit,
  initialPhone = '', onPhoneChange, onPayerInfo,
  cart,
}) => {
  const [phoneForPoints, setPhoneForPoints] = React.useState(initialPhone);
  const [existingPoints, setExistingPoints] = React.useState(0);
  const [usePoints, setUsePoints] = React.useState(0);
  const [accumulatePoints, setAccumulatePoints] = React.useState(!!initialPhone);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isTakeout, setIsTakeout] = React.useState(false);

  const finalTotal = Math.max(0, totalPrice - usePoints);

  React.useEffect(() => {
    if (onPhoneChange) onPhoneChange(phoneForPoints);
  }, [phoneForPoints, onPhoneChange]);

  const lookupPoints = async (phone: string) => {
    if (phone.length < 10) return;
    try {
      const res = await fetch(`${API_BASE}/api/points/${phone}`);
      const data = await res.json();
      const usable = data.usable_points ?? data.points ?? 0;
      const topPct = data.top_percent_accumulated ?? 100;
      setExistingPoints(usable);
      if (onPayerInfo) onPayerInfo(phone, topPct);
    } catch {
      setExistingPoints(0);
    }
  };

  const handlePay = async (method: string) => {
    setIsSubmitting(true);
    try {
      await onSubmit(method, { phone: phoneForPoints, usePoints, isTakeout });
    } catch (err) {
      console.error(err);
      alert('결제 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:4000,
      background:'rgba(0,0,0,0.85)', backdropFilter:'blur(10px)',
      padding: '40px 20px', display:'flex', flexDirection: 'column', alignItems:'center',
      overflowY: 'auto'
    }}>
      <div className="animate-pop-in" style={{ 
        width: '100%', maxWidth: '420px', borderRadius: 'var(--radius-lg)',
        flexShrink: 0, margin: 'auto 0', background: 'var(--surface)', padding: '28px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.1)'
      }}>
        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <h2 style={{ color:'var(--text-main)', margin:0, fontSize:'1.2rem', fontWeight:700 }}>주문 확인 및 결제</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'1.5rem', cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {/* 매장에서/포장 선택 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ color:'var(--text-muted)', fontSize:'0.8rem', fontWeight:700, marginBottom:'10px' }}>식사 옵션</div>
          <div style={{ display:'flex', gap:'10px' }}>
            {[{ val: false, icon: '🍽️', label: '매장에서' }, { val: true, icon: '📦', label: '포장' }].map(opt => (
              <button
                key={String(opt.val)}
                onClick={() => setIsTakeout(opt.val)}
                style={{
                  flex: 1, padding: '14px 10px', borderRadius: '14px', cursor: 'pointer',
                  border: isTakeout === opt.val ? '2px solid var(--accent-orange)' : '1px solid var(--border)',
                  background: isTakeout === opt.val ? 'rgba(249,115,22,0.08)' : 'white',
                  fontWeight: 800, fontSize: '0.95rem',
                  color: isTakeout === opt.val ? 'var(--accent-orange)' : 'var(--text-main)',
                  transition: 'all 0.18s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
                }}
              >
                <span style={{ fontSize: '1.6rem' }}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 상단 주문 내역 확인 영역 */}
        {cart && cart.length > 0 && (
          <div style={{ 
            marginBottom: '20px', padding: '12px 16px', background: 'var(--bg-main)', 
            borderRadius: '12px', border: '1px solid var(--border)' 
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>📋 주문 내역 상세</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
              {cart.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  <span style={{ fontWeight: 600 }}>{item.name} <span style={{ color: 'var(--text-muted)' }}>×{item.qty || item.quantity || 1}</span></span>
                  <span style={{ fontWeight: 700 }}>{((item.price || 0) * (item.qty || item.quantity || 1)).toLocaleString()}원</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 포인트 적립/할인 영역 */}
        <div style={{ 
          marginBottom: '20px', padding: '20px', borderRadius: '20px', 
          background: 'var(--bg-main)', border: '1px solid var(--border)' 
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: accumulatePoints ? '20px' : '0' }}>
            <div style={{ 
              width: '24px', height: '24px', borderRadius: '6px', border: '2px solid var(--border)',
              background: accumulatePoints ? 'var(--accent-orange)' : 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}>
              {accumulatePoints && <span style={{ color: 'white', fontSize: '14px' }}>✓</span>}
            </div>
            <input 
              type="checkbox" 
              checked={accumulatePoints} 
              onChange={(e) => {
                setAccumulatePoints(e.target.checked);
                if (e.target.checked && initialPhone) {
                  setPhoneForPoints(initialPhone);
                  lookupPoints(initialPhone);
                }
              }} 
              style={{ display: 'none' }}
            />
            <span style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '1.05rem' }}>포인트 적립 및 사용</span>
          </label>

          {accumulatePoints && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  placeholder="휴대폰 번호 입력"
                  value={phoneForPoints}
                  onChange={(e) => {
                    const formatted = formatPhone(e.target.value);
                    setPhoneForPoints(formatted);
                    const clean = formatted.replace(/[^0-9]/g, '');
                    if (clean.length >= 10) lookupPoints(clean);
                  }}
                  style={{
                    width: '100%', padding: '16px', borderRadius: '12px',
                    border: '1px solid var(--border)', background: 'white',
                    color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 700, 
                    outline: 'none', textAlign: 'center', boxSizing: 'border-box'
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '6px' }}>
                  번호 입력 시 자동으로 포인트를 조회합니다.
                </div>
              </div>

              {existingPoints > 0 && (
                <div style={{
                  display:'flex', flexDirection: 'column', gap: '10px', padding: '15px',
                  background: 'white', borderRadius: '12px', border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>사용 가능 포인트</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>{existingPoints.toLocaleString()} P</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setUsePoints(usePoints === 0 ? Math.min(existingPoints, totalPrice) : 0)}
                    style={{ 
                      width:'100%', padding:'10px', borderRadius:'8px', fontWeight:800, cursor:'pointer',
                      background: usePoints > 0 ? 'var(--text-main)' : 'white', 
                      color: usePoints > 0 ? 'white' : 'var(--text-main)', 
                      border: usePoints > 0 ? 'none' : '1px solid var(--text-main)',
                      transition: 'all 0.2s', marginTop: '10px'
                    }}
                  >
                    {usePoints > 0 ? `사용 취소 (-${usePoints.toLocaleString()}원)` : `포인트 전액 할인 적용`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 최종 결제액 안내 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: '20px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ color:'var(--text-muted)', fontWeight:700, fontSize: '1rem' }}>최종 결제 금액</span>
          <span style={{ color:'var(--accent-orange)', fontSize:'1.8rem', fontWeight:900 }}>{finalTotal.toLocaleString()}원</span>
        </div>

        {/* 간소화된 결제 버튼 영역 */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <button
            onClick={() => handlePay('self_pay')}
            disabled={isSubmitting}
            style={{ 
              display:'flex', alignItems:'center', gap:'16px', padding:'18px 20px',
              borderRadius:'16px', border:'none', background: 'var(--primary)',
              color: 'white', textAlign:'left', cursor: isSubmitting ? 'not-allowed' : 'pointer', 
              boxShadow:'0 10px 25px rgba(30, 41, 59, 0.15)', transition:'all 0.15s',
            }}
          >
            <span style={{ fontSize:'2rem' }}>📱</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:'1.1rem' }}>셀프 결제하기</div>
              <div style={{ color:'rgba(255,255,255,0.8)', fontSize:'0.75rem', marginTop:'4px' }}>
                삼성페이, 카카오페이, 네이버페이, 앱카드 등<br/>내 폰에서 바로 결제 (현금영수증 포함)
              </div>
            </div>
          </button>

          <button
            onClick={() => handlePay('call_staff')}
            disabled={isSubmitting}
            style={{ 
              display:'flex', alignItems:'center', gap:'16px', padding:'18px 20px',
              borderRadius:'16px', border:'1px solid var(--border)', background: 'transparent',
              color: 'var(--text-main)', textAlign:'left', cursor: isSubmitting ? 'not-allowed' : 'pointer', 
              transition:'all 0.15s',
            }}
          >
            <span style={{ fontSize:'2rem' }}>🙋</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:'1.1rem' }}>직원 호출하기</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.75rem', marginTop:'4px' }}>
                실물 카드 결제, 더치페이 분할 결제, 현금 결제 등<br/>직원이 단말기를 가지고 테이블로 방문합니다
              </div>
            </div>
          </button>
        </div>
        
        {/* 선결제 취소 불가 경고 */}
        <div style={{
          marginTop: '20px', padding: '12px 16px', borderRadius: '12px',
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', alignItems: 'flex-start', gap: '8px'
        }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
          <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, lineHeight: 1.5 }}>
            셀프 결제 완료 및 직원 호출 시 주문이 바로 주방으로 전달되며, 주문 취소가 불가능하오니 신중하게 선택해 주세요.
          </span>
        </div>
      </div>
    </div>
  );
};
