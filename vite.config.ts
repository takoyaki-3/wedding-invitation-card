import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnvironment } from './config/environment';
import { existsSync, readdirSync } from 'node:fs';

const photoDirectory = new URL('./public/photo/', import.meta.url);
const couplePhotos = existsSync(photoDirectory)
  ? readdirSync(photoDirectory, { withFileTypes: true })
    .filter(file => file.isFile() && /\.(jpe?g|png|webp|avif)$/i.test(file.name))
    .map(file => file.name).sort().map(name => `/photo/${encodeURIComponent(name)}`)
  : [];

export default defineConfig(() => ({
  plugins: [react()],
  define: {
    __WEDDING_CONFIG__: JSON.stringify(loadEnvironment().wedding),
    __COUPLE_PHOTOS__: JSON.stringify(couplePhotos),
    __PROFILE_PHOTOS__: JSON.stringify(Object.fromEntries(['bride', 'groom'].map(role => {
      const directory = new URL(`./public/${role}/`, import.meta.url);
      const photos = existsSync(directory) ? readdirSync(directory, { withFileTypes: true })
        .filter(file => file.isFile() && /\.(jpe?g|png|webp|avif)$/i.test(file.name))
        .map(file => file.name).sort().map(name => `/${role}/${encodeURIComponent(name)}`) : [];
      return [role, photos];
    })))
  }
}));
