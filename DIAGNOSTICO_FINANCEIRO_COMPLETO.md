# 🔍 DIAGNÓSTICO COMPLETO: Sistema Financeiro

**Data:** 31/01/2026  
**Missão:** Reestruturar financeiro para nível PROFISSIONAL

---

## 📊 **ANÁLISE - ESTADO ATUAL**

### **✅ O QUE JÁ FUNCIONA:**

#### **1. VENDAS** - ✅ PERFEITO
```typescript
// src/lib/vendas.ts (linha 516)
await criarLancamentosVenda(saved);

// src/lib/finance/lancamentos.ts (linha 16-86)
export async function criarLancamentosVenda(venda: Venda)
- ✅ Cria ENTRADA quando status_pagamento === 'pago'
- ✅ Cria SAÍDA para taxa de cartão
- ✅ Idempotente (não duplica)
- ✅ origem_tipo: 'venda'
```

#### **2. ORDENS DE SERVIÇO** - ✅ LÓGICA EXISTE!
```typescript
// src/lib/ordens.ts (linhas 162-169, 288-300)
// CRIAÇÃO: Se criada já como 'pago'
if (saved.status_pagamento === 'pago') {
  await criarLancamentosOS(saved);
}

// ATUALIZAÇÃO: Se mudar para 'pago'
if (deveConsiderarPago || foiConcluida) {
  await criarLancamentosOS(saved);
}

// src/lib/finance/lancamentos.ts (linha 93-154)
export async function criarLancamentosOS(ordem: OrdemServico)
- ✅ Cria ENTRADA quando status_pagamento === 'pago'
- ✅ Cria SAÍDA para taxa de cartão
- ✅ Idempotente (não duplica)
- ✅ origem_tipo: 'ordem_servico'
```

**STATUS:** ✅ **JÁ IMPLEMENTADO!**

---

#### **3. COBRANÇAS** - ✅ LÓGICA EXISTE!
```typescript
// src/lib/cobrancas.ts (linhas 70-77)
if (updates.status === 'paga' && statusAnterior !== 'paga') {
  await criarLancamentoRecebimentoCobranca(salva);
}

// src/lib/finance/lancamentos.ts (linha 467-506)
export async function criarLancamentoRecebimentoCobranca(cobranca: Cobranca)
- ✅ Cria ENTRADA
- ✅ Idempotente (não duplica)
- ✅ origem_tipo: 'cobranca'
- ✅ categoria: 'recebimento_cobranca'
```

**STATUS:** ✅ **JÁ IMPLEMENTADO!**

---

#### **4. RECIBOS** - ⚠️ VERIFICAR IMPLEMENTAÇÃO
```typescript
// Preciso verificar se recibos.ts chama criarLancamentoRecibo
```

**STATUS:** ⚠️ **VERIFICAR**

---

#### **5. ENCOMENDAS** - ✅ LÓGICA COMPLETA
```typescript
// src/lib/encomendas.ts (linhas 75-85)
- Sinal (status = 'pago') → ENTRADA
- Entrega (status = 'entregue') → ENTRADA do saldo
- Compra → SAÍDA

// src/lib/finance/lancamentos.ts (linhas 328-458)
- criarLancamentoEncomendaSinal()
- criarLancamentoEncomendaCompra()
- criarLancamentoEncomendaEntrega()
```

**STATUS:** ✅ **JÁ IMPLEMENTADO!**

---

### **⚠️ O PROBLEMA REAL:**

**HIPÓTESE 1:** OS e Cobranças são criadas com `status_pagamento = 'pendente'` por padrão, então não geram lançamento imediatamente.

**HIPÓTESE 2:** Usuário não está MARCANDO como 'pago' nas OS/Cobranças antigas.

**HIPÓTESE 3:** Pode haver BUG na interface que impede marcar como 'pago'.

---

## 🎯 **O QUE PRECISA SER FEITO:**

### **1️⃣ BANCO DE DADOS - Tabela `financeiro`**

**Estado Atual (migrations):**
```sql
-- 20260130_financeiro_completo.sql
CREATE TABLE IF NOT EXISTS public.financeiro (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  tipo TEXT NOT NULL, -- 'entrada', 'saida', 'venda'
  valor DECIMAL(10,2),
  descricao TEXT,
  usuario TEXT,
  data TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Colunas adicionadas por migrações:
- origem_tipo TEXT (ex: 'venda', 'ordem_servico', 'cobranca')
- origem_id UUID
- forma_pagamento TEXT
- categoria TEXT
- responsavel TEXT (NOT NULL DEFAULT 'SISTEMA')
- origem TEXT
```

