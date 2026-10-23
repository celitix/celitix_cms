import {
  MAX_LIST_ITEM_WORDS,
  countWords,
  type HeadingLevel,
  type IconBulletsBlock,
  type IconBulletsItem,
} from "../../../lib/blocks";

const labelClass = "block text-sm font-medium text-gray-700";
const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

/** A few sensible icons so the writer isn't hunting for an emoji picker. */
const ICON_CHOICES = ["\u2713", "\u2605", "\u2192", "\u2022", "\u26A1", "\u2764", "\uD83D\uDD12", "\uD83D\uDE80"];

type Props = {
  block: IconBulletsBlock;
  focusKeyword: string;
  onChange: (patch: Partial<IconBulletsBlock>) => void;
};

/**
 * Block 5 - Icon Bullets. One row per point, with a live word count, because the
 * engine fails any list item over 50 words. A single long textarea would hide
 * that until the score dropped.
 */
export default function IconBulletsForm({ block, focusKeyword, onChange }: Props) {
  const items = block.items.length > 0 ? block.items : [{ icon: "\u2713", text: "" }];

  function setItem(index: number, patch: Partial<IconBulletsItem>) {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange({ items: next });
  }

  function addItem() {
    const icon = items[items.length - 1]?.icon || "\u2713";
    onChange({ items: [...items, { icon, text: "" }] });
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index);
    onChange({ items: next.length > 0 ? next : [{ icon: "\u2713", text: "" }] });
  }

  const kw = focusKeyword.trim();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
        <div>
          <label className={labelClass} htmlFor={`ib-head-${block.id}`}>
            Headline
          </label>
          <input
            id={`ib-head-${block.id}`}
            type="text"
            value={block.heading}
            onChange={(e) => onChange({ heading: e.target.value })}
            placeholder="Why choose us"
            className={inputClass}
          />
          {kw && block.heading && !block.heading.toLowerCase().includes(kw.toLowerCase()) && (
            <p className="mt-1 text-xs text-amber-700">
              Focus keyword "{kw}" is not in this headline.
            </p>
          )}
        </div>
        <div>
          <label className={labelClass} htmlFor={`ib-level-${block.id}`}>
            Heading level
          </label>
          <select
            id={`ib-level-${block.id}`}
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
        <span className={labelClass}>Bullets</span>
        <div className="mt-2 space-y-2">
          {items.map((it, index) => {
            const words = countWords(it.text);
            const over = words > MAX_LIST_ITEM_WORDS;
            return (
              <div key={index} className="flex items-start gap-2">
                <select
                  value={it.icon}
                  onChange={(e) => setItem(index, { icon: e.target.value })}
                  className="mt-1 w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm outline-none focus:border-brand"
                  aria-label={`Icon for bullet ${index + 1}`}
                >
                  {(ICON_CHOICES.includes(it.icon) ? ICON_CHOICES : [it.icon, ...ICON_CHOICES]).map(
                    (icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ),
                  )}
                </select>
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={it.text}
                    onChange={(e) => setItem(index, { text: e.target.value })}
                    placeholder="A short, scannable point"
                    className={`${inputClass} mt-1`}
                  />
                  {it.text && (
                    <p className={`mt-1 text-xs ${over ? "text-red-600" : "text-gray-500"}`}>
                      {words} words
                      {over ? ` - over the ${MAX_LIST_ITEM_WORDS}-word list-item limit.` : ""}
                    </p>
                  )}
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="mt-1 shrink-0 rounded-md px-2 py-2 text-xs text-gray-500 hover:bg-gray-100 hover:text-red-600 transition"
                    title="Remove this bullet"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          + Add bullet
        </button>
      </div>
    </div>
  );
}
