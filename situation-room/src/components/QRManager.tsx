import React, { useState, useEffect } from 'react';

interface Props {
  bundles: any[];
  storeId?: string;
  storeName?: string;
}

export const QRManager: React.FC<Props> = ({ bundles, storeId, storeName: initialStoreName }) => {
    const [printMode, setPrintMode] = useState<'single' | 'a4' | 'grid'>('single');

    const [tableQty, setTableQty] = useState(0);
    const [funcQty, setFuncQty] = useState(5);
    const [receiverName, setReceiverName] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [orderNotes, setOrderNotes] = useState('');
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [placedOrderId, setPlacedOrderId] = useState('');

    const safeBundles = Array.isArray(bundles) ? bundles : [];
    const storeBundle = (storeId && safeBundles.find(b => b.type === 'StoreConfig' && (b.store_id === storeId || b.id === storeId)))
        || safeBundles.find(b => b.type === 'StoreConfig');
    const safeItems = Array.isArray(storeBundle?.items) ? storeBundle!.items : [];
    const resolvedStoreId = storeBundle?.store_id || storeBundle?.id || 'default_store';
    const storeName = safeItems.find((i: any) => i.name === '상호명' || i.name === 'brand')?.value || initialStoreName || '우리식당';
    const storePhone = safeItems.find((i: any) => i.name === '전화번호' || i.name === '연락처' || i.name === '대표번호' || i.name === 'phone')?.value || '010-3269-3343';

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

    useEffect(() => {
        setTableQty(parsedTables.length);
    }, [parsedTables.length]);

    // 현재 접속 중인 브라우저의 주소(로컬 Vite 포트 또는 운영 도메인)를 그대로 사용하여 QR 생성
    let baseUrl = window.location.origin;
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        baseUrl = baseUrl.replace('localhost', '92.168.219.170').replace('127.0.0.1', '92.168.219.170');
    }

    const qrItems = [
        { title: "🛎️ 대기 등록",       label: "WT", data: `${baseUrl}/?mode=waiting&action=register&table=99&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}` },
        { title: "📅 실시간 예약",   label: "RS", data: `${baseUrl}/?mode=reserve&action=register&table=98&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}` },
        { title: "👥 직원 출퇴근",        label: "AB", data: `${baseUrl}/?mode=hr&action=checkin&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}` },
        { title: "📚 사용자 메뉴얼",      label: "MU", data: `${baseUrl}/?mode=manual&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}` },
        { title: "💳 카운터에서 결제",      label: "PY", data: `${baseUrl}/?mode=customer&action=pay&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}` },
    ];

    const getQRUri = (data: string, size = 200) =>
        `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;

    const handlePrint = () => {
        const allCards: any[] = [
            ...qrItems.map(item => ({
                title: item.title,
                url: item.data,
                isTable: false,
                storeName: storeName,
                storePhone: storePhone,
            })),
            ...parsedTables.map(item => ({
                title: `테이블 ${item.num} (${item.seats})`,
                url: `${baseUrl}/?mode=customer&table=${item.num}&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`,
                isTable: true,
                tableNum: item.num,
                tableSeats: item.seats,
                storeName: storeName,
                storePhone: storePhone,
            })),
        ];

        const isSingle = printMode === 'single';
        const isA4 = printMode === 'a4';
        const qrSize = isA4 ? 400 : 160;

        const cardStyle = isA4
            ? `display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;page-break-after:always;background:white;padding:40px;box-sizing:border-box;`
            : isSingle
            ? `display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:12px 6px;border:1.5px dashed #94a3b8;border-radius:8px;background:white;box-sizing:border-box;break-inside:avoid;height:100%;`
            : `display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:20px 14px;border:1px solid #e2e8f0;border-radius:10px;background:white;box-sizing:border-box;break-inside:avoid;height:100%;`;

        const gridStyle = isA4
            ? `display:block;`
            : isSingle
            ? `display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:1fr;gap:6px;width:100%;height:calc(297mm - 16mm);`
            : `display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr;gap:12px;width:100%;height:calc(297mm - 16mm);`;

        const titleStyle = isA4
            ? `font-size:2.4rem;font-weight:900;color:#0f172a;margin:0 0 30px;text-align:center;`
            : isSingle
            ? `font-size:0.75rem;font-weight:900;color:#0f172a;margin:0 0 6px;text-align:center;`
            : `font-size:1.1rem;font-weight:900;color:#0f172a;margin:0 0 10px;text-align:center;`;

        const imgBoxStyle = isA4
            ? `width:${qrSize}px;height:${qrSize}px;border:3px solid #000;border-radius:16px;padding:12px;background:white;flex-shrink:0;`
            : `width:100%;aspect-ratio:1;border:1px solid #e2e8f0;border-radius:8px;padding:3px;background:white;flex:1;min-height:0;`;

        const cardsHtml = allCards.map(card => {
            const bottomHtml = `
                <div style="margin-top:${isA4 ? '28px' : '10px'};text-align:center;width:100%;">
                    <div style="font-size:${isA4 ? '1.8rem' : '0.82rem'};font-weight:900;color:#0f172a;word-break:break-all;line-height:1.25;">${card.storeName}</div>
                    <div style="font-size:${isA4 ? '1.25rem' : '0.68rem'};font-weight:700;color:#64748b;margin-top:2px;">Tel: ${card.storePhone}</div>
                </div>
            `;

            if (card.isTable) {
                return `
                    <div style="${cardStyle}">
                        <div style="${titleStyle}">테이블 ${card.tableNum} (${card.tableSeats})</div>
                        <div style="${imgBoxStyle}">
                            <img src="${getQRUri(card.url, qrSize)}" style="width:100%;height:100%;display:block;object-fit:contain;" />
                        </div>
                        ${bottomHtml}
                    </div>
                `;
            } else {
                return `
                    <div style="${cardStyle}">
                        <div style="${titleStyle}">${card.title}</div>
                        <div style="${imgBoxStyle}">
                            <img src="${getQRUri(card.url, qrSize)}" style="width:100%;height:100%;display:block;object-fit:contain;" />
                        </div>
                        ${bottomHtml}
                    </div>
                `;
            }
        }).join('');

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
                            <div style={{ marginTop: '8px', textAlign: 'center', width: '100%' }}>
                                <div style={{ fontSize: printMode === 'single' ? '0.78rem' : '0.92rem', fontWeight: '900', color: '#1e293b', wordBreak: 'break-all' }}>{storeName}</div>
                                <div style={{ fontSize: printMode === 'single' ? '0.68rem' : '0.75rem', fontWeight: '700', color: '#64748b', marginTop: '2px' }}>Tel: {storePhone}</div>
                            </div>
                        </div>
                    ))}
                    {parsedTables.map((item, idx) => (
                        <div key={idx} style={{
                            border: printMode === 'single' ? '1.5px dashed #cbd5e1' : '1px solid #f1f5f9',
                            background: '#fafafa', borderRadius: '12px',
                            padding: printMode === 'single' ? '10px' : '20px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                        }}>
                            <h3 style={{ margin: '0 0 10px', fontSize: printMode === 'single' ? '0.75rem' : '1.1rem', fontWeight: '900', color: '#1e293b' }}>
                                테이블 {item.num} ({item.seats})
                            </h3>
                            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '4px', width: printMode === 'single' ? '80px' : '140px', height: printMode === 'single' ? '80px' : '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src={getQRUri(`${baseUrl}/?mode=customer&table=${item.num}&storeId=${resolvedStoreId}&store=${encodeURIComponent(storeName)}`)} alt={`${item.label} QR`} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
                            </div>
                            <div style={{ marginTop: '8px', textAlign: 'center', width: '100%' }}>
                                <div style={{ fontSize: printMode === 'single' ? '0.78rem' : '0.92rem', fontWeight: '900', color: '#1e293b', wordBreak: 'break-all' }}>{storeName}</div>
                                <div style={{ fontSize: printMode === 'single' ? '0.68rem' : '0.75rem', fontWeight: '700', color: '#64748b', marginTop: '2px' }}>Tel: {storePhone}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 💎 프리미엄 방수 플라스틱 QR 명판 제작 주문 */}
            <div style={{
                background: 'var(--surface)',
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                marginTop: '25px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
                fontFamily: 'system-ui, sans-serif'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <span style={{ fontSize: '1.5rem' }}>💎</span>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)' }}>
                        테이블 부착용 방수 플라스틱 QR 명판 주문
                    </h3>
                </div>

                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                    인쇄소 출력 번거로움 없이, <strong>물에 젖지 않는 내구성 강한 아크릴 플라스틱 명판</strong>을 간편하게 주문하세요.<br />
                    명판 뒷면에 강력 양면테이프가 부착되어 배송되므로 테이블에 바로 부착하실 수 있습니다. (장당 단가: <strong>200원</strong>)
                </p>

                {orderSuccess ? (
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1.5px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center',
                        color: 'var(--text-main)'
                    }}>
                        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '10px' }}>🎉</span>
                        <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>QR 명판 주문 접수 완료!</h4>
                        <p style={{ fontSize: '0.88rem', margin: '0 0 15px', color: 'var(--text-muted)' }}>
                            주문 번호: <strong>{placedOrderId}</strong><br />
                            아래 가상 전용 계좌로 입금해 주시면, 제작을 시작하여 3영업일 이내에 출고 및 배송됩니다.
                        </p>
                        
                        <div style={{
                            background: 'var(--bg-main)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '14px',
                            fontSize: '0.85rem',
                            textAlign: 'left',
                            maxWidth: '360px',
                            margin: '0 auto 20px',
                            lineHeight: '1.6'
                        }}>
                            <strong>💰 입금 계좌 안내:</strong><br />
                            • 은행명: <strong>국민은행</strong><br />
                            • 계좌번호: <strong>123-45-6789-012</strong><br />
                            • 예금주: <strong>(주)시튜에이션스마트POS</strong><br />
                            • 입금 금액: <strong>{((tableQty + funcQty) * 200 + ((tableQty + funcQty) >= 25 ? 0 : 2500)).toLocaleString()}원</strong>
                        </div>

                        <button 
                            onClick={() => {
                                setOrderSuccess(false);
                                setReceiverName('');
                                setDeliveryAddress('');
                                setContactNumber('');
                                setOrderNotes('');
                            }}
                            style={{
                                padding: '10px 20px',
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                            }}
                        >
                            새로 주문하기
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap' }}>
                        {/* 주문 수량 설정 및 견적 */}
                        <div style={{
                            background: 'var(--bg-main)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '18px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <h4 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                    📋 주문 구성 및 견적
                                </h4>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-main)' }}>테이블 QR 명판 (개당 200원)</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <input 
                                                type="number" 
                                                min={0} 
                                                value={tableQty} 
                                                onChange={e => setTableQty(Math.max(0, parseInt(e.target.value) || 0))}
                                                style={{ width: '60px', padding: '4px', border: '1px solid var(--border)', borderRadius: '6px', textAlign: 'center', background: 'var(--surface)', color: 'var(--text-main)' }} 
                                            />
                                            <span style={{ color: 'var(--text-muted)' }}>개</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--text-main)' }}>부가 기능 QR 명판 (개당 200원)</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <input 
                                                type="number" 
                                                min={0} 
                                                value={funcQty} 
                                                onChange={e => setFuncQty(Math.max(0, parseInt(e.target.value) || 0))}
                                                style={{ width: '60px', padding: '4px', border: '1px solid var(--border)', borderRadius: '6px', textAlign: 'center', background: 'var(--surface)', color: 'var(--text-main)' }} 
                                            />
                                            <span style={{ color: 'var(--text-muted)' }}>개</span>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginTop: '4px' }}>
                                        * 기본 포함 기능: 대기, 예약, 출퇴근, 매설, 결제 QR 명판 총 5개
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px dashed var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                    <span>상품 금액 (총 {tableQty + funcQty}개)</span>
                                    <span style={{ color: 'var(--text-main)' }}>{((tableQty + funcQty) * 200).toLocaleString()}원</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                    <span>배송비 (25개 이상 주문 시 무료)</span>
                                    <span style={{ color: 'var(--text-main)' }}>{(tableQty + funcQty) >= 25 ? '무료' : '2,500원'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '900', color: 'var(--text-main)' }}>
                                    <span>최종 금액</span>
                                    <span style={{ color: 'var(--accent-orange)' }}>
                                        {((tableQty + funcQty) * 200 + ((tableQty + funcQty) >= 25 ? 0 : 2500)).toLocaleString()}원
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 배송 정보 입력 폼 */}
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (!receiverName.trim() || !deliveryAddress.trim() || !contactNumber.trim()) {
                                alert('수령인, 주소, 연락처를 모두 입력해 주세요.');
                                return;
                            }
                            const randId = 'QR-' + Math.floor(100000 + Math.random() * 900000);
                            setPlacedOrderId(randId);
                            setOrderSuccess(true);
                            alert(`🎉 QR 명판 제작 주문이 성공적으로 접수되었습니다.\n주문 번호: ${randId}`);
                        }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>수령인 성함 *</label>
                                <input 
                                    type="text" 
                                    value={receiverName} 
                                    onChange={e => setReceiverName(e.target.value)} 
                                    placeholder="홍길동" 
                                    required 
                                    style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.85rem' }} 
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>연락처 (휴대폰 번호) *</label>
                                <input 
                                    type="tel" 
                                    value={contactNumber} 
                                    onChange={e => setContactNumber(e.target.value)} 
                                    placeholder="010-1234-5678" 
                                    required 
                                    style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.85rem' }} 
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>배송지 주소 *</label>
                                <input 
                                    type="text" 
                                    value={deliveryAddress} 
                                    onChange={e => setDeliveryAddress(e.target.value)} 
                                    placeholder="배송받으실 전체 상세 주소를 입력하세요" 
                                    required 
                                    style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.85rem' }} 
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>요청 사항 (선택)</label>
                                <input 
                                    type="text" 
                                    value={orderNotes} 
                                    onChange={e => setOrderNotes(e.target.value)} 
                                    placeholder="예: 문 앞에 놓아주세요" 
                                    style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.85rem' }} 
                                />
                            </div>

                            <button 
                                type="submit" 
                                className="premium-btn" 
                                style={{
                                    marginTop: '8px',
                                    padding: '12px',
                                    fontSize: '0.9rem',
                                    fontWeight: '800',
                                    background: 'var(--accent-orange)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)'
                                }}
                            >
                                📦 명판 인쇄 제작 주문 접수
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
