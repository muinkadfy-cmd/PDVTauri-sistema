import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDesktopApp } from '@/lib/platform';
import { getDeviceId } from '@/lib/device';
import { getLicenseStatusAsync } from '@/lib/license';
import { downloadSupportPack } from '@/lib/support-pack';
import { getCrashLogCount, clearCrashLog } from '@/lib/crash-report';
import { getDesktopCaptureStats } from '@/lib/desktop/error-capture';

import WhatsAppButton from '@/components/ui/WhatsAppButton';
import './AjudaPage.css';

interface FAQ {
  id: string;
  categoria: string;
  pergunta: string;
  resposta: string;
}

const WHATSAPP_SUPORTE = '5543996694751'; // (43) 99669-4751

const FAQS: FAQ[] = [
  // VENDAS
  {
    id: 'venda-1',
    categoria: 'Vendas',
    pergunta: 'Como fazer uma venda?',
    resposta: `**Passo a passo:**
1. Acesse **Vendas** no menu lateral
2. Clique em **+ Nova Venda** ou **⚡ Venda Rápida**
3. Adicione produtos clicando em **+ Adicionar Produto**
4. Selecione o cliente (opcional)
5. Escolha a forma de pagamento (Dinheiro, PIX, Débito, Crédito)
6. Para crédito: selecione o número de parcelas (1-12x)
7. Clique em **Finalizar Venda**

**Dica:** Use Venda Rápida para agilizar o processo!`
  },
  {
    id: 'venda-2',
    categoria: 'Vendas',
    pergunta: 'Como funcionam as taxas de cartão?',
    resposta: `As taxas são aplicadas automaticamente conforme configurado em **Configurações > Taxas de Pagamento**:

**Débito:** Taxa única (ex: 1.66%)
**Crédito:** Taxa varia por parcela (1x-12x)

O sistema calcula automaticamente:
- Valor bruto da venda
- Taxa aplicada (%)
- Valor líquido a receber

Você pode **simular taxas** em **Financeiro > Simular Taxas**.`
  },
  {
    id: 'venda-3',
    categoria: 'Vendas',
    pergunta: 'Como imprimir comprovante de venda?',
    resposta: `1. Acesse **Vendas** no menu
2. Localize a venda desejada
3. Clique no botão **🖨️ Imprimir** ao lado da venda
4. A impressão abrirá automaticamente

**Comprovante inclui:**
- Dados da loja
- Dados do cliente
- Produtos vendidos
- Valores e taxas
- Forma de pagamento
- Termos de garantia`
  },
  
  // ORDENS DE SERVIÇO
  {
    id: 'os-1',
    categoria: 'Ordens de Serviço',
    pergunta: 'Como abrir uma ordem de serviço?',
    resposta: `**Passo a passo:**
1. Acesse **Ordens de Serviço** no menu
2. Clique em **+ Nova Ordem**
3. Preencha os dados do cliente
4. Descreva o defeito relatado
5. Adicione observações técnicas
6. Informe valor de serviço e peças
7. Clique em **Criar Ordem**

**Status da OS:**
- **Aberta:** Recém-criada
- **Em Andamento:** Em execução
- **Aguardando Peça:** Aguardando peças
- **Concluída:** Finalizada
- **Cancelada:** Cancelada`
  },
  {
    id: 'os-2',
    categoria: 'Ordens de Serviço',
    pergunta: 'Como adicionar acessórios à OS?',
    resposta: `1. Ao criar/editar uma OS
2. Na seção **Acessórios Entregues**
3. Clique em **+ Adicionar Acessório**
4. Digite o nome do acessório (ex: Carregador, Capa, Fone)
5. Repita para cada acessório

**Importante:** Acessórios aparecem no termo de garantia impresso!`
  },
  
  // PRODUTOS
  {
    id: 'prod-1',
    categoria: 'Produtos',
    pergunta: 'Como cadastrar produtos?',
    resposta: `**Passo a passo:**
1. Acesse **Produtos** no menu
2. Clique em **+ Novo Produto**
3. Preencha:
   - Nome do produto
   - Preço de venda
   - Custo (opcional, para cálculo de lucro)
   - Estoque inicial
   - Categoria
4. Clique em **Salvar**

**Dica:** Configure o estoque mínimo para alertas!`
  },
  {
    id: 'prod-2',
    categoria: 'Produtos',
    pergunta: 'Como controlar estoque?',
    resposta: `O sistema controla estoque **automaticamente**:

**Vendas:** Subtrai do estoque
**Devolução:** Devolve ao estoque
**Edição manual:** Ajuste direto no produto

Para ver movimentações:
1. Acesse **Estoque** no menu
2. Veja entradas e saídas
3. Filtre por período

**Alerta:** Produtos com estoque baixo aparecem em destaque!`
  },
  
  // CLIENTES
  {
    id: 'cli-1',
    categoria: 'Clientes',
    pergunta: 'Como cadastrar clientes?',
    resposta: `**Passo a passo:**
1. Acesse **Clientes** no menu
2. Clique em **+ Novo Cliente**
3. Preencha:
   - Nome completo
   - CPF/CNPJ (opcional)
   - Telefone (importante para contato)
   - Endereço
4. Clique em **Salvar**

**Vantagens:**
- Histórico de compras
- Dados salvos para próximas vendas
- Envio de comprovante por WhatsApp`
  },
  {
    id: 'cli-2',
    categoria: 'Clientes',
    pergunta: 'Como enviar comprovante por WhatsApp?',
    resposta: `1. Na tela de **Vendas** ou **Ordens de Serviço**
2. Localize a venda/OS
3. Clique no botão **💬 WhatsApp**
4. O WhatsApp abrirá automaticamente
5. Mensagem pré-formatada com dados da venda
6. Clique em Enviar

**Requisito:** Cliente deve ter telefone cadastrado!`
  },
  
  // FINANCEIRO
  {
    id: 'fin-1',
    categoria: 'Financeiro',
    pergunta: 'Como ver o fluxo de caixa?',
    resposta: `**Acesse Fluxo de Caixa:**
1. Clique em **Fluxo de Caixa** no menu
2. Veja resumo:
   - Total de Entradas (vendas, recibos)
   - Total de Saídas (compras, despesas)
   - Saldo do Período

**Filtros disponíveis:**
- Por data (hoje, semana, mês)
- Por forma de pagamento
- Por categoria

**Retirada do Caixa:**
Clique em **💸 Retirada do Caixa** para registrar saídas`
  },
  {
    id: 'fin-2',
    categoria: 'Financeiro',
    pergunta: 'Como lançar despesas?',
    resposta: `1. Acesse **Financeiro** no menu
2. Clique em **+ Lançamento**
3. Selecione **Tipo: Saída**
4. Preencha:
   - Valor
   - Categoria (Compra de Peças, Despesas, etc.)
   - Forma de pagamento
   - Descrição
5. Clique em **Salvar**

**Categorias disponíveis:**
- Compra de Peças
- Despesas Operacionais
- Retirada do Caixa
- Outras Saídas`
  },
  
  // RELATÓRIOS
  {
    id: 'rel-1',
    categoria: 'Relatórios',
    pergunta: 'Como gerar relatórios?',
    resposta: `1. Acesse **Relatórios** no menu
2. Escolha o tipo:
   - Vendas por Período
   - Produtos Mais Vendidos
   - Lucro por Produto
   - Ordens de Serviço
   - Financeiro
3. Selecione o período
4. Clique em **Gerar Relatório**

**Exportar:**
- Clique em **📥 Exportar** para baixar PDF/Excel`
  },
  
  // SINCRONIZAÇÃO
  {
    id: 'sync-1',
    categoria: 'Sincronização',
    pergunta: 'Como funciona a sincronização?',
    resposta: `O sistema sincroniza **automaticamente** entre dispositivos:

**Web ↔ Mobile:** Dados sincronizam em tempo real

**Modo Offline:**
- Trabalhe sem internet
- Dados salvos localmente
- Sincronização automática ao reconectar

**Status de Sync:**
- 🟢 Online: Sincronizado
- 🟡 Pendente: Aguardando sincronização
- 🔴 Erro: Problema de conexão

**Diagnóstico:** Acesse **Configurações > Diagnóstico de Sync**`
  },
  
  // CONFIGURAÇÕES
  {
    id: 'config-1',
    categoria: 'Configurações',
    pergunta: 'Como configurar taxas de cartão?',
    resposta: `1. Acesse **Configurações** no menu
2. Clique em **Taxas de Pagamento**
3. Configure:
   - **Débito:** Taxa única (ex: 1.66%)
   - **Crédito:** Taxa por parcela (1x-12x)
4. Clique em **Salvar**

**As taxas são aplicadas automaticamente** em todas as vendas!

**Dica:** Use **Simular Taxas** para testar antes de configurar.`
  },
  {
    id: 'config-2',
    categoria: 'Configurações',
    pergunta: 'Como personalizar termos de garantia?',
    resposta: `1. Acesse **Configurações** no menu
2. Clique em **Termos de Garantia**
3. Edite o texto padrão
4. Clique em **📌 Fixar Termos** para usar em todas as OS
5. Clique em **Salvar**

**O termo aparece** em todos os comprovantes impressos!`
  },
  
  // BACKUP
  {
    id: 'backup-1',
    categoria: 'Backup',
    pergunta: 'Como fazer backup dos dados?',
    resposta: `**Backup Automático:**
No Desktop offline, o sistema salva os dados no banco local SQLite deste PC. Use Backup para copiar os dados com segurança.

**Backup Manual:**
1. Acesse **Configurações > Backup**
2. Clique em **📥 Exportar Dados**
3. Arquivo JSON será baixado
4. Guarde em local seguro

**Restaurar:**
1. Acesse **Configurações > Backup**
2. Clique em **📤 Importar Dados**
3. Selecione o arquivo JSON
4. Confirme a restauração`
  }
];

