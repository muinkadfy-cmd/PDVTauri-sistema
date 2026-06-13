# 🔧 CORREÇÕES GLOBAIS - CARDS DE MÉTRICAS

**Data:** 31/01/2026  
**Status:** ✅ **3 PROBLEMAS CORRIGIDOS**

---

## 🐛 **PROBLEMAS ENCONTRADOS**

### **1. Card "Ordens de Serviço" no Painel**

**Problema:** Só mostrava OS com `status_pagamento = 'pago'`

**Comportamento Antigo:**
- OS criada (pendente) → ❌ **Card zerado**
- OS marcada como paga → ✅ Aparece

**Arquivos Afetados:**
- `src/pages/Painel/PainelPage.tsx` (linhas 81-82, 148-149)

**Correção:**
```typescript
// ✅ ANTES: Só movimentações financeiras (OS pagas)
if (m.origem_tipo === 'ordem_servico') {
  ordensServico += m.valor;
}

// ✅ AGORA: Todas as OS criadas hoje
const ordensHoje = ordens.filter(os => {
  const dataOS = new Date(os.dataAbertura);
  dataOS.setHours(0, 0, 0, 0);
  return dataOS.getTime() === hoje.getTime();
});

ordensHoje.forEach(os => {
  const valorOS = os.total_liquido || os.valorTotal || 0;
  if (valorOS > 0 && os.status_pagamento !== 'pago') {
    ordensServico += valorOS;
  }
});
```

---

### **2. Métricas de Ordens de Serviço**

**Problema:** `FinanceMetricsCards` na página de OS só contava OS pagas

**Comportamento Antigo:**
- Período "Este Mês": Só mostra OS pagas → Valores incorretos
- Quantidade: Conta só as pagas

**Arquivo Afetado:**
- `src/lib/metrics.ts` (linha 133-134)

**Correção:**
```typescript
// ❌ ANTES: Só OS pagas
const ordens = getOrdens().filter(o => 
  o.dataAbertura && estaNoPeriodo(o.dataAbertura, periodo) && o.status_pagamento === 'pago'
);

// ✅ AGORA: Todas as OS do período
const ordens = getOrdens().filter(o => 
  o.dataAbertura && estaNoPeriodo(o.dataAbertura, periodo)
);
```

---

### **3. Métricas de Cobranças**

**Problema:** `FinanceMetricsCards` na página de Cobranças só contava cobranças pagas

**Comportamento Antigo:**
- Período "Este Mês": Só mostra cobranças pagas
- Cobranças pendentes/vencidas não aparecem

**Arquivo Afetado:**
- `src/lib/metrics.ts` (linha 258-259)

**Correção:**
```typescript
// ❌ ANTES: Só cobranças pagas
const cobrancas = getCobrancas().filter(c => 
  c.dataPagamento && estaNoPeriodo(c.dataPagamento, periodo) && c.status === 'paga'
);

// ✅ AGORA: Todas as cobranças do período
const cobrancas = getCobrancas().filter(c => 
  c.dataCriacao && estaNoPeriodo(c.dataCriacao, periodo)
);
```

**IMPORTANTE:** Mudou de `dataPagamento` para `dataCriacao` para pegar todas as cobranças criadas no período.

---

## ✅ **RESULTADO APÓS CORREÇÕES**

### **Painel (Card "Ordens de Serviço"):**
| Situação | Antes | Agora |
|----------|-------|-------|
| OS criada hoje (pendente) | R$ 0,00 ❌ | R$ 1.052,00 ✅ |
| OS criada hoje (paga) | R$ 1.052,00 ✅ | R$ 1.052,00 ✅ |

### **Página Ordens de Serviço (Métricas):**
| Situação | Antes | Agora |
|----------|-------|-------|
| 5 OS pendentes (R$ 5.000) | Não aparece ❌ | R$ 5.000,00 ✅ |
| 2 OS pagas (R$ 2.000) | R$ 2.000,00 ✅ | R$ 7.000,00 ✅ |
| Quantidade | 2 ❌ | 7 ✅ |

### **Página Cobranças (Métricas):**
| Situação | Antes | Agora |
|----------|-------|-------|
| 10 cobranças pendentes (R$ 3.000) | Não aparece ❌ | R$ 3.000,00 ✅ |
| 3 cobranças pagas (R$ 1.000) | R$ 1.000,00 ✅ | R$ 4.000,00 ✅ |
| Quantidade | 3 ❌ | 13 ✅ |

---

## 🎯 **IMPACTO NAS PÁGINAS**

### **✅ Páginas Afetadas e Corrigidas:**

1. **Painel (`/painel`):**
   - Card "Ordens de Serviço" agora mostra TODAS as OS de hoje

2. **Ordens de Serviço (`/ordens`):**
   - Cards de métricas agora mostram TODAS as OS do período
   - "Total Bruto", "Quantidade", etc. agora estão corretos

3. **Cobranças (`/cobrancas`):**
   - Cards de métricas agora mostram TODAS as cobranças do período
   - Cobranças pendentes/vencidas agora aparecem nos totais

---

## 📋 **PÁGINAS QUE JÁ ESTAVAM CORRETAS**

### **✅ Vendas:**
- Sempre conta TODAS as vendas (não tem filtro de "paga")
- Vendas são sempre pagas ao criar

### **✅ Recibos:**
- Sempre conta TODOS os recibos
- Recibos são sempre criados como "emitidos"

### **✅ Usados (Compra/Venda):**
- Não tem status de pagamento
- Sempre conta todos os registros

---

## 🚀 **DEPLOY**

**Arquivos Modificados:**
1. `src/pages/Painel/PainelPage.tsx` (Card OS)
2. `src/lib/metrics.ts` (Métricas OS e Cobranças)

**Commit:**
```
fix: Corrigir contagem de OS e Cobranças em cards de métricas

- Painel: Mostrar TODAS as OS criadas hoje (não só pagas)
- Métricas OS: Contar TODAS as OS do período
- Métricas Cobranças: Contar TODAS as cobranças (por dataCriacao)
```

---

## 💡 **PARA O USUÁRIO**

### **Como Testar:**

1. **Painel:**
   - Acesse `/painel`
   - Veja o card "Ordens de Serviço"
   - Deve mostrar a OS-7089 (R$ 1.052,00)

2. **Ordens de Serviço:**
   - Acesse `/ordens`
   - Veja os cards de métricas no topo
   - "Quantidade" deve mostrar TODAS as OS do período
   - "Total Bruto" deve incluir OS pendentes

3. **Cobranças:**
   - Acesse `/cobrancas`
   - Veja os cards de métricas
   - Deve incluir cobranças pendentes e vencidas

---

## 📊 **LÓGICA FINANCEIRA MANTIDA**

**IMPORTANTE:** As correções **NÃO afetam** o Fluxo de Caixa!

- **Fluxo de Caixa:** Continua mostrando só valores **pagos** ✅
- **Cards de Métricas:** Agora mostram **todos os registros** (pago ou não) ✅

**Exemplo:**
- OS criada: R$ 1.052,00 (pendente)
  - ✅ Aparece no card "Ordens de Serviço"
  - ✅ Aparece nas métricas da página
  - ❌ **NÃO** aparece no Fluxo de Caixa (correto!)
- OS marcada como paga:
  - ✅ Continua no card
  - ✅ Continua nas métricas
  - ✅ **AGORA** aparece no Fluxo de Caixa ✅

---

**Status:** ✅ **TODAS AS CORREÇÕES APLICADAS E TESTADAS**
