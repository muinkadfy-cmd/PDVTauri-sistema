# 💰 Módulo Financeiro Completo - Smart Tech Rolândia

## ✅ CONCLUÍDO

### 📋 Resumo das Implementações

Módulo financeiro completo implementado com relatórios profissionais, cálculo de lucro real, taxas de cartão e lançamentos automáticos. Sistema offline-first com sincronização Supabase.

---

## 📁 Arquivos Criados/Modificados

### ✨ Novos Arquivos

1. **`src/lib/finance/calc.ts`**
   - Funções puras de cálculo financeiro
   - `calcTotalBrutoVenda()`, `calcTotalBrutoOS()`
   - `calcTaxaCartao()`, `calcTotalLiquido()`
   - `calcCustoVenda()`, `calcCustoOS()`
   - `calcLucro()`, `calcMargem()`
   - `normalizarVenda()`, `normalizarOS()`
   - `criarPeriodo()`, `estaNoPeriodo()`

2. **`src/lib/finance/reports.ts`**
   - Geração de relatórios financeiros completos
   - `gerarRelatorioFinanceiro()` - relatório completo por período
   - Cálculo de KPIs, top produtos, taxas detalhadas

3. **`src/lib/finance/lancamentos.ts`**
   - Lançamentos financeiros automáticos
   - `criarLancamentosVenda()` - cria entrada + taxa cartão (se aplicável)
   - `criarLancamentosOS()` - cria entrada + taxa cartão (se aplicável)
   - Prevenção de duplicação (verifica existência)

4. **`src/pages/RelatoriosPage.tsx` + `.css`**
   - Página completa de relatórios financeiros
   - Filtros de período (Hoje, 7 dias, Mês, Personalizado)
   - 9 Cards KPI principais
   - Tabelas: Por forma de pagamento, Top 10 produtos, Taxas detalhadas
   - Resumo comparativo Vendas vs OS

5. **`migracao_financeiro.sql`**
   - SQL completo para adicionar novos campos no Supabase
   - ALTER TABLE para vendas, venda_itens, ordens_servico, produtos, financeiro
   - Migração de dados existentes
   - Índices para performance
   - Comentários de documentação

### 🔧 Arquivos Modificados

1. **`src/types/index.ts`**
   - **Venda**: Adicionados campos:
     - `total_bruto`, `taxa_cartao_valor`, `taxa_cartao_percentual`
     - `total_liquido`, `status_pagamento`, `data_pagamento`
     - `data_prevista_recebimento`
     - `FormaPagamento` expandido: 'dinheiro' | 'cartao' | 'pix' | 'boleto' | 'outro'
     - `StatusPagamento`: 'pago' | 'pendente' | 'cancelado'
   - **ItemVenda**: Adicionados `custoUnitario`, `custoTotal`
   - **OrdemServico**: Adicionados campos financeiros similares + `custo_interno`
   - **Produto**: Adicionado `custo_unitario` (alias para `custo`)
   - **Movimentacao**: Adicionados `origem_tipo`, `origem_id`, `categoria`, `forma_pagamento`
   - **TipoMovimentacao**: Expandido: 'venda' | 'gasto' | 'servico' | 'taxa_cartao' | 'entrada' | 'saida'

2. **`src/lib/vendas.ts`**
   - Cálculo automático de campos financeiros
   - Cálculo de custos dos itens
   - Integração com `criarLancamentosVenda()`
   - Normalização de dados

3. **`src/lib/ordens.ts`**
   - Cálculo automático de campos financeiros
   - Recalculo ao atualizar
   - Criação de lançamentos quando `status_pagamento` muda para 'pago'
   - Integração com `criarLancamentosOS()`

4. **`src/lib/repository/schema-map.ts`**
   - Atualizado schema de `vendas` com novos campos
   - Atualizado schema de `venda_itens` com custos
   - Atualizado schema de `ordens_servico` com novos campos
   - Atualizado schema de `produtos` com `custo_unitario`
   - Atualizado schema de `financeiro` com metadados

5. **`src/pages/FinanceiroPage.tsx`**
   - Atualizado `getTipoLabel()` e `getTipoIcon()` para novos tipos
   - Suporte para 'taxa_cartao', 'entrada', 'saida'

6. **`src/components/ui/StatCard.tsx`**
   - Adicionado suporte para cor 'red'

7. **`src/app/routes.tsx`**
   - Adicionada rota `/relatorios`

8. **`src/components/layout/Sidebar.tsx`**
   - Adicionado item "Relatórios" no menu

---

## 🎯 Funcionalidades Implementadas

### 1) PADRONIZAÇÃO DO MODELO DE DADOS ✅

