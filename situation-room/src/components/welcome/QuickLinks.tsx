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
      <h4 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 20px 0', color: 'var(--text-main)' }}>
        ⚡ 역할 맞춤형 원클릭 이동
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        {links.map((link, idx) => (
          <div
            key={idx}
            onClick={() => onNavigate(link.tab)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '16px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'var(--accent-orange)';
              e.currentTarget.style.boxShadow = '0 10px 25px rgba(249, 115, 22, 0.06)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.02)';
            }}
          >
            <span style={{ fontSize: '1.8rem' }}>{link.icon}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)' }}>{link.label}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{link.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
