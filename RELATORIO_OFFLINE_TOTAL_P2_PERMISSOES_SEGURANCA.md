# RELATÓRIO — Lote P2 Desktop Offline Total

## Tema
Permissões locais, segurança de usuários, proteção de áreas sensíveis e hash de senha local.

## Objetivo
Deixar o PDV Desktop offline mais seguro para cliente final, evitando que operador comum acesse ou altere áreas críticas como financeiro, backup, licença, configurações e usuários.

---

## Arquivos alterados

- `src/types/index.ts`
- `src/lib/permissions.ts`
- `src/lib/auth-supabase.ts`
- `src/components/AuthGuard.tsx`
- `src/pages/FluxoCaixaPage.tsx`

---

## Correções aplicadas

### P0/P1 — Permissões por perfil mais seguras

Antes, `atendente` e `tecnico` tinham permissões operacionais amplas demais, incluindo exclusão.

Agora:

- `admin`: criar, editar, excluir, visualizar, gerenciar usuários e licença.
- `atendente`: criar, editar e visualizar; não exclui e não administra áreas sensíveis.
- `tecnico`: criar, editar e visualizar apenas dentro de rotas técnicas/operacionais; não exclui e não acessa financeiro/backup/licença.

### P1 — Áreas sensíveis protegidas

Áreas protegidas agora ficam somente para `admin` ou `superadmin`:

- Financeiro
- Fluxo de caixa
- Relatórios
- Backup
- Configurações
- Usuários
- Licença
- Atualizações
- Rotas antigas online/Supabase/multi-loja

### P1 — Removida liberação geral de Atualizações

Antes, qualquer usuário logado podia abrir `/atualizacoes`.

Agora `/atualizacoes` segue a matriz de permissões: apenas admin/superadmin.

### P1 — Exclusão manual no Fluxo de Caixa protegida

Antes, movimentação manual podia mostrar exclusão sem checar `canDelete()`.

Agora só aparece se:

- usuário puder excluir;
- não estiver em modo somente leitura;
- movimentação for manual.

### P1 — Hash de senha local melhorado

Antes, a senha local usava SHA-256 simples ou fallback `plain:*`.

Agora novos hashes usam:

- PBKDF2
- SHA-256
- salt aleatório
- 150.000 iterações
- formato versionado

Formato novo:

```txt
pbkdf2:sha256:150000:<saltHex>:<hashHex>
```

### Compatibilidade preservada

Hashes antigos continuam funcionando:

- SHA-256 puro antigo
- `plain:*` legado antigo

Ao logar com senha antiga válida, o sistema migra automaticamente para PBKDF2.

---

## O que foi testado

- `npm run type-check` — OK
- `npm run build:desktop` — OK

## O que não foi testado aqui

- `cargo check` — ambiente sem Rust/Cargo
- `npm run tauri:dev` — precisa rodar no Windows
- `npm run tauri:build` — precisa rodar no Windows
- Teste manual de login real com usuários antigos — precisa rodar no app local

---

## Riscos restantes

### Risco 1 — Permissões ainda são UI/client-side

No Desktop offline isso é aceitável para operação comum, mas não é cofre absoluto contra usuário técnico mexendo diretamente em arquivos locais.

### Risco 2 — Algumas páginas ainda usam permissões genéricas

Algumas telas usam `canEdit()` geral. Para uma camada 10/10 futura, o ideal é criar permissões por módulo:

- `canEditOrdens()`
- `canEditProdutos()`
- `canEditFinanceiro()`
- `canDeleteVenda()`
- `canManageBackup()`

### Risco 3 — SuperAdmin/env

A conta SuperAdmin ainda depende de variáveis/configuração do projeto. Para produção final, o ideal é ter rotina de ativação/suporte bem documentada.

---

## Classificação do lote

| Setor | Nota | Estrelas | Status |
|---|---:|---|---|
| Permissões locais | 8.7/10 | ⭐⭐⭐⭐☆ | BOM |
| Proteção de áreas sensíveis | 9/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Bloqueio de exclusão para operador | 9/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Hash de senha local | 8.8/10 | ⭐⭐⭐⭐☆ | BOM |
| Compatibilidade com usuários antigos | 9/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Segurança total contra adulteração local | 6.5/10 | ⭐⭐⭐☆☆ | PARCIAL |

## Veredito

Este lote melhora bastante a segurança do Desktop offline sem quebrar a base local. O sistema fica mais adequado para uso em loja, onde atendente e técnico não devem mexer em financeiro, backup, licença, usuários ou atualizações.

Próximo lote recomendado: **P3 — limpeza de heranças físicas do projeto**, removendo/arquivando service worker/PWA do build desktop, QZ Tray antigo, arquivos lixo de versão, relatórios de teste e SQLs antigos perigosos.
