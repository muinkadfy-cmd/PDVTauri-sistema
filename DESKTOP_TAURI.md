# Smart Tech PDV — Desktop (Tauri)

Este projeto agora tem uma base **Tauri v2** para rodar como **aplicativo Desktop** (Windows).

## 1) Pré-requisitos (Windows)

- Node.js (recomendado LTS)
- Rust + toolchain MSVC (via **rustup**)
- Visual Studio Build Tools (C++ build tools)

## 2) Instalar dependências

```bash
npm install
```

## 3) Rodar em modo Desktop (dev)

```bash
npm run tauri:dev
```

- O frontend será executado em `vite --mode desktop` (localhost) e o Tauri abrirá a janela.

## 4) Build do instalador (Windows)

```bash
npm run tauri:build
```

O resultado ficará em algo como:
- `src-tauri/target/release/bundle/...`

## 5) Web/PWA continua funcionando

Para rodar no browser (como hoje):

```bash
npm run dev
```

Para build web:

```bash
npm run build
```

## Observação importante

- No modo Desktop/Tauri o sistema **não registra Service Worker** (PWA update fica desativado).
- A tela **Atualizações** mostra uma mensagem indicando que no Desktop a atualização é via nova versão do app.

Próximo passo (planejado): migrar armazenamento local de IndexedDB para **SQLite** (via plugin) e implementar **licença por arquivo** no diretório de dados do aplicativo.
