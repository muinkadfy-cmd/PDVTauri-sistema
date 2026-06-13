# ✅ Correção do Bug: Produto Criado Some Quando Sai da Aba

## 🔍 Causa Raiz Identificada

O bug tinha múltiplas causas potenciais que foram todas corrigidas:

1. **Produtos criados sem `store_id`**: Quando `VITE_STORE_ID` estava configurado, produtos criados localmente sem `store_id` podiam não aparecer corretamente após sincronização com Supabase que filtra por `store_id`.

2. **Pull do Supabase poderia sobrescrever itens locais pendentes**: O `pullFromRemote` não verificava se itens locais estavam pendentes na outbox antes de sobrescrever com dados do Supabase.

3. **Filtros ocultando produtos recém-criados**: Se um produto inativo fosse criado enquanto o filtro estava em "Ativos", o produto não apareceria imediatamente.

4. **Falta de logs para debug**: Não havia logs suficientes para rastrear o fluxo de criação e carregamento de produtos.

## ✅ Correções Implementadas

### 1. Adicionar `store_id` ao Produto Criado

**Arquivo:** `src/lib/produtos.ts`

```typescript
// Adicionar store_id se configurado (para multi-device)
const storeId = import.meta.env.VITE_STORE_ID;
const novoProduto: Produto = {
  ...produto,
  // ... outros campos
  ...(storeId && { storeId } as any) // Adicionar store_id se configurado
};
```

**Impacto:** Produtos criados agora recebem `store_id` automaticamente se `VITE_STORE_ID` estiver configurado, garantindo que apareçam corretamente após sincronização.

---

### 2. Proteger Itens Locais Pendentes no Pull

**Arquivo:** `src/lib/repository/data-repository.ts`

**Mudança:** O método `pullFromRemote` agora:
- Verifica itens pendentes na outbox antes de sobrescrever
- Mantém itens locais que não estão no Supabase (offline-first)
- Loga itens locais que não estão no Supabase para debug

```typescript
// Verificar itens na outbox (pendentes de sync)
const { getPendingOutboxItems } = await import('./outbox');
const pendingItems = getPendingOutboxItems();
const pendingIds = new Set(
  pendingItems
    .filter(item => item.table === this.tableName)
    .map(item => item.payload?.id || item.id)
);

// Se item está pendente na outbox, NÃO sobrescrever
if (pendingIds.has(remoteItem.id)) {
  if (import.meta.env.DEV) {
    logger.log(`[Repository:${this.tableName}] Item ${remoteItem.id} está pendente na outbox, mantendo versão local`);
  }
  continue;
}
```

**Impacto:** Itens locais pendentes de sincronização não são mais sobrescritos por dados do Supabase, garantindo que produtos criados offline não desapareçam.

---

### 3. Ajustar Filtros Após Criar Produto

**Arquivo:** `src/pages/ProdutosPage.tsx`

```typescript
// Se o produto criado está inativo e o filtro está em "Ativos", ajustar filtro
if (!resultado.ativo && filtroAtivo === true) {
  setFiltroAtivo(null); // Mostrar todos para que o produto apareça
}
```

**Impacto:** Produtos inativos criados agora aparecem imediatamente, mesmo que o filtro esteja em "Ativos".

---

### 4. Logs Detalhados para Debug

**Arquivos:** `src/lib/produtos.ts`, `src/pages/ProdutosPage.tsx`

Logs adicionados em:
- Criação de produto (payload completo + id gerado)
- Após salvar (tamanho da lista local + primeiro/último item)
- Ao entrar na aba (quantos itens foram carregados)
- Filtros aplicados (busca, ativo, total filtrado vs total local)

**Exemplo de logs:**
```typescript
[Produtos] Criando produto: { id: "...", nome: "...", storeId: "..." }
[Produtos] Produto salvo: { id: "...", totalLocal: 10, ... }
[ProdutosPage] Produtos carregados: { total: 10, filtroAtivo: null, busca: "" }
[ProdutosPage] Filtros aplicados: { busca: "teste", filtroAtivo: "ativos", totalFiltrado: 5 }
```

**Impacto:** Facilita debug e rastreamento de problemas de persistência.

---

### 5. Teste de Regressão Automatizado

**Arquivo:** `src/lib/testing/tests/produtos.test.ts`

Novo teste `testProdutoPersistencia()` que valida:
- Produto criado aparece imediatamente
- Produto persiste após "recarregar" (simula sair e voltar da aba)
- Produto persiste após múltiplas leituras
- Produto é deletado corretamente

**Como executar:**
```bash
npm run dev
# Abrir /testes
# Clicar "Rodar Todos os Testes"
# Verificar que "Produtos" → "testProdutoPersistencia" passa
```

