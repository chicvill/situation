import React from 'react';

export const payMethods = {
  pays: [
    { id: 'kakao', name: '📱 카카오페이', color: '#fee500', text: '#000' },
    { id: 'toss', name: '🔵 토스페이', color: '#0064ff', text: '#fff' },
    { id: 'naver', name: '🟢 네이버페이', color: '#03c75a', text: '#fff' },
    { id: 'zero', name: '⚪ 제로페이', color: '#555555', text: '#fff' }
  ],
  cards: [
    { id: 'samsung', name: '삼성카드', color: '#115eb6', text: '#fff' },
    { id: 'hyundai', name: '현대카드', color: '#333333', text: '#fff' },
    { id: 'shinhan', name: '신한카드', color: '#0b4da2', text: '#fff' },
    { id: 'kb', name: '국민카드', color: '#ffbc00', text: '#000' },
    { id: 'bc', name: 'BC카드', color: '#e21b22', text: '#fff' }
  ],
  etc: [
    { id: 'transfer', name: '🏦 계좌이체', color: '#8b5cf6', text: '#fff' },
    { id: 'cash', name: '💵 현금결제', color: '#10b981', text: '#fff' }
  ]
};

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
  const [selectedMethod, setSelectedMethod] = React.useState<string | null>(null);

  // If counter pad and already prepaid (and not onsite), just show confirmation
  const isPrepaid = isCounter && prepaidMethod && prepaidMethod !== '현장결제' && prepaidMethod !== 'CALL' && prepaidMethod !== '카운터에서 직접 결제 (현장결제)';

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

  const renderButtons = (items: any[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      {items.map(m => (
        <button 
          key={m.id} 
          onClick={() => setSelectedMethod(m.name)} 
          style={{ 
            padding: '15px 10px',
            borderRadius: '12px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s',
            borderColor: selectedMethod === m.name ? m.color : 'rgba(255,255,255,0.2)', 
            background: selectedMethod === m.name ? m.color : 'rgba(255,255,255,0.05)', 
            color: selectedMethod === m.name ? m.text : 'white', 
            borderWidth: '2px',
            borderStyle: 'solid'
          }}
        >
          {m.name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="payment-modal-overlay animate-fade-in" style={{ zIndex: isCounter ? 4000 : 2000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="payment-modal animate-pop-in premium-scroll" style={{ width: isCounter ? '550px' : '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', background: '#1e293b', border: '2px solid var(--accent-orange)', borderRadius: '30px', padding: '30px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px' }}>
          {isCounter ? (
             <h2 style={{ fontSize: '1.8rem', margin: 0, color: 'white', display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span>Table: <span style={{ color: 'var(--accent-orange)' }}>{tableNo}</span></span>
                <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.4)' }}>|</span>
                <span style={{ fontSize: '1.2rem' }}>Order: <span style={{ color: 'var(--accent-orange)' }}>{orderNo}</span></span>
             </h2>
          ) : (
             <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'white' }}>💳 결제 수단 선택</h3>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '2.5rem', cursor: 'pointer', lineHeight: '1' }}>&times;</button>
        </header>

        <div className="pay-section" style={{ marginBottom: '25px' }}>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 'bold' }}>간편 결제</p>
          {renderButtons(payMethods.pays)}
        </div>

        <div className="pay-section" style={{ marginBottom: '25px' }}>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 'bold' }}>신용카드 및 기타</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
             {payMethods.cards.map(m => (
               <button 
                 key={m.id} 
                 onClick={() => setSelectedMethod(m.name)} 
                 style={{ 
                   padding: '12px 5px', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer',
                   borderColor: selectedMethod === m.name ? m.color : 'rgba(255,255,255,0.2)', 
                   background: selectedMethod === m.name ? m.color : 'rgba(255,255,255,0.05)', 
                   color: selectedMethod === m.name ? m.text : 'white', 
                   borderWidth: '2px', borderStyle: 'solid'
                 }}
               >
                 {m.name}
               </button>
             ))}
          </div>
          {renderButtons(payMethods.etc)}
        </div>

        {!isCounter && (
          <div className="pay-section" style={{ marginBottom: '25px' }}>
             <button onClick={() => setSelectedMethod('현장결제')} style={{ width: '100%', padding: '15px', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', borderColor: selectedMethod === '현장결제' ? 'var(--accent-orange)' : 'rgba(255,255,255,0.2)', background: selectedMethod === '현장결제' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255,255,255,0.05)', color: 'white', borderWidth: '2px', borderStyle: 'solid' }}>
               🏦 카운터에서 직접 결제 (현장결제)
             </button>
          </div>
        )}

        <button 
          onClick={() => onSubmit(selectedMethod!)} 
          disabled={!selectedMethod} 
          style={{ 
            width: '100%', padding: '20px', borderRadius: '15px', 
            background: selectedMethod ? 'var(--accent-orange)' : '#333', 
            color: 'white', border: 'none', fontWeight: '900', fontSize: '1.4rem', cursor: selectedMethod ? 'pointer' : 'not-allowed',
            boxShadow: selectedMethod ? '0 10px 25px rgba(249,115,22,0.4)' : 'none'
          }}
        >
          {selectedMethod ? `${totalPrice.toLocaleString()}원 결제하기` : '결제 수단을 선택해 주세요'}
        </button>
      </div>
    </div>
  );
};
