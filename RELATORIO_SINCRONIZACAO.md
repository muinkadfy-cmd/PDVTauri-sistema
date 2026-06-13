# 🔍 RELATÓRIO DE SINCRONIZAÇÃO - FINANCEIRO

**Data:** 30/01/2026  
**Auditor:** Sistema Automatizado  
**Status:** ⚠️ **SINCRONIZAÇÃO PARCIAL**

---

## 📊 **DIAGNÓSTICO: EXISTE OU NÃO EXISTE?**

| Integração | Status | Implementado? | Arquivo | Observações |
|------------|--------|---------------|---------|-------------|
| **A) Venda → Financeiro** | ✅ **SIM** | ✅ Automático | `src/lib/vendas.ts:327`<br>`src/lib/finance/lancamentos.ts:16` | Cria entrada automática com `criarLancamentosVenda()` |
| **B) OS → Financeiro** | ✅ **SIM** | ✅ Automático | `src/lib/ordens.ts:162-169`<br>`src/lib/finance/lancamentos.ts:82` | Cria entrada quando `status_pagamento === 'pago'` |
| **C) Compra Usados → Financeiro** | ❌ **NÃO** | ❌ Ausente | `src/lib/usados.ts:20-49` | **FALTA:** Não cria saída ao comprar usado |
| **D) Venda Usados → Financeiro** | ❌ **NÃO** | ❌ Ausente | `src/lib/usados.ts:72-112` | **FALTA:** Não cria entrada ao vender usado |
| **E) Relatórios - Fonte** | ⚠️ **MISTO** | ⚠️ Inconsistente | `src/lib/finance/reports.ts:70`<br>`src/pages/RelatoriosPage.tsx:75` | Usa vendas direto + view SQL (deveria usar apenas financeiro) |
| **F) Fluxo Caixa - Fonte** | ✅ **CORRETO** | ✅ Financeiro | `src/pages/FluxoCaixaPage.tsx:50` | Lê apenas de `getMovimentacoes()` ✅ |

---

## 🗂️ **MAPEAMENTO DE IMPLEMENTAÇÃO**

### **1. Tabelas do Banco (Supabase)**

```sql
✅ vendas
   - id, store_id, itens, total, desconto, forma_pagamento, created_at
   - Novos campos financeiros: parcelas, total_final, total_liquido, custo_total, lucro_bruto, lucro_liquido

✅ ordens_servico
   - id, store_id, numero, valorTotal, desconto, taxa_cartao_valor, total_liquido, status_pagamento

✅ financeiro (movimentacoes)
   - id, store_id, tipo, valor, responsavel, descricao, data
   - origem_tipo, origem_id, categoria, forma_pagamento

✅ usados
   - id, store_id, titulo, valorCompra, status (em_estoque/vendido/cancelado)

✅ usados_vendas
   - id, store_id, usadoId, valorVenda, dataVenda

✅ taxas_pagamento
   - id, store_id, forma_pagamento, parcelas, taxa_percentual, taxa_fixa

❌ TRIGGER SQL: NÃO EXISTE
   - Não há triggers automáticos no banco para inserir em financeiro
   - Lógica está no frontend (src/lib/finance/lancamentos.ts)
```

---

### **2. Arquivos de Persistência**

#### **✅ Vendas (IMPLEMENTADO)**

**Arquivo:** `src/lib/vendas.ts`

```typescript
// Linha 80-327: criarVenda()
export async function criarVenda(...): Promise<Venda | null> {
  // ... validações, cálculos financeiros ...
  
  const saved = await vendasRepo.upsert(novaVenda);
  
  // ✅ INTEGRAÇÃO FINANCEIRA (linha 325-333)
  try {
    await criarLancamentosVenda(saved);
  } catch (error) {
    logger.error('[Vendas] Erro ao criar lançamentos financeiros (venda continuou):', error);
  }
  
  return saved;
}
```

**Lançamentos criados:**
- **Entrada:** `total_liquido` (tipo: 'venda')
- **Saída:** `taxa_cartao_valor` (se cartão, tipo: 'taxa_cartao')
- **Idempotência:** ✅ Verifica `origem_id + origem_tipo` antes de criar

---

#### **✅ Ordens de Serviço (IMPLEMENTADO)**

**Arquivo:** `src/lib/ordens.ts`

