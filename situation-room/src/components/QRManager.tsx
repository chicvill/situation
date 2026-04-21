import React, { useState } from 'react';

export const QRManager: React.FC = () => {
    const [wifiSSID, setWifiSSID] = useState('MQnet_Wifi');
    const [wifiPass, setWifiPass] = useState('12345678');
    const host = window.location.host;
    const protocol = window.location.protocol;
    const baseUrl = `${protocol}//${host}`;

    const qrItems = [
        {
            title: "📶 매장 WiFi 프리패스",
            desc: "손님이 카메라를 대면 즉시 로그인이 됩니다.",
            data: `WIFI:S:${wifiSSID};T:WPA;P:${wifiPass};;`,
            fields: (
                <div className="qr-inputs">
                    <input type="text" value={wifiSSID} onChange={(e) => setWifiSSID(e.target.value)} placeholder="SSID" />
                    <input type="text" value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} placeholder="비밀번호" />
                </div>
            )
        },
        {
            title: "🛎️ 무인 웨이팅 등록",
            desc: "매장 입구에 비치하여 대기 명단을 받습니다.",
            data: `${baseUrl}/?mode=waiting&action=register`
        },
        {
            title: "👥 직원 스마트 출퇴근",
            desc: "게시판에 붙여두어 직원이 출퇴근을 찍게 합니다.",
            data: `${baseUrl}/?mode=hr&action=checkin`
        },
        {
            title: "📚 사용자 매뉴얼",
            desc: "시스템 사용법 및 가이드를 확인합니다.",
            data: `${baseUrl}/?mode=admin&tab=manual`
        },
        {
            title: "💳 자리에서 결제하기",
            desc: "각 테이블에서 정산창으로 연결됩니다.",
            data: `${baseUrl}/?mode=customer&action=pay`
        }
    ];

    const getQRUri = (data: string) => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;

    return (
        <div className="qr-manager-container animate-fade-in">
            <header className="page-header">
                <h2>🔳 QR 마스터 관리 센터</h2>
                <p>매장 곳곳에 배치할 QR코드를 생성하고 인쇄하세요.</p>
            </header>

            <div className="qr-grid">
                {qrItems.map((item, idx) => (
                    <div key={idx} className="glass-panel qr-card">
                        <div className="qr-info">
                            <h3>{item.title}</h3>
                            <p>{item.desc}</p>
                            {item.fields}
                        </div>
                        <div className="qr-image-wrapper">
                            <img src={getQRUri(item.data)} alt="QR Code" />
                            <button className="print-btn" onClick={() => window.print()}>인쇄하기</button>
                        </div>
                    </div>
                ))}
            </div>

            <section className="table-qr-section">
                <h3>🍽️ 테이블별 주문 QR 생성</h3>
                <p>각 테이블 번호가 내장된 전용 주문 QR입니다.</p>
                <div className="table-qr-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                        <div key={num} className="glass-panel table-qr-card">
                            <span>Table {num}</span>
                            <img src={getQRUri(`${baseUrl}/?mode=customer&table=${num}`)} alt={`Table ${num} QR`} />
                            <small>스캔 시 {num}번 테이블 주문창 연결</small>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};
