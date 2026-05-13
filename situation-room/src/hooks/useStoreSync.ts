import { useState, useEffect, useCallback } from 'react';
import { WS_BASE } from '../config';

export interface NotificationStates {
  call: number;
  waiting: number;
  reserve: number;
  parking: number;
  points: number;
}

// 한글 TTS (음성 안내) 합성 유틸리티
const playTTS = (text: string) => {
  try {
    if ('speechSynthesis' in window) {
      // 진행 중인 음성을 먼저 취소하여 음성 겹침 현상 방지
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.error("TTS 재생 에러:", err);
  }
};

export const useStoreSync = (storeId: string) => {
  const [flashingTabs, setFlashingTabs] = useState<NotificationStates>({
    call: 0,
    waiting: 0,
    reserve: 0,
    parking: 0,
    points: 0,
  });

  const getApiUrl = () => import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;

  // 1. 초기 백엔드 상태를 조회하여 실제 DB 대기자/호출/예약 건수로 빨간 배지 개수 세팅
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
          setFlashingTabs(prev => ({ ...prev, call: data.length }));
        }
      }

      // 대기 손님 실시간 상태 체크
      const waitingRes = await fetch(`${apiUrl}/api/waiting/active${storeParam}`);
      if (waitingRes.ok) {
        const data = await waitingRes.json();
        if (Array.isArray(data)) {
          setFlashingTabs(prev => ({ ...prev, waiting: data.length }));
        }
      }

      // 사전 예약 실시간 상태 체크
      const reserveRes = await fetch(`${apiUrl}/api/reservation/active`);
      if (reserveRes.ok) {
        const data = await reserveRes.json();
        if (Array.isArray(data)) {
          setFlashingTabs(prev => ({ ...prev, reserve: data.length }));
        }
      }
    } catch (e) {
      console.error('Failed to sync initial store state alerts:', e);
    }
  }, [storeId]);

  useEffect(() => {
    checkInitialStates();

    // 2. 단 하나의 웹소켓(WebSocket) 커넥션으로 하단 모든 탭 아이콘의 실시간 동기화 및 카운트 배지 연동!
    const ws = new WebSocket(`${WS_BASE}/ws/kitchen`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 다중 가상 매장 연동: 수신한 데이터에 store_id가 있고, 현재 가동 매장 ID와 불일치하면 필터링 통과
        if (storeId && storeId !== 'Total' && data.store_id && data.store_id !== storeId) {
          return;
        }

        const apiUrl = getApiUrl();
        const storeParam = storeId !== 'Total' ? `?store_id=${storeId}` : '';

        switch (data.type) {
          case 'STAFF_CALL':
          case 'CALL_STATUS_UPDATED':
            fetch(`${apiUrl}/api/call/active${storeParam}`)
              .then(res => res.json())
              .then(calls => {
                if (Array.isArray(calls)) {
                  setFlashingTabs(prev => ({ ...prev, call: calls.length }));
                }
              }).catch(err => console.error(err));
            break;

          case 'WAITING_REGISTERED':
          case 'WAITING_STATUS_CHANGED':
          case 'WAITING_UPDATED':
          case 'Waiting': // AI situations 대기 알림 패킷 수신 시
            // 신규 대기 손님이 등록되었을 때만 우아하게 한글 음성 가이드 실행!
            if (data.type === 'WAITING_REGISTERED' || data.type === 'Waiting') {
              playTTS("새로운 대기 손님이 등록되었습니다. 확인해 주세요.");
            }
            // 최신 정밀 대기팀 숫자 fetch 갱신
            fetch(`${apiUrl}/api/waiting/active${storeParam}`)
              .then(res => res.json())
              .then(waitings => {
                if (Array.isArray(waitings)) {
                  setFlashingTabs(prev => ({ ...prev, waiting: waitings.length }));
                }
              }).catch(err => console.error(err));
            break;

          case 'RESERVATION_UPDATED':
            fetch(`${apiUrl}/api/reservation/active`)
              .then(res => res.json())
              .then(reserves => {
                if (Array.isArray(reserves)) {
                  setFlashingTabs(prev => ({ ...prev, reserve: reserves.length }));
                }
              }).catch(err => console.error(err));
            break;

          case 'PARKING_APPLIED':
            setFlashingTabs(prev => ({ ...prev, parking: prev.parking + 1 }));
            break;

          case 'POINTS_UPDATED':
            setFlashingTabs(prev => ({ ...prev, points: prev.points + 1 }));
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Store Notification WS Parsing Error:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [storeId, checkInitialStates]);

  // 3. 특정 탭 클릭 이동 시 해당 알림 숫자 배지 즉시 초기화(Reset)
  const resetFlash = useCallback((tab: string) => {
    const validKeys: (keyof NotificationStates)[] = ['call', 'waiting', 'reserve', 'parking', 'points'];
    const key = tab as keyof NotificationStates;
    if (!validKeys.includes(key)) return;

    setFlashingTabs(prev => {
      if (prev[key] === 0) return prev;
      return {
        ...prev,
        [key]: 0
      };
    });
  }, []);

  return {
    flashingTabs,
    resetFlash,
    syncInitial: checkInitialStates
  };
};
