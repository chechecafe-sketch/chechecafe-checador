import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const ADMIN_EMAILS = [
  "luiscgarinian@gmail.com",
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

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const now = new Date();
  const mexicoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  const hour = mexicoTime.getHours();
  const todayStart = new Date(mexicoTime);
  todayStart.setHours(0, 0, 0, 0);

  // Check which shifts have ended — roughly after 3pm (matutino done) and after 10pm (vespertino done)
  const checkShifts = [];
  if (hour >= 15) checkShifts.push("matutino");
  if (hour >= 22) checkShifts.push("vespertino");
  if (checkShifts.length === 0) {
    return res.status(200).json({ message: "No shifts to check at this hour", hour });
  }

  const missingCuts = [];

  for (const store of STORES) {
    for (const shift of checkShifts) {
      // Check if there were check-outs for this shift today
      const { data: checkouts } = await supabase
        .from("records")
        .select("employee_name, timestamp")
        .eq("store_id", store.id)
        .eq("type", "salida")
        .eq("shift", shift)
        .gte("timestamp", todayStart.toISOString())
        .not("employee_id", "in", "('DEMO01','ADMIN01','ADMIN02','ADMIN03','SGA101')");

      if (!checkouts || checkouts.length === 0) continue;

      // Check if there's a cut for this store/shift today
      const { data: cuts } = await supabase
        .from("cuts")
        .select("id, employee_name, timestamp")
        .eq("store_id", store.id)
        .eq("es_cajero", true)
        .gte("timestamp", todayStart.toISOString());

      // If checkouts exist but no cuts — alert
      if (!cuts || cuts.length === 0) {
        const names = [...new Set(checkouts.map(c => c.employee_name))].join(", ");
        missingCuts.push({
          store: store.name,
          shift: shift === "matutino" ? "Matutino" : "Vespertino",
          employees: names,
        });
      }
    }
  }

  if (missingCuts.length === 0) {
    return res.status(200).json({ ok: true, message: "All cuts accounted for" });
  }

  const dateStr = mexicoTime.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const rows = missingCuts.map(m =>
    `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f0e8d8;font-weight:500;">${m.store}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0e8d8;">${m.shift}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0e8d8;color:#6D6D6D;font-size:13px;">${m.employees}</td>
    </tr>`
  ).join("");

  try {
    await resend.emails.send({
      from: "Che Che Café <onboarding@resend.dev>",
      to: ADMIN_EMAILS,
      subject: `🚨 Cortes de caja faltantes — ${dateStr}`,
      html: `
        <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#3B1F0E;padding:24px;text-align:center;">
            <h1 style="color:#F5EDD7;font-size:20px;margin:0;">☕ Che Che Café</h1>
            <p style="color:#EDE0C4;font-size:12px;margin:6px 0 0;">Alerta — Cortes de turno faltantes</p>
          </div>
          <div style="padding:24px;background:#FDF8EE;">
            <p style="color:#C62828;font-weight:600;font-size:15px;">🚨 Las siguientes tiendas NO registraron corte de caja:</p>
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
              <thead>
                <tr style="background:#EDE0C4;">
                  <th style="padding:10px 14px;text-align:left;font-size:13px;">Tienda</th>
                  <th style="padding:10px 14px;text-align:left;font-size:13px;">Turno</th>
                  <th style="padding:10px 14px;text-align:left;font-size:13px;">Empleados que salieron</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div style="background:#FFEBEE;border-left:4px solid #C62828;padding:14px;border-radius:0 8px 8px 0;margin-top:20px;">
              <p style="color:#C62828;font-weight:500;margin:0;">El corte de caja es OBLIGATORIO al final de cada turno. Por favor contactar al encargado de tienda de inmediato.</p>
            </div>
          </div>
          <div style="background:#EDE0C4;padding:14px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#6D6D6D;">Sistema automático Che Che Café · ${dateStr}</p>
          </div>
        </div>`,
    });

    res.status(200).json({ ok: true, alertsSent: missingCuts.length, missingCuts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
