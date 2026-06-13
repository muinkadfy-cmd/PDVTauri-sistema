# Como Adicionar a Logo

## 📸 Adicionar Imagem de Logo

Para adicionar a logo da Smart Tech, siga estes passos:

### 1. Preparar a Imagem
- Formato recomendado: PNG ou SVG
- Tamanho recomendado: 40x40px (ou maior, será redimensionado)
- Fundo transparente (recomendado)
- Nome do arquivo: `logo.png`

### 2. Colocar a Imagem
Coloque o arquivo `logo.png` na pasta `public/` do projeto:

```
public/
  ├── logo.png          ← Adicione aqui
  ├── icon.svg
  ├── manifest.json
  └── pwa-192x192.png
```

### 3. Verificar
Após adicionar a imagem, a logo aparecerá automaticamente no Topbar.

### 4. Fallback
Se a imagem não for encontrada, o sistema automaticamente mostrará o emoji 🌿 como fallback.

## 🎨 Formatos Suportados
- PNG (recomendado)
- SVG (recomendado para escalabilidade)
- JPG/JPEG
- WebP

## 📝 Notas
- A logo será redimensionada automaticamente para 40x40px
- Em telas menores (mobile), será redimensionada para 32x32px
- O sistema mantém a proporção da imagem (object-fit: contain)
