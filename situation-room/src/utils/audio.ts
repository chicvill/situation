/**
 * Web Audio API 기반 딩동 음 생성 — 외부 URL 불필요, 네트워크 독립적
 * 브라우저 autoplay 정책: 사용자 인터랙션 후에는 항상 재생 가능
 */
let lastPlayTime = 0;

export function playDingDong(volume = 0.5): void {
    const now = Date.now();
    // 1초 이내에 다시 호출되면 무시 (중복 재생으로 인한 기괴한 소리 방지)
    if (now - lastPlayTime < 1000) return;
    lastPlayTime = now;

    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        const makeBeep = (freq: number, startAt: number, duration: number) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
            gain.gain.setValueAtTime(volume, ctx.currentTime + startAt);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
            osc.start(ctx.currentTime + startAt);
            osc.stop(ctx.currentTime + startAt + duration);
        };

        // 딩 (높은 음) → 동 (낮은 음)
        makeBeep(1200, 0,    0.35);
        makeBeep(900,  0.35, 0.5);
    } catch (_) {}
}
