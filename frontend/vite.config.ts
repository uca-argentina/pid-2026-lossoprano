import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(() => {
  if (process.env.VERCEL) {
    let valido = false;
    try {
      const url = new URL(process.env.VITE_API_URL ?? '');
      valido =
        url.protocol === 'https:' &&
        /\/api\/?$/.test(url.pathname) &&
        !url.search &&
        !url.hash &&
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch {
      /* Missing or invalid URL. */
    }
    if (!valido)
      throw new Error(
        'Set VITE_API_URL to the deployed backend HTTPS URL ending in /api.',
      );
  }
  return { plugins: [react()] };
});
