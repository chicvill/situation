import React, { useState, useEffect } from 'react';
import type { BundleData, BundleItem } from '../types';

interface MenuManagerProps {
    bundles: BundleData[];
    onUpdate?: (updatedItems: any[]) => void;
}

export const MenuManager: React.FC<MenuManagerProps> = ({ bundles, onUpdate }) => {
    const [menuItems, setMenuItems] = useState<any[]>([]);

    useEffect(() => {
        const menuBundle = bundles.find(b => b.type === 'Menus');
        if (menuBundle) {
            setMenuItems(menuBundle.items.map(item => ({
                ...item,
                icon: item.icon || '🍴',
                category: item.category || '기타',
                description: item.description || '신선한 재료로 준비했습니다.'
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

    const handleSave = () => {
        if (onUpdate) onUpdate(menuItems);
        alert("✅ 메뉴 정보가 지식 창고에 안전하게 저장되었습니다.");
    };

    return (
        <div className="menu-manager-compact animate-fade-in" style={{ padding: '5px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>📔 메뉴 마스터 편집</h2>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="premium-btn-sm" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'var(--accent-orange)' }}>📸 사진 스캔</button>
                    <button onClick={handleSave} className="premium-btn-sm" style={{ background: '#10b981', padding: '6px 12px', fontSize: '0.8rem' }}>💾 저장</button>
                </div>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {menuItems.map((item, idx) => (
                    <div key={idx} style={{ 
                        background: 'rgba(255,255,255,0.03)', 
                        padding: '8px 12px', 
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        {/* 1. 아이콘 */}
                        <input 
                            value={item.icon} 
                            onChange={(e) => handleChange(idx, 'icon', e.target.value)}
                            style={{ width: '40px', height: '40px', textAlign: 'center', fontSize: '1.4rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '12px', color: 'white' }}
                        />

                        {/* 2. 중앙 메뉴 정보 */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                <input 
                                    value={item.category}
                                    onChange={(e) => handleChange(idx, 'category', e.target.value)}
                                    style={{ fontSize: '0.65rem', width: '60px', padding: '2px 4px', background: 'var(--accent-orange)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', textAlign: 'center' }}
                                />
                                <input 
                                    value={item.name}
                                    onChange={(e) => handleChange(idx, 'name', e.target.value)}
                                    style={{ flex: 1, fontSize: '1.1rem', fontWeight: '900', background: 'transparent', border: 'none', color: 'white', outline: 'none' }}
                                />
                            </div>
                            <input 
                                value={item.description}
                                onChange={(e) => handleChange(idx, 'description', e.target.value)}
                                style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'transparent', border: 'none', width: '100%', outline: 'none', opacity: 0.8 }}
                            />
                        </div>

                        {/* 3. 우측 가격 & 삭제 세로 정렬 */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', minWidth: '90px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <input 
                                    value={item.value}
                                    onChange={(e) => handleChange(idx, 'value', e.target.value)}
                                    style={{ width: '70px', fontSize: '1.15rem', fontWeight: '950', color: 'var(--accent-orange)', background: 'transparent', border: 'none', textAlign: 'right', outline: 'none' }}
                                />
                                <span style={{ fontSize: '0.85rem', color: 'var(--accent-orange)', fontWeight: 'bold', marginLeft: '2px' }}>원</span>
                            </div>
                            <button 
                                onClick={() => handleDelete(idx)}
                                style={{ 
                                    background: 'rgba(239, 68, 68, 0.1)', 
                                    color: '#ef4444', 
                                    border: '1px solid rgba(239, 68, 68, 0.2)', 
                                    borderRadius: '6px', 
                                    width: '30px', height: '22px', 
                                    fontSize: '1rem', 
                                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                                    cursor: 'pointer'
                                }}
                            >×</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
