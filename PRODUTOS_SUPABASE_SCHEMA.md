# 📊 Análise de Campos: Produtos → Supabase

## 🔍 Locais onde produtos são inseridos/atualizados no Supabase

### 1. **SupabaseTestPage.tsx** (linha 248-255)
```typescript
const produtoTeste: any = {
  nome: 'Produto Teste Supabase',
  preco: 1.99,
  estoque: 1,
  ativo: true,
  descricao: '[TESTE_SUPABASE] Produto criado automaticamente para teste'
  // created_at e updated_at serão gerados automaticamente pelo Supabase
};
```

**Campos enviados no INSERT:**
- `nome` (string)
- `preco` (number)
- `estoque` (number)
- `ativo` (boolean)
- `descricao` (string, opcional)

---

### 2. **ProdutosPage.tsx** (linha 62-71)
```typescript
const produtoData = {
  nome: formData.nome,
  descricao: formData.descricao || undefined,
  preco: parseFloat(formData.preco) || 0,
  custo: formData.custo ? parseFloat(formData.custo) : undefined,
  estoque: parseInt(formData.estoque) || 0,
  codigoBarras: formData.codigoBarras || undefined,
  categoria: formData.categoria || undefined,
  ativo: formData.ativo
};
```

**Campos que podem ser enviados (quando sincronização for implementada):**
- `nome` (string, obrigatório)
- `descricao` (string, opcional)
- `preco` (number, obrigatório)
- `custo` (number, opcional)
- `estoque` (number, obrigatório)
- `codigoBarras` (string, opcional)
- `categoria` (string, opcional)
- `ativo` (boolean, obrigatório)

---

### 3. **Interface TypeScript: Produto** (`src/types/index.ts`)
```typescript
export interface Produto {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  custo?: number;
  estoque: number;
  codigoBarras?: string;
  categoria?: string;
  ativo: boolean;
  created_at?: string; // Timestamp do Supabase
  updated_at?: string; // Timestamp do Supabase
}
```

---

## 📋 Lista Completa de Campos (Payload Final)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID/string | ✅ | ID único (gerado pelo Supabase ou app) |
| `nome` | TEXT | ✅ | Nome do produto |
| `descricao` | TEXT | ❌ | Descrição detalhada |
| `preco` | DECIMAL(10,2) | ✅ | Preço de venda |
| `custo` | DECIMAL(10,2) | ❌ | Custo de aquisição |
| `estoque` | INTEGER | ✅ | Quantidade em estoque |
| `codigoBarras` | TEXT | ❌ | Código de barras |
| `categoria` | TEXT | ❌ | Categoria do produto |
| `ativo` | BOOLEAN | ✅ | Status ativo/inativo |
| `created_at` | TIMESTAMPTZ | ✅ | Data de criação (gerado pelo Supabase) |
| `updated_at` | TIMESTAMPTZ | ✅ | Data de atualização (gerado pelo Supabase) |

---

## 🗄️ SQL ALTER TABLE

