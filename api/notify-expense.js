import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const VICTORIA_EMAIL = "luiscgarinian@gmail.com";

function formatCurrency(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { cut, employee, unapprovedExpenses } = req.body;
  if (!cut || !employee) return res.status(400).json({ error: "Missing data" });

  const timeStr = new Date(cut.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const dateStr = new Date(cut.timestamp).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  const expenseRows = unapprovedExpenses.map(g =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0e8d8;">${g.concepto}</td><td style="padding:6px 12px;border-bottom:1px solid #f0e8d8;font-weight:500;">${formatCurrency(g.monto)}</td></tr>`
  ).join("");

  try {
    await resend.emails.send({
      from: "Che Che Café <onboarding@resend.dev>",
      to: [VICTORIA_EMAIL],
      subject: `⚠️ Gastos no autorizados — ${employee.full_name || employee.fullName} · ${cut.store_name}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
          <div style="background:#3B1F0E;padding:20px;text-align:center;">
            <h2 style="color:#F5EDD7;margin:0;">☕ Che Che Café — Aviso Admin</h2>
          </div>
          <div style="padding:24px;background:#FDF8EE;">
            <p>Se registraron gastos <strong>fuera de los conceptos autorizados</strong> en el corte de turno.</p>
            <ul style="color:#3B1F0E;line-height:2;margin-bottom:16px;">
              <li>Empleado: <strong>${employee.full_name || employee.fullName}</strong></li>
              <li>Tienda: ${cut.store_name}</li>
              <li>Fecha: ${dateStr} a las ${timeStr}</li>
            </ul>
            <p style="font-weight:500;margin-bottom:10px;">Gastos no autorizados:</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
              <thead>
                <tr style="background:#EDE0C4;">
                  <th style="padding:8px 12px;text-align:left;font-size:13px;">Concepto</th>
                  <th style="padding:8px 12px;text-align:left;font-size:13px;">Monto</th>
                </tr>
              </thead>
              <tbody>${expenseRows}</tbody>
            </table>
            <p style="color:#C62828;font-weight:500;">Por favor valida estos gastos con el empleado.</p>
            <p style="color:#6D6D6D;font-size:13px;">Gastos aprobados sin autorización previa: café, leche, hielo, artículos de operación básica.</p>
          </div>
          <div style="background:#EDE0C4;padding:12px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#6D6D6D;">Sistema de asistencia Che Che Café</p>
          </div>
        </div>`,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
