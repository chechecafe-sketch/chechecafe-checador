import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAILS = [
  "luiscgarinian@me.com",
  "ferhughes04@gmail.com",
  "saiv1221hughes@gmail.com",
];

const STORES = [
  { id: "SMR", name: "Santa María La Ribera" },
  { id: "TAB", name: "Tabacalera" },
  { id: "JUA", name: "Juárez" },
  { id: "CEN", name: "Centro" },
  { id: "JAR", name: "Jardín" },
  { id: "DVA", name: "Del Valle" },
];

function formatMin(mins) {
  if (!mins || mins === 0) return "0 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function getDateRange(type) {
  const now = new Date();
  let start;
  if (type === "diario") {
    start = new Date(now); start.setHours(0, 0, 0, 0);
  } else if (type === "semanal") {
    start = new Date(now); start.setDate(now.getDate() - 7);
  } else {
    const day = now.getDate();
    start = day <= 15
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), now.getMonth(), 16);
  }
  return start;
}

function buildHtml(type, records, employees) {
  const start = getDateRange(type);
  const filtered = records.filter(r => new Date(r.timestamp) >= start);
  const now = new Date();

  const storeBlocks = STORES.map(store => {
    const emps = Object.values(employees).filter(e => e.storeId === store.id);
    if (!emps.length) return "";
    const storeRecs = filtered.filter(r => r.storeId === store.id);
    const lateRecs = storeRecs.filter(r => r.lateMinutes > 0);
    const onTime = storeRecs.filter(r => r.lateMinutes === 0).length;

    const rows = emps.map(e => {
      const eRecs = storeRecs.filter(r => r.employeeId === e.employeeId);
      const totalLate = eRecs.filter(r => r.lateMinutes > 0).reduce((s, r) => s + r.lateMinutes, 0);
      const absences = eRecs.filter(r => r.type === "falta").length;
      const statusColor = totalLate >= 60 ? "#C62828" : totalLate >= 30 ? "#E65100" : "#2E7D32";
      return `
        <tr style="border-bottom:1px solid #f0e8d8;">
          <td style="padding:8px 12px;font-size:14px;">${e.fullName}</td>
          <td style="padding:8px 12px;font-size:13px;color:#6D6D6D;">${e.position}</td>
          <td style="padding:8px 12px;font-size:13px;">${eRecs.length}</td>
          <td style="padding:8px 12px;font-size:13px;color:${statusColor};font-weight:500;">${formatMin(totalLate)}</td>
          <td style="padding:8px 12px;font-size:13px;color:${absences > 0 ? "#C62828" : "#6D6D6D"};">${absences}</td>
        </tr>`;
    }).join("");

    return `
      <div style="margin-bottom:28px;">
        <h3 style="font-size:16px;color:#3B1F0E;border-bottom:2px solid #EDE0C4;padding-bottom:6px;margin-bottom:12px;">
          ☕ ${store.name}
        </h3>
        <div style="display:flex;gap:16px;margin-bottom:12px;">
          <div style="background:#FDF8EE;border-radius:8px;padding:10px 16px;text-align:center;min-width:70px;">
            <div style="font-size:22px;font-weight:600;color:#3B1F0E;">${emps.length}</div>
            <div style="font-size:11px;color:#6D6D6D;text-transform:uppercase;">Empleados</div>
          </div>
          <div style="background:#FDF8EE;border-radius:8px;padding:10px 16px;text-align:center;min-width:70px;">
            <div style="font-size:22px;font-weight:600;color:#2E7D32;">${onTime}</div>
            <div style="font-size:11px;color:#6D6D6D;text-transform:uppercase;">Puntual</div>
          </div>
          <div style="background:#FDF8EE;border-radius:8px;padding:10px 16px;text-align:center;min-width:70px;">
            <div style="font-size:22px;font-weight:600;color:#E65100;">${lateRecs.length}</div>
            <div style="font-size:11px;color:#6D6D6D;text-transform:uppercase;">Retardos</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-family:sans-serif;">
          <thead>
            <tr style="background:#EDE0C4;">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6D6D6D;font-weight:500;">Empleado</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6D6D6D;font-weight:500;">Puesto</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6D6D6D;font-weight:500;">Entradas</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6D6D6D;font-weight:500;">Min retardo</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6D6D6D;font-weight:500;">Faltas</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("");

  const labels = { diario: "Diario", semanal: "Semanal", quincenal: "Quincenal" };
  const dateStr = now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;">
      <div style="background:#3B1F0E;padding:24px 28px;text-align:center;">
        <h1 style="color:#F5EDD7;font-size:22px;margin:0;letter-spacing:0.5px;">☕ Che Che Café</h1>
        <p style="color:#EDE0C4;font-size:13px;margin:6px 0 0;opacity:0.85;">Digest ${labels[type]} de Asistencia</p>
      </div>
      <div style="padding:24px 28px;background:#FDF8EE;border-bottom:1px solid #EDE0C4;">
        <p style="margin:0;color:#6D6D6D;font-size:13px;">${dateStr}</p>
      </div>
      <div style="padding:28px;">
        ${storeBlocks || "<p style='color:#6D6D6D;text-align:center;'>Sin registros en este período.</p>"}
      </div>
      <div style="background:#EDE0C4;padding:16px 28px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#6D6D6D;">Generado automáticamente por el sistema de asistencia Che Che Café</p>
      </div>
    </div>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { type, records, employees } = req.body;
  if (!type || !records || !employees) return res.status(400).json({ error: "Missing data" });
  try {
    const html = buildHtml(type, records, employees);
    const labels = { diario: "Diario", semanal: "Semanal", quincenal: "Quincenal" };
    const now = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long" });
    await resend.emails.send({
      from: "Che Che Café <onboarding@resend.dev>",
      to: ADMIN_EMAILS,
      subject: `☕ Digest ${labels[type]} de Asistencia — ${now}`,
      html,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
