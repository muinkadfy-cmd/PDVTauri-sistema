# Patch: rusqlite load_extension (corrige erro E0599)

## O que corrige
- Corrige os erros do Rust no `tauri-plugin-rusqlite2`:
  `load_extension_enable`, `load_extension`, `load_extension_disable` 'method not found'.

## Por quê acontecia
- Esses métodos só existem no `rusqlite` quando o feature `load_extension` está habilitado.

## O que foi alterado
- `src-tauri/Cargo.toml`: ajustado `tauri-plugin-rusqlite2` para:
  - `default-features = false` (evita SQLCipher + OpenSSL vendored)
  - `features = ["bundled", "load_extension"]`.

## Como aplicar
1. Extraia este ZIP por cima do projeto (substituir arquivo).
2. No diretório do projeto:
   - `cargo clean` (recomendado)
   - `npm install`
   - `npx tauri build`
