# ✅ CHECKLIST DE TESTES - PRODUÇÃO

**Data:** 30/01/2026  
**Objetivo:** Validar correções críticas antes de venda comercial  
**Tempo Total:** 15 minutos

---

## 🔴 **TESTES CRÍTICOS (BLOCKERS)**

### **Teste #1: Venda Simples (2 min)** ⭐ PRIORITÁRIO

```
DISPOSITIVO: PC

1. Login no sistema
2. Navegar: /vendas
3. Clicar "+ Nova Venda"
4. Selecionar cliente (ou deixar vazio)
5. Adicionar 1 produto (qualquer)
6. Finalizar venda

✅ SUCESSO SE:
- Toast: "Venda de R$ X,XX registrada com sucesso!"
- Venda aparece na lista
- Console (F12) NÃO mostra erro 400
- Console NÃO mostra "flcit=id"

❌ FALHA SE:
- Erro 400 no console
- Toast: "Erro ao criar venda"
- Venda não aparece na lista
```

---

### **Teste #2: Venda com Múltiplos Produtos (3 min)** ⭐ PRIORITÁRIO

```
DISPOSITIVO: PC

1. Navegar: /vendas
2. "+ Nova Venda"
3. Adicionar produtos:
   - Produto A: 2 unidades
   - Produto B: 1 unidade
   - Produto C: 3 unidades
4. Verificar total (deve somar corretamente)
5. Finalizar venda

✅ SUCESSO SE:
- Toast: "Venda de R$ X,XX registrada com sucesso!"
- Venda aparece com 3 itens
- Estoque de A decrementou 2
- Estoque de B decrementou 1
- Estoque de C decrementou 3

❌ FALHA SE:
- Erro 400 "flcit=id"
- Venda não criada
- Estoque inconsistente
- Console mostra "Produtos inválidos"
```

---

### **Teste #3: Upload de Arquivo com Nome Problemático (3 min)** ⭐ PRIORITÁRIO

```
DISPOSITIVO: PC ou Mobile

1. Preparar arquivo de teste:
   - Renomear: "Sem título.png"
   - Ou: "Noção de Prêmio.jpg"

2. Navegar: /compra-usados
3. Preencher:
   - Vendedor: Criar ou selecionar
   - Título: "iPhone 11"
   - Valor: "1500"

4. Upload do arquivo:
   - Clicar "📷 Fotos do aparelho"
   - Selecionar "Sem título.png"
   - ✅ Toast: "✅ 1 foto(s) adicionada(s)"

5. Salvar compra:
   - Clicar "Salvar Compra"
   - ✅ Toast: "Compra salva! 1 arquivo(s) enviado(s)."

6. Verificar "Último Cadastro":
   - Scroll até seção "📋 Último Cadastro"
   - ✅ "Arquivos: 1"
   - ✅ Arquivo visível na lista
   - ✅ Botão "Abrir" funciona

✅ SUCESSO SE:
- Upload funciona (sem "falharam")
- Arquivo aparece na listagem
- Botão "Abrir" abre o arquivo

❌ FALHA SE:
- Toast: "mas arquivos falharam: Sem título.png"
- Arquivo não aparece
- Console mostra erro 400 ou "Invalid path"
```

---

### **Teste #4: Impressão de Comprovante (2 min)** 🟠 IMPORTANTE

```
DISPOSITIVO: PC

1. Após criar compra de usado (Teste #3)
2. Na seção "📋 Último Cadastro"
3. Clicar "🖨️ Imprimir Recibo"

✅ SUCESSO SE:
- Janela de impressão abre
- Comprovante mostra:
  - Nome do vendedor
  - Título do usado ("iPhone 11")
  - IMEI (se preenchido)
  - Valor (R$ 1.500,00)
- Diálogo de impressão do navegador abre

❌ FALHA SE:
- Nada acontece ao clicar
- Erro: "Permita pop-ups"
- Comprovante vazio ou sem dados
```

---

## 🟡 **TESTES SECUNDÁRIOS (UX)**

### **Teste #5: Floating Bar - Auto-hide Mobile (2 min)** 📱

