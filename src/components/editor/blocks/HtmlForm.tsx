import { type HtmlBlock } from "../../../lib/blocks";

type Props = {
  block: HtmlBlock;
  onChange: (patch: Partial<HtmlBlock>) => void;
};

/**
 * Raw HTML block. Paste hand-authored HTML (e.g. a designed section). It renders
 * verbatim in THIS entry only; <script> and inline event handlers are stripped
 * on save. Everything else — markup, classes, inline styles — is preserved.
 */
export default function HtmlForm({ block, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700" htmlFor={`html-${block.id}`}>
        HTML
      </label>
      <textarea
        id={`html-${block.id}`}
        value={block.html}
        onChange={(e) => onChange({ html: e.target.value })}
        placeholder={'<section class="my-section">\n  <h2>Heading</h2>\n  <p>Paste your designed HTML here…</p>\n</section>'}
        spellCheck={false}
        className="h-64 w-full rounded-lg border border-gray-300 p-3 font-mono text-xs leading-relaxed outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <p className="text-xs text-gray-500">
        Renders only in this entry. Scripts and inline event handlers are removed on save; all other
        markup, classes and inline styles are kept.
      </p>
    </div>
  );
}
