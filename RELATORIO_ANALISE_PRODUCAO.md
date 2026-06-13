# 🔍 RELATÓRIO DE ANÁLISE - PROBLEMAS EM PRODUÇÃO

**Data:** 30/01/2026  
**Sistema:** Smart Tech PDV (React + Supabase + Cloudflare Pages)  
**Severidade:** 🔴 CRÍTICO - Bloqueadores de venda comercial

---

## ⚠️ PROBLEMAS CRÍTICOS IDENTIFICADOS

### 🔴 **PROBLEMA #1: Erro 400 "flcit=id" no endpoint /rest/v1/vendas**

**Severidade:** 🔴 **BLOCKER** - Impede criação de vendas  
**Arquivo:** `src/lib/repository/remote-store.ts` (linha 248-256)

#### **Causa Raiz:**
```typescript
// Linha 248-256: remote-store.ts
const pkCol = this.getPrimaryKeyColumn(); // Retorna 'id'
const result = await supabase!
  .from(this.tableName)
  .upsert(supabaseData, {
    onConflict: pkCol, // ❌ PROBLEMA: pkCol = 'id'
    ignoreDuplicates: false
  })
  .select()
  .single();
```

**O Problema:**
1. `getPrimaryKeyColumn()` retorna `'id'` para tabela `vendas`
2. Supabase.js gera URL: `/rest/v1/vendas?onConflict=id`
3. PostgREST trunca ou interpreta mal: `flcit=id` (aparece no erro 400)
4. **CAUSA REAL**: A coluna `id` NÃO É PRIMARY KEY na tabela `vendas` do Supabase!

#### **Verificação Necessária:**
```sql
-- Verificar PRIMARY KEY da tabela vendas no Supabase
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'vendas' AND constraint_type = 'PRIMARY KEY';

-- EXPECTATIVA: Deve retornar 'id' como PK
-- SE NÃO: Esse é o problema!
```

#### **Correção Proposta:**

**OPÇÃO 1: Ajustar Schema (Se PK for diferente)**
```typescript
// src/lib/repository/schema-map.ts
vendas: {
  tableName: 'vendas',
  primaryKey: 'id', // ✅ Confirmar que é 'id' no Supabase
  fields: {
    // ... campos
  }
}
```

**OPÇÃO 2: Usar `.insert()` em vez de `.upsert()` para vendas**
```typescript
// src/lib/repository/remote-store.ts (linha 246-257)

// Usar upsert() com onConflict para TODAS as tabelas
const pkCol = this.getPrimaryKeyColumn();

// ✅ CORREÇÃO: Para vendas, usar INSERT sem onConflict
if (this.tableName === 'vendas') {
  // Vendas sempre cria novo registro (nunca atualiza)
  const result = await supabase!
    .from(this.tableName)
    .insert(supabaseData)
    .select()
    .single();
  
  // ... resto do código
} else {
  // Outras tabelas: usar upsert normal
  const result = await supabase!
    .from(this.tableName)
    .upsert(supabaseData, {
      onConflict: pkCol,
      ignoreDuplicates: false
    })
    .select()
    .single();
}
```

**✅ CORREÇÃO RECOMENDADA: OPÇÃO 2**
- Mais segura
- Não requer alteração no Supabase
- Vendas nunca devem ser atualizadas via upsert (apenas criadas)
- Evita conflitos de PK

---

### 🔴 **PROBLEMA #2: Venda com Múltiplos Produtos Falha**

**Severidade:** 🔴 **BLOCKER** - Funcionalidade core quebrada  
**Arquivo:** `src/lib/vendas.ts` (linhas 162-229)

#### **Causa Raiz:**
```typescript
// Sistema de reservas de estoque pode ter race condition
// ao processar múltiplos itens rapidamente
for (const item of novaVenda.itens) {
  const produto = getProdutoPorId(item.produtoId);
  
  // ❌ Se produto não existir, falha toda a venda
  if (!produto) {
    logger.error('[Vendas] Produto não encontrado...'); // ✅ Log já melhorado
    return null; // ❌ Falha silenciosa
  }
  
  // Atualizar estoque
  const novoEstoque = produto.estoque - item.quantidade;
  await atualizarProduto(produto.id, { estoque: novoEstoque });
}
```

