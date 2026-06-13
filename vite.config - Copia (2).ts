import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


function desktopHtmlPrune() {
  return {
    name: 'smarttech-desktop-html-prune',
    transformIndexHtml(html: string) {
      // Desktop/Tauri oficial é offline local. Remove heranças Web/PWA do HTML final
      // para evitar service worker, manifest e cache web dentro do pacote MSI.
      return html
        .replace(/\s*<link\s+rel=["']manifest["'][^>]*>\s*/gi, '\n')
        .replace(/\s*<link\s+rel=["']apple-touch-icon["'][^>]*>\s*/gi, '\n')
        .replace(/\s*<meta\s+name=["'](?:mobile-web-app-capable|apple-mobile-web-app-capable|apple-mobile-web-app-status-bar-style|apple-mobile-web-app-title|application-name|msapplication-TileColor|msapplication-config|apple-touch-fullscreen)["'][^>]*>\s*/gi, '\n');
    },
  };
}

export default defineConfig(({ mode }) => {
  // mode=desktop será usado pelo Tauri (npm run dev:desktop / build:desktop)
  const isDesktop = mode === 'desktop';

  return {
    // No Desktop/Tauri, usa assets mínimos para impedir que public/sw.js,
    // manifest PWA, _headers e arquivos Web antigos entrem no MSI.
    publicDir: isDesktop ? 'public-desktop' : 'public',
    server: {
      // Web/mobile: expõe na rede (para testar no celular)
      // Desktop/Tauri: só localhost (mais seguro, evita problemas de CORS)
      host: isDesktop ? '127.0.0.1' : '0.0.0.0',
      port: 5173,
      // Tauri precisa porta fixa (não pode "tentar outra")
      strictPort: isDesktop,
    },
    build: {
      minify: isDesktop ? 'esbuild' : 'terser',
      terserOptions: {
        compress: {
          drop_console: false, // Não remover TODOS os console (manter error/warn)
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'], // Remove apenas log/info/debug (mantém error/warn)
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
      chunkSizeWarningLimit: 1000, // Aumentar limite de warning
    },
    plugins: [
      react(),
      isDesktop && desktopHtmlPrune(),
      // PWA/Service Worker apenas no build Web.
      // Desktop/Tauri oficial é offline local e não deve gerar SW/cache web.
      !isDesktop && VitePWA({
        registerType: 'prompt',
        strategies: 'generateSW', // Usar generateSW para melhor controle
        includeAssets: [
          'favicon.ico',
          'icons/favicon-16.png',
          'icons/favicon-32.png',
          'icons/apple-touch-icon.png',
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/icon-192-maskable.png',
          'icons/icon-512-maskable.png',
          'screenshot-desktop.png',
          'screenshot-mobile.png',
        ],
        manifest: {
          id: '/',
          name: 'Smart Tech - Sistema de Gestão',
          short_name: 'SmartTech',
          description: 'Sistema de gestão financeira e controle de vendas',
          theme_color: '#4CAF50',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          categories: ['business', 'finance', 'productivity'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            {
              name: 'Nova Venda',
              short_name: 'Venda',
              description: 'Criar nova venda rapidamente',
              url: '/vendas?action=new',
              icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
            },
            {
              name: 'Nova Ordem',
              short_name: 'OS',
              description: 'Criar nova ordem de serviço',
              url: '/ordens?action=new',
              icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
            },
          ],
          screenshots: [
            {
              src: 'screenshot-desktop.png',
              sizes: '1280x720',
              type: 'image/png',
              form_factor: 'wide',
              label: 'Smart Tech - Desktop',
            },
            {
              src: 'screenshot-mobile.png',
              sizes: '750x1334',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Smart Tech - Mobile',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB (para permitir ícones grandes)
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/_/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 ano
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 5, // 5 minutos
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
                networkTimeoutSeconds: 3,
              },
            },
          ],
          // Em conjunto com registerType: 'prompt' + registerSW no main.tsx
          // para o usuário aplicar update quando quiser (evita "não aparece no deploy").
          skipWaiting: false,
          // Quando o usuário clicar "Atualizar agora" (SKIP_WAITING),
          // o SW novo deve assumir o controle imediatamente.
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          navigationPreload: false,
          // Desabilitar logs de dev apenas em produção
          disableDevLogs: process.env.NODE_ENV === 'production',
        },
        devOptions: {
          enabled: false,
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        ...(isDesktop ? { 'virtual:pwa-register': path.resolve(__dirname, './src/lib/pwa-register-desktop-shim.ts') } : {}),
      },
    },
    define: {
      __SMARTTECH_DESKTOP__: JSON.stringify(isDesktop),
    },
  };
});
