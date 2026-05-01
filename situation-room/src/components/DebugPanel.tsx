import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

export const DebugPanel: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        return logger.subscribe((newLogs) => {
            setLogs(newLogs);
        });
    }, []);

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed', bottom: '20px', right: '20px', zIndex: 11000,
                    padding: '10px 15px', background: '#334155', color: 'white',
                    border: 'none', borderRadius: '8px', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontWeight: 'bold', fontSize: '12px'
                }}
            >
                🛠️ 디버그 로그 ({logs.length})
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed', bottom: '20px', right: '20px', zIndex: 11000,
            width: '400px', maxHeight: '500px', background: '#0f172a',
            border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            fontFamily: 'monospace'
        }}>
            <header style={{
                padding: '12px 15px', background: '#1e293b', display: 'flex', 
                justifyContent: 'space-between', alignItems: 'center'
            }}>
                <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 'bold' }}>🛰️ SYSTEM ACTIVITY LOG</span>
                <button 
                    onClick={() => setIsOpen(false)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}
                >
                    ×
                </button>
            </header>
            
            <div style={{ 
                flex: 1, overflowY: 'auto', padding: '15px', 
                fontSize: '12px', display: 'flex', flexDirection: 'column-reverse', gap: '8px',
                background: '#020617'
            }}>
                {logs.map(log => (
                    <div key={log.id} style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '4px' }}>
                        <span style={{ color: '#475569', whiteSpace: 'nowrap' }}>[{log.timestamp}]</span>
                        <span style={{ 
                            color: log.level === 'error' ? '#f87171' : 
                                   log.level === 'success' ? '#4ade80' : 
                                   log.level === 'warn' ? '#fbbf24' : '#38bdf8',
                            wordBreak: 'break-all'
                        }}>
                            {log.message}
                        </span>
                    </div>
                ))}
            </div>
            
            <footer style={{ padding: '8px 15px', background: '#1e293b', fontSize: '10px', color: '#475569', textAlign: 'right' }}>
                MQnet Internal Debugger v1.0
            </footer>
        </div>
    );
};
