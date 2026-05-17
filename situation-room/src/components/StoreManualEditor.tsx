import { useState } from 'react';

interface TreeItem {
  title: string;
  desc: string;
  children?: { label: string; detail: string }[];
}

const sections: { icon: string; category: string; color: string; items: TreeItem[] }[] = [
  {
    icon: '🏪', category: '매장 개설 & 기본 설정', color: '#6366f1',
    items: [
      { title: '매장 정보 등록', desc: '홈 > 매장 설정에서 상호명·주소·전화번호를 입력합니다.', children: [
        { label: '영업 시간 설정', detail: '평일/주말 영업 시작·종료 시간과 브레이크타임을 설정합니다.' },
        { label: '테이블 구성', detail: '테이블 수와 좌석 수를 등록하여 입장·예약 배정에 활용합니다.' },
        { label: 'AI 비서 매뉴얼', detail: '고객 응대 말투, 와이파이 비밀번호, 비상 수칙 등 AI가 최우선 준수할 규칙을 입력합니다.' },
      ]},
    ],
  },
  {
    icon: '📔', category: '메뉴 관리', color: '#0ea5e9',
    items: [
      { title: '메뉴 카테고리 & 항목', desc: '메뉴 설정 탭에서 카테고리를 만들고 항목·가격·사진을 등록합니다.', children: [
        { label: '품절 처리', detail: '즉시 품절 토글로 모바일 주문 화면에서 해당 메뉴를 비활성화합니다.' },
        { label: '옵션 추가', detail: '사이즈·온도·추가 토핑 등 선택 옵션을 설정할 수 있습니다.' },
      ]},
    ],
  },
  {
    icon: '🖨️', category: 'QR 인쇄', color: '#8b5cf6',
    items: [
      { title: 'QR 종류별 인쇄', desc: '목적별 QR 코드를 생성하여 인쇄합니다.', children: [
        { label: '주문 QR', detail: '고객이 스캔하면 모바일 주문 화면으로 이동합니다.' },
        { label: '대기 등록 QR', detail: '대기 등록 화면으로 이동합니다.' },
        { label: '직원 출퇴근 QR', detail: '직원이 스캔하면 출퇴근 시간이 자동 기록됩니다.' },
        { label: 'WiFi QR', detail: '햄버거 메뉴 > WiFi QR 인쇄에서 SSID/비밀번호를 입력 후 인쇄합니다.' },
      ]},
    ],
  },
  {
    icon: '💰', category: '주문 & 카운터', color: '#f59e0b',
    items: [
      { title: '카운터에서 결제 처리', desc: '카운터 탭에서 수동 주문 입력과 포인트 결제를 처리합니다.', children: [
        { label: '포인트 조회', detail: '전화번호 입력 시 사용 가능 포인트와 누적 합계를 즉시 확인합니다.' },
        { label: 'VIP 단골 알림', detail: '상위 10% 고객 결제 시 화면에 VIP 플래시 오버레이가 표시됩니다.' },
        { label: '주차 연계 등록', detail: '결제 시 차량번호를 함께 입력하면 주차 무료 시간이 자동 등록됩니다.' },
      ]},
    ],
  },
  {
    icon: '🛎️', category: '대기 & 호출', color: '#10b981',
    items: [
      { title: '대기 등록 및 호출', desc: '고객이 QR로 대기 등록 후 준비되면 호출 알림이 발송됩니다.', children: [
        { label: '대기 탭', detail: '현재 대기 중인 명단을 확인하고 "입장" 처리 또는 "취소"합니다.' },
        { label: '호출 탭', detail: '테이블 호출 벨 요청을 확인하고 서비스 완료 처리합니다.' },
        { label: '실시간 뱃지', detail: '하단 네비게이션에 미처리 건수가 실시간 배지로 표시됩니다.' },
      ]},
    ],
  },
  {
    icon: '📅', category: '예약 관리', color: '#ef4444',
    items: [
      { title: '예약 접수부터 입장까지', desc: '예약 탭에서 접수·확정·입장을 일자 순으로 관리합니다.', children: [
        { label: '새 예약 추가', detail: '+ 새 예약 버튼으로 이름·연락처·인원·날짜·시간을 등록합니다.' },
        { label: '1일 전 알림', detail: '예약 24시간 전 오버레이가 표시됩니다. 전화 확인 후 "확인 완료"를 누르면 다시 뜨지 않습니다.' },
        { label: '3시간 전 알림', detail: '예약 3시간 전 빨간 오버레이로 긴급 확인을 요청합니다.' },
        { label: '입장 처리', detail: '"입장 처리" 버튼을 누르면 테이블 배정 화면이 열리고 세션이 활성화됩니다.' },
        { label: '수정 / 삭제', detail: '예약 카드의 수정·삭제 버튼으로 정보를 변경하거나 취소할 수 있습니다.' },
      ]},
    ],
  },
  {
    icon: '🚗', category: '주차 관리', color: '#64748b',
    items: [
      { title: '차량 무료 주차 처리', desc: '주차 탭에서 등록·만료 알림·완료 처리를 합니다.', children: [
        { label: '차량번호 등록', detail: '카운터 결제 연계 또는 주차 탭 직접 입력으로 등록합니다.' },
        { label: '무료 시간 설정', detail: '매장 설정에서 기본 무료 주차 시간(분)을 지정합니다.' },
        { label: '만료 알림', detail: '설정 시간 초과 시 하단 배지와 MQTT 알림으로 즉시 표시됩니다.' },
      ]},
    ],
  },
  {
    icon: '🪙', category: '포인트 관리', color: '#d97706',
    items: [
      { title: '포인트 적립 & 사용 & 조회', desc: '포인트 탭에서 전체 고객 포인트 현황을 조회합니다.', children: [
        { label: '자동 적립', detail: '카운터 결제 완료 시 결제금액의 일정 비율이 자동 적립됩니다.' },
        { label: '포인트 사용', detail: '카운터에서 전화번호 조회 후 보유 포인트를 차감 결제합니다.' },
        { label: '누적 합계 & 순위', detail: '사용 가능 포인트와 별개로 누적 합계를 기록해 VIP 등급 산정에 사용합니다.' },
        { label: 'VIP 상위 10%', detail: '누적 포인트 기준 상위 10% 고객은 금빛 배지와 결제 시 VIP 플래시로 구분됩니다.' },
      ]},
    ],
  },
  {
    icon: '👥', category: '직원 · 근태 · 급여', color: '#0891b2',
    items: [
      { title: '직원 관리', desc: '직원·근태·급여 탭에서 등록부터 급여 계산까지 처리합니다.', children: [
        { label: '직원 등록', detail: '이름·역할·시급을 등록합니다.' },
        { label: 'QR 출퇴근', detail: '직원이 QR을 스캔하면 출퇴근 시간이 자동 기록됩니다.' },
        { label: '근태 이력 조회', detail: '기간별 출퇴근 내역을 확인합니다.' },
        { label: '급여 계산', detail: '시급 × 근무 시간을 자동 계산하여 정산 내역을 확인합니다.' },
      ]},
    ],
  },
  {
    icon: '🎤', category: 'AI 비서 (음성 & 대화)', color: '#7c3aed',
    items: [
      { title: 'AI 비서 활용', desc: '하단 중앙 마이크 버튼이나 홈 화면 대화 창으로 AI 비서를 사용합니다.', children: [
        { label: '음성 명령', detail: '"주문", "카운터" 등 키워드를 말하면 해당 탭으로 즉시 이동합니다.' },
        { label: '매뉴얼 기반 응답', detail: '매장 운영 매뉴얼에 입력한 내용을 우선 참고하여 답변합니다.' },
        { label: '상황 질문', detail: '"오늘 예약 있어?", "대기 몇 명이야?" 등 운영 현황을 자연어로 물어볼 수 있습니다.' },
      ]},
    ],
  },
];

