import { useState, useEffect } from 'react';
import { API_BASE } from '../config';

interface Props {
  storeId: string;
  user?: any;
}

// 여러 매장에 공통적으로 완벽하게 대응하는 표준 매뉴얼 예제 템플릿
const COMMON_MANUAL_TEMPLATE = `### [우리 매장 운영 절대 규칙]

### ⏰ 영업 시간 및 쉬는 시간
- 영업시간: 오전 11:30 ~ 오후 22:00
- 브레이크타임: 오후 15:00 ~ 17:00 (오후 14:30 라스트오더)
- 정기휴무: 매주 화요일은 쉽니다.

### 📶 고객 편의 정보
- 매장 와이파이: MQnet_Wifi (비밀번호: 12345678)
- 화장실 위치: 주방 오른쪽 통로 건물 전용 복도 (비밀번호: *1234#)
- 주차 지원: 결제 시 직원에게 차량번호를 말씀해주시면 지하주차장 1시간 무료 정산을 등록해 드립니다.

### 👥 서비스 말투 가이드라인
- 고객 응대 시 항상 정중하고 신뢰감 넘치는 표준 존댓말을 구사해 주세요.
- 비서 역할을 할 때는 "저희 식당을 방문해 주셔서 진심으로 감사드립니다."로 친절하게 문장을 시작하세요.

### 📅 단체 예약 및 결제
- 8인 이상의 단체 손님은 당일 대화식 주문보다는 사전 전화 예약으로 접수하도록 안내해 주세요.
- 모든 포인트는 결제금액의 0.1%가 적립되며, 1,000 포인트부터 현금처럼 사용 가능합니다.

### ⚠️ 비상 및 기타 대응 수칙
- 와이파이가 작동하지 않는 비상 상황 시에는 공유기를 끈 뒤 10초 후에 재부팅하도록 사장님께 보고하세요.
- 손님이 물을 쏟거나 요청 사항이 있을 시 즉시 벨 호출 알림을 확인하고 신속히 이동해 대응합니다.`;

