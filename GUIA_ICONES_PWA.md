# 🎨 Guia: Geração Automática de Ícones PWA

## 🚀 Solução Automatizada

### Comandos Disponíveis

```bash
# Gerar ícones PWA (tamanhos corretos)
npm run icons:pwa

# Validar ícones (verificar dimensões)
npm run verify:pwa

# Gerar e validar (tudo de uma vez)
npm run icons:all
```

---

## 📋 Como Funciona

### 1. Gerar Ícones (`npm run icons:pwa`)

**O que faz:**
- Lê uma imagem fonte (usa `pwa-512x512.png` existente ou outra disponível)
- Gera 4 ícones com tamanhos exatos:
  - `pwa-192x192.png` → 192x192 pixels
  - `pwa-512x512.png` → 512x512 pixels
  - `pwa-maskable-192x192.png` → 192x192 pixels (com safe zone)
  - `pwa-maskable-512x512.png` → 512x512 pixels (com safe zone)

**Safe Zone (Maskable):**
- Padding: 20% em todas as bordas
- Logo ocupa: 60% central
- Garante que logo não será cortado em diferentes formas

**Saída:**
```
🚀 Gerando ícones PWA...
📸 Imagem fonte: public/pwa-512x512.png

📦 Gerando ícones padrão (purpose: "any"):
📦 Gerando pwa-192x192.png (192x192)...
✅ pwa-192x192.png: 192x192 (45.23 KB)
📦 Gerando pwa-512x512.png (512x512)...
✅ pwa-512x512.png: 512x512 (123.45 KB)

🎭 Gerando ícones maskable (purpose: "maskable"):
🎭 Gerando pwa-maskable-192x192.png (192x192 com safe zone)...
✅ pwa-maskable-192x192.png: 192x192 (48.12 KB)
   Safe zone: 38px padding (logo: 116x116px centralizado)
🎭 Gerando pwa-maskable-512x512.png (512x512 com safe zone)...
✅ pwa-maskable-512x512.png: 512x512 (134.56 KB)
   Safe zone: 102px padding (logo: 308x308px centralizado)

✅ Todos os ícones foram gerados com sucesso!
```

---

### 2. Validar Ícones (`npm run verify:pwa`)

**O que faz:**
- Verifica se arquivos existem
- Valida dimensões (deve ser exatamente 192x192 ou 512x512)
- Verifica tamanhos de arquivo (avisa se > 500 KB)

**Saída:**
```
🔍 Validando ícones PWA...

✅ pwa-192x192.png: 192x192px (45.23 KB)
✅ pwa-512x512.png: 512x512px (123.45 KB)
✅ pwa-maskable-192x192.png: 192x192px (48.12 KB)
✅ pwa-maskable-512x512.png: 512x512px (134.56 KB)

📊 Resumo:
✅ Todos os ícones estão corretos!
```

**Se houver erros:**
```
❌ pwa-192x192.png: Dimensão incorreta!
   Esperado: 192x192px
   Obtido: 2048x2048px

📊 Resumo:
❌ 1 erro(s) encontrado(s)

💡 Para corrigir, execute: npm run icons:pwa
```

---

## 🔧 Requisitos

### Dependência

O script usa `sharp` para processamento de imagens:
```bash
npm install
```

`sharp` já está adicionado como `devDependency` no `package.json`.

### Imagem Fonte

O script procura por uma imagem fonte nesta ordem:
1. `public/pwa-512x512.png` (usa o maior existente)
2. `public/pwa-192x192.png`
3. `public/logo.png`
4. `public/icon.png`
5. `public/icon.svg`

**Se não encontrar:** O script mostrará um erro com instruções.

---

## 📋 Fluxo de Trabalho

### Primeira Vez (Setup)

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Gerar ícones:**
   ```bash
   npm run icons:pwa
   ```

3. **Validar:**
   ```bash
   npm run verify:pwa
   ```

4. **Build e testar:**
   ```bash
   npm run build:prod
   npm run preview:prod
   ```

5. **Verificar no DevTools:**
   - F12 → Application → Manifest
   - Verificar: Sem warnings de "Actual size"
   - Verificar: "Installability" mostra "Installable"

### Após Mudanças no Logo

1. **Substituir imagem fonte** em `public/` (ex: `logo.png`)
2. **Regenerar ícones:**
   ```bash
   npm run icons:all
   ```
3. **Validar e testar**

---

## 🎯 Tamanhos Esperados

### Dimensões (Pixels):
- `pwa-192x192.png`: **192x192** (exato)
- `pwa-512x512.png`: **512x512** (exato)
- `pwa-maskable-192x192.png`: **192x192** (exato)
- `pwa-maskable-512x512.png`: **512x512** (exato)

### Tamanhos de Arquivo (Otimizados):
- 192x192: **50-200 KB** (ideal: < 100 KB)
- 512x512: **100-500 KB** (ideal: < 200 KB)

**Se arquivos estiverem muito grandes:**
- Use TinyPNG após gerar: https://tinypng.com/
- Ou ajuste qualidade no script (linha `quality: 90`)

---

## 🔍 Troubleshooting

### Erro: "Nenhuma imagem fonte encontrada"

**Solução:**
1. Coloque uma imagem em `public/` (ex: `logo.png`)
2. Ou use um dos ícones existentes como fonte
3. Execute `npm run icons:pwa` novamente

### Erro: "Dimensão incorreta"

**Solução:**
1. Execute `npm run icons:pwa` para regenerar
2. Verifique com `npm run verify:pwa`
3. Se persistir, verifique se `sharp` está instalado: `npm install`

### Arquivos muito grandes (> 500 KB)

**Solução:**
1. Após gerar, use TinyPNG: https://tinypng.com/
2. Ou ajuste qualidade no script (reduzir `quality: 90` para `quality: 80`)

### Build falha com "Assets exceeding the limit"

**Solução:**
1. Otimize ícones com TinyPNG
2. Ou aumente limite no `vite.config.ts`:
   ```typescript
   maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
   ```

---

## ✅ Checklist de Validação

Após gerar ícones:

- [ ] `npm run verify:pwa` passa sem erros
- [ ] Todos os 4 arquivos existem em `public/`
- [ ] Dimensões corretas (192x192, 512x512)
- [ ] Tamanhos de arquivo < 500 KB cada
- [ ] `npm run build:prod` funciona
- [ ] `npm run preview:prod` serve ícones corretamente
- [ ] DevTools → Manifest sem warnings
- [ ] URLs abrem corretamente:
  - `http://localhost:4173/pwa-192x192.png`
  - `http://localhost:4173/pwa-512x512.png`

---

## 📁 Arquivos do Script

- `scripts/generate-pwa-icons.mjs` - Gera ícones
- `scripts/verify-pwa-icons.mjs` - Valida ícones

---

**Data:** 2026-01-22  
**Status:** ✅ Scripts criados e prontos para uso
