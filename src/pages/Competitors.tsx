import { useState } from "react";
import Layout from "../components/Layout";
import {
  getCompetitorBacklinks,
  getDomainOverview,
  DFS_COUNTRIES,
  type DomainOverview,
  type ReplicableBacklink,
} from "../lib/api";
import { downloadCsv, stamp, toCsv } from "../lib/csv";

const input =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/* ------------------------------ Domain Overview ------------------------------ */
function OverviewTab() {
  const [domain, setDomain] = useState("celitix.com");
  const [country, setCountry] = useState("in");
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DomainOverview | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setData(await getDomainOverview(domain, country, count));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[16rem]">
            <label className="block text-xs font-medium text-gray-500">Domain</label>
            <input className={`mt-1 ${input}`} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="celitix.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Country</label>
            <select className={`mt-1 ${input}`} value={country} onChange={(e) => setCountry(e.target.value)}>
              {DFS_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Competitors</label>
            <select className={`mt-1 ${input}`} value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading || !domain.trim()}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? "Looking up…" : "Run overview"}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Aggregate lookup (~$0.03–0.05) — organic footprint, top competitors and backlink summary.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Top-10 keywords" value={data.top10.toLocaleString()} hint={`#1: ${data.pos1} · 2-3: ${data.pos2_3} · 4-10: ${data.pos4_10}`} />
            <Stat label="Total keywords" value={data.totalKw.toLocaleString()} />
            <Stat label="Est. traffic (ETV)" value={Math.round(data.etv).toLocaleString()} hint="monthly organic" />
            <Stat label="Backlinks" value={data.backlinks.toLocaleString()} hint={`${data.refDomains.toLocaleString()} ref domains · rank ${data.blRank}`} />
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-3">
              <p className="font-semibold text-gray-900">Top competitors</p>
              <p className="text-xs text-gray-400">Domains competing for the same keywords, most overlap first.</p>
            </div>
            {data.competitors.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">No competitor data returned.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">Competitor</th>
                    <th className="px-5 py-2.5 font-semibold">Common keywords</th>
                    <th className="px-5 py-2.5 font-semibold">Their top-10</th>
                    <th className="px-5 py-2.5 font-semibold">Their total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.competitors.map((c) => (
                    <tr key={c.domain} className="hover:bg-gray-50/70">
                      <td className="px-5 py-2.5 font-medium text-gray-900">{c.domain}</td>
                      <td className="px-5 py-2.5 text-gray-600">{c.common.toLocaleString()}</td>
                      <td className="px-5 py-2.5 text-gray-600">{c.top10.toLocaleString()}</td>
                      <td className="px-5 py-2.5 text-gray-600">{c.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {data.notes.length > 0 && (
            <p className="text-xs text-amber-600">{data.notes.join(" · ")}</p>
          )}
        </>
      )}
    </div>
  );
}

/* --------------------------- Competitor Backlinks --------------------------- */
function BacklinksTab() {
  const [client, setClient] = useState("celitix.com");
  const [comps, setComps] = useState("");
  const [limit, setLimit] = useState(300);
  const [minShared, setMinShared] = useState(2);
  const [country, setCountry] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReplicableBacklink[] | null>(null);
  const [scanned, setScanned] = useState(0);

  async function run() {
    const competitors = comps
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (competitors.length < 2) {
      setError("Enter at least 2 competitors.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await getCompetitorBacklinks({ client, competitors, limit, minShared, country, showAll });
      setRows(r.rows);
      setScanned(r.scanned);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!rows?.length) return;
    const csv = toCsv(rows as unknown as Record<string, unknown>[], [
      { key: "platform", header: "Platform" },
      { key: "category", header: "Category" },
      { key: "method", header: "How to get the link" },
      { key: "country", header: "Market" },
      { key: "competitors", header: "Shared by (competitors)" },
      { key: "da", header: "DA (DataForSEO rank)" },
    ]);
    downloadCsv(`celitix-competitor-backlinks-${stamp()}.csv`, csv);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500">Client website</label>
          <input className={`mt-1 ${input}`} value={client} onChange={(e) => setClient(e.target.value)} placeholder="celitix.com" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Competitors (2–10, one per line or comma-separated)</label>
          <textarea
            className={`mt-1 ${input} h-24`}
            value={comps}
            onChange={(e) => setComps(e.target.value)}
            placeholder={"competitor1.com\ncompetitor2.com\ncompetitor3.com"}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-500">Depth</label>
            <select className={`mt-1 ${input}`} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value={300}>Best 300 (~$0.03)</option>
              <option value={500}>Best 500 (~$0.035)</option>
              <option value={1000}>Best 1000 (~$0.05)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Shared by at least</label>
            <select className={`mt-1 ${input}`} value={minShared} onChange={(e) => setMinShared(Number(e.target.value))}>
              <option value={2}>2 competitors</option>
              <option value={3}>3 competitors</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Market (platform filter)</label>
            <select className={`mt-1 ${input}`} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="all">All countries</option>
              {DFS_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Include unknown shared domains too (for you to vet — surfaces niche directories)
        </label>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? "Scanning…" : "Find replicable backlinks"}
          </button>
          <span className="text-xs text-gray-400">
            One DataForSEO call · excludes links the client already has · DA = DataForSEO rank (0–1000)
          </span>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {rows && (
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <p className="text-sm text-gray-500">
              {rows.length} platform{rows.length === 1 ? "" : "s"} · scanned {scanned} referring domains
            </p>
            <button
              type="button"
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Export CSV
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">
              No free-registration platforms matched. Try depth 1000, "shared by 2", or All countries.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Platform</th>
                  <th className="px-5 py-2.5 font-semibold">Category</th>
                  <th className="px-5 py-2.5 font-semibold">How to get the link</th>
                  <th className="px-5 py-2.5 font-semibold">Shared by</th>
                  <th className="px-5 py-2.5 font-semibold">DA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.platform} className="hover:bg-gray-50/70">
                    <td className="px-5 py-2.5 font-medium text-gray-900">
                      <a href={`https://${r.platform}`} target="_blank" rel="noreferrer" className="hover:text-brand">
                        {r.platform}
                      </a>
                    </td>
                    <td className="px-5 py-2.5 text-gray-600">{r.category}</td>
                    <td className="px-5 py-2.5 text-gray-500">{r.method || "—"}</td>
                    <td className="px-5 py-2.5 text-gray-600">{r.competitors}</td>
                    <td className="px-5 py-2.5 text-gray-600">{r.da}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function Competitors() {
  const [tab, setTab] = useState<"overview" | "backlinks">("overview");

  return (
    <Layout title="Competitor Intelligence">
      <div className="p-8">
        <div className="mb-5 inline-flex rounded-lg border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setTab("overview")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === "overview" ? "bg-brand text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Domain Overview
          </button>
          <button
            type="button"
            onClick={() => setTab("backlinks")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === "backlinks" ? "bg-brand text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Competitor Backlinks
          </button>
        </div>

        {tab === "overview" ? <OverviewTab /> : <BacklinksTab />}
      </div>
    </Layout>
  );
}