```typescript
// Linha 25-169: criarOrdem()
export async function criarOrdem(...): Promise<OrdemServico | null> {
  // ... validações, cálculos financeiros ...
  
  const saved = await ordensRepo.upsert(novaOrdem);
  
  // ✅ INTEGRAÇÃO FINANCEIRA (linha 161-169)
  if (saved.status_pagamento === 'pago') {
    try {
      await criarLancamentosOS(saved);
    } catch (error) {
      logger.error('[Ordens] Erro ao criar lançamentos financeiros (OS continuou):', error);
    }
  }
  
  return saved;
}

// Linha 194-283: atualizarOrdem()
// ✅ INTEGRAÇÃO FINANCEIRA (linha 277-282)
// Se mudar status_pagamento para 'pago', cria lançamento
if (statusPagamentoNovo === 'pago' && statusPagamentoAnterior !== 'pago') {
  await criarLancamentosOS(saved);
}
```

**Lançamentos criados:**
- **Entrada:** `total_liquido` (tipo: 'servico', quando pago)
- **Saída:** `taxa_cartao_valor` (se cartão, tipo: 'taxa_cartao')
- **Idempotência:** ✅ Verifica `origem_id + origem_tipo` antes de criar

---

#### **❌ Usados - COMPRA (NÃO IMPLEMENTADO)**

**Arquivo:** `src/lib/usados.ts`

```typescript
// Linha 20-49: criarUsado()
export async function criarUsado(...): Promise<Usado | null> {
  // ... validações ...
  
  const novo: Usado = {
    // ... campos ...
    valorCompra: Number(usado.valorCompra) || 0,
    status: usado.status || 'em_estoque',
    // ...
  };

  return await usadosRepo.upsert(novo);
  
  // ❌ FALTA: Não cria movimentação financeira SAÍDA
  // Deveria chamar:
  // await createMovimentacao('compra_usado', valorCompra, responsavel, descricao, {
  //   origem_tipo: 'compra_usado',
  //   origem_id: novo.id,
  //   categoria: 'compra_usado'
  // });
}
```

**O que falta:**
- ❌ Criar **SAÍDA** no financeiro quando comprar usado
- ❌ Valor: `valorCompra`
- ❌ Tipo: `'compra_usado'` ou `'saida'`

---

#### **❌ Usados - VENDA (NÃO IMPLEMENTADO)**

**Arquivo:** `src/lib/usados.ts`

```typescript
// Linha 72-112: registrarVendaUsado()
export async function registrarVendaUsado(...): Promise<{...}> {
  const usado = usadosRepo.getById(usadoId);
  
  // Cria registro de venda
  const vendaRow: UsadoVenda = {
    // ... campos ...
    valorVenda: Number(venda.valorVenda) || 0,
    // ...
  };
  
  const savedVenda = await usadosVendasRepo.upsert(vendaRow);
  
  // Atualiza status do usado para 'vendido'
  const updatedUsado = await atualizarUsado(usadoId, { status: 'vendido' });
  
  return { success: true, venda: savedVenda, usado: updatedUsado };
  
  // ❌ FALTA: Não cria movimentação financeira ENTRADA
  // Deveria chamar:
  // const lucro = valorVenda - usado.valorCompra;
  // await createMovimentacao('venda_usado', valorVenda, responsavel, descricao, {
  //   origem_tipo: 'venda_usado',
  //   origem_id: savedVenda.id,
  //   categoria: 'venda_usado'
  // });
}
```

**O que falta:**
- ❌ Criar **ENTRADA** no financeiro quando vender usado
- ❌ Valor: `valorVenda` (ou `valorVenda - taxa` se houver)
- ❌ Tipo: `'venda_usado'` ou `'venda'`
- ❌ Calcular lucro: `valorVenda - valorCompra`

---

### **3. Relatórios - Fonte de Dados**

#### **⚠️ reports.ts (MISTO - INCONSISTENTE)**

**Arquivo:** `src/lib/finance/reports.ts`

