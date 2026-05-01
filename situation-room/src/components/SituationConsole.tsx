import React, { useState, useRef, useEffect } from 'react';
import './SituationConsole.css';
import type { Message } from '../types';

interface Props {
  messages: Message[];
  onSendMessage: (text: string, targetId?: string) => void;
}

export const SituationConsole: React.FC<Props> = ({ messages, onSendMessage }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Web Speech API 초기화
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'ko-KR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsListening(true);
      } else {
        alert("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 권장합니다.");
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleQuickAction = (action: string) => {
    onSendMessage(action);
  };

  return (
    <div className="glass-panel console-container">
      <div className="messages-area">
        <div className="message ai">
          안녕하세요! 지금 무슨 일이 일어나고 있나요? 상황을 설명해주시거나 아래 버튼을 클릭해주세요.
        </div>
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            {msg.text}
            {msg.selection && (
                <div className="selection-container" style={{ marginTop: '10px' }}>
                    <p style={{ fontSize: '0.9rem', marginBottom: '8px', color: '#94a3b8' }}>{msg.selection.message}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {msg.selection.candidates.map((c: any, idx: number) => (
                            <button key={c.id} className="mode-switch-btn" onClick={() => onSendMessage(msg.text, c.id)}>
                               [{idx + 1}] {c.timestamp} - {c.title} 업데이트
                            </button>
                        ))}
                        <button className="mode-switch-btn" style={{ background: '#10b981' }} onClick={() => onSendMessage(msg.text, "new")}>[+] 새 바구니로 생성</button>
                    </div>
                </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="quick-actions">
        <button className="quick-btn" onClick={() => handleQuickAction('🎉 신규 고객 입장')}>🎉 신규 고객 입장</button>
        <button className="quick-btn" onClick={() => handleQuickAction('☕ 테이블 3번 아메리카노 2잔 주문')}>☕ 아메리카노 주문</button>
        <button className="quick-btn" onClick={() => handleQuickAction('💸 3번 테이블 결제 완료')}>💸 결제 완료</button>
        <button className="quick-btn" onClick={() => handleQuickAction('🤖 [자동 감지] 로스팅 머신 가동 완료')}>🤖 기기 상태 자동 감지</button>
        <button className="quick-btn" onClick={() => handleQuickAction('💨 [단순 보고] 냉장고 문 열림 (휘발성)')}>💨 휘발성 센서 감지</button>
      </div>

      <div className="input-area">
        <button type="button" className={`mic-btn ${isListening ? 'listening' : ''}`} onClick={toggleListening} title="음성으로 입력하기">
          {isListening ? '🎙️' : '🎤'}
        </button>
        <form style={{ display: 'flex', gap: '0.5rem', flex: 1 }} onSubmit={handleSubmit}>
          <input
            type="text"
            className="input-box"
            placeholder="상황을 자연스럽게 입력하세요... (예: 메뉴판 사진 등록해줘)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="send-btn">전송</button>
        </form>
      </div>
    </div>
  );
};
