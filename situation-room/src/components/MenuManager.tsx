import React, { useState, useEffect } from 'react';
import { useImageScan, ScanningOverlay, ScanChoiceModal } from '../hooks/useImageScan';
import type { BundleData } from '../types';

import { useStoreFilter } from '../hooks/useStoreFilter';

interface MenuManagerProps {
    bundles: BundleData[];
    onUpdate?: (updatedItems: any[]) => void;
}

export const MenuManager: React.FC<MenuManagerProps> = ({ bundles, onUpdate }) => {
    const { storeId, storeName } = useStoreFilter();
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [bundleId, setBundleId] = useState<string | null>(null);

    useEffect(() => {
        if (!bundles) return; // 데이터가 없으면 대기
        
        const menuBundle = bundles.find(b => b.type === 'Menus' && (storeId === 'Total' || b.store_id === storeId || !b.store_id));
        if (menuBundle) {
            setBundleId(menuBundle.id);
            setMenuItems(menuBundle.items.map(item => ({
                ...item,
                value: item.value.replace(/원/g, '').trim(), // '원' 중복 노출 방지를 위해 제거
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
            const newItems = rawItems.map((i: any) => {
                const rawValue = String(i.price || i.value || '0');
                return {
                    name: i.name || '',
                    value: rawValue.replace(/원/g, '').trim(), // 스캔 시 '원' 제거
                    icon: '🍴',
                    category: '추천',
                    description: 'AI 스캔으로 등록된 메뉴입니다.'
                };
            });

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

    // --- Android Back Button Support ---
    useEffect(() => {
        const handlePopState = () => {
            if (showChoiceModal) {
                setShowChoiceModal(false);
            }
        };
        if (showChoiceModal) {
            window.history.pushState({ modal: 'menu-scan' }, '');
        }
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [showChoiceModal, setShowChoiceModal]);

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
                    title: '메뉴 정보',
                    store: storeName,
                    store_id: storeId
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
        <div className="menu-manager-compact animate-fade-in" style={{ padding: '30px', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <ScanningOverlay isScanning={isScanning} docType="menu" />
            <ScanChoiceModal 
                show={showChoiceModal} 
                onClose={() => setShowChoiceModal(false)} 
                onChoice={proceedToPickFile}
                title="메뉴판 분석"
                docType="menu"
            />
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
            
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)' }}>메뉴 정보 관리</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        style={{ 
                            padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                            background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer'
                        }}
                        onClick={startScanFlow}
                        disabled={isSaving}
                    >
                        📸 사진 스캔
                    </button>
                    <button 
                        onClick={handleSave} 
                        style={{ 
                            padding: '8px 24px', borderRadius: 'var(--radius-sm)', border: 'none',
                            background: isSaving ? 'var(--text-muted)' : 'var(--primary)', color: 'white', 
                            fontSize: '0.85rem', fontWeight: '700', cursor: isSaving ? 'not-allowed' : 'pointer' 
                        }}
                        disabled={isSaving}
                    >
                        {isSaving ? '저장 중...' : '변경사항 저장'}
                    </button>
                </div>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {menuItems.map((item, idx) => (
                    <div key={idx} style={{ 
                        display: 'flex', gap: '12px', alignItems: 'center', padding: '12px',
                        background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)'
                    }}>
                        <input 
                            value={item.icon} 
                            onChange={(e) => handleChange(idx, 'icon', e.target.value)}
                            style={{ width: '40px', textAlign: 'center', fontSize: '1.2rem', border: 'none', background: 'transparent' }}
                        />

                        <input
                            value={item.category ?? '식사'}
                            onChange={(e) => handleChange(idx, 'category', e.target.value)}
                            placeholder="분류"
                            style={{ 
                                padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border)',
                                background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.85rem', width: '90px'
                            }}
                        />

                        <input 
                            value={item.name}
                            onChange={(e) => handleChange(idx, 'name', e.target.value)}
                            placeholder="메뉴명"
                            style={{ 
                                flex: 1, padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border)',
                                background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600'
                            }}
                        />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                                value={item.value.replace(/[^0-9]/g, '')}
                                onChange={(e) => handleChange(idx, 'value', e.target.value)}
                                placeholder="0"
                                style={{ 
                                    width: '100px', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border)',
                                    background: 'var(--surface)', color: 'var(--accent)', fontSize: '0.9rem', fontWeight: '700', textAlign: 'right'
                                }}
                            />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>원</span>
                        </div>

                        <button 
                            onClick={() => handleDelete(idx)}
                            style={{ 
                                background: 'transparent', color: 'var(--danger)', border: 'none', 
                                fontSize: '1.5rem', cursor: 'pointer', padding: '0 10px'
                            }}
                        >×</button>
                    </div>
                ))}

                {menuItems.length === 0 && (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        등록된 메뉴가 없습니다. 메뉴판 사진을 스캔해 보세요.
                    </div>
                )}
            </div>
        </div>
    );
};
