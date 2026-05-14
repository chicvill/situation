import React from 'react';
import type { NotificationStates } from '../hooks/useStoreSync';

interface NavItem { label: string; icon: string; tab: string; special?: boolean }
interface BottomNavProps {
  navItems: NavItem[];
  activeTab: string;
  flashingTabs: NotificationStates;
  onNavigate: (tab: string) => void;
  onVoice: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  navItems,
  activeTab,
  flashingTabs,
  onNavigate,
  onVoice,
}) => {
  return (
    <nav className="bottom-nav-bar-9">
      {navItems.map((item, idx) => {
        const shouldBlink =
          (item.tab === 'call'    && flashingTabs.call    && activeTab !== 'call')    ||
          (item.tab === 'waiting' && flashingTabs.waiting && activeTab !== 'waiting') ||
          (item.tab === 'reserve' && flashingTabs.reserve && activeTab !== 'reserve') ||
          (item.tab === 'parking' && flashingTabs.parking && activeTab !== 'parking') ||
          (item.tab === 'points'  && flashingTabs.points  && activeTab !== 'points');

        return (
          <div
            key={idx}
            className={`nav-item-9 ${item.special ? 'mic-special-centered' : ''} ${activeTab === item.tab ? 'active' : ''} ${shouldBlink ? 'blink-call-bell' : ''}`}
            onClick={() => item.special ? onVoice() : onNavigate(item.tab)}
          >
            <div className="nav-icon">{item.icon}</div>
            <div className="nav-label">{item.label}</div>
          </div>
        );
      })}
    </nav>
  );
};
