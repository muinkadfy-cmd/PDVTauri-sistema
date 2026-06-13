import './ImeiPage.css';
import { openExternalUrl } from '../lib/openExternalUrl';
import PageHeader from '@/components/ui/PageHeader';

const servicosImei = [
  {
    id: 'imeicheck',
    nome: 'IMEICheck',
    descricao: 'Verificação gratuita de IMEI - Descubra informações sobre Blacklist, Operadora, SimLock e mais',
    url: 'https://imeicheck.com/pt/consultar-imei',
    cor: '#3b82f6',
    icon: 'IC'
  },
  {
    id: 'anatel',
    nome: 'Consulta Anatel',
    descricao: 'Verifique se o aparelho está impedido (bloqueado por roubo/furto/perda) na rede brasileira',
    url: 'https://www.consultaaparelhoimpedido.com.br/public-web/welcome',
    cor: '#10b981',
    icon: 'AN'
  },
  {
    id: 'ifreeicloud',
    nome: 'iFreeiCloud',
    descricao: 'Verificação gratuita de iCloud - Verifique se o iPhone está bloqueado pelo iCloud',
    url: 'https://www.ifreeicloud.co.uk/free-check',
    cor: '#f59e0b',
    icon: 'ICL'
  }
];

function ImeiPage() {
  const abrirServico = (url: string) => {
    void openExternalUrl(url);
  };

  return (
    <div className="imei-page page-container">
      <PageHeader
        kicker="Suporte e verificação"
        title="Consulta IMEI"
        subtitle="Serviços externos confiáveis para validar bloqueio, blacklist e status do aparelho."
      />

      <div className="imei-info">
        <div className="imei-info-card">
          <h3>O que é IMEI?</h3>
          <p>
            O <strong>IMEI</strong> (International Mobile Equipment Identity) é o número de identificação único do seu celular.
            Você pode encontrá-lo digitando <strong>*#06#</strong> no telefone ou nas configurações do dispositivo.
          </p>
        </div>
      </div>

      <div className="servicos-grid">
        {servicosImei.map(servico => (
          <div
            key={servico.id}
            className="servico-card"
            onClick={() => abrirServico(servico.url)}
            style={{ '--card-color': servico.cor } as React.CSSProperties}
          >
            <div className="servico-icon">{servico.icon}</div>
            <h3>{servico.nome}</h3>
            <p>{servico.descricao}</p>
            <button className="servico-btn">
              Acessar Serviço →
            </button>
          </div>
        ))}
      </div>

      <div className="imei-dica">
        <h3>Dica rápida</h3>
        <p>
          Para consultar um IMEI, clique em um dos serviços acima. Você será redirecionado para o site oficial do serviço,
          onde poderá inserir o número IMEI para verificação.
        </p>
      </div>
    </div>
  );
}

export default ImeiPage;
