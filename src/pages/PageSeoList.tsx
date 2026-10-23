import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { BAND_BADGE, scoreBand } from "../lib/score";
import { WEBSITE_PAGES, ALL_WEBSITE_SLUGS, titleFromSlug } from "../lib/websitePages";
import {
  listPageSeo,
  getPageSeoHealth,
  type PageSeoListItem,
  type PageSeoHealth,
} from "../lib/pageSeoApi";
import { toCsv, downloadCsv, stamp, type CsvColumn } from "../lib/csv";

const PAGE_SEO_CSV_COLUMNS: CsvColumn<PageSeoListItem>[] = [
  { key: "slug", header: "Slug" },
  { key: "metaTitle", header: "Meta title" },
  { key: "focusKeyword", header: "Focus keyword" },
  { key: "score", header: "Score" },
  { key: "updatedAt", header: "Updated at" },
];

type HealthState = PageSeoHealth | "loading" | undefined;

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="text-sm text-gray-400">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset ${
        BAND_BADGE[scoreBand(score)]
      }`}
    >
      {score}
    </span>
  );
}

function HealthBadge({ state }: { state: HealthState }) {
  if (state === undefined) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  if (state === "loading") {
    return <span className="text-xs text-gray-500">Checking…</span>;
  }
  const map: Record<PageSeoHealth["status"], { cls: string; label: string }> = {
    green:   { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "✓ Live" },
    amber:   { cls: "bg-amber-50 text-amber-800 ring-amber-200",       label: "⚠ Partial" },
    red:     { cls: "bg-red-50 text-red-700 ring-red-200",             label: "✗ Bypassed" },
    unknown: { cls: "bg-gray-100 text-gray-600 ring-gray-200",         label: "? Unreachable" },
  };
  const cfg = map[state.status];
  const tip = state.reasons.length
    ? state.reasons.join(" · ")
    : `Checked ${new Date(state.checkedAt).toLocaleTimeString()}`;
  return (
    <span
      title={tip}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset cursor-help ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

export default function PageSeoList() {
  const [records, setRecords] = useState<PageSeoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthBySlug, setHealthBySlug] = useState<Map<string, HealthState>>(new Map());
  const [checkingAll, setCheckingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await listPageSeo());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load SEO records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const bySlug = useMemo(() => {
    const m = new Map<string, PageSeoListItem>();
    for (const r of records) m.set(r.slug, r);
    return m;
  }, [records]);

  const extras = useMemo(
    () => records.filter((r) => !ALL_WEBSITE_SLUGS.includes(r.slug)),
    [records],
  );

  const siteUrl = import.meta.env.VITE_SITE_URL || "http://localhost:3001";
  const done = ALL_WEBSITE_SLUGS.filter((s) => bySlug.has(s)).length;

  function handleExportCsv() {
    const csv = toCsv(records, PAGE_SEO_CSV_COLUMNS);
    downloadCsv(`celitix-page-seo-${stamp()}.csv`, csv);
  }

  const runCheck = useCallback(async (slug: string) => {
    setHealthBySlug((m) => {
      const next = new Map(m);
      next.set(slug, "loading");
      return next;
    });
    try {
      const result = await getPageSeoHealth(slug);
      setHealthBySlug((m) => {
        const next = new Map(m);
        next.set(slug, result);
        return next;
      });
    } catch (e) {
      setHealthBySlug((m) => {
        const next = new Map(m);
        next.set(slug, {
          status: "unknown",
          checks: {},
          reasons: [e instanceof Error ? e.message : "check failed"],
          checkedAt: new Date().toISOString(),
          liveUrl: `${siteUrl}/${slug}`,
        });
        return next;
      });
    }
  }, [siteUrl]);

  const runCheckAll = useCallback(async () => {
    setCheckingAll(true);
    try {
      for (const r of records) {
        await runCheck(r.slug);
      }
    } finally {
      setCheckingAll(false);
    }
  }, [records, runCheck]);

  function Row({ slug }: { slug: string }) {
    const rec = bySlug.get(slug);
    const health = healthBySlug.get(slug);
    return (
      <tr className="hover:bg-gray-50/70">
        <td className="px-5 py-3">
          <p className="font-medium text-gray-900">
            {rec?.metaTitle || titleFromSlug(slug)}
          </p>
          <p className="text-xs text-gray-500 font-mono">/{slug}</p>
        </td>
        <td className="px-5 py-3">
          {rec ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              SEO set ✓
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-200">
              No record
            </span>
          )}
        </td>
        <td className="px-5 py-3 text-gray-600 text-xs">
          {rec?.focusKeyword || "—"}
        </td>
        <td className="px-5 py-3">
          <ScoreBadge score={rec?.score} />
        </td>
        <td className="px-5 py-3">
          {rec ? (
            <div className="flex items-center gap-2">
              <HealthBadge state={health} />
              <button
                type="button"
                onClick={() => void runCheck(slug)}
                disabled={health === "loading"}
                className="text-xs font-medium text-gray-500 hover:text-brand disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {health === undefined ? "Check" : "Recheck"}
              </button>
            </div>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
        <td className="px-5 py-3 text-right">
          <div className="flex items-center justify-end gap-4">
            <a
              href={`${siteUrl}/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-gray-500 hover:text-brand"
            >
              View
            </a>
            <Link
              to={`/seo/${slug}`}
              className="font-medium text-brand hover:text-brand-dark"
            >
              {rec ? "Edit SEO" : "Add SEO"}
            </Link>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <Layout title="Page SEO">
      <div className="p-8 space-y-5">
        <div className="flex items-start justify-between gap-6">
          <p className="text-sm text-gray-500 max-w-3xl">
            Each record drives that page's title, meta description, canonical,
            robots, Open Graph, Twitter card and JSON-LD, server-side. Pages with
            no record keep their existing hard-coded fallback, so nothing breaks
            until you fill one in.
          </p>
          <div className="shrink-0 flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600">
              {done}/{ALL_WEBSITE_SLUGS.length} pages configured
            </span>
            <button
              type="button"
              onClick={() => void runCheckAll()}
              disabled={checkingAll || records.length === 0}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkingAll ? "Checking…" : "Recheck all"}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={records.length === 0}
              className="rounded-lg border border-brand px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white border border-gray-200">
            <p className="p-10 text-center text-sm text-gray-500">Loading…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-10 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
              {WEBSITE_PAGES.map((g) => (
                <div key={g.group}>
                  <p className="px-5 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {g.group}
                  </p>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {g.slugs.map((slug) => (
                        <Row key={slug} slug={slug} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {extras.length > 0 && (
              <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
                <p className="px-5 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Other records
                </p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {extras.map((r) => (
                      <Row key={r.slug} slug={r.slug} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
