import os

filepath = r"c:\Users\USER\Desktop\Workstation\situation\situation-room\src\components\CounterPad.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Container Height, padding, gap
target_1 = """    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 146px)', overflow: 'hidden', background: 'var(--bg-main)', padding: '10px', gap: '8px', boxSizing: 'border-box' }}>"""

replacement_1 = """    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 110px)', overflow: 'hidden', background: 'var(--bg-main)', padding: '4px 4px 0', gap: '4px', boxSizing: 'border-box' }}>"""

# 2. Table grid margin & padding
target_2 = """            {/* ── 상단 바: 테이블 그리드 ── */}
            <div style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)', borderRadius: '12px', padding: '10px 12px 8px', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>테이블 현황 <span style={{ color: 'var(--accent)' }}>{sessions.length}석 활성</span></span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>"""

replacement_2 = """            {/* ── 상단 바: 테이블 그리드 ── */}
            <div style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)', borderRadius: '12px', padding: '4px 8px 4px', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>현황: <span style={{ color: 'var(--accent)' }}>{sessions.length}석 활성</span></span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>"""

# 3. Legend dots
target_3 = """                        {STAGE_PIPELINE.filter(s => s.key !== 'initial').map(s => (
                            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: s.bg, border: `1px solid ${s.color}66`, flexShrink: 0 }} />
                                <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>{s.label}</span>
                            </div>
                        ))}"""

replacement_3 = """                        {STAGE_PIPELINE.filter(s => s.key !== 'initial').map(s => (
                            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <div style={{ width: '5px', height: '5px', borderRadius: '1px', background: s.bg, border: `1px solid ${s.color}66`, flexShrink: 0 }} />
                                <span style={{ fontSize: '0.52rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.label}</span>
                            </div>
                        ))}"""

# 4. Table Grid button styling
target_4 = """                                style={{
                                    padding: '6px 4px',
                                    borderRadius: '8px',
                                    border: buttonBorder,
                                    background: buttonBg,
                                    color: buttonColor,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    boxShadow: isSelected ? `0 0 0 3px ${color}22` : (!isWaiting && hasAlert) ? `0 0 8px ${color}44` : 'none',
                                    transition: isWaiting ? 'none' : 'all 0.15s',
                                    ...(isWaiting ? {} : { animation: hasAlert ? 'pulse-mild 2s infinite' : 'none' }),
                                }}
                            >
                                <div style={{ fontSize: stage === 'initial' ? '0.72rem' : '0.85rem', fontWeight: '900', color: 'inherit' }}>{tableId}</div>
                                <div style={{ lineHeight: 1.1, fontSize: stage === 'initial' ? '0.72rem' : '0.85rem', fontWeight: '900', color: 'inherit' }}>{label}</div>"""

replacement_4 = """                                style={{
                                    padding: '3px 2px',
                                    borderRadius: '6px',
                                    border: buttonBorder,
                                    background: buttonBg,
                                    color: buttonColor,
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    boxShadow: isSelected ? `0 0 0 2px ${color}22` : (!isWaiting && hasAlert) ? `0 0 6px ${color}44` : 'none',
                                    transition: isWaiting ? 'none' : 'all 0.15s',
                                    ...(isWaiting ? {} : { animation: hasAlert ? 'pulse-mild 2s infinite' : 'none' }),
                                }}
                            >
                                <div style={{ fontSize: '0.7rem', fontWeight: '900', color: 'inherit', whiteSpace: 'nowrap' }}>{tableId}</div>
                                <div style={{ lineHeight: 1.1, fontSize: '0.58rem', fontWeight: '800', color: 'inherit', whiteSpace: 'nowrap' }}>{label}</div>"""

