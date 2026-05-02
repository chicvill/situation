import { useCallback, useRef } from 'react';

/**
 * useAIVoice - 전 페이지 공유 AI 음성 훅
 * - speak(): 텍스트를 한국어로 TTS 출력
 * - startListening(): 한국어 STT 시작 후 결과를 콜백으로 전달
 * - announce(): 페이지 진입 시 AI 브리핑 (첫 인터렉션 후 활성화)
 */

export interface VoiceOptions {
  rate?: number;   // 말하기 속도 (기본값 1.0)
  pitch?: number;  // 음높이 (기본값 1.0)
  lang?: string;   // 언어 (기본값 'ko-KR')
}

export function useAIVoice() {
  const isSpeakingRef = useRef(false);

  /** TTS - 텍스트를 음성으로 읽기 */
  const speak = useCallback((text: string, options?: VoiceOptions) => {
    const win = window as any;
    if (!win.speechSynthesis) return;

    win.speechSynthesis.cancel();
    isSpeakingRef.current = true;

    const utterance = new (win.SpeechSynthesisUtterance || win.webkitSpeechSynthesisUtterance)(
      text.replace(/\[GOTO:\w+\]/g, '').trim()
    );
    utterance.lang = options?.lang ?? 'ko-KR';
    utterance.rate = options?.rate ?? 1.0;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.onend = () => { isSpeakingRef.current = false; };

    win.speechSynthesis.speak(utterance);
  }, []);

  /** STT - 마이크로 음성 인식 후 콜백으로 결과 전달 */
  const startListening = useCallback((onResult: (text: string) => void, onEnd?: () => void) => {
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
    };
    recognition.onend = () => { if (onEnd) onEnd(); };
    recognition.start();
  }, []);

  /** 페이지 진입 브리핑 - 짧은 지연 후 실행 (음성 차단 우회) */
  const announce = useCallback((text: string, delayMs = 800) => {
    setTimeout(() => speak(text), delayMs);
  }, [speak]);

  return { speak, startListening, announce };
}
