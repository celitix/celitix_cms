import { useState } from "react";
import ImagePicker from "../../ImagePicker";
import { mediaSrc, type MediaItem } from "../../../lib/mediaApi";
import { countWords, type AuthorBlock } from "../../../lib/blocks";

const labelClass = "block text-sm font-medium text-gray-700";
const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

type Props = { block: AuthorBlock; onChange: (patch: Partial<AuthorBlock>) => void };

/**
 * Block 11 - Author Bio. The E-E-A-T signal: a named author, a role, and a real
 * bio (Google wants 20+ words). Optional photo from the Image Library.
 */
export default function AuthorForm({ block, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const bioWords = countWords(block.bio);

  function applyPhoto(images: MediaItem[]) {
    const img = images[0];
    setPickerOpen(false);
    if (!img) return;
    onChange({ url: img.url, mediaId: img.id, alt: img.alt || block.name });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <div className="h-20 w-20 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
            {block.url ? (
              <img
                src={mediaSrc(block.url)}
                alt={block.alt || block.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                No photo
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-2 w-20 rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
          >
            {block.url ? "Change" : "Add photo"}
          </button>
          {block.url && (
            <button
              type="button"
              onClick={() => onChange({ url: "", mediaId: null, alt: "" })}
              className="mt-1 w-20 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor={`au-name-${block.id}`}>
                Name
              </label>
              <input
                id={`au-name-${block.id}`}
                type="text"
                value={block.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="AR Nayak"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={`au-role-${block.id}`}>
                Role / title
              </label>
              <input
                id={`au-role-${block.id}`}
                type="text"
                value={block.role}
                onChange={(e) => onChange({ role: e.target.value })}
                placeholder="Founder & CEO, Indscope"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label className={labelClass} htmlFor={`au-bio-${block.id}`}>
                Bio
              </label>
              <span
                className={`text-xs font-medium ${
                  bioWords === 0 ? "text-gray-500" : bioWords < 20 ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {bioWords} words - aim 20+
              </span>
            </div>
            <textarea
              id={`au-bio-${block.id}`}
              rows={3}
              value={block.bio}
              onChange={(e) => onChange({ bio: e.target.value })}
              placeholder="A short, credible bio - experience, credentials, what they cover."
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <ImagePicker
        open={pickerOpen}
        title="Choose an author photo"
        onClose={() => setPickerOpen(false)}
        onSelect={applyPhoto}
      />
    </div>
  );
}
