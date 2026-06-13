# Checklist final de release — cliente final desktop

## 1. Pré-build
- [ ] `npm run release:check`
- [ ] `npm run type-check`
- [ ] versão do `package.json` igual ao `src-tauri/tauri.conf.json`
- [ ] ACL com `core:window:allow-close`
- [ ] ACL com `core:window:allow-destroy`
- [ ] `registerDesktopPersistenceCloseGuard()` registrado no `src/main.tsx`
- [ ] auto-backup sem `onCloseRequested` próprio

## 2. Build
- [ ] `npm run build:desktop`
- [ ] `npm run tauri:build`
- [ ] MSI gerado sem erro
- [ ] sem erro TS/TSX/Rust bloqueando release

## 3. Smoke DEV
- [ ] `npm run qa:e2e:release`
- [ ] Painel abre
- [ ] Configurações abre
- [ ] Cobranças abre
- [ ] Estoque abre
- [ ] Encomendas abre
- [ ] Compra/Venda de usados abrem

## 4. Homologação manual DEV
- [ ] criar cliente
- [ ] criar produto
- [ ] fazer venda
- [ ] criar OS
- [ ] criar cobrança e marcar como paga
- [ ] cadastrar fornecedor
- [ ] alterar taxas
- [ ] salvar dados da empresa
- [ ] comprar usado
- [ ] vender usado
- [ ] abrir Painel e conferir entradas por setor
- [ ] imprimir 58mm
- [ ] imprimir 80mm
- [ ] imprimir A4

## 5. Fechamento / reopen
- [ ] clicar no X
- [ ] confirmar fechamento seguro
- [ ] app fecha de verdade
- [ ] app não fica preso no Gerenciador de Tarefas
- [ ] reabrir e conferir dados iguais
- [ ] sem falso erro de banco corrompido

## 6. MSI por cima
- [ ] instalar MSI
- [ ] criar/alterar dados reais
- [ ] fechar o app
- [ ] instalar MSI por cima
- [ ] abrir novamente
- [ ] conferir persistência igual

## 7. Backup / restore
- [ ] gerar backup
- [ ] restaurar backup
- [ ] fechar o app
- [ ] abrir novamente
- [ ] mesma loja da instalação
- [ ] mesmos dados
- [ ] mesma empresa

## 8. Aprovação final
- [ ] release aprovada para cliente final
- [ ] versão anotada
- [ ] caminho do MSI anotado
- [ ] data da homologação anotada
- [ ] responsável pela aprovação anotado
