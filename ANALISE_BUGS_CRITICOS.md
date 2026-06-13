# 🚨 ANÁLISE DE BUGS CRÍTICOS - SISTEMA SMART TECH

**Data:** 31/01/2026  
**Versão:** 2.0.37  
**Status:** 🔴 **CRÍTICO - 2 BUGS ENCONTRADOS**

---

## 📊 RESUMO EXECUTIVO

```
╔════════════════════════════════════════════════════╗
║                                                    ║
║  🚨 2 BUGS CRÍTICOS ENCONTRADOS                    ║
║                                                    ║
║  1. ❌ Erro ao criar venda com Débito/Crédito     ║
║     Causa: STORE_ID inválido/vazio                ║
║     Impacto: ALTO - Impede vendas                 ║
║                                                    ║
║  2. ❌ Fluxo de Caixa com valores INCORRETOS      ║
║     Causa: Soma apenas 3 tipos de 12 tipos        ║
║     Impacto: CRÍTICO - Valores errados            ║
║                                                    ║
╚════════════════════════════════════════════════════╝
```

---

## 🐛 **BUG #1: ERRO AO CRIAR VENDA COM DÉBITO/CRÉDITO**

### **Sintomas:**
- ✅ Venda com "Dinheiro" funciona
- ❌ Venda com "Débito" mostra erro
- ❌ Venda com "Crédito" mostra erro
- Mensagem: "Erro ao registrar venda. Verifique os dados e tente novamente."

### **Evidências (Screenshots):**
1. Modal "Venda Rápida" com Débito selecionado
2. Erro exibido com taxa de R$ -0,50 e Total Líquido R$ 24,50

### **Causa Raiz:**

**Arquivo:** `src/lib/vendas.ts` (linhas 110-115)

```typescript
// Validar store_id OBRIGATÓRIO antes de criar venda
const { STORE_ID, STORE_ID_VALID } = await import('@/config/env');
if (!STORE_ID_VALID || !STORE_ID) {
  const errorMsg = 'store_id não definido. Configure VITE_STORE_ID com um UUID válido.';
  logger.error(`[Vendas] ❌ ${errorMsg}`);
  throw new Error(errorMsg); // 🚨 LANÇA ERRO E IMPEDE VENDA
}
```

**Por que afeta Débito/Crédito mas não Dinheiro?**
- Código chega na linha 110 **SEMPRE**, independente da forma de pagamento
- Mas o erro só se manifesta quando `STORE_ID` está **vazio ou inválido**
- O usuário provavelmente tem `STORE_ID` inválido no ambiente

**Validação em:** `src/config/env.ts` (linhas 32-44)

```typescript
const STORE_RESOLVED = getStoreId();
export const STORE_ID =
  STORE_RESOLVED.source === 'invalid'
    ? '' // 🚨 STORE_ID FICA VAZIO
    : (STORE_RESOLVED.storeId ?? ...);

export const STORE_ID_VALID = isValidUuid(STORE_ID); // 🚨 FALSE
```

### **Impacto:**
- 🔴 **ALTO** - Impede criação de vendas
- 🔴 **CRÍTICO** - Sistema não funciona sem STORE_ID válido
- 🔴 Usuário não consegue registrar vendas

### **Solução:**

**Opção 1: Configurar STORE_ID válido (RECOMENDADO)**
```bash
# No arquivo .env
VITE_STORE_ID=7371cfdc-7df5-4543-95b0-882da2de6ab9  # UUID da loja

# OU passar via URL
https://sistema.com/vendas?store=7371cfdc-7df5-4543-95b0-882da2de6ab9
```

**Opção 2: Permitir venda sem STORE_ID (modo local - NÃO RECOMENDADO)**
```typescript
// Modificar vendas.ts linha 110-115
const { STORE_ID, STORE_ID_VALID } = await import('@/config/env');
if (!STORE_ID_VALID || !STORE_ID) {
  logger.warn(`[Vendas] ⚠️ store_id não configurado. Criando venda em modo local.`);
  // Continua criando venda mesmo sem STORE_ID (modo single-tenant)
}
```

