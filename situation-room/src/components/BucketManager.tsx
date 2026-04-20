import React from 'react';
import './BucketManager.css';
import type { BundleData } from '../types';

interface Props {
  bundles: BundleData[];
}

export const BucketManager: React.FC<Props> = ({ bundles }) => {
  const getIconForType = (type: string) => {
    switch (type) {
      case 'Menus': return '🍔';
      case 'PersonalInfos': return '👤';
      case 'Orders': return '🛒';
      case 'Log': return '📝';
      default: return '📦';
    }
  };

  return (
    <div className="bucket-manager">
      {bundles.length === 0 ? (
        <div className="glass-panel empty-state">
          아직 생성된 바구니가 없습니다.<br/>
          왼쪽 콘솔에서 상황을 입력하여 AI가 바구니를 생성하게 해보세요.
        </div>
      ) : (
        bundles.map((bundle) => (
          <div key={bundle.id} className="glass-panel bucket-card">
            <div className="bucket-header">
              <h3>
                {getIconForType(bundle.type)} {bundle.title}
              </h3>
              <span className="bucket-time">{bundle.timestamp}</span>
            </div>
            <div className="bucket-content">
              {bundle.items.map((item, index) => (
                <div key={index} className="bundle-item">
                  <span className="item-name">{item.name || JSON.stringify(item)}</span>
                  {item.value && <span className="item-value">{item.value}</span>}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
