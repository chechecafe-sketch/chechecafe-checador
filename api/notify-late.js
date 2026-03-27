import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const VICTORIA_EMAIL = "luiscgarinian@gmail.com";

function formatMin(mins) {
  if (!mins || mins === 0) return "0 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { record, employee } = req.body;
  if (!record || !employee) return res.status(400).json({ error: "Missing data" });

  const timeStr = new Date(record.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const dateStr = new Date(record.timestamp).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  try {
    // Notify the employee
    if (employee.email) {
      await resend.emails.send({
        from: "Che Che Café <onboarding@resend.dev>",
        to: [employee.email],
        subject: record.note
          ? "⚠️ Registro fuera de ventana — Che Che Café"
          : `⏰ Retardo registrado — ${formatMin(record.lateMinutes)}`,
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
            <div style="background:#3B1F0E;padding:20px;text-align:center;">
              <h2 style="color:#F5EDD7;margin:0;">☕ Che Che Café</h2>
            </div>
            <div style="padding:24px;background:#FDF8EE;">
              <p>Hola <strong>${employee.fullName}</strong>,</p>
              ${record.lateMinutes > 0 ? `<p>Se registró un retardo de <strong style="color:#E65100;">${formatMin(record.lateMinutes)}</strong> el ${dateStr} a las ${timeStr} en la tienda <strong>${record.storeName}</strong>.</p>` : ""}
              ${record.note ? `<p style="color:#C62828;"><strong>${record.note}</strong></p>` : ""}
              <p style="color:#6D6D6D;font-size:13px;">Recuerda que los minutos de retardo se acumulan cada quincena. A partir de 15 minutos se registra retardo.</p>
            </div>
            <div style="background:#EDE0C4;padding:12px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#6D6D6D;">Sistema de asistencia Che Che Café</p>
            </div>
          </div>`,
      });
    }

    // If intermedio note, also notify Victoria
    if (record.note) {
      await resend.emails.send({
        from: "Che Che Café <onboarding@resend.dev>",
        to: [VICTORIA_EMAIL],
        subject: `⚠️ Registro intermedio fuera de ventana — ${employee.fullName}`,
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
            <div style="background:#3B1F0E;padding:20px;text-align:center;">
              <h2 style="color:#F5EDD7;margin:0;">☕ Che Che Café — Aviso Admin</h2>
            </div>
            <div style="padding:24px;background:#FDF8EE;">
              <p><strong>${employee.fullName}</strong> registró entrada de turno intermedio <strong>fuera de la ventana 10:00–11:00am</strong>.</p>
              <ul style="color:#3B1F0E;line-height:2;">
                <li>Tienda: ${record.storeName}</li>
                <li>Hora de registro: ${timeStr}</li>
                <li>Fecha: ${dateStr}</li>
                <li>ID empleado: ${employee.employeeId}</li>
              </ul>
              <p style="color:#C62828;font-weight:500;">Este registro requiere revisión.</p>
            </div>
          </div>`,
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
