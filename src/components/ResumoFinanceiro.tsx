/**
 * Componente ResumoFinanceiro
 * Exibe resumo completo dos cálculos financeiros de uma venda
 */

import React from 'react';
import './ResumoFinanceiro.css';

export interface DadosFinanceiros {
  totalBruto: number;
  desconto: number;
  descontoTipo: 'valor' | 'percentual';
  totalFinal: number;
  taxaPercentual: number;
  taxaValor: number;
  totalLiquido: number;
  custoTotal: number;
  lucroBruto: number;
  lucroLiquido: number;
}

interface ResumoFinanceiroProps {
  dados: DadosFinanceiros;
  compacto?: boolean;
}

function formatarValor(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

function formatarPercentual(valor: number): string {
  return `${valor.toFixed(2)}%`;
}

export function ResumoFinanceiro({ dados, compacto = false }: ResumoFinanceiroProps) {
  const {
    totalBruto,
    desconto,
    descontoTipo,
    totalFinal,
    taxaPercentual,
    taxaValor,
    totalLiquido,
    custoTotal,
    lucroBruto,
    lucroLiquido
  } = dados;

  const descontoValor = descontoTipo === 'percentual'
    ? (totalBruto * desconto / 100)
    : desconto;

  if (compacto) {
    return (
      <div className="resumo-financeiro-compacto">
        <div className="resumo-linha">
          <span className="label">Total Líquido:</span>
          <span className="valor destaque">{formatarValor(totalLiquido)}</span>
        </div>
        <div className="resumo-linha">
          <span className="label">Lucro Líquido:</span>
          <span className={`valor ${lucroLiquido >= 0 ? 'positivo' : 'negativo'}`}>
            {formatarValor(lucroLiquido)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="resumo-financeiro">
      <h3 className="resumo-titulo">💰 Resumo Financeiro</h3>
      
      {/* Valores Brutos */}
      <div className="resumo-secao">
        <div className="resumo-linha">
          <span className="label">Total Bruto:</span>
          <span className="valor">{formatarValor(totalBruto)}</span>
        </div>
        
        {desconto > 0 && (
          <div className="resumo-linha desconto">
            <span className="label">
              Desconto {descontoTipo === 'percentual' ? `(${formatarPercentual(desconto)})` : ''}:
            </span>
            <span className="valor negativo">- {formatarValor(descontoValor)}</span>
          </div>
        )}
        
        <div className="resumo-linha total">
          <span className="label">Total Final:</span>
          <span className="valor destaque">{formatarValor(totalFinal)}</span>
        </div>
      </div>

      {/* Taxas */}
      {taxaValor > 0 && (
        <div className="resumo-secao">
          <div className="resumo-linha taxa">
            <span className="label">
              Taxa ({formatarPercentual(taxaPercentual)}):
            </span>
            <span className="valor negativo">- {formatarValor(taxaValor)}</span>
          </div>
        </div>
      )}

      {/* Líquido */}
      <div className="resumo-secao">
        <div className="resumo-linha total-liquido">
          <span className="label">💵 Total Líquido:</span>
          <span className="valor destaque-liquido">{formatarValor(totalLiquido)}</span>
        </div>
      </div>

      {/* Custos e Lucros */}
      {custoTotal > 0 && (
        <div className="resumo-secao lucros">
          <div className="resumo-linha">
            <span className="label">Custo Total:</span>
            <span className="valor custo">- {formatarValor(custoTotal)}</span>
          </div>
          
          <div className="resumo-linha">
            <span className="label">Lucro Bruto:</span>
            <span className={`valor ${lucroBruto >= 0 ? 'positivo' : 'negativo'}`}>
              {formatarValor(lucroBruto)}
            </span>
          </div>
          
          <div className="resumo-linha lucro-final">
            <span className="label">📈 Lucro Líquido:</span>
            <span className={`valor destaque-lucro ${lucroLiquido >= 0 ? 'positivo' : 'negativo'}`}>
              {formatarValor(lucroLiquido)}
            </span>
          </div>
          
          {totalLiquido > 0 && (
            <div className="resumo-linha margem">
              <span className="label">Margem:</span>
              <span className="valor">
                {formatarPercentual((lucroLiquido / totalLiquido) * 100)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ResumoFinanceiro;
