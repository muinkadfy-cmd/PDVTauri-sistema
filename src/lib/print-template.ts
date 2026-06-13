/**
 * Template de Impressão - Layout baseado no comprovante físico
 * Reutilizável para Ordens de Serviço, Recibos, Vendas, etc.
 * Respeita o tamanho de papel configurado em Configurações (A4, 58mm, 80mm).
 */

import { safeGet } from '@/lib/storage';
import { ACESSORIOS as ACESSORIOS_PRESETS } from '@/lib/os-presets';
import { isDesktopApp } from '@/lib/platform';
import { openPrintPreviewWindow } from '@/lib/capabilities/print-adapter';
import { loadPrintProfile } from '@/print/printProfiles';
import { escposPrintRaw, buildEscposReceiptFromPrintData } from '@/utils/escpos';
import { listPrinters } from '@/utils/printers';

export type TamanhoPapel = 'A4' | '58mm' | '80mm';
export type PrintMode = 'normal' | 'compact';

const STORAGE_KEY_PAPEL = 'smart-tech-tamanho-papel';
const STORAGE_KEY_PRINT_MODE = 'smart-tech-print-mode';
const STORAGE_KEY_PRINT_SCALE = 'smart-tech-print-scale';

function getPaperSize(): TamanhoPapel {
  const res = safeGet<TamanhoPapel>(STORAGE_KEY_PAPEL, null);
  const v = res?.data;

  if (v && ['A4', '58mm', '80mm'].includes(v)) {
    return v;
  }

  // Padrão: desktop costuma usar bobina (80mm); web inicia em A4.
  return isDesktopApp() ? '80mm' : 'A4';
}

function getPrintMode(): PrintMode {
  const res = safeGet<PrintMode>(STORAGE_KEY_PRINT_MODE, null);
  const v = res?.data;
  if (v && ['normal', 'compact'].includes(v)) return v;
  // Padrão mais seguro: em papel térmico (58/80mm), iniciar em modo compacto
  // para reduzir espaço e diminuir risco de corte/estouro de largura.
  return getPaperSize() === 'A4' ? 'normal' : 'compact';
}

function getPrintScale(): number {
  const res = safeGet<number>(STORAGE_KEY_PRINT_SCALE, null);
  const v = res?.data;
  // Aceita 50% a 120% para evitar valores quebrados
  if (typeof v === 'number' && v >= 0.5 && v <= 1.2) return v;
  return 1;
}

