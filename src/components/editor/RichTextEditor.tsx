import { useEffect, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { CtaButton, Details, DetailsSummary } from "./extensions";
import ImagePicker from "../ImagePicker";
import { mediaSrc, type MediaItem } from "../../lib/mediaApi";

type Props = {
  /** HTML in. */
  value: string;
  /** HTML out. Empty string when the document is empty. */
  onChange: (html: string) => void;
};

const BTN_BASE =
  "rounded-md px-2 py-1.5 text-xs font-medium transition disabled:opacity-30 disabled:cursor-not-allowed";
const BTN_OFF = "text-gray-600 hover:bg-gray-100";
const BTN_ON = "bg-brand-50 text-brand";

function TB({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${BTN_BASE} ${active ? BTN_ON : BTN_OFF}`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px bg-gray-200" />;

function Toolbar({
  editor,
  onPickImage,
  sourceOpen,
  onToggleSource,
  fullscreen,
  onToggleFullscreen,
}: {
  editor: Editor;
  onPickImage: () => void;
  sourceOpen: boolean;
  onToggleSource: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  /** The format dropdown value — paragraph, h2 or h3. */
  const blockValue = editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
      ? "h3"
      : "p";

  function setBlock(v: string) {
    const chain = editor.chain().focus();
    if (v === "h2") chain.setHeading({ level: 2 }).run();
    else if (v === "h3") chain.setHeading({ level: 3 }).run();
    else chain.setParagraph().run();
  }

  /** Internal link: a site path. External link: a full URL that opens in a new tab. */
  function addLink(kind: "internal" | "external") {
    const previous = (editor.getAttributes("link").href as string) ?? "";
    const url = window.prompt(
      kind === "internal"
        ? "Internal link — a path on this site, e.g. /pricing"
        : "External link — a full address, e.g. https://example.com",
      previous,
    );
    if (url === null) return;
    const href = url.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    // Internal links stay clean (no target/rel) so they pass link equity; the
    // engine wants 3+ internal links and nofollowing your own pages wastes them.
    // External links open in a new tab and are marked nofollow noopener.
    const attrs =
      kind === "external"
        ? { href, target: "_blank", rel: "nofollow noopener" }
        : { href, target: null, rel: null };
    editor.chain().focus().extendMarkRange("link").setLink(attrs).run();
  }

  function insertCta() {
    const url = window.prompt("Where should the button go?", "/contact");
    if (url === null) return;
    const label = window.prompt("Button label", "Get started") ?? "Get started";
    editor
      .chain()
      .focus()
      .insertContent({
        type: "ctaButton",
        attrs: { href: url || "#" },
        content: [{ type: "text", text: label || "Get started" }],
      })
      .run();
  }

  function insertAccordion() {
    editor
      .chain()
      .focus()
      .insertContent({
        type: "details",
        content: [
          { type: "detailsSummary", content: [{ type: "text", text: "What is included?" }] },
          { type: "paragraph", content: [{ type: "text", text: "Answer goes here." }] },
        ],
      })
      .run();
  }

  function clearFormatting() {
    editor.chain().focus().unsetAllMarks().clearNodes().run();
  }

  const selectClass =
    "rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 outline-none focus:border-brand";

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50/60 px-2 py-1.5">
      {/* Format */}
      <select
        className={selectClass}
        value={blockValue}
        onChange={(e) => setBlock(e.target.value)}
        title="Paragraph or heading. The engine grades H2/H3; H1 is the page title."
        disabled={sourceOpen}
      >
        <option value="p">Paragraph</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>

      <Divider />

      <TB title="Bold" active={editor.isActive("bold")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </TB>
      <TB title="Italic" active={editor.isActive("italic")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic">I</span>
      </TB>
      <TB title="Underline" active={editor.isActive("underline")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">U</span>
      </TB>
      <TB title="Strikethrough" active={editor.isActive("strike")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </TB>

      <Divider />

      <TB title="Bulleted list" active={editor.isActive("bulletList")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • List
      </TB>
      <TB title="Numbered list" active={editor.isActive("orderedList")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1. List
      </TB>

      <Divider />

      <TB title="Align left" active={editor.isActive({ textAlign: "left" })} disabled={sourceOpen} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        ⯇
      </TB>
      <TB title="Align center" active={editor.isActive({ textAlign: "center" })} disabled={sourceOpen} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        ≡
      </TB>
      <TB title="Align right" active={editor.isActive({ textAlign: "right" })} disabled={sourceOpen} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        ⯈
      </TB>

      <Divider />

      <TB title="Internal link (a path on this site)" active={editor.isActive("link")} disabled={sourceOpen} onClick={() => addLink("internal")}>
        Internal
      </TB>
      <TB title="External link (opens in a new tab, nofollow)" disabled={sourceOpen} onClick={() => addLink("external")}>
        External
      </TB>
      <TB title="Remove link" disabled={sourceOpen || !editor.isActive("link")} onClick={() => editor.chain().focus().unsetLink().run()}>
        Unlink
      </TB>

      <Divider />

      <TB title="Insert an image from the Library" disabled={sourceOpen} onClick={onPickImage}>
        Image
      </TB>
      <TB title="Quote" active={editor.isActive("blockquote")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        Quote
      </TB>
      <TB title="Inline code" active={editor.isActive("code")} disabled={sourceOpen} onClick={() => editor.chain().focus().toggleCode().run()}>
        {"</>"}
      </TB>
      <TB title="Horizontal rule" disabled={sourceOpen} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        ― HR
      </TB>
      <TB title="Clear formatting" disabled={sourceOpen} onClick={clearFormatting}>
        Clear
      </TB>

      <Divider />

      <TB title="Insert a call-to-action button (satisfies the CTA check)" disabled={sourceOpen} onClick={insertCta}>
        CTA
      </TB>
      <TB title="Insert an expandable FAQ block (satisfies the accordion check)" disabled={sourceOpen} onClick={insertAccordion}>
        FAQ
      </TB>

      <Divider />

      <TB title="Undo" disabled={sourceOpen || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        ↺
      </TB>
      <TB title="Redo" disabled={sourceOpen || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        ↻
      </TB>

      {/* pushed to the right */}
      <span className="ml-auto flex items-center gap-1">
        <TB title="Edit the raw HTML this block stores" active={sourceOpen} onClick={onToggleSource}>
          {"</> Source"}
        </TB>
        <TB title={fullscreen ? "Exit full screen" : "Full screen"} active={fullscreen} onClick={onToggleFullscreen}>
          {fullscreen ? "⤢ Exit" : "⤢ Full"}
        </TB>
      </span>
    </div>
  );
}

export default function RichTextEditor({ value, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceDraft, setSourceDraft] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: false,
          HTMLAttributes: { target: null, rel: null },
        },
      }),
      // Alignment applies to paragraphs and headings.
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      // Inline images. Kept clean with lazy-loading; alt comes from the Library.
      Image.configure({ inline: false, HTMLAttributes: { loading: "lazy", decoding: "async" } }),
      CtaButton,
      DetailsSummary,
      Details,
      // Without these the schema silently drops <table> on save.
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "",
    onUpdate({ editor: e }) {
      if (!sourceOpen) onChange(e.isEmpty ? "" : e.getHTML());
    },
    editorProps: {
      attributes: { class: "rte-content min-h-[420px] px-5 py-4 outline-none" },
    },
  });

  // Pull in outside changes (e.g. loading an item) without moving the cursor.
  useEffect(() => {
    if (!editor || sourceOpen) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor, sourceOpen]);

  // Escape leaves full screen.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  if (!editor) return null;

  function openSource() {
    setSourceDraft(editor.isEmpty ? "" : editor.getHTML());
    setSourceOpen(true);
  }

  function applySource() {
    // What the writer typed becomes the block's content verbatim — the
    // stored-equals-rendered rule, straight from the source box.
    editor.commands.setContent(sourceDraft || "", { emitUpdate: false });
    onChange(sourceDraft.trim());
    setSourceOpen(false);
  }

  function insertImage(images: MediaItem[]) {
    setPickerOpen(false);
    const img = images[0];
    if (!img) return;
    editor
      .chain()
      .focus()
      .setImage({ src: mediaSrc(img.url), alt: img.alt || img.originalName, title: img.title || undefined })
      .run();
  }

  const shell = fullscreen
    ? "fixed inset-0 z-50 m-0 flex flex-col rounded-none bg-white"
    : "rounded-lg border border-gray-300 overflow-hidden focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition";

  return (
    <div className={shell}>
      <Toolbar
        editor={editor}
        onPickImage={() => setPickerOpen(true)}
        sourceOpen={sourceOpen}
        onToggleSource={() => (sourceOpen ? applySource() : openSource())}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((f) => !f)}
      />

      {sourceOpen ? (
        <div className="flex flex-1 flex-col">
          <textarea
            value={sourceDraft}
            onChange={(e) => setSourceDraft(e.target.value)}
            spellCheck={false}
            className="min-h-[420px] flex-1 w-full resize-y bg-gray-900 px-4 py-3 font-mono text-[12px] leading-relaxed text-gray-100 outline-none"
            placeholder="<p>Type or paste HTML here…</p>"
          />
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2">
            <span className="text-xs text-gray-500">
              This exact HTML becomes the block's stored content.
            </span>
            <button
              type="button"
              onClick={applySource}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              Apply HTML
            </button>
          </div>
        </div>
      ) : (
        <div className={fullscreen ? "flex-1 overflow-y-auto" : ""}>
          <EditorContent editor={editor} />
        </div>
      )}

      <ImagePicker
        open={pickerOpen}
        title="Insert an image"
        onClose={() => setPickerOpen(false)}
        onSelect={insertImage}
      />
    </div>
  );
}
