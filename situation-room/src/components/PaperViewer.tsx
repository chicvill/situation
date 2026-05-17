import React, { useState } from 'react';

const pillars = [
  {
    icon: '⚙️',
    title: '코드리스 논리 설계 (CodeLess Logic Matrix)',
    body: '전문 코딩 없이 [노출 · 입력 · 버튼 · 분기점] 4요소를 매트릭스 형태로 정의합니다. 운영자의 비즈니스 철학이 담긴 이 표가 실행 엔진이 되어, 코드 수정 없이도 전체 운영 로직을 즉각 변경할 수 있습니다.',
  },
  {
    icon: '🧠',
    title: 'AI Knowledge Pool (지능형 지식 저장소)',
    body: '고정 DB 스키마 대신 AI가 실시간으로 상황 데이터를 해석해 의미 있는 정보만 필터링하는 "No-DB" 지향의 유연한 저장 체계를 갖춥니다.',
  },
  {
    icon: '♻️',
    title: '객체 수명 주기 관리 (Object Lifecycle)',
    body: '데이터는 살아있는 Bundle 객체로 관리됩니다. 생성 → 진행 → 완료 → 아카이브로 이어지는 명확한 수명 주기를 따르며, 폐기 시까지 모든 이력이 투명하게 기록됩니다.',
  },
  {
    icon: '💬',
    title: '대화형 프로세스 & 마이크로 UI (Conversational UX)',
    body: '복잡한 대시보드 대신 카카오톡 방식의 대화형 인터페이스를 제공합니다. AI가 가이드가 되어 분절된 마이크로 UI를 제시함으로써 스마트폰 화면에서 인지 부하를 최소화합니다.',
  },
];

const compareRows = [
  ['운영 논리', '코드에 고착됨', '템플릿에 의존함', '매트릭스 기반 자율 가변'],
  ['데이터 처리', '경직된 DB 스키마', '제한적 데이터 연동', '지능형 객체 수명 주기 관리'],
  ['사용자 환경', '대시보드 중심', '폼(Form) 중심', '대화형 & 마이크로 UI 중심'],
  ['지능화 수준', '별도 모듈 필요', '기능적 한계 존재', '지능형 지식 풀이 시스템의 핵'],
];

export const PaperViewer: React.FC = () => {
  const [openPillar, setOpenPillar] = useState<number | null>(null);

  return (
    <div style={{ padding: '24px', maxWidth: '860px', margin: '0 auto', background: 'var(--bg-main)', minHeight: '100vh' }}>

      {/* 제목 */}
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>📜</div>
        <h1 style={{ fontSize: '1.55rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 6px' }}>
          지능형 객체 중심의 코드리스(CodeLess) 운영 아키텍처
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
          AI Knowledge Pool과 대화형 인터페이스를 활용한 자율 진화형 매장 관리 시스템 연구
        </p>
      </div>

      {/* 초록 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px 26px', marginBottom: '24px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.08em', marginBottom: '10px' }}>ABSTRACT · 초록</div>
        <p style={{ fontSize: '0.95rem', lineHeight: '1.8', color: 'var(--text-main)', margin: 0 }}>
          본 연구는 고정된 스키마와 경직된 로직을 가진 전통적 IT 시스템의 한계를 극복하기 위해,
          <strong> AI Knowledge Pool</strong>과 <strong>객체 수명 주기(Lifecycle)</strong> 관리에 기반한
          <strong> 코드리스(CodeLess)</strong> 운영 아키텍처를 제안한다.
          스마트폰 환경에 최적화된 <strong>대화형 인터페이스</strong>와 <strong>마이크로 UI</strong>를 통해
          초보 사용자도 직관적으로 시스템을 운영할 수 있는 환경을 구축하였다.
          실제 매장 관리 앱 개발 과정에서의 시행착오를 바탕으로, 지식 기반 자율 운영 시스템의
          기술적 우위와 경제성을 입증한다.
        </p>
      </div>

      {/* 4대 핵심 아키텍처 */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.08em', marginBottom: '14px' }}>THE 4 PILLARS · 4대 핵심 아키텍처</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pillars.map((p, i) => (
            <div key={i}
              style={{ background: 'var(--surface)', border: `1px solid ${openPillar === i ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
              <button
                onClick={() => setOpenPillar(openPillar === i ? null : i)}
                style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: '1.4rem' }}>{p.icon}</span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{p.title}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: openPillar === i ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
              </button>
              {openPillar === i && (
                <div style={{ padding: '0 20px 18px 52px', fontSize: '0.9rem', lineHeight: '1.75', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                  <p style={{ margin: '14px 0 0' }}>{p.body}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 사례 분석 */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px 26px', marginBottom: '24px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.08em', marginBottom: '14px' }}>CASE STUDY · 개발 실무 경험</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '4px' }}>⏱ "30분의 늪"과 테스트 혁신</div>
            <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.7', color: 'var(--text-muted)' }}>단순 수정 후에도 재부팅과 설정에 30분이 소요되던 비효율을 <strong>실시간 디버그 패널</strong> 도입으로 해결. 디버깅 효율 극대화 및 개발 주기를 단축했다.</p>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '4px' }}>🗄 데이터 무결성과 아카이빙 로직</div>
            <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.7', color: 'var(--text-muted)' }}>데이터 삭제 대신 <strong>상태 기반 아카이빙</strong> 방식을 채택. 결제와 동시에 매출 데이터가 유실될 리스크를 차단하고 BI 원천 데이터를 확보했다.</p>
          </div>
        </div>
      </div>

      {/* 비교 테이블 */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.08em', marginBottom: '14px' }}>COMPARATIVE ANALYSIS · 기존 방법론과의 비교</div>
        <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                {['비교 항목', '전통적 코딩', '일반 노코드', '본 AI 코드리스'].map((h, i) => (
                  <th key={i} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 800, color: i === 3 ? 'var(--primary)' : 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: ri < compareRows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: '11px 14px', color: ci === 3 ? 'var(--primary)' : 'var(--text-main)', fontWeight: ci === 0 ? 700 : ci === 3 ? 700 : 400, background: ci === 3 ? 'rgba(var(--primary-rgb, 99,102,241),0.04)' : 'transparent' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 결론 */}
      <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #818cf8 100%)', borderRadius: '16px', padding: '24px 28px', marginBottom: '32px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', marginBottom: '10px' }}>CONCLUSION · 결론</div>
        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.8', color: 'white' }}>
          AI Knowledge Pool과 코드리스 설계가 결합했을 때 얻을 수 있는 운영의 자유도를 실증하였다.
          특히 대화형 프로세스는 모바일 운영 환경에서 절대적 우위를 점하며,
          이는 향후 AI가 스스로 시스템을 최적화하는 <strong>자율 운영 매장(Autonomous Store)</strong>의 표준 모델이 될 것이다.
        </p>
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', paddingBottom: '40px' }}>
        © 2026 AI Situation Room Research Lab · All rights reserved
      </div>
    </div>
  );
};
