/**
 * 🔔 SERVICE WORKER - PUSH NOTIFICATIONS
 * Smart Tech PDV - Sistema profissional de notificações
 * 
 * Suporta:
 * - Push Notifications (Web, Android, iOS 16.4+)
 * - Offline caching (Workbox)
 * - Notificação click → redirect inteligente
 */

// Importar Workbox (se estiver usando Vite PWA plugin)
if (typeof importScripts === 'function') {
  // Workbox será injetado automaticamente pelo Vite PWA
}

const NOTIFICATION_TAG_PREFIX = 'smart-tech-notif-';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔔 PUSH EVENT - Receber notificação
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

self.addEventListener('push', (event) => {
  console.log('[SW] 📨 Push recebido:', event);

  if (!event.data) {
    console.warn('[SW] Push sem dados');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW] Dados do push:', data);

    const {
      title = '🔔 Notificação',
      body = '',
      icon = '/pwa-512x512.png',
      badge = '/pwa-192x192.png',
      tag,
      data: notificationData = {},
      requireInteraction = false
    } = data;

    const options = {
      body,
      icon,
      badge,
      tag: tag || NOTIFICATION_TAG_PREFIX + Date.now(),
      data: {
        ...notificationData,
        timestamp: Date.now(),
        clickAction: notificationData.url || '/'
      },
      requireInteraction,
      // Configurações para melhor visibilidade
      silent: false,
      actions: [
        {
          action: 'open',
          title: 'Abrir',
          icon: icon
        },
        {
          action: 'close',
          title: 'Fechar'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
        .then(() => {
          console.log('[SW] ✅ Notificação exibida:', title);
        })
        .catch((error) => {
          console.error('[SW] ❌ Erro ao exibir notificação:', error);
        })
    );
  } catch (error) {
    console.error('[SW] ❌ Erro ao processar push:', error);
    
    // Fallback: mostrar notificação genérica
    event.waitUntil(
      self.registration.showNotification('🔔 Nova Notificação', {
        body: 'Você tem uma nova notificação do Smart Tech PDV',
        icon: '/pwa-512x512.png',
        badge: '/pwa-192x192.png',
        tag: NOTIFICATION_TAG_PREFIX + Date.now()
      })
    );
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👆 NOTIFICATION CLICK - Redirecionar ao clicar
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 👆 Notificação clicada:', event);

  const notification = event.notification;
  const action = event.action;
  const clickAction = notification.data?.clickAction || '/';

  notification.close();

  // Se ação for "close", apenas fecha
  if (action === 'close') {
    return;
  }

  // Abrir ou focar janela existente
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        console.log('[SW] Clientes encontrados:', clientList.length);

        // Tentar focar janela existente com mesma origin
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            console.log('[SW] ✅ Focando janela existente:', client.url);
            return client.focus().then((focusedClient) => {
              // Navegar para URL da notificação
              if (clickAction && clickAction !== '/') {
                focusedClient.postMessage({
                  type: 'NOTIFICATION_CLICK',
                  url: clickAction,
                  data: notification.data
                });
              }
              return focusedClient;
            });
          }
        }

        // Se não houver janela aberta, abrir nova
        console.log('[SW] 🆕 Abrindo nova janela:', clickAction);
        return clients.openWindow(self.location.origin + clickAction);
      })
      .catch((error) => {
        console.error('[SW] ❌ Erro ao processar clique:', error);
      })
  );
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📢 PUSH SUBSCRIPTION CHANGE - Lidar com mudanças de subscription
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] 🔄 Push subscription alterada:', event);

  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey
    })
      .then((newSubscription) => {
        console.log('[SW] ✅ Nova subscription criada:', newSubscription);
        
        // Enviar nova subscription para o servidor
        return fetch('/api/push/update-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription?.endpoint,
            newSubscription: newSubscription.toJSON()
          })
        });
      })
      .catch((error) => {
        console.error('[SW] ❌ Erro ao renovar subscription:', error);
      })
  );
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💬 MESSAGE - Comunicação com cliente
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

self.addEventListener('message', (event) => {
  console.log('[SW] 💬 Mensagem recebida:', event.data);

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: '1.0.0',
      timestamp: Date.now()
    });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔧 INSTALL & ACTIVATE - Lifecycle
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

self.addEventListener('install', (event) => {
  console.log('[SW] 📦 Service Worker instalado');
  self.skipWaiting(); // Ativar imediatamente
});

self.addEventListener('activate', (event) => {
  console.log('[SW] ✅ Service Worker ativado');
  event.waitUntil(clients.claim()); // Tomar controle imediatamente
});

console.log('[SW] 🚀 Service Worker carregado - Push Notifications habilitado');
