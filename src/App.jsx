import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  LayoutDashboard, CheckSquare, Target, Database, Zap, Search,
  ChevronRight, RefreshCw, Wifi, WifiOff, Loader, AlertTriangle,
  Clock, Award, TrendingUp, User, Filter, Menu, X,
} from "lucide-react";

/* ══════════════════════════════════════════════════════
   CONFIG
   ══════════════════════════════════════════════════════ */
const SHEET_ID = "1KZxSaMPMok6a08vzkz46MTVEAWvCh2V3kC2hq0xCY0U";
const csvUrl = (tab) =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
const PENDING_TAB = "Pratik";
const DONE_TAB = "Status-Complete";
const REFRESH = 5 * 60 * 1000;
const PP = 20;

const C = {
  navy: "#0F0F83", purple: "#4C4CCC", dark: "#272756", green: "#1FB15A",
  bg: "#f6f7fb", card: "#ffffff", bdr: "#e4e6ef",
  txt: "#1a1a2e", sub: "#6b7094", muted: "#9ca0b8",
  danger: "#e53e3e", dangerBg: "#fff5f5",
  warn: "#ed8936", warnBg: "#fffaf0",
  okBg: "#f0fff4", infoBg: "#ebf8ff", info: "#3182ce",
};
const PIE = [
  C.navy, C.purple, C.green, C.warn, C.info, C.danger,
  "#805AD5", "#ed64a6", "#38b2ac", "#dd6b20", "#667eea",
];

/* ══════════════════════════════════════════════════════
   CSV PARSER
   ══════════════════════════════════════════════════════ */
function parseCSV(text) {
  const lines = [];
  let cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (q && text[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (ch === "\n" && !q) { lines.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur) lines.push(cur);

  return lines.map((line) => {
    const cells = [];
    let cell = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cell += '"'; i++; } else inQ = !inQ;
      } else if (c === "," && !inQ) { cells.push(cell.trim()); cell = ""; }
      else cell += c;
    }
    cells.push(cell.trim());
    return cells;
  });
}

/* ══════════════════════════════════════════════════════
   ROW → TASK  (columns: A‑Sr B‑Project C‑Platform D‑Status
   E‑CompleteDate F‑Received G‑DevUAT H‑TestDate I‑Owner J‑Desc)
   ══════════════════════════════════════════════════════ */
function rowToTask(r, isDone) {
  const project = r[1] || "";
  const platform = r[2] || "";
  const desc = (r[9] || "").replace(/"/g, "").trim();
  if (!project && !desc) return null;

  const raw = r[3] || "";
  const sl = raw.toLowerCase();
  const status = isDone || sl.includes("complete") || sl.includes("closed")
    ? "Completed"
    : sl.includes("progress") ? "In Progress"
    : sl.includes("hold") ? "On Hold"
    : sl.includes("review") ? "Given for Review"
    : raw || "Pending";

  const dl = (desc + project + platform).toLowerCase();
  const priority = dl.includes("critical") ? "Critical"
    : dl.includes("urgent") || dl.includes("trading") || dl.includes("revamp") ? "High"
    : dl.includes("banner") || dl.includes("icon") ? "Low" : "Medium";

  const received = r[5] || "";
  const completeDate = r[4] || "";
  const devUAT = r[6] || "";

  return {
    id: `P-${r[0] || Math.random().toString(36).slice(2, 7)}`,
    srNo: r[0] || "",
    title: project,
    project: platform || project,
    platform,
    status,
    priority,
    owner: r[8] || "Pratik",
    received,
    completeDate,
    devUAT,
    testDate: r[7] || "",
    dueDate: completeDate || devUAT || received,
    description: desc,
    progress: status === "Completed" ? 100 : 20 + Math.floor(Math.random() * 55),
    critical: priority === "Critical",
  };
}

/* ══════════════════════════════════════════════════════
   SMALL COMPONENTS
   ══════════════════════════════════════════════════════ */
function StatusBadge({ status }) {
  const l = (status || "").toLowerCase();
  const m = l.includes("complete") || l.includes("closed")
    ? { bg: C.okBg, fg: C.green }
    : l.includes("progress") ? { bg: C.infoBg, fg: C.info }
    : l.includes("hold") ? { bg: "#f0f0f0", fg: "#888" }
    : { bg: C.warnBg, fg: C.warn };
  return (
    <span style={{
      background: m.bg, color: m.fg, border: `1px solid ${m.fg}30`,
      padding: "4px 12px", borderRadius: 7, fontSize: 13, fontWeight: 600,
      whiteSpace: "nowrap", lineHeight: 1,
    }}>{status}</span>
  );
}

function PrioBadge({ p }) {
  const c = { Critical: C.danger, High: C.warn, Medium: C.info, Low: C.green }[p] || "#999";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: c }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }} />{p}
    </span>
  );
}

