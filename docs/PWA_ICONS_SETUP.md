# 🎨 Configuração de Ícones PWA - Smart Tech

**Data:** 2026-01-24  
**Status:** ✅ Configurado e Testado

---

## 📋 Ícones Gerados

Todos os ícones foram gerados automaticamente a partir de `public/pwa.png`:

### Ícones PWA
- ✅ `pwa-192x192.png` - Ícone padrão 192x192
- ✅ `pwa-512x512.png` - Ícone padrão 512x512
- ✅ `pwa-maskable-192x192.png` - Ícone maskable 192x192 (com padding 80%)
- ✅ `pwa-maskable-512x512.png` - Ícone maskable 512x512 (com padding 80%)

### Favicons
- ✅ `favicon-16x16.png` - Favicon 16x16
- ✅ `favicon-32x32.png` - Favicon 32x32
- ✅ `apple-touch-icon.png` - Apple Touch Icon 180x180

---

## 🔧 Como Gerar os Ícones

Execute o comando:

```bash
npm run icons:pwa
```

Este comando:
1. Lê `public/pwa.png` como imagem fonte
2. Gera todos os ícones necessários
3. Cria ícones maskable com padding de 80% (10% de margem em cada lado)

---

## 📝 Configuração do Manifest

### `public/manifest.json` e `public/manifest.webmanifest`

Ambos os arquivos contêm a mesma configuração de ícones:

```json
{
  "icons": [
    {
      "src": "/pwa-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/pwa-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/pwa-maskable-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/pwa-maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### `vite.config.ts`

O VitePWA plugin também está configurado com os mesmos ícones.

---

## 🌐 Configuração do HTML

### `index.html`

O arquivo `index.html` está configurado com:

```html
<!-- Favicons -->
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

<!-- Manifest -->
<link rel="manifest" href="/manifest.webmanifest" />
```

---

## ✅ Validação

### 1. Build

```bash
npm run build
```

**Verificar:**
- ✅ Build completa sem erros
- ✅ Ícones aparecem em `dist/`
- ✅ Manifest gerado corretamente

### 2. Preview

```bash
npm run preview
```

**Verificar no DevTools:**
1. Abrir `http://localhost:4173`
2. Abrir DevTools (F12)
3. Ir em **Application** → **Manifest**
4. Verificar:
   - ✅ Nome do app: "Smart Tech - Sistema de Gestão"
   - ✅ Ícones listados: 4 ícones (2 any + 2 maskable)
   - ✅ Tamanhos corretos: 192x192, 512x512
   - ✅ Purpose correto: "any" e "maskable"
   - ✅ **Sem warnings** de "Actual size (1x1)"
   - ✅ **Sem warnings** de "Installability"

### 3. Teste de Instalação

**Desktop (Chrome/Edge):**
- ✅ Ícone aparece na barra de endereços
- ✅ Pode instalar como PWA
- ✅ Ícone aparece na área de trabalho

**Android:**
- ✅ Banner de instalação aparece
- ✅ Ícone aparece na tela inicial
- ✅ Ícone maskable se adapta ao formato do sistema

---

## 🐛 Problemas Comuns

### Warning: "Actual size (1x1)"

**Causa:** Ícone não encontrado ou caminho incorreto.

**Solução:**
1. Verificar se os arquivos existem em `public/`
2. Verificar se o build copiou para `dist/`
3. Verificar caminhos no manifest (devem começar com `/`)

### Warning: "Installability"

**Causa:** Manifest inválido ou ícones faltando.

**Solução:**
1. Verificar se todos os 4 ícones estão no manifest
2. Verificar se `purpose` está correto ("any" e "maskable")
3. Verificar se os tamanhos estão corretos (192x192 e 512x512)

### Ícones não aparecem

**Causa:** Cache do navegador ou build antigo.

**Solução:**
1. Limpar cache do navegador (Ctrl+Shift+Delete)
2. Fazer hard refresh (Ctrl+F5)
3. Rebuild: `npm run build`

---

## 📱 Ícones Maskable

Ícones maskable são usados em sistemas Android que aplicam máscaras aos ícones. Para funcionar corretamente:

- **Área útil:** 80% do tamanho total
- **Padding:** 10% em cada lado
- **Exemplo:** Em um ícone 192x192, a área útil é 154x154 (192 * 0.8)

O script `generate-pwa-icons.mjs` já cria os ícones maskable com o padding correto automaticamente.

---

## 🔄 Atualizar Ícones

Se você atualizar `public/pwa.png`:

1. Execute: `npm run icons:pwa`
2. Execute: `npm run build`
3. Teste: `npm run preview`

---

## 📚 Referências

- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Maskable Icons](https://web.dev/maskable-icon/)
- [PWA Best Practices](https://web.dev/pwa-checklist/)
