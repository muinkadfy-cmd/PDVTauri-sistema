/**
 * Helpers assíncronos pequenos (sem dependências)
 */

export class TimeoutError extends Error {
  constructor(message = 'Operação excedeu o tempo limite') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envolve uma Promise com timeout.
 * - Não cancela a operação original (JS não tem cancelamento genérico)
 * - Mas garante que a UI não fique "presa" em loading infinito.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string
): Promise<T> {
  let t: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = window.setTimeout(() => reject(new TimeoutError(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (t) window.clearTimeout(t);
  }
}
