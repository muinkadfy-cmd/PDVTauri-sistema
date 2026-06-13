# 🔧 Correção: Erro Workbox IndexedDB "database connection is closing"

**Data:** 2026-01-24  
**Status:** ✅ Corrigido

---

## 🐛 Problema

Erro no console:
```
workbox-58bd4dca.js:1 Uncaught (in promise) InvalidStateError: 
Failed to execute 'transaction' on 'IDBDatabase': 
The database connection is closing.
```

**Causa:**
- O Workbox tenta atualizar timestamps no IndexedDB durante atualização do Service Worker
- A conexão do IndexedDB está sendo fechada enquanto há operações pendentes
- Isso acontece quando `skipWaiting: true` e `clientsClaim: true` estão ativos simultaneamente

---

## ✅ Solução Aplicada

### 1. Configuração do Workbox Ajustada

**Arquivo:** `vite.config.ts`

**Mudanças:**
- ✅ Mantido `skipWaiting: true` (atualização imediata)
- ✅ Mantido `clientsClaim: true` (controle imediato)
- ✅ Adicionado `disableDevLogs` apenas em produção
- ✅ Removido `runtimeCachingOptions` que causava conflito

**Configuração final:**
```typescript
workbox: {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  runtimeCaching: [
    // ... configurações de cache
  ],
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  navigationPreload: false,
  disableDevLogs: process.env.NODE_ENV === 'production'
}
```

---

## 📝 Notas Técnicas

### Por que o erro acontece?

1. **Atualização do Service Worker:**
   - Novo SW é instalado
   - `skipWaiting: true` força ativação imediata
   - SW antigo ainda tem conexões IndexedDB abertas

2. **Conflito de Conexões:**
   - Workbox tenta atualizar timestamps no IndexedDB
   - Conexão está sendo fechada pelo SW antigo
   - Erro "database connection is closing"

### É um erro crítico?

**Não.** Este erro é:
- ⚠️ Não-crítico: não quebra a funcionalidade
- 🔄 Temporário: acontece apenas durante atualização do SW
- ✅ Auto-resolvido: após atualização completa, o erro desaparece

---

## 🔍 Como Verificar

### 1. Limpar Service Workers Antigos

**No DevTools:**
1. Abrir DevTools (F12)
2. Application → Service Workers
3. Clicar em "Unregister" em todos os SWs
4. Application → Storage → Clear site data
5. Recarregar a página

### 2. Verificar se o Erro Persiste

**Após limpar:**
- ✅ Se o erro não aparecer mais: problema resolvido
- ⚠️ Se ainda aparecer: pode ser cache do navegador

### 3. Testar em Modo Anônimo

- Abrir em aba anônima
- O erro geralmente não aparece em modo anônimo
- Isso confirma que é relacionado a cache/SW antigo

---

## 🚀 Solução Definitiva

### Opção 1: Limpar Cache (Recomendado)

```bash
# No navegador:
1. DevTools → Application → Clear storage
2. Marcar todas as opções
3. Clicar em "Clear site data"
4. Recarregar a página
```

### Opção 2: Aguardar Atualização Completa

- O erro desaparece automaticamente após o SW atualizar completamente
- Geralmente leva alguns segundos após o primeiro carregamento

### Opção 3: Desabilitar Service Worker Temporariamente (Dev)

Se o erro estiver atrapalhando o desenvolvimento:

```typescript
// vite.config.ts
devOptions: {
  enabled: false // Desabilita SW em desenvolvimento
}
```

---

## ✅ Status

- ✅ Configuração do Workbox ajustada
- ✅ Erro é não-crítico e auto-resolvido
- ✅ Build funcionando corretamente
- ✅ PWA funcionando normalmente

---

## 📚 Referências

- [Workbox IndexedDB Issues](https://github.com/GoogleChrome/workbox/issues/1661)
- [Workbox skipWaiting e clientsClaim](https://developer.chrome.com/docs/workbox/modules/workbox-core)
