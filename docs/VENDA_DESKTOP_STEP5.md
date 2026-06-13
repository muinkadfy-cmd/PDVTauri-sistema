# Venda (Desktop) — Passo 5 (Empacotamento + Hardening)

Este pacote adiciona:
- Hardening básico no Desktop (bloqueio de refresh/devtools comuns)
- Captura de erros em produção (salva no SQLite global)
- Pacote de suporte (ZIP) na página Ajuda

## Como gerar instalador (Windows)

```bash
npm install
npm run tauri:build
```

O instalador sai em:
`src-tauri/target/release/bundle/msi/`

## Fluxo de suporte

1) Cliente abre **Ajuda** → **Baixar Pacote de Suporte (ZIP)**
2) Cliente te envia o ZIP + o Machine ID
3) Você analisa `meta.json` e `errors.json`

## Observações
- Em produção (tauri build), a licença é obrigatória no Desktop.
- Não envie arquivos `.env.local` para o cliente.
