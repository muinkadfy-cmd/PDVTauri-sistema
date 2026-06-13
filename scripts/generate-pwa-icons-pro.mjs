/**
 * Gera ícones PWA nível "software pago" em public/icons/
 * A partir de public/pwa.png: any, maskable (20% padding, fundo verde escuro), favicons, apple-touch.
 * Purpose "any" e "maskable" separados (sem "any maskable").
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const iconsDir = join(publicDir, 'icons');
const sourceImage = join(publicDir, 'pwa.png');

const PRIMARY_COLOR = { r: 76, g: 175, b: 80 };   // #4CAF50
const DARK_GREEN = { r: 27, g: 94, b: 32 };       // #1B5E20 (verde escuro para maskable)

if (!existsSync(sourceImage)) {
  console.error(`❌ Erro: ${sourceImage} não encontrado.`);
  process.exit(1);
}

if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
  console.log('📁 Pasta public/icons criada.');
}

/** Ícone purpose "any": circular premium, gradiente verde, logo centralizado */
async function createAnyIcon(size, outputPath) {
  const contentSize = Math.floor(size * 0.86);
  const padding = Math.floor((size - contentSize) / 2);
  const circleSvg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(${PRIMARY_COLOR.r},${PRIMARY_COLOR.g},${PRIMARY_COLOR.b});stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(${PRIMARY_COLOR.r - 12},${PRIMARY_COLOR.g - 12},${PRIMARY_COLOR.b});stop-opacity:1" />
        </linearGradient>
        <filter id="sh"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dx="0" dy="1" result="o"/><feComponentTransfer><feFuncA type="linear" slope="0.25"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="url(#g)" filter="url(#sh)"/>
    </svg>
  `;
  const resized = await sharp(sourceImage)
    .resize(contentSize, contentSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const maskSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`;
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([
      { input: Buffer.from(circleSvg), left: 0, top: 0 },
      { input: resized, left: padding, top: padding }
    ])
    .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
    .png()
    .toFile(outputPath);
  console.log(`✅ ${outputPath} (${size}x${size} any)`);
}

/** Ícone purpose "maskable": fundo verde escuro sólido, logo com ~20% padding */
async function createMaskableIcon(size, outputPath) {
  const padding = Math.floor(size * 0.2);
  const contentSize = size - padding * 2;
  const resized = await sharp(sourceImage)
    .resize(contentSize, contentSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: DARK_GREEN.r, g: DARK_GREEN.g, b: DARK_GREEN.b, alpha: 1 }
    }
  })
    .composite([{ input: resized, left: padding, top: padding }])
    .png()
    .toFile(outputPath);
  console.log(`✅ ${outputPath} (${size}x${size} maskable)`);
}

/** Favicon / apple-touch: quadrado com fundo branco e logo */
async function createFaviconOrApple(size, outputPath) {
  await sharp(sourceImage)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(outputPath);
  console.log(`✅ ${outputPath} (${size}x${size})`);
}

async function main() {
  console.log('🎨 Gerando ícones PWA (public/icons) a partir de', sourceImage, '\n');
  try {
    await createAnyIcon(192, join(iconsDir, 'icon-192.png'));
    await createAnyIcon(512, join(iconsDir, 'icon-512.png'));
    await createMaskableIcon(192, join(iconsDir, 'icon-192-maskable.png'));
    await createMaskableIcon(512, join(iconsDir, 'icon-512-maskable.png'));
    await createFaviconOrApple(180, join(iconsDir, 'apple-touch-icon.png'));
    await createFaviconOrApple(32, join(iconsDir, 'favicon-32.png'));
    await createFaviconOrApple(16, join(iconsDir, 'favicon-16.png'));
    console.log('\n✨ Ícones gerados em public/icons/\n');
  } catch (e) {
    console.error('❌', e);
    process.exit(1);
  }
}

main();
