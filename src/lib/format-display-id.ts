/**
 * Formatação de IDs para exibição visual
 * NÃO ALTERA O BANCO DE DADOS - apenas melhora a visualização
 */

/**
 * Formata um ID para exibição visual com prefixo e padding
 * @param tipo - Tipo do documento ('OS' para Ordem de Serviço, 'V' para Venda)
 * @param id - ID original (UUID ou número)
 * @param length - Tamanho do padding (padrão: 4)
 * @returns String formatada (ex: OS-0001, V-0045)
 */
export function formatDisplayId(
  tipo: 'OS' | 'V' | 'REC' | 'COB' | 'DEV' | 'ENC',
  id: string | number | undefined | null,
  length: number = 4
): string {
  if (!id) return `${tipo}-0000`;

  // Se for UUID, pegar últimos 8 caracteres e tentar converter para número
  const idStr = String(id);
  
  // Se for UUID (tem hífens e é longo)
  if (idStr.includes('-') && idStr.length > 20) {
    // Pegar últimos 8 caracteres (sem hífens) e converter para número
    const lastChars = idStr.replace(/-/g, '').slice(-8);
    const numericPart = parseInt(lastChars, 16) % 10000; // Modulo para manter 4 dígitos
    return `${tipo}-${String(numericPart).padStart(length, '0')}`;
  }
  
  // Se for número, usar diretamente
  const numericId = typeof id === 'number' ? id : parseInt(idStr, 10);
  
  if (isNaN(numericId)) {
    // Fallback: usar hash simples dos primeiros caracteres
    const hash = idStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 10000;
    return `${tipo}-${String(hash).padStart(length, '0')}`;
  }
  
  return `${tipo}-${String(numericId).padStart(length, '0')}`;
}

/**
 * Formata ID de Ordem de Serviço
 * @param id - ID da ordem
 * @returns String formatada (ex: OS-0001)
 */
export function formatOSId(id: string | number | undefined | null): string {
  return formatDisplayId('OS', id);
}

/**
 * Formata ID de Venda
 * @param id - ID da venda
 * @returns String formatada (ex: V-0001)
 */
export function formatVendaId(id: string | number | undefined | null): string {
  return formatDisplayId('V', id);
}

/**
 * Formata ID de Recibo
 * @param id - ID do recibo
 * @returns String formatada (ex: REC-0001)
 */
export function formatReciboId(id: string | number | undefined | null): string {
  return formatDisplayId('REC', id);
}

/**
 * Formata ID de Cobrança
 * @param id - ID da cobrança
 * @returns String formatada (ex: COB-0001)
 */
export function formatCobrancaId(id: string | number | undefined | null): string {
  return formatDisplayId('COB', id);
}

/**
 * Formata ID de Devolução
 * @param id - ID da devolução
 * @returns String formatada (ex: DEV-0001)
 */
export function formatDevolucaoId(id: string | number | undefined | null): string {
  return formatDisplayId('DEV', id);
}

/**
 * Formata ID de Encomenda
 * @param id - ID da encomenda
 * @returns String formatada (ex: ENC-0001)
 */
export function formatEncomendaId(id: string | number | undefined | null): string {
  return formatDisplayId('ENC', id);
}

/**
 * Extrai o ID real de um ID formatado (uso interno apenas)
 * @param displayId - ID formatado (ex: OS-0001)
 * @returns Número extraído (ex: 1)
 */
export function extractNumericId(displayId: string): number | null {
  const match = displayId.match(/[A-Z]+-(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}
