import React, { useState, useRef } from 'react';
import { logger } from '../utils/logger';
import { API_BASE } from '../config';

interface ScanResult {
    [key: string]: any;
}

interface UseImageScanOptions {
    docType: 'menu' | 'reg';
    onSuccess: (result: ScanResult, overwrite: boolean) => void;
}

// ─── Shared Scanning Hook ─────────────────────────────────────────────────────
export const useImageScan = ({ docType, onSuccess }: UseImageScanOptions) => {
    const [isScanning, setIsScanning] = useState(false);
    const [showChoiceModal, setShowChoiceModal] = useState(false);
    const [overwriteMode, setOverwriteMode] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const startScanFlow = () => {
        logger.info(`[Scan] 사용자가 ${docType === 'reg' ? '사업자등록증' : '메뉴판'} 스캔을 시작했습니다.`);
        setShowChoiceModal(true);
    };

    const proceedToPickFile = (replace: boolean) => {
        logger.info(`[Scan] 반영 모드 결정: ${replace ? '전체 교체' : '목록 추가'}`);
        setOverwriteMode(replace);
        setShowChoiceModal(false);
        setTimeout(() => {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
                fileInputRef.current.click();
            }
        }, 100);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            logger.warn('[Scan] 파일 선택이 취소되었습니다.');
            return;
        }

        logger.info(`[Scan] 파일 업로드 준비: ${file.name} (${Math.round(file.size/1024)}KB)`);
        setIsScanning(true);
        await new Promise<void>(resolve => setTimeout(resolve, 300));

        const formData = new FormData();
        formData.append('file', file);

        try {
            logger.info('[Scan] AI 서버로 이미지 전송 중...');
            const response = await fetch(
                `${API_BASE}/api/analyze-image?doc_type=${docType}`,
                { method: 'POST', body: formData }
            );

            if (!response.ok) throw new Error(`서버 오류: ${response.status}`);
            
            const result = await response.json();
            logger.success('[Scan] 서버로부터 데이터 수신 성공');

            if (result.error) {
                logger.error(`[Scan] AI 엔진 오류: ${result.error}`);
                alert(`❌ AI 분석 오류:\n${result.error}`);
                return;
            }

            logger.info(`[Scan] 추출 데이터: ${JSON.stringify(result).substring(0, 50)}...`);
            onSuccess(result, overwriteMode);
            
        } catch (err: any) {
            logger.error(`[Scan] 네트워크 또는 런타임 오류: ${err.message}`);
            alert(`이미지 분석 중 오류가 발생했습니다.\n${err.message}`);
        } finally {
            setIsScanning(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return { 
        isScanning, 
        showChoiceModal, 
        setShowChoiceModal,
        fileInputRef, 
        startScanFlow, 
        proceedToPickFile,
        handleFileChange 
    };
};

// ─── Shared Scanning Overlay ──────────────────────────────────────────────────
export const ScanningOverlay: React.FC<{ isScanning: boolean; docType: 'menu' | 'reg' }> = ({ isScanning, docType }) => {
    if (!isScanning) return null;

    const info = {
        reg:  { icon: '📄', title: '사업자등록증 정밀 독해 중', sub: '상호, 번호, 주소를 디지털화 하고 있습니다...' },
        menu: { icon: '🍽️', title: '메뉴 리스트 자동 추출 중', sub: '메뉴명과 가격을 지식 풀로 변환 중입니다...' },
    };
    const { icon, title, sub } = info[docType];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10001,
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '30px', color: 'white'
        }}>
            <div style={{ fontSize: '5rem', animation: 'spin-pulse 2s infinite ease-in-out' }}>{icon}</div>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f97316', margin: 0 }}>{title}</h2>
                <p style={{ fontSize: '1.2rem', color: '#94a3b8', marginTop: '10px' }}>{sub}</p>
            </div>
            <div className="premium-loader" style={{ width: '300px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#f97316', width: '50%', animation: 'loading-move 1.5s infinite linear' }} />
            </div>
            <style>{`
                @keyframes spin-pulse { 0% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.1) rotate(180deg); } 100% { transform: scale(1) rotate(360deg); } }
                @keyframes loading-move { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
            `}</style>
        </div>
    );
};

// ─── Shared Choice Modal ─────────────────────────────────────────────────────
interface ChoiceModalProps {
    show: boolean;
    onClose: () => void;
    onChoice: (replace: boolean) => void;
    title: string;
    docType: 'menu' | 'reg';
}

export const ScanChoiceModal: React.FC<ChoiceModalProps> = ({ show, onClose, onChoice, title, docType }) => {
    if (!show) return null;

    const isMenu = docType === 'menu';

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div className="glass-panel animate-pop-in" style={{ 
                maxWidth: '500px', width: '100%', padding: '40px', textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.1)', background: '#0f172a',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '20px' }}>{isMenu ? '🍽️' : '📄'}</div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white', marginBottom: '15px' }}>{title}</h2>
                <p style={{ color: '#94a3b8', marginBottom: '35px', lineHeight: 1.6, fontSize: '1.05rem' }}>
                    {isMenu 
                        ? '스캔한 메뉴 정보를 어떻게 반영할까요?\n기존 목록을 유지하거나 새로 교체할 수 있습니다.' 
                        : '사진 속 사업자 정보를 읽어와서\n현재 등록된 매장 정보를 업데이트하시겠습니까?'}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                    <button 
                        className="confirm-btn premium-orange" 
                        style={{ flex: 1, minWidth: '200px', padding: '18px', fontSize: '1.1rem', fontWeight: 'bold' }}
                        onClick={() => onChoice(true)}
                    >
                        {isMenu ? '전체 교체 (삭제 후 등록)' : '📄 정보 덮어쓰기'}
                    </button>
                    
                    {isMenu ? (
                        <button 
                            className="confirm-btn success-green" 
                            style={{ flex: 1, minWidth: '200px', padding: '18px', fontSize: '1.1rem', fontWeight: 'bold' }}
                            onClick={() => onChoice(false)}
                        >
                            목록 하단에 추가
                        </button>
                    ) : (
                        <button 
                            className="confirm-btn" 
                            style={{ flex: 1, minWidth: '200px', padding: '18px', fontSize: '1.1rem', fontWeight: 'bold', background: '#334155' }}
                            onClick={onClose}
                        >
                            취소하기
                        </button>
                    )}
                </div>
                {isMenu && (
                    <button onClick={onClose} style={{ marginTop: '30px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}>
                        취소하고 돌아가기
                    </button>
                )}
            </div>
        </div>
    );
};
