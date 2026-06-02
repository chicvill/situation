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
      { title: '매장 초기 설정 및 접속', desc: '시스템 로그인 방법 및 AI 간편 등록을 통한 기초 세팅 가이드입니다.', children: [
        { label: '📍 웹 접속 및 로그인', detail: '발급받으신 관리자 전용 웹페이지 주소(예: https://situation.chicvill.store)로 매장 태블릿이나 PC에서 접속합니다. 초기 화면에서 매장명을 입력하고 사용할 비밀번호를 설정하면 로그인 가능합니다. 이후 접속 시 설정한 비밀번호를 사용합니다.' },
        { label: '📍 AI 간편 등록 (매장 & 메뉴)', detail: '수기 입력 번거로움 없이 AI 기술로 1분 만에 등록합니다.\n1) [매장 설정] 메뉴로 진입합니다.\n2) 사업자등록증 사진을 업로드하면 상호, 주소, 대표자명이 자동 입력됩니다.\n3) 기존 매장 메뉴판 사진을 업로드하면 카테고리별로 메뉴 이름과 가격이 자동 등록됩니다.' },
        { label: '영업 시간 & 테이블 구성', detail: '평일/주말 영업 시간과 브레이크타임을 설정합니다. 또한 매장의 총 테이블 수와 좌석 수를 등록하여 입장 및 예약 배정에 활용합니다.' },
        { label: '스마트 토글 (기능별 On/Off)', detail: '매장 상황에 맞춰 스마트 직원 관리, N분의 1 더치페이 결제, 전광판 서비스, 직원 호출 벨, 고객 대기, 셀프 주차, 멤버십 포인트 등의 부가 기능을 온/오프 스위치로 자유롭게 활성화하거나 숨길 수 있습니다.' },
        { label: 'AI 비서 규칙 설정', detail: '고객 응대 시 사용할 말투, 와이파이 비밀번호, 비상 수칙 등 AI 비서가 최우선으로 준수해야 할 매장 고유의 규칙을 입력합니다.' },
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
    icon: '🔔', category: '상황판 조작 & 알림 설정', color: '#ec4899',
    items: [
      { title: '실시간 상황판(상황실) 사용법', desc: '매장 운영 중 항상 켜두고 보시게 될 핵심 관리 화면의 조작 및 알림 규칙입니다.', children: [
        { label: '📢 실시간 알림음 및 카드 표시', detail: '고객이 QR 주문, 직원 호출, 대기 접수를 완료하면 상황판 상단에 해당 카드가 띄워집니다. "딩동~" 하는 명확한 알림음과 함께 카드가 깜빡이므로 바쁜 매장에서도 쉽게 파악할 수 있습니다.' },
        { label: '⚠️ 소리 알림 필수 설정 (중요)', detail: '브라우저(크롬 등)의 자동 재생(Autoplay) 제한 정책으로 인해, 최초 접속 또는 새로고침 후 화면의 아무 곳이나 한 번 터치(클릭)하셔야 소리 알림 기능이 정상 작동합니다.' },
        { label: '👆 1회 터치 (상세 정보 확인)', detail: '카드를 한 번 터치하면 해당 테이블의 상세 요청 내용이나 주문 리스트를 우측/팝업에서 자세히 확인할 수 있습니다.' },
        { label: '✌️ 더블 터치 / 더블 클릭 (완료 처리)', detail: '주방 서빙이 끝났거나 고객 호출 응대(물 전달 등)가 완료된 후, 카드를 빠르게 두 번 연속 터치(더블 클릭)하면 해당 요청이 다음 단계로 진행되거나 완료 처리되어 상황판 목록에서 사라집니다.' },
      ]},
    ],
  },
  {
    icon: '💰', category: '주문 & 카운터', color: '#f59e0b',
    items: [
      { title: '카운터 주문 및 세션 관리', desc: 'POS 패드에서 수동 주문 등록 및 테이블 실시간 세션을 제어합니다. (현장 결제 불가 정책)', children: [
        { label: '무조건 모바일 선결제 원칙', detail: '고객은 테이블 QR 또는 모바일 주문창을 통해 카드/간편결제로 직접 선결제해야 주문이 주방으로 전송됩니다. 카운터에서는 임의의 카드리더기나 현금 직접 결제를 받지 않는 무인화 연동 시스템입니다.' },
        { label: '수동 구두 주문', detail: '스마트폰 미소지 고객이나 특수 상황에서 직원이 구두로 주문을 받아 카운터 POS에서 수동 등록하면 주방으로 주문서가 전송됩니다.' },
        { label: '세션 제어 및 퇴실', detail: '테이블의 미결제 잔액이 없고 서빙이 모두 완료되면 [종료] 버튼을 클릭하여 활성 세션을 닫고 테이블을 빈자리 상태로 초기화시킵니다.' },
      ]},
    ],
  },
  {
    icon: '🤝', category: 'N분의 1 더치페이 결제', color: '#6366f1',
    items: [
      { title: '실시간 분할 결제 흐름', desc: '매장 설정에서 활성화 시, 일행이 각자 휴대폰으로 나누어 결제할 수 있습니다.', children: [
        { label: '더치페이 On/Off 제어', detail: '점주 매장 설정에서 "더치페이 결제 사용" 스위치를 끄면 결제창에서 N분의 1 더치페이 계산기 및 QR 현황판 관련 버튼이 자동 비노출 처리됩니다.' },
        { label: '대표 주문자의 세션 생성', detail: '대표 고객이 "N분의 1 더치페이 계산"에서 인원수를 지정한 뒤 "일행과 나누어 결제하기"를 클릭하면 화면에 실시간 결제 현황과 동적 QR 코드가 렌더링됩니다.' },
        { label: '동행인의 스캔 및 랜딩', detail: '동행 고객들이 대표자의 QR 코드를 스캔하면 "분할 결제 대기실"로 자동 랜딩되어 자신의 1인당 할당액을 확인하고 카드/페이로 결제할 수 있습니다.' },
        { label: '100% 완결 시 주문 접수', detail: '동행자 및 대표자의 누적 결제액이 100% 채워지는 시점에 미결제 상태(unpaid) 주문들이 승격(paid)되며 주방 모니터로 주문서가 자동 인쇄/출력됩니다.' },
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
        { label: '새 예약 추가', detail: '우측 하단 [+] 버튼을 통해 신규 예약을 등록합니다. 이름, 연락처, 인원, 날짜 및 예약 시간(직관적인 원형 시간 선택기로 15분 단위 설정 가능)을 입력하고 배정 테이블을 선택합니다.' },
        { label: '1일 전 알림', detail: '예약 24시간 전 오버레이가 표시됩니다. 전화 확인 후 "확인 완료"를 누르면 다시 뜨지 않습니다.' },
        { label: '3시간 전 알림', detail: '예약 3시간 전 빨간 오버레이로 긴급 확인을 요청합니다.' },
        { label: '입장 처리 및 세션 연동', detail: '예약 손님이 도착하면 [입장 처리] 버튼을 누릅니다. 자동으로 해당 테이블 배정 화면이 열리고 실시간 세션이 활성화됩니다.' },
        { label: '수정 / 삭제', detail: '예약 카드의 수정·삭제 버튼으로 정보를 변경하거나 취소할 수 있습니다.' },
      ]},
    ],
  },
  {
    icon: '🚗', category: '주차 관리', color: '#64748b',
    items: [
      { title: '차량 무료 주차 처리', desc: '주차 탭에서 등록·만료 알림·완료 처리를 합니다.', children: [
        { label: '차량번호 등록 및 조회', detail: '고객 주문 완료 후 모바일 셀프 주차 등록 또는 주차 탭에서 직접 입력하여 등록 및 할인을 조회하고 적용 처리합니다.' },
        { label: '무료 시간 설정', detail: '매장 설정에서 기본 무료 주차 시간(분)을 지정합니다.' },
        { label: '만료 알림', detail: '설정 시간 초과 시 하단 배지와 MQTT 알림으로 즉시 표시됩니다.' },
      ]},
    ],
  },
  {
    icon: '🪙', category: '포인트 관리', color: '#d97706',
    items: [
      { title: '포인트 적립 & 사용 & 조회', desc: '포인트 탭에서 전체 고객 포인트 현황을 조회합니다.', children: [
        { label: '자동 적립', detail: '선결제 완료 시 고객의 휴대폰 번호로 결제금액의 일정 비율이 자동 적립됩니다.' },
        { label: '포인트 사용', detail: '결제 모달에서 휴대폰 번호 조회 후 보유 포인트를 차감하여 결제할 수 있습니다.' },
        { label: '누적 합계 & 순위', detail: '사용 가능 포인트와 별개로 누적 합계를 기록해 VIP 등급 산정에 사용합니다.' },
        { label: 'VIP 상위 10%', detail: '누적 포인트 기준 상위 10% 고객은 금빛 배지와 결제 시 VIP 플래시로 구분됩니다.' },
      ]},
    ],
  },
  {
    icon: '👥', category: '직원 · 근태 · 급여', color: '#0891b2',
    items: [
      { title: '직원 관리', desc: '직원·근태·급여 탭에서 등록부터 급여 계산까지 처리합니다.', children: [
        { label: '직원 관리 On/Off 제어', detail: '점주 매장 설정에서 "스마트 직원 관리 사용" 스위치를 끄면 대시보드와 메뉴 서랍에서 직원 관리 탭 및 기능 전체가 보이지 않도록 숨김 처리됩니다.' },
        { label: '개인 전화번호 로그인 ID', detail: '직원은 별도의 비밀 계정 생성 없이 본인의 개인 휴대전화 번호를 ID로 입력하여 매장 시스템에 간편하게 로그인합니다.' },
        { label: '직원 등록 및 승인', detail: '점주가 직원의 이름, 전화번호(로그인 ID), 역할, 시급을 등록하면 승인 처리 이후 즉시 계정이 활성화됩니다.' },
        { label: 'QR 출퇴근 기록', detail: '로그인한 직원이 매장 QR 코드를 스캔하면 위치(위도)와 근태 로그가 기록되며 근무 정산 시간이 자동 계산됩니다.' },
        { label: '급여 정산', detail: '시급 × 근무 시간을 자동 계산하여 정산 내역을 확인하고 급여 처리를 완료합니다.' },
      ]},
    ],
  },
  {
    icon: '🎤', category: 'AI 비서 (음성 & 대화)', color: '#7c3aed',
    items: [
      { title: 'AI 비서 활용', desc: '하단 중앙 마이크 버튼이나 홈 화면 대화 창으로 AI 비서를 사용합니다.', children: [
        { label: '대화창 아코디언 기능', detail: '모바일 AI 비서 화면에서 대화창 최상단 헤더를 클릭하면 대화창을 접거나 펼쳐서 모바일 주문 스크롤 영역을 최대한 넓게 확보할 수 있습니다.' },
        { label: '백그라운드 음성 안내 (TTS)', detail: 'AI 대화창이 아코디언 기능에 의해 접혀서(보이지 않아서) 화면에서 숨겨진 상태일 때에도 AI의 음성 안내와 피드백은 백그라운드에서 끝까지 정상 재생됩니다.' },
        { label: '음성 명령', detail: '"주문", "카운터" 등 키워드를 말하면 해당 탭으로 즉시 이동합니다.' },
        { label: '매뉴얼 기반 응답', detail: '매장 운영 매뉴얼에 입력한 내용을 우선 참고하여 답변합니다.' },
        { label: '상황 질문', detail: '"오늘 예약 있어?", "대기 몇 명이야?" 등 운영 현황을 자연어로 물어볼 수 있습니다.' },
      ]},
    ],
  },
  {
    icon: '💻', category: '권장 작동 환경 (TIP)', color: '#4b5563',
    items: [
      { title: '시스템 최적 작동 환경', desc: '원활하고 누락 없는 시스템 운영을 위한 하드웨어 및 네트워크 설정입니다.', children: [
        { label: '기기 및 브라우저 권장', detail: '화면이 넉넉하여 대시보드 시야 확보가 유리한 태블릿 PC (아이패드, 갤럭시탭 등) 또는 데스크톱 PC 사용을 적극 권장합니다. 인터넷 브라우저는 가장 호환성이 높은 Chrome(크롬) 앱을 이용해 주세요.' },
        { label: '매장 네트워크 (Wi-Fi)', detail: '손님의 오더 및 호출 등이 실시간 MQTT 프로토콜로 전송됩니다. 실시간 데이터 동기화를 위해 매장 내 와이파이(Wi-Fi) 연결을 끊김 없이 안정적으로 유지해 주세요.' },
        { label: '태블릿 볼륨 설정', detail: '시끄러운 주방이나 매장 소음 속에서 알림음이 묻힐 수 있습니다. 태블릿 기기의 미디어 알림 볼륨을 충분히 크게 설정해 두시길 바랍니다.' },
      ]},
    ],
  },
  {
    icon: '📞', category: '고객센터 & 장애 문의', color: '#dc2626',
    items: [
      { title: '개발사 엠큐넷 고객지원', desc: '매장 운영 중 발생하는 일체의 장애, 에러 해결 및 기능 건의 창구입니다.', children: [
        { label: '엠큐넷 (MQNET) 기술지원', detail: '시스템 오동작, 기능의 사용법 문의, 메뉴판 수정이나 매장 주소 변경 등에 어려움이 있다면 언제든 편하게 연락해 주세요.' },
        { label: '대표 연락처 및 이메일', detail: '• 전화번호: 010-3269-3343\n• 이메일: mqnet.gmail.com' },
        { label: '고객센터 운영시간', detail: '• 평일: 09:00 ~ 18:00\n• 점심시간: 12:00 ~ 13:00\n• 주말 및 공휴일: 휴무 (장애 발생 시 메일 또는 문자로 접수해 주시면 순차 연락 드립니다.)' },
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