**O QUE FALTA:**
- ✅ Índices de performance
- ✅ Constraint anti-duplicidade
- ✅ Campo `status` ('ATIVO' | 'CANCELADO')
- ✅ Padronizar `origem` vs `origem_tipo`

---

### **2️⃣ RECIBOS - Implementar Lançamento**

**Arquivo:** `src/lib/recibos.ts`

**Verificar se chama:**
```typescript
import { criarLancamentoRecibo } from './finance/lancamentos';

// Ao criar recibo
await criarLancamentoRecibo(recibo);
```

**Se não existir, criar função:**
```typescript
// src/lib/finance/lancamentos.ts
export async function criarLancamentoRecibo(recibo) {
  // ENTRADA
  // origem_tipo: 'recibo'
}
```

---

### **3️⃣ FLUXO DE CAIXA - Refatorar UI**

**Arquivo:** `src/pages/FluxoCaixaPage.tsx`

**Adicionar:**
- Cards superiores (Saldo Inicial, Entradas, Saídas, Saldo)
- Filtros por origem
- Lista profissional com badges
- Saldo acumulado por linha

---

### **4️⃣ PAINEL - Cards por Setor**

**Arquivo:** `src/pages/PainelPage.tsx`

**Adicionar:**
- Cards financeiros HOJE
- Cards por setor (Vendas, OS, Cobranças, Recibos)
- Visual profissional

---

### **5️⃣ ORDEM DE SERVIÇO - Layout Telefone**

**Arquivo:** `src/lib/print-template.ts` e `src/pages/OrdensPage.tsx`

**Adicionar:**
- Mostrar telefone do cliente se existir
- Funcionar em 80mm, 58mm, A4

---

## 📋 **CHECKLIST DE IMPLEMENTAÇÃO**

- [ ] 1. Criar migração SQL (`20260131_financeiro_profissional.sql`)
  - [ ] Índices: (store_id, created_at DESC)
  - [ ] Índices: (store_id, origem_tipo)
  - [ ] Índices: (store_id, origem_id)
  - [ ] Constraint UNIQUE(store_id, origem_tipo, origem_id, tipo, status)
  - [ ] Campo `status` DEFAULT 'ATIVO'
  - [ ] Padronizar `origem` para `origem_tipo`

- [ ] 2. Verificar/Implementar Recibos
  - [ ] Verificar se `recibos.ts` chama lançamento
  - [ ] Criar função se não existir
  - [ ] Testar

- [ ] 3. Refatorar Fluxo de Caixa
  - [ ] Cards superiores
  - [ ] Filtros
  - [ ] Lista profissional
  - [ ] Badges coloridos

- [ ] 4. Refatorar Painel
  - [ ] Cards por setor
  - [ ] Resumo visual
  - [ ] Responsivo

- [ ] 5. Melhorar OS
  - [ ] Telefone no layout
  - [ ] Print profissional

- [ ] 6. Testar Sistema Completo
  - [ ] Criar OS e marcar como paga
  - [ ] Criar Cobrança e marcar como paga
  - [ ] Criar Recibo
  - [ ] Verificar Fluxo de Caixa
  - [ ] Verificar Painel

---

## ✅ **CONCLUSÃO DO DIAGNÓSTICO**

**BOM:**
- ✅ Lógica de lançamentos JÁ EXISTE para OS, Cobranças e Encomendas
- ✅ Sistema é idempotente (não duplica)
- ✅ Offline-first preservado

**PROBLEMA:**
- ⚠️ OS e Cobranças precisam ser MARCADAS como 'pago' manualmente
- ⚠️ Interface pode não facilitar isso
- ⚠️ Usuário pode não saber que precisa marcar
- ⚠️ Recibos podem não ter lançamento automático

**SOLUÇÃO:**
1. ✅ Verificar se interface permite marcar como 'pago' facilmente
2. ✅ Implementar lançamento de Recibos se não existir
3. ✅ Refatorar UI (Fluxo + Painel) para mostrar TUDO
4. ✅ Adicionar migração SQL pro banco
5. ✅ Melhorar layout de OS

---

**Próximo passo:** Verificar `recibos.ts` e começar implementação!
