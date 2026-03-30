import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase client ─────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Leaflet icon fix ─────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Static data ──────────────────────────────────────────────────────────────
const CITIES = [
  { name: "Osaka",    lat: 34.6937, lng: 135.5023, days: "Apr 1–4",   emoji: "🏯", desc: "Dotonbori, street food capital, Osaka Castle" },
  { name: "Kyoto",    lat: 35.0116, lng: 135.7681, days: "Apr 5–8",   emoji: "⛩️", desc: "Fushimi Inari, Arashiyama, Gion district" },
  { name: "Kanazawa", lat: 36.5613, lng: 136.6562, days: "Apr 9–11",  emoji: "🌸", desc: "Kenroku-en garden, samurai districts, fresh seafood" },
  { name: "Hakone",   lat: 35.2322, lng: 139.1069, days: "Apr 12–14", emoji: "🗻", desc: "Mt Fuji views, ryokan stay, onsen hot springs" },
  { name: "Tokyo",    lat: 35.6762, lng: 139.6503, days: "Apr 15–20", emoji: "🌆", desc: "Shibuya, Shinjuku, Asakusa, teamLab" },
];
const ROUTE = CITIES.map((c) => [c.lat, c.lng]);

// Default seeds — only used if Supabase has no data yet
const DEFAULT_TASKS = [
  { label: "Book flights",                                  tag: "travel",    done: false },
  { label: "Get JR Pass (order online before departure)",   tag: "transport", done: false },
  { label: "Book all hotels/ryokan",                        tag: "lodging",   done: false },
  { label: "Apply for IC Card (Suica)",                     tag: "transport", done: false },
  { label: "Get travel insurance",                          tag: "admin",     done: false },
  { label: "Pocket WiFi or SIM card rental",                tag: "gear",      done: false },
  { label: "Notify bank of travel dates",                   tag: "admin",     done: false },
  { label: "Download Google Maps offline — Japan",          tag: "gear",      done: false },
  { label: "Download Google Translate + Japanese pack",     tag: "gear",      done: false },
  { label: "Pack yen cash (Japan is still cash-heavy)",     tag: "money",     done: false },
  { label: "Book teamLab Planets tickets (sells out)",      tag: "tokyo",     done: false },
  { label: "Book Fushimi Inari early morning visit",        tag: "kyoto",     done: false },
];
const DEFAULT_EXPENSES  = [];
const DEFAULT_EVENTS    = [
  { day: 1,  label: "Arrive Osaka", color: "#D85A30" },
  { day: 20, label: "Fly home",     color: "#888780" },
];
const DEFAULT_BUDGET    = 8000;

const TIPS = [
  { cat: "respect", title: "Bow as a greeting",           body: "A slight bow (15°) is the standard greeting. Don't expect or initiate handshakes." },
  { cat: "respect", title: "Remove shoes indoors",        body: "Always remove shoes when entering homes, ryokans, and many traditional restaurants. Look for a step up at the entrance as a signal." },
  { cat: "respect", title: "Quiet on public transport",   body: "Trains are silent spaces. No phone calls, keep music inaudible, speak softly. It's genuinely observed, not just a rule." },
  { cat: "food",    title: "Say itadakimasu before eating", body: "It means roughly 'I humbly receive' — said before every meal. Gochisousama (go-chi-so-sa-ma) after. Locals will love that you know this." },
  { cat: "food",    title: "Don't tip — ever",            body: "Tipping is considered rude in Japan. Service is included in the price and the staff take pride in doing it without extra payment." },
  { cat: "food",    title: "Slurping noodles is fine",    body: "Slurping ramen or soba is totally normal and even signals you're enjoying the food." },
  { cat: "money",   title: "Carry cash",                  body: "Many restaurants, shrines, and small shops are cash-only. Convenience stores (7-Eleven, FamilyMart) have reliable ATMs that accept foreign cards." },
  { cat: "onsen",   title: "Onsen rules are strict",      body: "Shower thoroughly before entering. Tattoos are often banned in public onsen — check ahead. No swimwear in traditional baths." },
  { cat: "onsen",   title: "Towels stay out of the water", body: "Your small towel can be folded on your head or left at the side — never in the communal water." },
  { cat: "general", title: "Rubbish bins are rare",       body: "Japan has almost no public bins yet is spotless. Carry a small bag for your trash and dispose at your hotel or a convenience store." },
  { cat: "general", title: "Queuing is sacred",           body: "Always queue in line — for trains, escalators (stand left, walk right in Tokyo), restaurants. Cutting in is a serious faux pas." },
  { cat: "general", title: "Pointing is impolite",        body: "Use an open hand to gesture toward something rather than pointing with a single finger." },
];

