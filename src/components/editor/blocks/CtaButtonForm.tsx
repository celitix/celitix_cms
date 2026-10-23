import { type CtaButtonBlock } from "../../../lib/blocks";

const labelClass = "block text-sm font-medium text-gray-700";
const SWATCHES = ["#7c3aed", "#2563eb", "#059669", "#dc2626", "#ea580c", "#0891b2", "#111827"];
const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

type Props = {
  block: CtaButtonBlock;
  onChange: (patch: Partial<CtaButtonBlock>) => void;
};

/**
 * Block 8 - Button (CTA). Renders `<a class="cta-button" role="button">`, which
 * is exactly what the engine's cta check matches, so one of these turns that
 * check green.
 */
export default function CtaButtonForm({ block, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`cta-label-${block.id}`}>
            Button label
          </label>
          <input
            id={`cta-label-${block.id}`}
            type="text"
            value={block.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Get a free quote"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`cta-href-${block.id}`}>
            Link
          </label>
          <input
            id={`cta-href-${block.id}`}
            type="text"
            value={block.href}
            onChange={(e) => onChange({ href: e.target.value })}
            placeholder="/contact or https://..."
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-500">
            A path like <code>/contact</code> for internal, or a full{" "}
            <code>https://</code> address for external.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className={labelClass}>Style</span>
          <div className="mt-1 flex gap-2">
            {(["primary", "secondary"] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => onChange({ style })}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition ${
                  block.style === style
                    ? "border-brand bg-brand-50 text-brand"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={labelClass}>Alignment</span>
          <div className="mt-1 flex gap-2">
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => onChange({ align })}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition ${
                  block.align === align
                    ? "border-brand bg-brand-50 text-brand"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {align}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <span className={labelClass}>Button colour</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => onChange({ color: c })}
              className={`h-7 w-7 rounded-full border-2 transition ${
                block.color === c ? "border-gray-900" : "border-white ring-1 ring-gray-200"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="ml-1 flex items-center gap-1 text-xs text-gray-500">
            Custom
            <input
              type="color"
              value={block.color || "#7c3aed"}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-7 w-8 cursor-pointer rounded border border-gray-200 bg-white"
            />
          </label>
          {block.color && (
            <button
              type="button"
              onClick={() => onChange({ color: "" })}
              className="ml-1 text-xs font-medium text-gray-400 hover:text-gray-700"
            >
              Reset
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Buttons lift and brighten on hover automatically on the live site.
        </p>
      </div>
    </div>
  );
}
