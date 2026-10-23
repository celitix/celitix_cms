import { useCallback, useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import {
  deleteMedia,
  formatSize,
  listMedia,
  mediaSrc,
  metaFilledCount,
  updateMediaMeta,
  uploadMedia,
  type MediaItem,
  type MediaMeta,
} from "../lib/mediaApi";

const EMPTY_META: MediaMeta = { alt: "", title: "", caption: "", description: "" };

/**
 * Image Library.
 *
 * Every image carries four metadata fields — alt, title, caption, description.
 * The Gold Mine engine scores all four (`img_4field`, `sec_images`), so an image
 * with only an alt tag is a half-finished image. The badge on each tile shows
 * how many of the four are filled, which is why images look "incomplete" until
 * they genuinely are complete.
 */
export default function ImageLibrary() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  // Upload form
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadMeta, setUploadMeta] = useState<MediaMeta>(EMPTY_META);
  const [uploading, setUploading] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMeta, setEditMeta] = useState<MediaMeta>(EMPTY_META);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMedia({ q, limit: 100 });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not reach the server. Make sure the backend is running on port 3000.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(query), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [query, load]);

  function flash(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(null), 3000);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadMedia(file, uploadMeta);
      setFile(null);
      setUploadMeta(EMPTY_META);
      if (fileRef.current) fileRef.current.value = "";
      await load(query);
      flash("Image uploaded.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function startEdit(item: MediaItem) {
    setEditingId(item.id);
    setEditMeta({
      alt: item.alt ?? "",
      title: item.title ?? "",
      caption: item.caption ?? "",
      description: item.description ?? "",
    });
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError(null);
    try {
      const { media } = await updateMediaMeta(id, editMeta);
      setItems((prev) => prev.map((i) => (i.id === id ? media : i)));
      setEditingId(null);
      flash("Image details saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: MediaItem) {
    if (!confirm(`Delete "${item.originalName}"? This cannot be undone.`)) return;
    try {
      await deleteMedia(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setTotal((t) => Math.max(0, t - 1));
      flash("Image deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
    }
  }

  const field =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

  return (
    <Layout title="Image Library">
      <div className="p-6 space-y-6">
        {notice && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ---------------- Upload ---------------- */}
        <section className="rounded-xl bg-white border border-gray-200 p-5">
          <h2 className="text-base font-semibold mb-1">Upload an image</h2>
          <p className="text-sm text-gray-500 mb-4">
            Fill all four fields — the SEO score reads every one of them. You can
            also fill them in later from the grid below.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand-50"
              />
              {file && (
                <p className="text-xs text-gray-500">
                  {file.name} — {formatSize(file.size)}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Alt text</label>
                <input
                  className={field}
                  placeholder="Describe the image, include the focus keyword"
                  value={uploadMeta.alt}
                  onChange={(e) => setUploadMeta({ ...uploadMeta, alt: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  className={field}
                  value={uploadMeta.title}
                  onChange={(e) =>
                    setUploadMeta({ ...uploadMeta, title: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Caption</label>
                <input
                  className={field}
                  value={uploadMeta.caption}
                  onChange={(e) =>
                    setUploadMeta({ ...uploadMeta, caption: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  className={`${field} min-h-[76px]`}
                  value={uploadMeta.description}
                  onChange={(e) =>
                    setUploadMeta({ ...uploadMeta, description: e.target.value })
                  }
                />
              </div>
              <button
                type="button"
                disabled={!file || uploading}
                onClick={handleUpload}
                className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Upload image"}
              </button>
            </div>
          </div>
        </section>

        {/* ---------------- Library ---------------- */}
        <section className="rounded-xl bg-white border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <h2 className="text-base font-semibold">
              Library{" "}
              <span className="ml-1 text-sm font-normal text-gray-500">
                {total} image{total === 1 ? "" : "s"}
              </span>
            </h2>
            <input
              className={`${field} max-w-xs`}
              placeholder="Search images…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <p className="p-10 text-center text-sm text-gray-500">Loading images…</p>
          ) : items.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-500">
              {query
                ? "No images match that search."
                : "No images yet — upload your first one above."}
            </p>
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => {
                const filled = metaFilledCount(item);
                const editing = editingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200 overflow-hidden flex flex-col"
                  >
                    <div className="relative aspect-video bg-gray-100">
                      <img
                        src={mediaSrc(item.url)}
                        alt={item.alt || item.originalName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <span
                        title="How many of the four SEO fields are filled"
                        className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          filled === 4
                            ? "bg-green-100 text-green-800"
                            : filled >= 2
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {filled}/4
                      </span>
                    </div>

                    <div className="flex-1 p-3 space-y-2">
                      <p
                        className="truncate text-sm font-medium"
                        title={item.originalName}
                      >
                        {item.originalName}
                      </p>
                      <p className="text-xs text-gray-500">{formatSize(item.size)}</p>

                      {editing ? (
                        <div className="space-y-2 pt-1">
                          {(
                            [
                              ["alt", "Alt text"],
                              ["title", "Title"],
                              ["caption", "Caption"],
                              ["description", "Description"],
                            ] as const
                          ).map(([key, label]) => (
                            <input
                              key={key}
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-brand"
                              placeholder={label}
                              value={editMeta[key]}
                              onChange={(e) =>
                                setEditMeta({ ...editMeta, [key]: e.target.value })
                              }
                            />
                          ))}
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => saveEdit(item.id)}
                              className="flex-1 rounded-md bg-brand px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 text-xs text-gray-600">
                          <p className="truncate">
                            <span className="text-gray-400">Alt:</span>{" "}
                            {item.alt || <em className="text-red-500">missing</em>}
                          </p>
                          <p className="truncate">
                            <span className="text-gray-400">Title:</span>{" "}
                            {item.title || <em className="text-red-500">missing</em>}
                          </p>
                          <p className="truncate">
                            <span className="text-gray-400">Caption:</span>{" "}
                            {item.caption || <em className="text-red-500">missing</em>}
                          </p>
                          <p className="truncate">
                            <span className="text-gray-400">Desc:</span>{" "}
                            {item.description || (
                              <em className="text-red-500">missing</em>
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    {!editing && (
                      <div className="flex gap-2 border-t border-gray-200 p-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="flex-1 rounded-md px-2 py-1.5 text-xs font-medium text-brand hover:bg-brand-50"
                        >
                          Edit details
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="rounded-md px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
