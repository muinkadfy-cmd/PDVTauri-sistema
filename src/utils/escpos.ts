import { escposPrintRawNative } from '@/lib/capabilities/native-print-adapter';
import type { EmpresaInfo, PrintData, PrintMode } from "@/lib/print-template";

export type EscposPreset = "58mm" | "80mm";

export interface EscposPrintOptions {
  /** Optional job name (helps identify in spooler). */
  jobName?: string;
  /** Optional printer name. If omitted, uses OS default printer (Windows). */
  printerName?: string;
  /** Copies. Defaults to 1. */
  copies?: number;
}

/**
 * Convert Uint8Array -> base64 (safe for large arrays).
 */
export function uint8ToBase64(data: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) {
    binary += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Sends RAW ESC/POS bytes to the Windows spooler via Tauri (silent/kiosk).
 * Requires Rust command: `escpos_print_raw`.
 */
export async function escposPrintRaw(data: Uint8Array, opts: EscposPrintOptions = {}) {
  const { jobName, printerName, copies = 1 } = opts;
  const dataBase64 = uint8ToBase64(data);

  await escposPrintRawNative({
    jobName,
    printerName,
    copies,
    dataBase64
  });
}

// ------------------------------
// ESC/POS receipt builder (text)
// ------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function normalizeText(input: unknown): string {
  const s = String(input ?? "").trim();
  if (!s) return "";
  // Remove accents to avoid codepage issues across different printers.
  // Keeps output consistent even when printer isn't configured for UTF-8.
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    // Remove emojis / non-ASCII to avoid printer garbling
    .replace(/[^\x20-\x7E]/g, "");
}

function repeat(ch: string, n: number) {
  return new Array(Math.max(0, n)).fill(ch).join("");
}

function wrapLine(text: string, width: number): string[] {
  const s = normalizeText(text);
  if (!s) return [""];
  const words = s.split(/\s+/g);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) {
      cur = w;
      continue;
    }
    if ((cur + " " + w).length <= width) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  // Hard-split very long tokens
  const out: string[] = [];
  for (const l of lines) {
    if (l.length <= width) out.push(l);
    else {
      for (let i = 0; i < l.length; i += width) out.push(l.slice(i, i + width));
    }
  }
  return out.length ? out : [""];
}

function bytesFromAscii(text: string) {
  // ASCII-safe bytes (because we normalize removing accents).
  const s = normalizeText(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function pushBytes(dst: number[], ...arr: ArrayLike<number>[]) {
  for (const a of arr) {
    for (let i = 0; i < a.length; i++) dst.push(a[i] as number);
  }
}

function lf(dst: number[], n = 1) {
  for (let i = 0; i < n; i++) dst.push(0x0a);
}

function escAlign(dst: number[], mode: 0 | 1 | 2) {
  dst.push(0x1b, 0x61, mode); // ESC a n
}

function escBold(dst: number[], on: boolean) {
  dst.push(0x1b, 0x45, on ? 1 : 0); // ESC E n
}

function escDoubleStrike(dst: number[], on: boolean) {
  // ESC G n
  dst.push(0x1b, 0x47, on ? 1 : 0);
}

function escLineSpacing(dst: number[], n: number) {
  // ESC 3 n (0-255)
  dst.push(0x1b, 0x33, Math.max(0, Math.min(255, n)));
}

function addText(dst: number[], text: string) {
  pushBytes(dst, bytesFromAscii(text));
}

function addWrapped(dst: number[], text: string, width: number) {
  const raw = String(text ?? "").replace(/\r\n?/g, "\n");
  const parts = raw.split("\n");
  for (const part of parts) {
    if (!part.trim()) {
      lf(dst, 1);
      continue;
    }
    const lines = wrapLine(part, width);
    for (const l of lines) {
      addText(dst, l);
      lf(dst, 1);
    }
  }
}

function addKeyValue(dst: number[], key: string, value: unknown, width: number) {
  const v = normalizeText(value);
  if (!v) return;
  const k = normalizeText(key);
  const prefix = `${k}: `;
  if ((prefix + v).length <= width) {
    addText(dst, prefix + v);
    lf(dst, 1);
    return;
  }
  // Key on same line, value wrapped below.
  addText(dst, prefix.trimEnd());
  lf(dst, 1);
  const lines = wrapLine(v, width);
  for (const l of lines) {
    addText(dst, l);
    lf(dst, 1);
  }
}


function separatorThin(dst: number[], width: number) {
  addText(dst, repeat("-", width));
  lf(dst, 1);
}

function separatorThick(dst: number[], width: number) {
  addText(dst, repeat("=", width));
  lf(dst, 1);
}

function addLeftRight(dst: number[], left: string, right: string, width: number, emph = false) {
  const l = normalizeText(left);
  const r = normalizeText(right);
  if (!l && !r) return;

  const lineFits = (l.length + 1 + r.length) <= width;
  if (!lineFits) {
    if (emph) { escBold(dst, true); escDoubleStrike(dst, true); }
    if (l) { addText(dst, l); lf(dst, 1); }
    if (emph) { escBold(dst, false); escDoubleStrike(dst, false); }
    if (r) { addText(dst, r); lf(dst, 1); }
    return;
  }

  const spaces = Math.max(1, width - l.length - r.length);
  const line = l + repeat(" ", spaces) + r;

  if (emph) { escBold(dst, true); escDoubleStrike(dst, true); }
  addText(dst, line);
  lf(dst, 1);
  if (emph) { escBold(dst, false); escDoubleStrike(dst, false); }
}

function addKeyValueEmph(dst: number[], key: string, value: unknown, width: number) {
  const v = normalizeText(value);
  if (!v) return;

  // Imprime a linha toda em destaque (melhor contraste em térmicas).
  escBold(dst, true);
  escDoubleStrike(dst, true);
  addKeyValue(dst, key, v, width);
  escBold(dst, false);
  escDoubleStrike(dst, false);
}

function formatPrintableDate(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("pt-BR");
  }
  return normalizeText(raw);
}

function addSectionText(dst: number[], title: string, value: unknown, width: number) {
  const raw = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!raw) return;
  escBold(dst, true);
  addText(dst, normalizeText(title));
  escBold(dst, false);
  lf(dst, 1);
  addWrapped(dst, raw, width);
}