---

## 📁 Arquivos Alterados

1. **`src/lib/produtos.ts`**
   - Adiciona `store_id` ao produto criado se configurado
   - Logs detalhados de criação e salvamento

2. **`src/lib/repository/data-repository.ts`**
   - Protege itens pendentes na outbox durante pull
   - Mantém itens locais que não estão no Supabase
   - Logs de itens locais não sincronizados

3. **`src/pages/ProdutosPage.tsx`**
   - Ajusta filtros após criar produto inativo
   - Logs de carregamento e filtros aplicados
   - Importa `logger` para logs

4. **`src/lib/testing/tests/produtos.test.ts`**
   - Novo teste `testProdutoPersistencia()` para regressão

5. **`src/lib/testing/tests/index.ts`**
   - Adiciona `testProdutoPersistencia` à suite de testes

---

## 🧪 Como Validar a Correção

### Passo 1: Teste Manual Básico
1. Abrir a aplicação (`npm run dev`)
2. Ir para aba "Produtos"
3. Criar um novo produto (nome, preço, estoque)
4. Verificar que produto aparece na lista
5. **Sair da aba** (clicar em outra aba, ex: "Clientes")
6. **Voltar para aba "Produtos"**
7. ✅ **Validar:** Produto ainda está na lista

### Passo 2: Teste com Filtros
1. Na aba "Produtos", ativar filtro "Ativos"
2. Criar um produto **inativo**
3. ✅ **Validar:** Filtro muda para "Todos" e produto aparece

### Passo 3: Teste Offline
1. Desconectar internet (ou desabilitar Supabase)
2. Criar um produto
3. Sair e voltar da aba
4. ✅ **Validar:** Produto ainda está na lista

### Passo 4: Teste com Store ID
1. Configurar `VITE_STORE_ID` no `.env`
2. Criar um produto
3. Verificar logs no console (DEV): deve mostrar `storeId: "..."` no produto criado
4. Sair e voltar da aba
5. ✅ **Validar:** Produto ainda está na lista

### Passo 5: Teste Automatizado
1. Abrir `/testes` (apenas em DEV)
2. Clicar "Rodar Todos os Testes"
3. ✅ **Validar:** Teste "Produtos" → "testProdutoPersistencia" passa

### Passo 6: Verificar Logs (DEV)
1. Abrir DevTools (F12) → Console
2. Criar um produto
3. Verificar logs:
   - `[Produtos] Criando produto: { id, nome, storeId }`
   - `[Produtos] Produto salvo: { id, totalLocal, ... }`
   - `[ProdutosPage] Produtos carregados: { total, ... }`
4. Sair e voltar da aba
5. Verificar logs de carregamento

---

## 🔒 Garantias Implementadas

1. ✅ **Persistência Local**: Produtos são salvos imediatamente no LocalStorage via `produtosRepo.upsert()`
2. ✅ **Offline-First**: Produtos locais não são apagados se não estiverem no Supabase
3. ✅ **Proteção de Outbox**: Itens pendentes de sync não são sobrescritos
4. ✅ **Store ID**: Produtos recebem `store_id` automaticamente se configurado
5. ✅ **Filtros Inteligentes**: Filtros são ajustados para mostrar produtos recém-criados
6. ✅ **Logs Detalhados**: Logs em DEV para facilitar debug
7. ✅ **Teste de Regressão**: Teste automatizado previne recorrência do bug

---

## 📝 Notas Importantes

### Store ID
- Se `VITE_STORE_ID` estiver configurado, produtos criados recebem automaticamente esse `store_id`
- Isso garante que produtos apareçam corretamente após sincronização com Supabase
- Produtos sem `store_id` ainda funcionam se `VITE_STORE_ID` não estiver configurado

### Pull do Supabase
- O pull agora é **não-destrutivo**: nunca apaga itens locais que não estão no Supabase
- Itens pendentes na outbox são protegidos de sobrescrita
- Itens locais mais recentes (por `updated_at`) são mantidos

### Filtros
- Filtros são ajustados automaticamente se um produto criado não passaria no filtro atual
- Isso garante que produtos recém-criados sempre apareçam imediatamente

---

## ✅ Resultado Final

- ✅ **Bug corrigido**: Produtos criados agora persistem corretamente
- ✅ **Logs adicionados**: Facilita debug futuro
- ✅ **Teste de regressão**: Previne recorrência
- ✅ **Offline-first garantido**: Produtos locais não são apagados
- ✅ **Store ID**: Produtos recebem `store_id` automaticamente
- ✅ **Filtros inteligentes**: Produtos recém-criados sempre aparecem

---

**Data:** 2026-01-22  
**Status:** ✅ Bug corrigido e testado
