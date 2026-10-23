import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import {
  AI_ENGINES,
  AI_ENGINE_LABEL,
  AI_PRESENCE,
  createAiMention,
  checkAiMention,
  checkAllAiMentions,
  deleteAiMention,
  getAiVisibility,
  importAiMentionsFromSeo,
  listAiMentions,
  listContent,
  updateAiMention,
  LABEL_BY_TYPE,
  type AiMention,
  type ContentListItem,
  DFS_COUNTRIES,
  type AiVisibility,
} from "../lib/api";

const cell =
  "rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";
const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

const PRESENCE_PILL: Record<string, string> = {
  cited: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  mentioned: "bg-amber-50 text-amber-700 ring-amber-200",
  absent: "bg-gray-100 text-gray-500 ring-gray-200",
};

export default function AiOverview() {
  const [pages, setPages] = useState<ContentListItem[]>([]);
  const [contentId, setContentId] = useState("");
  const [engineFilter, setEngineFilter] = useState("");
  const [rows, setRows] = useState<AiMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [explorerKw, setExplorerKw] = useState("");
  const [explorerCc, setExplorerCc] = useState("in");
  const [explorerBusy, setExplorerBusy] = useState(false);
  const [explorer, setExplorer] = useState<AiVisibility | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // add form
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState("aio");
  const [presence, setPresence] = useState("absent");
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
      setRows(
        await listAiMentions({
          contentId: contentId || undefined,
          engine: engineFilter || undefined,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load AI mentions.");
    } finally {
      setLoading(false);
    }
  }, [contentId, engineFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const isAll = contentId === "";

  async function add() {
    if (!query.trim() || !contentId) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createAiMention({ contentId, query, engine, presence });
      if (!engineFilter || created.engine === engineFilter) setRows((r) => [created, ...r]);
      setQuery("");
      setEngine("aio");
      setPresence("absent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add the query.");
    } finally {
      setSaving(false);
    }
  }

  async function patch(row: AiMention, input: Partial<AiMention>) {
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, ...input } : x)));
    try {
      await updateAiMention(row.id, input as never);
      if (input.engine && engineFilter && input.engine !== engineFilter) void load();
    } catch {
      void load();
    }
  }

  async function removeOne(row: AiMention) {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== row.id));
    try {
      await deleteAiMention(row.id);
    } catch {
      setRows(prev);
    }
  }

  async function runImport() {
    if (!contentId) return;
    setImporting(true);
    setNotice(null);
    setError(null);
    try {
      const { created, mentions } = await importAiMentionsFromSeo(contentId);
      setRows(mentions);
      setNotice(
        created > 0
          ? `Imported ${created} AI ${created === 1 ? "query" : "queries"} from page SEO.`
          : "Nothing to import — either no AI queries in this page's SEO, or all are already tracked.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  async function checkRow(row: { id: string; engine: string }) {
    setBusyRow(row.id);
    setError(null);
    try {
      const { presence } = await checkAiMention(row.id);
      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, presence, checkedAt: new Date().toISOString() } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check failed.");
    } finally {
      setBusyRow(null);
    }
  }

  async function checkAll() {
    setCheckingAll(true);
    setError(null);
    try {
      const r = await checkAllAiMentions();
      setNotice(`Checked ${r.checked}${r.skipped ? `, skipped ${r.skipped} (unsupported engine)` : ""}${r.capped ? ` — hit the ${r.cap}/run cap.` : "."}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check all failed.");
    } finally {
      setCheckingAll(false);
    }
  }

  async function runExplorer() {
    if (!explorerKw.trim()) return;
    setExplorerBusy(true);
    setExplorer(null);
    setError(null);
    try {
      setExplorer(await getAiVisibility(explorerKw.trim(), explorerCc));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setExplorerBusy(false);
    }
  }

  const summary = useMemo(() => {
    const cited = rows.filter((r) => r.presence === "cited").length;
    const mentioned = rows.filter((r) => r.presence === "mentioned").length;
    const visible = cited + mentioned;
    const pct = rows.length ? Math.round((visible / rows.length) * 100) : 0;
    return { total: rows.length, cited, mentioned, pct };
  }, [rows]);

  return (
    <Layout title="AI-Overview Tracking">
      <div className="p-8 space-y-5">
        {/* AI Visibility explorer (keyword-driven, like the plugin) */}
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[16rem]">
              <label className="block text-xs font-medium text-gray-500">AI visibility for a keyword</label>
              <input
                className={`mt-1 w-full ${cell} py-2`}
                placeholder="e.g. whatsapp business api"
                value={explorerKw}
                onChange={(e) => setExplorerKw(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runExplorer()}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Country</label>
              <select className={`mt-1 ${cell} py-2`} value={explorerCc} onChange={(e) => setExplorerCc(e.target.value)}>
                {DFS_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void runExplorer()}
              disabled={explorerBusy || !explorerKw.trim()}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
            >
              {explorerBusy ? "Checking…" : "Check AI visibility"}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Are you cited in Google AI Overview / ChatGPT for this keyword, which competitor brands appear, and the fan-out sub-questions to target. (Uses DataForSEO LLM Mentions.)
          </p>

          {explorer && (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Platforms</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {explorer.platforms.map((pl) => (
                    <li key={pl.platform} className="flex items-center justify-between">
                      <span className="text-gray-700">{pl.label}</span>
                      <span className={pl.cited === true ? "text-emerald-600" : pl.cited === false ? "text-gray-400" : "text-gray-300"}>
                        {pl.cited === true ? "✅ cited" : pl.cited === false ? (pl.mentions > 0 ? `${pl.mentions} mentions` : "not cited") : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Competitor brands in AI answers</p>
                {explorer.competitors.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {explorer.competitors.map((c) => (
                      <span key={c} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{c}</span>
                    ))}
                  </div>
                ) : <p className="mt-1 text-xs text-gray-400">None found.</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Fan-out questions (longtail)</p>
                {explorer.longtail.length ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-600">
                    {explorer.longtail.slice(0, 8).map((q) => <li key={q}>{q}</li>)}
                  </ul>
                ) : <p className="mt-1 text-xs text-gray-400">None found.</p>}
              </div>
              {explorer.recommendations.length > 0 && (
                <div className="md:col-span-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  {explorer.recommendations.map((r, i) => <p key={i}>• {r}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selector + summary */}
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[18rem] flex-1">
              <label className="block text-sm font-medium text-gray-700">Page</label>
              <select
                className={`mt-1 w-full ${cell} py-2`}
                value={contentId}
                onChange={(e) => setContentId(e.target.value)}
              >
                <option value="">All pages — AI visibility overview</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{LABEL_BY_TYPE[p.type] ?? p.type}] {p.title || p.slug}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Engine</label>
              <select
                className={`mt-1 ${cell} py-2`}
                value={engineFilter}
                onChange={(e) => setEngineFilter(e.target.value)}
              >
                <option value="">All engines</option>
                {AI_ENGINES.map((en) => (
                  <option key={en} value={en}>
                    {AI_ENGINE_LABEL[en]}
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
                {importing ? "Importing…" : "Import AI queries from SEO"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void checkAll()}
              disabled={checkingAll || rows.length === 0}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
            >
              {checkingAll ? "Checking…" : "Check all (AIO + ChatGPT)"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
              {summary.total} tracked
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
              {summary.cited} cited
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
              {summary.mentioned} mentioned
            </span>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-brand">
              {summary.pct}% AI visibility
            </span>
          </div>

          {notice && <p className="mt-3 text-sm text-emerald-600">{notice}</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Add form */}
        {!isAll && (
          <div className="rounded-2xl bg-white border border-gray-200 p-5">
            <div className="grid gap-3 md:grid-cols-[3fr_1fr_1fr_auto] md:items-end">
              <div>
                <label className="block text-xs font-medium text-gray-500">AI query</label>
                <input
                  className={`mt-1 ${inputClass}`}
                  placeholder="e.g. best whatsapp business api provider in india"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void add()}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Engine</label>
                <select
                  className={`mt-1 w-full ${cell} py-2`}
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                >
                  {AI_ENGINES.map((en) => (
                    <option key={en} value={en}>
                      {AI_ENGINE_LABEL[en]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Presence</label>
                <select
                  className={`mt-1 w-full ${cell} py-2`}
                  value={presence}
                  onChange={(e) => setPresence(e.target.value)}
                >
                  {AI_PRESENCE.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void add()}
                disabled={saving || !query.trim()}
                className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
              >
                {saving ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="p-10 text-center text-sm text-gray-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-400">
              {isAll
                ? "No AI queries tracked yet. Pick a page and import from its SEO, or add manually."
                : "No AI queries for this page yet. Import from its SEO or add above."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Query</th>
                  {isAll && <th className="px-4 py-3 font-semibold">Page</th>}
                  <th className="px-4 py-3 font-semibold">Engine</th>
                  <th className="px-4 py-3 font-semibold">Presence</th>
                  <th className="px-4 py-3 font-semibold">Pos</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.query}</td>
                    {isAll && (
                      <td className="px-4 py-2.5 text-gray-500">
                        {r.content ? r.content.title || r.content.slug : "—"}
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <select
                        className={cell}
                        value={r.engine}
                        onChange={(e) => void patch(r, { engine: e.target.value })}
                      >
                        {AI_ENGINES.map((en) => (
                          <option key={en} value={en}>
                            {AI_ENGINE_LABEL[en]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        className={`${cell} ring-1 ring-inset ${PRESENCE_PILL[r.presence] ?? ""}`}
                        value={r.presence}
                        onChange={(e) => void patch(r, { presence: e.target.value })}
                      >
                        {AI_PRESENCE.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min={1}
                        className={`w-14 ${cell}`}
                        defaultValue={r.position ?? ""}
                        placeholder="—"
                        onBlur={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          if (v !== r.position) void patch(r, { position: v });
                        }}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void checkRow(r)}
                        disabled={busyRow === r.id}
                        className="font-medium text-brand hover:text-brand-dark disabled:opacity-50"
                        title="Check AI visibility via DataForSEO"
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
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
