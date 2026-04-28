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

  return (
    <div className="receipt-modal-overlay animate-fade-in" style={{ 
      zIndex: 5000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', 
      alignItems: 'center', justifyContent: 'center', padding: '20px' 
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
          {receiptUrl && (
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
          )}
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
            닫기
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
