# 🔍 DIAGNÓSTICO: SINCRONIZAÇÃO E MÉTRICAS

**Data:** 30/01/2026  
**Problema:** Métricas não atualizam, dados não vão para Supabase

---

## 🎯 PROBLEMA RELATADO

```
❌ Métricas financeiras não atualizam
❌ Dados não estão indo para o Supabase
❌ "prescisa ir superbase tambem , p nao atualiza nada"
```

---

## 🔍 ANÁLISE DO SISTEMA

### **Arquitetura Atual:**

```
┌─────────────────┐
│  FRONTEND       │
│  (React)        │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ DataRepository  │ ← Aqui está o problema!
├─────────────────┤
│ 1. LocalStore   │ ✅ Funciona (localStorage)
│    (localStorage)│
│                 │
│ 2. RemoteStore  │ ❌ Pode não estar configurado
│    (Supabase)   │
│                 │
│ 3. Outbox       │ ❌ Pode estar com itens pendentes
│    (fila sync)  │
│                 │
│ 4. Sync Engine  │ ❌ Pode não estar rodando
│    (processador)│
└─────────────────┘
         │
         ↓
┌─────────────────┐
│   SUPABASE      │ ❌ Pode não estar configurado
│   (PostgreSQL)  │
└─────────────────┘
```

---

## 📊 FLUXO ATUAL (COMO FUNCIONA)

### **Quando você cria uma venda:**

```
1. VendasPage.tsx → criarVenda()
   ↓
2. vendas.ts → vendasRepo.upsert(venda)
   ↓
3. DataRepository.upsert()
   ├─→ LocalStore.upsert() ✅ Salva no localStorage
   ├─→ addToOutbox() ✅ Adiciona à fila
   └─→ syncItem() ❌ Tenta sincronizar (pode falhar)
       ↓
4. RemoteStore.upsert()
   ├─→ supabase.from('sales').upsert() ❌ Pode falhar
   └─→ Erro silencioso (não bloqueia)
```

### **Quando você abre a aba Vendas:**

```
1. VendasPage.tsx monta
   ↓
2. const vendas = useMemo(() => getVendas(), []);
   ↓
3. getVendas() → vendasRepo.list()
   ↓
4. LocalStore.list() ✅ Lê do localStorage
   ↓
5. Métricas calculadas ✅ Baseadas no localStorage
```

---

## ❓ POR QUE AS MÉTRICAS NÃO ATUALIZAM?

### **Possíveis Causas:**

#### **1. Supabase Não Configurado**
```
❌ .env.local sem VITE_SUPABASE_URL
❌ .env.local sem VITE_SUPABASE_ANON_KEY
❌ .env.local sem VITE_STORE_ID

Resultado:
→ Dados ficam APENAS no localStorage
→ Não sincronizam com Supabase
→ Ao limpar cache, perde tudo
```

#### **2. Sync Falhando Silenciosamente**
```
❌ Outbox cheia de itens pendentes
❌ Supabase retorna erro (RLS, auth, etc)
❌ Erro não aparece para o usuário

Resultado:
→ localStorage atualiza ✅
→ Supabase não atualiza ❌
→ Métricas baseadas no localStorage funcionam ✅
→ Mas ao abrir em outro dispositivo, não tem dados ❌
```

#### **3. Métricas Lendo de Fonte Errada**
```
❌ Métricas leem do localStorage
❌ Mas você espera que leiam do Supabase

Resultado:
→ localStorage atualiza ✅
→ Métricas calculam baseado no localStorage ✅
→ Mas Supabase não tem os dados ❌
```

---

## 🔧 VERIFICAÇÕES NECESSÁRIAS

### **1. Verificar Configuração do Supabase**

**Abrir console do navegador (F12):**
```javascript
// Deve aparecer no console ao carregar a página:
[Config] Store ID válido: ✅ Sim
[Config] Store ID: 7371cfdc-7df5-4543-95b0-882da2de6ab9 (source: url)
[Config] Supabase configurado: ✅ Sim
```

**Se aparecer:**
```javascript
[Config] Store ID válido: ❌ Não
[Config] Supabase configurado: ❌ Não
```

