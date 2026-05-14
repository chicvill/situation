import React from 'react';

interface OnboardingRoadmapProps {
  isStep1Done: boolean;
  isStep2Done: boolean;
  isStep3Done: boolean;
  isStep4Done: boolean;
  progressPercent: number;
  completedCount: number;
  userId: string;
  onNavigate: (tab: any) => void;
  onStep3Complete: () => void;
}

export const OnboardingRoadmap: React.FC<OnboardingRoadmapProps> = ({
  isStep1Done,
  isStep2Done,
  isStep3Done,
  isStep4Done,
  progressPercent,
  completedCount,
  userId: _userId,
  onNavigate,
  onStep3Complete,
}) => {
  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01))',
        borderRadius: '24px',
        padding: '28px',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.06)',
        marginBottom: '35px',
        textAlign: 'left'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.6rem' }}>🚀</span>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>
              스마트 가맹점 개설 및 운영 개시 로드맵 (Checklist)
            </h4>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              아래 4가지 기초 필수 세팅을 단계별로 가이드에 따라 완공하여 스마트 매장 자율 운영을 무결하게 시작하세요!
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 900, color: progressPercent === 100 ? '#10b981' : 'var(--accent-orange)' }}>
            {progressPercent}%
          </span>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>({completedCount}/4 완료)</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: '8px', background: 'var(--bg-secondary)', borderRadius: '10px', overflow: 'hidden', marginBottom: '25px', border: '1px solid var(--border)' }}>
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: progressPercent === 100
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : 'linear-gradient(90deg, var(--accent-orange), #ea580c)',
            borderRadius: '10px',
            transition: 'width 0.5s ease-in-out'
          }}
        />
      </div>

      {/* 4 Steps Checklist Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

        {/* Step 1 */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', background: isStep1Done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(249, 115, 22, 0.04)', padding: '16px', borderRadius: '16px', border: isStep1Done ? '1px solid rgba(16, 185, 129, 0.15)' : '1px dashed rgba(249, 115, 22, 0.25)' }}>
          <div style={{ fontSize: '1.5rem', marginTop: '2px' }}>{isStep1Done ? '✅' : '🏠'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.95rem', color: isStep1Done ? 'var(--text-main)' : 'var(--accent-orange)' }}>
                1단계: 내 매장 개설 (내 집 짓기 완공)
              </strong>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '50px', fontWeight: 800, background: isStep1Done ? 'rgba(16, 185, 129, 0.12)' : 'rgba(249, 115, 22, 0.12)', color: isStep1Done ? '#10b981' : 'var(--accent-orange)' }}>
                {isStep1Done ? '완료됨' : '진행 중'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              상호명, 개업일자 및 각 테이블 번호별 인석 정보(인쇄 테이블 정보) 등 매장 고유 뼈대를 정식 등록합니다.
            </p>
            {!isStep1Done && (
              <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--accent-orange)', fontWeight: 700 }}>
                👇 아래 '내 매장 개설 및 등록' 신청서를 채워 완공해 주세요.
              </div>
            )}
          </div>
        </div>

        {/* Step 2 */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', background: isStep2Done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '16px', border: isStep2Done ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border)', opacity: isStep1Done ? 1 : 0.5 }}>
          <div style={{ fontSize: '1.5rem', marginTop: '2px' }}>{isStep2Done ? '✅' : '📋'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.95rem', color: isStep2Done ? 'var(--text-main)' : 'var(--text-muted)' }}>
                2단계: 디지털 메뉴 구성 (메뉴판 스캔 완료)
              </strong>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '50px', fontWeight: 800, background: isStep2Done ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)', color: isStep2Done ? '#10b981' : 'var(--text-muted)' }}>
                {isStep2Done ? '완료됨' : (isStep1Done ? '활성화' : '대기 중')}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              가맹점의 대표 메뉴판, 빌지, 영수증 실물 이미지를 AI 스캔하여 3초 만에 디지털 메뉴 구성을 완공합니다.
            </p>
            {isStep1Done && !isStep2Done && (
              <button
                onClick={() => onNavigate('menu')}
                className="confirm-btn"
                style={{ marginTop: '10px', padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '800', background: 'linear-gradient(135deg, var(--accent-orange), #ea580c)', border: 'none', color: 'white', cursor: 'pointer' }}
              >
                📸 이미지/메뉴판 AI 스캔 등록 ➔
              </button>
            )}
          </div>
        </div>

        {/* Step 3 */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', background: isStep3Done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '16px', border: isStep3Done ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border)', opacity: isStep2Done ? 1 : 0.5 }}>
          <div style={{ fontSize: '1.5rem', marginTop: '2px' }}>{isStep3Done ? '✅' : '🖨️'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.95rem', color: isStep3Done ? 'var(--text-main)' : 'var(--text-muted)' }}>
                3단계: 스마트 주문용 테이블 QR 코드 인쇄 및 부착
              </strong>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '50px', fontWeight: 800, background: isStep3Done ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)', color: isStep3Done ? '#10b981' : 'var(--text-muted)' }}>
                {isStep3Done ? '완료됨' : (isStep2Done ? '활성화' : '대기 중')}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              설정한 좌석 규모에 맞게 자리세팅 QR 코드가 마스터 인쇄지로 가변 출력됩니다. 각 손님 자리에 예쁘게 오려 부착해 주세요!
            </p>
            {isStep2Done && !isStep3Done && (
              <button
                onClick={() => {
                  onStep3Complete();
                  onNavigate('qr');
                }}
                className="confirm-btn"
                style={{ marginTop: '10px', padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '800', background: 'linear-gradient(135deg, var(--accent-orange), #ea580c)', border: 'none', color: 'white', cursor: 'pointer' }}
              >
                🖨️ 인쇄 센터에서 QR 마스터 인쇄하기 ➔
              </button>
            )}
          </div>
        </div>

        {/* Step 4 */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', background: isStep4Done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '16px', border: isStep4Done ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border)', opacity: isStep1Done ? 1 : 0.5 }}>
          <div style={{ fontSize: '1.5rem', marginTop: '2px' }}>{isStep4Done ? '✅' : '👥'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.95rem', color: isStep4Done ? 'var(--text-main)' : 'var(--text-muted)' }}>
                4단계: 근무 직원(점원/매니저) 가입 및 최종 권한 승인
              </strong>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '50px', fontWeight: 800, background: isStep4Done ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)', color: isStep4Done ? '#10b981' : 'var(--text-muted)' }}>
                {isStep4Done ? '완료됨' : (isStep1Done ? '활성화' : '대기 중')}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              함께 일할 첫 직원을 가맹 매장 소속으로 연결하고 권한(시급, 출근 조건)을 세팅합니다.
            </p>
            {isStep1Done && !isStep4Done && (
              <button
                onClick={() => onNavigate('hr')}
                className="confirm-btn"
                style={{ marginTop: '10px', padding: '6px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '800', background: 'linear-gradient(135deg, var(--accent-orange), #ea580c)', border: 'none', color: 'white', cursor: 'pointer' }}
              >
                👥 직원 관리 및 권한 세팅하러 가기 ➔
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Celebration Box */}
      {progressPercent === 100 && (
        <div
          style={{
            marginTop: '25px',
            padding: '20px',
            borderRadius: '16px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '2px solid #10b981',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🎉🚀🎊</div>
          <h5 style={{ margin: '0 0 5px 0', fontSize: '1.15rem', fontWeight: 900, color: '#34d399' }}>
            스마트 가맹점 최종 세팅 완료 및 정상 운영 개시!
          </h5>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
            축하합니다 대표님! 기초 세팅이 완벽히 수립되었습니다. 이제 손님들은 테이블 QR 코드로 자유롭게 AI 비서와 대화 주문이 가능하며, 주방 상황판과 POS 패드를 통해 자동 주문 관리가 시작됩니다.
          </p>
        </div>
      )}
    </div>
  );
};