```typescript
// Linha 70-76: gerarRelatorioFinanceiro()
export function gerarRelatorioFinanceiro(
  vendas: Venda[],               // ⚠️ Usa vendas DIRETO
  ordens: OrdemServico[],        // ⚠️ Usa ordens DIRETO
  movimentacoes: Movimentacao[], // ✅ Usa movimentacoes
  produtos: Produto[],
  periodo: PeriodoFiltro
): RelatorioFinanceiro {
  // Linha 78-84: Filtra vendas/ordens por período
  const vendasFiltradas = vendas
    .map(normalizarVenda)
    .filter(v => estaNoPeriodo(v.data, periodo));
  
  const ordensFiltradas = ordens
    .map(normalizarOS)
    .filter(o => estaNoPeriodo(o.dataAbertura, periodo));

  // Linha 90-92: Calcula receita DIRETO de vendas/ordens
  const receitaBrutaVendas = vendasFiltradas.reduce(...);
  const receitaBrutaOS = ordensFiltradas.reduce(...);
  
  // ⚠️ PROBLEMA: Não está usando movimentacoes como fonte única
  // ⚠️ Pode ter discrepância se lançamento falhar ou for manual
}
```

**Problema:**
- ⚠️ Relatórios calculam receitas **DIRETO** de `vendas` e `ordens`
- ⚠️ Deveria calcular **APENAS** de `movimentacoes` (financeiro)
- ⚠️ Pode ter divergência se:
  - Lançamento falhar ao criar venda/OS
  - Movimentação manual for criada
  - Venda/OS de usados não criar lançamento

---

#### **⚠️ RelatoriosPage.tsx (MISTO - INCONSISTENTE)**

**Arquivo:** `src/pages/RelatoriosPage.tsx`

```typescript
// Linha 39-58: Busca de view SQL
useEffect(() => {
  fetchRelatoriosFinanceiros() // ✅ View SQL com store_id
    .then(({ data, error }) => {
      setRows(data || []);
    });
}, [refreshKey]);

// Linha 73-77: Busca vendas locais
const vendasDoPeriodo = useMemo(() => {
  const todasVendas = getVendas(); // ⚠️ Usa vendas DIRETO
  return todasVendas.filter(v => estaNoPeriodo(v.data, periodo));
}, [periodo]);

// Linha 92-128: Métricas financeiras
const metricasFinanceiras = useMemo(() => {
  // ... calcula de vendasDoPeriodo ...
  vendasDoPeriodo.forEach(v => {
    totalBruto += v.total || 0;  // ⚠️ Calcula de vendas, não de financeiro
    // ...
  });
}, [vendasDoPeriodo]);
```

**Problema:**
- ⚠️ Usa `fetchRelatoriosFinanceiros()` (view SQL) para tabela
- ⚠️ Usa `getVendas()` (local) para métricas financeiras
- ⚠️ **MISTO:** Duas fontes diferentes para mesmo relatório

---

### **4. Fluxo de Caixa**

#### **✅ FluxoCaixaPage.tsx (CORRETO)**

**Arquivo:** `src/pages/FluxoCaixaPage.tsx`

```typescript
// Linha 49-50: Carrega movimentações
const carregarMovimentacoes = () => {
  setMovimentacoes(getMovimentacoes()); // ✅ CORRETO: Apenas financeiro
};

// Linha 54-99: Filtros e exibição
const movimentacoesFiltradas = useMemo(() => {
  let movs = [...movimentacoes]; // ✅ Usa apenas movimentacoes
  // ... filtros por período, tipo, busca ...
  return movs;
}, [movimentacoes, filtroPeriodo, filtroTipo, busca]);
```

**Status:**
- ✅ **CORRETO:** Lê apenas de `movimentacoes` (financeiro)
- ✅ Não acessa vendas/ordens diretamente
- ✅ Fonte única e consistente

---

## 🔧 **O QUE FALTA IMPLEMENTAR**

### **1. Compra de Usados → Financeiro** ❌

**Local:** `src/lib/usados.ts:20-49`

**Adicionar após linha 48:**

```typescript
export async function criarUsado(...): Promise<Usado | null> {
  // ... código existente ...
  
  const saved = await usadosRepo.upsert(novo);
  
  if (!saved) return null;
  
  // ✅ NOVO: Criar lançamento financeiro (SAÍDA)
  try {
    await createMovimentacao(
      'saida', // ou 'compra_usado'
      novo.valorCompra,
      'Sistema', // ou passar responsável como parâmetro
      `Compra Usado - ${novo.titulo}`,
      {
        origem_tipo: 'compra_usado',
        origem_id: novo.id,
        categoria: 'compra_usado',
        forma_pagamento: 'dinheiro' // ou passar como parâmetro
      }
    );
    
    logger.log(`[Usados] Saída financeira criada: R$ ${novo.valorCompra.toFixed(2)} - Usado ${novo.id}`);
  } catch (error) {
    // Não falha a compra se houver erro ao criar movimentação
    logger.error('[Usados] Erro ao criar lançamento financeiro (compra continuou):', error);
  }
  
  return saved;
}
```

