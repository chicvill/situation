import { useState, useEffect } from 'react';
import { API_BASE } from '../config';

interface Props {
  storeId: string;
  user?: any;
}

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

  // 관리자 권한 여부 확인 (admin, owner, manager)
  const hasEditPermission = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'manager';

  // 줄바꿈 문자열을 아름다운 HTML 문단 목록으로 변환하는 파서
  const renderFormattedManual = () => {
    if (!manual.trim()) {
      return (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📖</div>
          <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)' }}>매장 매뉴얼이 비어 있습니다</h3>
          <p style={{ fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
            {hasEditPermission 
              ? "상단의 [✏️ 매뉴얼 수정] 버튼을 클릭하여 매장의 절대 규칙을 직접 입력해 주세요!" 
              : "등록된 매뉴얼이 없습니다. 매장 관리자에게 등록을 요청해 주세요."}
          </p>
        </div>
      );
    }

    return (
      <div className="manual-booklet-paper" style={{
        background: '#fff',
        color: '#1e293b',
        padding: '30px 40px',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)',
        border: '1px solid #e2e8f0',
        lineHeight: '1.8',
        fontSize: '1.05rem',
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
        
        {/* 관리자 권한이 있는 경우에만 수정하기 버튼 노출 */}
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

      {message && (
        <div style={{ 
          marginBottom: '15px', 
          padding: '12px', 
          borderRadius: '8px', 
          textAlign: 'center', 
          background: message.includes('✅') ? '#ecfdf5' : '#fef2f2',
          color: message.includes('✅') ? '#059669' : '#dc2626',
          fontWeight: '600',
          fontSize: '0.9rem',
          border: `1px solid ${message.includes('✅') ? '#a7f3d0' : '#fecaca'}`
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
            <button 
              onClick={handleSave}
              disabled={isSaving}
              style={{
                marginTop: '15px', width: '100%', padding: '15px', borderRadius: '12px',
                background: 'var(--accent)', color: 'white', fontWeight: '800',
                fontSize: '1rem', border: 'none', cursor: 'pointer', opacity: isSaving ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)'
              }}
            >
              {isSaving ? "매장 규칙 반영 중..." : "💾 AI에게 학습시키기"}
            </button>
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