function parsePatternPoints(raw: string): number[] {
  const s = normalizeText(raw);
  if (!s) return [];
  const nums = s
    .split(/[^0-9]+/g)
    .map((v) => parseInt(v, 10))
    .filter((n) => Number.isFinite(n));

  if (!nums.length) return [];

  const min = Math.min(...nums);
  const max = Math.max(...nums);

  // Accept 0..8
  if (min >= 0 && max <= 8) return nums;

  // Accept 1..9 and convert to 0..8
  if (min >= 1 && max <= 9) return nums.map((n) => n - 1);

  return [];
}

/**
 * Padrão do cliente (9 bolinhas) - forma mais legível para leigo:
 * - Mostra ordem dentro das bolinhas: (1) inicio ... (N) fim
 * - ASCII puro (compatível em praticamente todas ESC/POS).
 */
function addPatternOrderGrid(dst: number[], rawPattern: string, width: number) {
  const pts = parsePatternPoints(rawPattern);
  if (!pts.length) {
    addKeyValue(dst, "PADRAO", rawPattern, width);
    return;
  }

  const order: Array<string | null> = new Array(9).fill(null);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p >= 0 && p <= 8) order[p] = String(i + 1);
  }

  const start = 1;
  const end = pts.length;

  escBold(dst, true);
  addText(dst, "PADRAO (9 PONTOS):");
  lf(dst, 1);
  escBold(dst, false);

  addText(dst, `INICIO: ${start}   FIM: ${end}`);
  lf(dst, 1);

  const rows = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ];
  for (const row of rows) {
    const line = row
      .map((idx) => (order[idx] || " ").padStart(2, " "))
      .join("  ")
      .trimEnd();
    addText(dst, line);
    lf(dst, 1);
  }
}


/**
 * Build a thermal receipt (text) from your PrintData.
 * - Works best for 58/80mm.
 * - Uses ASCII-safe output (no accents) for maximum compatibility across printers.
 */
