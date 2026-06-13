# Lote P6 — Login simplificado Desktop offline (admin / 1234)

## Objetivo
Remover o campo visível de Store ID da tela de login Desktop e deixar o acesso inicial simples:

- Usuário: `admin`
- Senha: `1234`

O Store ID continua existindo internamente para isolar o banco SQLite da instalação, mas não aparece mais para o cliente comum na tela de login.

## Arquivos alterados

- `src/pages/LoginPage.tsx`
- `src/pages/LoginPage.css`
- `src/lib/env.ts`

## Correções aplicadas

1. Campo `Store ID fixo deste PC` removido da interface Desktop.
2. Store ID continua sendo usado internamente pelo app, vindo de `getStoreId()`.
3. Login Desktop passa a mostrar acesso inicial `admin / 1234`.
4. Campo usuário Desktop inicia com `admin` quando não houver usuário lembrado.
5. Placeholder da senha Desktop mostra `1234`.
6. Administrador local inicial é criado/atualizado automaticamente no Desktop offline.
7. Desktop offline agora usa por padrão:
   - `superAdminEnabled = true`
   - `superAdminEmail = admin`
   - `superAdminPassword = 1234`
8. Lembrar acesso continua salvando somente usuário, nunca senha.

## Observação técnica
O Store ID NÃO foi removido da arquitetura. Ele só foi escondido da tela de login.

Motivo: o sistema ainda precisa de Store ID interno para manter o banco SQLite separado e estável, evitando conflito com backups, diagnósticos e dados da loja.

## Testes executados

- `npm run type-check` — OK
- `npm run build:desktop` — OK
- `npm run check:desktop-offline-clean` — OK
- `npm run qa:unit:finance` — OK, 7 testes passaram
- `cargo check` — não executado neste ambiente, pois Cargo/Rust não está instalado
- `npm run tauri:build` — precisa testar no Windows

## Nota do lote

| Setor | Nota | Estrelas | Status |
|---|---:|---|---|
| Remoção visual do Store ID | 10/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Login admin/1234 | 9/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Segurança de senha lembrada | 9/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Risco de trocar banco por Store ID | 9.5/10 | ⭐⭐⭐⭐⭐ | REDUZIDO |
| Build Desktop | 9/10 | ⭐⭐⭐⭐⭐ | PASSOU |

## Próximo passo recomendado
Depois de aplicar, entrar no app com:

- Usuário: `admin`
- Senha: `1234`

Depois, para produção, trocar a senha do admin em `Configurações > Usuários`.
