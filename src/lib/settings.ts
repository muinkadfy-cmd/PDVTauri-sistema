/**
 * Settings do sistema por loja (multitenant)
 * - Termos de garantia (texto simples) por store_id
 */

import { WarrantySettings } from '@/types';
import { settingsRepo } from '@/lib/repositories';
import { logger } from '@/utils/logger';
import { bootstrapCurrentStoreDefaults } from '@/lib/bootstrap-store';
import { requireRuntimeStoreId } from '@/lib/runtime-context';

function getStoreIdOrThrow(): string {
  const storeId = requireRuntimeStoreId()?.trim() || '';
  if (!storeId) {
    throw new Error('Selecione uma loja (adicione ?store=UUID na URL).');
  }
  return storeId;
}

export function getDefaultWarrantySettings(storeId: string): WarrantySettings {
  // Texto padrão (editável) dos Termos de Garantia impresso na OS.
  // Obs: o usuário ainda pode personalizar em Configurações → Termos de Garantia.
  const termosDefault = `TERMO DE GARANTIA
GARANTIA: [30 A 90] DIAS
COBRE DEFEITO FUNCIONAL.
NAO COBRE QUEDA, TELA,
AGUA, MAU USO OU
VIOLACAO DO APARELHO.
APRESENTAR COMPROVANTE.`;

  return {
    id: storeId,
    warranty_terms: termosDefault,
    // Editável por padrão (o admin pode “fixar” se quiser impedir edição rápida na OS)
    warranty_terms_pinned: false,
    warranty_terms_enabled: true,
    // Técnico padrão (opcional)
    default_tecnico: '',
    tecnico_pinned: false,
    // Garantia padrão (meses)
    default_warranty_months: 3,
    warranty_months_pinned: false,
    print_mode: 'normal' // Modo padrão: normal (não compacto)
  };
}

export async function getWarrantySettings(): Promise<{ success: boolean; data?: WarrantySettings; error?: string }> {
  try {
    const storeId = getStoreIdOrThrow();

    // Tentar pull do remoto (best-effort). Se falhar, segue com local.
    try {
      await settingsRepo.pullFromRemote();
    } catch (e) {
      if (import.meta.env.DEV) logger.warn('[Settings] pullFromRemote falhou (seguindo local):', e);
    }

    let local = settingsRepo.getById(storeId);
    if (!local) {
      // Se não existe no remoto/local ainda, criar defaults (best-effort)
      try {
        await bootstrapCurrentStoreDefaults();
      } catch {
        // ignore
      }
      try {
        const created = getDefaultWarrantySettings(storeId);
        await settingsRepo.upsert(created);
      } catch (e) {
        if (import.meta.env.DEV) logger.warn('[Settings] upsert default falhou:', e);
      }
      local = settingsRepo.getById(storeId);
    }

    // Migração (legado): algumas versões antigas vinham com um texto de "Direitos de registro"
    // como padrão. Se o usuário ainda não personalizou (ou ficou com o padrão antigo),
    // atualizamos automaticamente para o novo texto de garantia (3 meses / 90 dias).
    try {
      const txt = String(local?.warranty_terms || '').trim();
      const isLegacyRights =
        txt.startsWith('📜 DIREITOS DE REGISTRO') ||
        txt.startsWith('DIREITOS DE REGISTRO') ||
        txt.includes('Lei nº 9.610/98') ||
        txt.includes('Direitos Autorais');
      const previousDefaultWarranty =
        txt.startsWith('🛡️ TERMOS DE GARANTIA — 90 DIAS') ||
        txt.includes('A garantia é de 90 dias a partir da data de entrega') ||
        txt.includes('Cobre: defeito diretamente relacionado ao reparo') ||
        txt.includes('Para validação: apresentação do comprovante');

      if (local && (isLegacyRights || previousDefaultWarranty)) {
        const migrated: WarrantySettings = {
          ...local,
          warranty_terms: getDefaultWarrantySettings(storeId).warranty_terms
        };
        await settingsRepo.upsert(migrated);
        local = migrated;
      }
    } catch {
      // ignore
    }

    // Migração (novos campos): técnico padrão
    try {
      if (local) {
        const needsTechPinned = typeof (local as any).tecnico_pinned !== 'boolean';
        const needsDefaultTech = typeof (local as any).default_tecnico !== 'string';
        if (needsTechPinned || needsDefaultTech) {
          const migrated: WarrantySettings = {
            ...getDefaultWarrantySettings(storeId),
            ...local,
            tecnico_pinned: typeof (local as any).tecnico_pinned === 'boolean' ? (local as any).tecnico_pinned : false,
            default_tecnico: typeof (local as any).default_tecnico === 'string' ? (local as any).default_tecnico : '',
          };
          await settingsRepo.upsert(migrated);
          local = migrated;
        }
      }
    } catch {
      // ignore
    }

    return { success: true, data: local || getDefaultWarrantySettings(storeId) };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Erro ao carregar settings' };
  }
}

export async function upsertWarrantySettings(
  patch: Partial<Omit<WarrantySettings, 'id'>> & { id?: string }
): Promise<{ success: boolean; data?: WarrantySettings; error?: string }> {
  try {
    const storeId = getStoreIdOrThrow();

    const current = settingsRepo.getById(storeId) || getDefaultWarrantySettings(storeId);
    const next: WarrantySettings = {
      ...current,
      ...patch,
      id: storeId
    };

    const saved = await settingsRepo.upsert(next);
    if (!saved) return { success: false, error: 'Não foi possível salvar settings' };
    return { success: true, data: saved };
  } catch (e: any) {
    logger.error('[Settings] Erro ao salvar settings:', e);
    return { success: false, error: e?.message || 'Erro ao salvar settings' };
  }
}