// Normaliza texto para impressão (corrige "mojibake" comum: Ã£ -> ã, etc) e evita quebrar HTML
function t(v: unknown): string {
  const s = String(v ?? '');
  if (!s) return '';
  let out = s;

  // Heurística: só tenta corrigir se aparecerem padrões clássicos de UTF-8 interpretado como Latin-1
  if (/[ÃÂ]/.test(out)) {
    try {
      const bytes = Uint8Array.from(out, (ch) => ch.charCodeAt(0) & 0xff);
      const decoded = new TextDecoder('utf-8').decode(bytes);
      // Se a versão decodificada parecer melhor, usa ela
      if (decoded && decoded.length >= 1) out = decoded;
    } catch {
      // ignora
    }
  }

  // Escape básico HTML
  return out
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderTextBlock(value: unknown, opts?: { extraClass?: string; compactParagraphs?: boolean }): string {
  const raw = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  if (!raw) return '';

  const paragraphs = raw
    .split(/\n{2,}/)
    .map((part) => part.split('\n').map((line) => line.trim()).join('\n').trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return '';

  const extraClass = opts?.extraClass ? ` ${opts.extraClass}` : '';
  const compactClass = opts?.compactParagraphs ? ' text-block--compact' : '';

  return `<div class="text-block${compactClass}${extraClass}">${paragraphs
    .map((paragraph) => `<p>${t(paragraph)}</p>`)
    .join('')}</div>`;
}


export interface EmpresaInfo {
  nome: string;
  cnpj?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  logo_url?: string;
  slogan?: string;
}

const COMPANY_CACHE_KEY = 'smart-tech-company-cache';

export interface PrintData {
  tipo: 'ordem-servico' | 'recibo' | 'venda' | 'comprovante' | 'checklist';
  numero: string;
  clienteNome?: string;
  clienteTelefone?: string;
  cpfCnpj?: string;
  clienteEndereco?: string;
  data?: string;
  hora?: string;
  // Ordem de Serviço
  equipamento?: string;
  marca?: string;
  modelo?: string;
  cor?: string;
  garantia?: string;
  defeito?: string;
  reparo?: string;
  senhaCliente?: string;
  senhaPadrao?: string; // padrão 9 pontos (ex.: \"6-0-8-2\")
  situacao?: string;
  tecnico?: string;
  dataPrevisao?: string;
  dataConclusao?: string;
  acessorios?: string[]; // Array de acessórios
  laudoTecnico?: string; // Laudo técnico detalhado
  // Valores
  valorServico?: number;
  valorPecas?: number;
  /**
   * Valor total principal do documento.
   * Para compatibilidade, mantém o comportamento antigo (ex.: total líquido em OS).
   */
  valorTotal?: number;
  /**
   * Valores detalhados (quando disponíveis).
   * Útil para exibir no comprovante: bruto / desconto / taxa / líquido.
   */
  valorBruto?: number;
  desconto?: number;
  taxaCartaoValor?: number;
  valorLiquido?: number;
  formaPagamento?: string;
  parcelas?: string;
  // Recibo/Venda
  descricao?: string;
  tipoRecibo?: string;
  itens?: Array<{ nome: string; quantidade: number; preco: number; descricao?: string }>;
  // Observações
  observacoes?: string;
  termosCompra?: string;
  termosGarantia?: string;
}

const DEFAULT_EMPRESA: EmpresaInfo = {
  nome: '',
  cnpj: undefined,
  telefone: undefined,
  endereco: undefined,
  cidade: undefined,
  estado: undefined,
  logo_url: undefined,
  slogan: undefined,
};

/**
 * Formata valor monetário
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// formatDate removido - não utilizado

/**
 * Formata data e hora
 */
function formatDateTime(date: string | Date): { data: string; hora: string } {
  const d = typeof date === 'string' ? new Date(date) : date;
  return {
    data: d.toLocaleDateString('pt-BR'),
    hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  };
}

/**
 * buildAccessoriesChecklistHTML
 *
 * Regras legais:
 *  - TODOS os acessórios são renderizados (☑ marcado / ☐ não entregue)
 *  - Itens customizados (fora da lista fixa) são adicionados ao final
 *  - A ordem é sempre: lista fixa → customizados
 *  - NÃO altera marcação — apenas reflete o que foi salvo na OS
 *  - Inclui linha de assinatura para confirmação do cliente
 */
function buildAccessoriesChecklistHTML(
  selected: string[] | undefined,
  papel: TamanhoPapel,
  modo: PrintMode
): string {
  const compact = modo === 'compact';
  const oneCol  = papel === '58mm' || compact;

  // Itens fixos da lista predefinida
  const fixedLabels = ACESSORIOS_PRESETS as unknown as string[];

  // Itens customizados: qualquer item selecionado que não esteja na lista fixa
  const selectedArr  = (selected ?? []).map(s => String(s).trim());
  const selectedLower = new Set(selectedArr.map(s => s.toLowerCase()));
  const fixedLower   = new Set(fixedLabels.map(s => s.toLowerCase()));
  const customItems  = selectedArr.filter(s => !fixedLower.has(s.toLowerCase()));

  // Montar lista completa: fixos + customizados
  const allItems: string[] = [...fixedLabels, ...customItems];

  const items = allItems.map(label => {
    const checked = selectedLower.has(label.toLowerCase());
    const symbol  = checked ? '&#x2611;' : '&#x2610;'; // ☑ ou ☐
    const weight  = checked ? 'font-weight:700;' : '';
    return `<span class="check-item" style="${weight}">${symbol}&nbsp;${label}</span>`;
  }).join('');

  const nenhum = selectedArr.length === 0;

return `
  <div class="separator-thick"></div>
  <div class="info-section">
    <div class="info-full">
      <div class="info-full-label" style="font-size:${compact ? '9px' : '11px'};letter-spacing:0.5px;">
        ACESSÓRIOS ENTREGUES PELO CLIENTE
      </div>
      <div class="acess-instrucao" style="font-size:${compact ? '7px' : '9px'};color:#555;margin:${compact ? '1px 0 3px' : '2px 0 5px'};">
        Itens marcados com &#x2611; foram entregues. Itens com &#x2610; NÃO foram entregues.
      </div>

      <div class="checklist${oneCol ? ' checklist-1col' : ''}" style="margin-top:${compact ? '3px' : '5px'};">
        ${nenhum
          ? `<span class="check-item" style="font-style:italic;color:#888;">Nenhum acessório informado</span>`
          : items
        }
      </div>

      ${!compact ? `
      <div class="acess-assinatura" style="margin-top:8px;border-top:1px solid #ccc;padding-top:6px;">
        <div style="font-size:8px;color:#555;margin-bottom:18px;">
          Confirmo que os itens marcados acima foram entregues junto ao aparelho.
        </div>
        <div style="border-bottom:1px solid #000;width:65%;margin-bottom:2px;"></div>
        <div style="font-size:7px;color:#777;">Assinatura do cliente / Data</div>
      </div>
      ` : ''}
    </div>
  </div>
`;
}

function renderPatternSVG(pattern?: string, modo: PrintMode = 'normal'): string {
  if (!pattern) return '';
  const parts = pattern
    .split('-')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 8);

  if (parts.length < 1) return '';

  const cell = modo === 'compact' ? 22 : 28;
  const pad = 10;

  const pos = (i: number) => {
    const r = Math.floor(i / 3);
    const c = i % 3;
    return { x: pad + c * cell, y: pad + r * cell };
  };

  const dots = Array.from({ length: 9 })
    .map((_, i) => {
      const p = pos(i);
      return `<circle cx="${p.x}" cy="${p.y}" r="${modo === 'compact' ? 4 : 5}" stroke="#000" stroke-width="2" fill="none" />`;
    })
    .join('');

  const lines = parts
    .slice(1)
    .map((to, idx) => {
      const from = parts[idx];
      const a = pos(from);
      const b = pos(to);
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#000" stroke-width="${modo === 'compact' ? 2.5 : 3}" stroke-linecap="round" />`;
    })
    .join('');

  const selected = Array.from(new Set(parts))
    .map(i => {
      const p = pos(i);
      return `<circle cx="${p.x}" cy="${p.y}" r="${modo === 'compact' ? 3.3 : 4}" fill="#000" />`;
    })
    .join('');

  const w = pad * 2 + cell * 2;
  const h = pad * 2 + cell * 2;

  return `
    <div style="margin-top:6px">
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        ${lines}
        ${dots}
        ${selected}
      </svg>
    </div>
  `;
}


/**
 * Gera HTML do template de impressão.
 * Usa o tamanho de papel da Configurações (A4, 58mm, 80mm) se paperSize não for informado.
 * Usa o modo de impressão (normal/compact) das Configurações.
 */
export function generatePrintTemplate(
  data: PrintData,
  empresa: EmpresaInfo = DEFAULT_EMPRESA,
  paperSize?: TamanhoPapel,
  printMode?: PrintMode
): string {
  // Se existir cache da empresa (vindo do Supabase via CompanyContext), usar automaticamente.
  // Isso permite que recibos/impressÃµes mostrem os dados reais da loja sem editar cada página.
  const cached = safeGet<Partial<EmpresaInfo>>(COMPANY_CACHE_KEY, null);
  if (cached?.success && cached.data) {
    empresa = { ...empresa, ...cached.data };
  }

  const storedPaper = getPaperSize();
  // Determinar papel final: se opção fornecida, usar ela; senão usar o salvo nas configurações
  const papel: TamanhoPapel = paperSize ?? storedPaper;

  // OBS: "Economia (50%)" não pode encolher a impressão na horizontal.
  // Antes usávamos `zoom: 0.5`, o que achata a largura e deixa ilegível.
  // Agora tratamos 0.5 como "compactação vertical" (reduz espaços/linhas) mantendo a largura.
  const scale = getPrintScale();
  const isEconomy50 = scale <= 0.75; // hoje só existe 1.0 ou 0.5

  const modoBase: PrintMode = printMode ?? getPrintMode();
  const modo: PrintMode = papel === '58mm' || papel === '80mm'
    ? 'compact'
    : modoBase;

  // CSS do @page: em economia reduzimos margens (ganho real de altura) sem achatar a largura.
  const pageCss = (() => {
    if (papel === 'A4') {
      const margin = isEconomy50
        ? (modo === 'compact' ? '4mm' : '6mm')
        : (modo === 'compact' ? '6mm' : '10mm');
      return `size: A4; margin: ${margin};`;
    }
    if (papel === '80mm') {
      return 'size: auto; margin: 0;';
    }
    // 58mm
    return 'size: auto; margin: 0;';
  })();

  const { data: dataFormatada, hora: horaFormatada } = data.data
    ? formatDateTime(data.data)
    : { data: new Date().toLocaleDateString('pt-BR'), hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };



  const termosGarantiaLimpo = (() => {
    const raw = String(data.termosGarantia ?? '').trim();
    return raw.replace(/^(?:\s*TERMOS\s+DE\s+GARANTIA\s*[:\-–]*\s*)+/i, '').trim();
  })();

  const termosCompraLimpo = (() => {
    const raw = String(data.termosCompra ?? '').trim();
    return raw.replace(/^(?:\s*TERMO\S*\s+DE\s+COMPRA\s*(?:\(.*?\))?\s*[:\-–]*\s*)+/i, '').trim();
  })();



  // Montar endereço completo
  const enderecoCompleto = [
    empresa.endereco,
    empresa.cidade ? empresa.cidade : '',
    empresa.estado ? empresa.estado : ''
  ]
    .filter(Boolean)
    .join(', ');

  const companyLogoHtml = empresa.logo_url
    ? `
      <div class="empresa-logo">
        <img src="${t(empresa.logo_url)}" alt="${t(empresa.nome || 'Logo da empresa')}" />
      </div>
    `
    : '';

  // Determinar título do documento
  let tituloDocumento = '';
  let subtituloDocumento = '';
  switch (data.tipo) {
    case 'ordem-servico':
      tituloDocumento = `O.S. NUMERO : ${data.numero}`;
      subtituloDocumento = 'COMPROVANTE DE RECEBIMENTO';
      break;
    case 'recibo':
      tituloDocumento = `RECIBO NUMERO : ${data.numero}`;
      subtituloDocumento = 'COMPROVANTE DE RECEBIMENTO';
      break;
    case 'venda':
      tituloDocumento = `VENDA NUMERO : ${data.numero}`;
      break;
    case 'comprovante':
      tituloDocumento = `COMPROVANTE NUMERO : ${data.numero}`;
      break;
    case 'checklist':
      tituloDocumento = `CHECKLIST OS : ${data.numero}`;
      subtituloDocumento = 'ACESSÓRIOS E SENHA';
      break;
  }

  // Montar seção de valores
  let valoresHTML = '';
  const isOS = data.tipo === 'ordem-servico';
  const isReceipt = data.tipo === 'ordem-servico' || data.tipo === 'recibo' || data.tipo === 'comprovante';
  // â ï¸ Regra: em OS (assistência), NÃO exibir valor líquido/taxas para o cliente.
  // O valor principal deve ser o BRUTO / valor do serviço.
  const principal = isOS
    ? (data.valorBruto ?? data.valorTotal)
    : (data.valorLiquido ?? data.valorTotal);

  // Em OS, nunca detalhar SERVIÇO/PEÇAS no comprovante (cliente só vÃª um valor final).
  if (principal || (!isReceipt && (data.valorServico || data.valorPecas || data.valorBruto || data.desconto || data.taxaCartaoValor))) {
    const valorServicoFormatado = (!isReceipt && data.valorServico)
      ? formatCurrency(data.valorServico).replace('R$', '').trim()
      : '';
    const valorPecasFormatado = (!isReceipt && data.valorPecas)
      ? formatCurrency(data.valorPecas).replace('R$', '').trim()
      : '';
    const totalFormatado = principal 
      ? formatCurrency(principal).replace('R$', '').trim()
      : '';

    // Labels
    const labelPrincipal = isOS ? 'VALOR DO SERVIÇO' : 'VALOR TOTAL';
    valoresHTML = `
      <div class="valor-section">
        ${!isReceipt && data.valorServico ? `
          <div class="valor-item">
            <span class="info-label">SERVIÇO:</span>
            <span class="info-value">R$ ${valorServicoFormatado}</span>
          </div>
        ` : ''}
        ${!isReceipt && data.valorPecas ? `
          <div class="valor-item">
            <span class="info-label">PEÇAS:</span>
            <span class="info-value">R$ ${valorPecasFormatado}</span>
          </div>
        ` : ''}
        ${totalFormatado ? `
          <div class="valor-label">${labelPrincipal}:</div>
          <div class="valor-container">
            <span class="valor-simbolo">R$</span>
            <span class="valor-principal">${totalFormatado}</span>
          </div>
        ` : ''}
        ${data.formaPagamento ? (isOS ? `
          <div class="pagamento-inline">PAGAMENTO: ${String(data.formaPagamento).toUpperCase().replace('CARTAO', 'CRÉDITO À VISTA')}${data.parcelas ? ` (${data.parcelas})` : ''}</div>
        ` : `
          <div class="pagamento-info">
            <div class="pagamento-box">PAGAMENTO VIA ${String(data.formaPagamento).toUpperCase().replace('CARTAO', 'CRÉDITO À VISTA')}</div>
            ${data.parcelas ? `<div class="pagamento-box">${data.parcelas}</div>` : ''}
          </div>
        `) : ''}
      </div>
    `;
  }

  // Montar itens (para vendas)
  let itensHTML = '';
  if (data.itens && data.itens.length > 0) {
    itensHTML = `
      <div class="info-section">
        <div class="info-label">ITENS:</div>
        ${data.itens.map(item => `
          <div class="info-line">
            <span class="info-value">${item.quantidade}x ${item.nome} - ${formatCurrency(item.preco * item.quantidade)}</span>
          </div>
          ${item.descricao ? `<div class="info-line"><span class="info-value">${t(item.descricao)}</span></div>` : ''}
        `).join('')}
      </div>
    `;
  }

  
  // Cabeçalho compacto específico para O.S. (sem caixas/linhas quadradas)
  const headerOS = `
    <div class="header header-os${empresa.logo_url ? ' header-with-logo' : ''}">
      ${companyLogoHtml}
      <div class="empresa-header-main">
        <div class="empresa-nome">${t(empresa.nome)}</div>
        <div class="empresa-meta">
          ${empresa.cnpj ? `<span>CNPJ: ${empresa.cnpj}</span>` : ''}
          ${empresa.telefone ? `<span>Tel: ${empresa.telefone}</span>` : ''}
        </div>
        ${enderecoCompleto ? `<div class="empresa-endereco">${t(enderecoCompleto)}</div>` : ''}
        ${empresa.slogan ? `<div class="empresa-slogan">${t(empresa.slogan)}</div>` : ''}
      </div>
    </div>
    <div class="separator-thin"></div>`;

// Layout comprovante (ordem de serviço): igual ao padrão físico
  const ordemServicoBodyHTML =
    data.tipo === 'ordem-servico'
      ? `
        ${headerOS}
        
        <div class="documento-titulo">OS: ${data.numero}</div>
        <div class="documento-subtitulo">COMPROVANTE DE RECEBIMENTO</div>
        <div class="separator-thin"></div>
        <div class="info-section">
          ${data.clienteNome ? `<div class="info-line"><span class="info-label">CLIENTE:</span><span class="info-value">${t(data.clienteNome)}</span></div>` : ''}
          ${data.clienteTelefone ? `<div class="info-line"><span class="info-label">TELEFONE:</span><span class="info-value">${t(data.clienteTelefone)}</span></div>` : ''}
          ${data.cpfCnpj ? `<div class="info-line"><span class="info-label">CPF/CNPJ:</span><span class="info-value">${t(data.cpfCnpj)}</span></div>` : ''}
          ${data.clienteEndereco ? `<div class="info-line"><span class="info-label">ENDEREÇO:</span><span class="info-value">${t(data.clienteEndereco)}</span></div>` : ''}
          ${data.modelo ? `<div class="info-line"><span class="info-label">MODELO:</span><span class="info-value">${t(data.modelo)}</span></div>` : ''}
          ${data.marca ? `<div class="info-line"><span class="info-label">MARCA:</span><span class="info-value">${t(data.marca)}</span></div>` : ''}
          ${data.cor ? `<div class="info-line"><span class="info-label">COR:</span><span class="info-value">${t(data.cor)}</span></div>` : ''}
          ${data.garantia ? `<div class="info-line"><span class="info-label">GARANTIA:</span><span class="info-value">${t(data.garantia)}</span></div>` : ''}
          ${data.data ? `<div class="info-line"><span class="info-label">ENTRADA:</span><span class="info-value">${dataFormatada} ${horaFormatada}</span></div>` : ''}
                              ${data.tecnico ? `<div class="info-line"><span class="info-label">TÉCNICO:</span><span class="info-value">${t(data.tecnico)}</span></div>` : ''}
        </div>
        <div class="separator-thin"></div>
        ${data.defeito ? `<div class="info-section"><div class="info-full"><div class="info-full-label">DEFEITO RELATADO:</div><div class="info-full-value">${renderTextBlock(data.defeito, { compactParagraphs: true })}</div></div></div>` : ''}
        ${data.reparo ? `<div class="info-section"><div class="info-full"><div class="info-full-label">REPARO TÉCNICO:</div><div class="info-full-value">${renderTextBlock(data.reparo, { compactParagraphs: true })}</div></div></div>` : ''}
        <div class="separator-thin"></div>
        ${valoresHTML || ''}
        <div class="separator-thin"></div>
        ${(data.observacoes || data.termosGarantia) ? `
        <div class="observacoes-section">
          <div class="observacoes-label">OBSERVAÇÕES</div>
          <div class="observacoes-text">${renderTextBlock([data.observacoes, data.termosGarantia].filter(Boolean).join('\n\n'), { compactParagraphs: true })}</div>
        </div>
        ` : ''}
        ${data.clienteNome ? `<div class="assinatura"><div class="assinatura-line"></div><div class="assinatura-nome">${t(data.clienteNome)}</div></div>` : ''}
      `
      : null;


  // Layout: CHECKLIST (impressão separada)
  const checklistBodyHTML =
    data.tipo === 'checklist'
      ? `
        ${headerOS}

        <div class="documento-titulo">CHECKLIST - OS: ${data.numero}</div>
        <div class="documento-subtitulo">ACESSÓRIOS E SENHA</div>
        <div class="separator-thin"></div>
        <div class="info-section">
          ${data.clienteNome ? `<div class="info-line"><span class="info-label">CLIENTE:</span><span class="info-value">${t(data.clienteNome)}</span></div>` : ''}
          ${data.clienteTelefone ? `<div class="info-line"><span class="info-label">TELEFONE:</span><span class="info-value">${t(data.clienteTelefone)}</span></div>` : ''}
          ${(data.tipo === 'checklist' && data.senhaCliente) ? `<div class="info-line"><span class="info-label">SENHA:</span><span class="info-value">${t(data.senhaCliente)}</span></div>` : ''}
          ${data.senhaPadrao ? `<div class="info-full"><div class="info-full-label">PADRÃO (9 PONTOS):</div>${renderPatternSVG(data.senhaPadrao, modo)}</div>` : ''}
                            </div>
        ${buildAccessoriesChecklistHTML(data.acessorios, papel, modo)}
        <div class="separator-thick"></div>
        ${data.clienteNome ? `<div class="assinatura"><div class="assinatura-line"></div><div class="assinatura-nome">${t(data.clienteNome)}</div></div>` : ''}
      `
      : null;


  // Cabeçalho compartilhado (padrão): usa o mesmo layout da OS
  const headerComprovante = headerOS;

// Layout comprovante: RECIBO
  const reciboBodyHTML =
    data.tipo === 'recibo'
      ? `${headerComprovante}
        <div class="documento-titulo">RECIBO: ${data.numero}</div>
        <div class="documento-subtitulo">COMPROVANTE DE RECEBIMENTO</div>
        <div class="separator-thin"></div>
        <div class="info-section">
          ${data.clienteNome ? `<div class="info-line"><span class="info-label">CLIENTE:</span><span class="info-value">${t(data.clienteNome)}</span></div>` : ''}
          ${data.clienteTelefone ? `<div class="info-line"><span class="info-label">TELEFONE:</span><span class="info-value">${t(data.clienteTelefone)}</span></div>` : ''}
          ${data.cpfCnpj ? `<div class="info-line"><span class="info-label">CPF/CNPJ:</span><span class="info-value">${t(data.cpfCnpj)}</span></div>` : ''}
          ${data.clienteEndereco ? `<div class="info-line"><span class="info-label">ENDEREÇO:</span><span class="info-value">${t(data.clienteEndereco)}</span></div>` : ''}
          ${data.data ? `<div class="info-line"><span class="info-label">DATA:</span><span class="info-value">${dataFormatada} ${horaFormatada}</span></div>` : ''}
          ${data.tipoRecibo ? `<div class="info-line"><span class="info-label">TIPO:</span><span class="info-value">${t(data.tipoRecibo)}</span></div>` : ''}
        </div>
        <div class="separator-thick"></div>
        ${data.descricao ? `<div class="info-section"><div class="info-full"><div class="info-full-label">DESCRIÇÃO:</div><div class="info-full-value">${renderTextBlock(data.descricao, { compactParagraphs: true })}</div></div></div>` : ''}
        ${(data.valorTotal != null) ? `
        <div class="separator-thick"></div>
        <div class="valor-section">
          <div class="valor-label">VALOR</div>
          <div class="valor-container">
            <span class="valor-simbolo">R$</span>
            <span class="valor-principal">${formatCurrency(data.valorTotal).replace('R$', '').trim()}</span>
          </div>
          ${data.formaPagamento ? `<div class="pagamento-info"><div class="pagamento-box">PAGAMENTO VIA ${String(data.formaPagamento).toUpperCase().replace('CARTAO', 'CRÉDITO À VISTA')}</div></div>` : ''}
        </div>
        ` : ''}
        <div class="separator-thick"></div>
        ${data.observacoes ? `<div class="observacoes-section"><div class="observacoes-label">OBSERVAÇÕES</div><div class="observacoes-text">${renderTextBlock(data.observacoes, { compactParagraphs: true })}</div></div>` : ''}
        ${termosCompraLimpo ? `<div class="separator-thick"></div><div class="observacoes-section termos-compra-section"><div class="observacoes-label">TERMOS DE COMPRA</div><div class="observacoes-text">${renderTextBlock(termosCompraLimpo)}</div></div>` : ''}
        ${termosGarantiaLimpo ? `<div class="separator-thick"></div><div class="observacoes-section termos-garantia-section"><div class="observacoes-label">TERMOS DE GARANTIA</div><div class="observacoes-text">${renderTextBlock(termosGarantiaLimpo)}</div></div>` : ''}
        ${data.clienteNome ? `<div class="assinatura"><div class="assinatura-line"></div><div class="assinatura-nome">${t(data.clienteNome)}</div></div>` : ''}
      `
      : null;

  // Layout comprovante: VENDA
  const vendaBodyHTML =
    data.tipo === 'venda'
      ? `${headerComprovante}
        <div class="documento-titulo">VENDA: ${data.numero}</div>
        <div class="documento-subtitulo">COMPROVANTE DE RECEBIMENTO</div>
        <div class="separator-thin"></div>
        <div class="info-section">
          ${data.clienteNome ? `<div class="info-line"><span class="info-label">CLIENTE:</span><span class="info-value">${t(data.clienteNome)}</span></div>` : ''}
          ${data.clienteTelefone ? `<div class="info-line"><span class="info-label">TELEFONE:</span><span class="info-value">${t(data.clienteTelefone)}</span></div>` : ''}
          ${data.cpfCnpj ? `<div class="info-line"><span class="info-label">CPF/CNPJ:</span><span class="info-value">${t(data.cpfCnpj)}</span></div>` : ''}
          ${data.clienteEndereco ? `<div class="info-line"><span class="info-label">ENDEREÇO:</span><span class="info-value">${t(data.clienteEndereco)}</span></div>` : ''}
          ${data.data ? `<div class="info-line"><span class="info-label">DATA:</span><span class="info-value">${dataFormatada} ${horaFormatada}</span></div>` : ''}
          ${data.garantia ? `<div class="info-line"><span class="info-label">GARANTIA:</span><span class="info-value">${t(data.garantia)}</span></div>` : ''}
        </div>
        <div class="separator-thick"></div>
        ${data.itens && data.itens.length > 0 ? `
        <div class="info-section">
          <div class="info-full-label">ITENS</div>
          ${data.itens.map(item => `<div><div class="info-line" style="margin: 2px 0;"><span class="info-value">${item.quantidade}x ${item.nome} - ${formatCurrency(item.preco * item.quantidade)}</span></div>${item.descricao ? `<div class="info-line" style="margin: 0 0 2px 0;"><span class="info-value">${t(item.descricao)}</span></div>` : ''}</div>`).join('')}
        </div>
        <div class="separator-thick"></div>
        ` : ''}
        ${(data.valorTotal != null) ? `
        <div class="valor-section">
          <div class="valor-label">VALOR TOTAL</div>
          <div class="valor-container">
            <span class="valor-simbolo">R$</span>
            <span class="valor-principal">${formatCurrency(data.valorTotal).replace('R$', '').trim()}</span>
          </div>
          ${(data.formaPagamento || data.parcelas) ? `<div class="pagamento-info">${data.formaPagamento ? `<div class="pagamento-box">PAGAMENTO VIA ${String(data.formaPagamento).toUpperCase().replace('CARTAO', 'CRÉDITO À VISTA')}</div>` : ''}${data.parcelas ? `<div class="pagamento-box">${data.parcelas}</div>` : ''}</div>` : ''}
        </div>
        ` : ''}
        <div class="separator-thick"></div>
        ${data.observacoes ? `<div class="observacoes-section"><div class="observacoes-label">OBSERVAÇÕES</div><div class="observacoes-text">${renderTextBlock(data.observacoes, { compactParagraphs: true })}</div></div>` : ''}
        ${termosCompraLimpo ? `<div class="separator-thick"></div><div class="observacoes-section termos-compra-section"><div class="observacoes-label">TERMOS DE COMPRA</div><div class="observacoes-text">${renderTextBlock(termosCompraLimpo)}</div></div>` : ''}
        ${termosGarantiaLimpo ? `<div class="separator-thick"></div><div class="observacoes-section termos-garantia-section"><div class="observacoes-label">TERMOS DE GARANTIA</div><div class="observacoes-text">${renderTextBlock(termosGarantiaLimpo)}</div></div>` : ''}
        ${data.clienteNome ? `<div class="assinatura"><div class="assinatura-line"></div><div class="assinatura-nome">${t(data.clienteNome)}</div></div>` : ''}
      `
      : null;

  // Layout comprovante: COMPROVANTE (cobrança, compra usados, etc.)
  const comprovanteBodyHTML =
    data.tipo === 'comprovante'
      ? `${headerComprovante}
        <div class="documento-titulo">COMPROVANTE: ${data.numero}</div>
        <div class="documento-subtitulo">COMPROVANTE DE RECEBIMENTO</div>
        <div class="separator-thin"></div>
        <div class="info-section">
          ${data.clienteNome ? `<div class="info-line"><span class="info-label">CLIENTE:</span><span class="info-value">${t(data.clienteNome)}</span></div>` : ''}
          ${data.clienteTelefone ? `<div class="info-line"><span class="info-label">TELEFONE:</span><span class="info-value">${t(data.clienteTelefone)}</span></div>` : ''}
          ${data.cpfCnpj ? `<div class="info-line"><span class="info-label">CPF/CNPJ:</span><span class="info-value">${t(data.cpfCnpj)}</span></div>` : ''}
          ${data.clienteEndereco ? `<div class="info-line"><span class="info-label">ENDEREÇO:</span><span class="info-value">${t(data.clienteEndereco)}</span></div>` : ''}
          ${data.data ? `<div class="info-line"><span class="info-label">DATA:</span><span class="info-value">${dataFormatada} ${horaFormatada}</span></div>` : ''}
          ${data.garantia ? `<div class="info-line"><span class="info-label">GARANTIA:</span><span class="info-value">${t(data.garantia)}</span></div>` : ''}
        </div>
        <div class="separator-thick"></div>
        ${data.descricao ? `<div class="info-section"><div class="info-full"><div class="info-full-label">DESCRIÇÃO:</div><div class="info-full-value">${renderTextBlock(data.descricao, { compactParagraphs: true })}</div></div></div>` : ''}
        ${(data.itens && data.itens.length > 0) ? `<div class="info-section"><div class="info-full-label">ITENS</div>${data.itens.map(item => `<div><div class="info-line" style="margin: 2px 0;"><span class="info-value">${item.quantidade}x ${item.nome} - ${formatCurrency(item.preco * item.quantidade)}</span></div>${item.descricao ? `<div class="info-line" style="margin: 0 0 2px 0;"><span class="info-value">${t(item.descricao)}</span></div>` : ''}</div>`).join('')}</div><div class="separator-thick"></div>` : ''}
        ${(data.valorTotal != null) ? `
        <div class="valor-section">
          <div class="valor-label">VALOR</div>
          <div class="valor-container">
            <span class="valor-simbolo">R$</span>
            <span class="valor-principal">${formatCurrency(data.valorTotal).replace('R$', '').trim()}</span>
          </div>
          ${data.formaPagamento ? `<div class="pagamento-info"><div class="pagamento-box">${String(data.formaPagamento).toUpperCase().replace('CARTAO', 'CRÉDITO À VISTA')}</div></div>` : ''}
        </div>
        ` : ''}
        <div class="separator-thick"></div>
        ${data.observacoes ? `<div class="observacoes-section"><div class="observacoes-label">OBSERVAÇÕES</div><div class="observacoes-text">${renderTextBlock(data.observacoes, { compactParagraphs: true })}</div></div>` : ''}
        ${termosCompraLimpo ? `<div class="separator-thick"></div><div class="observacoes-section termos-compra-section"><div class="observacoes-label">TERMOS DE COMPRA</div><div class="observacoes-text">${renderTextBlock(termosCompraLimpo)}</div></div>` : ''}
        ${termosGarantiaLimpo ? `<div class="separator-thick"></div><div class="observacoes-section termos-garantia-section"><div class="observacoes-label">TERMOS DE GARANTIA</div><div class="observacoes-text">${renderTextBlock(termosGarantiaLimpo)}</div></div>` : ''}
        ${data.clienteNome ? `<div class="assinatura"><div class="assinatura-line"></div><div class="assinatura-nome">${t(data.clienteNome)}</div></div>` : ''}
      `
      : null;

  const comprovanteLayoutHTML = checklistBodyHTML ?? ordemServicoBodyHTML ?? reciboBodyHTML ?? vendaBodyHTML ?? comprovanteBodyHTML;
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${tituloDocumento}</title>
        <style>
          @media print {
            @page {
              ${pageCss}
            }
            body {
              margin: 0;
              padding: 0;
            }
            .no-print {
              display: none;
            }
            html, body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body.print-receipt {
              /* Economia (50%): NÃO aplicar zoom/scale global (achata na horizontal). */
            }
            a {
              color: #000;
              text-decoration: none;
            }
            svg, img {
              max-width: 100%;
            }
            /* Evitar cortes estranhos em blocos importantes */
            .header,
            .info-section,
            .observacoes-section,
            .valor-section,
            .pagamento-section,
            .assinatura {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .page-break {
              break-after: page;
              page-break-after: always;
            }

            }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: Arial, sans-serif;
            font-size: ${modo === 'compact' ? '10px' : '12px'};
            line-height: ${modo === 'compact' ? '1.2' : '1.4'};
            color: #000;
            background: #fff;
            margin: 0 auto;
          }

          /* Base do documento de impressão */
          body.print-receipt {
            font-variant-numeric: tabular-nums;
          }

          /* =============================
             ECONOMIA (50%) — COMPACTAÇÃO VERTICAL
             Mantém largura, reduz altura via espaçamentos/linhas.
             ============================= */
          body.print-receipt.economy-50 .header {
            margin-bottom: ${modo === 'compact' ? '6px' : '8px'};
            padding-bottom: ${modo === 'compact' ? '4px' : '6px'};
          }
          body.print-receipt.economy-50 .empresa-nome {
            font-size: ${modo === 'compact' ? '15px' : '16px'};
            margin-bottom: 3px;
          }
          body.print-receipt.economy-50 .empresa-info-box { gap: ${modo === 'compact' ? '4px' : '6px'}; }
          body.print-receipt.economy-50 .empresa-meta { gap: ${modo === 'compact' ? '6px' : '8px'}; font-size: ${modo === 'compact' ? '8px' : '9px'}; }
          body.print-receipt.economy-50 .empresa-endereco { font-size: ${modo === 'compact' ? '8px' : '9px'}; margin-top: 3px; }
          body.print-receipt.economy-50 .info-box { padding: ${modo === 'compact' ? '2px 4px' : '3px 6px'}; }
          body.print-receipt.economy-50 .empresa-endereco-box { padding: ${modo === 'compact' ? '2px 4px' : '3px 6px'}; margin-top: 4px; }
          body.print-receipt.economy-50 .empresa-slogan { margin-top: 3px; padding: ${modo === 'compact' ? '2px 4px' : '3px 6px'}; }

          body.print-receipt.economy-50 .separator-thick { margin: ${modo === 'compact' ? '5px 0' : '7px 0'}; }
          body.print-receipt.economy-50 .separator-thin { margin: ${modo === 'compact' ? '4px 0' : '5px 0'}; }

          body.print-receipt.economy-50 .documento-titulo { margin: ${modo === 'compact' ? '4px 0' : '6px 0'}; font-size: ${modo === 'compact' ? '11px' : '12px'}; }
          body.print-receipt.economy-50 .documento-subtitulo { margin: 2px 0 ${modo === 'compact' ? '4px' : '6px'} 0; }

          body.print-receipt.economy-50 .info-section { margin: ${modo === 'compact' ? '5px 0' : '7px 0'}; }
          body.print-receipt.economy-50 .info-line { margin: ${modo === 'compact' ? '2px 0' : '3px 0'}; }
          body.print-receipt.economy-50 .info-label { min-width: ${modo === 'compact' ? '80px' : '88px'}; }

          body.print-receipt.economy-50 .itens-section { margin: ${modo === 'compact' ? '6px 0' : '10px 0'}; }
          body.print-receipt.economy-50 .item-row { padding: ${modo === 'compact' ? '2px 0' : '3px 0'}; }

          body.print-receipt.economy-50 .valor-section { margin: ${modo === 'compact' ? '8px 0' : '10px 0'}; padding: ${modo === 'compact' ? '6px 0' : '8px 0'}; }
          body.print-receipt.economy-50 .valor-principal { font-size: ${modo === 'compact' ? '18px' : '20px'}; }

          body.print-receipt.economy-50 .pagamento-section { margin: ${modo === 'compact' ? '6px 0' : '8px 0'}; }
          body.print-receipt.economy-50 .pagamento-box { padding: ${modo === 'compact' ? '2px 6px' : '3px 7px'}; }

          body.print-receipt.economy-50 .observacoes-section { margin: ${modo === 'compact' ? '5px 0' : '8px 0'}; }
          body.print-receipt.economy-50 .observacoes-text { line-height: ${modo === 'compact' ? '1.12' : '1.18'}; }
          body.print-receipt.economy-50 .termos-garantia-section .observacoes-text { line-height: ${modo === 'compact' ? '1.10' : '1.16'}; }

          body.print-receipt.economy-50 .assinatura { margin-top: ${modo === 'compact' ? '10px' : '14px'}; padding-top: ${modo === 'compact' ? '3px' : '5px'}; }
          body.print-receipt.economy-50 .assinatura-line { margin: ${modo === 'compact' ? '3px 0' : '5px 0'}; }

          @media screen {
            /* Preview limpo antes de imprimir (não afeta a impressão) */
            body.print-receipt {
              background: #f2f2f2;
              padding: 16px;
            }
            body.print-receipt.paper-A4,
            body.print-receipt.paper-80mm,
            body.print-receipt.paper-58mm {
              background: #f2f2f2;
            }
          }

          
          .header {
            text-align: center;
            margin-bottom: ${modo === 'compact' ? '8px' : '12px'};
            padding-bottom: ${modo === 'compact' ? '4px' : '8px'};
          }

          .header-with-logo {
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .empresa-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto ${modo === 'compact' ? '4px' : '8px'};
            max-width: 100%;
          }

          .empresa-logo img {
            display: block;
            width: auto;
            height: auto;
            max-width: 100%;
            object-fit: contain;
            object-position: center;
            image-rendering: auto;
          }

          .empresa-header-main {
            width: 100%;
            min-width: 0;
          }
          
          .empresa-nome {
            font-size: ${modo === 'compact' ? '14px' : '16px'};
            font-weight: bold;
            margin-bottom: ${modo === 'compact' ? '4px' : '6px'};
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .empresa-info-box {
            display: flex;
            justify-content: center;
            gap: ${modo === 'compact' ? '4px' : '8px'};
            margin: ${modo === 'compact' ? '2px 0' : '4px 0'};
            flex-wrap: wrap;
          }
          
          .info-box {
            border: 1px solid #000;
            padding: ${modo === 'compact' ? '2px 6px' : '4px 8px'};
            font-size: ${modo === 'compact' ? '9px' : '10px'};
            display: inline-block;
          }
          
          .empresa-endereco-box {
            border: 1px solid #000;
            padding: ${modo === 'compact' ? '2px 6px' : '4px 8px'};
            font-size: ${modo === 'compact' ? '9px' : '10px'};
            margin: ${modo === 'compact' ? '2px auto' : '4px auto'};
            display: inline-block;
            text-align: center;
          }
          

          .header.header-os {
            margin-bottom: 8px;
            padding-bottom: 0;
          }

          .header.header-os .empresa-logo {
            margin-bottom: ${modo === 'compact' ? '3px' : '5px'};
          }

          .header.header-os .empresa-nome {
            margin-bottom: 2px;
            letter-spacing: 0.4px;
          }

          .empresa-meta {
            display: flex;
            justify-content: center;
            gap: 10px;
            flex-wrap: wrap;
            font-size: ${modo === 'compact' ? '9px' : '10px'};
            line-height: 1.1;
          }

          .empresa-endereco {
            margin-top: 2px;
            font-size: ${modo === 'compact' ? '9px' : '10px'};
            line-height: 1.15;
          }

          .pagamento-inline {
            margin-top: ${modo === 'compact' ? '4px' : '6px'};
            font-size: ${modo === 'compact' ? '9px' : '10px'};
            font-weight: bold;
            text-transform: uppercase;
          }
          .empresa-slogan {
            font-size: ${modo === 'compact' ? '9px' : '10px'};
            margin-top: ${modo === 'compact' ? '4px' : '6px'};
            text-transform: uppercase;
          }
          
          .separator-thick {
            border-top: 2px solid #000;
            margin: ${modo === 'compact' ? '4px 0' : '8px 0'};
          }
          
          .separator-thin {
            border-top: 1px solid #000;
            margin: ${modo === 'compact' ? '3px 0' : '6px 0'};
          }
          
          .documento-titulo {
            text-align: center;
            font-size: ${modo === 'compact' ? '12px' : '14px'};
            font-weight: bold;
            margin: ${modo === 'compact' ? '4px 0' : '8px 0'};
            text-transform: uppercase;
          }
          
          .documento-subtitulo {
            text-align: center;
            font-size: ${modo === 'compact' ? '10px' : '12px'};
            font-weight: bold;
            margin: ${modo === 'compact' ? '2px 0 4px 0' : '4px 0 8px 0'};
            text-transform: uppercase;
          }
          
          * { box-sizing: border-box; }

          .page-avoid-break,
          .header,
          .info-section,
          .valor-section,
          .observacoes-section,
          .assinatura {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .text-block {
            display: block;
          }

          .text-block p {
            margin: 0 0 ${modo === 'compact' ? '4px' : '6px'} 0;
          }

          .text-block p:last-child {
            margin-bottom: 0;
          }

          .text-block--compact p {
            margin-bottom: ${modo === 'compact' ? '2px' : '4px'};
          }

          .info-section {
            margin: ${modo === 'compact' ? '4px 0' : '8px 0'};
          }

          .checklist {
            display: flex;
            flex-wrap: wrap;
            gap: ${modo === 'compact' ? '4px 10px' : '6px 12px'};
            margin-top: ${modo === 'compact' ? '2px' : '4px'};
          }

          .checklist-1col {
            flex-direction: column;
            gap: ${modo === 'compact' ? '3px' : '4px'};
          }

          .check-item {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            min-width: 32%;
            font-size: ${modo === 'compact' ? '9px' : '11px'};
            line-height: 1.4;
            white-space: nowrap;
          }

          /* Itens marcados mais visíveis — valor legal */
          .check-item[style*="font-weight:700"] {
            color: #000;
          }

          body.paper-80mm .check-item { min-width: 45%; font-size: ${modo === 'compact' ? '9px' : '11px'}; }
          body.paper-58mm .check-item { min-width: 100%; font-size: ${modo === 'compact' ? '8px' : '10px'}; }
          
          .info-line {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: ${modo === 'compact' ? '4px' : '8px'};
            margin: ${modo === 'compact' ? '2px 0' : '3px 0'};
            font-size: ${modo === 'compact' ? '10px' : '11px'};
          }
          
          .info-label {
            flex: 0 0 auto;
            font-weight: bold;
            min-width: ${modo === 'compact' ? '80px' : '90px'};
            text-transform: uppercase;
            font-size: ${modo === 'compact' ? '10px' : '11px'};
            text-align: left;
          }
          
          .info-value {
            flex: 1;
            min-width: 0;
            text-align: left;
            font-size: ${modo === 'compact' ? '10px' : '11px'};
            margin-left: 0;
            white-space: pre-wrap;
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          
          .info-full {
            margin: ${modo === 'compact' ? '2px 0' : '4px 0'};
            font-size: ${modo === 'compact' ? '10px' : '11px'};
          }
          
          .info-full-label {
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: ${modo === 'compact' ? '1px' : '2px'};
            font-size: ${modo === 'compact' ? '10px' : '11px'};
          }
          
          .info-full-value {
            font-size: ${modo === 'compact' ? '10px' : '11px'};
            margin-left: 0;
            white-space: pre-wrap;
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          
          .valor-section {
            margin: ${modo === 'compact' ? '6px 0' : '12px 0'};
            text-align: left;
            padding: ${modo === 'compact' ? '4px 0' : '8px 0'};
          }
          
          .valor-label {
            font-weight: bold;
            font-size: ${modo === 'compact' ? '10px' : '11px'};
            margin-bottom: ${modo === 'compact' ? '2px' : '4px'};
            text-transform: uppercase;
          }
          
          .valor-container {
            display: flex;
            align-items: baseline;
            margin: ${modo === 'compact' ? '3px 0' : '6px 0'};
            gap: 4px;
          }
          
          .valor-simbolo {
            font-size: ${modo === 'compact' ? '10px' : '12px'};
            font-weight: bold;
          }
          
          .valor-principal {
            font-size: ${modo === 'compact' ? '18px' : '22px'};
            font-weight: bold;
            line-height: 1.2;
          }
          
          .valor-item {
            margin: ${modo === 'compact' ? '2px 0' : '4px 0'};
            font-size: ${modo === 'compact' ? '10px' : '11px'};
          }
          
          .valor-total {
            margin-top: ${modo === 'compact' ? '4px' : '8px'};
            font-size: ${modo === 'compact' ? '12px' : '14px'};
            font-weight: bold;
            border-top: 1px solid #000;
            padding-top: ${modo === 'compact' ? '2px' : '4px'};
          }
          
          .pagamento-info {
            margin-top: ${modo === 'compact' ? '4px' : '8px'};
            display: flex;
            flex-direction: row;
            gap: ${modo === 'compact' ? '4px' : '8px'};
            justify-content: flex-start;
            flex-wrap: wrap;
          }
          
          .pagamento-box {
            font-size: ${modo === 'compact' ? '9px' : '10px'};
            padding: ${modo === 'compact' ? '2px 6px' : '4px 8px'};
            border: 1px solid #000;
            display: inline-block;
          }
          
          .observacoes-section {
            margin: ${modo === 'compact' ? '6px 0' : '12px 0'};
            font-size: ${modo === 'compact' ? '9px' : '10px'};
          }

          /* Termos de garantia: mais compacto e legível */
          .termos-garantia-section {
            margin: ${modo === 'compact' ? '4px 0' : '8px 0'};
          }
          .termos-garantia-section .observacoes-label {
            margin-bottom: ${modo === 'compact' ? '2px' : '4px'};
          }
          .termos-garantia-section .observacoes-text {
            font-size: ${modo === 'compact' ? '8px' : '9px'};
            line-height: ${modo === 'compact' ? '1.15' : '1.25'};
            text-align: left;
          }
          
          .observacoes-label {
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: ${modo === 'compact' ? '2px' : '4px'};
            font-size: ${modo === 'compact' ? '9px' : '10px'};
          }
          
          .observacoes-text {
            font-size: ${modo === 'compact' ? '9px' : '10px'};
            line-height: ${modo === 'compact' ? '1.2' : '1.34'};
            text-align: left;
            word-break: break-word;
            overflow-wrap: anywhere;
            white-space: normal;
          }
          
          .assinatura {
            margin-top: ${modo === 'compact' ? '12px' : '20px'};
            padding-top: ${modo === 'compact' ? '4px' : '8px'};
            text-align: center;
            font-size: ${modo === 'compact' ? '10px' : '11px'};
          }
          
          .assinatura-line {
            border-top: 1px dashed #000;
            margin: ${modo === 'compact' ? '4px 0' : '8px 0'};
          }
          
          .assinatura-nome {
            font-weight: bold;
            margin-top: ${modo === 'compact' ? '4px' : '8px'};
            text-align: center;
          }
          
          /* Layout por tamanho de papel (Configurações > Impressora) */
          body.paper-80mm {
            width: 80mm;
            max-width: 80mm;
            padding: 3px 4px;
            margin: 0;
            min-height: auto;
            height: auto;
            overflow: visible;
            background: #fff;
            color: #000;
            font-family: "Courier New", "Lucida Console", monospace;
            line-height: 1.18;
          }
          body.paper-58mm {
            width: 58mm;
            max-width: 58mm;
            padding: 2px 3px;
            margin: 0;
            font-size: 9px;
            min-height: auto;
            height: auto;
            overflow: visible;
            background: #fff;
            color: #000;
            font-family: "Courier New", "Lucida Console", monospace;
            line-height: 1.14;
          }
          body.paper-80mm *,
          body.paper-58mm * {
            color: #000 !important;
            background: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
            filter: none !important;
          }
          body.paper-80mm .header,
          body.paper-58mm .header {
            margin-bottom: 5px;
            padding-bottom: 2px;
          }
          body.paper-80mm .empresa-nome,
          body.paper-58mm .empresa-nome {
            font-size: 12px;
            letter-spacing: 0.2px;
            margin-bottom: 2px;
          }
          body.paper-80mm .empresa-meta,
          body.paper-58mm .empresa-meta,
          body.paper-80mm .empresa-endereco,
          body.paper-58mm .empresa-endereco,
          body.paper-80mm .empresa-slogan,
          body.paper-58mm .empresa-slogan {
            font-size: 8px;
            line-height: 1.15;
          }
          body.paper-80mm .empresa-info-box,
          body.paper-58mm .empresa-info-box,
          body.paper-80mm .pagamento-info,
          body.paper-58mm .pagamento-info {
            gap: 3px;
          }
          body.paper-80mm .info-box,
          body.paper-58mm .info-box,
          body.paper-80mm .empresa-endereco-box,
          body.paper-58mm .empresa-endereco-box,
          body.paper-80mm .pagamento-box,
          body.paper-58mm .pagamento-box {
            border: 0;
            padding: 0;
            margin: 0;
            font-size: 8px;
          }
          body.paper-80mm .separator-thick,
          body.paper-80mm .separator-thin,
          body.paper-58mm .separator-thick,
          body.paper-58mm .separator-thin {
            border-top-width: 1px;
            margin: 3px 0;
          }
          body.paper-80mm .documento-titulo,
          body.paper-58mm .documento-titulo {
            font-size: 11px;
            margin: 3px 0;
          }
          body.paper-80mm .documento-subtitulo,
          body.paper-58mm .documento-subtitulo {
            font-size: 9px;
            margin: 1px 0 3px 0;
          }
          body.paper-80mm .info-section,
          body.paper-58mm .info-section,
          body.paper-80mm .observacoes-section,
          body.paper-58mm .observacoes-section,
          body.paper-80mm .valor-section,
          body.paper-58mm .valor-section {
            margin: 3px 0;
            padding: 0;
          }
          body.paper-80mm .info-line,
          body.paper-58mm .info-line,
          body.paper-80mm .valor-item,
          body.paper-58mm .valor-item {
            font-size: 8px;
            margin: 1px 0;
            gap: 3px;
          }
          body.paper-80mm .info-label,
          body.paper-58mm .info-label,
          body.paper-80mm .info-value,
          body.paper-58mm .info-value,
          body.paper-80mm .info-full-label,
          body.paper-58mm .info-full-label,
          body.paper-80mm .info-full-value,
          body.paper-58mm .info-full-value,
          body.paper-80mm .observacoes-label,
          body.paper-58mm .observacoes-label,
          body.paper-80mm .observacoes-text,
          body.paper-58mm .observacoes-text {
            font-size: 8px;
            line-height: 1.16;
          }
          body.paper-80mm .info-label,
          body.paper-58mm .info-label {
            min-width: 58px;
          }
          body.paper-80mm .valor-label,
          body.paper-58mm .valor-label,
          body.paper-80mm .valor-simbolo,
          body.paper-58mm .valor-simbolo {
            font-size: 9px;
          }
          body.paper-80mm .valor-principal,
          body.paper-58mm .valor-principal {
            font-size: 15px;
            line-height: 1.05;
          }
          body.paper-80mm .assinatura,
          body.paper-58mm .assinatura {
            margin-top: 8px;
            padding-top: 2px;
            font-size: 8px;
          }
          body.paper-80mm .assinatura-line,
          body.paper-58mm .assinatura-line {
            margin: 3px 0;
          }
          /* Em papel tÃ©rmico, permitir quebra de linha (evita cortar texto) */
          body.paper-80mm .check-item,
          body.paper-58mm .check-item {
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          body.paper-58mm .empresa-nome { font-size: 11px; margin-bottom: 2px; }
          body.paper-58mm .empresa-logo img { max-width: 34mm; max-height: 16mm; }
          body.paper-58mm .empresa-info-box { gap: 2px; }
          body.paper-58mm .empresa-meta { gap: 4px; font-size: 8px; }
          body.paper-58mm .empresa-endereco { font-size: 8px; }
          body.paper-58mm .info-box,
          body.paper-58mm .empresa-endereco-box,
          body.paper-58mm .empresa-slogan { font-size: 8px; padding: 0; }
          body.paper-58mm .empresa-endereco-box { max-width: 100%; word-break: break-word; overflow-wrap: break-word; }
          body.paper-58mm .separator-thick { margin: 2px 0; }
          body.paper-58mm .separator-thin { margin: 2px 0; }
          body.paper-58mm .documento-titulo { font-size: 10px; margin: 2px 0; }
          body.paper-58mm .documento-subtitulo { font-size: 8px; margin: 1px 0 2px 0; }
          body.paper-58mm .info-section { margin: 2px 0; }
          body.paper-58mm .info-line { font-size: 8px; margin: 1px 0; }
          body.paper-58mm .info-label,
          body.paper-58mm .info-value,
          body.paper-58mm .info-full-label,
          body.paper-58mm .info-full-value { font-size: 8px; }
          body.paper-58mm .info-label { min-width: 52px; }
          body.paper-58mm .valor-section { margin: 3px 0; padding: 0; }
          body.paper-58mm .valor-label { font-size: 8px; }
          body.paper-58mm .valor-principal { font-size: 14px; }
          body.paper-58mm .valor-simbolo { font-size: 8px; }
          body.paper-58mm .pagamento-box { font-size: 8px; padding: 0; }
          body.paper-58mm .observacoes-section,
          body.paper-58mm .observacoes-label,
          body.paper-58mm .observacoes-text { font-size: 8px; }
          body.paper-58mm .observacoes-text,
          body.paper-80mm .observacoes-text,
          body.paper-58mm .info-full-value,
          body.paper-80mm .info-full-value { text-align: left; }
          body.paper-58mm .assinatura { margin-top: 7px; font-size: 8px; }
          body.paper-58mm .assinatura-nome { font-size: 8px; }
          body.paper-58mm .header { margin-bottom: 4px; padding-bottom: 2px; }
          body.paper-80mm .empresa-logo img { max-width: 48mm; max-height: 22mm; }
          body.paper-A4 {
            width: 100%;
            max-width: 190mm;
            padding: ${modo === 'compact' ? '10px' : '12px'};
            font-size: ${modo === 'compact' ? '12px' : '14px'};
            margin: 0 auto;
          }
          body.paper-A4 .empresa-logo img { max-width: 42mm; max-height: 24mm; }
          body.paper-A4 .empresa-nome { font-size: 18px; }
          body.paper-A4 .documento-titulo { font-size: 16px; }
          body.paper-A4 .documento-subtitulo { font-size: 14px; }
          body.paper-A4 .info-line,
          body.paper-A4 .info-label,
          body.paper-A4 .info-value,
          body.paper-A4 .info-full-label,
          body.paper-A4 .info-full-value { font-size: 12px; }
          body.paper-A4 .valor-label { font-size: 12px; }
          body.paper-A4 .valor-principal { font-size: 26px; }
          body.paper-A4 .valor-simbolo { font-size: 14px; }
          body.paper-A4 .pagamento-box,
          body.paper-A4 .observacoes-text { font-size: 11px; }
          body.paper-A4 .header { margin-bottom: 12px; }
          body.paper-A4 .info-section { margin: 10px 0; }
          body.paper-A4 .observacoes-section,
          body.paper-A4 .termos-compra-section,
          body.paper-A4 .termos-garantia-section {
            padding: 4px 0;
          }
          body.paper-A4 .assinatura {
            margin-top: 24px;
            padding-top: 10px;
          }
          body.paper-A4 .assinatura-line {
            max-width: 96mm;
            margin: 10px auto 8px;
          }
          body.paper-A4 .empresa-endereco-box,
          body.paper-A4 .empresa-slogan,
          body.paper-A4 .info-value,
          body.paper-A4 .info-full-value,
          body.paper-A4 .observacoes-text,
          body.paper-A4 .pagamento-box {
            word-break: normal;
            overflow-wrap: anywhere;
            hyphens: auto;
          }
          body.paper-A4 .observacoes-text {
            text-align: justify;
          }
          body.paper-A4 .info-line { align-items: flex-start; }
        </style>
      </head>
        <body class="print-receipt paper-${papel}${isEconomy50 ? ' economy-50' : ''}" data-print-scale="${scale}">
          ${comprovanteLayoutHTML != null ? comprovanteLayoutHTML : `
        <div class="header${empresa.logo_url ? ' header-with-logo' : ''}">
          ${companyLogoHtml}
          <div class="empresa-header-main">
            <div class="empresa-nome">${t(empresa.nome)}</div>
            <div class="empresa-info-box">
              ${empresa.cnpj ? `<div class="info-box">CNPJ: ${empresa.cnpj}</div>` : ''}
              ${empresa.telefone ? `<div class="info-box">TEL: ${empresa.telefone}</div>` : ''}
            </div>
            ${enderecoCompleto ? `<div class="empresa-endereco-box">${t(enderecoCompleto)}</div>` : ''}
            ${empresa.slogan ? `<div class="empresa-slogan">${t(empresa.slogan)}</div>` : ''}
          </div>
        </div>
        <div class="separator-thick"></div>
        <div class="documento-titulo">${tituloDocumento}</div>
        ${subtituloDocumento ? `<div class="documento-subtitulo">${subtituloDocumento}</div>` : ''}
        <div class="separator-thick"></div>
        <div class="info-section">
          ${data.clienteNome ? `<div class="info-line"><span class="info-label">CLIENTE:</span><span class="info-value">${t(data.clienteNome)}</span></div>` : ''}
          ${data.clienteTelefone ? `<div class="info-line"><span class="info-label">TELEFONE:</span><span class="info-value">${t(data.clienteTelefone)}</span></div>` : ''}
          ${data.cpfCnpj ? `<div class="info-line"><span class="info-label">CPF/CNPJ:</span><span class="info-value">${t(data.cpfCnpj)}</span></div>` : ''}
          ${data.clienteEndereco ? `<div class="info-line"><span class="info-label">ENDEREÇO:</span><span class="info-value">${t(data.clienteEndereco)}</span></div>` : ''}
          ${data.equipamento ? `<div class="info-line"><span class="info-label">EQUIPAMENTO:</span><span class="info-value">${t(data.equipamento)}</span></div>` : ''}
          ${data.marca ? `<div class="info-line"><span class="info-label">MARCA:</span><span class="info-value">${t(data.marca)}</span></div>` : ''}
          ${data.modelo ? `<div class="info-line"><span class="info-label">MODELO:</span><span class="info-value">${t(data.modelo)}</span></div>` : ''}
          ${data.cor ? `<div class="info-line"><span class="info-label">COR:</span><span class="info-value">${t(data.cor)}</span></div>` : ''}
          ${data.garantia ? `<div class="info-line"><span class="info-label">GARANTIA:</span><span class="info-value">${t(data.garantia)}</span></div>` : ''}
          ${data.data ? `<div class="info-line"><span class="info-label">ENTRADA:</span><span class="info-value">${dataFormatada} ${horaFormatada}</span></div>` : ''}
        </div>
        ${buildAccessoriesChecklistHTML(data.acessorios, papel, modo)}
        <div class="separator-thin"></div>
        ${data.defeito ? `<div class="info-section"><div class="info-full"><div class="info-full-label">DEFEITO RELATADO:</div><div class="info-full-value">${renderTextBlock(data.defeito, { compactParagraphs: true })}</div></div></div>` : ''}
        ${data.reparo ? `<div class="info-section"><div class="info-full"><div class="info-full-label">REPARO TÉCNICO:</div><div class="info-full-value">${renderTextBlock(data.reparo, { compactParagraphs: true })}</div></div></div>` : ''}
        ${data.situacao ? `<div class="info-section"><div class="info-line"><span class="info-label">SITUAÇÃO:</span><span class="info-value">${t(data.situacao)}</span></div></div>` : ''}
        ${data.tecnico ? `<div class="info-section"><div class="info-line"><span class="info-label">TÉCNICO:</span><span class="info-value">${t(data.tecnico)}</span></div></div>` : ''}
        ${(data.tipo === 'checklist' && data.senhaCliente) ? `<div class="info-section"><div class="info-line"><span class="info-label">SENHA DO CLIENTE:</span><span class="info-value">${t(data.senhaCliente)}</span></div></div>` : ''}
        ${data.dataPrevisao ? `<div class="info-section"><div class="info-line"><span class="info-label">PREVISÃO DE ENTREGA:</span><span class="info-value">${formatDateTime(data.dataPrevisao).data}</span></div></div>` : ''}
        ${data.dataConclusao ? `<div class="info-section"><div class="info-line"><span class="info-label">DATA DE CONCLUSÃO:</span><span class="info-value">${formatDateTime(data.dataConclusao).data}</span></div></div>` : ''}
        ${data.laudoTecnico ? `<div class="separator-thin"></div><div class="info-section"><div class="info-full"><div class="info-full-label">LAUDO TÉCNICO:</div><div class="info-full-value">${renderTextBlock(data.laudoTecnico)}</div></div></div>` : ''}
        <div class="separator-thin"></div>
        ${itensHTML}
        ${valoresHTML}
        ${termosCompraLimpo ? `<div class="separator-thin"></div><div class="observacoes-section termos-compra-section"><div class="observacoes-label">TERMOS DE COMPRA</div><div class="observacoes-text">${renderTextBlock(termosCompraLimpo)}</div></div>` : ''}
        ${termosGarantiaLimpo ? `<div class="separator-thin"></div><div class="observacoes-section termos-garantia-section"><div class="observacoes-label">TERMOS DE GARANTIA</div><div class="observacoes-text">${renderTextBlock(termosGarantiaLimpo)}</div></div>` : ''}
        ${data.observacoes ? `<div class="separator-thin"></div><div class="observacoes-section"><div class="observacoes-label">OBSERVAÇÕES</div><div class="observacoes-text">${renderTextBlock(data.observacoes, { compactParagraphs: true })}</div></div>` : ''}
        ${data.clienteNome ? `<div class="assinatura"><div class="assinatura-line"></div><div class="assinatura-nome">${t(data.clienteNome)}</div></div>` : ''}
        `}
      </body>
    </html>
  `;
}


/**
 * Wrapper: generate template with options without positional args.
 * Allows choosing paper/mode per print (without changing global settings).
 */
export function generatePrintTemplateWithOptions(
  data: PrintData,
  options?: { empresa?: EmpresaInfo; paperSize?: TamanhoPapel; printMode?: PrintMode }
): string {
  const empresa = options?.empresa ?? DEFAULT_EMPRESA;
  return generatePrintTemplate(data, empresa, options?.paperSize, options?.printMode);
}

// Desktop/Tauri: aplica micro-ajustes (mm) e escala do perfil de impressão (calibração)
// para térmica (58/80mm). Isso ajuda a reduzir a diferença dev/prod e variações de driver.
function injectDesktopThermalProfile(html: string): string {
  if (!isDesktopApp()) return html;
  if (!html || typeof html !== 'string') return html;
  if (!/paper-(58mm|80mm)/i.test(html)) return html;
  if (html.includes('st-print-root')) return html;

  try {
    const p = loadPrintProfile();
    if (!p) return html;
    const left = Number(p.offsetLeftMm ?? 0) || 0;
    const top = Number(p.offsetTopMm ?? 0) || 0;
    const scale = Number(p.scale ?? 1) || 1;
    const hasAdj = Math.abs(left) > 0.001 || Math.abs(top) > 0.001 || Math.abs(scale - 1) > 0.001;
    if (!hasAdj) return html;

    const style = `\n<style id="st-print-profile">\n#st-print-root{\n  display:block;\n  transform: translate(${left}mm, ${top}mm) scale(${scale});\n  transform-origin: top left;\n}\n</style>\n`;

    let out = html;
    // inserir estilo antes do </head>
    out = out.replace(/<\/head>/i, `${style}</head>`);
    // abrir wrapper logo após <body ...>
    out = out.replace(/<body([^>]*)>/i, `<body$1><div id="st-print-root">`);
    // fechar wrapper antes de </body>
    out = out.replace(/<\/body>/i, `</div></body>`);
    return out;
  } catch {
    return html;
  }
}


/**
 * Imprime um documento do PDV usando o melhor motor disponível:
 * - Desktop + térmica (58/80mm) => ESC/POS raw nativo (silencioso, monocromático e consistente)
 * - Caso contrário => HTML (fluxo atual)
 *
 * Observação: mantém compatibilidade total com o printTemplate() existente.
 */
async function resolveEscposPrinterName(explicitPrinterName?: string): Promise<string | undefined> {
  const explicit = (explicitPrinterName ?? '').trim();
  if (explicit) return explicit;

  // Try Windows default (via listPrinters).
  try {
    const ps = await listPrinters();
    const def = ps.find(p => p.is_default)?.name?.trim();
    if (def) return def;

    // If there is only one printer installed, use it as a safe best-effort.
    if (ps.length === 1 && ps[0]?.name) return ps[0].name;
  } catch {
    // ignore, handled by caller
  }

  return undefined;
}

export function printDocument(
  data: PrintData,
  options?: { empresa?: EmpresaInfo; paperSize?: TamanhoPapel; printMode?: PrintMode; copies?: number }
): void {
  let empresa = options?.empresa ?? DEFAULT_EMPRESA;
  const profile = loadPrintProfile();

  // Em ESC/POS (desktop/térmica), também precisa carregar os dados salvos da empresa (cache),
  // senão o topo sai vazio mesmo com empresa cadastrada no sistema.
  const cachedCompany = safeGet<Partial<EmpresaInfo>>(COMPANY_CACHE_KEY, null);
  if (cachedCompany?.success && cachedCompany.data) {
    empresa = { ...empresa, ...cachedCompany.data };
  }

  const defaultDesktopThermalPaper = (profile?.preset === '58mm' || profile?.preset === '80mm')
    ? profile.preset
    : '80mm';

  const papel: TamanhoPapel = options?.paperSize
    ?? (isDesktopApp() ? defaultDesktopThermalPaper : getPaperSize());
  const modo: PrintMode = options?.printMode ?? getPrintMode();

  const isThermal = papel === '58mm' || papel === '80mm';
  const preset = papel === '58mm' ? '58mm' : '80mm';

  if (!isDesktopApp() && isThermal) {
    alert(
      'Impressão térmica 58mm/80mm no navegador não é suportada com qualidade.\n\n' +
      'Use "Abrir no app" para imprimir em modo silencioso RAW ESC/POS.'
    );
    return;
  }

  const shouldUseEscposThermal =
    isDesktopApp() &&
    isThermal;

  // ✅ Térmica no desktop sempre usa RAW ESC/POS silencioso e monocromático.
  // Isso evita preview torto, diálogo do navegador e inconsistências de layout.
  if (shouldUseEscposThermal) {
    void (async () => {
      const bytes = buildEscposReceiptFromPrintData(data, empresa, preset, modo);
      const jobName = `Smart Tech PDV - ${data.tipo} ${data.numero || ''}`.trim();
      const copies = options?.copies ?? 1;

      const printerName = await resolveEscposPrinterName(profile?.printerName);
      if (!printerName) {
        throw new Error(
          'Nenhuma impressora configurada. Vá em Configurações → Impressora e selecione uma impressora (ou defina uma impressora padrão no Windows).'
        );
      }

      await escposPrintRaw(bytes, {
        jobName,
        printerName,
        copies,
      });
    })().catch((err) => {
      console.error('[Print] Erro ao imprimir documento (ESC/POS):', err);
      alert((err as any)?.message ?? String(err));
    });

    return;
  }

  // ✅ HTML (A4 e fallback térmica): chamar SINCRONO a partir do clique do usuário
  // para preservar o "user gesture" e forçar o diálogo do Windows quando necessário.
  try {
    const template = generatePrintTemplateWithOptions(data, { empresa, paperSize: papel, printMode: modo });
    printTemplate(template, { forceDialog: isDesktopApp() && papel === 'A4' });
  } catch (err) {
    console.error('[Print] Erro ao imprimir documento (HTML):', err);
    alert((err as any)?.message ?? String(err));
  }
}

/**
 * Abre janela de impressão com o template
 * @throws Error se falhar ao abrir janela ou imprimir
 */

function printA4InPlace(finalTemplate: string, options?: { retryIfBlocked?: boolean }): void {
  const overlayId = 'st-a4-print-overlay';
  const styleId = 'st-a4-print-style';

  // Remove any previous leftovers (in case of crash/refresh)
  try { document.getElementById(overlayId)?.remove(); } catch { /* ignore */ }
  try { document.getElementById(styleId)?.remove(); } catch { /* ignore */ }

  const bodyMatch = finalTemplate.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyInner = bodyMatch?.[1] ?? finalTemplate;

  const bodyClassMatch = finalTemplate.match(/<body[^>]*class="([^"]*)"/i);
  const bodyClasses = bodyClassMatch?.[1] ?? '';

  const styleMatches = Array.from(finalTemplate.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi));
  const styles = styleMatches.map((m) => m[1]).join('\n');

  const prevBodyClassName = document.body.className;

  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = `${styles}

@media print {
  body > *:not(#${overlayId}) { display: none !important; }
  #${overlayId} { display: block !important; }
}

@media screen {
  #${overlayId} { padding: 16px; background: #fff; }
}
`;
  document.head.appendChild(styleEl);

  const overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '2147483647';
  overlay.style.background = '#fff';
  overlay.style.overflow = 'auto';
  overlay.innerHTML = bodyInner;
  document.body.appendChild(overlay);

  for (const cls of bodyClasses.split(/\s+/).filter(Boolean)) {
    document.body.classList.add(cls);
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try { overlay.remove(); } catch { /* ignore */ }
    try { styleEl.remove(); } catch { /* ignore */ }
    try { document.body.className = prevBodyClassName; } catch { /* ignore */ }
  };

  window.addEventListener('afterprint', cleanup, { once: true });
  // fallback: garante limpeza mesmo se afterprint não disparar no WebView
  setTimeout(cleanup, 10000);

    // força layout antes do print (sem perder o clique do usuário)
  try {
    // acessar offsetHeight força reflow
    void overlay.offsetHeight;
  } catch { /* ignore */ }

  let triedAgain = false;
  const tryPrint = () => {
    try {
      window.focus();
    } catch { /* ignore */ }
    try {
      window.print();
    } catch (err) {
      // se falhar, deixa o fallback (iframe) do caller tentar
      throw err;
    }
  };

  // 1) tenta imediatamente (preserva user gesture)
  tryPrint();

  // 2) fallback opcional: se afterprint não disparar, tenta uma única vez depois.
  if (options?.retryIfBlocked) {
    setTimeout(() => {
      if (cleaned || triedAgain) return;
      triedAgain = true;
      try {
        tryPrint();
      } catch {
        // ignore
      }
    }, 1200);
  }
}

export function printTemplate(template: string, options?: { forceDialog?: boolean }): void {
  try {
    // Validar template não vazio
    if (!template || template.trim().length === 0) {
      throw new Error('Template de impressão está vazio');
    }

    // ✅ Ajuste fino (desktop/térmica): offsets/escala por perfil (calibração)
    const finalTemplate = injectDesktopThermalProfile(template);

        // ✅ Desktop A4: em alguns ambientes (WebView2) a impressão via iframe oculto pode falhar
    // ou NÃO abrir o diálogo do Windows quando a chamada perde o "user gesture".
    // Para A4, preferimos impressão "in-place" no documento principal e chamamos print() imediatamente.
    const isA4 = /paper-A4/i.test(finalTemplate) || /size:\s*A4/i.test(finalTemplate);
    const forceDialog = Boolean(options?.forceDialog);

    if (isDesktopApp() && (forceDialog || isA4)) {
      try {
        printA4InPlace(finalTemplate, { retryIfBlocked: true });
        return;
      } catch (err) {
        console.warn('[Print] Falha no modo A4 in-place, tentando fallback...', err);
        // continua para o fallback via iframe
      }
    }


        // Em Tauri/WebView, window.open pode ser bloqueado (pop-up). Primeiro tenta o fluxo
        // padrão; se falhar, cai para impressão via iframe invisível (sem pop-up).
        const janelaImpressao = isDesktopApp() ? null : openPrintPreviewWindow();
    
        const waitForDocumentImages = async (doc: Document | null | undefined) => {
          if (!doc) return;
          const images = Array.from(doc.images ?? []);
          if (images.length === 0) return;

          await Promise.all(
            images.map((img) => {
              if (img.complete && img.naturalWidth > 0) return Promise.resolve();
              return new Promise<void>((resolve) => {
                const done = () => resolve();
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
                setTimeout(done, 1500);
              });
            })
          );
        };

        if (janelaImpressao) {
          // Tentar escrever o template
          try {
            janelaImpressao.document.write(finalTemplate);
            janelaImpressao.document.close();
            janelaImpressao.focus();
          } catch (err: any) {
            janelaImpressao.close(); // Fechar janela se falhar
            throw new Error(`Erro ao preparar impressão: ${err.message}`);
          }
    
          // Tentar imprimir
          setTimeout(() => {
            void (async () => {
              try {
                await waitForDocumentImages(janelaImpressao.document);
                janelaImpressao.print();
              } catch (err: any) {
                console.error('[Print] Erro ao chamar print():', err);
                alert(`Erro ao iniciar impressão: ${err.message}`);
              }
            })();
          }, 250);
          return;
        }
    
        // ✅ Fallback (Tauri-friendly): imprime via iframe oculto
        // - não depende de pop-up
        // - funciona em navegador e no WebView
        try {
          const iframe = document.createElement('iframe');
          iframe.setAttribute('aria-hidden', 'true');
          iframe.style.position = 'fixed';
          // IMPORTANTE (WebView2/Edge): iframe com 0x0 pode não renderizar/layout antes do print,
          // resultando em impressão "sem CSS"/poluída. Mantemos 1x1px fora da tela.
          iframe.style.left = '-9999px';
          iframe.style.top = '0';
          iframe.style.width = '1px';
          iframe.style.height = '1px';
          iframe.style.border = '0';
          iframe.style.opacity = '0';
          iframe.style.pointerEvents = 'none';
    
          document.body.appendChild(iframe);
    
          // Evitar disparos duplicados (onload + timer)
          let printed = false;
          const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
          const waitFrames = async (count: number) => {
            const raf = (iframe.contentWindow?.requestAnimationFrame ?? window.requestAnimationFrame).bind(
              iframe.contentWindow ?? window
            );
            for (let i = 0; i < count; i++) {
              await new Promise<void>((r) => raf(() => r()));
            }
          };

          const doPrint = async () => {
            if (printed) return;
            printed = true;

            try {
              const doc = iframe.contentDocument || iframe.contentWindow?.document;

              // Aguardar o documento ficar pronto (WebView2 pode precisar de um pouco mais)
              if (doc) {
                for (let i = 0; i < 40 && doc.readyState !== 'complete'; i++) {
                  await wait(50);
                }

                // Aguardar carregamento de fontes (quando disponível) para evitar layout sujo
                const fonts = (doc as any).fonts;
              if (fonts?.ready) {
                try {
                  await fonts.ready;
                } catch {
                  // ignore
                }
              }

              await waitForDocumentImages(doc);
            }

            // Garantir ao menos 2 frames de layout antes do print
              await waitFrames(2);

              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
            } catch (err: any) {
              console.error('[Print] Erro ao imprimir via iframe:', err);
              alert(`Erro ao iniciar impressão: ${err?.message ?? String(err)}`);
            } finally {
              // remove depois de disparar o print (evita acumular iframes)
              setTimeout(() => iframe.remove(), 1500);
            }
          };
    
          // Preferir srcdoc quando disponível.
          // IMPORTANTE: não misturar srcdoc + doc.write (pode gerar corrida em WebView2).
          let usedSrcdoc = false;
          try {
            (iframe as any).srcdoc = finalTemplate;
            usedSrcdoc = true;
          } catch {
            usedSrcdoc = false;
          }

          if (!usedSrcdoc) {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc) {
              doc.open();
              doc.write(finalTemplate);
              doc.close();
            }
          }
    
          // onload nem sempre dispara em WebView; timer garante.
          iframe.onload = () => void doPrint();
          setTimeout(() => void doPrint(), 700);
        } catch (err: any) {
          throw new Error(`Não foi possível iniciar impressão (modo desktop). ${err?.message ?? String(err)}`);
        }
    } catch (err: any) {
    console.error('[Print] Erro na impressão:', err);
    alert(err.message || 'Erro ao imprimir documento');
    throw err; // Re-throw para quem chamou tratar
  }
}
