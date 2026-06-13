# 🧪 TESTE DE FLUXO: FORMAS DE PAGAMENTO

**Data:** 30/01/2026  
**Versão:** 1.0

---

## 🎯 OBJETIVO

Testar todas as formas de pagamento e verificar se:
```
✅ Venda é registrada corretamente
✅ Lançamento financeiro é criado no Fluxo de Caixa
✅ Métricas são atualizadas
✅ Comprovante é gerado com os dados corretos
```

---

## 📋 FORMAS DE PAGAMENTO DISPONÍVEIS

### **Opções no Sistema:**
```
1. 💵 Dinheiro
2. 📱 PIX
3. 💳 Débito
4. 💳 Cartão Crédito (com parcelas)
5. 📄 Outro
```

### **❌ REMOVIDAS (duplicatas):**
```
❌ "Crédito" (duplicado de "Cartão Crédito")
❌ "Cartão (Crédito)" (duplicado de "Cartão Crédito")
```

---

## 🧪 CENÁRIOS DE TESTE

### **Teste 1: Dinheiro**

**Passos:**
```
1. Ir em "Vendas"
2. Clicar em "Venda Rápida" ou "Nova Venda"
3. Adicionar 1 produto (ex: "fone de ouvido - R$ 25,00")
4. Forma de Pagamento: Dinheiro
5. Finalizar Venda
```

**Resultado Esperado:**
```
✅ Toast: "💰 Venda de R$ 25,00 registrada com sucesso!"
✅ Venda aparece na lista
✅ Forma de pagamento: "dinheiro"
✅ Fluxo de Caixa: +R$ 25,00 (entrada)
✅ Métricas: Total Bruto +R$ 25,00
```

---

### **Teste 2: PIX**

**Passos:**
```
1. Nova venda
2. Adicionar 1 produto (R$ 50,00)
3. Forma de Pagamento: PIX
4. Finalizar Venda
```

**Resultado Esperado:**
```
✅ Venda registrada
✅ Forma de pagamento: "pix"
✅ Fluxo de Caixa: +R$ 50,00
✅ Métricas atualizadas
```

---

### **Teste 3: Débito**

**Passos:**
```
1. Nova venda
2. Adicionar 1 produto (R$ 100,00)
3. Forma de Pagamento: Débito
4. Finalizar Venda
```

**Resultado Esperado:**
```
✅ Venda registrada
✅ Forma de pagamento: "debito"
✅ Parcelas: não exibe (débito é à vista)
✅ Taxa: 0 (débito não tem taxa)
✅ Fluxo de Caixa: +R$ 100,00
✅ Total Líquido = Total Bruto (sem taxa)
```

---

### **Teste 4: Cartão Crédito (1x)**

**Passos:**
```
1. Nova venda
2. Adicionar 1 produto (R$ 200,00)
3. Forma de Pagamento: Cartão Crédito
4. Parcelas: 1x
5. Finalizar Venda
```

**Resultado Esperado:**
```
✅ Venda registrada
✅ Forma de pagamento: "credito"
✅ Parcelas: 1
✅ Taxa calculada (se configurada)
✅ Fluxo de Caixa: +R$ 200,00 (ou total líquido após taxa)
✅ Comprovante mostra "Cartão Crédito - 1x"
```

---

### **Teste 5: Cartão Crédito (12x)**

**Passos:**
```
1. Nova venda
2. Adicionar 1 produto (R$ 600,00)
3. Forma de Pagamento: Cartão Crédito
4. Parcelas: 12x
5. Finalizar Venda
```

**Resultado Esperado:**
```
✅ Venda registrada
✅ Forma de pagamento: "credito"
✅ Parcelas: 12
✅ Taxa calculada (ex: 12x = ~3-5%)
✅ Valor parcela = R$ 600,00 / 12 = R$ 50,00
✅ Comprovante: "12X DE R$ 50,00"
✅ Fluxo de Caixa: +R$ X (total líquido após taxa)
✅ Total Líquido < Total Bruto (devido à taxa)
```

---

### **Teste 6: Outro**

**Passos:**
```
1. Nova venda
2. Adicionar 1 produto (R$ 75,00)
3. Forma de Pagamento: Outro
4. Finalizar Venda
```

**Resultado Esperado:**
```
✅ Venda registrada
✅ Forma de pagamento: "outro"
✅ Fluxo de Caixa: +R$ 75,00
✅ Métricas atualizadas
```

---

## 🔍 VERIFICAÇÕES OBRIGATÓRIAS

### **Para TODAS as vendas:**

#### **1. Lista de Vendas:**
```
✅ Venda aparece na lista
✅ Cliente correto (se informado)
✅ Valor total correto
✅ Forma de pagamento correta
✅ Data/hora corretas
```

#### **2. Fluxo de Caixa:**
```
1. Ir em "Fluxo de Caixa"
2. ✅ Ver lançamento da venda
3. ✅ Tipo: "venda"
4. ✅ Valor correto (total líquido)
5. ✅ Descrição: "Venda #XXXXXX - [Cliente]"
```

#### **3. Métricas (na aba Vendas):**
```
✅ Total Bruto atualizado
✅ Lucro Bruto atualizado
✅ Lucro Líquido atualizado
✅ Ticket Médio recalculado
```

#### **4. Comprovante (Impressão):**
```
1. Clicar no botão "🖨️ Imprimir"
2. ✅ Número da venda correto (V-0001)
3. ✅ Cliente correto
4. ✅ Itens corretos
5. ✅ Valor total correto
6. ✅ Forma de pagamento correta
7. ✅ Parcelas (se crédito com +1x)
```

