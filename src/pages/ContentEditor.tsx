import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import BlockList from "../components/editor/BlockList";
import ScorePanel from "../components/editor/ScorePanel";
import SeoFields from "../components/editor/SeoFields";
import { useDebouncedScore } from "../hooks/useDebouncedScore";
import {
  ApiError,
  CONTENT_TYPES,
  LABEL_BY_TYPE,
  createContent,
  emptyDraft,
  getContent,
  isContentType,
  slugify,
  updateContent,
  listCategories,
  type Category,
  type ContentDetail,
  type ContentDraft,
  type ContentType,
} from "../lib/api";
import {
  PLACEHOLDER_IMAGE_NAME,
  placeholderImageFile,
} from "../lib/placeholderImage";
import ImagePicker from "../components/ImagePicker";
import { mediaSrc, metaFilledCount, type MediaItem } from "../lib/mediaApi";
import {
  blockIssues,
  collectBlockImageMeta,
  countWordsInHtml,
  createBlock,
  parseBlocks,
  serializeBlocks,
  sanitizeEmbeddedHtml,
  type Block,
} from "../lib/blocks";

/**
 * The backend's Zod schema rejects these with a bare 400, so check them here
 * and say which field is wrong in words the writer can act on.
 */
function validate(draft: ContentDraft): string[] {
  const problems: string[] = [];
  if (!draft.title.trim()) problems.push("Give it a title.");
  if (!draft.slug.trim()) problems.push("The URL slug can't be empty.");
  if (draft.shortDesc.trim().length < 50)
    problems.push(
      `The short description needs at least 50 characters — it has ${draft.shortDesc.trim().length}.`,
    );
  if (draft.content.length < 100)
    problems.push(
      "The body is too short to save — write at least a paragraph.",
    );
  if (!draft.category.trim()) problems.push("Pick a category.");
  if (!draft.tags.trim()) problems.push("Add at least one tag.");
  if (!draft.seo.focusKeyword.trim())
    problems.push("Set a focus keyword — the SEO keywords are built from it.");
  if (!draft.seo.title.trim()) problems.push("Write a meta title.");
  if (!draft.seo.description.trim()) problems.push("Write a meta description.");
  return problems;
}

/** Word-count floor the engine expects, by type. */
function minWords(type: ContentType): number {
  return type === "POST" ? 600 : 1200;
}

function toArray<T = any>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string" && raw.trim()) {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p as T[];
    } catch {
      /* ignore */
    }
  }
  return [];
}

function draftFromDetail(item: ContentDetail): ContentDraft {
  const base = emptyDraft(item.type);
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
    faqs: toArray(item.faqs),
    seo: {
      title: item.seo?.title ?? "",
      description: item.seo?.description ?? "",
      keywords: item.seo?.keywords ?? "",
      focusKeyword: item.seo?.focusKeyword ?? "",
      secondaryKeywords: toArray<string>(item.seo?.secondaryKeywords),
      aiQueries: item.seo?.aiQueries ?? "",
      tldr: item.seo?.tldr ?? "",
      hasFaq: item.seo?.hasFaq ?? false,
    },
  };
}

/** Id prefix marking the item's already-saved image in the picked list. */
const STORED_ID = "stored:";

/**
 * The item's saved featured image as a picker entry. The backend stores the
 * multer path (`uploads/123.jpg`, backslashes on Windows) and serves it from
 * /api/uploads. It isn't a Library row, so its only known metadata is the ALT
 * the server derives from the focus keyword.
 */
function storedImageItem(image: string, focusKeyword: string): MediaItem {
  const filename = image.split(/[\\/]/).pop() ?? image;
  const url = /^https?:\/\//i.test(image) ? image : `/api/uploads/${filename}`;
  return {
    id: `${STORED_ID}${image}`,
    filename,
    originalName: filename,
    url,
    mimeType: "",
    size: 0,
    alt: focusKeyword,
    title: "",
    caption: "",
    description: "",
    createdAt: "",
    updatedAt: "",
  };
}

