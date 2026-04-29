import React, { useState } from 'react';

interface Props {
  bundles: any[];
}

export const QRManager: React.FC<Props> = ({ bundles }) => {
    const [wifiSSID, setWifiSSID] = useState('MQnet_Wifi');
    const [wifiPass, setWifiPass] = useState('12345678');
    
    // 매장 정보 추출
    const storeBundle = (bundles || []).find(b => b.type === 'StoreConfig');
    const storeName = (storeBundle?.items || []).find((i: any) => i.name === '상호명' || i.name === 'brand')?.value || 'UnknownStore';

    const baseUrl = `https://situation.chicvill.store`;

    const qrItems = [
        {
            title: "📶 매장 WiFi",
            label: "WIFI",
            data: `WIFI:S:${wifiSSID};T:WPA;P:${wifiPass};;`,
            fields: (
                <div className="qr-inputs no-print">
                    <input type="text" value={wifiSSID} onChange={(e) => setWifiSSID(e.target.value)} placeholder="SSID" />
                    <input type="text" value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} placeholder="비밀번호" />
                </div>
            )
        },
        {
            title: "🛎️ 웨이팅 등록",
            label: "WT",
            data: `${baseUrl}/?mode=waiting&action=register&store=${encodeURIComponent(storeName)}`
        },
        {
            title: "👥 직원 출퇴근",
            label: "AB",
            data: `${baseUrl}/?mode=hr&action=checkin&store=${encodeURIComponent(storeName)}`
        },
        {
            title: "📚 사용자 매뉴얼",
            label: "MU",
            data: `${baseUrl}/?mode=admin&tab=manual&store=${encodeURIComponent(storeName)}`
        },
        {
            title: "💳 자리에서 결제",
            label: "PY",
            data: `${baseUrl}/?mode=customer&action=pay&store=${encodeURIComponent(storeName)}`
        }
    ];

    const getQRUri = (data: string) => `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data)}`;

    return (
        <div className="qr-manager-container animate-fade-in">
            <header className="page-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>🔳 QR 마스터 인쇄 센터</h2>
                    <p>매장명: {storeName}</p>
                </div>
                <button className="premium-btn" onClick={() => window.print()} style={{ padding: '10px 30px' }}>
                    🖨️ 페이지 전체 인쇄하기
                </button>
            </header>

            <div className="qr-print-layout">
                <div className="qr-grid">
                    {qrItems.map((item, idx) => (
                        <div key={idx} className="qr-card-v2">
                            <h3 className="qr-title-v2">{item.title}</h3>
                            <div className="qr-image-wrapper-v2">
                                <img src={getQRUri(item.data)} alt="QR Code" />
                            </div>
                            <div className="qr-badge-v2">{item.label}</div>
                            <div className="qr-url-text">{item.data}</div>
                            {item.fields}
                        </div>
                    ))}
                    
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                        <div key={num} className="qr-card-v2">
                            <h3 className="qr-title-v2">Table {num}</h3>
                            <div className="qr-image-wrapper-v2">
                                <img src={getQRUri(`${baseUrl}/?mode=customer&table=${num}&store=${encodeURIComponent(storeName)}`)} alt={`Table ${num} QR`} />
                            </div>
                            <div className="qr-badge-v2">{`T${num}`}</div>
                            <div className="qr-url-text">{`${baseUrl}/?mode=customer&table=${num}&store=${encodeURIComponent(storeName)}`}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