- ✅ **Vendas**:
  - `total_bruto` (soma dos subtotais)
  - `desconto` (desconto comercial)
  - `taxa_cartao_valor` e `taxa_cartao_percentual`
  - `total_liquido` = total_bruto - desconto - taxa_cartao_valor
  - `status_pagamento`, `data_pagamento`, `data_prevista_recebimento`

- ✅ **Ordens de Serviço**:
  - `total_bruto` (valorServico + valorPecas)
  - `desconto`, `taxa_cartao_valor`, `taxa_cartao_percentual`
  - `total_liquido`, `custo_interno`
  - `status_pagamento`, `data_pagamento`, `data_prevista_recebimento`

- ✅ **Produtos**:
  - `custo` / `custo_unitario` (CMV)

- ✅ **ItemVenda**:
  - `custoUnitario`, `custoTotal` (calculado automaticamente)

### 2) CUSTOS E LUCRO ✅

- ✅ **CMV (Custo Mercadoria Vendida)**:
  - Calculado por item: `quantidade * custo_unitario`
  - Total: soma de todos os itens

- ✅ **Custo OS**:
  - `valorPecas` + `custo_interno` (mão de obra)

- ✅ **Cálculos**:
  - `receita_liquida` = total_liquido (vendas + OS)
  - `custo_total` = CMV + custo_pecas + custo_interno
  - `lucro` = receita_liquida - custo_total
  - `margem` = lucro / receita_liquida (com proteção divisão por zero)

- ✅ **Indicadores**:
  - Se custo não disponível, mostra "lucro estimado"
  - Indicação de dados faltantes

### 3) LANÇAMENTOS AUTOMÁTICOS ✅

- ✅ **Ao finalizar venda/OS como pago**:
  - Cria lançamento tipo 'entrada' com `valor = total_liquido`
  - `categoria = 'venda'` ou `'ordem_servico'`
  - `forma_pagamento` preservada
  - `data_lancamento = data_pagamento` (ou hoje)

- ✅ **Taxa de cartão**:
  - Se `forma_pagamento == 'cartao'` e `taxa_cartao_valor > 0`:
  - Cria lançamento tipo 'saida' / 'taxa_cartao'
  - `valor = taxa_cartao_valor`
  - `categoria = 'taxa_cartao'`
  - Vinculado à `venda_id` ou `os_id`

- ✅ **Prevenção de duplicação**:
  - Verifica existência antes de criar
  - Usa `origem_id` e `origem_tipo` para identificar

### 4) RELATÓRIOS E ANÁLISES ✅

- ✅ **Página `/relatorios`**:
  - Filtro de período (Hoje, 7 dias, Mês, Personalizado)
  - 9 Cards KPI:
    - Receita Bruta, Descontos, Taxas Cartão
    - Receita Líquida, Custos, Lucro, Margem
    - Entradas, Saídas, Saldo

- ✅ **Tabelas/Resumos**:
  - Por forma de pagamento (quantidade, receita bruta/líquida)
  - Vendas vs OS (comparativo completo)
  - Top 10 produtos (receita, custo, lucro, margem)
  - Taxas de cartão detalhadas (origem, valor, percentual, data)

- ✅ **Responsivo**:
  - Web e mobile com CSS puro
  - Grid adaptativo
  - Tabelas com componente `Table` reutilizável

### 5) REGRAS E CONSISTÊNCIA ✅

- ✅ **Arquivo centralizado**: `src/lib/finance/calc.ts`
  - Todas as funções de cálculo em um único lugar
  - Funções puras (sem side effects)
  - Reutilizáveis em todo o sistema

- ✅ **Padronização**:
  - `normalizarVenda()` e `normalizarOS()` garantem campos calculados
  - Todas as telas usam as mesmas funções
  - Cálculo duplicado evitado

- ✅ **Fluxo de Caixa e Financeiro**:
  - Usam o mesmo padrão de cálculo
  - Dados consistentes

### 6) OFFLINE-FIRST + SYNC ✅

- ✅ **Relatórios offline**:
  - Funcionam com base no LocalStorage
  - Dados carregados via `getVendas()`, `getOrdens()`, etc.

- ✅ **Sincronização**:
  - Quando online, reflete dados do Supabase
  - Indicador de pendências no topo da página

- ✅ **Não trava**:
  - Se houver outbox pendente, apenas indica
  - Sistema continua funcionando

### 7) SQL MIGRAÇÃO ✅

- ✅ **Arquivo `migracao_financeiro.sql`**:
  - ALTER TABLE para todas as tabelas
  - Migração de dados existentes
  - Índices para performance
  - Comentários de documentação
  - Compatível com dados existentes (campos opcionais)

---

## 📊 Estrutura de Cálculo

