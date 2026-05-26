import React, { useState } from 'react';

interface Props {
  bundles: any[];
  storeId?: string;
  storeName?: string;
}

export const QRManager: React.FC<Props> = ({ bundles, storeId, storeName: initialStoreName }) => {
    const [printMode, setPrintMode] = useState<'single' | 'a4' | 'grid'>('single');

    const safeBundles = Array.isArray(bundles) ? bundles : [];
    const storeBundle = (storeId && safeBundles.find(b => b.type === 'StoreConfig' && (b.store_id === storeId || b.id === storeId)))
        || safeBundles.find(b => b.type === 'StoreConfig');
    const safeItems = Array.isArray(storeBundle?.items) ? storeBundle!.items : [];
    const resolvedStoreId = storeBundle?.store_id || storeBundle?.id || 'default_store';
    const storeName = safeItems.find((i: any) => i.name === '상호명' || i.name === 'brand')?.value || initialStoreName || '우리식당';

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
                    return { num: parseInt(match[1]), label: `Table ${match[1]}`, seats: match[2] ? match[2].trim() : '4' };
                }
                if (clean.includes(':')) {
                    const [left, right] = clean.split(':');
                    const parsedNum = parseInt(left.replace(/[^0-9]/g, ''));
                    if (!isNaN(parsedNum)) {
                        return { num: parsedNum, label: `Table ${parsedNum}`, seats: right ? right.trim() : '4' };
                    }
                }
                return null;
            }).filter(Boolean) as any[];
        } catch (e) {
            return [1, 2, 3, 4, 5, 6, 7, 8].map(num => ({ num, label: `Table ${num}`, seats: '4인석' }));
        }
    })();

    // 현재 접속 중인 브라우저의 주소(로컬 Vite 포트 또는 운영 도메인)를 그대로 사용하여 QR 생성
    let baseUrl = window.location.origin;
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        baseUrl = baseUrl.replace('localhost', '192.168.219.152').replace('127.0.0.1', '192.168.219.152');
    }

    const qrItems = [
        { title: "🛎️ 웨이팅 등록",       label: "WT", data: `${baseUrl}/?mode=waiting&action=register&table=99&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}` },
        { title: "📅 실시간 예약 신청",   label: "RS", data: `${baseUrl}/?mode=reserve&action=register&table=98&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}` },
        { title: "👥 직원 출퇴근",        label: "AB", data: `${baseUrl}/?mode=hr&action=checkin&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}` },
        { title: "📚 사용자 매뉴얼",      label: "MU", data: `${baseUrl}/?mode=manual&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}` },
        { title: "💳 자리에서 결제",      label: "PY", data: `${baseUrl}/?mode=customer&action=pay&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}` },
    ];

    const getQRUri = (data: string, size = 200) =>
        `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;

    const handlePrint = () => {
        const allCards = [
            ...qrItems.map(item => ({
                title: item.title,
                badge: item.label,
                badgeColor: '#0f172a',
                url: item.data,
            })),
            ...parsedTables.map(item => ({
                title: `${item.label} (${item.seats})`,
                badge: `T${String(item.num).padStart(2, '0')}[${item.seats.replace(/[^0-9]/g, '')}]`,
                badgeColor: '#f97316',
                url: `${baseUrl}/?mode=customer&table=${item.num}&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`,
            })),
        ];

        const isSingle = printMode === 'single';
        const isA4 = printMode === 'a4';
        const qrSize = isA4 ? 400 : 160;

        const cardStyle = isA4
            ? `display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;page-break-after:always;background:white;padding:40px;box-sizing:border-box;`
            : isSingle
            ? `display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:6px 4px;border:1.5px dashed #94a3b8;border-radius:8px;background:white;box-sizing:border-box;break-inside:avoid;height:100%;`
            : `display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:white;box-sizing:border-box;break-inside:avoid;height:100%;`;

        const gridStyle = isA4
            ? `display:block;`
            : isSingle
            ? `display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:1fr;gap:6px;width:100%;height:calc(297mm - 16mm);`
            : `display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr;gap:12px;width:100%;height:calc(297mm - 16mm);`;

        const titleStyle = isA4
            ? `font-size:2rem;font-weight:900;color:#0f172a;margin:0 0 30px;text-align:center;`
            : isSingle
            ? `font-size:0.72rem;font-weight:800;color:#0f172a;margin:0 0 6px;text-align:center;`
            : `font-size:1rem;font-weight:800;color:#0f172a;margin:0 0 10px;text-align:center;`;

        const imgBoxStyle = isA4
            ? `width:${qrSize}px;height:${qrSize}px;border:3px solid #000;border-radius:16px;padding:12px;background:white;flex-shrink:0;`
            : `width:100%;aspect-ratio:1;border:1px solid #e2e8f0;border-radius:8px;padding:3px;background:white;flex:1;min-height:0;`;

        const badgeStyle = (color: string) => isA4
            ? `margin-top:28px;background:${color};color:white;border-radius:50px;padding:10px 36px;font-size:1.4rem;font-weight:900;`
            : `margin-top:6px;background:${color};color:white;border-radius:50px;padding:2px 10px;font-size:0.65rem;font-weight:800;`;

        const cardsHtml = allCards.map(card => `
            <div style="${cardStyle}">
                <div style="${titleStyle}">${card.title}</div>
                <div style="${imgBoxStyle}">
                    <img src="${getQRUri(card.url, qrSize)}" style="width:100%;height:100%;display:block;object-fit:contain;" />
                </div>
                <div style="${badgeStyle(card.badgeColor)}">${card.badge}</div>
                ${isA4 ? `<div style="margin-top:20px;font-size:0.8rem;color:#64748b;font-family:monospace;word-break:break-all;max-width:500px;text-align:center;">${card.url}</div>` : ''}
            </div>
        `).join('');

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>QR 인쇄 - ${storeName}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: white; font-family: system-ui, sans-serif; }
  img { display: block; }
