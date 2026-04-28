import React from 'react';

interface PaymentModalProps {
  totalPrice: number;
  onClose: () => void;
  onSubmit: (method: string) => void;
  isCounter?: boolean; 
  prepaidMethod?: string | null;
  tableNo?: string;
  orderNo?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ 
  totalPrice, onClose, onSubmit, isCounter, prepaidMethod, tableNo, orderNo 
}) => {
  const [showTransferInfo, setShowTransferInfo] = React.useState(false);

  // If counter pad and already prepaid (and not onsite), just show confirmation
  const isPrepaid = isCounter && prepaidMethod && prepaidMethod !== '현장결제' && prepaidMethod !== 'CALL' && prepaidMethod !== '카운터에서 직접 결제 (현장결제)';

  const processPayment = async (method: string) => {
    if (method === '계좌이체') {
      setShowTransferInfo(true);
      return;
    }

    // 디지털 결제 (토스페이먼츠 연동)
    if (method === '카드/간편결제' && (window as any).TossPayments) {
      try {
        const tossPayments = (window as any).TossPayments('test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq');
        const orderId = orderNo || `ORD_${Date.now()}`;
        
        await tossPayments.requestPayment('카드', {
          amount: totalPrice,
          orderId: orderId,
          orderName: `${tableNo ? 'Table ' + tableNo : '주문'} 결제`,
          successUrl: `${window.location.origin}/?payment_success=true&order_id=${orderId}`,
          failUrl: `${window.location.origin}/?payment_fail=true`,
        });
        return; 
      } catch (err) {
        console.error("Toss Payment Error:", err);
        alert("결제창을 여는 중 오류가 발생했습니다.");
        return;
      }
    }

    // 현금 등은 기존 방식대로 처리
    onSubmit(method);
  };

  if (isPrepaid) {
    return (
      <div className="payment-modal-overlay animate-fade-in" style={{ zIndex: 4000, background: 'rgba(0,0,0,0.9)', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="payment-modal animate-pop-in" style={{ width: '450px', padding: '40px', background: '#1e293b', border: '2px solid #10b981', borderRadius: '30px', boxShadow: '0 30px 60px rgba(0,0,0,0.8)', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', color: '#10b981', marginBottom: '20px' }}>✅ 선결제 완료</h2>
          <p style={{ fontSize: '1.2rem', color: 'white', marginBottom: '30px' }}>
            결제수단: <strong style={{ color: 'var(--accent-orange)' }}>{prepaidMethod}</strong>
          </p>
          <button onClick={() => onSubmit(prepaidMethod!)} style={{ width: '100%', padding: '20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '15px', fontSize: '1.4rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px' }}>
            확인 및 정산 완료
          </button>
          <button onClick={onClose} style={{ width: '100%', padding: '15px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
            닫기 (취소)
          </button>
        </div>
      </div>
    );
  }

  if (showTransferInfo) {
    return (
      <div className="payment-modal-overlay animate-fade-in" style={{ zIndex: 4000, background: 'rgba(0,0,0,0.9)', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="payment-modal animate-pop-in" style={{ width: '450px', padding: '32px', background: '#1e293b', border: '1px solid var(--accent-orange)', borderRadius: '30px', boxShadow: '0 30px 60px rgba(0,0,0,0.8)', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', color: 'white', marginBottom: '24px' }}>🏦 계좌이체 안내</h2>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '24px', borderRadius: '20px', textAlign: 'left', marginBottom: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 4px 0', fontSize: '0.9rem' }}>은행명</p>
              <p style={{ color: 'white', margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>국민은행 (KB)</p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 4px 0', fontSize: '0.9rem' }}>계좌번호</p>
              <p style={{ color: 'var(--accent-orange)', margin: 0, fontSize: '1.4rem', fontWeight: '900', letterSpacing: '1px' }}>123-456789-01-012</p>
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 4px 0', fontSize: '0.9rem' }}>예금주</p>
              <p style={{ color: 'white', margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>주식회사 시크앤프레시</p>
            </div>
          </div>

          <div style={{ fontSize: '1.3rem', color: 'white', marginBottom: '32px', fontWeight: 'bold' }}>
            입금 금액: <span style={{ color: 'var(--accent-orange)' }}>{totalPrice.toLocaleString()}원</span>
          </div>

          <button onClick={() => onSubmit('계좌이체')} style={{ width: '100%', padding: '20px', background: 'var(--accent-orange)', color: 'white', border: 'none', borderRadius: '15px', fontSize: '1.4rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '12px' }}>
            입금 완료
          </button>
          <button onClick={() => setShowTransferInfo(false)} style={{ width: '100%', padding: '15px', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '15px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
            뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  const mainMethods = [
    { id: 'digital', name: '카드/간편결제', icon: '💳', desc: '신용카드, 삼성페이, 애플페이, 카카오/토스페이', color: '#3b82f6' },
    { id: 'transfer', name: '계좌이체', icon: '🏦', desc: '실시간 계좌이체 및 무통장 입금', color: '#8b5cf6' },
    { id: 'cash', name: '현금결제', icon: '💵', desc: '매장에서 현금으로 직접 결제', color: '#10b981' }
  ];

  return (
    <div className="payment-modal-overlay animate-fade-in" style={{ zIndex: isCounter ? 4000 : 2000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="payment-modal animate-pop-in" style={{ width: isCounter ? '500px' : '95%', maxWidth: '480px', background: 'linear-gradient(145deg, #1e293b, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '32px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', color: 'white', margin: 0 }}>결제 수단 선택</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>결제 방식을 선택하면 즉시 연결됩니다</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
          {mainMethods.map(m => (
            <button 
              key={m.id} 
              onClick={() => processPayment(m.name)} 
              className="payment-method-btn"
              style={{ 
                display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '20px', border: '2px solid rgba(255,255,255,0.05)',
                background: 'rgba(255,255,255,0.03)',
                textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = m.color;
                e.currentTarget.style.background = `${m.color}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }}
            >
              <span style={{ fontSize: '2rem', background: 'rgba(255,255,255,0.05)', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{m.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{m.desc}</div>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '1.2rem' }}>❯</span>
            </button>
          ))}
        </div>

        <div style={{ 
          width: '100%', padding: '24px', borderRadius: '20px', 
          background: 'rgba(255,255,255,0.05)', 
          color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontWeight: '900', fontSize: '1.4rem', textAlign: 'center'
        }}>
          총 {totalPrice.toLocaleString()}원 결제
        </div>
      </div>
    </div>
  );
};
