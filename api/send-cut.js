import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAILS = [
  "luiscgarinian@gmail.com",
  "ferhughes04@gmail.com",
  "saiv1221hughes@gmail.com",
];

function formatCurrency(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { cut, employee } = req.body;
  if (!cut) return res.status(400).json({ error: "Missing data" });

  const timeStr = new Date(cut.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const dateStr = new Date(cut.timestamp).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const neto = (cut.total_corte || 0) - (cut.total_gastos || 0);

  let gastoRows = "";
  try {
    const gastos = typeof cut.gastos === "string" ? JSON.parse(cut.gastos) : (cut.gastos || []);
    gastoRows = gastos.filter(g => g.concepto || g.monto).map(g =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0e8d8;">${g.concepto || "—"}</td><td style="padding:6px 12px;border-bottom:1px solid #f0e8d8;text-align:right;">${formatCurrency(g.monto)}</td></tr>`
    ).join("");
  } catch {}

  const netoColor = neto >= 0 ? "#2E7D32" : "#C62828";

  try {
    await resend.emails.send({
      from: "Che Che Café <onboarding@resend.dev>",
      to: ADMIN_EMAILS,
      subject: `☕ Corte de turno — ${cut.store_name} · ${dateStr}`,
      html: `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">
          <div style="background:#3B1F0E;padding:24px 28px;text-align:center;">
            <h1 style="color:#F5EDD7;font-size:20px;margin:0;">☕ Che Che Café</h1>
            <p style="color:#EDE0C4;font-size:12px;margin:6px 0 0;">Reporte de Corte de Turno</p>
          </div>

          <div style="padding:20px 28px;background:#FDF8EE;border-bottom:1px solid #EDE0C4;">
            <table style="width:100%;">
              <tr>
                <td style="font-size:13px;color:#6D6D6D;">Tienda</td>
                <td style="font-size:13px;font-weight:500;text-align:right;">${cut.store_name}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6D6D6D;">Cajero</td>
                <td style="font-size:13px;font-weight:500;text-align:right;">${employee?.full_name || cut.employee_name || "—"}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6D6D6D;">Hora</td>
                <td style="font-size:13px;text-align:right;">${timeStr} · ${dateStr}</td>
              </tr>
            </table>
          </div>

          <div style="padding:24px 28px;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
              <tr style="background:#EDE0C4;">
                <td colspan="2" style="padding:10px 12px;font-size:13px;font-weight:500;color:#3B1F0E;">Resumen financiero</td>
              </tr>
              <tr>
                <td style="padding:10px 12px;font-size:14px;border-bottom:1px solid #f0e8d8;">Total del corte</td>
                <td style="padding:10px 12px;font-size:14px;font-weight:500;text-align:right;border-bottom:1px solid #f0e8d8;color:#2E7D32;">${formatCurrency(cut.total_corte)}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px;font-size:14px;border-bottom:1px solid #f0e8d8;">Total egresos</td>
                <td style="padding:10px 12px;font-size:14px;font-weight:500;text-align:right;border-bottom:1px solid #f0e8d8;color:#E65100;">${formatCurrency(cut.total_gastos)}</td>
              </tr>
              ${cut.propinas > 0 ? `<tr>
                <td style="padding:10px 12px;font-size:14px;border-bottom:1px solid #f0e8d8;">Propinas del turno</td>
                <td style="padding:10px 12px;font-size:14px;font-weight:500;text-align:right;border-bottom:1px solid #f0e8d8;color:#C8862A;">${formatCurrency(cut.propinas)}</td>
              </tr>` : ""}
              <tr style="background:#FDF8EE;">
                <td style="padding:12px 12px;font-size:15px;font-weight:600;">Neto del turno</td>
                <td style="padding:12px 12px;font-size:15px;font-weight:700;text-align:right;color:${netoColor};">${formatCurrency(neto)}</td>
              </tr>
            </table>

            ${gastoRows ? `
            <p style="font-size:13px;font-weight:500;margin-bottom:8px;color:#3B1F0E;">Detalle de egresos:</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
              <thead>
                <tr style="background:#EDE0C4;">
                  <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6D6D6D;">Concepto</th>
                  <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6D6D6D;">Monto</th>
                </tr>
              </thead>
              <tbody>${gastoRows}</tbody>
            </table>` : ""}

            ${cut.notas ? `
            <div style="background:#FDF8EE;border-left:4px solid #EDE0C4;padding:12px 14px;border-radius:0 8px 8px 0;margin-bottom:16px;">
              <p style="font-size:12px;color:#6D6D6D;margin:0 0 4px;">Notas del turno:</p>
              <p style="font-size:13px;color:#3B1F0E;margin:0;">${cut.notas}</p>
            </div>` : ""}

            ${cut.tiene_gastos_no_aprobados ? `
            <div style="background:#FFEBEE;border-left:4px solid #C62828;padding:12px 14px;border-radius:0 8px 8px 0;">
              <p style="font-size:13px;color:#C62828;font-weight:500;margin:0;">⚠️ Este corte contiene gastos que requieren revisión y autorización.</p>
            </div>` : ""}
          </div>

          <div style="background:#EDE0C4;padding:14px 28px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#6D6D6D;">Reporte automático — Sistema de asistencia Che Che Café</p>
          </div>
        </div>`,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
