import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import {
  emptyDraft,
  getContent,
  getStoredScore,
  listContent,
  LABEL_BY_TYPE,
  scorePreview,
  type ContentDetail,
  type ContentDraft,
  type ContentListItem,
  type ScoreCheck,
  type ScoreResult,
} from "../lib/api";
import { collectBlockImageMeta, parseBlocks } from "../lib/blocks";
import { BAND_TEXT, CHECK_DOT, scoreBand } from "../lib/score";

const BAND_RING: Record<string, string> = {
  green: "ring-emerald-200 bg-emerald-50",
  amber: "ring-amber-200 bg-amber-50",
  red: "ring-red-200 bg-red-50",
};

const STATUS_LABEL: Record<ScoreCheck["status"], string> = {
  green: "Passing",
  yellow: "Warning",
  red: "Failing",
};

/**
 * Rebuilds the exact draft the editor would score, from a saved item — so
 * "Re-run live" reflects the current stored content (including in-block image
 * metadata, which the save-time score can miss) rather than a stale number.
 */
function draftForRescore(item: ContentDetail): ContentDraft {
  const base = emptyDraft(item.type);
  const media = collectBlockImageMeta(parseBlocks(item.content ?? ""));
  return {
    ...base,
    id: item.id,
    type: item.type,
    title: item.title ?? "",
    slug: item.slug ?? "",
    shortDesc: item.shortDesc ?? "",
    content: item.content ?? "",
    category: item.category || base.category,
    tags: item.tags || base.tags,
    faqs: item.faqs ?? [],
    seo: {
      title: item.seo?.title ?? "",
      description: item.seo?.description ?? "",
      keywords: item.seo?.keywords ?? "",
      focusKeyword: item.seo?.focusKeyword ?? "",
      secondaryKeywords: item.seo?.secondaryKeywords ?? [],
      aiQueries: item.seo?.aiQueries ?? "",
      tldr: item.seo?.tldr ?? "",
      hasFaq: item.seo?.hasFaq ?? false,
    },
    featuredImage: item.image ? { alt: item.seo?.focusKeyword ?? "" } : undefined,
    media,
  };
}

function ScoreDial({ score }: { score: number }) {
  const band = scoreBand(score);
  return (
    <div
      className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full ring-4 ${BAND_RING[band]}`}
    >
      <span className={`text-3xl font-bold ${BAND_TEXT[band]}`}>{score}</span>
      <span className="text-[10px] uppercase tracking-wide text-gray-400">/ 100</span>
    </div>
  );
}

function CheckRow({ check }: { check: ScoreCheck }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${CHECK_DOT[check.status]}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-900">{check.label}</p>
          <span className="shrink-0 text-xs font-semibold text-gray-400">
            {check.points}/10
          </span>
        </div>
        {check.message && (
          <p className="mt-0.5 text-xs text-gray-500">{check.message}</p>
        )}
      </div>
    </li>
  );
}

export default function PageAnalyzer() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [items, setItems] = useState<ContentListItem[]>([]);
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [live, setLive] = useState(false); // true once a live re-run replaces the stored score
  const [loading, setLoading] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate the picker once.
  useEffect(() => {
    listContent({ limit: 100 })
      .then((res) => setItems(res.items ?? []))
      .catch(() => {
        /* the picker is a convenience; a failure here shouldn't block a deep link */
      });
  }, []);

  // Load the selected item: stored score first, plus its detail for Re-run.
  useEffect(() => {
    if (!slug) {
      setDetail(null);
      setResult(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setLive(false);
    setError(null);
    Promise.all([getStoredScore(slug), getContent(slug)])
      .then(([score, item]) => {
        if (!alive) return;
        setResult(score);
        setDetail(item);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Couldn't load this item.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const rerun = useCallback(async () => {
    if (!detail) return;
    setRerunning(true);
    setError(null);
    try {
      const fresh = await scorePreview(draftForRescore(detail));
      setResult(fresh);
      setLive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't re-run the score.");
    } finally {
      setRerunning(false);
    }
  }, [detail]);

  const summary = useMemo(() => {
    const checks = result?.checks ?? [];
    let green = 0,
      yellow = 0,
      red = 0,
      earned = 0;
    for (const c of checks) {
      earned += c.points;
      if (c.status === "green") green += 1;
      else if (c.status === "yellow") yellow += 1;
      else red += 1;
    }
    return { green, yellow, red, earned, possible: checks.length * 10, total: checks.length };
  }, [result]);

  const grouped = useMemo(() => {
    const checks = result?.checks ?? [];
    const order: ScoreCheck["status"][] = ["red", "yellow", "green"];
    return order
      .map((status) => ({ status, checks: checks.filter((c) => c.status === status) }))
      .filter((g) => g.checks.length > 0);
  }, [result]);

  return (
    <Layout title="Page Analyzer">
      <div className="p-8 space-y-6">
        {/* Picker */}
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-700">
            Analyze a page
          </label>
          <select
            className="mt-2 w-full max-w-lg rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            value={slug ?? ""}
            onChange={(e) => {
              const next = e.target.value;
              navigate(next ? `/analyze/${next}` : "/analyze");
            }}
          >
            <option value="">Select a page, blog, case study or guide…</option>
            {items.map((it) => (
              <option key={it.id} value={it.slug}>
                [{LABEL_BY_TYPE[it.type] ?? it.type}] {it.title || it.slug}
                {it.status !== "PUBLISHED" ? ` · ${it.status.toLowerCase()}` : ""}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!slug ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center text-sm text-gray-400">
            Pick an item above, or open it from the content list's “Analyze” link.
          </div>
        ) : loading ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-12 text-center text-sm text-gray-500">
            Loading score…
          </div>
        ) : result ? (
          <>
            {/* Header: dial + summary + actions */}
            <div className="rounded-2xl bg-white border border-gray-200 p-6">
              <div className="flex flex-wrap items-center gap-6">
                <ScoreDial score={result.score} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-gray-900">
                      {detail?.title || slug}
                    </h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        live
                          ? "bg-brand-50 text-brand"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {live ? "live re-run" : "stored score"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    {detail ? LABEL_BY_TYPE[detail.type] : ""} · /{slug}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <span className="text-emerald-600">{summary.green} passing</span>
                    <span className="text-amber-600">{summary.yellow} warnings</span>
                    <span className="text-red-600">{summary.red} failing</span>
                    <span className="text-gray-400">
                      {summary.earned}/{summary.possible} pts
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => void rerun()}
                    disabled={rerunning || !detail}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
                  >
                    {rerunning ? "Re-running…" : "Re-run live"}
                  </button>
                  <Link
                    to={`/content/edit/${slug}`}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Open in editor
                  </Link>
                </div>
              </div>
              {live && (
                <p className="mt-4 text-xs text-gray-400">
                  Live re-run scores the current saved content, including in-block
                  image metadata. Save the item to persist this score.
                </p>
              )}
            </div>

            {/* Checks, grouped failing → warning → passing */}
            {summary.total === 0 ? (
              <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center text-sm text-gray-500">
                No checks recorded yet. Hit <strong>Re-run live</strong> to score it now.
              </div>
            ) : (
              <div className="space-y-4">
                {grouped.map((group) => (
                  <div
                    key={group.status}
                    className="rounded-2xl bg-white border border-gray-200 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${CHECK_DOT[group.status]}`} />
                      <p className="text-sm font-semibold text-gray-700">
                        {STATUS_LABEL[group.status]}
                      </p>
                      <span className="text-xs text-gray-400">({group.checks.length})</span>
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {group.checks.map((c) => (
                        <CheckRow key={c.id} check={c} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </Layout>
  );
}
