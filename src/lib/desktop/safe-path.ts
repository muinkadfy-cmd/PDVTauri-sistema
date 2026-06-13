/**
 * Desktop Safe Path Helpers
 *
 * Objetivo: reduzir risco de escrita/leitura fora do esperado ao usar plugin-fs.
 * Observação: o path vem do `dialog.save/open`, mas ainda assim validamos:
 * - sem NUL bytes
 * - sem esquema (file://)
 * - sem segmentos de traversal óbvios
 * - extensão permitida
 */

export function sanitizeDesktopFilePath(
  filePath: string,
  allowedExtensions: string[]
): { ok: true; path: string } | { ok: false; error: string } {
  const p = String(filePath || '').trim();

  if (!p) return { ok: false, error: 'Caminho vazio.' };
  if (p.includes('\0') || p.includes('\u0000') || p.includes(String.fromCharCode(0))) {
    return { ok: false, error: 'Caminho inválido (NUL byte).' };
  }
  if (/^\s*file:\/\//i.test(p)) return { ok: false, error: 'Caminho inválido (file://).' };

  // Normaliza separadores para checagens simples
  const norm = p.replace(/\\/g, '/');

  // Bloqueia traversal óbvio
  if (/(^|\/)\.\.(\/|$)/.test(norm)) {
    return { ok: false, error: 'Caminho inválido (..).' };
  }

  const ext = (norm.split('.').pop() || '').toLowerCase();
  const allowed = (allowedExtensions || []).map((e) => String(e).toLowerCase().replace(/^\./, ''));
  if (allowed.length && !allowed.includes(ext)) {
    return { ok: false, error: `Extensão não permitida: .${ext || '?'} (permitido: ${allowed.join(', ')})` };
  }

  return { ok: true, path: p };
}