# 5. Bottom Detail view gap & TABLE selected status details header
target_5 = """            {/* ── 하단: 선택 테이블 상세 ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'auto', minHeight: 0 }}>
                    {selectedTableId && selectedStage ? (
                        <>
                            {/* 헤더 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', borderRadius: '10px', padding: '10px 14px', border: `2px solid ${selectedStage.color}33`, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '1.3rem', fontWeight: '900', color: selectedStage.color }}>
                                    TABLE {selectedTableId}
                                </span>
                                <span style={{ background: selectedStage.bg, color: selectedStage.color, padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: `1px solid ${selectedStage.color}44` }}>
                                    {selectedStage.label}
                                </span>
                                {selectedSession && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {selectedSession.session_id}
                                        </span>
                                    </div>
                                )}
                            </div>"""

replacement_5 = """            {/* ── 하단: 선택 테이블 상세 ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'auto', minHeight: 0 }}>
                    {selectedTableId && selectedStage ? (
                        <>
                            {/* 헤더 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface)', borderRadius: '8px', padding: '4px 8px', border: `1px solid ${selectedStage.color}33`, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: '900', color: selectedStage.color }}>
                                    TABLE {selectedTableId}
                                </span>
                                <span style={{ background: selectedStage.bg, color: selectedStage.color, padding: '1px 5px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700', border: `1px solid ${selectedStage.color}44` }}>
                                    {selectedStage.label}
                                </span>
                                {selectedSession && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                                        <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {selectedSession.session_id}
                                        </span>
                                    </div>
                                )}
                            </div>"""

# 6. Order List title header
target_6 = """                                    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>주문 내역</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{activeOrders.length}건</span>
                                            <button 
                                                onClick={() => setShowAddOrder(!showAddOrder)} 
                                                style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                {showAddOrder ? '✕ 닫기' : '➕ 구두 주문 추가'}
                                            </button>
                                        </div>
                                    </div>"""

replacement_6 = """                                    <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)' }}>주문 내역</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{activeOrders.length}건</span>
                                            <button 
                                                onClick={() => setShowAddOrder(!showAddOrder)} 
                                                style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                            >
                                                {showAddOrder ? '✕ 닫기' : '➕ 구두 주문 추가'}
                                            </button>
                                        </div>
                                    </div>"""

# 7. Order rows padding/gaps
target_7 = """                                                    <div key={order.order_id} style={{
                                                        padding: '10px 14px',
                                                        borderBottom: idx < activeOrders.length - 1 ? '1px solid var(--border)' : 'none',
                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                        background: 'transparent',
                                                        borderLeft: '3px solid transparent',
                                                    }}>"""

replacement_7 = """                                                    <div key={order.order_id} style={{
                                                        padding: '4px 8px',
                                                        borderBottom: idx < activeOrders.length - 1 ? '1px solid var(--border)' : 'none',
                                                        display: 'flex', alignItems: 'center', gap: '6px',
                                                        background: 'transparent',
                                                        borderLeft: '3px solid transparent',
                                                    }}>"""

# 8. Order row details and action buttons
target_8 = """                                                        {/* 차수 배지 */}
                                                        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: '36px' }}>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)' }}>#{order.order_seq || 1}</div>
                                                        </div>

                                                        {/* 메뉴 목록 */}
                                                        <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                                                            {(order.items || []).map((item: any) => `${item.name} ${item.quantity || item.qty}개`).join(' · ')}
                                                        </div>

                                                        {/* 금액 */}
                                                        <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                                            <div style={{ fontSize: '0.88rem', fontWeight: '800', color: isPaidFull ? '#10b981' : 'var(--accent)', whiteSpace: 'nowrap' }}>
                                                                {orderAmt.toLocaleString()}원
                                                            </div>
                                                            <div style={{ fontSize: '0.6rem', fontWeight: '600', color: isPrepaid ? '#10b981' : '#9ca3af' }}>
                                                                {isPrepaid ? '선불' : '후불'}
                                                            </div>
                                                        </div>

                                                        {/* 액션 버튼 */}
                                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                            <button onClick={() => handleCancelWithRefund(order)} style={{ background: 'transparent', border: '1px solid #fca5a5', color: '#ef4444', padding: '4px 8px', borderRadius: '5px', fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>취소</button>
                                                            {isReady ? (
                                                                <button onClick={() => handleStatusUpdate(order.order_id, 'served')} style={{ background: '#10b981', border: 'none', color: 'white', padding: '4px 10px', borderRadius: '5px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: '700', whiteSpace: 'nowrap', boxShadow: '0 0 8px rgba(16,185,129,0.4)' }}>
                                                                    🍽️ 서빙
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    disabled={isPaidFull}
                                                                    onClick={() => setSelectedOrderForPay(order)}
                                                                    style={{ background: isPaidFull ? '#e5e7eb' : 'var(--accent)', border: 'none', color: isPaidFull ? '#9ca3af' : 'white', padding: '4px 10px', borderRadius: '5px', fontSize: '0.72rem', cursor: isPaidFull ? 'default' : 'pointer', fontWeight: '700', whiteSpace: 'nowrap' }}
                                                                >
                                                                    {isPrepaid ? '완료' : (order.status === 'paid' || order.payment_status === 'paid') ? '완료' : '결제'}
                                                                </button>
                                                            )}
                                                        </div>"""