export function buildEscposReceiptFromPrintData(
  data: PrintData,
  empresa: EmpresaInfo,
  preset: EscposPreset,
  printMode: PrintMode = "compact",
): Uint8Array {
  const width = preset === "58mm" ? 32 : 48;
  const compact = printMode === "compact";

  const out: number[] = [];

  // Initialize
  out.push(0x1b, 0x40); // ESC @
  // Linha um pouco mais "alta" para não ficar tudo grudado
  escLineSpacing(out, compact ? 26 : 34);
  lf(out, 1); // respiro inicial (evita topo colado)

  // =========================
  // HEADER (EMPRESA)
  // =========================
  escAlign(out, 1);

  const nomeEmpresa = normalizeText(empresa?.nome) || "SMART TECH";
  escBold(out, true);
  escDoubleStrike(out, true);
  addWrapped(out, nomeEmpresa, width);
  escBold(out, false);
  escDoubleStrike(out, false);

  const tel = normalizeText(empresa?.telefone);
  const cnpj = normalizeText(empresa?.cnpj);
  const end = normalizeText(empresa?.endereco);
  const city = [empresa?.cidade, empresa?.estado].filter(Boolean).map(normalizeText).join(" - ");

  // Linha meta mais "responsiva": Tel + CNPJ na mesma linha quando possível
  if (tel && cnpj) {
    addWrapped(out, `Tel: ${tel}  CNPJ: ${cnpj}`, width);
  } else {
    if (tel) addWrapped(out, `Tel: ${tel}`, width);
    if (cnpj) addWrapped(out, `CNPJ: ${cnpj}`, width);
  }
  if (end) addWrapped(out, end, width);
  if (city) addWrapped(out, city, width);

  if (empresa?.slogan) addWrapped(out, empresa.slogan, width);

  escAlign(out, 0);
  separatorThin(out, width);

  // =========================
  // TITLE
  // =========================
  escAlign(out, 1);
  escBold(out, true);

  const tipoLabel =
    data.tipo === "ordem-servico" ? "O.S." :
    data.tipo === "recibo" ? "RECIBO" :
    data.tipo === "venda" ? "VENDA" :
    data.tipo === "checklist" ? "CHECKLIST" :
    "COMPROVANTE";

  const numero = normalizeText(data.numero || "");
  addWrapped(out, `${tipoLabel}: ${numero}`.trim(), width);

  if (data.tipo === "ordem-servico" || data.tipo === "recibo") {
    escBold(out, false);
    addWrapped(out, "COMPROVANTE DE RECEBIMENTO", width);
    escBold(out, true);
  }

  escBold(out, false);
  escAlign(out, 0);
  separatorThin(out, width);

  // =========================
  // DATE/TIME
  // =========================
  const dt = data.data ? new Date(String(data.data)) : new Date();
  const dtValid = !Number.isNaN(dt.getTime());
  const dataStr = dtValid ? dt.toLocaleDateString("pt-BR") : normalizeText(data.data);
  const horaStr = dtValid ? dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : normalizeText(data.hora);
  const dateTimeStr = `${dataStr} ${horaStr}`.trim();

  // OS costuma ser entendido como "ENTRADA" para o cliente
  if (data.tipo === "ordem-servico") addKeyValueEmph(out, "ENTRADA", dateTimeStr, width);
  else addKeyValueEmph(out, "DATA", dateTimeStr, width);

  separatorThin(out, width);

  // =========================
  // CLIENT
  // =========================
  addKeyValueEmph(out, "CLIENTE", data.clienteNome, width);
  addKeyValue(out, "TEL", data.clienteTelefone, width);
  addKeyValue(out, "CPF/CNPJ", data.cpfCnpj, width);
  addKeyValue(out, "END", data.clienteEndereco, width);

  separatorThin(out, width);

  // =========================
  // OS / CHECKLIST: DEVICE INFO
  // =========================
  const isOS = data.tipo === "ordem-servico";
  const isChecklist = data.tipo === "checklist";
  const isReceipt = data.tipo === "ordem-servico" || data.tipo === "recibo" || data.tipo === "comprovante";

  if (!isOS && !isChecklist && data.garantia) {
    addKeyValueEmph(out, "GARANTIA", data.garantia, width);
    separatorThin(out, width);
  }

  if (isOS || isChecklist) {
    addKeyValueEmph(out, "EQUIP", data.equipamento, width);
    addKeyValueEmph(out, "MARCA", data.marca, width);
    addKeyValueEmph(out, "MODELO", data.modelo, width);
    addKeyValueEmph(out, "COR", data.cor, width);
  }

  if (isOS) {
    addKeyValueEmph(out, "GARANTIA", data.garantia, width);
    addKeyValueEmph(out, "TECNICO", data.tecnico, width);
    if (data.situacao) addKeyValue(out, "SITUACAO", data.situacao, width);
    if (data.dataPrevisao) addKeyValue(out, "PREVISAO", formatPrintableDate(data.dataPrevisao), width);
    if (data.dataConclusao) addKeyValue(out, "CONCLUSAO", formatPrintableDate(data.dataConclusao), width);

    if (data.defeito) {
      separatorThin(out, width);
      addSectionText(out, "DEFEITO RELATADO:", data.defeito, width);
    }

    if (data.reparo) {
      separatorThin(out, width);
      addSectionText(out, "REPARO/OBS TECNICA:", data.reparo, width);
    }
  }

  // =========================
  // CHECKLIST: PASSWORD / PATTERN / ACCESSORIES
  // =========================
  if (isChecklist) {
    if (data.senhaCliente || data.senhaPadrao) {
      separatorThin(out, width);
      escBold(out, true);
      addText(out, "SENHA / PADRAO DO CLIENTE");
      escBold(out, false);
      lf(out, 1);

      if (data.senhaCliente) addKeyValueEmph(out, "SENHA/PIN", data.senhaCliente, width);
      if (data.senhaPadrao) addPatternOrderGrid(out, String(data.senhaPadrao), width);
    }

    if (Array.isArray(data.acessorios) && data.acessorios.length) {
      separatorThin(out, width);
      escBold(out, true);
      addText(out, "ACESSORIOS ENTREGUES:");
      escBold(out, false);
      lf(out, 1);

      for (const item of data.acessorios) {
        const s = normalizeText(item);
        if (!s) continue;
        addWrapped(out, `- ${s}`, width);
      }
    }

    if (data.laudoTecnico) {
      separatorThin(out, width);
      addSectionText(out, "OBSERVACOES:", data.laudoTecnico, width);
    }
  }

  // =========================
  // VALUES
  // =========================
  const principal =
    isOS
      ? (typeof data.valorBruto === "number" ? data.valorBruto : (typeof data.valorTotal === "number" ? data.valorTotal : undefined))
      : (typeof data.valorLiquido === "number" ? data.valorLiquido : (typeof data.valorTotal === "number" ? data.valorTotal : undefined));

  const hasDetalhes = !isReceipt && (typeof data.valorServico === "number" || typeof data.valorPecas === "number");
  const hasPrincipal = typeof principal === "number";

  if (hasPrincipal || hasDetalhes) {
    separatorThick(out, width);

    if (!isReceipt) {
      if (typeof data.valorServico === "number") addKeyValue(out, "SERVICO", formatCurrency(data.valorServico), width);
      if (typeof data.valorPecas === "number") addKeyValue(out, "PECAS", formatCurrency(data.valorPecas), width);
      separatorThin(out, width);
    }

    if (hasPrincipal) {
      addLeftRight(out, isReceipt ? "TOTAL A PAGAR" : "TOTAL", formatCurrency(principal!), width, true);
    }

    if (data.formaPagamento) addKeyValue(out, "PAGAMENTO", data.formaPagamento, width);
    if (data.parcelas) addKeyValue(out, "PARCELAS", data.parcelas, width);

    separatorThick(out, width);
  }

  // =========================
  // ITEMS (SALE)
  // =========================
  if (Array.isArray(data.itens) && data.itens.length) {
    escBold(out, true);
    addText(out, "ITENS:");
    escBold(out, false);
    lf(out, 1);
    for (const it of data.itens) {
      const nome = normalizeText(it.nome);
      const qtd = Number(it.quantidade || 0);
      const preco = Number(it.preco || 0);
      const linha = `${qtd}x ${nome} - ${formatCurrency(preco)}`;
      addWrapped(out, linha, width);
    }
    separatorThin(out, width);
  }

  // =========================
  // NOTES + TERMS
  // =========================
  if (data.observacoes) {
    addSectionText(out, "OBSERVACOES:", data.observacoes, width);
    separatorThin(out, width);
  }

  const termosCompraRaw = normalizeText(data.termosCompra || "");
  const termosCompra = termosCompraRaw
    .replace(/^(?:\s*TERMO\S*\s+DE\s+COMPRA\s*(?:\(.*?\))?\s*[:\-–]*\s*)+/i, "")
    .trim();

  if (termosCompra) {
    addSectionText(out, "TERMOS DE COMPRA:", termosCompra, width);
    separatorThin(out, width);
  }

  const termosRaw = normalizeText(data.termosGarantia || "");
  const termos = termosRaw.replace(/^(?:\s*TERMOS\s+DE\s+GARANTIA\s*[:\-–]*\s*)+/i, "").trim();

  if (termos) {
    addSectionText(out, "TERMOS DE GARANTIA:", termos, width);
    separatorThin(out, width);
  }

  // =========================
  // SIGNATURE (RECEBIMENTO)
  // =========================
  const isComprovanteRecebimento = data.tipo === "ordem-servico" || data.tipo === "recibo" || data.tipo === "venda" || data.tipo === "comprovante";
  if (isComprovanteRecebimento) {
    escAlign(out, 1);
    addText(out, "ASSINATURA DO CLIENTE");
    lf(out, 1);
    addText(out, repeat("_", Math.min(width, 30)));
    lf(out, 2);
    if (data.clienteNome) addWrapped(out, data.clienteNome, width);
    escAlign(out, 0);
    separatorThin(out, width);
  }

  // Footer spacing (evita cortar o fim / grudar proximo trabalho)
  lf(out, compact ? 4 : 8);

  // Cut (partial)
  out.push(0x1d, 0x56, 0x01);

  return Uint8Array.from(out);
}
