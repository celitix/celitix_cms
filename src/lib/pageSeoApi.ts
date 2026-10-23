// src/lib/pageSeoApi.ts
// Client for the SEO-only connector (/api/page-seo + /api/public/seo/:slug).
// Kept out of api.ts deliberately - that file is 1200+ lines and shared by every
// screen, so the connector gets its own module with its own tiny request helper.
//
// Field names are camelCase to match pageSeo.controller.ts exactly. The backend
// upsert writes `?? null` for anything absent, so ALWAYS send a full record.

import { getToken } from "./auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class PageSeoError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; json?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
  });

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    throw new PageSeoError(`Server returned ${res.status}`, res.status);
  }
  if (!res.ok) {
    const message =
      (parsed as { message?: string })?.message ?? `Server returned ${res.status}`;
    throw new PageSeoError(message, res.status);
  }
  return parsed as T;
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** One image whose metadata the connector emits as an ImageObject JSON-LD block. */
export type SeoImage = {
  url: string;
  alt: string;
  title: string;
  caption: string;
  description: string;
};

export type PageSeoRecord = {
  slug: string;
  pageTitle: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  /** Comma-separated in the DB, comma-separated here. */
  secondaryKeywords: string;
  canonical: string;
  /** A single directive string, e.g. "index,follow,max-snippet:-1". */
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  schemaType: string;
  /** Raw JSON. When valid, it replaces the auto-built JSON-LD entirely. */
  customJsonLd: string;
  images: SeoImage[];
  aiQueries: string;
  tldr: string;
  score?: number | null;
};

export type PageSeoListItem = {
  id: string;
  slug: string;
  metaTitle: string | null;
  focusKeyword: string | null;
  score: number | null;
  updatedAt: string;
};

export const SCHEMA_TYPES = [
  "WebPage",
  "Service",
  "Product",
  "SoftwareApplication",
  "Organization",
  "AboutPage",
  "ContactPage",
  "CollectionPage",
  "FAQPage",
] as const;

export const OG_TYPES = ["website", "article", "product", "profile"] as const;
export const TWITTER_CARDS = ["summary_large_image", "summary"] as const;

export function emptySeoRecord(slug: string, pageTitle = ""): PageSeoRecord {
  return {
    slug,
    pageTitle,
    metaTitle: "",
    metaDescription: "",
    focusKeyword: "",
    secondaryKeywords: "",
    canonical: "",
    robots: "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    ogType: "website",
    twitterCard: "summary_large_image",
    twitterTitle: "",
    twitterDescription: "",
    twitterImage: "",
    schemaType: "WebPage",
    customJsonLd: "",
    images: [],
    aiQueries: "",
    tldr: "",
    score: null,
  };
}

/** The API hands back nulls; the form wants strings. */
function s(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

function normalizeImages(raw: unknown): SeoImage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((im: any) => ({
    url: s(im?.url),
    alt: s(im?.alt),
    title: s(im?.title),
    caption: s(im?.caption),
    description: s(im?.description),
  }));
}

function fromApi(slug: string, rec: any): PageSeoRecord {
  const base = emptySeoRecord(slug);
  if (!rec) return base;
  return {
    slug: s(rec.slug) || slug,
    pageTitle: s(rec.pageTitle),
    metaTitle: s(rec.metaTitle),
    metaDescription: s(rec.metaDescription),
    focusKeyword: s(rec.focusKeyword),
    secondaryKeywords: s(rec.secondaryKeywords),
    canonical: s(rec.canonical),
    robots: s(rec.robots) || base.robots,
    ogTitle: s(rec.ogTitle),
    ogDescription: s(rec.ogDescription),
    ogImage: s(rec.ogImage),
    ogType: s(rec.ogType) || "website",
    twitterCard: s(rec.twitterCard) || "summary_large_image",
    twitterTitle: s(rec.twitterTitle),
    twitterDescription: s(rec.twitterDescription),
    twitterImage: s(rec.twitterImage),
    schemaType: s(rec.schemaType) || "WebPage",
    customJsonLd: s(rec.customJsonLd),
    images: normalizeImages(rec.images),
    aiQueries: s(rec.aiQueries),
    tldr: s(rec.tldr),
    score: typeof rec.score === "number" ? rec.score : null,
  };
}

