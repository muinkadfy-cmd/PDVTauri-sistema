import { useDeferredValue, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { showToast } from '@/components/ui/ToastContainer';
import './CodigosPage.css';

interface CodigoSecreto {
  codigo: string;
  descricao: string;
  categoria: 'info' | 'teste' | 'reset' | 'config';
}

interface Marca {
  id: string;
  nome: string;
  icon: string;
  cor: string;
  codigos: CodigoSecreto[];
}

const marcas: Marca[] = [
  { id: 'apple', nome: 'Apple / iPhone', icon: '🍎', cor: '#000000', codigos: [
    { codigo: '*#06#', descricao: 'Exibir número IMEI', categoria: 'info' },
    { codigo: '*#21#', descricao: 'Verificar redirecionamento de chamadas', categoria: 'info' },
    { codigo: '*#62#', descricao: 'Verificar redirecionamento quando não atende', categoria: 'info' },
    { codigo: '*#67#', descricao: 'Verificar redirecionamento quando ocupado', categoria: 'info' },
    { codigo: '*#30#', descricao: 'Exibir número do telefone', categoria: 'info' },
    { codigo: '*#43#', descricao: 'Verificar status de chamada em espera', categoria: 'info' },
    { codigo: '*#5005*7672#', descricao: 'Verificar número de mensagens de texto', categoria: 'info' },
    { codigo: '*#0*#', descricao: 'Menu de teste (LCD, vibração, som)', categoria: 'teste' },
  ]},
  { id: 'samsung', nome: 'Samsung', icon: '📱', cor: '#1428A0', codigos: [
    { codigo: '*#06#', descricao: 'Exibir número IMEI', categoria: 'info' },
    { codigo: '*#0*#', descricao: 'Menu de teste do hardware', categoria: 'teste' },
    { codigo: '*#*#4636#*#*', descricao: 'Informações do telefone e bateria', categoria: 'info' },
    { codigo: '*#0228#', descricao: 'Status da bateria', categoria: 'info' },
    { codigo: '*#0011#', descricao: 'Menu de serviço (modo RF)', categoria: 'config' },
    { codigo: '*#1234#', descricao: 'Versão do firmware', categoria: 'info' },
    { codigo: '*#0842#', descricao: 'Teste de vibração', categoria: 'teste' },
    { codigo: '*#2663#', descricao: 'Versão da tela touch', categoria: 'info' },
    { codigo: '*#34971539#', descricao: 'Informações da câmera', categoria: 'info' },
    { codigo: '*2767*3855#', descricao: 'Reset completo do aparelho (CUIDADO!)', categoria: 'reset' },
  ]},
  { id: 'xiaomi', nome: 'Xiaomi', icon: '📲', cor: '#FF6900', codigos: [
    { codigo: '*#06#', descricao: 'Exibir número IMEI', categoria: 'info' },
    { codigo: '*#*#4636#*#*', descricao: 'Informações do telefone e bateria', categoria: 'info' },
    { codigo: '*#*#64663#*#*', descricao: 'Menu de teste do hardware', categoria: 'teste' },
    { codigo: '*#*#0842#*#*', descricao: 'Teste de vibração e LED', categoria: 'teste' },
    { codigo: '*#*#232338#*#*', descricao: 'Exibir endereço MAC WiFi', categoria: 'info' },
    { codigo: '*#*#1111#*#*', descricao: 'Versão do software FTA', categoria: 'info' },
    { codigo: '*#*#2222#*#*', descricao: 'Versão do hardware FTA', categoria: 'info' },
    { codigo: '*#*#232331#*#*', descricao: 'Teste do Bluetooth', categoria: 'teste' },
    { codigo: '*#*#232337#*#*', descricao: 'Endereço Bluetooth', categoria: 'info' },
  ]},
  { id: 'motorola', nome: 'Motorola', icon: '📱', cor: '#E11427', codigos: [
    { codigo: '*#06#', descricao: 'Exibir número IMEI', categoria: 'info' },
    { codigo: '*#*#4636#*#*', descricao: 'Informações do telefone e bateria', categoria: 'info' },
    { codigo: '*#*#232338#*#*', descricao: 'Exibir endereço MAC WiFi', categoria: 'info' },
    { codigo: '*#*#0842#*#*', descricao: 'Teste de vibração e LED', categoria: 'teste' },
    { codigo: '*#*#232331#*#*', descricao: 'Teste do Bluetooth', categoria: 'teste' },
    { codigo: '*#*#7262626#*#*', descricao: 'Teste de campo (RF)', categoria: 'teste' },
    { codigo: '*#*#232337#*#*', descricao: 'Endereço Bluetooth', categoria: 'info' },
    { codigo: '*#*#0842#*#*', descricao: 'Teste de vibração', categoria: 'teste' },
  ]},
  { id: 'lg', nome: 'LG', icon: '📱', cor: '#A50034', codigos: [
    { codigo: '*#06#', descricao: 'Exibir número IMEI', categoria: 'info' },
    { codigo: '*#*#4636#*#*', descricao: 'Informações do telefone e bateria', categoria: 'info' },
    { codigo: '3845#*modelo#', descricao: 'Menu de teste (substitua "modelo" pelo modelo)', categoria: 'teste' },
    { codigo: '*#546368#*modelo#', descricao: 'Menu oculto (substitua "modelo" pelo modelo)', categoria: 'config' },
    { codigo: '*#*#232338#*#*', descricao: 'Exibir endereço MAC WiFi', categoria: 'info' },
    { codigo: '*#*#0842#*#*', descricao: 'Teste de vibração', categoria: 'teste' },
    { codigo: '*#*#232331#*#*', descricao: 'Teste do Bluetooth', categoria: 'teste' },
    { codigo: '*#*#232337#*#*', descricao: 'Endereço Bluetooth', categoria: 'info' },
  ]},
  { id: 'nokia', nome: 'Nokia', icon: '📱', cor: '#124191', codigos: [
    { codigo: '*#06#', descricao: 'Exibir número IMEI', categoria: 'info' },
    { codigo: '*#0000#', descricao: 'Versão do software', categoria: 'info' },
    { codigo: '*#92702689#', descricao: 'Informações de uso (tempo de chamadas)', categoria: 'info' },
    { codigo: '*#2820#', descricao: 'Endereço Bluetooth', categoria: 'info' },
    { codigo: '*#7370#', descricao: 'Reset completo (CUIDADO!)', categoria: 'reset' },
    { codigo: '*#7780#', descricao: 'Reset de fábrica (CUIDADO!)', categoria: 'reset' },
    { codigo: '*#62209526#', descricao: 'Exibir endereço MAC WiFi', categoria: 'info' },
    { codigo: '*#*#4636#*#*', descricao: 'Informações do telefone e bateria', categoria: 'info' },
  ]},
  { id: 'huawei', nome: 'Huawei', icon: '📱', cor: '#FF0000', codigos: [
    { codigo: '*#06#', descricao: 'Exibir número IMEI', categoria: 'info' },
    { codigo: '*#*#4636#*#*', descricao: 'Informações do telefone e bateria', categoria: 'info' },
    { codigo: '*#*#2846579#*#*', descricao: 'Menu de projeto (testes)', categoria: 'teste' },
    { codigo: '*#*#232338#*#*', descricao: 'Exibir endereço MAC WiFi', categoria: 'info' },
    { codigo: '*#*#0842#*#*', descricao: 'Teste de vibração e LED', categoria: 'teste' },
    { codigo: '*#*#232331#*#*', descricao: 'Teste do Bluetooth', categoria: 'teste' },
    { codigo: '*#*#232337#*#*', descricao: 'Endereço Bluetooth', categoria: 'info' },
    { codigo: '*#*#64663#*#*', descricao: 'Menu de teste do hardware', categoria: 'teste' },
  ]},
];

function getCategoriaIcon(categoria: CodigoSecreto['categoria']) {
  switch (categoria) {
    case 'info': return 'ℹ️';
    case 'teste': return '🔧';
    case 'reset': return '⚠️';
    case 'config': return '⚙️';
    default: return '📋';
  }
}

function getCategoriaLabel(categoria: CodigoSecreto['categoria']) {
  switch (categoria) {
    case 'info': return 'Informação';
    case 'teste': return 'Teste';
    case 'reset': return 'Reset';
    case 'config': return 'Configuração';
    default: return 'Outro';
  }
}

export default function CodigosPage() {
  const [marcaSelecionada, setMarcaSelecionada] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const buscaDeferred = useDeferredValue(busca);

  const marcasFiltradas = useMemo(() => {
    const buscaLower = buscaDeferred.trim().toLowerCase();
    return marcas.filter((marca) => {
      if (!buscaLower) return true;
      return marca.nome.toLowerCase().includes(buscaLower) ||
        marca.codigos.some((codigo) => codigo.codigo.toLowerCase().includes(buscaLower) || codigo.descricao.toLowerCase().includes(buscaLower));
    });
  }, [buscaDeferred]);

  const resumo = useMemo(() => {
    const totalCodigos = marcas.reduce((acc, marca) => acc + marca.codigos.length, 0);
    const totalTestes = marcas.reduce((acc, marca) => acc + marca.codigos.filter((codigo) => codigo.categoria === 'teste').length, 0);
    const totalResets = marcas.reduce((acc, marca) => acc + marca.codigos.filter((codigo) => codigo.categoria === 'reset').length, 0);
    return {
      totalMarcas: marcas.length,
      totalCodigos,
      totalTestes,
      totalResets,
      resultados: marcasFiltradas.length,
    };
  }, [marcasFiltradas.length]);

  const marcaAtiva = useMemo(() => marcas.find((marca) => marca.id === marcaSelecionada) || null, [marcaSelecionada]);

  const copiarCodigo = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      showToast(`📋 Código ${codigo} copiado.`, 'success');
    } catch {
      showToast('⚠️ Não foi possível copiar agora.', 'warning');
    }
  };

  return (
    <div className="codigos-page">
      <div className="page-header codigos-hero-header">
        <div>
          <h1>Códigos Secretos de Celulares</h1>
          <p>Consulta rápida por marca, testes úteis e atalhos de diagnóstico.</p>
        </div>
        <div className="codigos-hero-badge">Ferramenta técnica • consulta rápida</div>
      </div>

      <div className="codigos-overview-grid">
        <div className="codigos-overview-card"><span>Marcas</span><strong>{resumo.totalMarcas}</strong><small>principais no catálogo</small></div>
        <div className="codigos-overview-card"><span>Códigos úteis</span><strong>{resumo.totalCodigos}</strong><small>atalhos cadastrados</small></div>
        <div className="codigos-overview-card"><span>Testes</span><strong>{resumo.totalTestes}</strong><small>menus e verificações</small></div>
        <div className="codigos-overview-card codigos-overview-card--warning"><span>Atenção</span><strong>{resumo.totalResets}</strong><small>código(s) com reset</small></div>
      </div>

      <div className="search-bar codigos-search-card">
        <input
          type="text"
          placeholder="Buscar por marca, código ou descrição..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="search-input"
        />
        <div className="codigos-search-meta">
          <span>{resumo.resultados} marca(s) encontrada(s)</span>
          {busca ? <button type="button" className="codigos-clear-btn" onClick={() => setBusca('')}>Limpar busca</button> : null}
        </div>
      </div>

      <div className="codigos-legend">
        <span className="codigos-legend-chip">ℹ️ Informação</span>
        <span className="codigos-legend-chip">🔧 Teste</span>
        <span className="codigos-legend-chip">⚙️ Configuração</span>
        <span className="codigos-legend-chip codigos-legend-chip--warning">⚠️ Reset</span>
      </div>

      {marcaAtiva ? (
        <div className="codigos-highlight-card" style={{ '--marca-color': marcaAtiva.cor } as CSSProperties}>
          <div>
            <strong>{marcaAtiva.icon} {marcaAtiva.nome}</strong>
            <p>{marcaAtiva.codigos.length} código(s) visíveis nesta marca. Toque novamente no card para recolher.</p>
          </div>
          <div className="codigos-highlight-badge">Marca em foco</div>
        </div>
      ) : null}

      <div className="marcas-grid">
        {marcasFiltradas.map((marca) => (
          <div
            key={marca.id}
            className={`marca-card ${marcaSelecionada === marca.id ? 'expandido' : ''}`}
            onClick={() => setMarcaSelecionada(marcaSelecionada === marca.id ? null : marca.id)}
            style={{ '--marca-color': marca.cor } as CSSProperties}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setMarcaSelecionada(marcaSelecionada === marca.id ? null : marca.id);
              }
            }}
          >
            <div className="marca-header">
              <div className="marca-icon">{marca.icon}</div>
              <div className="marca-copy">
                <h2>{marca.nome}</h2>
                <p className="marca-helper">Toque para abrir os códigos e copiar rapidamente.</p>
              </div>
              <span className="marca-badge">{marca.codigos.length} códigos</span>
            </div>

            {marcaSelecionada === marca.id ? (
              <div className="marca-codigos">
                {marca.codigos.map((codigo) => (
                  <div key={`${marca.id}-${codigo.codigo}`} className="codigo-item">
                    <div className="codigo-header-item">
                      <div className="codigo-info">
                        <span className={`codigo-categoria codigo-categoria--${codigo.categoria}`}>
                          {getCategoriaIcon(codigo.categoria)} {getCategoriaLabel(codigo.categoria)}
                        </span>
                        <code className="codigo-valor" onClick={(e) => { e.stopPropagation(); void copiarCodigo(codigo.codigo); }}>
                          {codigo.codigo}
                        </code>
                      </div>
                      <button
                        className="btn-copiar"
                        onClick={(e) => { e.stopPropagation(); void copiarCodigo(codigo.codigo); }}
                        title="Copiar código"
                        type="button"
                      >
                        📋 Copiar
                      </button>
                    </div>
                    <p className="codigo-descricao">{codigo.descricao}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="marca-footer-hint">Clique para expandir os códigos desta marca.</div>
            )}
          </div>
        ))}
      </div>

      {marcasFiltradas.length === 0 ? (
        <div className="empty-state codigos-empty-state">
          <p>Nenhum resultado encontrado para "{busca}".</p>
          <button type="button" className="codigos-clear-btn" onClick={() => setBusca('')}>Limpar busca</button>
        </div>
      ) : null}

      <div className="codigos-aviso codigos-aviso-premium">
        <h3>⚠️ Aviso importante</h3>
        <p>Alguns códigos podem causar reset ou alterações no aparelho. Use com cuidado e faça backup antes de aplicar códigos de formatação.</p>
      </div>
    </div>
  );
}
