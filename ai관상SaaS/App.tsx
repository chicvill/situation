
import { useState, useEffect, useCallback } from 'react';
import CameraCapture from './components/CameraCapture';
import ResultCard from './components/ResultCard';
import GASSetup from './components/GASSetup';
import { analyzeFace, checkModelAvailability } from './services/geminiService';
import { logToSheet } from './services/sheetService';
import { AppState, PhysiognomyResult } from './types';
import { Sparkles, ScanFace, Loader2, ShieldCheck, RefreshCw } from 'lucide-react';

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwM4UfTY9a5d-tg-TldreYcndu2Bh8QEoH0HdnVdKkf8trJTGHFp0mxVXr3CjPynSiu/exec"; 

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [result, setResult] = useState<PhysiognomyResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [modelStatus, setModelStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  const [scriptUrl, setScriptUrl] = useState<string>(() => {
    return localStorage.getItem('gas_script_url') || DEFAULT_SCRIPT_URL;
  });

  // API 연결 상태 확인 함수
  const checkStatus = useCallback(async () => {
    setModelStatus('checking');
    const isAvailable = await checkModelAvailability();
    setModelStatus(isAvailable ? 'online' : 'offline');
  }, []);

  useEffect(() => {
    if (scriptUrl) localStorage.setItem('gas_script_url', scriptUrl);
  }, [scriptUrl]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleStart = () => {
    if (modelStatus !== 'online') {
      alert("AI 서비스가 준비되지 않았습니다. 상단 API 상태를 확인해주세요.");
      return;
    }
    setAppState(AppState.CAMERA);
  };

  const handleCapture = async (base64Image: string) => {
    setCapturedImage(base64Image);
    setAppState(AppState.ANALYZING);
    try {
      const data = await analyzeFace(base64Image);
      setResult(data);
      setAppState(AppState.RESULT);
    } catch (error) {
      console.error(error);
      setAppState(AppState.ERROR);
    }
  };

  const handleSaveToSheet = async () => {
    if (result && scriptUrl && !isSaving) {
      setIsSaving(true);
      try {
        await logToSheet(scriptUrl, result);
        setTimeout(() => setIsSaving(false), 1500);
      } catch (err) {
        setIsSaving(false);
        alert("저장 중 오류가 발생했습니다.");
      }
    }
  };

  const resetApp = () => {
    setResult(null);
    setCapturedImage(null);
    setAppState(AppState.HOME);
    setIsSaving(false);
  };

  const containerClass = appState === AppState.RESULT ? "max-w-4xl" : "max-w-lg";

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-4 bg-[#0f0f0f] bg-[url('https://www.toptal.com/designers/subtlepatterns/uploads/paper.png')] bg-repeat overflow-hidden relative">
      
      {/* [UPDATE] API 상태 인디케이터 - 클릭 시 재시도 기능 추가 */}
      <button 
        onClick={checkStatus}
        disabled={modelStatus === 'checking'}
        className={`fixed top-4 right-14 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md transition-all active:scale-95 ${
          modelStatus === 'checking' ? 'opacity-50' : 'hover:bg-white/5 cursor-pointer'
        }`}
        title="클릭하여 API 상태 재확인"
      >
        <div className={`w-2 h-2 rounded-full ${
          modelStatus === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 
          modelStatus === 'offline' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse' : 
          'bg-yellow-500 animate-spin'
        }`} />
        <span className="text-[10px] font-bold tracking-tighter text-gray-300 uppercase flex items-center gap-1">
          {modelStatus === 'online' ? 'Gemini AI Online' : 
           modelStatus === 'offline' ? 'Connect Error (Retry)' : 
           'Checking...'}
          {modelStatus === 'offline' && <RefreshCw size={10} />}
        </span>
      </button>

      <GASSetup scriptUrl={scriptUrl} setScriptUrl={setScriptUrl} />

      <main className={`w-full ${containerClass} max-h-full flex flex-col relative z-10 transition-all duration-700`}>
        
        {appState !== AppState.RESULT && (
          <header className="text-center mb-6 flex flex-col items-center animate-fade-in flex-shrink-0">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 backdrop-blur-md">
                <ScanFace className="text-[#d4af37]" size={32} />
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#f3e5ab] to-[#d4af37] serif drop-shadow-lg">
                AI 관상가
              </h1>
            </div>
            <p className="text-[#d4af37]/60 text-xs font-medium tracking-[0.3em] serif uppercase">
              Physiognomy Intelligence
            </p>
          </header>
        )}

        <div className="flex-1 flex flex-col justify-center overflow-hidden">
          
          {appState === AppState.HOME && (
            <div className="text-center space-y-6 animate-fade-in flex-shrink-0">
              <div className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl shadow-2xl mx-4">
                <p className="text-lg text-gray-200 leading-relaxed mb-8 serif break-keep">
                  찰나의 인상에 깃든 <span className="text-[#d4af37] font-bold">운명의 흐름</span>을<br/>
                  최첨단 인공지능의 눈으로 통찰합니다.
                </p>
                
                <button 
                  onClick={handleStart}
                  className={`group relative inline-flex items-center justify-center px-10 py-5 font-black text-black transition-all duration-300 bg-gradient-to-r from-[#d4af37] to-[#f3e5ab] rounded-2xl shadow-[0_0_30px_rgba(212,175,55,0.3)] ${
                    modelStatus === 'online' ? 'hover:scale-105 active:scale-95' : 'opacity-50 grayscale cursor-not-allowed'
                  }`}
                >
                  <span className="relative flex items-center gap-3 text-xl">
                    {modelStatus === 'online' ? '운명 확인하기' : 'API 확인 중...'} 
                    <Sparkles size={24} className={modelStatus === 'online' ? "animate-pulse" : ""}/>
                  </span>
                </button>

                <div className="mt-8 p-3 bg-[#d4af37]/5 rounded-xl border border-[#d4af37]/20 flex items-center justify-center gap-2">
                  <ShieldCheck className="text-[#d4af37]" size={18} />
                  <p className="text-sm font-bold text-[#f3e5ab] break-keep">
                    분석 후 이미지는 즉시 파기됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {appState === AppState.CAMERA && (
            <div className="h-[500px] w-full shadow-2xl flex-shrink-0">
               <CameraCapture onCapture={handleCapture} onCancel={resetApp} />
            </div>
          )}

          {appState === AppState.ANALYZING && (
            <div className="text-center p-12 rounded-3xl bg-black/50 border border-[#d4af37]/20 backdrop-blur-xl flex-shrink-0">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <Loader2 className="animate-spin text-[#d4af37] absolute inset-0" size={80} />
                <ScanFace className="text-white/20 absolute inset-0 m-auto" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 serif">기운을 살피는 중...</h2>
              <div className="flex justify-center gap-1">
                {[1,2,3].map(i => <div key={i} className="w-2 h-2 bg-[#d4af37] rounded-full animate-bounce" style={{animationDelay: `${i*0.2}s`}}></div>)}
              </div>
            </div>
          )}

          {appState === AppState.RESULT && result && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <ResultCard 
                result={result} 
                userImage={capturedImage}
                onReset={resetApp} 
                onSave={handleSaveToSheet} 
                isSaving={isSaving}
              />
            </div>
          )}

          {appState === AppState.ERROR && (
            <div className="text-center p-10 bg-red-950/30 border border-red-500/50 rounded-3xl backdrop-blur-md flex-shrink-0">
              <h3 className="text-xl text-red-400 font-bold mb-3">인식에 실패하였습니다</h3>
              <p className="text-gray-300 text-sm mb-6">얼굴이 너무 어둡거나 가려져 있지는 않은지 확인해주세요.</p>
              <button onClick={resetApp} className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl transition-all font-bold">
                다시 시도하기
              </button>
            </div>
          )}
        </div>

        {appState !== AppState.RESULT && (
          <footer className="mt-6 text-center text-gray-500 text-[10px] font-medium tracking-widest flex-shrink-0">
            <p>© 2024 AI CONVERGENCE EDUCATION CENTER</p>
          </footer>
        )}
      </main>

      <div className="fixed inset-0 pointer-events-none z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#d4af37] rounded-full mix-blend-soft-light filter blur-[150px] opacity-10"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#8b4513] rounded-full mix-blend-soft-light filter blur-[150px] opacity-10"></div>
      </div>
    </div>
  );
}
