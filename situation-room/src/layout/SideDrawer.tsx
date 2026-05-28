import React from 'react';
import { API_BASE } from '../config';

interface SideDrawerProps {
  isOpen: boolean;
  storeName: string;
  user: any;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
  onSwitchStore?: () => void;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  storeName,
  user,
  onClose,
  onNavigate,
  onLogout,
  onSwitchStore,
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
          <div className="drawer-section-label">운영 화면</div>
          <button onClick={() => onNavigate('home')}>🏠 홈</button>
          <button onClick={() => onNavigate('kitchen')}>👨‍🍳 주방 모니터</button>
          <button onClick={() => onNavigate('counter')}>💰 카운터</button>
          <button onClick={() => onNavigate('display')}>📢 전광판</button>
          <button onClick={() => onNavigate('qr')}>🖨️ QR 인쇄</button>
          <button onClick={() => onNavigate('wifi')}>📶 WiFi QR 인쇄</button>
          {(user?.role === 'admin' || user?.role === 'owner') && (
            <button onClick={() => onNavigate('stats')}>📊 통계</button>
          )}
          <hr />
          <div className="drawer-section-label">설정</div>
          <button onClick={() => onNavigate('manual')}>📜 매장 운영 매뉴얼</button>
          <button onClick={() => onNavigate('settings')}>⚙️ 매장 설정</button>
          <button onClick={() => onNavigate('menu')}>📔 메뉴 설정</button>
          <button onClick={() => onNavigate('hr')}>👥 직원 · 근태 · 급여 관리</button>
          <button onClick={() => onNavigate('tech')}>🛠 기술 정보</button>
          {user?.role === 'admin' && (
            <>
              <button onClick={() => onNavigate('admin')}>🏢 매장관리 (관리자 전용)</button>
              <button onClick={() => onNavigate('paper')}>📄 AI 논문 보기</button>
            </>
          )}
          <hr />
          {user?.role === 'admin' && onSwitchStore && (
            <button 
              onClick={onSwitchStore}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1.5px dashed rgba(249,115,22,0.4)',
                background: 'rgba(249,115,22,0.08)',
                color: 'var(--accent-orange)',
                fontWeight: '800',
                fontSize: '0.88rem',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '10px',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--accent-orange)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(249,115,22,0.08)';
                e.currentTarget.style.color = 'var(--accent-orange)';
              }}
            >
              🔄 매장 선택 홈 (관리자)
            </button>
          )}
          <button 
            onClick={() => window.open(`${API_BASE}/api/doc/checklist`, '_blank')}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1.5px solid rgba(59,130,246,0.3)',
              background: 'rgba(59,130,246,0.08)',
              color: '#60a5fa',
              fontWeight: '700',
              fontSize: '0.88rem',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#3b82f6';
              e.currentTarget.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(59,130,246,0.08)';
              e.currentTarget.style.color = '#60a5fa';
            }}
          >
            📋 최종 점검 리포트
          </button>
          <button onClick={onLogout} style={{ color: '#f87171' }}>🔓 로그아웃</button>

        </nav>
      </div>
    </>
  );
};
