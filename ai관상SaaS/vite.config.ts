
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // mode(development/production)에 맞춰 .env 파일을 로드합니다.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    plugins: [react()],
    define: {
      // 빌드 타임에 process.env.API_KEY를 실제 값으로 치환합니다.
      // 값이 없을 경우 빈 문자열을 주입하여 에러를 방지합니다.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY || ''),
    },
    server: {
      port: 5174,
      open: false,
      watch: {
        usePolling: true,
      }
    }
  };
});
