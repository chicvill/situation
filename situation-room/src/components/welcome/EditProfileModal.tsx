import React from 'react';

interface EditProfileModalProps {
  user: any;
  name: string;
  password: string;
  editedStoreName: string;
  isSaving: boolean;
  error: string;
  onNameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onStoreNameChange: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  user,
  name,
  password,
  editedStoreName,
  isSaving,
  error,
  onNameChange,
  onPasswordChange,
  onStoreNameChange,
  onClose,
  onSubmit,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
    >
      <div
        className="glass-panel"
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: '24px',
          padding: '30px',
          width: '100%',
          maxWidth: '450px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          position: 'relative'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: 'var(--text-main)',
            fontSize: '1.2rem',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ✕
        </button>

        <h3 style={{ fontSize: '1.3rem', fontWeight: '900', margin: '0 0 10px 0', color: 'var(--text-main)', textAlign: 'center' }}>
          👤 개인 정보 수정
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 25px 0' }}>
          계정 정보를 안전하게 수정하고 저장할 수 있습니다.
        </p>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' }}>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>아이디 (수정 불가)</label>
            <input
              type="text"
              value={user?.id || ''}
              disabled
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
                cursor: 'not-allowed'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="새로운 이름을 입력해 주세요"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'var(--surface)',
                border: '1.5px solid var(--border)',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-orange)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="기존 비밀번호 유지 (변경할 때만 입력)"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'var(--surface)',
                border: '1.5px solid var(--border)',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-orange)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {user?.role !== 'admin' && user?.role !== 'owner' && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>근무 매장</label>
              <input
                type="text"
                value={editedStoreName}
                onChange={(e) => onStoreNameChange(e.target.value)}
                placeholder="소속 매장명을 입력해 주세요"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-orange)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          )}

          {error && (
            <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: '700', textAlign: 'center', margin: '5px 0' }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="confirm-btn success-green"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              fontSize: '0.95rem',
              fontWeight: '800',
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isSaving ? '저장하는 중...' : '💾 개인정보 저장하기'}
          </button>
        </form>
      </div>
    </div>
  );
};
