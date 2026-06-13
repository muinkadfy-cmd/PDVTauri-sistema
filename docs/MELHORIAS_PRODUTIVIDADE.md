# ✅ Melhorias de Produtividade e Auto-preenchimento

**Data:** 2026-01-24  
**Status:** ✅ Implementado

---

## 📋 Funcionalidades Implementadas

### 1. Hook `useSmartForm` ✅

**Arquivo:** `src/hooks/useSmartForm.ts`

**Funcionalidades:**
- ✅ Salva rascunho automaticamente no localStorage
- ✅ Restaura dados ao voltar na tela
- ✅ Debounce de 300ms para evitar salvamentos excessivos
- ✅ Função `clearDraft()` para limpar rascunho
- ✅ Função `resetForm()` para resetar formulário
- ✅ Flag `hasDraft` para indicar se há rascunho salvo

**Uso:**
```typescript
const { formData, setFormData, clearDraft, hasDraft } = useSmartForm({
  formKey: 'clientes',
  initialValues: { nome: '', telefone: '', ... }
});
```

### 2. Utilitários de Máscara ✅

**Arquivo:** `src/lib/masks.ts`

**Máscaras disponíveis:**
- ✅ Telefone: `(11) 98765-4321`
- ✅ CPF: `123.456.789-00`
- ✅ CNPJ: `12.345.678/0001-90`
- ✅ Moeda: `R$ 1.234,56`
- ✅ CEP: `12345-678`

**Componente:** `src/components/forms/MaskedInput.tsx`
- ✅ Input reutilizável com máscaras
- ✅ `inputMode` correto para mobile
- ✅ Suporte a `onEnterPress` para ir ao próximo campo

### 3. CompanyContext ✅

**Arquivo:** `src/contexts/CompanyContext.tsx`

**Funcionalidades:**
- ✅ Carrega dados da empresa do Supabase
- ✅ Filtra por `store_id`
- ✅ Cache automático
- ✅ Função `refresh()` para atualizar dados

**Uso:**
```typescript
const { company, loading, error } = useCompany();
```

### 4. Componentes de Impressão ✅

**Arquivos:**
- `src/components/print/PrintHeaderCompany.tsx`
- `src/components/print/PrintFooterCompany.tsx`

**Funcionalidades:**
- ✅ Cabeçalho com dados da empresa (nome, CNPJ, endereço, telefone)
- ✅ Logo opcional
- ✅ Rodapé com mensagem personalizada
- ✅ Responsivo para A4 e 80mm

**Uso:**
```tsx
<PrintHeaderCompany title="Ordem de Serviço" showLogo={true} />
{/* conteúdo */}
<PrintFooterCompany additionalMessage="Obrigado!" />
```

### 5. Barra de Ações Rápidas ✅

**Arquivo:** `src/components/quick-actions/QuickActionsBar.tsx`

**Funcionalidades:**
- ✅ Botões para criar: Cliente, Venda, OS, Produto
- ✅ Posições: top, bottom, floating
- ✅ Modo icon-only para mobile
- ✅ Navegação direta para páginas com `?action=new`

**Uso:**
```tsx
<QuickActionsBar position="floating" iconOnly={isMobile} />
```

### 6. Helpers de Clientes ✅

**Arquivo:** `src/lib/clientes-helpers.ts`

**Funcionalidades:**
- ✅ `buscarClientePorTelefone()` - Busca cliente pelo telefone
- ✅ `buscarClientePorCPF()` - Busca cliente pelo CPF
- ✅ `sugerirDadosCliente()` - Sugere dados baseado em telefone/CPF

---

## 📁 Arquivos Criados

1. ✅ `src/hooks/useSmartForm.ts` - Hook para rascunhos
2. ✅ `src/lib/masks.ts` - Utilitários de máscara
3. ✅ `src/components/forms/MaskedInput.tsx` - Input com máscara
4. ✅ `src/contexts/CompanyContext.tsx` - Contexto da empresa
5. ✅ `src/components/print/PrintHeaderCompany.tsx` - Cabeçalho de impressão
6. ✅ `src/components/print/PrintHeaderCompany.css` - Estilos do cabeçalho
7. ✅ `src/components/print/PrintFooterCompany.tsx` - Rodapé de impressão
8. ✅ `src/components/print/PrintFooterCompany.css` - Estilos do rodapé
9. ✅ `src/components/quick-actions/QuickActionsBar.tsx` - Barra de ações rápidas
10. ✅ `src/components/quick-actions/QuickActionsBar.css` - Estilos da barra
11. ✅ `src/lib/clientes-helpers.ts` - Helpers de clientes
12. ✅ `docs/sql/create_empresa_table.sql` - SQL para tabela empresa

