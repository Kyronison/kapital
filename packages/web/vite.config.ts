import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // HTTP-API аккаунтов идёт через Vite на игровой сервер: cookie сессии остаётся на одном адресе
  server: { port: 5173, proxy: { '/api': 'http://localhost:2567' } },
});
