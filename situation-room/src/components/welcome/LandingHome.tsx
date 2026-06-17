import React, { useState } from 'react';
import './LandingHome.css';

interface LandingHomeProps {
  onNavigate: (view: 'login' | 'signup') => void;
}

export const LandingHome: React.FC<LandingHomeProps> = ({ onNavigate }) => {
  // 요금제 계산기 상태
  const [options, setOptions] = useState({
    waiting: false,
    call: false,
    points: false,
    staff: false,
    parking: false,
  });

  const toggleOption = (key: keyof typeof options) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const calculateMonthlyFee = () => {
    const base = 10000;
    const activeCount = Object.values(options).filter(Boolean).length;
    return base + activeCount * 1000;
  };

  return (
    <div className="landing-container animate-fade-in">
      {/* 🚀 Header */}
      <header className="landing-header">
        <div className="landing-logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">SITUATION SMART POS</span>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => onNavigate('login')}>
            로그인 / 시작하기
          </button>
        </div>
      </header>

      {/* 🌟 Hero Section */}
      <section className="landing-hero">
        <div className="hero-badge">🚀 가입비 0원 • 위약금 0원 • 첫 달 무료</div>
        <h1 className="hero-title">
          비싼 키오스크 대신<br />
          <span>고객의 스마트폰</span>으로 끝내는 주문 결제
        </h1>
        <p className="hero-subtitle">
          테이블 QR 주문부터 선불 결제, 포인트 적립, 직원 QR 출퇴근 관리와 AI 임금 산출, 
          그리고 정교한 매출 데이터 분석까지. 단 하나의 지능형 모바일 시스템으로 통합하세요.
        </p>
        <div className="hero-buttons" style={{ flexDirection: 'column', gap: '8px' }}>
          <button className="btn-hero-primary" style={{ maxWidth: '380px', width: '100%' }} onClick={() => onNavigate('login')}>
            시작하기 (로그인 및 매장 개설)
          </button>
          <div style={{ fontSize: '1.05rem', color: '#94a3b8', fontWeight: '700', marginTop: '8px' }}>
            문의 : 010-3269-3343
          </div>
        </div>
      </section>

      {/* 📊 Kiosk vs Situation Smart POS */}
      <section className="landing-compare">
        <h2 className="section-title">일반 키오스크 vs 본 시스템 비교</h2>
        <div className="compare-grid">
          <div className="compare-card compare-kiosk">
            <h3>일반 하드웨어 키오스크</h3>
            <ul>
              <li>❌ <strong>초기 비용 부담:</strong> 기기 대당 300~500만 원 상당의 설치비</li>
              <li>❌ <strong>공간 차지와 정체:</strong> 매장 입구 정체 및 공간 협소화 유발</li>
              <li>❌ <strong>대면 업무 유지:</strong> 손님이 자리를 비우고 카운터/키오스크로 이동 필요</li>
              <li>❌ <strong>추가 주문 한계:</strong> 1~N차 합석 주문 및 구두 추가 주문 불가</li>
              <li>❌ <strong>유지보수 비용:</strong> 용지 교체, 하드웨어 고장 시 출장 수리비 발생</li>
            </ul>
          </div>

          <div className="compare-card compare-situation">
            <div className="popular-badge">추천</div>
            <h3>SITUATION 스마트 QR 오더</h3>
            <ul>
              <li>✅ <strong>초기비용 0원:</strong> 고객의 스마트폰으로 자리에 앉아 즉시 결제</li>
              <li>✅ <strong>공간 제약 제로:</strong> 테이블마다 QR 배치로 줄서기 전면 해소</li>
              <li>✅ <strong>업무 부담의 획기적 감소:</strong> 주문 및 선불 결제 자동화로 대면 최소화</li>
              <li>✅ <strong>지능형 주문 지원:</strong> 합석/추가 주문, 비서 형태 구두(음성) 주문 가능</li>
              <li>✅ <strong>완벽한 통합 솔루션:</strong> 호출, 대기, 포인트, 주차, 근태, 매출 분석 기본 탑재</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 💸 요금 계산기 */}
      <section className="landing-pricing">
        <h2 className="section-title">유연하고 정직한 요금 정책</h2>
        <p className="section-subtitle">기본 사용료 10,000원에 필요한 부가 기능만 합리적으로 추가해 보세요.</p>
        
        <div className="pricing-box">
          <div className="pricing-selector">
            <h3>이용할 추가 기능 선택</h3>
            <div className="option-list">
              <label className={`option-item ${options.waiting ? 'active' : ''}`}>
                <input type="checkbox" checked={options.waiting} onChange={() => toggleOption('waiting')} />
                <span className="option-name">🛎️ 대기열 관리 서비스</span>
                <span className="option-price">+ 월 1,000원</span>
              </label>
              <label className={`option-item ${options.call ? 'active' : ''}`}>
                <input type="checkbox" checked={options.call} onChange={() => toggleOption('call')} />
                <span className="option-name">🔔 테이블 직원 호출 벨</span>
                <span className="option-price">+ 월 1,000원</span>
              </label>
              <label className={`option-item ${options.points ? 'active' : ''}`}>
                <input type="checkbox" checked={options.points} onChange={() => toggleOption('points')} />
                <span className="option-name">🪙 단골 고객 포인트 적립</span>
                <span className="option-price">+ 월 1,000원</span>
              </label>
              <label className={`option-item ${options.staff ? 'active' : ''}`}>
                <input type="checkbox" checked={options.staff} onChange={() => toggleOption('staff')} />
                <span className="option-name">👥 직원 QR 출퇴근 & 임금 분석</span>
                <span className="option-price">+ 월 1,000원</span>
              </label>
              <label className={`option-item ${options.parking ? 'active' : ''}`}>
                <input type="checkbox" checked={options.parking} onChange={() => toggleOption('parking')} />
                <span className="option-name">🚗 주차 차량 자동 등록</span>
                <span className="option-price">+ 월 1,000원</span>
              </label>
            </div>
          </div>

          <div className="pricing-display">
            <div className="pricing-inner">
              <h4>예상 월 서비스 이용료</h4>
              <div className="fee-amount">
                <span>{calculateMonthlyFee().toLocaleString()}</span>원 / 월
              </div>
              <ul className="pricing-features">
                <li>🎁 첫 달은 완전히 무료 체험</li>
                <li>언제 해지해도 해지 위약금 없음</li>
                <li>가입비 및 설치비 일체 면제</li>
              </ul>
              <button className="btn-pricing-action" onClick={() => onNavigate('login')}>
                이 구성으로 시작하기
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 🔒 PayApp 안내 및 수수료 고지 */}
      <section className="landing-payapp">
        <h2 className="section-title">페이앱(PayApp) 공식 파트너쉽 결제</h2>
        <div className="payapp-card">
          <div className="payapp-icon">💳</div>
          <div className="payapp-info">
            <h3>단말기 없는 무선 카드 결제 시스템</h3>
            <p>
              본 스마트 POS는 대표 PG사인 **페이앱(PayApp)** 단일 결제를 채택하고 있습니다. 
              고객들은 자리에 앉아 휴대폰 결제창을 통해 안전하게 앱카드 또는 간편결제를 이용할 수 있습니다.
            </p>
            <div className="payapp-terms-box">
              <strong>⚠️ 필수 중요 고지 사항:</strong>
              <ul>
                <li><strong>결제 수수료:</strong> 결제 시 PG 표준 수수료(신용카드 결제 시 3.4% 내외)가 발생하며, 이는 대금 정산 시 선공제 지급됩니다.</li>
                <li><strong>가맹점 최종 승인 필수:</strong> 가입 신청 즉시 매장 설정 및 직원 출퇴근 등 내부 기능은 바로 활성화되어 테스트 가능하나, 실제 고객 거래 대금의 <strong>출금 및 정산</strong>을 받으시려면 최고관리자(Admin)에게 필수 가맹 서류를 제출하여 PayApp 최종 심사 승인을 완료하셔야 정상 지급이 가능합니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© 2026 SITUATION Smart Store POS. All rights reserved.</p>
        <p>본 시스템은 페이앱 공식 연동 API를 사용하며 가입 대행 서비스를 무료로 지원합니다.</p>
      </footer>
    </div>
  );
};
