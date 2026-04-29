import React, { useState, useEffect } from 'react';
import { useImageScan, ScanningOverlay, ScanChoiceModal } from '../hooks/useImageScan';
import type { BundleData } from '../types';

interface MenuManagerProps {
    bundles: BundleData[];
    onUpdate?: (updatedItems: any[]) => void;
}

export const MenuManager: React.FC<MenuManagerProps> = ({ bundles, onUpdate }) => {
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [bundleId, setBundleId] = useState<string | null>(null);

    useEffect(() => {
        if (!bundles) return; // 데이터가 없으면 대기
        
        const menuBundle = bundles.find(b => b.type === 'Menus');
        if (menuBundle) {
            setBundleId(menuBundle.id);
            setMenuItems(menuBundle.items.map(item => ({
                ...item,
                icon: (item as any).icon || '🍴',
                category: (item as any).category || '기타',
                description: (item as any).description || '신선한 재료로 준비했습니다.'
            })));
        }
    }, [bundles]);

    const handleChange = (index: number, field: string, value: string) => {
        const updated = [...menuItems];
        updated[index] = { ...updated[index], [field]: value };
        setMenuItems(updated);
    };

    const handleDelete = (index: number) => {
        const updated = menuItems.filter((_, i) => i !== index);
        setMenuItems(updated);
    };

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
            // AI 엔진이 반환하는 다양한 필드명(menus, items) 및 가격 필드명(price, value) 대응
            const rawItems = result.menus || result.items || [];
            const newItems = rawItems.map((i: any) => ({
                name: i.name || '',
                value: String(i.price || i.value || '0'),
                icon: '🍴',
                category: '추천',
                description: 'AI 스캔으로 등록된 메뉴입니다.'
            }));

            if (newItems.length === 0) {
                alert("⚠️ 이미지에서 메뉴 정보를 추출하지 못했습니다. 선명한 사진으로 다시 시도해 주세요.");
                return;
            }

            if (overwrite) {
                setMenuItems(newItems);
            } else {
                setMenuItems(prev => [...prev, ...newItems]);
            }
        },
    });

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (menuItems.length === 0) {
            alert("⚠️ 저장할 메뉴가 없습니다. 메뉴를 추가하거나 사진을 스캔해 주세요.");
            return;
        }

        const idToUse = bundleId || `MENUS_${Date.now()}`;
        setIsSaving(true);
        
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const response = await fetch(`${apiUrl}/api/bundle/${idToUse}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    items: menuItems.map(item => ({ 
                        name: item.name, 
                        value: item.value, 
                        icon: item.icon, 
                        category: item.category, 
                        description: item.description 
                    })),
                    type: 'Menus',
                    title: '메뉴 정보'
                }),
            });

            if (response.ok) {
                alert("✅ 메뉴 정보가 성공적으로 저장되었습니다.");
                if (onUpdate) onUpdate(menuItems);
            } else {
                throw new Error('저장 실패');
            }
        } catch (err) {
            console.error("Save error:", err);
            alert("❌ 저장 중 오류가 발생했습니다. 서버 연결을 확인하세요.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="menu-manager-compact animate-fade-in" style={{ padding: '5px' }}>
            <ScanningOverlay isScanning={isScanning} docType="menu" />
            <ScanChoiceModal 
                show={showChoiceModal} 
                onClose={() => setShowChoiceModal(false)} 
                onChoice={proceedToPickFile}
                title="메뉴판 사진 스캔 분석"
                docType="menu"
            />
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
            
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>📔 메뉴 관리</h2>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                        className="premium-btn-sm" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'var(--accent-orange)' }}
                        onClick={startScanFlow}
                        disabled={isSaving}
                    >
                        📸 사진 스캔
                    </button>
                    <button 
                        onClick={handleSave} 
                        className="premium-btn-sm" 
                        style={{ background: isSaving ? '#64748b' : '#10b981', padding: '6px 12px', fontSize: '0.8rem', cursor: isSaving ? 'not-allowed' : 'pointer' }}
                        disabled={isSaving}
                    >
                        {isSaving ? '⏳ 저장 중...' : '💾 저장'}
                    </button>
                </div>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {menuItems.map((item, idx) => (
                    <div key={idx} className="editor-row">
                        {/* 1. 아이콘 */}
                        <input 
                            value={item.icon} 
                            onChange={(e) => handleChange(idx, 'icon', e.target.value)}
                            style={{ width: '35px', textAlign: 'center', fontSize: '1.2rem', padding: '0 !important' }}
                        />

                        {/* 카테고리 입력 */}
                        <input
                            value={item.category ?? '식사'}
                            onChange={(e) => handleChange(idx, 'category', e.target.value)}
                            placeholder="카테고리"
                            style={{ 
                                padding: '4px 8px', 
                                borderRadius: '8px', 
                                background: 'rgba(255,255,255,0.05)', 
                                color: 'white', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                fontSize: '0.9rem',
                                width: '60px'
                            }}
                        />

                        {/* 2. 메뉴명 */}
                        <input 
                            className="name-field"
                            value={item.name}
                            onChange={(e) => handleChange(idx, 'name', e.target.value)}
                            placeholder="메뉴명"
                        />

                        {/* 3. 가격 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input 
                                className="value-field"
                                value={item.value}
                                onChange={(e) => handleChange(idx, 'value', e.target.value)}
                                placeholder="0"
                                style={{ width: '80px' }}
                            />
                            <span style={{ fontSize: '0.8rem', color: 'var(--accent-orange)', fontWeight: 'bold' }}>원</span>
                        </div>

                        {/* 4. 삭제 버튼 */}
                        <button 
                            onClick={() => handleDelete(idx)}
                            style={{ 
                                background: 'rgba(239, 68, 68, 0.1)', 
                                color: '#ef4444', 
                                border: 'none', 
                                borderRadius: '8px', 
                                width: '28px', height: '28px', 
                                fontSize: '1.2rem', 
                                cursor: 'pointer',
                                display: 'flex', justifyContent: 'center', alignItems: 'center'
                            }}
                        >×</button>
                    </div>
                ))}
            </div>
        </div>
    );
};
