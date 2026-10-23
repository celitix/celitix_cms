import type { Admin } from "./auth";
import { getToken } from "./auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

export type ContentType = "PAGE" | "POST" | "CASE_STUDY" | "GUIDE";
export type ContentStatus = "DRAFT" | "PUBLISHED" | "HIDDEN";

/** Sidebar labels -> the `type` value the backend expects. */
export const TYPE_BY_LABEL: Record<string, ContentType> = {
  Pages: "PAGE",
  Blogs: "POST",
  "Case Studies": "CASE_STUDY",
  Guides: "GUIDE",
};

export const CONTENT_TYPES: ContentType[] = ["PAGE", "POST", "CASE_STUDY", "GUIDE"];

/** Narrows an untrusted value (e.g. a `?type=` query param) to a ContentType. */
export function isContentType(value: unknown): value is ContentType {
  return typeof value === "string" && (CONTENT_TYPES as string[]).includes(value);
}

/**
 * Anything that can appear as a "page" in the dashboard: a CMS ContentType, or
 * "SEO" for an SEO-connector page_seo record (which has no Content row).
 */
export type PageLabelType = ContentType | "SEO";

export const LABEL_BY_TYPE: Record<PageLabelType, string> = {
  PAGE: "Page",
  POST: "Blog",
  CASE_STUDY: "Case Study",
  GUIDE: "Guide",
  SEO: "SEO",
};

export type Faq = { question: string; answer: string };

/**
 * SEO fields. These MUST be sent nested under `seo` — the scoring controller
 * reads `b.seo?.focusKeyword` etc. and silently ignores flat top-level fields,
 * which produces a stuck-low score with no error message.
 */
export type SeoDraft = {
  /** Meta title. This — not `title` — is what the scorer grades for length. */
  title: string;
  /** Meta description (the 140–160 char check). */
  description: string;
  /** Required on save only. Comma-separated string, NOT an array. */
  keywords: string;
  focusKeyword: string;
  /** The engine wants 2–4 of these. */
  secondaryKeywords: string[];
  /** Comma-separated AI/SGE queries. */
  aiQueries: string;
  tldr: string;
  hasFaq: boolean;
};

/** Image metadata the scorer reads (alt/title/caption/description checks). */
export type ImageMeta = {
  alt?: string;
  title?: string;
  caption?: string;
  description?: string;
};

export type ContentDraft = {
  /**
   * The database id (cuid) of the item being edited — NOT the slug. The scorer
   * compares it against `content.id` to exclude the item from its own focus
   * keyword uniqueness check; passing a slug here would silently fail to match
   * and the item would flag itself as a duplicate. Undefined for new content.
   */
  id?: string;
  type: ContentType;
  /** Fallback title. The scorer prefers `seo.title` over this one. */
  title: string;
  slug: string;
  /** Required on save: min 50 chars. */
  shortDesc: string;
  /** HTML body. Required on save: min 100 chars. */
  content: string;
  /** Required on save: min 1 char. */
  category: string;
  /** Required on save: min 1 char. Comma-separated string, NOT an array. */
  tags: string;
  faqs: Faq[];
  seo: SeoDraft;
  featuredImage?: ImageMeta;
  /** Per-image metadata from a media manager (doesn't exist yet — stays empty). */
  media?: ImageMeta[];
};

export type ScoreCheck = {
  id: string;
  label: string;
  status: "green" | "yellow" | "red";
  points: 0 | 5 | 10;
  message: string;
};

export type ScoreResult = {
  score: number;
  checks: ScoreCheck[];
};

/** One row in the dashboard's "recent" / "needs attention" lists. */
export type DashboardItem = {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  status: ContentStatus;
  score: number | null;
  updatedAt: string;
};

/**
 * The dashboard aggregate. Every field is a real DB count, so the cards show
 * the true library, not a tally of the first page of the content list.
 */
export type DashboardStats = {
  pageSeo: { configured: number; scored: number; average: number; green: number; amber: number; red: number; needsWork: number };
  totals: { all: number; published: number; draft: number; hidden: number };
  byType: Record<ContentType, number>;
  scores: {
    average: number;
    green: number;
    amber: number;
    red: number;
    unscored: number;
    scored: number;
  };
  media: number;
  recent: DashboardItem[];
  attention: DashboardItem[];
};

/** A row from GET /api/content (a Prisma content row with seo + score joined). */
export type ContentListItem = {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  status: ContentStatus;
  image?: string | null;
  createdAt: string;
  updatedAt: string;
  seo?: { title?: string; description?: string; focusKeyword?: string | null } | null;
  score?: { score: number } | null;
};

