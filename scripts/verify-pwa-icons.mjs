#!/usr/bin/env node
/**
 * Script para validar dimensões dos ícones PWA
 * 
 * Uso: npm run verify:pwa
 * 
 * Valida:
 * - Dimensões corretas (192x192, 512x512)
 * - Arquivos existem
 * - Tamanhos de arquivo razoáveis (< 500 KB)
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');

// Configuração dos ícones
const ICONS = [
  { file: 'pwa-192x192.png', size: 192, maxSizeKB: 200 },
  { file: 'pwa-512x512.png', size: 512, maxSizeKB: 500 },
  { file: 'pwa-maskable-192x192.png', size: 192, maxSizeKB: 200 },
  { file: 'pwa-maskable-512x512.png', size: 512, maxSizeKB: 500 },
];

let errors = 0;
let warnings = 0;

/**
 * Valida um ícone
 */
async function validateIcon(icon) {
  const filePath = join(publicDir, icon.file);
  
  // Verificar se arquivo existe
  if (!existsSync(filePath)) {
    console.error(`❌ ${icon.file}: Arquivo não encontrado`);
    errors++;
    return;
  }

  try {
    // Verificar dimensões
    const metadata = await sharp(filePath).metadata();
    const width = metadata.width;
    const height = metadata.height;
    const expectedSize = icon.size;

    if (width !== expectedSize || height !== expectedSize) {
      console.error(
        `❌ ${icon.file}: Dimensão incorreta!\n` +
        `   Esperado: ${expectedSize}x${expectedSize}px\n` +
        `   Obtido: ${width}x${height}px`
      );
      errors++;
      return;
    }

    // Verificar tamanho do arquivo
    const fileSize = statSync(filePath).size;
    const fileSizeKB = fileSize / 1024;
    const maxSizeKB = icon.maxSizeKB;

    if (fileSizeKB > maxSizeKB) {
      console.warn(
        `⚠️  ${icon.file}: Arquivo muito grande!\n` +
        `   Tamanho: ${fileSizeKB.toFixed(2)} KB\n` +
        `   Recomendado: < ${maxSizeKB} KB\n` +
        `   Dica: Use TinyPNG para otimizar`
      );
      warnings++;
    }

    // Sucesso
    console.log(
      `✅ ${icon.file}: ${width}x${height}px (${fileSizeKB.toFixed(2)} KB)`
    );

  } catch (error) {
    console.error(`❌ ${icon.file}: Erro ao validar - ${error.message}`);
    errors++;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🔍 Validando ícones PWA...\n');

  // Validar todos os ícones
  for (const icon of ICONS) {
    await validateIcon(icon);
  }

  // Resumo
  console.log('\n📊 Resumo:');
  if (errors === 0 && warnings === 0) {
    console.log('✅ Todos os ícones estão corretos!');
    process.exit(0);
  } else {
    if (errors > 0) {
      console.error(`❌ ${errors} erro(s) encontrado(s)`);
    }
    if (warnings > 0) {
      console.warn(`⚠️  ${warnings} aviso(s)`);
    }
    console.log('\n💡 Para corrigir, execute: npm run icons:pwa');
    process.exit(errors > 0 ? 1 : 0);
  }
}

main();
