import React from 'react';

export const HRManager: React.FC<{ bundles: any[] }> = ({ bundles }) => {
    const employees = bundles.filter(b => b.type === 'Employee');
    const attendance = bundles.filter(b => b.type === 'Attendance');

    return (
        <div className="admin-page animate-fade-in">
            <header className="page-header">
                <h2>👥 인적 자원 관리 (HR)</h2>
                <p>사원 등록, 권한 설정 및 실시간 출퇴근 현황을 관리합니다.</p>
            </header>

            <div className="hr-grid">
                <div className="glass-panel employee-list">
                    <h3>사원 명부</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>이름</th>
                                <th>직책</th>
                                <th>시급</th>
                                <th>근무 시간</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(e => {
                                const name = e.items.find((i: any) => i.name === '이름')?.value || '-';
                                const role = e.items.find((i: any) => i.name === '직책')?.value || '점원';
                                const wage = e.items.find((i: any) => i.name === '시급')?.value || '10,000';
                                return (
                                    <tr key={e.id}>
                                        <td>{name}</td>
                                        <td><span className="role-badge">{role}</span></td>
                                        <td>{wage}원</td>
                                        <td>월~금 / 09:00-18:00</td>
                                    </tr>
                                );
                            })}
                            {employees.length === 0 && (
                                <tr><td colSpan={4} style={{textAlign: 'center', opacity: 0.5}}>등록된 사원이 없습니다.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="glass-panel attendance-logs">
                    <h3>실시간 출퇴근 로그</h3>
                    <div className="log-container">
                        {attendance.map(a => (
                            <div key={a.id} className="log-item">
                                <span className="time">{a.timestamp}</span>
                                <span className="action">{a.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
