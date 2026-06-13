# 🔧 CORREÇÃO: VENDAS COM DÉBITO/CRÉDITO

**Data:** 30/01/2026  
**Versão:** 1.0

---

## 🎯 PROBLEMA

```
❌ Vendas com forma_pagamento = DEBITO ou CREDITO falhavam
✅ Vendas com PIX e DINHEIRO funcionavam normalmente
```

**Causa Raiz:**
- Payload enviado ao Supabase estava incompleto
- Faltavam campos obrigatórios para cartão (parcelas, taxas, total_liquido)
- Forma de pagamento não estava padronizada
- Logs de erro não mostravam detalhes suficientes

---

## 🔧 SOLUÇÕES IMPLEMENTADAS

### **1. Padronização de `forma_pagamento`**

**ANTES:**
```typescript
forma_pagamento: v.formaPagamento  // Valores inconsistentes
```

**DEPOIS:**
```typescript
// Valores padronizados (UPPERCASE)
DINHEIRO | PIX | DEBITO | CREDITO | BOLETO | OUTRO

// Mapeamento de valores legados
'cartao' → 'DEBITO' (default)
'dinheiro' → 'DINHEIRO'
'pix' → 'PIX'
'debito' → 'DEBITO'
'credito' → 'CREDITO'
```

---

### **2. Payload Completo para Supabase**

**ANTES:**
```typescript
function toSupabaseVendaPayload(v: Venda) {
  return {
    id: v.id,
    store_id: v.storeId,
    itens: v.itens,
    total: v.total,
    desconto: v.desconto ?? 0,
    forma_pagamento: v.formaPagamento,
    observacoes: v.observacoes ?? null,
    created_at: v.data
  };
}
```

**DEPOIS:**
```typescript
function toSupabaseVendaPayload(v: Venda) {
  // Normalizar forma_pagamento para uppercase
  let formaPagamento = (v.formaPagamento || 'DINHEIRO').toUpperCase();
  
  // Mapeamento de valores legados
  const formaPagamentoMap = {
    'DINHEIRO': 'DINHEIRO',
    'PIX': 'PIX',
    'DEBITO': 'DEBITO',
    'CREDITO': 'CREDITO',
    'CARTAO': 'DEBITO', // Legacy
    'BOLETO': 'BOLETO',
    'OUTRO': 'OUTRO'
  };
  
  formaPagamento = formaPagamentoMap[formaPagamento] || 'DINHEIRO';
  
  // Defaults seguros para campos de cartão
  const isCartao = formaPagamento === 'DEBITO' || formaPagamento === 'CREDITO';
  
  // REGRAS:
  // - DEBITO: parcelas = 1, taxa = 0 (default)
  // - CREDITO: parcelas = 1+ (do select), taxa calculada
  const parcelas = formaPagamento === 'DEBITO' 
    ? 1 
    : (v.parcelas && v.parcelas > 0 ? v.parcelas : 1);
  
  const taxaCartaoValor = v.taxa_cartao_valor ?? 0;
  const taxaCartaoPercentual = v.taxa_cartao_percentual ?? 0;
  
  const totalFinal = v.total - (v.desconto ?? 0);
  const totalLiquido = v.total_liquido ?? (totalFinal - taxaCartaoValor);
  
  return {
    id: v.id,
    store_id: v.storeId || null,
    numero_venda_num: v.numero_venda_num ?? null,
    numero_venda: v.numero_venda ?? null,
    number_status: v.number_status ?? 'pending',
    number_assigned_at: v.number_assigned_at ?? null,
    
    // Cliente
    cliente_id: v.clienteId ?? null,
    cliente_nome: v.clienteNome ?? null,
    cliente_telefone: v.clienteTelefone ?? null,
    cliente_endereco: v.clienteEndereco ?? null,
    cliente_cidade: v.clienteCidade ?? null,
    cliente_estado: v.clienteEstado ?? null,
    
    // Itens
    itens: v.itens,
    
    // Financeiro - Valores
    total: v.total,
    total_bruto: v.total_bruto ?? v.total,
    desconto: v.desconto ?? 0,
    desconto_tipo: v.desconto_tipo ?? 'valor',
    total_final: totalFinal,
    
    // Financeiro - Taxas (SEMPRE enviadas, mesmo que 0)
    taxa_cartao_valor: isCartao ? taxaCartaoValor : 0,
    taxa_cartao_percentual: isCartao ? taxaCartaoPercentual : 0,
    total_liquido: totalLiquido,
    
    // Financeiro - Custos e Lucros
    custo_total: v.custo_total ?? 0,
    lucro_bruto: v.lucro_bruto ?? 0,
    lucro_liquido: v.lucro_liquido ?? 0,
    
    // Forma de Pagamento (SEMPRE padronizada)
    forma_pagamento: formaPagamento,
    parcelas: isCartao ? parcelas : null,
    
    // Status
    status_pagamento: v.status_pagamento ?? 'pago',
    data_pagamento: v.data_pagamento ?? v.data,
    data_prevista_recebimento: v.data_prevista_recebimento ?? null,
    
    // Outros
    observacoes: v.observacoes ?? null,
    vendedor: v.vendedor,
    created_at: v.data ?? new Date().toISOString()
  };
}
```