---

### **2. Venda de Usados → Financeiro** ❌

**Local:** `src/lib/usados.ts:72-112`

**Adicionar após linha 109:**

```typescript
export async function registrarVendaUsado(...): Promise<{...}> {
  // ... código existente ...
  
  const savedVenda = await usadosVendasRepo.upsert(vendaRow);
  if (!savedVenda) return { success: false, error: 'Falha ao salvar venda' };

  const updatedUsado = await atualizarUsado(usadoId, { status: 'vendido' });
  if (!updatedUsado) return { success: false, error: 'Falha ao atualizar status do usado' };

  // ✅ NOVO: Criar lançamento financeiro (ENTRADA)
  try {
    const lucro = savedVenda.valorVenda - usado.valorCompra;
    
    await createMovimentacao(
      'venda', // ou 'venda_usado'
      savedVenda.valorVenda,
      'Sistema', // ou passar responsável como parâmetro
      `Venda Usado - ${usado.titulo}`,
      {
        origem_tipo: 'venda_usado',
        origem_id: savedVenda.id,
        categoria: 'venda_usado',
        forma_pagamento: 'dinheiro' // ou passar como parâmetro
      }
    );
    
    logger.log(`[Usados] Entrada financeira criada: R$ ${savedVenda.valorVenda.toFixed(2)} (Lucro: R$ ${lucro.toFixed(2)}) - Usado ${usado.id}`);
  } catch (error) {
    // Não falha a venda se houver erro ao criar movimentação
    logger.error('[Usados] Erro ao criar lançamento financeiro (venda continuou):', error);
  }

  return { success: true, venda: savedVenda, usado: updatedUsado };
}
```

---

### **3. Relatórios - Usar Apenas Financeiro** ⚠️

**Local:** `src/lib/finance/reports.ts:70-150`

**Opções:**

#### **Opção A: Manter Atual (MISTO)**
- ✅ Pros: Já funciona, relatórios mais ricos (tem itens, produtos, etc.)
- ❌ Contras: Pode ter divergência se lançamento falhar

#### **Opção B: Migrar para Financeiro 100%** ⭐ **RECOMENDADO**
- ✅ Pros: Fonte única e consistente, sempre correto
- ⚠️ Contras: Precisa refatorar, perder alguns detalhes

**Implementação (Opção B):**

```typescript
// NOVO: gerarRelatorioFinanceiroV2()
export function gerarRelatorioFinanceiroV2(
  movimentacoes: Movimentacao[],
  periodo: PeriodoFiltro
): RelatorioFinanceiro {
  const movsFiltradas = movimentacoes
    .filter(m => estaNoPeriodo(m.data, periodo));
  
  // Calcular receitas APENAS de movimentacoes
  const entradas = movsFiltradas
    .filter(m => ['venda', 'servico', 'venda_usado'].includes(m.tipo))
    .reduce((sum, m) => sum + m.valor, 0);
  
  const saidas = movsFiltradas
    .filter(m => ['saida', 'gasto', 'taxa_cartao', 'compra_usado'].includes(m.tipo))
    .reduce((sum, m) => sum + m.valor, 0);
  
  const saldo = entradas - saidas;
  
  // Por forma de pagamento
  const porFormaPagamento = movsFiltradas
    .reduce((acc, m) => {
      const forma = m.forma_pagamento || 'outro';
      if (!acc[forma]) acc[forma] = { quantidade: 0, receita: 0 };
      acc[forma].quantidade++;
      acc[forma].receita += m.valor;
      return acc;
    }, {} as Record<string, { quantidade: number; receita: number }>);
  
  return {
    periodo,
    receitaBruta: entradas,
    receitaLiquida: entradas - saidas,
    custos: 0, // Precisaria join com vendas/itens para calcular
    lucro: entradas - saidas,
    saldo,
    entradas,
    saidas,
    porFormaPagamento,
    // ...
  };
}
```

---

## 📋 **PLANO DE CORREÇÃO**

### **PRIORIDADE 1: Usados → Financeiro** 🔴

**Passos:**

