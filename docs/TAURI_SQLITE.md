# Desktop (Tauri) + SQLite — Patch 1

Este patch muda a persistência **no Desktop** para **SQLite**, sem alterar o código das telas.

## O que mudou

- Web/PWA continua: **IndexedDB (Dexie)**
- Desktop (Tauri) passa a usar: **SQLite** via plugin `@razein97/tauri-plugin-rusqlite2` (com suporte a **SQLCipher**)

A escolha é automática:
- `vite --mode desktop` **ou** rodando dentro do Tauri → SQLite
- demais modos → IndexedDB

## Arquivos principais

- `src/lib/repository/sqlite-db.ts` (abre o DB e garante schema)
- `src/lib/repository/sqlite-local-store.ts` (LocalStore compatível com SQLite)
- `src/lib/repository/local-store-factory.ts` (decide Dexie vs SQLite)
- `src-tauri/src/lib.rs` + `src-tauri/Cargo.toml` + `src-tauri/capabilities/default.json`

## Como rodar no Desktop

1) Instalar deps (na raiz do projeto):

```bash
npm install
```

2) Rodar em modo desktop:

```bash
npm run tauri:dev
```

## Onde o SQLite fica salvo

O plugin usa caminhos relativos ao `BaseDirectory::App` do Tauri.

- Arquivo por loja: `smarttech-<storeId>.db`
- Ex.: `smarttech-default.db`

## Permissões (Tauri v2)

O SQL plugin é bloqueado por padrão. Já habilitamos:

- `sql:default` (load/select/close)
- `sql:allow-execute` (INSERT/UPDATE/DELETE)

Em `src-tauri/capabilities/default.json`.
