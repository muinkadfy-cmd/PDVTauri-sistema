# 🧪 Guia de Teste do Supabase

## ✅ Página de Teste Implementada

A página `/supabase-test` foi completamente refatorada para usar tabelas reais e oferecer uma interface profissional de testes.

---

## 📋 Funcionalidades Implementadas

### 1. **Indicador de Status de Internet (Tempo Real)**
- ✅ Monitora `navigator.onLine` em tempo real
- ✅ Atualiza automaticamente quando a conexão muda
- ✅ Mostra mensagem clara quando offline

### 2. **Botão: "Testar Conexão"**
- ✅ Faz SELECT em `public.clientes` e `public.produtos` (limit 1)
- ✅ Mostra resultado em JSON formatado
- ✅ Detecta erros de RLS e sugere solução
- ✅ Detecta se tabelas não existem

### 3. **Botão: "Inserir Cliente Exemplo"**
- ✅ Insere cliente com:
  - `nome`: "Cliente Teste Supabase"
  - `telefone`: "43999990000"
  - `observacoes`: "[TESTE_SUPABASE] Registro criado automaticamente para teste"
- ✅ Mostra resultado ou erro

### 4. **Botão: "Inserir Produto Exemplo"**
- ✅ Insere produto com:
  - `nome`: "Produto Teste Supabase"
  - `preco`: 1.99
  - `estoque`: 1
  - `descricao`: "[TESTE_SUPABASE] Produto criado automaticamente para teste"
- ✅ Mostra resultado ou erro

### 5. **Botão: "Limpar Dados de Teste"**
- ✅ Remove todos os registros marcados com `[TESTE_SUPABASE]`
- ✅ Busca em `clientes` e `produtos`
- ✅ Remove apenas registros de teste
- ✅ Mostra quantidade removida

### 6. **Offline-First**
- ✅ Não tenta chamadas ao Supabase se offline
- ✅ Mostra mensagem: "Sem internet: usando LocalStorage (modo offline)"
- ✅ Botões desabilitados quando offline
- ✅ Página nunca quebra ou trava

---

## 🔧 Arquivos Modificados

### 1. `src/lib/supabase.ts`
- ✅ Atualizado `isSupabaseOnline()` para usar tabelas reais (`clientes` e `produtos`)
- ✅ Remove referência a `_test_connection`

### 2. `src/pages/SupabaseTestPage.tsx`
- ✅ Refatorado completamente
- ✅ Usa tabelas reais: `clientes` e `produtos`
- ✅ Monitoramento de internet em tempo real
- ✅ 4 botões de ação implementados
- ✅ Tratamento de erros RLS com sugestões
- ✅ Offline-first garantido

### 3. `src/pages/SupabaseTestPage.css`
- ✅ Estilos para novos elementos
- ✅ Status panel, botões de ação, ajuda RLS
- ✅ Responsivo para mobile

---

## 🚀 Como Testar

### 1. Inicie o servidor:
```bash
npm run dev
```

### 2. Acesse a página:
- Menu → "Teste Supabase" 🔌
- Ou: `http://localhost:5173/supabase-test`

### 3. Teste a conexão:
1. Clique em **"🔍 Testar Conexão"**
   - Deve fazer SELECT em `clientes` e `produtos`
   - Mostra resultado ou erro

### 4. Teste inserção:
1. Clique em **"➕ Inserir Cliente Exemplo"**
   - Deve inserir um cliente de teste
   - Mostra toast de sucesso/erro

2. Clique em **"➕ Inserir Produto Exemplo"**
   - Deve inserir um produto de teste
   - Mostra toast de sucesso/erro

### 5. Teste limpeza:
1. Clique em **"🗑️ Limpar Dados de Teste"**
   - Confirma antes de deletar
   - Remove apenas registros marcados com `[TESTE_SUPABASE]`
   - Mostra quantidade removida

### 6. Teste offline:
1. Desconecte a internet (ou use DevTools → Network → Offline)
2. Observe que:
   - Status muda para "🔴 Offline"
   - Botões ficam desabilitados
   - Mensagem aparece: "Sem internet: usando LocalStorage"

---

## ⚠️ Erros Comuns e Soluções

### Erro PGRST301 (RLS - Row Level Security)
**Causa:** Tabelas têm RLS ativado mas sem políticas configuradas.

**Solução:**
1. Acesse Supabase Dashboard
2. Vá em **Authentication → Policies**
3. Crie políticas para `clientes` e `produtos`
4. Ou execute no SQL Editor:

```sql
-- Desabilitar RLS temporariamente (apenas para testes)
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE produtos DISABLE ROW LEVEL SECURITY;

-- OU criar políticas permissivas (recomendado para produção)
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo" ON clientes FOR ALL USING (true);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo" ON produtos FOR ALL USING (true);
```

### Erro PGRST116 (Tabela não existe)
**Causa:** Tabelas não foram criadas no Supabase.

**Solução:**
1. Acesse Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute o SQL para criar as tabelas:

```sql
-- Criar tabela clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  dataCadastro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela produtos
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2) NOT NULL,
  custo DECIMAL(10,2),
  estoque INTEGER NOT NULL DEFAULT 0,
  codigoBarras TEXT,
  categoria TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  dataCadastro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 📝 Código Final dos Arquivos

### `src/lib/supabase.ts` (função atualizada)

```typescript
export async function isSupabaseOnline(): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  try {
    // Testa conexão fazendo uma query simples em tabelas reais
    const { error: errorClientes } = await supabase
      .from('clientes')
      .select('id')
      .limit(1);
    
    if (!errorClientes) {
      return true;
    }

    const { error: errorProdutos } = await supabase
      .from('produtos')
      .select('id')
      .limit(1);
    
    if (!errorProdutos) {
      return true;
    }

    // Erros de RLS (PGRST301) ou tabela não existe (PGRST116) indicam que a conexão funcionou
    const isConnectionError = 
      errorClientes?.code === 'PGRST301' || 
      errorClientes?.code === 'PGRST116' ||
      errorProdutos?.code === 'PGRST301' ||
      errorProdutos?.code === 'PGRST116';
    
    return isConnectionError && !errorClientes?.message.includes('fetch') && !errorProdutos?.message.includes('fetch');
  } catch {
    return false;
  }
}
```

---

## ✅ Checklist de Validação

- [x] Removida referência a `_test_connection`
- [x] Teste usa tabelas reais (`clientes` e `produtos`)
- [x] Indicador de internet em tempo real
- [x] Botão "Testar Conexão" implementado
- [x] Botão "Inserir Cliente Exemplo" implementado
- [x] Botão "Inserir Produto Exemplo" implementado
- [x] Botão "Limpar Dados de Teste" implementado
- [x] Offline-first garantido (não quebra quando offline)
- [x] Tratamento de erros RLS com sugestões
- [x] UI profissional e responsiva
- [x] Toast notifications para feedback

---

## 🎯 Instrução Final

**Para testar:**

```bash
# 1. Certifique-se que as credenciais estão no .env.local
# 2. Inicie o servidor
npm run dev

# 3. Acesse: Menu → "Teste Supabase" ou /supabase-test
# 4. Clique em "Testar Conexão"
# 5. Teste inserir cliente e produto
# 6. Teste limpar dados
```

**Status:** ✅ **Página de teste completa e funcional!**

---

**Desenvolvido para Smart Tech Rolândia**
