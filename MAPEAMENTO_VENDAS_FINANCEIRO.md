# 📋 MAPEAMENTO - MÓDULO VENDAS/FINANCEIRO

**Data:** 30/01/2026  
**Objetivo:** Profissionalizar cálculos financeiros e UI de vendas

---

## 🔍 **ESTADO ATUAL**

### **Interface Venda (src/types/index.ts)**
```typescript
export interface Venda {
  // Identificação
  id: string;
  numero_venda?: string;
  
  // Cliente
  clienteId?: string;
  clienteNome?: string;
  clienteTelefone?: string;
  
  // Itens
  itens: ItemVenda[];
  
  // Financeiro (ATUAL)
  total: number;                      // ✅ Total bruto
  total_bruto?: number;               // ✅ Alias
  desconto?: number;                  // ✅ Desconto (valor fixo)
  taxa_cartao_valor?: number;         // ✅ Taxa calculada
  taxa_cartao_percentual?: number;    // ✅ Percentual usado
  total_liquido?: number;             // ✅ Total final
  formaPagamento: FormaPagamento;     // ✅ dinheiro/cartao/pix/boleto/outro
  
  // Metadata
  vendedor: string;
  data: string;
  storeId?: string;
}

export interface ItemVenda {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  custoUnitario?: number;  // ✅ JÁ EXISTE
  custoTotal?: number;      // ✅ JÁ EXISTE
}
```

### **Lógica de Cálculo (src/lib/vendas.ts)**
```typescript
// ✅ Já calculam:
- calcTotalBrutoVenda(itens) → soma subtotais
- calcTaxaCartao(valor, percentual) → valor * percentual / 100
- calcTotalLiquido(bruto, desconto, taxa) → bruto - desconto - taxa
- calcCustoItem(item) → quantidade * custoUnitario
```

### **SimularTaxasPage (src/pages/SimularTaxasPage.tsx)**
```typescript
// ✅ JÁ EXISTE com:
- Bandeiras (Visa, Mastercard, Elo, Amex)
- Taxas por parcela (1x-12x)
- Débito separado
- Simulador completo
```

---

## ❌ **O QUE FALTA**

### **1. Interface Venda - Campos Novos:**
```typescript
// ADICIONAR:
parcelas?: number;              // 1-12 (quando crédito)
desconto_tipo?: 'valor' | 'percentual';  // Tipo do desconto
custo_total?: number;           // Soma custos dos itens
lucro_bruto?: number;           // total_final - custo_total
lucro_liquido?: number;         // total_liquido - custo_total
```

### **2. FormaPagamento - Separar Crédito/Débito:**
```typescript
// ATUAL: 'dinheiro' | 'cartao' | 'pix' | 'boleto' | 'outro'
// NOVO:  'dinheiro' | 'pix' | 'debito' | 'credito' | 'outro'
```

### **3. Tabela de Taxas Configurável:**
```sql
-- Nova tabela:
CREATE TABLE taxas_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  forma_pagamento TEXT NOT NULL,  -- 'dinheiro', 'pix', 'debito', 'credito'
  parcelas INT DEFAULT 1,          -- 1-12 para crédito
  taxa_percentual DECIMAL(5,2) NOT NULL DEFAULT 0,
  taxa_fixa DECIMAL(10,2) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, forma_pagamento, parcelas)
);
```

### **4. UI Nova Venda - Melhorias:**
- [x] Campo parcelas (1-12) quando crédito
- [x] Desconto em R$ ou %
- [x] Resumo financeiro completo:
  ```
  Bruto:          R$ 100,00
  Desconto:       R$ 10,00 (10%)
  Total Final:    R$ 90,00
  Taxa (2.5%):    R$ 2,25
  Líquido:        R$ 87,75
  Custo:          R$ 60,00
  Lucro Bruto:    R$ 30,00
  Lucro Líquido:  R$ 27,75
  ```

### **5. Página Configurações - Nova Seção:**
- Tabela de taxas por forma de pagamento
- Editar taxas por parcela (crédito)
- Salvar por store_id

### **6. Relatórios - Expandir:**
- Total bruto
- Total descontos
- Total taxas
- Total líquido
- Custo total
- Lucro bruto
- Lucro líquido
- Breakdown por forma_pagamento
- Breakdown por parcelas

---

## 📁 **ARQUIVOS A CRIAR/MODIFICAR**

### **Criar:**
```
supabase/migrations/20260130_vendas_financeiro_completo.sql
src/lib/taxas-pagamento.ts
src/components/ResumoFinanceiro.tsx
```

### **Modificar:**
```
src/types/index.ts                  (+10 linhas)
src/lib/vendas.ts                   (+50 linhas)
src/lib/finance/calc.ts             (+30 linhas)
src/pages/VendasPage.tsx            (+150 linhas)
src/pages/ConfiguracoesPage.tsx     (+200 linhas)
src/pages/RelatoriosPage.tsx        (+100 linhas)
src/pages/FluxoCaixaPage.tsx        (+20 linhas)
```

---

## 🎯 **PLANO DE IMPLEMENTAÇÃO**

### **FASE 1: Schema e Migrations (30 min)**
1. Criar migration para adicionar campos em `vendas`
2. Criar tabela `taxas_pagamento`
3. Inserir taxas padrão
4. Backfill vendas existentes (safe)

### **FASE 2: Services e Cálculos (30 min)**
5. Criar `src/lib/taxas-pagamento.ts`
6. Atualizar `src/lib/finance/calc.ts`
7. Atualizar `src/lib/vendas.ts` (criarVenda)

### **FASE 3: UI Nova Venda (60 min)**
8. Atualizar interface Venda em types
9. Adicionar campos na VendasPage
10. Criar ResumoFinanceiro component
11. Integrar cálculo em tempo real

### **FASE 4: Configurações (30 min)**
12. Criar seção "Taxas de Pagamento"
13. Permitir editar taxas
14. Salvar por store_id

### **FASE 5: Relatórios (30 min)**
15. Atualizar RelatoriosPage
16. Adicionar métricas financeiras
17. Breakdown por forma/parcelas

### **FASE 6: Testes e Docs (20 min)**
18. Testar fluxo completo
19. Criar RELATORIO_IMPLEMENTACAO.md
20. Commit e deploy

**TOTAL: ~3h30min**

---

## ✅ **PONTOS FORTES JÁ IMPLEMENTADOS**

1. ✅ Cálculo de taxa de cartão funcional
2. ✅ Total líquido já calculado
3. ✅ Custo unitário já snapshoteado nos itens
4. ✅ SimularTaxasPage já existe
5. ✅ Multi-tenant (store_id) já implementado
6. ✅ RLS já configurado
7. ✅ Financeiro/FluxoCaixa já existentes

---

## 🚀 **COMEÇANDO IMPLEMENTAÇÃO**

**Próxima Ação:** Criar migration SQL
