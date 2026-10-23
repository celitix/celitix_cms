import { useState } from "react";
import AccordionForm from "./blocks/AccordionForm";
import AudioForm from "./blocks/AudioForm";
import AuthorForm from "./blocks/AuthorForm";
import GridForm from "./blocks/GridForm";
import VideoForm from "./blocks/VideoForm";
import AiOverviewForm from "./blocks/AiOverviewForm";
import CtaButtonForm from "./blocks/CtaButtonForm";
import IconBulletsForm from "./blocks/IconBulletsForm";
import ImageTextForm from "./blocks/ImageTextForm";
import TextForm from "./blocks/TextForm";
import HtmlForm from "./blocks/HtmlForm";
import {
  NOT_YET_BUILT,
  PALETTE,
  blockIssues,
  blockLabel,
  blockSummary,
  moveBlock,
  removeBlock,
  serializeBlock,
  updateBlock,
  type AccordionBlock,
  type AiOverviewBlock,
  type AudioBlock,
  type AuthorBlock,
  type Block,
  type CtaButtonBlock,
  type GridBlock,
  type IconBulletsBlock,
  type ImageTextBlock,
  type HtmlBlock,
  type TextBlock,
  type VideoBlock,
} from "../../lib/blocks";

const labelClass = "block text-sm font-medium text-gray-700";

