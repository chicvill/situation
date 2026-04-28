import React from 'react';

interface PaymentModalProps {
  totalPrice: number;
  onClose: () => void;
  onSubmit: (method: string, extraData?: any) => void;
  isCounter?: boolean; 
  prepaidMethod?: string | null;
  tableNo?: string;
  orderNo?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ 
  totalPrice: initialTotalPrice, onClose, onSubmit, isCounter, prepaidMethod, tableNo, orderNo 
}) => {
  const [step, setStep] = React.useState<'select' | 'points' | 'transfer'>('select');
  const [selectedMethod, setSelectedMethod] = React.useState<string | null>(null);
  const [phoneForPoints, setPhoneForPoints] = React.useState('');
  const [existingPoints, setExistingPoints] = React.useState(0);
  const [usePoints, setUsePoints] = React.useState(0);
  const [requestCashReceipt, setRequestCashReceipt] = React.useState(false);
  const [cashReceiptPhone, setCashReceiptPhone] = React.useState('');

  const potentialPoints = Math.floor(initialTotalPrice * 0.001); // 0.1% 적립
  const finalTotalPrice = initialTotalPrice - usePoints;

  // 포인트 조회
  const handleCheckPoints = async () => {
    if (phoneForPoints.length < 10) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      const res = await fetch(`${apiUrl}/api/points/${phoneForPoints}`);
      const data = await res.json();
      setExistingPoints(data.points || 0);
    } catch (err) {
      console.error("Points Check Error:", err);
    }
  };

  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
    setStep('points');
  };

  const executePayment = async () => {
    const method = selectedMethod!;
    const extraData = {
      phoneForPoints,
      earnedPoints: potentialPoints,
      usedPoints: usePoints,
      requestCashReceipt,
      cashReceiptPhone: cashReceiptPhone || phoneForPoints // 포인트 번호와 동일할 확률이 높음
    };

    // 토스페이먼츠 연동
    if ((method === '카드/간편결제' || method === '계좌이체') && (window as any).TossPayments) {
      try {
        const tossPayments = (window as any).TossPayments('test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq');
        const orderId = orderNo || `ORD_${Date.now()}`;
        const tossType = method === '카드/간편결제' ? '카드' : '가상계좌';
        
        await tossPayments.requestPayment(tossType, {
          amount: finalTotalPrice,
          orderId: orderId,
          orderName: `${tableNo ? 'Table ' + tableNo : '주문'} 결제`,
          successUrl: `${window.location.origin}/?payment_success=true&order_id=${orderId}&method=${tossType}&amount=${finalTotalPrice}`,
          failUrl: `${window.location.origin}/?payment_fail=true`,
        });
        return; 
      } catch (err) {
        console.error("Toss Payment Error:", err);
        alert("결제창을 여는 중 오류가 발생했습니다.");
        return;
      }
    }

    onSubmit(method, extraData);
  };

  // 1. 선결제 완료 뷰
  if (isCounter && prepaidMethod && prepaidMethod !== '현장결제' && prepaidMethod !== 'CALL') {
    return (
      <div className="payment-modal-overlay" style={{ zIndex: 4000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
        <div className="payment-modal animate-pop-in" style={{ width: '450px', padding: '40px', background: '#1e293b', border: '2px solid #10b981', borderRadius: '30px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', color: '#10b981', marginBottom: '20px' }}>✅ 선결제 완료</h2>
          <p style={{ fontSize: '1.2rem', color: 'white', marginBottom: '30px' }}>결제수단: <strong>{prepaidMethod}</strong></p>
          <button onClick={() => onSubmit(prepaidMethod!)} style={{ width: '100%', padding: '20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '15px', fontSize: '1.4rem', fontWeight: 'bold' }}>확인</button>
        </div>
      </div>
    );
  }

  // 2. 결제 수단 선택 뷰
  if (step === 'select') {
    const mainMethods = [
      { id: 'digital', name: '카드/간편결제', icon: '💳', desc: '신용카드, 삼성/애플페이, 토스페이', color: '#3b82f6' },
      { id: 'transfer', name: '계좌이체', icon: '🏦', desc: '가상계좌 발급 및 자동 입금 확인', color: '#8b5cf6' },
      { id: 'cash', name: '현금결제', icon: '💵', desc: '매장 현장 결제', color: '#10b981' }
    ];

    return (
      <div className="payment-modal-overlay" style={{ zIndex: 4000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="payment-modal animate-pop-in" style={{ width: '480px', background: 'linear-gradient(145deg, #1e293b, #0f172a)', borderRadius: '32px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 style={{ color: 'white', margin: 0 }}>결제 수단 선택</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
          </header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {mainMethods.map(m => (
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
      </div>
    );
  }

  // 3. 포인트 적립 및 최종 확인 뷰
  return (
    <div className="payment-modal-overlay" style={{ zIndex: 4000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
      <div className="payment-modal animate-pop-in" style={{ width: '480px', background: '#1e293b', borderRadius: '30px', padding: '32px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ color: 'white', marginBottom: '24px', textAlign: 'center' }}>💰 포인트 적립 및 결제</h2>
        
        {/* 포인트 입력 영역 */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '20px', marginBottom: '20px' }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '8px' }}>포인트 적립용 전화번호</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input 
              type="tel" 
              placeholder="01012345678" 
              value={phoneForPoints}
              onChange={(e) => setPhoneForPoints(e.target.value)}
              style={{ flex: 1, padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white', fontSize: '1.1rem' }}
            />
            <button onClick={handleCheckPoints} style={{ padding: '0 20px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>조회</button>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: 'white' }}>
            <span>적립 예정: <strong style={{ color: 'var(--accent-orange)' }}>+{potentialPoints.toLocaleString()}P</strong></span>
            <span>현재 포인트: <strong>{existingPoints.toLocaleString()}P</strong></span>
          </div>

          {/* 포인트 사용 버튼 (10000P 이상일 때만) */}
          {existingPoints >= 10000 && (
            <button 
              onClick={() => setUsePoints(usePoints === 0 ? existingPoints : 0)}
              style={{ width: '100%', marginTop: '15px', padding: '12px', background: usePoints > 0 ? 'var(--accent-orange)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}
            >
              {usePoints > 0 ? `사용 취소 (-${usePoints.toLocaleString()}원)` : `${existingPoints.toLocaleString()}P 전액 사용하기`}
            </button>
          )}
        </div>

        {/* 계좌이체/현금 시 현금영수증 옵션 */}
        {(selectedMethod === '계좌이체' || selectedMethod === '현금결제') && (
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '15px', marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white', cursor: 'pointer' }}>
              <input type="checkbox" checked={requestCashReceipt} onChange={(e) => setRequestCashReceipt(e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>현금영수증 발행 신청</span>
            </label>
          </div>
        )}

        {/* 최종 결제 금액 요약 */}
        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
            <span>주문 금액</span>
            <span>{initialTotalPrice.toLocaleString()}원</span>
          </div>
          {usePoints > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-orange)', marginBottom: '8px' }}>
              <span>포인트 할인</span>
              <span>-{usePoints.toLocaleString()}원</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'white', fontSize: '1.4rem', fontWeight: '900' }}>
            <span>최종 결제액</span>
            <span style={{ color: 'var(--accent-orange)' }}>{finalTotalPrice.toLocaleString()}원</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setStep('select')} style={{ flex: 1, padding: '18px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '15px', fontWeight: 'bold' }}>뒤로</button>
          <button onClick={executePayment} style={{ flex: 2, padding: '18px', background: 'var(--accent-orange)', color: 'white', border: 'none', borderRadius: '15px', fontSize: '1.2rem', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(249,115,22,0.3)' }}>{finalTotalPrice.toLocaleString()}원 결제하기</button>
        </div>
      </div>
    </div>
  );
};
