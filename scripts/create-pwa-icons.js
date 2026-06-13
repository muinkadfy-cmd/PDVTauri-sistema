/**
 * Script para criar ícones PWA válidos (PNG mínimo)
 * Execute: node scripts/create-pwa-icons.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PNG válido mínimo 1x1 pixel verde (#4CAF50)
// Este é um PNG real e válido, mas muito pequeno
// Para produção, substitua por ícones reais de 192x192 e 512x512
const createMinimalPNG = () => {
  // PNG 1x1 pixel verde (válido)
  // Base64 de um PNG real de 1x1 pixel
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return Buffer.from(pngBase64, 'base64');
};

const publicDir = path.join(__dirname, '..', 'public');

// Criar ícones
const sizes = [192, 512];

sizes.forEach(size => {
  const filename = `pwa-${size}x${size}.png`;
  const filepath = path.join(publicDir, filename);
  
  // Criar PNG mínimo válido
  const png = createMinimalPNG();
  
  fs.writeFileSync(filepath, png);
  console.log(`✅ Criado: ${filename} (${png.length} bytes)`);
});

console.log('\n⚠️  NOTA: Estes são placeholders mínimos válidos.');
console.log('   Para produção, substitua por ícones PNG reais de 192x192 e 512x512 pixels.');
console.log('   Use um editor de imagens ou ferramenta online para criar os ícones.');
