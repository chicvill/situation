import React, { useMemo } from 'react';
import { useStoreFilter } from '../hooks/useStoreFilter';
import type { BundleData } from '../types';

interface DisplayBoardProps {
    bundles: BundleData[];
}

export const DisplayBoard: React.FC<DisplayBoardProps> = ({ bundles }) => {
    const { storeId } = useStoreFilter();
    
    // 사장님 요청: 오직 'ready' (조리 완료) 상태인 주문만 전광판에 노출 (매장 격리 적용)
    const readyOrders = useMemo(() => {
        return bundles
            .filter(b => b.type === 'Orders' && b.status === 'ready' && (storeId === 'Total' || b.store_id === storeId || !b.store_id))
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // 최신순 정렬
    }, [bundles, storeId]);

    // 테이블 번호 추출 함수 (과거 데이터 호환성 유지)
    const getTableLabel = (order: BundleData) => {
        if (order.table && order.table !== 'null') {
            return order.table === '포장' ? '포장' : `${order.table}번 테이블`;
        }
        
        // 1. 제목(title)에서 추출 (예: "테이블 3 - ..." -> "3번 테이블")
        const titleMatch = order.title.match(/테이블\s*(\d+)/) || order.title.match(/Table\s*(\d+)/i);
        if (titleMatch) return `${titleMatch[1]}번 테이블`;

        // 2. 제목에서 포장 여부 확인
        if (order.title.includes('포장')) return '포장';

        // 3. items에서 검색
        const tableItem = order.items.find(i => i.name === '테이블' || i.name === 'table');
        if (tableItem) return `${tableItem.value}번 테이블`;
        
        return '일반 주문';
    };

    // 포장 여부 확인 함수
    const isTakeout = (order: BundleData) => {
        return getTableLabel(order) === '포장';
    };

    // 주문에서 유효한 메뉴 목록만 추출하는 헬퍼 함수
    const getMenuItems = (order: BundleData) => {
        return order.items.filter(item => {
            const lowerName = item.name.toLowerCase();
            const excludeKeywords = [
                '결제수단', '테이블', 'table', 'brand', '상호명', 
                '납부상태', '대표자', '사업자번호', '주소', 'payment', 
                'session_id', 'store_id', 'device_id'
            ];
            
            if (excludeKeywords.some(kw => lowerName.includes(kw))) {
                return false;
            }
            
            // "메뉴"나 "menu"라는 이름이면서 더미 주문인 경우 제외
            if ((lowerName === '메뉴' || lowerName === 'menu') && item.value.includes('디지털 주문')) {
                return false;
            }
            
            return true;
        });
    };

    return (
        <div className="display-board-container" style={{ 
            minHeight: '100vh', 
            padding: '40px 20px',
            textAlign: 'center',
            position: 'relative'
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&family=Noto+Sans+KR:wght@400;700;900&display=swap');
                
                .display-board-container {
                    font-family: 'Outfit', 'Noto Sans KR', sans-serif;
                    background: radial-gradient(circle at 50% 50%, #080711 0%, #020105 100%);
                    position: relative;
                    overflow-x: hidden;
                    overflow-y: auto;
                    z-index: 1;
                }
                
                .display-board-container::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-image: 
                        linear-gradient(to right, rgba(0, 242, 254, 0.02) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(0, 242, 254, 0.02) 1px, transparent 1px);
                    background-size: 50px 50px;
                    animation: grid-move 25s linear infinite;
                    pointer-events: none;
                    z-index: -1;
                }

                @keyframes grid-move {
                    0% { background-position: 0 0; }
                    100% { background-position: 50px 50px; }
                }

                .neon-title {
                    font-size: 3rem;
                    font-weight: 900;
                    margin: 20px 0 10px 0;
                    background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    filter: drop-shadow(0 0 15px rgba(0, 242, 254, 0.6));
                    animation: neon-title-glow 2s ease-in-out infinite alternate;
                    letter-spacing: -1px;
                }

                @keyframes neon-title-glow {
                    from {
                        filter: drop-shadow(0 0 8px rgba(0, 242, 254, 0.4)) drop-shadow(0 0 2px rgba(0, 242, 254, 0.2));
                    }
                    to {
                        filter: drop-shadow(0 0 20px rgba(0, 242, 254, 0.8)) drop-shadow(0 0 10px rgba(79, 172, 254, 0.5));
                    }
                }

                .cyber-card {
                    background: rgba(13, 11, 26, 0.7);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(0, 242, 254, 0.15);
                    border-radius: 28px;
                    padding: 26px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), inset 0 0 25px rgba(0, 242, 254, 0.02);
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                    overflow: hidden;
                }

                .cyber-card::before {
                    content: '';
                    position: absolute;
                    top: -50%; left: -50%; width: 200%; height: 200%;
                    background: radial-gradient(circle, rgba(0, 242, 254, 0.06) 0%, transparent 60%);
                    opacity: 0;
                    transition: opacity 0.4s ease;
                    pointer-events: none;
                }

                .cyber-card:hover {
                    transform: translateY(-8px) scale(1.02);
                    border-color: rgba(0, 242, 254, 0.45);
                    box-shadow: 
                        0 25px 50px rgba(0, 242, 254, 0.18),
                        0 0 30px rgba(0, 242, 254, 0.12),
                        inset 0 0 20px rgba(0, 242, 254, 0.04);
                }

                .cyber-card:hover::before {
                    opacity: 1;
                }

                /* 포장 카드 개별 스타일 */
                .cyber-card.takeout-card {
                    border-color: rgba(249, 115, 22, 0.18);
                }

                .cyber-card.takeout-card:hover {
                    border-color: rgba(249, 115, 22, 0.5);
                    box-shadow: 
                        0 25px 50px rgba(249, 115, 22, 0.18),
                        0 0 30px rgba(249, 115, 22, 0.12),
                        inset 0 0 20px rgba(249, 115, 22, 0.04);
                }

                .cyber-card.takeout-card::before {
                    background: radial-gradient(circle, rgba(249, 115, 22, 0.06) 0%, transparent 60%);
                }

                .badge-neon-blue {
                    background: rgba(0, 242, 254, 0.08);
                    border: 1px solid rgba(0, 242, 254, 0.3);
                    color: #00f2fe;
                    padding: 6px 14px;
                    border-radius: 50px;
                    font-size: 0.85rem;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    box-shadow: 0 0 10px rgba(0, 242, 254, 0.05);
                }

                .badge-neon-orange {
                    background: rgba(249, 115, 22, 0.08);
                    border: 1px solid rgba(249, 115, 22, 0.3);
                    color: #f97316;
                    padding: 6px 14px;
                    border-radius: 50px;
                    font-size: 0.85rem;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    box-shadow: 0 0 10px rgba(249, 115, 22, 0.05);
                }

                .neon-divider {
                    height: 1px;
                    background: linear-gradient(90deg, transparent 0%, rgba(0, 242, 254, 0.3) 25%, rgba(157, 78, 223, 0.3) 75%, transparent 100%);
                    margin: 18px 0;
                }

                .takeout-divider {
                    background: linear-gradient(90deg, transparent 0%, rgba(249, 115, 22, 0.3) 25%, rgba(236, 72, 153, 0.3) 75%, transparent 100%);
                }

                .order-item-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 14px;
                    border-radius: 14px;
                    background: rgba(255, 255, 255, 0.015);
                    margin-bottom: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.03);
                    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .order-item-row:hover {
                    background: rgba(255, 255, 255, 0.04);
                    border-color: rgba(255, 255, 255, 0.08);
                    transform: translateX(4px);
                }

                .item-qty-badge {
                    background: linear-gradient(135deg, rgba(0, 242, 254, 0.1) 0%, rgba(157, 78, 223, 0.1) 100%);
                    border: 1px solid rgba(0, 242, 254, 0.3);
                    color: #00f2fe;
                    padding: 3px 10px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    box-shadow: 0 0 12px rgba(0, 242, 254, 0.1);
                    flex-shrink: 0;
                }

                .takeout-item-qty-badge {
                    background: linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%);
                    border: 1px solid rgba(249, 115, 22, 0.3);
                    color: #f97316;
                    padding: 3px 10px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    box-shadow: 0 0 12px rgba(249, 115, 22, 0.1);
                    flex-shrink: 0;
                }

                .items-scroll-container::-webkit-scrollbar {
                    width: 4px;
                }
                .items-scroll-container::-webkit-scrollbar-track {
                    background: transparent;
                }
                .items-scroll-container::-webkit-scrollbar-thumb {
                    background: rgba(0, 242, 254, 0.2);
                    border-radius: 4px;
                }
                .items-scroll-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 242, 254, 0.4);
                }

                .pulse-ready {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #10b981;
                    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
                    animation: pulse-ready-glow 1.5s infinite;
                    vertical-align: middle;
                    margin-right: 8px;
                }

                @keyframes pulse-ready-glow {
                    0% {
                        transform: scale(0.95);
                        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
                    }
                    70% {
                        transform: scale(1);
                        box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
                    }
                    100% {
                        transform: scale(0.95);
                        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
                    }
                }

                .pulse-takeout {
                    background-color: #f97316;
                    box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7);
                    animation: pulse-takeout-glow 1.5s infinite;
                }

                @keyframes pulse-takeout-glow {
                    0% {
                        transform: scale(0.95);
                        box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7);
                    }
                    70% {
                        transform: scale(1);
                        box-shadow: 0 0 0 10px rgba(249, 115, 22, 0);
                    }
                    100% {
                        transform: scale(0.95);
                        box-shadow: 0 0 0 0 rgba(249, 115, 22, 0);
                    }
                }
                
                .glowing-number {
                    text-shadow: 0 0 15px rgba(255, 255, 255, 0.2), 0 0 25px rgba(0, 242, 254, 0.4);
                }
                
                .takeout-glowing-number {
                    text-shadow: 0 0 15px rgba(255, 255, 255, 0.2), 0 0 25px rgba(249, 115, 22, 0.4);
                }
            `}</style>

            <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
                {/* Header Section */}
                <div style={{ marginBottom: '50px' }}>
                    <h1 className="neon-title">📢 PICK UP YOUR FOOD</h1>
                    <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.2rem', fontWeight: '500', marginTop: '10px' }}>
                        음식이 맛있게 준비되었습니다. 주문 번호를 확인해 주세요!
                    </p>
                </div>

                {/* Orders Grid */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
                    gap: '24px', 
                    margin: '0 auto' 
                }}>
                    {readyOrders.map(order => {
                        const takeout = isTakeout(order);
                        const menuItems = getMenuItems(order);
                        const displayCode = order.order_code || order.id.substring(0, 4).toUpperCase();
                        const timeString = order.timestamp ? order.timestamp.substring(0, 5) : '';

                        return (
                            <div key={order.id} className={`cyber-card ${takeout ? 'takeout-card' : ''} animate-pop-in`}>
                                {/* Header Info inside Card */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                    <span className={takeout ? 'badge-neon-orange' : 'badge-neon-blue'}>
                                        {takeout ? '🛍️ 포장 주문' : `🏠 ${getTableLabel(order)}`}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className={`pulse-ready ${takeout ? 'pulse-takeout' : ''}`}></span>
                                        <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.85rem', fontWeight: '700' }}>
                                            {timeString || 'READY'}
                                        </span>
                                    </div>
                                </div>

                                {/* Order Number/Code */}
                                <div 
                                    className={takeout ? 'takeout-glowing-number' : 'glowing-number'}
                                    style={{ 
                                        fontSize: '3rem', 
                                        fontWeight: '950', 
                                        color: 'white', 
                                        letterSpacing: '2px',
                                        margin: '10px 0'
                                    }}
                                >
                                    #{displayCode}
                                </div>

                                {/* Neon Divider */}
                                <div className={`neon-divider ${takeout ? 'takeout-divider' : ''}`}></div>

                                {/* Menu Items List */}
                                <div 
                                    className="items-scroll-container"
                                    style={{ 
                                        maxHeight: '180px', 
                                        overflowY: 'auto', 
                                        paddingRight: '2px',
                                        textAlign: 'left'
                                    }}
                                >
                                    {menuItems.length > 0 ? (
                                        menuItems.map((item, idx) => (
                                            <div key={idx} className="order-item-row">
                                                <span style={{ 
                                                    color: 'rgba(255, 255, 255, 0.9)', 
                                                    fontWeight: '600', 
                                                    fontSize: '1rem',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    paddingRight: '12px'
                                                }}>
                                                    {item.name}
                                                </span>
                                                <span className={takeout ? 'takeout-item-qty-badge' : 'item-qty-badge'}>
                                                    {item.value}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '16px 0', color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.95rem', fontStyle: 'italic' }}>
                                            상세 항목이 없습니다
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Empty State */}
                {readyOrders.length === 0 && (
                    <div className="animate-fade-in" style={{ 
                        marginTop: '120px', 
                        padding: '60px 40px',
                        background: 'rgba(13, 11, 26, 0.4)',
                        backdropFilter: 'blur(12px)',
                        borderRadius: '32px',
                        border: '1px dashed rgba(255, 255, 255, 0.08)',
                        maxWidth: '600px',
                        margin: '120px auto 0 auto'
                    }}>
                        <div style={{ 
                            fontSize: '5rem', 
                            marginBottom: '24px', 
                            filter: 'drop-shadow(0 0 20px rgba(0, 242, 254, 0.3))',
                            animation: 'bounce-float 3s ease-in-out infinite'
                        }}>👨‍🍳</div>
                        <h2 style={{ color: 'white', fontSize: '1.8rem', fontWeight: '800', marginBottom: '12px' }}>
                            주방에서 음식을 열심히 조리 중입니다
                        </h2>
                        <p style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '1rem', lineHeight: '1.6' }}>
                            현재 준비 완료된 음식이 없습니다. 잠시만 기다려 주시면 맛있는 요리를 전광판에 안내해 드리겠습니다.
                        </p>
                    </div>
                )}
            </div>
            
            <style>{`
                @keyframes bounce-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
            `}</style>
        </div>
    );
};
