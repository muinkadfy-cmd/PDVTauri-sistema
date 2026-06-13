# P17 — Política de pacote release limpo

Antes de enviar código, ZIP ou projeto para cliente/terceiro:

1. Rode `npm run security:quarantine`.
2. Rode `npm run check:release-secrets`.
3. Rode `npm run release:clean-package`.
4. Envie somente `release/SmartTechPDV-clean-source.zip` ou o MSI final.

Nunca enviar:

- `.env.local`, `.env.production`, `.env`
- `*.pem`, `*.key`, `*.p12`, `*.pfx`
- `playwright-report/`, `test-results/`, `qa-artifacts/`, `tmp/`
- `.wrangler/`
- chaves privadas Tauri, QZ, Cloudflare, Supabase service role

Se o sistema precisar de certificado público, distribua separado e nunca junto com chave privada.
