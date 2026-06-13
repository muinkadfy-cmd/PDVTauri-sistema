# 🔍 Diagnóstico: Produtos Desaparecem em Modo Dev

## 📋 Problema Reportado

Produtos criados desaparecem quando:
- Usuário sai da aba e volta
- Página é recarregada (F5)
- Sistema está em modo dev

## 🛠️ Ferramentas de Diagnóstico Criadas

### 1. **Página de Diagnóstico de Produtos** (`/produtos-diagnostico`)

**Arquivo:** `src/pages/ProdutosDiagnosticoPage.tsx`

**Funcionalidades:**
- ✅ Verifica dados brutos do LocalStorage
- ✅ Compara `produtosRepo.list()` vs `getProdutos()`
- ✅ Identifica produtos inválidos e seus erros
- ✅ Verifica store_id (se configurado)
- ✅ Verifica campos obrigatórios faltando
- ✅ Mostra diferença entre repositório e função getProdutos()
- ✅ Botão para criar produto de teste
- ✅ Botão para limpar LocalStorage

**Como usar:**
1. Abrir `/produtos-diagnostico` (apenas em DEV)
2. Clicar "Atualizar Diagnóstico"
3. Analisar as seções:
   - **Resumo**: Contadores de produtos em cada camada
   - **Diferença**: Produtos que estão em `produtosRepo.list()` mas não em `getProdutos()`
   - **Produtos Inválidos**: Produtos que falham na validação
   - **Store ID**: Verificação de store_id
   - **Campos Obrigatórios**: Campos faltando
   - **Dados Brutos**: JSON completo do LocalStorage

### 2. **Teste Automatizado de Persistência**

**Arquivo:** `src/lib/testing/tests/produtos-persistencia.test.ts`

**O que testa:**
- ✅ Criação de produto
- ✅ Persistência no LocalStorage
- ✅ Validação de campos obrigatórios
- ✅ Verificação de store_id
- ✅ Múltiplas leituras do repositório
- ✅ Limpeza após teste

**Como executar:**
1. Abrir `/testes` (apenas em DEV)
2. Clicar "Rodar Todos os Testes"
3. Verificar resultado do teste "Produtos - Persistência"

## 🔍 Possíveis Causas Identificadas

### 1. **Validação Removendo Produtos Válidos**

**Sintoma:** `produtosRepo.list()` tem mais itens que `getProdutos()`

**Causa:** `getProdutos()` usa `filterValid()` que pode estar removendo produtos válidos

**Verificação:**
- Abrir `/produtos-diagnostico`
- Verificar seção "Diferença entre produtosRepo.list() e getProdutos()"
- Se houver diferença, verificar produtos inválidos

**Solução:** Corrigir validação `isValidProduto()` em `src/lib/validate.ts`

### 2. **Store ID Filtrando Produtos**

**Sintoma:** Produtos criados sem store_id não aparecem quando `VITE_STORE_ID` está configurado

**Causa:** Filtro por store_id pode estar escondendo produtos

**Verificação:**
- Abrir `/produtos-diagnostico`
- Verificar seção "Store ID"
- Verificar quantos produtos têm store_id vs sem store_id

**Solução:** Garantir que produtos recebem store_id ao criar (já implementado)

### 3. **Campos Obrigatórios Faltando**

**Sintoma:** Produtos são criados mas não passam na validação

**Causa:** Campos obrigatórios não estão sendo preenchidos

**Verificação:**
- Abrir `/produtos-diagnostico`
- Verificar seção "Campos Obrigatórios Faltando"
- Verificar seção "Produtos Inválidos"

**Solução:** Corrigir criação de produtos para garantir todos os campos

### 4. **Pull do Supabase Apagando Produtos Locais**

**Sintoma:** Produtos aparecem após criar, mas somem após pull

**Causa:** Pull do Supabase pode estar substituindo lista local

**Verificação:**
- Verificar logs do console (DEV)
- Procurar por `[Repository:produtos] X itens locais não estão no Supabase`
- Verificar se pull está apagando produtos locais

**Solução:** Já implementado - pull não apaga produtos locais (merge por ID)

## 📝 Checklist de Diagnóstico

Use este checklist para identificar o problema:

- [ ] Abrir `/produtos-diagnostico`
- [ ] Clicar "Atualizar Diagnóstico"
- [ ] Verificar seção "Resumo":
  - [ ] LocalStorage tem produtos?
  - [ ] `produtosRepo.list()` tem produtos?
  - [ ] `getProdutos()` tem produtos?
  - [ ] Há produtos inválidos?
- [ ] Se houver diferença entre repo e getProdutos:
  - [ ] Verificar seção "Diferença"
  - [ ] Verificar quais produtos estão apenas em repo
  - [ ] Verificar se esses produtos são inválidos
- [ ] Verificar seção "Produtos Inválidos":
  - [ ] Quais erros de validação?
  - [ ] Quais campos estão faltando?
- [ ] Verificar seção "Store ID":
  - [ ] Store ID está configurado?
  - [ ] Produtos têm store_id?
  - [ ] Store_id está correto?
- [ ] Criar produto de teste:
  - [ ] Clicar "Criar Produto Teste"
  - [ ] Atualizar diagnóstico
  - [ ] Verificar se produto aparece em todas as camadas
- [ ] Executar teste automatizado:
  - [ ] Abrir `/testes`
  - [ ] Clicar "Rodar Todos os Testes"
  - [ ] Verificar resultado do teste "Produtos - Persistência"

## 🎯 Próximos Passos

1. **Executar diagnóstico:**
   - Abrir `/produtos-diagnostico`
   - Analisar resultados

2. **Identificar causa raiz:**
   - Usar checklist acima
   - Verificar logs do console

3. **Aplicar correção:**
   - Baseado na causa identificada
   - Testar novamente

4. **Validar correção:**
   - Criar produto
   - Sair da aba e voltar
   - Recarregar página (F5)
   - Verificar se produto persiste

## 📊 Logs Úteis

Em modo DEV, os seguintes logs ajudam no diagnóstico:

```
[ProdutosPage] Carregando produtos ao montar componente
[ProdutosPage] Aplicando filtros: { totalLocal, busca, filtroAtivo, storeId, ... }
[ProdutosPage] Filtros aplicados: { totalFiltrado, produtosIds }
[Produtos] Criando produto: { id, nome, storeId, ativo }
[Produtos] Produto salvo: { id, nome, totalLocal, primeiroItem, ultimoItem }
[Repository:produtos] X itens locais não estão no Supabase (mantidos localmente)
```

## ✅ Status

- ✅ Página de diagnóstico criada
- ✅ Teste automatizado criado
- ✅ Rota adicionada (`/produtos-diagnostico`)
- ✅ Link no sidebar (DEV only)
- ⏳ Aguardando execução do diagnóstico para identificar causa raiz

---

**Data:** 2026-01-22  
**Status:** Ferramentas de diagnóstico criadas e prontas para uso
