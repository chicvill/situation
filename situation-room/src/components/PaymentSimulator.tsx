import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../config';

interface LogEntry {
  time: string;
  type: 'info' | 'api' | 'success' | 'event' | 'error';
  message: string;
  details?: any;
}

export const PaymentSimulator = ({ storeId = 'default_store' }: { storeId?: string, bundles?: any[] }) => {
  const [activeScenario, setActiveScenario] = useState<'pg' | 'dutch' | 'nfc' | 'cash'>('pg');
  const [currentStep, setCurrentStep] = useState(1);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // 시뮬레이션용 가상 테이블 매핑
  const scenarioTables = {
    pg: 'T88',
    dutch: 'T89',
    nfc: 'T90',
    cash: 'T91',
  };

  const activeTable = scenarioTables[activeScenario];
  const effectiveStoreId = storeId === 'Total' ? 'default_store' : storeId;

  // 로그 추가 함수
  const addLog = (type: LogEntry['type'], message: string, details?: any) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, type, message, details }]);
  };

  // 로그 터미널 스크롤 제어
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 테이블 세션 조회
  const fetchSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/session/${activeTable}?store_id=${effectiveStoreId}`);
      if (res.ok) {
        const data = await res.json();
        setSessionData(data.session || null);
      }
    } catch (err: any) {
      console.error('Error fetching session:', err);
    }
  };

  // 시뮬레이션 변경 시 로그 초기화 및 세션 로드
  useEffect(() => {
    setLogs([]);
    setCurrentStep(1);
    setSessionData(null);
    addLog('info', `[시나리오 변경] ${activeScenario.toUpperCase()} 시나리오가 선택되었습니다. 테이블: ${activeTable}`);
    fetchSession();
  }, [activeScenario]);

  // 주기적으로 세션 데이터 갱신
  useEffect(() => {
    const timer = setInterval(() => {
      fetchSession();
    }, 2500);
    return () => clearInterval(timer);
  }, [activeScenario]);

  // 테스트 테이블 초기화 API 호출
  const handleResetTables = async () => {
    setLoading(true);
    try {
      addLog('info', '테스트 테이블 세션 및 주문 초기화를 요청 중입니다...');
      const res = await fetch(`${API_BASE}/api/debug/reset-test`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        addLog('success', '테스트 테이블이 성공적으로 초기화되었습니다.', data);
        setCurrentStep(1);
        fetchSession();
      } else {
        throw new Error('초기화 실패');
      }
    } catch (err: any) {
      addLog('error', '테이블 초기화 도중 에러가 발생했습니다.', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- API 모의 호출 헬퍼 ---

  // 1. 주문 전송 API (/api/order/direct)
  const placeOrder = async (items: any[], paymentMethod: string, paymentStatus: string, phone?: string, usePoints?: number) => {
    const total_price = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderPayload = {
      store_id: effectiveStoreId,
      table_id: activeTable,
      device_id: 'simulator_device',
      items,
      total_price,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      metadata: phone ? { phone, usePoints: usePoints || 0, requestCashReceipt: !!phone } : {},
      join_order: false
    };

    addLog('api', `POST /api/order/direct 호출`, orderPayload);

    const res = await fetch(`${API_BASE}/api/order/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`주문 전송 실패: ${errTxt}`);
    }

    const data = await res.json();
    addLog('success', `주문이 저장되었습니다. ID: ${data.order_id}`, data);
    await fetchSession();
    return data;
  };

  // 2. 페이앱 Webhook 피드백 모의 전송 (/api/payment/payapp/feedback)
  const triggerPayAppWebhook = async (orderId: string, price: number) => {
    const formData = new URLSearchParams();
    formData.append('userid', 'payapp_test_id'); // 테스트 가맹점 ID (인증 우회)
    formData.append('price', String(price));
    formData.append('pay_state', '4'); // 결제 승인 완료 상태 코드
    formData.append('var1', orderId); // 가맹점 주문참조 ID
    formData.append('mul_no', `MOCK-TX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`);

    addLog('api', `POST /api/payment/payapp/feedback (Webhook 시뮬레이션)`, Object.fromEntries(formData.entries()));

    const res = await fetch(`${API_BASE}/api/payment/payapp/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    const resultText = await res.text();
    addLog('success', `페이앱 웹훅 처리 완료. 반환값: ${resultText}`);
    await fetchSession();
    return resultText;
  };

  // 3. 더치페이 생성 API (/api/dutch/create)
  const createDutchPay = async (sessionId: string) => {
    addLog('api', `POST /api/dutch/create 호출. Session: ${sessionId}`);
    const res = await fetch(`${API_BASE}/api/dutch/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId })
    });
    if (!res.ok) throw new Error('더치페이 초기화 실패');
    const data = await res.json();
    addLog('success', '더치페이 분할 결제가 초기화되었습니다.', data);
    await fetchSession();
    return data;
  };

  // 4. 수동 승인/결제 완료 처리 (점장 POS 수동 승인)
  const manualCompletePayment = async (orderId: string) => {
    addLog('api', `POST /api/payment/confirm 호출 (수동 승인 대행)`, { orderId });
    const res = await fetch(`${API_BASE}/api/payment/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        amount: sessionData?.orders?.find((o: any) => o.order_id === orderId)?.total_price || 0,
        paymentKey: 'mock_manual_approval'
      })
    });
    if (!res.ok) throw new Error('수동 승인 실패');
    const data = await res.json();
    addLog('success', '결제가 수동 승인 완료되었습니다.', data);
    await fetchSession();
    return data;
  };

  // --- 시나리오별 단계적 제어 ---

  // 시나리오 1: N차 주문 및 신용카드 온라인 결제
  const runPgScenarioStep = async (step: number) => {
    setLoading(true);
    try {
      if (step === 1) {
        addLog('info', '1단계: T88 테이블에 1차 주문(에스프레소, 크루아상)을 전송합니다. 결제 수단: 카드(선결제)');
        // 선결제이므로 payment_status를 pending으로 보냄
        await placeOrder([
          { name: '에스프레소', price: 4500, quantity: 1 },
          { name: '크루아상', price: 4000, quantity: 2 }
        ], '카드 결제', 'pending');
        setCurrentStep(2);
      } 
      else if (step === 2) {
        addLog('info', '2단계: 동일한 세션에 2차 추가 주문(아이스 아메리카노)을 전송합니다. 결제 수단: 카드(선결제)');
        await placeOrder([
          { name: '아이스 아메리카노', price: 5000, quantity: 1 }
        ], '카드 결제', 'pending');
        setCurrentStep(3);
      } 
      else if (step === 3) {
        addLog('info', '3단계: 1차 주문 건에 대해 PG 결제 완료 웹훅 수신을 모의 실행합니다.');
        const pendingOrder = sessionData?.orders?.find((o: any) => o.payment_status === 'pending');
        if (!pendingOrder) {
          addLog('error', '대기 중인 주문을 찾을 수 없습니다. 1단계를 다시 실행하세요.');
          return;
        }
        await triggerPayAppWebhook(pendingOrder.order_id, pendingOrder.total_price);
        setCurrentStep(4);
      }
      else if (step === 4) {
        addLog('info', '4단계: 2차 주문 건에 대해서도 PG 결제 웹훅 수신을 모의 실행합니다.');
        const pendingOrder = sessionData?.orders?.find((o: any) => o.payment_status === 'pending');
        if (!pendingOrder) {
          addLog('success', '모든 주문이 이미 결제 완료 상태입니다!');
          setCurrentStep(5);
          return;
        }
        await triggerPayAppWebhook(pendingOrder.order_id, pendingOrder.total_price);
        addLog('success', '시나리오 1 완료! N차 추가 주문 및 PG 웹훅 승인이 전과정 연동되었습니다.');
        setCurrentStep(5);
      }
    } catch (err: any) {
      addLog('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 시나리오 2: 합석 및 더치페이 분할 결제
  const runDutchScenarioStep = async (step: number) => {
    setLoading(true);
    try {
      if (step === 1) {
        addLog('info', '1단계: T89 테이블에 Customer A의 주문(치즈케이크 2개 - 14,000원)을 전송합니다.');
        await placeOrder([
          { name: '치즈케이크', price: 7000, quantity: 2 }
        ], '더치페이', 'unpaid');
        setCurrentStep(2);
      }
      else if (step === 2) {
        addLog('info', '2단계: 동일한 T89 세션에 Customer B가 합류하여 음료(자몽에이드 1개 - 6,000원)를 추가 주문합니다.');
        // 합석 주문 시뮬레이션
        await placeOrder([
          { name: '자몽에이드', price: 6000, quantity: 1 }
        ], '더치페이', 'unpaid');
        setCurrentStep(3);
      }
      else if (step === 3) {
        addLog('info', '3단계: 점주/고객이 더치페이 분할 계산(2분의 1)을 활성화합니다.');
        if (!sessionData?.session_id) {
          addLog('error', '활성화된 테이블 세션이 없습니다.');
          return;
        }
        await createDutchPay(sessionData.session_id);
        setCurrentStep(4);
      }
      else if (step === 4) {
        addLog('info', '4단계: Customer A가 자신의 몫(10,000원)을 카드 결제 완료(PG Webhook)합니다.');
        const dutchOrderId = `dutch_${sessionData?.session_id}`;
        await triggerPayAppWebhook(dutchOrderId, 10000);
        setCurrentStep(5);
      }
      else if (step === 5) {
        addLog('info', '5단계: Customer B가 남은 몫(10,000원)을 마저 결제(PG Webhook)하여 더치페이를 마칩니다.');
        const dutchOrderId = `dutch_${sessionData?.session_id}`;
        await triggerPayAppWebhook(dutchOrderId, 10000);
        addLog('success', '시나리오 2 완료! 합석 및 분할 결제 완결 시점에 테이블 전체 주문이 일괄 paid 상태로 승격되었습니다.');
        setCurrentStep(6);
      }
    } catch (err: any) {
      addLog('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 시나리오 3: 직원호출 실물카드 결제 & App-to-App
  const runNfcScenarioStep = async (step: number) => {
    setLoading(true);
    try {
      if (step === 1) {
        addLog('info', '1단계: T90 테이블에서 손님이 [실물카드 결제 (직원호출)]을 선택하고 주문을 보냅니다.');
        await placeOrder([
          { name: '크로플', price: 6500, quantity: 1 },
          { name: '아인슈페너', price: 6000, quantity: 1 }
        ], '실물카드 결제 (직원호출)', 'unpaid');
        setCurrentStep(2);
      }
      else if (step === 2) {
        addLog('info', '2단계: 직원이 스마트폰으로 테이블에 방문하여 PayApp App-to-App 태깅 결제를 시작합니다. (태깅 완료 통보 모의)');
        const unpaidOrder = sessionData?.orders?.find((o: any) => o.payment_status === 'unpaid');
        if (!unpaidOrder) {
          addLog('error', '결제할 주문을 찾지 못했습니다.');
          return;
        }
        // App-to-App 실행 후 결제가 완료되면 페이앱 피드백 웹훅이 수신됩니다.
        await triggerPayAppWebhook(unpaidOrder.order_id, unpaidOrder.total_price);
        addLog('success', '시나리오 3 완료! 실물카드 결제 요청 -> 카운터/스태프 호출 점멸 -> 페이앱 태깅 완료가 실시간 처리되었습니다.');
        setCurrentStep(3);
      }
    } catch (err: any) {
      addLog('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 시나리오 4: 현금/계좌이체 및 포인트 적립 + 현금영수증 자동 발행
  const runCashScenarioStep = async (step: number) => {
    setLoading(true);
    try {
      if (step === 1) {
        addLog('info', '1단계: T91 테이블 손님이 포인트 적립용 번호(010-9999-8888)를 입력하고, 현금 결제 + 현금영수증 발행을 신청합니다.');
        await placeOrder([
          { name: '까페라떼', price: 5000, quantity: 2 },
          { name: '초코칩 쿠키', price: 3000, quantity: 1 }
        ], '현금 결제', 'unpaid', '010-9999-8888');
        setCurrentStep(2);
      }
      else if (step === 2) {
        addLog('info', '2단계: 직원이 카운터포스에서 현금 수납 완료를 누릅니다. (수동 승인 버튼 클릭)');
        const unpaidOrder = sessionData?.orders?.find((o: any) => o.payment_status === 'unpaid');
        if (!unpaidOrder) {
          addLog('error', '수납할 현금 주문 건이 없습니다.');
          return;
        }
        await manualCompletePayment(unpaidOrder.order_id);
        addLog('info', '현금영수증 발행 트리거 완료! 백엔드가 페이앱 oapi에 cashStRegist 커맨드를 비동기로 발송합니다.');
        addLog('success', '시나리오 4 완료! 현금 결제 승인과 동시에 단골 포인트가 10P 적립되었으며 현금영수증 발행도 동시 트리거되었습니다.');
        setCurrentStep(3);
      }
    } catch (err: any) {
      addLog('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 단계 초기화
  const resetSteps = () => {
    setCurrentStep(1);
    addLog('info', '단계를 1단계로 재설정했습니다.');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', color: '#f8fafc' }}>
      
      {/* 1. 상단 타이틀 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '2.2rem' }}>🎭</span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, background: 'linear-gradient(to right, #ec4899, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              결제 시나리오 통합 시뮬레이터
            </h1>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0' }}>
            실제 백엔드 API와 DB 트랜잭션, Webhook 파이프라인을 그대로 작동하여 결제 전과정을 모의 시연합니다.
          </p>
        </div>

        <button 
          onClick={handleResetTables} 
          disabled={loading}
          style={{
            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171', padding: '10px 18px', borderRadius: '12px',
            fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          🧹 테스트 세션/주문 전체 초기화
        </button>
      </div>

      {/* 2. 메인 시뮬레이션 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* 왼쪽: 컨트롤러 및 프리셋 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 시나리오 프리셋 선택 */}
          <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 12px' }}>테스트 시나리오 선택</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { id: 'pg', label: '💳 N차 주문 + PG 직접 결제', icon: '⚡' },
                { id: 'dutch', label: '👥 합석 + 더치페이 분할', icon: '🔗' },
                { id: 'nfc', label: '📲 직원호출 실물카드 결제', icon: '📱' },
                { id: 'cash', label: '💵 현금 + 영수증 + 포인트', icon: '💵' },
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveScenario(s.id as any)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '12px', borderRadius: '10px',
                    border: activeScenario === s.id ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.05)',
                    background: activeScenario === s.id ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                    color: activeScenario === s.id ? '#60a5fa' : '#cbd5e1',
                    fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 시나리오 단계 제어 */}
          <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>시나리오 제어</h3>
              <button onClick={resetSteps} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}>
                처음부터
              </button>
            </div>

            {/* 현재 시나리오별 스텝 정보 및 버튼 */}
            {activeScenario === 'pg' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  <strong>[시나리오 1] N차 추가 주문 + PG</strong><br />
                  장바구니에 음식을 담고 1차 선결제 완료 전 추가 주문을 넣어 합산한 뒤, 결제를 승인하는 PG 결제 라이프사이클을 테스트합니다.
                </div>
                
                <div style={{ marginTop: '6px' }}>
                  {currentStep === 1 && (
                    <button onClick={() => runPgScenarioStep(1)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      🚀 1단계: 1차 주문 생성 (unpaid)
                    </button>
                  )}
                  {currentStep === 2 && (
                    <button onClick={() => runPgScenarioStep(2)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#ec4899', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      🔄 2단계: 2차 추가 주문 (unpaid)
                    </button>
                  )}
                  {currentStep === 3 && (
                    <button onClick={() => runPgScenarioStep(3)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      🔗 3단계: 1차 주문 웹훅 결제 승인
                    </button>
                  )}
                  {currentStep === 4 && (
                    <button onClick={() => runPgScenarioStep(4)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      🔗 4단계: 2차 주문 웹훅 결제 승인
                    </button>
                  )}
                  {currentStep >= 5 && (
                    <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700 }}>
                      🎉 시나리오 시연 성공!
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeScenario === 'dutch' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  <strong>[시나리오 2] 합석 + 더치페이</strong><br />
                  각자 테이블에 앉아 주문한 공용 세션을 생성하고, N분의 1로 쪼개어 마지막 구성원이 결제를 완료할 때까지 상태를 추적합니다.
                </div>
                
                <div style={{ marginTop: '6px' }}>
                  {currentStep === 1 && (
                    <button onClick={() => runDutchScenarioStep(1)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      🚀 1단계: Customer A 주문 전송
                    </button>
                  )}
                  {currentStep === 2 && (
                    <button onClick={() => runDutchScenarioStep(2)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#a78bfa', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      👥 2단계: Customer B 합석 및 추가 주문
                    </button>
                  )}
                  {currentStep === 3 && (
                    <button onClick={() => runDutchScenarioStep(3)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#38bdf8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      ⚖️ 3단계: 더치페이(N분의 1) 활성화
                    </button>
                  )}
                  {currentStep === 4 && (
                    <button onClick={() => runDutchScenarioStep(4)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#f43f5e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      💳 4단계: A의 몫 1만원 승인
                    </button>
                  )}
                  {currentStep === 5 && (
                    <button onClick={() => runDutchScenarioStep(5)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      💳 5단계: B의 몫 1만원 승인 (최종)
                    </button>
                  )}
                  {currentStep >= 6 && (
                    <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700 }}>
                      🎉 시나리오 시연 성공!
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeScenario === 'nfc' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  <strong>[시나리오 3] 직원호출 실물카드</strong><br />
                  고객 기기에서 직원호출 실물카드 결제를 선택하면, 주방 알림이 울리고 직원이 PDA에서 원터치로 페이앱 NFC 결제를 연동하는 흐름입니다.
                </div>
                
                <div style={{ marginTop: '6px' }}>
                  {currentStep === 1 && (
                    <button onClick={() => runNfcScenarioStep(1)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      🚀 1단계: 실물카드 결제 주문 전송
                    </button>
                  )}
                  {currentStep === 2 && (
                    <button onClick={() => runNfcScenarioStep(2)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#ec4899', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      📲 2단계: 직원 태깅 (페이앱 웹훅)
                    </button>
                  )}
                  {currentStep >= 3 && (
                    <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700 }}>
                      🎉 시나리오 시연 성공!
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeScenario === 'cash' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  <strong>[시나리오 4] 현금 결제 + 영수증 + 적립</strong><br />
                  현금 수납 시 단골 포인트 적립을 처리하고, 휴대폰 번호 정보를 페이앱 현금영수증 발행 API(`cashStRegist`)로 비동기 전송하는 파이프라인을 검증합니다.
                </div>
                
                <div style={{ marginTop: '6px' }}>
                  {currentStep === 1 && (
                    <button onClick={() => runCashScenarioStep(1)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      🚀 1단계: 현금주문 + 폰번호 전송
                    </button>
                  )}
                  {currentStep === 2 && (
                    <button onClick={() => runCashScenarioStep(2)} disabled={loading} style={{ width: '100%', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', fontSize: '0.8rem' }}>
                      💵 2단계: 포스 수동 수납완료 승인
                    </button>
                  )}
                  {currentStep >= 3 && (
                    <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700 }}>
                      🎉 시나리오 시연 성공!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 가상 디바이스 데모 및 터미널 로그 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 가상 스크린 데모 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', minHeight: '340px' }}>
            
            {/* 📱 가상 고객 기기 화면 */}
            <div style={{ background: '#0f172a', border: '8px solid #334155', borderRadius: '36px', padding: '16px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', height: '100%', minHeight: '340px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#334155' }}></div>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#334155' }}></div>
              </div>

              <div style={{ background: '#1e293b', flex: 1, borderRadius: '20px', padding: '12px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginBottom: '8px', fontWeight: 700 }}>
                  <span>Table {activeTable}</span>
                  <span>LOBBY VIEW (손님)</span>
                </div>

                {/* 세션 상태에 따른 뷰 렌더링 */}
                {!sessionData ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center' }}>
                    <span style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🛒</span>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>장바구니가 비어 있습니다</div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px' }}>시나리오의 1단계를 시작해 주문을 넣어보세요.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f1f5f9', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px', marginBottom: '8px' }}>
                      📋 세션 주문 내역 (합계: {sessionData.orders?.reduce((sum: number, o: any) => sum + (o.total_price || 0), 0).toLocaleString()}원)
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto', maxHeight: '180px' }}>
                      {sessionData.orders?.map((o: any) => {
                        const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]');
                        return (
                          <div key={o.order_id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700, color: '#cbd5e1' }}>
                              <span>{o.order_seq}차 추가 주문</span>
                              <span style={{ 
                                color: o.payment_status === 'paid' ? '#34d399' : o.payment_status === 'pending' ? '#fbbf24' : '#f87171',
                                background: o.payment_status === 'paid' ? 'rgba(52,211,153,0.1)' : o.payment_status === 'pending' ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)',
                                padding: '2px 6px', borderRadius: '4px', fontSize: '0.62rem'
                              }}>
                                {o.payment_status === 'paid' ? '결제완료' : o.payment_status === 'pending' ? '승인대기' : '미결제'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                              {items.map((item: any, i: number) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8' }}>
                                  <span>{item.name} x {item.quantity || item.qty || 1}</span>
                                  <span>{((item.price || 0) * (item.quantity || item.qty || 1)).toLocaleString()}원</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 더치페이 노출 */}
                    {sessionData.splits && (
                      <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(56,189,248,0.08)', border: '1px dashed rgba(56,189,248,0.3)', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#38bdf8', marginBottom: '4px' }}>👥 N분의 1 분할 정산 현황판</div>
                        {(() => {
                          const splits = typeof sessionData.splits === 'string' ? JSON.parse(sessionData.splits) : sessionData.splits;
                          const paidItems = splits.paid_items || [];
                          const total = splits.total_price || 0;
                          const paidSum = paidItems.reduce((s: number, x: any) => s + x.amount, 0);
                          return (
                            <div style={{ fontSize: '0.62rem', color: '#cbd5e1' }}>
                              <div>분할 대상 금액: {total.toLocaleString()}원</div>
                              <div>현재 결제 금액: {paidSum.toLocaleString()}원 / 남은 금액: {(total - paidSum).toLocaleString()}원</div>
                              <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                                {paidItems.map((pi: any, idx: number) => (
                                  <span key={idx} style={{ background: '#10b981', color: 'white', padding: '2px 4px', borderRadius: '4px', fontSize: '0.58rem' }}>
                                    승인 {pi.amount.toLocaleString()}원
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 🖥️ 카운터 포스 / KDS 모니터 화면 */}
            <div style={{ background: '#0f172a', border: '8px solid #475569', borderRadius: '16px', padding: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', height: '100%', minHeight: '340px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#64748b', marginBottom: '8px', fontWeight: 700 }}>
                <span>COUNTER POS (점원)</span>
                <span style={{ color: '#ef4444' }}>● LIVE SYNC</span>
              </div>

              <div style={{ background: '#1e293b', flex: 1, borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '10px' }}>
                  🏢 매장 좌석 현황판 (스냅 POS)
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', flex: 1 }}>
                  {[
                    { id: 'T88', label: 'T88 (PG결제)', active: activeTable === 'T88' && sessionData },
                    { id: 'T89', label: 'T89 (더치페이)', active: activeTable === 'T89' && sessionData },
                    { id: 'T90', label: 'T90 (실물카드)', active: activeTable === 'T90' && sessionData },
                    { id: 'T91', label: 'T91 (현금/적립)', active: activeTable === 'T91' && sessionData },
                  ].map(t => {
                    const isTarget = t.id === activeTable;
                    const hasActiveSession = t.active;
                    let tableBg = 'rgba(255,255,255,0.02)';
                    let border = '1px solid rgba(255,255,255,0.06)';
                    let statusColor = '#94a3b8';
                    let statusLabel = '빈 테이블';

                    if (hasActiveSession) {
                      const allPaid = sessionData.orders?.every((o: any) => o.payment_status === 'paid');
                      if (allPaid) {
                        tableBg = 'rgba(16, 185, 129, 0.08)';
                        border = '1px solid rgba(16, 185, 129, 0.4)';
                        statusColor = '#34d399';
                        statusLabel = '완납 (식사중)';
                      } else {
                        // 실물카드 직원호출 등 미결제 주문이 있는 경우 깜빡임 효과
                        const hasStaffNfc = sessionData.orders?.some((o: any) => o.payment_method?.includes('직원호출') && o.payment_status !== 'paid');
                        if (hasStaffNfc) {
                          tableBg = 'rgba(236, 72, 153, 0.1)';
                          border = '1px solid #ec4899';
                          statusColor = '#f472b6';
                          statusLabel = '💳 실물카드 호출';
                        } else {
                          tableBg = 'rgba(249, 115, 22, 0.08)';
                          border = '1px solid rgba(249, 115, 22, 0.4)';
                          statusColor = '#fb923c';
                          statusLabel = '미결제 주문';
                        }
                      }
                    }

                    return (
                      <div
                        key={t.id}
                        style={{
                          background: tableBg, border: border, borderRadius: '8px', padding: '10px',
                          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                          outline: isTarget ? '2.5px solid #3b82f6' : 'none',
                          boxShadow: isTarget ? '0 0 10px rgba(59, 130, 246, 0.4)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 900, color: isTarget ? '#60a5fa' : 'white' }}>{t.label}</span>
                          {isTarget && <span style={{ background: '#3b82f6', color: 'white', fontSize: '0.45rem', padding: '1px 3px', borderRadius: '3px' }}>현재 시연</span>}
                        </div>
                        
                        <div style={{ fontSize: '0.62rem', color: statusColor, fontWeight: 700, marginTop: '10px' }}>
                          {statusLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {/* 실시간 시스템 이벤트 로그 */}
          <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', height: '200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }}></span>
                실시간 시스템 이벤트 터미널 로그
              </div>
              <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline' }}>
                로그 지우기
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.68rem', lineHeight: '1.4', color: '#94a3b8' }}>
              {logs.length === 0 ? (
                <div style={{ color: '#475569', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                  이벤트 로그가 여기에 출력됩니다. 시나리오 단계를 클릭하여 시뮬레이션을 작동하세요.
                </div>
              ) : (
                logs.map((log, idx) => {
                  let color = '#cbd5e1';
                  if (log.type === 'api') color = '#38bdf8';
                  else if (log.type === 'success') color = '#34d399';
                  else if (log.type === 'event') color = '#a78bfa';
                  else if (log.type === 'error') color = '#ef4444';

                  return (
                    <div key={idx} style={{ marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                      <span style={{ color: '#64748b', marginRight: '6px' }}>[{log.time}]</span>
                      <span style={{ color: color, fontWeight: 700 }}>{log.message}</span>
                      {log.details && (
                        <pre style={{ margin: '3px 0 0 10px', color: '#64748b', fontSize: '0.6rem', whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.01)', padding: '4px', borderRadius: '4px' }}>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={logEndRef}></div>
            </div>
          </div>

        </div>

      </div>
      
    </div>
  );
};

export default PaymentSimulator;
