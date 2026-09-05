import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnvironment } from './config/environment';

export default defineConfig(() => ({
  plugins: [react()],
  define: { __WEDDING_CONFIG__: JSON.stringify(loadEnvironment().wedding) }
}));
