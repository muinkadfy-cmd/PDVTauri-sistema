# 🏗️ REFATORAÇÃO PROFISSIONAL - FINANCEIRO COMO FONTE DA VERDADE

**Data:** 31/01/2026  
**Status:** 🔄 **EM IMPLEMENTAÇÃO**

---

## 🎯 **OBJETIVO**

Transformar o sistema financeiro em um **LEDGER PROFISSIONAL**, usando a tabela `financeiro` como **ÚNICA FONTE DA VERDADE** para todos os cálculos e visualizações.

---

## 📋 **MUDANÇAS A IMPLEMENTAR**

### **1. PAINEL - Simplificação** ✅

**Antes:**
- ✅ Cards: Serviços, Vendas, Gastos, Saldo Diário (HOJE)
- ✅ Cards: Total Entradas, Total Saídas, Saldo, **Saldo Atual** (GERAL - duplicado!)
- ✅ Cards: Entradas por Setor (HOJE)

**Depois:**
- ✅ Cards: **Apenas HOJE** (remover seção "Fluxo de Caixa Geral")
- ✅ Cards: Entradas Hoje, Saídas Hoje, Saldo Hoje
- ✅ Cards: Entradas por Setor (Vendas, OS, Cobranças, Recibos)
- ❌ **REMOVER:** Card "Saldo Atual" (redundante)
- ❌ **REMOVER:** Seção "Fluxo de Caixa (Geral)" completa

**Fonte de Dados:**
```typescript
// ✅ USO CORRETO: Buscar do financeiro
const movs = getMovimentacoes(); // financeiro table

// ❌ NÃO FAZER: Buscar de outras tabelas
const vendas = getVendas();
const ordens = getOrdens();
```

---

### **2. FLUXO DE CAIXA - Período Selecionável** ✅

**Manter:**
- ✅ Filtros: Período, Tipo, Origem, Busca
- ✅ Cards: Saldo Inicial, Entradas, Saídas, Saldo do Período
- ❌ **REMOVER:** Card "Saldo Atual" (igual ao "Saldo do Período")

**Fonte de Dados:**
```typescript
// ✅ ÚNICA FONTE: getMovimentacoes()
const movs = getMovimentacoes();
```

---

### **3. ESTORNOS - Lógica Profissional** 🔧

**Antes (Problemático):**
```typescript
// Ao deletar venda
await createMovimentacao('saida', valor, usuario, '🔄 Estorno - Venda XXX excluída', {
  categoria: 'Estorno de Venda' // ❌ Categoria genérica
});
```

**Depois (Profissional):**
```typescript
// Ao deletar venda
await createMovimentacao('saida', valor, usuario, 'Estorno de Venda XXX', {
  origem_tipo: 'estorno', // ✅ NOVO: Origem específica
  origem_id: vendaId, // Referência ao documento original
  categoria: 'ESTORNO_VENDA' // Categoria padronizada
});
```

**Arquivos a Modificar:**
- `src/lib/vendas.ts` (deletarVenda)
- `src/lib/ordens.ts` (deletarOrdem)
- `src/lib/cobrancas.ts` (deletarCobranca)
- `src/lib/recibos.ts` (deletarRecibo)
- `src/lib/usados.ts` (deletarUsado, estornarVenda)
- `src/lib/encomendas.ts` (deletarEncomenda)
- `src/lib/devolucao.ts` (estorno)

---

### **4. SALDO NEGATIVO - Permitir com Aviso** ⚠️

**Comportamento Atual:**
- Não há bloqueio de saldo negativo
- Não há aviso visual

**Novo Comportamento:**
```typescript
// No Painel e Fluxo de Caixa
const saldoAtual = entradas - saidas;

// ⚠️ AVISO VISUAL se saldo < 0
{saldoAtual < 0 && (
  <div className="aviso-saldo-negativo">
    ⚠️ ATENÇÃO: Saldo negativo! Verifique saídas não registradas.
  </div>
)}
```

---

### **5. REMOVER CÁLCULOS REDUNDANTES** 🧹

**Problema Atual:**
```typescript
// ❌ NÃO FAZER: Buscar ordens e vendas para calcular financeiro
const ordens = getOrdens();
const vendas = getVendas();

ordensHoje.forEach(os => {
  if (os.status_pagamento !== 'pago') {
    ordensServico += os.valorTotal; // ❌ Calculando fora do financeiro!
  }
});
```

**Solução:**
```typescript
// ✅ FAZER: Confiar APENAS no financeiro
const movs = getMovimentacoes();

movs.forEach(m => {
  if (m.origem_tipo === 'ordem_servico') {
    ordensServico += m.valor; // ✅ Direto do financeiro
  }
});
```

