import React from 'react';

interface SideDrawerProps {
  isOpen: boolean;
  storeName: string;
  user: any;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  storeName,
  user,
  onClose,
  onNavigate,
  onLogout,
}) => {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(2px)',
            zIndex: 1999,
            animation: 'fadeIn 0.2s ease'
          }}
        />
      )}

      {/* Drawer */}
      <div className={`side-menu-drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-logo">
            {storeName.length > 12 ? storeName.slice(0, 12) + '…' : storeName}
            <span>{user?.role === 'admin' ? '관리자' : user?.role === 'owner' ? '점주' : user?.role === 'manager' ? '점장' : '점원'}</span>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <nav className="drawer-nav">
          <button onClick={() => onNavigate('manual')}>📜 매장 운영 매뉴얼</button>
          <button onClick={() => onNavigate('settings')}>⚙️ 매장 설정</button>
          <button onClick={() => onNavigate('menu')}>📔 메뉴 설정</button>
          <button onClick={() => onNavigate('hr')}>👥 직원 · 근태 · 급여 관리</button>
          {user?.role === 'admin' && (
            <>
              <button onClick={() => onNavigate('admin')}>🏢 매장관리 (관리자 전용)</button>
              <button onClick={() => onNavigate('inventory')}>🧠 AI 지식 인벤토리</button>
              <button onClick={() => onNavigate('paper')}>📄 AI 논문 보기</button>
            </>
          )}
          <hr />
          <button onClick={onLogout} style={{ color: '#f87171' }}>🔓 로그아웃</button>
        </nav>
      </div>
    </>
  );
};
