import React from 'react';
import type { BundleData } from '../types';

interface PaymentModalProps {
  totalPrice: number;
  onClose: () => void;
  onSubmit: (method: string, extraData?: any) => void;
  isCounter?: boolean; 
  prepaidMethod?: string | null;
  tableNo?: string;
  orderNo?: string;
  bundles?: BundleData[];
  initialPhone?: string;
  onPhoneChange?: (val: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ 
  totalPrice: initialTotalPrice, onClose, onSubmit, isCounter, prepaidMethod, tableNo, orderNo, bundles,
  initialPhone = '', onPhoneChange
}) => {
  const [step, setStep] = React.useState<'select' | 'phone_input' | 'transfer_select' | 'points'>('select');
  const [selectedMethod, setSelectedMethod] = React.useState<string | null>(null);
  const [phoneForPoints, setPhoneForPoints] = React.useState(initialPhone);
  const [existingPoints, setExistingPoints] = React.useState(0);
  const [usePoints, setUsePoints] = React.useState(0);
  const [requestCashReceipt, setRequestCashReceipt] = React.useState(false);
  const [cashReceiptPhone, setCashReceiptPhone] = React.useState('');

  const potentialPoints = Math.floor(initialTotalPrice * 0.001); // 0.1% 적립
  const finalTotalPrice = initialTotalPrice - usePoints;

  // Sync phone back to parent
  React.useEffect(() => {
    if (onPhoneChange) onPhoneChange(phoneForPoints);
  }, [phoneForPoints, onPhoneChange]);

  // 매장 설정에서 은행 정보 추출 (안내용)
  const storeBundle = bundles?.find(b => b.type === 'StoreConfig');
  const bankInfo = storeBundle ? {
    name: storeBundle.items.find(i => i.name === '은행명')?.value || '국민은행',
    account: storeBundle.items.find(i => i.name === '계좌번호')?.value || '123-456789-01-012',
    holder: storeBundle.items.find(i => i.name === '예금주')?.value || '시크앤프레시'
  } : { name: '국민은행', account: '123-456789-01-012', holder: '시크앤프레시' };

  const handleCheckPoints = async (phone: string) => {
    if (phone.length < 10) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      const res = await fetch(`${apiUrl}/api/points/${phone}`);
      const data = await res.json();
      setExistingPoints(data.points || 0);
    } catch (err) {
      console.error("Points Check Error:", err);
    }
  };

  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
    if (method === '계좌이체') {
        setStep('phone_input');
    } else {
        setStep('points');
    }
  };

  const startTossPayment = async (type: '카드' | '계좌이체' | '가상계좌') => {
    if (!(window as any).TossPayments) return;
    
    try {
      const tossPayments = (window as any).TossPayments('test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq');
      const orderId = orderNo || `ORD_${Date.now()}`;
      
      await tossPayments.requestPayment(type, {
        amount: finalTotalPrice,
        orderId: orderId,
        orderName: `${tableNo ? 'Table ' + tableNo : '주문'} 결제`,
        successUrl: `${window.location.origin}/?payment_success=true&order_id=${orderId}&amount=${finalTotalPrice}&method=${type === '카드' ? '카드' : '계좌이체'}`,
        failUrl: `${window.location.origin}/?payment_fail=true`,
      });
    } catch (err) {
      console.error("Toss Payment Error:", err);
      alert("결제창을 여는 중 오류가 발생했습니다.");
    }
  };

  const executePayment = async () => {
    const method = selectedMethod!;
    const extraData = {
      phoneForPoints,
      earnedPoints: potentialPoints,
      usedPoints: usePoints,
      requestCashReceipt,
      cashReceiptPhone: cashReceiptPhone || phoneForPoints
    };

    if (method === '카드/간편결제') {
      await startTossPayment('카드');
      return;
    }

    if (method === '계좌이체') {
        await startTossPayment('계좌이체');
        return;
    }

    onSubmit(method, extraData);
  };

  const renderSelect = () => (
    <div className="payment-modal animate-pop-in" style={{ width: '480px', background: 'linear-gradient(145deg, #1e293b, #0f172a)', borderRadius: '32px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ color: 'white', margin: 0 }}>결제 수단 선택</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {[
          { id: 'digital', name: '카드/간편결제', icon: '💳', desc: '신용카드, 삼성/애플페이, 토스페이', color: '#3b82f6' },
          { id: 'transfer', name: '계좌이체', icon: '🏦', desc: '은행 선택 후 앱에서 바로 송금', color: '#8b5cf6' },
          { id: 'cash', name: '현금결제', icon: '💵', desc: '매장 현장 결제', color: '#10b981' }
        ].map(m => (
          <button key={m.id} onClick={() => handleMethodSelect(m.name)} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.03)', textAlign: 'left', cursor: 'pointer', transition: '0.2s' }}>
            <span style={{ fontSize: '2rem' }}>{m.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>{m.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{m.desc}</div>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>❯</span>
          </button>
        ))}
      </div>
      <div style={{ padding: '20px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
        총 {initialTotalPrice.toLocaleString()}원 결제
      </div>
    </div>
  );

  const renderPhoneInput = () => (
    <div className="payment-modal animate-pop-in" style={{ width: '450px', background: '#fff', borderRadius: '40px', padding: '40px', color: '#1a1a1a', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', zIndex: 10000 }}>
        <header style={{ marginBottom: '30px' }}>
            <button onClick={() => setStep('select')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b', marginBottom: '20px' }}>❮</button>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 10px 0', lineHeight: '1.4' }}>계좌로 결제하려면<br/>휴대폰번호를 입력해주세요</h2>
            <p style={{ color: '#888', margin: 0, fontWeight: '500' }}>주문 결제</p>
        </header>

        <div style={{ marginBottom: '30px' }}>
            <label htmlFor="phone-input" style={{ color: '#64748b', fontSize: '0.9rem', display: 'block', marginBottom: '10px' }}>휴대폰번호</label>
            <input 
                id="phone-input"
                type="tel" 
                autoFocus
                placeholder="010-0000-0000" 
                value={phoneForPoints}
                onChange={(e) => setPhoneForPoints(e.target.value)}
                style={{ 
                    width: '100%', padding: '15px 0', border: 'none', borderBottom: '2px solid #3b82f6',
                    fontSize: '1.8rem', fontWeight: '700', outline: 'none', color: '#1a1a1a',
                    background: 'transparent'
                }}
            />
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', marginTop: '20px' }}>
                테스트용 휴대폰번호가 입력되어 있어요.<br/>다음을 눌러주세요.
            </p>
        </div>

        <button 
            onClick={() => {
                handleCheckPoints(phoneForPoints);
                setStep('transfer_select');
            }} 
            disabled={!phoneForPoints}
            style={{ 
                width: '100%', padding: '20px', background: phoneForPoints ? '#3b82f6' : '#cbd5e1', 
                color: 'white', border: 'none', borderRadius: '20px', fontWeight: '800', fontSize: '1.2rem', cursor: 'pointer' 
            }}
        >
            다음
        </button>
    </div>
  );

  const renderTransferSelect = () => {
    const banks = [
        { name: '국민은행', logo: '🏦', id: 'kb' },
        { name: '농협', logo: '🌾', id: 'nh' },
        { name: '우리', logo: '🔵', id: 'woori' },
        { name: '신한', logo: '🌀', id: 'shinhan' },
        { name: '기업', logo: '💼', id: 'ibk' },
        { name: '하나', logo: '🟢', id: 'hana' },
        { name: '카카오', logo: '🟡', id: 'kakao' },
        { name: '토스', logo: '🔵', id: 'toss' }
    ];

    return (
      <div className="payment-modal animate-pop-in" style={{ width: '450px', background: '#fff', borderRadius: '40px', padding: '40px', color: '#1a1a1a', boxShadow: '0 30px 60px rgba(0,0,0,0.8)' }}>
        <header style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 10px 0' }}>결제할 계좌 선택</h2>
            <p style={{ color: '#888', margin: 0, fontWeight: '500' }}>주문 결제</p>
        </header>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '30px' }}>
            {banks.map(bank => (
                <button 
                    key={bank.id} 
                    onClick={() => setStep('points')}
                    style={{ 
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', 
                        padding: '20px 10px', background: '#f8fafc', border: '1px solid #f1f5f9', 
                        borderRadius: '24px', cursor: 'pointer', transition: '0.2s' 
                    }}
                >
                    <span style={{ fontSize: '2.5rem' }}>{bank.logo}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#334155' }}>{bank.name}</span>
                </button>
            ))}
        </div>

        <button onClick={() => setStep('phone_input')} style={{ width: '100%', padding: '18px', background: '#f1f5f9', border: 'none', borderRadius: '20px', color: '#64748b', fontWeight: '800', fontSize: '1rem', cursor: 'pointer' }}>뒤로 가기</button>
      </div>
    );
  };

  const renderPoints = () => (
    <div className="payment-modal animate-pop-in" style={{ width: '480px', background: '#1e293b', borderRadius: '30px', padding: '32px', border: '1px solid rgba(255,255,255,0.1)' }}>
      <h2 style={{ color: 'white', marginBottom: '24px', textAlign: 'center' }}>💰 포인트 및 최종 확인</h2>
      
      {/* 계좌 정보 안내 (계좌이체일 때만 노출) */}
      {selectedMethod === '계좌이체' && (
        <div style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid var(--accent-orange)', padding: '20px', borderRadius: '20px', marginBottom: '20px' }}>
            <div style={{ color: 'var(--accent-orange)', fontSize: '0.8rem', marginBottom: '5px', fontWeight: 'bold' }}>입금 받을 매장 계좌</div>
            <div style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold' }}>{bankInfo.name} {bankInfo.account}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>예금주: {bankInfo.holder}</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '10px', margin: '10px 0 0 0' }}>※ 결제하기 클릭 시 고객님의 뱅킹 앱으로 연결됩니다.</p>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '20px', marginBottom: '20px' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '8px' }}>포인트 적립 정보</p>
        <div style={{ fontSize: '1.2rem', color: 'white', fontWeight: 'bold', marginBottom: '10px' }}>{phoneForPoints}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: 'white' }}>
          <span>적립 예정: <strong style={{ color: 'var(--accent-orange)' }}>+{potentialPoints.toLocaleString()}P</strong></span>
          <span>현재 포인트: <strong>{existingPoints.toLocaleString()}P</strong></span>
        </div>
        {existingPoints >= 10000 && (
          <button onClick={() => setUsePoints(usePoints === 0 ? existingPoints : 0)} style={{ width: '100%', marginTop: '15px', padding: '12px', background: usePoints > 0 ? 'var(--accent-orange)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>
            {usePoints > 0 ? `사용 취소 (-${usePoints.toLocaleString()}원)` : `${existingPoints.toLocaleString()}P 전액 사용하기`}
          </button>
        )}
      </div>

      {(selectedMethod === '계좌이체' || selectedMethod === '현금결제') && (
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '15px', marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white', cursor: 'pointer' }}>
            <input type="checkbox" checked={requestCashReceipt} onChange={(e) => setRequestCashReceipt(e.target.checked)} style={{ width: '18px', height: '18px' }} />
            <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>현금영수증 발행 신청</span>
          </label>
        </div>
      )}

      <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'white', fontSize: '1.4rem', fontWeight: '900' }}>
          <span>최종 결제액</span>
          <span style={{ color: 'var(--accent-orange)' }}>{finalTotalPrice.toLocaleString()}원</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={() => setStep(selectedMethod === '계좌이체' ? 'transfer_select' : 'select')} style={{ flex: 1, padding: '18px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '15px', fontWeight: 'bold' }}>뒤로</button>
        <button onClick={executePayment} style={{ flex: 2, padding: '18px', background: 'var(--accent-orange)', color: 'white', border: 'none', borderRadius: '15px', fontSize: '1.2rem', fontWeight: 'bold' }}>{finalTotalPrice.toLocaleString()}원 결제하기</button>
      </div>
    </div>
  );

  return (
    <div className="payment-modal-overlay" style={{ zIndex: 4000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
      {step === 'select' && renderSelect()}
      {step === 'phone_input' && renderPhoneInput()}
      {step === 'transfer_select' && renderTransferSelect()}
      {step === 'points' && renderPoints()}
    </div>
  );
};
