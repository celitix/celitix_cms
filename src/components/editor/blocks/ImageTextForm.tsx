import { useState } from "react";
import RichTextEditor from "../RichTextEditor";
import ImagePicker from "../../ImagePicker";
import { mediaSrc, metaFilledCount, type MediaItem } from "../../../lib/mediaApi";
import {
  type HeadingLevel,
  type ImageTextBlock,
} from "../../../lib/blocks";

function paragraphsToHtml(paras: string[]): string {
  const items = paras.map((p) => p.trim()).filter(Boolean);
  return items.length ? items.map((p) => `<p>${p}</p>`).join("") : "";
}
function paragraphsFromHtml(html: string): string[] {
  if (typeof window === "undefined") return [""];
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const ps = Array.from(doc.querySelectorAll("p"))
    .map((p) => (p.textContent ?? "").trim())
    .filter(Boolean);
  if (ps.length) return ps;
  const text = (doc.body.textContent ?? "").trim();
  return text ? [text] : [""];
}


const labelClass = "block text-sm font-medium text-gray-700";
const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

type Props = {
  block: ImageTextBlock;
  focusKeyword: string;
  onChange: (patch: Partial<ImageTextBlock>) => void;
};

/**
 * Blocks 3 and 4 — Image Left + Text and Text + Image Right.
 *
 * The image is chosen from the Library rather than uploaded here, and its four
 * metadata fields are read-only in this form on purpose: they belong to the
 * asset, not to this one block. Editing them here would fix the score on this
 * page and leave every other page using the same image untagged. The form links
 * to the Library instead, so the fix lands once and helps everywhere.
 */
export default function ImageTextForm({ block, focusKeyword, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const paragraphs = block.paragraphs.length > 0 ? block.paragraphs : [""];

  function applyPicked(images: MediaItem[]) {
    const image = images[0];
    setPickerOpen(false);
    if (!image) return;
    onChange({
      mediaId: image.id,
      url: image.url,
      alt: image.alt,
      title: image.title,
      caption: image.caption,
      description: image.description,
      width: image.width ?? null,
      height: image.height ?? null,
    });
  }


  const filled = metaFilledCount(block);
  const kw = focusKeyword.trim();

  return (
    <div className="space-y-4">
      {/* ---------- layout ---------- */}
      <div>
        <span className={labelClass}>Layout</span>
        <div className="mt-1 flex gap-2">
          {(["left", "right"] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => onChange({ side })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                block.side === side
                  ? "border-brand bg-brand-50 text-brand"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {side === "left" ? "Image left, text right" : "Text left, image right"}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          The HTML is written in the same order it appears, so screen readers and
          crawlers read it the way it looks.
        </p>
      </div>

      {/* ---------- the image ---------- */}
      <div>
        <span className={labelClass}>Image</span>
        {block.url ? (
          <div className="mt-1 flex gap-3 rounded-xl border border-gray-200 p-3">
            <img
              src={mediaSrc(block.url)}
              alt={block.alt}
              className="h-24 w-32 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
                    filled === 4
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-amber-50 text-amber-700 ring-amber-200"
                  }`}
                >
                  {filled}/4 metadata fields
                </span>
                {block.width && block.height && (
                  <span className="text-[11px] text-gray-500">
                    {block.width}x{block.height}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-gray-700">
                <span className="text-gray-500">alt:</span> {block.alt || "(empty)"}
              </p>
              <p className="truncate text-xs text-gray-700">
                <span className="text-gray-500">title:</span> {block.title || "(empty)"}
              </p>
              <p className="truncate text-xs text-gray-700">
                <span className="text-gray-500">caption:</span>{" "}
                {block.caption || "(empty)"}
              </p>
              <p className="truncate text-xs text-gray-700">
                <span className="text-gray-500">description:</span>{" "}
                {block.description || "(empty)"}
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      mediaId: null,
                      url: "",
                      alt: "",
                      title: "",
                      caption: "",
                      description: "",
                      width: null,
                      height: null,
                    })
                  }
                  className="text-xs font-medium text-gray-500 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-1 w-full rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm font-medium text-gray-600 hover:border-brand hover:text-brand transition"
          >
            Choose an image from the Library
          </button>
        )}

        {block.url && filled < 4 && (
          <p className="mt-1 text-xs text-amber-700">
            The four fields belong to the image, not this block - fix them once in the
            Image Library and every page using this image gets the benefit.
          </p>
        )}
        {block.url && filled === 4 && kw && !block.alt.toLowerCase().includes(kw.toLowerCase()) && (
          <p className="mt-1 text-xs text-amber-700">
            All four are filled, but none of them mention "{kw}".
          </p>
        )}

        <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={block.aboveFold}
            onChange={(e) => onChange({ aboveFold: e.target.checked })}
            className="rounded border-gray-300"
          />
          This image is above the fold - load it eagerly
        </label>
        <p className="mt-0.5 text-xs text-gray-500">
          Leave this off for anything further down the page. Tick it only for the
          first thing a visitor sees: lazy-loading that image delays LCP.
        </p>

        <div className="mt-3">
          <span className="block text-sm font-medium text-gray-700">Image display width</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {[["", "Full"], ["25%", "25%"], ["50%", "50%"], ["75%", "75%"], ["300px", "300px"], ["480px", "480px"]].map(
              ([val, lbl]) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => onChange({ displayWidth: val })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    (block.displayWidth || "") === val
                      ? "border-brand bg-brand-50 text-brand"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {lbl}
                </button>
              ),
            )}
            <label className="ml-1 flex items-center gap-1 text-xs text-gray-500">
              Custom
              <input
                type="text"
                value={block.displayWidth || ""}
                onChange={(e) => onChange({ displayWidth: e.target.value.trim() })}
                placeholder="e.g. 360px or 40%"
                className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs outline-none focus:border-brand"
              />
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Resize the image like Elementor — px or %. &ldquo;Full&rdquo; uses the column width.
          </p>
        </div>
      </div>

      {/* ---------- the text ---------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
        <div>
          <label className={labelClass} htmlFor={`heading-${block.id}`}>
            Heading <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id={`heading-${block.id}`}
            type="text"
            value={block.heading}
            onChange={(e) => onChange({ heading: e.target.value })}
            placeholder="Built for Indian carrier compliance"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-500">
            A secondary keyword in here counts towards the headings check.
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor={`itlevel-${block.id}`}>
            Heading level
          </label>
          <select
            id={`itlevel-${block.id}`}
            value={block.level}
            onChange={(e) => onChange({ level: Number(e.target.value) as HeadingLevel })}
            className={inputClass}
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
        </div>
      </div>

      <div>
        <span className={labelClass}>Text</span>
        <div className="mt-1">
          <RichTextEditor
            value={block.bodyHtml && block.bodyHtml.trim() !== "" ? block.bodyHtml : paragraphsToHtml(paragraphs)}
            onChange={(html) =>
              onChange({ bodyHtml: html, paragraphs: paragraphsFromHtml(html) })
            }
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Same editor as the body — headings, lists, links, bold. Keep paragraphs concise.
        </p>
      </div>

      <ImagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={applyPicked}
        title="Choose an image for this block"
      />
    </div>
  );
}
