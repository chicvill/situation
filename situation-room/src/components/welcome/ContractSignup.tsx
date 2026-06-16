import React, { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../../config';
import './ContractSignup.css';

interface ContractSignupProps {
  onBack: () => void;
  onSignupSuccess: (userSession: any) => void;
}

const hashPassword = async (password: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const ContractSignup: React.FC<ContractSignupProps> = ({ onBack, onSignupSuccess }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1: 계정 정보
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2: 매장 정보 및 옵션
  const [storeName, setStoreName] = useState('');
  const [bizNo, setBizNo] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [tableCount, setTableCount] = useState(6);
  const [options, setOptions] = useState({
    waiting: false,
    call: false,
    points: false,
    staff: false,
    parking: false,
  });

  // Step 3: 본인인증 및 서명
  const [authSent, setAuthSent] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [authVerified, setAuthVerified] = useState(false);
  const [carrier, setCarrier] = useState('SKT');
  
  // 약관 동의 상태
  const [agreed1, setAgreed1] = useState(false); // 가입 대행 및 정보제공 동의
  const [agreed2, setAgreed2] = useState(false); // 수수료 고지 동의
  const [agreed3, setAgreed3] = useState(false); // 정산 보류 안내 동의
  const [agreed4, setAgreed4] = useState(false); // 가맹비 연체 운영 정지 동의

  // Canvas 서명 패드 레퍼런스
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (step === 3 && canvasRef.current) {
      initCanvas();
    }
  }, [step]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getEventCoords = (e: React.MouseEvent | React.TouchEvent | any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawing.current = true;
    const coords = getEventCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getEventCoords(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const handleEndDraw = () => {
    isDrawing.current = false;
  };

  const handleClearCanvas = () => {
    initCanvas();
  };

  // 요금 계산
  const calculateFee = () => {
    const base = 10000;
    const activeCount = Object.values(options).filter(Boolean).length;
    return base + activeCount * 1000;
  };

  // 본인인증번호 발송
  const sendVerification = () => {
    if (!userName.trim() || !phone.trim()) {
      alert('본인인증을 위해 이름과 연락처를 먼저 채워주세요.');
      return;
    }
    setAuthSent(true);
    alert('가상 본인인증 번호 [123456]이 전송되었습니다. (테스트 번호를 입력해 주세요)');
  };

  // 본인인증 완료
  const verifyCode = () => {
    if (authCode === '123456') {
      setAuthVerified(true);
      alert('본인인증이 완료되었습니다.');
    } else {
      alert('인증번호가 일치하지 않습니다. (테스트 번호: 123456)');
    }
  };

  // 유효성 검사 및 단계 이동
  const handleNextStep = () => {
    setError('');
    if (step === 1) {
      if (!userId.trim()) return setError('아이디를 입력해주세요.');
      if (password.length < 4) return setError('비밀번호는 4자리 이상이어야 합니다.');
      if (password !== confirmPassword) return setError('비밀번호가 일치하지 않습니다.');
      if (!userName.trim()) return setError('성명을 입력해주세요.');
      if (!phone.trim()) return setError('연락처를 입력해주세요.');
      setStep(2);
    } else if (step === 2) {
      if (!storeName.trim()) return setError('상호명을 입력해주세요.');
      if (!bizNo.trim()) return setError('사업자등록번호를 입력해주세요.');
      if (!openDate.trim()) return setError('개업일자를 입력해주세요.');
      setStep(3);
    }
  };

  // 최종 제출
  const handleSubmit = async () => {
    setError('');
    if (!authVerified) {
      return setError('계약 서명 전 본인인증을 완료해주셔야 합니다.');
    }
    if (!agreed1 || !agreed2 || !agreed3 || !agreed4) {
      return setError('모든 필수 동의 조항에 체크하셔야 제출이 가능합니다.');
    }

    setIsSubmitting(true);
    try {
      const hashedPw = await hashPassword(password);
      const storeId = `store-${userId.trim()}`;
      const bundleId = `USER-${userId.trim()}`;

      // PersonalInfos 번들 데이터 구성
      const bundlePayload = {
        id: bundleId,
        type: 'PersonalInfos',
        title: `${userName} 점주님 가입 신청`,
        store: storeName.trim(),
        store_id: storeId,
        status: 'pending',
        timestamp: new Date().toISOString(),
        items: [
          { name: '이름', value: userName.trim() },
          { name: '아이디', value: userId.trim() },
          { name: '비밀번호', value: hashedPw },
          { name: '권한', value: 'owner' },
          { name: '사업자번호', value: bizNo.trim() },
          { name: '개업일자', value: openDate.trim() },
          { name: '테이블수', value: String(tableCount) },
          { name: '연락처', value: phone.trim() },
          { name: '옵션_호출', value: options.call ? 'Y' : 'N' },
          { name: '옵션_대기', value: options.waiting ? 'Y' : 'N' },
          { name: '옵션_주차', value: options.parking ? 'Y' : 'N' },
          { name: '옵션_포인트', value: options.points ? 'Y' : 'N' },
          { name: '옵션_직원', value: options.staff ? 'Y' : 'N' },
          { name: '약관동의_대행', value: 'Y' },
          { name: '약관동의_수수료', value: 'Y' },
          { name: '약관동의_정산보류', value: 'Y' },
          { name: '약관동의_가맹비연체', value: 'Y' }
        ]
      };

      // 1. 번들 전송 및 저장 (RDBMS users, stores, bundles 자동 처리됨)
      const res = await fetch(`${API_BASE}/api/bundle/${bundleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundlePayload)
      });

      if (!res.ok) {
        throw new Error('가입 번들 저장 중 오류가 발생했습니다.');
      }

      // 2. 가입 즉시 사전 설정 체험을 위해 임시 세션 발급 및 자동 로그인 처리
      const loginPayload = { id: userId.trim(), password: hashedPw };
      const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginPayload)
      });

      if (!loginRes.ok) {
        throw new Error('계정 자동 생성 완료 후 로그인 처리에 실패했습니다.');
      }

      const loginData = await loginRes.json();
      localStorage.setItem('mqnet_user', JSON.stringify(loginData));
      localStorage.setItem('mqnet_token', loginData.token);

      alert(`🎉 가입 및 이용계약 제출이 완료되었습니다!\n현재 매장은 최고관리자의 PayApp 심사 대기 중입니다.\n승인 전 상태로 로그인하여 매장 설정과 직원 등록을 시작합니다!`);
      
      onSignupSuccess(loginData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '서버 통신 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signup-container animate-fade-in">
      <div className="signup-box glass-panel">
        {/* Step Indicator */}
        <div className="step-indicator">
          <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className="step-line"></div>
          <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className="step-line"></div>
          <div className={`step-dot ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>

        <h2>{step === 1 ? '점주 계정 설정' : step === 2 ? '매장 기본 정보' : '전자 이용계약서 작성'}</h2>

        {error && <div className="error-message">⚠️ {error}</div>}

        {step === 1 && (
          <div className="signup-form">
            <div className="form-group">
              <label>아이디 (로그인용)</label>
              <input type="text" value={userId} onChange={e => setUserId(e.target.value)} placeholder="아이디 입력" />
            </div>
            <div className="form-group">
              <label>비밀번호</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호 입력" />
            </div>
            <div className="form-group">
              <label>비밀번호 확인</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="비밀번호 재입력" />
            </div>
            <div className="form-group">
              <label>대표자 성명</label>
              <input type="text" value={userName} onChange={e => setUserName(e.target.value)} placeholder="대표자 이름 입력" />
            </div>
            <div className="form-group">
              <label>연락처 (휴대폰 번호)</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="예: 01012345678" />
            </div>
            
            <div className="signup-actions">
              <button className="btn-back" onClick={onBack}>취소</button>
              <button className="btn-next" onClick={handleNextStep}>다음 단계로</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="signup-form">
            <div className="form-group">
              <label>매장명 (상호)</label>
              <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="예: 커피팩토리 신촌점" />
            </div>
            <div className="form-group">
              <label>사업자등록번호</label>
              <input type="text" value={bizNo} onChange={e => setBizNo(e.target.value)} placeholder="예: 120-80-12345" />
            </div>
            <div className="form-group">
              <label>개업일자</label>
              <input type="date" value={openDate} onChange={e => setOpenDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>기초 매장 테이블 수</label>
              <input type="number" min={1} max={50} value={tableCount} onChange={e => setTableCount(Number(e.target.value))} />
            </div>
            
            <div className="form-group">
              <label>이용할 스마트 기능 옵션</label>
              <div className="option-checkbox-grid">
                <label className={`checkbox-item ${options.waiting ? 'checked' : ''}`}>
                  <input type="checkbox" checked={options.waiting} onChange={() => setOptions(prev => ({...prev, waiting: !prev.waiting}))} />
                  <span>🛎️ 대기 관리 (월 +1,000원)</span>
                </label>
                <label className={`checkbox-item ${options.call ? 'checked' : ''}`}>
                  <input type="checkbox" checked={options.call} onChange={() => setOptions(prev => ({...prev, call: !prev.call}))} />
                  <span>🔔 호출 벨 (월 +1,000원)</span>
                </label>
                <label className={`checkbox-item ${options.points ? 'checked' : ''}`}>
                  <input type="checkbox" checked={options.points} onChange={() => setOptions(prev => ({...prev, points: !prev.points}))} />
                  <span>🪙 포인트 적립 (월 +1,000원)</span>
                </label>
                <label className={`checkbox-item ${options.staff ? 'checked' : ''}`}>
                  <input type="checkbox" checked={options.staff} onChange={() => setOptions(prev => ({...prev, staff: !prev.staff}))} />
                  <span>👥 직원 QR 근태 (월 +1,000원)</span>
                </label>
                <label className={`checkbox-item ${options.parking ? 'checked' : ''}`}>
                  <input type="checkbox" checked={options.parking} onChange={() => setOptions(prev => ({...prev, parking: !prev.parking}))} />
                  <span>🚗 주차 등록 (월 +1,000원)</span>
                </label>
              </div>
            </div>

            <div className="signup-actions">
              <button className="btn-back" onClick={() => setStep(1)}>이전 단계</button>
              <button className="btn-next" onClick={handleNextStep}>다음 단계로</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="signup-form scrollable-contract">
            {/* 📜 전자 계약서 서식 */}
            <div className="contract-box">
              <h3>스마트 매장 솔루션 이용 및 PayApp 대행 계약서</h3>
              <p>본 계약은 스마트 매장 운영 시스템(이하 "시스템") 제공사 및 가맹점주(이하 "점주") 간의 서비스 이용 및 PG 결제 연동 처리에 관한 계약입니다.</p>
              
              <h4>1. 가맹 매장 및 요금 구성</h4>
              <ul>
                <li><strong>상호명:</strong> {storeName}</li>
                <li><strong>대표자명:</strong> {userName}</li>
                <li><strong>사업자등록번호:</strong> {bizNo}</li>
                <li><strong>기본 이용료:</strong> 월 10,000원 (첫 1달 무료 혜택 제공)</li>
                <li><strong>선택 옵션 수료:</strong> 월 { (Object.values(options).filter(Boolean).length * 1000).toLocaleString() }원</li>
                <li><strong>합계 이용 금액:</strong> 월 { calculateFee().toLocaleString() }원</li>
              </ul>

              <h4>2. 주요 계약 약정 사항</h4>
              <div className="contract-terms">
                <h5>[제 1조] 가맹비 1개월 경과 시 청구 및 미납 운영 정지 약정</h5>
                <p>본 시스템 가입 후 <strong>1개월(30일) 무료 체험 기간이 만료</strong>되면, 점주 대시보드 화면에 월 가맹비 청구서가 노출됩니다. 기한 내에 가맹비가 납부되지 않아 연체 상태가 될 시 <strong>스마트폰 테이블 주문 및 점주 대시보드 시스템 전체 운영이 일시 정지(접속 차단)</strong>됩니다. 연체된 요금이 완납되면 즉시 모든 시스템은 자동으로 정상 재가동 상태로 잠금 해제(Unlock)됩니다.</p>

                <h5>[제 2조] PayApp 가맹 승인 대행 및 필수 정보 제공 약정</h5>
                <p>점주는 서비스 내 신용카드 결제를 위해 당사가 페이앱(PayApp) 공식 심사 센터에 <strong>가맹점 등록 및 가입 승인 업무를 대행하는 것에 동의</strong>합니다. 대행을 위해 입력한 대표자명, 사업자정보, 연락처 등의 필수 정보를 PG사(UDID PayApp)에 전송하는 것에 동의합니다.</p>

                <h5>[제 3조] PayApp 서비스 수수료 및 정산 보류(출금 제한) 고지</h5>
                <p>페이앱 결제 연동 완료 후 고객의 신용카드 및 각종 간편결제 승인 시 <strong>페이앱 표준 가맹 수수료(신용카드 결제 시 3.4% 내외 등)</strong>가 정산 시 공제됩니다. 페이앱 연동은 시스템 상 즉시 결제 연동(결제창 구동)이 가능하나, 점주가 필수 서류(사업자등록증, 통장 사본 등)를 제출하여 <strong>페이앱 가입 심사 최종 승인을 받기 전까지는 대금의 정산(출금)이 불가(보류)</strong>합니다.</p>
              </div>
            </div>

            {/* ✍️ 약관 동의 체크박스 */}
            <div className="agreement-checkboxes">
              <label className="agree-check">
                <input type="checkbox" checked={agreed1} onChange={e => setAgreed1(e.target.checked)} />
                <span>[필수] PayApp 승인 대행 및 가맹 신청 정보 제공에 동의합니다.</span>
              </label>
              <label className="agree-check">
                <input type="checkbox" checked={agreed2} onChange={e => setAgreed2(e.target.checked)} />
                <span>[필수] PayApp 결제 시 발생 요율 수수료(3.4% 등) 공제 고지를 확인했습니다.</span>
              </label>
              <label className="agree-check">
                <input type="checkbox" checked={agreed3} onChange={e => setAgreed3(e.target.checked)} />
                <span>[필수] 최종 가맹 승인 전까지 결제 대금 정산(출금)이 보류됨에 동의합니다.</span>
              </label>
              <label className="agree-check">
                <input type="checkbox" checked={agreed4} onChange={e => setAgreed4(e.target.checked)} />
                <span>[필수] 가입 1개월 경과 후 미납 연체 시 시스템 운영 정지 조항에 동의합니다.</span>
              </label>
            </div>

            {/* 📞 본인인증 */}
            <div className="auth-verification-box">
              <h4>✍️ 계약서 서명 전 본인인증</h4>
              <div className="auth-flex">
                <select value={carrier} onChange={e => setCarrier(e.target.value)}>
                  <option value="SKT">SKT</option>
                  <option value="KT">KT</option>
                  <option value="LGU+">LGU+</option>
                  <option value="MVNO">알뜰폰</option>
                </select>
                <input type="text" readOnly value={userName} placeholder="이름" />
                <input type="text" readOnly value={phone} placeholder="휴대폰 번호" />
                <button type="button" className="btn-auth-send" onClick={sendVerification}>
                  {authSent ? '재전송' : '인증번호 전송'}
                </button>
              </div>
              
              {authSent && !authVerified && (
                <div className="auth-code-row">
                  <input type="text" value={authCode} onChange={e => setAuthCode(e.target.value)} placeholder="인증번호 6자리 입력" />
                  <button type="button" className="btn-auth-verify" onClick={verifyCode}>인증 완료</button>
                </div>
              )}
              {authVerified && <div className="auth-verified-badge">✓ 본인 인증 완료</div>}
            </div>

            {/* 🎨 서명 패드 (Canvas) */}
            <div className="signature-pad-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4>✍️ 전자 서명 패드</h4>
                <button type="button" className="btn-clear-canvas" onClick={handleClearCanvas}>지우기</button>
              </div>
              <canvas
                ref={canvasRef}
                width={360}
                height={160}
                className="signature-canvas"
                onMouseDown={handleStartDraw}
                onMouseMove={handleDraw}
                onMouseUp={handleEndDraw}
                onMouseLeave={handleEndDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleDraw}
                onTouchEnd={handleEndDraw}
              />
              <p className="signature-guide">마우스 드래그 또는 손가락으로 사인을 그려주세요.</p>
            </div>

            <div className="signup-actions" style={{ marginTop: '24px' }}>
              <button className="btn-back" disabled={isSubmitting} onClick={() => setStep(2)}>이전 단계</button>
              <button className="btn-submit" disabled={isSubmitting || !authVerified} onClick={handleSubmit}>
                {isSubmitting ? '계약 제출 중...' : '계약 제출 및 완료'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
