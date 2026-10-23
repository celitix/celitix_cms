import { type AudioBlock } from "../../../lib/blocks";

const labelClass = "block text-sm font-medium text-gray-700";
const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

type Props = { block: AudioBlock; onChange: (patch: Partial<AudioBlock>) => void };

/** Block 7 - Audio Embed. A native <audio> player. */
export default function AudioForm({ block, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass} htmlFor={`aud-url-${block.id}`}>
          Audio URL
        </label>
        <input
          id={`aud-url-${block.id}`}
          type="text"
          value={block.url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://.../episode.mp3"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`aud-title-${block.id}`}>
            Title
          </label>
          <input
            id={`aud-title-${block.id}`}
            type="text"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`aud-cap-${block.id}`}>
            Caption <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id={`aud-cap-${block.id}`}
            type="text"
            value={block.caption}
            onChange={(e) => onChange({ caption: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
