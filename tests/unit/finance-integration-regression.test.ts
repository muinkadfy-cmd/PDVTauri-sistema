import { describe, expect, it } from 'vitest';
import { toSupabaseVendaPayload } from '@/lib/vendas';
import { calcularAjustesPeriodo } from '@/lib/data';
import { toLocalDateKey } from '@/lib/date-local';

describe('finance integration regression', () => {
  it('monta payload de venda com desconto percentual sem distorcer total final e liquido', () => {
    const payload = toSupabaseVendaPayload({
      id: 'v1',
      itens: [
        {
          produtoId: 'p1',
          produtoNome: 'Produto',
          quantidade: 1,
          precoUnitario: 200,
          subtotal: 200,
          custoUnitario: 80,
          custoTotal: 80,
        },
      ],
      total: 200,
      desconto: 10,
      desconto_tipo: 'percentual',
      taxa_cartao_percentual: 5,
      formaPagamento: 'credito',
      vendedor: 'Teste',
      data: '2026-03-26T12:00:00-03:00',
    });

    expect(payload.total_bruto).toBe(200);
    expect(payload.total_final).toBe(180);
    expect(payload.total_liquido).toBeCloseTo(171, 6);
    expect(payload.desconto_tipo).toBe('percentual');
    expect(payload.taxa_cartao_valor).toBeCloseTo(9, 6);
  });

  it('soma ajustes manuais de entrada no periodo correto', () => {
    const start = new Date('2026-03-01T00:00:00-03:00');
    const end = new Date('2026-03-31T23:59:59-03:00');

    const total = calcularAjustesPeriodo([
      {
        origem_tipo: 'manual',
        tipo: 'entrada',
        valor: 120,
        created_at: '2026-03-10T10:00:00-03:00',
      },
      {
        origem_tipo: 'manual',
        tipo: 'saida',
        valor: 90,
        created_at: '2026-03-10T11:00:00-03:00',
      },
      {
        origem_tipo: 'venda',
        tipo: 'entrada',
        valor: 300,
        created_at: '2026-03-10T11:00:00-03:00',
      },
    ], start, end);

    expect(total).toBe(120);
  });

  it('gera chave diaria local sem usar UTC da ISO', () => {
    const date = new Date(2026, 2, 26, 0, 30, 0, 0);
    expect(toLocalDateKey(date)).toBe('2026-03-26');
  });
});
