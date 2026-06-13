import { useState, useMemo, useCallback, useEffect } from 'react';
import { salvarTaxa, getTaxaOuPadrao, inicializarTaxasPadrao } from '@/lib/taxas-pagamento';
import { taxasPagamentoRepo } from '@/lib/repositories';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import { showToast } from '@/components/ui/ToastContainer';
import TableMobile from '@/components/ui/TableMobile';
import PageHeader from '@/components/ui/PageHeader';
import './SimularTaxasPage.css';
import { getRuntimeStoreIdOrDefault } from '@/lib/runtime-context';

type TipoTransacao = 'debito' | 'credito';

interface ResultadoSimulacao {
  tipo: TipoTransacao;
  parcelas: number;
  valorBruto: number;
  taxa: number;
  valorTaxa: number;
  valorLiquido: number;
  valorParcela?: number;
}

type TaxaRow = {
  id: string;
  tipo: string;
  parcelas: string;
  taxa: number;
};

function SimularTaxasPage() {
  const [valor, setValor] = useState<string>('1000.00');
  const [tipoTransacao, setTipoTransacao] = useState<TipoTransacao>('credito');
  const [parcelas, setParcelas] = useState<number>(1);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [taxasEditando, setTaxasEditando] = useState<{ debito: number; credito: Record<number, number> }>({
    debito: 1.66, // ✅ Padrão WhatsApp Business
    credito: {
      1: 3.95, 2: 7.99, 3: 8.99, 4: 9.99,
      5: 10.99, 6: 11.99, 7: 12.99, 8: 13.99,
      9: 14.99, 10: 14.99, 11: 15.49, 12: 15.49
    }
  });

  const resolveStoreId = () => getRuntimeStoreIdOrDefault();

  const carregarTaxas = useCallback(async () => {
    const storeId = resolveStoreId();
    if (!storeId) return;

    try {
      await taxasPagamentoRepo.preloadLocal();
    } catch {
      // ignore
    }

    await inicializarTaxasPadrao(storeId);

    const taxaDebito = getTaxaOuPadrao('debito', 1, storeId);
    const taxasCredito: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) {
      const taxaCredito = getTaxaOuPadrao('credito', i, storeId);
      taxasCredito[i] = taxaCredito.taxa_percentual;
    }

    setTaxasEditando({
      debito: taxaDebito.taxa_percentual,
      credito: taxasCredito
    });
  }, []);

  useEffect(() => {
    void carregarTaxas();
  }, [carregarTaxas]);

  useEffect(() => {
    let retryTimer: number | undefined;

    const handleStorageChange = () => {
      void carregarTaxas();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') handleStorageChange();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('smart-tech-taxas-updated', handleStorageChange);
    window.addEventListener('smarttech:sqlite-ready', handleStorageChange as EventListener);
    window.addEventListener('smarttech:store-changed', handleStorageChange as EventListener);
    document.addEventListener('visibilitychange', onVisibility);

    retryTimer = window.setTimeout(handleStorageChange, 280);

    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('smart-tech-taxas-updated', handleStorageChange);
      window.removeEventListener('smarttech:sqlite-ready', handleStorageChange as EventListener);
      window.removeEventListener('smarttech:store-changed', handleStorageChange as EventListener);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [carregarTaxas]);

  // Salvar taxas editadas
  const salvarTaxasEditadas = useCallback(async () => {
    try {
      // Validar taxas
      if (taxasEditando.debito < 0 || taxasEditando.debito > 100) {
        showToast('Taxa de débito deve estar entre 0% e 100%', 'error');
        return;
      }
      
      for (let i = 1; i <= 12; i++) {
        if (taxasEditando.credito[i] < 0 || taxasEditando.credito[i] > 100) {
          showToast(`Taxa de crédito ${i}x deve estar entre 0% e 100%`, 'error');
          return;
        }
      }

      const storeId = resolveStoreId();
      if (!storeId) {
        showToast('❌ Loja não configurada para salvar taxas', 'error');
        return;
      }

      // Salvar taxa de débito
      const debitoSaved = await salvarTaxa({
        store_id: storeId,
        forma_pagamento: 'debito',
        parcelas: 1,
        taxa_percentual: taxasEditando.debito,
        taxa_fixa: 0,
        ativo: true
      });
      if (!debitoSaved) throw new Error('Falha ao salvar taxa de débito.');

      // Salvar taxas de crédito (1-12x)
      for (let i = 1; i <= 12; i++) {
        const creditoSaved = await salvarTaxa({
          store_id: storeId,
          forma_pagamento: 'credito',
          parcelas: i,
          taxa_percentual: taxasEditando.credito[i],
          taxa_fixa: 0,
          ativo: true
        });
        if (!creditoSaved) throw new Error(`Falha ao salvar taxa de crédito ${i}x.`);
      }

      await carregarTaxas();
      showToast('✅ Taxas salvas com sucesso!', 'success');
      setMostrarModalEditar(false);
      
      // Disparar evento para sincronizar outras abas
      window.dispatchEvent(new Event('smart-tech-taxas-updated'));
    } catch (error: any) {
      console.error('Erro ao salvar taxas:', error);
      await carregarTaxas();
      showToast(error?.message || '❌ Erro ao salvar taxas', 'error');
    }
  }, [carregarTaxas, taxasEditando]);

  // Calcular simulação
  const resultado = useMemo<ResultadoSimulacao | null>(() => {
    const valorNum = parseFloat(valor.replace(',', '.')) || 0;
    if (valorNum <= 0) return null;

    let taxa = 0;
    if (tipoTransacao === 'debito') {
      taxa = taxasEditando.debito;
    } else {
      taxa = taxasEditando.credito[parcelas] || 0;
    }

    const valorTaxa = (valorNum * taxa) / 100;
    const valorLiquido = valorNum - valorTaxa;
    const valorParcela = tipoTransacao === 'credito' && parcelas > 1 
      ? valorNum / parcelas 
      : undefined;

    return {
      tipo: tipoTransacao,
      parcelas: tipoTransacao === 'credito' ? parcelas : 1,
      valorBruto: valorNum,
      taxa,
      valorTaxa,
      valorLiquido,
      valorParcela
    };
  }, [valor, tipoTransacao, parcelas, taxasEditando]);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }, []);

  const formatPercent = useCallback((value: number) => {
    return `${value.toFixed(2)}%`;
  }, []);

  const taxasRows = useMemo<TaxaRow[]>(() => {
    const rows: TaxaRow[] = [
      {
        id: 'debito',
        tipo: '💵 Débito',
        parcelas: '-',
        taxa: Number(taxasEditando.debito ?? 0),
      },
    ];

    for (let i = 1; i <= 12; i++) {
      rows.push({
        id: `credito-${i}`,
        tipo: '💳 Crédito',
        parcelas: `${i}x`,
        taxa: Number(taxasEditando.credito?.[i] ?? 0),
      });
    }
    return rows;
  }, [taxasEditando]);

  return (
    <div className="simular-taxas-page page-container">
      <PageHeader
        kicker="Financeiro e taxas"
        title="Simulador de taxas"
        subtitle="Calcule taxas e valores líquidos para débito e crédito com base na configuração atual."
      />

      <div className="simulacao-container">
        {/* Formulário de Simulação */}
        <div className="simulacao-form card">
          <h2>Parâmetros da simulação</h2>
          
          <div className="form-group">
            <label htmlFor="valor">Valor da Venda</label>
            <div className="input-with-icon">
              <span className="input-icon">R$</span>
              <input
                id="valor"
                type="text"
                className="form-input"
                value={valor}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d,]/g, '');
                  setValor(value);
                }}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="tipo">Tipo de Transação</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="tipo"
                  value="credito"
                  checked={tipoTransacao === 'credito'}
                  onChange={() => setTipoTransacao('credito')}
                />
                <span>Crédito</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="tipo"
                  value="debito"
                  checked={tipoTransacao === 'debito'}
                  onChange={() => {
                    setTipoTransacao('debito');
                    setParcelas(1);
                  }}
                />
                <span>Débito</span>
              </label>
            </div>
          </div>

          {tipoTransacao === 'credito' && (
            <div className="form-group">
              <label htmlFor="parcelas">Número de Parcelas</label>
              <select
                id="parcelas"
                className="form-select"
                value={parcelas}
                onChange={(e) => setParcelas(parseInt(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                  <option key={num} value={num}>
                    {num}x
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            className="btn-primary"
            onClick={() => setMostrarModalEditar(true)}
          >
            Editar taxas padrão
          </button>
        </div>

        {/* Resultado da Simulação */}
        {resultado && (
          <div className="resultado-simulacao card">
            <h2>Resultado da simulação</h2>
            
            <div className="resultado-header">
              <div className="tipo-info">
                {resultado.tipo === 'credito' ? 'Crédito' : 'Débito'}
                {resultado.tipo === 'credito' && resultado.parcelas > 1 && (
                  <span className="parcelas-badge">{resultado.parcelas}x</span>
                )}
              </div>
            </div>

            <div className="resultado-valores">
              <div className="valor-item">
                <span className="valor-label">Valor Bruto:</span>
                <span className="valor-amount">{formatCurrency(resultado.valorBruto)}</span>
              </div>
              
              <div className="valor-item">
                <span className="valor-label">Taxa ({formatPercent(resultado.taxa)}):</span>
                <span className="valor-amount taxa">- {formatCurrency(resultado.valorTaxa)}</span>
              </div>

              {resultado.valorParcela && (
                <div className="valor-item">
                  <span className="valor-label">Valor por Parcela:</span>
                  <span className="valor-amount">{formatCurrency(resultado.valorParcela)}</span>
                </div>
              )}

              <div className="valor-item total">
                <span className="valor-label">Valor Líquido a Receber:</span>
                <span className="valor-amount total">{formatCurrency(resultado.valorLiquido)}</span>
              </div>
            </div>

            <div className="resultado-resumo">
              <div className="resumo-item">
                <span className="resumo-label">Taxa Aplicada:</span>
                <span className="resumo-value">{formatPercent(resultado.taxa)}</span>
              </div>
              <div className="resumo-item">
                <span className="resumo-label">Desconto:</span>
                <span className="resumo-value">{formatCurrency(resultado.valorTaxa)}</span>
              </div>
              <div className="resumo-item">
                <span className="resumo-label">Percentual Líquido:</span>
                <span className="resumo-value">{formatPercent((resultado.valorLiquido / resultado.valorBruto) * 100)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tabela de Taxas Configuradas */}
        <div className="tabela-taxas card">
          <h2>Taxas configuradas</h2>

          {/* Desktop */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Parcelas</th>
                  <th>Taxa (%)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Débito</td>
                  <td>-</td>
                  <td>{formatPercent(taxasEditando.debito)}</td>
                </tr>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                  <tr key={num}>
                    <td>Crédito</td>
                    <td>{num}x</td>
                    <td>{formatPercent(taxasEditando.credito[num])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet */}
          <TableMobile<TaxaRow>
            columns={[
              {
                key: 'tipo',
                label: 'Tipo',
                mobilePriority: 1,
              },
              {
                key: 'parcelas',
                label: 'Parcelas',
                mobilePriority: 2,
                align: 'right',
              },
              {
                key: 'taxa',
                label: 'Taxa',
                mobileLabel: 'Taxa',
                mobilePriority: 3,
                align: 'right',
                render: (row) => formatPercent(row.taxa),
              },
            ]}
            data={taxasRows}
            keyExtractor={(row) => row.id}
            emptyMessage="Nenhuma taxa configurada"
          />
        </div>
      </div>

      {/* Modal de Edição de Taxas */}
      <Modal
        isOpen={mostrarModalEditar}
        onClose={() => setMostrarModalEditar(false)}
        title="Editar taxas padrão"
        size="lg"
      >
        <div className="editar-taxas-form">
          <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
            Configure as taxas para débito e crédito (1x a 12x). Estas taxas serão aplicadas automaticamente nas vendas.
          </p>

          <FormField label="Taxa de débito (%)" fullWidth>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={taxasEditando.debito}
              onChange={(e) => setTaxasEditando({
                ...taxasEditando,
                debito: parseFloat(e.target.value) || 0
              })}
              className="form-input"
              placeholder="0.00"
            />
          </FormField>

          <div className="taxas-credito-section">
            <FormField label="Taxas de crédito por parcelas (%)" fullWidth>
              <div className="taxas-parcelas-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                  <div key={num} className="taxa-parcela-item">
                    <label className="taxa-parcela-label">{num}x</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={taxasEditando.credito[num]}
                      onChange={(e) => setTaxasEditando({
                        ...taxasEditando,
                        credito: {
                          ...taxasEditando.credito,
                          [num]: parseFloat(e.target.value) || 0
                        }
                      })}
                      className="form-input"
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>
            </FormField>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setMostrarModalEditar(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={salvarTaxasEditadas}
            >
              💾 Salvar Alterações
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default SimularTaxasPage;
