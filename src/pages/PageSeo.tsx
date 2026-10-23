import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../components/Layout";
import { BAND_BADGE, scoreBand } from "../lib/score";
import { titleFromSlug } from "../lib/websitePages";
import {
  OG_TYPES,
  SCHEMA_TYPES,
  TWITTER_CARDS,
  buildRobots,
  deletePageSeo,
  emptySeoRecord,
  getPageSeo,
  parseRobots,
  previewPublicSeo,
  savePageSeo,
  scoreSeoRecord,
  discoverPageImages,
  type PageSeoRecord,
  type SeoImage,
  type DiscoveredImage,
} from "../lib/pageSeoApi";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="block text-xs font-medium text-gray-500">{label}</label>
        {hint}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Counter({ n, min, max }: { n: number; min: number; max: number }) {
  const ok = n >= min && n <= max;
  return (
    <span className={`text-xs font-medium ${ok ? "text-emerald-600" : "text-amber-600"}`}>
      {n} / {min}-{max}
    </span>
  );
}

export default function PageSeo() {
  const { slug = "" } = useParams();
  const [rec, setRec] = useState<PageSeoRecord>(() =>
    emptySeoRecord(slug, titleFromSlug(slug)),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [found, setFound] = useState<DiscoveredImage[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [findMsg, setFindMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getPageSeo(slug);
      const isNew = !r.metaTitle && !r.pageTitle && !r.focusKeyword;
      setExists(!isNew);
      setRec(isNew ? emptySeoRecord(slug, titleFromSlug(slug)) : r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this record.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof PageSeoRecord>(key: K, value: PageSeoRecord[K]) =>
    setRec((r) => ({ ...r, [key]: value }));

  const robots = useMemo(() => parseRobots(rec.robots), [rec.robots]);
  const setRobots = (patch: Partial<ReturnType<typeof parseRobots>>) =>
    set("robots", buildRobots({ ...robots, ...patch }));

  const { score, checks } = useMemo(() => scoreSeoRecord(rec), [rec]);

  function addImage() {
    const blank: SeoImage = { url: "", alt: "", title: "", caption: "", description: "" };
    set("images", [...rec.images, blank]);
  }
  function patchImage(i: number, patch: Partial<SeoImage>) {
    set(
      "images",
      rec.images.map((im, n) => (n === i ? { ...im, ...patch } : im)),
    );
  }
  function removeImage(i: number) {
    set(
      "images",
      rec.images.filter((_, n) => n !== i),
    );
  }

  async function save() {
    setSaving(true);
    setSaved(null);
    setError(null);
    try {
      const fresh = await savePageSeo(rec, score, checks);
      setRec(fresh);
      setExists(true);
      setSaved(`Saved. Score ${score}. Reload the page to see the new head.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord() {
    if (
      !confirm(
        `Delete the SEO record for /${slug}? The page reverts to its hard-coded fallback.`,
      )
    )
      return;
    try {
      await deletePageSeo(slug);
      setRec(emptySeoRecord(slug, titleFromSlug(slug)));
      setExists(false);
      setSaved("Deleted. This page is back on its fallback metadata.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
    }
  }

  async function findImages() {
    setFinding(true);
    setFindMsg(null);
    try {
      const res = await discoverPageImages(slug);
      setFound(res.images);
      if (!res.ok) setFindMsg(res.message ?? "Could not read the page.");
      else if (res.images.length === 0)
        setFindMsg(`No images found on ${res.pageUrl}.`);
      else
        setFindMsg(
          `${res.contentCount} content image(s), ${
            res.images.length - res.contentCount
          } icon(s)` +
            (res.scopedToMain
              ? " — read from the page's <main> region, so the shared header and footer are excluded."
              : " — this page has no <main>, so the whole document was scanned including the header and footer."),
        );
    } catch (e) {
      setFindMsg(e instanceof Error ? e.message : "Discovery failed.");
    } finally {
      setFinding(false);
    }
  }

  /** Pull a discovered image into the record, pre-filled with its existing alt. */
  function addFound(f: DiscoveredImage) {
    if (rec.images.some((im) => im.url === f.url)) return;
    set("images", [
      ...rec.images,
      { url: f.url, alt: f.alt, title: "", caption: "", description: "" },
    ]);
  }

  async function loadPreview() {
    try {
      setPreview(await previewPublicSeo(slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't fetch the public payload.");
    }
  }

  const siteUrl = import.meta.env.VITE_SITE_URL || "http://localhost:3001";

  return (
    <Layout
      title={`SEO · /${slug}`}
      actions={
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${
              BAND_BADGE[scoreBand(score)]
            }`}
          >
            {score}
          </span>
          <Link to="/seo" className="text-sm font-medium text-gray-500 hover:text-brand">
            Back
          </Link>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition"
          >
            {saving ? "Saving…" : "Save SEO"}
          </button>
        </div>
      }
    >
      {loading ? (
        <p className="p-10 text-center text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="p-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] items-start">
          <div className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {saved && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                {saved}
              </div>
            )}

            <Card
              title="Search result"
              hint="What Google shows. The meta title is the one graded for length, not the page title."
            >
              <Field label="Page title (internal label)">
                <input
                  className={inputClass}
                  value={rec.pageTitle}
                  onChange={(e) => set("pageTitle", e.target.value)}
                  placeholder={titleFromSlug(slug)}
                />
              </Field>
              <Field
                label="Meta title"
                hint={<Counter n={rec.metaTitle.length} min={50} max={60} />}
              >
                <input
                  className={inputClass}
                  value={rec.metaTitle}
                  onChange={(e) => set("metaTitle", e.target.value)}
                  placeholder="WhatsApp Business API | Celitix"
                />
              </Field>
              <Field
                label="Meta description"
                hint={<Counter n={rec.metaDescription.length} min={140} max={160} />}
              >
                <textarea
                  rows={3}
                  className={inputClass}
                  value={rec.metaDescription}
                  onChange={(e) => set("metaDescription", e.target.value)}
                />
              </Field>
            </Card>

            <Card title="Keywords">
              <Field label="Focus keyword">
                <input
                  className={inputClass}
                  value={rec.focusKeyword}
                  onChange={(e) => set("focusKeyword", e.target.value)}
                />
              </Field>
              <Field
                label="Secondary keywords"
                hint={<span className="text-xs text-gray-400">comma separated, 2-4</span>}
              >
                <input
                  className={inputClass}
                  value={rec.secondaryKeywords}
                  onChange={(e) => set("secondaryKeywords", e.target.value)}
                  placeholder="whatsapp api pricing, whatsapp chatbot, business messaging"
                />
              </Field>
              <Field
                label="AI / SGE queries"
                hint={<span className="text-xs text-gray-400">comma separated</span>}
              >
                <input
                  className={inputClass}
                  value={rec.aiQueries}
                  onChange={(e) => set("aiQueries", e.target.value)}
                  placeholder="how do I get the whatsapp business api in india"
                />
              </Field>
              <Field label="TL;DR summary">
                <textarea
                  rows={2}
                  className={inputClass}
                  value={rec.tldr}
                  onChange={(e) => set("tldr", e.target.value)}
                />
              </Field>
            </Card>

            <Card
              title="Canonical and robots"
              hint="Leave canonical blank and the backend uses SITE_URL/slug. Set SITE_URL in the production .env."
            >
              <Field label="Canonical URL">
                <input
                  className={inputClass}
                  value={rec.canonical}
                  onChange={(e) => set("canonical", e.target.value)}
                  placeholder={`https://www.celitix.com/${slug}`}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-5 pt-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={robots.index}
                    onChange={(e) => setRobots({ index: e.target.checked })}
                  />
                  Index
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={robots.follow}
                    onChange={(e) => setRobots({ follow: e.target.checked })}
                  />
                  Follow
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="max-snippet">
                  <select
                    className={inputClass}
                    value={robots.maxSnippet}
                    onChange={(e) => setRobots({ maxSnippet: e.target.value })}
                  >
                    <option value="-1">-1 (no limit)</option>
                    <option value="0">0</option>
                    <option value="160">160</option>
                  </select>
                </Field>
                <Field label="max-image-preview">
                  <select
                    className={inputClass}
                    value={robots.maxImagePreview}
                    onChange={(e) => setRobots({ maxImagePreview: e.target.value })}
                  >
                    <option value="large">large</option>
                    <option value="standard">standard</option>
                    <option value="none">none</option>
                  </select>
                </Field>
                <Field label="max-video-preview">
                  <select
                    className={inputClass}
                    value={robots.maxVideoPreview}
                    onChange={(e) => setRobots({ maxVideoPreview: e.target.value })}
                  >
                    <option value="-1">-1 (no limit)</option>
                    <option value="0">0</option>
                    <option value="30">30</option>
                  </select>
                </Field>
              </div>
              <p className="text-xs font-mono text-gray-400 break-all">{rec.robots}</p>
            </Card>

            <Card title="Open Graph" hint="Used by WhatsApp, LinkedIn and Facebook previews.">
              <Field label="OG title">
                <input
                  className={inputClass}
                  value={rec.ogTitle}
                  onChange={(e) => set("ogTitle", e.target.value)}
                />
              </Field>
              <Field label="OG description">
                <textarea
                  rows={2}
                  className={inputClass}
                  value={rec.ogDescription}
                  onChange={(e) => set("ogDescription", e.target.value)}
                />
              </Field>
              <div className="grid gap-3 md:grid-cols-[1fr_200px]">
                <Field label="OG image URL">
                  <input
                    className={inputClass}
                    value={rec.ogImage}
                    onChange={(e) => set("ogImage", e.target.value)}
                    placeholder="/uploads/og-whatsapp.jpg"
                  />
                </Field>
                <Field label="OG type">
                  <select
                    className={inputClass}
                    value={rec.ogType}
                    onChange={(e) => set("ogType", e.target.value)}
                  >
                    {OG_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="text-xs text-amber-600">
                In production this must resolve to a public celitix.com URL - social
                crawlers cannot reach localhost.
              </p>
            </Card>

            <Card
              title="Twitter card"
              hint="Blank title, description or image falls back to the Open Graph values."
            >
              <Field label="Card type">
                <select
                  className={inputClass}
                  value={rec.twitterCard}
                  onChange={(e) => set("twitterCard", e.target.value)}
                >
                  {TWITTER_CARDS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Twitter title">
                <input
                  className={inputClass}
                  value={rec.twitterTitle}
                  onChange={(e) => set("twitterTitle", e.target.value)}
                />
              </Field>
              <Field label="Twitter description">
                <textarea
                  rows={2}
                  className={inputClass}
                  value={rec.twitterDescription}
                  onChange={(e) => set("twitterDescription", e.target.value)}
                />
              </Field>
              <Field label="Twitter image URL">
                <input
                  className={inputClass}
                  value={rec.twitterImage}
                  onChange={(e) => set("twitterImage", e.target.value)}
                />
              </Field>
            </Card>

            <Card
              title="Schema"
              hint="JSON-LD is built automatically from the fields above. Fill the override only to replace it entirely."
            >
              <Field label="Schema type">
                <select
                  className={inputClass}
                  value={rec.schemaType}
                  onChange={(e) => set("schemaType", e.target.value)}
                >
                  {SCHEMA_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Custom JSON-LD override"
                hint={
                  <span className="text-xs text-gray-400">
                    an object or an array of objects
                  </span>
                }
              >
                <textarea
                  rows={8}
                  className={`${inputClass} font-mono text-xs`}
                  value={rec.customJsonLd}
                  onChange={(e) => set("customJsonLd", e.target.value)}
                  placeholder='[{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}]'
                />
              </Field>
              <p className="text-xs text-gray-500">
                Invalid JSON is not an error - the backend silently falls back to the
                auto-built blocks, so check the score panel.
              </p>
            </Card>

            <Card
              title="Image metadata"
              hint="Emitted as ImageObject JSON-LD: title becomes name, alt becomes alternateName."
            >
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                Alt text on the visible image tag lives in the page body and cannot be
                injected from the head. Alt entered here feeds the JSON-LD only - the
                visible alt is a one-time developer paste from the page's content
                document.
              </div>

              {/* Discovery: list what is really on the page, then pick. */}
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">
                      Images on the live page
                    </p>
                    <p className="text-xs text-gray-500">
                      Read straight from the rendered page, so you annotate images
                      that actually exist rather than typing paths.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void findImages()}
                    disabled={finding}
                    className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                  >
                    {finding ? "Reading…" : found ? "Refresh" : "Find images"}
                  </button>
                </div>

                {findMsg && (
                  <p className="mt-2 text-xs text-gray-500">{findMsg}</p>
                )}

                {found && found.length > 0 && (
                  <>
                    <p className="mt-3 text-xs text-amber-700">
                      Largest first, icons last. Add only the images that carry
                      meaning on this page — every image you add must then have all
                      four fields filled, or the score check fails.
                    </p>
                    <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-gray-100">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-gray-100">
                          {found.map((f) => {
                            const already = rec.images.some((im) => im.url === f.url);
                            return (
                              <tr key={f.stem} className="hover:bg-gray-50/70">
                                <td className="px-3 py-2">
                                  <p className="font-medium text-gray-900">
                                    {f.stem}
                                    {f.likelyIcon && (
                                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal text-gray-500">
                                        icon
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-gray-400 font-mono break-all">
                                    {f.url}
                                  </p>
                                  <p className="text-gray-500">
                                    alt: {f.alt ? `"${f.alt}"` : <em>empty</em>}
                                    {f.width && f.height
                                      ? ` · ${f.width}×${f.height}`
                                      : ""}
                                  </p>
                                </td>
                                <td className="px-3 py-2 text-right align-top">
                                  {already ? (
                                    <span className="text-gray-400">Added</span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => addFound(f)}
                                      className="font-medium text-brand hover:text-brand-dark"
                                    >
                                      Add
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {rec.images.length === 0 && (
                <p className="text-sm text-gray-400">No images registered yet.</p>
              )}

              {rec.images.map((im, i) => (
                <div key={i} className="rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500">Image {i + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="text-xs font-medium text-red-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                  <Field label="Image URL">
                    <input
                      className={inputClass}
                      value={im.url}
                      onChange={(e) => patchImage(i, { url: e.target.value })}
                      placeholder="/uploads/hero.webp"
                    />
                  </Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Alt">
                      <input
                        className={inputClass}
                        value={im.alt}
                        onChange={(e) => patchImage(i, { alt: e.target.value })}
                      />
                    </Field>
                    <Field label="Title">
                      <input
                        className={inputClass}
                        value={im.title}
                        onChange={(e) => patchImage(i, { title: e.target.value })}
                      />
                    </Field>
                    <Field label="Caption">
                      <input
                        className={inputClass}
                        value={im.caption}
                        onChange={(e) => patchImage(i, { caption: e.target.value })}
                      />
                    </Field>
                    <Field label="Description">
                      <input
                        className={inputClass}
                        value={im.description}
                        onChange={(e) => patchImage(i, { description: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addImage}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Add image
              </button>
            </Card>

            <div className="flex items-center justify-between gap-4 pb-4">
              <a
                href={`${siteUrl}/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-gray-500 hover:text-brand"
              >
                Open /{slug} on the site
              </a>
              {exists && (
                <button
                  type="button"
                  onClick={() => void removeRecord()}
                  className="text-sm font-medium text-red-500 hover:text-red-600"
                >
                  Delete this SEO record
                </button>
              )}
            </div>
          </div>

          {/* Score panel */}
          <div className="space-y-4 xl:sticky xl:top-8">
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Gold Mine score</h2>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${
                    BAND_BADGE[scoreBand(score)]
                  }`}
                >
                  {score}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Head-level checks only. Word count, keyword density and heading
                structure belong to the page body and are graded in its content
                document.
              </p>
              <ul className="mt-4 space-y-2">
                {checks.map((c) => (
                  <li key={c.id} className="flex gap-2 text-xs">
                    <span className={c.ok ? "text-emerald-600" : "text-amber-500"}>
                      {c.ok ? "✓" : "•"}
                    </span>
                    <span>
                      <span
                        className={c.ok ? "text-gray-700" : "text-gray-900 font-medium"}
                      >
                        {c.label}
                      </span>
                      <span className="block text-gray-400">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Public payload</h2>
                <button
                  type="button"
                  onClick={() => void loadPreview()}
                  className="text-xs font-medium text-brand hover:text-brand-dark"
                >
                  Fetch
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Exactly what the website receives from /api/public/seo/{slug}, including
                the built JSON-LD.
              </p>
              {preview && (
                <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-700">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
