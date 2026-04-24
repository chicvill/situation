import React, { useMemo } from 'react';
import type { BundleData } from '../types';

interface DisplayBoardProps {
    bundles: BundleData[];
}

export const DisplayBoard: React.FC<DisplayBoardProps> = ({ bundles }) => {
    // 사장님 요청: 오직 'ready' (조리 완료) 상태인 주문만 전광판에 노출
    const readyOrders = useMemo(() => {
        return bundles
            .filter(b => b.type === 'Orders' && b.status === 'ready')
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // 최신순 정렬
    }, [bundles]);

    // 테이블 번호 추출 함수 (과거 데이터 호환성 유지)
    const getTableLabel = (order: BundleData) => {
        if (order.table && order.table !== 'null') {
            return order.table === '포장' ? '[포장]' : `${order.table}번`;
        }
        
        // 1. 제목(title)에서 추출 (예: "테이블 3 - ..." -> "3번")
        const titleMatch = order.title.match(/테이블\s*(\d+)/) || order.title.match(/Table\s*(\d+)/i);
        if (titleMatch) return `${titleMatch[1]}번`;

        // 2. 제목에서 포장 여부 확인
        if (order.title.includes('포장')) return '[포장]';

        // 3. items에서 검색
        const tableItem = order.items.find(i => i.name === '테이블' || i.name === 'table');
        if (tableItem) return `${tableItem.value}번`;
        
        return '주문'; // 최후의 수단
    };

    return (
        <div className="display-board-premium" style={{ 
            height: '100vh', 
            background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
            padding: '20px',
            textAlign: 'center',
            overflow: 'hidden'
        }}>
            <h1 style={{ color: 'white', fontSize: '2.5rem', fontWeight: '900', margin: '20px 0 40px 0', textShadow: '0 0 20px rgba(249, 115, 22, 0.5)' }}>
                📢 음식이 준비되었습니다!
            </h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
                {readyOrders.map(order => (
                    <div key={order.id} className="animate-pop-in" style={{ 
                        background: 'rgba(30, 41, 59, 0.8)', 
                        border: '2px solid #10b981', 
                        borderRadius: '24px', 
                        padding: '20px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{ fontSize: '1.2rem', color: '#10b981', marginBottom: '8px', fontWeight: '900' }}>
                            Table : {getTableLabel(order)}
                        </div>
                        <div style={{ fontSize: '3rem', fontWeight: '950', color: 'white', letterSpacing: '2px' }}>
                            #{order.order_code || order.id.substring(0, 4).toUpperCase()}
                        </div>
                    </div>
                ))}
            </div>

            {readyOrders.length === 0 && (
                <div style={{ marginTop: '100px', opacity: 0.2 }}>
                    <div style={{ fontSize: '5rem' }}>👨‍🍳</div>
                    <h2 style={{ color: 'white' }}>현재 준비 완료된 음식이 없습니다.</h2>
                </div>
            )}
        </div>
    );
};
