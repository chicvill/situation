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
  totalPrice: initialTotalPrice, onClose, tableNo, orderNo, bundles,
  initialPhone = '', onPhoneChange
}) => {
  const [step, setStep] = React.useState<'widget' | 'points'>('widget');
  const [paymentWidget, setPaymentWidget] = React.useState<any>(null);
  const [phoneForPoints, setPhoneForPoints] = React.useState(initialPhone);
  const [existingPoints, setExistingPoints] = React.useState(0);
  const [usePoints, setUsePoints] = React.useState(0);
  const [requestCashReceipt, setRequestCashReceipt] = React.useState(false);


  const potentialPoints = Math.floor(initialTotalPrice * 0.001); // 0.1% 적립
  const finalTotalPrice = initialTotalPrice - usePoints;

  // Initialize Payment Widget with retry
  React.useEffect(() => {
    let timer: any;
    const initWidget = () => {
        if (!(window as any).loadPaymentWidget) {
            timer = setTimeout(initWidget, 100);
            return;
        }

        const clientKey = "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq";
        const customerKey = phoneForPoints || "ANONYMOUS";

        (window as any).loadPaymentWidget(clientKey, customerKey).then((widget: any) => {
            widget.renderPaymentMethods("#payment-method", { value: finalTotalPrice });
            widget.renderAgreement("#agreement");
            setPaymentWidget(widget);
        });
    };

    initWidget();
    return () => clearTimeout(timer);
  }, []);

  // Update amount when points change
  React.useEffect(() => {
    if (paymentWidget) {
        paymentWidget.updateAmount(finalTotalPrice);
    }
  }, [finalTotalPrice, paymentWidget]);

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

  const handleNextStep = () => {
    if (!paymentWidget) {
        alert("결제 시스템이 아직 준비되지 않았습니다. 잠시만 기다려 주세요.");
        return;
    }
    if (phoneForPoints.length >= 10) {
        handleCheckPoints(phoneForPoints);
    }
    setStep('points');
  };



  const executePayment = async () => {
    try {
        if (!paymentWidget) {
            alert("결제 시스템 로딩 중입니다. 잠시 후 다시 시도해 주세요.");
            setStep('widget');
            return;
        }
        
        // Debug check for method selection
        const selectedMethod = paymentWidget.getSelectedPaymentMethod();
        if (!selectedMethod) {
            alert("결제 수단을 선택해 주세요.");
            setStep('widget');
            return;
        }

        const orderId = orderNo || `ORD_${Date.now()}`;
        const orderName = `${tableNo ? 'Table ' + tableNo : '주문'} 결제`;

        await paymentWidget.requestPayment({
            orderId: orderId,
            orderName: orderName,
            successUrl: `${window.location.origin}/?payment_success=true&order_id=${orderId}&amount=${finalTotalPrice}`,
            failUrl: `${window.location.origin}/?payment_fail=true`,
            customerMobilePhone: phoneForPoints.replace(/[^0-9]/g, '')
        });
    } catch (err) {
        console.error("Payment Request Error:", err);
        alert("결제창을 여는 중 오류가 발생했습니다: " + (err as any).message);
    }
  };

  const renderWidget = () => (
    <div className="payment-modal animate-pop-in" style={{ width: '500px', background: '#fff', borderRadius: '32px', padding: '30px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
        <h2 style={{ color: '#1e293b', margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>결제 수단</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
      </header>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ color: '#64748b', fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>포인트 적립/사용 번호</label>
        <input 
            type="tel" 
            placeholder="010-0000-0000" 
            value={phoneForPoints}
            onChange={(e) => setPhoneForPoints(e.target.value)}
            style={{ 
                width: '100%', padding: '12px 15px', borderRadius: '12px', border: '1px solid #e2e8f0',
                fontSize: '1.1rem', fontWeight: '600', outline: 'none', color: '#1e293b', background: '#f8fafc'
            }}
        />
      </div>
      
      <div id="payment-method" style={{ marginBottom: '10px' }}></div>
      <div id="agreement"></div>

      <div style={{ padding: '20px', borderRadius: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontWeight: '600' }}>최종 결제 금액</span>
            <span style={{ color: '#3b82f6', fontSize: '1.5rem', fontWeight: '900' }}>{finalTotalPrice.toLocaleString()}원</span>
        </div>
      </div>

      <button 
        onClick={handleNextStep} 
        style={{ 
            width: '100%', padding: '18px', background: '#3b82f6', color: 'white', border: 'none', 
            borderRadius: '16px', fontWeight: '800', fontSize: '1.1rem', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
        }}
      >
        결제 정보 확인 및 적립
      </button>
    </div>
  );



  const renderPoints = () => (
    <div className="payment-modal animate-pop-in" style={{ width: '480px', background: '#1e293b', borderRadius: '30px', padding: '32px', border: '1px solid rgba(255,255,255,0.1)' }}>
      <h2 style={{ color: 'white', marginBottom: '24px', textAlign: 'center' }}>💰 포인트 및 최종 확인</h2>
      
      {/* 계좌 정보 안내 (필요 시 노출) */}
      {paymentWidget?.getSelectedPaymentMethod()?.method === 'TRANSFER' && (
        <div style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid var(--accent-orange)', padding: '20px', borderRadius: '20px', marginBottom: '20px' }}>
            <div style={{ color: 'var(--accent-orange)', fontSize: '0.8rem', marginBottom: '5px', fontWeight: 'bold' }}>입금 받을 매장 계좌</div>
            <div style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold' }}>{bankInfo.name} {bankInfo.account}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>예금주: {bankInfo.holder}</div>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '20px', marginBottom: '20px' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '8px' }}>포인트 적립 정보</p>
        <div style={{ fontSize: '1.2rem', color: 'white', fontWeight: 'bold', marginBottom: '10px' }}>
          {phoneForPoints || <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 'normal' }}>비회원 (포인트 미적립)</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: 'white' }}>
          <span>적립 예정: <strong style={{ color: 'var(--accent-orange)' }}>{phoneForPoints ? `+${potentialPoints.toLocaleString()}P` : '0P'}</strong></span>
          <span>현재 포인트: <strong>{phoneForPoints ? `${existingPoints.toLocaleString()}P` : '0P'}</strong></span>
        </div>
        {existingPoints >= 10000 && (
          <button onClick={() => setUsePoints(usePoints === 0 ? existingPoints : 0)} style={{ width: '100%', marginTop: '15px', padding: '12px', background: usePoints > 0 ? 'var(--accent-orange)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>
            {usePoints > 0 ? `사용 취소 (-${usePoints.toLocaleString()}원)` : `${existingPoints.toLocaleString()}P 전액 사용하기`}
          </button>
        )}
      </div>

      {(paymentWidget?.getSelectedPaymentMethod()?.method === 'TRANSFER' || paymentWidget?.getSelectedPaymentMethod()?.method === 'CASH') && (
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
        <button onClick={() => setStep('widget')} style={{ flex: 1, padding: '18px', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '15px', fontWeight: 'bold' }}>뒤로</button>
        <button onClick={executePayment} style={{ flex: 2, padding: '18px', background: 'var(--accent-orange)', color: 'white', border: 'none', borderRadius: '15px', fontSize: '1.2rem', fontWeight: 'bold' }}>{finalTotalPrice.toLocaleString()}원 결제하기</button>
      </div>
    </div>
  );

  return (
    <div className="payment-modal-overlay" style={{ zIndex: 4000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
      {/* Widget container - always in DOM, hide with opacity/off-screen to avoid SDK issues */}
      <div style={{ 
          opacity: step === 'widget' ? 1 : 0, 
          pointerEvents: step === 'widget' ? 'auto' : 'none',
          position: step === 'widget' ? 'relative' : 'absolute',
          left: step === 'widget' ? '0' : '-9999px',
          zIndex: step === 'widget' ? 1 : -1
      }}>
        {renderWidget()}
      </div>

      {/* Points container */}
      <div style={{ 
          display: step === 'points' ? 'block' : 'none',
          zIndex: step === 'points' ? 2 : -1
      }}>
        {renderPoints()}
      </div>
    </div>
  );
};
