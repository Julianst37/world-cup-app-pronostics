import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Plugin que reemplaza los placeholders del Service Worker con los valores del .env
function swEnvPlugin() {
  return {
    name: 'sw-env-replace',
    // En dev: sirve el SW con los valores reemplazados on-the-fly
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/firebase-messaging-sw.js') return next();
        const env = loadEnv(server.config.mode, process.cwd(), '');
        const swPath = path.resolve(__dirname, 'public/firebase-messaging-sw.js');
        let content = fs.readFileSync(swPath, 'utf-8');
        Object.keys(env).forEach((key) => {
          content = content.replaceAll(`__${key}__`, env[key]);
        });
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Service-Worker-Allowed', '/');
        res.end(content);
      });
    },
    // En build: genera el SW con los valores ya reemplazados
    closeBundle() {
      const env = loadEnv('production', process.cwd(), '');
      const src = path.resolve(__dirname, 'public/firebase-messaging-sw.js');
      const dest = path.resolve(__dirname, 'dist/firebase-messaging-sw.js');
      let content = fs.readFileSync(src, 'utf-8');
      Object.keys(env).forEach((key) => {
        content = content.replaceAll(`__${key}__`, env[key]);
      });
      fs.writeFileSync(dest, content);
    },
  };
}

export default defineConfig({
  plugins: [react(), swEnvPlugin()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
