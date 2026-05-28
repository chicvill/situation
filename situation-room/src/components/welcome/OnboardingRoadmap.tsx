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
        borderRadius: '16px',
        padding: '16px 18px',
        border: '1px solid var(--border)',
        boxShadow: '0 12px 28px rgba(0,0,0,0.04)',
        marginBottom: '18px',
        textAlign: 'left'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.5rem' }}>🚀</span>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)' }}>
              가맹점 개설 및 운영 로드맵 (체크리스트)
            </h4>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              기초 세팅을 완료하여 스마트 매장 운영을 바로 시작하세요!
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '1.3rem', fontWeight: 900, color: progressPercent === 100 ? '#10b981' : 'var(--accent-orange)' }}>
            {progressPercent}%
          </span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>({completedCount}/4 완료)</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: '6px', background: 'var(--bg-secondary)', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px', border: '1px solid var(--border)' }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Step 1 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: isStep1Done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(249, 115, 22, 0.04)', padding: '10px 14px', borderRadius: '12px', border: isStep1Done ? '1px solid rgba(16, 185, 129, 0.15)' : '1px dashed rgba(249, 115, 22, 0.25)' }}>
          <div style={{ fontSize: '1.3rem', marginTop: '1px' }}>{isStep1Done ? '✅' : '🏠'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1.0rem', fontWeight: 800, color: isStep1Done ? 'var(--text-main)' : 'var(--accent-orange)' }}>
                1단계: 매장 개설 (집짓기 완공)
              </strong>
              <span style={{ fontSize: '0.78rem', padding: '1px 6px', borderRadius: '50px', fontWeight: 800, background: isStep1Done ? 'rgba(16, 185, 129, 0.12)' : 'rgba(249, 115, 22, 0.12)', color: isStep1Done ? '#10b981' : 'var(--accent-orange)' }}>
                {isStep1Done ? '완료' : '진행중'}
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
              상호명, 개업일 및 테이블별 좌석 수 등 매장 기본 정보를 등록합니다.
            </p>
            {!isStep1Done && (
              <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--accent-orange)', fontWeight: 700 }}>
                👇 아래 '내 매장 개설 및 등록' 신청서를 채워 완공해 주세요.
              </div>
            )}
          </div>
        </div>

        {/* Step 2 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: isStep2Done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: '12px', border: isStep2Done ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border)', opacity: isStep1Done ? 1 : 0.5 }}>
          <div style={{ fontSize: '1.3rem', marginTop: '1px' }}>{isStep2Done ? '✅' : '📋'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1.0rem', fontWeight: 800, color: isStep2Done ? 'var(--text-main)' : 'var(--text-muted)' }}>
                2단계: 디지털 메뉴 (메뉴 스캔 완료)
              </strong>
              <span style={{ fontSize: '0.78rem', padding: '1px 6px', borderRadius: '50px', fontWeight: 800, background: isStep2Done ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)', color: isStep2Done ? '#10b981' : 'var(--text-muted)' }}>
                {isStep2Done ? '완료' : (isStep1Done ? '활성화' : '대기')}
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
              실물 메뉴판이나 영수증을 AI 스캔하여 디지털 메뉴 구성을 완료합니다.
            </p>
            {isStep1Done && !isStep2Done && (
              <button
                onClick={() => onNavigate('menu')}
                className="confirm-btn"
                style={{ marginTop: '8px', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '800', background: 'linear-gradient(135deg, var(--accent-orange), #ea580c)', border: 'none', color: 'white', cursor: 'pointer' }}
              >
                📸 이미지/메뉴판 AI 스캔 등록 ➔
              </button>
            )}
          </div>
        </div>

        {/* Step 3 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: isStep3Done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: '12px', border: isStep3Done ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border)', opacity: isStep2Done ? 1 : 0.5 }}>
          <div style={{ fontSize: '1.3rem', marginTop: '1px' }}>{isStep3Done ? '✅' : '🖨️'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1.0rem', fontWeight: 800, color: isStep3Done ? 'var(--text-main)' : 'var(--text-muted)' }}>
                3단계: 테이블 QR 인쇄 및 부착
              </strong>
              <span style={{ fontSize: '0.78rem', padding: '1px 6px', borderRadius: '50px', fontWeight: 800, background: isStep3Done ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)', color: isStep3Done ? '#10b981' : 'var(--text-muted)' }}>
                {isStep3Done ? '완료' : (isStep2Done ? '활성화' : '대기')}
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
              좌석에 맞는 스마트 주문용 가변 QR 코드를 출력하여 자리에 부착합니다.
            </p>
            {isStep2Done && !isStep3Done && (
              <button
                onClick={() => {
                  onStep3Complete();
                  onNavigate('qr');
                }}
                className="confirm-btn"
                style={{ marginTop: '8px', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '800', background: 'linear-gradient(135deg, var(--accent-orange), #ea580c)', border: 'none', color: 'white', cursor: 'pointer' }}
              >
                🖨️ QR 인쇄하러 가기 ➔
              </button>
            )}
          </div>
        </div>

        {/* Step 4 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: isStep4Done ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: '12px', border: isStep4Done ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid var(--border)', opacity: isStep1Done ? 1 : 0.5 }}>
          <div style={{ fontSize: '1.3rem', marginTop: '1px' }}>{isStep4Done ? '✅' : '👥'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1.0rem', fontWeight: 800, color: isStep4Done ? 'var(--text-main)' : 'var(--text-muted)' }}>
                4단계: 직원 가입 및 권한 승인
              </strong>
              <span style={{ fontSize: '0.78rem', padding: '1px 6px', borderRadius: '50px', fontWeight: 800, background: isStep4Done ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)', color: isStep4Done ? '#10b981' : 'var(--text-muted)' }}>
                {isStep4Done ? '완료' : (isStep1Done ? '활성화' : '대기')}
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
              함께 일할 사원을 매장과 연결하고 권한 및 출퇴근 규칙을 세팅합니다.
            </p>
            {isStep1Done && !isStep4Done && (
              <button
                onClick={() => onNavigate('hr')}
                className="confirm-btn"
                style={{ marginTop: '8px', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '800', background: 'linear-gradient(135deg, var(--accent-orange), #ea580c)', border: 'none', color: 'white', cursor: 'pointer' }}
              >
                👥 직원 관리 & 권한 세팅 ➔
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Celebration Box */}
      {progressPercent === 100 && (
        <div
          style={{
            marginTop: '16px',
            padding: '14px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '2px solid #10b981',
            textAlign: 'center',
            boxShadow: '0 6px 18px rgba(16, 185, 129, 0.12)',
          }}
        >
          <div style={{ fontSize: '2.0rem', marginBottom: '6px' }}>🎉🚀🎊</div>
          <h5 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 900, color: '#34d399' }}>
            가맹점 최종 세팅 완료! 정상 운영 개시
          </h5>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
            축하합니다! 기초 세팅이 성공적으로 수립되었습니다. 손님들은 테이블 QR 코드로 AI 대화 주문이 가능하며, 주방 및 POS에서 자동 관리가 개시됩니다.
          </p>
        </div>
      )}
    </div>
  );
};
