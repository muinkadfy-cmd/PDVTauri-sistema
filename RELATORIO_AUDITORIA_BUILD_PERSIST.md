# Auditoria – Build / Persistência / Abas sumindo (Tauri)

## Principais causas encontradas (100% no código)

### 1) “Abas sumiram no PC do cliente” (na prática: Sidebar não aparece)
**Causa:** no `Layout.tsx` o breakpoint tratava **largura < 1100px** como “tablet”.
- No Tauri, a janela costuma iniciar em **1024px** (e o `minWidth` do app está 1024), então o app entrava em modo “tablet”: **sem Sidebar**.
- Resultado: o usuário só vê as páginas pelo **menu do topo (drawer)** e acha que “as abas sumiram”.

✅ **Correção aplicada**: unificação de breakpoint com o `Sidebar` (>= **901px** é desktop). Agora em 1024px o cliente vê Sidebar normal.

Arquivos alterados:
- `src/app/Layout.tsx`

---

### 2) Persistência frágil (StoreId / perfil de impressão) quando o WebView limpa storage
O projeto já usa KV (SQLite) via `kv_get/kv_set` para guardar dados críticos (device_id, license_token).

**Problema:** o `store_id` e o perfil de impressão eram salvos apenas no `localStorage`. Se o WebView for resetado/limpo no PC do cliente, pode:
- gerar novo `store_id` e parecer “um novo sistema”,
- perder calibragem da impressora (offset/scale),
- afetar preferências (papel / impressão) e causar diferenças entre máquinas.

✅ **Melhoria aplicada**: hidratação desses itens também no KV (SQLite), com estratégia:
- se existe no local mas não no KV → grava no KV
- se existe no KV mas não no local → restaura no local
- se ambos faltam → gera novo id e salva nos dois
- se divergem → KV prevalece (mais estável)

Arquivos alterados:
- `src/lib/desktop-globals.ts`

---

### 3) OS: “Fixar técnico” (técnico padrão)
Você pediu para ter opção de **fixar/desfixar o técnico** na Ordem de Serviço.

✅ **Implementação aplicada**:
- Novo campo em configurações (por loja) usando `WarrantySettings`:
  - `default_tecnico` (string)
  - `tecnico_pinned` (boolean)
- Na **Nova OS**, se `tecnico_pinned=true`, o formulário abre com `default_tecnico`.
- Botão **📍 Fixar / 📌 Desfixar** ao lado do label “Responsável/Técnico” (apenas admin).

Arquivos alterados:
- `src/types/index.ts`
- `src/lib/settings.ts`
- `src/pages/OrdensPage.tsx`
- `src/components/ui/FormField.tsx` (label agora aceita JSX, compatível com label string)

---

### 4) Impressão: compatibilidade + “Tauri reconhece impressora?”
O backend Tauri já possui comandos para:
- listar impressoras (`list_printers`)
- setar padrão (`set_default_printer`)
- retornar padrão (`get_default_printer`)

**Problema prático:** a tela de configurações não expunha isso, então parecia “não reconhece” no cliente.

✅ **Melhoria aplicada**:
- Inserido `PrinterSettings` dentro de `ConfiguracoesPage` (somente Desktop/Tauri).
- E o **perfil de impressão** (offset/scale) agora é aplicado no HTML de impressão (térmica 58/80) via injeção de wrapper.

Arquivos alterados:
- `src/pages/ConfiguracoesPage.tsx`
- `src/lib/print-template.ts`

---

## Recomendação técnica (para eliminar 100% do “dev x prod” em impressão)
1) **Padronizar** um único motor de impressão no Desktop:
   - HTML → WebView2 → print, com offsets/scale aplicados (feito)
2) **Adicionar preflight** (diagnóstico) na tela de impressão:
   - listar impressoras
   - exibir impressora padrão detectada
   - botão “Imprimir teste” (ticket 80mm com borda)
3) Se quiser “silent print” de verdade:
   - bundle do `SumatraPDF.exe` (o Rust já tenta usar)
   - e adicionar `resources` no `tauri.conf.json`.

---

## Como reproduzir / validar no PC do cliente (checklist)
- Abrir o app e confirmar que a Sidebar aparece em 1024px.
- Ir em **Configurações > Impressão (Tauri)** e verificar lista de impressoras.
- Selecionar impressora e ajustar offset (ex: Top 1.0mm) se cortar.
- Abrir **Ordens de Serviço** e usar **📍 Fixar** no técnico.
- Criar “Nova OS” e confirmar que técnico veio preenchido.

