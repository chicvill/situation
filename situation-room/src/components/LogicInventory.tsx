import React from 'react';

export const LogicInventory: React.FC = () => {
    const matrix = [
        { step: 'STEP 0', type: '노출', loc: 'StoreSetup/Menu', content: '기초 데이터 설정', logic: '매장 정보, 메뉴, 직원 등 마스터 데이터 구축' },
        { step: '마스터설정', type: '입력', loc: 'Admin/Setup', content: '설정값 저장', logic: '시스템 환경 변수 및 운영 규칙 정의' },
        { step: 'STEP 1', type: '노출', loc: 'CustomerOrder', content: '메뉴판/장바구니', logic: '고객의 메뉴 선택 및 수량 파악' },
        { step: '주문생성', type: '입력', loc: 'CustomerOrder', content: '요청사항 텍스트', logic: 'items[memo] 필드 저장 및 주방 전달' },
        { step: '', type: '버튼', loc: 'CustomerOrder', content: '[주문하기]', logic: '장바구니 > 0 시 활성화, POST 주문 전송' },
        { step: '', type: '분기점', loc: 'CustomerOrder', content: '결제 수단 선택', logic: 'handleSubmit(method_id) 호출 (선결제/후결제)' },
        { step: 'STEP 2', type: '노출', loc: 'Counter/Kitchen', content: '주문 카드 리스트', logic: '실시간 현황 브로드캐스팅 및 인지' },
        { step: '실시간동기', type: '분기점', loc: 'useSituation', content: '메시지 수신', logic: 'handleWS(data.type)에 따라 UI 리렌더링' },
        { step: 'STEP 3', type: '노출', loc: 'KitchenDisplay', content: '조리 대기 리스트', logic: '주방장의 조리 우선순위 결정' },
        { step: '상태변화', type: '버튼', loc: 'KitchenDisplay', content: '[조리 완료]', logic: 'status: cooking → ready 변경/브로드캐스트' },
        { step: '', type: '분기점', loc: 'CounterPad', content: '서빙 상태 판별', logic: 'updateStatus(bundleId, ready) 연동' },
        { step: '', type: '버튼', loc: 'CounterPad', content: '[서빙 완료]', logic: 'status: ready → served 변경/전광판 소등' },
        { step: 'STEP 4', type: '노출', loc: 'CounterPad', content: '정산 모달 영수증', logic: '최종 금액/수단 확인 및 고객 검수' },
        { step: '정산소멸', type: '버튼', loc: 'CounterPad', content: '[정산 완료]', logic: '결제 수단 확정 및 아카이빙 트리거' },
        { step: '', type: '분기점', loc: 'AI Engine', content: '아카이빙 로직', logic: 'archive_bundle(id) 호출, 매출 통계 기록' },
        { step: '', type: '결과', loc: 'Knowledge Pool', content: '데이터 소멸', logic: '활성 리스트에서 삭제, status: archived' },
    ];

    const lifecycle = [
        { id: '0', title: '마스터 설정', desc: '기초 데이터 구축' },
        { id: '1', title: '객체 생성', desc: '주인공 번들 탄생' },
        { id: '2', title: '실시간 동기', desc: '전 단말기 공유' },
        { id: '3', title: '상태 진화', desc: '조리 및 서빙 업데이트' },
        { id: '4', title: '정산 및 소멸', desc: '매출 기록 및 아카이빙' },
    ];

    return (
        <div className="logic-inventory-page animate-fade-in" style={{ padding: '40px', color: 'white' }}>
            <header style={{ marginBottom: '40px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🧠 Knowledge Inventory Dashboard</h1>
                <p style={{ color: 'var(--text-muted)' }}>범용 앱 개발 프레임워크: 데이터 객체 중심(Object-First) 방법론</p>
            </header>

            <div className="lifecycle-visual" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '60px', position: 'relative' }}>
                <div className="flow-line" style={{ position: 'absolute', top: '50%', left: '0', width: '100%', height: '2px', background: 'linear-gradient(90deg, transparent, var(--accent-orange), transparent)', zIndex: -1 }}></div>
                {lifecycle.map((step, i) => (
                    <div key={i} className="step-node glass-panel" style={{ width: '18%', padding: '20px', textAlign: 'center', border: '1px solid var(--accent-orange)', boxShadow: '0 0 15px rgba(249, 115, 22, 0.2)' }}>
                        <div className="node-num" style={{ width: '30px', height: '30px', background: 'var(--accent-orange)', borderRadius: '50%', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{step.id}</div>
                        <h4 style={{ margin: '0 0 5px 0' }}>{step.title}</h4>
                        <p style={{ fontSize: '0.75rem', color: '#aaa', margin: 0 }}>{step.desc}</p>
                    </div>
                ))}
            </div>

            <div className="logic-matrix-container glass-panel" style={{ padding: '30px', overflowX: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0 }}>📋 로직 매트릭스 (Logical Objects Matrix)</h2>
                    <div style={{ fontSize: '0.9rem', color: 'var(--accent-orange)' }}>* 새로운 앱 개발 시 이 매트릭스를 먼저 채우십시오.</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                            <th style={{ padding: '15px' }}>단계</th>
                            <th style={{ padding: '15px' }}>유형</th>
                            <th style={{ padding: '15px' }}>위치</th>
                            <th style={{ padding: '15px' }}>항목 및 내용</th>
                            <th style={{ padding: '15px' }}>로직 및 결과 (조건/영향)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: row.step ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                <td style={{ padding: '12px 15px', fontWeight: 'bold', color: row.step.includes('STEP') ? 'var(--accent-orange)' : '#888' }}>{row.step}</td>
                                <td style={{ padding: '12px 15px' }}><span className={`type-badge ${row.type}`}>{row.type}</span></td>
                                <td style={{ padding: '12px 15px', opacity: 0.8, fontSize: '0.85rem' }}>{row.loc}</td>
                                <td style={{ padding: '12px 15px', fontWeight: 'bold' }}>{row.content}</td>
                                <td style={{ padding: '12px 15px', fontSize: '0.9rem', color: '#ccc' }}>{row.logic}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <footer style={{ marginTop: '40px', padding: '20px', textAlign: 'center', opacity: 0.6, fontSize: '0.85rem' }}>
                본 프레임워크는 사장님의 비즈니스 철학을 IT 시스템으로 구현하는 표준 방법론입니다.
            </footer>

            <style dangerouslySetInnerHTML={{ __html: `
                .type-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
                .type-badge.노출 { background: #3b82f6; color: white; }
                .type-badge.입력 { background: #10b981; color: white; }
                .type-badge.버튼 { background: #f59e0b; color: white; }
                .type-badge.분기점 { background: #8b5cf6; color: white; }
                .type-badge.결과 { background: #ef4444; color: white; }
                .logic-inventory-page tr:hover { background: rgba(255,255,255,0.05) !important; }
                .step-node:hover { transform: translateY(-5px); transition: all 0.3s ease; border-color: white !important; }
            `}} />
        </div>
    );
};
