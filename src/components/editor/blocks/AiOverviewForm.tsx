import {
  AI_ANSWER_MAX_WORDS,
  AI_ANSWER_MIN_WORDS,
  MAX_PARAGRAPH_WORDS,
  countWords,
  type AiOverviewBlock,
  type HeadingLevel,
} from "../../../lib/blocks";

const labelClass = "block text-sm font-medium text-gray-700";
const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

/** The engine's ceiling per paragraph, shown live so it is never a surprise. */
function ParagraphCounter({ text }: { text: string }) {
  const words = countWords(text);
  const over = words > MAX_PARAGRAPH_WORDS;
  return (
    <p className={`mt-1 text-xs ${over ? "text-red-600" : "text-gray-500"}`}>
      {words} words
      {over
        ? ` - over the ${MAX_PARAGRAPH_WORDS}-word paragraph limit. Split it or the paragraph check fails.`
        : ` of ${MAX_PARAGRAPH_WORDS} allowed in one paragraph.`}
    </p>
  );
}

type Props = {
  block: AiOverviewBlock;
  /** From the SEO panel. Used only to point out when the heading misses it. */
  focusKeyword: string;
  onChange: (patch: Partial<AiOverviewBlock>) => void;
};

/**
 * Block 1 of Section 4A — the block Money Pilot shipped as a dead button.
 *
 * Two rules drive the shape of this form:
 *
 *  - AI engines lift a direct answer to a plainly asked question, so the
 *    question is a real heading in the page HTML, not a styled div.
 *  - The engine fails any paragraph over 60 words, and the answer wants to be
 *    around 120. So the answer is authored as separate paragraphs with live
 *    counts, rather than one textarea that quietly breaks the paragraph check.
 */
export default function AiOverviewForm({ block, focusKeyword, onChange }: Props) {
  const paragraphs = block.paragraphs.length > 0 ? block.paragraphs : [""];
  const totalWords = paragraphs.reduce((sum, p) => sum + countWords(p), 0);

  function setParagraph(index: number, value: string) {
    const next = paragraphs.slice();
    next[index] = value;
    onChange({ paragraphs: next });
  }

  function addParagraph() {
    onChange({ paragraphs: [...paragraphs, ""] });
  }

  function removeParagraph(index: number) {
    const next = paragraphs.filter((_, i) => i !== index);
    onChange({ paragraphs: next.length > 0 ? next : [""] });
  }

  const inRange = totalWords >= AI_ANSWER_MIN_WORDS && totalWords <= AI_ANSWER_MAX_WORDS;
  const kw = focusKeyword.trim();
  const kwMissing = kw.length > 0 && !block.question.toLowerCase().includes(kw.toLowerCase());

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
        <div>
          <label className={labelClass} htmlFor={`q-${block.id}`}>
            Question
          </label>
          <input
            id={`q-${block.id}`}
            type="text"
            value={block.question}
            onChange={(e) => onChange({ question: e.target.value })}
            placeholder="How do I send bulk SMS in India?"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-500">
            Renders as a real <code>h{block.level}</code> in the page. A How / What / Why
            heading also satisfies the engine's question-heading check on its own.
            {kwMissing && (
              <span className="text-amber-700">
                {" "}
                Your focus keyword "{kw}" is not in it yet.
              </span>
            )}
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor={`level-${block.id}`}>
            Heading level
          </label>
          <select
            id={`level-${block.id}`}
            value={block.level}
            onChange={(e) => onChange({ level: Number(e.target.value) as HeadingLevel })}
            className={inputClass}
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">H3 only under an H2.</p>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className={labelClass}>Answer</span>
          <span
            className={`text-xs font-medium ${
              totalWords === 0
                ? "text-gray-500"
                : inRange
                  ? "text-emerald-600"
                  : "text-amber-600"
            }`}
          >
            {totalWords} words - aim {AI_ANSWER_MIN_WORDS}-{AI_ANSWER_MAX_WORDS}
          </span>
        </div>

        <div className="mt-2 space-y-3">
          {paragraphs.map((text, index) => (
            <div key={index}>
              <div className="flex items-start gap-2">
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setParagraph(index, e.target.value)}
                  placeholder={
                    index === 0
                      ? "Answer the question directly in the first sentence, then add the detail."
                      : "Continue the answer."
                  }
                  className={`${inputClass} mt-0`}
                />
                {paragraphs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeParagraph(index)}
                    className="mt-1 shrink-0 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-red-600 transition"
                    aria-label={`Remove paragraph ${index + 1}`}
                    title="Remove this paragraph"
                  >
                    Remove
                  </button>
                )}
              </div>
              <ParagraphCounter text={text} />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addParagraph}
          className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          + Add paragraph
        </button>

        <p className="mt-2 text-xs text-gray-500">
          Plain text - each paragraph is escaped and rendered as its own{" "}
          <code>&lt;p&gt;</code>. Answers stay visible rather than collapsed, so the
          text is in the served HTML where AI engines and crawlers read it.
        </p>
      </div>
    </div>
  );
}