const labelClass = "block text-sm font-medium text-gray-700";
const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

export default function ContentEditor() {
  const [categories, setCategories] = useState<Category[]>([]);
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const isEdit = Boolean(routeSlug);

  const initialType = isContentType(params.get("type"))
    ? (params.get("type") as ContentType)
    : "POST";

  const [draft, setDraft] = useState<ContentDraft>(() =>
    emptyDraft(initialType),
  );
  // Once the writer edits the slug by hand it stops tracking the title —
  // silently renaming a live URL would break every existing link to it.
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Set once the item exists in the database — either we opened an existing
  // one, or we just created it. Anything after that is an update, not a create.
  const [savedSlug, setSavedSlug] = useState<string | null>(routeSlug ?? null);
  const [hasStoredImage, setHasStoredImage] = useState(false);
  // The file input was replaced by the Library picker, so this stays null;
  // it is kept so the placeholder-upload path below is unchanged.
  const [imageFile] = useState<File | null>(null);
  // Images chosen from the Library. The first one is the featured image;
  // all of them feed the draft's `media` array, which is what the scorer
  // reads for the image checks.
  const [picked, setPicked] = useState<MediaItem[]>([]);
  /**
   * The body, as blocks. Editing source of truth; `draft.content` stays empty in
   * state and the real HTML is compiled from these blocks wherever the body is
   * read. One copy, so there is nothing to fall out of step.
   */
  const [blocks, setBlocks] = useState<Block[]>(() =>
    routeSlug ? [] : [createBlock("text")],
  );
  const [bodyMode, setBodyMode] = useState<"visual" | "html">("visual");
  const [htmlSource, setHtmlSource] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{
    kind: "ok" | "error";
    text: string;
    problems?: string[];
    expired?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!routeSlug) return;
    let cancelled = false;

    setLoading(true);
    setLoadError(null);
    getContent(routeSlug)
      .then((item) => {
        if (cancelled) return;
        setDraft(draftFromDetail(item));
        // Stored HTML back into blocks. Anything saved before the block system
        // existed carries no markers and returns as a single Text block.
        setBlocks(parseBlocks(item.content ?? ""));
        setSlugTouched(true); // an existing slug is never auto-rewritten
        setSavedSlug(item.slug);
        setHasStoredImage(Boolean(item.image));
        // Show the saved featured image in the picker list so it isn't lost
        // from view (and from the score) when the item is reopened.
        setPicked(
          item.image
            ? [storedImageItem(item.image, item.seo?.focusKeyword ?? "")]
            : [],
        );
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(
          e instanceof Error ? e.message : "Couldn't load this item.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [routeSlug]);

  function patch(changes: Partial<ContentDraft>) {
    setDraft((d) => ({ ...d, ...changes }));
  }

  function handleTitleChange(value: string) {
    setDraft((d) => ({
      ...d,
      title: value,
      slug: slugTouched ? d.slug : slugify(value),
    }));
  }

  // The server derives the featured image's ALT from the focus keyword when it
  // re-scores after a save. Mirror that here so the live number matches the
  // stored one — but only when there really is an image, so the preview never
  // claims credit the saved item wouldn't get.
  const hasImage = Boolean(imageFile) || hasStoredImage || picked.length > 0;

  // Images picked from the Library carry all four metadata fields, so hand the
  // scorer the real values rather than a guess. Falling back to the focus
  // keyword only when nothing is picked keeps the old behaviour intact.
  /** The body HTML — compiled from blocks, used everywhere the body is read. */
  const contentHtml = useMemo(
    () =>
      bodyMode === "html"
        ? sanitizeEmbeddedHtml(htmlSource)
        : serializeBlocks(blocks),
    [bodyMode, htmlSource, blocks],
  );

  /**
   * The draft as it will be sent.
   *
   * Images inside blocks join `media` alongside the picked ones. That is not
   * cosmetic: the engine's 4-field check reads `featuredImage` and `media` and
   * never the `<img>` tags in the body, so a fully tagged in-block image that
   * did not reach this array would leave the check amber while the CMS showed
   * 4/4. Deduplicated inside collectBlockImageMeta.
   */
  const fullDraft = useMemo<ContentDraft>(() => {
    const pickedMeta = picked.map((m) => ({
      alt: m.alt,
      title: m.title,
      caption: m.caption,
      description: m.description,
    }));
    const blockMeta = collectBlockImageMeta(blocks).filter(
      (m) => !picked.some((p) => p.alt === m.alt && p.title === m.title),
    );
    const media = [...pickedMeta, ...blockMeta];

    return {
      ...draft,
      content: contentHtml,
      featuredImage:
        pickedMeta[0] ??
        (hasImage ? { alt: draft.seo.focusKeyword } : undefined),
      media,
    };
  }, [draft, contentHtml, hasImage, picked, blocks]);

  const scoreState = useDebouncedScore(fullDraft);

  const words = countWordsInHtml(contentHtml);
  const target = minWords(draft.type);

  /** Block-level problems that would cost points, rolled up under the list. */
  const blockErrorCount = useMemo(
    () =>
      blocks.reduce(
        (sum, b) =>
          sum +
          blockIssues(b, draft.seo.focusKeyword).filter(
            (i) => i.level === "error",
          ).length,
        0,
      ),
    [blocks, draft.seo.focusKeyword],
  );

  useEffect(() => {
    let alive = true;
    listCategories()
      .then((r) => {
        if (alive) setCategories(r.categories || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function handleSave(status: "draft" | "published") {
    const problems = validate(fullDraft);
    if (problems.length > 0) {
      setBanner({
        kind: "error",
        text: "Not saved — a few things need fixing first:",
        problems,
      });
      return;
    }

    setSaving(true);
    setBanner(null);

    // The picked featured image already lives on the server. Fetch it back as a
    // File so it goes through the existing multipart upload path unchanged —
    // no backend or api.ts change needed.
    // The item's own saved image is already in place on the server — skip the
    // re-upload so an unchanged image isn't replaced by a copy of itself.
    let fileToSend = imageFile;
    if (!fileToSend && picked[0] && !picked[0].id.startsWith(STORED_ID)) {
      try {
        const res = await fetch(mediaSrc(picked[0].url));
        const blob = await res.blob();
        fileToSend = new File([blob], picked[0].originalName, {
          type: blob.type,
        });
      } catch {
        // Non-fatal: fall through to the placeholder rather than blocking a save.
      }
    }

    // seo.keywords is required by the API but is just the keyword set, so
    // build it rather than asking the writer for the same words twice.
    const payload: ContentDraft = {
      ...fullDraft,
      seo: {
        ...fullDraft.seo,
        keywords: [
          fullDraft.seo.focusKeyword,
          ...fullDraft.seo.secondaryKeywords,
        ]
          .map((k) => k.trim())
          .filter(Boolean)
          .join(", "),
      },
    };

    try {
      if (savedSlug) {
        const res = await updateContent(savedSlug, payload, fileToSend, status);
        setSavedSlug(payload.slug);
        if (fileToSend) setHasStoredImage(true);
        setBanner({
          kind: "ok",
          text:
            res.message ??
            (status === "published" ? "Published." : "Draft saved."),
        });
      } else {
        const file = fileToSend ?? placeholderImageFile();
        const res = await createContent(payload, file, status);
        setSavedSlug(payload.slug);
        setHasStoredImage(Boolean(fileToSend));
        // Adopt the new record's id so the focus-keyword uniqueness check stops
        // matching this item against itself.
        if (res.id) patch({ id: res.id });
        setBanner({
          kind: "ok",
          text:
            res.score !== undefined
              ? `${status === "published" ? "Published" : "Draft saved"} — the server scored it ${res.score}/100.`
              : (res.message ?? "Saved."),
        });
      }
    } catch (e) {
      const expired = e instanceof ApiError && e.status === 401;
      setBanner({
        kind: "error",
        text: expired
          ? "Your session has expired — sign in again and your work will still be here."
          : e instanceof Error
            ? e.message
            : "Couldn't save. Check your connection and try again.",
        expired,
      });
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit ? `Edit: ${draft.title || routeSlug}` : "New content";

  if (loading) {
    return (
      <Layout title="Loading…">
        <p className="p-10 text-center text-sm text-gray-500">Loading…</p>
      </Layout>
    );
  }

  if (loadError) {
    return (
      <Layout title="Content">
        <div className="p-10 text-center">
          <p className="text-sm text-red-600">{loadError}</p>
          <Link
            to="/content"
            className="mt-3 inline-block rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Back to list
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title={title}
      actions={
        <div className="flex items-center gap-2">
          <Link
            to={`/content?type=${draft.type}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Back
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave("draft")}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave("published")}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition"
          >
            Publish
          </button>
        </div>
      }
    >
      <div className="p-8">
        {banner && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              banner.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{banner.text}</p>
                {banner.problems && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                    {banner.problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                {banner.expired && (
                  <Link
                    to="/login"
                    className="mt-2 inline-block font-medium underline"
                  >
                    Go to sign in
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="shrink-0 opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* ---------------- Left: the draft ---------------- */}
          <div className="space-y-4">
            <section className="rounded-2xl bg-white border border-gray-200 p-6 space-y-4">
              <div>
                <label className={labelClass} htmlFor="type">
                  Type
                </label>
                <select
                  id="type"
                  value={draft.type}
                  onChange={(e) =>
                    patch({ type: e.target.value as ContentType })
                  }
                  className={inputClass}
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {LABEL_BY_TYPE[t]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Sets the word-count target: {minWords(draft.type)}+ words.
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="title">
                  Title
                </label>
                <input
                  id="title"
                  type="text"
                  value={draft.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="How to send bulk SMS in India"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="slug">
                  URL slug
                </label>
                <input
                  id="slug"
                  type="text"
                  value={draft.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    patch({ slug: slugify(e.target.value) });
                  }}
                  placeholder="how-to-send-bulk-sms-in-india"
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {slugTouched
                    ? "Set manually — it no longer follows the title."
                    : "Following the title. Edit it once and it stays put."}{" "}
                  {draft.slug.length > 75 && (
                    <span className="text-red-600">
                      {draft.slug.length} chars — the engine wants 75 or fewer.
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="shortDesc">
                  Short description
                </label>
                <textarea
                  id="shortDesc"
                  rows={3}
                  value={draft.shortDesc}
                  onChange={(e) => patch({ shortDesc: e.target.value })}
                  placeholder="A one-paragraph summary used in listings."
                  className={inputClass}
                />
                <p
                  className={`mt-1 text-xs ${
                    draft.shortDesc.length > 0 && draft.shortDesc.length < 50
                      ? "text-red-600"
                      : "text-gray-500"
                  }`}
                >
                  {draft.shortDesc.length} characters — needs at least 50 to
                  save.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="category">
                    Category
                  </label>
                  <select
                    id="category"
                    value={draft.category}
                    onChange={(e) => patch({ category: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">— Select a category —</option>
                    {categories
                      .filter((c) =>
                        draft.type === "PAGE"
                          ? c.type === "page"
                          : c.type === "blog",
                      )
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    {draft.category &&
                      !categories.some((c) => c.name === draft.category) && (
                        <option value={draft.category}>
                          {draft.category} (unmanaged)
                        </option>
                      )}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="tags">
                    Tags
                  </label>
                  <input
                    id="tags"
                    type="text"
                    value={draft.tags}
                    onChange={(e) => patch({ tags: e.target.value })}
                    placeholder="celitix, sms"
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-gray-500">Comma-separated.</p>
                </div>
              </div>

              <div>
                <span className={labelClass}>
                  Images{" "}
                  <span className="text-gray-400">(from the Library)</span>
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  The first image is the featured one. Pick 2 or more with a 4/4
                  badge to turn the image checks green.
                </p>

                <div className="mt-2 flex flex-wrap gap-3">
                  {picked.map((m, i) => (
                    <div
                      key={m.id}
                      className="relative w-28 overflow-hidden rounded-lg border border-gray-200"
                    >
                      <div className="aspect-video bg-gray-100">
                        <img
                          src={mediaSrc(m.url)}
                          alt={m.alt || m.originalName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {i === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Featured
                        </span>
                      )}
                      <span
                        className={`absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          metaFilledCount(m) === 4
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {metaFilledCount(m)}/4
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPicked((p) => p.filter((x) => x.id !== m.id))
                        }
                        className="w-full bg-white py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="flex h-[86px] w-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-xs font-medium text-gray-500 transition hover:border-brand hover:text-brand"
                  >
                    <span className="text-lg leading-none">+</span>
                    Add image
                  </button>
                </div>

                {picked.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    None picked yet. Without images the API still needs a file,
                    so a 1-pixel placeholder (
                    <code>{PLACEHOLDER_IMAGE_NAME}</code>) is attached and the
                    image checks stay red.
                  </p>
                )}

                <ImagePicker
                  open={pickerOpen}
                  multiple
                  title="Choose images for this page"
                  onClose={() => setPickerOpen(false)}
                  onSelect={(imgs) =>
                    setPicked((prev) => {
                      const seen = new Set(prev.map((p) => p.id));
                      return [...prev, ...imgs.filter((i) => !seen.has(i.id))];
                    })
                  }
                />
              </div>
            </section>

            <div className="mb-3 flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setBlocks(parseBlocks(htmlSource));
                    setBodyMode("visual");
                  }}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    bodyMode === "visual"
                      ? "bg-brand text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Visual editor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHtmlSource(serializeBlocks(blocks));
                    setBodyMode("html");
                  }}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    bodyMode === "html"
                      ? "bg-brand text-white"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Raw HTML
                </button>
              </div>
              <span className="text-xs text-gray-400">
                {bodyMode === "html"
                  ? "Editing the whole body as HTML — switch back to rebuild blocks from it."
                  : "Build visually with blocks."}
              </span>
            </div>

            {bodyMode === "html" ? (
              <textarea
                value={htmlSource}
                onChange={(e) => setHtmlSource(e.target.value)}
                spellCheck={false}
                placeholder="<section>…paste or write the whole page HTML here…</section>"
                className="h-[32rem] w-full rounded-lg border border-gray-300 p-3 font-mono text-xs leading-relaxed outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            ) : (
              <BlockList
                blocks={blocks}
                onChange={setBlocks}
                focusKeyword={draft.seo.focusKeyword}
              />
            )}

            <p className="px-1 text-xs text-gray-500">
              <span
                className={
                  words < target ? "text-amber-600" : "text-emerald-600"
                }
              >
                {words} words
              </span>{" "}
              across all blocks — target {target}–3500. Use H2s, a list, and
              links: the score grades the structure, not just the prose.
              {blockErrorCount > 0 && (
                <span className="text-red-600">
                  {" "}
                  {blockErrorCount} block problem
                  {blockErrorCount === 1 ? "" : "s"} will cost points — expand
                  the flagged blocks to see them.
                </span>
              )}
            </p>

            <SeoFields draft={draft} onChange={patch} />
          </div>

          {/* ---------------- Right: the score ---------------- */}
          <aside className="xl:sticky xl:top-8 xl:self-start">
            <ScorePanel {...scoreState} />
          </aside>
        </div>

        {/* Bottom action bar — mirrors the top so you needn't scroll up */}
        <div className="mt-8 flex items-center justify-end gap-2 border-t border-gray-100 pt-5">
          <Link
            to={`/content?type=${draft.type}`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Back
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave("draft")}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave("published")}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 transition"
          >
            Publish
          </button>
        </div>
      </div>
    </Layout>
  );
}