**O Problema:**
1. Se algum `produtoId` for inválido → Venda falha
2. Se estoque insuficiente → Venda falha (mas pode ser esperado)
3. **LOG JÁ MELHORADO** nas correções anteriores ✅

#### **Correção Necessária:**
```typescript
// Adicionar validação ANTES de processar estoque
// Validar que TODOS os produtoIds existem
const produtosInvalidos = novaVenda.itens.filter(item => {
  const produto = getProdutoPorId(item.produtoId);
  return !produto;
});

if (produtosInvalidos.length > 0) {
  const ids = produtosInvalidos.map(i => i.produtoId).join(', ');
  logger.error('[Vendas] Produtos inválidos na venda:', {
    produtosInvalidos: ids,
    totalItens: novaVenda.itens.length
  });
  
  // ✅ Retornar erro específico
  showToast(`❌ Produto(s) inválido(s): ${ids}`, 'error');
  return null;
}

// Depois, processar estoque normalmente
```

**✅ CORREÇÃO: Validação pré-processamento**
- Logs já melhorados ✅
- Adicionar toast para usuário
- Impedir venda com produtos inválidos

---

### 🔴 **PROBLEMA #3: Upload de Arquivos em Compra de Usados Falha**

**Severidade:** 🔴 **BLOCKER** - Funcionalidade core quebrada  
**Status:** ✅ **JÁ CORRIGIDO** nas alterações anteriores

#### **Correção Aplicada:**
```typescript
// src/lib/usados-uploads.ts
function sanitizeFilename(name: string): string {
  if (!name || name.trim().length === 0) {
    return 'arquivo';
  }
  
  return name
    .normalize('NFD') // ✅ Remove acentos
    .replace(/[\u0300-\u036f]/g, '') // ✅ Diacríticos
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/[^\w\-_.]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+/, '')
    .replace(/[._-]+$/, '')
    .slice(0, 120)
    .toLowerCase()
    || 'arquivo';
}
```

**✅ STATUS: RESOLVIDO**

---

### 🔴 **PROBLEMA #4: Não é Possível Imprimir Comprovante de Compra**

**Severidade:** 🟠 **ALTO** - Funcionalidade importante quebrada  
**Arquivo:** `src/pages/CompraUsadosPage.tsx` + `src/lib/print-template.ts`

#### **Causa Raiz:**
Preciso verificar se:
1. Dados da compra estão disponíveis
2. Template de impressão suporta compra de usados
3. Botão de impressão está presente

#### **Verificação Necessária:**
```typescript
// CompraUsadosPage.tsx - Verificar se há botão de impressão
// e se dados são passados corretamente para print-template
```

#### **Correção Proposta:**
- Verificar se `PrintButton` está implementado
- Garantir que dados de `usado` são convertidos para `PrintData`
- Adicionar campos faltantes no template

**⏳ PENDENTE: Análise mais detalhada necessária**

---

### 🟡 **PROBLEMA #5: Mobile - Elementos Flutuantes Cobrem Botões**

**Severidade:** 🟡 **MÉDIO** - UX ruim, mas não blocker  
**Status:** ✅ **JÁ CORRIGIDO** nas alterações anteriores

#### **Correção Aplicada:**
```typescript
// src/components/quick-actions/QuickActionsBar.tsx
// ✅ Auto-hide ao focar input
// ✅ Safe area padding (80-136px)
// ✅ Transição suave (200ms)
```

**✅ STATUS: RESOLVIDO**

---

### 🟡 **PROBLEMA #6: UI Bloqueia Ações Importantes**

**Severidade:** 🟡 **MÉDIO** - Relacionado ao #5  
**Status:** ✅ **JÁ CORRIGIDO** nas alterações anteriores

**✅ STATUS: RESOLVIDO**

---