function IconButton({
  onClick,
  disabled,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-30 ${
        danger
          ? "text-gray-500 hover:bg-red-50 hover:text-red-600"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The form for one block. A switch rather than a registry lookup so each form
 * keeps its own prop types — a dynamic component map would need casts, and a
 * cast is how you end up passing an AI Overview block to a Text form.
 */
function BlockForm({
  block,
  focusKeyword,
  onPatch,
}: {
  block: Block;
  focusKeyword: string;
  onPatch: (patch: Partial<Block>) => void;
}) {
  switch (block.type) {
    case "aiOverview":
      return (
        <AiOverviewForm
          block={block}
          focusKeyword={focusKeyword}
          onChange={(patch: Partial<AiOverviewBlock>) => onPatch(patch)}
        />
      );
    case "imageText":
      return (
        <ImageTextForm
          block={block}
          focusKeyword={focusKeyword}
          onChange={(patch: Partial<ImageTextBlock>) => onPatch(patch)}
        />
      );
    case "text":
      return <TextForm block={block} onChange={(patch: Partial<TextBlock>) => onPatch(patch)} />;
    case "cta":
      return (
        <CtaButtonForm
          block={block}
          onChange={(patch: Partial<CtaButtonBlock>) => onPatch(patch)}
        />
      );
    case "iconBullets":
      return (
        <IconBulletsForm
          block={block}
          focusKeyword={focusKeyword}
          onChange={(patch: Partial<IconBulletsBlock>) => onPatch(patch)}
        />
      );
    case "accordion":
      return (
        <AccordionForm
          block={block}
          onChange={(patch: Partial<AccordionBlock>) => onPatch(patch)}
        />
      );
    case "video":
      return <VideoForm block={block} onChange={(patch: Partial<VideoBlock>) => onPatch(patch)} />;
    case "audio":
      return <AudioForm block={block} onChange={(patch: Partial<AudioBlock>) => onPatch(patch)} />;
    case "grid":
      return <GridForm block={block} onChange={(patch: Partial<GridBlock>) => onPatch(patch)} />;
    case "author":
      return <AuthorForm block={block} onChange={(patch: Partial<AuthorBlock>) => onPatch(patch)} />;
    case "html":
      return <HtmlForm block={block} onChange={(patch: Partial<HtmlBlock>) => onPatch(patch)} />;
    case "raw":
      return (
        <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-600">
          {block.html}
        </pre>
      );
  }
}

type Props = {
  blocks: Block[];
  onChange: (next: Block[]) => void;
  /** Passed to the blocks that check their own text against it. */
  focusKeyword: string;
};

export default function BlockList({ blocks, onChange, focusKeyword }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showHtml, setShowHtml] = useState<Record<string, boolean>>({});

  function toggle(map: Record<string, boolean>, set: (m: Record<string, boolean>) => void, id: string) {
    set({ ...map, [id]: !map[id] });
  }

  function handleDelete(block: Block) {
    const label = blockLabel(block);
    if (!window.confirm(`Delete this ${label} block? The other blocks are untouched.`)) return;
    onChange(removeBlock(blocks, block.id));
  }

  return (
    <section className="rounded-2xl bg-white border border-gray-200 p-6 space-y-4">
      <div className="flex items-baseline justify-between">
        <span className={labelClass}>Body</span>
        <span className="text-xs text-gray-500">
          {blocks.length} block{blocks.length === 1 ? "" : "s"}
        </span>
      </div>

      {blocks.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
          No blocks yet. Add one below to start the body.
        </p>
      )}

      <div className="space-y-3">
        {blocks.map((block, index) => {
          const issues = blockIssues(block, focusKeyword);
          const errors = issues.filter((i) => i.level === "error");
          const warns = issues.filter((i) => i.level === "warn");
          const isCollapsed = Boolean(collapsed[block.id]);

          return (
            <article
              key={block.id}
              className="rounded-xl border border-gray-200 overflow-hidden"
            >
              <header className="flex items-start gap-3 bg-gray-50/70 px-4 py-2.5">
                <span className="mt-0.5 text-xs font-semibold tabular-nums text-gray-400">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">{blockLabel(block)}</p>
                    {errors.length > 0 && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-red-200">
                        {errors.length} to fix
                      </span>
                    )}
                    {warns.length > 0 && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                        {warns.length} to check
                      </span>
                    )}
                  </div>
                  {isCollapsed && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {blockSummary(block)}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <IconButton
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => onChange(moveBlock(blocks, block.id, -1))}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    title="Move down"
                    disabled={index === blocks.length - 1}
                    onClick={() => onChange(moveBlock(blocks, block.id, 1))}
                  >
                    ↓
                  </IconButton>
                  <IconButton
                    title={isCollapsed ? "Expand" : "Collapse"}
                    onClick={() => toggle(collapsed, setCollapsed, block.id)}
                  >
                    {isCollapsed ? "Expand" : "Collapse"}
                  </IconButton>
                  <IconButton title="Delete block" danger onClick={() => handleDelete(block)}>
                    Delete
                  </IconButton>
                </div>
              </header>

              {!isCollapsed && (
                <div className="space-y-3 px-4 py-4">
                  <BlockForm
                    block={block}
                    focusKeyword={focusKeyword}
                    onPatch={(patch) => onChange(updateBlock(blocks, block.id, patch))}
                  />

                  {issues.length > 0 && (
                    <ul className="space-y-1 rounded-lg bg-gray-50 px-3 py-2">
                      {issues.map((issue, i) => (
                        <li
                          key={i}
                          className={`text-xs ${
                            issue.level === "error" ? "text-red-700" : "text-amber-700"
                          }`}
                        >
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/*
                    The stored-equals-rendered check, per block, without leaving
                    the editor. This is the exact string that goes to the
                    database and comes back out in page source — not a preview
                    of something generated later.
                  */}
                  {block.type !== "raw" && (
                    <div>
                      <button
                        type="button"
                        onClick={() => toggle(showHtml, setShowHtml, block.id)}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        {showHtml[block.id] ? "Hide" : "Show"} the HTML this block stores
                      </button>
                      {showHtml[block.id] && (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">
                          {serializeBlock(block) || "(empty - nothing will be saved)"}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Add block
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PALETTE.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange([...blocks, item.create()])}
              title={item.blurb}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand hover:bg-brand-50 hover:text-brand transition"
            >
              + {item.label}
            </button>
          ))}
        </div>
        {/*
          Listed as text, never as buttons. Money Pilot put all 11 in the
          palette and wired 7 — four looked available and did nothing.
        */}
        <p className="mt-3 text-xs text-gray-500">
          Still to build in this phase: {NOT_YET_BUILT.join(", ")}. They are not in the
          palette until they save and render.
        </p>
      </div>
    </section>
  );
}
