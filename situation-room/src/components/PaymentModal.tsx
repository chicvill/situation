import React from 'react'; // Git Force Trigger: 2026-05-04 23:27
import type { BundleData } from '../types';
import { API_BASE } from '../config';
import { subscribeTopic } from '../services/mqttClient';
import { formatPhone } from '../utils/formatters';
import { PaymentService } from '../services/paymentService';

interface PaymentModalProps {
  totalPrice: number;
  onClose: () => void;
  onSubmit: (method: string, extraData?: any) => void | Promise<void>;
  isCounter?: boolean;
  prepaidMethod?: string | null;
  bundles?: BundleData[];
  initialPhone?: string;
  onPhoneChange?: (val: string) => void;
  onPayerInfo?: (phone: string, topPercentAccumulated: number) => void;
  cart?: any[];
  sessionId?: string;
  storeId?: string;
  tableId?: string;
}

type Step = 'select' | 'points' | 'dutch_qr';
type Method = { id: string; icon: string; name: string; desc: string; color: string; };
const METHODS: Method[] = [
  { id: 'card',          icon: '💳', name: '신용카드 / 페이 결제', desc: '삼성페이, 애플페이, 토스페이 등',   color: '#3b82f6' },
  { id: 'qrpay',         icon: '📱', name: '테이블 QR 결제',       desc: '카카오페이, 네이버페이, 제로페이 스캔', color: '#10b981' },
  { id: 'transfer',      icon: '🏦', name: '간편 계좌이체',         desc: '매장 계좌로 실시간 1초 이체',        color: '#8b5cf6' },
  { id: 'staff_nfc',     icon: '📲', name: '실물카드 결제 (직원호출)', desc: '직원이 결제 단말기를 들고 테이블로 이동', color: '#ec4899' },
  { id: 'test',          icon: '⚡', name: '가상 결제 (테스트)',     desc: '실결제 없이 즉시 결제 완료 처리',    color: '#f59e0b' },
];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  totalPrice, onClose, onSubmit,
  isCounter,
  bundles,
  initialPhone = '', onPhoneChange, onPayerInfo,
  cart,
  sessionId,
  storeId,
  tableId,
}) => {
  const [step, setStep] = React.useState<Step>('select');
  if (typeof isCounter === 'boolean') {
    // safe reference to bypass unused prop lint
  }
  const [selectedMethod, setSelectedMethod] = React.useState<Method | null>(null);
  const [phoneForPoints, setPhoneForPoints] = React.useState(initialPhone);
  const [existingPoints, setExistingPoints] = React.useState(0);
  const [accumulatedPoints, setAccumulatedPoints] = React.useState(0);
  const [topPercentAccumulated, setTopPercentAccumulated] = React.useState(100);
  const [usePoints, setUsePoints] = React.useState(0);
  const [requestCashReceipt, setRequestCashReceipt] = React.useState(false);
  const [accumulatePoints, setAccumulatePoints] = React.useState(!!initialPhone);
  const [isTakeout, setIsTakeout] = React.useState(false);
  const [dutchPayerCount, setDutchPayerCount] = React.useState(2);

  // Dutch pay states
  const [dutchProgress, setDutchProgress] = React.useState<any>(null);
  const [isInitiatingDutch, setIsInitiatingDutch] = React.useState(false);
  const [useDutchSetting, setUseDutchSetting] = React.useState(true);

  const resolvedSessionId = sessionId || localStorage.getItem('mqnet_session_id') || '';
  const resolvedStoreId = storeId || 'store-chicvill';
  const resolvedTableId = tableId || 'T03';

  React.useEffect(() => {
    if (!resolvedStoreId) return;
    fetch(`${API_BASE}/api/stores/${resolvedStoreId}/settings`)
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('settings fetch fail');
      })
      .then(d => {
        setUseDutchSetting(d.use_dutch ?? true);
      })
      .catch(err => {
        console.error('Failed to load store settings in PaymentModal:', err);
      });
  }, [resolvedStoreId]);

  // Dutch pay real-time subscription & polling
  React.useEffect(() => {
    if (step !== 'dutch_qr' || !resolvedSessionId) return;

    const fetchSplits = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/dutch/${resolvedSessionId}`);
        if (res.ok) {
          const data = await res.json();
          setDutchProgress(data.splits);
          if (data.splits && data.splits.paid_items) {
            const paid = data.splits.paid_items.reduce((sum: number, item: any) => sum + item.amount, 0);
            if (paid >= data.splits.total_price && data.splits.total_price > 0) {
              alert('더치페이 정산이 완료되어 주문이 카운터로 접수되었습니다! 🎉');
              onClose();
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch splits:', err);
      }
    };

    fetchSplits();
    const pollInterval = setInterval(fetchSplits, 3000);

    const topic = `store/${resolvedStoreId}/table/${resolvedTableId}`;
    let unsub: (() => void) | null = null;
    try {
      unsub = subscribeTopic(topic, (msg: any) => {
        if (msg.type === 'DUTCH_PAYMENT_UPDATE' && msg.session_id === resolvedSessionId) {
          setDutchProgress(msg.splits);
          if (msg.is_completed) {
            alert('더치페이 정산이 완료되어 주문이 카운터로 접수되었습니다! 🎉');
            onClose();
          }
        } else if (msg.type === 'DUTCH_COMPLETED' && msg.session_id === resolvedSessionId) {
          alert('더치페이 정산이 완료되어 주문이 카운터로 접수되었습니다! 🎉');
          onClose();
        }
      });
    } catch (err) {
      console.error('MQTT subscribe error in PaymentModal:', err);
    }

    return () => {
      clearInterval(pollInterval);
      if (unsub) unsub();
    };
  }, [step, resolvedSessionId, resolvedStoreId, resolvedTableId, onClose]);

  // Window message listener for Toss success popup
  React.useEffect(() => {
    const handleMessage = async (e: MessageEvent) => {
      if (e.data && e.data.type === 'PAYMENT_FINISHED') {
        const { orderId, success } = e.data;
        if (success && orderId && orderId.startsWith('dutch_')) {
          // Refresh splits state immediately
          if (resolvedSessionId) {
            try {
              const res = await fetch(`${API_BASE}/api/dutch/${resolvedSessionId}`);
              if (res.ok) {
                const data = await res.json();
                setDutchProgress(data.splits);
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [resolvedSessionId]);


  const finalTotal = totalPrice - usePoints;
  const potentialPoints = Math.floor(totalPrice * 0.001);

  // 매장 계좌 정보
  const storeBundle = bundles?.find(b => b.type === 'StoreConfig');
  const bankInfo = {
    name:    storeBundle?.items?.find(i => i.name === '은행명')?.value    || '국민은행',
    account: storeBundle?.items?.find(i => i.name === '계좌번호')?.value  || '123-456789-01-012',
    holder:  storeBundle?.items?.find(i => i.name === '예금주')?.value    || '매장',
  };

  // 부모 동기화
  React.useEffect(() => {
    if (onPhoneChange) onPhoneChange(phoneForPoints);
  }, [phoneForPoints, onPhoneChange]);

  const lookupPoints = async (phone: string) => {
    if (phone.length < 10) return;
    try {
      const apiUrl = API_BASE;
      const res = await fetch(`${apiUrl}/api/points/${phone}`);
      const data = await res.json();
      const usable = data.usable_points ?? data.points ?? 0;
      const accumulated = data.accumulated_points ?? 0;
      const topPct = data.top_percent_accumulated ?? 100;
      setExistingPoints(usable);
      setAccumulatedPoints(accumulated);
      setTopPercentAccumulated(topPct);
      if (onPayerInfo) onPayerInfo(phone, topPct);
    } catch {
      setExistingPoints(0);
      setAccumulatedPoints(0);
      setTopPercentAccumulated(100);
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
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <h2 style={{ color:'var(--text-main)', margin:0, fontSize:'1.2rem', fontWeight:700 }}>결제 방법 선택</h2>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'1.5rem', cursor:'pointer', lineHeight:1 }}>×</button>
      </div>

      {/* 상단 주문 내역 확인 영역 */}
      {cart && cart.length > 0 && (
        <div style={{ 
          marginBottom: '20px', padding: '12px 16px', background: 'var(--bg-main)', 
          borderRadius: '12px', border: '1px solid var(--border)' 
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>📋 주문 내역 상세</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '90px', overflowY: 'auto' }}>
            {cart.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                <span style={{ fontWeight: 600 }}>{item.name} <span style={{ color: 'var(--text-muted)' }}>×{item.qty || item.quantity || 1}</span></span>
                <span style={{ fontWeight: 700 }}>{((item.price || 0) * (item.qty || item.quantity || 1)).toLocaleString()}원</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* N분의 1 더치페이 풀다운 및 할당액 계산기 */}
      {useDutchSetting && (
        <div style={{ 
          marginBottom: '20px', padding: '14px 16px', background: 'rgba(99,102,241,0.05)', 
          borderRadius: '14px', border: '1.5px solid rgba(99,102,241,0.12)',
          display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🤝 N분의 1 더치페이 계산
            </span>
            <select 
              value={dutchPayerCount} 
              onChange={(e) => setDutchPayerCount(parseInt(e.target.value))}
              style={{
                padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(99,102,241,0.25)',
                background: 'white', color: '#4f46e5', fontWeight: 800, fontSize: '0.8rem', outline: 'none'
              }}
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <option key={num} value={num}>{num}명 분할</option>
              ))}
            </select>
          </div>
          {dutchPayerCount > 1 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed rgba(99,102,241,0.15)', paddingTop: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>1인당 부담 금액</span>
                <span style={{ fontSize: '1rem', fontWeight: 900, color: '#4f46e5' }}>
                  {Math.ceil(totalPrice / dutchPayerCount).toLocaleString()}원
                </span>
              </div>
              <button
                onClick={async () => {
                  if (!resolvedSessionId) {
                    alert('더치페이를 시작하려면 세션 정보가 필요합니다.');
                    return;
                  }
                  setIsInitiatingDutch(true);
                  try {
                    const res = await fetch(`${API_BASE}/api/dutch/create`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        session_id: resolvedSessionId,
                        total_price: totalPrice,
                        split_count: dutchPayerCount
                      })
                    });
                    if (res.ok) {
                      setStep('dutch_qr');
                    } else {
                      alert('더치페이 세션 생성에 실패했습니다.');
                    }
                  } catch (err) {
                    console.error(err);
                    alert('더치페이 요청 중 네트워크 오류가 발생했습니다.');
                  } finally {
                    setIsInitiatingDutch(false);
                  }
                }}
                disabled={isInitiatingDutch}
                style={{
                  marginTop: '10px', width: '100%', padding: '12px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white',
                  border: 'none', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)', transition: 'all 0.2s'
                }}
              >
                {isInitiatingDutch ? '⏳ 설정 중...' : '🤝 일행과 나누어 결제하기 (QR 현황판 열기)'}
              </button>
            </>
          )}
        </div>
      )}

      {/* 포장 / 매장 선택 토글 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ color:'var(--text-muted)', fontSize:'0.75rem', fontWeight:600, marginBottom:'10px' }}>주문 유형을 선택해 주세요</div>
        <div style={{ display:'flex', gap:'10px' }}>
          {[{ val: false, icon: '🍽️', label: '매장에서' }, { val: true, icon: '📦', label: '포장' }].map(opt => (
            <button
              key={String(opt.val)}
              onClick={() => setIsTakeout(opt.val)}
              style={{
                flex: 1, padding: '14px 10px', borderRadius: '14px', cursor: 'pointer',
                border: isTakeout === opt.val ? '2px solid var(--accent-orange)' : '2px solid var(--border)',
                background: isTakeout === opt.val ? 'rgba(249,115,22,0.08)' : 'transparent',
                fontWeight: 700, fontSize: '0.95rem',
                color: isTakeout === opt.val ? 'var(--accent-orange)' : 'var(--text-muted)',
                transition: 'all 0.18s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px'
              }}
            >
              <span style={{ fontSize: '1.6rem' }}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
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
        <div style={{ height: '20px' }}></div>
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
                  const formatted = formatPhone(e.target.value);
                  setPhoneForPoints(formatted);
                  const clean = formatted.replace(/[^0-9]/g, '');
                  if (clean.length >= 10) lookupPoints(clean);
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
              display:'flex', flexDirection: 'column', gap: '10px', padding: '15px',
              background: 'white', borderRadius: '12px', border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>사용 가능</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>{existingPoints.toLocaleString()} P</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>누적 합계</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#8b5cf6' }}>{accumulatedPoints.toLocaleString()} P</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>적립 예정</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-orange)' }}>+{potentialPoints.toLocaleString()} P</span>
                </div>
              </div>
              {accumulatedPoints > 0 && (
                <div style={{
                  textAlign: 'center', padding: '6px 12px', borderRadius: '8px',
                  background: topPercentAccumulated <= 10 ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : 'rgba(0,0,0,0.03)',
                  border: topPercentAccumulated <= 10 ? '1px solid #f59e0b' : '1px solid var(--border)',
                  fontSize: '0.8rem', fontWeight: 700,
                  color: topPercentAccumulated <= 10 ? '#92400e' : 'var(--text-muted)'
                }}>
                  {topPercentAccumulated <= 10 ? `👑 VIP 단골 고객 — 상위 ${topPercentAccumulated}%` : `상위 ${topPercentAccumulated}% 고객`}
                </div>
              )}
            </div>

            {existingPoints > 0 ? (
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
                {usePoints > 0 ? `사용 취소 (-${usePoints.toLocaleString()}원)` : `보유 포인트 전액 사용하기`}
              </button>
            ) : (
              <div style={{ padding: '12px', textAlign: 'center', background: 'rgba(0,0,0,0.03)', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                💡 적립된 포인트가 없습니다.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 현금영수증 (현금/계좌이체/직원호출) */}
      {(selectedMethod?.id === 'cash' || selectedMethod?.id === 'transfer' || selectedMethod?.id === 'staff_nfc') && (
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

        {/* 선결제 취소 불가 경고 */}
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '12px',
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
          display: 'flex', alignItems: 'flex-start', gap: '8px'
        }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
          <span style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, lineHeight: 1.5 }}>
            선결제 완료 후에는 주문 취소가 불가능하오니 신중하게 선택해 주세요.
          </span>
        </div>

        <button
          onClick={async () => {
            try {
              await onSubmit(selectedMethod?.name || '기타', { phone: phoneForPoints, usePoints, isTakeout, requestCashReceipt });
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
      <div style={{ height: '30px' }}></div>
    </div>
  );

  // ════════════════════════════════════════
  //  STEP 3 : N분의 1 분할 더치페이 실시간 QR 현황판
  // ════════════════════════════════════════
  const renderDutchQr = () => {
    const total = dutchProgress?.total_price || totalPrice;
    const count = dutchProgress?.split_count || dutchPayerCount;
    const splitAmount = dutchProgress?.split_amount || Math.ceil(total / count);
    const paidItems = dutchProgress?.paid_items || [];
    const totalPaid = paidItems.reduce((sum: number, item: any) => sum + item.amount, 0);
    const remaining = Math.max(0, total - totalPaid);
    const pct = total > 0 ? Math.min(100, (totalPaid / total) * 100) : 0;

    const landingUrl = `${window.location.origin}/?dutch_session_id=${resolvedSessionId}&store_id=${resolvedStoreId}&table_id=${resolvedTableId}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(landingUrl)}`;

    return (
      <div style={{
        width: '90vw', maxWidth: '420px', background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)', padding: '28px', border: '1px solid var(--border)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.1)', textAlign: 'center',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>🤝 실시간 N분의 1 더치페이</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* QR 설명 */}
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.4 }}>
          동행자가 아래 **QR 코드**를 스캔하면 각자의 휴대폰으로 분할 결제 화면에 랜딩됩니다.
        </p>

        {/* QR 이미지 컨테이너 */}
        <div style={{
          display: 'inline-block', padding: '16px', background: 'white',
          borderRadius: '20px', border: '1px solid var(--border)', marginBottom: '20px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.06)'
        }}>
          <img src={qrCodeUrl} alt="더치페이 결제 QR" style={{ width: '220px', height: '220px', display: 'block' }} />
        </div>

        {/* 1인 분할 금액 & 잔액 정보 */}
        <div style={{
          background: 'rgba(99,102,241,0.05)', borderRadius: '16px', padding: '16px',
          border: '1.5px solid rgba(99,102,241,0.12)', marginBottom: '20px',
          display: 'flex', flexDirection: 'column', gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>정산 인원</span>
            <span style={{ fontWeight: 800 }}>{count}명</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-main)' }}>
            <span style={{ fontWeight: 600 }}>1인당 정산액</span>
            <span style={{ fontWeight: 800, color: '#4f46e5' }}>{splitAmount.toLocaleString()}원</span>
          </div>
          <div style={{ borderTop: '1px dashed rgba(99,102,241,0.15)', marginTop: '4px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>남은 결제 잔액</span>
            <span style={{ fontWeight: 900, color: 'var(--accent-orange)' }}>{remaining.toLocaleString()}원</span>
          </div>
        </div>

        {/* 실시간 정산 진행률 바 */}
        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
            <span>정산 진행률</span>
            <span>{Math.round(pct)}% ({totalPaid.toLocaleString()} / {total.toLocaleString()}원)</span>
          </div>
          <div style={{ width: '100%', height: '14px', background: 'var(--bg-main)', borderRadius: '7px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: 'linear-gradient(90deg, #f97316, #4f46e5)',
              borderRadius: '7px', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}></div>
          </div>
        </div>

        {/* 결제 완료 목록 */}
        <div style={{ marginBottom: '24px', textAlign: 'left' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            📢 실시간 결제 현황 ({paidItems.length}건 완료)
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '100px', overflowY: 'auto' }}>
            {paidItems.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '10px', textAlign: 'center', background: 'var(--bg-main)', borderRadius: '8px' }}>
                아직 결제 완료된 건이 없습니다.
              </div>
            ) : (
              paidItems.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px', fontSize: '0.8rem' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>✔️ {idx + 1}번째 결제 완료</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>{item.amount.toLocaleString()}원</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 직접 결제 버튼 */}
        <button
          onClick={async () => {
            try {
              const orderId = `dutch_${resolvedSessionId}_${Date.now()}`;
              await PaymentService.requestPayAppPayment('카드', {
                amount: splitAmount,
                orderId,
                orderName: `더치페이 분할 결제 (${resolvedTableId})`,
                customerName: '주문 대표자'
              });
            } catch (err: any) {
              alert(err.message || '결제창 호출에 실패했습니다.');
            }
          }}
          disabled={remaining <= 0}
          style={{
            width: '100%', padding: '16px', background: 'var(--primary)', color: 'white',
            border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 800,
            cursor: 'pointer', boxShadow: '0 6px 20px rgba(30, 41, 59, 0.15)', marginBottom: '10px'
          }}
        >
          💳 내 분할액({splitAmount.toLocaleString()}원) 직접 결제하기
        </button>

        <button
          onClick={() => setStep('select')}
          style={{
            width: '100%', padding: '12px', background: 'transparent', color: 'var(--text-muted)',
            border: '1px solid var(--border)', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          ❮ 결제 방법 선택으로 돌아가기
        </button>
      </div>
    );
  };

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:4000,
      background:'rgba(0,0,0,0.85)', backdropFilter:'blur(10px)',
      padding: '40px 20px', display:'flex', flexDirection: 'column', alignItems:'center',
      overflowY: 'auto'
    }}>
      <div className="animate-pop-in" style={{ 
        width: '100%', maxWidth: '420px', borderRadius: 'var(--radius-lg)',
        flexShrink: 0, margin: 'auto 0'
      }}>
        {step === 'select' && renderSelect()}
        {step === 'points' && renderPoints()}
        {step === 'dutch_qr' && renderDutchQr()}
      </div>
    </div>
  );
};