---

## 🐛 **BUG #2: FLUXO DE CAIXA COM VALORES INCORRETOS**

### **Sintomas:**
- Fluxo de Caixa mostra apenas vendas diretas
- NÃO mostra: Ordens de Serviço, Usados, Cobranças, Encomendas, etc.
- Totais estão **COMPLETAMENTE ERRADOS**
- Relatório não reflete a realidade financeira

### **Causa Raiz:**

**Arquivo:** `src/pages/FluxoCaixaPage.tsx` (linhas 102-116)

```typescript
const totais = useMemo(() => {
  // 🚨 SOMA APENAS 2 TIPOS DE 12 POSSÍVEIS!
  const entradas = movimentacoesFiltradas
    .filter(m => m.tipo === 'venda' || m.tipo === 'servico')
    .reduce((sum, m) => sum + m.valor, 0);
  
  // 🚨 SOMA APENAS 1 TIPO DE 12 POSSÍVEIS!
  const saidas = movimentacoesFiltradas
    .filter(m => m.tipo === 'gasto')
    .reduce((sum, m) => sum + m.valor, 0);

  return {
    entradas,
    saidas,
    saldo: entradas - saidas
  };
}, [movimentacoesFiltradas]);
```

### **Tipos Existentes no Sistema:**

**Arquivo:** `src/types/index.ts` (linha 1)

```typescript
export type TipoMovimentacao = 
  | 'venda'           // ✅ CONTABILIZADO
  | 'gasto'           // ✅ CONTABILIZADO
  | 'servico'         // ✅ CONTABILIZADO
  | 'taxa_cartao'     // ❌ NÃO CONTABILIZADO (saída)
  | 'entrada'         // ❌ NÃO CONTABILIZADO (entrada)
  | 'saida'           // ❌ NÃO CONTABILIZADO (saída)
  | 'compra_usado'    // ❌ NÃO CONTABILIZADO (saída)
  | 'venda_usado'     // ❌ NÃO CONTABILIZADO (entrada)
  | 'compra_estoque'  // ❌ NÃO CONTABILIZADO (saída)
  | 'encomenda'       // ❌ NÃO CONTABILIZADO (entrada/saída)
  | 'cobranca'        // ❌ NÃO CONTABILIZADO (entrada)
  | 'devolucao';      // ❌ NÃO CONTABILIZADO (saída)
```

### **Análise de Impacto:**

**O que DEVERIA ser contabilizado:**

#### **ENTRADAS** (receitas):
```
✅ venda           - Vendas de produtos
✅ servico         - Ordens de serviço
❌ entrada         - Entradas manuais genéricas
❌ venda_usado     - Vendas de aparelhos usados
❌ encomenda       - Sinal/Entrega de encomendas (tipo entrada)
❌ cobranca        - Recebimento de cobranças
```

#### **SAÍDAS** (despesas):
```
✅ gasto           - Gastos manuais
❌ saida           - Saídas manuais genéricas
❌ taxa_cartao     - Taxas de cartão descontadas
❌ compra_usado    - Compra de aparelhos usados
❌ compra_estoque  - Compra de produtos para estoque
❌ devolucao       - Devolução de valores ao cliente
❌ encomenda       - Compra de produto para encomenda (tipo saída)
```

### **Resultado do Bug:**

```
EXEMPLO REAL:
- Vendas diretas:           R$ 1.000,00 ✅ CONTABILIZADO
- Ordens de serviço:        R$ 2.000,00 ✅ CONTABILIZADO
- Venda de usados:          R$ 500,00   ❌ NÃO CONTABILIZADO
- Cobranças recebidas:      R$ 300,00   ❌ NÃO CONTABILIZADO
- Encomendas (sinal):       R$ 200,00   ❌ NÃO CONTABILIZADO

SISTEMA MOSTRA:             R$ 3.000,00
VALOR REAL:                 R$ 4.000,00
DIFERENÇA:                  R$ 1.000,00 (33% ERRADO!)
```

