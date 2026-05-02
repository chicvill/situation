import React, { useState, useEffect } from 'react';
import type { BundleData } from '../types';
import { useImageScan, ScanningOverlay, ScanChoiceModal } from '../hooks/useImageScan';

import { useStoreFilter } from '../hooks/useStoreFilter';

interface StoreManagerProps {
  bundles: BundleData[];
  onNavigate: (mode: any, tab?: any) => void;
}

export const StoreManager: React.FC<StoreManagerProps> = ({ bundles, onNavigate }) => {
  const { storeId, storeName } = useStoreFilter();
  const [storeData, setStoreData] = useState<any>({
    brand: '', regNo: '', address: '', owner: '', bankName: '', accountNo: '', accountHolder: '', bundleId: null
  });

  useEffect(() => {
    const storeBundle = bundles.find(b => b.type === 'StoreConfig' && (storeId === 'Total' || b.store_id === storeId || !b.store_id));
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
        body: JSON.stringify({ items, type: 'StoreConfig', title: '매장 정보', store: storeName, store_id: storeId }),
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
            await fetch(`${apiUrl}/api/pool?store_id=${encodeURIComponent(storeId)}`, { method: 'DELETE' });
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

  // --- Android Back Button Support ---
  useEffect(() => {
    const handlePopState = () => {
      if (showChoiceModal) {
        setShowChoiceModal(false);
      }
    };
    if (showChoiceModal) {
      window.history.pushState({ modal: 'scan' }, '');
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showChoiceModal, setShowChoiceModal]);

  return (
    <div className="admin-page animate-fade-in" style={{ padding: '40px', background: 'var(--bg-main)', minHeight: '100vh' }}>
      <ScanningOverlay isScanning={isScanning} docType="reg" />
      <ScanChoiceModal 
        show={showChoiceModal} 
        onClose={() => setShowChoiceModal(false)} 
        onChoice={proceedToPickFile}
        title="정보 업데이트"
        docType="reg"
      />
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>매장 설정</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>매장의 공식 정보와 시스템 설정을 관리합니다.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
            <button 
                style={{ 
                    padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--danger)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer'
                }} 
                onClick={handleResetPool}
            >
                시스템 초기화
            </button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleFileChange} />
            <button 
                style={{ 
                    padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none',
                    background: 'var(--primary)', color: 'white', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer'
                }} 
                onClick={startScanFlow} 
                disabled={isScanning}
            >
                {isScanning ? '분석 중...' : '사업자 등록증 스캔'}
            </button>
        </div>
      </header>

      <div style={{ maxWidth: '700px', margin: '0 auto', background: 'var(--surface)', padding: '40px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <div className="ocr-result edit-mode animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>상호명</label>
            <input 
              style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '1rem', outline: 'none' }}
              value={storeData.brand} 
              onChange={(e) => handleChange('brand', e.target.value)} 
              placeholder="상호명 입력" 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>사업자등록번호</label>
            <input 
              style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '1rem', outline: 'none' }}
              value={storeData.regNo} 
              onChange={(e) => handleChange('regNo', e.target.value)} 
              placeholder="000-00-00000" 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>사업장 주소</label>
            <input 
              style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '1rem', outline: 'none' }}
              value={storeData.address} 
              onChange={(e) => handleChange('address', e.target.value)} 
              placeholder="전체 주소 입력" 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>대표자명</label>
            <input 
              style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '1rem', outline: 'none' }}
              value={storeData.owner} 
              onChange={(e) => handleChange('owner', e.target.value)} 
              placeholder="성함 입력" 
            />
          </div>

          <div style={{ marginTop: '20px', padding: '30px', background: 'var(--primary-soft)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ color: 'var(--primary)', margin: 0, fontSize: '1rem', fontWeight: '700' }}>입금 계좌 설정</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>은행명</label>
                <input 
                    style={{ padding: '10px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' }}
                    value={storeData.bankName} 
                    onChange={(e) => handleChange('bankName', e.target.value)} 
                    placeholder="예: 국민은행" 
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>계좌번호</label>
                <input 
                    style={{ padding: '10px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' }}
                    value={storeData.accountNo} 
                    onChange={(e) => handleChange('accountNo', e.target.value)} 
                    placeholder="하이픈(-) 포함 입력" 
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>예금주</label>
                <input 
                    style={{ padding: '10px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' }}
                    value={storeData.accountHolder} 
                    onChange={(e) => handleChange('accountHolder', e.target.value)} 
                    placeholder="예금주명 입력" 
                />
            </div>
          </div>

          <button 
            style={{ 
                width: '100%', marginTop: '10px', padding: '16px', borderRadius: 'var(--radius-sm)', 
                border: 'none', background: 'var(--accent)', color: 'white', fontWeight: '700', fontSize: '1.1rem', cursor: 'pointer' 
            }} 
            onClick={() => handleSave()}
          >
            저장 및 적용하기
          </button>
        </div>
      </div>
    </div>
  );
};
