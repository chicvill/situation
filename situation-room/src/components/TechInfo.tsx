import { useState } from 'react';

interface Tech {
  name: string;
  role: string;
  detail: string;
  link?: string;
}

interface Group {
  icon: string;
  label: string;
  color: string;
  techs: Tech[];
}

const groups: Group[] = [
  {
    icon: '🤖', label: 'AI & 개발 도구', color: '#7c3aed',
    techs: [
      {
        name: 'Claude Code (Anthropic)',
        role: 'AI 페어 프로그래머',
        detail: '전체 시스템 설계·구현·디버깅·리팩터링을 Claude Code AI와 대화 기반으로 진행했습니다. 코딩 경험 없이도 프로덕션 수준의 앱을 만들 수 있음을 직접 증명한 프로젝트입니다.',
      },
      {
        name: 'Claude API (claude-sonnet-4-6)',
        role: '매장 AI 비서 엔진',
        detail: 'Anthropic의 LLM API를 호출해 점주 질문 응답, 매뉴얼 기반 가이드, 대화형 주문 흐름을 제공합니다. 지식 번들(Bundle)을 시스템 프롬프트에 주입해 매장 맞춤형 응답을 생성합니다.',
      },
    ],
  },
  {
    icon: '⚡', label: '프론트엔드', color: '#0ea5e9',
    techs: [
      {
        name: 'React 18 + TypeScript',
        role: 'UI 프레임워크',
        detail: '컴포넌트 기반 SPA로 구성. TypeScript로 타입 안전성을 확보하고, useState·useEffect·custom hooks로 실시간 상태를 관리합니다.',
      },
      {
        name: 'Vite',
        role: '빌드 도구 & 개발 서버',
        detail: 'ES 모듈 기반 초고속 번들러. HMR(Hot Module Replacement)로 저장 즉시 화면이 갱신되어 개발 속도를 극대화합니다.',
      },
      {
        name: 'CSS Variables + 다크모드',
        role: '테마 시스템',
        detail: '--primary, --surface, --text-muted 등 CSS 변수를 전역 선언해 다크/라이트 전환과 일관된 디자인 토큰을 관리합니다.',
      },
      {
        name: 'Web Speech API',
        role: '음성 인식 (브라우저 내장)',
        detail: '별도 라이브러리 없이 브라우저 내장 SpeechRecognition API로 한국어 음성 명령을 처리합니다. HTTPS 환경에서만 동작합니다.',
      },
    ],
  },
  {
    icon: '🐍', label: '백엔드', color: '#10b981',
    techs: [
      {
        name: 'FastAPI (Python)',
        role: 'REST API 서버',
        detail: '비동기 Python 웹 프레임워크. 자동 OpenAPI 문서 생성, Pydantic 데이터 검증, 라우터 분리(주문·결제·예약·포인트·주차 등)로 구조화된 API를 제공합니다.',
      },
      {
        name: 'Python 3.11',
        role: '백엔드 언어',
        detail: 'asyncio 기반 비동기 처리, psycopg2로 PostgreSQL 연동, paho-mqtt로 MQTT 이벤트 발행을 담당합니다.',
      },
    ],
  },
  {
    icon: '📡', label: '실시간 통신 — MQTT', color: '#f59e0b',
    techs: [
      {
        name: 'MQTT (paho-mqtt / EMQX)',
        role: '실시간 이벤트 메시징',
        detail: '주문 접수·테이블 호출·대기 입장·주차 만료 등 모든 실시간 알림을 MQTT pub/sub 패턴으로 처리합니다. REST 폴링 없이 수 밀리초 내에 모든 기기에 이벤트가 전파됩니다.',
      },
      {
        name: 'MQTT 토픽 구조',
        role: 'store/{storeId}/{event}',
        detail: '매장 ID로 토픽을 격리해 멀티 매장 환경에서 이벤트 혼선 없이 운영합니다. ORDER_PLACED, CALL_REQUESTED, WAITING_REGISTERED 등의 이벤트 타입을 정의합니다.',
      },
    ],
  },
  {
    icon: '☁️', label: '인프라 & 배포', color: '#6366f1',
    techs: [
      {
        name: 'Cloudflare',
        role: 'DNS · CDN · SSL · Tunnel',
        detail: 'situation.chicvill.store 도메인을 관리하며, Cloudflare Tunnel로 로컬/렌더 서버를 외부에 HTTPS로 안전하게 노출합니다. DDoS 방어와 전 세계 CDN 캐싱도 제공합니다.',
      },
      {
        name: 'Render',
        role: '클라우드 앱 호스팅',
        detail: 'FastAPI 백엔드와 React 프론트엔드를 Render 플랫폼에 배포합니다. GitHub 푸시 시 자동 빌드·배포(CI/CD)가 실행됩니다.',
      },
      {
        name: 'Docker',
        role: '컨테이너화',
        detail: 'Dockerfile로 FastAPI 서버를 이미지화해 로컬·Render·기타 환경에서 동일하게 실행합니다. 의존성 충돌 없이 어디서나 동일한 환경을 보장합니다.',
      },
      {
        name: 'Git / GitHub',
        role: '버전 관리 & CI/CD',
        detail: '전체 소스 코드를 Git으로 관리하고 GitHub에서 협업합니다. main 브랜치 푸시 → Render 자동 배포 파이프라인이 연결되어 있습니다.',
      },
    ],
  },
  {
    icon: '🗄️', label: '데이터베이스', color: '#0891b2',
    techs: [
      {
        name: 'Supabase',
        role: 'PostgreSQL 클라우드 호스팅',
        detail: 'AWS 기반 관리형 PostgreSQL 서비스. 별도 DB 서버 운영 없이 연결 문자열만으로 프로덕션 DB를 사용합니다. 실시간 구독, Row Level Security, 무료 티어를 제공합니다.',
      },
      {
        name: 'PostgreSQL',
        role: '관계형 데이터베이스',
        detail: '주문·세션·포인트·예약·주차·직원 데이터를 테이블로 관리합니다. Window 함수(RANK OVER, COUNT OVER)로 포인트 백분위 순위를 실시간 계산합니다.',
      },
    ],
  },
  {
    icon: '💳', label: '결제 & 외부 연동', color: '#e11d48',
    techs: [
      {
        name: 'PayApp',
        role: '한국 결제 게이트웨이',
        detail: '카드 및 가상 결제 요청·상세조회·취소 API를 연동합니다. 팝업 창으로 결제 흐름을 분리해 메인 앱 상태를 유지하고, postMessage로 결제 결과를 부모 창에 전달합니다.',
      },
      {
        name: 'QR Server API',
        role: 'QR 코드 이미지 생성',
        detail: 'api.qrserver.com 외부 API에 인코딩된 데이터를 URL 파라미터로 전달해 즉시 QR 이미지를 생성합니다. 서버 저장 없이 동적으로 QR을 렌더링합니다.',
      },
    ],
  },
  {
    icon: '🏗️', label: '아키텍처 & 설계 패턴', color: '#854d0e',
    techs: [
      {
        name: '객체지향 프로그래밍 (OOP)',
        role: 'Bundle 수명 주기 설계',
        detail: '모든 운영 데이터를 생성 → 진행 → 완료 → 아카이브 수명 주기를 가진 "Bundle 객체"로 모델링합니다. 상태 기반 아카이빙으로 데이터 무결성을 보장합니다.',
      },
      {
        name: 'CodeLess Logic Matrix',
        role: '본 시스템 핵심 아키텍처',
        detail: '[노출·입력·버튼·분기점] 4요소 매트릭스로 운영 로직을 정의합니다. 코드 수정 없이 AI가 매트릭스를 해석해 전체 운영 흐름을 실행합니다.',
      },
      {
        name: 'Pub/Sub 패턴',
        role: 'MQTT 이벤트 아키텍처',
        detail: '발행자(백엔드)와 구독자(프론트엔드)가 직접 결합하지 않고 브로커를 통해 통신합니다. 이벤트 기반 설계로 새 기능 추가 시 기존 코드를 수정하지 않아도 됩니다.',
      },
      {
        name: 'RESTful API',
        role: 'HTTP 인터페이스 설계',
        detail: 'GET·POST·PUT·DELETE 메서드와 명확한 URI 구조(/api/reservation/{id}, /api/points/use 등)로 직관적인 API를 설계합니다.',
      },
      {
        name: 'Custom Hooks 패턴',
        role: 'React 상태 로직 분리',
        detail: 'useStoreSync, useStoreFilter, useSituation 등 커스텀 훅으로 MQTT 구독·스토어 필터·AI 번들 로직을 컴포넌트에서 분리해 재사용성을 높입니다.',
      },
    ],
  },
];

