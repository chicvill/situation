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
  { id: 'cash',     icon: '💵', name: '현금 결제',         desc: '매장 현장 결제',                    color: '#10b981' },
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
            onClick={async () => {
              setSelectedMethod(m);
              try {
                await onSubmit(m.name);
                setStep('points');
              } catch (err) {
                alert('주문 처리 중 오류가 발생했습니다.');
              }
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
          <span style={{ color:'var(--accent)', fontSize:'1.4rem', fontWeight:700 }}>{totalPrice.toLocaleString()}원</span>
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
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
        <button onClick={() => setStep('select')} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'1.2rem', cursor:'pointer' }}>❮</button>
        <h2 style={{ color:'var(--text-main)', margin:0, fontSize:'1.1rem', fontWeight:700 }}>포인트 적립</h2>
      </div>

      {/* 선택된 결제수단 배지 */}
      <div style={{ marginBottom:'20px', padding:'14px 18px', borderRadius:'14px', background:`${selectedMethod?.color}18`, border:`1px solid ${selectedMethod?.color}44`, display:'flex', alignItems:'center', gap:'12px' }}>
        <span style={{ fontSize:'1.6rem' }}>{selectedMethod?.icon}</span>
        <span style={{ color:'white', fontWeight:700 }}>{selectedMethod?.name}</span>
      </div>

      {/* 계좌이체 매장 계좌 안내 */}
      {selectedMethod?.id === 'transfer' && (
        <div style={{ marginBottom:'16px', padding:'16px', borderRadius:'14px', background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.3)' }}>
          <div style={{ color:'#f97316', fontSize:'0.75rem', fontWeight:700, marginBottom:'4px' }}>입금 계좌</div>
          <div style={{ color:'white', fontWeight:700 }}>{bankInfo.name} {bankInfo.account}</div>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.85rem' }}>예금주: {bankInfo.holder}</div>
        </div>
      )}

      {/* 포인트 적립 여부 체크 */}
      <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: accumulatePoints ? '15px' : '0' }}>
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
            style={{ width: '20px', height: '20px', accentColor: '#f97316' }}
          />
          <span style={{ color: 'white', fontWeight: 700, fontSize: '1.05rem' }}>포인트 적립을 하시겠습니까?</span>
        </label>

        {accumulatePoints && (
          <div className="animate-fade-in">
            <input
              type="tel"
              placeholder="010-0000-0000"
              value={phoneForPoints}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setPhoneForPoints(val);
                if (val.length >= 10) lookupPoints(val);
              }}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                color: 'white', fontSize: '1.1rem', outline: 'none', textAlign: 'center'
              }}
            />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.9rem', color:'white', marginTop: '12px' }}>
              <span>적립 예정: <strong style={{ color:'#f97316' }}>+{potentialPoints.toLocaleString()}P</strong></span>
              <span>보유: <strong>{existingPoints.toLocaleString()}P</strong></span>
            </div>
            {existingPoints >= 1000 && (
              <button
                onClick={() => setUsePoints(usePoints === 0 ? existingPoints : 0)}
                style={{ width:'100%', marginTop:'12px', padding:'10px', background: usePoints > 0 ? '#f97316' : 'rgba(255,255,255,0.08)', color:'white', border:'none', borderRadius:'10px', fontWeight:700, cursor:'pointer' }}
              >
                {usePoints > 0 ? `사용 취소 (-${usePoints.toLocaleString()}원)` : `${existingPoints.toLocaleString()}P 포인트 사용`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 현금영수증 (현금/계좌이체) */}
      {(selectedMethod?.id === 'cash' || selectedMethod?.id === 'transfer') && (
        <label style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px', color:'white', cursor:'pointer', padding:'14px', background:'rgba(255,255,255,0.03)', borderRadius:'12px' }}>
          <input type="checkbox" checked={requestCashReceipt} onChange={e => setRequestCashReceipt(e.target.checked)} style={{ width:'16px', height:'16px' }} />
          <span style={{ fontWeight:600 }}>현금영수증 발행 신청</span>
        </label>
      )}

      {/* 최종 금액 */}
      <div style={{ borderTop:'1px dashed rgba(255,255,255,0.1)', paddingTop:'18px', marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <span style={{ color:'#94a3b8', fontWeight:600 }}>최종 결제액</span>
        <span style={{ color:'#f97316', fontSize:'1.6rem', fontWeight:900 }}>{finalTotal.toLocaleString()}원</span>
      </div>

      {/* 완료 버튼 */}
      <button
        onClick={onClose}
        style={{ width:'100%', padding:'18px', background:'linear-gradient(135deg,#1e293b,#0f172a)', color:'white', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', fontSize:'1.15rem', fontWeight:800, cursor:'pointer', boxShadow:'0 6px 20px rgba(0,0,0,0.2)', letterSpacing:'0.02em' }}
      >
        적립 완료 및 확인하기
      </button>
    </div>
  );

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:4000,
      background:'rgba(0,0,0,0.85)', backdropFilter:'blur(10px)',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div className="animate-pop-in">
        {step === 'select' && renderSelect()}
        {step === 'points' && renderPoints()}
      </div>
    </div>
  );
};
