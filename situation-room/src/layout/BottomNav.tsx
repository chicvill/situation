import React from 'react';
import type { NotificationStates } from '../hooks/useStoreSync';

interface NavItem { label: string; icon: string; tab: string; special?: boolean }
interface BottomNavProps {
  navItems: NavItem[];
  activeTab: string;
  flashingTabs: NotificationStates;
  callCount: number;
  waitingCount: number;
  parkingCount: number;
  callFlashing: boolean;
  waitingFlashing: boolean;
  parkingFlashing: boolean;
  onNavigate: (tab: string) => void;
  onVoice: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  navItems,
  activeTab,
  flashingTabs,
  callCount,
  waitingCount,
  parkingCount,
  callFlashing,
  waitingFlashing,
  parkingFlashing,
  onNavigate,
  onVoice,
}) => {
  return (
    <nav className="bottom-nav-bar-9">
      {navItems.map((item, idx) => {
        const shouldBlink =
          (item.tab === 'call'    && (callFlashing || flashingTabs.call)       && activeTab !== 'call')    ||
          (item.tab === 'waiting' && (waitingFlashing || flashingTabs.waiting) && activeTab !== 'waiting') ||
          (item.tab === 'reserve' && flashingTabs.reserve && activeTab !== 'reserve') ||
          (item.tab === 'counter' && flashingTabs.counter && activeTab !== 'counter') ||
          (item.tab === 'parking' && parkingFlashing     && activeTab !== 'parking') ||
          (item.tab === 'points'  && flashingTabs.points  && activeTab !== 'points');

        const badge =
          item.tab === 'call'    && callCount > 0    ? callCount :
          item.tab === 'waiting' && waitingCount > 0 ? waitingCount :
          item.tab === 'parking' && parkingCount > 0 ? parkingCount : 0;

        return (
          <div
            key={idx}
            className={`nav-item-9 ${item.special ? 'mic-special-centered' : ''} ${activeTab === item.tab ? 'active' : ''} ${shouldBlink ? 'blink-call-bell' : ''}`}
            onClick={() => item.special ? onVoice() : onNavigate(item.tab)}
          >
            <div className="nav-icon" style={{ position: 'relative', display: 'inline-block' }}>
              {item.icon}
              {badge > 0 && (
                <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>
              )}
            </div>
            <div className="nav-label">{item.label}</div>
          </div>
        );
      })}
    </nav>
  );
};
