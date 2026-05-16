import { useEffect, useState, useCallback } from 'react';
import { subscribeToStore } from '../services/notifications';
import { API_BASE } from '../config';

interface Toast {
  id: string;
  type: 'call' | 'parking';
  table_id?: string;
  call_type?: string;
  vehicle_number?: string;
  discount_minutes?: number;
  call_id?: string;
  timestamp: number;
}

interface Props {
  storeId: string;
  onNavigate: (tab: string) => void;
}

export const NotificationToast = ({ storeId, onNavigate }: Props) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleComplete = useCallback(async (toast: Toast) => {
    if (toast.call_id) {
      try {
        await fetch(`${API_BASE}/api/call/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_id: toast.call_id, status: 'completed' }),
        });
      } catch (e) {
        console.error('[NotificationToast] 처리 완료 실패:', e);
      }
    }
    dismiss(toast.id);
  }, [dismiss]);

  useEffect(() => {
    const handle = (data: any) => {
      if (data.type === 'STAFF_CALL') {
        const id = data.call_id || `call-${Date.now()}`;
        setToasts(prev => {
          if (prev.some(t => t.id === id)) return prev;
          return [...prev, {
            id,
            type: 'call',
            table_id: data.table_id,
            call_type: data.call_type || '직원호출',
            call_id: data.call_id,
            timestamp: Date.now(),
          }];
        });
      } else if (data.type === 'PARKING_APPLIED') {
        const id = data.parking_id || `park-${Date.now()}`;
        setToasts(prev => {
          if (prev.some(t => t.id === id)) return prev;
          return [...prev, {
            id,
            type: 'parking',
            table_id: data.table_id,
            vehicle_number: data.vehicle_number,
            discount_minutes: data.discount_minutes || 120,
            timestamp: Date.now(),
          }];
        });
      }
    };
    return subscribeToStore(storeId, handle);
  }, [storeId]);

  // 30초 후 자동 소멸
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => now - t.timestamp < 30000));
    }, 1000);
    return () => clearInterval(timer);
  }, [toasts.length]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '72px',
      right: '16px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      width: '300px',
      maxWidth: 'calc(100vw - 32px)',
    }}>
      {toasts.map(t => (
        <div key={t.id} className="notif-toast-card" style={{
          background: t.type === 'call' ? '#1e293b' : '#064e3b',
          borderRadius: '16px',
          padding: '16px 18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          border: `1px solid ${t.type === 'call' ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
          color: 'white',
        }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.5rem', animation: 'blink-call-icon 0.9s infinite' }}>
                {t.type === 'call' ? '🔔' : '🚗'}
              </span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2 }}>
                  {t.type === 'call' ? t.call_type : '주차 할인 신청'}
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.65, marginTop: '2px' }}>
                  {t.table_id && t.table_id.startsWith('T1')
                    ? `시스템`
                    : t.table_id
                      ? `TABLE ${t.table_id}`
                      : t.type === 'parking' ? '셀프 주차' : '입구'}
                </div>
              </div>
            </div>
            <button onClick={() => dismiss(t.id)} style={{
              background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.45)', fontSize: '1.2rem',
              cursor: 'pointer', lineHeight: 1, padding: '0 2px',
            }}>×</button>
          </div>

          {/* 주차 차량번호 */}
          {t.type === 'parking' && t.vehicle_number && (
            <div style={{
              fontSize: '1.15rem', fontWeight: 800,
              color: '#6ee7b7', margin: '4px 0 12px',
              letterSpacing: '0.05em',
            }}>
              {t.vehicle_number}
              <span style={{ fontSize: '0.8rem', fontWeight: 600, marginLeft: '8px', opacity: 0.8 }}>
                {t.discount_minutes}분 무료
              </span>
            </div>
          )}

          {/* 액션 버튼 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {t.type === 'call' && (
              <button onClick={() => handleComplete(t)} style={{
                flex: 1, padding: '9px 0',
                background: '#f59e0b', border: 'none',
                borderRadius: '8px', color: 'white',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              }}>
                ✅ 처리 완료
              </button>
            )}
            <button
              onClick={() => { onNavigate(t.type === 'call' ? 'call' : 'parking'); dismiss(t.id); }}
              style={{
                flex: 1, padding: '9px 0',
                background: 'rgba(255,255,255,0.12)', border: 'none',
                borderRadius: '8px', color: 'white',
                fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              📋 전체 보기
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
