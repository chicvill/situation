import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

interface Props {
  storeId: string;
}

export const StoreManualEditor: React.FC<Props> = ({ storeId }) => {
  const [manual, setManual] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

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
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err) {
      setMessage("❌ 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="manual-editor-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px', borderBottom: '2px solid var(--primary)', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0, color: 'var(--primary)' }}>🧠 AI 전용 매뉴얼 설정</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          여기에 작성하는 내용은 AI 비서가 답변할 때 최우선으로 참고하는 '절대 규칙'이 됩니다.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <textarea
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="예: 우리 매장은 친절을 최우선으로 합니다. 브레이크 타임은 15:00~17:00입니다. 10인 이상 단체 예약은 전화로만 받습니다."
            style={{ 
              width: '100%', height: '400px', padding: '15px', borderRadius: '12px',
              border: '1px solid var(--border)', fontSize: '1rem', lineHeight: '1.6',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)', outline: 'none'
            }}
          />
          <button 
            onClick={handleSave}
            disabled={isSaving}
            style={{
              marginTop: '15px', width: '100%', padding: '15px', borderRadius: '12px',
              background: 'var(--primary)', color: 'white', fontWeight: 'bold',
              border: 'none', cursor: 'pointer', opacity: isSaving ? 0.7 : 1
            }}
          >
            {isSaving ? "반영 중..." : "AI에게 학습시키기"}
          </button>
          {message && <div style={{ marginTop: '10px', textAlign: 'center', color: message.includes('✅') ? '#059669' : '#dc2626' }}>{message}</div>}
        </div>

        <div style={{ flex: 0.7, minWidth: '250px', background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>💡 작성 팁</h4>
          <ul style={{ fontSize: '0.85rem', color: '#475569', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li><b>운영 시간</b>: 공휴일 휴무 여부 등</li>
            <li><b>예약 규칙</b>: 예약 가능 인원, 노쇼 방침 등</li>
            <li><b>서비스 마인드</b>: 답변 시 권장하는 어조 등</li>
            <li><b>재고 관리</b>: 특정 재고가 부족할 때의 대처법</li>
            <li><b>비상 연락망</b>: 특정 상황 시 보고 체계</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
