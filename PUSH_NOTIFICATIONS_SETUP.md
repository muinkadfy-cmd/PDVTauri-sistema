# 🔔 PUSH NOTIFICATIONS - GUIA COMPLETO DE CONFIGURAÇÃO

**Sistema:** Smart Tech PDV  
**Versão:** 1.0.0  
**Data:** 31/01/2026

---

## 📋 **ÍNDICE**

1. [Pré-requisitos](#pré-requisitos)
2. [Gerar VAPID Keys](#1-gerar-vapid-keys)
3. [Configurar Frontend (.env)](#2-configurar-frontend-env)
4. [Configurar Backend (Cloudflare Worker)](#3-configurar-backend-cloudflare-worker)
5. [Testar Sistema](#4-testar-sistema)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 **PRÉ-REQUISITOS**

✅ Node.js instalado (v18+)  
✅ Projeto clonado localmente  
✅ Acesso ao Cloudflare Dashboard  
✅ Dispositivo Android/iOS para testes (opcional)

---

## 1️⃣ **GERAR VAPID KEYS**

### **Passo 1: Instalar web-push (se necessário)**

```bash
npm install -g web-push
# ou usar npx (recomendado)
```

### **Passo 2: Gerar as chaves**

```bash
npx web-push generate-vapid-keys
```

**Output esperado:**

```
=======================================

Public Key:
BKxT7_ABC123XYZ...long_string_here...

Private Key:
xyz789_ABC123...long_string_here...

=======================================
```

### **Passo 3: Salvar as chaves com segurança**

⚠️ **IMPORTANTE:** Nunca commite a chave privada no repositório!

Criar arquivo `.env.local` (não comitar):

```env
# Frontend (público)
VITE_VAPID_PUBLIC_KEY=BKxT7_ABC123XYZ...

# Backend (PRIVADO - não commitar)
VAPID_PRIVATE_KEY=xyz789_ABC123...
```

---

## 2️⃣ **CONFIGURAR FRONTEND (.env)**

### **Desenvolvimento local:**

Criar/editar `.env.local`:

```env
# Supabase (já configurado)
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=seu_anon_key

# Push Notifications (NOVO)
VITE_VAPID_PUBLIC_KEY=BKxT7_ABC123XYZ...sua_public_key_aqui...
```

### **Produção (Cloudflare Pages):**

1. Ir em: **Cloudflare Dashboard → Pages → seu-projeto → Settings → Environment Variables**
2. Adicionar:
   - **Name:** `VITE_VAPID_PUBLIC_KEY`
   - **Value:** `BKxT7_ABC123XYZ...`
   - **Environment:** Production + Preview

---

## 3️⃣ **CONFIGURAR BACKEND (CLOUDFLARE WORKER)**

### **Opção A: Cloudflare Worker (Recomendado)**

#### **Criar Worker:**

```bash
npm create cloudflare@latest push-notifications-worker
cd push-notifications-worker
npm install web-push
```

#### **Editar `src/index.ts`:**

```typescript
import webpush from 'web-push';

export interface Env {
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_EMAIL: string; // mailto:seu-email@exemplo.com
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST' || !request.url.endsWith('/send')) {
      return new Response('Not Found', { status: 404 });
    }

    try {
      const body = await request.json();
      const { store_id, user_id, notification } = body;

      // Validar
      if (!store_id || !notification) {
        return new Response('Missing required fields', { status: 400 });
      }

      // Configurar VAPID
      webpush.setVapidDetails(
        env.VAPID_EMAIL,
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
      );

      // Buscar subscriptions do Supabase
      const supabaseUrl = `${env.SUPABASE_URL}/rest/v1/push_subscriptions`;
      const query = new URLSearchParams({
        store_id: `eq.${store_id}`,
        active: 'eq.true',
        ...(user_id && { user_id: `eq.${user_id}` })
      });

      const subsResponse = await fetch(`${supabaseUrl}?${query}`, {
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      const subscriptions = await subsResponse.json();

      if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          sent: 0,
          message: 'No active subscriptions found' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Enviar push para cada subscription
      const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          try {
            await webpush.sendNotification(
              pushSubscription,
              JSON.stringify(notification)
            );
            return { success: true, endpoint: sub.endpoint };
          } catch (error: any) {
            // Se subscription inválida (410), marcar como inativa
            if (error.statusCode === 410 || error.statusCode === 404) {
              await fetch(`${env.SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
                method: 'PATCH',
                headers: {
                  'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ active: false }),
              });
            }
            throw error;
          }
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return new Response(JSON.stringify({
        success: true,
        sent: successful,
        failed,
        total: subscriptions.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error: any) {
      console.error('Push send error:', error);
      return new Response(JSON.stringify({ 
        error: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
};
```

#### **Deploy Worker:**

```bash
npx wrangler deploy
```

#### **Configurar Secrets:**

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
# Colar a private key quando solicitado

npx wrangler secret put VAPID_EMAIL
# Colar: mailto:seu-email@exemplo.com

npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Colar a service role key do Supabase
```

#### **Configurar Environment Variables:**

No Cloudflare Dashboard → Workers → seu-worker → Settings → Variables:

```
VAPID_PUBLIC_KEY=BKxT7_...
SUPABASE_URL=https://seu-projeto.supabase.co
```

#### **Anotar URL do Worker:**

```
https://push-notifications-worker.seu-usuario.workers.dev
```

---

### **Opção B: Supabase Edge Function (Alternativa)**

Criar `supabase/functions/send-push/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL = Deno.env.get('VAPID_EMAIL')!

serve(async (req) => {
  // Implementação similar ao Worker
  // ...
})
```

Deploy:

```bash
supabase functions deploy send-push
supabase secrets set VAPID_PRIVATE_KEY=xyz...
```

---

## 4️⃣ **TESTAR SISTEMA**

### **Teste 1: Solicitar Permissão**

1. Abrir aplicação: `http://localhost:5173` ou `https://smarttech.com.br`
2. Ir em: **Configurações → Notificações**
3. Clicar: **"Ativar Push Notifications"**
4. ✅ Permitir notificações no navegador

### **Teste 2: Criar Notificação de Teste**

No console do navegador (F12):

```javascript
// Importar função
const { testarNotificacao } = await import('/src/lib/push-notifications.ts');

// Enviar teste
await testarNotificacao();
```

**Resultado esperado:**
- ✅ Notificação aparece no desktop/mobile
- ✅ Clique abre a aplicação

### **Teste 3: Evento Real (Venda)**

1. Criar nova venda
2. ✅ Push notification aparece
3. ✅ Mensagem detalhada (valor, cliente, forma pagamento)
4. ✅ Clique redireciona para `/vendas`

### **Teste 4: Android (Chrome)**

1. Instalar PWA: **Menu → Instalar aplicativo**
2. Fechar aplicativo completamente
3. Criar venda no desktop
4. ✅ Push aparece no Android (app fechado)
5. ✅ Clique abre aplicativo na tela correta

### **Teste 5: iOS (Safari 16.4+)**

1. Adicionar à tela inicial: **Compartilhar → Adicionar à Tela de Início**
2. Abrir PWA
3. Permitir notificações
4. ✅ Push funciona (apenas se instalado)

---

## 🔧 **TROUBLESHOOTING**

### **Problema 1: "Push não suportado"**

**Causa:** Navegador/dispositivo não suporta Push API

**Solução:**
- Chrome/Edge (desktop): ✅ Suportado
- Firefox (desktop): ✅ Suportado
- Safari (macOS 16+): ✅ Suportado
- Safari (iOS 16.4+ PWA): ✅ Suportado
- Safari (iOS browser): ❌ Não suportado

### **Problema 2: Permissão negada**

**Solução:**
1. Chrome: `chrome://settings/content/notifications`
2. Remover site da lista de bloqueados
3. Recarregar página

### **Problema 3: Push não chega**

**Debug:**

```javascript
// Verificar subscription ativa
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.getSubscription();
console.log('Subscription:', sub);

// Verificar no Supabase
// SELECT * FROM push_subscriptions WHERE endpoint = '...'
```

**Checklist:**
- [ ] Service Worker registrado?
- [ ] Subscription salva no Supabase?
- [ ] VAPID keys corretas?
- [ ] Worker funcionando?
- [ ] Preferências de notificação habilitadas?

### **Problema 4: Erro 401/403 no Worker**

**Causa:** VAPID keys incorretas

**Solução:**
```bash
# Verificar secrets
npx wrangler secret list

# Re-adicionar se necessário
npx wrangler secret put VAPID_PRIVATE_KEY
```

### **Problema 5: iOS não recebe push**

**Checklist iOS:**
- [ ] iOS 16.4 ou superior?
- [ ] App adicionado à tela inicial (PWA)?
- [ ] Permissão concedida APÓS instalação?
- [ ] Testado com app fechado?

---

## 📊 **MONITORAMENTO**

### **Ver Subscriptions Ativas:**

```sql
-- Supabase SQL Editor
SELECT 
  user_id,
  device_info->>'platform' as platform,
  active,
  created_at,
  last_used_at
FROM push_subscriptions
WHERE store_id = 'seu-store-id'
  AND active = true
ORDER BY created_at DESC;
```

### **Ver Preferências:**

```sql
SELECT 
  user_id,
  vendas_push,
  os_push,
  cobrancas_push
FROM notificacoes_preferencias
WHERE store_id = 'seu-store-id';
```

### **Logs do Worker:**

```bash
npx wrangler tail push-notifications-worker
```

---

## ✅ **CHECKLIST FINAL**

### **Desenvolvimento:**
- [ ] VAPID keys geradas
- [ ] `.env.local` configurado
- [ ] Service Worker funcionando
- [ ] Teste local bem-sucedido

### **Produção:**
- [ ] Environment variables no Cloudflare Pages
- [ ] Worker deployed e testado
- [ ] Secrets configurados no Worker
- [ ] Teste em produção bem-sucedido

### **Mobile:**
- [ ] Teste Android (Chrome PWA)
- [ ] Teste iOS (Safari PWA 16.4+)
- [ ] Push com app fechado funciona

### **UX:**
- [ ] Mensagens claras e úteis
- [ ] Clique redireciona corretamente
- [ ] Preferências funcionando
- [ ] Subscriptions inválidas removidas

---

## 🔗 **LINKS ÚTEIS**

- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [iOS Push Support](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

---

**🎉 Sistema de Push Notifications configurado com sucesso!**

Para suporte: consultar `SISTEMA_NOTIFICACOES_COMPLETO.md`