### Vendas
```
total_bruto = Σ(subtotal dos itens)
desconto = desconto comercial (opcional)
taxa_cartao_valor = (total_bruto - desconto) * taxa_cartao_percentual / 100
total_liquido = total_bruto - desconto - taxa_cartao_valor
custo_total = Σ(quantidade * custo_unitario por item)
lucro = total_liquido - custo_total
```

### Ordens de Serviço
```
total_bruto = valorServico + valorPecas
desconto = desconto comercial (opcional)
taxa_cartao_valor = (total_bruto - desconto) * taxa_cartao_percentual / 100
total_liquido = total_bruto - desconto - taxa_cartao_valor
custo_total = valorPecas + custo_interno
lucro = total_liquido - custo_total
```

---

## 🎨 Interface de Relatórios

### Filtros de Período
- **Hoje**: Apenas transações de hoje
- **7 Dias**: Últimos 7 dias
- **Mês**: Mês atual completo
- **Personalizado**: Seleção de data início e fim

### Cards KPI (9 cards)
1. Receita Bruta
2. Descontos
3. Taxas Cartão
4. Receita Líquida
5. Custos
6. Lucro (com margem)
7. Entradas
8. Saídas
9. Saldo

### Tabelas
- **Por Forma de Pagamento**: Dinheiro, Cartão, PIX, Boleto, Outro
- **Top 10 Produtos**: Receita, Custo, Lucro, Margem
- **Taxas de Cartão Detalhadas**: Origem, Valor, Percentual, Data

### Resumo Comparativo
- **Vendas**: Quantidade, Receita Bruta/Líquida, Custos, Lucro
- **OS**: Quantidade, Receita Bruta/Líquida, Custos, Lucro

---

## 🔄 Fluxo de Lançamentos

### Venda Criada
1. Calcula `total_liquido`
2. Se `status_pagamento === 'pago'`:
   - Cria entrada: `tipo='entrada'`, `valor=total_liquido`, `categoria='venda'`
3. Se `formaPagamento === 'cartao'` e `taxa_cartao_valor > 0`:
   - Cria saída: `tipo='taxa_cartao'`, `valor=taxa_cartao_valor`, `categoria='taxa_cartao'`

### OS Criada/Atualizada
1. Calcula `total_liquido`
2. Se `status_pagamento === 'pago'`:
   - Cria entrada: `tipo='servico'`, `valor=total_liquido`, `categoria='ordem_servico'`
3. Se `formaPagamento === 'cartao'` e `taxa_cartao_valor > 0`:
   - Cria saída: `tipo='taxa_cartao'`, `valor=taxa_cartao_valor`, `categoria='taxa_cartao'`

### Prevenção de Duplicação
- Verifica se já existe lançamento com `origem_id` e `origem_tipo`
- Não cria duplicado

---

## 📝 SQL de Migração

O arquivo `migracao_financeiro.sql` contém:

1. **ALTER TABLE vendas**: Adiciona 7 novos campos
2. **ALTER TABLE venda_itens**: Adiciona 2 campos de custo
3. **ALTER TABLE ordens_servico**: Adiciona 9 novos campos
4. **ALTER TABLE produtos**: Adiciona `custo_unitario`
5. **ALTER TABLE financeiro**: Adiciona 4 campos de metadados
6. **UPDATE**: Migra dados existentes
7. **CREATE INDEX**: Índices para performance
8. **COMMENT**: Documentação das colunas

**Para aplicar**: Copie e cole o conteúdo de `migracao_financeiro.sql` no SQL Editor do Supabase.

---

## ✅ Garantias

- ✅ Nenhuma funcionalidade quebrada
- ✅ Compatibilidade com dados existentes
- ✅ Cálculos padronizados e consistentes
- ✅ Offline-first mantido
- ✅ Sincronização Supabase preservada
- ✅ Build sem erros
- ✅ UX limpa e profissional

---

## 🚀 Como Usar

### 1. Aplicar Migração SQL
```sql
-- Execute migracao_financeiro.sql no Supabase
```

### 2. Criar Venda com Taxa de Cartão
```typescript
const venda = await criarVenda({
  itens: [...],
  total: 1000,
  desconto: 50,
  taxa_cartao_percentual: 3.5, // 3.5%
  formaPagamento: 'cartao',
  status_pagamento: 'pago',
  // ... outros campos
});
// Automaticamente calcula:
// - total_bruto = 1000
// - taxa_cartao_valor = (1000 - 50) * 3.5 / 100 = 33.25
// - total_liquido = 1000 - 50 - 33.25 = 916.75
// - Cria lançamento entrada: R$ 916.75
// - Cria lançamento saída (taxa): R$ 33.25
```

### 3. Visualizar Relatórios
- Acesse `/relatorios`
- Selecione período
- Visualize KPIs, tabelas e análises

---

**Data de Conclusão:** $(date)
**Versão:** 1.0.0
**Status:** ✅ CONCLUÍDO
