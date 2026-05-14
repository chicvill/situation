import React from 'react';

interface StoreCreationFormProps {
  newStoreId: string;
  newStoreName: string;
  newOwnerName: string;
  newBizNo: string;
  newOpenDate: string;
  newTablesConfig: string;
  isBuildingHouse: boolean;
  buildError: string;
  onStoreIdChange: (v: string) => void;
  onStoreNameChange: (v: string) => void;
  onOwnerNameChange: (v: string) => void;
  onBizNoChange: (v: string) => void;
  onOpenDateChange: (v: string) => void;
  onTablesConfigChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const StoreCreationForm: React.FC<StoreCreationFormProps> = ({
  newStoreId,
  newStoreName,
  newOwnerName,
  newBizNo,
  newOpenDate,
  newTablesConfig,
  isBuildingHouse,
  buildError,
  onStoreIdChange,
  onStoreNameChange,
  onOwnerNameChange,
  onBizNoChange,
  onOpenDateChange,
  onTablesConfigChange,
  onSubmit,
}) => {
  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(249, 115, 22, 0.02))',
        border: '2px solid var(--accent-orange)',
        borderRadius: '24px',
        padding: '30px',
        marginBottom: '35px',
        boxShadow: '0 15px 35px rgba(249, 115, 22, 0.08)',
        textAlign: 'left'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <span style={{ fontSize: '2rem' }}>🏠</span>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)' }}>내 매장 개설 및 등록 (내 집 짓기)</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            회원가입 승인을 축하드립니다! 대표님의 매장 정보를 기입하여 가맹점을 정식으로 개설하세요.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>가맹 상호명</label>
            <input
              type="text"
              value={newStoreName}
              onChange={(e) => onStoreNameChange(e.target.value)}
              placeholder="예: 시크빌"
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600 }}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>가맹점 고유 ID</label>
            <input
              type="text"
              value={newStoreId}
              onChange={(e) => onStoreIdChange(e.target.value)}
              placeholder="예: store-chicvill"
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600 }}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>대표자 성명</label>
            <input
              type="text"
              value={newOwnerName}
              onChange={(e) => onOwnerNameChange(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600 }}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>사업자등록번호</label>
            <input
              type="text"
              value={newBizNo}
              onChange={(e) => onBizNoChange(e.target.value)}
              placeholder="숫자 10자리 입력"
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600 }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>개업 일자</label>
            <input
              type="text"
              value={newOpenDate}
              onChange={(e) => onOpenDateChange(e.target.value)}
              placeholder="예: 20191216"
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600 }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>테이블 좌석 구성 (QR 인쇄용)</label>
            <input
              type="text"
              value={newTablesConfig}
              onChange={(e) => onTablesConfigChange(e.target.value)}
              placeholder="예: 1번: 4인석, 2번: 2인석, 3번: 4인석"
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: 600 }}
              required
            />
          </div>
        </div>
        <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '-4px', display: 'block' }}>
          ※ 쉼표(,)로 구분하여 필요한 테이블들을 좌석 수와 함께 기재해 주세요. QR 인쇄 센터 및 결제 패드에 동적 매핑됩니다.
        </small>

        {buildError && (
          <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, marginTop: '5px' }}>{buildError}</div>
        )}

        <button
          type="submit"
          disabled={isBuildingHouse}
          style={{
            marginTop: '10px',
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, var(--accent-orange) 0%, #ea580c 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            fontSize: '1rem',
            fontWeight: '900',
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(249, 115, 22, 0.25)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 12px 25px rgba(249, 115, 22, 0.35)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(249, 115, 22, 0.25)';
          }}
        >
          {isBuildingHouse ? '🏠 내 가맹점 열심히 짓는 중...' : '🏠 내 가맹점(집) 완공 및 등록 완료'}
        </button>
      </form>
    </div>
  );
};