**REGRA DE OURO:**
> **"Se não está no financeiro, não aconteceu!"**

---

## 📁 **ARQUIVOS A MODIFICAR**

### **Páginas:**
1. ✅ `src/pages/Painel/PainelPage.tsx`
   - Remover seção "Fluxo de Caixa (Geral)"
   - Remover cálculo manual de OS pendentes
   - Simplificar para usar APENAS `getMovimentacoes()`

2. ✅ `src/pages/FluxoCaixaPage.tsx`
   - Remover card "Saldo Atual"
   - Adicionar aviso de saldo negativo
   - Manter apenas 4 cards: Saldo Inicial, Entradas, Saídas, Saldo do Período

### **Lógica de Estornos:**
3. ✅ `src/lib/vendas.ts` (deletarVenda)
4. ✅ `src/lib/ordens.ts` (deletarOrdem)
5. ✅ `src/lib/cobrancas.ts` (deletarCobranca)
6. ✅ `src/lib/recibos.ts` (deletarRecibo)
7. ✅ `src/lib/usados.ts` (estornos)
8. ✅ `src/lib/encomendas.ts` (deletarEncomenda)
9. ✅ `src/lib/devolucao.ts` (estornos)

### **Tipos:**
10. ✅ `src/types/index.ts`
    - Adicionar `'estorno'` aos tipos de `origem_tipo`

---

## 🎯 **CHECKLIST DE IMPLEMENTAÇÃO**

### **FASE 1: Atualizar Tipos** ✅
- [ ] Adicionar `'estorno'` ao tipo `origem_tipo` em Movimentacao

### **FASE 2: Refatorar Estornos** 🔧
- [ ] Vendas: Usar origem_tipo='estorno'
- [ ] OS: Usar origem_tipo='estorno'
- [ ] Cobranças: Usar origem_tipo='estorno'
- [ ] Recibos: Usar origem_tipo='estorno'
- [ ] Usados: Usar origem_tipo='estorno'
- [ ] Encomendas: Usar origem_tipo='estorno'
- [ ] Devoluções: Usar origem_tipo='estorno'

### **FASE 3: Simplificar Painel** 🎨
- [ ] Remover seção "Fluxo de Caixa (Geral)"
- [ ] Remover cálculo de OS pendentes (busca em ordens)
- [ ] Usar APENAS getMovimentacoes()
- [ ] Adicionar aviso de saldo negativo

### **FASE 4: Ajustar Fluxo de Caixa** 💰
- [ ] Remover card "Saldo Atual"
- [ ] Adicionar aviso visual de saldo negativo
- [ ] Manter filtros e período selecionável

### **FASE 5: Testes** ✅
- [ ] Criar venda e deletar → Verificar estorno com origem='estorno'
- [ ] Criar OS e deletar → Verificar estorno
- [ ] Verificar Painel (só dados de hoje, sem duplicatas)
- [ ] Verificar Fluxo (4 cards, saldo negativo com aviso)

---

## 🎨 **LAYOUT FINAL**

### **PAINEL:**
```
┌─────────────────────────────────────────────┐
│ 💰 Resumo Financeiro (Hoje)                 │
├─────────────────────────────────────────────┤
│ [Entradas Hoje] [Saídas Hoje] [Saldo Hoje] │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📊 Entradas por Setor (Hoje)                │
├─────────────────────────────────────────────┤
│ [Vendas] [OS] [Cobranças] [Recibos]        │
└─────────────────────────────────────────────┘
```

### **FLUXO DE CAIXA:**
```
┌─────────────────────────────────────────────┐
│ 💰 Fluxo de Caixa                           │
├─────────────────────────────────────────────┤
│ [Período: Este Mês ▼]                       │
│                                             │
│ Cards: [Saldo Inicial] [Entradas]          │
│        [Saídas] [Saldo do Período]         │
│                                             │
│ ⚠️ AVISO: Saldo negativo (se < 0)          │
└─────────────────────────────────────────────┘
```

---

## 💡 **BENEFÍCIOS**

1. ✅ **Fonte única:** Financeiro é a verdade absoluta
2. ✅ **Sem duplicatas:** Remover cards redundantes
3. ✅ **Estornos rastreáveis:** origem_tipo='estorno'
4. ✅ **Saldo negativo:** Permitido com aviso
5. ✅ **Performance:** Menos queries, mais cache
6. ✅ **Auditoria:** Estornos claramente identificados
7. ✅ **Simplicidade:** Menos código, mais manutenível

---

**INICIANDO IMPLEMENTAÇÃO AGORA...** 🚀
