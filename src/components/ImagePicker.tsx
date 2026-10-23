import { useCallback, useEffect, useState } from "react";
import {
  listMedia,
  mediaSrc,
  metaFilledCount,
  uploadMedia,
  type MediaItem,
} from "../lib/mediaApi";

type ImagePickerProps = {
  open: boolean;
  onClose: () => void;
  /** Fired when the user confirms their selection. */
  onSelect: (images: MediaItem[]) => void;
  /** Single pick (featured image) or multi (body images). Default: single. */
  multiple?: boolean;
  title?: string;
};

/**
 * Modal image picker, backed by the Image Library.
 *
 * Selected images arrive with all four metadata fields attached, which is what
 * lets the editor push them into the draft's `media` array — the array the
 * Gold Mine scorer reads for its image checks. Picking an image with an
 * incomplete 4/4 badge will keep those checks amber or red, so the badge is
 * shown here too.
 */
export default function ImagePicker({
  open,
  onClose,
  onSelect,
  multiple = false,
  title = "Choose an image",
}: ImagePickerProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, MediaItem>>({});

  // Direct upload (all four metadata fields required — Gold Mine strict).
  const [mode, setMode] = useState<"library" | "upload">("library");
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({ alt: "", title: "", caption: "", description: "" });
  const [uploading, setUploading] = useState(false);
  const metaComplete =
    meta.alt.trim() !== "" &&
    meta.title.trim() !== "" &&
    meta.caption.trim() !== "" &&
    meta.description.trim() !== "";

  async function doUpload() {
    if (!file || !metaComplete) return;
    setUploading(true);
    setError(null);
    try {
      const { media } = await uploadMedia(file, meta);
      // add to the grid + select it, then drop back to the library view
      setItems((prev) => [media, ...prev]);
      setSelected((prev) => (multiple ? { ...prev, [media.id]: media } : { [media.id]: media }));
      setFile(null);
      setMeta({ alt: "", title: "", caption: "", description: "" });
      setMode("library");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMedia({ q, limit: 100 });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load images.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected({});
    setMode("library");
    const t = setTimeout(() => void load(query), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [open, query, load]);

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggle(item: MediaItem) {
    setSelected((prev) => {
      if (!multiple) return prev[item.id] ? {} : { [item.id]: item };
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  }

  const chosen = Object.values(selected);

  function confirm() {
    if (chosen.length === 0) return;
    onSelect(chosen);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold">{title}</h3>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
              <button
                type="button"
                onClick={() => setMode("library")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  mode === "library" ? "bg-brand text-white" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Library
              </button>
              <button
                type="button"
                onClick={() => setMode("upload")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  mode === "upload" ? "bg-brand text-white" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Upload new
              </button>
            </div>
          </div>
          {mode === "library" && (
            <input
              className="w-56 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {mode === "upload" ? (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-8 hover:border-brand transition">
                {file ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    className="max-h-44 rounded-lg object-contain"
                  />
                ) : (
                  <span className="text-sm text-gray-500">Click to choose an image from your computer</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file && <p className="text-center text-xs text-gray-400">{file.name}</p>}
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["alt", "Alt text *"],
                    ["title", "Title *"],
                    ["caption", "Caption *"],
                    ["description", "Description *"],
                  ] as const
                ).map(([k, ph]) => (
                  <input
                    key={k}
                    className={`rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 ${
                      meta[k].trim() === "" ? "border-amber-300" : "border-gray-300"
                    }`}
                    placeholder={ph}
                    value={meta[k]}
                    onChange={(e) => setMeta((m) => ({ ...m, [k]: e.target.value }))}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400">
                All four fields are required — they're exactly what the Gold Mine scorer checks. The
                image is saved to the Library and inserted here.
              </p>
            </div>
          ) : loading ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              No images yet. Upload some in the Image Library first.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((item) => {
                const isOn = Boolean(selected[item.id]);
                const filled = metaFilledCount(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item)}
                    className={`group relative overflow-hidden rounded-lg border-2 text-left transition ${
                      isOn
                        ? "border-brand ring-1 ring-brand"
                        : "border-gray-200 hover:border-brand-light"
                    }`}
                  >
                    <div className="aspect-video bg-gray-100">
                      <img
                        src={mediaSrc(item.url)}
                        alt={item.alt || item.originalName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <span
                      className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        filled === 4
                          ? "bg-green-100 text-green-800"
                          : filled >= 2
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {filled}/4
                    </span>
                    {isOn && (
                      <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
                        ✓
                      </span>
                    )}
                    <p className="truncate px-2 py-1.5 text-xs" title={item.originalName}>
                      {item.alt || item.originalName}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-3">
          <p className="text-xs text-gray-500">
            {mode === "upload"
              ? metaComplete
                ? "Ready — all 4/4 metadata filled."
                : "Fill all four fields to upload (4/4 scores best)."
              : multiple
                ? `${chosen.length} selected — images with 4/4 score best.`
                : "Images with a 4/4 badge score best."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            {mode === "upload" ? (
              <button
                type="button"
                disabled={!file || !metaComplete || uploading}
                onClick={() => void doUpload()}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Upload & insert"}
              </button>
            ) : (
              <button
                type="button"
                disabled={chosen.length === 0}
                onClick={confirm}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {multiple ? `Insert ${chosen.length || ""}`.trim() : "Choose"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