/** A full item from GET /api/content/:slug. */
export type ContentDetail = ContentListItem & {
  shortDesc: string;
  content: string;
  category: string;
  tags: string;
  faqs?: Faq[] | null;
  seo?:
    | ({
        keywords?: string;
        secondaryKeywords?: string[] | null;
        aiQueries?: string | null;
        tldr?: string | null;
        hasFaq?: boolean | null;
        canonical?: string | null;
        robots?: string | null;
        jsonLd?: unknown;
      } & ContentListItem["seo"])
    | null;
};

/* ------------------------------------------------------------------ */
/* Low-level request helper                                            */
/* ------------------------------------------------------------------ */

/**
 * Raised for any non-2xx response. The backend's error middleware always
 * replies `{ message, status: false }`, so `message` is the human-readable text.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  /** JSON body. Mutually exclusive with `form`. */
  json?: unknown;
  /** multipart/form-data body. Content-Type is left unset so the browser adds the boundary. */
  form?: FormData;
  /** Attach `Authorization: Bearer <token>` if we have one. */
  auth?: boolean;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    // Deliberately no Content-Type — the browser must set the multipart boundary.
    body = opts.form;
  }

  if (opts.auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
    signal: opts.signal,
  });

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    if (!res.ok) throw new ApiError(`Server returned ${res.status}`, res.status);
    throw new ApiError("Unexpected response from server.", res.status);
  }

  if (!res.ok) {
    const message =
      (parsed as { message?: string })?.message ?? `Server returned ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return parsed as T;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export type LoginResponse = {
  status: boolean;
  message?: string;
  token?: string;
  admin?: Admin;
};

/**
 * Calls the backend's POST /api/auth/login.
 * Returns the parsed body on any HTTP status (the backend uses { status, message }
 * for both success and failure). Throws only on a network/connection error.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  try {
    return (await res.json()) as LoginResponse;
  } catch {
    return { status: false, message: "Unexpected response from server." };
  }
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/**
 * Maps editor state into the exact nested payload POST /api/public/score/preview
 * expects. Everything SEO lives under `seo`; flat fields are ignored server-side.
 * This mapper is the only place that shape is written down.
 */
export function buildScorePayload(draft: ContentDraft) {
  return {
    id: draft.id,
    type: draft.type,
    title: draft.title,
    slug: draft.slug,
    content: draft.content,
    faqs: draft.faqs,
    featuredImage: draft.featuredImage,
    media: draft.media ?? [],
    seo: {
      title: draft.seo.title,
      description: draft.seo.description,
      focusKeyword: draft.seo.focusKeyword,
      secondaryKeywords: draft.seo.secondaryKeywords,
      aiQueries: draft.seo.aiQueries,
      tldr: draft.seo.tldr,
      hasFaq: draft.seo.hasFaq,
    },
  };
}

/**
 * Scores a draft WITHOUT saving it. Public endpoint — no token required.
 * Pass an AbortSignal so the caller can cancel a stale in-flight request.
 */
export async function scorePreview(
  draft: ContentDraft,
  signal?: AbortSignal,
): Promise<ScoreResult> {
  const res = await request<{ status: boolean } & ScoreResult>(
    "/api/public/score/preview",
    { method: "POST", json: buildScorePayload(draft), signal },
  );
  return { score: res.score, checks: res.checks ?? [] };
}

/* ------------------------------------------------------------------ */
/* Technical SEO (sitemap / robots / llms)                             */
/* ------------------------------------------------------------------ */

export type SitemapUrl = { loc: string; lastmod: string };

/** The live sitemap payload — exactly the URLs a crawler would be given. */
export async function getSitemapData(): Promise<SitemapUrl[]> {
  const res = await request<{ status: boolean; urls?: SitemapUrl[] }>(
    "/api/public/sitemap-data",
  );
  return res.urls ?? [];
}

/** Raw text of a connector-served plaintext file (robots.txt / llms.txt). */
async function requestText(path: string): Promise<string> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new ApiError(`Server returned ${res.status}`, res.status);
  return res.text();
}

/** The live robots.txt, as the crawler receives it. */
export function getRobotsTxt(): Promise<string> {
  return requestText("/api/public/robots");
}

/** The live llms.txt, as an AI crawler receives it. */
export function getLlmsTxt(): Promise<string> {
  return requestText("/api/public/llms");
}

/* ------------------------------------------------------------------ */
/* Redirects                                                           */
/* ------------------------------------------------------------------ */

export type Redirect = {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  hits: number;
  active: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RedirectInput = {
  fromPath: string;
  toPath: string;
  statusCode?: number;
  note?: string | null;
  active?: boolean;
};

export async function listRedirects(): Promise<Redirect[]> {
  const res = await request<{ status: boolean; redirects: Redirect[] }>("/api/redirects", {
    auth: true,
  });
  return res.redirects ?? [];
}

export async function createRedirect(input: RedirectInput): Promise<Redirect> {
  const res = await request<{ status: boolean; redirect: Redirect }>("/api/redirects", {
    method: "POST",
    auth: true,
    json: input,
  });
  return res.redirect;
}

export async function updateRedirect(
  id: string,
  input: Partial<RedirectInput>,
): Promise<Redirect> {
  const res = await request<{ status: boolean; redirect: Redirect }>(
    `/api/redirects/${id}`,
    { method: "PUT", auth: true, json: input },
  );
  return res.redirect;
}

export async function deleteRedirect(id: string): Promise<void> {
  await request(`/api/redirects/${id}`, { method: "DELETE", auth: true });
}

/* ------------------------------------------------------------------ */
/* Keywords & rankings                                                 */
/* ------------------------------------------------------------------ */

export type KeywordRole = "PRIMARY" | "SECONDARY";
export const KEYWORD_ENGINES = ["google", "aio", "bing", "yandex", "chatgpt", "perplexity"] as const;
export type KeywordEngine = (typeof KEYWORD_ENGINES)[number];
export const ENGINE_LABEL: Record<string, string> = {
  google: "Google",
  aio: "AI Overview",
  bing: "Bing",
  yandex: "Yandex",
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
};

export type KeywordTarget = {
  id: string;
  contentId: string;
  keyword: string;
  role: KeywordRole;
  volumeBand: string | null; // H | M | L
  currentRank: number | null;
  engine: string;
  updatedAt: string;
  content?: { title: string; slug: string; type: ContentType } | null;
  // rank-tracker fields (DataForSEO)
  country: string;
  device: string;
  searchVolume: number | null;
  lastCheckedAt: string | null;
  competitors: { url: string; isYou: boolean }[];
};

export type KeywordInput = {
  contentId: string;
  keyword: string;
  role?: KeywordRole;
  engine?: string;
  volumeBand?: string | null;
  currentRank?: number | null;
  country?: string;
  device?: string;
};

export type RankHistoryPoint = { checked_on: string; position: number | null };

/** All targets (rankings view) or just one page's when contentId is given. */
export async function listKeywords(contentId?: string): Promise<KeywordTarget[]> {
  const qs = contentId ? `?contentId=${encodeURIComponent(contentId)}` : "";
  const res = await request<{ status: boolean; keywords: KeywordTarget[] }>(
    `/api/keywords${qs}`,
    { auth: true },
  );
  return res.keywords ?? [];
}

export async function createKeyword(input: KeywordInput): Promise<KeywordTarget> {
  const res = await request<{ status: boolean; keyword: KeywordTarget }>("/api/keywords", {
    method: "POST",
    auth: true,
    json: input,
  });
  return res.keyword;
}

export async function updateKeyword(
  id: string,
  input: Partial<Omit<KeywordInput, "contentId">>,
): Promise<KeywordTarget> {
  const res = await request<{ status: boolean; keyword: KeywordTarget }>(`/api/keywords/${id}`, {
    method: "PUT",
    auth: true,
    json: input,
  });
  return res.keyword;
}

export async function deleteKeyword(id: string): Promise<void> {
  await request(`/api/keywords/${id}`, { method: "DELETE", auth: true });
}

/** Seed a page's targets from its SEO (focus → primary, secondary → secondary). */
export async function importKeywordsFromSeo(
  contentId: string,
): Promise<{ created: number; keywords: KeywordTarget[] }> {
  const res = await request<{ status: boolean; created: number; keywords: KeywordTarget[] }>(
    "/api/keywords/import",
    { method: "POST", auth: true, json: { contentId } },
  );
  return { created: res.created ?? 0, keywords: res.keywords ?? [] };
}

/** One paid SERP call — refresh this keyword's Google position + real competitors. */
export async function checkKeywordRank(
  id: string,
): Promise<{ position: number | null; competitors: { url: string; isYou: boolean }[] }> {
  const res = await request<{
    status: boolean;
    position: number | null;
    competitors: { url: string; isYou: boolean }[];
  }>(`/api/keywords/${id}/check`, { method: "POST", auth: true });
  return { position: res.position ?? null, competitors: res.competitors ?? [] };
}

export type CheckAllResult = {
  checked: number;
  updated: number;
  skipped: number;
  capped: boolean;
  cap: number;
  remaining: number;
};

/** Bulk position refresh (cost-capped, skips already-checked-today). */
export async function checkAllRanks(force = false): Promise<CheckAllResult> {
  const res = await request<{ status: boolean } & CheckAllResult>(
    `/api/keywords/check-all${force ? "?force=1" : ""}`,
    { method: "POST", auth: true },
  );
  return res;
}

/** Batched search-volume refresh (one call per country). */
export async function refreshKeywordVolume(): Promise<number> {
  const res = await request<{ status: boolean; updated: number }>("/api/keywords/refresh-volume", {
    method: "POST",
    auth: true,
  });
  return res.updated ?? 0;
}

/** Position history for the sparkline. */
export async function getKeywordHistory(id: string): Promise<RankHistoryPoint[]> {
  const res = await request<{ status: boolean; history: RankHistoryPoint[] }>(
    `/api/keywords/${id}/history`,
    { auth: true },
  );
  return res.history ?? [];
}

/* ------------------------------------------------------------------ */
/* Backlinks                                                           */
/* ------------------------------------------------------------------ */

export const BACKLINK_RELS = ["dofollow", "nofollow", "ugc", "sponsored"] as const;
export const BACKLINK_STATUSES = ["live", "lost", "pending"] as const;

export type Backlink = {
  id: string;
  sourceUrl: string;
  sourceDomain: string;
  targetPath: string;
  anchor: string;
  rel: string;
  status: string;
  authority: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BacklinkInput = {
  sourceUrl: string;
  targetPath?: string;
  anchor?: string;
  rel?: string;
  status?: string;
  authority?: number | null;
  note?: string | null;
};

export async function listBacklinks(filter?: {
  status?: string;
  domain?: string;
}): Promise<Backlink[]> {
  const qs = new URLSearchParams();
  if (filter?.status) qs.set("status", filter.status);
  if (filter?.domain) qs.set("domain", filter.domain);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await request<{ status: boolean; backlinks: Backlink[] }>(
    `/api/backlinks${suffix}`,
    { auth: true },
  );
  return res.backlinks ?? [];
}

export async function createBacklink(input: BacklinkInput): Promise<Backlink> {
  const res = await request<{ status: boolean; backlink: Backlink }>("/api/backlinks", {
    method: "POST",
    auth: true,
    json: input,
  });
  return res.backlink;
}

export async function updateBacklink(
  id: string,
  input: Partial<BacklinkInput>,
): Promise<Backlink> {
  const res = await request<{ status: boolean; backlink: Backlink }>(`/api/backlinks/${id}`, {
    method: "PUT",
    auth: true,
    json: input,
  });
  return res.backlink;
}

export async function deleteBacklink(id: string): Promise<void> {
  await request(`/api/backlinks/${id}`, { method: "DELETE", auth: true });
}

/* ------------------------------------------------------------------ */
/* AI-Overview tracking                                                */
/* ------------------------------------------------------------------ */

export const AI_ENGINES = ["aio", "chatgpt", "perplexity"] as const;
export const AI_ENGINE_LABEL: Record<string, string> = {
  aio: "AI Overview",
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
};
export const AI_PRESENCE = ["cited", "mentioned", "absent"] as const;

export type AiMention = {
  id: string;
  contentId: string | null;
  query: string;
  engine: string;
  presence: string; // cited | mentioned | absent
  position: number | null;
  citedUrl: string;
  note: string | null;
  checkedAt: string | null;
  createdAt: string;
  updatedAt: string;
  content?: { title: string; slug: string; type: ContentType } | null;
};

export type AiMentionInput = {
  contentId?: string | null;
  query: string;
  engine?: string;
  presence?: string;
  position?: number | null;
  citedUrl?: string;
  note?: string | null;
};

export async function listAiMentions(filter?: {
  contentId?: string;
  engine?: string;
  presence?: string;
}): Promise<AiMention[]> {
  const qs = new URLSearchParams();
  if (filter?.contentId) qs.set("contentId", filter.contentId);
  if (filter?.engine) qs.set("engine", filter.engine);
  if (filter?.presence) qs.set("presence", filter.presence);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await request<{ status: boolean; mentions: AiMention[] }>(
    `/api/ai-mentions${suffix}`,
    { auth: true },
  );
  return res.mentions ?? [];
}

export async function createAiMention(input: AiMentionInput): Promise<AiMention> {
  const res = await request<{ status: boolean; mention: AiMention }>("/api/ai-mentions", {
    method: "POST",
    auth: true,
    json: input,
  });
  return res.mention;
}

export async function updateAiMention(
  id: string,
  input: Partial<AiMentionInput>,
): Promise<AiMention> {
  const res = await request<{ status: boolean; mention: AiMention }>(`/api/ai-mentions/${id}`, {
    method: "PUT",
    auth: true,
    json: input,
  });
  return res.mention;
}

export async function deleteAiMention(id: string): Promise<void> {
  await request(`/api/ai-mentions/${id}`, { method: "DELETE", auth: true });
}

/** Seed a page's AI queries from its SEO aiQueries field (on AI Overview). */
export async function importAiMentionsFromSeo(
  contentId: string,
): Promise<{ created: number; mentions: AiMention[] }> {
  const res = await request<{ status: boolean; created: number; mentions: AiMention[] }>(
    "/api/ai-mentions/import",
    { method: "POST", auth: true, json: { contentId } },
  );
  return { created: res.created ?? 0, mentions: res.mentions ?? [] };
}

/* ------------------------------------------------------------------ */
/* Settings & API keys (DataForSEO)                                    */
/* ------------------------------------------------------------------ */

export type AppSettings = {
  dataforseoUsername: string;
  dataforseoConfigured: boolean;
  siteDomain: string;
  defaultCountry: string;
  defaultDevice: string;
  competitorCount: string;
  general: Record<string, string>;
};

export type SettingsInput = {
  dataforseoUsername?: string;
  dataforseoPassword?: string; // blank = keep existing
  siteDomain?: string;
  defaultCountry?: string;
  defaultDevice?: string;
  competitorCount?: string;
  general?: Record<string, string>;
};

export async function getSettings(): Promise<AppSettings> {
  const res = await request<{ status: boolean; settings: AppSettings }>("/api/settings", {
    auth: true,
  });
  return res.settings;
}

export async function updateSettings(input: SettingsInput): Promise<void> {
  await request("/api/settings", { method: "PUT", auth: true, json: input });
}

export async function testDataforseo(): Promise<{ ok: boolean; message: string }> {
  const res = await request<{ status: boolean; ok: boolean; message: string }>(
    "/api/settings/dataforseo/test",
    { method: "POST", auth: true },
  );
  return { ok: res.ok, message: res.message };
}

/** Countries we map to DataForSEO location codes (mirrors the backend map). */
export const DFS_COUNTRIES: { code: string; label: string }[] = [
  { code: "in", label: "India" },
  { code: "us", label: "United States" },
  { code: "gb", label: "United Kingdom" },
  { code: "ae", label: "UAE" },
  { code: "au", label: "Australia" },
  { code: "ca", label: "Canada" },
  { code: "sg", label: "Singapore" },
  { code: "de", label: "Germany" },
  { code: "fr", label: "France" },
  { code: "es", label: "Spain" },
  { code: "it", label: "Italy" },
  { code: "jp", label: "Japan" },
  { code: "br", label: "Brazil" },
  { code: "sa", label: "Saudi Arabia" },
  { code: "za", label: "South Africa" },
  { code: "pk", label: "Pakistan" },
  { code: "bd", label: "Bangladesh" },
  { code: "ng", label: "Nigeria" },
];

/* ------------------------------------------------------------------ */
/* DataForSEO — domain overview + competitor backlinks (Batch B)       */
/* ------------------------------------------------------------------ */

export type DomainOverview = {
  domain: string;
  cc: string;
  pos1: number;
  pos2_3: number;
  pos4_10: number;
  top10: number;
  totalKw: number;
  etv: number;
  backlinks: number;
  refDomains: number;
  blRank: number;
  competitors: { domain: string; common: number; top10: number; total: number }[];
  notes: string[];
};

export async function getDomainOverview(
  domain: string,
  country: string,
  count = 5,
): Promise<DomainOverview> {
  const res = await request<{ status: boolean; overview: DomainOverview }>(
    "/api/dataforseo/domain-overview",
    { method: "POST", auth: true, json: { domain, country, count } },
  );
  return res.overview;
}

export type ReplicableBacklink = {
  platform: string;
  category: string;
  method: string;
  country: string;
  competitors: number;
  da: number;
  known: boolean;
};

export type CompetitorBacklinkInput = {
  client: string;
  competitors: string[];
  limit?: number;
  minShared?: number;
  country?: string;
  showAll?: boolean;
};

export async function getCompetitorBacklinks(
  input: CompetitorBacklinkInput,
): Promise<{ rows: ReplicableBacklink[]; scanned: number }> {
  const res = await request<{ status: boolean; rows: ReplicableBacklink[]; scanned: number }>(
    "/api/dataforseo/competitor-backlinks",
    { method: "POST", auth: true, json: input },
  );
  return { rows: res.rows ?? [], scanned: res.scanned ?? 0 };
}

/* ------------------------------------------------------------------ */
/* Content read                                                        */
/* ------------------------------------------------------------------ */

/**
 * The stored score + full check breakdown for a saved item, from
 * GET /api/public/score/:slug. This is the score as it was at the last save —
 * the Analyzer shows it instantly, then offers a live Re-run.
 */
export async function getStoredScore(slug: string): Promise<ScoreResult> {
  const res = await request<{ status: boolean } & Partial<ScoreResult>>(
    `/api/public/score/${encodeURIComponent(slug)}`,
  );
  return { score: res.score ?? 0, checks: res.checks ?? [] };
}

export type ListContentResponse = {
  status: boolean;
  items: ContentListItem[];
  total: number;
  page: number;
};

/**
 * Lists content, optionally filtered by type.
 *
 * NOTE: the backend mounts this route without auth middleware, so `req.admin`
 * is never set and only PUBLISHED items come back — DRAFT/HIDDEN are filtered
 * out regardless of the token. We send the token anyway so this starts working
 * the moment the backend adds optional auth to GET /api/content.
 */
export async function listContent(
  params: { type?: ContentType; page?: number; limit?: number } = {},
): Promise<ListContentResponse> {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));

  const suffix = qs.toString() ? `?${qs}` : "";
  return request<ListContentResponse>(`/api/content${suffix}`, { auth: true });
}

/**
 * Dashboard metrics. Sends the token so an admin sees the full library
 * (drafts + hidden counted); without it the backend counts published only.
 */
export async function getStats(): Promise<DashboardStats> {
  const res = await request<{ status: boolean; stats: DashboardStats }>("/api/content/stats", {
    auth: true,
  });
  return res.stats;
}

/** Fetches one item by slug, for loading it into the editor. */
export async function getContent(slug: string): Promise<ContentDetail> {
  const res = await request<{ status: boolean; content: ContentDetail }>(
    `/api/content/${encodeURIComponent(slug)}`,
    { auth: true },
  );
  return res.content;
}

/* ------------------------------------------------------------------ */
/* Content write                                                       */
/* ------------------------------------------------------------------ */

export type SaveResponse = {
  status: boolean;
  message?: string;
  id?: string;
  score?: number;
};

/**
 * Builds the multipart body. `seo` and `faqs` go in as JSON strings — the Zod
 * schema JSON.parses them back (form data can only carry strings).
 */
function toFormData(draft: ContentDraft, image: File | null, status: string): FormData {
  const fd = new FormData();
  fd.set("type", draft.type);
  fd.set("title", draft.title);
  fd.set("slug", draft.slug);
  fd.set("shortDesc", draft.shortDesc);
  fd.set("content", draft.content);
  fd.set("category", draft.category);
  fd.set("tags", draft.tags);
  fd.set("status", status);
  fd.set("faqs", JSON.stringify(draft.faqs));
  fd.set("seo", JSON.stringify(draft.seo));
  if (image) fd.set("image", image);
  return fd;
}

/**
 * POST /api/content/create. The backend rejects this with 400 unless a real
 * file is attached, so `image` is required here even though the editor UI
 * treats the featured image as optional (it substitutes a placeholder).
 */
export async function createContent(
  draft: ContentDraft,
  image: File,
  status: "draft" | "published" = "draft",
): Promise<SaveResponse> {
  return request<SaveResponse>("/api/content/create", {
    method: "POST",
    form: toFormData(draft, image, status),
    auth: true,
  });
}

/**
 * PUT /api/content/update. `id` is the slug of the item being updated, and the
 * image is optional — omitting it leaves the existing one in place.
 */
export async function updateContent(
  slug: string,
  draft: ContentDraft,
  image: File | null = null,
  status: "draft" | "published" = "draft",
): Promise<SaveResponse> {
  const form = toFormData(draft, image, status);
  form.set("id", slug);
  return request<SaveResponse>("/api/content/update", {
    method: "PUT",
    form,
    auth: true,
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Lowercase, punctuation stripped, spaces -> hyphens. Feeds the slug checks. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** An empty draft, so the editor and the scorer agree on the starting shape. */
export function emptyDraft(type: ContentType = "POST"): ContentDraft {
  return {
    type,
    title: "",
    slug: "",
    shortDesc: "",
    content: "",
    category: "General",
    tags: "celitix",
    faqs: [],
    seo: {
      title: "",
      description: "",
      keywords: "",
      focusKeyword: "",
      secondaryKeywords: [],
      aiQueries: "",
      tldr: "",
      hasFaq: false,
    },
    media: [],
  };
}

/* ------------------------------------------------------------------ */
/* Keyword Intelligence (page-driven, spec-accurate)                    */
/* ------------------------------------------------------------------ */

export type KwintelRow = {
  keyword: string;
  role: "primary" | "secondary";
  volume: number | null;
  position: number | null;
  posDesktop: number | null;
  posMobile: number | null;
  competitors: { url: string; isYou: boolean }[];
  locations: Record<string, { desktop?: number | null; mobile?: number | null }>;
  serpChecked: string | null;
  volChecked: string | null;
};

export type KwintelGroup = {
  postId: string;
  title: string;
  url: string;
  slug: string;
  type: ContentType | "SEO";
  rows: KwintelRow[];
};

export async function getKwintelGroups(
  scope: "both" | "focus" | "secondary" = "both",
): Promise<{ groups: KwintelGroup[]; keywords: string[] }> {
  const res = await request<{ status: boolean; groups: KwintelGroup[]; keywords: string[] }>(
    `/api/kwintel/groups?scope=${scope}`,
    { auth: true },
  );
  return { groups: res.groups ?? [], keywords: res.keywords ?? [] };
}

export type KwintelBatchInput = {
  mode: "volume" | "serp";
  keywords: string[];
  country: string;
  device: string;
  compCount?: number;
  skipHours?: number;
  locations?: string[];
  stopTop?: number;
};

export type KwintelBatchResult = {
  processed: number;
  skipped: number;
  errors: number;
  errorMessage?: string;
};

export async function runKwintelBatch(input: KwintelBatchInput): Promise<KwintelBatchResult> {
  return request<{ status: boolean } & KwintelBatchResult>("/api/kwintel/batch", {
    method: "POST",
    auth: true,
    json: input,
  });
}

export type BacklinkRow = {
  urlFrom: string;
  domainFrom: string;
  urlTo: string;
  anchor: string;
  dofollow: boolean;
  rank: number;
  firstSeen: string | null;
};

export async function getCities(q: string, country: string): Promise<{ code: number; name: string }[]> {
  const res = await request<{ status: boolean; cities: { code: number; name: string }[] }>(
    `/api/kwintel/cities?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}`,
    { auth: true },
  );
  return res.cities ?? [];
}

export async function getBacklinks(target: string, limit = 50): Promise<BacklinkRow[]> {
  const res = await request<{ status: boolean; backlinks: BacklinkRow[] }>(
    "/api/dataforseo/backlinks",
    { method: "POST", auth: true, json: { target, limit } },
  );
  return res.backlinks ?? [];
}

/* ------------------------------------------------------------------ */
/* AI Visibility — LLM Mentions (Batch C)                               */
/* ------------------------------------------------------------------ */

export type AiPlatform = {
  platform: string;
  label: string;
  cited: boolean | null;
  mentions: number;
  note?: string;
};
export type AiVisibility = {
  keyword: string;
  host: string;
  platforms: AiPlatform[];
  competitors: string[];
  longtail: string[];
  recommendations: string[];
};

export async function getAiVisibility(keyword: string, country: string): Promise<AiVisibility> {
  const res = await request<{ status: boolean; visibility: AiVisibility }>(
    "/api/dataforseo/ai-visibility",
    { method: "POST", auth: true, json: { keyword, country } },
  );
  return res.visibility;
}

export async function checkAiMention(id: string): Promise<{
  presence: string;
  competitors: string[];
  longtail: string[];
  recommendations: string[];
}> {
  const res = await request<{
    status: boolean;
    presence: string;
    competitors: string[];
    longtail: string[];
    recommendations: string[];
  }>(`/api/ai-mentions/${id}/check`, { method: "POST", auth: true });
  return {
    presence: res.presence,
    competitors: res.competitors ?? [],
    longtail: res.longtail ?? [],
    recommendations: res.recommendations ?? [],
  };
}

export async function checkAllAiMentions(): Promise<{
  checked: number;
  skipped: number;
  capped: boolean;
  cap: number;
}> {
  return request<{ status: boolean; checked: number; skipped: number; capped: boolean; cap: number }>(
    "/api/ai-mentions/check-all",
    { method: "POST", auth: true },
  );
}

/* ------------------------------------------------------------------ */
/* Bulk operations (Step 5)                                            */
/* ------------------------------------------------------------------ */

export type BulkSeoResult = {
  updated: number;
  notFound: string[];
  errors: { slug: string; error: string }[];
};
export async function bulkSeo(rows: Record<string, string>[]): Promise<BulkSeoResult> {
  const res = await request<{ status: boolean } & BulkSeoResult>("/api/bulk/seo", {
    method: "POST",
    auth: true,
    json: { rows },
  });
  return { updated: res.updated ?? 0, notFound: res.notFound ?? [], errors: res.errors ?? [] };
}

export type BulkCreateResult = {
  created: number;
  skipped: string[];
  errors: { slug: string; error: string }[];
};
export async function bulkCreate(rows: Record<string, string>[]): Promise<BulkCreateResult> {
  const res = await request<{ status: boolean } & BulkCreateResult>("/api/bulk/create", {
    method: "POST",
    auth: true,
    json: { rows },
  });
  return { created: res.created ?? 0, skipped: res.skipped ?? [], errors: res.errors ?? [] };
}

export async function uploadMediaFile(
  file: File,
  meta: { alt?: string; title?: string; caption?: string; description?: string },
): Promise<{ id: string; url: string; filename: string }> {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("alt", meta.alt ?? "");
  fd.append("title", meta.title ?? "");
  fd.append("caption", meta.caption ?? "");
  fd.append("description", meta.description ?? "");
  const res = await request<{ status: boolean; media: { id: string; url: string; filename: string } }>(
    "/api/media/upload",
    { method: "POST", auth: true, form: fd },
  );
  return res.media;
}

// ---------------------------------------------------------------------------
// [PHASE 2] Page content-map (existing pages made editable).
// ---------------------------------------------------------------------------
export type PageContentResponse = {
  status: boolean;
  fields: Record<string, any>;
  blocksHtml: string;
};

export async function getPageContent(slug: string): Promise<PageContentResponse> {
  return request<PageContentResponse>(`/api/public/page-content/${slug}`);
}

export async function savePageContent(
  slug: string,
  pageMap: Record<string, any>,
  blocksHtml?: string,
): Promise<{ status: boolean; message?: string }> {
  return request(`/api/content/page-content`, {
    method: "PUT",
    auth: true,
    json: { slug, pageMap, ...(blocksHtml !== undefined ? { blocksHtml } : {}) },
  });
}

export type ExportManifest = {
  sections: { name: string; headings: number; paragraphs: number; lists: number; listItems: number; images: number; fields: string[] }[];
  totals: { sections: number; headings: number; paragraphs: number; images: number; faqs: number; appendedBlocks: number; internalLinks: number; externalLinks: number };
};
export async function exportPage(slug: string): Promise<{ status: boolean; page: any; manifest?: ExportManifest }> {
  return request(`/api/content/export/${slug}`, { auth: true });
}

export async function importPage(page: any): Promise<{ status: boolean; message?: string }> {
  return request(`/api/content/import`, { method: "POST", auth: true, json: { page } });
}

export type PageScoreCheck = { id: string; label: string; ok: boolean; detail: string };
export type PageScoreResult = { status: boolean; type: string; score: number; passed: number; total: number; checks: PageScoreCheck[] };

export async function scoreContent(page: any): Promise<PageScoreResult> {
  return request(`/api/content/score`, { method: "POST", json: { page } });
}

// [PHASE 2] Categories (taxonomy)
export type Category = { id: string; name: string; slug: string; type: string; description?: string | null };

export async function listCategories(type?: string): Promise<{ status: boolean; categories: Category[] }> {
  return request(`/api/categories${type ? `?type=${type}` : ""}`);
}
export async function createCategory(name: string, type: string, description?: string): Promise<{ status: boolean; category: Category }> {
  return request(`/api/categories`, { method: "POST", auth: true, json: { name, type, description } });
}
export async function updateCategory(id: string, data: Partial<Category>): Promise<{ status: boolean; category: Category }> {
  return request(`/api/categories/${id}`, { method: "PUT", auth: true, json: data });
}
export async function deleteCategory(id: string): Promise<{ status: boolean }> {
  return request(`/api/categories/${id}`, { method: "DELETE", auth: true });
}
