import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import {
  checkAllRanks,
  checkKeywordRank,
  createKeyword,
  deleteKeyword,
  getKeywordHistory,
  importKeywordsFromSeo,
  listContent,
  listKeywords,
  refreshKeywordVolume,
  updateKeyword,
  DFS_COUNTRIES,
  ENGINE_LABEL,
  KEYWORD_ENGINES,
  LABEL_BY_TYPE,
  type ContentListItem,
  type KeywordRole,
  type KeywordTarget,
  type RankHistoryPoint,
} from "../lib/api";

const ROLES: KeywordRole[] = ["PRIMARY", "SECONDARY"];
const cell =
  "rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

function rankBadge(rank: number | null) {
  if (rank === null) return "bg-gray-100 text-gray-400";
  if (rank <= 3) return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";
  if (rank <= 10) return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";
  return "bg-red-50 text-red-600 ring-1 ring-inset ring-red-200";
}

function ago(iso: string | null) {
  if (!iso) return "never";
  const d = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Tiny inline sparkline of position history (lower = better, so invert Y). */
function Sparkline({ points }: { points: RankHistoryPoint[] }) {
  const vals = points.map((p) => p.position).filter((v): v is number => v !== null);
  if (vals.length < 2) return <span className="text-xs text-gray-400">not enough history</span>;
  const w = 120,
    h = 28,
    pad = 2;
  const max = Math.max(...vals),
    min = Math.min(...vals);
  const range = max - min || 1;
  const step = (w - pad * 2) / (vals.length - 1);
  // invert: rank 1 at top
  const d = vals
    .map((v, i) => {
      const x = pad + i * step;
      const y = pad + ((v - min) / range) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = vals[vals.length - 1];
  const first = vals[0];
  const better = last < first;
  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h} className="overflow-visible">
        <path d={d} fill="none" stroke={better ? "#059669" : "#dc2626"} strokeWidth="1.5" />
      </svg>
      <span className={`text-xs ${better ? "text-emerald-600" : "text-red-600"}`}>
        {better ? "▲" : "▼"} {Math.abs(last - first)}
      </span>
    </div>
  );
}

export default function Keywords() {
  const [pages, setPages] = useState<ContentListItem[]>([]);
  const [contentId, setContentId] = useState("");
  const [rows, setRows] = useState<KeywordTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [refreshingVol, setRefreshingVol] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [historyMap, setHistoryMap] = useState<Record<string, RankHistoryPoint[]>>({});

  // add form
  const [kw, setKw] = useState("");
  const [role, setRole] = useState<KeywordRole>("SECONDARY");
  const [engine, setEngine] = useState("google");
  const [country, setCountry] = useState("in");
  const [device, setDevice] = useState("desktop");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listContent({ limit: 100 })
      .then((r) => setPages(r.items ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listKeywords(contentId || undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load keywords.");
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isAll = contentId === "";

  async function add() {
    if (!kw.trim() || !contentId) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createKeyword({ contentId, keyword: kw, role, engine, country, device });
      setRows((r) => [created, ...r]);
      setKw("");
      setRole("SECONDARY");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add the keyword.");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, input: Partial<KeywordTarget>) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...input } : x)));
    try {
      await updateKeyword(id, input as never);
    } catch {
      void load();
    }
  }

  async function removeOne(row: KeywordTarget) {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== row.id));
    try {
      await deleteKeyword(row.id);
    } catch {
      setRows(prev);
    }
  }

  async function checkRow(row: KeywordTarget) {
    setBusyRow(row.id);
    setError(null);
    try {
      const { position, competitors } = await checkKeywordRank(row.id);
      setRows((r) =>
        r.map((x) =>
          x.id === row.id
            ? { ...x, currentRank: position, competitors, lastCheckedAt: new Date().toISOString() }
            : x,
        ),
      );
      // refresh history if open
      if (expanded === row.id) setHistoryMap((m) => ({ ...m, [row.id]: [] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed.");
    } finally {
      setBusyRow(null);
    }
  }

  async function checkAll() {
    setCheckingAll(true);
    setNotice(null);
    setError(null);
    try {
      const r = await checkAllRanks();
      setNotice(
        `Checked ${r.checked} (${r.updated} ranked), skipped ${r.skipped} already done today` +
          (r.capped ? ` — hit the ${r.cap}/run cap, ${r.remaining} left for next run.` : "."),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check all failed.");
    } finally {
      setCheckingAll(false);
    }
  }

  async function refreshVol() {
    setRefreshingVol(true);
    setNotice(null);
    setError(null);
    try {
      const n = await refreshKeywordVolume();
      setNotice(`Search volume refreshed for ${n} keyword${n === 1 ? "" : "s"}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Volume refresh failed.");
    } finally {
      setRefreshingVol(false);
    }
  }

  async function toggleHistory(row: KeywordTarget) {
    if (expanded === row.id) {
      setExpanded(null);
      return;
    }
    setExpanded(row.id);
    if (!historyMap[row.id]?.length) {
      try {
        const h = await getKeywordHistory(row.id);
        setHistoryMap((m) => ({ ...m, [row.id]: h }));
      } catch {
        /* ignore */
      }
    }
  }

  async function runImport() {
    if (!contentId) return;
    setImporting(true);
    setNotice(null);
    setError(null);
    try {
      const { created, keywords } = await importKeywordsFromSeo(contentId);
      setRows(keywords);
      setNotice(
        created > 0
          ? `Imported ${created} keyword${created === 1 ? "" : "s"} from page SEO.`
          : "Nothing new to import — already tracked.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  const summary = useMemo(() => {
    const ranked = rows.filter((r) => r.currentRank !== null);
    const top10 = ranked.filter((r) => (r.currentRank ?? 99) <= 10).length;
    const avg = ranked.length
      ? Math.round(ranked.reduce((s, r) => s + (r.currentRank ?? 0), 0) / ranked.length)
      : null;
    return { total: rows.length, ranked: ranked.length, top10, avg };
  }, [rows]);

  return (
    <Layout title="Keywords & Rankings">
      <div className="p-8 space-y-5">
        {/* Selector + actions + summary */}
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <label className="block text-sm font-medium text-gray-700">Page</label>
              <select
                className={`mt-1 w-full ${cell} py-2`}
                value={contentId}
                onChange={(e) => setContentId(e.target.value)}
              >
                <option value="">All pages — rankings overview</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{LABEL_BY_TYPE[p.type] ?? p.type}] {p.title || p.slug}
                  </option>
                ))}
              </select>
            </div>
            {!isAll && (
              <button
                type="button"
                onClick={() => void runImport()}
                disabled={importing}
                className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-50 disabled:opacity-50 transition"
              >
                {importing ? "Importing…" : "Import from SEO"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void checkAll()}
              disabled={checkingAll || rows.length === 0}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
            >
              {checkingAll ? "Checking…" : "Check all ranks"}
            </button>
            <button
              type="button"
              onClick={() => void refreshVol()}
              disabled={refreshingVol || rows.length === 0}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              {refreshingVol ? "Refreshing…" : "Refresh volume"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
              {summary.total} keyword{summary.total === 1 ? "" : "s"}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
              {summary.top10} in top 10
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
              {summary.ranked} ranked{summary.avg !== null ? ` · avg #${summary.avg}` : ""}
            </span>
            <span className="text-xs text-gray-400 self-center">
              Each rank check is one paid SERP call · capped at 50/run · skips ones already done today
            </span>
          </div>

          {notice && <p className="mt-3 text-sm text-emerald-600">{notice}</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Add form */}
        {!isAll && (
          <div className="rounded-2xl bg-white border border-gray-200 p-5">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:items-end">
              <div>
                <label className="block text-xs font-medium text-gray-500">Keyword</label>
                <input
                  className={`mt-1 w-full ${cell} py-2`}
                  placeholder="e.g. whatsapp business api"
                  value={kw}
                  onChange={(e) => setKw(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void add()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Role</label>
                <select className={`mt-1 w-full ${cell} py-2`} value={role} onChange={(e) => setRole(e.target.value as KeywordRole)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r === "PRIMARY" ? "Primary" : "Secondary"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Engine</label>
                <select className={`mt-1 w-full ${cell} py-2`} value={engine} onChange={(e) => setEngine(e.target.value)}>
                  {KEYWORD_ENGINES.map((en) => (
                    <option key={en} value={en}>
                      {ENGINE_LABEL[en]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Country</label>
                <select className={`mt-1 w-full ${cell} py-2`} value={country} onChange={(e) => setCountry(e.target.value)}>
                  {DFS_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Device</label>
                <select className={`mt-1 w-full ${cell} py-2`} value={device} onChange={(e) => setDevice(e.target.value)}>
                  <option value="desktop">Desktop</option>
                  <option value="mobile">Mobile</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => void add()}
                disabled={saving || !kw.trim()}
                className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
              >
                {saving ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl bg-white border border-gray-200 overflow-x-auto">
          {loading ? (
            <p className="p-10 text-center text-sm text-gray-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-400">
              {isAll
                ? "No keywords tracked yet. Pick a page and add some, or import from its SEO."
                : "No keywords for this page yet."}
            </p>
          ) : (
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Keyword</th>
                  {isAll && <th className="px-4 py-3 font-semibold">Page</th>}
                  <th className="px-4 py-3 font-semibold">Engine</th>
                  <th className="px-4 py-3 font-semibold">Geo</th>
                  <th className="px-4 py-3 font-semibold">Vol</th>
                  <th className="px-4 py-3 font-semibold">Position</th>
                  <th className="px-4 py-3 font-semibold">Checked</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-gray-50/70">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{r.keyword}</td>
                      {isAll && (
                        <td className="px-4 py-2.5 text-gray-500">
                          {r.content ? r.content.title || r.content.slug : "—"}
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <select className={cell} value={r.engine} onChange={(e) => void patch(r.id, { engine: e.target.value })}>
                          {KEYWORD_ENGINES.map((en) => (
                            <option key={en} value={en}>
                              {ENGINE_LABEL[en]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <select className={`${cell} w-20`} value={r.country} onChange={(e) => void patch(r.id, { country: e.target.value })}>
                            {DFS_COUNTRIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code.toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <select className={`${cell} w-16`} value={r.device} onChange={(e) => void patch(r.id, { device: e.target.value })}>
                            <option value="desktop">🖥</option>
                            <option value="mobile">📱</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {r.searchVolume === null ? "—" : r.searchVolume.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => void toggleHistory(r)}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${rankBadge(r.currentRank)}`}
                          title="Show history"
                        >
                          {r.currentRank === null ? "—" : `#${r.currentRank}`}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{ago(r.lastCheckedAt)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void checkRow(r)}
                          disabled={busyRow === r.id}
                          className="font-medium text-brand hover:text-brand-dark disabled:opacity-50"
                        >
                          {busyRow === r.id ? "…" : "Check"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeOne(r)}
                          className="ml-3 font-medium text-red-500 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={isAll ? 8 : 7} className="px-4 py-3">
                          <div className="flex flex-wrap items-start gap-x-10 gap-y-3">
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-medium text-gray-500">History</span>
                              <Sparkline points={historyMap[r.id] ?? []} />
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-500">Top competitors (this keyword)</span>
                              {r.competitors && r.competitors.length > 0 ? (
                                <ol className="mt-1 space-y-0.5 text-xs">
                                  {r.competitors.map((c, i) => (
                                    <li key={i} className={c.isYou ? "text-emerald-600 font-medium" : "text-gray-600"}>
                                      {i + 1}.{" "}
                                      <a href={c.url} target="_blank" rel="noreferrer" className="hover:text-brand">
                                        {(() => { try { return new URL(c.url).hostname.replace(/^www\./, ""); } catch { return c.url; } })()}
                                      </a>
                                      {c.isYou ? " (you)" : ""}
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <p className="mt-1 text-xs text-gray-400">Run a Check to load competitors.</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