export const TechInfo = () => {
  const [openGroup, setOpenGroup] = useState<number | null>(0);
  const [openTech, setOpenTech] = useState<string | null>(null);

  const totalTechs = groups.reduce((s, g) => s + g.techs.length, 0);

  return (
    <div style={{ padding: '24px', maxWidth: '860px', margin: '0 auto', background: 'var(--bg-main)', minHeight: '100vh' }}>

      {/* 헤더 */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 4px' }}>🛠 기술 정보</h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
          Situation Room 개발에 직·간접적으로 사용된 주요 기술 스택 요약
        </p>

        {/* 뱃지 요약 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {groups.map((g, i) => (
            <button key={i} onClick={() => setOpenGroup(openGroup === i ? null : i)}
              style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                background: openGroup === i ? g.color : 'var(--surface)',
                color: openGroup === i ? 'white' : 'var(--text-muted)',
                outline: `1px solid ${openGroup === i ? g.color : 'var(--border)'}`,
                transition: 'all 0.2s' }}>
              {g.icon} {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* 총계 */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: '기술 카테고리', value: groups.length },
          { label: '기술 항목', value: totalTechs },
          { label: '핵심 언어', value: 'Python · TypeScript' },
        ].map((stat, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 18px', flex: 1, minWidth: '120px' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-main)' }}>{stat.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* 그룹 아코디언 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {groups.map((g, gi) => {
          const isGroupOpen = openGroup === gi;
          return (
            <div key={gi} style={{ borderRadius: '16px', border: `1px solid ${isGroupOpen ? g.color : 'var(--border)'}`, overflow: 'hidden', background: 'var(--surface)', transition: 'border-color 0.2s' }}>

              {/* 그룹 헤더 */}
              <button onClick={() => setOpenGroup(isGroupOpen ? null : gi)}
                style={{ width: '100%', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{g.icon}</span>
                <span style={{ flex: 1, fontWeight: 800, fontSize: '0.98rem', color: isGroupOpen ? g.color : 'var(--text-main)' }}>{g.label}</span>
                <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '10px', background: isGroupOpen ? g.color : 'var(--bg-main)', color: isGroupOpen ? 'white' : 'var(--text-muted)', fontWeight: 700 }}>
                  {g.techs.length}개
                </span>
                <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: isGroupOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>▼</span>
              </button>

              {/* 기술 목록 */}
              {isGroupOpen && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '8px 12px 12px' }}>
                  {g.techs.map((tech, ti) => {
                    const key = `${gi}-${ti}`;
                    const isOpen = openTech === key;
                    return (
                      <div key={ti}
                        onClick={() => setOpenTech(isOpen ? null : key)}
                        style={{ margin: '6px 0', borderRadius: '12px', border: `1px solid ${isOpen ? g.color : 'var(--border)'}`, background: isOpen ? 'var(--bg-main)' : 'transparent', cursor: 'pointer', overflow: 'hidden', transition: 'all 0.15s' }}>

                        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: isOpen ? g.color : 'var(--text-main)' }}>{tech.name}</div>
                            <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)', marginTop: '1px' }}>{tech.role}</div>
                          </div>
                          <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-muted)', fontSize: '0.78rem' }}>▼</span>
                        </div>

                        {isOpen && (
                          <div style={{ padding: '0 16px 14px 34px', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: '1.7', borderTop: '1px solid var(--border)' }}>
                            <p style={{ margin: '10px 0 0' }}>{tech.detail}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', fontSize: '0.76rem', color: 'var(--text-muted)', padding: '32px 0 40px', lineHeight: '1.8' }}>
        Built with AI · Deployed on Cloudflare + Render · Powered by Claude
      </div>
    </div>
  );
};

export default TechInfo;