---

### **3. Defaults Seguros por Forma de Pagamento**

| Forma Pagamento | Parcelas | Taxa Cartão | Total Líquido |
|-----------------|----------|-------------|---------------|
| **DINHEIRO** | `null` | `0` | `total - desconto` |
| **PIX** | `null` | `0` | `total - desconto` |
| **DEBITO** | `1` | `0` (ou calculado) | `total - desconto - taxa` |
| **CREDITO** | `1+` (do select) | `calculado` | `total - desconto - taxa` |

---

### **4. Logs Detalhados de Erro**

**ANTES:**
```typescript
logger.error('Erro ao enviar venda', { error: error.message });
```

**DEPOIS:**
```typescript
console.error('❌ [VENDAS] Erro ao enviar venda ao Supabase:', {
  '🔴 ERROR MESSAGE': error.message || String(error),
  '🔴 ERROR CODE': error.code || 'N/A',
  '🔴 ERROR DETAILS': error.details || 'N/A',
  '🔴 ERROR HINT': error.hint || 'N/A',
  '📦 PAYLOAD ENVIADO': payload,
  '🆔 Venda ID': v.id,
  '🏪 Store ID': STORE_ID,
  '💳 Forma Pagamento': payload.forma_pagamento,
  '💰 Total': payload.total,
  '💰 Total Líquido': payload.total_liquido,
  '🔢 Parcelas': payload.parcelas,
  '📊 Taxa Cartão': payload.taxa_cartao_valor,
  '🕒 Timestamp': new Date().toISOString()
});
```

---

## 🧪 COMO TESTAR

### **Teste 1: Venda com DÉBITO**
```
1. Ir em "Vendas"
2. Adicionar produto
3. Selecionar "Débito" como forma de pagamento
4. Confirmar venda
5. ✅ Venda criada com sucesso
6. ✅ Fluxo de caixa atualizado
7. ✅ Console SEM erros do Supabase
```

### **Teste 2: Venda com CRÉDITO**
```
1. Ir em "Vendas"
2. Adicionar produto
3. Selecionar "Crédito" como forma de pagamento
4. Escolher 3 parcelas
5. Aplicar taxa de cartão (opcional)
6. Confirmar venda
7. ✅ Venda criada com sucesso
8. ✅ Parcelas = 3
9. ✅ Taxa calculada corretamente
10. ✅ Console SEM erros do Supabase
```

### **Teste 3: Venda com PIX (Regressão)**
```
1. Ir em "Vendas"
2. Adicionar produto
3. Selecionar "PIX"
4. Confirmar venda
5. ✅ Venda criada normalmente (sem regressão)
```

### **Teste 4: Venda com DINHEIRO (Regressão)**
```
1. Ir em "Vendas"
2. Adicionar produto
3. Selecionar "Dinheiro"
4. Confirmar venda
5. ✅ Venda criada normalmente (sem regressão)
```