export const StoreManualEditor = (_props: { storeId?: string; user?: any }) => {
  const [openSection, setOpenSection] = useState<number | null>(0);
  const [openItem, setOpenItem] = useState<string | null>(null);

  return (
    <div style={{ padding: '24px', maxWidth: '820px', margin: '0 auto', background: 'var(--bg-main)', minHeight: '100vh' }}>

      {/* 헤더 */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 4px' }}>📜 매장 운영 매뉴얼</h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
          매장 개설부터 포인트·예약까지 — 주요 기능 한눈에 보기
        </p>
      </div>

      {/* 섹션 트리 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sections.map((sec, si) => {
          const isOpen = openSection === si;
          return (
            <div key={si} style={{ borderRadius: '16px', border: `1px solid ${isOpen ? sec.color : 'var(--border)'}`, overflow: 'hidden', transition: 'border-color 0.2s', background: 'var(--surface)' }}>

              {/* 섹션 헤더 */}
              <button
                onClick={() => setOpenSection(isOpen ? null : si)}
                style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{sec.icon}</span>
                <span style={{ flex: 1, fontWeight: 800, fontSize: '1rem', color: isOpen ? sec.color : 'var(--text-main)' }}>{sec.category}</span>
                <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>▼</span>
              </button>

              {/* 섹션 내용 */}
              {isOpen && (
                <div style={{ borderTop: `1px solid var(--border)`, padding: '4px 0 12px' }}>
                  {sec.items.map((item, ii) => {
                    const itemKey = `${si}-${ii}`;
                    const itemOpen = openItem === itemKey;
                    return (
                      <div key={ii} style={{ margin: '6px 16px 0' }}>

                        {/* 아이템 헤더 */}
                        <div
                          onClick={() => item.children ? setOpenItem(itemOpen ? null : itemKey) : undefined}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: itemOpen ? 'var(--bg-main)' : 'transparent', cursor: item.children ? 'pointer' : 'default', transition: 'background 0.15s' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sec.color, flexShrink: 0, marginTop: '6px' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <span>{item.title}</span>
                              {item.children && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-block', transition: 'transform 0.2s', transform: itemOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>▼</span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.5' }}>{item.desc}</div>
                          </div>
                        </div>

                        {/* 하위 항목 */}
                        {itemOpen && item.children && (
                          <div style={{ marginLeft: '18px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '6px' }}>
                            {item.children.map((child, ci) => (
                              <div key={ci} style={{ padding: '9px 14px', borderRadius: '9px', background: 'var(--bg-main)', border: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: sec.color, marginBottom: '3px' }}>{child.label}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.55' }}>{child.detail}</div>
                              </div>
                            ))}
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
    </div>
  );
};
