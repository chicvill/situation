import React from 'react';

interface ReceiptItem {
  name: string;
  value: string;
  price?: number;
}

interface ReceiptModalProps {
  orderId: string;
  totalPrice: number;
  paymentMethod: string;
  items: ReceiptItem[];
  onClose: () => void;
  receiptUrl?: string;
  storeName?: string;
  showGwansangOption?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ 
  orderId, totalPrice, paymentMethod, items, onClose, receiptUrl, storeName, showGwansangOption
}) => {
  const today = new Date().toLocaleString();
  const displayStoreName = storeName || '시크빌';

  // 정밀 한글/영문 텍스트 바이트 정렬 헬퍼
  const getByteLength = (str: string) => {
    let len = 0;
    for (let i = 0; i < str.length; i++) {
      if (str.charCodeAt(i) > 127) len += 2; // 한글 전각 문자 2바이트
      else len += 1;
    }
    return len;
  };

  const padText = (str: string, targetLength: number, padChar = ' ', padLeft = false) => {
    const currentLen = getByteLength(str);
    if (currentLen >= targetLength) return str;
    const padding = padChar.repeat(targetLength - currentLen);
    return padLeft ? padding + str : str + padding;
  };

  const handleSaveAsFile = () => {
    const receiptText = `
========================================
             영 수 증 (RECEIPT)
========================================
매장명   : ${displayStoreName}
발행일시 : ${today}
주문번호 : ${orderId}
결제수단 : ${paymentMethod}
----------------------------------------
상품명                  수량        금액
----------------------------------------
${items.map(item => {
  const nameCol = padText(item.name, 22);
  const qtyCol = padText(item.value, 8, ' ', true);
  const priceVal = item.price !== undefined ? `${item.price.toLocaleString()}원` : '-';
  const priceCol = padText(priceVal, 10, ' ', true);
  return `${nameCol}${qtyCol}${priceCol}`;
}).join('\n')}
----------------------------------------
총 결제 금액: ₩ ${totalPrice.toLocaleString()}원
========================================
이용해 주셔서 감사합니다!
`;
    
    const blob = new Blob(['\ufeff' + receiptText], { type: 'text/plain;charset=utf-8' });
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
      zIndex: 15000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
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
          <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: '#111' }}>{displayStoreName}</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: '#666' }}>{today}</p>
        </div>

        {/* Order Details */}
        <div style={{ marginBottom: '20px', fontSize: '0.85rem' }}>
          <p style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
            <span style={{ color: '#666' }}>주문번호</span>
            <span style={{ fontWeight: 'bold' }}>{orderId}</span>
          </p>
          <p style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
            <span style={{ color: '#666' }}>결제수단</span>
            <span style={{ fontWeight: 'bold' }}>{paymentMethod}</span>
          </p>
        </div>

        {/* Items Grid */}
        <div style={{ borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '10px', fontSize: '0.85rem', color: '#555' }}>
            <span style={{ flex: 2 }}>상품명</span>
            <span style={{ flex: 1, textAlign: 'center' }}>수량</span>
            <span style={{ flex: 1, textAlign: 'right' }}>금액</span>
          </div>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0', fontSize: '0.85rem' }}>
              <span style={{ flex: 2, fontWeight: 500 }}>{item.name}</span>
              <span style={{ flex: 1, textAlign: 'center', color: '#666' }}>{item.value}</span>
              <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>
                {item.price !== undefined ? `${item.price.toLocaleString()}원` : '-'}
              </span>
            </div>
          ))}
        </div>

        {/* Total Price */}
        <div style={{ textAlign: 'right', marginBottom: '30px' }}>
          <p style={{ fontSize: '0.9rem', margin: '0 0 5px 0', color: '#666' }}>최종 합계</p>
          <h3 style={{ fontSize: '1.8rem', margin: 0, fontWeight: '900' }}>₩ {totalPrice.toLocaleString()}원</h3>
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
              📄 전자 영수증 확인 (PayApp)
            </a>
          ) : (
            <div style={{ 
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', 
              padding: '14px', fontSize: '0.8rem', color: '#64748b', textAlign: 'center',
              lineHeight: 1.45, fontWeight: 500
            }}>
              💡 테스트(Sandbox) 결제 건은 페이앱 공식 전자의무영수증 발급이 생략됩니다.
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
          {showGwansangOption ? (
            <>
              <button 
                onClick={() => {
                  const getGwansangUrl = () => {
                    const hostname = window.location.hostname;
                    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
                      return `http://${hostname}:5174`;
                    }
                    return 'https://gwansang.chicvill.store';
                  };
                  window.location.href = getGwansangUrl();
                }}
                style={{ 
                  padding: '15px', 
                  background: 'linear-gradient(135deg, #d4af37, #f3e5ab)', 
                  color: '#1a1a1a', 
                  border: 'none', 
                  borderRadius: '8px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(212,175,55,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                ✨ AI 관상 보러가기 (운세 예측)
              </button>
              <button 
                onClick={onClose}
                style={{ padding: '15px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                그냥 종료하기
              </button>
            </>
          ) : (
            <button 
              onClick={onClose}
              style={{ padding: '15px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              종료
            </button>
          )}
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