/* ------------------------------------------------------------------ */
/* Calls                                                               */
/* ------------------------------------------------------------------ */

export async function listPageSeo(): Promise<PageSeoListItem[]> {
  const res = await request<{ status: boolean; items: PageSeoListItem[] }>(
    "/api/page-seo",
  );
  return res.items ?? [];
}

/** Returns a blank record (not null) when the slug has no entry yet. */
export async function getPageSeo(slug: string): Promise<PageSeoRecord> {
  const res = await request<{ status: boolean; seo: any }>(`/api/page-seo/${slug}`);
  return fromApi(slug, res.seo);
}

export async function savePageSeo(
  record: PageSeoRecord,
  score: number,
  checks: SeoCheck[],
): Promise<PageSeoRecord> {
  const res = await request<{ status: boolean; seo: any }>("/api/page-seo", {
    method: "POST",
    json: { ...record, score, checks },
  });
  return fromApi(record.slug, res.seo);
}

export async function deletePageSeo(slug: string): Promise<void> {
  await request(`/api/page-seo/${slug}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Image discovery                                                     */
/* ------------------------------------------------------------------ */

/** One image found on the rendered page. */
export type DiscoveredImage = {
  /** Filename without the build hash - MultiAgentLiveChat. Stable across rebuilds. */
  stem: string;
  /** The built path, e.g. /_next/static/media/MultiAgentLiveChat.85a6f535.png */
  url: string;
  /** The alt already on the <img> tag in the page body. */
  alt: string;
  width: number | null;
  height: number | null;
  /** Small rendered box - almost certainly a UI icon rather than content. */
  likelyIcon: boolean;
};

export type DiscoverResult = {
  ok: boolean;
  pageUrl: string;
  images: DiscoveredImage[];
  /** False when the page had no <main>, so the whole document was scanned. */
  scopedToMain: boolean;
  contentCount: number;
  message?: string;
};

/**
 * Asks the backend to fetch the live page and list its images. Read-only -
 * nothing is saved until the user adds an image to the record.
 */
export async function discoverPageImages(slug: string): Promise<DiscoverResult> {
  const res = await request<{
    status: boolean;
    pageUrl: string;
    scopedToMain?: boolean;
    contentCount?: number;
    images?: DiscoveredImage[];
    message?: string;
  }>(`/api/page-seo/${slug}/images`);
  const images = res.images ?? [];
  return {
    ok: Boolean(res.status),
    pageUrl: res.pageUrl ?? "",
    images,
    scopedToMain: Boolean(res.scopedToMain),
    contentCount: res.contentCount ?? images.filter((i) => !i.likelyIcon).length,
    message: res.message,
  };
}

/** What the live site will actually receive - used by the Preview panel. */
export async function previewPublicSeo(slug: string): Promise<any> {
  const res = await request<{ status: boolean; seo: any }>(`/api/public/seo/${slug}`);
  return res.seo;
}

/* ------------------------------------------------------------------ */
/* Robots directive string <-> checkbox state                          */
/* ------------------------------------------------------------------ */

export type RobotsState = {
  index: boolean;
  follow: boolean;
  maxSnippet: string;
  maxImagePreview: string;
  maxVideoPreview: string;
};

export function parseRobots(raw: string): RobotsState {
  const parts = (raw || "").split(",").map((p) => p.trim().toLowerCase());
  const val = (key: string, fallback: string) => {
    const hit = parts.find((p) => p.startsWith(`${key}:`));
    return hit ? hit.slice(key.length + 1) : fallback;
  };
  return {
    index: !parts.includes("noindex"),
    follow: !parts.includes("nofollow"),
    maxSnippet: val("max-snippet", "-1"),
    maxImagePreview: val("max-image-preview", "large"),
    maxVideoPreview: val("max-video-preview", "-1"),
  };
}

export function buildRobots(r: RobotsState): string {
  return [
    r.index ? "index" : "noindex",
    r.follow ? "follow" : "nofollow",
    `max-snippet:${r.maxSnippet}`,
    `max-image-preview:${r.maxImagePreview}`,
    `max-video-preview:${r.maxVideoPreview}`,
  ].join(",");
}

/* ------------------------------------------------------------------ */
/* Gold Mine SEO score - connector scope                               */
/* ------------------------------------------------------------------ */

export type SeoCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

/**
 * Grades ONLY what this connector controls - the head. Body-copy checks
 * (word count, density, H2 spread, internal links) are not scored here because
 * the connector never sees the body; those stay with the page's content doc.
 */
export function scoreSeoRecord(r: PageSeoRecord): {
  score: number;
  checks: SeoCheck[];
} {
  const checks: SeoCheck[] = [];
  const add = (id: string, label: string, ok: boolean, detail: string) =>
    checks.push({ id, label, ok, detail });

  const fk = r.focusKeyword.trim().toLowerCase();
  const has = (hay: string) => Boolean(fk) && hay.toLowerCase().includes(fk);

  const mt = r.metaTitle.trim();
  add(
    "meta-title-length",
    "Meta title 50-60 characters",
    mt.length >= 50 && mt.length <= 60,
    `${mt.length} characters`,
  );
  add("focus-keyword", "Focus keyword set", Boolean(fk), fk || "Not set");
  add("fk-in-title", "Focus keyword in meta title", has(mt), has(mt) ? "Found" : "Missing");

  const md = r.metaDescription.trim();
  add(
    "meta-desc-length",
    "Meta description 140-160 characters",
    md.length >= 140 && md.length <= 160,
    `${md.length} characters`,
  );
  add("fk-in-desc", "Focus keyword in meta description", has(md), has(md) ? "Found" : "Missing");
  add(
    "fk-in-slug",
    "Focus keyword in slug",
    has(r.slug.replace(/-/g, " ")) || has(r.slug),
    r.slug,
  );

  const sk = r.secondaryKeywords.split(",").map((k) => k.trim()).filter(Boolean);
  add("secondary-keywords", "2-4 secondary keywords", sk.length >= 2 && sk.length <= 4, `${sk.length} set`);

  add(
    "canonical",
    "Canonical URL is absolute",
    /^https?:\/\//i.test(r.canonical.trim()),
    r.canonical || "Not set - backend will default to SITE_URL/slug",
  );
  add("robots", "Robots directive set", Boolean(r.robots.trim()), r.robots || "Not set");

  add(
    "og-text",
    "OG title and description set",
    Boolean(r.ogTitle.trim() && r.ogDescription.trim()),
    r.ogTitle.trim() && r.ogDescription.trim() ? "Both set" : "One or both missing",
  );
  add("og-image", "OG image set", Boolean(r.ogImage.trim()), r.ogImage || "Not set");
  add(
    "twitter",
    "Twitter card complete",
    Boolean(r.twitterCard.trim() && (r.twitterImage.trim() || r.ogImage.trim())),
    r.twitterImage.trim() ? "Own image" : r.ogImage.trim() ? "Falls back to OG image" : "No image",
  );
  add("schema-type", "Schema type chosen", Boolean(r.schemaType.trim()), r.schemaType);

  /* ---------------------------------------------------------------- */
  /* Image checks                                                      */
  /*                                                                   */
  /* Google does not weight the four fields equally. Alt text is the    */
  /* primary signal for an image; caption is secondary; the title       */
  /* attribute is largely ignored, and description is not a standard    */
  /* img attribute at all - here it only feeds ImageObject.description. */
  /*                                                                   */
  /* So a keyword must appear in the ALT plus at least ONE other field. */
  /* Requiring all four would force the same phrase four times over one */
  /* picture, which is the pattern Google's spam policies name as       */
  /* keyword stuffing - see the guard check at the end.                 */
  /* ---------------------------------------------------------------- */

  const imgs = r.images.filter((im) => im.url.trim());
  const full = imgs.filter(
    (im) => im.alt.trim() && im.title.trim() && im.caption.trim() && im.description.trim(),
  );
  add("images-present", "At least one image registered", imgs.length > 0, `${imgs.length} image(s)`);
  add(
    "images-four-fields",
    "Every image has all 4 metadata fields",
    imgs.length > 0 && full.length === imgs.length,
    `${full.length}/${imgs.length} complete`,
  );

  /** Fields other than alt, for the "alt plus one more" rule. */
  const others = (im: SeoImage) => [im.title, im.caption, im.description];
  const hasIn = (text: string, kw: string) =>
    Boolean(kw) && text.toLowerCase().includes(kw.toLowerCase());
  /** Keyword is in the alt AND in at least one of title/caption/description. */
  const carries = (im: SeoImage, kw: string) =>
    hasIn(im.alt, kw) && others(im).some((f) => hasIn(f, kw));

  const primaryImgs = fk ? imgs.filter((im) => carries(im, fk)) : [];
  add(
    "image-primary-keyword",
    "Focus keyword in one image's alt + one other field",
    primaryImgs.length >= 1,
    primaryImgs.length >= 1
      ? `${primaryImgs.length} image(s) carry it`
      : fk
        ? "No image has the focus keyword in its alt and a second field"
        : "No focus keyword set",
  );

  const secondaryImgs = imgs.filter((im) => sk.some((k) => carries(im, k)));
  add(
    "image-secondary-keywords",
    "3 images carry a secondary keyword in alt + one other field",
    secondaryImgs.length >= 3,
    `${secondaryImgs.length}/3 image(s)`,
  );

  // Guard: the same keyword in ALL FOUR fields of one image is stuffing.
  // This check passes by default and only fails if someone over-optimises.
  const stuffed = imgs.filter((im) =>
    [fk, ...sk].some(
      (k) =>
        Boolean(k) &&
        hasIn(im.alt, k) &&
        hasIn(im.title, k) &&
        hasIn(im.caption, k) &&
        hasIn(im.description, k),
    ),
  );
  add(
    "images-not-stuffed",
    "No image repeats a keyword in all 4 fields",
    stuffed.length === 0,
    stuffed.length === 0
      ? "Clean"
      : `${stuffed.length} image(s) repeat a keyword in every field - Google reads this as stuffing`,
  );

  add("ai-queries", "AI / SGE queries set", Boolean(r.aiQueries.trim()), r.aiQueries ? "Set" : "Not set");
  add("tldr", "TL;DR summary set", Boolean(r.tldr.trim()), r.tldr ? "Set" : "Not set");

  let customOk = true;
  let customDetail = "Not used - auto JSON-LD applies";
  if (r.customJsonLd.trim()) {
    try {
      JSON.parse(r.customJsonLd);
      customDetail = "Valid JSON - overrides auto JSON-LD";
    } catch {
      customOk = false;
      customDetail = "Invalid JSON - backend will silently fall back to auto";
    }
  }
  add("custom-jsonld", "Custom JSON-LD parses", customOk, customDetail);

  const passed = checks.filter((c) => c.ok).length;
  return { score: Math.round((passed / checks.length) * 100), checks };
}

/* ---------- Layer 1 health check (24 Aug) ---------- */

export type PageSeoHealthStatus = "green" | "amber" | "red" | "unknown";

export type PageSeoHealthChecks = {
  titleMatch: boolean;
  canonicalMatch: boolean;
  hasSchemaType: boolean;
  hasOgImage: boolean;
  hasRobots: boolean;
};

export type PageSeoHealth = {
  status: PageSeoHealthStatus;
  checks: Partial<PageSeoHealthChecks>;
  reasons: string[];
  checkedAt: string;
  liveUrl: string;
  jsonLdTypes?: string[];
};

/**
 * Asks the backend to fetch the live page and compare its <head> against the
 * saved CMS record. Read-only. Returns green/amber/red/unknown so the CMS can
 * flag pages where the connector has been silently bypassed (e.g. a layout.js
 * that exports a hardcoded metadata object).
 */
export async function getPageSeoHealth(slug: string): Promise<PageSeoHealth> {
  return await request<PageSeoHealth>(`/api/page-seo/${slug}/health`);
}

/* ---------- Layer 1 health summary (Dashboard tile, 25 Aug) ---------- */

export type PageSeoHealthSummary = {
  green: number;
  amber: number;
  red: number;
  unknown: number;
  total: number;
  needsAttention: number;
  checkedAt: string;
};

/**
 * Walks every configured page_seo record on the backend, running the same
 * live-head health check as getPageSeoHealth, and returns the tally. Powers
 * the Dashboard "Live connector health" tile. On-demand only.
 */
export async function getPageSeoHealthSummary(): Promise<PageSeoHealthSummary> {
  return await request<PageSeoHealthSummary>("/api/page-seo/health-summary");
}