</style>
</head>
<body>
  <div style="${gridStyle}">
    ${cardsHtml}
  </div>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) { alert('팝업이 차단되었습니다. 팝업을 허용해주세요.'); return; }
        win.document.write(html);
        win.document.close();
        // 이미지 로딩 완료 후 인쇄 다이얼로그 열기
        win.onload = () => {
            const imgs = win.document.querySelectorAll('img');
            let loaded = 0;
            const tryPrint = () => { loaded++; if (loaded >= imgs.length) { win.focus(); win.print(); } };
            if (imgs.length === 0) { win.focus(); win.print(); }
            else { imgs.forEach(img => { if (img.complete) tryPrint(); else { img.onload = tryPrint; img.onerror = tryPrint; } }); }
        };
    };

    return (
        <div className="qr-manager-container animate-fade-in" style={{ padding: '16px' }}>
            <header className="page-header" style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--surface)', padding: '18px', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                {/* 제목 + 매장 정보 */}
                <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: '900', color: 'var(--text-main)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🔳 QR 마스터 인쇄 센터</h2>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.82rem' }}>
                        매장명: <strong style={{ color: 'var(--accent-orange)' }}>{storeName}</strong> <span style={{ opacity: 0.6 }}>(ID: {resolvedStoreId})</span>
                    </p>
                </div>

                {/* 인쇄 모드 선택 */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {([
                        { mode: 'single', icon: '📄', label: 'A4 모아찍기' },
                        { mode: 'a4',     icon: '📐', label: 'A4 낱장' },
                        { mode: 'grid',   icon: '🔳', label: '스티커 3열' },
                    ] as const).map(({ mode, icon, label }) => (
                        <button
                            key={mode}
                            onClick={() => setPrintMode(mode)}
                            style={{
                                flex: 1,
                                padding: '8px 4px',
                                borderRadius: '8px',
                                border: printMode === mode ? '2px solid var(--accent-orange)' : '1px solid var(--border)',
                                background: printMode === mode ? '#f9731615' : 'white',
                                color: printMode === mode ? 'var(--accent-orange)' : 'var(--text-main)',
                                fontWeight: '800',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {icon} {label}
                        </button>
                    ))}
                </div>

                {/* 인쇄 버튼 */}
                <button className="premium-btn" onClick={handlePrint} style={{ width: '100%', padding: '13px', fontSize: '1rem', boxShadow: '0 4px 15px rgba(249, 115, 22, 0.2)' }}>
                    🖨️ 인쇄하기 (Ctrl + P)
                </button>
            </header>

            {/* 미리보기 */}
            <div style={{ background: 'white', padding: '25px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: printMode === 'single' ? 'repeat(6, 1fr)' : printMode === 'a4' ? 'repeat(auto-fill, minmax(280px, 1fr))' : 'repeat(3, 1fr)',
                    gap: printMode === 'single' ? '12px' : '25px',
                }}>
                    {qrItems.map((item, idx) => (
                        <div key={idx} style={{
                            border: printMode === 'single' ? '1.5px dashed #cbd5e1' : '1px solid #f1f5f9',
                            background: '#fafafa', borderRadius: '12px',
                            padding: printMode === 'single' ? '10px' : '20px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                        }}>
                            <h3 style={{ margin: '0 0 10px', fontSize: printMode === 'single' ? '0.75rem' : '1rem', fontWeight: '900', color: '#1e293b' }}>{item.title}</h3>
                            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '4px', width: printMode === 'single' ? '80px' : '140px', height: printMode === 'single' ? '80px' : '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={getQRUri(item.data)} alt="QR" style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
                            </div>
                            <div style={{ background: '#0f172a', color: 'white', borderRadius: '50px', padding: printMode === 'single' ? '2px 8px' : '4px 15px', fontSize: printMode === 'single' ? '0.6rem' : '0.8rem', fontWeight: '900', marginTop: '8px' }}>{item.label}</div>
                        </div>
                    ))}
                    {parsedTables.map((item, idx) => (
                        <div key={idx} style={{
                            border: printMode === 'single' ? '1.5px dashed #cbd5e1' : '1px solid #f1f5f9',
                            background: '#fafafa', borderRadius: '12px',
                            padding: printMode === 'single' ? '10px' : '20px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                        }}>
                            <h3 style={{ margin: '0 0 10px', fontSize: printMode === 'single' ? '0.75rem' : '1rem', fontWeight: '900', color: '#1e293b' }}>
                                {item.label} <span style={{ fontSize: printMode === 'single' ? '10px' : '13px', color: 'var(--accent-orange)' }}>({item.seats})</span>
                            </h3>
                            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '4px', width: printMode === 'single' ? '80px' : '140px', height: printMode === 'single' ? '80px' : '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={getQRUri(`${baseUrl}/?mode=customer&table=${item.num}&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`)} alt={`${item.label} QR`} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
                            </div>
                            <div style={{ background: 'var(--accent-orange)', color: 'white', borderRadius: '50px', padding: printMode === 'single' ? '2px 8px' : '4px 15px', fontSize: printMode === 'single' ? '0.6rem' : '0.8rem', fontWeight: '900', marginTop: '8px' }}>{`T${String(item.num).padStart(2, '0')}[${item.seats.replace(/[^0-9]/g, '')}]`}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
