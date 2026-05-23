import React, { useState, useEffect } from 'react';
import { addGlobalMqttListener } from '../services/mqttClient';

interface LogEntry {
    id: number;
    time: string;
    topic: string;
    data: any;
}

export const MqttDebugOverlay: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // 단축키 (Ctrl + Shift + M) 로 토글
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
                setIsVisible(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        const removeListener = addGlobalMqttListener((topic, data) => {
            setLogs(prev => {
                const newLog = {
                    id: Date.now() + Math.random(),
                    time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }),
                    topic,
                    data
                };
                return [newLog, ...prev].slice(0, 10); // 최근 10개만 유지
            });
        });

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            removeListener();
        };
    }, []);

    if (!isVisible) {
        return (
            <button 
                onClick={() => setIsVisible(true)}
                style={{
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    zIndex: 9999,
                    background: 'rgba(0,0,0,0.6)',
                    color: '#10b981',
                    border: '1px solid #10b981',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)'
                }}
            >
                📡 MQTT View
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            width: '320px',
            maxHeight: '400px',
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid #334155',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backdropFilter: 'blur(8px)',
            fontFamily: 'monospace'
        }}>
            <div style={{
                background: '#1e293b',
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #334155'
            }}>
                <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem' }}>📡 MQTT Live Logs</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setLogs([])} style={{ background: 'transparent', border: '1px solid #64748b', color: '#cbd5e1', borderRadius: '4px', fontSize: '0.7rem', padding: '2px 6px', cursor: 'pointer' }}>Clear</button>
                    <button onClick={() => setIsVisible(false)} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '1rem', lineHeight: 1, cursor: 'pointer' }}>×</button>
                </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {logs.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>수신 대기 중...</div>
                ) : (
                    logs.map(log => {
                        const safeData = log.data || {};
                        const typeName = typeof safeData === 'object' ? safeData.type : 'UNKNOWN';
                        const displayData = typeof safeData === 'object' 
                            ? JSON.stringify(safeData).replace(`{"type":"${typeName}",`, '{') 
                            : String(safeData);

                        return (
                            <div key={log.id} style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '6px 8px', fontSize: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{log.topic}</span>
                                    <span style={{ color: '#64748b' }}>{log.time}</span>
                                </div>
                                <div style={{ color: '#f8fafc', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    <span style={{ color: '#fcd34d' }}>{typeName || 'UNKNOWN'}</span>
                                    {' '}{displayData}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
