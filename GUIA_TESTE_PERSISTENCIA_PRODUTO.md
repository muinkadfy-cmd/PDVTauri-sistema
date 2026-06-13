# 🧪 Guia: Teste de Persistência de Produtos

## Objetivo
Verificar se um produto criado permanece após trocar de aba e voltar.

---

## 📋 Teste Manual Passo a Passo

### 1. Abrir a Aplicação
1. Abrir o navegador
2. Acessar `http://localhost:4173` (ou a URL do preview)
3. Aguardar a aplicação carregar

### 2. Navegar para Produtos
1. Clicar no menu lateral (ou usar a navegação)
2. Selecionar **"Produtos"** (`/produtos`)
3. Verificar se a lista de produtos está carregada

### 3. Criar um Produto
1. Clicar no botão **"+ Novo Produto"**
2. Preencher o formulário:
   - **Nome:** `Produto Teste Persistência`
   - **Preço de Venda:** `99.99`
   - **Estoque:** `10`
   - **Ativo:** ✅ (marcado)
   - **Descrição:** `Produto criado para teste de persistência` (opcional)
3. Clicar em **"Salvar"**
4. Verificar se aparece uma mensagem de sucesso
5. Verificar se o produto aparece na lista

### 4. Trocar de Aba
1. Clicar em outra aba do menu (ex: **"Clientes"** ou **"Vendas"**)
2. Aguardar a página carregar completamente
3. Aguardar alguns segundos (2-3 segundos)

### 5. Voltar para Produtos
1. Clicar novamente em **"Produtos"** no menu
2. Aguardar a página carregar
3. **VERIFICAR:** O produto **"Produto Teste Persistência"** deve estar na lista

### 6. Teste Adicional: Recarregar Página (F5)
1. Pressionar **F5** (recarregar página)
2. Aguardar a página carregar
3. **VERIFICAR:** O produto **"Produto Teste Persistência"** deve ainda estar na lista

---

## ✅ Resultado Esperado

### ✅ Sucesso
- Produto aparece na lista após criar
- Produto permanece na lista após trocar de aba
- Produto permanece na lista após recarregar (F5)
- Dados do produto estão corretos (nome, preço, estoque)

### ❌ Falha
- Produto desaparece após trocar de aba
- Produto desaparece após recarregar (F5)
- Produto não aparece na lista após criar

---

## 🔍 Diagnóstico em Caso de Falha

### 1. Verificar Console do Navegador
1. Abrir DevTools (F12)
2. Ir para a aba **Console**
3. Verificar se há erros em vermelho
4. Procurar por mensagens relacionadas a produtos

### 2. Verificar LocalStorage
1. Abrir DevTools (F12)
2. Ir para **Application** → **Local Storage** → `http://localhost:4173`
3. Procurar pela chave `smart-tech-produtos`
4. Clicar na chave para ver o valor
5. Verificar se o produto está salvo no JSON

**Comando no Console:**
```javascript
// Ver todos os produtos no LocalStorage
const produtos = JSON.parse(localStorage.getItem('smart-tech-produtos') || '[]');
console.log('Produtos no LocalStorage:', produtos);

// Procurar produto específico
const produtoTeste = produtos.find(p => p.nome === 'Produto Teste Persistência');
console.log('Produto Teste:', produtoTeste);
```

### 3. Usar Página de Diagnóstico
1. Navegar para `/produtos-diagnostico`
2. Clicar em **"🔄 Atualizar Diagnóstico"**
3. Verificar:
   - Quantidade de produtos no LocalStorage
   - Quantidade de produtos válidos
   - Quantidade de produtos inválidos
   - Se há diferença entre `produtosRepo.list()` e `getProdutos()`

### 4. Verificar Repository
**Comando no Console:**
```javascript
// Ver produtos via Repository
import { produtosRepo } from '@/lib/repositories';
const produtosRepo = produtosRepo.list();
console.log('Produtos via Repository:', produtosRepo);

// Ver produtos via getProdutos()
import { getProdutos } from '@/lib/produtos';
const produtosGet = getProdutos();
console.log('Produtos via getProdutos():', produtosGet);
```

---

## 🧪 Teste Automatizado

### Executar Teste de Navegação
1. Navegar para `/testes`
2. Clicar em **"Rodar Todos os Testes"**
3. Procurar pelo teste **"Produtos - Persistência Após Navegação"**
4. Verificar se passou (✅) ou falhou (❌)

### Teste Criado
- **Arquivo:** `src/lib/testing/tests/produtos-navegacao.test.ts`
- **Função:** `testProdutosNavegacao()`
- **Validações:**
  - Produto criado com sucesso
  - Produto aparece na lista após criar
  - Produto persiste após simular navegação
  - Produto persiste no LocalStorage
  - Dados do produto estão corretos

---

## 📝 Notas

### O que o Teste Automatizado Faz
1. Cria um produto de teste com nome `[TESTE_NAV_PRODUTO] Produto Teste Navegação`
2. Verifica se o produto aparece na lista
3. Simula navegação (recarrega produtos do LocalStorage)
4. Verifica se o produto ainda está na lista
5. Verifica se os dados estão corretos
6. Limpa o produto de teste

### Limitações do Teste Automatizado
- Não navega realmente entre páginas (não é possível sem navegação real)
- Simula navegação recarregando produtos do LocalStorage
- Para teste completo de navegação, use o teste manual

---

## 🚀 Comandos Úteis

### Limpar Produtos de Teste
```javascript
// No console do navegador
import { getProdutos, deletarProduto } from '@/lib/produtos';
const produtos = getProdutos();
const produtosTeste = produtos.filter(p => 
  p.nome.includes('[TESTE_NAV_PRODUTO]') || 
  p.nome.includes('[TESTE_PERSIST_PRODUTO]')
);
for (const produto of produtosTeste) {
  await deletarProduto(produto.id);
}
console.log(`Removidos ${produtosTeste.length} produtos de teste`);
```

### Criar Produto de Teste Manualmente
```javascript
// No console do navegador
import { criarProduto } from '@/lib/produtos';
const produto = await criarProduto({
  nome: 'Produto Teste Persistência',
  preco: 99.99,
  estoque: 10,
  ativo: true
});
console.log('Produto criado:', produto);
```

---

**Data:** 2026-01-22  
**Status:** ✅ Teste criado e documentado
