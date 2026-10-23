import {
  MAX_PARAGRAPH_WORDS,
  countWords,
  type AccordionBlock,
  type AccordionItem,
} from "../../../lib/blocks";

const labelClass = "block text-sm font-medium text-gray-700";
const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

type Props = {
  block: AccordionBlock;
  onChange: (patch: Partial<AccordionBlock>) => void;
};

/**
 * Block 9 - Accordion (FAQ). Each item is one native <details> in the page,
 * which satisfies the engine's accordion check and feeds FAQPage schema. The
 * question shown here is the exact text used in the schema, so the two can never
 * disagree.
 */
export default function AccordionForm({ block, onChange }: Props) {
  const items = block.items.length > 0 ? block.items : [{ question: "", answer: "" }];

  function setItem(index: number, patch: Partial<AccordionItem>) {
    onChange({ items: items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });
  }

  function addItem() {
    onChange({ items: [...items, { question: "", answer: "" }] });
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index);
    onChange({ items: next.length > 0 ? next : [{ question: "", answer: "" }] });
  }

  return (
    <div className="space-y-3">
      {items.map((it, index) => {
        const answerWords = countWords(it.answer);
        const longAnswer = answerWords > MAX_PARAGRAPH_WORDS;
        return (
          <div key={index} className="rounded-xl border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Q{index + 1}</span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-red-600 transition"
                  title="Remove this question"
                >
                  Remove
                </button>
              )}
            </div>

            <label className={labelClass} htmlFor={`acc-q-${block.id}-${index}`}>
              Question
            </label>
            <input
              id={`acc-q-${block.id}-${index}`}
              type="text"
              value={it.question}
              onChange={(e) => setItem(index, { question: e.target.value })}
              placeholder="How long does delivery take?"
              className={inputClass}
            />

            <label className={`${labelClass} mt-2`} htmlFor={`acc-a-${block.id}-${index}`}>
              Answer
            </label>
            <textarea
              id={`acc-a-${block.id}-${index}`}
              rows={3}
              value={it.answer}
              onChange={(e) => setItem(index, { answer: e.target.value })}
              placeholder="Answer it plainly in the first sentence."
              className={inputClass}
            />
            {it.answer && (
              <p className={`mt-1 text-xs ${longAnswer ? "text-amber-600" : "text-gray-500"}`}>
                {answerWords} words{longAnswer ? ` - tighter than ${MAX_PARAGRAPH_WORDS} reads better` : ""}
              </p>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addItem}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
      >
        + Add question
      </button>

      <p className="text-xs text-gray-500">
        Each question becomes a native <code>&lt;details&gt;</code> in the page and a FAQ
        schema entry - the same words appear in both.
      </p>
    </div>
  );
}
