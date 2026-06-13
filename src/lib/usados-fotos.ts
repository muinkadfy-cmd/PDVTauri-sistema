/**
 * Serviço para buscar e exibir fotos de itens usados
 */

import { usadosArquivosRepo } from './repositories';
import type { UsadoArquivo } from '@/types';
import { logger } from '@/utils/logger';
import { getUsadoFileBlob } from '@/lib/usados-files-store';
import { LOCAL_USADOS_BUCKET } from '@/lib/usados-uploads';
import { resolveRemoteUsadoPreviewUrl } from '@/lib/capabilities/usados-preview-remote-adapter';

/**
 * Busca todas as fotos de um usado
 */
export function getFotosUsado(usadoId: string): UsadoArquivo[] {
  return usadosArquivosRepo
    .list()
    .filter(arquivo => arquivo.usadoId === usadoId && arquivo.kind === 'photo')
    .sort((a, b) => {
      // Ordenar por data de criação (mais antiga primeiro = primeira foto)
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateA - dateB;
    });
}

/**
 * Busca a primeira foto (miniatura) de um usado
 */
export function getPrimeiraFoto(usadoId: string): UsadoArquivo | null {
  const fotos = getFotosUsado(usadoId);
  return fotos[0] || null;
}

/**
 * Conta quantas fotos um usado tem
 */
export function contarFotos(usadoId: string): number {
  return getFotosUsado(usadoId).length;
}

/**
 * Gera URL para exibição de foto
 * - Se bucket é público: usa getPublicUrl
 * - Se bucket é privado: usa createSignedUrl (60 min)
 */
export async function gerarUrlFoto(arquivo: UsadoArquivo): Promise<string | null> {
  // ✅ Offline / Local bucket: ler do IndexedDB e gerar objectURL
  if (arquivo.bucket === LOCAL_USADOS_BUCKET) {
    try {
      const blob = await getUsadoFileBlob(arquivo.path, arquivo.mimeType || undefined);
      if (!blob) return null;
      return URL.createObjectURL(blob);
    } catch (e) {
      logger.warn('[UsadosFotos] Falha ao gerar URL local:', e);
      return null;
    }
  }

  try {
    return await resolveRemoteUsadoPreviewUrl(arquivo.bucket, arquivo.path, 3600);
  } catch (err) {
    logger.error('[UsadosFotos] Exceção ao gerar URL:', err);
    return null;
  }
}

/**
 * Gera URLs para múltiplas fotos em paralelo
 */
export async function gerarUrlsFotos(arquivos: UsadoArquivo[]): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  
  const promises = arquivos.map(async (arquivo) => {
    const url = await gerarUrlFoto(arquivo);
    if (url) {
      urlMap.set(arquivo.id, url);
    }
  });

  await Promise.all(promises);
  return urlMap;
}

/**
 * Busca fotos com URLs já geradas
 */
export async function getFotosComUrls(usadoId: string): Promise<Array<{ arquivo: UsadoArquivo; url: string; isObjectUrl?: boolean }>> {
  const fotos = getFotosUsado(usadoId);
  const urlMap = await gerarUrlsFotos(fotos);
  
  return fotos
    .map(foto => ({
      arquivo: foto,
      url: urlMap.get(foto.id) || '',
      isObjectUrl: (urlMap.get(foto.id) || '').startsWith('blob:')
    }))
    .filter(item => item.url); // Apenas fotos com URL válida
}
