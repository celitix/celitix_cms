import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import {
  getStats,
  listAiMentions,
  listBacklinks,
  listContent,
  listKeywords,
  AI_ENGINE_LABEL,
  ENGINE_LABEL,
  LABEL_BY_TYPE,
  type AiMention,
  type Backlink,
  type ContentListItem,
  type DashboardStats,
  type KeywordTarget,
} from "../lib/api";
import { downloadCsv, stamp, toCsv, type CsvColumn } from "../lib/csv";

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function ReportCard<T extends Record<string, unknown>>({
  title,
  subtitle,
  rows,
  columns,
  filename,
  preview,
  href,
}: {
  title: string;
  subtitle: string;
  rows: T[];
  columns: CsvColumn<T>[];
  filename: string;
  preview: (row: T) => React.ReactNode;
  href?: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div>
          <p className="font-semibold text-gray-900">
            {href ? (
              <Link to={href} className="hover:text-brand">
                {title} <span className="text-xs text-gray-400">View →</span>
              </Link>
            ) : (
              title
            )}
          </p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() => downloadCsv(`${filename}-${stamp()}.csv`, toCsv(rows, columns))}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 transition"
        >
          Export CSV
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-gray-400">No data yet.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.slice(0, 5).map((r, i) => (
            <div key={i} className="px-5 py-2.5 text-sm">
              {preview(r)}
            </div>
          ))}
          {rows.length > 5 && (
            <p className="px-5 py-2 text-xs text-gray-400">
              …and {rows.length - 5} more in the export.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [content, setContent] = useState<ContentListItem[]>([]);
  const [keywords, setKeywords] = useState<KeywordTarget[]>([]);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [mentions, setMentions] = useState<AiMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.allSettled([
      getStats(),
      listContent({ limit: 100 }),
      listKeywords(),
      listBacklinks(),
      listAiMentions(),
    ])
      .then(([s, c, k, b, m]) => {
        if (!alive) return;
        if (s.status === "fulfilled") setStats(s.value);
        if (c.status === "fulfilled") setContent(c.value.items ?? []);
        if (k.status === "fulfilled") setKeywords(k.value);
        if (b.status === "fulfilled") setBacklinks(b.value);
        if (m.status === "fulfilled") setMentions(m.value);
        if ([s, c, k, b, m].every((r) => r.status === "rejected"))
          setError("Couldn't reach the server.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // ---- CSV column definitions ----
  const contentCols: CsvColumn<ContentListItem>[] = useMemo(
    () => [
      { key: "title", header: "Title" },
      { key: "type", header: "Type", get: (r) => LABEL_BY_TYPE[r.type] ?? r.type },
      { key: "status", header: "Status" },
      { key: "slug", header: "Slug" },
      { key: "score", header: "Score", get: (r) => r.score?.score ?? "" },
      { key: "updatedAt", header: "Updated", get: (r) => String(r.updatedAt).slice(0, 10) },
    ],
    [],
  );
  const keywordCols: CsvColumn<KeywordTarget>[] = useMemo(
    () => [
      { key: "keyword", header: "Keyword" },
      { key: "page", header: "Page", get: (r) => r.content?.title ?? r.content?.slug ?? "" },
      { key: "role", header: "Role" },
      { key: "engine", header: "Engine", get: (r) => ENGINE_LABEL[r.engine] ?? r.engine },
      { key: "currentRank", header: "Rank", get: (r) => r.currentRank ?? "" },
      { key: "volumeBand", header: "Volume", get: (r) => r.volumeBand ?? "" },
    ],
    [],
  );
  const backlinkCols: CsvColumn<Backlink>[] = useMemo(
    () => [
      { key: "sourceDomain", header: "Source domain" },
      { key: "sourceUrl", header: "Source URL" },
      { key: "targetPath", header: "Target" },
      { key: "anchor", header: "Anchor" },
      { key: "rel", header: "Rel" },
      { key: "status", header: "Status" },
      { key: "authority", header: "DA", get: (r) => r.authority ?? "" },
    ],
    [],
  );
  const mentionCols: CsvColumn<AiMention>[] = useMemo(
    () => [
      { key: "query", header: "Query" },
      { key: "page", header: "Page", get: (r) => r.content?.title ?? r.content?.slug ?? "" },
      { key: "engine", header: "Engine", get: (r) => AI_ENGINE_LABEL[r.engine] ?? r.engine },
      { key: "presence", header: "Presence" },
      { key: "position", header: "Position", get: (r) => r.position ?? "" },
    ],
    [],
  );

  const kwTop10 = keywords.filter((k) => (k.currentRank ?? 99) <= 10).length;
  const blLive = backlinks.filter((b) => b.status === "live").length;
  const aiVisible = mentions.filter((m) => m.presence !== "absent").length;
  const aiPct = mentions.length ? Math.round((aiVisible / mentions.length) * 100) : 0;

  return (
    <Layout title="Reports & Exports">
      <div className="p-8 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Compiling report…</p>
        ) : (
          <>
            {/* Executive summary */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Executive summary</h2>
              <p className="text-sm text-gray-500">
                A snapshot across content, keywords, backlinks and AI visibility.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <Metric
                  label="Content"
                  value={stats?.totals.all ?? content.length}
                  hint={`${stats?.totals.published ?? 0} published`}
                />
                <Metric
                  label="Avg score"
                  value={stats?.scores.scored ? stats.scores.average : "—"}
                  hint={`${stats?.scores.green ?? 0} green`}
                />
                <Metric label="Keywords" value={keywords.length} hint={`${kwTop10} in top 10`} />
                <Metric label="Backlinks" value={backlinks.length} hint={`${blLive} live`} />
                <Metric
                  label="AI queries"
                  value={mentions.length}
                  hint={`${aiVisible} visible`}
                />
                <Metric label="AI visibility" value={`${aiPct}%`} hint="cited + mentioned" />
              </div>
            </div>

            {/* Per-dataset reports */}
            <ReportCard
              title="Content & scores"
              href="/seo"
              subtitle={`${content.length} items`}
              rows={content}
              columns={contentCols}
              filename="celitix-content"
              preview={(r) => (
                <div className="flex items-center justify-between">
                  <span className="text-gray-800">{r.title}</span>
                  <span className="text-gray-400">
                    {LABEL_BY_TYPE[r.type]} · {r.status.toLowerCase()} · {r.score?.score ?? "—"}
                  </span>
                </div>
              )}
            />

            <ReportCard
              title="Keywords & rankings"
              href="/keyword-intel"
              subtitle={`${keywords.length} tracked`}
              rows={keywords}
              columns={keywordCols}
              filename="celitix-keywords"
              preview={(r) => (
                <div className="flex items-center justify-between">
                  <span className="text-gray-800">{r.keyword}</span>
                  <span className="text-gray-400">
                    {ENGINE_LABEL[r.engine] ?? r.engine} ·{" "}
                    {r.currentRank ? `#${r.currentRank}` : "unranked"}
                  </span>
                </div>
              )}
            />

            <ReportCard
              title="Backlinks"
              href="/keyword-intel"
              subtitle={`${backlinks.length} links · ${blLive} live`}
              rows={backlinks}
              columns={backlinkCols}
              filename="celitix-backlinks"
              preview={(r) => (
                <div className="flex items-center justify-between">
                  <span className="text-gray-800">{r.sourceDomain || r.sourceUrl}</span>
                  <span className="text-gray-400">
                    {r.rel} · {r.status} · DA {r.authority ?? "—"}
                  </span>
                </div>
              )}
            />

            <ReportCard
              title="AI-Overview visibility"
              href="/ai-overview"
              subtitle={`${mentions.length} queries · ${aiPct}% visible`}
              rows={mentions}
              columns={mentionCols}
              filename="celitix-ai-visibility"
              preview={(r) => (
                <div className="flex items-center justify-between">
                  <span className="text-gray-800">{r.query}</span>
                  <span className="text-gray-400">
                    {AI_ENGINE_LABEL[r.engine] ?? r.engine} · {r.presence}
                  </span>
                </div>
              )}
            />
          </>
        )}
      </div>
    </Layout>
  );
}
