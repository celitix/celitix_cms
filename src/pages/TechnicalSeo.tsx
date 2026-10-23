import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import {
  getContent,
  getLlmsTxt,
  getRobotsTxt,
  getSitemapData,
  listContent,
  LABEL_BY_TYPE,
  type ContentDetail,
  type ContentListItem,
  type SitemapUrl,
} from "../lib/api";

type Tab = "sitemap" | "robots" | "schema";

/* The crawlers the build standards require robots.txt to allow. */
const REQUIRED_AGENTS = [
  "Googlebot",
  "Bingbot",
  "YandexBot",
  "Google-Extended",
  "GPTBot",
  "OAI-SearchBot",
  "PerplexityBot",
  "ClaudeBot",
];

/* Schema @types the standards expect, by content type. */
const RECOMMENDED_SCHEMA: Record<string, string[]> = {
  PAGE: ["Organization", "WebSite", "BreadcrumbList"],
  POST: ["Article", "BreadcrumbList"],
  CASE_STUDY: ["Article", "BreadcrumbList"],
  GUIDE: ["Article", "BreadcrumbList"],
};

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          },
          () => {},
        );
      }}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

/* Pull every @type string out of a JSON-LD value (object, array, or @graph). */
function collectTypes(node: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((n) => collectTypes(n, out));
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") out.add(t);
    else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.add(x));
    if (Array.isArray(obj["@graph"])) collectTypes(obj["@graph"], out);
  }
  return out;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

/* ----------------------------- Sitemap ----------------------------- */

