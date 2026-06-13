import { Venda, ItemVenda, Usado, UsadoVenda, Pessoa } from '@/types';
import { createAppRepository } from '@/lib/repository/create-app-repository';
import { generateId } from '@/lib/storage';

export interface SoldDevice {
  id: string;
  vendaId: string;
  dataVenda?: string;
  clienteNome?: string;
  clienteTelefone?: string;
  marca?: string;
  modelo: string;
  imei?: string;
  descricao?: string;
  estado?: string;
  valor: number;
  warranty_months?: number;
  sale_terms?: string;
  storeId?: string;
  created_at?: string;
}

export const soldDevicesRepo = createAppRepository<SoldDevice>(
  'sold_devices',
  'sold_devices',
  { enableSync: true, syncImmediately: true }
);

function readItemBrand(item: ItemVenda): string | undefined {
  return undefined;
}

function readItemModel(item: ItemVenda): string | undefined {
  return item.manual_modelo?.trim() || item.produtoNome?.trim() || undefined;
}

function readItemImei(item: ItemVenda): string | undefined {
  return item.manual_imei?.trim() || undefined;
}

function readItemDescription(item: ItemVenda): string | undefined {
  return item.manual_descricao?.trim() || undefined;
}

function shouldRegisterAsSoldDevice(item: ItemVenda): boolean {
  if (item.manual_imei?.trim()) return true;
  if (item.manual_modelo?.trim()) return true;

  const nome = String(item.produtoNome || '').toLowerCase();
  return /(iphone|samsung|xiaomi|moto|motorola|redmi|galaxy|celular|smartphone)/.test(nome);
}

function buildModelLabel(item: ItemVenda): string {
  return readItemModel(item) || 'Celular';
}

export async function saveSoldDevicesFromVenda(venda: Venda): Promise<number> {
  const itens = (venda.itens || []).filter(shouldRegisterAsSoldDevice);
  if (!itens.length) return 0;

  const existing = soldDevicesRepo.list();
  let saved = 0;

  for (const item of itens) {
    const modelo = buildModelLabel(item);
    const imei = readItemImei(item);

    const already = existing.find(
      (d: SoldDevice) => d.vendaId === venda.id && (imei ? d.imei === imei : d.modelo === modelo)
    );
    if (already) continue;

    const unit = Number(item.precoUnitario || 0);
    const subtotal = Number(item.subtotal || unit * Number(item.quantidade || 0) || 0);

    const device: SoldDevice = {
      id: generateId(),
      vendaId: venda.id,
      dataVenda: venda.data,
      clienteNome: venda.clienteNome,
      clienteTelefone: venda.clienteTelefone,
      marca: readItemBrand(item),
      modelo,
      imei,
      descricao: readItemDescription(item),
      valor: subtotal,
      warranty_months: venda.warranty_months,
      sale_terms: venda.warranty_terms,
      storeId: venda.storeId,
      created_at: new Date().toISOString(),
    };

    await soldDevicesRepo.upsert(device);
    saved += 1;
  }

  return saved;
}

export async function saveSoldDeviceFromUsadoVenda(params: {
  usado: Usado;
  venda: UsadoVenda;
  comprador?: Pessoa | null;
}): Promise<boolean> {
  const { usado, venda, comprador } = params;
  const existing = soldDevicesRepo.list();
  const modelo = usado.titulo?.trim() || 'Celular';
  const imei = usado.imei?.trim() || undefined;

  const already = existing.find(
    (d: SoldDevice) => d.vendaId === venda.id && (imei ? d.imei === imei : d.modelo === modelo)
  );
  if (already) return false;

  const device: SoldDevice = {
    id: generateId(),
    vendaId: venda.id,
    dataVenda: venda.dataVenda,
    clienteNome: comprador?.nome,
    clienteTelefone: comprador?.telefone,
    modelo,
    imei,
    descricao: usado.descricao,
    valor: Number(venda.valorVenda ?? 0),
    warranty_months: venda.warranty_months,
    sale_terms: venda.warranty_terms,
    storeId: venda.storeId,
    created_at: new Date().toISOString(),
  };

  await soldDevicesRepo.upsert(device);
  return true;
}