function ProgressBar({ value, h = 7 }) {
  const bg = value === 100 ? C.green : value > 60 ? C.purple : value > 30 ? C.warn : C.danger;
  return (
    <div style={{ width: "100%", background: "#e8eaf0", borderRadius: h, height: h, overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", borderRadius: h, background: bg, transition: "width .4s" }} />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, accent = C.navy }) {
  return (
    <div style={{
      background: C.card, borderRadius: 16, padding: "20px 22px",
      border: `1px solid ${C.bdr}`, flex: "1 1 0", minWidth: 150,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, background: `${accent}12`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={18} color={accent} />
        </div>
        <span style={{ fontSize: 14, color: C.sub, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: C.txt, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

/* chart card wrapper */
function ChartCard({ title, children, style: s }) {
  return (
    <div style={{
      background: C.card, borderRadius: 16, padding: 22,
      border: `1px solid ${C.bdr}`, ...s,
    }}>
      <h4 style={{ fontSize: 15, fontWeight: 600, color: C.txt, margin: "0 0 14px" }}>{title}</h4>
      {children}
    </div>
  );
}

/* pie legend */
function PieLegend({ data, colors }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 10 }}>
      {data.map((d, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.sub }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: colors[i % colors.length], flexShrink: 0 }} />
          {d.name} ({d.value})
        </span>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════════════ */
export default function App() {
  const [page, setPage] = useState("overview");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [fetchInfo, setFetchInfo] = useState({ pending: 0, done: 0, ok: false });
  const [search, setSearch] = useState("");
  const [view, setView] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [timeRange, setTimeRange] = useState("all");
  const [pg, setPg] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);

  /* ─── Fetch ─── */
  const doFetch = useCallback(async () => {
    setLoading(true);
    const all = [];
    let pendCount = 0, doneCount = 0, ok = false;

    // 1) Pratik pending tab
    try {
      const resp = await fetch(csvUrl(PENDING_TAB));
      if (resp.ok) {
        const rows = parseCSV(await resp.text());
        if (rows.length > 1) {
          pendCount = rows.length - 1;
          ok = true;
          for (let i = 1; i < rows.length; i++) {
            const t = rowToTask(rows[i], false);
            if (t) all.push(t);
          }
        }
      }
    } catch (e) { console.warn("Pending tab:", e.message); }

    // 2) Status-Complete tab → only Pratik rows
    try {
      const resp = await fetch(csvUrl(DONE_TAB));
      if (resp.ok) {
        const rows = parseCSV(await resp.text());
        if (rows.length > 1) {
          ok = true;
          for (let i = 1; i < rows.length; i++) {
            const owner = (rows[i][8] || "").trim().toLowerCase();
            if (owner === "pratik" || owner === "") {
              const t = rowToTask(rows[i], true);
              if (t) { all.push(t); doneCount++; }
            }
          }
        }
      }
    } catch (e) { console.warn("Complete tab:", e.message); }

    setTasks(all);
    setFetchInfo({ pending: pendCount, done: doneCount, ok });
    setLastFetch(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { doFetch(); }, [doFetch]);
  useEffect(() => { const iv = setInterval(doFetch, REFRESH); return () => clearInterval(iv); }, [doFetch]);

  /* ─── Filtering & Sorting ─── */
  const filtered = useMemo(() => {
    let t = [...tasks];
    if (view === "pending") t = t.filter((x) => x.status !== "Completed");
    else if (view === "completed") t = t.filter((x) => x.status === "Completed");

    if (search) {
      const q = search.toLowerCase();
      t = t.filter((x) =>
        [x.title, x.project, x.platform, x.owner, x.description]
          .some((f) => (f || "").toLowerCase().includes(q))
      );
    }

    if (timeRange !== "all") {
      const now = new Date(), cut = new Date();
      if (timeRange === "week") cut.setDate(now.getDate() - 7);
      else if (timeRange === "month") cut.setMonth(now.getMonth() - 1);
      else if (timeRange === "quarter") cut.setMonth(now.getMonth() - 3);
      else if (timeRange === "year") cut.setFullYear(now.getFullYear() - 1);
      t = t.filter((x) => { const d = new Date(x.dueDate || x.received); return !isNaN(d) && d >= cut; });
    }

    const sorters = {
      date: (a, b) => new Date(b.dueDate || b.received || 0) - new Date(a.dueDate || a.received || 0),
      priority: (a, b) => {
        const o = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return (o[a.priority] ?? 3) - (o[b.priority] ?? 3);
      },
      project: (a, b) => (a.project || "").localeCompare(b.project || ""),
      status: (a, b) => (a.status || "").localeCompare(b.status || ""),
    };
    t.sort(sorters[sortBy] || sorters.date);
    return t;
  }, [tasks, search, view, sortBy, timeRange]);

  const paged = useMemo(() => filtered.slice(pg * PP, (pg + 1) * PP), [filtered, pg]);
  const totalPg = Math.ceil(filtered.length / PP);

  const stats = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter((x) => x.status === "Completed").length,
    active: tasks.filter((x) => x.status !== "Completed").length,
    crit: tasks.filter((x) => x.critical && x.status !== "Completed").length,
  }), [tasks]);

  /* ─── Chart Data ─── */
  const statusPie = useMemo(() => {
    const m = {};
    filtered.forEach((t) => { m[t.status] = (m[t.status] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const platformPie = useMemo(() => {
    const m = {};
    filtered.forEach((t) => { const k = t.platform || t.project || "Other"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const prioPie = useMemo(() =>
    [
      { name: "Critical", value: filtered.filter((x) => x.priority === "Critical").length, color: C.danger },
      { name: "High", value: filtered.filter((x) => x.priority === "High").length, color: C.warn },
      { name: "Medium", value: filtered.filter((x) => x.priority === "Medium").length, color: C.info },
      { name: "Low", value: filtered.filter((x) => x.priority === "Low").length, color: C.green },
    ].filter((x) => x.value > 0),
  [filtered]);

  const monthlyChart = useMemo(() => {
    const m = {};
    filtered.forEach((t) => {
      const raw = t.received || t.dueDate;
      if (!raw) return;
      const d = new Date(raw);
      if (isNaN(d)) return;
      m[d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })] =
        (m[d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })] || 0) + 1;
    });
    return Object.entries(m).map(([month, count]) => ({ month, count }));
  }, [filtered]);

  /* ─── Nav ─── */
  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "tasks", label: "My Tasks", icon: CheckSquare },
    { id: "focus", label: "Focus Mode", icon: Target },
    { id: "data", label: "Data Source", icon: Database },
  ];

  const navigate = (id) => { setPage(id); setPg(0); setMobileNav(false); };

  /* ─── Connection Bar ─── */
  const ConnBar = () => (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 16px", borderRadius: 12, marginBottom: 20,
      background: fetchInfo.ok ? C.okBg : C.warnBg,
      border: `1px solid ${fetchInfo.ok ? C.green : C.warn}25`,
      flexWrap: "wrap",
    }}>
      {fetchInfo.ok ? <Wifi size={16} color={C.green} /> : <WifiOff size={16} color={C.warn} />}
      <span style={{ fontSize: 14, fontWeight: 600, color: fetchInfo.ok ? C.green : C.warn }}>
        {fetchInfo.ok ? "Live" : "Offline"}
      </span>
      <span style={{ fontSize: 14, color: C.sub }}>
        {fetchInfo.pending} pending + {fetchInfo.done} completed rows
      </span>
      {lastFetch && (
        <span style={{ fontSize: 13, color: C.muted, marginLeft: "auto" }}>
          Updated {lastFetch.toLocaleTimeString()}
        </span>
      )}
      <button onClick={doFetch} disabled={loading} style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "6px 14px", borderRadius: 8,
        border: `1px solid ${C.bdr}`, background: C.card,
        fontSize: 13, fontWeight: 600, color: C.navy,
      }}>
        <RefreshCw size={14} className={loading ? "spinning" : ""} />
        {loading ? "Fetching…" : "Refresh"}
      </button>
    </div>
  );

  /* ═══════════════════════════════════════════════
     LOADING SCREEN
     ═══════════════════════════════════════════════ */
  if (loading && tasks.length === 0) {
    return (
      <div style={{
        minHeight: "100vh", background: C.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 22, padding: 24,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, background: `${C.navy}12`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Loader size={34} color={C.navy} className="spinning" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.navy, textAlign: "center" }}>
          Loading Pratik's task data…
        </h2>
        <p style={{ fontSize: 15, color: C.sub, textAlign: "center", maxWidth: 400 }}>
          Connecting to Google Sheets — fetching "{PENDING_TAB}" tab (pending tasks)
          and "{DONE_TAB}" tab (completed tasks)
        </p>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════
     OVERVIEW PAGE
     ═══════════════════════════════════════════════ */
  const Overview = () => (
    <div className="fade-up">
      <ConnBar />

      {/* Metric Cards */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <MetricCard icon={CheckSquare} label="Total Tasks" value={stats.total} sub="From Google Sheets" />
        <MetricCard icon={Award} label="Completed" value={stats.done}
          sub={`${stats.total ? Math.round((stats.done / stats.total) * 100) : 0}% completion rate`} accent={C.green} />
        <MetricCard icon={Clock} label="Active" value={stats.active} sub="Pending / In Progress" accent={C.warn} />
        <MetricCard icon={AlertTriangle} label="Critical" value={stats.crit} sub="Needs attention" accent={C.danger} />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, marginBottom: 24 }}>
        <ChartCard title="Tasks by status">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusPie} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} dataKey="value">
                {statusPie.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 14, border: `1px solid ${C.bdr}` }} />
            </PieChart>
          </ResponsiveContainer>
          <PieLegend data={statusPie} colors={PIE} />
        </ChartCard>

        <ChartCard title="Tasks by platform">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={platformPie} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={1} dataKey="value">
                {platformPie.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 14, border: `1px solid ${C.bdr}` }} />
            </PieChart>
          </ResponsiveContainer>
          <PieLegend data={platformPie.slice(0, 6)} colors={PIE} />
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
        <ChartCard title="Tasks by priority">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={prioPie} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} dataKey="value">
                {prioPie.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 14, border: `1px solid ${C.bdr}` }} />
            </PieChart>
          </ResponsiveContainer>
          <PieLegend data={prioPie} colors={prioPie.map((x) => x.color)} />
        </ChartCard>

        <ChartCard title="Monthly timeline">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#efefef" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 14, border: `1px solid ${C.bdr}` }} />
              <Bar dataKey="count" fill={C.green} radius={[5, 5, 0, 0]} name="Tasks" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════
     TASKS PAGE
     ═══════════════════════════════════════════════ */
  const TasksPage = () => {
    const doneC = tasks.filter((t) => t.status === "Completed").length;
    const pendC = tasks.filter((t) => t.status !== "Completed").length;

    return (
      <div className="fade-up">
        <ConnBar />

        {/* Mini metrics */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          <MetricCard icon={CheckSquare} label="Total" value={stats.total} />
          <MetricCard icon={Award} label="Done" value={stats.done} accent={C.green} />
          <MetricCard icon={Clock} label="Active" value={stats.active} accent={C.warn} />
          <MetricCard icon={AlertTriangle} label="Critical" value={stats.crit} accent={C.danger} />
        </div>

        {/* Mini charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
          <ChartCard title="Status">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={statusPie} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={2} dataKey="value">
                  {statusPie.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
            <PieLegend data={statusPie} colors={PIE} />
          </ChartCard>

          <ChartCard title="Priority">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={prioPie} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={2} dataKey="value">
                  {prioPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
            <PieLegend data={prioPie} colors={prioPie.map((x) => x.color)} />
          </ChartCard>

          <ChartCard title="Platform">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={platformPie.slice(0, 6)} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={1} dataKey="value">
                  {platformPie.slice(0, 6).map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
            <PieLegend data={platformPie.slice(0, 5)} colors={PIE} />
          </ChartCard>
        </div>

        {/* Filters bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 14, flexWrap: "wrap",
        }}>
          {/* View toggle */}
          <div style={{ display: "flex", borderRadius: 10, border: `1px solid ${C.bdr}`, overflow: "hidden" }}>
            {[
              { k: "all", l: `All (${stats.total})` },
              { k: "pending", l: `Active (${pendC})` },
              { k: "completed", l: `Done (${doneC})` },
            ].map((v) => (
              <button key={v.k} onClick={() => { setView(v.k); setPg(0); }} style={{
                padding: "8px 16px", border: "none",
                background: view === v.k ? C.navy : "transparent",
                color: view === v.k ? "#fff" : C.sub,
                fontSize: 14, fontWeight: 600,
              }}>
                {v.l}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ flex: "1 1 180px", position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPg(0); }}
              placeholder="Search tasks, projects…"
              style={{
                width: "100%", padding: "9px 14px 9px 36px", borderRadius: 10,
                border: `1px solid ${C.bdr}`, fontSize: 14, background: C.card,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Sort */}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{
            padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.bdr}`,
            fontSize: 14, background: C.card,
          }}>
            <option value="date">Sort: Date</option>
            <option value="priority">Sort: Priority</option>
            <option value="project">Sort: Project</option>
            <option value="status">Sort: Status</option>
          </select>

          {/* Time range */}
          <select value={timeRange} onChange={(e) => { setTimeRange(e.target.value); setPg(0); }} style={{
            padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.bdr}`,
            fontSize: 14, background: C.card,
          }}>
            <option value="all">All time</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
            <option value="year">This year</option>
          </select>
        </div>

        <p style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
          {filtered.length} tasks · sorted by {sortBy}{timeRange !== "all" ? ` · ${timeRange}` : ""}
        </p>

        {/* Task List */}
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.bdr}`, overflow: "hidden" }}>
          {paged.map((t) => {
            const open = expanded === t.id;
            return (
              <div key={t.id} style={{ borderBottom: `1px solid ${C.bdr}` }}>
                {/* Row */}
                <div
                  onClick={() => setExpanded(open ? null : t.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto auto",
                    gap: 12, alignItems: "center",
                    padding: "14px 20px", cursor: "pointer",
                    transition: "background .1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafbfe")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 600, color: C.txt,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 3, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <span>{t.platform || t.project}</span>
                      <span>·</span>
                      <span>{t.received}</span>
                    </div>
                  </div>
                  <StatusBadge status={t.status} />
                  <PrioBadge p={t.priority} />
                  <ChevronRight size={16} color={C.muted} style={{
                    transform: open ? "rotate(90deg)" : "none",
                    transition: "transform .2s",
                  }} />
                </div>

                {/* Expanded Detail */}
                {open && (
                  <div style={{ padding: "0 20px 18px", background: "#fafbfe" }}>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 16, marginBottom: 14,
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 4 }}>Description</div>
                        <div style={{ fontSize: 14, color: C.txt, lineHeight: 1.7 }}>
                          {t.description || "No description available"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 6 }}>Details</div>
                        {[
                          ["Sr No", t.srNo],
                          ["Platform", t.platform],
                          ["Received", t.received],
                          ["Completed", t.completeDate || "—"],
                          ["Dev UAT", t.devUAT || "—"],
                          ["Testing", t.testDate || "—"],
                          ["Owner", t.owner],
                        ].map(([label, val]) => (
                          <div key={label} style={{ fontSize: 14, marginBottom: 4 }}>
                            <span style={{ color: C.sub, fontWeight: 600 }}>{label}: </span>
                            <span style={{ color: C.txt }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {t.status !== "Completed" && (
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.sub, marginBottom: 5 }}>Progress</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 300 }}>
                          <ProgressBar value={t.progress} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.navy, whiteSpace: "nowrap" }}>{t.progress}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: 48, textAlign: "center", color: C.muted, fontSize: 15 }}>
              {loading ? "Fetching from Google Sheets…" : "No tasks match your filters"}
            </div>
          )}

          {/* Pagination */}
          {totalPg > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px", borderTop: `1px solid ${C.bdr}`, background: "#fafbfe",
            }}>
              <span style={{ fontSize: 14, color: C.sub }}>
                {pg * PP + 1}–{Math.min((pg + 1) * PP, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button disabled={pg === 0} onClick={() => setPg(pg - 1)} style={{
                  padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.bdr}`,
                  background: "transparent", fontSize: 14,
                }}>Prev</button>
                <span style={{ padding: "6px 10px", fontSize: 14, color: C.sub }}>{pg + 1} / {totalPg}</span>
                <button disabled={pg >= totalPg - 1} onClick={() => setPg(pg + 1)} style={{
                  padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.bdr}`,
                  background: "transparent", fontSize: 14,
                }}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════
     FOCUS PAGE
     ═══════════════════════════════════════════════ */
  const FocusPage = () => {
    const active = tasks
      .filter((t) => t.status !== "Completed")
      .sort((a, b) => {
        const o = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return (o[a.priority] ?? 3) - (o[b.priority] ?? 3);
      });
    const top = active[0];

    if (!top) {
      return (
        <div style={{ textAlign: "center", padding: 60, color: C.muted, fontSize: 16 }}>
          No active tasks — everything is completed!
        </div>
      );
    }

    return (
      <div className="fade-up" style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: `${C.navy}10`, display: "inline-flex",
            alignItems: "center", justifyContent: "center", marginBottom: 12,
          }}>
            <Target size={30} color={C.navy} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: C.navy, margin: "0 0 4px" }}>Focus Mode</h2>
          <p style={{ fontSize: 15, color: C.sub }}>Your highest priority task right now</p>
        </div>

        <div style={{
          background: C.card, borderRadius: 18,
          border: `2px solid ${C.navy}22`, padding: 28,
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <PrioBadge p={top.priority} />
            <StatusBadge status={top.status} />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: C.txt, margin: "0 0 8px" }}>{top.title}</h3>
          <p style={{ fontSize: 15, color: C.sub, lineHeight: 1.7, margin: "0 0 16px" }}>
            {top.description || "No description available"}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {[top.platform || top.project, `Received: ${top.received}`].filter(Boolean).map((s, i) => (
              <span key={i} style={{
                background: "#f4f5fa", padding: "6px 14px",
                borderRadius: 10, fontSize: 14, color: C.sub,
              }}>{s}</span>
            ))}
          </div>
          {top.status !== "Completed" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 14, color: C.sub }}>Progress</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{top.progress}%</span>
              </div>
              <ProgressBar value={top.progress} h={10} />
            </div>
          )}
        </div>

        {active.length > 1 && (
          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontSize: 16, fontWeight: 600, color: C.sub, margin: "0 0 12px" }}>
              Up next ({active.length - 1} remaining)
            </h4>
            {active.slice(1, 6).map((t) => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 0", borderBottom: `1px solid ${C.bdr}`,
              }}>
                <PrioBadge p={t.priority} />
                <span style={{ flex: 1, fontSize: 15, color: C.txt }}>{t.title}</span>
                <StatusBadge status={t.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════
     DATA SOURCE PAGE
     ═══════════════════════════════════════════════ */
  const DataPage = () => (
    <div className="fade-up">
      <h3 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: "0 0 20px" }}>
        Google Sheets — Live Connection
      </h3>

      <div style={{
        background: C.card, borderRadius: 16, border: `1px solid ${C.bdr}`,
        padding: 24, marginBottom: 22,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Database size={24} color={C.navy} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 17 }}>Connected Spreadsheet</div>
            <a
              href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 14, color: C.purple, wordBreak: "break-all" }}
            >
              Open in Google Sheets ↗
            </a>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[
            { val: fetchInfo.pending, label: "Pending rows", accent: C.warn, bg: C.warnBg },
            { val: fetchInfo.done, label: "Completed rows", accent: C.green, bg: C.okBg },
            { val: tasks.length, label: "Total tasks parsed", accent: C.navy, bg: "#f0f0ff" },
          ].map((m, i) => (
            <div key={i} style={{
              padding: "14px 20px", background: m.bg,
              borderRadius: 14, border: `1px solid ${m.accent}25`,
              minWidth: 130,
            }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: m.accent }}>{m.val}</div>
              <div style={{ fontSize: 14, color: C.sub }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        background: C.card, borderRadius: 16, border: `1px solid ${C.bdr}`,
        overflow: "hidden", marginBottom: 22,
      }}>
        <div style={{
          padding: "14px 22px", background: "#f8f9fc",
          borderBottom: `1px solid ${C.bdr}`,
          display: "grid", gridTemplateColumns: "1fr 120px 80px",
          fontSize: 14, fontWeight: 600, color: C.sub,
        }}>
          <span>Source tab</span><span>Status</span><span>Rows</span>
        </div>
        {[
          { name: `"${PENDING_TAB}" (Pending tasks)`, ok: fetchInfo.pending > 0, count: fetchInfo.pending },
          { name: `"${DONE_TAB}" (Completed)`, ok: fetchInfo.done > 0, count: fetchInfo.done },
        ].map((s, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "1fr 120px 80px",
            padding: "14px 22px", borderBottom: `1px solid ${C.bdr}`,
            alignItems: "center", fontSize: 15,
          }}>
            <span style={{ fontWeight: 500 }}>{s.name}</span>
            <span style={{
              color: s.ok ? C.green : C.warn,
              fontWeight: 600, fontSize: 14,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {s.ok ? <><Wifi size={14} /> Connected</> : <><WifiOff size={14} /> No data</>}
            </span>
            <span style={{ fontWeight: 600, fontSize: 16 }}>{s.count}</span>
          </div>
        ))}
      </div>

      <div style={{
        padding: 22, background: C.infoBg, borderRadius: 16,
        border: `1px solid ${C.info}25`, fontSize: 15,
        color: C.sub, lineHeight: 1.8, marginBottom: 22,
      }}>
        <div style={{ fontWeight: 600, color: C.info, marginBottom: 8, fontSize: 16 }}>How it works</div>
        The dashboard fetches CSV data from your Google Sheet using the{" "}
        <code style={{ background: "#e0e8f0", padding: "2px 7px", borderRadius: 5, fontSize: 14 }}>gviz/tq</code>{" "}
        endpoint. It reads the <strong>"{PENDING_TAB}"</strong> tab for active tasks and the{" "}
        <strong>"{DONE_TAB}"</strong> tab for completed work (filtered to Owner = Pratik).
        Data auto-refreshes every 5 minutes.
        <div style={{ fontWeight: 600, color: C.info, marginTop: 12 }}>Requirement</div>
        The Google Sheet must be shared as <strong>"Anyone with the link can view"</strong>.
      </div>

      <button onClick={doFetch} disabled={loading} style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 28px", borderRadius: 12,
        border: "none", background: C.navy, color: "#fff",
        fontSize: 16, fontWeight: 600,
      }}>
        <RefreshCw size={18} className={loading ? "spinning" : ""} />
        {loading ? "Fetching…" : "Refresh all data now"}
      </button>
    </div>
  );

  /* ═══════════════════════════════════════════════
     LAYOUT
     ═══════════════════════════════════════════════ */
  const pages = { overview: Overview, tasks: TasksPage, focus: FocusPage, data: DataPage };
  const PageComponent = pages[page] || Overview;
  const sideW = sideOpen ? 240 : 68;

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* ─── SIDEBAR (desktop) ─── */}
      <nav style={{
        width: sideW, background: C.navy,
        height: "100vh", position: "fixed", left: 0, top: 0, zIndex: 100,
        display: "flex", flexDirection: "column",
        transition: "width .3s ease", overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          padding: sideOpen ? "20px 18px" : "20px 14px",
          display: "flex", alignItems: "center", gap: 12,
          borderBottom: "1px solid rgba(255,255,255,.1)",
        }}>
          <div
            onClick={() => setSideOpen(!sideOpen)}
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: "rgba(255,255,255,.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <Zap size={18} color="#fff" />
          </div>
          {sideOpen && (
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>Pratik</div>
              <div style={{ color: "rgba(255,255,255,.5)", fontSize: 13 }}>UI/UX Designer</div>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <div style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          {navItems.map((n) => {
            const active = page === n.id;
            return (
              <button key={n.id} onClick={() => navigate(n.id)} style={{
                display: "flex", alignItems: "center",
                gap: 12, padding: sideOpen ? "12px 16px" : "12px 16px",
                borderRadius: 12, border: "none",
                background: active ? "rgba(255,255,255,.15)" : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,.6)",
                fontSize: 15, fontWeight: active ? 600 : 400,
                justifyContent: sideOpen ? "flex-start" : "center",
                transition: "background .15s",
              }}>
                <n.icon size={20} />
                {sideOpen && <span>{n.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Live badge */}
        {sideOpen && (
          <div style={{
            padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,.1)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: fetchInfo.ok ? C.green : C.warn,
            }} />
            <span style={{ color: "rgba(255,255,255,.6)", fontSize: 13 }}>
              {fetchInfo.ok ? "Live · Google Sheets" : "Offline"}
            </span>
          </div>
        )}
      </nav>

      {/* ─── MOBILE NAV TOGGLE ─── */}
      <button onClick={() => setMobileNav(true)} style={{
        position: "fixed", top: 14, left: 14, zIndex: 90,
        width: 44, height: 44, borderRadius: 12, border: "none",
        background: C.navy, color: "#fff",
        display: "none", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,.2)",
      }} className="mobile-nav-btn">
        <Menu size={22} />
      </button>

      {/* ─── MOBILE NAV OVERLAY ─── */}
      {mobileNav && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,.4)",
        }} onClick={() => setMobileNav(false)}>
          <div style={{
            width: 280, height: "100%", background: C.navy,
            padding: "20px 16px",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Zap size={20} color="#fff" />
                <span style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Pratik</span>
              </div>
              <button onClick={() => setMobileNav(false)} style={{ border: "none", background: "transparent" }}>
                <X size={22} color="rgba(255,255,255,.6)" />
              </button>
            </div>
            {navItems.map((n) => (
              <button key={n.id} onClick={() => navigate(n.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: 12, border: "none",
                background: page === n.id ? "rgba(255,255,255,.15)" : "transparent",
                color: page === n.id ? "#fff" : "rgba(255,255,255,.6)",
                fontSize: 16, fontWeight: page === n.id ? 600 : 400,
                width: "100%", marginBottom: 4,
              }}>
                <n.icon size={20} />{n.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <div style={{ marginLeft: sideW, transition: "margin-left .3s" }} className="main-area">
        {/* Header */}
        <header style={{
          background: C.card, borderBottom: `1px solid ${C.bdr}`,
          padding: "14px 28px", display: "flex", alignItems: "center",
          justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50,
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.navy, margin: 0 }}>
              {
                { overview: "Overview", tasks: "My Tasks", focus: "Focus Mode", data: "Data Source" }[page]
              }
            </h1>
            <p style={{ fontSize: 14, color: C.sub, margin: "2px 0 0" }}>
              Pratik · UI/UX Designer · {new Date().toLocaleDateString("en-IN", {
                weekday: "long", day: "numeric", month: "short", year: "numeric",
              })}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 10,
              background: fetchInfo.ok ? C.okBg : C.warnBg,
              border: `1px solid ${fetchInfo.ok ? C.green : C.warn}20`,
            }}>
              {fetchInfo.ok ? <Wifi size={14} color={C.green} /> : <WifiOff size={14} color={C.warn} />}
              <span style={{ fontSize: 14, fontWeight: 600, color: fetchInfo.ok ? C.green : C.warn }}>
                {fetchInfo.ok ? `${tasks.length} tasks` : "Offline"}
              </span>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: C.navy, display: "flex", alignItems: "center",
              justifyContent: "center", color: "#fff", fontSize: 17, fontWeight: 700,
            }}>P</div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ padding: 28 }}>
          <PageComponent />
        </main>
      </div>

      {/* ─── RESPONSIVE CSS ─── */}
      <style>{`
        @media (max-width: 900px) {
          nav { display: none !important; }
          .main-area { margin-left: 0 !important; }
          .mobile-nav-btn { display: flex !important; }
        }
        @media (max-width: 600px) {
          main { padding: 16px !important; }
          header { padding: 12px 16px !important; }
        }
      `}</style>
    </div>
  );
}
