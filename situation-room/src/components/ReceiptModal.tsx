import React from 'react';

interface ReceiptModalProps {
  orderId: string;
  totalPrice: number;
  paymentMethod: string;
  items: { name: string; value: string }[];
  onClose: () => void;
  receiptUrl?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ 
  orderId, totalPrice, paymentMethod, items, onClose, receiptUrl 
}) => {
  const today = new Date().toLocaleString();

  const handleSaveAsFile = () => {
    const receiptText = `
========================================
             영 수 증 (RECEIPT)
========================================
매장명   : 시크앤프레시 (Chic & Fresh)
발행일시 : ${today}
주문번호 : ${orderId}
결제수단 : ${paymentMethod}
----------------------------------------
상품명                      수량    금액
----------------------------------------
${items.map(item => `${item.name.padEnd(20)} ${item.value.padStart(15)}`).join('\n')}
----------------------------------------
총 결제 금액: ₩ ${totalPrice.toLocaleString()}원
========================================
이용해 주셔서 감사합니다!
`;
    
    const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `영수증_${orderId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert('영수증이 텍스트 파일로 성공적으로 저장되었습니다! 💾');
  };

  return (
    <div className="receipt-modal-overlay animate-fade-in" style={{ 
      zIndex: 5000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', 
      alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto',
      padding: '20px 20px 100px 20px'
    }}>
      <div className="receipt-paper animate-pop-in" style={{ 
        width: '100%', maxWidth: '380px', background: 'white', borderRadius: '4px', 
        padding: '30px', color: '#1a1a1a', fontFamily: 'monospace', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        position: 'relative'
      }}>
        {/* Receipt Decorative Top */}
        <div style={{ textAlign: 'center', borderBottom: '2px dashed #ddd', paddingBottom: '20px', marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', fontWeight: 'bold' }}>RECEIPT</h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>시크앤프레시 (Chic & Fresh)</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#888' }}>{today}</p>
        </div>

        {/* Order Details */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
            <span>Order No.</span>
            <span>{orderId}</span>
          </p>
          <p style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
            <span>Payment</span>
            <span>{paymentMethod}</span>
          </p>
        </div>

        {/* Items Grid */}
        <div style={{ borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '10px', fontSize: '0.9rem' }}>
            <span>Item</span>
            <span>Qty</span>
          </div>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '0.9rem' }}>
              <span style={{ flex: 1 }}>{item.name}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Total Price */}
        <div style={{ textAlign: 'right', marginBottom: '30px' }}>
          <p style={{ fontSize: '0.9rem', margin: '0 0 5px 0' }}>Total Amount</p>
          <h3 style={{ fontSize: '1.8rem', margin: 0, fontWeight: '900' }}>₩ {totalPrice.toLocaleString()}</h3>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {receiptUrl ? (
            <a 
              href={receiptUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                display: 'block', textAlign: 'center', padding: '15px', background: '#3b82f6', 
                color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: 'bold' 
              }}
            >
              📄 전자 영수증 확인 (Toss)
            </a>
          ) : (
            <div style={{ 
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', 
              padding: '14px', fontSize: '0.8rem', color: '#64748b', textAlign: 'center',
              lineHeight: 1.45, fontWeight: 500
            }}>
              💡 테스트(Sandbox) 결제 건은 토스 공식 전자의무영수증 발급이 생략됩니다.
            </div>
          )}
          <button 
            onClick={handleSaveAsFile}
            style={{ padding: '15px', background: '#f97316', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(249,115,22,0.2)' }}
          >
            💾 파일로 저장하기
          </button>
          <button 
            onClick={() => window.print()}
            style={{ padding: '15px', background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🖨️ 영수증 출력하기
          </button>
          <button 
            onClick={onClose}
            style={{ padding: '15px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            취소
          </button>
        </div>

        {/* Bottom Jagged Edge Decorative */}
        <div style={{ 
          position: 'absolute', bottom: '-10px', left: 0, width: '100%', height: '10px',
          background: 'linear-gradient(-45deg, transparent 5px, white 5px), linear-gradient(45deg, transparent 5px, white 5px)',
          backgroundSize: '10px 10px', backgroundPosition: 'left bottom'
        }}></div>
      </div>
    </div>
  );
};
