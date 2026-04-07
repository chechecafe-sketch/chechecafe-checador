import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const STORES = [
  { id: "SMR", name: "Santa María La Ribera", lat: 19.44815114965266, lng: -99.15418204004736 },
  { id: "TAB", name: "Tabacalera", lat: 19.43910242690003, lng: -99.15578818924966 },
  { id: "JUA", name: "Juárez", lat: 19.426522070418077, lng: -99.15542057575757 },
  { id: "CEN", name: "Centro", lat: 19.435325031610592, lng: -99.13280633342903 },
  { id: "JAR", name: "Jardín", lat: 19.45033734600347, lng: -99.16094680274179 },
  { id: "DVA", name: "Del Valle", lat: 19.373600044458726, lng: -99.16078647575902 },
];

const RADIUS_METERS = 300;
const LATE_MINUTES = 15;
const CAPUCHINO_PRICE = 66;

const APPROVED_EXPENSE_KEYWORDS = ["café", "cafe", "leche", "hielo", "azúcar", "azucar", "servilleta", "vaso", "tapa", "popote", "limpieza", "detergente", "papel", "bolsa", "agua", "propina"];

const SCHEDULES = {
  matutino: { label: "Matutino", getTime: (d) => d === 6 ? { h: 7, m: 30 } : d === 0 ? { h: 8, m: 30 } : { h: 7, m: 0 } },
  intermedio: { label: "Intermedio", getTime: () => ({ h: 10, m: 0 }), adminNote: true },
  vespertino: { label: "Vespertino", getTime: (d) => (d === 0 || d === 6) ? { h: 15, m: 0 } : { h: 14, m: 0 } },
};

const POSITIONS = ["Auxiliar", "Supervisor", "Administración"];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateEmployeeId(storeId, lastName, position) {
  const storeChar = storeId[0].toUpperCase();
  const lastTwo = lastName.replace(/\s/g, "").substring(0, 2).toUpperCase();
  const rankMap = { Auxiliar: "2", Supervisor: "1", Administración: "3" };
  const rank = rankMap[position] || "2";
  const rand = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return `${storeChar}${lastTwo}${rank}${rand}`;
}

function formatMin(mins) {
  if (!mins || mins === 0) return "0 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatCurrency(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);
}

function getCurrentPeriod() {
  const now = new Date(); const day = now.getDay();
  const totalMin = now.getHours() * 60 + now.getMinutes();
  for (const [key, sched] of Object.entries(SCHEDULES)) {
    const { h: sh, m: sm } = sched.getTime(day);
    const schedMin = sh * 60 + sm;
    if (totalMin >= schedMin - 30 && totalMin <= schedMin + 120) return { key, sched, scheduledMin: schedMin };
  }
  return null;
}

function isApprovedExpense(concept) {
  const lower = concept.toLowerCase();
  return APPROVED_EXPENSE_KEYWORDS.some(k => lower.includes(k));
}

function getTipsRanking(cuts, storeId) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const byStore = {};
  STORES.forEach(s => { byStore[s.id] = { name: s.name, tips: 0 }; });
  cuts.filter(c => new Date(c.timestamp) >= monthStart).forEach(c => {
    if (byStore[c.store_id]) byStore[c.store_id].tips += (c.propinas || 0);
  });
  const ranking = Object.entries(byStore).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.tips - a.tips);
  const myPos = ranking.findIndex(r => r.id === storeId);
  const myStore = ranking[myPos];
  const leader = ranking[0];
  return { ranking, myPos, myStore, leader };
}

function getTipsMessage(ranking, myPos, myStore, leader) {
  if (!myStore) return null;
  const diff = leader.tips - myStore.tips;
  const capuchinos = Math.ceil(diff / CAPUCHINO_PRICE);

  if (myPos === 0 && ranking.length > 1) {
    const second = ranking[1];
    const lead = myStore.tips - second.tips;
    const capLead = Math.ceil(lead / CAPUCHINO_PRICE);
    return {
      emoji: "🏆",
      color: "#2E7D32",
      bg: "#E8F5E9",
      msg: `¡${myStore.name} va en primer lugar este mes con ${formatCurrency(myStore.tips)} en propinas!`,
      sub: `${second.name} te persigue de cerca — llevas ${capLead} capuchinos de ventaja. No te duermas. ☕`
    };
  }
  if (myPos === 1) {
    return {
      emoji: "🥈",
      color: "#E65100",
      bg: "#FFF3E0",
      msg: `Vas en segundo lugar con ${formatCurrency(myStore.tips)} en propinas este mes.`,
      sub: `Para quitarle el primer lugar a ${leader.name} necesitarías vender ${capuchinos} capuchinos más. ¡Ándale! ☕`
    };
  }
  return {
    emoji: "📈",
    color: "#1565C0",
    bg: "#E3F2FD",
    msg: `${myStore.name} lleva ${formatCurrency(myStore.tips)} en propinas este mes. Vas en el lugar #${myPos + 1}.`,
    sub: `Para alcanzar a ${leader.name} (el líder con ${formatCurrency(leader.tips)}) necesitarías vender ${capuchinos} capuchinos. ¡A darle! ☕`
  };
}

