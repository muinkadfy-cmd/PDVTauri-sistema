# 🔧 Guia: Corrigir Produtos Inválidos

## 📋 Passo a Passo

### 1. Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

### 2. Abrir a Página de Diagnóstico

No navegador, acesse:
```
http://localhost:5173/produtos-diagnostico
```

**Nota:** Esta página só está disponível em modo de desenvolvimento (DEV).

### 3. Executar Diagnóstico

1. A página deve carregar automaticamente o diagnóstico
2. Se não carregar, clique no botão **"🔄 Atualizar Diagnóstico"**
3. Aguarde o diagnóstico ser executado

### 4. Verificar Produtos Inválidos

Na seção **"Validação"**, você verá:
- **Válidos:** Quantidade de produtos válidos
- **Inválidos:** Quantidade de produtos inválidos (se houver)

Se houver produtos inválidos, você verá:
- Uma lista detalhada dos produtos inválidos
- Os erros específicos de cada produto (ex: "id inválido", "preco inválido", etc.)

### 5. Corrigir Produtos Inválidos

1. Clique no botão **"🔧 Tentar Corrigir Produtos Inválidos"**
2. Uma confirmação aparecerá: `"Tentar corrigir X produtos inválidos? Produtos que não puderem ser corrigidos serão removidos."`
3. Clique em **"OK"** para confirmar

### 6. Aguardar Correção

A correção irá:
- ✅ Corrigir tipos incorretos (string → number, string → boolean)
- ✅ Garantir campos obrigatórios (nome, preco, estoque, ativo)
- ✅ Corrigir campos opcionais (descricao, custo, codigoBarras, categoria)
- ✅ Validar cada produto corrigido
- ✅ Remover produtos que não puderem ser corrigidos

### 7. Verificar Resultado

Após a correção:
- Um toast aparecerá: `"Correção concluída: X corrigidos, Y removidos"`
- O diagnóstico será atualizado automaticamente
- Verifique se o número de produtos inválidos diminuiu

### 8. Validar Correção

1. Verifique na seção **"Resumo"**:
   - `getProdutos()` deve mostrar mais produtos agora
   - `Inválidos` deve estar em 0 (ou menor)

2. Navegue para a página **Produtos** (`/produtos`)
3. Verifique se os produtos corrigidos aparecem na lista

---

## 🔍 O que a Correção Faz?

### Correções Automáticas

1. **ID:**
   - Se não for string → Converte para string ou gera novo UUID

2. **Nome:**
   - Se não for string → Converte para string
   - Se vazio → Define como "Produto sem nome"

3. **Preço:**
   - Se não for number → Converte string para number
   - Se negativo → Define como 0

4. **Estoque:**
   - Se não for number → Converte string para number

5. **Ativo:**
   - Se não for boolean → Converte (true, "true", 1 → true, outros → false)

6. **Campos Opcionais:**
   - `descricao`: Converte para string se necessário
   - `custo`: Converte para number se necessário
   - `codigoBarras`: Converte para string se necessário
   - `categoria`: Converte para string se necessário

### Validação Final

Após todas as correções, cada produto é validado usando `isValidProduto()`:
- ✅ Se válido → Mantido
- ❌ Se inválido → Removido

---

## ⚠️ Avisos Importantes

1. **Backup Recomendado:**
   - Antes de corrigir, faça backup dos dados
   - Use a página `/backup` para exportar dados

2. **Produtos Removidos:**
   - Produtos que não puderem ser corrigidos serão **permanentemente removidos**
   - Não há como recuperar após a remoção

3. **Modo DEV:**
   - Esta página só funciona em modo de desenvolvimento
   - Em produção, a página não estará disponível

---

## 🐛 Troubleshooting

### Problema: "Nenhum produto inválido para corrigir"

**Causa:** Não há produtos inválidos no LocalStorage

**Solução:**
- Verifique se o diagnóstico foi executado
- Clique em "🔄 Atualizar Diagnóstico"

### Problema: Produtos ainda aparecem como inválidos após correção

**Causa:** Produtos têm erros que não podem ser corrigidos automaticamente

**Solução:**
1. Veja os erros detalhados na seção "Produtos Inválidos"
2. Se necessário, remova manualmente produtos problemáticos usando "🗑️ Remover Produtos Inválidos"

### Problema: Página não carrega

**Causa:** Pode estar em modo PROD

**Solução:**
- Certifique-se de estar rodando `npm run dev` (não `npm run build`)
- Verifique se `import.meta.env.DEV` é `true`

---

## 📊 Exemplo de Resultado Esperado

### Antes da Correção:
```
LocalStorage: 13 produtos
produtosRepo.list(): 13 produtos
getProdutos(): 4 produtos
Inválidos: 9 produtos
```

### Após a Correção:
```
LocalStorage: 13 produtos (ou menos, se alguns foram removidos)
produtosRepo.list(): 13 produtos
getProdutos(): 13 produtos (ou próximo disso)
Inválidos: 0 produtos
```

---

## ✅ Validação Final

Após corrigir, valide:

1. **Na página `/produtos-diagnostico`:**
   - [ ] Inválidos = 0 (ou muito menor)
   - [ ] `getProdutos()` mostra mais produtos

2. **Na página `/produtos`:**
   - [ ] Produtos corrigidos aparecem na lista
   - [ ] Produtos podem ser editados normalmente

3. **Persistência:**
   - [ ] Recarregar página (F5) → Produtos ainda aparecem
   - [ ] Navegar para outra aba e voltar → Produtos ainda aparecem

---

**Última Atualização:** 2026-01-22