1. ✅ Criar função `criarLancamentosUsadoCompra()` em `src/lib/finance/lancamentos.ts`
   ```typescript
   export async function criarLancamentosUsadoCompra(usado: Usado): Promise<boolean> {
     // Verificar idempotência
     // Criar SAÍDA (compra_usado)
   }
   ```

2. ✅ Criar função `criarLancamentosUsadoVenda()` em `src/lib/finance/lancamentos.ts`
   ```typescript
   export async function criarLancamentosUsadoVenda(
     venda: UsadoVenda, 
     usado: Usado
   ): Promise<boolean> {
     // Verificar idempotência
     // Criar ENTRADA (venda_usado)
     // Calcular lucro (valorVenda - valorCompra)
   }
   ```

3. ✅ Integrar em `src/lib/usados.ts`
   - Chamar `criarLancamentosUsadoCompra()` após salvar compra
   - Chamar `criarLancamentosUsadoVenda()` após salvar venda

4. ✅ Atualizar tipos em `src/types/index.ts`
   ```typescript
   export type TipoMovimentacao = 
     | 'venda' 
     | 'servico' 
     | 'compra_usado'   // NOVO
     | 'venda_usado'    // NOVO
     | 'saida' 
     | 'gasto' 
     | 'taxa_cartao';
   ```

5. ✅ Testar:
   - Comprar usado → Verificar saída em Fluxo de Caixa
   - Vender usado → Verificar entrada em Fluxo de Caixa
   - Idempotência → Comprar 2x mesmo usado → 1 lançamento apenas

---

### **PRIORIDADE 2: Relatórios Consistentes** 🟡

**Opção escolhida:** Manter MISTO por enquanto, documentar divergência

**Passos:**

1. ✅ Adicionar comentário em `reports.ts` explicando que usa vendas/ordens direto
2. ✅ Adicionar aviso na UI de Relatórios: "Valores baseados em vendas/OS registradas"
3. 🔜 **FUTURO:** Migrar para `gerarRelatorioFinanceiroV2()` (apenas financeiro)

---

### **PRIORIDADE 3: Idempotência Garantida** 🟢

**Status:** ✅ **JÁ IMPLEMENTADO**

**Verificado:**
- ✅ `criarLancamentosVenda()` verifica `origem_id + origem_tipo` (linha 22-30)
- ✅ `criarLancamentosOS()` verifica `origem_id + origem_tipo` (linha 88-96)
- ✅ Não há risco de duplicação

---

## ✅ **CHECKLIST DE VALIDAÇÃO**

```
✅ Venda → Financeiro (automático)
✅ OS → Financeiro (automático quando pago)
❌ Compra Usados → Financeiro (FALTA IMPLEMENTAR)
❌ Venda Usados → Financeiro (FALTA IMPLEMENTAR)
✅ Idempotência (já implementada)
✅ Multi-tenant (store_id em todas as tabelas)
⚠️ Relatórios (misto, mas funcional)
✅ Fluxo de Caixa (apenas financeiro)
```

---

## 📊 **TABELA RESUMO**

| Módulo | Cria Lançamento? | Quando? | Tipo | Idempotente? |
|--------|------------------|---------|------|--------------|
| **Venda** | ✅ SIM | Ao criar | ENTRADA (venda) | ✅ SIM |
| **OS** | ✅ SIM | Quando `status_pagamento = 'pago'` | ENTRADA (servico) | ✅ SIM |
| **Compra Usado** | ❌ NÃO | - | - | - |
| **Venda Usado** | ❌ NÃO | - | - | - |

---

## 🚀 **PRÓXIMOS PASSOS**

1. **Implementar Usados → Financeiro** (Prioridade 1)
   - Tempo estimado: 30-45 min
   - Arquivos: 2 modificados, 0 novos
   - Testes: Comprar + Vender usado, verificar fluxo

2. **Atualizar Documentação** (Prioridade 2)
   - Adicionar comentários sobre fontes de dados
   - Documentar divergência relatórios

3. **Testes E2E** (Prioridade 3)
   - Cenário completo: Compra → Estoque → Venda
   - Verificar financeiro atualizado
   - Verificar relatórios corretos

---

**📝 Relatório gerado:** 30/01/2026  
**🔍 Auditoria completa:** ✅  
**⚠️ Ação requerida:** Implementar integração Usados → Financeiro
