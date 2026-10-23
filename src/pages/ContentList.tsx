import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import {
  LABEL_BY_TYPE,
  isContentType,
  listContent,
  type ContentListItem,
  type ContentType,
} from "../lib/api";
import { BAND_BADGE, scoreBand } from "../lib/score";

const STATUS_PILL: Record<string, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DRAFT: "bg-gray-100 text-gray-600 ring-gray-200",
  HIDDEN: "bg-amber-50 text-amber-700 ring-amber-200",
};

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

export default function ContentList() {
  const [params] = useSearchParams();
  const rawType = params.get("type");
  const type: ContentType | undefined = isContentType(rawType) ? rawType : undefined;

  const [items, setItems] = useState<ContentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listContent({ type, limit: 50 });
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  const heading = type ? `${LABEL_BY_TYPE[type]}s` : "All content";
  const newHref = type ? `/content/new?type=${type}` : "/content/new";

  return (
    <Layout
      title={heading}
      actions={
        <Link
          to={newHref}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition"
        >
          New Content
        </Link>
      }
    >
      <div className="p-8 space-y-4">
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="p-10 text-center text-sm text-gray-500">Loading…</p>
          ) : error ? (
            <div className="p-10 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-500">
                No {heading.toLowerCase()} yet.
              </p>
              <Link
                to={newHref}
                className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark transition"
              >
                Create the first one
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Title</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Score</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500">/{item.slug}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {LABEL_BY_TYPE[item.type] ?? item.type}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          STATUS_PILL[item.status] ?? STATUS_PILL.DRAFT
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <ScoreBadge score={item.score?.score} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <a
                          href={`${import.meta.env.VITE_SITE_URL || "http://localhost:3001"}/${item.type === "POST" ? "blog/" : ""}${item.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-gray-500 hover:text-brand"
                        >
                          View
                        </a>
                        <Link
                          to={`/analyze/${item.slug}`}
                          className="font-medium text-gray-500 hover:text-brand"
                        >
                          Analyze
                        </Link>
                        <Link
                          to={`/seo/${item.slug}`}
                          className="font-medium text-gray-500 hover:text-brand"
                        >
                          SEO
                        </Link>
                        <Link
                          to={`/content/edit/${item.slug}`}
                          className="font-medium text-brand hover:text-brand-dark"
                        >
                          Edit
                        </Link>
                      </div>
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
