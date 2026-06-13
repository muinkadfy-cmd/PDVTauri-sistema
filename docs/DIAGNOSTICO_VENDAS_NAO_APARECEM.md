# Diagnóstico: Vendas não aparecem no Painel/Financeiro/Fluxo de Caixa

## Problema Identificado

As vendas estão sendo criadas e aparecem na página de Vendas, mas **não aparecem** em:
- **Painel**: Mostra "R$ 0,00" e "0 vendas"
- **Financeiro**: Mostra "R$ 0,00" e "0 vendas" 
- **Fluxo de Caixa**: Mostra "R$ 0,00" em Entradas e "Nenhuma movimentação encontrada"

## Causa Raiz

### Problema 1: `status_pagamento` não definido na criação da venda

**Localização**: `src/lib/vendas.ts` - função `criarVenda()`

**Problema**: Quando uma venda é criada, o campo `status_pagamento` não estava sendo definido explicitamente. Ele só vinha do objeto `venda` passado como parâmetro, mas se não viesse, ficava `undefined`.

**Impacto**: A função `criarLancamentosVenda()` só cria movimentação financeira se `status_pagamento === 'pago'`. Como o campo estava `undefined`, a condição falhava e nenhuma movimentação era criada.

**Código problemático**:
```typescript
// ANTES (linha 88-105)
const novaVenda: Venda = {
  ...venda,
  // ... outros campos ...
  // status_pagamento NÃO estava sendo definido!
};
```

### Problema 2: Validação muito restritiva em `criarLancamentosVenda`

**Localização**: `src/lib/finance/lancamentos.ts` - função `criarLancamentosVenda()`

**Problema**: A função só cria movimentação se `status_pagamento === 'pago'` explicitamente, sem fallback para quando o campo não está definido.

**Código problemático**:
```typescript
// ANTES (linha 33)
if (vendaNormalizada.status_pagamento === 'pago' && totalLiquido > 0) {
  // Criar movimentação...
}
// Se status_pagamento for undefined, não cria nada!
```

## Correções Implementadas

### Correção 1: Definir `status_pagamento` padrão ao criar venda

**Arquivo**: `src/lib/vendas.ts`

**Mudança**: Adicionar `status_pagamento: 'pago'` por padrão e `data_pagamento` com a data atual.

```typescript
// DEPOIS
const novaVenda: Venda = {
  ...venda,
  // ... outros campos ...
  status_pagamento: venda.status_pagamento || 'pago', // Padrão: pago
  data_pagamento: venda.data_pagamento || new Date().toISOString(), // Data atual
  // ...
};
```

**Justificativa**: Vendas são sempre pagas na criação (não há venda a prazo no sistema atual). Se o usuário não especificar, assumir 'pago'.

### Correção 2: Fallback em `criarLancamentosVenda`

**Arquivo**: `src/lib/finance/lancamentos.ts`

**Mudança**: Adicionar fallback para assumir 'pago' se `status_pagamento` não estiver definido.

```typescript
// DEPOIS
const statusPagamento = vendaNormalizada.status_pagamento || 'pago';
if (statusPagamento === 'pago' && totalLiquido > 0) {
  // Criar movimentação...
}
```

**Justificativa**: Garantir que mesmo vendas antigas (sem `status_pagamento` definido) gerem movimentação financeira.

## Fluxo Correto Após Correção

1. **Usuário cria venda** → `criarVenda()` é chamado
2. **Venda é salva** → `status_pagamento: 'pago'` e `data_pagamento` são definidos
3. **`criarLancamentosVenda()` é chamado** → Detecta `status_pagamento === 'pago'`
4. **Movimentação financeira é criada** → Tipo `'venda'`, valor = `total_liquido`
5. **Movimentação aparece em**:
   - Painel → `getResumoFinanceiro()` filtra por `tipo === 'venda'`
   - Financeiro → Lista todas movimentações tipo `'venda'`
   - Fluxo de Caixa → Filtra por `tipo === 'venda'` ou `'servico'` para Entradas

## Validação

### Como testar:

1. **Criar uma nova venda** (ex: R$ 25,00)
2. **Verificar console** (DEV):
   - Deve aparecer: `[Financeiro] Entrada criada: R$ 25,00 - Venda {id}`
   - Deve aparecer: `[Financeiro] Movimentação salva: {id, tipo: 'venda', valor: 25}`
3. **Verificar Painel**:
   - Card "Vendas" deve mostrar "R$ 25,00" e "1 venda"
   - Seção "Últimas Movimentações" deve mostrar a venda
4. **Verificar Financeiro**:
   - Card "Vendas" deve mostrar "R$ 25,00" e "1 venda"
   - Lista deve mostrar a movimentação tipo "venda"
5. **Verificar Fluxo de Caixa**:
   - Card "ENTRADAS" deve mostrar "R$ 25,00"
   - Histórico deve mostrar a movimentação

## Arquivos Alterados

1. `src/lib/vendas.ts` - Adicionado `status_pagamento` e `data_pagamento` padrão
2. `src/lib/finance/lancamentos.ts` - Adicionado fallback para `status_pagamento`

## Observações

- **Vendas antigas**: Vendas criadas antes desta correção podem não ter movimentação financeira. Seria necessário rodar um script de migração para criar movimentações retroativas.
- **Sincronização**: As movimentações financeiras são criadas localmente e adicionadas à outbox para sincronização com Supabase. Se houver erro de sincronização (400, 429), as movimentações podem não aparecer no Supabase, mas devem aparecer localmente.
