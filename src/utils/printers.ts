import {
  getNativeDefaultPrinter,
  listNativePrinters,
  setNativeDefaultPrinter
} from '@/lib/capabilities/native-print-adapter';

export type PrinterInfo = { name: string; is_default: boolean };

type ListPrintersOptions = {
  force?: boolean;
};

const PRINTERS_CACHE_TTL_MS = 15_000;

let printersCache:
  | {
      expiresAt: number;
      value: PrinterInfo[];
    }
  | null = null;
let inflightPrintersRequest: Promise<PrinterInfo[]> | null = null;

function normalizePrinters(value: unknown): PrinterInfo[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rawName = "name" in item ? String((item as { name?: unknown }).name ?? "").trim() : "";
      if (!rawName) return null;

      return {
        name: rawName,
        is_default: Boolean((item as { is_default?: unknown }).is_default),
      } satisfies PrinterInfo;
    })
    .filter((item): item is PrinterInfo => Boolean(item))
    .sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
    });
}

export function invalidatePrintersCache() {
  printersCache = null;
}

export async function listPrinters(options: ListPrintersOptions = {}): Promise<PrinterInfo[]> {
  const force = options.force === true;

  if (!force && printersCache && Date.now() < printersCache.expiresAt) {
    return printersCache.value;
  }

  if (!force && inflightPrintersRequest) {
    return inflightPrintersRequest;
  }

  const request = listNativePrinters()
    .then((value) => {
      const normalized = normalizePrinters(value);
      printersCache = {
        value: normalized,
        expiresAt: Date.now() + PRINTERS_CACHE_TTL_MS,
      };
      return normalized;
    })
    .finally(() => {
      if (inflightPrintersRequest === request) {
        inflightPrintersRequest = null;
      }
    });

  inflightPrintersRequest = request;
  return request;
}

export async function getDefaultPrinter(): Promise<string | undefined> {
  const res = await getNativeDefaultPrinter();
  const normalized = res?.trim();
  return normalized || undefined;
}

export async function setDefaultPrinter(printerName: string): Promise<void> {
  await setNativeDefaultPrinter(printerName);
  invalidatePrintersCache();
}
