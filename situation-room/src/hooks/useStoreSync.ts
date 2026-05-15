import { useState, useEffect, useCallback } from 'react';
import { WS_BASE } from '../config';

export interface NotificationStates {
  call: boolean;
  waiting: boolean;
  reserve: boolean;
  parking: boolean;
  points: boolean;
}

export const useStoreSync = (storeId: string) => {
  const [flashingTabs, setFlashingTabs] = useState<NotificationStates>({
    call: false,
    waiting: false,
    reserve: false,
    parking: false,
    points: false,
  });
  const [callCount, setCallCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);

  const getApiUrl = () => import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

  // 1. 초기 백엔드 상태를 조회하여 실제 DB 대기자/호출/예약 건수에 맞게 깜빡임 플래그 세팅
  const checkInitialStates = useCallback(async () => {
    if (!storeId) return;
    try {
      const apiUrl = getApiUrl();
      const storeParam = storeId !== 'Total' ? `?store_id=${storeId}` : '';

      // 직원 호출 실시간 상태 체크
      const callRes = await fetch(`${apiUrl}/api/call/active${storeParam}`);
      if (callRes.ok) {
        const data = await callRes.json();
        if (Array.isArray(data)) {
          setCallCount(data.length);
          setFlashingTabs(prev => ({ ...prev, call: data.length > 0 }));
        }
      }

      // 대기 손님 실시간 상태 체크
      const waitingRes = await fetch(`${apiUrl}/api/waiting/active${storeParam}`);
      if (waitingRes.ok) {
        const data = await waitingRes.json();
        if (Array.isArray(data)) {
          setWaitingCount(data.length);
          setFlashingTabs(prev => ({ ...prev, waiting: data.length > 0 }));
        }
      }

      // 사전 예약 실시간 상태 체크
      const reserveRes = await fetch(`${apiUrl}/api/reservation/active`);
      if (reserveRes.ok) {
        const data = await reserveRes.json();
        if (Array.isArray(data)) {
          setFlashingTabs(prev => ({ ...prev, reserve: data.length > 0 }));
        }
      }
    } catch (e) {
      console.error('Failed to sync initial store state alerts:', e);
    }
  }, [storeId]);

    useEffect(() => {
    checkInitialStates();

    // 2. 단 하나의 웹소켓(WebSocket) 커넥션으로 하단 모든 탭 아이콘의 실시간 동기화 및 깜빡임 연동!
    let ws: WebSocket;
    let reconnectTimeout: any;

    const connect = () => {
      ws = new WebSocket(`${WS_BASE}/ws/kitchen`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 다중 가상 매장 연동: 수신한 데이터에 store_id가 있고, 현재 가동 매장 ID와 불일치하면 필터링 통과
          if (storeId && storeId !== 'Total' && data.store_id && data.store_id !== storeId) {
            return;
          }

          switch (data.type) {
            case 'STAFF_CALL':
              setCallCount(prev => prev + 1);
              setFlashingTabs(prev => ({ ...prev, call: true }));
              break;
            case 'CALL_STATUS_UPDATED':
              fetch(`${getApiUrl()}/api/call/active${storeId !== 'Total' ? `?store_id=${storeId}` : ''}`)
                .then(res => res.json())
                .then(calls => {
                  if (Array.isArray(calls)) {
                    setCallCount(calls.length);
                    setFlashingTabs(prev => ({ ...prev, call: calls.length > 0 }));
                  }
                })
                .catch(err => console.error('Failed to refresh call status:', err));
              break;

            case 'WAITING_REGISTERED':
              setWaitingCount(prev => prev + 1);
              setFlashingTabs(prev => ({ ...prev, waiting: true }));
              break;
            case 'WAITING_STATUS_CHANGED':
            case 'WAITING_UPDATED':
              fetch(`${getApiUrl()}/api/waiting/active${storeId !== 'Total' ? `?store_id=${storeId}` : ''}`)
                .then(res => res.json())
                .then(waitings => {
                  if (Array.isArray(waitings)) {
                    setWaitingCount(waitings.length);
                    setFlashingTabs(prev => ({ ...prev, waiting: waitings.length > 0 }));
                  }
                })
                .catch(err => console.error('Failed to refresh waiting status:', err));
              break;

            case 'RESERVATION_UPDATED':
              setFlashingTabs(prev => ({ ...prev, reserve: true }));
              break;

            case 'PARKING_APPLIED':
              setFlashingTabs(prev => ({ ...prev, parking: true }));
              break;

            case 'POINTS_UPDATED':
              setFlashingTabs(prev => ({ ...prev, points: true }));
              break;

            default:
              break;
          }
        } catch (err) {
          console.error('Store Notification WS Parsing Error:', err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [storeId, checkInitialStates]);

  // 3. 특정 탭 클릭 이동 시 해당 알림 깜빡임 즉시 초기화(Reset)
  const resetFlash = useCallback((tab: string) => {
    const validKeys: (keyof NotificationStates)[] = ['call', 'waiting', 'reserve', 'parking', 'points'];
    const key = tab as keyof NotificationStates;
    if (!validKeys.includes(key)) return;

    setFlashingTabs(prev => {
      if (prev[key] === false) return prev;
      return { ...prev, [key]: false };
    });
    if (tab === 'call') setCallCount(0);
    if (tab === 'waiting') setWaitingCount(0);
  }, []);

  return {
    flashingTabs,
    callCount,
    waitingCount,
    resetFlash,
    syncInitial: checkInitialStates
  };
};
