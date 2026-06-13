# SQLCipher (SQLite criptografado no Desktop)

No Desktop (Tauri), o banco **SQLite** usa o plugin `@razein97/tauri-plugin-rusqlite2`, que suporta **SQLCipher** e permite definir senha no connection string no formato:

- `sqlite:<senha>:<arquivo.db>`
- Para desabilitar criptografia: `sqlite::<arquivo.db>`

Neste projeto:
- A senha é derivada do arquivo `crypto.key` (segredo local persistente).
- Em DEV, a senha é vazia e o DB fica sem criptografia (para facilitar debug).

## Migração (se você já tem um DB antigo sem senha)
O SQLCipher não abre um `.db` antigo sem criptografia como criptografado automaticamente.

Caminho recomendado:
1) Faça backup (menu Backup ZIP)
2) Apague o arquivo `.db` (AppConfig)
3) Restaure o backup — o DB novo será criado já criptografado.

> Se você precisa migrar mantendo o DB existente, me avise que eu monto um comando de migração (ATTACH + sqlcipher_export).
