import React, { useState, useRef } from 'react';

export const StoreSetup: React.FC<{ storeName: string }> = ({ storeName }) => {
    const [uploadingReg, setUploadingReg] = useState(false);
    const [uploadingMenu, setUploadingMenu] = useState(false);
    const [storeData, setStoreData] = useState<any>(null);
    const [menuData, setMenuData] = useState<any[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const menuInputRef = useRef<HTMLInputElement>(null);

    const requestRealAIAnalysis = async (type: 'reg' | 'menu', file: File) => {
        setSelectedFile(file.name);
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            if (type === 'reg') setUploadingReg(true); else setUploadingMenu(true);
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/analyze-image?doc_type=${type}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorBody}`);
            }
            
            const result = await response.json();
            
            // 백엔드가 보낸 Bundle 형태에서 데이터 추출
            if (type === 'reg') {
                const items = result.items || [];
                const getValue = (name: string) => items.find((i: any) => i.name === name)?.value || '';
                
                setStoreData({
                    brand: getValue('상호명') || getValue('brand'),
                    regNo: getValue('사업자번호') || getValue('regNo'),
                    address: getValue('주소') || getValue('address'),
                    owner: getValue('대표자') || getValue('owner')
                });
            } else {
                // 메뉴 데이터 추출
                const items = result.items || [];
                if (items.length > 0) {
                    setMenuData(items.map((i: any) => ({ name: i.name, price: i.value })));
                } else {
                    setMenuData([{ name: '', price: '' }]); // 기본 행 추가
                }
            }
        } catch (err: any) {
            console.error("AI Analysis failed:", err);
            alert(`서버 연결 실패 상세: ${err.message}\n(AI 서버가 정확히 실행 중인지 확인하세요)`);
        } finally {
            setUploadingReg(false);
            setUploadingMenu(false);
            setSelectedFile(null);
        }
    };

    const handleStoreChange = (field: string, value: string) => {
        setStoreData((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleMenuChange = (idx: number, field: string, value: string) => {
        const newMenu = [...menuData];
        newMenu[idx][field] = value;
        setMenuData(newMenu);
    };

    const removeMenuItem = (idx: number) => {
        setMenuData(prev => prev.filter((_, i) => i !== idx));
    };

    const addMenuItem = () => {
        setMenuData([...menuData, { name: '', price: '' }]);
    };

    const saveToPool = async (type: 'StoreConfig' | 'Menus', data: any) => {
        let text = "";
        if (type === 'StoreConfig') {
            text = `매장 개설: 상호명은 '${data.brand}', 사업자번호는 '${data.regNo}', 주소는 '${data.address}', 대표자는 '${data.owner}'로 공식 등록해줘.`;
        } else {
            const menuStr = data.filter((m:any) => m.name).map((m: any) => `${m.name}(${m.price}원)`).join(", ");
            text = `최종 메뉴판 등록: ${menuStr}`;
        }

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/situation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, store: storeName }),
            });
            if (response.ok) {
                alert("교정된 지식이 성공적으로 저장되었습니다! 🎉");
                if (type === 'StoreConfig') setStoreData(null);
                else setMenuData([]);
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert(`전송 실패: ${errorData.detail || '서버 응답 오류'}`);
            }
        } catch (err) {
            console.error("Save failed:", err);
            alert("서버 연결에 실패했습니다. 백엔드 서버가 실행 중인지 확인해 주세요.");
        }
    };

    return (
        <div className="admin-page animate-fade-in sm-setup">
            <header className="page-header">
                <h2>📋 AI 분석 결과 교정 및 전송</h2>
                <p>AI가 분석한 내용을 점주님이 직접 확인하고 맞춤법/오타를 수정한 뒤 시스템에 전송하세요.</p>
            </header>

            <div className="setup-grid">
                {/* 1. 사업자등록증 검수 */}
                <div className="glass-panel setup-card">
                    <div className="card-header">
                        <div className="icon">📝</div>
                        <h3>사업자 정보 정밀 교정</h3>
                    </div>
                    <div className="upload-area">
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => e.target.files?.[0] && requestRealAIAnalysis('reg', e.target.files[0])} />
                        {storeData ? (
                            <div className="ocr-result edit-mode animate-fade-in">
                                <div className="result-field highlight">
                                    <label>상호명 (정확하게 교정해주세요)</label>
                                    <input value={storeData.brand} onChange={(e) => handleStoreChange('brand', e.target.value)} placeholder="상호명 입력" />
                                </div>
                                <div className="result-field highlight">
                                    <label>사업자등록번호</label>
                                    <input value={storeData.regNo} onChange={(e) => handleStoreChange('regNo', e.target.value)} placeholder="000-00-00000" />
                                </div>
                                <div className="result-field highlight">
                                    <label>사업장 주소</label>
                                    <input value={storeData.address} onChange={(e) => handleStoreChange('address', e.target.value)} placeholder="전체 주소 입력" />
                                </div>
                                <div className="result-field highlight">
                                    <label>대표자명</label>
                                    <input value={storeData.owner} onChange={(e) => handleStoreChange('owner', e.target.value)} placeholder="성함 입력" />
                                </div>
                                <button className="confirm-btn premium-orange" onClick={() => saveToPool('StoreConfig', storeData)}>수정 완료 및 매장 정보 전송</button>
                                <button className="retry-btn" onClick={() => setStoreData(null)}>다시 스캔하기</button>
                            </div>
                        ) : (
                            <div className="upload-placeholder pulse-border" onClick={() => fileInputRef.current?.click()}>
                                {uploadingReg ? (
                                    <div className="spinner">🚀 AI가 {selectedFile} 분석 중...</div>
                                ) : (
                                    <div className="up-msg">
                                        <div className="up-icon">📂</div>
                                        <p>사업자등록증 사진 선택</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. 메뉴판 리스트 교정 */}
                <div className="glass-panel setup-card">
                    <div className="card-header">
                        <div className="icon">🏷️</div>
                        <h3>메뉴 및 가격 교정</h3>
                    </div>
                    <div className="upload-area">
                        <input type="file" ref={menuInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => e.target.files?.[0] && requestRealAIAnalysis('menu', e.target.files[0])} />
                        {menuData.length > 0 ? (
                            <div className="ocr-result edit-mode animate-fade-in">
                                <div className="menu-edit-container">
                                    {menuData.map((m, idx) => (
                                        <div key={idx} className="menu-edit-row premium">
                                            <input className="edit-name" value={m.name} placeholder="메뉴명" onChange={(e) => handleMenuChange(idx, 'name', e.target.value)} />
                                            <input className="edit-price" value={m.price} placeholder="가격" onChange={(e) => handleMenuChange(idx, 'price', e.target.value)} />
                                            <button className="del-btn" onClick={() => removeMenuItem(idx)}>×</button>
                                        </div>
                                    ))}
                                </div>
                                <div className="edit-actions">
                                    <button className="add-item-btn" onClick={addMenuItem}>+ 메뉴 추가</button>
                                    <button className="confirm-btn success-green" onClick={() => saveToPool('Menus', menuData)}>최종 메뉴판 지식 전송</button>
                                </div>
                            </div>
                        ) : (
                            <div className="upload-placeholder pulse-border" onClick={() => menuInputRef.current?.click()}>
                                {uploadingMenu ? (
                                    <div className="spinner">🧠 {selectedFile} 분석 중...</div>
                                ) : (
                                    <div className="up-msg">
                                        <div className="up-icon">📸</div>
                                        <p>메뉴판 사진 선택</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
