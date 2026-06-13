# Patch: remover OpenSSL/SQLCipher do build (Windows) + reduzir tamanho

O erro `openssl-src` / `nmake` vem do default feature do `tauri-plugin-rusqlite2`:
`bundled-sqlcipher-vendored-openssl` (SQLCipher + OpenSSL).

Este patch muda o plugin para **SQLite puro** (`bundled`), eliminando OpenSSL e
reduzindo bastante o `src-tauri/target`.

## Como aplicar
1) Extraia este ZIP por cima do seu projeto (substituir arquivos).
2) Limpe builds antigos:
   - apague `src-tauri\target\` (ou rode `cargo clean` dentro de src-tauri)
3) Reinstale deps Node (se necessário):
   - `npm install`
4) Build:
   - `npx tauri build`

## Observações
- Por padrão, o DB será aberto como `sqlite::smarttech-<store>.db` (sem criptografia).
- Para reativar SQLCipher no futuro:
  - em `src-tauri/Cargo.toml`, troque features para `bundled-sqlcipher-vendored-openssl`
  - defina `VITE_SQLCIPHER=1` no ambiente / .env e rebuild.

Se você já tinha bancos gerados com SQLCipher, eles NÃO vão abrir com SQLite puro.