function SitemapTab() {
  const [urls, setUrls] = useState<SitemapUrl[]>([]);
  const [all, setAll] = useState<ContentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([getSitemapData(), listContent({ limit: 100 })])
      .then(([u, list]) => {
        if (!alive) return;
        setUrls(u);
        setAll(list.items ?? []);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const excluded = useMemo(
    () => all.filter((i) => i.status !== "PUBLISHED"),
    [all],
  );

  // Prime-Directive check: no excluded slug may appear in the live sitemap.
  const leaked = useMemo(() => {
    const inSitemap = new Set(urls.map((u) => u.loc));
    return excluded.filter((i) => [...inSitemap].some((loc) => loc.endsWith(`/${i.slug}`)));
  }, [urls, excluded]);

  const xml = useMemo(() => {
    const rows = urls
      .map(
        (u) =>
          `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${new Date(
            u.lastmod,
          ).toISOString().slice(0, 10)}</lastmod>\n  </url>`,
      )
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>`;
  }, [urls]);

  if (loading) return <p className="p-8 text-sm text-gray-500">Loading sitemap…</p>;
  if (error) return <p className="p-8 text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-inset ring-emerald-200">
          {urls.length} URLs in sitemap
        </span>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 ring-1 ring-inset ring-gray-200">
          {excluded.length} excluded (draft / hidden)
        </span>
      </div>

      {leaked.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>{leaked.length} unpublished item(s) are leaking into the sitemap.</strong>{" "}
          Drafts and hidden pages must never be listed. Check the connector's sitemap
          query.
        </div>
      )}

      <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <p className="text-sm font-semibold text-gray-700">Included URLs</p>
          <CopyButton text={xml} label="Copy sitemap.xml" />
        </div>
        {urls.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">
            Nothing published yet — the sitemap is empty.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {urls.map((u) => (
                <tr key={u.loc}>
                  <td className="px-4 py-2.5 text-gray-700 break-all">{u.loc}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-400 whitespace-nowrap">
                    {new Date(u.lastmod).toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {excluded.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          <p className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700">
            Correctly excluded
          </p>
          <ul className="divide-y divide-gray-100">
            {excluded.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-gray-600">
                  {i.title || i.slug}{" "}
                  <span className="text-gray-400">· /{i.slug}</span>
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                  {i.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Robots ----------------------------- */

function RobotsTab() {
  const [robots, setRobots] = useState("");
  const [llms, setLlms] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getRobotsTxt(), getLlmsTxt()])
      .then(([r, l]) => {
        if (!alive) return;
        setRobots(r);
        setLlms(l);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // An agent is allowed if it's named with Allow, or covered by a wildcard Allow.
  const wildcardAllows = /User-agent:\s*\*[\s\S]*?Allow:\s*\//i.test(robots);
  const agentStatus = REQUIRED_AGENTS.map((agent) => {
    const named = new RegExp(`User-agent:\\s*${agent}[\\s\\S]*?Allow:\\s*/`, "i").test(robots);
    return { agent, allowed: named || wildcardAllows, explicit: named };
  });

  if (loading) return <p className="p-8 text-sm text-gray-500">Loading robots…</p>;
  if (error) return <p className="p-8 text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-700">Crawler allow-list</p>
        <p className="mt-1 text-xs text-gray-400">
          Search + AI engines that must be allowed for indexing and citation.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {agentStatus.map((s) => (
            <div
              key={s.agent}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  s.allowed ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <span className="truncate text-xs text-gray-600" title={s.agent}>
                {s.agent}
              </span>
            </div>
          ))}
        </div>
      </div>

      {[
        { title: "robots.txt", body: robots },
        { title: "llms.txt", body: llms },
      ].map((f) => (
        <div key={f.title} className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-gray-700">{f.title}</p>
            <CopyButton text={f.body} />
          </div>
          <pre className="max-h-80 overflow-auto px-4 py-3 text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">
            {f.body}
          </pre>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Schema ----------------------------- */

function SchemaTab() {
  const [items, setItems] = useState<ContentListItem[]>([]);
  const [slug, setSlug] = useState("");
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listContent({ limit: 100 })
      .then((r) => setItems(r.items ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback((s: string) => {
    setSlug(s);
    setDetail(null);
    setError(null);
    if (!s) return;
    setLoading(true);
    getContent(s)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, []);

  const jsonLd = detail?.seo?.jsonLd ?? null;
  const pretty = jsonLd ? JSON.stringify(jsonLd, null, 2) : "";
  const present = useMemo(() => collectTypes(jsonLd), [jsonLd]);
  const recommended = detail ? RECOMMENDED_SCHEMA[detail.type] ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-gray-200 p-5">
        <label className="block text-sm font-medium text-gray-700">
          Inspect a page's JSON-LD
        </label>
        <select
          className="mt-2 w-full max-w-lg rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
          value={slug}
          onChange={(e) => load(e.target.value)}
        >
          <option value="">Select a page…</option>
          {items.map((i) => (
            <option key={i.id} value={i.slug}>
              [{LABEL_BY_TYPE[i.type] ?? i.type}] {i.title || i.slug}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading schema…</p>}

      {detail && !loading && (
        <>
          {recommended.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-700">
                Schema types for a {LABEL_BY_TYPE[detail.type]}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {recommended.map((t) => (
                  <span
                    key={t}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                      present.has(t)
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-red-50 text-red-600 ring-red-200"
                    }`}
                  >
                    {present.has(t) ? "✓" : "✗"} {t}
                  </span>
                ))}
                {[...present]
                  .filter((t) => !recommended.includes(t))
                  .map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-200"
                    >
                      + {t}
                    </span>
                  ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-gray-700">JSON-LD</p>
              {pretty && <CopyButton text={pretty} />}
            </div>
            {pretty ? (
              <pre className="max-h-[28rem] overflow-auto px-4 py-3 text-xs leading-relaxed text-gray-700">
                {pretty}
              </pre>
            ) : (
              <p className="p-8 text-center text-sm text-gray-400">
                No JSON-LD stored yet. It's generated when the item is saved —
                open it in the editor and save to populate this.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------ Screen ----------------------------- */

export default function TechnicalSeo() {
  const [tab, setTab] = useState<Tab>("sitemap");

  return (
    <Layout title="Technical SEO">
      <div className="p-8 space-y-5">
        <div className="flex gap-2 rounded-xl bg-gray-100 p-1 w-fit">
          <TabButton active={tab === "sitemap"} onClick={() => setTab("sitemap")}>
            Sitemap
          </TabButton>
          <TabButton active={tab === "robots"} onClick={() => setTab("robots")}>
            Robots &amp; AI
          </TabButton>
          <TabButton active={tab === "schema"} onClick={() => setTab("schema")}>
            Schema
          </TabButton>
        </div>

        {tab === "sitemap" && <SitemapTab />}
        {tab === "robots" && <RobotsTab />}
        {tab === "schema" && <SchemaTab />}
      </div>
    </Layout>
  );
}
