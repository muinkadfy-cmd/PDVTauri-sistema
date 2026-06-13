/**
 * Script para gerar todos os ícones PWA a partir de public/pwa.png
 * Gera: ícones PWA circulares premium, favicons e ícones maskable com padding
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const sourceImage = join(publicDir, 'pwa.png');

// Cores premium (baseado no theme_color do app)
const PRIMARY_COLOR = { r: 76, g: 175, b: 80 }; // #4CAF50 (verde)
const BORDER_COLOR = { r: 56, g: 142, b: 60 }; // Verde mais escuro para borda

// Verificar se a imagem fonte existe
if (!existsSync(sourceImage)) {
  console.error(`❌ Erro: Arquivo ${sourceImage} não encontrado!`);
  process.exit(1);
}

console.log('🎨 Gerando ícones PWA circulares premium a partir de', sourceImage);

/**
 * Cria um ícone circular premium com fundo verde e borda suave
 */
async function createCircleIcon(size, outputPath) {
  // Tamanho do conteúdo (deixar espaço para borda)
  // Mais margem interna para não cortar a logo/texto em ícones redondos (Android/iOS)
  const contentSize = Math.floor(size * 0.86); // 86% do tamanho
  const padding = Math.floor((size - contentSize) / 2);
  
  // Fundo: apenas o círculo (fora dele deve ficar transparente no PNG final)
  const circleSvg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(${PRIMARY_COLOR.r},${PRIMARY_COLOR.g},${PRIMARY_COLOR.b});stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(${PRIMARY_COLOR.r - 10},${PRIMARY_COLOR.g - 10},${PRIMARY_COLOR.b - 10});stop-opacity:1" />
        </linearGradient>
        <filter id="shadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="url(#grad)" filter="url(#shadow)"/>
    </svg>
  `;
  
  const circleBuffer = Buffer.from(circleSvg);
  
  // Redimensionar imagem original para o tamanho do conteúdo
  // IMPORTANTE: não recortar a logo em círculo (pode cortar texto/logo).
  const resized = await sharp(sourceImage)
    .resize(contentSize, contentSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  
  // Máscara FINAL no tamanho total: garante que os cantos fiquem realmente transparentes,
  // o que faz o ícone aparecer redondo no instalável (web/desktop/mobile).
  const finalMaskSvg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
    </svg>
  `;

  const base = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });

  // Compor: fundo circular + logo centralizada (sem recorte), e aplicar máscara final
  await base
    .composite([
      { input: circleBuffer, left: 0, top: 0 },
      { input: resized, left: padding, top: padding }
    ])
    .composite([{ input: Buffer.from(finalMaskSvg), blend: 'dest-in' }])
    .png()
    .toFile(outputPath);

  console.log(`✅ Criado: ${outputPath} (${size}x${size} circular premium)`);
}

/**
 * Cria um ícone maskable com padding (80% da área útil - 20% de padding)
 * Para maskable icons, o conteúdo deve estar em 80% central da imagem
 */
async function createMaskableIcon(size, outputPath) {
  const padding = Math.floor(size * 0.2); // 20% de padding em cada lado = 60% área útil (seguro)
  const contentSize = size - (padding * 2);
  
  // Para maskable, é melhor ter fundo preenchido (evita borda feia/recorte irregular no launcher)
  // e manter o conteúdo centralizado com safe-area (padding 20%).
  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: PRIMARY_COLOR.r, g: PRIMARY_COLOR.g, b: PRIMARY_COLOR.b, alpha: 1 }
    }
  });

  // Redimensionar imagem original para o tamanho do conteúdo
  const resized = await sharp(sourceImage)
    .resize(contentSize, contentSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  // Compor: fundo transparente + imagem centralizada
  await canvas
    .composite([{
      input: resized,
      left: padding,
      top: padding
    }])
    .png()
    .toFile(outputPath);

  console.log(`✅ Criado: ${outputPath} (${size}x${size} maskable com padding 20%)`);
}

/**
 * Cria um ícone normal (sem padding)
 */
async function createIcon(size, outputPath) {
  await sharp(sourceImage)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toFile(outputPath);

  console.log(`✅ Criado: ${outputPath} (${size}x${size})`);
}

/**
 * Cria favicon
 */
async function createFavicon(size, outputPath) {
  await sharp(sourceImage)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .png()
    .toFile(outputPath);

  console.log(`✅ Criado: ${outputPath} (${size}x${size})`);
}

async function generateAllIcons() {
  try {
    console.log('\n📦 Gerando ícones PWA circulares premium...\n');

    // Ícones PWA circulares premium (purpose: "any")
    await createCircleIcon(192, join(publicDir, 'pwa-circle-192.png'));
    await createCircleIcon(512, join(publicDir, 'pwa-circle-512.png'));

    // Ícones PWA maskable (com padding 20% para Android)
    await createMaskableIcon(192, join(publicDir, 'pwa-maskable-192x192.png'));
    await createMaskableIcon(512, join(publicDir, 'pwa-maskable-512x512.png'));
    
    // Manter ícones antigos para compatibilidade (serão substituídos pelos circulares)
    console.log('\n📦 Gerando ícones PWA padrão (compatibilidade)...\n');
    await createIcon(192, join(publicDir, 'pwa-192x192.png'));
    await createIcon(512, join(publicDir, 'pwa-512x512.png'));

    console.log('\n📦 Gerando favicons...\n');

    // Favicons
    await createFavicon(16, join(publicDir, 'favicon-16x16.png'));
    await createFavicon(32, join(publicDir, 'favicon-32x32.png'));

    // Apple Touch Icon (180x180) - usar o mesmo estilo do pwa-circle (fica consistente e “premium”)
    await createCircleIcon(180, join(publicDir, 'apple-touch-icon.png'));

    // Favicon.ico (32x32 em formato PNG, navegadores modernos aceitam PNG como .ico)
    console.log('\n📄 Gerando favicon.ico...');
    await createFavicon(32, join(publicDir, 'favicon.ico'));
    console.log('   ✅ favicon.ico');

    console.log('\n✨ Todos os ícones foram gerados com sucesso!\n');
    console.log('📋 Arquivos criados:');
    console.log('   - pwa-circle-192.png (circular premium)');
    console.log('   - pwa-circle-512.png (circular premium)');
    console.log('   - pwa-maskable-192x192.png (maskable com padding 20%)');
    console.log('   - pwa-maskable-512x512.png (maskable com padding 20%)');
    console.log('   - pwa-192x192.png (compatibilidade)');
    console.log('   - pwa-512x512.png (compatibilidade)');
    console.log('   - favicon-16x16.png');
    console.log('   - favicon-32x32.png');
    console.log('   - apple-touch-icon.png');
    console.log('   - favicon.ico');
    console.log('\n💡 Execute "npm run build" para testar o PWA.\n');

  } catch (error) {
    console.error('❌ Erro ao gerar ícones:', error);
    process.exit(1);
  }
}

generateAllIcons();