```
DISPOSITIVO: Mobile (ou Chrome DevTools → Device Toolbar)

1. Navegar: /vendas
2. Clicar campo "Cliente"
   ✅ Teclado virtual abre
   ✅ Floating bar desaparece (auto-hide)
   ✅ Campo "Cliente" visível acima do teclado

3. Mudar para "Observações"
   ✅ Floating bar permanece escondida
   ✅ Sem "piscar" ao mudar de campo

4. Fechar teclado (clicar fora)
   ✅ Floating bar reaparece após 100ms
   ✅ Transição suave (fade + slide)
```

---

### **Teste #6: Safe Area Padding (2 min)** 📱

```
DISPOSITIVO: Mobile

1. Navegar: /compra-usados
2. Scroll até o fim da página
   ✅ Botão "Salvar Compra" totalmente visível
   ✅ Floating bar NÃO cobre botão
   ✅ Padding suficiente (~136px)

3. Navegar: /vendas
4. Scroll até "Finalizar Venda"
   ✅ Botão totalmente visível
   ✅ Sem sobreposição
```

---

## 📊 **MATRIZ DE TESTES**

| Teste | Dispositivo | Tempo | Prioridade | Status |
|-------|-------------|-------|------------|--------|
| #1 Venda simples | PC | 2 min | 🔴 CRÍTICO | ⏳ |
| #2 Venda múltipla | PC | 3 min | 🔴 CRÍTICO | ⏳ |
| #3 Upload arquivo | PC/Mobile | 3 min | 🔴 CRÍTICO | ⏳ |
| #4 Impressão | PC | 2 min | 🟠 IMPORTANTE | ⏳ |
| #5 Auto-hide | Mobile | 2 min | 🟡 NORMAL | ⏳ |
| #6 Safe area | Mobile | 2 min | 🟡 NORMAL | ⏳ |

---

## 🎯 **CRITÉRIO DE APROVAÇÃO**

### **✅ APROVADO para venda comercial se:**

- [ ] Teste #1: Venda simples funciona (sem erro 400)
- [ ] Teste #2: Venda com 3+ produtos funciona
- [ ] Teste #3: Upload com nome problemático funciona
- [ ] Teste #4: Impressão de comprovante funciona
- [ ] Console (F12): Sem erros críticos

### **❌ REPROVAR se:**

- [ ] Erro 400 "flcit=id" ainda aparece
- [ ] Venda com múltiplos produtos falha
- [ ] Upload de arquivo falha sempre
- [ ] Estoque fica inconsistente
- [ ] Qualquer funcionalidade core quebrada

---

## 📋 **LOGS ESPERADOS (Console)**

### **Venda Bem-Sucedida:**
```
[Vendas] Venda salva: {
  id: "abc-123-...",
  totalLocal: 5
}
```

### **Produto Inválido (se houver):**
```
[Vendas] Produtos inválidos na venda (pré-validação) {
  produtosInvalidos: "xyz-999",
  posicoes: "Item 2",
  totalItens: 3,
  timestamp: "2026-01-30..."
}
```

### **Upload Bem-Sucedido (DEV):**
```
[UsadosUploads] Upload: {
  original: "Sem título.png",
  sanitized: "sem_titulo.png",
  path: "abc/def/123456-sem_titulo.png",
  size: 5450000,
  type: "image/png"
}
```

---

## 🚀 **APÓS TODOS OS TESTES PASSAREM**

```bash
# 1. Marcar como aprovado
✅ Testes #1, #2, #3, #4 passaram

# 2. Fazer commit (se ainda não fez)
git add .
git commit -m "fix: erro 400 vendas + validação produtos + upload usados"
git push

# 3. Aguardar deploy Cloudflare Pages

# 4. Testar em produção (repetir testes #1-#4)

# 5. Monitorar por 24h
- Verificar erros no console
- Coletar feedback de usuários
- Verificar sync com Supabase

# 6. Celebrar! 🎉
Sistema pronto para venda comercial
```

---

**✅ CHECKLIST PRONTO!**  
**⏱️ Tempo total: 15 minutos**  
**🎯 Execute os 4 testes críticos antes de deploy!**
