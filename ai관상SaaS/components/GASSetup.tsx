import React, { useState, useEffect } from 'react';
import { Settings, X, Copy, Lock } from 'lucide-react';

interface GASSetupProps {
  scriptUrl: string;
  setScriptUrl: (url: string) => void;
}

const GASSetup: React.FC<GASSetupProps> = ({ scriptUrl, setScriptUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [inputUrl, setInputUrl] = useState(scriptUrl);

  // Sync internal state if prop changes
  useEffect(() => {
    setInputUrl(scriptUrl);
  }, [scriptUrl]);

  const handleOpen = () => {
    setIsOpen(true);
    setIsAuthenticated(false); // Reset auth on open
    setPassword('');
    setErrorMsg('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1234') {
      setIsAuthenticated(true);
      setErrorMsg('');
    } else {
      setErrorMsg('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleSave = () => {
    setScriptUrl(inputUrl);
    setIsOpen(false);
  };

  const codeSnippet = `
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // Header check
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "AnimalType", "Score", "Wealth", "Advice", "Source"]);
    }

    sheet.appendRow([
      new Date(),
      data.animalType,
      data.score,
      data.wealth,
      data.advice,
      data.source
    ]);

    return ContentService.createTextOutput(JSON.stringify({"result":"success"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({"result":"error", "error": e}))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;

  return (
    <>
      <button 
        onClick={handleOpen}
        className="fixed top-4 right-4 z-50 p-2 text-gray-500 hover:text-white transition-colors"
      >
        <Settings size={20} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 text-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-700 shadow-2xl relative">
            <button 
              onClick={() => setIsOpen(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>

            {!isAuthenticated ? (
              // Login View
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-[#d4af37]">
                  <Lock size={32} />
                </div>
                <h2 className="text-xl font-bold mb-2">관리자 설정</h2>
                <p className="text-gray-400 text-sm mb-6">설정을 변경하려면 비밀번호를 입력하세요.</p>
                
                <form onSubmit={handleLogin} className="space-y-4">
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-center text-white focus:border-[#d4af37] outline-none"
                    placeholder="비밀번호"
                    autoFocus
                  />
                  {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
                  
                  <button 
                    type="submit"
                    className="w-full bg-[#d4af37] text-black font-bold py-3 rounded-lg hover:bg-[#b5952f] transition-colors"
                  >
                    확인
                  </button>
                </form>
              </div>
            ) : (
              // Settings View
              <div className="p-6">
                <div className="border-b border-gray-700 pb-4 mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <span className="text-[#d4af37]">구글 시트 연동 설정</span>
                  </h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Google Apps Script Web App URL</label>
                    <input 
                      type="text" 
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-sm focus:border-[#d4af37] outline-none"
                    />
                  </div>

                  <div className="bg-gray-800 p-4 rounded-lg text-sm space-y-3">
                    <h3 className="font-bold text-[#d4af37]">연동 방법 (How to setup):</h3>
                    <ol className="list-decimal pl-5 space-y-2 text-gray-300">
                      <li>새 구글 스프레드시트를 생성합니다.</li>
                      <li><b>확장 프로그램 &gt; Apps Script</b> 클릭.</li>
                      <li>아래 코드를 `Code.gs`에 붙여넣기.</li>
                      <li><b>배포 &gt; 새 배포</b> &gt; 유형: <b>웹 앱</b>.</li>
                      <li>액세스 권한: <b>모든 사용자</b> (필수).</li>
                      <li>생성된 URL을 위 칸에 입력.</li>
                    </ol>
                  </div>

                  <div className="relative group">
                     <pre className="bg-black p-4 rounded border border-gray-700 text-xs overflow-x-auto text-green-400 font-mono">
                      {codeSnippet}
                    </pre>
                    <button 
                      onClick={() => navigator.clipboard.writeText(codeSnippet)}
                      className="absolute top-2 right-2 p-2 bg-gray-700 rounded hover:bg-gray-600"
                      title="코드 복사"
                    >
                      <Copy size={14}/>
                    </button>
                  </div>

                  <button 
                    onClick={handleSave}
                    className="w-full bg-[#d4af37] text-black font-bold py-3 rounded-lg hover:bg-[#b5952f] transition-colors"
                  >
                    설정 저장하기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default GASSetup;