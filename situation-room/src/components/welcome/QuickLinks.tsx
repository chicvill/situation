import React from 'react';

interface QuickLink {
  label: string;
  tab: string;
  desc: string;
  icon: string;
}

interface QuickLinksProps {
  links: QuickLink[];
  onNavigate: (tab: any) => void;
}

export const QuickLinks: React.FC<QuickLinksProps> = ({ links, onNavigate }) => {
  return (
    <div>
      <h4 style={{ fontSize: '1.15rem', fontWeight: '800', margin: '0 0 12px 0', color: 'var(--text-main)' }}>
        ⚡ 맞춤형 원클릭 이동
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {links.map((link, idx) => (
          <div
            key={idx}
            onClick={() => onNavigate(link.tab)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '10px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.borderColor = 'var(--accent-orange)';
              e.currentTarget.style.boxShadow = '0 6px 15px rgba(249, 115, 22, 0.04)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.01)';
            }}
          >
            <span style={{ fontSize: '1.5rem' }}>{link.icon}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', textAlign: 'left' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.3px' }}>{link.label}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.2' }}>{link.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
