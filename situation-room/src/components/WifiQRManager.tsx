import { useState } from 'react';

export const WifiQRManager = () => {
    const [ssid, setSsid] = useState('');
    const [password, setPassword] = useState('');
    const [security, setSecurity] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
    const [showPass, setShowPass] = useState(false);

    const wifiData = security === 'nopass'
        ? `WIFI:S:${ssid};T:nopass;;`
        : `WIFI:S:${ssid};T:${security};P:${password};;`;

    const qrSrc = ssid
        ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(wifiData)}`
        : '';

    const handlePrint = () => window.print();

    return (
        <div style={{ padding: '24px', background: 'var(--bg-main)', minHeight: '100vh' }}>
            <style>{`
                @media print {
                    @page { size: A5 portrait; margin: 10mm; }
                    .no-print { display: none !important; }
                    body, html, #root { background: white !important; }
                }
            `}</style>

            {/* Header — 인쇄 시 숨김 */}
            <div className="no-print" style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px' }}>📶 WiFi QR 인쇄</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
                    매장 WiFi 이름과 비밀번호를 입력하면 손님이 스캔 한 번으로 자동 연결됩니다.
                </p>
            </div>

            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

                {/* 입력 폼 — 인쇄 시 숨김 */}
                <div className="no-print glass-card" style={{
                    flex: '1', minWidth: '280px', maxWidth: '380px',
                    padding: '28px', borderRadius: '20px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', gap: '20px'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                            보안 방식
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {(['WPA', 'WEP', 'nopass'] as const).map(s => (
                                <button key={s} onClick={() => setSecurity(s)} style={{
                                    flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 700,
                                    fontSize: '0.82rem', cursor: 'pointer', border: 'none',
                                    background: security === s ? 'var(--primary)' : 'var(--bg-main)',
                                    color: security === s ? 'white' : 'var(--text-muted)',
                                }}>
                                    {s === 'nopass' ? '비밀번호 없음' : s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                            WiFi 이름 (SSID)
                        </label>
                        <input
                            type="text"
                            value={ssid}
                            onChange={e => setSsid(e.target.value)}
                            placeholder="예) Chicvill_Guest"
                            style={{
                                padding: '14px 16px', borderRadius: '12px',
                                border: '1px solid var(--border)', background: 'var(--bg-main)',
                                color: 'var(--text-main)', fontSize: '1rem', outline: 'none',
                            }}
                        />
                    </div>

                    {security !== 'nopass' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                비밀번호
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="WiFi 비밀번호 입력"
                                    style={{
                                        width: '100%', padding: '14px 48px 14px 16px',
                                        borderRadius: '12px', border: '1px solid var(--border)',
                                        background: 'var(--bg-main)', color: 'var(--text-main)',
                                        fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <button onClick={() => setShowPass(p => !p)} style={{
                                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: '1.1rem', color: 'var(--text-muted)',
                                }}>
                                    {showPass ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handlePrint}
                        disabled={!ssid}
                        style={{
                            marginTop: '8px', padding: '16px', borderRadius: '14px', border: 'none',
                            background: ssid ? 'var(--primary)' : 'var(--border)',
                            color: ssid ? 'white' : 'var(--text-muted)',
                            fontWeight: 800, fontSize: '1rem',
                            cursor: ssid ? 'pointer' : 'not-allowed',
                        }}
                    >
                        🖨️ QR 인쇄하기
                    </button>
                </div>

                {/* QR 미리보기 — 인쇄 시 전체 화면 */}
                <div style={{
                    flex: '1', minWidth: '260px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '16px',
                    background: 'white', borderRadius: '20px', padding: '32px',
                    border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                }}>
                    {qrSrc ? (
                        <>
                            <img
                                src={qrSrc}
                                alt="WiFi QR"
                                style={{ width: '220px', height: '220px', borderRadius: '12px' }}
                            />
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#1e293b', marginBottom: '6px' }}>
                                    📶 {ssid}
                                </div>
                                {security !== 'nopass' && (
                                    <div style={{ fontSize: '0.9rem', color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                                        비밀번호: {password || '—'}
                                    </div>
                                )}
                                <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#94a3b8' }}>
                                    QR 코드를 스캔하면 자동으로 WiFi에 연결됩니다
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📶</div>
                            <p style={{ fontWeight: 600 }}>왼쪽에 WiFi 이름을 입력하면<br />QR 코드가 여기에 표시됩니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WifiQRManager;
