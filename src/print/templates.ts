
export function receiptInnerHTML(data: {
  store: string;
  cnpj?: string;
  address?: string;
  phone?: string;
  items: Array<{ name: string; qty: number; price: number }>;
  subtotal: number;
  discount?: number;
  total: number;
  payment?: string;
  footer?: string;
}) {
  const money = (v: number) => v.toFixed(2).replace(".", ",");

  const lines = data.items.map(i => `
    <tr>
      <td style="width:60%;font-size:10px">${i.name}</td>
      <td style="width:10%;text-align:right;font-size:10px">${i.qty}</td>
      <td style="width:15%;text-align:right;font-size:10px">${money(i.price)}</td>
      <td style="width:15%;text-align:right;font-size:10px">${money(i.qty * i.price)}</td>
    </tr>
  `).join("");

  return `
  <div style="padding:2mm;border:0.3mm solid #111;border-radius:2mm">
    <div style="text-align:center;font-weight:900;font-size:12px">${data.store}</div>
    ${data.cnpj ? `<div style="text-align:center;font-size:9px">CNPJ: ${data.cnpj}</div>` : ``}
    ${data.address ? `<div style="text-align:center;font-size:9px">${data.address}</div>` : ``}
    ${data.phone ? `<div style="text-align:center;font-size:9px">${data.phone}</div>` : ``}

    <div style="margin:1.5mm 0;border-bottom:0.3mm dashed #111"></div>

    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th style="text-align:left;font-size:9px">Item</th>
          <th style="text-align:right;font-size:9px">Qtd</th>
          <th style="text-align:right;font-size:9px">R$</th>
          <th style="text-align:right;font-size:9px">Total</th>
        </tr>
      </thead>
      <tbody>${lines}</tbody>
    </table>

    <div style="margin:1.5mm 0;border-bottom:0.3mm dashed #111"></div>

    <div style="display:flex;justify-content:space-between;font-size:10px">
      <span>Subtotal</span><span>R$ ${money(data.subtotal)}</span>
    </div>
    ${typeof data.discount === "number" ? `
      <div style="display:flex;justify-content:space-between;font-size:10px">
        <span>Desconto</span><span>- R$ ${money(data.discount)}</span>
      </div>
    ` : ``}
    <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:900;margin-top:1mm">
      <span>Total</span><span>R$ ${money(data.total)}</span>
    </div>

    ${data.payment ? `<div style="margin-top:1mm;font-size:9px">Pagamento: ${data.payment}</div>` : ``}

    ${data.footer ? `<div style="margin-top:2mm;text-align:center;font-size:9px">${data.footer}</div>` : ``}
  </div>
  `;
}

export function serviceOrderInnerHTML(data: {
  store: string;
  osNumber: string;
  customer: string;
  phone?: string;
  device?: string;
  imei?: string;
  issue?: string;
  notes?: string;
  total?: string;
  warranty?: string;
}) {
  return `
  <div style="padding:2mm;border:0.3mm solid #111;border-radius:2mm">
    <div style="text-align:center;font-weight:900;font-size:12px">${data.store}</div>
    <div style="display:flex;justify-content:space-between;margin-top:1mm;font-size:10px">
      <span>OS: <b>${data.osNumber}</b></span>
      <span>${new Date().toLocaleDateString("pt-BR")}</span>
    </div>

    <div style="margin:1.5mm 0;border-bottom:0.3mm solid #111"></div>

    <div style="font-size:10px"><b>Cliente:</b> ${data.customer}</div>
    ${data.phone ? `<div style="font-size:10px"><b>Telefone:</b> ${data.phone}</div>` : ``}
    ${data.device ? `<div style="font-size:10px"><b>Aparelho:</b> ${data.device}</div>` : ``}
    ${data.imei ? `<div style="font-size:10px"><b>IMEI:</b> ${data.imei}</div>` : ``}

    ${data.issue ? `<div style="margin-top:1mm;font-size:10px"><b>Defeito:</b><br/>${data.issue}</div>` : ``}
    ${data.notes ? `<div style="margin-top:1mm;font-size:10px"><b>Observações:</b><br/>${data.notes}</div>` : ``}

    ${data.total ? `<div style="margin-top:1mm;font-size:11px"><b>Total:</b> ${data.total}</div>` : ``}

    <div style="margin:1.5mm 0;border-bottom:0.3mm solid #111"></div>

    ${data.warranty ? `<div style="font-size:9px;line-height:1.2">${data.warranty}</div>` : ``}

    <div style="margin-top:2mm;font-size:9px;display:flex;justify-content:space-between;gap:2mm">
      <div style="flex:1;border-top:0.3mm solid #111;text-align:center;padding-top:1mm">Assinatura Cliente</div>
      <div style="flex:1;border-top:0.3mm solid #111;text-align:center;padding-top:1mm">Assinatura Técnico</div>
    </div>
  </div>
  `;
}

export function labelInnerHTML(data: {
  title: string;
  line1?: string;
  line2?: string;
  qrDataUrl?: string;
}) {
  const qr = data.qrDataUrl
    ? `<img src="${data.qrDataUrl}" style="width:18mm;height:18mm;border:0.3mm solid #111;border-radius:2mm" />`
    : ``;

  return `
  <div style="padding:2mm;border:0.3mm solid #111;border-radius:2mm">
    <div style="font-weight:900;font-size:12px">${data.title}</div>
    ${data.line1 ? `<div style="font-size:10px">${data.line1}</div>` : ``}
    ${data.line2 ? `<div style="font-size:10px">${data.line2}</div>` : ``}
    ${qr ? `<div style="margin-top:2mm">${qr}</div>` : ``}
  </div>
  `;
}
