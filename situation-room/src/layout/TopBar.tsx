import React from 'react';

interface TopBarProps {
  storeName: string;
  user: any;
  currentTime: Date;
  isCustomerMode: boolean;
  onMenuOpen: () => void;
  onSwitchStore: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  storeName,
  user,
  currentTime,
  isCustomerMode,
  onMenuOpen,
  onSwitchStore: _onSwitchStore,
}) => {
  return (
    <header className="premium-top-bar" style={{
      padding: '0 18px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '58px',
      gap: '12px',
    }}>
      {/* Left: hamburger + store name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        {!isCustomerMode && user && user.role !== 'staff' && (
          <button
            onClick={onMenuOpen}
            style={{
              background: 'none', border: 'none',
              padding: '6px', margin: '-6px',
              cursor: 'pointer', color: 'var(--text-main)',
              display: 'flex', alignItems: 'center',
              borderRadius: 'var(--radius-sm)',
              flexShrink: 0,
              transition: 'background var(--transition-fast)',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <div style={{
          fontSize: '1rem',
          fontWeight: '900',
          color: 'var(--text-main)',
          letterSpacing: '-0.4px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }} title={storeName}>
          {storeName || '우리식당'}
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={_onSwitchStore}
            style={{
              background: 'rgba(249,115,22,0.12)',
              color: 'var(--accent-orange)',
              border: '1px solid rgba(249,115,22,0.3)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: '800',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '4px',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--accent-orange)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(249,115,22,0.12)';
              e.currentTarget.style.color = 'var(--accent-orange)';
            }}
          >
            🔄 매장변경
          </button>
        )}
      </div>

      {/* Right: user badge + clock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {!isCustomerMode && user && (
          <div style={{
            background: 'var(--accent-orange-light)',
            color: 'var(--accent-orange)',
            border: '1px solid rgba(249,115,22,0.2)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            fontWeight: '800',
            whiteSpace: 'nowrap',
          }}>
            {user.name}
          </div>
        )}
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: '600', lineHeight: 1 }}>
            {currentTime.getFullYear()}.{String(currentTime.getMonth()+1).padStart(2,'0')}.{String(currentTime.getDate()).padStart(2,'0')}
          </div>
          <div style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: '900', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
            {String(currentTime.getHours()).padStart(2,'0')}:{String(currentTime.getMinutes()).padStart(2,'0')}
          </div>
        </div>
      </div>
    </header>
  );
};
