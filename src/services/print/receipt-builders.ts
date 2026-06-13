import type { Cobranca, Cliente, OrdemServico, Pessoa, Recibo, Usado, UsadoVenda, Venda } from '@/types';
import { getClientes } from '@/lib/clientes';
import { getCobrancas } from '@/lib/cobrancas';
import { fetchCompany } from '@/lib/company-service';
import { formatCobrancaId } from '@/lib/format-display-id';
import { formatVendaId } from '@/lib/format-display-id';
import { getOrdensAsync } from '@/lib/ordens';
import { getPessoas } from '@/lib/pessoas';
import { getRecibos } from '@/lib/recibos';
import { getUsadoById, getVendaUsadoById } from '@/lib/usados';
import { getVendasAsync } from '@/lib/vendas';
import type { EmpresaInfo, PrintData } from '@/lib/print-template';

export type PrintableReceiptType =
  | 'sale'
  | 'receipt'
  | 'service-order'
  | 'service-order-checklist'
  | 'charge'
  | 'used-purchase'
  | 'used-sale'
  | 'test';

export interface ThermalReceiptLineItem {
  label: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
  note?: string;
}

export interface ThermalReceiptModel {
  type: PrintableReceiptType;
  title: string;
  documentNumber: string;
  dateLabel: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  company: EmpresaInfo;
  items: ThermalReceiptLineItem[];
  subtotal?: number;
  discount?: number;
  total: number;
  paymentLabel?: string;
  installmentsLabel?: string;
  checklistPassword?: string;
  checklistPattern?: string;
  notes?: string[];
  footerMessage: string;
}

