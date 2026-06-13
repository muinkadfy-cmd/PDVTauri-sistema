/**
 * Script para gerar ícones PWA válidos
 * Executa: node scripts/generate-pwa-icons.js
 */

const fs = require('fs');
const path = require('path');

// Criar um PNG simples 1x1 (válido mas mínimo)
// Em produção, substitua por ícones reais
const createSimplePNG = (size) => {
  // PNG mínimo válido (1x1 pixel verde)
  // Header PNG + IHDR + IDAT + IEND
  const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // Para um PNG real, seria necessário usar uma biblioteca como 'sharp' ou 'pngjs'
  // Por enquanto, vamos criar um placeholder que será substituído
  // Este é um PNG válido mínimo de 1x1 pixel verde
  
  // PNG 1x1 verde (base64)
  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  
  return png1x1;
};

const publicDir = path.join(__dirname, '..', 'public');

// Criar ícones
const sizes = [192, 512];

sizes.forEach(size => {
  const filename = `pwa-${size}x${size}.png`;
  const filepath = path.join(publicDir, filename);
  
  // Criar PNG simples (1x1, será substituído por ícone real depois)
  const png = createSimplePNG(size);
  
  fs.writeFileSync(filepath, png);
  console.log(`✅ Criado: ${filename} (${png.length} bytes)`);
});

console.log('\n⚠️  NOTA: Estes são placeholders mínimos.');
console.log('   Para produção, substitua por ícones PNG reais de 192x192 e 512x512 pixels.');
