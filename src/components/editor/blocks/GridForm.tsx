import {
  MAX_PARAGRAPH_WORDS,
  countWords,
  type GridBlock,
  type GridCell,
} from "../../../lib/blocks";

const labelClass = "block text-sm font-medium text-gray-700";
const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

type Props = { block: GridBlock; onChange: (patch: Partial<GridBlock>) => void };

/** Block 10 - Multi-Column Grid. 2-4 columns of heading + text. */
export default function GridForm({ block, onChange }: Props) {
  const cells = block.cells.length > 0 ? block.cells : [{ heading: "", text: "" }];

  function setCell(index: number, patch: Partial<GridCell>) {
    onChange({ cells: cells.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
  }
  function addCell() {
    onChange({ cells: [...cells, { heading: "", text: "" }] });
  }
  function removeCell(index: number) {
    const next = cells.filter((_, i) => i !== index);
    onChange({ cells: next.length > 0 ? next : [{ heading: "", text: "" }] });
  }

  return (
    <div className="space-y-4">
      <div>
        <span className={labelClass}>Columns</span>
        <div className="mt-1 flex gap-2">
          {([2, 3, 4] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ columns: n })}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                block.columns === n
                  ? "border-brand bg-brand-50 text-brand"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {n} columns
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {cells.map((c, index) => {
          const words = countWords(c.text);
          const over = words > MAX_PARAGRAPH_WORDS;
          return (
            <div key={index} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Cell {index + 1}</span>
                {cells.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCell(index)}
                    className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-red-600 transition"
                    title="Remove this cell"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                type="text"
                value={c.heading}
                onChange={(e) => setCell(index, { heading: e.target.value })}
                placeholder="Cell heading"
                className={inputClass}
              />
              <textarea
                rows={2}
                value={c.text}
                onChange={(e) => setCell(index, { text: e.target.value })}
                placeholder="Cell text"
                className={`${inputClass} mt-2`}
              />
              {c.text && (
                <p className={`mt-1 text-xs ${over ? "text-red-600" : "text-gray-500"}`}>
                  {words} words{over ? ` - over the ${MAX_PARAGRAPH_WORDS}-word limit` : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={addCell}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
      >
        + Add cell
      </button>
    </div>
  );
}
