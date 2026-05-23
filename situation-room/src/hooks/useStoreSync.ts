import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToStore } from '../services/notifications';
import { playDingDong } from '../utils/audio';

export interface NotificationStates {
  call: boolean;
  waiting: boolean;
  reserve: boolean;
  parking: boolean;
  points: boolean;
  counter: boolean;
}

export const useStoreSync = (storeId: string) => {
  const [flashingTabs, setFlashingTabs] = useState<NotificationStates>({
    call: false,
    waiting: false,
    reserve: false,
    parking: false,
    points: false,
    counter: false,
  });
  const [callCount, setCallCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);
  const [parkingCount, setParkingCount] = useState(0);
  const [reservationCount, setReservationCount] = useState(0);
  const [callFlashing, setCallFlashing] = useState(false);
  const [waitingFlashing, setWaitingFlashing] = useState(false);
  const [parkingFlashing, setParkingFlashing] = useState(false);
  const callFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parkingFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // playDingDong은 utils/audio.ts 공통 함수 사용

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
      const reserveRes = await fetch(`${apiUrl}/api/reservation/active${storeParam}`);
      if (reserveRes.ok) {
        const data = await reserveRes.json();
        if (Array.isArray(data)) {
          setReservationCount(data.length);
          setFlashingTabs(prev => ({ ...prev, reserve: data.length > 0 }));
        }
      }

      // 주차 건수 초기 조회
      const parkingRes = await fetch(`${apiUrl}/api/parking/active${storeParam}`);
      if (parkingRes.ok) {
        const data = await parkingRes.json();
        if (Array.isArray(data)) setParkingCount(data.length);
      }
    } catch (e) {
      console.error('Failed to sync initial store state alerts:', e);
    }
  }, [storeId]);

    useEffect(() => {
    checkInitialStates();

    // 2. MQTT situation/kitchen 구독으로 모든 탭 아이콘 실시간 동기화
    const handleMessage = (data: any) => {
      try {
        // store_id 필터는 subscribeToStore 에서 처리됨
        switch (data.type) {
          case 'STAFF_CALL':
            setCallCount(prev => prev + 1);
            setFlashingTabs(prev => ({ ...prev, call: true }));
            setCallFlashing(true);
            playDingDong();
            if (callFlashTimer.current) clearTimeout(callFlashTimer.current);
            callFlashTimer.current = setTimeout(() => setCallFlashing(false), 3000);
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
            setWaitingFlashing(true);
            playDingDong();
            if (waitingFlashTimer.current) clearTimeout(waitingFlashTimer.current);
            waitingFlashTimer.current = setTimeout(() => setWaitingFlashing(false), 3000);
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
            fetch(`${getApiUrl()}/api/reservation/active${storeId !== 'Total' ? `?store_id=${storeId}` : ''}`)
              .then(res => res.json())
              .then(data => {
                if (Array.isArray(data)) {
                  setReservationCount(data.length);
                  setFlashingTabs(prev => ({ ...prev, reserve: data.length > 0 }));
                }
              })
              .catch(() => {});
            setFlashingTabs(prev => ({ ...prev, reserve: true }));
            break;

          case 'PARKING_APPLIED':
            setParkingCount(prev => prev + 1);
            setParkingFlashing(true);
            playDingDong();
            if (parkingFlashTimer.current) clearTimeout(parkingFlashTimer.current);
            parkingFlashTimer.current = setTimeout(() => setParkingFlashing(false), 3000);
            break;

          case 'POINTS_UPDATED':
            setFlashingTabs(prev => ({ ...prev, points: true }));
            break;
          
          case 'JOIN_REQUEST':
          case 'JOIN_CHECKIN':
          case 'CHECKIN_REQUEST':
          case 'JOIN_SESSION':
            setFlashingTabs(prev => ({ ...prev, counter: true, call: true }));
            setCallCount(prev => prev + 1);
            break;

          case 'JOIN_RESPONSE':
            fetch(`${getApiUrl()}/api/call/active${storeId !== 'Total' ? `?store_id=${storeId}` : ''}`)
              .then(res => res.json())
              .then(calls => {
                if (Array.isArray(calls)) {
                  setCallCount(calls.length);
                  setFlashingTabs(prev => ({ ...prev, call: calls.length > 0 }));
                }
              })
              .catch(err => console.error('Failed to refresh call status after join response:', err));
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Store Notification MQTT Parsing Error:', err);
      }
    };

    const unsubscribe = subscribeToStore(storeId, handleMessage);

    // 주기적 폴링: 30초마다 건수 정확히 동기화
    const pollInterval = setInterval(() => { checkInitialStates(); }, 30000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [storeId, checkInitialStates]);

  // 3. 특정 탭 클릭 이동 시 해당 알림 깜빡임 즉시 초기화(Reset)
  const resetFlash = useCallback((tab: string) => {
    const validKeys: (keyof NotificationStates)[] = ['call', 'waiting', 'reserve', 'parking', 'points', 'counter'];
    const key = tab as keyof NotificationStates;
    if (!validKeys.includes(key)) return;

    setFlashingTabs(prev => {
      if (prev[key] === false) return prev;
      return { ...prev, [key]: false };
    });
  }, []);

  const decrementCall = useCallback(() => {
    setCallCount(prev => Math.max(0, prev - 1));
  }, []);

  const decrementWaiting = useCallback(() => {
    setWaitingCount(prev => Math.max(0, prev - 1));
  }, []);

  const decrementParking = useCallback(() => {
    setParkingCount(prev => Math.max(0, prev - 1));
  }, []);

  return {
    flashingTabs,
    callCount,
    waitingCount,
    parkingCount,
    reservationCount,
    callFlashing,
    waitingFlashing,
    parkingFlashing,
    resetFlash,
    decrementCall,
    decrementWaiting,
    decrementParking,
    syncInitial: checkInitialStates
  };
};
