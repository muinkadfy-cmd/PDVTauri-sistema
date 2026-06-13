CORREÇÃO: build Tauri updater v2

Arquivo alterado:
- src-tauri/src/updater.rs

Causa:
- A API atual do tauri-plugin-updater v2 não possui mais os campos update.notes e update.pub_date.
- Os campos corretos são update.body e update.date.

Troca aplicada:
- body: update.notes -> body: update.body
- date: update.pub_date.map(...) -> date: update.date.map(...)

Como aplicar:
1. Extraia este ZIP por cima da raiz do projeto: C:\PDVTauri-sistema
2. Confirme que substituiu: C:\PDVTauri-sistema\src-tauri\src\updater.rs
3. Rode:
   npm run tauri build

Se quiser testar antes:
   cd C:\PDVTauri-sistema\src-tauri
   cargo check
