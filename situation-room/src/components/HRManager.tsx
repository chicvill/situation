import React, { useState } from 'react';
import { apiFetch } from '../utils/apiFetch';
import { useStoreFilter } from '../hooks/useStoreFilter';
import type { Bundle, EmployeeDetail, PayrollInfo } from './hr/types';
import { useAttendance } from './hr/useAttendance';
import { KioskPanel } from './hr/KioskPanel';
import { PayrollModal } from './hr/PayrollModal';
import { EmployeeCard } from './hr/EmployeeCard';
import { EmployeeModal } from './hr/EmployeeModal';

export const HRManager: React.FC<{ bundles: any[], user: any, storeDetails?: any, onRefresh?: () => void }> = ({ bundles, user, storeDetails, onRefresh }) => {
    const { storeId, storeName } = useStoreFilter();
    const params = new URLSearchParams(window.location.search);
    const isCheckinMode = params.get('mode') === 'hr' && params.get('action') === 'checkin';

    const [isProcessing, setIsProcessing] = useState(false);
    const [showBanner, setShowBanner] = useState(true);
    const [kioskPhone, setKioskPhone] = useState('');

    // Selected states
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDetail | null>(null);
    const [payrollModal, setPayrollModal] = useState<PayrollInfo | null>(null);
    const [isScanningQr, setIsScanningQr] = useState(false);

    // Sync selectedEmployee with latest bundles data
    React.useEffect(() => {
        if (selectedEmployee) {
            const updated = bundles.find(b => b.id === selectedEmployee.id);
            if (updated && JSON.stringify(updated) !== JSON.stringify(selectedEmployee)) {
                setSelectedEmployee(updated as any);
            }
        }
    }, [bundles, selectedEmployee]);

    // 신규 사원 직접 등록 폼 활성화 및 입력 상태들
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [regName, setRegName] = useState('');
    const [regPhone, setRegPhone] = useState('');
    const [regRole, setRegRole] = useState('staff');
    const [regWage, setRegWage] = useState('10500');
    const [regTempPw, setRegTempPw] = useState('1212');
    const [regSchedules, setRegSchedules] = useState<{ [key: number]: { active: boolean, start: string, end: string } }>({
        0: { active: false, start: '09:00', end: '18:00' },
        1: { active: false, start: '09:00', end: '18:00' },
        2: { active: false, start: '09:00', end: '18:00' },
        3: { active: false, start: '09:00', end: '18:00' },
        4: { active: false, start: '09:00', end: '18:00' },
        5: { active: false, start: '09:00', end: '18:00' },
        6: { active: false, start: '09:00', end: '18:00' },
    });

    // 현재 매장의 직원 및 근태 정보만 필터링
    const employees: Bundle[] = bundles.filter(b => b.type === 'Employee' && (storeId === 'Total' || b.store_id === storeId || !b.store_id));
    const attendance: Bundle[] = bundles.filter(b => b.type === 'Attendance' && (storeId === 'Total' || b.store_id === storeId || !b.store_id));

    const employeeAttendance = selectedEmployee ? attendance.filter(a => {
        const staffId = a.items?.find((i: any) => i.name === '아이디')?.value;
        return staffId === selectedEmployee.id || staffId === selectedEmployee.id.replace('EMP-', '');
    }) : [];

    // 승인 대기 계정 필터링 (계층적 승인 + 매장 격리)
    // admin → 점주 승인, owner → 점장·점원 승인, manager → 점원(자기 매장만) 승인
    const pendingAccounts: Bundle[] = bundles.filter(b => {
        if (b.type !== 'PersonalInfos' || b.status === 'approved') return false;
        const accountRole = b.items?.find((i: any) => i.name === '권한')?.value;
        if (user.role === 'admin') return accountRole === 'owner';
        if (user.role === 'owner') {
            if (storeId !== 'Total' && b.store_id !== storeId) return false;
            return accountRole === 'manager' || accountRole === 'staff';
        }
        if (user.role === 'manager') {
            return accountRole === 'staff' && b.store_id === storeId;
        }
        return false;
    });

    const { deviceId: _deviceId, handleForceAttendance, handleKioskSubmit } = useAttendance({
        storeId,
        employees,
        setIsScanningQr,
        kioskPhone,
        setKioskPhone,
        setIsProcessing,
        onRefresh,
    });



    const handleDeleteLog = async (ev: React.MouseEvent, bundleId: string) => {
        ev.stopPropagation();
        if (!window.confirm('이 근태 기록을 삭제하시겠습니까? (삭제 시 복구할 수 없으며 타임라인과 DB 모두에서 제거됩니다.)')) return;

        try {
            const response = await apiFetch(`/api/bundle/${bundleId}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                alert('삭제 중 오류가 발생했습니다.');
            } else {
                // 즉시 데이터 새로고침
                if (onRefresh) onRefresh();
            }
        } catch (err) {
            console.error(err);
            alert('삭제 중 서버 오류가 발생했습니다.');
        }
    };

    const handleResignEmployee = async (bundle: Bundle) => {
        if (!window.confirm(`${bundle.title} 사원의 퇴사 처리를 진행하시겠습니까? 로그인 권한이 즉시 차단됩니다.`)) return;
        setIsProcessing(true);
        try {
            await apiFetch(`/api/bundle/${bundle.id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...bundle, status: 'resigned', store: storeName, store_id: storeId }),
            });
            alert('🚫 퇴사 처리가 완료되었습니다.');
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
    };

    const handleApproveAccount = async (bundle: Bundle) => {
        if (!window.confirm(`${bundle.title} 계정을 승인하시겠습니까?`)) return;
        setIsProcessing(true);
        try {
            await apiFetch(`/api/bundle/${bundle.id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...bundle, status: 'approved', store: storeName, store_id: storeId }),
            });
            alert('✅ 계정이 승인되었습니다.');
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
    };

    const handlePaySalary = async (staffId: string, name: string) => {
        if (!window.confirm(`💰 ${name} 사원에게 쌓인 모든 미지급 임금을 정상 지급 완료 처리하시겠습니까?`)) return;
        setIsProcessing(true);
        try {
            const response = await apiFetch(`/api/attendance/pay/${staffId}`, {
                method: 'POST',
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


    const handleRegisterStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanPhone = regPhone.replace(/[^0-9]/g, '').trim();
        if (!regName.trim() || !cleanPhone) {
            alert('⚠️ 사원명과 휴대폰 번호(ID)를 정확히 입력해 주세요.');
            return;
        }

        const isDuplicate = employees.some(emp => {
            const existing = emp.items?.find((i: any) => i.name === '아이디')?.value;
            return existing && existing.replace(/[^0-9]/g, '') === cleanPhone;
        });
        if (isDuplicate) {
            alert(`⚠️ 이미 등록된 전화번호(ID)입니다: ${cleanPhone}\n중복 등록은 허용되지 않습니다.`);
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

            const response = await apiFetch(`/api/staff/direct-register`, {
                method: 'POST',
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

    // ── Kiosk check-in mode ──
    if (isCheckinMode) {
        return (
            <KioskPanel
                kioskPhone={kioskPhone}
                isScanningQr={isScanningQr}
                onPhoneChange={setKioskPhone}
                onSubmit={handleKioskSubmit}
            />
        );
    }

    return (
        <div className="admin-page animate-fade-in" style={{ paddingBottom: '60px' }}>

            {/* 헤더 */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                        <h2 style={{ margin: '0 0 2px', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>
                            👥 인적 자원 · 임금 정산 관리
                        </h2>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {user.role === 'owner' || user.role === 'admin' ? '스케줄 · 급여 · QR 출퇴근 통합 관리' : '실시간 나의 근무 및 근태 로그'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(user.role === 'owner' || user.role === 'admin') && (
                            <button
                                onClick={() => setShowRegisterForm(!showRegisterForm)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '9px 16px', borderRadius: '10px', border: 'none',
                                    background: showRegisterForm ? 'var(--surface)' : '#10b981',
                                    color: showRegisterForm ? 'var(--text-muted)' : 'white',
                                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                    boxShadow: showRegisterForm ? 'none' : '0 2px 8px rgba(16,185,129,0.25)',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {showRegisterForm ? '✕ 닫기' : '➕ 사원 등록'}
                            </button>
                        )}
                    </div>
                </div>

                {storeDetails && showBanner && (
                    <div
                        onClick={() => setShowBanner(false)}
                        style={{
                            marginTop: '14px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderLeft: '3px solid #10b981',
                            borderRadius: '10px',
                            padding: '10px 14px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                            cursor: 'pointer',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ fontSize: '1rem', flexShrink: 0 }}>⏱</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                <strong style={{ color: 'var(--text-main)' }}>출퇴근 전후 5분 수칙:</strong> 배정된 요일별 일정 기준 전후 5분 내에만 QR 인증이 가능합니다.
                            </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>✕</span>
                    </div>
                )}
            </div>

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
                                <input type="text" value={regName} onChange={(ev) => setRegName(ev.target.value)} placeholder="이름 입력" style={{ padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white' }} required />
                            </div>
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>아이디 (휴대폰 번호)</label>
                                <input type="text" value={regPhone} onChange={(ev) => setRegPhone(ev.target.value)} placeholder="예: 01012345678" style={{ padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white' }} required />
                            </div>
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>임시 비밀번호</label>
                                <input type="text" value={regTempPw} onChange={(ev) => setRegTempPw(ev.target.value)} placeholder="임시 암호 (기본 1212)" style={{ padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white' }} required />
                            </div>
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>근무 직책</label>
                                <select value={regRole} onChange={(ev) => setRegRole(ev.target.value)} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white' }}>
                                    <option value="staff">점원 (Staff)</option>
                                    <option value="manager">점장 (Manager)</option>
                                </select>
                            </div>
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>계약 시급 (원)</label>
                                <input type="text" value={regWage} onChange={(ev) => setRegWage(ev.target.value.replace(/[^0-9]/g, ''))} placeholder="시급 입력 (예: 10500)" style={{ padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', color: 'white', fontWeight: 'bold' }} required />
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
                                                    onChange={(ev) => setRegSchedules({ ...regSchedules, [idx]: { ...daySched, active: ev.target.checked } })}
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
                                                />
                                                <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{dayName}요일</span>
                                            </div>

                                            {daySched.active ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <input type="time" value={daySched.start} onChange={(ev) => setRegSchedules({ ...regSchedules, [idx]: { ...daySched, start: ev.target.value } })} style={{ padding: '6px 10px', borderRadius: '6px', background: '#000', border: '1px solid var(--border)', color: '#fff' }} />
                                                    <span style={{ opacity: 0.6 }}>~</span>
                                                    <input type="time" value={daySched.end} onChange={(ev) => setRegSchedules({ ...regSchedules, [idx]: { ...daySched, end: ev.target.value } })} style={{ padding: '6px 10px', borderRadius: '6px', background: '#000', border: '1px solid var(--border)', color: '#fff' }} />
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
                                const accName = b.items?.find((i: any) => i.name === '이름')?.value || '-';
                                const accRole = b.items?.find((i: any) => i.name === '권한')?.value || '-';
                                const roleLabel = accRole === 'manager' ? '점장' : accRole === 'staff' ? '점원' : accRole;
                                return (
                                    <div key={b.id} style={{ background: 'rgba(249, 115, 22, 0.05)', padding: '16px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(249, 115, 22, 0.15)' }}>
                                        <div>
                                            <strong style={{ fontSize: '1rem' }}>{accName}</strong>
                                            <span style={{ opacity: 0.7, fontSize: '0.85rem', marginLeft: '6px' }}>({roleLabel})</span>
                                            {b.store && <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{b.store}</span>}
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {employees.map(e => (
                            <EmployeeCard
                                key={e.id}
                                bundle={e}
                                isSelected={selectedEmployee?.id === e.items?.find((i: any) => i.name === '아이디')?.value || selectedEmployee?.id === e.id}
                                onSelect={setSelectedEmployee}
                            />
                        ))}
                        {employees.length === 0 && (
                            <div style={{ textAlign: 'center', opacity: 0.5, padding: '40px' }}>등록된 사원이 없습니다.</div>
                        )}
                    </div>
                </div>

                {/* 사원 상세 계약 조건 및 스케줄 화면 (모달 팝업으로 변경) */}
                {/* 사원 상세 계약 조건 및 스케줄 화면 (모달 팝업으로 변경) */}
                {selectedEmployee && (
                    <EmployeeModal
                        employee={selectedEmployee}
                        userRole={user.role}
                        storeId={storeId}
                        isProcessing={isProcessing}
                        setIsProcessing={setIsProcessing}
                        onClose={() => setSelectedEmployee(null)}
                        employeeAttendance={employeeAttendance}
                        handleForceAttendance={handleForceAttendance}
                        handlePaySalary={handlePaySalary}
                        handleResignEmployee={handleResignEmployee}
                        handleDeleteLog={handleDeleteLog}
                        setPayrollModal={setPayrollModal}
                    />
                )}

                {/* 누적 급여 명세서 확인 모달 */}
                {payrollModal && (
                    <PayrollModal
                        payrollModal={payrollModal}
                        isProcessing={isProcessing}
                        userRole={user.role}
                        onClose={() => setPayrollModal(null)}
                        onPaySalary={handlePaySalary}
                    />
                )}
            </div>
        </div>
    );
};

