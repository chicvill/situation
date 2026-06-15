import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../config';

interface LogEntry {
  time: string;
  type: 'info' | 'api' | 'success' | 'event' | 'error';
  message: string;
  details?: any;
}

export const PaymentSimulator = ({ storeId = 'default_store' }: { storeId?: string, bundles?: any[] }) => {
  const [activeTab, setActiveTab] = useState<'roadmap' | 'apiConfig' | 'testCenter'>('roadmap');
  const [activeRoadmapStep, setActiveRoadmapStep] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  // 시뮬레이터 관련 상태 (Tab 3에서 사용)
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
    if (activeTab === 'testCenter') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

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
    addLog('info', `[테스트 시나리오 변경] ${activeScenario.toUpperCase()} 모드가 선택되었습니다. 대상 테이블: ${activeTable}`);
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

  const triggerPayAppWebhook = async (orderId: string, price: number) => {
    const formData = new URLSearchParams();
    formData.append('userid', 'payapp_test_id');
    formData.append('price', String(price));
    formData.append('pay_state', '4');
    formData.append('var1', orderId);
    formData.append('mul_no', `MOCK-TX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`);

    addLog('api', `POST /api/payment/payapp/feedback (Webhook 웹노티 시뮬레이션)`, Object.fromEntries(formData.entries()));

    const res = await fetch(`${API_BASE}/api/payment/payapp/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    const resultText = await res.text();
    addLog('success', `페이앱 웹훅 처리 완료. 반환 결과: ${resultText}`);
    await fetchSession();
    return resultText;
  };

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

  const manualCompletePayment = async (orderId: string) => {
    addLog('api', `POST /api/payment/confirm 호출 (포스 수동 승인 처리)`, { orderId });
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
    addLog('success', '결제가 수동 수납완료(승인) 처리되었습니다.', data);
    await fetchSession();
    return data;
  };

  // --- 시나리오 실행 제어 ---
  const runPgScenarioStep = async (step: number) => {
    setLoading(true);
    try {
      if (step === 1) {
        addLog('info', '1단계: T88 테이블에 1차 주문(에스프레소, 크루아상)을 전송합니다. 결제 수단: 카드(선결제)');
        await placeOrder([
          { name: '에스프레소', price: 4500, quantity: 1 },
          { name: '크루아상', price: 4000, quantity: 2 }
        ], '카드 결제', 'pending');
        setCurrentStep(2);
      } 
      else if (step === 2) {
        addLog('info', '2단계: T88 테이블에 2차 추가 주문(아이스 아메리카노)을 전송합니다. 결제 수단: 카드(선결제)');
        await placeOrder([
          { name: '아이스 아메리카노', price: 5000, quantity: 1 }
        ], '카드 결제', 'pending');
        setCurrentStep(3);
      } 
      else if (step === 3) {
        addLog('info', '3단계: 1차 주문 건에 대해 페이앱 결제 완료 웹훅 수신을 시뮬레이션합니다.');
        const pendingOrder = sessionData?.orders?.find((o: any) => o.payment_status === 'pending');
        if (!pendingOrder) {
          addLog('error', '대기 중인 주문을 찾을 수 없습니다. 1단계를 먼저 실행하세요.');
          return;
        }
        await triggerPayAppWebhook(pendingOrder.order_id, pendingOrder.total_price);
        setCurrentStep(4);
      }
      else if (step === 4) {
        addLog('info', '4단계: 2차 주문 건에 대해 페이앱 결제 완료 웹훅 수신을 시뮬레이션합니다.');
        const pendingOrder = sessionData?.orders?.find((o: any) => o.payment_status === 'pending');
        if (!pendingOrder) {
          addLog('success', '대기 중인 2차 주문이 없습니다. 이미 승인되었거나 2단계를 진행하지 않았습니다.');
          setCurrentStep(5);
          return;
        }
        await triggerPayAppWebhook(pendingOrder.order_id, pendingOrder.total_price);
        addLog('success', '시나리오 1 완료! N차 추가 주문 및 웹훅 결제 승인 연동이 모두 확인되었습니다.');
        setCurrentStep(5);
      }
    } catch (err: any) {
      addLog('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const runDutchScenarioStep = async (step: number) => {
    setLoading(true);
    try {
      if (step === 1) {
        addLog('info', '1단계: T89 테이블에 손님 A의 주문(치즈케이크 2개 - 14,000원)을 등록합니다.');
        await placeOrder([
          { name: '치즈케이크', price: 7000, quantity: 2 }
        ], '더치페이', 'unpaid');
        setCurrentStep(2);
      }
      else if (step === 2) {
        addLog('info', '2단계: 동일한 T89 테이블에 손님 B가 합석하여 자몽에이드(6,000원)를 추가 주문합니다.');
        await placeOrder([
          { name: '자몽에이드', price: 6000, quantity: 1 }
        ], '더치페이', 'unpaid');
        setCurrentStep(3);
      }
      else if (step === 3) {
        addLog('info', '3단계: 점주/고객이 더치페이 분할 결제(2인 분배)를 생성합니다.');
        if (!sessionData?.session_id) {
          addLog('error', '활성화된 테이블 세션이 없습니다. 1단계를 먼저 실행하세요.');
          return;
        }
        await createDutchPay(sessionData.session_id);
        setCurrentStep(4);
      }
      else if (step === 4) {
        addLog('info', '4단계: 손님 A가 본인 몫(10,000원)을 결제 완료(웹훅 호출)합니다.');
        const dutchOrderId = `dutch_${sessionData?.session_id}`;
        await triggerPayAppWebhook(dutchOrderId, 10000);
        setCurrentStep(5);
      }
      else if (step === 5) {
        addLog('info', '5단계: 손님 B가 남은 몫(10,000원)을 결제 완료(웹훅 호출)하여 정산을 완료합니다.');
        const dutchOrderId = `dutch_${sessionData?.session_id}`;
        await triggerPayAppWebhook(dutchOrderId, 10000);
        addLog('success', '시나리오 2 완료! 분할 정산이 완결되어 전체 주문이 결제완료(paid) 상태로 업데이트되었습니다.');
        setCurrentStep(6);
      }
    } catch (err: any) {
      addLog('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const runNfcScenarioStep = async (step: number) => {
    setLoading(true);
    try {
      if (step === 1) {
        addLog('info', '1단계: T90 테이블에서 손님이 [실물카드 결제 (직원호출)] 방식으로 주문을 발송합니다.');
        await placeOrder([
          { name: '크로플', price: 6500, quantity: 1 },
          { name: '아인슈페너', price: 6000, quantity: 1 }
        ], '실물카드 결제 (직원호출)', 'unpaid');
        setCurrentStep(2);
      }
      else if (step === 2) {
        addLog('info', '2단계: 직원이 카운터 패드를 확인하고 고객 테이블로 방문하여 PayApp 앱(App-to-App) 태깅 결제를 완료합니다.');
        const unpaidOrder = sessionData?.orders?.find((o: any) => o.payment_status === 'unpaid');
        if (!unpaidOrder) {
          addLog('error', '대기 중인 미결제 주문 건을 찾을 수 없습니다.');
          return;
        }
        await triggerPayAppWebhook(unpaidOrder.order_id, unpaidOrder.total_price);
        addLog('success', '시나리오 3 완료! 직원 대면 태깅 결제 시 웹훅 수신 및 주문 상태 전파가 검증되었습니다.');
        setCurrentStep(3);
      }
    } catch (err: any) {
      addLog('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const runCashScenarioStep = async (step: number) => {
    setLoading(true);
    try {
      if (step === 1) {
        addLog('info', '1단계: T91 테이블에서 손님이 포인트 적립(010-9999-8888) 및 현금 결제(현금영수증 신청) 주문을 전송합니다.');
        await placeOrder([
          { name: '카페라떼', price: 5000, quantity: 2 },
          { name: '초코칩 쿠키', price: 3000, quantity: 1 }
        ], '현금 결제', 'unpaid', '010-9999-8888');
        setCurrentStep(2);
      }
      else if (step === 2) {
        addLog('info', '2단계: 직원이 카운터포스에서 현금을 확인하고 수납을 승인합니다. 포인트 적립과 동시에 현금영수증 API(cashStRegist)가 백그라운드로 트리거됩니다.');
        const unpaidOrder = sessionData?.orders?.find((o: any) => o.payment_status === 'unpaid');
        if (!unpaidOrder) {
          addLog('error', '수납 대기 상태의 주문 건을 찾을 수 없습니다.');
          return;
        }
        await manualCompletePayment(unpaidOrder.order_id);
        addLog('success', '시나리오 4 완료! 현금 승인 및 단골포인트 적립, 페이앱 현금영수증 등록 호출 프로세스가 정상 가동됩니다.');
        setCurrentStep(3);
      }
    } catch (err: any) {
      addLog('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const envText = `PAYAPP_USERID=himin53\nPAYAPP_LINKKEY=qJ42gWTeu8HQzBR1xYfthu1DPJnCCRVaOgT+oqg6zaM=\nPAYAPP_LINKVAL=qJ42gWTeu8HQzBR1xYfthiUCd45CKQSTYfgyGNI2Vy0=`;
    navigator.clipboard.writeText(envText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* 🚀 1. 상단 유리모피즘 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '2.5rem' }}>💳</span>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 900, background: 'linear-gradient(to right, #60a5fa, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                페이앱(PayApp) 설정 및 연동 센터
              </h1>
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '6px 0 0' }}>
                가맹점 페이앱 가입 및 구비 서류 준비부터 API 키 설정, 그리고 연동 기능의 정상 가동 여부를 확인합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 탭 네비게이션 버튼 그룹 */}
        <div style={{
          display: 'flex',
          background: 'rgba(15, 23, 42, 0.5)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          {[
            { id: 'roadmap', label: '📋 가입 및 심사', icon: '📝' },
            { id: 'apiConfig', label: '⚙️ API & 설정', icon: '🛠️' },
            { id: 'testCenter', label: '🧪 연동 테스트', icon: '⚡' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#94a3b8',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 🚀 2. 탭별 메인 컨텐츠 영역 */}

      {/* TAB 1: 가입 및 심사 절차 (Roadmap) */}
      {activeTab === 'roadmap' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
          
          {/* 왼쪽: 로드맵 흐름 & 세부사항 */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '20px',
            padding: '24px',
            backdropFilter: 'blur(10px)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 20px', color: '#e2e8f0' }}>페이앱 가입 로드맵 (5단계)</h3>
            
            {/* 가로형 스텝 버튼 그룹 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { step: 1, label: '회원가입' },
                { step: 2, label: '가입비 결제' },
                { step: 3, label: '서류 제출' },
                { step: 4, label: '보증보험' },
                { step: 5, label: '심사 및 완료' }
              ].map(item => (
                <button
                  key={item.step}
                  onClick={() => setActiveRoadmapStep(item.step)}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    opacity: activeRoadmapStep === item.step ? 1 : 0.5,
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: activeRoadmapStep === item.step ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    border: activeRoadmapStep === item.step ? '2px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                    marginBottom: '8px'
                  }}>
                    {item.step}
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: activeRoadmapStep === item.step ? '#60a5fa' : '#94a3b8' }}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            {/* 활성화된 단계 상세 내용 */}
            <div style={{ background: 'rgba(15, 23, 42, 0.3)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
              {activeRoadmapStep === 1 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#60a5fa', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>💻</span> 1단계: 페이앱 공식 홈페이지 가입
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 14px 0' }}>
                    페이앱 웹사이트에 직접 접속하여 서비스 가입을 신청합니다. 본인의 가입 유형에 맞춰 정보를 명확하게 작성해 주세요.
                  </p>
                  <ul style={{ paddingLeft: '20px', fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.8' }}>
                    <li><strong>가입 주소:</strong> <a href="https://www.payapp.kr" target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>www.payapp.kr</a> 접속 ➔ [회원가입]</li>
                    <li><strong>가입 구분 선택:</strong>
                      <ul>
                        <li><strong style={{ color: '#f1f5f9' }}>개인 판매자 (비사업자)</strong>: 사업자등록증이 없는 개인 및 SNS 마켓 셀러</li>
                        <li><strong style={{ color: '#f1f5f9' }}>개인 사업자</strong>: 개인 등록 사업체를 보유한 경우</li>
                        <li><strong style={{ color: '#f1f5f9' }}>법인 사업자</strong>: 법인 등록 사업체의 경우</li>
                      </ul>
                    </li>
                    <li><strong>기본 입력 정보:</strong> ID(사용자 아이디), 이메일, 정산 계좌(대금 지급용 통장) 설정</li>
                  </ul>
                </div>
              )}

              {activeRoadmapStep === 2 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#60a5fa', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>💳</span> 2단계: 최초 가입비 결제
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 14px 0' }}>
                    페이앱 서비스를 원활하게 이용하기 위해 가입 시 1회에 한하여 가입비가 청구됩니다. (제휴 프로모션에 따라 비용이 면제되거나 추가 할인이 부여될 수 있습니다.)
                  </p>
                  <ul style={{ paddingLeft: '20px', fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.8' }}>
                    <li><strong>가입 비용:</strong> 최초 가입비 220,000원 (VAT 포함)</li>
                    <li><strong>결제 방식:</strong> 신용카드 결제, 가상계좌 이체 등 지원</li>
                    <li><strong>참고사항:</strong> 가입비 결제가 완료되면 임시 가입 상태로 전환되며, 페이앱 판매자 관리자 시스템 로그인이 가능해집니다.</li>
                  </ul>
                </div>
              )}

              {activeRoadmapStep === 3 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#60a5fa', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📁</span> 3단계: 가맹 계약서 및 증빙 서류 제출
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 14px 0' }}>
                    신용카드 결제 한도 심사 및 판매 대금의 투명한 정산을 위하여, 계약서와 함께 법률상 요구되는 증빙 서류를 업로드 또는 팩스/이메일로 접수해야 합니다.
                  </p>
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', fontSize: '0.8rem', color: '#cbd5e1' }}>
                    <strong style={{ color: '#38bdf8' }}>📄 가입 형태별 구비서류:</strong>
                    <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '100px 1fr', gap: '6px 12px' }}>
                      <span style={{ color: '#94a3b8' }}>비사업자(개인)</span>
                      <span>신분증 사본, 본인 명의 통장 사본</span>
                      
                      <span style={{ color: '#94a3b8' }}>개인사업자</span>
                      <span>사업자등록증, 대표 신분증, 대표 통장 사본</span>
                      
                      <span style={{ color: '#94a3b8' }}>법인사업자</span>
                      <span>사업자등록증, 법인등기부등본, 법인인감증명서 (최근 3개월 이내 발급본), 법인 통장 사본, 대표자 신분증 사본</span>
                    </div>
                  </div>
                </div>
              )}

              {activeRoadmapStep === 4 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#60a5fa', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🛡️</span> 4단계: 보증보험(SGI서울보증) 가입
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 14px 0' }}>
                    비대면 상거래의 결제 환불 사고 및 리스크 방지를 위해 서울보증보험 가입이 의무화되거나 필요할 수 있습니다.
                  </p>
                  <ul style={{ paddingLeft: '20px', fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.8' }}>
                    <li><strong>대상자:</strong> 개인(비사업자) 회원 전체 및 결제액 한도 증액이 필요한 사업자 회원</li>
                    <li><strong>절차:</strong> 페이앱 안내 메시지 수신 ➔ 서울보증보험 사이트 접속 ➔ 공인인증서 전자서명 및 보험료 납부</li>
                    <li><strong>참고:</strong> 가입하는 보증보험 가입금액 규모에 따라 월 결제 한도액이 연동되어 조정됩니다.</li>
                  </ul>
                </div>
              )}

              {activeRoadmapStep === 5 && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#34d399', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎉</span> 5단계: 카드사 심사 승인 및 서비스 개시
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 14px 0' }}>
                    제출 완료된 서류를 바탕으로 국내 8대 카드사의 심사가 순차적으로 처리됩니다.
                  </p>
                  <ul style={{ paddingLeft: '20px', fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.8' }}>
                    <li><strong>심사 기간:</strong> 주말 제외 영업일 기준 약 3 ~ 7일 소요</li>
                    <li><strong>카드 승인:</strong> 카드사별로 승인이 개별 등록되며, 심사가 완료되는 즉시 실결제가 가능해집니다.</li>
                    <li><strong>완료 확인:</strong> 페이앱 판매자 관리자 페이지 내에서 [심사현황] ➔ [정상운영] 상태 확인 가능</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 필수 구비 서류 체크리스트 */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '20px',
            padding: '24px',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>제출 서류 체크리스트</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', gap: '10px', fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked style={{ accentColor: '#10b981' }} />
                <span>사업자등록증 사본 (사업자 공통)</span>
              </label>
              <label style={{ display: 'flex', gap: '10px', fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked style={{ accentColor: '#10b981' }} />
                <span>대표자 신분증 사본 (신분증 앞면)</span>
              </label>
              <label style={{ display: 'flex', gap: '10px', fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: '#10b981' }} />
                <span>정산받을 대표/법인 명의 통장 사본</span>
              </label>
              <label style={{ display: 'flex', gap: '10px', fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: '#10b981' }} />
                <span>법인등기부등본 (법인, 3개월 내)</span>
              </label>
              <label style={{ display: 'flex', gap: '10px', fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: '#10b981' }} />
                <span>법인인감증명서 (법인, 3개월 내)</span>
              </label>
            </div>
            
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '10px',
              padding: '12px',
              fontSize: '0.75rem',
              color: '#f87171',
              lineHeight: 1.5
            }}>
              <strong>⚠️ 서류 제출 시 주의사항</strong><br />
              모든 사본 서류는 흐릿하거나 잘리는 부분 없이 선명한 스캔본이어야 합니다. 정보 오식 시 재승인 검토 절차로 인해 연동이 지연됩니다.
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: API 및 환경변수 설정 (API & Configuration) */}
      {activeTab === 'apiConfig' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* 왼쪽: 키 발급 및 피드백 주소 설정 가이드 */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '20px',
            padding: '24px',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>API 키 및 웹훅 설정</h3>
            
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6' }}>
              카드 가맹 심사가 승인 완료되면 시스템 간 데이터 동기화를 위해 키값들을 발급받아야 합니다.
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.03)'
            }}>
              <strong style={{ fontSize: '0.88rem', color: '#60a5fa', display: 'block', marginBottom: '10px' }}>🔑 1. API 연동 키 정보 발급 위치</strong>
              <ol style={{ paddingLeft: '18px', fontSize: '0.78rem', color: '#94a3b8', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>페이앱 관리자 모드(<a href="https://www.payapp.kr/query/login.html" target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>로그인</a>) 접속</li>
                <li>[설정/관리] 메뉴 ➔ [연동관리] 혹은 [API 연동설정] 선택</li>
                <li>발급된 <strong style={{ color: '#f1f5f9' }}>USERID, LINKKEY, LINKVAL</strong> 값을 메모/복사합니다.</li>
              </ol>
            </div>

            <div style={{
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.03)'
            }}>
              <strong style={{ fontSize: '0.88rem', color: '#60a5fa', display: 'block', marginBottom: '10px' }}>🔗 2. 피드백 URL (웹훅) 등록하기</strong>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                고객 결제 완료 시 서버 DB 상태를 미결제에서 완납(paid) 상태로 자동 동기화하고 주방/점원 알림을 트리거하기 위해 웹훅을 등록합니다.
              </p>
              <div style={{
                background: 'rgba(0,0,0,0.2)',
                padding: '10px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#34d399',
                wordBreak: 'break-all'
              }}>
                https://chicvill.store/api/payment/payapp/feedback
              </div>
              <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginTop: '6px' }}>
                * 페이앱 관리자 연동 설정 내 '피드백 URL(또는 WebNoti URL)' 란에 위 주소를 기입해 줍니다.
              </span>
            </div>
          </div>

          {/* 오른쪽: .env 파일 기입 예시 */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '20px',
            padding: '24px',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>.env 환경변수 설정</h3>
              <button
                onClick={handleCopy}
                style={{
                  background: copied ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.06)',
                  border: copied ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.1)',
                  color: copied ? '#34d399' : '#cbd5e1',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {copied ? '✅ 복사 완료!' : '📋 복사하기'}
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
              서버 백엔드 설정 파일인 <code style={{ color: '#60a5fa', fontFamily: 'monospace' }}>.env</code>를 에디터로 열어 아래 양식과 같이 연동 키값들을 주입하고 저장합니다.
            </p>

            <pre style={{
              background: '#090d16',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)',
              fontFamily: 'monospace',
              fontSize: '0.76rem',
              color: '#cbd5e1',
              lineHeight: 1.6,
              overflowX: 'auto',
              margin: 0
            }}>
              {`# ----------------------------------------------------\n# PayApp Configuration (B2B Terminal-Free Payments)\n# ----------------------------------------------------\nPAYAPP_USERID=himin53\nPAYAPP_LINKKEY=qJ42gWTeu8HQzBR1xYfthu1DPJnCCRVaOgT+oqg6zaM=\nPAYAPP_LINKVAL=qJ42gWTeu8HQzBR1xYfthiUCd45CKQSTYfgyGNI2Vy0=`}
            </pre>

            <div style={{
              background: 'rgba(96, 165, 250, 0.08)',
              border: '1px solid rgba(96, 165, 250, 0.2)',
              borderRadius: '12px',
              padding: '14px',
              fontSize: '0.76rem',
              color: '#93c5fd',
              lineHeight: 1.5
            }}>
              <strong>💡 로컬 개발용 가이드:</strong><br />
              로컬 개발서버 테스트 단계에서는 실제 돈이 이체되지 않도록 <code style={{ color: '#cbd5e1' }}>PAYAPP_USERID=payapp_test_id</code>로 적용하면 가맹 키 검증 및 실결제 호출 과정이 우회 처리되어 시뮬레이션 테스트가 통과되도록 설계되어 있습니다.
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: 실시간 연동 테스트 (Simulator) */}
      {activeTab === 'testCenter' && (
        <div>
          {/* 가상 테이블 데이터 및 전체 초기화 탑바 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
              실제 백엔드 API와 DB 트랜잭션, Webhook 검증 라우트를 그대로 연동하여 결제 가동 상태를 테스트합니다.
            </p>
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
              🧹 테스트 테이블 & 주문 로그 전체 초기화
            </button>
          </div>

          {/* 메인 테스트 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
            
            {/* 왼쪽: 컨트롤러 및 프리셋 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 시나리오 프리셋 선택 */}
              <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 12px' }}>검증 시나리오 선택</h3>
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
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>테스트 스텝 제어</h3>
                  <button onClick={() => { setCurrentStep(1); addLog('info', '단계를 1단계로 재설정했습니다.'); }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }}>
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

            {/* 오른쪽: 가상 디바이스 및 터미널 로그 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 가상 스크린 */}
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
                      <span>고객 태블릿 화면</span>
                    </div>

                    {!sessionData ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center' }}>
                        <span style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🛒</span>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>장바구니가 비어 있습니다</div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '4px' }}>시나리오의 1단계를 시작하여 주문 데이터를 전송하세요.</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f1f5f9', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px', marginBottom: '8px' }}>
                          📋 주문 합계: {sessionData.orders?.reduce((sum: number, o: any) => sum + (o.total_price || 0), 0).toLocaleString()}원
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
                                  <div>정산 금액: {total.toLocaleString()}원</div>
                                  <div>결제 완료: {paidSum.toLocaleString()}원 / 미결제: {(total - paidSum).toLocaleString()}원</div>
                                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
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
                    <span>카운터 POS 현황</span>
                    <span style={{ color: '#34d399' }}>● 동기화 중</span>
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

              {/* 실시간 시스템 로그 터미널 */}
              <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', height: '200px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }}></span>
                    실시간 API 검증 터미널 로그
                  </div>
                  <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline' }}>
                    로그 클리어
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.68rem', lineHeight: '1.4', color: '#94a3b8' }}>
                  {logs.length === 0 ? (
                    <div style={{ color: '#475569', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                      시뮬레이션 단계를 클릭하면 시스템 API 연동 이벤트 흐름이 여기에 출력됩니다.
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
      )}

    </div>
  );
};

export default PaymentSimulator;