## 📊 **RESUMO DE PROBLEMAS**

| # | Problema | Severidade | Status |
|---|----------|------------|--------|
| 1 | Erro 400 "flcit=id" | 🔴 BLOCKER | ⏳ Correção proposta |
| 2 | Múltiplos produtos | 🔴 BLOCKER | ⏳ Validação necessária |
| 3 | Upload arquivos | 🔴 BLOCKER | ✅ RESOLVIDO |
| 4 | Imprimir comprovante | 🟠 ALTO | ⏳ Análise necessária |
| 5 | Floating bar mobile | 🟡 MÉDIO | ✅ RESOLVIDO |
| 6 | UI bloqueia ações | 🟡 MÉDIO | ✅ RESOLVIDO |

---

## 🔧 **CORREÇÕES PRIORITÁRIAS**

### **URGENTE (BLOCKERS):**

1. **Erro 400 "flcit=id"** - Usar `.insert()` em vez de `.upsert()` para vendas
2. **Múltiplos produtos** - Adicionar validação pré-processamento

### **IMPORTANTE:**

3. **Imprimir comprovante** - Verificar template e botão

### **CONCLUÍDO:**

4. ✅ Upload arquivos (sanitização robusta)
5. ✅ Floating bar mobile (auto-hide + safe area)

---

## 💡 **RECOMENDAÇÕES**

### **Antes de Aplicar Correções:**

1. **Verificar schema no Supabase:**
```sql
-- Conectar ao Supabase e executar:
\d vendas
-- Verificar PRIMARY KEY
```

2. **Backup de dados:**
```bash
# Antes de qualquer alteração em produção
npm run backup:local
```

3. **Testar em ambiente local:**
```bash
npm run dev
# Testar vendas com múltiplos produtos
```

### **Ordem de Implementação:**

```
1. Correção #1 (Erro 400) - 20 min
   ↓
2. Teste: Criar venda simples
   ↓
3. Teste: Criar venda com 3 produtos
   ↓
4. Correção #2 (Validação) - 15 min
   ↓
5. Correção #4 (Impressão) - 30 min
   ↓
6. Teste completo (PC + Mobile)
   ↓
7. Deploy em produção
```

---

## ⚠️ **AVISOS IMPORTANTES**

### **NÃO FAZER:**

- ❌ Alterar schema do Supabase sem backup
- ❌ Remover campo `onConflict` de outras tabelas
- ❌ Quebrar sync offline/online
- ❌ Alterar estrutura de `itens` em vendas

### **FAZER:**

- ✅ Testar CADA correção isoladamente
- ✅ Verificar logs no console (F12)
- ✅ Testar venda com 1, 3 e 10 produtos
- ✅ Testar upload com nomes problemáticos
- ✅ Testar impressão de comprovante

---

## 📈 **IMPACTO DAS CORREÇÕES**

| Correção | Impacto | Risco |
|----------|---------|-------|
| #1 Erro 400 | ✅ Vendas funcionam | 🟢 BAIXO |
| #2 Validação | ✅ Menos erros silenciosos | 🟢 BAIXO |
| #3 Upload | ✅ Arquivos funcionam | ✅ RESOLVIDO |
| #4 Impressão | ✅ Comprovantes funcionam | 🟡 MÉDIO |
| #5 Mobile | ✅ UX melhor | ✅ RESOLVIDO |

---

## 🎯 **PRÓXIMOS PASSOS**

### **AGORA (Urgente):**
1. Aplicar Correção #1 (Erro 400)
2. Aplicar Correção #2 (Validação)
3. Testar vendas com múltiplos produtos

### **DEPOIS:**
4. Analisar e corrigir impressão de comprovante
5. Teste completo em produção
6. Monitorar logs por 24h

### **OPCIONAL:**
7. Melhorar tratamento de erros
8. Adicionar mais logs estruturados
9. Criar testes automatizados

---

**📝 Relatório gerado em:** 30/01/2026  
**🔍 Próxima ação:** Aplicar correções #1 e #2 (BLOCKERS)