```sql
-- Adicionar colunas faltantes na tabela public.produtos
-- Execute no SQL Editor do Supabase

-- Verificar se a tabela existe, se não, criar
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar coluna 'nome' (obrigatório)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'produtos' 
                 AND column_name = 'nome') THEN
    ALTER TABLE public.produtos ADD COLUMN nome TEXT NOT NULL;
  END IF;
END $$;

-- Adicionar coluna 'descricao' (opcional)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'produtos' 
                 AND column_name = 'descricao') THEN
    ALTER TABLE public.produtos ADD COLUMN descricao TEXT;
  END IF;
END $$;

-- Adicionar coluna 'preco' (obrigatório)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'produtos' 
                 AND column_name = 'preco') THEN
    ALTER TABLE public.produtos ADD COLUMN preco DECIMAL(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Adicionar coluna 'custo' (opcional)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'produtos' 
                 AND column_name = 'custo') THEN
    ALTER TABLE public.produtos ADD COLUMN custo DECIMAL(10,2);
  END IF;
END $$;

-- Adicionar coluna 'estoque' (obrigatório)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'produtos' 
                 AND column_name = 'estoque') THEN
    ALTER TABLE public.produtos ADD COLUMN estoque INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Adicionar coluna 'codigoBarras' (opcional)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'produtos' 
                 AND column_name = 'codigoBarras') THEN
    ALTER TABLE public.produtos ADD COLUMN "codigoBarras" TEXT;
  END IF;
END $$;

-- Adicionar coluna 'categoria' (opcional)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'produtos' 
                 AND column_name = 'categoria') THEN
    ALTER TABLE public.produtos ADD COLUMN categoria TEXT;
  END IF;
END $$;

-- Adicionar coluna 'ativo' (obrigatório)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'produtos' 
                 AND column_name = 'ativo') THEN
    ALTER TABLE public.produtos ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- Garantir que created_at e updated_at existem e têm defaults
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'produtos' 
                 AND column_name = 'created_at') THEN
    ALTER TABLE public.produtos ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'produtos' 
                 AND column_name = 'updated_at') THEN
    ALTER TABLE public.produtos ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_produtos_updated_at ON public.produtos;
CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Notificar PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
```

---

## ✅ Lista Final de Colunas no Banco (após ALTER TABLE)

| Coluna | Tipo | Nullable | Default | Descrição |
|--------|------|----------|---------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | Chave primária |
| `nome` | TEXT | NOT NULL | - | Nome do produto |
| `descricao` | TEXT | NULL | - | Descrição detalhada |
| `preco` | DECIMAL(10,2) | NOT NULL | `0` | Preço de venda |
| `custo` | DECIMAL(10,2) | NULL | - | Custo de aquisição |
| `estoque` | INTEGER | NOT NULL | `0` | Quantidade em estoque |
| `codigoBarras` | TEXT | NULL | - | Código de barras |
| `categoria` | TEXT | NULL | - | Categoria do produto |
| `ativo` | BOOLEAN | NOT NULL | `true` | Status ativo/inativo |
| `created_at` | TIMESTAMPTZ | NULL | `NOW()` | Data de criação |
| `updated_at` | TIMESTAMPTZ | NULL | `NOW()` | Data de atualização (atualizado via trigger) |

---

## 🔄 Comparação: Payload vs Banco

### ✅ Campos que devem estar no banco (11 colunas):

1. ✅ `id` - UUID (gerado automaticamente ou enviado)
2. ✅ `nome` - TEXT NOT NULL
3. ✅ `descricao` - TEXT NULL
4. ✅ `preco` - DECIMAL(10,2) NOT NULL
5. ✅ `custo` - DECIMAL(10,2) NULL
6. ✅ `estoque` - INTEGER NOT NULL
7. ✅ `codigoBarras` - TEXT NULL
8. ✅ `categoria` - TEXT NULL
9. ✅ `ativo` - BOOLEAN NOT NULL
10. ✅ `created_at` - TIMESTAMPTZ (gerado automaticamente)
11. ✅ `updated_at` - TIMESTAMPTZ (atualizado via trigger)

---

## 📝 Notas Importantes

1. **`id`**: Pode ser UUID gerado pelo Supabase ou string enviada pelo app
2. **`created_at` e `updated_at`**: Gerados/atualizados automaticamente pelo Supabase (não enviar no INSERT/UPDATE)
3. **`codigoBarras`**: Nome da coluna usa camelCase (entre aspas no SQL)
4. **Trigger**: O trigger `update_produtos_updated_at` atualiza `updated_at` automaticamente em UPDATEs
5. **NOTIFY**: O comando `NOTIFY pgrst, 'reload schema'` recarrega o schema do PostgREST para que as mudanças sejam refletidas imediatamente na API

---

## 🚀 Como Executar

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Cole o SQL acima
4. Execute (Run)
5. Verifique se todas as colunas foram criadas

---

**Status:** ✅ Schema completo e pronto para sincronização!