const CAT_COLORS = {
  respect: { bg: "#FBEAF0", text: "#72243E", label: "respect" },
  food:    { bg: "#FAEEDA", text: "#633806", label: "food & drink" },
  money:   { bg: "#EAF3DE", text: "#27500A", label: "money" },
  onsen:   { bg: "#E6F1FB", text: "#0C447C", label: "onsen" },
  general: { bg: "#F1EFE8", text: "#444441", label: "general" },
};
const EXPENSE_CATS = ["transport", "food", "lodging", "activities", "shopping", "other"];
const CAT_BAR_COLORS = {
  transport: "#378ADD", food: "#BA7517", lodging: "#7F77DD",
  activities: "#1D9E75", shopping: "#D4537E", other: "#888780",
};

// ─── Supabase helpers ─────────────────────────────────────────────────────────

/**
 * Load a key from planner_state. Returns the parsed value, or `fallback` if
 * the row doesn't exist yet (first load). Also seeds the row on first load.
 */
async function loadOrSeed(key, fallback) {
  const { data, error } = await supabase
    .from("planner_state")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) {
    // Row doesn't exist — seed it
    await supabase.from("planner_state").upsert({ key, value: fallback, updated_at: new Date().toISOString() });
    return fallback;
  }
  return data.value;
}

