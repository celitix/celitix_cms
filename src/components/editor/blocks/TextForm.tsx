import RichTextEditor from "../RichTextEditor";
import { countWordsInHtml, type TextBlock } from "../../../lib/blocks";

type Props = {
  block: TextBlock;
  onChange: (patch: Partial<TextBlock>) => void;
};

/**
 * Block 2 of Section 4A — Text.
 *
 * Deliberately the same RichTextEditor as before, with the same CTA and FAQ
 * nodes. The body used to be one instance of this component; it is now one per
 * Text block. Nothing about the emitted HTML changed, which is why every item
 * saved before the block system opens as a Text block and scores identically.
 */
export default function TextForm({ block, onChange }: Props) {
  const words = countWordsInHtml(block.html);

  return (
    <div className="space-y-2">
      <RichTextEditor value={block.html} onChange={(html) => onChange({ html })} />
      <p className="text-xs text-gray-500">
        {words} words in this block. H2s, a list and internal links all get graded -
        the score reads structure, not just prose.
      </p>
    </div>
  );
}