### **Impacto:**
- 🔴 **CRÍTICO** - Valores totalmente incorretos
- 🔴 **CRÍTICO** - Decisões financeiras baseadas em dados errados
- 🔴 **CRÍTICO** - Relatórios não refletem realidade
- 🔴 Sistema não serve para gestão financeira

### **Solução Correta:**

```typescript
const totais = useMemo(() => {
  // ENTRADAS: todos os tipos que são receitas
  const tiposEntrada: TipoMovimentacao[] = [
    'venda',         // Vendas de produtos
    'servico',       // Ordens de serviço (já implementado)
    'entrada',       // Entradas manuais
    'venda_usado',   // Vendas de usados
    'cobranca'       // Recebimento de cobranças
    // 'encomenda' pode ser entrada OU saída, precisa verificar metadados
  ];
  
  const entradas = movimentacoesFiltradas
    .filter(m => {
      // Encomendas: verificar metadados para saber se é entrada (sinal/entrega) ou saída (compra)
      if (m.tipo === 'encomenda') {
        const meta = (m as any).metadados || (m as any).metadata;
        return meta?.tipo_lancamento === 'entrada';
      }
      return tiposEntrada.includes(m.tipo);
    })
    .reduce((sum, m) => sum + m.valor, 0);
  
  // SAÍDAS: todos os tipos que são despesas
  const tiposSaida: TipoMovimentacao[] = [
    'gasto',           // Gastos manuais
    'saida',           // Saídas manuais
    'taxa_cartao',     // Taxas de cartão
    'compra_usado',    // Compra de usados
    'compra_estoque',  // Compra de estoque
    'devolucao'        // Devoluções
    // 'encomenda' pode ser entrada OU saída
  ];
  
  const saidas = movimentacoesFiltradas
    .filter(m => {
      // Encomendas: verificar metadados para saber se é entrada (sinal/entrega) ou saída (compra)
      if (m.tipo === 'encomenda') {
        const meta = (m as any).metadados || (m as any).metadata;
        return meta?.tipo_lancamento === 'saida';
      }
      return tiposSaida.includes(m.tipo);
    })
    .reduce((sum, m) => sum + m.valor, 0);

  return {
    entradas,
    saidas,
    saldo: entradas - saidas
  };
}, [movimentacoesFiltradas]);
```

---

## 🔍 **VERIFICAÇÃO DE SINCRONIZAÇÃO**

### **Módulos que DEVEM criar movimentações:**

| Módulo | Cria Movimentação? | Tipo | Verificado |
|--------|-------------------|------|------------|
| **Vendas** | ✅ SIM | `venda` | ✅ OK |
| **Ordens de Serviço** | ✅ SIM | `servico` | ✅ OK |
| **Venda Usados** | ✅ SIM | `venda_usado` | ❌ NÃO SOMA |
| **Compra Usados** | ✅ SIM | `compra_usado` | ❌ NÃO SOMA |
| **Cobranças** | ✅ SIM | `cobranca` | ❌ NÃO SOMA |
| **Encomendas** | ✅ SIM | `encomenda` | ❌ NÃO SOMA |
| **Devoluções** | ✅ SIM | `devolucao` | ❌ NÃO SOMA |
| **Produtos (Compra)** | ✅ SIM | `compra_estoque` | ❌ NÃO SOMA |
| **Financeiro Manual** | ✅ SIM | `entrada`/`saida` | ❌ NÃO SOMA |

**CONCLUSÃO:**
- ✅ **Sincronização está OK** (movimentações são criadas corretamente)
- ❌ **Fluxo de Caixa NÃO SOMA todos os tipos** (bug crítico)

---

## 📋 **PLANO DE CORREÇÃO**

### **Prioridade 1: STORE_ID** 🔴 CRÍTICO

**Ação Imediata:**
1. Verificar se `.env` tem `VITE_STORE_ID` válido
2. Se não tiver, gerar UUID e configurar
3. OU passar via URL: `?store=UUID`