---

## 🔧 Como Aplicar nas Páginas

### Exemplo: ClientesPage

```typescript
import { useSmartForm } from '@/hooks/useSmartForm';
import { MaskedInput } from '@/components/forms/MaskedInput';
import { maskPhone, maskCPF, maskCEP } from '@/lib/masks';
import { sugerirDadosCliente } from '@/lib/clientes-helpers';
import { useRef } from 'react';

function ClientesPage() {
  const nomeInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  
  const { formData, setFormData, clearDraft, hasDraft } = useSmartForm({
    formKey: 'clientes',
    initialValues: {
      nome: '',
      email: '',
      telefone: '',
      cpf: '',
      // ...
    }
  });

  // Auto-preenchimento ao digitar telefone
  const handleTelefoneChange = (value: string) => {
    const masked = maskPhone(value);
    setFormData({ ...formData, telefone: masked });
    
    // Buscar cliente existente
    if (value.replace(/\D/g, '').length >= 10) {
      const sugestao = sugerirDadosCliente(value);
      if (sugestao && !formData.nome) {
        setFormData({ ...formData, telefone: masked, ...sugestao });
        showToast('Cliente encontrado! Dados preenchidos automaticamente.', 'info');
      }
    }
  };

  return (
    <>
      {hasDraft && (
        <button onClick={clearDraft}>Limpar rascunho</button>
      )}
      
      <MaskedInput
        ref={nomeInputRef}
        mask="none"
        value={formData.nome}
        onChange={(value) => setFormData({ ...formData, nome: value })}
        onEnterPress={() => emailInputRef.current?.focus()}
        autoFocus
        placeholder="Nome completo"
      />
      
      <MaskedInput
        mask="phone"
        value={formData.telefone}
        onChange={handleTelefoneChange}
        placeholder="(11) 98765-4321"
      />
      
      <MaskedInput
        mask="cpf"
        value={formData.cpf}
        onChange={(value) => setFormData({ ...formData, cpf: maskCPF(value) })}
        placeholder="123.456.789-00"
      />
    </>
  );
}
```

---

## 🗄️ Banco de Dados

### Tabela `empresa`

Execute o SQL em `docs/sql/create_empresa_table.sql` no Supabase.

**Campos:**
- `id` (UUID)
- `store_id` (UUID) - Vinculado ao VITE_STORE_ID
- `nome_fantasia` (TEXT)
- `razao_social` (TEXT)
- `cnpj` (TEXT)
- `telefone` (TEXT)
- `endereco` (TEXT)
- `cidade` (TEXT)
- `estado` (TEXT)
- `cep` (TEXT)
- `logo_url` (TEXT) - Opcional
- `mensagem_rodape` (TEXT) - Opcional

---

## 📝 Próximos Passos

### Para aplicar nas outras páginas:

1. **ProdutosPage:**
   - Usar `useSmartForm` com `formKey: 'produtos'`
   - Ao digitar código de barras, buscar produto existente
   - Máscara para valores monetários

2. **OrdensPage:**
   - Usar `useSmartForm` com `formKey: 'ordens'`
   - Ao selecionar cliente, preencher automaticamente dados
   - Buscar histórico de modelos do cliente

3. **VendasPage:**
   - Usar `useSmartForm` com `formKey: 'vendas'`
   - Auto-preenchimento ao selecionar cliente

4. **Impressões:**
   - Substituir cabeçalhos/rodapés antigos por `PrintHeaderCompany` e `PrintFooterCompany`
   - Aplicar em: ReciboPage, OrdensPage (impressão), etc.

---

## ✅ Status

- ✅ Hook useSmartForm criado
- ✅ Máscaras implementadas
- ✅ CompanyContext criado
- ✅ Componentes de impressão criados
- ✅ Barra de ações rápidas criada
- ✅ Helpers de clientes criados
- ✅ SQL da tabela empresa criado
- ✅ CompanyProvider integrado no Layout
- ⏳ Páginas precisam ser ajustadas (exemplo em ClientesPage)

---

## 🚀 Como Testar

1. **Rascunho automático:**
   - Abra página de clientes
   - Preencha alguns campos
   - Feche a página
   - Abra novamente → campos devem estar preenchidos

2. **Auto-preenchimento:**
   - Digite telefone de cliente existente
   - Dados devem ser preenchidos automaticamente

3. **Máscaras:**
   - Digite telefone → deve formatar automaticamente
   - Digite CPF → deve formatar automaticamente

4. **Impressão:**
   - Use `PrintHeaderCompany` e `PrintFooterCompany`
   - Configure dados da empresa no Supabase
   - Imprima → deve mostrar dados da empresa
