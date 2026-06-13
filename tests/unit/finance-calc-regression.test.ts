import { describe, expect, it } from 'vitest';
import {
  calcCustoTotalVenda,
  calcDescontoValor,
  calcFinanceiroCompleto,
  calcMargem,
  calcTaxaCartao,
  calcTotalBrutoOS,
  calcTotalBrutoVenda,
  calcTotalFinal,
  calcTotalLiquido,
  criarPeriodo,
  formatMargem,
} from '@/lib/finance/calc';

describe('finance/calc regression', () => {
  const itens = [
    {
      produtoId: 'p1',
      produtoNome: 'Produto A',
      quantidade: 2,
      preco: 10,
      precoUnitario: 10,
      subtotal: 20,
      custoUnitario: 4,
    },
    {
      produtoId: 'p2',
      produtoNome: 'Produto B',
      quantidade: 1,
      preco: 15,
      precoUnitario: 15,
      subtotal: 15,
      custoUnitario: 5,
    },
  ];

  it('soma corretamente total bruto da venda', () => {
    expect(calcTotalBrutoVenda(itens as any)).toBe(35);
  });

  it('calcula desconto em valor e percentual', () => {
    expect(calcDescontoValor(100, 10, 'valor')).toBe(10);
    expect(calcDescontoValor(100, 10, 'percentual')).toBe(10);
    expect(calcTotalFinal(100, 10, 'valor')).toBe(90);
    expect(calcTotalFinal(200, 15, 'percentual')).toBe(170);
  });

  it('calcula taxa e líquido sem deixar negativo', () => {
    expect(calcTaxaCartao(100, 3.5)).toBeCloseTo(3.5, 6);
    expect(calcTotalLiquido(100, 10, 3.5)).toBeCloseTo(86.5, 6);
    expect(calcTotalLiquido(50, 60, 5)).toBe(0);
  });

  it('gera financeiro completo consistente para venda', () => {
    const resultado = calcFinanceiroCompleto(itens as any, 10, 'valor', 5);
    expect(resultado.totalBruto).toBe(35);
    expect(resultado.descontoValor).toBe(10);
    expect(resultado.totalFinal).toBe(25);
    expect(resultado.taxaValor).toBeCloseTo(1.25, 6);
    expect(resultado.totalLiquido).toBeCloseTo(23.75, 6);
    expect(resultado.custoTotal).toBe(13);
    expect(resultado.lucroBruto).toBe(12);
    expect(resultado.lucroLiquido).toBeCloseTo(10.75, 6);
  });

  it('calcula custo total, margem e formatação de margem', () => {
    expect(calcCustoTotalVenda(itens as any)).toBe(13);
    expect(calcMargem(25, 100)).toBe(25);
    expect(calcMargem(10, 0)).toBeNull();
    expect(formatMargem(12.3456)).toBe('12.35%');
    expect(formatMargem(null)).toBe('N/A');
  });

  it('calcula total bruto da ordem de serviço', () => {
    expect(calcTotalBrutoOS(120, 30)).toBe(150);
    expect(calcTotalBrutoOS(120, 0)).toBe(120);
  });

  it('cria períodos padrão coerentes', () => {
    const hoje = criarPeriodo('hoje');
    const seteDias = criarPeriodo('7dias');
    const mes = criarPeriodo('mes');

    expect(hoje.inicio.getHours()).toBe(0);
    expect(hoje.fim.getHours()).toBe(23);
    expect(seteDias.inicio.getTime()).toBeLessThan(hoje.inicio.getTime());
    expect(mes.inicio.getDate()).toBe(1);
    expect(mes.fim.getDate()).toBeGreaterThanOrEqual(28);
  });
});