### **Teste 5: Verificar Logs de Erro (Simulado)**
```
1. Abrir F12 → Console
2. Tentar criar venda (qualquer forma de pagamento)
3. Se houver erro:
   ✅ Log detalhado com MESSAGE, CODE, DETAILS, HINT
   ✅ Payload completo visível
   ✅ Valores de parcelas, taxas, total_liquido visíveis
```

---

## 📊 CAMPOS SEMPRE ENVIADOS (Defaults Seguros)

```typescript
{
  // IDs e Numeração
  id: string,
  store_id: string | null,
  numero_venda_num: number | null,
  numero_venda: string | null,
  number_status: 'pending' | 'final',
  number_assigned_at: string | null,
  
  // Cliente (todos nullable)
  cliente_id: string | null,
  cliente_nome: string | null,
  cliente_telefone: string | null,
  cliente_endereco: string | null,
  cliente_cidade: string | null,
  cliente_estado: string | null,
  
  // Itens (obrigatório)
  itens: ItemVenda[],
  
  // Financeiro (SEMPRE com defaults)
  total: number,
  total_bruto: number,
  desconto: number, // default 0
  desconto_tipo: 'valor' | 'percentual', // default 'valor'
  total_final: number,
  taxa_cartao_valor: number, // default 0 (0 se não cartão)
  taxa_cartao_percentual: number, // default 0
  total_liquido: number,
  custo_total: number, // default 0
  lucro_bruto: number, // default 0
  lucro_liquido: number, // default 0
  
  // Pagamento (SEMPRE padronizado)
  forma_pagamento: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO',
  parcelas: number | null, // 1 para DEBITO, 1+ para CREDITO, null demais
  status_pagamento: 'pago' | 'pendente', // default 'pago'
  data_pagamento: string,
  data_prevista_recebimento: string | null,
  
  // Outros
  observacoes: string | null,
  vendedor: string,
  created_at: string
}
```

---

## ✅ BENEFÍCIOS

```
✅ Vendas com DÉBITO funcionam
✅ Vendas com CRÉDITO funcionam
✅ Payload completo e consistente
✅ Defaults seguros evitam erros de validação
✅ Forma de pagamento padronizada (uppercase)
✅ Logs detalhados facilitam debug
✅ Compatibilidade com valores legados ('cartao' → 'DEBITO')
✅ Nenhuma alteração no schema do Supabase
```

---

## 🎯 REGRAS DE NEGÓCIO

### **DÉBITO:**
```
parcelas: 1 (sempre)
taxa_cartao_valor: 0 (default, pode ter valor)
taxa_cartao_percentual: 0 (default, pode ter valor)
total_liquido: total - desconto - taxa
```

### **CRÉDITO:**
```
parcelas: 1-12 (do select, default 1)
taxa_cartao_valor: calculado ou 0
taxa_cartao_percentual: informado ou 0
total_liquido: total - desconto - taxa
```

### **PIX / DINHEIRO:**
```
parcelas: null
taxa_cartao_valor: 0
taxa_cartao_percentual: 0
total_liquido: total - desconto
```

---

## 📝 RESUMO

**ANTES:**
```
❌ Payload incompleto
❌ Forma pagamento inconsistente
❌ DEBITO/CREDITO falhavam
❌ Logs sem detalhes
❌ Campos obrigatórios ausentes
```

**DEPOIS:**
```
✅ Payload completo com todos os campos
✅ Forma pagamento padronizada (UPPERCASE)
✅ DEBITO/CREDITO funcionam
✅ Logs detalhados (message, code, details, hint)
✅ Defaults seguros para todos os campos
✅ Compatibilidade com valores legados
✅ Sem alteração no schema
```

---

**📅 Data:** 30/01/2026  
**🏆 Status:** IMPLEMENTADO  
**✅ Build:** OK

© 2026 - PDV Smart Tech - Payment Fix v1.0
