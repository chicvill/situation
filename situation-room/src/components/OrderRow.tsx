import React from 'react';

interface OrderRowProps {
    tableKey: string;
    orderCode: string;
    itemSummary: string;
    totalPrice?: number;
    hasReady: boolean;
    statusBadge: React.ReactNode;
    actionButtons: React.ReactNode;
}

export const OrderRow: React.FC<OrderRowProps> = ({ 
    tableKey, 
    orderCode, 
    itemSummary, 
    totalPrice, 
    hasReady, 
    statusBadge, 
    actionButtons 
}) => {
    return (
        <div style={{ 
            background: hasReady ? 'rgba(249, 115, 22, 0.12)' : 'rgba(59, 130, 246, 0.08)', 
            border: hasReady ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid rgba(59, 130, 246, 0.3)', 
            borderRadius: '18px', padding: '16px', marginBottom: '10px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: '900', color: 'white' }}>
                            {tableKey === '포장' ? 'Table : [포장]' : `Table : ${tableKey}`}
                        </span>
                        <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.4)' }}>|</span>
                        <span style={{ fontSize: '1.1rem', color: 'var(--accent-orange)', fontWeight: 'bold' }}>
                            Order No : {orderCode}
                        </span>
                    </div>
                    {statusBadge}
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    {actionButtons}
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px' }}>
                <div style={{ fontSize: '1.1rem', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>🍱 {itemSummary}</div>
                {totalPrice !== undefined && totalPrice > 0 && (
                    <div style={{ fontSize: '1.4rem', fontWeight: '900', color: hasReady ? 'white' : '#60a5fa' }}>
                        {totalPrice.toLocaleString()}원
                    </div>
                )}
            </div>
        </div>
    );
};
