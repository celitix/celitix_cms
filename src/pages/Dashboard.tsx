import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { getAdmin } from "../lib/auth";
import {
  getStats,
  LABEL_BY_TYPE,
  TYPE_BY_LABEL,
  type ContentType,
  type DashboardItem,
  type DashboardStats,
} from "../lib/api";
import { getPageSeoHealthSummary, type PageSeoHealthSummary } from "../lib/pageSeoApi";
import { BAND_BADGE, BAND_TEXT, scoreBand } from "../lib/score";

const STATUS_PILL: Record<string, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DRAFT: "bg-gray-100 text-gray-600 ring-gray-200",
  HIDDEN: "bg-amber-50 text-amber-700 ring-amber-200",
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-sm text-gray-400">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        BAND_BADGE[scoreBand(score)]
      }`}
    >
      {score}
    </span>
  );
}

/** A single headline number. */
function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

/** A stacked green/amber/red bar for the score distribution. */
function ScoreBar({ green, amber, red }: { green: number; amber: number; red: number }) {
  const total = green + amber + red;
  if (total === 0) {
    return (
      <div className="h-3 w-full rounded-full bg-gray-100" title="No scored content yet" />
    );
  }
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="bg-emerald-500" style={{ width: pct(green) }} title={`${green} green`} />
      <div className="bg-amber-500" style={{ width: pct(amber) }} title={`${amber} amber`} />
      <div className="bg-red-500" style={{ width: pct(red) }} title={`${red} red`} />
    </div>
  );
}

/** A compact row used by both the "recent" and "needs attention" lists. */
function ItemRow({ item }: { item: DashboardItem }) {
  return (
    <Link
      to={`/content/edit/${item.slug}`}
      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 transition"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">
          {item.title || <span className="text-gray-400">Untitled</span>}
        </p>
        <p className="truncate text-xs text-gray-400">
          {LABEL_BY_TYPE[item.type]} · /{item.slug}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
            STATUS_PILL[item.status] ?? STATUS_PILL.DRAFT
          }`}
        >
          {item.status.toLowerCase()}
        </span>
        <ScoreBadge score={item.score} />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const admin = getAdmin();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 6: on-demand live connector-health summary (no auto-fetch, no cache).
  const [health, setHealth] = useState<PageSeoHealthSummary | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const runHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      setHealth(await getPageSeoHealthSummary());
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : "Couldn't check live health.");
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getStats()
      .then((s) => {
        if (alive) setStats(s);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Couldn't reach the server.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Layout
      title="Dashboard"
      actions={
        <Link
          to="/content/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
        >
          New Content
        </Link>
      }
    >
      <div className="p-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Welcome{admin?.name ? `, ${admin.name}` : ""} 👋
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            The whole library at a glance — every number is live from the database.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !stats ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : stats ? (
          <>
            {/* Connector pages strip */}
            <Link
              to="/seo"
              className="block rounded-2xl border border-gray-200 bg-white p-5 hover:border-brand hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Connector pages (Page SEO)
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    The 32 hard-coded website pages. Metadata-only, scored on the connector's 21 head-level checks.
                  </p>
                </div>
                <span className="text-xs font-medium text-brand">Open Page SEO →</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-500">Configured</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {stats.pageSeo.configured}<span className="text-sm text-gray-400"> / 32</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Average score</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">
                    {stats.pageSeo.scored ? stats.pageSeo.average : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Needs work</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.pageSeo.needsWork}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Score bands</p>
                  <p className="mt-1 text-sm font-medium">
                    <span className="text-emerald-600">{stats.pageSeo.green}</span>
                    <span className="text-gray-300"> · </span>
                    <span className="text-amber-600">{stats.pageSeo.amber}</span>
                    <span className="text-gray-300"> · </span>
                    <span className="text-red-600">{stats.pageSeo.red}</span>
                  </p>
                </div>
              </div>
            </Link>

            {/* Live connector health (Step 6) — on-demand walk of every configured page */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Live connector health
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Fetches each configured page and compares its live head against the CMS record — catches a page whose connector has been bypassed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void runHealth()}
                  disabled={healthLoading}
                  className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  {healthLoading ? "Checking…" : health ? "Refresh" : "Check now"}
                </button>
              </div>

              {healthError && <p className="mt-3 text-sm text-red-600">{healthError}</p>}

              {health ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
                    <div>
                      <p className="text-xs text-gray-500">Needs attention</p>
                      <p
                        className={`mt-1 text-2xl font-semibold ${
                          health.needsAttention ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {health.needsAttention}
                      </p>
                      <p className="text-[11px] text-gray-400">red + amber</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Live ✓</p>
                      <p className="mt-1 text-2xl font-semibold text-emerald-600">{health.green}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Partial</p>
                      <p className="mt-1 text-2xl font-semibold text-amber-600">{health.amber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Bypassed</p>
                      <p className="mt-1 text-2xl font-semibold text-red-600">{health.red}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Unreachable</p>
                      <p className="mt-1 text-2xl font-semibold text-gray-500">{health.unknown}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      Checked {new Date(health.checkedAt).toLocaleTimeString()} · {health.total} page(s) walked
                    </p>
                    <Link to="/seo" className="text-xs font-medium text-brand hover:underline">
                      Open Page SEO →
                    </Link>
                  </div>
                </>
              ) : (
                !healthError && (
                  <p className="mt-4 text-sm text-gray-400">
                    Not checked yet — press Check now. Walks the {stats.pageSeo.configured} configured page(s); takes a few seconds.
                  </p>
                )
              )}
            </div>

            {/* Headline numbers */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Total content"
                value={stats.totals.all}
                sub={`${stats.totals.published} published · ${stats.totals.draft} draft · ${stats.totals.hidden} hidden`}
              />
              <StatCard
                label="Average score"
                value={stats.scores.scored ? stats.scores.average : "—"}
                sub={
                  stats.scores.scored
                    ? `across ${stats.scores.scored} scored`
                    : "nothing scored yet"
                }
              />
              <StatCard
                label="Needs work"
                value={stats.scores.red + stats.scores.amber + stats.totals.draft}
                sub={`${stats.scores.red} red · ${stats.scores.amber} amber`}
              />
              <StatCard label="Images" value={stats.media} sub="in the library" />
            </div>

            {/* Score distribution + type breakdown */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white border border-gray-200 p-6">
                <div className="flex items-baseline justify-between">
                  <p className="font-medium text-gray-900">Score distribution</p>
                  <p className="text-sm text-gray-400">
                    {stats.scores.scored} scored
                    {stats.scores.unscored ? ` · ${stats.scores.unscored} not yet` : ""}
                  </p>
                </div>
                <div className="mt-4">
                  <ScoreBar
                    green={stats.scores.green}
                    amber={stats.scores.amber}
                    red={stats.scores.red}
                  />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className={`text-2xl font-semibold ${BAND_TEXT.green}`}>
                      {stats.scores.green}
                    </p>
                    <p className="text-xs text-gray-500">Green · 85+</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-semibold ${BAND_TEXT.amber}`}>
                      {stats.scores.amber}
                    </p>
                    <p className="text-xs text-gray-500">Amber · 60–84</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-semibold ${BAND_TEXT.red}`}>
                      {stats.scores.red}
                    </p>
                    <p className="text-xs text-gray-500">Red · below 60</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-gray-200 p-6">
                <p className="font-medium text-gray-900">By type</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {(Object.entries(TYPE_BY_LABEL) as [string, ContentType][]).map(
                    ([label, type]) => (
                      <Link
                        key={type}
                        to={`/content?type=${type}`}
                        className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:border-brand hover:bg-brand-50 transition"
                      >
                        <span className="text-sm text-gray-600">{label}</span>
                        <span className="text-lg font-semibold text-gray-900">
                          {stats.byType[type] ?? 0}
                        </span>
                      </Link>
                    ),
                  )}
                </div>
              </div>
            </div>

            {/* Recent + needs attention */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white border border-gray-200 p-4">
                <div className="flex items-center justify-between px-2 pb-2">
                  <p className="font-medium text-gray-900">Recently updated</p>
                  <Link to="/content" className="text-sm text-brand hover:underline">
                    View all
                  </Link>
                </div>
                {stats.recent.length ? (
                  <div className="space-y-0.5">
                    {stats.recent.map((it) => (
                      <ItemRow key={it.id} item={it} />
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-gray-400">
                    No content yet.
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-white border border-gray-200 p-4">
                <p className="px-2 pb-2 font-medium text-gray-900">Needs attention</p>
                {stats.attention.length ? (
                  <div className="space-y-0.5">
                    {stats.attention.map((it) => (
                      <ItemRow key={it.id} item={it} />
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-gray-400">
                    Everything's published and scoring well. 🎉
                  </p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
