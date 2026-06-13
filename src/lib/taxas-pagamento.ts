/**
 * Service para gerenciar taxas de pagamento configuráveis por loja
 * 
 * Permite configurar taxas percentuais e fixas para cada forma de pagamento:
 * - Dinheiro (geralmente 0%)
 * - PIX (geralmente 0% ou baixa)
 * - Débito (ex: 1.99%)
 * - Crédito (varia por parcela: 1x-12x)
 * - Outro (configurável)
 * 
 * ✅ REFATORADO: Agora usa Repository para sincronização automática entre web/mobile
 */

import { logger } from '@/utils/logger';
import { generateId } from '@/lib/storage';
import { taxasPagamentoRepo } from './repositories';
import { getStoreId } from './store-id'; // ✅ NOVO: Importar getStoreId direto

// ================================================================
// TIPOS
// ================================================================

export type FormaPagamentoTaxa = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'boleto' | 'cartao' | 'outro';

export interface TaxaPagamento {
  id: string;
  store_id: string;
  forma_pagamento: FormaPagamentoTaxa;
  parcelas: number; // 1-12 (usado apenas para crédito)
  taxa_percentual: number; // 0-100%
  taxa_fixa: number; // R$ (opcional)
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TaxaCalculada {
  percentual: number;
  valorTaxa: number;
  valorFinal: number; // valor - taxa
}

// ================================================================
// CONSTANTES
// ================================================================

// ✅ REMOVIDO: Não precisa mais da chave de storage, usa Repository
// const STORAGE_KEY = 'smart-tech-taxas-pagamento';

// Taxas padrão (baseadas no padrão da imagem do WhatsApp Business)
const TAXAS_PADRAO: Omit<TaxaPagamento, 'id' | 'store_id' | 'created_at' | 'updated_at'>[] = [
  // Dinheiro e PIX: sem taxa
  { forma_pagamento: 'dinheiro', parcelas: 1, taxa_percentual: 0, taxa_fixa: 0, ativo: true },
  { forma_pagamento: 'pix', parcelas: 1, taxa_percentual: 0, taxa_fixa: 0, ativo: true },
  
  // Débito: 1.66% (padrão WhatsApp Business)
  { forma_pagamento: 'debito', parcelas: 1, taxa_percentual: 1.66, taxa_fixa: 0, ativo: true },
  
  // Crédito: taxas padrão WhatsApp Business
  { forma_pagamento: 'credito', parcelas: 1, taxa_percentual: 3.95, taxa_fixa: 0, ativo: true },
  { forma_pagamento: 'credito', parcelas: 2, taxa_percentual: 7.99, taxa_fixa: 0, ativo: true },
  { forma_pagamento: 'credito', parcelas: 3, taxa_percentual: 8.99, taxa_fixa: 0, ativo: true },
  { forma_pagamento: 'credito', parcelas: 4, taxa_percentual: 9.99, taxa_fixa: 0, ativo: true },
  { forma_pagamento: 'credito', parcelas: 5, taxa_percentual: 10.99, taxa_fixa: 0, ativo: true },
  { forma_pagamento: 'credito', parcelas: 6, taxa_percentual: 11.99, taxa_fixa: 0, ativo: true },
  { forma_pagamento: 'credito', parcelas: 7, taxa_percentual: 12.99, taxa_fixa: 0, ativo: true },
  { forma_pagamento: 'credito', parcelas: 8, taxa_percentual: 13.99, taxa_fixa: 0, ativo: true },
  { forma_pagamento: 'credito', parcelas: 9, taxa_percentual: 14.99, taxa_fixa: 0, ativo: true },
  { forma_pagamento: 'credito', parcelas: 10, taxa_percentual: 14.99, taxa_fixa: 0, ativo: true },
  { forma_pagamento: 'credito', parcelas: 11, taxa_percentual: 15.49, taxa_fixa: 0, ativo: true },
  { forma_pagamento: 'credito', parcelas: 12, taxa_percentual: 15.49, taxa_fixa: 0, ativo: true },
  
  // Outro: sem taxa default
  { forma_pagamento: 'outro', parcelas: 1, taxa_percentual: 0, taxa_fixa: 0, ativo: true }
];

// ================================================================
// STORAGE (✅ REFATORADO: Usa Repository com sincronização automática)
// ================================================================

/**
 * Lista todas as taxas do Repository (sincronizado com Supabase)
 */
export function getTaxasDoStorage(): TaxaPagamento[] {
  return taxasPagamentoRepo.list();
}

/**
 * ⚠️ DEPRECATED: Não é mais necessário salvar manualmente
 * Use salvarTaxa() que já usa o Repository
 */
export function salvarTaxasNoStorage(taxas: TaxaPagamento[]): void {
  logger.warn('[TaxasPagamento] salvarTaxasNoStorage() está deprecated. Use salvarTaxa() diretamente.');
  // Manter compatibilidade temporária
  taxas.forEach(taxa => {
    taxasPagamentoRepo.upsert(taxa);
  });
}

// ================================================================
// FUNÇÕES DE LEITURA
// ================================================================

/**
 * Lista todas as taxas configuradas para a loja atual
 */
export function getTaxasPagamento(): TaxaPagamento[] {
  return getTaxasDoStorage();
}

/**
 * Busca taxa específica para forma de pagamento e parcelas
 */
export function getTaxa(
  formaPagamento: FormaPagamentoTaxa,
  parcelas: number = 1
): TaxaPagamento | null {
  const taxas = getTaxasPagamento();
  
  // Procurar taxa exata
  const taxa = taxas.find(
    t => t.forma_pagamento === formaPagamento && 
         t.parcelas === parcelas && 
         t.ativo
  );
  
  if (taxa) return taxa;
  
  // Se não encontrou e não é crédito, buscar com parcelas=1
  if (formaPagamento !== 'credito') {
    return taxas.find(
      t => t.forma_pagamento === formaPagamento && 
           t.parcelas === 1 && 
           t.ativo
    ) || null;
  }
  
  return null;
}

/**
 * Busca taxa ou retorna padrão
 */
export function getTaxaOuPadrao(
  formaPagamento: FormaPagamentoTaxa,
  parcelas: number = 1,
  storeId: string
): TaxaPagamento {
  const taxa = getTaxa(formaPagamento, parcelas);
  
  if (taxa) return taxa;
  
  // Retornar taxa padrão
  const taxaPadrao = TAXAS_PADRAO.find(
    t => t.forma_pagamento === formaPagamento && t.parcelas === parcelas
  );
  
  if (taxaPadrao) {
    return {
      ...taxaPadrao,
      id: `default-${formaPagamento}-${parcelas}`,
      store_id: storeId
    };
  }
  
  // Fallback: sem taxa
  return {
    id: `fallback-${formaPagamento}-${parcelas}`,
    store_id: storeId,
    forma_pagamento: formaPagamento,
    parcelas: parcelas,
    taxa_percentual: 0,
    taxa_fixa: 0,
    ativo: true
  };
}

/**
 * Lista taxas agrupadas por forma de pagamento
 */
export function getTaxasAgrupadas(): Record<FormaPagamentoTaxa, TaxaPagamento[]> {
  const taxas = getTaxasPagamento();
  
  const agrupadas: Partial<Record<FormaPagamentoTaxa, TaxaPagamento[]>> = {
    dinheiro: [],
    pix: [],
    debito: [],
    credito: [],
    boleto: [],
    cartao: [],
    outro: []
  };
  
  taxas.forEach(taxa => {
    if (agrupadas[taxa.forma_pagamento]) {
      agrupadas[taxa.forma_pagamento]!.push(taxa);
    }
  });
  
  // Ordenar crédito por parcelas
  if (agrupadas.credito) {
    agrupadas.credito.sort((a, b) => a.parcelas - b.parcelas);
  }
  
  return agrupadas as Record<FormaPagamentoTaxa, TaxaPagamento[]>;
}

// ================================================================
// FUNÇÕES DE CÁLCULO
// ================================================================

/**
 * Calcula taxa para um valor específico
 */
export function calcularTaxa(
  valor: number,
  formaPagamento: FormaPagamentoTaxa,
  parcelas: number = 1,
  storeId: string
): TaxaCalculada {
  const taxa = getTaxaOuPadrao(formaPagamento, parcelas, storeId);
  
  // Calcular taxa
  const taxaPercentual = (valor * taxa.taxa_percentual) / 100;
  const taxaTotal = taxaPercentual + taxa.taxa_fixa;
  const valorFinal = valor - taxaTotal;
  
  return {
    percentual: taxa.taxa_percentual,
    valorTaxa: taxaTotal,
    valorFinal: Math.max(0, valorFinal) // Nunca negativo
  };
}

/**
 * Calcula taxa e retorna percentual usado
 */
export function calcularTaxaValor(
  valor: number,
  formaPagamento: FormaPagamentoTaxa,
  parcelas: number = 1,
  storeId: string
): { taxa_valor: number; taxa_percentual: number } {
  const resultado = calcularTaxa(valor, formaPagamento, parcelas, storeId);
  
  return {
    taxa_valor: resultado.valorTaxa,
    taxa_percentual: resultado.percentual
  };
}

// ================================================================
// FUNÇÕES DE ESCRITA
// ================================================================

/**
 * Salva ou atualiza taxa (✅ REFATORADO: Usa Repository com sync automático)
 */
export async function salvarTaxa(taxa: Omit<TaxaPagamento, 'id'> & { id?: string }): Promise<TaxaPagamento | null> {
  try {
    // ✅ CRÍTICO: Validar store_id ANTES de salvar
    let storeId = taxa.store_id?.trim();
    
    // Se não foi fornecido ou está vazio, tentar obter do contexto
    if (!storeId) {
      const { storeId: currentStoreId } = getStoreId();
      storeId = currentStoreId?.trim() || '';
      
      if (!storeId) {
        logger.error('[TaxasPagamento] ❌ store_id não definido! Configure a loja (?store=UUID na URL)');
        return null;
      }
      
      logger.log('[TaxasPagamento] ✅ store_id obtido do contexto:', storeId);
    }
    
    // Validações
    if (!taxa.forma_pagamento) {
      logger.error('[TaxasPagamento] forma_pagamento é obrigatório');
      return null;
    }
    
    if (taxa.parcelas < 1 || taxa.parcelas > 12) {
      logger.error('[TaxasPagamento] Parcelas deve estar entre 1 e 12');
      return null;
    }
    
    if (taxa.taxa_percentual < 0 || taxa.taxa_percentual > 100) {
      logger.error('[TaxasPagamento] Taxa percentual deve estar entre 0 e 100');
      return null;
    }
    
    if (taxa.taxa_fixa < 0) {
      logger.error('[TaxasPagamento] Taxa fixa não pode ser negativa');
      return null;
    }
    
    // ✅ REFATORADO: Usa Repository (sincroniza automaticamente)
    const taxas = getTaxasDoStorage();
    
    // Se tem ID, atualizar; senão, criar
    if (taxa.id) {
      const taxaAtualizada: TaxaPagamento = {
        ...taxa,
        id: taxa.id,
        store_id: storeId, // ✅ Garantir store_id
        updated_at: new Date().toISOString()
      };
      
      const saved = await taxasPagamentoRepo.upsert(taxaAtualizada);
      logger.log('[TaxasPagamento] Taxa atualizada e sincronizada:', taxa.id);
      return saved;
    } else {
      // Verificar se já existe taxa para essa combinação
      const existente = getTaxa(taxa.forma_pagamento, taxa.parcelas);
      
      if (existente) {
        // Atualizar existente
        const atualizada: TaxaPagamento = {
          ...taxa,
          id: existente.id,
          store_id: storeId, // ✅ Garantir store_id
          updated_at: new Date().toISOString()
        };
        const saved = await taxasPagamentoRepo.upsert(atualizada);
        logger.log('[TaxasPagamento] Taxa existente atualizada e sincronizada:', existente.id);
        return saved;
      }
      
      // Criar nova
      const nova: TaxaPagamento = {
        ...taxa,
        id: generateId(),
        store_id: storeId, // ✅ Garantir store_id
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const saved = await taxasPagamentoRepo.upsert(nova);
      logger.log('[TaxasPagamento] Nova taxa criada e sincronizada:', nova.id);
      
      // ✅ Disparar evento para atualizar UI em tempo real
      window.dispatchEvent(new Event('smart-tech-taxas-updated'));
      
      return saved;
    }
  } catch (error) {
    logger.error('[TaxasPagamento] Erro ao salvar taxa:', error);
    return null;
  }
}

/**
 * Deleta taxa (✅ REFATORADO: Usa Repository com sync automático)
 */
export async function deletarTaxa(id: string): Promise<boolean> {
  try {
    const sucesso = await taxasPagamentoRepo.remove(id);
    
    if (sucesso) {
      logger.log('[TaxasPagamento] Taxa deletada e sincronizada:', id);
      // Disparar evento para atualizar UI
      window.dispatchEvent(new Event('smart-tech-taxas-updated'));
    }
    
    return sucesso;
  } catch (error) {
    logger.error('[TaxasPagamento] Erro ao deletar taxa:', error);
    return false;
  }
}

/**
 * Inicializa taxas padrão para uma loja (se não existir nenhuma)
 */
export async function inicializarTaxasPadrao(storeId: string): Promise<void> {
  try {
    // ✅ Validar store_id antes de inicializar
    let validStoreId = storeId?.trim();
    
    if (!validStoreId) {
      const { storeId: currentStoreId } = getStoreId();
      validStoreId = currentStoreId?.trim() || '';
      
      if (!validStoreId) {
        logger.error('[TaxasPagamento] ❌ Não é possível inicializar taxas sem store_id válido');
        return;
      }
    }
    
    const taxasExistentes = getTaxasPagamento();
    
    // Se já tem taxas, não faz nada
    if (taxasExistentes.length > 0) {
      logger.log('[TaxasPagamento] Taxas já existem para esta loja');
      return;
    }
    
    logger.log('[TaxasPagamento] Inicializando taxas padrão para loja:', validStoreId);
    
    // Criar todas as taxas padrão
    for (const taxaPadrao of TAXAS_PADRAO) {
      await salvarTaxa({
        ...taxaPadrao,
        store_id: validStoreId // ✅ Usar store_id validado
      });
    }
    
    logger.log('[TaxasPagamento] ✅ Taxas padrão inicializadas:', TAXAS_PADRAO.length);
  } catch (error) {
    logger.error('[TaxasPagamento] Erro ao inicializar taxas padrão:', error);
  }
}

/**
 * Reseta taxas para padrão (CUIDADO: deleta todas as customizações!)
 */
export async function resetarTaxasParaPadrao(storeId: string): Promise<void> {
  try {
    const taxasExistentes = getTaxasPagamento();
    
    // Deletar todas existentes
    for (const taxa of taxasExistentes) {
      await deletarTaxa(taxa.id);
    }
    
    // Recriar padrão
    await inicializarTaxasPadrao(storeId);
    
    logger.log('[TaxasPagamento] ✅ Taxas resetadas para padrão');
  } catch (error) {
    logger.error('[TaxasPagamento] Erro ao resetar taxas:', error);
  }
}

// ================================================================
// HELPERS
// ================================================================

/**
 * Formata percentual para exibição
 */
export function formatarPercentual(valor: number): string {
  return `${valor.toFixed(2)}%`;
}

/**
 * Formata valor monetário
 */
export function formatarValor(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

/**
 * Retorna nome amigável da forma de pagamento
 */
export function getNomeFormaPagamento(forma: FormaPagamentoTaxa | string): string {
  const nomes: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    debito: 'Débito',
    credito: 'Crédito',
    cartao: 'Cartão',
    boleto: 'Boleto',
    outro: 'Outro'
  };
  
  return nomes[forma] || forma;
}

/**
 * Retorna ícone para forma de pagamento
 */
export function getIconeFormaPagamento(forma: FormaPagamentoTaxa | string): string {
  const icones: Record<string, string> = {
    dinheiro: '💵',
    pix: '📱',
    debito: '💳',
    credito: '💳',
    cartao: '💳',
    boleto: '🧾',
    outro: '📝'
  };
  
  return icones[forma] || '💰';
}


// ================================================================
// DETALHES PARA EXIBIÇÃO (TAXA + "JUROS" DO PARCELAMENTO)
// ================================================================

/**
 * Calcula detalhes para exibir em cards/comprovantes:
 * - taxa total do meio de pagamento (percentual + fixa)
 * - para crédito parcelado (>1x), calcula o "juros do parcelamento" como o
 *   custo adicional em relação ao crédito 1x (mesma forma, 1 parcela).
 *
 * Observação: aqui "juros" = diferença de taxa (MDR) entre 1x e Nx.
 * É uma forma prática de explicar ao usuário por que parcelado "custa mais".
 */
export function calcularDetalhesCartao(
  valor: number,
  formaPagamento: FormaPagamentoTaxa,
  parcelas: number = 1,
  storeId: string
): {
  taxa_total: number;
  taxa_percentual: number;
  taxa_fixa: number;
  juros_parcelamento: number; // diferença vs crédito 1x
  parcelas: number;
} {
  const atual = getTaxaOuPadrao(formaPagamento, parcelas, storeId);

  const taxaPercentualValor = (valor * (atual.taxa_percentual || 0)) / 100;
  const taxaTotal = taxaPercentualValor + (atual.taxa_fixa || 0);

  let jurosParcelamento = 0;

  // Só faz sentido comparar quando for crédito e parcelado
  if (formaPagamento === 'credito' && parcelas > 1) {
    const base1x = getTaxaOuPadrao('credito', 1, storeId);

    const basePercentualValor = (valor * (base1x.taxa_percentual || 0)) / 100;
    const baseTotal = basePercentualValor + (base1x.taxa_fixa || 0);

    jurosParcelamento = Math.max(0, taxaTotal - baseTotal);
  }

  return {
    taxa_total: Math.max(0, taxaTotal),
    taxa_percentual: atual.taxa_percentual || 0,
    taxa_fixa: atual.taxa_fixa || 0,
    juros_parcelamento: Math.max(0, jurosParcelamento),
    parcelas: parcelas || 1
  };
}
