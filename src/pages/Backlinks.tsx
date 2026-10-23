import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import {
  BACKLINK_RELS,
  BACKLINK_STATUSES,
  createBacklink,
  deleteBacklink,
  listBacklinks,
  updateBacklink,
  type Backlink,
} from "../lib/api";

const cell =
  "rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";
const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

const STATUS_PILL: Record<string, string> = {
  live: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  lost: "bg-red-50 text-red-600 ring-red-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
};

function authorityColor(a: number | null) {
  if (a === null) return "text-gray-400";
  if (a >= 50) return "text-emerald-600";
  if (a >= 25) return "text-amber-600";
  return "text-gray-500";
}

export default function Backlinks() {
  const [rows, setRows] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(""); // "" = all

  // add form
  const [sourceUrl, setSourceUrl] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [anchor, setAnchor] = useState("");
  const [rel, setRel] = useState("dofollow");
  const [status, setStatus] = useState("live");
  const [authority, setAuthority] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listBacklinks(filter ? { status: filter } : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load backlinks.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!sourceUrl.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createBacklink({
        sourceUrl,
        targetPath,
        anchor,
        rel,
        status,
        authority: authority === "" ? null : Number(authority),
      });
      // respect the current filter
      if (!filter || created.status === filter) setRows((r) => [created, ...r]);
      setSourceUrl("");
      setTargetPath("");
      setAnchor("");
      setRel("dofollow");
      setStatus("live");
      setAuthority("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add the backlink.");
    } finally {
      setSaving(false);
    }
  }

  async function patch(row: Backlink, input: Partial<Backlink>) {
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, ...input } : x)));
    try {
      await updateBacklink(row.id, input as never);
      // a status change may move it out of the current filter
      if (input.status && filter && input.status !== filter) void load();
    } catch {
      void load();
    }
  }

  async function removeOne(row: Backlink) {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== row.id));
    try {
      await deleteBacklink(row.id);
    } catch {
      setRows(prev);
    }
  }

  const summary = useMemo(() => {
    const live = rows.filter((r) => r.status === "live");
    const dofollow = live.filter((r) => r.rel === "dofollow").length;
    const withDa = rows.filter((r) => r.authority !== null);
    const avgDa = withDa.length
      ? Math.round(withDa.reduce((s, r) => s + (r.authority ?? 0), 0) / withDa.length)
      : null;
    const domains = new Set(rows.map((r) => r.sourceDomain).filter(Boolean)).size;
    return { total: rows.length, live: live.length, dofollow, avgDa, domains };
  }, [rows]);

  return (
    <Layout title="Backlinks">
      <div className="p-8 space-y-5">
        {/* Summary + filter */}
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
              {summary.total} total
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
              {summary.live} live
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
              {summary.dofollow} dofollow (live)
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
              {summary.domains} domains
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
              {summary.avgDa !== null ? `avg DA ${summary.avgDa}` : "DA n/a"}
            </span>
          </div>

          <div className="mt-4 flex gap-2">
            {["", ...BACKLINK_STATUSES].map((s) => (
              <button
                key={s || "all"}
                type="button"
                onClick={() => setFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  filter === s ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Add form */}
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-500">Source URL</label>
              <input
                className={`mt-1 ${inputClass}`}
                placeholder="https://example.com/post-linking-to-us"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Target on our site (optional)
              </label>
              <input
                className={`mt-1 ${inputClass}`}
                placeholder="/whatsapp-business-api"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500">Anchor text</label>
              <input
                className={`mt-1 w-full ${cell} py-2`}
                placeholder="anchor"
                value={anchor}
                onChange={(e) => setAnchor(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Rel</label>
              <select
                className={`mt-1 w-full ${cell} py-2`}
                value={rel}
                onChange={(e) => setRel(e.target.value)}
              >
                {BACKLINK_RELS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Status</label>
              <select
                className={`mt-1 w-full ${cell} py-2`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {BACKLINK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">DA</label>
              <input
                type="number"
                min={0}
                max={100}
                className={`mt-1 w-full ${cell} py-2`}
                placeholder="0–100"
                value={authority}
                onChange={(e) => setAuthority(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => void add()}
              disabled={saving || !sourceUrl.trim()}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
            >
              {saving ? "Adding…" : "Add"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="p-10 text-center text-sm text-gray-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-400">
              No backlinks {filter ? `with status “${filter}”` : "yet"}. Add one above.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Source → Target</th>
                  <th className="px-4 py-3 font-semibold">Anchor</th>
                  <th className="px-4 py-3 font-semibold">Rel</th>
                  <th className="px-4 py-3 font-semibold">DA</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/70 align-top">
                    <td className="px-4 py-2.5">
                      <a
                        href={r.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-gray-900 hover:text-brand break-all"
                      >
                        {r.sourceDomain || r.sourceUrl}
                      </a>
                      {r.targetPath && (
                        <p className="text-xs text-gray-500 break-all">→ {r.targetPath}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 break-all">{r.anchor || "—"}</td>
                    <td className="px-4 py-2.5">
                      <select
                        className={cell}
                        value={r.rel}
                        onChange={(e) => void patch(r, { rel: e.target.value })}
                      >
                        {BACKLINK_RELS.map((rl) => (
                          <option key={rl} value={rl}>
                            {rl}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className={`w-16 ${cell}`}
                        defaultValue={r.authority ?? ""}
                        placeholder="—"
                        onBlur={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          if (v !== r.authority) void patch(r, { authority: v });
                        }}
                      />
                      <span className={`ml-2 text-xs font-semibold ${authorityColor(r.authority)}`}>
                        {r.authority ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        className={`${cell} ring-1 ring-inset ${
                          STATUS_PILL[r.status] ?? ""
                        }`}
                        value={r.status}
                        onChange={(e) => void patch(r, { status: e.target.value })}
                      >
                        {BACKLINK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => void removeOne(r)}
                        className="font-medium text-red-500 hover:text-red-600"
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
