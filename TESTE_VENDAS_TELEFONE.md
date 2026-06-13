# ✅ Checklist de Testes - Campo Telefone e WhatsApp

## Pré-requisitos
- [ ] Build foi executado com sucesso (`npm run build`)
- [ ] Aplicação está rodando (local ou deploy)
- [ ] Migração SQL foi executada no Supabase (se estiver usando sync)

---

## 🧪 TESTE 1: Ordens de Serviço

### 1.1 - Criar Nova Ordem com Telefone

**Passos:**
1. Acesse a página **Ordens de Serviço** (`/ordens`)
2. Clique em **+ Nova Ordem**
3. Preencha o formulário:
   - **Cliente**: Selecione ou crie um cliente (ex: "João Silva")
   - **Celular do Cliente**: Digite um número (ex: "(43) 99999-8888")
   - **Equipamento**: Selecione "Celular"
   - **Marca do Aparelho**: Digite "Samsung"
   - **Modelo do Aparelho**: Digite "Galaxy S21"
   - **Defeito Relatado**: Selecione "Tela quebrada"
4. Clique em **Salvar**

**Resultado Esperado:**
- ✅ Campo "Celular do Cliente" deve aparecer logo **abaixo** do campo "Cliente"
- ✅ Ordem criada com sucesso
- ✅ Toast de confirmação aparece

### 1.2 - Verificar Botão WhatsApp na Lista

**Passos:**
1. Na lista de ordens, localize a ordem recém-criada
2. Observe os botões de ação

**Resultado Esperado:**
- ✅ Botão WhatsApp (ícone verde) deve aparecer **antes** do botão de impressora
- ✅ Ao passar o mouse, deve mostrar tooltip "Enviar via WhatsApp"

### 1.3 - Testar Envio via WhatsApp

**Passos:**
1. Clique no botão WhatsApp da ordem
2. Uma nova aba deve abrir com o WhatsApp Web

**Resultado Esperado:**
- ✅ Abre WhatsApp Web com o número formatado (55 + DDD + número)
- ✅ Mensagem pré-formatada contém:
  - 📋 Título: "ORDEM DE SERVIÇO #número"
  - Nome: Smart Tech Rolândia
  - Cliente: João Silva
  - Equipamento: Celular
  - Marca: Samsung
  - Modelo: Galaxy S21
  - Defeito: Tela quebrada
  - Status e datas

### 1.4 - Editar Ordem Existente

**Passos:**
1. Clique no botão de editar (✏️) de uma ordem
2. Verifique o campo "Celular do Cliente"
3. Modifique o telefone (ex: "(43) 98888-7777")
4. Salve

**Resultado Esperado:**
- ✅ Campo está preenchido com o telefone anterior
- ✅ Permite alterar o telefone
- ✅ Após salvar, botão WhatsApp atualiza com novo número

### 1.5 - Ordem sem Telefone

**Passos:**
1. Crie uma nova ordem **sem** preencher o campo "Celular do Cliente"
2. Salve a ordem

**Resultado Esperado:**
- ✅ Ordem criada normalmente
- ✅ Botão WhatsApp **não aparece** na lista (sem telefone cadastrado)

---

## 🧪 TESTE 2: Vendas (Quando implementado)

### 2.1 - Criar Venda com Telefone

**Status:** Campo `clienteTelefone` já está no tipo `Venda`, mas o formulário ainda não foi atualizado.

**Próximos passos:**
- Adicionar campo "Celular do Cliente" no formulário de vendas
- Adicionar botão WhatsApp na lista de vendas
- Seguir mesmo padrão das ordens de serviço

---

## 🧪 TESTE 3: Sincronização com Supabase

### 3.1 - Verificar Coluna no Supabase

**Passos:**
1. Acesse o **Supabase Dashboard** → SQL Editor
2. Execute a query:

```sql
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND column_name = 'cliente_telefone'
ORDER BY table_name;
```

**Resultado Esperado:**
- ✅ Deve retornar 3 linhas:
  - `ordens_servico | cliente_telefone | text`
  - `vendas | cliente_telefone | text`
  - `recibos | cliente_telefone | text`

### 3.2 - Verificar Sincronização

**Passos:**
1. Crie uma ordem com telefone no app (modo online)
2. Aguarde alguns segundos para sincronizar
3. No Supabase, consulte a tabela:

```sql
SELECT 
  numero,
  cliente_nome,
  cliente_telefone,
  equipamento,
  created_at
FROM public.ordens_servico
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado Esperado:**
- ✅ Ordem aparece na tabela do Supabase
- ✅ Campo `cliente_telefone` está preenchido corretamente

---

## 🧪 TESTE 4: Impressão

### 4.1 - Imprimir Ordem com Telefone

**Passos:**
1. Clique no botão de impressora de uma ordem que tem telefone
2. Verifique o comprovante impresso

**Resultado Esperado:**
- ✅ Comprovante abre em nova janela
- ✅ Telefone do cliente aparece no comprovante (se configurado no template)
- ✅ Layout está correto conforme o padrão

---

## 📊 Relatório de Bugs

Se encontrar algum problema, anote aqui:

### Bug #1
- **Onde:** _______________
- **O que aconteceu:** _______________
- **O que deveria acontecer:** _______________
- **Como reproduzir:** _______________

---

## ✅ Checklist Geral

Após todos os testes, marque:

- [ ] Campo "Celular do Cliente" aparece no formulário de ordem
- [ ] Campo está posicionado logo abaixo do campo "Cliente"
- [ ] Campo aceita entrada de telefone
- [ ] Ordem salva com telefone corretamente
- [ ] Botão WhatsApp aparece quando há telefone
- [ ] Botão WhatsApp NÃO aparece quando não há telefone
- [ ] Clique no WhatsApp abre conversa com mensagem formatada
- [ ] Edição de ordem preserva o telefone
- [ ] Sincronização com Supabase funciona (se aplicável)
- [ ] TypeScript não apresenta erros
- [ ] Build passa sem warnings

---

## 🚀 Testes de Deploy (Cloudflare Pages)

Após fazer o deploy:

- [ ] Aplicação carrega sem erros no console
- [ ] Funcionalidades de ordem com telefone funcionam em produção
- [ ] WhatsApp funciona em dispositivos móveis
- [ ] PWA instala e funciona offline (sem sincronização, mas mantém dados locais)

---

**Data do Teste:** _____________  
**Testado por:** _____________  
**Versão:** Build de 30/01/2026
