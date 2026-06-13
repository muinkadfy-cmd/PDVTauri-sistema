
/**
 * Examples of printable INNER HTML.
 * Note: printOrFallback() wraps it into .print-root 58/80mm.
 */
export function businessCardInnerHTML(data: {
  title: string;
  tagline?: string;
  phone?: string;
  whatsapp?: string;
  logoDataUrl?: string;
  qrDataUrl?: string;
}) {
  const { title, tagline, phone, whatsapp, logoDataUrl, qrDataUrl } = data;

  const logo = logoDataUrl
    ? `<div style="width:12mm;height:12mm;border-radius:2mm;overflow:hidden;border:0.3mm solid #111;">
         <img src="${logoDataUrl}" style="width:100%;height:100%;object-fit:cover" />
       </div>`
    : `<div style="width:12mm;height:12mm;border-radius:2mm;border:0.3mm solid #111;display:flex;align-items:center;justify-content:center;font-weight:800;">
         ${title.slice(0,2).toUpperCase()}
       </div>`;

  const qr = qrDataUrl
    ? `<img src="${qrDataUrl}" style="width:16mm;height:16mm;border-radius:2mm;border:0.3mm solid #111;" />`
    : `<div style="width:16mm;height:16mm;border-radius:2mm;border:0.3mm solid #111;display:flex;align-items:center;justify-content:center;font-size:10px">
         QR
       </div>`;

  return `
  <div style="border:0.4mm solid #111;border-radius:3mm;padding:3mm;">
    <div style="display:flex;gap:2.5mm;align-items:center;justify-content:space-between;">
      <div style="display:flex;gap:2.5mm;align-items:center;">
        ${logo}
        <div style="line-height:1.1">
          <div style="font-weight:900;font-size:12px;">${title}</div>
          ${tagline ? `<div style="font-size:10px;opacity:.9">${tagline}</div>` : ``}
          <div style="margin-top:1mm;font-size:10px">
            ${phone ? `• ${phone}<br/>` : ``}
            ${whatsapp ? `• WhatsApp` : ``}
          </div>
        </div>
      </div>
      ${qr}
    </div>

    <div style="margin-top:2mm;border-bottom:0.3mm solid #111"></div>

    <div style="margin-top:1.5mm;font-size:9px;opacity:.85;text-align:right">
      Fale conosco
    </div>
  </div>
  `;
}