export interface ResolvedReceiptPrintData {
  printData: PrintData;
  thermalModel: ThermalReceiptModel;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function formatDateLabel(date?: string): string {
  const target = date ? new Date(date) : new Date();
  return target.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getClienteById(clienteId?: string | null): Cliente | undefined {
  if (!clienteId) return undefined;
  return (getClientes() ?? []).find((cliente) => cliente.id === clienteId);
}

function getPessoaById(pessoaId?: string | null): Pessoa | undefined {
  if (!pessoaId) return undefined;
  return (getPessoas() ?? []).find((pessoa) => pessoa.id === pessoaId);
}

function getClienteEndereco(cliente?: Cliente, snapshot?: string): string | undefined {
  if (snapshot?.trim()) return snapshot.trim();
  if (!cliente) return undefined;
  const parts = [cliente.endereco, cliente.cidade, cliente.estado].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function getPessoaEndereco(pessoa?: Pessoa): string | undefined {
  return pessoa?.endereco?.trim() || undefined;
}

async function resolveCompanyInfo(): Promise<EmpresaInfo> {
  const result = await fetchCompany().catch(() => ({ success: false as const }));
  const company = result.success ? result.company : null;
  return {
    nome: company?.nome_fantasia || 'Smart Tech',
    cnpj: company?.cnpj || undefined,
    telefone: company?.telefone || undefined,
    endereco: company?.endereco || undefined,
    cidade: company?.cidade || undefined,
    estado: company?.estado || undefined,
    logo_url: company?.logo_url || undefined,
    slogan: company?.mensagem_rodape || 'Obrigado pela preferencia. Volte sempre.',
  };
}

export async function buildSaleReceiptById(id: string): Promise<ResolvedReceiptPrintData | null> {
  const venda = (await getVendasAsync()).find((item) => item.id === id) || null;
  if (!venda) return null;

  const cliente = getClienteById(venda.clienteId);
  const enderecoCliente = [
    venda.clienteEndereco ?? cliente?.endereco,
    venda.clienteCidade ?? cliente?.cidade,
    venda.clienteEstado ?? cliente?.estado,
  ].filter(Boolean).join(', ') || undefined;

  const itens = venda.itens.map((item) => {
    const noteParts = [
      item.manual_modelo ? `Modelo: ${String(item.manual_modelo).trim()}` : '',
      item.manual_cor ? `Cor: ${String(item.manual_cor).trim()}` : '',
      item.manual_imei ? `IMEI: ${String(item.manual_imei).trim()}` : '',
      item.manual_descricao ? String(item.manual_descricao).trim() : '',
    ].filter(Boolean);

    return {
      nome: item.produtoNome,
      quantidade: item.quantidade,
      preco: item.precoUnitario,
      descricao: noteParts.length ? noteParts.join(' | ') : undefined,
    };
  });

  const total = Number((venda as any).total_liquido ?? (venda as any).totalLiquido ?? (venda as any).total_final ?? venda.total ?? 0);
  const subtotal = Number((venda as any).total_bruto ?? venda.total ?? total);
  const discount = Number((venda as any).desconto ?? 0);

  let installmentsLabel = '';
  if ((venda.formaPagamento === 'credito' || venda.formaPagamento === 'cartao') && total > 0) {
    const numParcelas = venda.parcelas || 1;
    if (numParcelas > 1) {
      installmentsLabel = `${numParcelas}x de ${formatCurrency(total / numParcelas)}`;
    }
  }

  const company = await resolveCompanyInfo();
  const numero = venda.numero_venda ? `V-${venda.numero_venda}` : formatVendaId(venda.id);

  return {
    printData: {
      tipo: 'venda',
      numero,
      clienteNome: venda.clienteNome,
      clienteTelefone: venda.clienteTelefone ?? cliente?.telefone,
      clienteEndereco: enderecoCliente,
      data: venda.data,
      itens,
      valorTotal: total,
      valorBruto: subtotal,
      desconto: discount,
      formaPagamento: venda.formaPagamento,
      parcelas: installmentsLabel,
      cpfCnpj: (cliente as any)?.cpfCnpj ?? cliente?.cpf,
      garantia: venda.warranty_months ? `${venda.warranty_months} ${venda.warranty_months === 1 ? 'mês' : 'meses'}` : undefined,
      termosGarantia: venda.warranty_terms?.trim() || undefined,
      observacoes: venda.observacoes || undefined,
    },
    thermalModel: {
      type: 'sale',
      title: 'Comprovante de venda',
      documentNumber: numero,
      dateLabel: formatDateLabel(venda.data),
      customerName: venda.clienteNome || undefined,
      customerPhone: venda.clienteTelefone ?? cliente?.telefone,
      customerAddress: enderecoCliente,
      company,
      items: itens.map((item) => ({
        label: item.nome,
        quantity: item.quantidade,
        unitPrice: item.preco,
        total: item.preco * item.quantidade,
        note: item.descricao,
      })),
      subtotal,
      discount: discount > 0 ? discount : undefined,
      total,
      paymentLabel: venda.formaPagamento ? String(venda.formaPagamento).toUpperCase() : undefined,
      installmentsLabel: installmentsLabel || undefined,
      notes: [venda.observacoes, venda.warranty_terms].filter(Boolean) as string[],
      footerMessage: company.slogan || 'Obrigado pela preferencia. Volte sempre.',
    },
  };
}

export async function buildReceiptById(id: string): Promise<ResolvedReceiptPrintData | null> {
  const recibo = (getRecibos() ?? []).find((item) => item.id === id);
  if (!recibo) return null;

  const cliente = getClienteById(recibo.clienteId);
  const enderecoCliente = getClienteEndereco(cliente);
  const company = await resolveCompanyInfo();

  return {
    printData: {
      tipo: 'recibo',
      numero: recibo.numero,
      clienteNome: recibo.clienteNome,
      clienteTelefone: cliente?.telefone || recibo.clienteTelefone,
      clienteEndereco: enderecoCliente,
      data: recibo.data,
      descricao: recibo.descricao,
      tipoRecibo: recibo.tipo,
      valorTotal: recibo.valor,
      formaPagamento: recibo.formaPagamento,
      observacoes: recibo.observacoes,
    },
    thermalModel: {
      type: 'receipt',
      title: 'Recibo simples',
      documentNumber: recibo.numero,
      dateLabel: formatDateLabel(recibo.data),
      customerName: recibo.clienteNome,
      customerPhone: cliente?.telefone || recibo.clienteTelefone,
      customerAddress: enderecoCliente,
      company,
      items: [{
        label: recibo.descricao,
        total: recibo.valor,
      }],
      total: recibo.valor,
      paymentLabel: recibo.formaPagamento ? String(recibo.formaPagamento).toUpperCase() : undefined,
      notes: [recibo.observacoes].filter(Boolean) as string[],
      footerMessage: company.slogan || 'Obrigado pela preferencia. Volte sempre.',
    },
  };
}

export async function buildServiceOrderReceiptById(id: string): Promise<ResolvedReceiptPrintData | null> {
  const ordem = (await getOrdensAsync()).find((item) => item.id === id) || null;
  if (!ordem) return null;

  const cliente = getClienteById(ordem.clienteId);
  const enderecoCliente = getClienteEndereco(cliente);
  const total = Number(ordem.total_bruto || ordem.valorTotal || ((ordem.valorServico || 0) + (ordem.valorPecas || 0)));
  const company = await resolveCompanyInfo();
  const garantia = ordem.warranty_months ? `${ordem.warranty_months} ${ordem.warranty_months === 1 ? 'mês' : 'meses'}` : undefined;

  const items: ThermalReceiptLineItem[] = [];
  if ((ordem.valorServico || 0) > 0) {
    items.push({ label: 'Serviço técnico', total: Number(ordem.valorServico || 0) });
  }
  if ((ordem.valorPecas || 0) > 0) {
    items.push({ label: 'Peças', total: Number(ordem.valorPecas || 0) });
  }
  if (items.length === 0) {
    items.push({ label: ordem.equipamento || 'Ordem de serviço', total });
  }

  return {
    printData: {
      tipo: 'ordem-servico',
      numero: ordem.numero,
      clienteNome: ordem.clienteNome,
      clienteTelefone: ordem.clienteTelefone || cliente?.telefone,
      clienteEndereco: enderecoCliente,
      data: ordem.dataAbertura,
      equipamento: ordem.equipamento,
      marca: ordem.marca,
      modelo: ordem.modelo,
      cor: ordem.cor,
      garantia,
      defeito: ordem.defeito,
      reparo: ordem.laudoTecnico || undefined,
      situacao: ordem.situacao,
      tecnico: ordem.tecnico,
      dataConclusao: ordem.dataConclusao,
      valorServico: ordem.valorServico,
      valorPecas: ordem.valorPecas,
      valorTotal: total,
      valorBruto: total,
      formaPagamento: ordem.formaPagamento,
      parcelas: ordem.parcelas ? `${ordem.parcelas}x` : undefined,
      observacoes: ordem.observacoes,
      termosGarantia: ordem.warranty_terms_snapshot || undefined,
      acessorios: ordem.acessorios || [],
      laudoTecnico: ordem.laudoTecnico || undefined,
    },
    thermalModel: {
      type: 'service-order',
      title: 'Ordem de serviço',
      documentNumber: ordem.numero,
      dateLabel: formatDateLabel(ordem.dataAbertura),
      customerName: ordem.clienteNome,
      customerPhone: ordem.clienteTelefone || cliente?.telefone,
      customerAddress: enderecoCliente,
      company,
      items,
      total,
      paymentLabel: ordem.formaPagamento ? String(ordem.formaPagamento).toUpperCase() : undefined,
      notes: [ordem.defeito, ordem.laudoTecnico, ordem.observacoes, ordem.warranty_terms_snapshot].filter(Boolean) as string[],
      footerMessage: company.slogan || 'Obrigado pela preferencia. Volte sempre.',
    },
  };
}

export async function buildServiceOrderChecklistById(id: string): Promise<ResolvedReceiptPrintData | null> {
  const ordem = (await getOrdensAsync()).find((item) => item.id === id) || null;
  if (!ordem) return null;

  const cliente = getClienteById(ordem.clienteId);
  const enderecoCliente = getClienteEndereco(cliente);
  const company = await resolveCompanyInfo();
  const acessorios = (ordem.acessorios || []).filter(Boolean);
  const notes = [
    ordem.equipamento ? `Equipamento: ${ordem.equipamento}` : '',
    ordem.marca ? `Marca: ${ordem.marca}` : '',
    ordem.modelo ? `Modelo: ${ordem.modelo}` : '',
    ordem.cor ? `Cor: ${ordem.cor}` : '',
    ordem.defeito ? `Defeito: ${ordem.defeito}` : '',
    ordem.senhaCliente ? `Senha: ${ordem.senhaCliente}` : '',
    ordem.senhaPadrao ? 'Padrão de desbloqueio informado' : '',
    acessorios.length ? `Acessórios: ${acessorios.join(', ')}` : 'Acessórios: nenhum informado',
  ].filter(Boolean) as string[];

  return {
    printData: {
      tipo: 'checklist',
      numero: ordem.numero,
      clienteNome: ordem.clienteNome,
      clienteTelefone: ordem.clienteTelefone || cliente?.telefone,
      clienteEndereco: enderecoCliente,
      data: ordem.dataAbertura,
      equipamento: ordem.equipamento,
      marca: ordem.marca,
      modelo: ordem.modelo,
      cor: ordem.cor,
      defeito: ordem.defeito,
      senhaCliente: ordem.senhaCliente,
      senhaPadrao: ordem.senhaPadrao,
      acessorios,
    },
    thermalModel: {
      type: 'service-order-checklist',
      title: 'Checklist de entrada',
      documentNumber: ordem.numero,
      dateLabel: formatDateLabel(ordem.dataAbertura),
      customerName: ordem.clienteNome,
      customerPhone: ordem.clienteTelefone || cliente?.telefone,
      customerAddress: enderecoCliente,
      company,
      items: [
        {
          label: ordem.equipamento || 'Equipamento em análise',
          total: 0,
          note: [ordem.marca, ordem.modelo, ordem.cor].filter(Boolean).join(' | ') || undefined,
        },
      ],
      total: 0,
      checklistPassword: ordem.senhaCliente || undefined,
      checklistPattern: ordem.senhaPadrao || undefined,
      notes,
      footerMessage: company.slogan || 'Obrigado pela preferencia. Volte sempre.',
    },
  };
}

export async function buildChargeReceiptById(id: string): Promise<ResolvedReceiptPrintData | null> {
  const cobranca = (getCobrancas() ?? []).find((item) => item.id === id) as Cobranca | undefined;
  if (!cobranca) return null;

  const cliente = getClienteById(cobranca.clienteId);
  const enderecoCliente = getClienteEndereco(cliente);
  const company = await resolveCompanyInfo();
  const dataComprovante = cobranca.status === 'paga' && cobranca.dataPagamento
    ? cobranca.dataPagamento
    : cobranca.dataCriacao;
  const notes = [
    cobranca.status === 'paga'
      ? `Cobrança quitada em ${formatDateLabel(cobranca.dataPagamento || cobranca.dataCriacao)}`
      : `Vencimento: ${formatDateLabel(cobranca.vencimento)}`,
    cobranca.observacoes || '',
  ].filter(Boolean) as string[];

  return {
    printData: {
      tipo: 'comprovante',
      numero: formatCobrancaId(cobranca.id),
      clienteNome: cobranca.clienteNome,
      clienteTelefone: cliente?.telefone,
      clienteEndereco: enderecoCliente,
      data: dataComprovante,
      descricao: cobranca.descricao,
      valorTotal: cobranca.valor,
      formaPagamento: cobranca.formaPagamento,
      observacoes: notes.join(' | '),
    },
    thermalModel: {
      type: 'charge',
      title: cobranca.status === 'paga' ? 'Comprovante de pagamento' : 'Comprovante de cobrança',
      documentNumber: formatCobrancaId(cobranca.id),
      dateLabel: formatDateLabel(dataComprovante),
      customerName: cobranca.clienteNome,
      customerPhone: cliente?.telefone,
      customerAddress: enderecoCliente,
      company,
      items: [{
        label: cobranca.descricao || 'Cobrança',
        total: cobranca.valor,
        note: cobranca.status === 'paga'
          ? `Pagamento: ${String(cobranca.formaPagamento || 'não informado').toUpperCase()}`
          : `Status: ${String(cobranca.status || 'pendente').toUpperCase()}`,
      }],
      total: cobranca.valor,
      paymentLabel: cobranca.formaPagamento ? String(cobranca.formaPagamento).toUpperCase() : undefined,
      notes,
      footerMessage: company.slogan || 'Obrigado pela preferencia. Volte sempre.',
    },
  };
}

export async function buildUsedPurchaseReceiptById(id: string): Promise<ResolvedReceiptPrintData | null> {
  const usado = getUsadoById(id);
  if (!usado) return null;

  const vendedor = getPessoaById(usado.vendedorId);
  const company = await resolveCompanyInfo();
  const numero = `UC-${String(usado.id).slice(-6).toUpperCase()}`;
  const detalhes = [usado.imei ? `IMEI: ${usado.imei}` : '', usado.descricao || '']
    .filter(Boolean)
    .join(' | ');

  return {
    printData: {
      tipo: 'comprovante',
      numero,
      clienteNome: vendedor?.nome,
      clienteTelefone: vendedor?.telefone,
      clienteEndereco: getPessoaEndereco(vendedor),
      cpfCnpj: vendedor?.cpfCnpj,
      data: usado.created_at,
      itens: [
        {
          nome: usado.titulo,
          quantidade: 1,
          preco: Number(usado.valorCompra || 0),
          descricao: detalhes || undefined,
        },
      ],
      valorTotal: Number(usado.valorCompra || 0),
      formaPagamento: 'COMPRA (USADO)',
      termosCompra: usado.termos_compra_snapshot?.trim() || undefined,
      observacoes: usado.descricao?.trim() || undefined,
    },
    thermalModel: {
      type: 'used-purchase',
      title: 'Comprovante de compra',
      documentNumber: numero,
      dateLabel: formatDateLabel(usado.created_at),
      customerName: vendedor?.nome,
      customerPhone: vendedor?.telefone,
      customerAddress: getPessoaEndereco(vendedor),
      company,
      items: [
        {
          label: usado.titulo,
          quantity: 1,
          unitPrice: Number(usado.valorCompra || 0),
          total: Number(usado.valorCompra || 0),
          note: detalhes || undefined,
        },
      ],
      total: Number(usado.valorCompra || 0),
      paymentLabel: 'COMPRA (USADO)',
      notes: [usado.termos_compra_snapshot, usado.descricao].filter(Boolean) as string[],
      footerMessage: company.slogan || 'Obrigado pela preferencia. Volte sempre.',
    },
  };
}

export async function buildUsedSaleReceiptById(id: string): Promise<ResolvedReceiptPrintData | null> {
  const venda = getVendaUsadoById(id);
  if (!venda) return null;

  const usado = getUsadoById(venda.usadoId) as Usado | null;
  const comprador = getPessoaById(venda.compradorId);
  const company = await resolveCompanyInfo();
  const numero = `UV-${String(venda.id).slice(-6).toUpperCase()}`;
  const garantia = venda.warranty_months
    ? `${venda.warranty_months} ${venda.warranty_months === 1 ? 'mês' : 'meses'}`
    : undefined;
  const detalhes = [usado?.imei ? `IMEI: ${usado.imei}` : '', usado?.descricao || '']
    .filter(Boolean)
    .join(' | ');

  return {
    printData: {
      tipo: 'venda',
      numero,
      clienteNome: comprador?.nome || 'Cliente',
      clienteTelefone: comprador?.telefone,
      clienteEndereco: getPessoaEndereco(comprador),
      cpfCnpj: comprador?.cpfCnpj,
      data: venda.dataVenda,
      itens: [
        {
          nome: usado?.titulo || 'Item vendido',
          quantidade: 1,
          preco: Number(venda.valorVenda || 0),
          descricao: detalhes || undefined,
        },
      ],
      valorTotal: Number(venda.valorVenda || 0),
      formaPagamento: venda.formaPagamento,
      garantia,
      termosGarantia: venda.warranty_terms?.trim() || undefined,
      observacoes: venda.observacoes?.trim() || undefined,
    },
    thermalModel: {
      type: 'used-sale',
      title: 'Comprovante de venda',
      documentNumber: numero,
      dateLabel: formatDateLabel(venda.dataVenda),
      customerName: comprador?.nome || 'Cliente',
      customerPhone: comprador?.telefone,
      customerAddress: getPessoaEndereco(comprador),
      company,
      items: [
        {
          label: usado?.titulo || 'Item vendido',
          quantity: 1,
          unitPrice: Number(venda.valorVenda || 0),
          total: Number(venda.valorVenda || 0),
          note: detalhes || undefined,
        },
      ],
      total: Number(venda.valorVenda || 0),
      paymentLabel: venda.formaPagamento ? String(venda.formaPagamento).toUpperCase() : undefined,
      notes: [garantia, venda.warranty_terms, venda.observacoes].filter(Boolean) as string[],
      footerMessage: company.slogan || 'Obrigado pela preferencia. Volte sempre.',
    },
  };
}

export async function buildTestReceipt(): Promise<ResolvedReceiptPrintData> {
  const company = await resolveCompanyInfo();
  const now = new Date().toISOString();

  return {
    printData: {
      tipo: 'venda',
      numero: 'TESTE-001',
      clienteNome: 'Cliente de teste',
      clienteTelefone: '(43) 99999-9999',
      clienteEndereco: 'Rua Exemplo, 123',
      data: now,
      itens: [
        { nome: 'Impressão térmica 58/80mm', quantidade: 1, preco: 25 },
        { nome: 'Teste de alinhamento', quantidade: 1, preco: 0 },
      ],
      valorTotal: 25,
      valorBruto: 25,
      formaPagamento: 'dinheiro',
      observacoes: 'Cupom de teste para validar papel, fonte, logo e alinhamento.',
    },
    thermalModel: {
      type: 'test',
      title: 'Impressão de teste',
      documentNumber: 'TESTE-001',
      dateLabel: formatDateLabel(now),
      customerName: 'Cliente de teste',
      customerPhone: '(43) 99999-9999',
      customerAddress: 'Rua Exemplo, 123',
      company,
      items: [
        { label: 'Impressão térmica 58/80mm', quantity: 1, unitPrice: 25, total: 25, note: 'Valida largura e espaçamento' },
        { label: 'Teste de alinhamento', quantity: 1, unitPrice: 0, total: 0, note: 'Confere corte e centralização' },
      ],
      subtotal: 25,
      total: 25,
      paymentLabel: 'DINHEIRO',
      notes: ['Se este cupom saiu correto, a impressora está pronta para uso.'],
      footerMessage: company.slogan || 'Obrigado pela preferencia. Volte sempre.',
    },
  };
}

export async function resolveReceiptPrintData(type: PrintableReceiptType, id: string): Promise<ResolvedReceiptPrintData | null> {
  if (type === 'sale') return buildSaleReceiptById(id);
  if (type === 'receipt') return buildReceiptById(id);
  if (type === 'service-order') return buildServiceOrderReceiptById(id);
  if (type === 'service-order-checklist') return buildServiceOrderChecklistById(id);
  if (type === 'charge') return buildChargeReceiptById(id);
  if (type === 'used-purchase') return buildUsedPurchaseReceiptById(id);
  if (type === 'used-sale') return buildUsedSaleReceiptById(id);
  if (type === 'test') return buildTestReceipt();
  return null;
}