export const StoreManualEditor = ({ storeId, user }: Props) => {
  const [manual, setManual] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/store/manual?store_id=${storeId}`)
      .then(res => res.json())
      .then(data => setManual(data.manual || ""))
      .catch(err => console.error("Manual Load Error:", err));
  }, [storeId]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/store/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, manual })
      });
      if (res.ok) {
        setMessage("✅ 매뉴얼이 성공적으로 AI 지침에 반영되었습니다.");
        setIsEditing(false);
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      setMessage("❌ 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // 공통 템플릿 불러오기 기능
  const loadTemplate = () => {
    if (window.confirm("주의: 현재 작성 중인 내용이 지워지고 '공통 표준 매뉴얼 예제'로 덮어씌워집니다. 불러오시겠습니까?")) {
      setManual(COMMON_MANUAL_TEMPLATE);
      setIsEditing(true); // 편의상 바로 수정할 수 있게 편집 모드로 전환
      setMessage("📋 표준 공통 예제 템플릿이 로드되었습니다. 수정 후 'AI에게 학습시키기'를 꼭 눌러주세요!");
      setTimeout(() => setMessage(""), 5000);
    }
  };

  // 관리자 권한 여부 확인 (admin, owner, manager)
  const hasEditPermission = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'manager';

  // 줄바꿈 문자열을 아름다운 HTML 문단 목록으로 변환하는 파서
  const renderFormattedManual = () => {
    if (!manual.trim()) {
      return (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📖</div>
          <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)' }}>매장 매뉴얼이 비어 있습니다</h3>
          <p style={{ fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto 20px auto', lineHeight: '1.6' }}>
            매뉴얼을 새로 작성하거나, 다수의 매장에서 실제 공통으로 쓰이는 표준 예제를 불러와 자유롭게 편집 및 수정 테스트를 해볼 수 있습니다.
          </p>
          {hasEditPermission && (
            <button 
              onClick={loadTemplate}
              style={{
                padding: '12px 24px',
                borderRadius: '10px',
                background: 'var(--primary-soft)',
                color: 'var(--primary)',
                border: '1.5px dashed var(--primary)',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📋 표준 공통 예제 템플릿 불러오기
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="manual-booklet-paper" style={{
        background: '#fff',
        color: '#1e293b',
        padding: '35px 40px',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)',
        border: '1px solid #e2e8f0',
        lineHeight: '1.8',
        fontSize: '1.02rem',
        fontFamily: "'Inter', sans-serif",
        textAlign: 'left'
      }}>
        {manual.split('\n').map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} style={{ height: '14px' }} />;
          
          // 글머리 기호가 포함된 라인은 들여쓰기 셸로 감싸기
          if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
            return (
              <div key={idx} style={{ display: 'flex', gap: '8px', paddingLeft: '10px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>•</span>
                <span>{trimmed.substring(1).trim()}</span>
              </div>
            );
          }

          // 제목이나 대분류 성격인 경우 볼드 처리 및 마진 조율
          if (trimmed.endsWith(':') || trimmed.startsWith('###') || trimmed.startsWith('[')) {
            return (
              <h4 key={idx} style={{ 
                fontSize: '1.15rem', 
                fontWeight: '800', 
                color: '#0f172a', 
                marginTop: '25px', 
                marginBottom: '10px',
                borderLeft: '4px solid var(--primary)',
                paddingLeft: '10px'
              }}>
                {trimmed.replace(/###|\[|\]/g, '').trim()}
              </h4>
            );
          }

          return <p key={idx} style={{ margin: '0 0 10px 0' }}>{trimmed}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="manual-editor-container animate-fade-in" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      {/* 프리미엄 헤더 영역 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px', 
        borderBottom: '2px solid var(--primary)', 
        paddingBottom: '15px' 
      }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.6rem', fontWeight: 800 }}>📜 매장 운영 매뉴얼</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            {isEditing 
              ? "여기에 작성하는 내용은 AI 비서가 최우선으로 준수하는 매장의 법률이 됩니다." 
              : "우리 매장의 공식 가이드북 및 비서 인공지능 절대 규칙입니다."}
          </p>
        </div>
        
        {/* 우측 관리용 보조 버튼 묶음 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {hasEditPermission && (
            <button 
              onClick={loadTemplate}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px dashed var(--border)',
                fontWeight: '600',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="공통 예제로 덮어쓰기"
            >
              📋 예제 불러오기
            </button>
          )}

          {hasEditPermission && (
            <button 
              onClick={() => setIsEditing(!isEditing)}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: isEditing ? 'var(--surface)' : 'var(--primary)',
                color: isEditing ? 'var(--text-main)' : 'white',
                border: isEditing ? '1px solid var(--border)' : 'none',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
              }}
            >
              {isEditing ? "📄 매뉴얼 보기" : "✏️ 매뉴얼 수정"}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div style={{ 
          marginBottom: '15px', 
          padding: '12px', 
          borderRadius: '8px', 
          textAlign: 'center', 
          background: message.includes('✅') || message.includes('📋') ? '#ecfdf5' : '#fef2f2',
          color: message.includes('✅') || message.includes('📋') ? '#059669' : '#dc2626',
          fontWeight: '600',
          fontSize: '0.9rem',
          border: `1px solid ${message.includes('✅') || message.includes('📋') ? '#a7f3d0' : '#fecaca'}`
        }}>
          {message}
        </div>
      )}

      {isEditing && hasEditPermission ? (
        /* 에디터 편집 모드 */
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }} className="animate-fade-in">
          <div style={{ flex: 1, minWidth: '300px' }}>
            <textarea
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="예: 우리 매장은 친절을 최우선으로 합니다. 브레이크 타임은 15:00~17:00입니다. 10인 이상 단체 예약은 전화로만 받습니다."
              style={{ 
                width: '100%', height: '420px', padding: '20px', borderRadius: '12px',
                border: '1px solid var(--border)', fontSize: '1rem', lineHeight: '1.6',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)', outline: 'none',
                background: 'var(--surface)', color: 'var(--text-main)',
                fontFamily: 'inherit', boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button 
                onClick={() => setIsEditing(false)}
                style={{
                  flex: 0.4, padding: '15px', borderRadius: '12px',
                  background: 'var(--surface)', color: 'var(--text-main)', fontWeight: '700',
                  fontSize: '0.95rem', border: '1px solid var(--border)', cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  flex: 1, padding: '15px', borderRadius: '12px',
                  background: 'var(--accent)', color: 'white', fontWeight: '800',
                  fontSize: '1rem', border: 'none', cursor: 'pointer', opacity: isSaving ? 0.7 : 1,
                  boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)'
                }}
              >
                {isSaving ? "매장 규칙 반영 중..." : "💾 AI에게 학습시키기"}
              </button>
            </div>
          </div>

          <div style={{ flex: 0.7, minWidth: '250px', background: 'var(--primary-soft)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary)', fontWeight: 800 }}>💡 작성 추천 가이드라인</h4>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-main)', paddingLeft: '20px', lineHeight: '1.9', margin: 0 }}>
              <li><b>⏰ 매장 운영</b>: 영업 및 휴식 시간, 공휴일 휴무 여부</li>
              <li><b>🚗 편의 시설</b>: 와이파이 비번, 화장실 비밀번호, 무료 주차 시간</li>
              <li><b>📅 예약 규칙</b>: 예약 가능 시간 및 한계 인원수</li>
              <li><b>💁 친절한 말투</b>: 고객 응대 시 선호하는 어조 (예: "정중하고 존댓말로 안내")</li>
              <li><b>⚠️ 비상 수칙</b>: 특정 재고 소진이나 기기 고장 시 대응 체계</li>
            </ul>
          </div>
        </div>
      ) : (
        /* 읽기 전용 책자 모드 */
        <div className="animate-fade-in">
          {renderFormattedManual()}
        </div>
      )}
    </div>
  );
};
