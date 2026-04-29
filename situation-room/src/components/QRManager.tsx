import React, { useState, useEffect } from 'react';

export const QRManager: React.FC = () => {
    const [wifiSSID, setWifiSSID] = useState('MQnet_Wifi');
    const [wifiPass, setWifiPass] = useState('12345678');
    const [serverIp, setServerIp] = useState('192.168.219.106');
    const protocol = window.location.protocol;
    const port = window.location.port || '5173';
    
    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        fetch(`${apiUrl}/api/server-ip`)
            .then(res => res.json())
            .then(data => {
                if (data.ip) setServerIp(data.ip);
            })
            .catch(err => console.error("IP Fetch Error:", err));
    }, []);

    const baseUrl = `${protocol}//${serverIp}:${port}`;

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
            data: `${baseUrl}/?mode=waiting&action=register`
        },
        {
            title: "👥 직원 출퇴근",
            label: "AB",
            data: `${baseUrl}/?mode=hr&action=checkin`
        },
        {
            title: "📚 사용자 매뉴얼",
            label: "MU",
            data: `${baseUrl}/?mode=admin&tab=manual`
        },
        {
            title: "💳 자리에서 결제",
            label: "PY",
            data: `${baseUrl}/?mode=customer&action=pay`
        }
    ];

    const getQRUri = (data: string) => `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data)}`;

    return (
        <div className="qr-manager-container animate-fade-in">
            <header className="page-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>🔳 QR 마스터 인쇄 센터</h2>
                    <p>A4 한 장에 모든 QR코드가 배치됩니다.</p>
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
                    
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                        <div key={num} className="qr-card-v2">
                            <h3 className="qr-title-v2">Table {num}</h3>
                            <div className="qr-image-wrapper-v2">
                                <img src={getQRUri(`${baseUrl}/?mode=customer&table=${num}`)} alt={`Table ${num} QR`} />
                            </div>
                            <div className="qr-badge-v2">{`T${num}`}</div>
                            <div className="qr-url-text">{`${baseUrl}/?mode=customer&table=${num}`}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
