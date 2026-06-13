# Smart Tech

Sistema de gestão financeira desenvolvido com React, TypeScript e Vite.

## 🚀 Características

- **Design moderno e responsivo** - Interface limpa e adaptável para desktop e mobile
- **Offline-first** - Funciona sem conexão com internet usando LocalStorage
- **PWA** - Progressive Web App, pode ser instalado no dispositivo
- **TypeScript** - Tipagem estática para maior segurança
- **CSS puro** - Sem dependências de frameworks CSS

## 📋 Stack Tecnológica

- **TypeScript** 5.9.3
- **React** 19.2.0
- **Vite** 7.2.4
- **LocalStorage** (armazenamento offline)
- **Supabase** (sincronização opcional - configurável)

## 🛠️ Instalação

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev

# Build para produção
npm run build:prod

# Preview da build
npm run preview:prod
```

## 🎨 Ícones PWA

### Gerar Ícones Automaticamente

```bash
# Gerar ícones PWA com tamanhos corretos
npm run icons:pwa

# Validar ícones (verificar dimensões)
npm run verify:pwa

# Gerar e validar (tudo de uma vez)
npm run icons:all
```

**Documentação completa:** Ver `GUIA_ICONES_PWA.md`

## 📁 Estrutura do Projeto

```
src/
├── app/
│   └── App.tsx          # Componente raiz
├── components/          # Componentes reutilizáveis
├── pages/              # Páginas do sistema
├── lib/
│   └── data.ts         # Lógica de dados e CRUD
├── types/
│   └── index.ts        # Tipos TypeScript
└── styles/
    └── index.css       # Estilos globais
```

## 🎯 Funcionalidades

- ✅ Dashboard com resumo financeiro
- ✅ Gestão de movimentações (Vendas, Gastos, Serviços)
- ✅ Visualização por categorias
- ✅ Interface responsiva (Web e Mobile)
- ✅ Armazenamento local (LocalStorage)

## 📱 PWA

O sistema é configurado como PWA e pode ser instalado em dispositivos móveis e desktop.

## 📄 Licença

Smart Tech Rolândia
# PDV


## Venda Desktop (Tauri)
Veja: `docs/VENDA_DESKTOP_STEP5.md`
