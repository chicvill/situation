import { useMemo } from 'react';
import type { Bundle } from './types';
import { API_BASE } from '../../config';

interface UseAttendanceOptions {
  storeId: string;
  employees: Bundle[];
  setIsScanningQr: (v: boolean) => void;
  kioskPhone: string;
  setKioskPhone: (v: string) => void;
  setIsProcessing: (v: boolean) => void;
}

export const useAttendance = ({
  storeId,
  employees,
  setIsScanningQr,
  kioskPhone,
  setKioskPhone,
  setIsProcessing,
}: UseAttendanceOptions) => {
  const deviceId = useMemo(() => {
    let id = localStorage.getItem('mqnet_kiosk_device_id');
    if (!id) {
      id = 'KIOSK_' + Math.random().toString(36).substring(2, 9).toUpperCase();
      localStorage.setItem('mqnet_kiosk_device_id', id);
    }
    return id;
  }, []);

  const handleForceAttendance = async (ev: React.MouseEvent, emp: Bundle, actionType: 'check-in' | 'check-out') => {
    ev.stopPropagation();
    const actionText = actionType === 'check-in' ? '출근' : '퇴근';
    const empName = emp.items?.find((i) => i.name === '이름')?.value || '-';

    if (!window.confirm(`⚠️ 점주 예외 권한으로 ${empName} 사원의 ${actionText}을(를) 강제 기록하시겠습니까?\n이 작업은 5분 스케줄 제한을 무시하고 즉시 처리됩니다.`)) return;

    setIsProcessing(true);
    try {
      const apiUrl = API_BASE;
      const endpoint = actionType === 'check-in' ? '/api/staff/check-in' : '/api/staff/check-out';

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: emp.items?.find((i) => i.name === '아이디')?.value || emp.id,
          store_id: storeId === 'Total' ? 'store-korean' : storeId,
          device_id: deviceId,
          force: true
        })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(`🚨 강제 기록 에러!\n\n${result.detail}`);
      } else {
        if (actionType === 'check-in') {
          alert(`🏃 예외 출근 완료!\n\n${empName}님, 점주 승인으로 강제 출근 기록되었습니다.`);
        } else {
          alert(`🏠 예외 퇴근 완료!\n\n${empName}님, 점주 승인으로 강제 퇴근 기록되었습니다.`);
        }
      }
    } catch (err: any) {
      alert(`❌ 서버 연동 에러: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKioskSubmit = async (actionType: 'check-in' | 'check-out') => {
    const cleanPhone = kioskPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return alert('전화번호를 정확히 입력해 주세요.');

    const emp = employees.find(e => {
      const phone = e.items?.find((i) => i.name === '아이디')?.value;
      return phone && phone.replace(/[^0-9]/g, '') === cleanPhone;
    });

    if (!emp) return alert('🚨 등록되지 않은 전화번호(ID)입니다.');

    setIsScanningQr(true);
    try {
      const apiUrl = API_BASE;
      const endpoint = actionType === 'check-in' ? '/api/staff/check-in' : '/api/staff/check-out';

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: emp.items?.find((i) => i.name === '아이디')?.value || emp.id,
          store_id: storeId === 'Total' ? 'store-korean' : storeId,
          device_id: deviceId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(`🚨 출퇴근 시간 제한 에러!\n\n${result.detail || '5분 범위에 근로 스케줄이 없습니다.'}`);
      } else {
        const empName = emp.items?.find((i) => i.name === '이름')?.value || '-';
        if (actionType === 'check-in') {
          alert(`🏃 출근 완료!\n\n${empName}님, ${result.tardy ? '⚠️ 지각 출근입니다!' : '✨ 정상 출근 처리되었습니다.'}\n기록 시각: ${new Date(result.check_in_time).toLocaleTimeString()}`);
        } else {
          alert(`🏠 퇴근 완료!\n\n${empName}님, 정상 퇴근 처리되었습니다.\n기록 시각: ${new Date(result.check_out_time).toLocaleTimeString()}`);
        }
        setKioskPhone('');
      }
    } catch (err: any) {
      alert(`❌ 서버 연동 에러: ${err.message}`);
    } finally {
      setIsScanningQr(false);
    }
  };

  return { deviceId, handleForceAttendance, handleKioskSubmit };
};
