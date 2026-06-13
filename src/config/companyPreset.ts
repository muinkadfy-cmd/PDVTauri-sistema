/**
 * Preset/Bloqueio de Empresa (Build por Cliente)
 *
 * Objetivo:
 * - Gerar um build já com os dados da empresa do cliente (fixos)
 * - Impedir que o cliente altere esses dados no app
 *
 * Como usar (Vite/Tauri):
 *
 * 1) Defina no .env (ou no comando de build):
 *
 *    VITE_COMPANY_LOCKED=1
 *    VITE_COMPANY_PRESET={"nome_fantasia":"Loja do João","cnpj":"00.000.000/0000-00","telefone":"(43) 99999-9999"}
 *
 * 2) Faça o build normalmente.
 *
 * Observação:
 * - Se VITE_COMPANY_PRESET estiver definido, o app garante que esses dados existam localmente.
 * - Se VITE_COMPANY_LOCKED=1, a tela de Configurações fica somente leitura e o serviço bloqueia alterações.
 */

export type CompanyPresetInput = {
  nome_fantasia: string;
  razao_social?: string;
  cnpj?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  logo_url?: string;
  mensagem_rodape?: string;
};

function parseBool(v: unknown): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function pickPreset(raw: any): CompanyPresetInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const nome = String(raw.nome_fantasia ?? '').trim();
  if (!nome) return null;
  const preset: CompanyPresetInput = {
    nome_fantasia: nome,
  };

  // opcionais
  const fields: Array<keyof Omit<CompanyPresetInput, 'nome_fantasia'>> = [
    'razao_social',
    'cnpj',
    'telefone',
    'endereco',
    'cidade',
    'estado',
    'cep',
    'logo_url',
    'mensagem_rodape',
  ];
  for (const f of fields) {
    const v = raw[f];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) (preset as any)[f] = s;
  }
  return preset;
}

function parsePreset(v: unknown): CompanyPresetInput | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  try {
    return pickPreset(JSON.parse(s));
  } catch {
    return null;
  }
}

export const COMPANY_LOCKED = parseBool((import.meta as any).env?.VITE_COMPANY_LOCKED);
export const COMPANY_PRESET: CompanyPresetInput | null = parsePreset((import.meta as any).env?.VITE_COMPANY_PRESET);
export const COMPANY_PRESET_ENABLED = Boolean(COMPANY_PRESET);
