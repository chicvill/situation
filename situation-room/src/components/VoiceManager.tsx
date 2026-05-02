import React, { useState } from 'react';
import { BundleData } from '../types';
import { API_BASE } from '../config';

interface VoiceManagerProps {
    bundles: BundleData[];
    storeId: string;
}

export const VoiceManager: React.FC<VoiceManagerProps> = ({ bundles, storeId }) => {
    const voiceBundles = bundles.filter(b => b.type === 'VoiceConfig');
    const [isAdding, setIsAdding] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');
    const [newTab, setNewTab] = useState('order');

    const tabs = [
        { id: 'home', label: '홈' },
        { id: 'order', label: '주문' },
        { id: 'kitchen', label: '주방' },
        { id: 'counter', label: '카운터' },
        { id: 'waiting', label: '대기' },
        { id: 'reserve', label: '예약' },
        { id: 'call', label: '호출' },
        { id: 'qr', label: 'QR인쇄' },
        { id: 'display', label: '전광판' },
        { id: 'stats', label: '통계' },
        { id: 'settings', label: '매장설정' },
        { id: 'menu', label: '메뉴설정' },
        { id: 'inventory', label: 'AI인벤토리' },
        { id: 'paper', label: 'AI논문' },
        { id: 'hr', label: '직원관리' },
    ];

    const handleSave = async (keyword: string, tabId: string) => {
        try {
            await fetch(`${API_BASE}/api/situation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `앞으로 '${keyword}'라고 말하면 ${tabId} 화면으로 이동해줘`,
                    store: storeId
                })
            });
            setIsAdding(false);
            setNewKeyword('');
            alert('음성 가이드가 성공적으로 업데이트되었습니다.');
            window.location.reload(); // 데이터 갱신을 위해 리로드
        } catch (err) {
            console.error(err);
            alert('저장 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="voice-manager-page" style={{ padding: '30px', background: 'var(--bg-main)', minHeight: '100vh' }}>
            <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>🎙️ 음성 가이드 관리</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>특정 단어를 말했을 때 이동할 화면을 설정합니다.</p>
                </div>
                <button 
                    onClick={() => setIsAdding(true)}
                    style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                    + 명령어 추가
                </button>
            </header>

            <div className="voice-list-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {voiceBundles.map(bundle => (
                    bundle.items.map((item: any, idx: number) => (
                        <div key={`${bundle.id}-${idx}`} style={{ background: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>단어</span>
                                <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>"{item.name}"</strong>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>이동 화면</span>
                                <span style={{ 
                                    background: 'var(--primary-soft)', color: 'var(--primary)', 
                                    padding: '4px 10px', borderRadius: '4px', fontWeight: '700', fontSize: '0.9rem' 
                                }}>
                                    {tabs.find(t => t.id === item.value)?.label || item.value}
                                </span>
                            </div>
                        </div>
                    ))
                ))}
            </div>

            {isAdding && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'var(--surface)', padding: '40px', borderRadius: '20px', width: '400px', boxShadow: 'var(--shadow-lg)' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '25px' }}>새 명령어 추가</h3>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>말할 단어</label>
                            <input 
                                type="text" 
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                placeholder="예: 창고, 요리 등"
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)' }}
                            />
                        </div>
                        <div style={{ marginBottom: '30px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>이동할 화면</label>
                            <select 
                                value={newTab}
                                onChange={(e) => setNewTab(e.target.value)}
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)' }}
                            >
                                {tabs.map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setIsAdding(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', cursor: 'pointer' }}>취소</button>
                            <button 
                                onClick={() => handleSave(newKeyword, newTab)}
                                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: '700', cursor: 'pointer' }}
                            >
                                저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