**Então:**
```
❌ Supabase NÃO está configurado
❌ Dados ficam APENAS no localStorage
✅ Solução: Configurar .env.local
```

---

### **2. Verificar Outbox (Fila de Sincronização)**

**Abrir console (F12):**
```javascript
// Colar no console:
const outbox = JSON.parse(localStorage.getItem('smarttech:outbox') || '[]');
console.log('📦 Outbox:', outbox.length, 'itens pendentes');
console.table(outbox.slice(0, 10)); // Mostrar primeiros 10
```

**Se tiver muitos itens (> 50):**
```
❌ Sync está travada
❌ Itens não estão sendo processados
✅ Solução: Forçar sincronização ou limpar outbox
```

---

### **3. Verificar Dados no Supabase**

**Ir no Dashboard do Supabase:**
```
1. https://supabase.com/dashboard
2. Selecionar projeto
3. Table Editor
4. Verificar tabelas:
   - sales (vendas)
   - orders (ordens)
   - finance (movimentações)
```

**Se estiverem vazias:**
```
❌ Dados não estão sincronizando
❌ Sync engine não está funcionando
✅ Solução: Configurar/ativar sync
```

---

## ✅ SOLUÇÕES

### **Solução 1: Configurar .env.local**

**Criar/Editar `c:\PDV\.env.local`:**
```env
# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui

# Multi-tenant (UUID da loja)
VITE_STORE_ID=7371cfdc-7df5-4543-95b0-882da2de6ab9

# Client ID (opcional)
VITE_CLIENT_ID=smart-tech-pdv
```

**Depois:**
```
1. Salvar arquivo
2. Parar servidor (Ctrl + C)
3. Limpar cache: npm run clean
4. Iniciar novamente: npm run dev
5. Verificar console (F12): "Supabase configurado: ✅ Sim"
```

---

### **Solução 2: Forçar Sincronização Manual**

**Se Supabase está configurado mas dados não sincronizam:**

**Abrir console (F12) e colar:**
```javascript
// Importar sync engine
import { syncAllPendingChanges } from './src/lib/repository/sync-engine.ts';

// Forçar sincronização
(async () => {
  console.log('🔄 Iniciando sincronização forçada...');
  const result = await syncAllPendingChanges();
  console.log('✅ Sincronização concluída:', result);
})();
```

---

### **Solução 3: Limpar Outbox (Último Recurso)**

**⚠️ ATENÇÃO: Isso APAGA a fila de sincronização!**

**Só usar se:**
```
- Supabase está configurado ✅
- Dados ANTIGOS já estão no Supabase ✅
- Outbox tem centenas/milhares de itens ❌
- Sync está travada ❌
```

**Console (F12):**
```javascript
// CUIDADO: Apaga fila de sync!
localStorage.removeItem('smarttech:outbox');
console.log('🗑️ Outbox limpa. Recarregue a página.');
location.reload();
```

---

### **Solução 4: Usar Backup/Restore**

**Se dados estão no localStorage mas não no Supabase:**

**Opção A: Exportar Backup**
```
1. Ir em "Configurações" ou aba com backup
2. Clicar em "Exportar Backup"
3. Salvar arquivo .json
4. Guardar em segurança
```

**Opção B: Restaurar no Supabase**
```
1. Configurar .env.local (Solução 1)
2. Reiniciar app
3. Restaurar backup
4. Dados vão para Supabase automaticamente
```

---

## 🧪 TESTES

### **Teste 1: Supabase Configurado?**

```
1. Abrir app
2. F12 (console)
3. Procurar:
   ✅ "[Config] Supabase configurado: ✅ Sim"
   ❌ "[Config] Supabase configurado: ❌ Não"
```

**Resultado Esperado:**
```
✅ Sim → Continuar para Teste 2
❌ Não → Aplicar Solução 1
```

---

### **Teste 2: Dados Sincronizando?**

```
1. Criar nova venda (R$ 10,00)
2. F12 (console)
3. Procurar logs:
   ✅ "[Repository:sales] Item sincronizado"
   ❌ "[Repository:sales] Erro ao sincronizar"
4. Ir no Supabase Dashboard
5. Verificar tabela "sales"
6. ✅ Deve ter a venda nova
```

