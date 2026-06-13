# 🧪 Sistema de Testes - Smart Tech

## 📋 Observações Importantes

### ⚠️ Segurança e Ambiente

1. **Modo Desenvolvimento Apenas**
   - A página de testes (`/testes`) está disponível **APENAS** em modo desenvolvimento
   - Em produção (`npm run build`), a rota e o menu não aparecem
   - Verificação: `import.meta.env.DEV` e `import.meta.env.PROD`

2. **Dados de Teste**
   - Todos os dados criados pelos testes são marcados com `[TESTE_E2E]`
   - Fácil identificação e limpeza seletiva
   - **NUNCA** afeta dados reais do usuário

3. **Limpeza Automática**
   - Use o botão "Limpar Dados de Teste" após os testes
   - Remove dados do LocalStorage e Supabase (se habilitado)
   - Confirmação necessária antes de limpar

### 🔧 Configuração

1. **Supabase (Opcional)**
   - Testes funcionam **sem** Supabase configurado
   - Se Supabase estiver configurado, testes de sincronização são executados
   - Verificação automática: `isSupabaseConfigured()`

2. **Variáveis de Ambiente**
   - `VITE_SUPABASE_URL` - URL do projeto Supabase
   - `VITE_SUPABASE_ANON_KEY` - Chave pública anônima
   - Sem essas variáveis, testes de sync são pulados

### 📊 Estrutura dos Testes

#### Suites de Teste Implementadas

1. **Clientes** (`clientes.test.ts`)
   - ✅ Criar cliente
   - ✅ Listar e validar criação
   - ✅ Editar cliente
   - ✅ Excluir cliente

2. **Produtos** (`produtos.test.ts`)
   - ✅ Criar produto com custo/preço/estoque
   - ✅ Listar e validar
   - ✅ Editar estoque e preço
   - ✅ Excluir produto

3. **Ordens de Serviço** (`ordens.test.ts`)
   - ✅ Criar OS vinculada a cliente
   - ✅ Mudar status (aberta → em_andamento → concluida)
   - ✅ Validar total bruto (valorServico + valorPecas)
   - ✅ Validar total líquido com desconto
   - ✅ Excluir OS

4. **Vendas** (`vendas.test.ts`)
   - ✅ Criar venda com múltiplos itens
   - ✅ Validar subtotal/total
   - ✅ Validar atualização de estoque
   - ✅ Testar pagamento dinheiro/PIX (sem taxa)
   - ✅ Testar pagamento cartão (com taxa)
   - ✅ Validar lançamentos financeiros (entrada + saída taxa)
   - ✅ Excluir venda

5. **Financeiro** (`financeiro.test.ts`)
   - ✅ Criar lançamento manual (entrada)
   - ✅ Criar lançamento manual (saída)
   - ✅ Validar totais e saldo
   - ✅ Filtro por data
   - ✅ Atualizar movimentação
   - ✅ Excluir movimentações

6. **Relatórios e Cálculos** (`relatorios.test.ts`)
   - ✅ `calcTotalBrutoVenda()` - Soma de subtotais
   - ✅ `calcTaxaCartao()` - Cálculo de taxa percentual
   - ✅ `calcTotalLiquido()` - Total após descontos e taxas
   - ✅ `calcCustoVenda()` - CMV (Custo Mercadoria Vendida)
   - ✅ `calcLucro()` - Lucro (receita - custo)
   - ✅ `calcMargem()` - Margem percentual
   - ✅ `calcTotalBrutoOS()` - Total de OS
   - ✅ `calcCustoOS()` - Custo de OS
   - ✅ `normalizarVenda()` - Normalização de dados
   - ✅ `normalizarOS()` - Normalização de dados
   - ✅ Validação com dados vazios (proteção contra erros)

7. **Offline-First** (`offline.test.ts`)
   - ✅ Criar dados offline (sem sync)
   - ✅ Validar salvamento local
   - ✅ Validar outbox (se Supabase habilitado)
   - ✅ Testar sincronização online (se Supabase habilitado)

### 🚀 Como Usar

