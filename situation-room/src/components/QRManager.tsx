import React, { useState } from 'react';

interface Props {
  bundles: any[];
  storeId?: string;
  storeName?: string;
}

export const QRManager: React.FC<Props> = ({ bundles, storeId, storeName: initialStoreName }) => {
    const [wifiSSID, setWifiSSID] = useState('MQnet_Wifi');
    const [wifiPass, setWifiPass] = useState('12345678');
    const [printMode, setPrintMode] = useState<'a4' | 'grid'>('a4'); // 'a4' (1장 가득) 또는 'grid' (모아찍기)
    
    // 매장 정보 추출
    const safeBundles = Array.isArray(bundles) ? bundles : [];
    const storeBundle = (storeId && safeBundles.find(b => b.type === 'StoreConfig' && (b.store_id === storeId || b.id === storeId)))
        || safeBundles.find(b => b.type === 'StoreConfig');
    const safeItems = Array.isArray(storeBundle?.items) ? storeBundle!.items : [];
    const resolvedStoreId = storeBundle?.store_id || storeBundle?.id || 'default_store';
    const storeName = safeItems.find((i: any) => i.name === '상호명' || i.name === 'brand')?.value || initialStoreName || '우리식당';

    const baseUrl = `https://situation.chicvill.store`;

    const qrItems = [
        {
            title: "📶 매장 WiFi",
            label: "WIFI",
            data: `WIFI:S:${wifiSSID};T:WPA;P:${wifiPass};;`,
            fields: (
                <div className="qr-inputs no-print" style={{ marginTop: '10px' }}>
                    <input type="text" value={wifiSSID} onChange={(e) => setWifiSSID(e.target.value)} placeholder="SSID" style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc', marginRight: '5px', fontSize: '12px' }} />
                    <input type="text" value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} placeholder="비밀번호" style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px' }} />
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
            data: `${baseUrl}/?mode=admin&tab=manual&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`
        },
        {
            title: "💳 자리에서 결제",
            label: "PY",
            data: `${baseUrl}/?mode=customer&action=pay&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`
        }
    ];

    // 인쇄 시 깨짐 방지를 위해 A4 모드일 때는 500x500 고해상도, 그리드 모드일 때는 250x250 해상도로 자동 고품질화!
    const getQRUri = (data: string) => `https://api.qrserver.com/v1/create-qr-code/?size=${printMode === 'a4' ? '500x500' : '250x250'}&data=${encodeURIComponent(data)}`;

    return (
        <div className="qr-manager-container animate-fade-in" style={{ padding: '20px' }}>
            {/* 동적으로 인쇄 스타일 가로채기 주입 */}
            <style>
                {`
                @media print {
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    ${printMode === 'a4' ? `
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
                        box-shadow: none !important;
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
                    /* 모아찍기 컴팩트 스티커 규칙 (한 장에 여러 개 인쇄) */
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
                            📄 A4 1장씩 가득 인쇄 (권장)
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
                <div className="qr-grid" style={{ display: 'grid', gridTemplateColumns: printMode === 'a4' ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(3, 1fr)', gap: '25px' }}>
                    {qrItems.map((item, idx) => (
                        <div key={idx} className="qr-card-v2" style={{ border: '1px solid #f1f5f9', background: '#fafafa', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <h3 className="qr-title-v2" style={{ margin: '0 0 15px 0', fontSize: '1.15rem', fontWeight: '900', color: '#1e293b' }}>{item.title}</h3>
                            <div className="qr-image-wrapper-v2" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={getQRUri(item.data)} alt="QR Code" style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
                            </div>
                            <div className="qr-badge-v2" style={{ background: '#0f172a', color: 'white', borderRadius: '50px', padding: '4px 15px', fontSize: '0.85rem', fontWeight: '900', marginTop: '15px', letterSpacing: '0.5px' }}>{item.label}</div>
                            <div className="qr-url-text" style={{ fontSize: '0.7rem', color: '#64748b', wordBreak: 'break-all', marginTop: '12px', fontFamily: 'monospace', maxWidth: '200px' }}>{item.data}</div>
                            {item.fields}
                        </div>
                    ))}
                    
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                        <div key={num} className="qr-card-v2" style={{ border: '1px solid #f1f5f9', background: '#fafafa', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <h3 className="qr-title-v2" style={{ margin: '0 0 15px 0', fontSize: '1.15rem', fontWeight: '900', color: '#1e293b' }}>Table {num}</h3>
                            <div className="qr-image-wrapper-v2" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={getQRUri(`${baseUrl}/?mode=customer&table=${num}&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`)} alt={`Table ${num} QR`} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
                            </div>
                            <div className="qr-badge-v2" style={{ background: 'var(--accent-orange)', color: 'white', borderRadius: '50px', padding: '4px 15px', fontSize: '0.85rem', fontWeight: '900', marginTop: '15px', letterSpacing: '0.5px' }}>{`T${num}`}</div>
                            <div className="qr-url-text" style={{ fontSize: '0.7rem', color: '#64748b', wordBreak: 'break-all', marginTop: '12px', fontFamily: 'monospace', maxWidth: '200px' }}>{`${baseUrl}/?mode=customer&table=${num}&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
