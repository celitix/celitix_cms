import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import {
  getBacklinks,
  getCities,
  getKwintelGroups,
  runKwintelBatch,
  DFS_COUNTRIES,
  LABEL_BY_TYPE,
  type BacklinkRow,
  type KwintelGroup,
} from "../lib/api";
import { downloadCsv, stamp, toCsv } from "../lib/csv";

const BATCH_SIZE = 7;
const ctl =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}
function devPos(row: { posDesktop: number | null; posMobile: number | null; position: number | null }, device: string): string {
  const d = row.posDesktop, m = row.posMobile;
  if (device === "both") {
    const dd = d === null ? "—" : `#${d}`;
    const mm = m === null ? "—" : `#${m}`;
    return `D ${dd} · M ${mm}`;
  }
  return row.position === null ? "—" : `#${row.position}`;
}

function posBadge(p: number | null): string {
  if (p === null) return "bg-gray-100 text-gray-400";
  if (p <= 3) return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";
  if (p <= 10) return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";
  return "bg-red-50 text-red-600 ring-1 ring-inset ring-red-200";
}

function Ring({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const r = 26,
    c = 2 * Math.PI * r,
    off = c - (pct / 100) * c;
  return (
    <div className="flex items-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#eee" strokeWidth="7" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke="#f59e0b" strokeWidth="7"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="37" textAnchor="middle" className="fill-gray-900" fontSize="15" fontWeight="700">
          {pct}%
        </text>
      </svg>
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  );
}

/* Competitor backlinks popup */
function BacklinkModal({ target, onClose }: { target: string; onClose: () => void }) {
  const [rows, setRows] = useState<BacklinkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getBacklinks(target, 50)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load backlinks."));
  }, [target]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <p className="font-semibold text-gray-900">Backlinks — {target}</p>
            <p className="text-xs text-gray-400">{rows ? `${rows.length} referring domains (top by authority)` : "Loading…"}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="max-h-[65vh] overflow-auto">
          {error ? (
            <p className="p-6 text-center text-sm text-red-600">{error}</p>
          ) : !rows ? (
            <p className="p-6 text-center text-sm text-gray-500">Fetching from DataForSEO…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">No backlinks returned.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">From domain</th>
                  <th className="px-4 py-2 font-semibold">Anchor</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 font-semibold">DA</th>
                  <th className="px-4 py-2 font-semibold">First seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((b, i) => (
                  <tr key={i} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2">
                      <a href={b.urlFrom} target="_blank" rel="noreferrer" className="text-gray-800 hover:text-brand">
                        {b.domainFrom || hostOf(b.urlFrom)}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{b.anchor || "—"}</td>
                    <td className="px-4 py-2">
                      <span className={b.dofollow ? "text-emerald-600" : "text-gray-400"}>
                        {b.dofollow ? "dofollow" : "nofollow"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{b.rank}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">{b.firstSeen ? String(b.firstSeen).slice(0, 10) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KeywordIntel() {
  const [groups, setGroups] = useState<KwintelGroup[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // controls
  const [country, setCountry] = useState("in");
  const [device, setDevice] = useState("desktop");
  const [compCount, setCompCount] = useState(3);
  const [scope, setScope] = useState<"both" | "focus" | "secondary">("both");
  const [skipDays, setSkipDays] = useState(3);
  const [locations, setLocations] = useState<string[]>([]);
  const [stopTop, setStopTop] = useState(10);
  const [cityQuery, setCityQuery] = useState("");
  const [citySuggest, setCitySuggest] = useState<{ code: number; name: string }[]>([]);
  const [fMinVol, setFMinVol] = useState(0);
  const [fPosition, setFPosition] = useState<"all" | "top3" | "top10" | "unranked">("all");
  const [fType, setFType] = useState<string>("all");

  // batch progress
  const [progress, setProgress] = useState<{ running: boolean; done: number; total: number; label: string }>({
    running: false, done: 0, total: 0, label: "",
  });
  const stopRef = useRef(false);
  const [backlinkTarget, setBacklinkTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { groups, keywords } = await getKwintelGroups(scope);
      setGroups(groups);
      setKeywords(keywords);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load keyword intelligence.");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (cityQuery.trim().length < 3) {
      setCitySuggest([]);
      return;
    }
    const t = setTimeout(() => {
      getCities(cityQuery.trim(), country)
        .then(setCitySuggest)
        .catch(() => setCitySuggest([]));
    }, 250);
    return () => clearTimeout(t);
  }, [cityQuery, country]);

  async function runBatches(mode: "volume" | "serp") {
    if (!keywords.length) return;
    stopRef.current = false;
    setNotice(null);
    setError(null);
    const size = mode === "volume" ? 50 : BATCH_SIZE; // volume is one cheap call; serp is slow
    setProgress({ running: true, done: 0, total: keywords.length, label: mode === "volume" ? "Search volume" : "Positions + competitors" });
    let processed = 0, skipped = 0, errors = 0, lastErr = "";
    for (let i = 0; i < keywords.length; i += size) {
      if (stopRef.current) break;
      const chunk = keywords.slice(i, i + size);
      try {
        const r = await runKwintelBatch({
          mode, keywords: chunk, country, device,
          compCount, skipHours: skipDays * 24,
          locations: mode === "serp" ? locations : undefined,
          stopTop: mode === "serp" ? stopTop : undefined,
        });
        processed += r.processed; skipped += r.skipped; errors += r.errors;
        if (r.errorMessage) lastErr = r.errorMessage;
      } catch (e) {
        errors += chunk.length;
        lastErr = e instanceof Error ? e.message : "batch failed";
        if (/not configured/i.test(lastErr)) { setError(lastErr); break; }
      }
      setProgress((p) => ({ ...p, done: Math.min(keywords.length, i + size) }));
    }
    setProgress((p) => ({ ...p, running: false }));
    setNotice(`${progress.label || (mode === "volume" ? "Volume" : "Positions")}: ${processed} updated, ${skipped} skipped${errors ? `, ${errors} errors` : ""}.${lastErr && errors ? ` (${lastErr})` : ""}`);
    await load();
  }

  const stats = useMemo(() => {
    const all = groups.flatMap((g) => g.rows);
    const ranked = all.filter((r) => r.position !== null);
    const top10 = ranked.filter((r) => (r.position ?? 99) <= 10).length;
    const top5 = ranked.filter((r) => (r.position ?? 99) <= 5).length;
    return {
      total: all.length,
      ranked: ranked.length,
      top10, top5,
      top10Pct: ranked.length ? Math.round((top10 / ranked.length) * 100) : 0,
      top5Pct: ranked.length ? Math.round((top5 / ranked.length) * 100) : 0,
    };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const passRow = (r: (typeof groups)[number]["rows"][number]) => {
      if (fMinVol > 0 && (r.volume ?? 0) < fMinVol) return false;
      if (fPosition === "unranked" && r.position !== null) return false;
      if (fPosition === "top3" && (r.position === null || r.position > 3)) return false;
      if (fPosition === "top10" && (r.position === null || r.position > 10)) return false;
      return true;
    };
    return groups
      .filter((g) => fType === "all" || g.type === fType)
      .map((g) => ({ ...g, rows: g.rows.filter(passRow) }))
      .filter((g) => g.rows.length > 0);
  }, [groups, fMinVol, fPosition, fType]);

  const pctDone = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  // ---- exports ----
  function exportRows() {
    const out: Record<string, string | number>[] = [];
    for (const g of filteredGroups) {
      for (const r of g.rows) {
        const locs = Object.entries(r.locations || {})
          .map(([loc, v]) => {
            const dd = v?.desktop == null ? "—" : `#${v.desktop}`;
            const mm = v?.mobile == null ? "—" : `#${v.mobile}`;
            return `${loc.split(",")[0]} (D ${dd}/M ${mm})`;
          })
          .join("; ");
        out.push({
          Keyword: r.keyword,
          Role: r.role,
          Page: r.role === "primary" ? g.title : "",
          URL: r.role === "primary" ? g.url : "",
          Position: r.position ?? "",
          Desktop: r.posDesktop ?? "",
          Mobile: r.posMobile ?? "",
          Locations: locs,
          Volume: r.volume ?? "",
          "Top competitors": (r.competitors || []).map((c) => hostOf(c.url)).join(", "),
        });
      }
    }
    return out;
  }
  function doCsv() {
    const rows = exportRows();
    const cols = Object.keys(rows[0] || { Keyword: "" }).map((k) => ({ key: k, header: k }));
    downloadCsv(`celitix-keyword-intel-${stamp()}.csv`, toCsv(rows as never, cols as never));
  }
  function doExcel() {
    const rows = exportRows();
    const headers = Object.keys(rows[0] || { Keyword: "" });
    const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html =
      `<table border="1"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
      rows.map((r) => `<tr>${headers.map((h) => `<td>${esc((r as never)[h])}</td>`).join("")}</tr>`).join("") +
      `</tbody></table>`;
    const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `celitix-keyword-intel-${stamp()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function doPrint() {
    const rows = exportRows();
    const headers = Object.keys(rows[0] || { Keyword: "" });
    const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html =
      `<html><head><title>Keyword Intelligence — celitix.com</title>` +
      `<style>body{font-family:system-ui,sans-serif;padding:24px}h1{font-size:18px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f4f4f4}</style>` +
      `</head><body><h1>Keyword Intelligence — celitix.com</h1><p>${new Date().toLocaleString()}</p>` +
      `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
      rows.map((r) => `<tr>${headers.map((h) => `<td>${esc((r as never)[h])}</td>`).join("")}</tr>`).join("") +
      `</tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <Layout title="Keyword Intelligence">
      <div className="p-8 space-y-5">
        <p className="text-sm text-gray-500 -mt-2">
          Every page's primary (focus) keyword in bold, with its secondary keywords beneath. Position, search
          volume and top competitors come from DataForSEO.
        </p>

        {/* Controls */}
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">Country</label>
              <select className={`mt-1 ${ctl}`} value={country} onChange={(e) => setCountry(e.target.value)}>
                {DFS_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Device</label>
              <select className={`mt-1 ${ctl}`} value={device} onChange={(e) => setDevice(e.target.value)}>
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Competitors to fetch</label>
              <select className={`mt-1 ${ctl}`} value={compCount} onChange={(e) => setCompCount(Number(e.target.value))}>
                {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Track</label>
              <select className={`mt-1 ${ctl}`} value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
                <option value="both">Focus + secondary</option>
                <option value="focus">Focus only</option>
                <option value="secondary">Secondary only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Skip if checked within</label>
              <select className={`mt-1 ${ctl}`} value={skipDays} onChange={(e) => setSkipDays(Number(e.target.value))}>
                <option value={0}>Always re-check</option>
                <option value={1}>Last 1 day</option>
                <option value={3}>Last 3 days</option>
                <option value={7}>Last 7 days</option>
              </select>
            </div>
            <div className="relative">
              <label className="block text-xs font-medium text-gray-500">Locations (up to 5)</label>
              <input
                className={`mt-1 ${ctl} w-56`}
                placeholder="Type 3+ letters, pick to add…"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                disabled={locations.length >= 5}
              />
              {citySuggest.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {citySuggest.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        if (!locations.includes(c.name) && locations.length < 5)
                          setLocations((l) => [...l, c.name]);
                        setCityQuery("");
                        setCitySuggest([]);
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Stop once in</label>
              <select className={`mt-1 ${ctl}`} value={stopTop} onChange={(e) => setStopTop(Number(e.target.value))}>
                <option value={0}>Scan all</option>
                <option value={3}>Top 3</option>
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
              </select>
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => void runBatches("volume")}
              disabled={progress.running || keywords.length === 0}
              className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-50 disabled:opacity-50 transition"
            >
              💰 Refresh search volume
            </button>
            <button
              type="button"
              onClick={() => void runBatches("serp")}
              disabled={progress.running || keywords.length === 0}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
            >
              📊 Refresh positions + competitors
            </button>
          </div>

          {locations.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">Cities:</span>
              {locations.map((loc) => (
                <span key={loc} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand">
                  {loc}
                  <button type="button" onClick={() => setLocations((l) => l.filter((x) => x !== loc))} className="hover:text-brand-dark">✕</button>
                </span>
              ))}
            </div>
          )}

          {/* progress */}
          {progress.running && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{progress.label} — {progress.done}/{progress.total}</span>
                <button type="button" onClick={() => (stopRef.current = true)} className="font-medium text-red-500 hover:text-red-600">
                  Stop
                </button>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full bg-brand transition-all" style={{ width: `${pctDone}%` }} />
              </div>
            </div>
          )}
          {notice && <p className="mt-3 text-sm text-emerald-600">{notice}</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-8 rounded-2xl bg-white border border-gray-200 p-5">
          <Ring pct={stats.top10Pct} label="Ranking (Top 10)" sub={`${stats.top10} of ${stats.ranked} ranked keywords`} />
          <Ring pct={stats.top5Pct} label="In Top 5" sub={`${stats.top5} of ${stats.ranked} in top 5`} />
          <div className="flex items-center">
            <div>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-400">keywords across {groups.length} pages</p>
            </div>
          </div>
        </div>

        {/* Filters + exports */}
        <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white border border-gray-200 p-5">
          <div>
            <label className="block text-xs font-medium text-gray-500">Min volume</label>
            <input
              type="number"
              min={0}
              className={`mt-1 ${ctl} w-28`}
              value={fMinVol}
              onChange={(e) => setFMinVol(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Position</label>
            <select className={`mt-1 ${ctl}`} value={fPosition} onChange={(e) => setFPosition(e.target.value as typeof fPosition)}>
              <option value="all">All</option>
              <option value="top3">Top 3</option>
              <option value="top10">Top 10</option>
              <option value="unranked">Unranked</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Type</label>
            <select className={`mt-1 ${ctl}`} value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="all">All</option>
              <option value="PAGE">Page</option>
              <option value="POST">Blog</option>
              <option value="CASE_STUDY">Case study</option>
              <option value="GUIDE">Guide</option>
            </select>
          </div>
          <div className="flex-1" />
          <button type="button" onClick={doCsv} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            ↓ CSV
          </button>
          <button type="button" onClick={doExcel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            ↓ Excel
          </button>
          <button type="button" onClick={doPrint} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            🖨 Print / PDF
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-white border border-gray-200 overflow-x-auto">
          {loading ? (
            <p className="p-10 text-center text-sm text-gray-500">Loading…</p>
          ) : filteredGroups.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-400">
              {groups.length === 0
                ? "No pages have focus/secondary keywords yet. Add them in a page's SEO panel."
                : "No keywords match the current filters."}
            </p>
          ) : (
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Keyword</th>
                  <th className="px-4 py-3 font-semibold">Page URL</th>
                  <th className="px-4 py-3 font-semibold">Position</th>
                  <th className="px-4 py-3 font-semibold">Location rank</th>
                  <th className="px-4 py-3 font-semibold">Volume</th>
                  <th className="px-4 py-3 font-semibold">Top competitors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredGroups.map((g) => (
                  g.rows.map((r, idx) => (
                    <tr key={`${g.postId}-${r.keyword}-${idx}`} className="hover:bg-gray-50/70 align-top">
                      <td className="px-4 py-2.5">
                        {r.role === "primary" ? (
                          <span className="font-semibold text-gray-900">{r.keyword}</span>
                        ) : (
                          <span className="pl-5 text-gray-600">↳ {r.keyword}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.role === "primary" ? (
                          <a href={g.url} target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-brand">
                            <span className="mr-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                              {LABEL_BY_TYPE[g.type] ?? g.type}
                            </span>
                            /{g.type === "POST" ? "blog/" : ""}{g.slug}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {device === "both" ? (
                          <span className="text-xs text-gray-700">{devPos(r, device)}</span>
                        ) : (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${posBadge(r.position)}`}>
                            {r.position === null ? "—" : `#${r.position}`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.locations && Object.keys(r.locations).length > 0 ? (
                          <div className="space-y-0.5 text-xs">
                            {Object.entries(r.locations).map(([loc, v]) => (
                              <div key={loc} className="text-gray-600">
                                <span className="text-gray-400">{loc.split(",")[0]}:</span>{" "}
                                {typeof v === "number"
                                  ? (v === null ? "—" : `#${v}`)
                                  : `D ${v?.desktop == null ? "—" : "#" + v.desktop} · M ${v?.mobile == null ? "—" : "#" + v.mobile}`}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {r.volume === null ? "—" : r.volume.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.competitors.length === 0 ? (
                          <span className="text-xs text-gray-300">— refresh to load</span>
                        ) : (
                          <ol className="space-y-0.5 text-xs">
                            {r.competitors.map((c, i) => (
                              <li key={i} className={c.isYou ? "text-emerald-600 font-medium" : "text-gray-600"}>
                                {i + 1}.{" "}
                                <button
                                  type="button"
                                  onClick={() => setBacklinkTarget(hostOf(c.url))}
                                  className="hover:text-brand hover:underline"
                                  title="View this competitor's backlinks"
                                >
                                  {hostOf(c.url)} 🔗
                                </button>
                                {c.isYou ? " (you)" : ""}
                              </li>
                            ))}
                          </ol>
                        )}
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {backlinkTarget && <BacklinkModal target={backlinkTarget} onClose={() => setBacklinkTarget(null)} />}
    </Layout>
  );
}