**Resultado Esperado:**
```
✅ Venda aparece no Supabase → OK
❌ Venda NÃO aparece → Aplicar Solução 2
```

---

### **Teste 3: Outbox Limpa?**

```javascript
// Console (F12)
const outbox = JSON.parse(localStorage.getItem('smarttech:outbox') || '[]');
console.log('📦 Outbox:', outbox.length);
```

**Resultado Esperado:**
```
0-10 itens → ✅ OK (normal)
10-50 itens → ⚠️ Atenção (pode estar lenta)
50+ itens → ❌ Problema (travada)
```

---

## 📋 CHECKLIST DE DIAGNÓSTICO

```
☐ Verificar console: "Supabase configurado: ✅ Sim"
☐ Verificar console: "Store ID válido: ✅ Sim"
☐ Verificar .env.local tem VITE_SUPABASE_URL
☐ Verificar .env.local tem VITE_SUPABASE_ANON_KEY
☐ Verificar .env.local tem VITE_STORE_ID
☐ Criar venda de teste
☐ Verificar Supabase Dashboard (tabela sales)
☐ Verificar outbox (< 50 itens)
☐ Verificar logs de erro no console
```

---

## 🚨 ERROS COMUNS

### **Erro 1: RLS (Row Level Security)**

**Console mostra:**
```
[Repository:sales] Erro ao sincronizar: 
  message: "new row violates row-level security policy"
```

**Causa:**
```
❌ Usuário não autenticado
❌ RLS policy não permite insert/update
```

**Solução:**
```
1. Verificar se está logado
2. Verificar RLS policies no Supabase
3. Desabilitar RLS (somente DEV/teste)
```

---

### **Erro 2: Auth Token Expirado**

**Console mostra:**
```
[Supabase] Erro de autenticação: JWT expirado
```

**Causa:**
```
❌ Token de autenticação venceu (> 1 hora)
```

**Solução:**
```
1. Recarregar página (F5)
2. Fazer login novamente
3. Verificar refresh token
```

---

### **Erro 3: Store ID Inválido**

**Console mostra:**
```
[Config] Store ID válido: ❌ Não
[AuthGuard] STORE_ID inválido/ausente
```

**Causa:**
```
❌ VITE_STORE_ID não é UUID
❌ URL ?store= com valor inválido
```

**Solução:**
```
1. Gerar UUID válido: https://uuidgenerator.net/
2. Adicionar no .env.local: VITE_STORE_ID=...
3. Reiniciar app
```

---

## 💡 EXPLICAÇÃO: POR QUE MÉTRICAS FUNCIONAM SEM SUPABASE?

```
┌──────────────────────────────────────┐
│  MÉTRICAS LEEM DO LOCALSTORAGE       │
│  (Não do Supabase)                   │
└──────────────────────────────────────┘

localStorage.getItem('smarttech:7371cfdc:sales')
  ↓
vendasRepo.list()
  ↓
Métricas calculam ✅
```

**Mas:**
```
❌ Ao limpar cache → Perde tudo
❌ Em outro dispositivo → Não tem nada
❌ Ao restaurar sistema → Perde tudo
```

**Com Supabase:**
```
✅ Cache limpo → Puxa do Supabase
✅ Outro dispositivo → Puxa do Supabase
✅ Restaurar sistema → Puxa do Supabase
```

---

## 📝 RESUMO

**SITUAÇÃO ATUAL:**
```
✅ LocalStorage funciona
✅ Métricas calculam corretamente (baseadas no localStorage)
❌ Supabase pode não estar configurado
❌ Dados podem não estar sincronizando
```

**OBJETIVO:**
```
✅ Configurar Supabase
✅ Habilitar sincronização automática
✅ Dados persistentes na nuvem
✅ Métricas baseadas em dados sincronizados
```

**PRÓXIMOS PASSOS:**
```
1. Verificar .env.local
2. Configurar Supabase (se necessário)
3. Testar sincronização
4. Verificar Supabase Dashboard
5. Confirmar métricas atualizadas
```

---

**📅 Data:** 30/01/2026  
**🔍 Status:** DIAGNÓSTICO COMPLETO  
**✅ Próximo:** Verificar configuração

© 2026 - PDV Smart Tech - Sync Diagnostic v1.0