replacement_8 = """                                                        {/* 차수 배지 */}
                                                        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: '28px' }}>
                                                            <div style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--text-muted)' }}>#{order.order_seq || 1}</div>
                                                        </div>

                                                        {/* 메뉴 목록 */}
                                                        <div style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.3 }}>
                                                            {(order.items || []).map((item: any) => `${item.name} ${item.quantity || item.qty}개`).join(' · ')}
                                                        </div>

                                                        {/* 금액 */}
                                                        <div style={{ flexShrink: 0, textAlign: 'right', marginRight: '4px' }}>
                                                            <div style={{ fontSize: '0.82rem', fontWeight: '800', color: isPaidFull ? '#10b981' : 'var(--accent)', whiteSpace: 'nowrap' }}>
                                                                {orderAmt.toLocaleString()}원
                                                            </div>
                                                            <div style={{ fontSize: '0.58rem', fontWeight: '600', color: isPrepaid ? '#10b981' : '#9ca3af' }}>
                                                                {isPrepaid ? '선불' : '후불'}
                                                            </div>
                                                        </div>

                                                        {/* 액션 버튼 */}
                                                        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                                                            <button onClick={() => handleCancelWithRefund(order)} style={{ background: 'transparent', border: '1px solid #fca5a5', color: '#ef4444', padding: '3px 5px', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>취소</button>
                                                            {isReady ? (
                                                                <button onClick={() => handleStatusUpdate(order.order_id, 'served')} style={{ background: '#10b981', border: 'none', color: 'white', padding: '3px 6px', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', fontWeight: '700', whiteSpace: 'nowrap', boxShadow: '0 0 6px rgba(16,185,129,0.3)' }}>
                                                                    서빙
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    disabled={isPaidFull}
                                                                    onClick={() => setSelectedOrderForPay(order)}
                                                                    style={{ background: isPaidFull ? '#e5e7eb' : 'var(--accent)', border: 'none', color: isPaidFull ? '#9ca3af' : 'white', padding: '3px 6px', borderRadius: '4px', fontSize: '0.65rem', cursor: isPaidFull ? 'default' : 'pointer', fontWeight: '700', whiteSpace: 'nowrap' }}
                                                                >
                                                                    {isPrepaid ? '완료' : '결제'}
                                                                </button>
                                                            )}
                                                        </div>"""

# Execute safe replacements
replacements = [
    (target_1, replacement_1, "1. Height/padding"),
    (target_2, replacement_2, "2. Table grid margin"),
    (target_3, replacement_3, "3. Legend dots"),
    (target_4, replacement_4, "4. Table buttons styling"),
    (target_5, replacement_5, "5. selected table header"),
    (target_6, replacement_6, "6. Order List title header"),
    (target_7, replacement_7, "7. Order rows padding"),
    (target_8, replacement_8, "8. Order row details and action buttons"),
]

for t, r, label in replacements:
    if t in code:
        code = code.replace(t, r)
        print("Success: " + label)
    else:
        print("Target NOT found: " + label)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(code)
