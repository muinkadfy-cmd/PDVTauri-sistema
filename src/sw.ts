/// <reference lib="webworker" />

/**
 * ✅ Service Worker único (PWA + Push)
 *
 * Motivo:
 * - Evita conflito entre SW gerado pelo Workbox (generateSW) e um sw.js manual.
 * - Mantém update em modo "prompt" (não força skipWaiting automaticamente).
 * - Não cacheia chamadas do Supabase (evita respostas velhas e bugs de sincronização).
 */

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<any>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// Quando o SW novo for ativado (após SKIP_WAITING), tomar controle imediatamente.
clientsClaim();

// SPA: sempre responder navegações com o index.html precacheado.
try {
  const handler = createHandlerBoundToURL('/index.html');
  registerRoute(new NavigationRoute(handler));
} catch {
  // ignore
}

// Cache leve para Google Fonts (não afeta dados do app)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets'
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 })
    ]
  })
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔔 PUSH NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const NOTIFICATION_TAG_PREFIX = 'smart-tech-notif-';

self.addEventListener('push', (event) => {
  if (!event.data) return;

  event.waitUntil(
    (async () => {
      try {
        const data = event.data?.json?.() ?? {};
        const {
          title = '🔔 Notificação',
          body = '',
          icon = '/icons/icon-512.png',
          badge = '/icons/icon-192.png',
          tag,
          data: notificationData = {},
          requireInteraction = false
        } = data;

        // Tipagem do TS em lib.webworker pode não incluir 'actions' em NotificationOptions.
        // Em runtime, browsers suportam actions em notificações no SW.
        const opts: any = {
          body,
          icon,
          badge,
          tag: tag || NOTIFICATION_TAG_PREFIX + Date.now(),
          data: {
            ...notificationData,
            timestamp: Date.now(),
            clickAction: notificationData?.url || '/'
          },
          requireInteraction,
          silent: false,
          actions: [
            { action: 'open', title: 'Abrir', icon },
            { action: 'close', title: 'Fechar' }
          ]
        };

        await self.registration.showNotification(title, opts);
      } catch {
        await self.registration.showNotification('🔔 Nova Notificação', {
          body: 'Você tem uma nova notificação do Smart Tech PDV',
          icon: '/icons/icon-512.png',
          badge: '/icons/icon-192.png',
          tag: NOTIFICATION_TAG_PREFIX + Date.now()
        });
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const clickAction = (notification as any)?.data?.clickAction || '/';

  notification.close();

  if (action === 'close') return;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          const focused = await (client as WindowClient).focus();
          try {
            if (clickAction && clickAction !== '/') {
              focused.postMessage({
                type: 'NOTIFICATION_CLICK',
                url: clickAction,
                data: (notification as any)?.data
              });
            }
          } catch {
            // ignore
          }
          return;
        }
      }

      await self.clients.openWindow(self.location.origin + clickAction);
    })()
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldSub = (event as any).oldSubscription;
        const key = oldSub?.options?.applicationServerKey;

        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key
        });

        // Endpoint opcional (se você tiver API de push no futuro)
        await fetch('/api/push/update-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint: oldSub?.endpoint,
            newSubscription: newSub.toJSON()
          })
        }).catch(() => undefined);
      } catch {
        // ignore
      }
    })()
  );
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💬 MESSAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

self.addEventListener('message', (event) => {
  // registerType: 'prompt' → só ativa o SW novo quando o app manda esse comando.
  if ((event.data as any)?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
