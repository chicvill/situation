import React, { useState, useEffect } from 'react';
import { useStoreFilter } from '../hooks/useStoreFilter';

export const HRManager: React.FC<{ bundles: any[], user: any, storeDetails?: any }> = ({ bundles, user, storeDetails }) => {
    const { storeId, storeName } = useStoreFilter();
    const params = new URLSearchParams(window.location.search);
    const isCheckinMode = params.get('mode') === 'hr' && params.get('action') === 'checkin';
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingWage, setEditingWage] = useState<{ id: string, wage: string } | null>(null);
    const [editingPhone, setEditingPhone] = useState<{ id: string, phone: string } | null>(null);
    const [showBanner, setShowBanner] = useState(true);
    const [kioskPhone, setKioskPhone] = useState('');

    // Selected states
    const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
    const [payrollModal, setPayrollModal] = useState<any | null>(null);
    const [qrScannerOpen, setQrScannerOpen] = useState(false);
    const [selectedStaffForQr, setSelectedStaffForQr] = useState("");
    const [selectedActionForQr, setSelectedActionForQr] = useState<"check-in" | "check-out">("check-in");
    const [isScanningQr, setIsScanningQr] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // 신규 사원 직접 등록 폼 활성화 및 입력 상태들
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [regName, setRegName] = useState('');
    const [regPhone, setRegPhone] = useState('');
    const [regRole, setRegRole] = useState('staff');
    const [regWage, setRegWage] = useState('10500');
    const [regTempPw, setRegTempPw] = useState('1212');
    const [regSchedules, setRegSchedules] = useState<{ [key: number]: { active: boolean, start: string, end: string } }>({
        0: { active: false, start: '09:00', end: '18:00' }, // 월
        1: { active: false, start: '09:00', end: '18:00' }, // 화
        2: { active: false, start: '09:00', end: '18:00' }, // 수
        3: { active: false, start: '09:00', end: '18:00' }, // 목
        4: { active: false, start: '09:00', end: '18:00' }, // 금
        5: { active: false, start: '09:00', end: '18:00' }, // 토
        6: { active: false, start: '09:00', end: '18:00' }, // 일
    });

    // Live clock for QR terminal
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // 현재 매장의 직원 및 근태 정보만 필터링
    const employees = bundles.filter(b => b.type === 'Employee' && (storeId === 'Total' || b.store_id === storeId || !b.store_id));
    const attendance = bundles.filter(b => b.type === 'Attendance' && (storeId === 'Total' || b.store_id === storeId || !b.store_id));
    
    // 승인 대기 계정 필터링 (계층적 승인 + 매장 격리)
    const pendingAccounts = bundles.filter(b => {
        if (b.type !== 'PersonalInfos' || b.status === 'approved') return false;
        if (user.role === 'owner' && (storeId !== 'Total' && b.store_id !== storeId)) return false;
        
        const role = b.items.find((i: any) => i.name === '권한')?.value;
        if (user.role === 'admin') return role === 'owner';
        if (user.role === 'owner') return role === 'manager' || role === 'staff';
        return false;
    });

    const handleUpdateWage = async (bundle: any, newWage: string) => {
        if (!newWage) return setEditingWage(null);
        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const updatedItems = bundle.items.map((i: any) => 
                i.name === '시급' ? { ...i, value: newWage.replace(/[^0-9]/g, '') } : i
            );
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, items: updatedItems, store: storeName, store_id: storeId }),
            });
            setEditingWage(null);
            alert('✅ 시급 정보가 업데이트되었습니다.');
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
    };

    const handleUpdatePhone = async (bundle: any, newPhone: string) => {
        if (!newPhone) return setEditingPhone(null);
        setIsProcessing(true);
        try {
            const cleanPhone = newPhone.replace(/[^0-9-]/g, '').trim();
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const updatedItems = bundle.items.map((i: any) => 
                i.name === '아이디' ? { ...i, value: cleanPhone } : i
            );
            // 만약 아이디 항목이 없었다면 추가
            if (!updatedItems.find((i: any) => i.name === '아이디')) {
                updatedItems.push({ name: '아이디', value: cleanPhone });
            }
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, items: updatedItems, store: storeName, store_id: storeId }),
            });
            setEditingPhone(null);
            alert('✅ 연락처(ID) 정보가 업데이트되었습니다. 이제 해당 사원은 새 번호로 로그인할 수 있습니다.');
            // (권장) 변경 후 리스트 새로고침을 위해 페이지를 리로드하거나 데이터를 다시 받아올 수 있습니다.
            window.location.reload(); 
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
    };

    const handleResignEmployee = async (bundle: any) => {
        if (!window.confirm(`${bundle.title} 사원의 퇴사 처리를 진행하시겠습니까? 로그인 권한이 즉시 차단됩니다.`)) return;
        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, status: 'resigned', store: storeName, store_id: storeId }),
            });
            alert('🚫 퇴사 처리가 완료되었습니다.');
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
    };

    const handleApproveAccount = async (bundle: any) => {
        if (!window.confirm(`${bundle.title} 계정을 승인하시겠습니까?`)) return;
        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/api/bundle/${bundle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bundle, status: 'approved', store: storeName, store_id: storeId }),
            });
            alert('✅ 계정이 승인되었습니다.');
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
    };

    // 급여 지급 완료 처리 (지불된 임금으로 갱신)
    const handlePaySalary = async (staffId: string, name: string) => {
        if (!window.confirm(`💰 ${name} 사원에게 쌓인 모든 미지급 임금을 정상 지급 완료 처리하시겠습니까?`)) return;
        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const response = await fetch(`${apiUrl}/api/attendance/pay/${staffId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                alert(`✨ ${name} 사원의 급여 지급 및 정산이 완료되었습니다! 미지급 잔액이 0원으로 조정됩니다.`);
                setPayrollModal(null);
            } else {
                throw new Error('급여 지급 처리에 실패했습니다.');
            }
        } catch (err: any) {
            alert(`❌ 에러: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // 강제 출퇴근 처리 (점주 예외 권한)
    const handleForceAttendance = async (ev: React.MouseEvent, emp: any, actionType: 'check-in' | 'check-out') => {
        ev.stopPropagation();
        const actionText = actionType === 'check-in' ? '출근' : '퇴근';
        const empName = emp.items.find((i: any) => i.name === '이름')?.value || '-';
        
        if (!window.confirm(`⚠️ 점주 예외 권한으로 ${empName} 사원의 ${actionText}을(를) 강제 기록하시겠습니까?\n이 작업은 5분 스케줄 제한을 무시하고 즉시 처리됩니다.`)) return;

        setIsProcessing(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const endpoint = actionType === 'check-in' ? '/api/staff/check-in' : '/api/staff/check-out';
            
            const response = await fetch(`${apiUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staff_id: emp.items.find((i: any) => i.name === '아이디')?.value || emp.id,
                    store_id: storeId === 'Total' ? 'store-korean' : storeId,
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
                window.location.reload();
            }
        } catch (err: any) {
            alert(`❌ 서버 연동 에러: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // QR 스캔 기반 출퇴근 처리
    const handleQrAttendance = async () => {
        if (!selectedStaffForQr) {
            alert('근무자명을 선택해 주세요.');
            return;
        }
        setIsScanningQr(true);

        // 1.2초간 모의 스캐닝 애니메이션 연출
        setTimeout(async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
                const endpoint = selectedActionForQr === 'check-in' ? '/api/staff/check-in' : '/api/staff/check-out';
                
                const response = await fetch(`${apiUrl}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        staff_id: selectedStaffForQr,
                        store_id: storeId === 'Total' ? 'store-korean' : storeId
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    // 백엔드의 5분 제한 에러 메시지 완벽 노출
                    alert(`🚨 출퇴근 시간 제한 에러!\n\n${result.detail}`);
                } else {
                    if (selectedActionForQr === 'check-in') {
                        alert(`🏃 출근 완료!\n\n${result.tardy ? '⚠️ 지각 출근입니다! 예정 시간보다 늦게 등록되었습니다.' : '✨ 정상 출근 처리되었습니다.'}\n기록 시각: ${new Date(result.check_in_time).toLocaleTimeString()}`);
                    } else {
                        alert(`🏠 퇴근 완료!\n\n정상적으로 퇴근 처리가 완료되었습니다.\n근무 시간: ${result.work_minutes}분\n기록 시각: ${new Date(result.check_out_time).toLocaleTimeString()}`);
                    }
                    setQrScannerOpen(false);
                }
            } catch (err: any) {
                alert(`❌ 오류가 발생했습니다: ${err.message}`);
            } finally {
                setIsScanningQr(false);
            }
        }, 1200);
    };

    const handleRegisterStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanPhone = regPhone.replace(/[^0-9]/g, '').trim();
        if (!regName.trim() || !cleanPhone) {
            alert('⚠️ 사원명과 휴대폰 번호(ID)를 정확히 입력해 주세요.');
            return;
        }

        setIsProcessing(true);
        try {
            const schedulesList = Object.entries(regSchedules)
                .filter(([_key, val]) => val.active)
                .map(([day, val]) => ({
                    day_of_week: parseInt(day),
                    start_time: val.start,
                    end_time: val.end
                }));

            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const response = await fetch(`${apiUrl}/api/staff/direct-register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    store_id: storeId === 'Total' ? 'store-korean' : storeId,
                    store_name: storeName || '시크빌',
                    name: regName.trim(),
                    phone: cleanPhone,
                    role: regRole,
                    hourly_wage: parseInt(regWage.replace(/[^0-9]/g, '') || '10500'),
                    temporary_password: regTempPw.trim(),
                    schedules: schedulesList
                })
            });

            if (response.ok) {
                alert(`🎉 [직원 즉시 등록 완료]\n\n사원 ${regName}님이 성공적으로 등록되었습니다!\n임시 비밀번호는 "${regTempPw}" 입니다.`);
                setRegName('');
                setRegPhone('');
                setRegRole('staff');
                setRegWage('10500');
                setRegTempPw('1212');
                setRegSchedules({
                    0: { active: false, start: '09:00', end: '18:00' },
                    1: { active: false, start: '09:00', end: '18:00' },
                    2: { active: false, start: '09:00', end: '18:00' },
                    3: { active: false, start: '09:00', end: '18:00' },
                    4: { active: false, start: '09:00', end: '18:00' },
                    5: { active: false, start: '09:00', end: '18:00' },
                    6: { active: false, start: '09:00', end: '18:00' },
                });
                setShowRegisterForm(false);
                // Trigger a page refresh
                window.location.reload();
            } else {
                const errResult = await response.json();
                alert(`❌ 등록 실패: ${errResult.detail || '서버 오류'}`);
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
            const phone = e.items.find((i: any) => i.name === '아이디')?.value;
            return phone && phone.replace(/[^0-9]/g, '') === cleanPhone;
        });

        if (!emp) return alert('🚨 등록되지 않은 전화번호(ID)입니다.');

        setIsScanningQr(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            const endpoint = actionType === 'check-in' ? '/api/staff/check-in' : '/api/staff/check-out';
            
            const response = await fetch(`${apiUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staff_id: emp.items.find((i: any) => i.name === '아이디')?.value || emp.id,
                    store_id: storeId === 'Total' ? 'store-korean' : storeId
                })
            });

            const result = await response.json();

            if (!response.ok) {
                alert(`🚨 출퇴근 시간 제한 에러!\n\n${result.detail || '5분 범위에 근로 스케줄이 없습니다.'}`);
            } else {
                const empName = emp.items.find((i: any) => i.name === '이름')?.value || '-';
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

    if (isCheckinMode) {
        return (
            <div className="admin-page animate-fade-in" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: '20px' }}>
                <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '40px 30px', borderRadius: '24px', border: '1.5px solid rgba(249, 115, 22, 0.3)', textAlign: 'center' }}>
                    <div style={{ marginBottom: '30px' }}>
                        <span style={{ fontSize: '3.5rem' }}>⏰</span>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '15px', color: 'var(--text-main)' }}>출퇴근 기록 단말기</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                            본인의 전화번호(ID)를 입력하고<br/>원하는 버튼을 눌러주세요.
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <input 
                            type="tel"
                            placeholder="전화번호 (예: 01012345678)"
                            value={kioskPhone}
                            onChange={(e) => setKioskPhone(e.target.value)}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '12px',
                                background: 'var(--background)', border: '1.5px solid var(--border)',
                                color: 'var(--text-main)', fontSize: '1.1rem', textAlign: 'center', letterSpacing: '2px', outline: 'none'
                            }}
                            autoFocus
                        />

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                                onClick={() => handleKioskSubmit('check-in')}
                                disabled={isScanningQr}
                                style={{
                                    flex: 1, padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem',
                                    background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1.5px solid #10b981',
                                    cursor: isScanningQr ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                🏃 출 근
                            </button>
                            <button 
                                onClick={() => handleKioskSubmit('check-out')}
                                disabled={isScanningQr}
                                style={{
                                    flex: 1, padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem',
                                    background: 'rgba(249, 115, 22, 0.15)', color: 'var(--accent-orange)', border: '1.5px solid var(--accent-orange)',
                                    cursor: isScanningQr ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                🏠 퇴 근
                            </button>
                        </div>
                    </div>
                    {isScanningQr && <p style={{ marginTop: '20px', fontSize: '0.85rem', color: 'var(--accent-orange)' }}>인증 처리 중입니다...</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page animate-fade-in" style={{ paddingBottom: '60px' }}>
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2>👥 {storeName} 인적 자원 및 임금 정산 관리</h2>
                    <p>{user.role === 'owner' ? '매장 스케줄·급여·QR출퇴근 통합 관리' : '실시간 나의 근무 및 근태 로그'}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {(user.role === 'owner' || user.role === 'admin') && (
                        <button 
                            onClick={() => setShowRegisterForm(!showRegisterForm)}
                            className="confirm-btn success-green" 
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)' }}
                        >
                            ➕ {showRegisterForm ? '등록 폼 닫기' : '사원 직접 채용/등록'}
                        </button>
                    )}
                    <button 
                        onClick={() => setQrScannerOpen(true)}
                        className="confirm-btn premium-orange" 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(249, 115, 22, 0.2)' }}
                    >
                        📷 출퇴근 QR코드 단말기
                    </button>
                </div>
            </header>

            {storeDetails && showBanner && (
                <div 
                    onClick={() => setShowBanner(false)}
                    style={{
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))',
                        border: '1.5px dashed #10b981',
                        borderRadius: '16px',
                        padding: '16px 20px',
                        marginBottom: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.9rem',
                        color: 'var(--text-main)',
                        cursor: 'pointer',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.04)',
                        transition: 'all 0.3s'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
                        <span style={{ fontSize: '1.4rem' }}>🎁</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: '800' }}>[안내] 전후 5분 수칙 준수 정산 시스템</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                모든 점장과 점원은 배정된 요일별 출퇴근 일정 기준 전후 5분 내에만 출퇴근 QR 인증이 가능하도록 동기화되어 있습니다.
                            </span>
                        </div>
                    </div>
                    ✕
                </div>
            )}

            {showRegisterForm && (
                <div className="glass-panel animate-fade-in" style={{ padding: '24px', borderRadius: '20px', border: '1.5px solid #10b981', marginBottom: '25px', background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.05), rgba(0,0,0,0.2))' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ➕ 신규 직원 채용 및 근무 요건 즉시 등록
                        </h4>
                        <button onClick={() => setShowRegisterForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
                    </div>

                    <form onSubmit={handleRegisterStaff}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>사원명 (실명)</label>
                                <input 
                                    type="text" 
                                    value={regName} 
                                    onChange={(ev) => setRegName(ev.target.value)} 
                                    placeholder="이름 입력" 
                                    style={{ padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white' }}
                                    required 
                                />
                            </div>
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>아이디 (휴대폰 번호)</label>
                                <input 
                                    type="text" 
                                    value={regPhone} 
                                    onChange={(ev) => setRegPhone(ev.target.value)} 
                                    placeholder="예: 01012345678" 
                                    style={{ padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white' }}
                                    required 
                                />
                            </div>
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>임시 비밀번호</label>
                                <input 
                                    type="text" 
                                    value={regTempPw} 
                                    onChange={(ev) => setRegTempPw(ev.target.value)} 
                                    placeholder="임시 암호 (기본 1212)" 
                                    style={{ padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white' }}
                                    required 
                                />
                            </div>
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>근무 직책</label>
                                <select 
                                    value={regRole} 
                                    onChange={(ev) => setRegRole(ev.target.value)} 
                                    style={{ padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white' }}
                                >
                                    <option value="staff">점원 (Staff)</option>
                                    <option value="manager">점장 (Manager)</option>
                                </select>
                            </div>
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>계약 시급 (원)</label>
                                <input 
                                    type="text" 
                                    value={regWage} 
                                    onChange={(ev) => setRegWage(ev.target.value.replace(/[^0-9]/g, ''))} 
                                    placeholder="시급 입력 (예: 10500)" 
                                    style={{ padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white', fontWeight: 'bold' }}
                                    required 
                                />
                            </div>
                        </div>

                        {/* 요일별 근로 시간 스케줄 */}
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '24px' }}>
                            <h5 style={{ margin: '0 0 15px 0', fontSize: '0.95rem', fontWeight: 800 }}>📅 요일별 근무일정 일괄 지정</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {["월", "화", "수", "목", "금", "토", "일"].map((dayName, idx) => {
                                    const daySched = regSchedules[idx];
                                    return (
                                        <div key={dayName} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px', padding: '10px 15px', background: daySched.active ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100px' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={daySched.active} 
                                                    onChange={(ev) => setRegSchedules({
                                                        ...regSchedules,
                                                        [idx]: { ...daySched, active: ev.target.checked }
                                                    })}
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
                                                />
                                                <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{dayName}요일</span>
                                            </div>
                                            
                                            {daySched.active ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <input 
                                                        type="time" 
                                                        value={daySched.start} 
                                                        onChange={(ev) => setRegSchedules({
                                                            ...regSchedules,
                                                            [idx]: { ...daySched, start: ev.target.value }
                                                        })}
                                                        style={{ padding: '6px 10px', borderRadius: '6px', background: '#000', border: '1px solid var(--border)', color: '#fff' }}
                                                    />
                                                    <span style={{ opacity: 0.6 }}>~</span>
                                                    <input 
                                                        type="time" 
                                                        value={daySched.end} 
                                                        onChange={(ev) => setRegSchedules({
                                                            ...regSchedules,
                                                            [idx]: { ...daySched, end: ev.target.value }
                                                        })}
                                                        style={{ padding: '6px 10px', borderRadius: '6px', background: '#000', border: '1px solid var(--border)', color: '#fff' }}
                                                    />
                                                    <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 'bold' }}>출퇴근 가드레일 전후 5분 수식 활성</span>
                                                </div>
                                            ) : (
                                                <span style={{ opacity: 0.4, fontSize: '0.85rem' }}>휴무</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setShowRegisterForm(false)} className="del-btn" style={{ padding: '12px 24px', borderRadius: '10px' }}>취소</button>
                            <button type="submit" className="confirm-btn success-green" style={{ padding: '12px 30px', borderRadius: '10px', fontWeight: 'bold' }} disabled={isProcessing}>
                                {isProcessing ? '처리 중...' : '등록 완료 (계약 개시)'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="hr-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '25px' }}>
                {pendingAccounts.length > 0 && (
                    <div className="glass-panel pending-section" style={{ border: '2px solid var(--accent-orange)' }}>
                        <h3 style={{ color: 'var(--accent-orange)', margin: '0 0 15px 0' }}>⚠️ 가입 승인 대기</h3>
                        <div className="pending-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                            {pendingAccounts.map(b => {
                                const name = b.items.find((i: any) => i.name === '이름')?.value || '-';
                                const role = b.items.find((i: any) => i.name === '권한')?.value || '-';
                                return (
                                    <div key={b.id} style={{ background: 'rgba(249, 115, 22, 0.05)', padding: '16px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(249, 115, 22, 0.15)' }}>
                                        <div>
                                            <strong style={{ fontSize: '1rem' }}>{name}</strong> 
                                            <span style={{ opacity: 0.7, fontSize: '0.85rem', marginLeft: '6px' }}>({role})</span>
                                        </div>
                                        <button onClick={() => handleApproveAccount(b)} className="confirm-btn success-green" style={{ padding: '8px 16px', fontSize: '0.85rem' }} disabled={isProcessing}>승인하기</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 1. 사원 명부 및 급여 관리 리스트 */}
                <div className="glass-panel" style={{ padding: '24px', borderRadius: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>📋 전직원 근로 계약 및 급여 지급 대장</h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>* 사원 선택 시 상세 근무 요건 및 요일 스케줄을 조회할 수 있습니다.</span>
                    </div>
                    
                    <div style={{ overflowX: 'auto' }}>
                        <style>
                            {`
                            @media (max-width: 768px) {
                                .mobile-responsive-table, .mobile-responsive-table tbody, .mobile-responsive-table tr, .mobile-responsive-table td {
                                    display: block !important;
                                    width: 100% !important;
                                    box-sizing: border-box !important;
                                }
                                .mobile-responsive-table thead {
                                    display: none !important; /* 모바일에서는 표 헤더 숨김 */
                                }
                                .mobile-responsive-table tr {
                                    margin-bottom: 20px !important;
                                    border: 1px solid var(--border) !important;
                                    border-radius: 16px !important;
                                    padding: 12px !important;
                                    background: var(--surface) !important;
                                    box-shadow: 0 4px 12px rgba(0,0,0,0.03) !important;
                                }
                                .mobile-responsive-table td {
                                    display: flex !important;
                                    justify-content: space-between !important;
                                    align-items: center !important;
                                    text-align: right !important;
                                    padding: 10px 5px !important;
                                    border-bottom: 1px solid rgba(0,0,0,0.05) !important;
                                    white-space: nowrap !important;
                                }
                                .mobile-responsive-table td:last-child {
                                    border-bottom: none !important;
                                    flex-direction: column !important;
                                    align-items: flex-end !important;
                                    gap: 10px !important;
                                }
                                .mobile-responsive-table td::before {
                                    content: attr(data-label) !important;
                                    font-weight: 800 !important;
                                    color: var(--text-muted) !important;
                                    text-align: left !important;
                                    margin-right: 15px !important;
                                }
                            }
                            `}
                        </style>
                        <table className="mobile-responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    <th style={{ padding: '14px 10px', whiteSpace: 'nowrap' }}>사원명(연락처)</th>
                                    <th style={{ padding: '14px 10px', whiteSpace: 'nowrap' }}>직책</th>
                                    <th style={{ padding: '14px 10px', whiteSpace: 'nowrap' }}>계약 시급</th>
                                    <th style={{ padding: '14px 10px', whiteSpace: 'nowrap' }}>누적 시간</th>
                                    <th style={{ padding: '14px 10px', whiteSpace: 'nowrap' }}>총 누적임금</th>
                                    <th style={{ padding: '14px 10px', whiteSpace: 'nowrap' }}>지불된 임금</th>
                                    <th style={{ padding: '14px 10px', color: 'var(--accent-orange)', whiteSpace: 'nowrap' }}>미지급 임금</th>
                                    <th style={{ padding: '14px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>급여 정산 및 관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map(e => {
                                    const name = e.items.find((i: any) => i.name === '이름')?.value || '-';
                                    const id = e.items.find((i: any) => i.name === '아이디')?.value || e.id;
                                    const role = e.items.find((i: any) => i.name === '직책')?.value || '점원';
                                    const wage = e.items.find((i: any) => i.name === '시급')?.value || '10,000';
                                    const hours = e.items.find((i: any) => i.name === '누적시간')?.value || '0.0';
                                    const cumulativeWage = e.items.find((i: any) => i.name === '누적임금')?.value || '0';
                                    const paidWage = e.items.find((i: any) => i.name === '지불된임금')?.value || '0';
                                    const unpaidWage = e.items.find((i: any) => i.name === '미지급임금')?.value || '0';
                                    const contractStr = e.items.find((i: any) => i.name === '계약정보')?.value || '{}';
                                    const scheduleStr = e.items.find((i: any) => i.name === '스케줄')?.value || '[]';

                                    return (
                                        <tr 
                                            key={e.id} 
                                            style={{ 
                                                borderBottom: '1px solid rgba(255,255,255,0.03)', 
                                                cursor: 'pointer',
                                                background: selectedEmployee?.id === e.id ? 'rgba(255,255,255,0.02)' : 'transparent',
                                                transition: 'background 0.2s'
                                            }}
                                            onClick={() => setSelectedEmployee({
                                                id, name, role, wage, hours, cumulativeWage, paidWage, unpaidWage,
                                                contract: JSON.parse(contractStr),
                                                schedule: JSON.parse(scheduleStr)
                                            })}
                                        >
                                            <td data-label="사원명(연락처)" style={{ padding: '16px 10px', fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div>
                                                        👤 {name}
                                                        {selectedEmployee?.id === id && <span style={{ color: 'var(--accent-orange)', marginLeft: '6px', fontSize: '0.75rem' }}>● 선택됨</span>}
                                                    </div>
                                                    {editingPhone?.id === e.id ? (
                                                        <input 
                                                            autoFocus
                                                            defaultValue={id} 
                                                            onBlur={(ev) => handleUpdatePhone(e, ev.target.value)}
                                                            onKeyDown={(ev) => ev.key === 'Enter' && handleUpdatePhone(e, (ev.target as any).value)}
                                                            style={{ width: '130px', background: 'var(--surface)', color: 'var(--text-main)', border: '2px solid var(--accent-orange)', padding: '4px', borderRadius: '6px', fontSize: '0.85rem' }}
                                                        />
                                                    ) : (
                                                        <span 
                                                            onClick={(ev) => { ev.stopPropagation(); (user.role === 'owner' || user.role === 'admin') && setEditingPhone({ id: e.id, phone: id }); }} 
                                                            style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', cursor: (user.role === 'owner' || user.role === 'admin') ? 'pointer' : 'default', borderBottom: (user.role === 'owner' || user.role === 'admin') ? '1px dashed var(--accent-orange)' : 'none' }}
                                                        >
                                                            📞 {id}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td data-label="직책" style={{ padding: '16px 10px' }}>
                                                <span className={`role-badge ${role === '점장' ? 'owner-gold' : 'staff-blue'}`} style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '8px' }}>
                                                    {role}
                                                </span>
                                            </td>
                                            <td data-label="계약 시급" style={{ padding: '16px 10px', fontWeight: '700', color: 'var(--text-main)' }}>
                                                {editingWage?.id === e.id ? (
                                                    <input 
                                                        autoFocus
                                                        defaultValue={wage} 
                                                        onBlur={(ev) => handleUpdateWage(e, ev.target.value)}
                                                        onKeyDown={(ev) => ev.key === 'Enter' && handleUpdateWage(e, (ev.target as any).value)}
                                                        style={{ width: '80px', background: 'var(--surface)', color: 'var(--text-main)', border: '2px solid var(--accent-orange)', padding: '6px', borderRadius: '6px' }}
                                                    />
                                                ) : (
                                                    <span onClick={(ev) => { ev.stopPropagation(); (user.role === 'owner' || user.role === 'admin') && setEditingWage({ id: e.id, wage }); }} style={{ borderBottom: '2px dashed var(--accent-orange)', cursor: (user.role === 'owner' || user.role === 'admin') ? 'pointer' : 'default' }}>
                                                        {parseInt(wage).toLocaleString()}원
                                                    </span>
                                                )}
                                            </td>
                                            <td data-label="누적 시간" style={{ padding: '16px 10px', opacity: 0.8, color: 'var(--text-main)' }}>{hours}시간</td>
                                            <td data-label="총 누적임금" style={{ padding: '16px 10px', fontWeight: '700', color: 'var(--text-main)' }}>{parseInt(cumulativeWage).toLocaleString()}원</td>
                                            <td data-label="지불된 임금" style={{ padding: '16px 10px', color: '#10b981', fontWeight: '800' }}>{parseInt(paidWage).toLocaleString()}원</td>
                                            <td data-label="미지급 임금" style={{ padding: '16px 10px', color: 'var(--accent-orange)', fontWeight: '900', fontSize: '1.05rem' }}>
                                                {parseInt(unpaidWage).toLocaleString()}원
                                            </td>
                                            <td data-label="관리 옵션" style={{ padding: '16px 10px', textAlign: 'right' }} onClick={(ev) => ev.stopPropagation()}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                    <button 
                                                        onClick={() => setPayrollModal({ id, name, role, wage, hours, cumulativeWage, paidWage, unpaidWage })}
                                                        style={{ background: 'var(--surface)', color: 'var(--text-main)', border: '1.5px solid var(--border)', borderRadius: '10px', padding: '8px 14px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}
                                                    >
                                                        📄 명세서 확인
                                                    </button>
                                                    {(user.role === 'owner' || user.role === 'admin') && (
                                                        <>
                                                            <button 
                                                                onClick={(ev) => handleForceAttendance(ev, e, 'check-in')}
                                                                style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', borderRadius: '10px', padding: '8px 12px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}
                                                            >
                                                                🏃출근
                                                            </button>
                                                            <button 
                                                                onClick={(ev) => handleForceAttendance(ev, e, 'check-out')}
                                                                style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--accent-orange)', border: '1px solid var(--accent-orange)', borderRadius: '10px', padding: '8px 12px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}
                                                            >
                                                                🏠퇴근
                                                            </button>
                                                        </>
                                                    )}
                                                    {user.role === 'owner' && parseInt(unpaidWage) > 0 && (
                                                        <button 
                                                            onClick={() => handlePaySalary(id, name)}
                                                            className="confirm-btn success-green"
                                                            style={{ fontSize: '0.8rem', padding: '8px 14px', borderRadius: '10px', fontWeight: '800' }}
                                                        >
                                                            💸 급여 지급
                                                        </button>
                                                    )}
                                                    {user.role === 'owner' && (
                                                        <button onClick={() => handleResignEmployee(e)} className="del-btn" style={{ fontSize: '0.8rem', padding: '8px 14px', borderRadius: '10px', fontWeight: '800' }}>퇴사</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {employees.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', opacity: 0.5, padding: '40px' }}>등록된 사원이 없습니다.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 사원 상세 계약 조건 및 스케줄 화면 */}
                {selectedEmployee && (
                    <div className="glass-panel animate-fade-in" style={{ padding: '24px', borderRadius: '20px', border: '1.5px solid rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                            <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--accent-orange)' }}>🔒 {selectedEmployee.name} ({selectedEmployee.role}) 상세 근로 조건 및 스케줄</h4>
                            <button onClick={() => setSelectedEmployee(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '25px' }}>
                            {/* 계약 요건 */}
                            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                <h5 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 800 }}>📌 계약 요건 및 가이드</h5>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>근로 계약 기간:</span>
                                        <strong style={{ color: 'var(--text-main)' }}>{selectedEmployee.contract?.start || '2026-05-01'} ~ {selectedEmployee.contract?.end || '2026-10-31'}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>근무 구분:</span>
                                        <strong>{selectedEmployee.contract?.end === '9999-12-31' ? '정규 근로자' : '임시/단기 알바생'}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>퇴직금 대상 여부:</span>
                                        <strong style={{ color: parseFloat(selectedEmployee.hours) >= 60 ? '#10b981' : 'var(--text-muted)' }}>
                                            {parseFloat(selectedEmployee.hours) >= 60 ? '✅ 지급 대상 (주 15시간 이상)' : '❌ 미대상 (누적근무 부족)'}
                                        </strong>
                                    </div>
                                    <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                        ⚠️ <strong>퇴직금 산정 안내:</strong> 근로자 퇴직급여 보장법에 따라, 단기 알바생이라 하더라도 주당 평균 근로시간이 15시간 이상이고 연속 근로 기간이 1년 이상이 될 경우 법적 퇴직금 지급 대상이 됩니다.
                                    </div>
                                </div>
                            </div>

                            {/* 요일별 근무 스케줄 */}
                            <div style={{ background: 'rgba(0,0,0,0.15)', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                <h5 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 800 }}>📅 주간 요일별 출퇴근 스케줄</h5>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                                <th style={{ padding: '8px' }}>근무 요일</th>
                                                <th style={{ padding: '8px' }}>출근 시각</th>
                                                <th style={{ padding: '8px' }}>퇴근 시각</th>
                                                <th style={{ padding: '8px' }}>출퇴근 가드레일</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {["월", "화", "수", "목", "금", "토", "일"].map((day, idx) => {
                                                const sched = selectedEmployee.schedule?.find((s: any) => s.day_of_week === idx);
                                                return (
                                                    <tr key={day} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{day}요일</td>
                                                        <td style={{ padding: '8px', color: sched ? 'var(--text-main)' : 'rgba(255,255,255,0.2)' }}>
                                                            {sched ? sched.start_time : '휴무'}
                                                        </td>
                                                        <td style={{ padding: '8px', color: sched ? 'var(--text-main)' : 'rgba(255,255,255,0.2)' }}>
                                                            {sched ? sched.end_time : '휴무'}
                                                        </td>
                                                        <td style={{ padding: '8px', color: 'var(--accent-orange)', fontSize: '0.75rem' }}>
                                                            {sched ? "전후 5분 내 인증 필수" : "-"}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 실시간 근태 기록 로그 */}
            <div className="glass-panel attendance-logs" style={{ marginTop: '25px', padding: '24px', borderRadius: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.25rem', fontWeight: 800 }}>🕒 실시간 출퇴근 근태 타임라인 로그 ({storeName})</h3>
                <div className="log-container" style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {attendance.length > 0 ? attendance.map(a => {
                        const tardy = a.items?.find((i: any) => i.name === '지각여부')?.value === '지각';
                        const paid = a.items?.find((i: any) => i.name === '정산상태')?.value === '지급';
                        return (
                            <div 
                                key={a.id} 
                                className="log-item" 
                                style={{ 
                                    padding: '14px 18px', 
                                    background: 'rgba(255,255,255,0.02)', 
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    borderRadius: '12px', 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '1.1rem' }}>⏱️</span>
                                    <div>
                                        <span className="action" style={{ color: 'white', fontWeight: '700', fontSize: '0.9rem' }}>{a.title}</span>
                                        <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
                                            {tardy && <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>⚠️ 지각</span>}
                                            <span style={{ background: paid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: paid ? '#10b981' : '#f59e0b', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                                {paid ? '정산완료' : '미정산'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <span className="time" style={{ opacity: 0.5, fontSize: '0.85rem' }}>{a.timestamp}</span>
                            </div>
                        );
                    }) : (
                        <div style={{ textAlign: 'center', padding: '50px', opacity: 0.5 }}>기록된 출퇴근 로그가 없습니다.</div>
                    )}
                </div>
            </div>

            {/* ==================== 🕒 QR 출퇴근기록 단말기 모달 ==================== */}
            {qrScannerOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(8px)'
                }}>
                    <div className="glass-panel" style={{
                        width: '450px', padding: '30px', borderRadius: '24px',
                        border: '2px solid rgba(249, 115, 22, 0.3)', position: 'relative',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        <button 
                            onClick={() => setQrScannerOpen(false)} 
                            style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
                        >
                            ✕
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <span style={{ fontSize: '2.5rem' }}>📷</span>
                            <h4 style={{ margin: '10px 0 4px 0', fontSize: '1.2rem', fontWeight: 800 }}>출퇴근 QR코드 단말기</h4>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>스케줄 시각 전후 5분 내 인증 필수</p>
                        </div>

                        {/* 디지털 시계 피드 */}
                        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.05)', padding: '15px', borderRadius: '14px', textAlign: 'center', marginBottom: '20px' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>현재 매장 서버 시각</span>
                            <span style={{ color: 'var(--accent-orange)', fontSize: '1.6rem', fontWeight: '900', fontFamily: 'monospace', marginTop: '4px', display: 'block' }}>
                                {currentTime.toLocaleTimeString()}
                            </span>
                        </div>

                        {/* 모의 카메라 스캔 영역 */}
                        <div style={{ 
                            width: '100%', height: '180px', background: '#000', borderRadius: '16px', 
                            marginBottom: '20px', position: 'relative', overflow: 'hidden',
                            border: isScanningQr ? '2px solid var(--accent-orange)' : '1px solid rgba(255,255,255,0.1)'
                        }}>
                            {isScanningQr ? (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{
                                        width: '60px', height: '60px', border: '4px solid rgba(249, 115, 22, 0.2)',
                                        borderTopColor: 'var(--accent-orange)', borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }} />
                                    <span style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--accent-orange)', fontWeight: 'bold' }}>
                                        [QR 코드 정밀 해독 중...]
                                    </span>
                                </div>
                            ) : (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    {/* QR 과녁 라인 과 광원 연출 */}
                                    <div style={{
                                        width: '120px', height: '120px', border: '2px dashed rgba(255,255,255,0.3)',
                                        borderRadius: '8px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <div style={{
                                            position: 'absolute', width: '100%', height: '2px',
                                            background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
                                            top: '50%', transform: 'translateY(-50%)',
                                            animation: 'pulse 1.5s infinite'
                                        }} />
                                        📱 QR CODE
                                    </div>
                                    <span style={{ marginTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>매장 모바일 QR코드를 과녁에 비춰주세요</span>
                                </div>
                            )}
                        </div>

                        {/* 입력 설정 폼 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>근무 사원 선택</label>
                                <select 
                                    value={selectedStaffForQr}
                                    onChange={(e) => setSelectedStaffForQr(e.target.value)}
                                    style={{
                                        width: '100%', padding: '12px', borderRadius: '10px',
                                        background: '#111', border: '1.5px solid var(--border)',
                                        color: '#fff', outline: 'none'
                                    }}
                                >
                                    <option value="">사원을 선택해 주세요</option>
                                    {employees.map(emp => {
                                        const name = emp.items.find((i: any) => i.name === '이름')?.value || '-';
                                        const id = emp.items.find((i: any) => i.name === '아이디')?.value || emp.id;
                                        const role = emp.items.find((i: any) => i.name === '직책')?.value || '점원';
                                        return (
                                            <option key={id} value={id}>{name} ({role})</option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>인증 구분</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <button 
                                        type="button"
                                        onClick={() => setSelectedActionForQr('check-in')}
                                        style={{
                                            padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer',
                                            border: '1.5px solid ' + (selectedActionForQr === 'check-in' ? 'var(--accent-orange)' : 'var(--border)'),
                                            background: selectedActionForQr === 'check-in' ? 'rgba(249,115,22,0.1)' : 'transparent',
                                            color: selectedActionForQr === 'check-in' ? 'var(--accent-orange)' : 'var(--text-muted)'
                                        }}
                                    >
                                        🏃 출근 등록
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setSelectedActionForQr('check-out')}
                                        style={{
                                            padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer',
                                            border: '1.5px solid ' + (selectedActionForQr === 'check-out' ? 'var(--accent-orange)' : 'var(--border)'),
                                            background: selectedActionForQr === 'check-out' ? 'rgba(249,115,22,0.1)' : 'transparent',
                                            color: selectedActionForQr === 'check-out' ? 'var(--accent-orange)' : 'var(--text-muted)'
                                        }}
                                    >
                                        🏠 퇴근 등록
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleQrAttendance}
                            className="confirm-btn premium-orange" 
                            style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold' }}
                            disabled={isScanningQr}
                        >
                            {isScanningQr ? '출퇴근 매칭 분석 중...' : 'QR코드 인증 및 타임카드 서명'}
                        </button>
                    </div>
                </div>
            )}

            {/* ==================== 🧾 누적 급여 명세서 확인 모달 ==================== */}
            {payrollModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(6px)'
                }}>
                    <div style={{
                        width: '380px', padding: '30px', borderRadius: '24px',
                        background: '#151515', border: '1px solid rgba(255,255,255,0.08)',
                        position: 'relative', boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
                        color: '#eee', fontFamily: 'monospace'
                    }}>
                        {/* 영수증 상단 데코 */}
                        <div style={{ textAlign: 'center', borderBottom: '1.5px dashed rgba(255,255,255,0.15)', paddingBottom: '20px', marginBottom: '20px' }}>
                            <span style={{ fontSize: '1.8rem' }}>🧾</span>
                            <h4 style={{ margin: '10px 0 4px 0', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '1px' }}>PAYROLL STATEMENT</h4>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>식당 통합 정산 센터 영수증</span>
                        </div>

                        {/* 디테일 리스트 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>성 명 (사원명):</span>
                                <strong>{payrollModal.name} ({payrollModal.role})</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>계약 시급:</span>
                                <strong>{Math.floor(Number(payrollModal.wage) || 0).toLocaleString()}원</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>당월 누적근무시간:</span>
                                <strong>{payrollModal.hours}시간</strong>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '4px 0' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>기본 근로 소득:</span>
                                <span>{Math.floor((Number(payrollModal.wage) || 0) * (Number(payrollModal.hours) || 0)).toLocaleString()}원</span>
                            </div>

                            {parseFloat(payrollModal.hours) >= 60 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                                    <span>주휴수당 가산 (상용):</span>
                                    <span>+{Math.floor(((Number(payrollModal.hours) || 0) / 40.0) * 8.0 * (Number(payrollModal.wage) || 0)).toLocaleString()}원</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                                <span>원천세 징수 (3.3%):</span>
                                <span>-{Math.floor((Number(payrollModal.cumulativeWage) || 0) * 0.033).toLocaleString()}원</span>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1.5px dashed rgba(255,255,255,0.15)', margin: '10px 0' }} />

                            {/* 최종 실 수령 누적액 */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 'bold' }}>
                                <span style={{ color: 'var(--accent-orange)' }}>실수령 누적금액:</span>
                                <span style={{ color: 'var(--accent-orange)' }}>
                                    {Math.floor((Number(payrollModal.cumulativeWage) || 0) * 0.967).toLocaleString()}원
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '6px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>이미 지불된 금액:</span>
                                <span style={{ color: '#10b981' }}>{Math.floor(Number(payrollModal.paidWage) || 0).toLocaleString()}원</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '700' }}>
                                <span style={{ color: 'var(--text-muted)' }}>당월 미지급 잔액:</span>
                                <span style={{ color: 'var(--accent-orange)' }}>{Math.floor(Number(payrollModal.unpaidWage) || 0).toLocaleString()}원</span>
                            </div>
                        </div>

                        {/* 닫기 버튼 */}
                        <div style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
                            <button 
                                onClick={() => setPayrollModal(null)}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '10px',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                    color: '#fff', fontWeight: 'bold', cursor: 'pointer'
                                }}
                            >
                                닫 기
                            </button>
                            {user.role === 'owner' && parseInt(payrollModal.unpaidWage) > 0 && (
                                <button 
                                    onClick={() => handlePaySalary(payrollModal.id, payrollModal.name)}
                                    className="confirm-btn success-green"
                                    style={{ flex: 1.2, padding: '12px', borderRadius: '10px', fontWeight: 'bold' }}
                                >
                                    💸 급여 지금 처리
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
