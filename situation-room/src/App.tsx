import { useState } from 'react';
import './App.css';
import { SituationConsole } from './components/SituationConsole';
import { BucketManager } from './components/BucketManager';
import type { Message, BundleData } from './types';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [bundles, setBundles] = useState<BundleData[]>([]);

  const handleSendMessage = async (text: string) => {
    // 1. Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const loadingMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, {
      id: loadingMsgId,
      text: "상황을 분석하고 있습니다... 🧠",
      sender: 'ai',
      timestamp: new Date().toLocaleTimeString(),
    }]);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/api/situation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error('API Error');
      const result = await response.json();

      if (result.type === 'Analysis') {
        // Handle analysis query response
        setMessages((prev) => prev.map(msg => 
          msg.id === loadingMsgId ? { ...msg, text: result.answer } : msg
        ));
      } else {
        // Handle regular situation bundle
        const newBundle: BundleData = result;
        let aiReply = `AI 분석 완료! '${newBundle.title}' 바구니를 생성하여 지식 풀에 저장했습니다. ✨`;
        if (newBundle.title.includes('API 키 필요')) {
           aiReply = `AI 분석기(Gemini)가 연결되지 않아 가짜 바구니를 생성했습니다. 백엔드 코드(.env)에 GEMINI_API_KEY를 넣어주세요! 🔑`;
        }

        setMessages((prev) => prev.map(msg => 
          msg.id === loadingMsgId ? { ...msg, text: aiReply } : msg
        ));

        setBundles((prev) => [newBundle, ...prev]);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => prev.map(msg => 
        msg.id === loadingMsgId 
          ? { ...msg, text: "앗, 백엔드 서버(FastAPI)에 연결할 수 없습니다. 포트 8000번 서버가 켜져 있는지 확인해주세요! 😢" }
          : msg
      ));
    }
  };

  return (
    <div className="app-container">
      <div className="left-panel">
        <div className="header">
          <div className="logo-icon" style={{fontSize: '2rem'}}>🔮</div>
          <div>
            <h1>Situation Room</h1>
            <p>상황 지능형 엔진 대시보드</p>
          </div>
        </div>
        <SituationConsole messages={messages} onSendMessage={handleSendMessage} />
      </div>
      
      <div className="right-panel">
        <div className="header">
          <div className="logo-icon" style={{fontSize: '2rem'}}>📦</div>
          <div>
            <h1>Dynamic Bundles</h1>
            <p>AI가 동적으로 생성한 상황 바구니</p>
          </div>
        </div>
        <BucketManager bundles={bundles} />
      </div>
    </div>
  );
}

export default App;
