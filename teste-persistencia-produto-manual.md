# 🧪 Teste Manual: Persistência de Produtos

## Objetivo
Verificar se um produto criado permanece após trocar de aba e voltar.

## Passos para Teste Manual

### 1. Abrir a Aplicação
- Abrir `http://localhost:4173` (ou a URL do preview)
- Navegar para a aba **Produtos** (`/produtos`)

### 2. Criar um Produto
- Clicar no botão **"+ Novo Produto"**
- Preencher o formulário:
  - **Nome:** "Produto Teste Persistência"
  - **Preço:** 99.99
  - **Estoque:** 10
  - **Ativo:** ✅ (marcado)
- Clicar em **"Salvar"**
- Verificar se o produto aparece na lista

### 3. Trocar de Aba
- Navegar para outra aba (ex: **Clientes** ou **Vendas**)
- Aguardar alguns segundos

### 4. Voltar para Produtos
- Navegar de volta para a aba **Produtos** (`/produtos`)
- Verificar se o produto **"Produto Teste Persistência"** ainda está na lista

### 5. Verificar Persistência Após F5
- Pressionar **F5** (recarregar página)
- Verificar se o produto ainda está na lista após recarregar

## Resultado Esperado
✅ O produto deve permanecer na lista após:
- Trocar de aba
- Voltar para produtos
- Recarregar a página (F5)

## Se o Produto Desaparecer
1. Abrir DevTools (F12)
2. Ir para **Application** → **Local Storage**
3. Verificar a chave `smart-tech-produtos`
4. Verificar se o produto está salvo
5. Se não estiver, verificar console para erros
6. Usar a página `/produtos-diagnostico` para diagnosticar

## Comandos Úteis

### Verificar LocalStorage via Console
```javascript
// Ver todos os produtos no LocalStorage
const produtos = JSON.parse(localStorage.getItem('smart-tech-produtos') || '[]');
console.log('Produtos no LocalStorage:', produtos);

// Verificar produto específico
const produtoTeste = produtos.find(p => p.nome === 'Produto Teste Persistência');
console.log('Produto Teste:', produtoTeste);
```

### Verificar Repository
```javascript
// Ver produtos via Repository
import { produtosRepo } from '@/lib/repositories';
const produtosRepo = produtosRepo.list();
console.log('Produtos via Repository:', produtosRepo);
```

---

**Data:** 2026-01-22  
**Status:** ⏳ Aguardando teste manual