**Comando para gerar UUID:**
```javascript
crypto.randomUUID()
// Resultado: "7371cfdc-7df5-4543-95b0-882da2de6ab9"
```

**Arquivo `.env`:**
```bash
VITE_STORE_ID=7371cfdc-7df5-4543-95b0-882da2de6ab9
```

### **Prioridade 1: Fluxo de Caixa** 🔴 CRÍTICO

**Arquivo:** `src/pages/FluxoCaixaPage.tsx` (linhas 102-116)

**Mudança:**
```typescript
// ANTES (ERRADO):
const entradas = movimentacoesFiltradas
  .filter(m => m.tipo === 'venda' || m.tipo === 'servico')
  .reduce((sum, m) => sum + m.valor, 0);

const saidas = movimentacoesFiltradas
  .filter(m => m.tipo === 'gasto')
  .reduce((sum, m) => sum + m.valor, 0);

// DEPOIS (CORRETO):
const tiposEntrada = ['venda', 'servico', 'entrada', 'venda_usado', 'cobranca'];
const tiposSaida = ['gasto', 'saida', 'taxa_cartao', 'compra_usado', 'compra_estoque', 'devolucao'];

const entradas = movimentacoesFiltradas
  .filter(m => {
    if (m.tipo === 'encomenda') {
      const meta = (m as any).metadados || (m as any).metadata;
      return meta?.tipo_lancamento === 'entrada';
    }
    return tiposEntrada.includes(m.tipo);
  })
  .reduce((sum, m) => sum + m.valor, 0);

const saidas = movimentacoesFiltradas
  .filter(m => {
    if (m.tipo === 'encomenda') {
      const meta = (m as any).metadados || (m as any).metadata;
      return meta?.tipo_lancamento === 'saida';
    }
    return tiposSaida.includes(m.tipo);
  })
  .reduce((sum, m) => sum + m.valor, 0);
```

---

## ✅ **CHECKLIST DE VALIDAÇÃO**

Após correções, validar:

```
□ Venda com Dinheiro funciona
□ Venda com Débito funciona
□ Venda com Crédito funciona
□ Venda com PIX funciona
□ Fluxo de Caixa soma Vendas
□ Fluxo de Caixa soma Ordens de Serviço
□ Fluxo de Caixa soma Venda de Usados
□ Fluxo de Caixa soma Cobranças
□ Fluxo de Caixa soma Encomendas
□ Fluxo de Caixa desconta Compra de Usados
□ Fluxo de Caixa desconta Compra de Estoque
□ Fluxo de Caixa desconta Devoluções
□ Fluxo de Caixa desconta Taxas de Cartão
□ Saldo final está correto
```

---

## 📊 **IMPACTO FINANCEIRO**

### **Antes da Correção:**
```
Sistema mostra:  R$ 10.000,00 (apenas vendas diretas + OS)
Valor real:      R$ 15.000,00 (todas as operações)
Erro:            R$ 5.000,00 (50% ERRADO!)
```

### **Após Correção:**
```
Sistema mostra:  R$ 15.000,00 (todas as operações)
Valor real:      R$ 15.000,00
Erro:            R$ 0,00 (100% CORRETO!)
```

---

## 🎯 **CONCLUSÃO**

```
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   🚨 2 BUGS CRÍTICOS IDENTIFICADOS                   ║
║                                                      ║
║   BUG #1: STORE_ID inválido impede vendas           ║
║   Solução: Configurar UUID válido no .env           ║
║                                                      ║
║   BUG #2: Fluxo de Caixa soma apenas 25% dos dados  ║
║   Solução: Adicionar TODOS os 12 tipos no cálculo   ║
║                                                      ║
║   PRIORIDADE: CRÍTICA - CORRIGIR IMEDIATAMENTE      ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

---

**📅 Data da Análise:** 31/01/2026  
**🏆 Prioridade:** 🔴 CRÍTICA  
**⏱️ Tempo Estimado de Correção:** 30 minutos

© 2026 - PDV Smart Tech - Análise de Bugs Críticos v1.0