const CATEGORIAS = ['Todas', 'Vendas', 'Ordens de Serviço', 'Produtos', 'Clientes', 'Financeiro', 'Relatórios', 'Sincronização', 'Configurações', 'Backup'];

function AjudaPage() {

  const navigate = useNavigate();

  const desktop = isDesktopApp();
  const [deviceId, setDeviceId] = useState<string>('');
  const [licenseText, setLicenseText] = useState<string>('');
  const [loadingSupport, setLoadingSupport] = useState(false);
  const [crashCount, setCrashCount] = useState(0);
  const [captureStats, setCaptureStats] = useState<{ errors: number; breadcrumbs: number }>({ errors: 0, breadcrumbs: 0 });
  useEffect(() => {
    void getCrashLogCount().then(setCrashCount);
    if (desktop) {
      void getDesktopCaptureStats().then(setCaptureStats).catch(() => setCaptureStats({ errors: 0, breadcrumbs: 0 }));
    }
  }, [desktop]);

  useEffect(() => {
    if (!desktop) return;
    (async () => {
      try {
        const d = await getDeviceId();
        setDeviceId(d || '');
      } catch {
        setDeviceId('');
      }
      try {
        const st = await getLicenseStatusAsync();
        setLicenseText(st?.message || st?.status || '');
      } catch {
        setLicenseText('');
      }
    })();
  }, [desktop]);

  const supportSummary = useMemo(() => {
    if (!desktop) return null;
    const lic = licenseText ? `Licença: ${licenseText}` : 'Licença: (não verificada)';
    const dev = deviceId ? `Machine ID: ${deviceId}` : 'Machine ID: (indisponível)';
    const logs = `Coleta local: ${captureStats.errors} erro(s) • ${captureStats.breadcrumbs} trilha(s) • ${crashCount} crash(es)`;
    return { lic, dev, logs };
  }, [desktop, licenseText, deviceId, captureStats, crashCount]);

  async function handleDownloadSupportPack() {
    try {
      setLoadingSupport(true);
      await downloadSupportPack();
    } finally {
      setLoadingSupport(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback simples
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Todas');
  const [busca, setBusca] = useState('');
  const [faqAberto, setFaqAberto] = useState<string | null>(null);

  const faqsFiltrados = FAQS.filter(faq => {
    const filtraCategoria = categoriaSelecionada === 'Todas' || faq.categoria === categoriaSelecionada;
    const filtraBusca = busca === '' || 
      faq.pergunta.toLowerCase().includes(busca.toLowerCase()) ||
      faq.resposta.toLowerCase().includes(busca.toLowerCase());
    return filtraCategoria && filtraBusca;
  });

    const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

const formatarResposta = (resposta: string) => {
    return resposta
      .split('\n')
      .map((linha, index) => {
        linha = escapeHtml(linha);
        // Negrito
        linha = linha.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Item de lista
        if (linha.trim().startsWith('- ')) {
          linha = `<li>${linha.substring(2)}</li>`;
        }
        // Número de lista
        if (/^\d+\./.test(linha.trim())) {
          linha = `<li>${linha.replace(/^\d+\.\s*/, '')}</li>`;
        }
        return linha;
      })
      .join('\n');
  };

  return (
    <div className="ajuda-page page-container">

      {desktop && supportSummary && (
        <div className="support-card">
          <div className="support-card__title">Suporte técnico do desktop</div>
          <div className="support-card__line">{supportSummary.dev}</div>
          <div className="support-card__line">{supportSummary.lic}</div>
          <div className="support-card__line">{supportSummary.logs}</div>

          <div className="support-card__actions">
            <button className="support-btn" onClick={() => copyText(deviceId)} disabled={!deviceId}>
              Copiar Machine ID
            </button>
            <button className="support-btn" onClick={() => navigate('/auto-teste')}>
              Auto-teste (Passo 10)
            </button>
            <button className="support-btn" onClick={handleDownloadSupportPack} disabled={loadingSupport}>
              {loadingSupport ? 'Gerando…' : 'Baixar Pacote de Suporte (ZIP)'}
            </button>
          </div>

          <div className="support-card__hint">
            Envie o ZIP + seu Machine ID para o suporte.
          </div>
        </div>
      )}

      <div className="page-header">
        <span className="ajuda-kicker">Suporte e onboarding</span>
        <h1>Central de ajuda</h1>
        <p className="page-subtitle">Encontre respostas, fluxos guiados e atalhos para operar o sistema com segurança.</p>
      </div>

      {/* Suporte WhatsApp */}
      <div className="suporte-whatsapp-card card">
        <div className="suporte-content">
          <div className="suporte-icon">ST</div>
          <div className="suporte-info">
            <h2>Precisa de ajuda personalizada?</h2>
            <p>Fale direto com nosso suporte via WhatsApp!</p>
            <p className="suporte-telefone">(43) 99669-4751</p>
          </div>
          <WhatsAppButton
            telefone={WHATSAPP_SUPORTE}
            mensagem="Olá! Preciso de ajuda com o Sistema Smart Tech Rolândia PDV."
            className="btn-whatsapp-suporte"
          />
        </div>
      </div>

      {/* Busca e Filtros */}
      <div className="ajuda-filtros card">
        <div className="busca-container">
          <input
            type="text"
            className="form-input busca-input"
            placeholder="Buscar dúvidas, processos e termos..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="categorias-tabs">
          {CATEGORIAS.map(categoria => (
            <button
              key={categoria}
              className={`categoria-tab ${categoriaSelecionada === categoria ? 'active' : ''}`}
              onClick={() => setCategoriaSelecionada(categoria)}
            >
              {categoria}
            </button>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div className="faqs-container">
        {faqsFiltrados.length === 0 ? (
          <div className="sem-resultados card">
            <p>Nenhuma dúvida encontrada para sua busca.</p>
            <p>Tente buscar por outro termo ou entre em contato pelo WhatsApp!</p>
          </div>
        ) : (
          faqsFiltrados.map(faq => (
            <div key={faq.id} className="faq-item card">
              <button
                className="faq-pergunta"
                onClick={() => setFaqAberto(faqAberto === faq.id ? null : faq.id)}
              >
                <span className="faq-categoria-badge">{faq.categoria}</span>
                <span className="faq-pergunta-texto">{faq.pergunta}</span>
                <span className="faq-toggle">{faqAberto === faq.id ? '▼' : '▶'}</span>
              </button>
              {faqAberto === faq.id && (
                <div 
                  className="faq-resposta"
                  dangerouslySetInnerHTML={{ __html: formatarResposta(faq.resposta) }}
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Guia Rápido */}
      <div className="guia-rapido card">
        <h2>Guia rápido de início</h2>
        
        <div className="guia-steps">
          <div className="guia-step">
            <div className="step-numero">1</div>
            <div className="step-content">
              <h3>Configure sua Loja</h3>
              <p>Acesse <strong>Configurações</strong> e preencha dados da loja, taxas de cartão e termos de garantia.</p>
            </div>
          </div>

          <div className="guia-step">
            <div className="step-numero">2</div>
            <div className="step-content">
              <h3>Cadastre Produtos</h3>
              <p>Vá em <strong>Produtos</strong> e cadastre seu catálogo com preços e estoque.</p>
            </div>
          </div>

          <div className="guia-step">
            <div className="step-numero">3</div>
            <div className="step-content">
              <h3>Cadastre Clientes</h3>
              <p>Em <strong>Clientes</strong>, adicione seus clientes para facilitar vendas futuras.</p>
            </div>
          </div>

          <div className="guia-step">
            <div className="step-numero">4</div>
            <div className="step-content">
              <h3>Comece a Vender!</h3>
              <p>Use <strong>Nova Venda</strong> ou <strong>Venda Rápida</strong> para registrar suas vendas.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recursos do Sistema */}
      <div className="recursos-sistema card">
        <h2>Principais recursos</h2>
        
        <div className="recursos-grid">
          <div className="recurso-card">
            <div className="recurso-icon">VN</div>
            <h3>Vendas</h3>
            <p>Registre vendas rápido com cálculo automático de taxas e controle de estoque.</p>
          </div>

          <div className="recurso-card">
            <div className="recurso-icon">OS</div>
            <h3>Ordens de Serviço</h3>
            <p>Gerencie OS com status, acessórios e impressão de termos de garantia.</p>
          </div>

          <div className="recurso-card">
            <div className="recurso-icon">ET</div>
            <h3>Controle de Estoque</h3>
            <p>Estoque atualizado automaticamente em cada venda e devolução.</p>
          </div>

          <div className="recurso-card">
            <div className="recurso-icon">RL</div>
            <h3>Relatórios</h3>
            <p>Visualize vendas, lucros, produtos mais vendidos e muito mais.</p>
          </div>

          <div className="recurso-card">
            <div className="recurso-icon">TX</div>
            <h3>Taxas de Cartão</h3>
            <p>Configure taxas personalizadas para débito e crédito (1-12x).</p>
          </div>

          <div className="recurso-card">
            <div className="recurso-icon">SY</div>
            <h3>Sincronização</h3>
            <p>Dados sincronizados entre web e mobile, com modo offline.</p>
          </div>

          <div className="recurso-card">
            <div className="recurso-icon">WA</div>
            <h3>WhatsApp</h3>
            <p>Envie comprovantes direto para clientes via WhatsApp.</p>
          </div>

          <div className="recurso-card">
            <div className="recurso-icon">PR</div>
            <h3>Impressão</h3>
            <p>Imprima comprovantes de vendas, OS e termos de garantia.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AjudaPage;
