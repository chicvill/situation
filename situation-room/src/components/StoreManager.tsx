import React, { useState, useEffect } from 'react';
import type { BundleData } from '../types';
import { useImageScan, ScanningOverlay, ScanChoiceModal } from '../hooks/useImageScan';

interface StoreManagerProps {
  bundles: BundleData[];
  onNavigate: (mode: any, tab?: any) => void;
  storeName: string;
}

export const StoreManager: React.FC<StoreManagerProps> = ({ bundles, onNavigate, storeName }) => {
  const [storeData, setStoreData] = useState<any>({
    brand: '', regNo: '', address: '', owner: '', bankName: '', accountNo: '', accountHolder: '', bundleId: null
  });

  useEffect(() => {
    const storeBundle = bundles.find(b => b.type === 'StoreConfig' && (b.store === storeName || !b.store));
    if (storeBundle) {
      const findValue = (keys: string[]) => storeBundle.items.find((i: any) => keys.some(k => i.name.includes(k)))?.value || '';
      setStoreData({
        brand:    findValue(['상호', '브랜드', 'brand']),
        regNo:    findValue(['사업자', '번호', 'reg']),
        address:  findValue(['주소', '위치', 'address']),
        owner:    findValue(['대표', '이름', 'owner', '점주']),
        bankName: findValue(['은행']),
        accountNo: findValue(['계좌', '번호']),
        accountHolder: findValue(['예금주']),
        bundleId: storeBundle.id
      });
    }
  }, [bundles]);

    const handleSave = async (dataToSave?: any) => {
    const activeData = dataToSave || storeData;
    const items = [
      { name: '상호명',     value: activeData.brand },
      { name: '사업자번호', value: activeData.regNo },
      { name: '주소',       value: activeData.address },
      { name: '대표자',     value: activeData.owner },
      { name: '은행명',     value: activeData.bankName },
      { name: '계좌번호',   value: activeData.accountNo },
      { name: '예금주',     value: activeData.accountHolder },
    ].filter(i => i.value);


    const bundleId = activeData.bundleId || 'store-1';

    try {
      const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
      const response = await fetch(`${apiUrl}/api/bundle/${bundleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, type: 'StoreConfig', title: '매장 정보', store: storeName }),
      });
      if (response.ok) {
        alert('✅ 매장 정보가 성공적으로 저장되었습니다.');
        onNavigate('admin', 'dashboard');
      } else throw new Error('Server error');
    } catch {
      alert('❌ 저장 중 오류가 발생했습니다.');
    }
  };

  const handleResetPool = async () => {
    if (window.confirm("⚠️ 지식창고를 초기화하시겠습니까?\n이 작업은 모든 메뉴, 주문, 로그 데이터를 영구적으로 삭제하며 되돌릴 수 없습니다.")) {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
            await fetch(`${apiUrl}/api/pool?store=${encodeURIComponent(storeName)}`, { method: 'DELETE' });
            alert('✅ 지식창고가 초기화되었습니다.');
            window.location.reload();
        } catch {
            alert('❌ 초기화 중 오류가 발생했습니다.');
        }
    }
  };

  const { 
    isScanning, 
    showChoiceModal, 
    setShowChoiceModal,
    fileInputRef, 
    startScanFlow, 
    proceedToPickFile,
    handleFileChange 
  } = useImageScan({
    docType: 'reg',
    onSuccess: (result, _overwrite) => {
      setStoreData((prev: any) => ({
        ...prev,
        brand:   result.brand   || prev.brand,
        regNo:   result.regNo   || prev.regNo,
        address: result.address || prev.address,
        owner:   result.owner   || prev.owner,
      }));
      alert('✅ 사진 속 정보를 읽어왔습니다!\n오탈자가 없는지 확인하신 후 하단의 "저장" 버튼을 눌러주세요.');
    },
  });

  const handleChange = (field: string, value: string) => {
    setStoreData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="admin-page animate-fade-in">
      <ScanningOverlay isScanning={isScanning} docType="reg" />
      <ScanChoiceModal 
        show={showChoiceModal} 
        onClose={() => setShowChoiceModal(false)} 
        onChoice={proceedToPickFile}
        title="사업자등록증 분석 및 업데이트"
        docType="reg"
      />
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
            <h2>🏬 매장 정보 관리</h2>
        </div>
        <div className="header-actions" style={{ marginBottom: '5px', display: 'flex', gap: '10px' }}>
            <button className="confirm-btn" style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444' }} onClick={handleResetPool}>
                🧹 지식창고 초기화
            </button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
            <button className="confirm-btn premium-orange" onClick={startScanFlow} disabled={isScanning}>
                {isScanning ? '🧠 AI 분석 중...' : '📄 사업자 등록증 스캔 등록'}
            </button>
        </div>
      </header>

      <div className="admin-form-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="ocr-result edit-mode animate-fade-in">
          <div className="admin-form-group">
            <label className="admin-form-label">상호명</label>
            <input 
              className="admin-form-input"
              value={storeData.brand} 
              onChange={(e) => handleChange('brand', e.target.value)} 
              placeholder="상호명 입력" 
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">사업자등록번호</label>
            <input 
              className="admin-form-input"
              value={storeData.regNo} 
              onChange={(e) => handleChange('regNo', e.target.value)} 
              placeholder="000-00-00000" 
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">사업장 주소</label>
            <input 
              className="admin-form-input"
              value={storeData.address} 
              onChange={(e) => handleChange('address', e.target.value)} 
              placeholder="전체 주소 입력" 
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">대표자명</label>
            <input 
              className="admin-form-input"
              value={storeData.owner} 
              onChange={(e) => handleChange('owner', e.target.value)} 
              placeholder="성함 입력" 
            />
          </div>

          <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <h3 style={{ color: 'var(--accent-orange)', marginBottom: '15px', fontSize: '1.1rem' }}>🏦 입금 계좌 설정 (계좌이체용)</h3>
            <div className="admin-form-group">
                <label className="admin-form-label">은행명</label>
                <input 
                    className="admin-form-input"
                    value={storeData.bankName} 
                    onChange={(e) => handleChange('bankName', e.target.value)} 
                    placeholder="예: 국민은행" 
                />
            </div>
            <div className="admin-form-group">
                <label className="admin-form-label">계좌번호</label>
                <input 
                    className="admin-form-input"
                    value={storeData.accountNo} 
                    onChange={(e) => handleChange('accountNo', e.target.value)} 
                    placeholder="하이픈(-) 포함 입력" 
                />
            </div>
            <div className="admin-form-group">
                <label className="admin-form-label">예금주</label>
                <input 
                    className="admin-form-input"
                    value={storeData.accountHolder} 
                    onChange={(e) => handleChange('accountHolder', e.target.value)} 
                    placeholder="예금주명 입력" 
                />
            </div>
          </div>

          <button className="premium-btn success-green" onClick={() => handleSave()} style={{ width: '100%', marginTop: '20px' }}>
            💾 저장 및 적용
          </button>
        </div>
      </div>
    </div>
  );
};
