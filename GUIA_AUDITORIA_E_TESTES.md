# 🧪 Guia: Executar Auditoria e Testes

## 📋 Índice

1. [Executar Auditoria](#executar-auditoria)
2. [Rodar Todos os Testes](#rodar-todos-os-testes)
3. [Interpretar Resultados](#interpretar-resultados)
4. [Troubleshooting](#troubleshooting)

---

## 🔍 EXECUTAR AUDITORIA

### Passo a Passo

#### 1. Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

#### 2. Abrir a Página de Auditoria

No navegador, acesse:
```
http://localhost:5173/audit
```

**Nota:** Esta página só está disponível em modo de desenvolvimento (DEV).

#### 3. Executar Auditoria

1. A página deve mostrar um botão **"🔄 Executar Auditoria"**
2. Clique no botão
3. Aguarde a execução (pode levar alguns segundos)

#### 4. Verificar Resultados

Após a execução, você verá:

**Resumo:**
- ✅ **OK:** Quantidade de funcionalidades funcionando perfeitamente
- ⚠️ **Parcial:** Quantidade de funcionalidades parcialmente implementadas
- ❌ **Quebrado:** Quantidade de funcionalidades quebradas
- ⏸️ **Não Implementado:** Quantidade de funcionalidades não implementadas

**Detalhes por Grupo:**
- Cada funcionalidade mostra:
  - Status (OK/Parcial/Quebrado/Não Implementado)
  - CRUD (Create/Read/Update/Delete)
  - Repository (✓ ou ✗)
  - Sync (✓ ou ✗)
  - Filtros (✓ ou ✗)
  - Paginação (✓ ou ✗)
  - Observações (se houver)

#### 5. Exportar Relatório

1. Clique em **"📥 Exportar TXT"** para salvar relatório em texto
2. Clique em **"📥 Exportar JSON"** para salvar relatório em JSON
3. Os arquivos serão baixados automaticamente

---

## 🧪 RODAR TODOS OS TESTES

### Passo a Passo

#### 1. Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

#### 2. Abrir a Página de Testes

No navegador, acesse:
```
http://localhost:5173/testes
```

**Nota:** Esta página só está disponível em modo de desenvolvimento (DEV).

#### 3. Configurar Opções (Opcional)

Antes de rodar os testes, você pode configurar:

- **Testar Local:** ✅ (padrão) - Testa funcionalidades locais
- **Testar Supabase:** ⬜ (padrão) - Testa sincronização com Supabase (requer configuração)

**Nota:** Se Supabase não estiver configurado, desmarque "Testar Supabase" para evitar erros.

#### 4. Rodar Todos os Testes

1. Clique no botão **"▶️ Rodar Todos os Testes"**
2. Aguarde a execução (pode levar alguns segundos)
3. Os testes são executados sequencialmente

#### 5. Verificar Resultados

Após a execução, você verá:

**Resumo:**
- **Total:** Total de testes executados
- **Passou:** Quantidade de testes que passaram
- **Falhou:** Quantidade de testes que falharam
- **Tempo:** Tempo total de execução

**Detalhes por Teste:**
- ✅ **PASS** - Teste passou
- ❌ **FAIL** - Teste falhou
- Tempo de execução de cada teste
- Detalhes do erro (se falhou)

#### 6. Ver Logs no Console

Abra o console do navegador (F12) para ver:
- Logs detalhados de cada teste
- Erros completos (se houver)
- Stack traces

---

## 📊 INTERPRETAR RESULTADOS

### Auditoria

#### Status: ✅ OK
- Funcionalidade completa e funcionando
- Todos os CRUDs necessários implementados
- Repository configurado
- Sync funcionando (se aplicável)

#### Status: ⚠️ Parcial
- Funcionalidade parcialmente implementada
- Alguns CRUDs faltando
- Ou Repository não configurado
- Ou Sync não funcionando

**Ação:** Verificar o que está faltando e implementar.

#### Status: ❌ Quebrado
- Funcionalidade quebrada
- Função de leitura não encontrada
- Repository não configurado ou inválido

**Ação:** Corrigir urgentemente antes do release.

#### Status: ⏸️ Não Implementado
- Funcionalidade não implementada
- Apenas rota/estrutura básica

**Ação:** Implementar se necessário para o release.

### Testes

#### ✅ PASS
- Teste passou com sucesso
- Funcionalidade está funcionando corretamente

#### ❌ FAIL
- Teste falhou
- Verificar detalhes do erro
- Corrigir o problema

**Exemplos de Erros Comuns:**
- `Produto não encontrado` → Verificar criação
- `Erro ao criar` → Verificar Repository
- `Taxa incorreta` → Verificar cálculo
- `Persistência falhou` → Verificar LocalStorage

---

## 🔧 TROUBLESHOOTING

### Problema: Página de Auditoria não carrega

**Causa:** Pode estar em modo PROD

**Solução:**
- Certifique-se de estar rodando `npm run dev` (não `npm run build`)
- Verifique se `import.meta.env.DEV` é `true`

### Problema: Auditoria não executa

**Causa:** Erro no código de auditoria

**Solução:**
1. Abra o console do navegador (F12)
2. Verifique erros no console
3. Verifique se todas as funções importadas existem

### Problema: Testes falham com erro de Supabase

**Causa:** Supabase não configurado ou offline

**Solução:**
1. Desmarque "Testar Supabase" antes de rodar
2. Ou configure Supabase corretamente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_KEY`

### Problema: Testes criam dados de teste

**Causa:** Normal - testes criam dados temporários

**Solução:**
1. Após os testes, clique em **"🗑️ Limpar Dados de Teste"**
2. Isso remove todos os dados marcados com `[TESTE_E2E]`

### Problema: Testes demoram muito

**Causa:** Normal - testes executam sequencialmente

**Solução:**
- Aguarde a conclusão
- Verifique o console para ver progresso

---

## 📋 Checklist de Validação

### Antes do Release

- [ ] Executar auditoria (`/audit`)
- [ ] Verificar que todas funcionalidades críticas estão ✅ OK
- [ ] Corrigir funcionalidades ⚠️ Parciais ou ❌ Quebradas
- [ ] Rodar todos os testes (`/testes`)
- [ ] Verificar que todos os testes passam (✅ PASS)
- [ ] Corrigir testes que falharam (❌ FAIL)
- [ ] Limpar dados de teste após validação

### Após Correções

- [ ] Re-executar auditoria
- [ ] Re-executar testes
- [ ] Validar que correções funcionaram
- [ ] Documentar mudanças

---

## 📊 Exemplo de Resultados Esperados

### Auditoria - Resultado Ideal

```
RESUMO:
  OK: 15
  Parcial: 2
  Quebrado: 0
  Não Implementado: 1
```

### Testes - Resultado Ideal

```
RESUMO:
  Total: 9
  Passou: 9
  Falhou: 0
  Tempo: 1234.56ms
```

---

## 🎯 Próximos Passos Após Executar

### Se Auditoria Mostrar Problemas:

1. **Funcionalidades Quebradas:**
   - Corrigir urgentemente
   - Verificar logs no console
   - Verificar se Repository está configurado

2. **Funcionalidades Parciais:**
   - Implementar funcionalidades faltantes
   - Verificar CRUDs necessários
   - Verificar Repository e Sync

### Se Testes Falharem:

1. **Ler Detalhes do Erro:**
   - Verificar mensagem de erro
   - Verificar stack trace no console

2. **Corrigir Problema:**
   - Verificar código relacionado
   - Testar manualmente
   - Re-executar teste

3. **Validar Correção:**
   - Re-executar todos os testes
   - Verificar que teste passa

---

## 📁 Arquivos Relacionados

### Auditoria
- `src/lib/audit/system-audit.ts` - Lógica de auditoria
- `src/pages/AuditPage.tsx` - Interface de auditoria
- `MAPA_FUNCIONALIDADES.md` - Mapa completo

### Testes
- `src/lib/testing/testRunner.ts` - Runner de testes
- `src/lib/testing/tests/*.test.ts` - Testes individuais
- `src/pages/SystemTestPage.tsx` - Interface de testes
- `SISTEMA_TESTES.md` - Documentação de testes

---

**Última Atualização:** 2026-01-22