#### 1. Executar Testes

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Acessar página de testes
# Menu lateral → "Testes" (grupo Utilitários)
# Ou diretamente: http://localhost:5173/testes
```

#### 2. Opções de Teste

- **Rodar testes Local (offline-first)**: Testa funcionalidades básicas sem Supabase
- **Rodar testes com Supabase (online)**: Testa sincronização (requer Supabase configurado)

#### 3. Botões Disponíveis

- **▶️ Rodar Todos os Testes**: Executa todas as suites de teste
- **➕ Criar Dados de Exemplo**: Cria cliente e 2 produtos de teste
- **🗑️ Limpar Dados de Teste**: Remove todos os dados marcados com `[TESTE_E2E]`

### 📝 Resultados

#### Interface Visual

- ✅ **PASS**: Teste passou
- ❌ **FAIL**: Teste falhou
- ⏱️ **Tempo**: Duração de cada teste
- 📊 **Resumo**: Estatísticas gerais (total, passou, falhou, tempo total)

#### Console do Navegador

- Logs detalhados de cada teste
- Erros com stack trace completo
- Resumo final formatado

### 🔍 Troubleshooting

#### Testes Falhando

1. **Verificar Console**
   - Abra DevTools (F12)
   - Veja erros detalhados no console
   - Stack trace mostra exatamente onde falhou

2. **Verificar Dados**
   - Use "Limpar Dados de Teste" antes de rodar novamente
   - Dados de teste anteriores podem interferir

3. **Verificar Supabase**
   - Se testes de sync falharem, verifique:
     - Variáveis de ambiente configuradas
     - Conexão com internet
     - Tabelas criadas no Supabase

#### Testes Não Aparecem

1. **Verificar Ambiente**
   - Certifique-se de estar em modo dev (`npm run dev`)
   - Em produção, testes não aparecem (por design)

2. **Verificar Menu**
   - Menu "Testes" só aparece em dev
   - Está no grupo "Utilitários"

### 📁 Estrutura de Arquivos

```
src/
├── lib/
│   └── testing/
│       ├── testData.ts          # Utilitários de dados de teste
│       ├── testRunner.ts         # Runner de testes
│       └── tests/
│           ├── index.ts          # Exporta todas as suites
│           ├── clientes.test.ts
│           ├── produtos.test.ts
│           ├── ordens.test.ts
│           ├── vendas.test.ts
│           ├── financeiro.test.ts
│           ├── relatorios.test.ts
│           └── offline.test.ts
└── pages/
    ├── SystemTestPage.tsx        # Interface de testes
    └── SystemTestPage.css        # Estilos
```

### ⚙️ Personalização

#### Adicionar Novo Teste

1. Criar arquivo em `src/lib/testing/tests/`
2. Exportar função de teste:
   ```typescript
   export async function testNovoModulo(): Promise<void> {
     // Seu teste aqui
     if (condicao) {
       throw new Error('Mensagem de erro');
     }
   }
   ```
3. Adicionar em `src/lib/testing/tests/index.ts`:
   ```typescript
   {
     name: 'Novo Módulo',
     tests: [testNovoModulo]
   }
   ```

#### Modificar Dados de Teste

- Editar `src/lib/testing/testData.ts`
- Função `createTestData()` cria dados padrão
- Função `cleanupTestData()` remove todos os dados de teste

### 🎯 Boas Práticas

1. **Sempre Limpar Após Testes**
   - Use "Limpar Dados de Teste" após executar testes
   - Evita interferência entre execuções

2. **Verificar Resultados**
   - Sempre verifique o resumo final
   - Testes que falharam precisam ser investigados

3. **Testar Localmente Primeiro**
   - Execute testes locais antes de testar com Supabase
   - Isola problemas de sincronização

4. **Usar Console para Debug**
   - Console mostra detalhes completos
   - Stack traces ajudam a identificar problemas

### 🔐 Segurança

- ✅ Página não aparece em produção
- ✅ Rota não existe em produção
- ✅ Menu não aparece em produção
- ✅ Dados marcados com `[TESTE_E2E]` para fácil identificação
- ✅ Limpeza confirma antes de executar

### 📚 Referências

- **Repositórios**: `src/lib/repositories.ts`
- **Funções de Cálculo**: `src/lib/finance/calc.ts`
- **Sync Engine**: `src/lib/repository/sync-engine.ts`
- **Supabase**: `src/lib/supabase.ts`

---

**Última atualização**: Sistema completo de testes implementado e funcional.
