import React, { useState } from 'react';

interface Props {
  bundles: any[];
  storeId?: string;
  storeName?: string;
}

export const QRManager: React.FC<Props> = ({ bundles, storeId, storeName: initialStoreName }) => {
    const [wifiSSID, setWifiSSID] = useState('MQnet_Wifi');
    const [wifiPass, setWifiPass] = useState('12345678');
    const [printMode, setPrintMode] = useState<'single' | 'a4' | 'grid'>('single'); // 디폴트는 'single' (A4 한 장에 전체 배치)
    
    // 매장 정보 추출
    const safeBundles = Array.isArray(bundles) ? bundles : [];
    const storeBundle = (storeId && safeBundles.find(b => b.type === 'StoreConfig' && (b.store_id === storeId || b.id === storeId)))
        || safeBundles.find(b => b.type === 'StoreConfig');
    const safeItems = Array.isArray(storeBundle?.items) ? storeBundle!.items : [];
    const resolvedStoreId = storeBundle?.store_id || storeBundle?.id || 'default_store';
    const storeName = safeItems.find((i: any) => i.name === '상호명' || i.name === 'brand')?.value || initialStoreName || '우리식당';

    // 테이블설정 파싱 ("1번: 4인석, 2번: 2인석" 등)
    const tablesItem = safeItems.find((i: any) => i.name === '테이블설정')?.value;
    const parsedTables = (() => {
        if (!tablesItem) {
            return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => ({
                num,
                label: `Table ${num}`,
                seats: '4인석'
            }));
        }
        
        try {
            return String(tablesItem).split(',').map(part => {
                const clean = part.trim();
                const match = clean.match(/(\d+)(?:번)?\s*:\s*(.*)/);
                if (match) {
                    return {
                        num: parseInt(match[1]),
                        label: `Table ${match[1]}`,
                        seats: match[2].trim()
                    };
                }
                if (clean.includes(':')) {
                    const [left, right] = clean.split(':');
                    const parsedNum = parseInt(left.replace(/[^0-9]/g, ''));
                    if (!isNaN(parsedNum)) {
                        return {
                            num: parsedNum,
                            label: `Table ${parsedNum}`,
                            seats: right.trim()
                        };
                    }
                }
                return null;
            }).filter(Boolean) as any[];
        } catch (e) {
            console.error("Failed to parse table configs in QRManager:", e);
            return [1, 2, 3, 4, 5, 6, 7, 8].map(num => ({
                num,
                label: `Table ${num}`,
                seats: '4인석'
            }));
        }
    })();

    const baseUrl = `https://situation.chicvill.store`;

    const qrItems = [
        {
            title: "📶 매장 WiFi",
            label: "WIFI",
            data: `WIFI:S:${wifiSSID};T:WPA;P:${wifiPass};;`,
            fields: (
                <div className="qr-inputs no-print" style={{ marginTop: '10px' }}>
                    <input type="text" value={wifiSSID} onChange={(e) => setWifiSSID(e.target.value)} placeholder="SSID" style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc', marginRight: '5px', fontSize: '12px', width: '80px' }} />
                    <input type="text" value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} placeholder="비밀번호" style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px', width: '80px' }} />
                </div>
            )
        },
        {
            title: "🛎️ 웨이팅 등록",
            label: "WT",
            data: `${baseUrl}/?mode=waiting&action=register&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`
        },
        {
            title: "👥 직원 출퇴근",
            label: "AB",
            data: `${baseUrl}/?mode=hr&action=checkin&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`
        },
        {
            title: "📚 사용자 매뉴얼",
            label: "MU",
            data: `${baseUrl}/?mode=manual&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`
        },
        {
            title: "💳 자리에서 결제",
            label: "PY",
            data: `${baseUrl}/?mode=customer&action=pay&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`
        }
    ];

    // 인쇄 시 깨짐 방지를 위해 해상도 동적 설정 (모아찍기는 200x200, 낱장 A4는 500x500)
    // 구글 차트 API의 서비스 종료(접속 불가) 문제로 인해, 더 빠르고 안정적인 QR Server API로 교체 적용합니다.
    const getQRUri = (data: string) => `https://api.qrserver.com/v1/create-qr-code/?size=${printMode === 'a4' ? '500x500' : '200x200'}&data=${encodeURIComponent(data)}`;

    return (
        <div className="qr-manager-container animate-fade-in" style={{ padding: '20px' }}>
            {/* 동적으로 인쇄 스타일 가로채기 주입 */}
            <style>
                {`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm !important;
                    }
                    
                    /* ⚠️ 브라우저 이미지 그리기 누락 버그 방지를 위해 visibility: hidden 대신 안전한 display: none 선택자를 사용합니다. */
                    .sidebar, 
                    .premium-top-bar, 
                    .page-header, 
                    .no-print, 
                    button, 
                    header {
                        display: none !important;
                    }
                    
                    /* 부모 컨테이너들을 테두리/여백 없는 전체화면 백지로 전환 */
                    body, html, #root, .app-container, .saas-main, .main-content, .qr-manager-container {
                        background: white !important;
                        background-color: white !important;
                        border: none !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    
                    /* QR 출력 레이아웃이 A4 용지를 완벽하게 가득 채우도록 규격 설정 */
                    .qr-print-layout {
                        display: block !important;
                        width: 100% !important;
                        max-width: 194mm !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        border: none !important;
                        background: white !important;
                        box-sizing: border-box !important;
                    }
                    
                    .no-print {
                        display: none !important;
                    }
                    
                    ${printMode === 'single' ? `
                    /* A4 용지 딱 1장 안에 전체 17개 타이트하게 밀착 배치 규칙 */
                    .qr-grid {
                        display: grid !important;
                        grid-template-columns: repeat(6, 1fr) !important;
                        gap: 8px !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                    }
                    .qr-card-v2 {
                        break-inside: avoid !important;
                        border: 1.5px dashed #94a3b8 !important; /* 깔끔한 가위 오려내기 점선 */
                        border-radius: 8px !important;
                        padding: 6px !important;
                        background: white !important;
                        box-shadow: none !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        box-sizing: border-box !important;
                        height: 85mm !important; /* 정확히 3줄 세로높이(255mm) 맞춤으로 오버플로우 방지 */
                    }
                    .qr-title-v2 {
                        font-size: 0.75rem !important;
                        font-weight: 800 !important;
                        color: #0f172a !important;
                        margin: 0 0 4px 0 !important;
                    }
                    .qr-image-wrapper-v2 {
                        width: 75px !important;
                        height: 75px !important;
                        border: 1px solid #cbd5e1 !important;
                        border-radius: 6px !important;
                        padding: 2px !important;
                        background: white !important;
                    }
                    .qr-badge-v2 {
                        font-size: 0.65rem !important;
                        padding: 2px 8px !important;
                        margin-top: 4px !important;
                        border-radius: 4px !important;
                        font-weight: 800 !important;
                    }
                    .qr-url-text {
                        display: none !important; /* 공간 절약을 위해 URL 텍스트 숨김 */
                    }
                    ` : printMode === 'a4' ? `
                    /* A4 용지 1장 가득 채우는 개별 페이지 출력 규칙 */
                    .qr-grid {
                        display: block !important;
                    }
                    .qr-card-v2 {
                        page-break-after: always !important;
                        break-inside: avoid !important;
                        height: 100vh !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: center !important;
                        align-items: center !important;
                        border: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        background: white !important;
                    }
                    .qr-title-v2 {
                        font-size: 2.5rem !important;
                        margin-bottom: 40px !important;
                        font-weight: 900 !important;
                        color: #0f172a !important;
                    }
                    .qr-image-wrapper-v2 {
                        width: 380px !important;
                        height: 380px !important;
                        border: 3px solid #000 !important;
                        border-radius: 20px !important;
                        padding: 15px !important;
                        background: white !important;
                    }
                    .qr-badge-v2 {
                        font-size: 1.6rem !important;
                        padding: 10px 40px !important;
                        margin-top: 40px !important;
                        background: #000 !important;
                        color: #fff !important;
                        border-radius: 50px !important;
                        font-weight: 900 !important;
                    }
                    .qr-url-text {
                        font-size: 0.95rem !important;
                        margin-top: 30px !important;
                        max-width: 500px !important;
                        color: #475569 !important;
                        font-family: monospace !important;
                    }
                    ` : `
                    /* 모아찍기 컴팩트 스티커 규칙 (3열 그리드) */
                    .qr-grid {
                        display: grid !important;
                        grid-template-columns: repeat(3, 1fr) !important;
                        gap: 20px !important;
                    }
                    .qr-card-v2 {
                        break-inside: avoid !important;
                        border: 1px solid #e2e8f0 !important;
                        background: white !important;
                        box-shadow: none !important;
                    }
                    `}
                }
                `}
            </style>

            <header className="page-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '25px', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>🔳 QR 마스터 인쇄 센터</h2>
                    <p style={{ color: 'var(--text-muted)', margin: '5px 0 0', fontSize: '0.9rem' }}>매장명: <strong style={{ color: 'var(--accent-orange)' }}>{storeName}</strong> (ID: {resolvedStoreId})</p>
                    
                    {/* 인쇄 스타일 셀렉터 */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                        <button 
                            onClick={() => setPrintMode('single')} 
                            style={{ 
                                padding: '8px 16px', 
                                borderRadius: '8px', 
                                border: printMode === 'single' ? '2px solid var(--accent-orange)' : '1px solid var(--border)', 
                                background: printMode === 'single' ? '#f9731615' : 'white', 
                                color: printMode === 'single' ? 'var(--accent-orange)' : 'var(--text-main)',
                                fontWeight: '800', 
                                fontSize: '0.85rem',
                                cursor: 'pointer' 
                            }}
                        >
                            📄 A4 1장에 전체 모아찍기 (기본값)
                        </button>
                        <button 
                            onClick={() => setPrintMode('a4')} 
                            style={{ 
                                padding: '8px 16px', 
                                borderRadius: '8px', 
                                border: printMode === 'a4' ? '2px solid var(--accent-orange)' : '1px solid var(--border)', 
                                background: printMode === 'a4' ? '#f9731615' : 'white', 
                                color: printMode === 'a4' ? 'var(--accent-orange)' : 'var(--text-main)',
                                fontWeight: '800', 
                                fontSize: '0.85rem',
                                cursor: 'pointer' 
                            }}
                        >
                            📐 A4 1장에 1개씩 크게 인쇄
                        </button>
                        <button 
                            onClick={() => setPrintMode('grid')} 
                            style={{ 
                                padding: '8px 16px', 
                                borderRadius: '8px', 
                                border: printMode === 'grid' ? '2px solid var(--accent-orange)' : '1px solid var(--border)', 
                                background: printMode === 'grid' ? '#f9731615' : 'white', 
                                color: printMode === 'grid' ? 'var(--accent-orange)' : 'var(--text-main)',
                                fontWeight: '800', 
                                fontSize: '0.85rem',
                                cursor: 'pointer' 
                            }}
                        >
                            🔳 스티커 모아찍기 (3열 그리드)
                        </button>
                    </div>
                </div>
                
                <button className="premium-btn" onClick={() => window.print()} style={{ padding: '12px 30px', fontSize: '1.05rem', boxShadow: '0 4px 15px rgba(249, 115, 22, 0.2)' }}>
                    🖨️ 인쇄하기 (Ctrl + P)
                </button>
            </header>

            <div className="qr-print-layout" style={{ background: 'white', padding: '25px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div className="qr-grid" style={{ 
                    display: 'grid', 
                    gridTemplateColumns: printMode === 'single' ? 'repeat(6, 1fr)' : printMode === 'a4' ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(3, 1fr)', 
                    gap: printMode === 'single' ? '12px' : '25px' 
                }}>
                    {qrItems.map((item, idx) => (
                        <div key={idx} className="qr-card-v2" style={{ 
                            border: printMode === 'single' ? '1.5px dashed #cbd5e1' : '1px solid #f1f5f9', 
                            background: '#fafafa', 
                            borderRadius: '12px', 
                            padding: printMode === 'single' ? '10px' : '20px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            textAlign: 'center' 
                        }}>
                            <h3 className="qr-title-v2" style={{ margin: '0 0 10px 0', fontSize: printMode === 'single' ? '0.85rem' : '1.15rem', fontWeight: '900', color: '#1e293b' }}>{item.title}</h3>
                            <div className="qr-image-wrapper-v2" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: printMode === 'single' ? '4px' : '10px', width: printMode === 'single' ? '90px' : '160px', height: printMode === 'single' ? '90px' : '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={getQRUri(item.data)} alt="QR Code" style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
                            </div>
                            <div className="qr-badge-v2" style={{ background: '#0f172a', color: 'white', borderRadius: '50px', padding: printMode === 'single' ? '2px 8px' : '4px 15px', fontSize: printMode === 'single' ? '0.65rem' : '0.85rem', fontWeight: '900', marginTop: printMode === 'single' ? '8px' : '15px', letterSpacing: '0.5px' }}>{item.label}</div>
                            {printMode !== 'single' && <div className="qr-url-text" style={{ fontSize: '0.7rem', color: '#64748b', wordBreak: 'break-all', marginTop: '12px', fontFamily: 'monospace', maxWidth: '200px' }}>{item.data}</div>}
                            {item.fields}
                        </div>
                    ))}
                    
                    {parsedTables.map((item, idx) => (
                        <div key={idx} className="qr-card-v2" style={{ 
                            border: printMode === 'single' ? '1.5px dashed #cbd5e1' : '1px solid #f1f5f9', 
                            background: '#fafafa', 
                            borderRadius: '12px', 
                            padding: printMode === 'single' ? '10px' : '20px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            textAlign: 'center' 
                        }}>
                            <h3 className="qr-title-v2" style={{ margin: '0 0 10px 0', fontSize: printMode === 'single' ? '0.85rem' : '1.15rem', fontWeight: '900', color: '#1e293b' }}>
                                {item.label} <span style={{ fontSize: printMode === 'single' ? '10px' : '14px', color: 'var(--accent-orange)', fontWeight: 'bold' }}>({item.seats})</span>
                            </h3>
                            <div className="qr-image-wrapper-v2" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: printMode === 'single' ? '4px' : '10px', width: printMode === 'single' ? '90px' : '160px', height: printMode === 'single' ? '90px' : '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={getQRUri(`${baseUrl}/?mode=customer&table=${item.num}&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`)} alt={`${item.label} QR`} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
                            </div>
                            <div className="qr-badge-v2" style={{ background: 'var(--accent-orange)', color: 'white', borderRadius: '50px', padding: printMode === 'single' ? '2px 8px' : '4px 15px', fontSize: printMode === 'single' ? '0.65rem' : '0.85rem', fontWeight: '900', marginTop: printMode === 'single' ? '8px' : '15px', letterSpacing: '0.5px' }}>{`T${String(item.num).padStart(2, '0')}`}</div>
                            {printMode !== 'single' && <div className="qr-url-text" style={{ fontSize: '0.7rem', color: '#64748b', wordBreak: 'break-all', marginTop: '12px', fontFamily: 'monospace', maxWidth: '200px' }}>{`${baseUrl}/?mode=customer&table=${item.num}&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`}</div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
