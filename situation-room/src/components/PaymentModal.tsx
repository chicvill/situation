import React from 'react';
import type { BundleData } from '../types';

interface PaymentModalProps {
  totalPrice: number;
  onClose: () => void;
  onSubmit: (method: string, extraData?: any) => void | Promise<void>;
  isCounter?: boolean;
  prepaidMethod?: string | null;
  bundles?: BundleData[];
  initialPhone?: string;
  onPhoneChange?: (val: string) => void;
}

type Step = 'select' | 'points';
type Method = { id: string; icon: string; name: string; desc: string; color: string; };

const METHODS: Method[] = [
  { id: 'card',     icon: '💳', name: '카드 / 간편결제', desc: '신용카드, 토스페이, 삼성페이 등',   color: '#3b82f6' },
  { id: 'transfer', icon: '🏦', name: '계좌이체',         desc: '실시간 은행 이체',                  color: '#8b5cf6' },
  { id: 'cash',     icon: '💵', name: '카운터에서 결제',   desc: '매장 현장 결제',                    color: '#10b981' },
];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  totalPrice, onClose, onSubmit,
  bundles,
  initialPhone = '', onPhoneChange,
}) => {
  const [step, setStep] = React.useState<Step>('select');
  const [selectedMethod, setSelectedMethod] = React.useState<Method | null>(null);
  const [phoneForPoints, setPhoneForPoints] = React.useState(initialPhone);
  const [existingPoints, setExistingPoints] = React.useState(0);
  const [usePoints, setUsePoints] = React.useState(0);
  const [requestCashReceipt, setRequestCashReceipt] = React.useState(false);
  const [accumulatePoints, setAccumulatePoints] = React.useState(!!initialPhone);


  const finalTotal = totalPrice - usePoints;
  const potentialPoints = Math.floor(totalPrice * 0.001);

  // 매장 계좌 정보
  const storeBundle = bundles?.find(b => b.type === 'StoreConfig');
  const bankInfo = {
    name:    storeBundle?.items.find(i => i.name === '은행명')?.value    || '국민은행',
    account: storeBundle?.items.find(i => i.name === '계좌번호')?.value  || '123-456789-01-012',
    holder:  storeBundle?.items.find(i => i.name === '예금주')?.value    || '매장',
  };

  // 부모 동기화
  React.useEffect(() => {
    if (onPhoneChange) onPhoneChange(phoneForPoints);
  }, [phoneForPoints, onPhoneChange]);

  const lookupPoints = async (phone: string) => {
    if (phone.length < 10) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      const res = await fetch(`${apiUrl}/api/points/${phone}`);
      const data = await res.json();
      setExistingPoints(data.points || 0);
    } catch {
      setExistingPoints(0);
    }
  };


  // ════════════════════════════════════════
  //  STEP 1 : 결제 수단 선택
  // ════════════════════════════════════════
  const renderSelect = () => (
    <div style={{
      width: '90vw', maxWidth: '420px', background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)', padding: '28px', boxShadow: '0 25px 60px rgba(0,0,0,0.1)',
    }}>
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px' }}>
        <h2 style={{ color:'var(--text-main)', margin:0, fontSize:'1.2rem', fontWeight:700 }}>결제 방법 선택</h2>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'1.5rem', cursor:'pointer', lineHeight:1 }}>×</button>
      </div>

      <div style={{ color:'var(--text-muted)', fontSize:'0.85rem', fontWeight:500, marginBottom:'15px', display:'flex', alignItems:'center', gap:'8px' }}>
        결제 수단을 선택해 주세요.
      </div>

      {/* 결제 수단 버튼 */}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'30px' }}>
        {METHODS.map(m => (
          <button
            key={m.id}
            onClick={() => {
              setSelectedMethod(m);
              setStep('points');
            }}
            style={{
              display:'flex', alignItems:'center', gap:'16px', padding:'16px 20px',
              borderRadius:'var(--radius-md)', border:'1px solid var(--border)',
              background: 'transparent',
              textAlign:'left', cursor:'pointer', transition:'all 0.15s',
            }}
          >
            <span style={{ fontSize:'1.5rem' }}>{m.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ color:'var(--text-main)', fontWeight:600, fontSize:'0.95rem' }}>{m.name}</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.75rem', marginTop:'2px' }}>{m.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* 최종 합계 안내 */}
      <div style={{ borderTop:'1px solid var(--border)', paddingTop:'20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ color:'var(--text-muted)', fontWeight:500 }}>총 결제 금액</span>
          <span style={{ color:'var(--accent-orange)', fontSize:'1.4rem', fontWeight:700 }}>{totalPrice.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════
  //  STEP 2 : 포인트 확인 & 최종 결제
  // ════════════════════════════════════════
  const renderPoints = () => (
    <div style={{
      width:'90vw', maxWidth:'420px', background:'var(--surface)',
      borderRadius:'var(--radius-lg)', padding:'28px', border:'1px solid var(--border)',
      boxShadow:'0 25px 60px rgba(0,0,0,0.1)',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent: 'space-between', marginBottom:'30px' }}>
        <button onClick={() => setStep('select')} style={{ background:'rgba(0,0,0,0.05)', border:'none', color:'var(--text-main)', width: '40px', height: '40px', borderRadius: '50%', cursor:'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>❮</button>
        <h2 style={{ color:'var(--text-main)', margin:0, fontSize:'1.2rem', fontWeight:800 }}>결제 및 적립</h2>
        <div style={{ width: '40px' }}></div>
      </div>

      {/* 선택된 결제수단 배지 */}
      <div style={{ 
        marginBottom:'20px', padding:'16px 20px', borderRadius:'16px', 
        background:`${selectedMethod?.color}08`, border:`1px solid ${selectedMethod?.color}22`, 
        display:'flex', alignItems:'center', gap:'12px' 
      }}>
        <span style={{ fontSize:'1.8rem' }}>{selectedMethod?.icon}</span>
        <div>
          <div style={{ color:'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>선택된 결제수단</div>
          <div style={{ color: selectedMethod?.color, fontWeight:800, fontSize: '1rem' }}>{selectedMethod?.name}</div>
        </div>
      </div>

      {/* 계좌이체 매장 계좌 안내 */}
      {selectedMethod?.id === 'transfer' && (
        <div style={{ 
          marginBottom:'24px', padding:'20px', borderRadius:'16px', 
          background:'rgba(249,115,22,0.05)', border:'1px solid rgba(249,115,22,0.15)' 
        }}>
          <div style={{ color:'#f97316', fontSize:'0.8rem', fontWeight:800, marginBottom:'8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🏦 입금 계좌 정보
          </div>
          <div style={{ color:'var(--text-main)', fontWeight:800, fontSize: '1.1rem', marginBottom: '4px' }}>{bankInfo.name} {bankInfo.account}</div>
          <div style={{ color:'var(--text-muted)', fontSize:'0.9rem', fontWeight: 500 }}>예금주: {bankInfo.holder}</div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(bankInfo.account);
              alert('계좌번호가 복사되었습니다.');
            }}
            style={{ 
              marginTop: '12px', width: '100%', padding: '8px', borderRadius: '8px', 
              border: '1px solid rgba(249,115,22,0.2)', background: 'white', 
              color: '#f97316', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' 
            }}
          >
            📋 계좌번호 복사하기
          </button>
        </div>
      )}

      {/* 포인트 적립 영역 */}
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
          <span style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: '1.05rem' }}>포인트 적립/사용</span>
        </label>

        {accumulatePoints && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="tel"
                placeholder="휴대폰 번호 입력"
                value={phoneForPoints}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setPhoneForPoints(val);
                  if (val.length >= 10) lookupPoints(val);
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

            <div style={{ 
              display:'flex', justifyContent:'space-between', padding: '15px', 
              background: 'white', borderRadius: '12px', border: '1px solid var(--border)' 
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>보유 포인트</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>{existingPoints.toLocaleString()} P</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>적립 예정</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-orange)' }}>+{potentialPoints.toLocaleString()} P</span>
              </div>
            </div>

            {existingPoints >= 1000 && (
              <button
                onClick={() => setUsePoints(usePoints === 0 ? existingPoints : 0)}
                style={{ 
                  width:'100%', padding:'14px', borderRadius:'12px', fontWeight:800, cursor:'pointer',
                  background: usePoints > 0 ? 'var(--text-main)' : 'white', 
                  color: usePoints > 0 ? 'white' : 'var(--text-main)', 
                  border: usePoints > 0 ? 'none' : '1px solid var(--text-main)',
                  transition: 'all 0.2s'
                }}
              >
                {usePoints > 0 ? `사용 취소 (-${usePoints.toLocaleString()}원)` : `모든 포인트 사용하기`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 현금영수증 (현금/계좌이체) */}
      {(selectedMethod?.id === 'cash' || selectedMethod?.id === 'transfer') && (
        <label style={{ 
          display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', 
          cursor:'pointer', padding:'16px', background:'var(--bg-main)', 
          borderRadius:'16px', border: '1px solid var(--border)'
        }}>
          <div style={{ 
            width: '20px', height: '20px', borderRadius: '4px', border: '2px solid var(--border)',
            background: requestCashReceipt ? 'var(--text-main)' : 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {requestCashReceipt && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
          </div>
          <input type="checkbox" checked={requestCashReceipt} onChange={e => setRequestCashReceipt(e.target.checked)} style={{ display: 'none' }} />
          <span style={{ fontWeight:700, color: 'var(--text-main)', fontSize: '0.95rem' }}>현금영수증 발행 신청</span>
        </label>
      )}

      {/* 최종 금액 및 버튼 */}
      <div style={{ 
        borderTop:'2px solid var(--bg-main)', paddingTop:'24px', marginTop: '10px'
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: '20px' }}>
          <span style={{ color:'var(--text-muted)', fontWeight:700, fontSize: '1rem' }}>최종 결제액</span>
          <span style={{ color:'var(--accent-orange)', fontSize:'1.8rem', fontWeight:900 }}>{finalTotal.toLocaleString()}원</span>
        </div>

        <button
          onClick={async () => {
            try {
              await onSubmit(selectedMethod?.name || '기타', { phone: phoneForPoints, usePoints });
              onClose();
            } catch (err) {
              alert('결제 처리 중 오류가 발생했습니다.');
            }
          }}
          style={{ 
            width:'100%', padding:'20px', background:'var(--primary)', color:'white', 
            border:'none', borderRadius:'18px', fontSize:'1.2rem', fontWeight:900, 
            cursor:'pointer', boxShadow:'0 10px 25px rgba(30, 41, 59, 0.15)' 
          }}
        >
          {finalTotal.toLocaleString()}원 결제하기
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:4000,
      background:'rgba(0,0,0,0.85)', backdropFilter:'blur(10px)',
      padding: '20px', display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div className="animate-pop-in" style={{ 
        maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-lg)',
        scrollbarWidth: 'none', msOverflowStyle: 'none'
      }}>
        {step === 'select' && renderSelect()}
        {step === 'points' && renderPoints()}
      </div>
    </div>
  );
};