/** Persist a value back to Supabase. */
async function persist(key, value) {
  await supabase
    .from("planner_state")
    .upsert({ key, value, updated_at: new Date().toISOString() });
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  app:         { fontFamily: "'Georgia', serif", background: "#F5F0E8", minHeight: "100vh" },
  header:      { background: "#2C2416", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo:        { fontSize: "20px", color: "#F5F0E8", fontWeight: "400", letterSpacing: "0.5px" },
  logoSub:     { fontSize: "12px", color: "#A89878", marginTop: "2px", fontFamily: "sans-serif" },
  syncDot:     { width: "7px", height: "7px", borderRadius: "50%", display: "inline-block", marginRight: "5px" },
  syncLabel:   { fontSize: "11px", fontFamily: "sans-serif", display: "flex", alignItems: "center" },
  tabs:        { display: "flex", gap: "4px", background: "#3D3020", borderRadius: "8px", padding: "3px" },
  tab:         { padding: "6px 14px", borderRadius: "6px", fontSize: "13px", cursor: "pointer", color: "#A89878", border: "none", background: "none", fontFamily: "sans-serif", transition: "all 0.15s" },
  tabActive:   { background: "#F5F0E8", color: "#2C2416", fontWeight: "500" },
  content:     { padding: "22px 24px" },
  card:        { background: "#FFFDF8", border: "0.5px solid #D4C9B0", borderRadius: "12px", padding: "18px 20px", marginBottom: "14px" },
  cardTitle:   { fontSize: "14px", fontWeight: "500", color: "#2C2416", marginBottom: "12px", fontFamily: "sans-serif" },
  statGrid:    { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "10px", marginBottom: "16px" },
  stat:        { background: "#EDE8DC", borderRadius: "8px", padding: "12px 14px" },
  statVal:     { fontSize: "22px", fontWeight: "500", color: "#2C2416", fontFamily: "sans-serif" },
  statLabel:   { fontSize: "12px", color: "#7A6E5F", marginTop: "2px", fontFamily: "sans-serif" },
  taskRow:     { display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "0.5px solid #E8E0D0", cursor: "pointer" },
  cb:          { width: "16px", height: "16px", borderRadius: "4px", border: "1px solid #B8AD9A", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" },
  cbOn:        { background: "#5C7A3E", borderColor: "#5C7A3E" },
  tag:         { fontSize: "11px", color: "#7A6E5F", background: "#EDE8DC", padding: "2px 7px", borderRadius: "99px", whiteSpace: "nowrap", fontFamily: "sans-serif" },
  addRow:      { display: "flex", gap: "8px", marginTop: "12px" },
  input:       { flex: 1, padding: "8px 10px", border: "0.5px solid #C8BFAA", borderRadius: "8px", fontSize: "13px", background: "#FFFDF8", color: "#2C2416", fontFamily: "sans-serif" },
  btn:         { padding: "8px 14px", border: "0.5px solid #C8BFAA", borderRadius: "8px", fontSize: "13px", cursor: "pointer", background: "#FFFDF8", color: "#2C2416", fontFamily: "sans-serif" },
  btnPrimary:  { background: "#5C7A3E", color: "white", border: "none" },
  twoCol:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" },
  tipCard:     { background: "#FFFDF8", border: "0.5px solid #D4C9B0", borderRadius: "10px", padding: "14px 16px", marginBottom: "10px" },
  tipTitle:    { fontSize: "14px", fontWeight: "500", color: "#2C2416", marginBottom: "4px", fontFamily: "sans-serif" },
  tipBody:     { fontSize: "13px", color: "#5C5347", lineHeight: "1.6", fontFamily: "sans-serif" },
  calGrid:     { display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: "4px" },
  calDay:      { background: "#FFFDF8", border: "0.5px solid #D4C9B0", borderRadius: "6px", padding: "6px", minHeight: "58px", fontSize: "12px", fontFamily: "sans-serif" },
  calDayNum:   { fontWeight: "500", color: "#2C2416", marginBottom: "3px", fontSize: "13px" },
  calDayBlank: { background: "transparent", border: "none", minHeight: "58px" },
  cityCard:    { background: "#FFFDF8", border: "0.5px solid #D4C9B0", borderRadius: "10px", padding: "12px 14px", marginBottom: "8px", display: "flex", gap: "12px", alignItems: "flex-start" },
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]           = useState("map");
  const [ready, setReady]       = useState(false);   // true once initial load done
  const [syncStatus, setSyncStatus] = useState("synced"); // "synced" | "saving" | "error"

  // Persisted state
  const [tasks,    setTasksRaw]    = useState([]);
  const [expenses, setExpensesRaw] = useState([]);
  const [events,   setEventsRaw]   = useState([]);
  const [budget,   setBudgetRaw]   = useState(DEFAULT_BUDGET);

  // Transient UI state
  const [newTask,     setNewTask]     = useState("");
  const [expName,     setExpName]     = useState("");
  const [expAmt,      setExpAmt]      = useState("");
  const [expCat,      setExpCat]      = useState("food");
  const [newEvtDay,   setNewEvtDay]   = useState("");
  const [newEvtLabel, setNewEvtLabel] = useState("");
  const [tipFilter,   setTipFilter]   = useState("all");

  // Track whether changes originated locally (to avoid re-applying our own realtime echo)
  const localWrite = useRef(false);

  // ── Persist helpers (wrap raw setters) ──────────────────────────────────────
  async function save(key, value) {
    setSyncStatus("saving");
    localWrite.current = true;
    try {
      await persist(key, value);
      setSyncStatus("synced");
    } catch {
      setSyncStatus("error");
    }
  }

  function setTasks(v)    { setTasksRaw(v);    save("tasks", v); }
  function setExpenses(v) { setExpensesRaw(v); save("expenses", v); }
  function setEvents(v)   { setEventsRaw(v);   save("events", v); }
  function setBudget(v)   { setBudgetRaw(v);   save("budget", v); }

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function bootstrap() {
      const [t, e, ev, b] = await Promise.all([
        loadOrSeed("tasks",    DEFAULT_TASKS),
        loadOrSeed("expenses", DEFAULT_EXPENSES),
        loadOrSeed("events",   DEFAULT_EVENTS),
        loadOrSeed("budget",   DEFAULT_BUDGET),
      ]);
      setTasksRaw(t);
      setExpensesRaw(e);
      setEventsRaw(ev);
      setBudgetRaw(b);
      setReady(true);
    }
    bootstrap();
  }, []);

  // ── Realtime subscription ────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("planner_state_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planner_state" },
        (payload) => {
          // If this change came from us, skip it
          if (localWrite.current) {
            localWrite.current = false;
            return;
          }
          const { key, value } = payload.new;
          if (key === "tasks")    setTasksRaw(value);
          if (key === "expenses") setExpensesRaw(value);
          if (key === "events")   setEventsRaw(value);
          if (key === "budget")   setBudgetRaw(value);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────────
  const totalSpent   = expenses.reduce((s, e) => s + e.amt, 0);
  const catTotals    = EXPENSE_CATS
    .map(cat => ({ cat, total: expenses.filter(e => e.cat === cat).reduce((s, e) => s + e.amt, 0) }))
    .filter(c => c.total > 0);
  const filteredTips = tipFilter === "all" ? TIPS : TIPS.filter(t => t.cat === tipFilter);

  const DAYS_IN_APRIL = 30;
  const FIRST_DOW     = new Date(2026, 3, 1).getDay();

  // ── Actions ───────────────────────────────────────────────────────────────────
  function toggleTask(i) {
    setTasks(tasks.map((t, idx) => idx === i ? { ...t, done: !t.done } : t));
  }
  function addTask() {
    if (!newTask.trim()) return;
    setTasks([...tasks, { label: newTask.trim(), tag: "other", done: false }]);
    setNewTask("");
  }
  function addExpense() {
    const amt = parseFloat(expAmt);
    if (!expName.trim() || !amt) return;
    setExpenses([...expenses, { name: expName.trim(), amt, cat: expCat }]);
    setExpName(""); setExpAmt("");
  }
  function addEvent() {
    const day = parseInt(newEvtDay);
    if (!day || !newEvtLabel.trim()) return;
    setEvents([...events, { day, label: newEvtLabel.trim(), color: "#7F77DD" }]);
    setNewEvtDay(""); setNewEvtLabel("");
  }

  // ── Sync status indicator ─────────────────────────────────────────────────────
  const syncDotColor = { synced: "#5C7A3E", saving: "#BA7517", error: "#C0392B" }[syncStatus];
  const syncText     = { synced: "synced", saving: "saving…", error: "sync error" }[syncStatus];

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div style={{ ...s.app, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#7A6E5F", fontFamily: "sans-serif", fontSize: "14px" }}>
          <div style={{ fontSize: "28px", marginBottom: "12px" }}>🗾</div>
          Loading your planner…
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={s.app}>
      <div style={s.header}>
        <div>
          <div style={s.logo}>Japan April 2026</div>
          <div style={s.logoSub}>Osaka → Kyoto → Kanazawa → Hakone → Tokyo</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Sync status pill */}
          <div style={{ ...s.syncLabel, color: syncDotColor }}>
            <span style={{ ...s.syncDot, background: syncDotColor }} />
            {syncText}
          </div>
          <div style={s.tabs}>
            {["map", "checklist", "budget", "tips", "calendar"].map(t => (
              <button
                key={t}
                style={tab === t ? { ...s.tab, ...s.tabActive } : s.tab}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={s.content}>

        {/* ── Map ── */}
        {tab === "map" && (
          <div>
            <div style={{ ...s.card, padding: "0", overflow: "hidden", marginBottom: "14px" }}>
              <MapContainer center={[35.8, 136.5]} zoom={6} style={{ height: "380px", width: "100%" }} scrollWheelZoom={false}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution="© OpenStreetMap © CARTO" />
                <Polyline positions={ROUTE} color="#8B6914" weight={2} dashArray="6,6" />
                {CITIES.map((c) => (
                  <Marker key={c.name} position={[c.lat, c.lng]}>
                    <Popup><strong>{c.emoji} {c.name}</strong><br />{c.days}<br />{c.desc}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
            <div>
              {CITIES.map((c, i) => (
                <div key={c.name} style={s.cityCard}>
                  <div style={{ fontSize: "24px" }}>{c.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "15px", fontWeight: "500", color: "#2C2416", fontFamily: "sans-serif" }}>
                      {c.name} <span style={{ fontSize: "12px", color: "#7A6E5F", fontWeight: "400" }}>{c.days}</span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#5C5347", marginTop: "3px", fontFamily: "sans-serif" }}>{c.desc}</div>
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: "500", color: "#7A6E5F", fontFamily: "sans-serif" }}>stop {i + 1}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Checklist ── */}
        {tab === "checklist" && (
          <div style={s.twoCol}>
            <div style={s.card}>
              <div style={s.cardTitle}>pre-trip checklist</div>
              {tasks.map((t, i) => (
                <div
                  key={i}
                  style={{ ...s.taskRow, borderBottom: i === tasks.length - 1 ? "none" : "0.5px solid #E8E0D0" }}
                  onClick={() => toggleTask(i)}
                >
                  <div style={{ ...s.cb, ...(t.done ? s.cbOn : {}) }}>
                    {t.done && (
                      <svg width="9" height="7" viewBox="0 0 9 7">
                        <polyline points="1,3.5 3.5,6 8,1" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, fontSize: "13px", color: t.done ? "#A89878" : "#2C2416", textDecoration: t.done ? "line-through" : "none", fontFamily: "sans-serif" }}>{t.label}</div>
                  <div style={s.tag}>{t.tag}</div>
                </div>
              ))}
              <div style={s.addRow}>
                <input style={s.input} value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="add a task…" onKeyDown={e => e.key === "Enter" && addTask()} />
                <button style={{ ...s.btn, ...s.btnPrimary }} onClick={addTask}>add</button>
              </div>
            </div>
            <div>
              <div style={s.card}>
                <div style={s.cardTitle}>progress</div>
                <div style={s.statGrid}>
                  <div style={s.stat}><div style={s.statVal}>{tasks.filter(t => t.done).length}</div><div style={s.statLabel}>done</div></div>
                  <div style={s.stat}><div style={s.statVal}>{tasks.filter(t => !t.done).length}</div><div style={s.statLabel}>remaining</div></div>
                  <div style={s.stat}><div style={s.statVal}>{Math.round(tasks.filter(t => t.done).length / tasks.length * 100)}%</div><div style={s.statLabel}>complete</div></div>
                </div>
                <div style={{ height: "6px", background: "#EDE8DC", borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round(tasks.filter(t => t.done).length / tasks.length * 100)}%`, background: "#5C7A3E", borderRadius: "99px", transition: "width 0.3s" }} />
                </div>
              </div>
              <div style={s.card}>
                <div style={s.cardTitle}>important reminders</div>
                {[
                  "JR Pass must be purchased BEFORE you arrive in Japan",
                  "teamLab Planets Tokyo books out weeks ahead",
                  "Ryokans often require early booking especially in cherry blossom season",
                  "IC cards (Suica) can now be added to Apple/Google Wallet",
                ].map((r, i) => (
                  <div key={i} style={{ fontSize: "13px", color: "#5C5347", padding: "7px 0", borderBottom: i === 3 ? "none" : "0.5px solid #E8E0D0", fontFamily: "sans-serif", lineHeight: "1.5" }}>
                    ⚠ {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Budget ── */}
        {tab === "budget" && (
          <div>
            <div style={s.statGrid}>
              <div style={s.stat}><div style={s.statVal}>${budget.toLocaleString()}</div><div style={s.statLabel}>budget</div></div>
              <div style={s.stat}><div style={s.statVal}>${totalSpent.toLocaleString()}</div><div style={s.statLabel}>total spent</div></div>
              <div style={s.stat}><div style={s.statVal}>${(budget - totalSpent).toLocaleString()}</div><div style={s.statLabel}>remaining</div></div>
            </div>
            <div style={{ height: "6px", background: "#EDE8DC", borderRadius: "99px", overflow: "hidden", marginBottom: "16px" }}>
              <div style={{ height: "100%", width: `${Math.min(100, Math.round(totalSpent / budget * 100))}%`, background: totalSpent > budget ? "#C0392B" : "#5C7A3E", borderRadius: "99px" }} />
            </div>
            <div style={s.twoCol}>
              <div style={s.card}>
                <div style={s.cardTitle}>expenses</div>
                {expenses.map((e, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i === expenses.length - 1 ? "none" : "0.5px solid #E8E0D0" }}>
                    <div>
                      <div style={{ fontSize: "13px", color: "#2C2416", fontFamily: "sans-serif" }}>{e.name}</div>
                      <div style={{ fontSize: "11px", color: "#7A6E5F", fontFamily: "sans-serif" }}>{e.cat}</div>
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "500", color: "#2C2416", fontFamily: "sans-serif" }}>${e.amt.toLocaleString()}</div>
                  </div>
                ))}
                <div style={s.addRow}>
                  <input style={{ ...s.input, flex: 2 }} value={expName} onChange={e => setExpName(e.target.value)} placeholder="expense name" />
                  <input style={{ ...s.input, width: "80px", flex: "none" }} value={expAmt} onChange={e => setExpAmt(e.target.value)} placeholder="$" type="number" />
                  <select style={{ ...s.input, flex: "none" }} value={expCat} onChange={e => setExpCat(e.target.value)}>
                    {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <button style={{ ...s.btn, ...s.btnPrimary }} onClick={addExpense}>add</button>
                </div>
              </div>
              <div style={s.card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={s.cardTitle}>total budget ($)</div>
                  <input
                    style={{ ...s.input, width: "100px", flex: "none", textAlign: "right" }}
                    type="number"
                    value={budget}
                    onChange={e => setBudget(Number(e.target.value))}
                  />
                </div>
                {catTotals.map(c => (
                  <div key={c.cat} style={{ marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#7A6E5F", marginBottom: "5px", fontFamily: "sans-serif" }}>
                      <span>{c.cat}</span><span>${c.total.toLocaleString()}</span>
                    </div>
                    <div style={{ height: "5px", background: "#EDE8DC", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, Math.round(c.total / totalSpent * 100))}%`, background: CAT_BAR_COLORS[c.cat] || "#888780", borderRadius: "99px" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tips ── */}
        {tab === "tips" && (
          <div>
            <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
              {["all", "respect", "food", "money", "onsen", "general"].map(f => (
                <button key={f} onClick={() => setTipFilter(f)} style={{ ...s.btn, ...(tipFilter === f ? s.btnPrimary : {}), padding: "5px 12px", fontSize: "12px" }}>{f}</button>
              ))}
            </div>
            <div style={{ columns: "2", columnGap: "14px" }}>
              {filteredTips.map((t, i) => (
                <div key={i} style={{ ...s.tipCard, breakInside: "avoid", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <div style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: CAT_COLORS[t.cat]?.bg, color: CAT_COLORS[t.cat]?.text, fontFamily: "sans-serif", fontWeight: "500", whiteSpace: "nowrap" }}>
                      {CAT_COLORS[t.cat]?.label}
                    </div>
                    <div style={s.tipTitle}>{t.title}</div>
                  </div>
                  <div style={s.tipBody}>{t.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Calendar ── */}
        {tab === "calendar" && (
          <div style={s.card}>
            <div style={{ ...s.cardTitle, marginBottom: "16px" }}>April 2026</div>
            <div style={{ ...s.calGrid, marginBottom: "6px" }}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: "12px", color: "#7A6E5F", fontFamily: "sans-serif", padding: "4px 0", fontWeight: "500" }}>{d}</div>
              ))}
            </div>
            <div style={s.calGrid}>
              {Array(FIRST_DOW).fill(null).map((_, i) => <div key={"b" + i} style={s.calDayBlank} />)}
              {Array(DAYS_IN_APRIL).fill(null).map((_, i) => {
                const day = i + 1;
                const evt = events.find(e => e.day === day);
                const inTrip = day >= 1 && day <= 20;
                return (
                  <div key={day} style={{ ...s.calDay, background: inTrip ? "#FFF8EE" : "#FFFDF8", border: inTrip ? "0.5px solid #D4B870" : "0.5px solid #D4C9B0" }}>
                    <div style={{ ...s.calDayNum, color: inTrip ? "#8B6914" : "#2C2416" }}>{day}</div>
                    {evt && <div style={{ fontSize: "10px", color: evt.color, fontWeight: "500", lineHeight: "1.3" }}>{evt.label}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: "14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "12px", color: "#7A6E5F", fontFamily: "sans-serif", display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "12px", height: "12px", background: "#FFF8EE", border: "0.5px solid #D4B870", borderRadius: "3px" }} /> trip days (Apr 1–20)
              </div>
            </div>
            <div style={{ marginTop: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
              <input style={{ ...s.input, width: "60px", flex: "none" }} type="number" min="1" max="30" placeholder="day" value={newEvtDay} onChange={e => setNewEvtDay(e.target.value)} />
              <input style={{ ...s.input, flex: 1 }} placeholder="e.g. Osaka → Kyoto" value={newEvtLabel} onChange={e => setNewEvtLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && addEvent()} />
              <button style={{ ...s.btn, ...s.btnPrimary }} onClick={addEvent}>add</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
