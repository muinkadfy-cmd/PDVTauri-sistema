import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import './ModalNovaMovimentacao.css';

interface ModalNovaMovimentacaoProps {
  onClose: () => void;
  onSave: (tipo: 'venda' | 'gasto' | 'servico', valor: number, responsavel: string, descricao?: string) => void;
}

function ModalNovaMovimentacao({ onClose, onSave }: ModalNovaMovimentacaoProps) {
  const [tipo, setTipo] = useState<'venda' | 'gasto' | 'servico'>('venda');
  const [valor, setValor] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [descricao, setDescricao] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(valor.replace(',', '.'));
    
    if (isNaN(valorNum) || valorNum <= 0) {
      alert('Por favor, insira um valor válido');
      return;
    }

    if (!responsavel.trim()) {
      alert('Por favor, insira o responsável');
      return;
    }

    onSave(tipo, valorNum, responsavel.trim(), descricao.trim() || undefined);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Nova Movimentação" size="sm">
      <div className="nova-movimentacao">
      <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as 'venda' | 'gasto' | 'servico')}>
              <option value="venda">Venda</option>
              <option value="gasto">Gasto</option>
              <option value="servico">Serviço</option>
            </select>
          </div>
          <div className="form-group">
            <label>Valor (R$)</label>
            <input
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              required
            />
          </div>
          <div className="form-group">
            <label>Responsável</label>
            <input
              type="text"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Nome do responsável"
              required
            />
          </div>
          <div className="form-group">
            <label>Descrição (opcional)</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição da movimentação"
              rows={3}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-save">
              Salvar
            </button>
          </div>
      </form>
      </div>
    </Modal>
  );
}

export default ModalNovaMovimentacao;
