import React, { useState, useEffect } from 'react';
import type { BundleData } from '../types';
import { useImageScan, ScanningOverlay, ScanChoiceModal } from '../hooks/useImageScan';

interface MenuManagerProps {
  bundles: BundleData[];
  onNavigate: (mode: any, tab?: any) => void;
}

interface MenuItem {
    id: string;
    name: string;
    price: string;
    emoji: string;
    category: string;
    description: string;
}

export const MenuManager: React.FC<MenuManagerProps> = ({ bundles, onNavigate }) => {
  const [localMenus, setLocalMenus] = useState<MenuItem[]>([]);

  useEffect(() => {
    const menuMap = new Map<string, MenuItem>();
    [...bundles].reverse().filter(b => b.type === 'Menus').forEach((bundle) => {
      bundle.items.forEach((item, idx) => {
        const id = `${bundle.id}-${idx}`;
        const emojiMatch = item.name.match(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/);
        const nameClean = item.name.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/, '').trim();
        if (nameClean && !menuMap.has(nameClean)) {
            menuMap.set(nameClean, {
              id, name: nameClean, price: item.value,
              emoji: emojiMatch ? emojiMatch[0] : '🍽️',
              category: '식사', description: '가져온 정보입니다.'
            });
        }
      });
    });
    setLocalMenus(Array.from(menuMap.values()));
  }, [bundles]);

  const { 
    isScanning, 
    showChoiceModal, 
    setShowChoiceModal,
    fileInputRef, 
    startScanFlow, 
    proceedToPickFile,
    handleFileChange 
  } = useImageScan({
    docType: 'menu',
    onSuccess: (result, overwrite) => {
        let scannedItems: any[] = [];
        if (result.menus && Array.isArray(result.menus)) {
            scannedItems = result.menus;
        } else if (Array.isArray(result)) {
            scannedItems = result;
        } else {
            const firstVal = Object.values(result)[0];
            scannedItems = Array.isArray(firstVal) ? firstVal : [];
        }

        if (scannedItems.length === 0) {
            alert('⚠️ 메뉴 정보를 추출하지 못했습니다.\n이미지가 선명한지 확인해 주세요.');
            return;
        }

        const newMenus = scannedItems.map((item, idx) => ({
            id: `scan-${Date.now()}-${idx}`,
            name: item.name || '이름 없음',
            price: (item.price || '0').toString(),
            emoji: '🍽️', category: '식사', description: 'AI 스캔 결과입니다.'
        }));

        if (overwrite) {
            setLocalMenus(newMenus);
        } else {
            setLocalMenus(prev => [...prev, ...newMenus]);
        }

        const actionText = overwrite ? '새 목록으로 교체' : '기존 목록에 추가';
        alert(`✅ ${newMenus.length}개의 메뉴가 ${actionText}되었습니다!\n화면 아래의 "저장" 버튼을 눌러야 최종 반영됩니다.`);
    },
  });

  const handleLocalChange = (id: string, field: keyof MenuItem, value: string) => {
    setLocalMenus(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const addMenuItem = () => {
    setLocalMenus(prev => [{
        id: Date.now().toString(),
        name: '',
        price: '',
        emoji: '🍽️',
        category: '식사',
        description: ''
    }, ...prev]);
  };

  const deleteMenuItem = (id: string) => {
    setLocalMenus(prev => prev.filter(m => m.id !== id));
  };

  const handleSaveAll = async () => {
    const items = localMenus
        .filter(m => m.name)
        .map(m => ({ 
            name: `${m.emoji} ${m.name}`.trim(), 
            value: m.price 
        }));

    const existingBundle = bundles.find(b => b.type === 'Menus');
    const bundleId = existingBundle ? existingBundle.id : 'menu-master';

    try {
      const response = await fetch(`http://localhost:8000/api/bundle/${bundleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            items,
            type: 'Menus',
            title: '메뉴 카탈로그'
        }),
      });
      if (response.ok) {
        alert("✅ 전체 메뉴 정보가 지식 풀에 성공적으로 저장되었습니다!");
        onNavigate('admin', 'dashboard');
      } else {
        throw new Error('Server error');
      }
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="admin-page animate-fade-in">
      <ScanningOverlay isScanning={isScanning} docType="menu" />
      <ScanChoiceModal 
        show={showChoiceModal} 
        onClose={() => setShowChoiceModal(false)} 
        onChoice={proceedToPickFile}
        title="메뉴판 분석 방식 선택"
        docType="menu"
      />
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
            <h2>📒 메뉴 카탈로그 마스터 관리</h2>
            <p>메뉴판 사진을 스캔하거나 직접 항목을 추가하여 메뉴 지식을 관리하세요.</p>
        </div>
        <div className="header-actions" style={{ marginBottom: '5px' }}>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
            <button className="confirm-btn premium-orange" onClick={startScanFlow} disabled={isScanning}>
                {isScanning ? '🧠 AI 분석 중...' : '📸 메뉴판 사진 스캔 등록'}
            </button>
        </div>
      </header>

      <div className="glass-panel setup-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="ocr-result edit-mode animate-fade-in">
          <div className="menu-edit-container" style={{ maxHeight: '60vh' }}>
            {localMenus.map((m) => (
              <div key={m.id} className="menu-edit-row premium" style={{ alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '12px', marginBottom: '10px' }}>
                <input 
                    className="emoji-input" 
                    value={m.emoji} 
                    onChange={(e) => handleLocalChange(m.id, 'emoji', e.target.value)}
                    style={{ width: '50px', marginRight: '5px' }}
                />
                <select 
                    className="category-select" 
                    value={m.category} 
                    onChange={(e) => handleLocalChange(m.id, 'category', e.target.value)}
                    style={{ width: '90px', marginRight: '5px' }}
                >
                    <option>식사</option>
                    <option>안주</option>
                    <option>주류</option>
                    <option>음료</option>
                    <option>디저트</option>
                </select>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <input 
                        className="edit-name" 
                        value={m.name} 
                        onChange={(e) => handleLocalChange(m.id, 'name', e.target.value)}
                        placeholder="메뉴명"
                        style={{ background: 'white !important', color: '#111827 !important' }}
                    />
                    <input 
                        className="desc-input" 
                        value={m.description} 
                        onChange={(e) => handleLocalChange(m.id, 'description', e.target.value)} 
                        placeholder="상세 설명..."
                        style={{ fontSize: '0.8rem', border: 'none', background: 'transparent' }}
                    />
                </div>
                <input 
                    className="edit-price" 
                    value={m.price} 
                    onChange={(e) => handleLocalChange(m.id, 'price', e.target.value)} 
                    placeholder="가격"
                    style={{ width: '100px', textAlign: 'right' }}
                />
                <button className="del-btn" onClick={() => deleteMenuItem(m.id)} style={{ marginLeft: '10px' }}>×</button>
              </div>
            ))}
            {localMenus.length === 0 && <div style={{textAlign: 'center', padding: '40px', opacity: 0.5}}>등록된 메뉴가 없습니다. 메뉴판을 스캔하거나 새 메뉴를 추가하세요.</div>}
          </div>
        </div>
      </div>

      <div className="action-bar-bottom" style={{marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center'}}>
        <button className="confirm-btn premium-orange" onClick={addMenuItem}>+ 새 메뉴 직접 추가</button>
        <button className="confirm-btn success-green" onClick={handleSaveAll} style={{ padding: '1rem 2rem' }}>
            💾 모든 변경사항 저장
        </button>
      </div>
    </div>
  );
};