function getLS(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function setLS(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

const p = {
  coffee: "#3B1F0E", cream: "#F5EDD7", caramel: "#C8862A",
  espresso: "#1A0A02", milk: "#FDF8EE", foam: "#EDE0C4",
  green: "#2E7D32", red: "#C62828", amber: "#E65100", gray: "#6D6D6D",
  blue: "#1565C0",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { font-family: 'DM Sans', sans-serif; background: ${p.milk}; color: ${p.espresso}; }
  .app { max-width: 430px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; }
  .header { background: ${p.coffee}; color: ${p.cream}; padding: 20px 20px 16px; text-align: center; flex-shrink: 0; }
  .header h1 { font-family: 'Playfair Display', serif; font-size: 22px; letter-spacing: 0.5px; }
  .header p { font-size: 12px; color: ${p.foam}; margin-top: 3px; opacity: 0.8; }
  .content { flex: 1; padding: 18px 16px 80px; overflow-y: auto; }
  .card { background: white; border-radius: 14px; padding: 18px; margin-bottom: 14px; box-shadow: 0 2px 12px rgba(59,31,14,0.07); }
  .card-title { font-family: 'Playfair Display', serif; font-size: 17px; color: ${p.coffee}; margin-bottom: 14px; }
  label { font-size: 12px; font-weight: 500; color: ${p.gray}; display: block; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
  select, input[type=text], input[type=email], input[type=password], input[type=number], textarea {
    width: 100%; padding: 11px 13px; border: 1.5px solid ${p.foam}; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 15px; background: ${p.milk};
    color: ${p.espresso}; margin-bottom: 13px; outline: none; transition: border 0.2s; appearance: none;
  }
  textarea { resize: none; min-height: 80px; }
  select:focus, input:focus, textarea:focus { border-color: ${p.caramel}; }
  .btn { width: 100%; padding: 13px; border: none; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
  .btn-primary { background: ${p.coffee}; color: ${p.cream}; }
  .btn-primary:hover { background: ${p.espresso}; }
  .btn-primary:disabled { background: #ccc; cursor: not-allowed; }
  .btn-secondary { background: ${p.foam}; color: ${p.coffee}; margin-top: 10px; }
  .btn-check { background: ${p.caramel}; color: white; font-size: 16px; padding: 16px; }
  .btn-checkout { background: ${p.espresso}; color: ${p.cream}; font-size: 16px; padding: 16px; margin-top: 10px; }
  .btn-check:disabled, .btn-checkout:disabled { background: #ccc; cursor: not-allowed; }
  .btn-choice { flex: 1; padding: 16px; border: 2px solid ${p.foam}; border-radius: 12px; background: white; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; color: ${p.espresso}; }
  .btn-choice:hover { border-color: ${p.caramel}; }
  .btn-choice.selected { border-color: ${p.coffee}; background: ${p.coffee}; color: ${p.cream}; }
  .badge { display: inline-block; padding: 3px 9px; border-radius: 20px; font-size: 12px; font-weight: 500; }
  .badge-green { background: #E8F5E9; color: ${p.green}; }
  .badge-red { background: #FFEBEE; color: ${p.red}; }
  .badge-amber { background: #FFF3E0; color: ${p.amber}; }
  .badge-blue { background: #E3F2FD; color: ${p.blue}; }
  .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid ${p.foam}; }
  .stat-row:last-child { border-bottom: none; }
  .stat-label { font-size: 13px; color: ${p.gray}; }
  .stat-value { font-size: 14px; font-weight: 500; }
  .nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 430px; display: flex; background: ${p.coffee}; z-index: 100; }
  .nav-btn { flex: 1; padding: 12px 4px; border: none; background: transparent; color: ${p.foam}; font-size: 11px; font-family: 'DM Sans', sans-serif; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; transition: background 0.15s; }
  .nav-btn.active { background: rgba(255,255,255,0.13); color: white; }
  .nav-icon { font-size: 17px; }
  .info-box { border-left: 4px solid; border-radius: 0 10px 10px 0; padding: 11px 13px; margin-bottom: 13px; font-size: 13px; line-height: 1.6; }
  .info-green { background: #E8F5E9; border-color: ${p.green}; color: #1B5E20; }
  .info-amber { background: #FFF8E1; border-color: ${p.amber}; color: #5D4037; }
  .info-red { background: #FFEBEE; border-color: ${p.red}; color: #B71C1C; }
  .info-blue { background: #E3F2FD; border-color: ${p.blue}; color: ${p.blue}; }
  .rec-row { padding: 10px 0; border-bottom: 1px solid ${p.foam}; }
  .rec-row:last-child { border-bottom: none; }
  .rec-name { font-weight: 500; font-size: 14px; }
  .rec-meta { font-size: 12px; color: ${p.gray}; margin-top: 2px; }
  .id-badge { font-family: monospace; font-size: 20px; letter-spacing: 3px; background: ${p.foam}; padding: 12px 20px; border-radius: 10px; text-align: center; color: ${p.coffee}; font-weight: 700; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
  .mini-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
  .mini-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; }
  .mini-card { background: ${p.milk}; border-radius: 8px; padding: 8px 6px; text-align: center; }
  .mini-val { font-size: 16px; font-weight: 500; color: ${p.coffee}; }
  .mini-lbl { font-size: 10px; color: ${p.gray}; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }
  .section-title { font-size: 11px; font-weight: 500; color: ${p.gray}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
  .tab-row { display: flex; gap: 6px; margin-bottom: 16px; }
  .tab-btn { flex: 1; padding: 8px 4px; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
  .expense-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 10px; }
  .expense-row input { margin-bottom: 0; }
  .remove-btn { background: ${p.foam}; border: none; border-radius: 8px; padding: 11px 14px; cursor: pointer; font-size: 16px; flex-shrink: 0; }
  .photo-preview { width: 100%; border-radius: 10px; margin-bottom: 10px; max-height: 200px; object-fit: cover; }
  .photo-btn { width: 100%; padding: 13px; border: 2px dashed ${p.foam}; border-radius: 12px; background: ${p.milk}; color: ${p.gray}; font-family: 'DM Sans', sans-serif; font-size: 14px; cursor: pointer; text-align: center; margin-bottom: 13px; }
  .tips-card { border-radius: 14px; padding: 16px; margin-bottom: 14px; }
  .tips-rank-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.06); }
  .tips-rank-row:last-child { border-bottom: none; }
  .redFlag { background: #FFEBEE; border: 2px solid ${p.red}; border-radius: 12px; padding: 16px; margin-bottom: 14px; }
`;

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getLS("ccc_user", null));
  const [screen, setScreen] = useState(currentUser ? "main" : "welcome");
  const [tab, setTab] = useState("check");
  const [regStep, setRegStep] = useState(1);
  const [regForm, setRegForm] = useState({ fullName: "", storeId: "", position: "", email: "" });
  const [newEmpId, setNewEmpId] = useState("");
  const [checkState, setCheckState] = useState({ storeId: currentUser?.storeId || "", employeeId: currentUser?.employeeId || "", searching: false, result: null, mode: "entrada" });
  const [checkoutStep, setCheckoutStep] = useState("select"); // select | cajero | form | done
  const [isCajero, setIsCajero] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState({ totalCorte: "", gastos: [{ concepto: "", monto: "", fotoPreview: null }], notas: "" });
  const [cutError, setCutError] = useState("");
  const [adminTab, setAdminTab] = useState("hoy");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestSent, setDigestSent] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [cuts, setCuts] = useState([]);
  const [allCuts, setAllCuts] = useState([]);
  const [myRecords, setMyRecords] = useState([]);
  const [checkEmployees, setCheckEmployees] = useState([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [stats, setStats] = useState({ quinceMinutes: 0, monthMinutes: 0, totalMinutes: 0, totalChecks: 0, quinceAbsences: 0 });
  const ticketInputRef = useRef(null);

  useEffect(() => { if (currentUser) { loadMyRecords(); loadStats(); loadAllCuts(); } }, [currentUser]);
  useEffect(() => { if (adminUnlocked) loadAdminData(); }, [adminUnlocked]);
  useEffect(() => {
    const q = checkState.storeId
      ? supabase.from("employees").select("*").eq("store_id", checkState.storeId)
      : supabase.from("employees").select("*");
    q.then(({ data }) => { if (data) setCheckEmployees(data); });
  }, [checkState.storeId]);

  async function loadMyRecords() {
    if (!currentUser) return;
    const { data } = await supabase.from("records").select("*").eq("employee_id", currentUser.employeeId).order("timestamp", { ascending: false }).limit(10);
    if (data) setMyRecords(data);
  }

  async function loadAllCuts() {
    const { data } = await supabase.from("cuts").select("*").order("timestamp", { ascending: false });
    if (data) setAllCuts(data);
  }

  async function loadStats() {
    if (!currentUser) return;
    const now = new Date();
    const quinceStart = now.getDate() <= 15 ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth(), 16);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const { data: allRecs } = await supabase.from("records").select("*").eq("employee_id", currentUser.employeeId);
    if (!allRecs) return;
    const lateMin = (list) => list.filter(r => r.late_minutes > 0).reduce((s, r) => s + r.late_minutes, 0);
    const qRecs = allRecs.filter(r => new Date(r.timestamp) >= quinceStart);
    const mRecs = allRecs.filter(r => new Date(r.timestamp) >= monthStart);
    setStats({ quinceMinutes: lateMin(qRecs), monthMinutes: lateMin(mRecs), totalMinutes: lateMin(allRecs), totalChecks: allRecs.length, quinceAbsences: qRecs.filter(r => r.type === "falta").length });
  }

  async function loadAdminData() {
    setLoadingAdmin(true);
    const { data: emps } = await supabase.from("employees").select("*").order("full_name");
    const { data: recs } = await supabase.from("records").select("*").order("timestamp", { ascending: false }).limit(300);
    const { data: cutsData } = await supabase.from("cuts").select("*").order("timestamp", { ascending: false }).limit(200);
    if (emps) setEmployees(emps);
    if (recs) setRecords(recs);
    if (cutsData) { setCuts(cutsData); setAllCuts(cutsData); }
    setLoadingAdmin(false);
  }

  function saveUser(u) { setCurrentUser(u); setLS("ccc_user", u); }

  async function handleRegister() {
    const { fullName, storeId, position, email } = regForm;
    const parts = fullName.trim().split(" ");
    const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const empId = generateEmployeeId(storeId, lastName, position);
    setNewEmpId(empId);
    const store = STORES.find(s => s.id === storeId);
    await supabase.from("employees").upsert({ id: empId, full_name: fullName, store_id: storeId, store_name: store.name, position, email });
    saveUser({ fullName, storeId, storeName: store.name, position, email, employeeId: empId });
    setRegStep(3);
  }

  async function handleCheckIn() {
    if (!navigator.geolocation) { setCheckState(s => ({ ...s, result: { error: "Tu dispositivo no soporta geolocalización." } })); return; }
    setCheckState(s => ({ ...s, searching: true, result: null }));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const store = STORES.find(s => s.id === checkState.storeId);
        const dist = haversine(latitude, longitude, store.lat, store.lng);
        const { data: empCheck } = await supabase.from("employees").select("full_name").eq("id", checkState.employeeId).single();
        const isDemoMode = empCheck?.full_name?.toLowerCase().includes("elmaschingon");
        if (!isDemoMode && dist > RADIUS_METERS) { setCheckState(s => ({ ...s, searching: false, result: { error: `Estás a ${Math.round(dist)}m de la tienda. Necesitas estar dentro de ${RADIUS_METERS}m.` } })); return; }
        const now = new Date();
        const period = getCurrentPeriod();
        let lateMinutes = 0, note = "", shiftKey = "fuera_horario";
        if (period) {
          shiftKey = period.key;
          const nowMin = now.getHours() * 60 + now.getMinutes();
          const diff = nowMin - period.scheduledMin;
          if (diff >= LATE_MINUTES) lateMinutes = diff;
          if (period.key === "intermedio" && (nowMin < 600 || nowMin > 660)) note = "⚠️ Fuera de ventana 10-11am — Notificar a Admin (Victoria)";
        }
        const { data: empData } = await supabase.from("employees").select("*").eq("id", checkState.employeeId).single();
        if (!empData) { setCheckState(s => ({ ...s, searching: false, result: { error: "Empleado no encontrado." } })); return; }
        const rec = { id: Date.now().toString(), employee_id: empData.id, employee_name: empData.full_name, store_id: checkState.storeId, store_name: store.name, timestamp: now.toISOString(), late_minutes: lateMinutes, shift: shiftKey, note, type: "entrada", distance: Math.round(dist) };
        await supabase.from("records").insert(rec);
        if (lateMinutes > 0 || note) fetch("/api/notify-late", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record: rec, employee: empData }) }).catch(() => {});
        await loadMyRecords(); await loadStats();
        setCheckState(s => ({ ...s, searching: false, result: { success: true, rec, emp: empData } }));
      },
      () => setCheckState(s => ({ ...s, searching: false, result: { error: "No se pudo obtener tu ubicación." } })),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleCheckOut() {
    if (!navigator.geolocation) { setCheckState(s => ({ ...s, result: { error: "Tu dispositivo no soporta geolocalización." } })); return; }
    setCheckState(s => ({ ...s, searching: true, result: null }));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const store = STORES.find(s => s.id === checkState.storeId);
        const dist = haversine(latitude, longitude, store.lat, store.lng);
        const { data: empCheck } = await supabase.from("employees").select("full_name").eq("id", checkState.employeeId).single();
        const isDemoMode = empCheck?.full_name?.toLowerCase().includes("elmaschingon");
        if (!isDemoMode && dist > RADIUS_METERS) { setCheckState(s => ({ ...s, searching: false, result: { error: `Estás a ${Math.round(dist)}m de la tienda. Necesitas estar dentro de ${RADIUS_METERS}m.` } })); return; }
        const { data: empData } = await supabase.from("employees").select("*").eq("id", checkState.employeeId).single();
        if (!empData) { setCheckState(s => ({ ...s, searching: false, result: { error: "Empleado no encontrado." } })); return; }
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { data: lastEntry } = await supabase.from("records").select("*").eq("employee_id", empData.id).eq("type", "entrada").gte("timestamp", today.toISOString()).order("timestamp", { ascending: false }).limit(1);
        const now = new Date();
        const rec = { id: Date.now().toString(), employee_id: empData.id, employee_name: empData.full_name, store_id: checkState.storeId, store_name: store.name, timestamp: now.toISOString(), late_minutes: 0, shift: lastEntry?.[0]?.shift || "fuera_horario", note: "", type: "salida", distance: Math.round(dist) };
        await supabase.from("records").insert(rec);
        setCheckState(s => ({ ...s, searching: false, employeeData: empData }));
        setCheckoutStep("cajero");
      },
      () => setCheckState(s => ({ ...s, searching: false, result: { error: "No se pudo obtener tu ubicación." } })),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSubmitCut() {
    setCutError("");
    const totalCorte = parseFloat(checkoutForm.totalCorte) || 0;
    const gastosValidos = checkoutForm.gastos.filter(g => g.concepto || g.monto);
    const totalEgresos = gastosValidos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);

    if (totalEgresos > totalCorte) {
      setCutError(`🚨 Los egresos (${formatCurrency(totalEgresos)}) no pueden ser mayores al corte (${formatCurrency(totalCorte)}). Esto es una alerta crítica. Verifica los números.`);
      fetch("/api/notify-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cut: { store_name: STORES.find(s => s.id === checkState.storeId)?.name, timestamp: new Date().toISOString(), total_corte: totalCorte, total_gastos: totalEgresos },
          employee: checkState.employeeData,
          unapprovedExpenses: gastosValidos,
          redFlag: true,
        }),
      }).catch(() => {});
      return;
    }

    const unapprovedExpenses = gastosValidos.filter(g => g.concepto && !isApprovedExpense(g.concepto));
    const propinasGasto = gastosValidos.find(g => g.concepto?.toLowerCase().includes("propina"));
    const propinas = parseFloat(propinasGasto?.monto) || 0;

    const cut = {
      id: Date.now().toString(),
      employee_id: checkState.employeeId,
      employee_name: checkState.employeeData?.full_name,
      store_id: checkState.storeId,
      store_name: STORES.find(s => s.id === checkState.storeId)?.name,
      timestamp: new Date().toISOString(),
      total_corte: totalCorte,
      propinas,
      gastos: JSON.stringify(gastosValidos),
      total_gastos: totalEgresos,
      notas: checkoutForm.notas,
      tiene_gastos_no_aprobados: unapprovedExpenses.length > 0,
      es_cajero: true,
    };

    await supabase.from("cuts").insert(cut);

    // Send automatic cut digest
    fetch("/api/send-cut", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cut, employee: checkState.employeeData }),
    }).catch(() => {});

    if (unapprovedExpenses.length > 0) {
      fetch("/api/notify-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cut, employee: checkState.employeeData, unapprovedExpenses }),
      }).catch(() => {});
    }

    await loadAllCuts();
    setCheckoutStep("done");
    setCheckoutForm({ totalCorte: "", gastos: [{ concepto: "", monto: "", fotoPreview: null }], notas: "" });
  }

  function addGastoRow() { setCheckoutForm(f => ({ ...f, gastos: [...f.gastos, { concepto: "", monto: "", fotoPreview: null }] })); }
  function removeGastoRow(i) { setCheckoutForm(f => ({ ...f, gastos: f.gastos.filter((_, idx) => idx !== i) })); }
  function updateGasto(i, field, val) { setCheckoutForm(f => ({ ...f, gastos: f.gastos.map((g, idx) => idx === i ? { ...g, [field]: val } : g) })); }
  function handleGastoPhoto(i, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => updateGasto(i, "fotoPreview", e.target.result);
    reader.readAsDataURL(file);
  }

  async function sendDigest(type) {
    setSendingDigest(true); setDigestSent(null);
    try {
      const { data: recs } = await supabase.from("records").select("*");
      const { data: emps } = await supabase.from("employees").select("*");
      const empsObj = {};
      (emps || []).forEach(e => { empsObj[e.id] = { ...e, employeeId: e.id, fullName: e.full_name, storeId: e.store_id, storeName: e.store_name }; });
      const res = await fetch("/api/send-digest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, records: recs || [], employees: empsObj }) });
      const data = await res.json();
      setDigestSent(data.ok ? "enviado" : "error");
    } catch { setDigestSent("error"); }
    setSendingDigest(false);
  }

  function alertLevel(qMins) {
    if (qMins >= 120) return { cls: "info-red", msg: "⚠️ Más de 2 horas acumuladas — riesgo de descuento de día." };
    if (qMins >= 60) return { cls: "info-amber", msg: "⏱ Más de 1 hora acumulada esta quincena." };
    if (qMins >= 30) return { cls: "info-amber", msg: "⏱ 30+ minutos acumulados esta quincena." };
    return null;
  }

  const now = new Date();
  const period = getCurrentPeriod();
  const al = alertLevel(stats.quinceMinutes);
  const tipsData = currentUser ? getTipsRanking(allCuts, currentUser.storeId) : null;
  const tipsMsg = tipsData ? getTipsMessage(tipsData.ranking, tipsData.myPos, tipsData.myStore, tipsData.leader) : null;

  const totalCorteNum = parseFloat(checkoutForm.totalCorte) || 0;
  const totalEgresosNum = checkoutForm.gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
  const isOverspent = totalEgresosNum > totalCorteNum && totalCorteNum > 0;

  // ─── WELCOME ──────────────────────────────────────────────────────────────
  if (screen === "welcome") return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header"><h1>☕ Che Che Café</h1><p>Sistema de Asistencia</p></div>
        <div className="content">
          {regStep === 1 && (<>
            <div style={{ textAlign: "center", padding: "24px 0 28px" }}>
              <div style={{ fontSize: 60, marginBottom: 10 }}>☕</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, color: p.coffee, marginBottom: 8 }}>Bienvenido al checador</div>
              <div style={{ fontSize: 14, color: p.gray, lineHeight: 1.6 }}>Regístrate una sola vez y listo.</div>
            </div>
            <div className="card">
              <div className="card-title">Crear cuenta</div>
              <label>Nombre completo</label>
              <input type="text" placeholder="Ej. Ana García López" value={regForm.fullName} onChange={e => setRegForm(f => ({ ...f, fullName: e.target.value }))} />
              <label>Tu tienda</label>
              <select value={regForm.storeId} onChange={e => setRegForm(f => ({ ...f, storeId: e.target.value }))}>
                <option value="">Selecciona tu tienda</option>
                {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <label>Tu puesto</label>
              <select value={regForm.position} onChange={e => setRegForm(f => ({ ...f, position: e.target.value }))}>
                <option value="">Selecciona tu puesto</option>
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
              <label>Correo electrónico</label>
              <input type="email" placeholder="tu@email.com" value={regForm.email} onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))} />
              <button className="btn btn-primary" onClick={() => setRegStep(2)} disabled={!regForm.fullName || !regForm.storeId || !regForm.position || !regForm.email}>Continuar →</button>
            </div>
          </>)}
          {regStep === 2 && (
            <div className="card">
              <div className="card-title">Confirma tus datos</div>
              <div className="stat-row"><span className="stat-label">Nombre</span><span className="stat-value">{regForm.fullName}</span></div>
              <div className="stat-row"><span className="stat-label">Tienda</span><span className="stat-value">{STORES.find(s => s.id === regForm.storeId)?.name}</span></div>
              <div className="stat-row"><span className="stat-label">Puesto</span><span className="stat-value">{regForm.position}</span></div>
              <div className="stat-row" style={{ marginBottom: 16 }}><span className="stat-label">Correo</span><span className="stat-value" style={{ fontSize: 13 }}>{regForm.email}</span></div>
              <div className="info-box info-amber"><strong>Política:</strong> A partir de 15 min después de tu hora de entrada se registra retardo.</div>
              <button className="btn btn-primary" onClick={handleRegister}>✅ Registrarme</button>
              <button className="btn btn-secondary" onClick={() => setRegStep(1)}>← Regresar</button>
            </div>
          )}
          {regStep === 3 && (
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 50, margin: "10px 0 14px" }}>🎉</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: p.coffee, marginBottom: 8 }}>¡Cuenta creada!</div>
              <div style={{ fontSize: 13, color: p.gray, marginBottom: 18 }}>Este es tu ID de empleado. Guárdalo.</div>
              <div className="id-badge">{newEmpId}</div>
              <div style={{ fontSize: 12, color: p.gray, margin: "12px 0 20px" }}>Lo necesitarás si cambias de dispositivo.</div>
              <button className="btn btn-primary" onClick={() => { setScreen("main"); setTab("check"); }}>Comenzar →</button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // ─── CHECKOUT — PREGUNTA CAJERO ───────────────────────────────────────────
  if (tab === "check" && checkoutStep === "cajero") return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header"><h1>☕ Che Che Café</h1><p>Check out registrado ✅</p></div>
        <div className="content">
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 44, margin: "10px 0 14px" }}>🧾</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: p.coffee, marginBottom: 8 }}>¿Eres encargado de caja este turno?</div>
            <div style={{ fontSize: 13, color: p.gray, marginBottom: 24, lineHeight: 1.6 }}>Solo una persona por turno registra el corte de caja.</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className={`btn-choice ${isCajero === true ? "selected" : ""}`} onClick={() => setIsCajero(true)}>
                ✅ Sí, soy cajero
              </button>
              <button className={`btn-choice ${isCajero === false ? "selected" : ""}`} onClick={() => setIsCajero(false)}>
                No, solo salida
              </button>
            </div>
            {isCajero !== null && (
              <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => {
                if (isCajero) setCheckoutStep("form");
                else setCheckoutStep("done");
              }}>
                Continuar →
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // ─── CHECKOUT — FORMULARIO CORTE ──────────────────────────────────────────
  if (tab === "check" && checkoutStep === "form") return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header"><h1>☕ Che Che Café</h1><p>Corte de turno</p></div>
        <div className="content">
          <div className="info-box info-blue">Registra el corte de caja. Los egresos no pueden superar el total del corte.</div>

          <div className="card">
            <div className="card-title">💰 Total del corte</div>
            <label>Monto total del corte (MXN)</label>
            <input type="number" placeholder="0.00" value={checkoutForm.totalCorte} onChange={e => { setCheckoutForm(f => ({ ...f, totalCorte: e.target.value })); setCutError(""); }} />
            {totalCorteNum > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${p.foam}` }}>
                <span className="stat-label">Egresos registrados</span>
                <span style={{ fontWeight: 500, color: isOverspent ? p.red : p.green }}>{formatCurrency(totalEgresosNum)}</span>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">🧾 Egresos del turno</div>
            <div className="info-box info-amber">
              <strong>Gastos autorizados sin aprobación previa:</strong> café, leche, hielo, artículos de operación básica, propinas del turno. Todo lo demás requiere autorización de Victoria.
            </div>
            {checkoutForm.gastos.map((g, i) => {
              const approved = g.concepto ? isApprovedExpense(g.concepto) : null;
              return (
                <div key={i}>
                  <div className="expense-row">
                    <input type="text" placeholder="Concepto (ej. leche, propinas)" value={g.concepto}
                      onChange={e => { updateGasto(i, "concepto", e.target.value); setCutError(""); }}
                      style={{ marginBottom: 0, borderColor: g.concepto ? (approved ? p.green : p.red) : p.foam }} />
                    <input type="number" placeholder="$" value={g.monto}
                      onChange={e => { updateGasto(i, "monto", e.target.value); setCutError(""); }}
                      style={{ marginBottom: 0, width: 90 }} />
                    {checkoutForm.gastos.length > 1 && <button className="remove-btn" onClick={() => removeGastoRow(i)}>✕</button>}
                  </div>
                  {g.concepto && !approved && <div className="info-box info-red" style={{ marginTop: 4, marginBottom: 8, fontSize: 12 }}>⚠️ Requiere autorización de Victoria. Se notificará automáticamente.</div>}
                  {g.concepto && approved && <div className="info-box info-green" style={{ marginTop: 4, marginBottom: 8, fontSize: 12 }}>✓ Egreso autorizado</div>}
                  <div style={{ marginBottom: 10 }}>
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} id={`foto-${i}`} onChange={e => handleGastoPhoto(i, e.target.files[0])} />
                    {g.fotoPreview ? <img src={g.fotoPreview} className="photo-preview" alt="ticket" /> : <label htmlFor={`foto-${i}`} className="photo-btn">📷 Foto del ticket</label>}
                  </div>
                </div>
              );
            })}
            <button className="btn btn-secondary" onClick={addGastoRow} style={{ marginTop: 0 }}>+ Agregar egreso</button>
          </div>

          {isOverspent && (
            <div className="redFlag">
              <div style={{ fontWeight: 700, color: p.red, fontSize: 15, marginBottom: 6 }}>🚨 Alerta crítica</div>
              <div style={{ fontSize: 13, color: p.red }}>Los egresos ({formatCurrency(totalEgresosNum)}) superan el corte ({formatCurrency(totalCorteNum)}). Esto no es posible. Verifica los números antes de continuar.</div>
            </div>
          )}

          {cutError && <div className="redFlag"><div style={{ fontSize: 13, color: p.red }}>{cutError}</div></div>}

          <div className="card">
            <div className="card-title">📝 Notas del turno</div>
            <textarea placeholder="Incidencias, observaciones, mensajes para el siguiente turno..." value={checkoutForm.notas} onChange={e => setCheckoutForm(f => ({ ...f, notas: e.target.value }))} />
          </div>

          <button className="btn btn-primary" onClick={handleSubmitCut} disabled={!checkoutForm.totalCorte || isOverspent}>
            ✅ Registrar corte
          </button>
          <button className="btn btn-secondary" onClick={() => setCheckoutStep("cajero")}>← Regresar</button>
        </div>
      </div>
    </>
  );

  // ─── CHECKOUT DONE ────────────────────────────────────────────────────────
  if (tab === "check" && checkoutStep === "done") {
    const tipsMsg2 = tipsData ? getTipsMessage(tipsData.ranking, tipsData.myPos, tipsData.myStore, tipsData.leader) : null;
    return (
      <>
        <style>{css}</style>
        <div className="app">
          <div className="header"><h1>☕ Che Che Café</h1><p>Turno finalizado</p></div>
          <div className="content">
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, margin: "10px 0 14px" }}>✅</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: p.coffee, marginBottom: 8 }}>¡Turno cerrado!</div>
              <div style={{ fontSize: 13, color: p.gray, marginBottom: 16 }}>
                {isCajero ? "Tu salida y corte de caja quedaron registrados. Se envió el reporte automáticamente." : "Tu salida quedó registrada."}
              </div>
              {isCajero && checkoutForm.totalCorte && (
                <div style={{ background: p.milk, borderRadius: 10, padding: 14, marginBottom: 16, textAlign: "left" }}>
                  <div className="stat-row"><span className="stat-label">Corte</span><span className="stat-value">{formatCurrency(checkoutForm.totalCorte)}</span></div>
                  <div className="stat-row"><span className="stat-label">Egresos</span><span className="stat-value">{formatCurrency(totalEgresosNum)}</span></div>
                  <div className="stat-row"><span className="stat-label">Neto</span><span className="stat-value" style={{ color: p.green }}>{formatCurrency(parseFloat(checkoutForm.totalCorte) - totalEgresosNum)}</span></div>
                </div>
              )}
            </div>

            {tipsMsg2 && (
              <div className="tips-card" style={{ background: tipsMsg2.bg }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{tipsMsg2.emoji}</div>
                <div style={{ fontWeight: 500, fontSize: 14, color: tipsMsg2.color, marginBottom: 6 }}>{tipsMsg2.msg}</div>
                <div style={{ fontSize: 13, color: tipsMsg2.color, opacity: 0.85 }}>{tipsMsg2.sub}</div>
              </div>
            )}

            <button className="btn btn-primary" onClick={() => { setCheckoutStep("select"); setIsCajero(null); setCheckState(s => ({ ...s, result: null, mode: "entrada" })); }}>
              Listo
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─── MAIN APP ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header">
          <h1>☕ Che Che Café</h1>
          {currentUser && <p>{currentUser.fullName} · {currentUser.storeName}</p>}
        </div>
        <div className="content">

          {tab === "check" && (<>
            {period && <div className="info-box info-green"><strong>Turno activo:</strong> {SCHEDULES[period.key].label} — {period.key === "intermedio" ? "10:00–11:00 AM" : (() => { const t = SCHEDULES[period.key].getTime(now.getDay()); return `${t.h}:${String(t.m).padStart(2, "0")}`; })()}</div>}
            {!period && <div className="info-box info-amber">No hay turno activo en este momento.</div>}

            {checkState.result?.success ? (
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 52, margin: "6px 0 10px" }}>{checkState.result.rec.late_minutes > 0 ? "⏰" : "✅"}</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: p.coffee, marginBottom: 6 }}>
                  {checkState.result.rec.late_minutes > 0 ? `Retardo — ${formatMin(checkState.result.rec.late_minutes)}` : "¡Entrada registrada!"}
                </div>
                <div style={{ fontSize: 13, color: p.gray, marginBottom: 16 }}>
                  {new Date(checkState.result.rec.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {checkState.result.rec.store_name}
                </div>
                {checkState.result.rec.late_minutes > 0 && <div className="info-box info-amber" style={{ textAlign: "left" }}>Retardo de <strong>{formatMin(checkState.result.rec.late_minutes)}</strong>. Acumulado quincena: <strong>{formatMin(stats.quinceMinutes)}</strong></div>}
                {checkState.result.rec.note && <div className="info-box info-red" style={{ textAlign: "left" }}>{checkState.result.rec.note}</div>}
                <button className="btn btn-secondary" onClick={() => setCheckState(s => ({ ...s, result: null }))}>Nueva acción</button>
              </div>
            ) : (
              <div className="card">
                <div className="card-title">Registro de turno</div>
                <label>Tienda</label>
                <select value={checkState.storeId} onChange={e => setCheckState(s => ({ ...s, storeId: e.target.value, employeeId: "" }))}>
                  <option value="">Selecciona tienda</option>
                  {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <label>Empleado</label>
                <select value={checkState.employeeId} onChange={e => setCheckState(s => ({ ...s, employeeId: e.target.value }))}>
                  <option value="">Selecciona tu nombre</option>
                  {checkEmployees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
                {checkState.result?.error && <div className="info-box info-red">{checkState.result.error}</div>}
                <button className="btn btn-check" disabled={!checkState.storeId || !checkState.employeeId || checkState.searching} onClick={handleCheckIn}>
                  {checkState.searching && checkState.mode === "entrada" ? "Verificando..." : "📍 Check in — Entrada"}
                </button>
                <button className="btn btn-checkout" disabled={!checkState.storeId || !checkState.employeeId || checkState.searching} onClick={() => { setCheckState(s => ({ ...s, mode: "salida" })); handleCheckOut(); }}>
                  {checkState.searching && checkState.mode === "salida" ? "Verificando..." : "🚪 Check out — Salida"}
                </button>
                <div style={{ fontSize: 12, color: p.gray, textAlign: "center", marginTop: 10 }}>Debes estar dentro de {RADIUS_METERS}m de la tienda</div>
              </div>
            )}

            {tipsMsg && (
              <div className="tips-card" style={{ background: tipsMsg.bg }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{tipsMsg.emoji}</div>
                <div style={{ fontWeight: 500, fontSize: 13, color: tipsMsg.color, marginBottom: 4 }}>{tipsMsg.msg}</div>
                <div style={{ fontSize: 12, color: tipsMsg.color, opacity: 0.85 }}>{tipsMsg.sub}</div>
              </div>
            )}

            {myRecords.length > 0 && (
              <div className="card">
                <div className="card-title" style={{ marginBottom: 10 }}>Mis últimas entradas</div>
                {myRecords.slice(0, 5).map(r => (
                  <div key={r.id} className="rec-row">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div className="rec-name">{r.store_name}</div>
                        <div className="rec-meta">{new Date(r.timestamp).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })} · {new Date(r.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                      <span className={`badge ${r.type === "salida" ? "badge-blue" : r.late_minutes > 0 ? "badge-red" : "badge-green"}`}>
                        {r.type === "salida" ? "Salida" : r.late_minutes > 0 ? `+${formatMin(r.late_minutes)}` : "Puntual"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>)}

          {tab === "profile" && currentUser && (<>
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", background: p.foam, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: p.coffee, fontWeight: 700, flexShrink: 0 }}>
                  {currentUser.fullName.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: p.coffee }}>{currentUser.fullName}</div>
                  <div style={{ fontSize: 13, color: p.gray }}>{currentUser.storeName}</div>
                  <div style={{ fontSize: 12, color: p.gray }}>{currentUser.position} · <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{currentUser.employeeId}</span></div>
                </div>
              </div>
            </div>
            {al && <div className={`info-box ${al.cls}`}>{al.msg}</div>}
            <div className="card">
              <div className="card-title">Mis acumulados</div>
              <div className="stat-row"><span className="stat-label">Retardos esta quincena</span><span className="stat-value" style={{ color: stats.quinceMinutes > 0 ? p.amber : p.green }}>{formatMin(stats.quinceMinutes)}</span></div>
              <div className="stat-row"><span className="stat-label">Retardos este mes</span><span className="stat-value">{formatMin(stats.monthMinutes)}</span></div>
              <div className="stat-row"><span className="stat-label">Histórico total</span><span className="stat-value">{formatMin(stats.totalMinutes)}</span></div>
              <div className="stat-row"><span className="stat-label">Faltas quincena</span><span className="stat-value" style={{ color: stats.quinceAbsences > 0 ? p.red : p.green }}>{stats.quinceAbsences}</span></div>
              <div className="stat-row"><span className="stat-label">Entradas registradas</span><span className="stat-value">{stats.totalChecks}</span></div>
            </div>
            {tipsData && (
              <div className="card">
                <div className="card-title">🏆 Ranking de propinas — este mes</div>
                {tipsData.ranking.map((s, i) => (
                  <div key={s.id} className="tips-rank-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                      <span style={{ fontSize: 13, fontWeight: s.id === currentUser.storeId ? 500 : 400 }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: s.id === currentUser.storeId ? p.caramel : p.gray }}>{formatCurrency(s.tips)}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-secondary" onClick={() => { localStorage.removeItem("ccc_user"); setCurrentUser(null); setScreen("welcome"); setRegStep(1); setRegForm({ fullName: "", storeId: "", position: "", email: "" }); }}>
              Cerrar sesión / Cambiar cuenta
            </button>
          </>)}

          {tab === "admin" && !adminUnlocked && (
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 44, margin: "10px 0 14px" }}>🔒</div>
              <div className="card-title">Área Admin</div>
              <div style={{ fontSize: 13, color: p.gray, marginBottom: 16 }}>Ingresa el PIN para continuar</div>
              <input type="password" placeholder="• • • •" value={adminPin}
                onChange={e => setAdminPin(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { if (adminPin === "5366") setAdminUnlocked(true); else { alert("PIN incorrecto"); setAdminPin(""); } } }}
                style={{ textAlign: "center", letterSpacing: 8, fontSize: 20, marginBottom: 14 }} />
              <button className="btn btn-primary" onClick={() => { if (adminPin === "5366") setAdminUnlocked(true); else { alert("PIN incorrecto"); setAdminPin(""); } }}>Entrar</button>
            </div>
          )}

          {tab === "admin" && adminUnlocked && (<>
            <div className="tab-row">
              {["hoy", "cortes", "empleados", "digest"].map(t => (
                <button key={t} className="tab-btn" onClick={() => setAdminTab(t)}
                  style={{ background: adminTab === t ? p.coffee : "white", color: adminTab === t ? p.cream : p.coffee, border: `1.5px solid ${adminTab === t ? p.coffee : p.foam}`, fontSize: 11 }}>
                  {t === "hoy" ? "Hoy" : t === "cortes" ? "Cortes" : t === "empleados" ? "Empleados" : "Digest"}
                </button>
              ))}
            </div>

            {loadingAdmin && <div style={{ textAlign: "center", padding: "40px 0", color: p.gray }}>Cargando...</div>}

            {!loadingAdmin && adminTab === "hoy" && (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div className="card-title" style={{ margin: 0 }}>Registros de hoy</div>
                  <button onClick={loadAdminData} style={{ fontSize: 12, background: "none", border: "none", color: p.caramel, cursor: "pointer" }}>↻ Actualizar</button>
                </div>
                {STORES.map(store => {
                  const sr = records.filter(r => r.store_id === store.id && new Date(r.timestamp).toDateString() === now.toDateString());
                  if (!sr.length) return null;
                  return (
                    <div key={store.id} style={{ marginBottom: 16 }}>
                      <div className="section-title">{store.name}</div>
                      {sr.map(r => (
                        <div key={r.id} className="rec-row">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div className="rec-name">{r.employee_name}</div>
                              <div className="rec-meta">{new Date(r.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {SCHEDULES[r.shift]?.label || r.shift}</div>
                              {r.note && <div style={{ fontSize: 11, color: p.red, marginTop: 2 }}>{r.note}</div>}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                              <span className={`badge ${r.type === "salida" ? "badge-blue" : "badge-green"}`}>{r.type === "salida" ? "Salida" : "Entrada"}</span>
                              {r.late_minutes > 0 && <span className="badge badge-red">+{formatMin(r.late_minutes)}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {!records.some(r => new Date(r.timestamp).toDateString() === now.toDateString()) && <div style={{ textAlign: "center", color: p.gray, fontSize: 13, padding: "20px 0" }}>Sin registros hoy</div>}
              </div>
            )}

            {!loadingAdmin && adminTab === "cortes" && (
              <div className="card">
                <div className="card-title">Cortes de turno</div>
                {/* Ranking de propinas */}
                <div style={{ marginBottom: 16 }}>
                  <div className="section-title">🏆 Ranking de propinas — este mes</div>
                  {(() => {
                    const { ranking } = getTipsRanking(cuts, "");
                    return ranking.filter(s => s.tips > 0).map((s, i) => (
                      <div key={s.id} className="tips-rank-row">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                          <span style={{ fontSize: 13 }}>{s.name}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{formatCurrency(s.tips)}</span>
                      </div>
                    ));
                  })()}
                </div>
                {STORES.map(store => {
                  const storeCuts = cuts.filter(c => c.store_id === store.id);
                  if (!storeCuts.length) return null;
                  const totalVentas = storeCuts.reduce((s, c) => s + (c.total_corte || 0), 0);
                  const totalPropinas = storeCuts.reduce((s, c) => s + (c.propinas || 0), 0);
                  const totalGastos = storeCuts.reduce((s, c) => s + (c.total_gastos || 0), 0);
                  return (
                    <div key={store.id} style={{ marginBottom: 20 }}>
                      <div className="section-title">{store.name}</div>
                      <div className="mini-grid">
                        <div className="mini-card"><div className="mini-val">{formatCurrency(totalVentas)}</div><div className="mini-lbl">Ventas</div></div>
                        <div className="mini-card"><div className="mini-val">{formatCurrency(totalPropinas)}</div><div className="mini-lbl">Propinas</div></div>
                        <div className="mini-card"><div className="mini-val">{formatCurrency(totalGastos)}</div><div className="mini-lbl">Egresos</div></div>
                      </div>
                      {storeCuts.slice(0, 5).map(c => (
                        <div key={c.id} className="rec-row">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div className="rec-name">{c.employee_name}</div>
                              <div className="rec-meta">{new Date(c.timestamp).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })} · {new Date(c.timestamp).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</div>
                              <div className="rec-meta">Corte: {formatCurrency(c.total_corte)} · Egresos: {formatCurrency(c.total_gastos)}</div>
                              {c.notas && <div style={{ fontSize: 11, color: p.gray, marginTop: 2 }}>📝 {c.notas}</div>}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {c.tiene_gastos_no_aprobados && <span className="badge badge-red">⚠️ Gasto</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {!cuts.length && <div style={{ textAlign: "center", color: p.gray, fontSize: 13, padding: "20px 0" }}>Sin cortes registrados</div>}
              </div>
            )}

            {!loadingAdmin && adminTab === "empleados" && (
              <div className="card">
                <div className="card-title">Empleados ({employees.length})</div>
                {STORES.map(store => {
                  const emps = employees.filter(e => e.store_id === store.id);
                  if (!emps.length) return null;
                  return (
                    <div key={store.id} style={{ marginBottom: 16 }}>
                      <div className="section-title">{store.name}</div>
                      {emps.map(e => {
                        const qStart = now.getDate() <= 15 ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth(), 16);
                        const eRecs = records.filter(r => r.employee_id === e.id && new Date(r.timestamp) >= qStart);
                        const qMins = eRecs.filter(r => r.late_minutes > 0).reduce((s, r) => s + r.late_minutes, 0);
                        return (
                          <div key={e.id} className="rec-row">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div><div className="rec-name">{e.full_name}</div><div className="rec-meta">{e.id} · {e.position}</div></div>
                              <span className={`badge ${qMins >= 60 ? "badge-red" : qMins > 0 ? "badge-amber" : "badge-green"}`}>{formatMin(qMins)} qna</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {!loadingAdmin && adminTab === "digest" && (
              <div className="card">
                <div className="card-title">Digest de asistencia</div>
                <div style={{ fontSize: 13, color: p.gray, marginBottom: 16 }}>Envía resumen por tienda a los correos admin.</div>
                {["diario", "semanal", "quincenal"].map(type => (
                  <button key={type} className="btn btn-primary" style={{ marginBottom: 10 }} onClick={() => sendDigest(type)} disabled={sendingDigest}>
                    {sendingDigest ? "Enviando..." : `📧 Enviar digest ${type}`}
                  </button>
                ))}
                {digestSent === "enviado" && <div className="info-box info-green">✅ Digest enviado.</div>}
                {digestSent === "error" && <div className="info-box info-red">Error al enviar.</div>}
              </div>
            )}

            <button className="btn btn-secondary" style={{ marginTop: 4 }} onClick={() => { setAdminUnlocked(false); setAdminPin(""); }}>🔒 Cerrar Admin</button>
          </>)}

        </div>
        <nav className="nav">
          {[{ key: "check", icon: "📍", label: "Checar" }, { key: "profile", icon: "👤", label: "Mi perfil" }, { key: "admin", icon: "📊", label: "Admin" }].map(t => (
            <button key={t.key} className={`nav-btn ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              <span className="nav-icon">{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