#### **5. WhatsApp (se disponível):**
```
1. Clicar no botão "💬 WhatsApp"
2. ✅ Mensagem com dados corretos
3. ✅ Link funcional
```

---

## 🚨 CENÁRIOS DE ERRO

### **Erro 1: Sem produtos**
```
Tentar criar venda sem adicionar itens
❌ Deve bloquear: "Adicione pelo menos um item"
```

### **Erro 2: Crédito sem parcelas**
```
Selecionar "Cartão Crédito" e não selecionar parcelas
✅ Default deve ser 1x (automático)
```

### **Erro 3: Duplicatas no dropdown**
```
Abrir dropdown "Forma de Pagamento"
❌ NÃO deve haver "Crédito" e "Cartão (Crédito)" juntos
✅ Deve ter apenas "Cartão Crédito"
❌ NÃO deve haver "Débito" duplicado
```

---

## 📊 TABELA DE RESULTADOS

| Forma de Pagamento | Valor | Parcelas | Taxa | Total Líquido | Fluxo Caixa | Métricas | Status |
|-------------------|-------|----------|------|---------------|-------------|----------|--------|
| Dinheiro          | R$ 25 | -        | R$ 0 | R$ 25,00      | ✅          | ✅       | ⬜ |
| PIX               | R$ 50 | -        | R$ 0 | R$ 50,00      | ✅          | ✅       | ⬜ |
| Débito            | R$ 100| -        | R$ 0 | R$ 100,00     | ✅          | ✅       | ⬜ |
| Cartão Crédito 1x | R$ 200| 1x       | ~R$ 2| R$ 198,00     | ✅          | ✅       | ⬜ |
| Cartão Crédito 12x| R$ 600| 12x      | ~R$ 30| R$ 570,00    | ✅          | ✅       | ⬜ |
| Outro             | R$ 75 | -        | R$ 0 | R$ 75,00      | ✅          | ✅       | ⬜ |

**TOTAL ESPERADO (Fluxo de Caixa):** ~R$ 1.018,00 (considerando taxas)

---

## 🔄 TESTE DE ATUALIZAÇÃO AUTOMÁTICA

### **Teste: Múltiplas abas abertas**

**Passos:**
```
1. Abrir sistema em 2 abas do navegador
2. Aba 1: Ir em "Vendas"
3. Aba 2: Ir em "Fluxo de Caixa"
4. Aba 1: Criar uma venda
5. ✅ Aba 2 deve atualizar automaticamente (sem F5)
```

**Resultado Esperado:**
```
✅ Aba 2 (Fluxo de Caixa) atualiza em tempo real
✅ Métricas atualizadas em todas as abas
✅ Sem necessidade de refresh manual
```

---

## 🛠️ TROUBLESHOOTING

### **Problema: Venda não aparece no Fluxo de Caixa**

**Diagnóstico:**
```
1. F12 (Console)
2. Buscar por:
   ✅ "[Vendas] ✅ Lançamentos financeiros criados"
   ❌ "[Vendas] Erro ao criar lançamentos financeiros"
```

**Solução:**
```
- Se não houver log: Limpar cache (Ctrl + Shift + R)
- Se houver erro: Verificar mensagem de erro no console
```

---

### **Problema: Métricas não atualizam**

**Diagnóstico:**
```
1. Verificar se evento foi disparado:
   - storage: smart-tech-vendas-updated
   - custom: smart-tech-venda-criada
```

**Solução:**
```
1. Fechar e reabrir a aba
2. Limpar cache
3. Verificar console por erros
```

---

### **Problema: Erro ao vender com Crédito**

**Diagnóstico:**
```
1. Console deve mostrar payload enviado
2. Verificar campos:
   - forma_pagamento: "CREDITO" (uppercase)
   - parcelas: número (1-12)
   - taxa_cartao_valor: número
   - total_liquido: número
```

**Solução:**
```
✅ Correção já aplicada em toSupabaseVendaPayload()
✅ Payload agora inclui todos os campos obrigatórios
```

---

## ✅ CRITÉRIOS DE ACEITAÇÃO

### **Para aprovar este teste:**

```
☑️ TODAS as 6 formas de pagamento funcionam
☑️ TODOS os lançamentos aparecem no Fluxo de Caixa
☑️ TODAS as métricas atualizam corretamente
☑️ TODOS os comprovantes imprimem com dados corretos
☑️ NÃO há duplicatas no dropdown
☑️ NÃO há erros no console (F12)
☑️ Atualização automática funciona entre abas
```

---

## 📝 CHECKLIST FINAL

```
☑️ Dropdown limpo (sem duplicatas)
☑️ Dinheiro → Fluxo de Caixa
☑️ PIX → Fluxo de Caixa
☑️ Débito → Fluxo de Caixa (sem taxa)
☑️ Cartão Crédito 1x → Fluxo de Caixa
☑️ Cartão Crédito 12x → Fluxo de Caixa (com taxa)
☑️ Outro → Fluxo de Caixa
☑️ Métricas atualizadas
☑️ Comprovantes corretos
☑️ WhatsApp funcionando
☑️ Atualização automática
☑️ Console sem erros
```

---

## 📅 PRÓXIMOS PASSOS

Após concluir todos os testes:

```
1. ✅ Marcar todos os itens na tabela
2. ✅ Verificar console (F12) sem erros
3. ✅ Confirmar totais no Fluxo de Caixa
4. ✅ Tirar screenshot dos resultados
5. ✅ Reportar qualquer inconsistência
```

---

**📅 Data:** 30/01/2026  
**🏆 Status:** PRONTO PARA TESTE  
**✅ Build:** OK

© 2026 - PDV Smart Tech - Payment Flow Test v1.0
