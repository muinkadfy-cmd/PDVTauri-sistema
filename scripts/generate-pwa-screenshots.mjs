#!/usr/bin/env node
/**
 * Script para gerar screenshots PWA
 * 
 * Uso: npm run screenshots:pwa
 * 
 * Gera screenshots básicos para desktop e mobile usando o ícone como base
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');

// Tamanhos de screenshots recomendados
// Desktop (wide): 1280x720 ou 1920x1080
// Mobile: 750x1334 (iPhone) ou 1080x1920 (Android)
const SCREENSHOTS = {
  'screenshot-desktop.png': { width: 1280, height: 720, form_factor: 'wide' },
  'screenshot-mobile.png': { width: 750, height: 1334, form_factor: 'narrow' }
};

/**
 * Encontra uma imagem fonte
 */
function findSourceImage() {
  const possibleSources = [
    join(publicDir, 'pwa-512x512.png'),
    join(publicDir, 'pwa-192x192.png'),
    join(publicDir, 'logo.png'),
    join(publicDir, 'icon.png'),
    join(publicDir, 'icon.svg'),
  ];

  for (const source of possibleSources) {
    if (existsSync(source)) {
      return source;
    }
  }

  throw new Error(
    'Nenhuma imagem fonte encontrada!\n' +
    'Coloque uma imagem em public/ (ex: logo.png, icon.png)'
  );
}

/**
 * Gera screenshot
 */
async function generateScreenshot(sourcePath, outputPath, width, height) {
  console.log(`📸 Gerando ${outputPath} (${width}x${height})...`);
  
  // Criar canvas com fundo branco
  const canvas = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  });

  // Redimensionar logo para ocupar ~30% da altura centralizado
  const logoSize = Math.floor(height * 0.3);
  const logoX = Math.floor((width - logoSize) / 2);
  const logoY = Math.floor((height - logoSize) / 2);

  const logo = await sharp(sourcePath)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Compor: logo centralizado
  await canvas
    .composite([
      {
        input: logo,
        left: logoX,
        top: logoY,
      },
    ])
    .png({ quality: 85, compressionLevel: 9 })
    .toFile(outputPath);

  const metadata = await sharp(outputPath).metadata();
  const fileSize = (await import('fs')).statSync(outputPath).size;
  console.log(`✅ ${outputPath}: ${metadata.width}x${metadata.height} (${(fileSize / 1024).toFixed(2)} KB)`);
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Gerando screenshots PWA...\n');

  try {
    const sourcePath = findSourceImage();
    console.log(`📸 Imagem fonte: ${sourcePath}\n`);

    for (const [filename, config] of Object.entries(SCREENSHOTS)) {
      await generateScreenshot(
        sourcePath,
        join(publicDir, filename),
        config.width,
        config.height
      );
    }

    console.log('\n✅ Todos os screenshots foram gerados com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('   1. Substitua os screenshots por capturas reais da aplicação');
    console.log('   2. Build: npm run build:prod');
    console.log('   3. Verificar DevTools → Application → Manifest');

  } catch (error) {
    console.error('\n❌ Erro ao gerar screenshots:', error.message);
    process.exit(1);
  }
}

main();
