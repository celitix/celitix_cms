import { useState } from "react";
import type { ContentDraft, Faq, SeoDraft } from "../../lib/api";

const labelClass = "block text-sm font-medium text-gray-700";
const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

/** Live length readout against the engine's window for this field. */
function Counter({ value, min, max }: { value: string; min: number; max: number }) {
  const len = value.length;
  const inRange = len >= min && len <= max;
  const tone = len === 0 ? "text-gray-500" : inRange ? "text-emerald-600" : "text-amber-600";
  return (
    <p className={`mt-1 text-xs ${tone}`}>
      {len} characters — the engine wants {min}–{max}.
    </p>
  );
}

function toKeywordArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string");
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const p = JSON.parse(s);
      if (Array.isArray(p)) return p.filter((x) => typeof x === "string");
    } catch {
      /* not JSON — fall through to comma split */
    }
    return s.split(",").map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

function SecondaryKeywords({
  values: rawValues,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const values = toKeywordArray(rawValues);
  const [entry, setEntry] = useState("");

  function add() {
    const next = entry.trim().replace(/,$/, "");
    if (!next) return;
    if (values.some((v) => v.toLowerCase() === next.toLowerCase())) {
      setEntry("");
      return;
    }
    onChange([...values, next]);
    setEntry("");
  }

  const count = values.length;
  const ok = count >= 2 && count <= 4;

  return (
    <div>
      <label className={labelClass} htmlFor="secondary">
        Secondary keywords
      </label>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand"
          >
            {kw}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== kw))}
              className="text-brand/60 hover:text-brand"
              aria-label={`Remove ${kw}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        id="secondary"
        type="text"
        value={entry}
        onChange={(e) => setEntry(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder="Type a keyword and press Enter"
        className={inputClass}
      />
      <p className={`mt-1 text-xs ${ok ? "text-emerald-600" : "text-amber-600"}`}>
        {count} of 2–4. Each one also needs to appear at least twice in the body.
      </p>
    </div>
  );
}

function FaqEditor({ faqs: rawFaqs, onChange }: { faqs: Faq[] | string; onChange: (next: Faq[]) => void }) {
  const faqs: Faq[] = Array.isArray(rawFaqs)
    ? rawFaqs
    : (() => {
        if (typeof rawFaqs === "string" && rawFaqs.trim()) {
          try {
            const p = JSON.parse(rawFaqs);
            if (Array.isArray(p)) return p;
          } catch {
            /* ignore */
          }
        }
        return [];
      })();
  function update(index: number, patch: Partial<Faq>) {
    onChange(faqs.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={faq.question}
              onChange={(e) => update(i, { question: e.target.value })}
              placeholder="Question"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            />
            <button
              type="button"
              onClick={() => onChange(faqs.filter((_, x) => x !== i))}
              className="shrink-0 rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-red-50 transition"
              aria-label="Remove question"
            >
              ×
            </button>
          </div>
          <textarea
            rows={2}
            value={faq.answer}
            onChange={(e) => update(i, { answer: e.target.value })}
            placeholder="Answer"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...faqs, { question: "", answer: "" }])}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
      >
        Add question
      </button>
      <p className="text-xs text-gray-500">
        These power the FAQ schema. The accordion check reads the body instead —
        use the “FAQ block” button in the editor toolbar for that.
      </p>
    </div>
  );
}

type Props = {
  draft: ContentDraft;
  onChange: (changes: Partial<ContentDraft>) => void;
};

export default function SeoFields({ draft, onChange }: Props) {
  function setSeo(changes: Partial<SeoDraft>) {
    onChange({ seo: { ...draft.seo, ...changes } });
  }

  return (
    <section className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">SEO &amp; AI</h2>
        <p className="text-sm text-gray-500">
          Most of the remaining checks are graded from these fields.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="focusKeyword">
          Focus keyword
        </label>
        <input
          id="focusKeyword"
          type="text"
          value={draft.seo.focusKeyword}
          onChange={(e) => setSeo({ focusKeyword: e.target.value })}
          placeholder="bulk sms api"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500">
          The one phrase this piece is about. It should appear in the slug, near
          the start of the meta title, in a subheading, and 0.5–2.5% of the body.
        </p>
      </div>

      <SecondaryKeywords
        values={draft.seo.secondaryKeywords}
        onChange={(secondaryKeywords) => setSeo({ secondaryKeywords })}
      />

      <div>
        <label className={labelClass} htmlFor="metaTitle">
          Meta title
        </label>
        <input
          id="metaTitle"
          type="text"
          value={draft.seo.title}
          onChange={(e) => setSeo({ title: e.target.value })}
          placeholder="Bulk SMS API: The Complete 2026 Guide"
          className={inputClass}
        />
        <Counter value={draft.seo.title} min={50} max={60} />
        <p className="text-xs text-gray-500">
          This — not the page title — is what gets graded. A number or a power
          word (best, complete, guide, how…) satisfies the “strong title” check.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="metaDescription">
          Meta description
        </label>
        <textarea
          id="metaDescription"
          rows={3}
          value={draft.seo.description}
          onChange={(e) => setSeo({ description: e.target.value })}
          className={inputClass}
        />
        <Counter value={draft.seo.description} min={140} max={160} />
      </div>

      <div>
        <label className={labelClass} htmlFor="tldr">
          TL;DR
        </label>
        <textarea
          id="tldr"
          rows={3}
          value={draft.seo.tldr}
          onChange={(e) => setSeo({ tldr: e.target.value })}
          placeholder="A short summary of the piece, in the same words the body uses."
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500">
          Scored on overlap: at least 40% of its distinctive words must also
          appear in the body, so summarise — don't introduce new vocabulary.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="aiQueries">
          AI / SGE queries
        </label>
        <input
          id="aiQueries"
          type="text"
          value={draft.seo.aiQueries}
          onChange={(e) => setSeo({ aiQueries: e.target.value })}
          placeholder="how to send bulk sms, best bulk sms api india"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-500">
          Comma-separated questions you want this piece to answer in AI search.
        </p>
      </div>

      <div className="space-y-3 border-t border-gray-100 pt-4">
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={draft.seo.hasFaq}
            onChange={(e) => setSeo({ hasFaq: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 accent-[var(--color-brand)]"
          />
          <span className="text-sm font-medium text-gray-700">
            This piece has an FAQ
          </span>
        </label>

        {draft.seo.hasFaq ? (
          <FaqEditor faqs={draft.faqs} onChange={(faqs) => onChange({ faqs })} />
        ) : (
          <p className="text-xs text-gray-500">
            Leaving this off passes the FAQ check as “not required”. Tick it only
            if you'll add real question-and-answer pairs.
          </p>
        )}
      </div>
    </section>
  );
}
