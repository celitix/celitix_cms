import { videoEmbed, type VideoBlock } from "../../../lib/blocks";

const labelClass = "block text-sm font-medium text-gray-700";
const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

type Props = { block: VideoBlock; onChange: (patch: Partial<VideoBlock>) => void };

/** Block 6 - Video Embed. YouTube/Vimeo auto-embed; anything else plays as a file. */
export default function VideoForm({ block, onChange }: Props) {
  const url = block.url.trim();
  const detected = url ? videoEmbed(url) : null;
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass} htmlFor={`vid-url-${block.id}`}>
          Video URL
        </label>
        <input
          id={`vid-url-${block.id}`}
          type="text"
          value={block.url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://youtube.com/watch?v=... or a direct .mp4"
          className={inputClass}
        />
        {detected && (
          <p className="mt-1 text-xs text-gray-500">
            {detected.kind === "iframe"
              ? "Detected an embeddable video - it will render as a responsive player."
              : "Treated as a direct video file - it will play with a native <video> tag."}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`vid-title-${block.id}`}>
            Title
          </label>
          <input
            id={`vid-title-${block.id}`}
            type="text"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="What the video shows"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-500">Feeds video schema and accessibility.</p>
        </div>
        <div>
          <label className={labelClass} htmlFor={`vid-cap-${block.id}`}>
            Caption <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id={`vid-cap-${block.id}`}
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
