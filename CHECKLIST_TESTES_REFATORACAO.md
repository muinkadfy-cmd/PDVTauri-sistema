# ✅ CHECKLIST DE TESTES - REFATORAÇÃO FINANCEIRO

**Data:** 31/01/2026  
**Deploy:** Aguardando (2-3 minutos)

---

## 🎯 **OBJETIVO**

Validar que todas as mudanças da refatoração estão funcionando corretamente em produção.

---

## 📋 **TESTES OBRIGATÓRIOS**

### **✅ TESTE 1: Painel Simplificado**

**Passos:**
1. Ir em `/painel`
2. Dar **F5** (limpar cache)
3. Verificar layout

**Resultado Esperado:**
- ✅ Seção "Resumo Financeiro (Hoje)" existe
- ✅ Seção "Entradas por Setor (Hoje)" existe
- ❌ **NÃO existe** seção "Fluxo de Caixa (Geral)"
- ❌ **NÃO existe** card "Saldo Atual" duplicado
- ✅ Se saldo negativo: **AVISO VERMELHO** aparece

**Status:** [ ] Passou | [ ] Falhou

---

### **✅ TESTE 2: Fluxo de Caixa - 4 Cards**

**Passos:**
1. Ir em `/fluxo-caixa`
2. Dar **F5** (limpar cache)
3. Contar os cards de resumo

**Resultado Esperado:**
- ✅ **4 cards apenas:**
  1. Saldo Inicial (se período != todos)
  2. Total Entradas
  3. Total Saídas
  4. Saldo do Período
- ❌ **NÃO existe** card "Saldo Atual"
- ✅ Filtro "Origem" tem opção "🔄 Estornos"

**Status:** [ ] Passou | [ ] Falhou

---

### **✅ TESTE 3: Aviso de Saldo Negativo**

**Passos:**
1. Criar uma **Retirada de Caixa** de valor alto (ex: R$ 10.000)
2. Ir em `/painel`
3. Verificar se aparece aviso

**Resultado Esperado:**
- ✅ No **Painel**: Caixa vermelho com texto:
  > ⚠️ ATENÇÃO: Saldo negativo! Verifique saídas não registradas.
- ✅ No **Fluxo de Caixa**: Caixa vermelho com texto:
  > ⚠️ ATENÇÃO: Saldo atual está NEGATIVO (R$ -X.XXX,XX)!

**Status:** [ ] Passou | [ ] Falhou

---

### **✅ TESTE 4: Estornos Profissionais**

**Passos:**
1. Criar uma **Venda** de R$ 100,00
2. Anotar o **número da venda** (ex: V-0123)
3. **Deletar** a venda
4. Ir em `/fluxo-caixa`
5. Filtrar por **Origem: 🔄 Estornos**

**Resultado Esperado:**
- ✅ Aparece movimentação:
  - **Tipo:** Saída (vermelho)
  - **Descrição:** "Estorno de Venda 0123"
  - **Valor:** R$ 100,00
  - **Origem:** Estorno (badge específico)
- ✅ Se expandir detalhes, deve ter `origem_tipo = 'estorno'`

**Status:** [ ] Passou | [ ] Falhou

---

### **✅ TESTE 5: OS, Cobranças e Recibos**

**Repetir TESTE 4 para:**

**5A. Ordem de Serviço:**
1. Criar OS paga de R$ 50
2. Deletar
3. Verificar "Estorno de OS 0456" no Fluxo

**5B. Cobrança:**
1. Criar cobrança paga de R$ 30
2. Deletar
3. Verificar "Estorno de Cobrança #abc123" no Fluxo

**5C. Recibo:**
1. Emitir recibo de R$ 20
2. Deletar
3. Verificar "Estorno de Recibo 001" no Fluxo

**Status:**  
- [ ] OS - Passou | [ ] Falhou  
- [ ] Cobrança - Passou | [ ] Falhou  
- [ ] Recibo - Passou | [ ] Falhou

---

### **✅ TESTE 6: Valores do Painel Batem com Fluxo**

**Passos:**
1. Anotar valores do **Painel** (Entradas Hoje, Saídas Hoje)
2. Ir em **Fluxo de Caixa**
3. Filtrar por **Período: Hoje**
4. Comparar valores

**Resultado Esperado:**
- ✅ **Entradas do Painel** = **Entradas do Fluxo (Hoje)**
- ✅ **Saídas do Painel** = **Saídas do Fluxo (Hoje)**
- ✅ **Saldo Diário do Painel** = **Saldo do Período do Fluxo (Hoje)**

**Status:** [ ] Passou | [ ] Falhou

---

### **✅ TESTE 7: Entradas por Setor (Hoje)**

**Passos:**
1. Criar:
   - 1 Venda de R$ 100
   - 1 OS paga de R$ 50
   - 1 Cobrança paga de R$ 30
   - 1 Recibo de R$ 20
