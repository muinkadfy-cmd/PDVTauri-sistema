# Gerar Ícones PWA

Os ícones PWA são necessários para a instalação do app. Atualmente estamos usando SVG, mas para melhor compatibilidade, é recomendado ter PNGs.

## Opção 1: Usar conversor online (mais rápido)

1. Acesse: https://convertio.co/svg-png/ ou https://cloudconvert.com/svg-to-png
2. Faça upload do arquivo `public/icon.svg`
3. Configure:
   - **192x192.png**: Tamanho 192x192px
   - **512x512.png**: Tamanho 512x512px
4. Baixe e salve em `public/`:
   - `public/pwa-192x192.png`
   - `public/pwa-512x512.png`

## Opção 2: Usar Node.js com sharp

```bash
npm install --save-dev sharp
node scripts/generate-pwa-icons.js
```

## Opção 3: Usar ImageMagick (se instalado)

```bash
convert public/icon.svg -resize 192x192 public/pwa-192x192.png
convert public/icon.svg -resize 512x512 public/pwa-512x512.png
```

## Depois de gerar os PNGs

Atualize o `public/manifest.json` para usar os PNGs:

```json
{
  "icons": [
    {
      "src": "/pwa-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/pwa-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```
