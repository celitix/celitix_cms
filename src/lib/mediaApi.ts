import { getToken } from "./auth";

/**
 * Image Library API client.
 *
 * Self-contained on purpose — it doesn't touch api.ts, so dropping this file in
 * can't break the editor or content list.
 */

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/** An image as stored in the library. All four metadata fields are always present. */
export type MediaItem = {
  id: string;
  filename: string;
  originalName: string;
  /** Server-relative, e.g. /api/uploads/123.jpg — use mediaSrc() to render it. */
  url: string;
  mimeType: string;
  size: number;
  alt: string;
  title: string;
  caption: string;
  description: string;
  width?: number | null;
  height?: number | null;
  createdAt: string;
  updatedAt: string;
};

/** The four fields the Gold Mine scorer reads. */
export type MediaMeta = Pick<MediaItem, "alt" | "title" | "caption" | "description">;

export class MediaApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Turns the stored server-relative url into a full src for <img>. */
export function mediaSrc(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url}`;
}

/** Human-readable file size for the library UI. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** How many of the four metadata fields are filled — drives the badge in the UI. */
export function metaFilledCount(m: MediaMeta): number {
  return [m.alt, m.title, m.caption, m.description].filter(
    (v) => (v ?? "").trim().length > 0,
  ).length;
}

async function parse<T>(res: Response): Promise<T> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new MediaApiError(`Server returned ${res.status}`, res.status);
  }
  if (!res.ok) {
    const message =
      (body as { message?: string })?.message ?? `Server returned ${res.status}`;
    throw new MediaApiError(message, res.status);
  }
  return body as T;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ------------------------------------------------------------------ */

export async function listMedia(
  opts: { q?: string; page?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<{ items: MediaItem[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  params.set("page", String(opts.page ?? 1));
  params.set("limit", String(opts.limit ?? 60));

  const res = await fetch(`${API_URL}/api/media?${params.toString()}`, {
    signal: opts.signal,
  });
  return parse(res);
}

export async function uploadMedia(
  file: File,
  meta: Partial<MediaMeta> = {},
): Promise<{ media: MediaItem }> {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("alt", meta.alt ?? "");
  fd.append("title", meta.title ?? "");
  fd.append("caption", meta.caption ?? "");
  fd.append("description", meta.description ?? "");

  // No Content-Type header — the browser must set the multipart boundary.
  const res = await fetch(`${API_URL}/api/media/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  });
  return parse(res);
}

export async function updateMediaMeta(
  id: string,
  meta: MediaMeta,
): Promise<{ media: MediaItem }> {
  const res = await fetch(`${API_URL}/api/media/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(meta),
  });
  return parse(res);
}

export async function deleteMedia(id: string): Promise<{ status: boolean }> {
  const res = await fetch(`${API_URL}/api/media/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return parse(res);
}