2. Ir em `/painel`
3. Verificar cards de "Entradas por Setor"

**Resultado Esperado:**
- ✅ **Vendas:** R$ 100,00
- ✅ **Ordens de Serviço:** R$ 50,00
- ✅ **Cobranças:** R$ 30,00
- ✅ **Recibos:** R$ 20,00

**Status:** [ ] Passou | [ ] Falhou

---

### **✅ TESTE 8: Filtro de Estornos no Fluxo**

**Passos:**
1. Ter pelo menos 1 estorno criado (do TESTE 4)
2. Ir em `/fluxo-caixa`
3. Filtrar por **Origem: 🔄 Estornos**

**Resultado Esperado:**
- ✅ Lista mostra **APENAS** movimentações de estorno
- ✅ Todas têm tipo **Saída** (vermelho)
- ✅ Todas têm descrição "Estorno de..."

**Status:** [ ] Passou | [ ] Falhou

---

### **✅ TESTE 9: Performance e Responsividade**

**Passos:**
1. Abrir **Painel** no celular (ou DevTools mobile)
2. Abrir **Fluxo de Caixa** no celular
3. Verificar carregamento

**Resultado Esperado:**
- ✅ **Painel:** Carrega em < 1 segundo
- ✅ **Fluxo:** Carrega em < 2 segundos
- ✅ Responsivo em telas pequenas
- ✅ Cards se ajustam corretamente

**Status:** [ ] Passou | [ ] Falhou

---

### **✅ TESTE 10: Offline-First**

**Passos:**
1. **Desconectar internet**
2. Criar venda de R$ 100
3. Deletar a venda (estorno)
4. **Reconectar internet**
5. Aguardar sync (10-15 segundos)
6. Verificar Fluxo de Caixa

**Resultado Esperado:**
- ✅ Venda sincronizada (entrada)
- ✅ Estorno sincronizado (saída)
- ✅ **NÃO houve duplicidade**
- ✅ Saldo correto após sync

**Status:** [ ] Passou | [ ] Falhou

---

## 📊 **RESUMO DOS TESTES**

| # | Teste | Status | Observações |
|---|-------|--------|-------------|
| 1 | Painel Simplificado | ⏳ | |
| 2 | Fluxo 4 Cards | ⏳ | |
| 3 | Aviso Saldo Negativo | ⏳ | |
| 4 | Estornos Vendas | ⏳ | |
| 5A | Estornos OS | ⏳ | |
| 5B | Estornos Cobranças | ⏳ | |
| 5C | Estornos Recibos | ⏳ | |
| 6 | Valores Batem | ⏳ | |
| 7 | Entradas por Setor | ⏳ | |
| 8 | Filtro Estornos | ⏳ | |
| 9 | Performance | ⏳ | |
| 10 | Offline-First | ⏳ | |

**Total:** 0/12 testado

---

## 🐛 **SE ALGO FALHAR**

### **Problema: Painel ainda tem seção "Fluxo de Caixa (Geral)"**
**Solução:**
1. Dar **CTRL+F5** (hard refresh)
2. Limpar cache do navegador
3. Se persistir, avisar no chat

### **Problema: Card "Saldo Atual" ainda aparece**
**Solução:**
1. Dar **CTRL+F5**
2. Verificar se está na versão mais recente (hash do commit: `01a28a6`)

### **Problema: Estornos não aparecem com origem "estorno"**
**Solução:**
1. Deletar movimentações antigas (criadas antes da refatoração)
2. Criar novos documentos após a refatoração
3. Estornos **novos** devem ter `origem_tipo = 'estorno'`

### **Problema: Saldo negativo não mostra aviso**
**Solução:**
1. Verificar se o saldo realmente está negativo
2. Dar **F5**
3. Se não aparecer, avisar no chat

---

## 📝 **COMO REPORTAR PROBLEMAS**

**Formato:**
```
❌ TESTE X FALHOU

Descrição: [Explique o que aconteceu]
Esperado: [O que deveria acontecer]
Obtido: [O que realmente aconteceu]
Screenshot: [Se possível]
```

**Exemplo:**
```
❌ TESTE 4 FALHOU

Descrição: Deletei venda mas estorno não aparece
Esperado: Estorno com origem "estorno"
Obtido: Estorno com origem "venda"
Screenshot: [anexo]
```

---

## ✅ **APROVAÇÃO FINAL**

Após **TODOS** os testes passarem:

```
✅ REFATORAÇÃO APROVADA!

12/12 testes passaram
Sistema financeiro operando em nível profissional
Financeiro é a única fonte da verdade
Estornos rastreáveis e padronizados
UI limpa e sem duplicatas

Status: PRODUÇÃO ✅
```

---

**Aguardando deploy (2-3 minutos)...**

**Quando deploy concluir, começar testes!** 🚀
