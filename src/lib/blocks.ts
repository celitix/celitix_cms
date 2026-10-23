/**
 * The editor block model.
 *
 * ONE SOURCE OF TRUTH. Blocks compile down to the `content` HTML string, and
 * that string is the only copy that gets stored. Reopening an item parses the
 * HTML back into blocks. There is deliberately no second `blocks` column:
 *
 *   - the scorer reads `content`, so it grades exactly what ships
 *   - the frontend renders `content`, so the page shows exactly what scored
 *   - there is no second store that can silently disagree with the first
 *
 * That is the Money Pilot lesson applied to the editor: the CMS cannot hold a
 * value the page doesn't render, because there is only one value.
 *
 * Every block is marked in the HTML with `data-gm-block="<type>"`. Anything
 * without that marker is ordinary body HTML and becomes a Text block, which is
 * what makes all existing saved content open correctly in the new editor.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** The 11 blocks of Section 4A. Two are built; the rest land in this phase. */
export type BlockType =
  | "aiOverview"
  | "text"
  | "imageText"
  | "cta"
  | "html"
  | "iconBullets"
  | "accordion"
  | "video"
  | "audio"
  | "grid"
  | "author"
  | "raw";

export type HeadingLevel = 2 | 3;

/**
 * Block 1 — AI Overview Answer. Question heading plus a direct answer of
 * roughly 120 words, split into paragraphs.
 *
 * `paragraphs` is an array rather than one string on purpose: the engine fails
 * any paragraph over 60 words, so a single 120-word answer would score the
 * block red on the paragraph check. Splitting is structural, not cosmetic.
 */
export type AiOverviewBlock = {
  id: string;
  type: "aiOverview";
  question: string;
  level: HeadingLevel;
  paragraphs: string[];
};

/** Block 2 — Text. Rich text from Tiptap, stored as its own HTML. */
export type TextBlock = {
  id: string;
  type: "text";
  html: string;
};

/**
 * Blocks 3 and 4 — Image Left + Text and Text + Image Right. One block with a
 * `side` flag rather than two near-identical ones: the markup is the same, only
 * the order differs, and two copies would be two places to fix a bug.
 *
 * The four metadata fields are copied onto the block, not just referenced by
 * `mediaId`. The scoring engine reads its 4-field image check from the payload's
 * `media` array, so the editor has to be able to hand over alt/title/caption/
 * description without a round-trip to the Media table — and the saved HTML
 * carries all four too, so the page source shows what the CMS claims.
 */
export type ImageTextBlock = {
  id: string;
  type: "imageText";
  /** Which side the image sits on. `left` = block 3, `right` = block 4. */
  side: "left" | "right";
  /** Library id, kept so the block can be relinked after a reload. */
  mediaId: string | null;
  /** Server-relative url as stored in the Media table. */
  url: string;
  alt: string;
  title: string;
  caption: string;
  description: string;
  width: number | null;
  height: number | null;
  /** Optional CSS display width, e.g. "320px" or "50%". Empty = natural/full. */
  displayWidth?: string;
  heading: string;
  level: HeadingLevel;
  paragraphs: string[];
  /** Rich body HTML from the shared editor. When set it supersedes paragraphs. */
  bodyHtml?: string;
  /**
   * True when this image is above the fold. Standards 2.4: lazy-load below the
   * fold, never lazy-load the LCP image. The author knows which it is; guessing
   * from block position would be wrong the moment a block moves.
   */
  aboveFold: boolean;
};

/**
 * Not a palette block. A `data-gm-block` element of a type this build doesn't
 * know — content saved by a newer version of the CMS. Held verbatim and shown
 * read-only so an older session cannot destroy a newer session's work by
 * opening a page and saving it. Without this, unknown markup would fall into a
 * Text block, pass through Tiptap, and be stripped without warning.
 */
export type RawBlock = {
  id: string;
  type: "raw";
  markerType: string;
  html: string;
};

/**
 * Raw HTML block — first-class, palette-droppable. Holds hand-authored HTML
 * (e.g. a designed section pasted in), rendered verbatim inside THIS entry only.
 * Scripts and inline event handlers are stripped on save for safety; all other
 * markup, classes and inline styles are preserved so the design renders as built.
 */
export type HtmlBlock = {
  id: string;
  type: "html";
  html: string;
};

/**
 * Block 8 - Button (CTA). A call-to-action link rendered with the `cta-button`
 * class the engine's cta check looks for (/class="[^"]*(btn|button|cta)/), so a
 * call to action can stand between sections rather than only inside a Text block.
 */
export type CtaButtonBlock = {
  id: string;
  type: "cta";
  label: string;
  href: string;
  style: "primary" | "secondary";
  align: "left" | "center" | "right";
  /** Optional custom button colour (hex). Empty = use the theme default. */
  color: string;
};

/**
 * Block 5 - Icon Bullets. A headline over short, scannable points, each with a
 * leading icon. AI engines lift list structures; the engine fails any list item
 * over 50 words, so items are authored one per row with live counts.
 */
export type IconBulletsItem = { icon: string; text: string };
export type IconBulletsBlock = {
  id: string;
  type: "iconBullets";
  heading: string;
  level: HeadingLevel;
  items: IconBulletsItem[];
};

/**
 * Block 9 - Accordion (FAQ). Native <details> items - exactly what the engine's
 * has_accordion check matches (/<details/) - which also feed FAQPage schema
 * through collectQaPairs, with questions that are the same characters the reader
 * sees.
 */
export type AccordionItem = { question: string; answer: string };
export type AccordionBlock = {
  id: string;
  type: "accordion";
  items: AccordionItem[];
};

/** Block 6 - Video Embed. YouTube/Vimeo/direct file. Feeds VideoObject schema. */
export type VideoBlock = {
  id: string;
  type: "video";
  url: string;
  title: string;
  caption: string;
};

/** Block 7 - Audio Embed. A native <audio> player. Feeds AudioObject schema. */
export type AudioBlock = {
  id: string;
  type: "audio";
  url: string;
  title: string;
  caption: string;
};

/** Block 10 - Multi-Column Grid. 2-4 columns of heading+text. AI engines lift these. */
export type GridCell = { heading: string; text: string };
export type GridBlock = {
  id: string;
  type: "grid";
  columns: 2 | 3 | 4;
  cells: GridCell[];
};

/**
 * Block 11 - Author Bio. The E-E-A-T signal from Standards 2.8: a named author
 * with a job title and a 20+ word bio. Feeds Person / author schema.
 */
export type AuthorBlock = {
  id: string;
  type: "author";
  name: string;
  role: string;
  bio: string;
  url: string;
  mediaId: string | null;
  alt: string;
};

export type Block =
  | AiOverviewBlock
  | TextBlock
  | ImageTextBlock
  | CtaButtonBlock
  | IconBulletsBlock
  | AccordionBlock
  | VideoBlock
  | AudioBlock
  | GridBlock
  | AuthorBlock
  | HtmlBlock
  | RawBlock;

export type BlockIssue = {
  /** `error` = this will cost points. `warn` = worth a look. */
  level: "error" | "warn";
  message: string;
};

/* ------------------------------------------------------------------ */
/* Engine constants                                                    */
/* ------------------------------------------------------------------ */

/** Engine caps: every paragraph 60 words, every list item 50. */
export const MAX_PARAGRAPH_WORDS = 60;
export const MAX_LIST_ITEM_WORDS = 50;

/** The AI Overview answer window. "~120 words" from the standards doc. */
export const AI_ANSWER_MIN_WORDS = 90;
export const AI_ANSWER_MAX_WORDS = 140;

/**
 * Openers the engine accepts as a question-style heading. One AI Overview
 * block with a compliant question satisfies that check on its own.
 */
const QUESTION_OPENERS = [
  "how",
  "what",
  "why",
  "when",
  "where",
  "which",
  "who",
  "can",
  "does",
  "do",
  "is",
  "are",
  "should",
];

/** Palette metadata. Only built blocks appear here — no dead buttons. */
export const BLOCK_META: Record<BlockType, { label: string; blurb: string }> = {
  aiOverview: {
    label: "AI Overview Answer",
    blurb: "Question heading plus a direct ~120-word answer. The block AI engines extract.",
  },
  text: {
    label: "Text",
    blurb: "Rich body text — headings, lists, links, CTA and FAQ nodes.",
  },
  imageText: {
    label: "Image + Text",
    blurb: "Two columns. The image carries all four metadata fields.",
  },
  cta: {
    label: "Button (CTA)",
    blurb: "A call-to-action button. Satisfies the engine's CTA check.",
  },
  iconBullets: {
    label: "Icon Bullets",
    blurb: "A headline over a scannable icon list. AI engines lift these.",
  },
  accordion: {
    label: "Accordion (FAQ)",
    blurb: "Expandable Q&A. Satisfies the accordion check and feeds FAQ schema.",
  },
  video: {
    label: "Video Embed",
    blurb: "YouTube, Vimeo or a direct video file. Feeds video schema.",
  },
  audio: {
    label: "Audio Embed",
    blurb: "A native audio player with a title and caption.",
  },
  grid: {
    label: "Multi-Column Grid",
    blurb: "2-4 columns of heading + text. A strong comparison layout.",
  },
  author: {
    label: "Author Bio",
    blurb: "Named author, role and bio. The E-E-A-T signal Google looks for.",
  },
  html: {
    label: "Raw HTML",
    blurb: "Paste hand-authored HTML — rendered as-is in this entry only.",
  },
  raw: {
    label: "Unrecognised block",
    blurb: "Saved by a newer version of the CMS. Preserved as-is.",
  },
};

/**
 * What the ADD BLOCK row offers. One entry per palette button, so the mirrored
 * image block can appear as the two blocks the spec names while staying one
 * implementation underneath.
 */
export type PaletteItem = {
  key: string;
  label: string;
  blurb: string;
  create: () => Block;
};

export const PALETTE: PaletteItem[] = [
  {
    key: "aiOverview",
    label: BLOCK_META.aiOverview.label,
    blurb: BLOCK_META.aiOverview.blurb,
    create: () => createBlock("aiOverview"),
  },
  {
    key: "text",
    label: BLOCK_META.text.label,
    blurb: BLOCK_META.text.blurb,
    create: () => createBlock("text"),
  },
  {
    key: "imageLeft",
    label: "Image Left + Text",
    blurb: "Image on the left, text on the right.",
    create: () => createImageTextBlock("left"),
  },
  {
    key: "imageRight",
    label: "Text + Image Right",
    blurb: "Text on the left, image on the right.",
    create: () => createImageTextBlock("right"),
  },
  {
    key: "cta",
    label: BLOCK_META.cta.label,
    blurb: BLOCK_META.cta.blurb,
    create: () => createCtaButtonBlock(),
  },
  {
    key: "html",
    label: BLOCK_META.html.label,
    blurb: BLOCK_META.html.blurb,
    create: () => createHtmlBlock(),
  },
  {
    key: "iconBullets",
    label: BLOCK_META.iconBullets.label,
    blurb: BLOCK_META.iconBullets.blurb,
    create: () => createIconBulletsBlock(),
  },
  {
    key: "accordion",
    label: BLOCK_META.accordion.label,
    blurb: BLOCK_META.accordion.blurb,
    create: () => createAccordionBlock(),
  },
  {
    key: "video",
    label: BLOCK_META.video.label,
    blurb: BLOCK_META.video.blurb,
    create: () => createVideoBlock(),
  },
  {
    key: "audio",
    label: BLOCK_META.audio.label,
    blurb: BLOCK_META.audio.blurb,
    create: () => createAudioBlock(),
  },
  {
    key: "grid",
    label: BLOCK_META.grid.label,
    blurb: BLOCK_META.grid.blurb,
    create: () => createGridBlock(),
  },
  {
    key: "author",
    label: BLOCK_META.author.label,
    blurb: BLOCK_META.author.blurb,
    create: () => createAuthorBlock(),
  },
];

/** Section 4A blocks not yet built. Listed as text, never as a button. */
export const NOT_YET_BUILT: string[] = [];

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

let idCounter = 0;

/**
 * Ids are editor-session only — they are never serialised, and parsing
 * regenerates them. `randomUUID` is unavailable over plain http on some
 * browsers, so there is a counter fallback.
 */
export function newBlockId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  idCounter += 1;
  return `blk-${Date.now()}-${idCounter}`;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
}

/** Word count of an HTML fragment — tags out, entities collapsed. */
export function countWordsInHtml(html: string): number {
  return countWords(
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&[a-z]+;/gi, " "),
  );
}

export function sanitizeEmbeddedHtml(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseFragment(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
}

export function createImageTextBlock(side: "left" | "right"): ImageTextBlock {
  return {
    id: newBlockId(),
    type: "imageText",
    side,
    mediaId: null,
    url: "",
    alt: "",
    title: "",
    caption: "",
    description: "",
    width: null,
    height: null,
    heading: "",
    level: 2,
    paragraphs: [""],
    bodyHtml: "",
    displayWidth: "",
    aboveFold: false,
  };
}

export function createBlock(type: "aiOverview" | "text"): Block {
  if (type === "aiOverview") {
    return {
      id: newBlockId(),
      type: "aiOverview",
      question: "",
      level: 2,
      paragraphs: [""],
    };
  }
  return { id: newBlockId(), type: "text", html: "" };
}

export function createCtaButtonBlock(): CtaButtonBlock {
  return { id: newBlockId(), type: "cta", label: "", href: "", style: "primary", align: "left", color: "" };
}

export function createHtmlBlock(): HtmlBlock {
  return { id: newBlockId(), type: "html", html: "" };
}

export function createIconBulletsBlock(): IconBulletsBlock {
  return {
    id: newBlockId(),
    type: "iconBullets",
    heading: "",
    level: 2,
    items: [{ icon: "\u2713", text: "" }],
  };
}

export function createAccordionBlock(): AccordionBlock {
  return { id: newBlockId(), type: "accordion", items: [{ question: "", answer: "" }] };
}

export function createVideoBlock(): VideoBlock {
  return { id: newBlockId(), type: "video", url: "", title: "", caption: "" };
}

export function createAudioBlock(): AudioBlock {
  return { id: newBlockId(), type: "audio", url: "", title: "", caption: "" };
}

export function createGridBlock(): GridBlock {
  return {
    id: newBlockId(),
    type: "grid",
    columns: 3,
    cells: [
      { heading: "", text: "" },
      { heading: "", text: "" },
      { heading: "", text: "" },
    ],
  };
}

export function createAuthorBlock(): AuthorBlock {
  return {
    id: newBlockId(),
    type: "author",
    name: "",
    role: "",
    bio: "",
    url: "",
    mediaId: null,
    alt: "",
  };
}

/**
 * Normalises a video URL to what actually renders. YouTube and Vimeo become
 * privacy-friendly embed iframes; anything else is treated as a direct file and
 * played with <video>. The original url is kept on the section (data-gm-src) so
 * reopening the block shows what the author typed, not the rewritten embed.
 */
export function videoEmbed(url: string): { kind: "iframe" | "file"; src: string } {
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
  return { kind: "file", src: u };
}

/* ------------------------------------------------------------------ */
/* Serialise: blocks -> the HTML that gets stored and rendered          */
/* ------------------------------------------------------------------ */

/**
 * One block to HTML. This output is what the database stores, what the scorer
 * grades, and what appears in page source. It is not a preview of something
 * else that gets generated later.
 *
 * The question text lives in the heading only — not duplicated into a data
 * attribute — so there is no way for the marker and the visible text to drift
 * apart. Google's FAQ guidance requires schema questions to match visible
 * content; here they are the same characters.
 */
export function serializeBlock(block: Block): string {
  switch (block.type) {
    case "aiOverview": {
      const question = block.question.trim();
      const paragraphs = block.paragraphs
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join("");
      if (!question && !paragraphs) return "";

      const tag = `h${block.level}`;
      const heading = question
        ? `<${tag} class="gm-ai-overview__question">${escapeHtml(question)}</${tag}>`
        : "";

      return (
        `<section class="gm-block gm-ai-overview" data-gm-block="aiOverview">` +
        heading +
        `<div class="gm-ai-overview__answer">${paragraphs}</div>` +
        `</section>`
      );
    }

    case "imageText": {
      if (!block.url) return "";

      const attrs = [
        `src="${escapeHtml(block.url)}"`,
        `alt="${escapeHtml(block.alt)}"`,
      ];
      if (block.title.trim()) attrs.push(`title="${escapeHtml(block.title)}"`);
      if (block.width) attrs.push(`width="${block.width}"`);
      if (block.height) attrs.push(`height="${block.height}"`);
      // Below the fold: lazy. Above it: eager and prioritised, because the LCP
      // image must never be lazy-loaded (standards 2.4 / 2.7).
      attrs.push(
        block.aboveFold ? `loading="eager" fetchpriority="high"` : `loading="lazy"`,
      );
      attrs.push(`decoding="async"`);
      const dw = (block.displayWidth || "").trim();
      if (dw) attrs.push(`style="width:${escapeHtml(dw)};height:auto;max-width:100%"`);
      // The fourth metadata field has no native attribute. It rides along here
      // so all four are present in page source, not just in the Media table.
      if (block.description.trim()) {
        attrs.push(`data-gm-description="${escapeHtml(block.description)}"`);
      }

      const caption = block.caption.trim()
        ? `<figcaption>${escapeHtml(block.caption)}</figcaption>`
        : "";
      const figure = `<figure class="gm-image-text__figure"><img ${attrs.join(" ")}>${caption}</figure>`;

      const tag = `h${block.level}`;
      const heading = block.heading.trim()
        ? `<${tag}>${escapeHtml(block.heading.trim())}</${tag}>`
        : "";
      const rich = (block.bodyHtml ?? "").trim();
      const paragraphs = rich
        ? sanitizeEmbeddedHtml(block.bodyHtml as string)
        : block.paragraphs
            .map((para) => para.trim())
            .filter(Boolean)
            .map((para) => `<p>${escapeHtml(para)}</p>`)
            .join("");
      const body = `<div class="gm-image-text__body">${heading}${paragraphs}</div>`;

      // Source order follows the visual order, so the reading order and the
      // rendered order agree without CSS having to reverse anything.
      const inner = block.side === "left" ? figure + body : body + figure;
      const mediaAttr = block.mediaId
        ? ` data-gm-media-id="${escapeHtml(block.mediaId)}"`
        : "";

      return (
        `<section class="gm-block gm-image-text gm-image-text--${block.side}"` +
        ` data-gm-block="imageText" data-gm-side="${block.side}"${mediaAttr}>` +
        inner +
        `</section>`
      );
    }

    case "html":
      return `<div class="gm-block gm-html" data-gm-block="html">${sanitizeEmbeddedHtml(block.html)}</div>`;
    case "cta": {
      const label = block.label.trim();
      if (!label) return "";
      const href = block.href.trim() || "#";
      const cls = `cta-button cta-button--${block.style}`;
      const color = (block.color || "").trim();
      let aStyle = "";
      if (color) {
        aStyle =
          block.style === "secondary"
            ? ` style="color:${escapeHtml(color)};border-color:${escapeHtml(color)};background:transparent"`
            : ` style="background-color:${escapeHtml(color)};border-color:${escapeHtml(color)};color:#fff"`;
      }
      return (
        `<section class="gm-block gm-cta" data-gm-block="cta" data-gm-align="${block.align}" style="text-align:${block.align}">` +
        `<a class="${cls}" href="${escapeHtml(href)}" role="button"${aStyle}>${escapeHtml(label)}</a>` +
        `</section>`
      );
    }

    case "iconBullets": {
      const items = block.items
        .map((it) => ({ icon: it.icon.trim(), text: it.text.trim() }))
        .filter((it) => it.text);
      if (items.length === 0) return "";
      const tag = `h${block.level}`;
      const heading = block.heading.trim()
        ? `<${tag}>${escapeHtml(block.heading.trim())}</${tag}>`
        : "";
      const lis = items
        .map(
          (it) =>
            `<li class="gm-icon-bullets__item">` +
            `<span class="gm-icon-bullets__icon" aria-hidden="true">${escapeHtml(it.icon || "\u2713")}</span>` +
            `<span class="gm-icon-bullets__text">${escapeHtml(it.text)}</span>` +
            `</li>`,
        )
        .join("");
      return (
        `<section class="gm-block gm-icon-bullets" data-gm-block="iconBullets">` +
        heading +
        `<ul class="gm-icon-bullets__list">${lis}</ul>` +
        `</section>`
      );
    }

    case "accordion": {
      const items = block.items
        .map((it) => ({ question: it.question.trim(), answer: it.answer.trim() }))
        .filter((it) => it.question && it.answer);
      if (items.length === 0) return "";
      const details = items
        .map(
          (it) =>
            `<details class="gm-accordion__item">` +
            `<summary>${escapeHtml(it.question)}</summary>` +
            `<div class="gm-accordion__answer"><p>${escapeHtml(it.answer)}</p></div>` +
            `</details>`,
        )
        .join("");
      return `<section class="gm-block gm-accordion" data-gm-block="accordion">${details}</section>`;
    }

    case "video": {
      const url = block.url.trim();
      if (!url) return "";
      const { kind, src } = videoEmbed(url);
      const title = block.title.trim();
      const caption = block.caption.trim()
        ? `<figcaption>${escapeHtml(block.caption.trim())}</figcaption>`
        : "";
      const player =
        kind === "iframe"
          ? `<div class="gm-video__frame"><iframe src="${escapeHtml(src)}"` +
            (title ? ` title="${escapeHtml(title)}"` : "") +
            ` loading="lazy" frameborder="0"` +
            ` allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"` +
            ` allowfullscreen></iframe></div>`
          : `<video class="gm-video__file" controls preload="none" src="${escapeHtml(src)}"` +
            (title ? ` title="${escapeHtml(title)}"` : "") +
            `></video>`;
      return (
        `<section class="gm-block gm-video" data-gm-block="video" data-gm-src="${escapeHtml(url)}">` +
        player +
        caption +
        `</section>`
      );
    }

    case "audio": {
      const url = block.url.trim();
      if (!url) return "";
      const title = block.title.trim()
        ? `<p class="gm-audio__title">${escapeHtml(block.title.trim())}</p>`
        : "";
      const caption = block.caption.trim()
        ? `<figcaption>${escapeHtml(block.caption.trim())}</figcaption>`
        : "";
      return (
        `<section class="gm-block gm-audio" data-gm-block="audio">` +
        title +
        `<audio class="gm-audio__player" controls preload="none" src="${escapeHtml(url)}"></audio>` +
        caption +
        `</section>`
      );
    }

    case "grid": {
      const cells = block.cells
        .map((c) => ({ heading: c.heading.trim(), text: c.text.trim() }))
        .filter((c) => c.heading || c.text);
      if (cells.length === 0) return "";
      const inner = cells
        .map(
          (c) =>
            `<div class="gm-grid__cell">` +
            (c.heading ? `<h3 class="gm-grid__heading">${escapeHtml(c.heading)}</h3>` : "") +
            (c.text ? `<p class="gm-grid__text">${escapeHtml(c.text)}</p>` : "") +
            `</div>`,
        )
        .join("");
      return (
        `<section class="gm-block gm-grid gm-grid--${block.columns}"` +
        ` data-gm-block="grid" data-gm-cols="${block.columns}">` +
        inner +
        `</section>`
      );
    }

    case "author": {
      const name = block.name.trim();
      const bio = block.bio.trim();
      if (!name && !bio) return "";
      const photo = block.url.trim()
        ? `<img class="gm-author__photo" src="${escapeHtml(block.url.trim())}" alt="${escapeHtml(block.alt || name)}" loading="lazy" decoding="async">`
        : "";
      const role = block.role.trim()
        ? `<p class="gm-author__role">${escapeHtml(block.role.trim())}</p>`
        : "";
      const mediaAttr = block.mediaId ? ` data-gm-media-id="${escapeHtml(block.mediaId)}"` : "";
      return (
        `<section class="gm-block gm-author" data-gm-block="author"${mediaAttr}>` +
        photo +
        `<div class="gm-author__body">` +
        `<p class="gm-author__name">${escapeHtml(name)}</p>` +
        role +
        `<p class="gm-author__bio">${escapeHtml(bio)}</p>` +
        `</div>` +
        `</section>`
      );
    }

    // Text blocks are emitted bare. No wrapper element, so the body HTML looks
    // exactly as it did before blocks existed and every previously saved item
    // round-trips unchanged.
    case "text":
      return block.html.trim();

    case "raw":
      return block.html;
  }
}

/** The full body HTML. Blocks joined in order, empties dropped. */
export function serializeBlocks(blocks: Block[]): string {
  return blocks
    .map(serializeBlock)
    .filter((html) => html.trim().length > 0)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Parse: stored HTML -> blocks                                        */
/* ------------------------------------------------------------------ */

function readAiOverview(el: Element): AiOverviewBlock {
  const heading = el.querySelector(".gm-ai-overview__question");
  const level: HeadingLevel = heading?.tagName.toLowerCase() === "h3" ? 3 : 2;

  const paragraphs = Array.from(el.querySelectorAll(".gm-ai-overview__answer p"))
    .map((p) => (p.textContent ?? "").trim())
    .filter(Boolean);

  return {
    id: newBlockId(),
    type: "aiOverview",
    question: (heading?.textContent ?? "").trim(),
    level,
    paragraphs: paragraphs.length > 0 ? paragraphs : [""],
  };
}

function readImageText(el: Element): ImageTextBlock {
  const img = el.querySelector("img");
  const heading = el.querySelector(".gm-image-text__body h2, .gm-image-text__body h3");
  const width = Number(img?.getAttribute("width") ?? "");
  const height = Number(img?.getAttribute("height") ?? "");
  const loading = img?.getAttribute("loading");

  const paragraphs = Array.from(el.querySelectorAll(".gm-image-text__body p"))
    .map((para) => (para.textContent ?? "").trim())
    .filter(Boolean);

  let bodyHtml = "";
  const bodyEl = el.querySelector(".gm-image-text__body");
  if (bodyEl) {
    const clone = bodyEl.cloneNode(true) as Element;
    clone.querySelectorAll("h2, h3").forEach((h) => h.remove());
    bodyHtml = clone.innerHTML.trim();
  }

  return {
    id: newBlockId(),
    type: "imageText",
    side: el.getAttribute("data-gm-side") === "right" ? "right" : "left",
    mediaId: el.getAttribute("data-gm-media-id"),
    url: img?.getAttribute("src") ?? "",
    alt: img?.getAttribute("alt") ?? "",
    title: img?.getAttribute("title") ?? "",
    caption: (el.querySelector("figcaption")?.textContent ?? "").trim(),
    description: img?.getAttribute("data-gm-description") ?? "",
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null,
    displayWidth: ((): string => {
      const st = img?.getAttribute("style") ?? "";
      const m = st.match(/width\s*:\s*([0-9.]+(?:px|%))/i);
      return m ? m[1] : "";
    })(),
    heading: (heading?.textContent ?? "").trim(),
    level: heading?.tagName.toLowerCase() === "h3" ? 3 : 2,
    paragraphs: paragraphs.length > 0 ? paragraphs : [""],
    bodyHtml,
    aboveFold: loading === "eager",
  };
}

function readVideo(el: Element): VideoBlock {
  const media = el.querySelector("iframe, video");
  return {
    id: newBlockId(),
    type: "video",
    url: el.getAttribute("data-gm-src") ?? media?.getAttribute("src") ?? "",
    title: media?.getAttribute("title") ?? "",
    caption: (el.querySelector("figcaption")?.textContent ?? "").trim(),
  };
}

function readAudio(el: Element): AudioBlock {
  return {
    id: newBlockId(),
    type: "audio",
    url: el.querySelector("audio")?.getAttribute("src") ?? "",
    title: (el.querySelector(".gm-audio__title")?.textContent ?? "").trim(),
    caption: (el.querySelector("figcaption")?.textContent ?? "").trim(),
  };
}

function readGrid(el: Element): GridBlock {
  const colsAttr = Number(el.getAttribute("data-gm-cols") ?? "3");
  const columns = (colsAttr === 2 || colsAttr === 4 ? colsAttr : 3) as 2 | 3 | 4;
  const cells = Array.from(el.querySelectorAll(".gm-grid__cell")).map((c) => ({
    heading: (c.querySelector(".gm-grid__heading")?.textContent ?? "").trim(),
    text: (c.querySelector(".gm-grid__text")?.textContent ?? "").trim(),
  }));
  return {
    id: newBlockId(),
    type: "grid",
    columns,
    cells: cells.length > 0 ? cells : [{ heading: "", text: "" }],
  };
}

function readAuthor(el: Element): AuthorBlock {
  const img = el.querySelector("img.gm-author__photo");
  return {
    id: newBlockId(),
    type: "author",
    name: (el.querySelector(".gm-author__name")?.textContent ?? "").trim(),
    role: (el.querySelector(".gm-author__role")?.textContent ?? "").trim(),
    bio: (el.querySelector(".gm-author__bio")?.textContent ?? "").trim(),
    url: img?.getAttribute("src") ?? "",
    mediaId: el.getAttribute("data-gm-media-id"),
    alt: img?.getAttribute("alt") ?? "",
  };
}

function readCtaButton(el: Element): CtaButtonBlock {
  const a = el.querySelector("a");
  const cls = a?.getAttribute("class") ?? "";
  return {
    id: newBlockId(),
    type: "cta",
    label: (a?.textContent ?? "").trim(),
    href: a?.getAttribute("href") ?? "",
    style: cls.includes("cta-button--secondary") ? "secondary" : "primary",
    color: ((): string => {
      const st = a?.getAttribute("style") ?? "";
      const m = st.match(/(?:background-color|color)\s*:\s*(#[0-9a-fA-F]{3,8}|rgb[^;]+)/);
      return m ? m[1].trim() : "";
    })(),
    align: ((): "left" | "center" | "right" => {
      const a = el.getAttribute("data-gm-align");
      return a === "center" || a === "right" ? a : "left";
    })(),
  };
}

function readIconBullets(el: Element): IconBulletsBlock {
  const heading = el.querySelector("h2, h3");
  const items = Array.from(el.querySelectorAll(".gm-icon-bullets__item")).map((li) => ({
    icon: (li.querySelector(".gm-icon-bullets__icon")?.textContent ?? "").trim(),
    text: (li.querySelector(".gm-icon-bullets__text")?.textContent ?? "").trim(),
  }));
  return {
    id: newBlockId(),
    type: "iconBullets",
    heading: (heading?.textContent ?? "").trim(),
    level: heading?.tagName.toLowerCase() === "h3" ? 3 : 2,
    items: items.length > 0 ? items : [{ icon: "\u2713", text: "" }],
  };
}

function readAccordion(el: Element): AccordionBlock {
  const items = Array.from(el.querySelectorAll("details.gm-accordion__item")).map((d) => ({
    question: (d.querySelector("summary")?.textContent ?? "").trim(),
    answer: (d.querySelector(".gm-accordion__answer")?.textContent ?? "").trim(),
  }));
  return {
    id: newBlockId(),
    type: "accordion",
    items: items.length > 0 ? items : [{ question: "", answer: "" }],
  };
}

/**
 * Stored HTML back into blocks.
 *
 * Walks the top level in document order. A marked element becomes its block;
 * consecutive unmarked nodes collect into one Text block. That second rule is
 * what makes every item saved before this change open as a normal Text block
 * instead of an empty editor.
 */
export function parseBlocks(html: string): Block[] {
  if (!html || !html.trim()) return [];

  const doc = parseFragment(html);
  const blocks: Block[] = [];
  let buffer: string[] = [];

  function flushText() {
    const inner = buffer.join("").trim();
    buffer = [];
    if (inner) blocks.push({ id: newBlockId(), type: "text", html: inner });
  }

  for (const node of Array.from(doc.body.childNodes)) {
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : null;
    const marker = el?.getAttribute("data-gm-block");

    if (!marker) {
      buffer.push(el ? el.outerHTML : (node.textContent ?? ""));
      continue;
    }

    flushText();

    if (marker === "aiOverview") {
      blocks.push(readAiOverview(el as Element));
      continue;
    }

    if (marker === "imageText") {
      blocks.push(readImageText(el as Element));
      continue;
    }

    if (marker === "cta") {
      blocks.push(readCtaButton(el as Element));
      continue;
    }

    if (marker === "html") {
      blocks.push({ id: newBlockId(), type: "html", html: (el as Element).innerHTML });
      continue;
    }

    if (marker === "iconBullets") {
      blocks.push(readIconBullets(el as Element));
      continue;
    }

    if (marker === "accordion") {
      blocks.push(readAccordion(el as Element));
      continue;
    }

    if (marker === "video") {
      blocks.push(readVideo(el as Element));
      continue;
    }

    if (marker === "audio") {
      blocks.push(readAudio(el as Element));
      continue;
    }

    if (marker === "grid") {
      blocks.push(readGrid(el as Element));
      continue;
    }

    if (marker === "author") {
      blocks.push(readAuthor(el as Element));
      continue;
    }

    // A marked block this build doesn't implement. Keep it byte-for-byte.
    blocks.push({
      id: newBlockId(),
      type: "raw",
      markerType: marker,
      html: (el as Element).outerHTML,
    });
  }

  flushText();
  return blocks;
}

/* ------------------------------------------------------------------ */
/* List operations                                                     */
/* ------------------------------------------------------------------ */

export function updateBlock(blocks: Block[], id: string, patch: Partial<Block>): Block[] {
  return blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b));
}

export function removeBlock(blocks: Block[], id: string): Block[] {
  return blocks.filter((b) => b.id !== id);
}

/** Moves one block up or down. Out-of-range moves return the list untouched. */
export function moveBlock(blocks: Block[], id: string, direction: -1 | 1): Block[] {
  const from = blocks.findIndex((b) => b.id === id);
  if (from === -1) return blocks;
  const to = from + direction;
  if (to < 0 || to >= blocks.length) return blocks;

  const next = blocks.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function insertBlockAfter(blocks: Block[], id: string | null, block: Block): Block[] {
  if (id === null) return [...blocks, block];
  const at = blocks.findIndex((b) => b.id === id);
  if (at === -1) return [...blocks, block];
  const next = blocks.slice();
  next.splice(at + 1, 0, block);
  return next;
}

/* ------------------------------------------------------------------ */
/* Per-block summaries and issue detection                             */
/* ------------------------------------------------------------------ */

/** Header label. The image block names the side so it reads as the spec block. */
export function blockLabel(block: Block): string {
  if (block.type === "imageText") {
    return block.side === "left" ? "Image Left + Text" : "Text + Image Right";
  }
  return BLOCK_META[block.type].label;
}

/** The one-line description shown on a collapsed block header. */
export function blockSummary(block: Block): string {
  switch (block.type) {
    case "aiOverview": {
      const q = block.question.trim();
      const words = block.paragraphs.reduce((sum, p) => sum + countWords(p), 0);
      if (!q) return `No question yet - ${words} words of answer`;
      return `${q} - ${words} words`;
    }
    case "text": {
      const words = countWordsInHtml(block.html);
      if (words === 0) return "Empty";
      const text = block.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const snippet = text.length > 70 ? `${text.slice(0, 70)}...` : text;
      return `${words} words - ${snippet}`;
    }
    case "imageText": {
      const words = block.paragraphs.reduce((sum, para) => sum + countWords(para), 0);
      const where = block.side === "left" ? "Image left" : "Image right";
      if (!block.url) return `${where} - no image chosen yet`;
      return `${where} - ${block.heading.trim() || "no heading"} - ${words} words`;
    }
    case "html":
      return `<div class="gm-block gm-html" data-gm-block="html">${sanitizeEmbeddedHtml(block.html)}</div>`;
    case "cta": {
      const label = block.label.trim();
      if (!label) return "No button label yet";
      return `Button: "${label}" -> ${block.href.trim() || "no link"}`;
    }
    case "iconBullets": {
      const filled = block.items.filter((it) => it.text.trim()).length;
      return `${block.heading.trim() || "no heading"} - ${filled} bullet${filled === 1 ? "" : "s"}`;
    }
    case "accordion": {
      const filled = block.items.filter((it) => it.question.trim() && it.answer.trim()).length;
      return `${filled} question${filled === 1 ? "" : "s"}`;
    }
    case "video": {
      if (!block.url.trim()) return "No video URL yet";
      const { kind } = videoEmbed(block.url);
      return `${kind === "iframe" ? "Embed" : "File"}: ${block.title.trim() || block.url.trim()}`;
    }
    case "audio":
      return block.url.trim() ? `Audio: ${block.title.trim() || block.url.trim()}` : "No audio URL yet";
    case "grid": {
      const filled = block.cells.filter((c) => c.heading.trim() || c.text.trim()).length;
      return `${block.columns} columns - ${filled} cell${filled === 1 ? "" : "s"}`;
    }
    case "author":
      return block.name.trim() ? `${block.name.trim()}${block.role.trim() ? " - " + block.role.trim() : ""}` : "No author name yet";
    case "raw":
      return `Preserved "${block.markerType}" block - not editable in this build`;
  }
}

function aiOverviewIssues(block: AiOverviewBlock, focusKeyword: string): BlockIssue[] {
  const issues: BlockIssue[] = [];
  const question = block.question.trim();

  if (!question) {
    issues.push({ level: "error", message: "The question heading is empty." });
  } else {
    if (!question.endsWith("?")) {
      issues.push({ level: "warn", message: "Questions read better ending in a question mark." });
    }
    const firstWord = question.toLowerCase().split(/\s+/)[0]?.replace(/[^a-z]/g, "") ?? "";
    if (!QUESTION_OPENERS.includes(firstWord)) {
      issues.push({
        level: "warn",
        message:
          "Start with How, What or Why - that is what the engine counts as a question-style heading.",
      });
    }
    const kw = focusKeyword.trim().toLowerCase();
    if (kw && !question.toLowerCase().includes(kw)) {
      issues.push({
        level: "warn",
        message: `The focus keyword "${focusKeyword.trim()}" is not in this heading.`,
      });
    }
  }

  const paragraphs = block.paragraphs.map((p) => p.trim()).filter(Boolean);
  const words = paragraphs.reduce((sum, p) => sum + countWords(p), 0);

  if (words === 0) {
    issues.push({ level: "error", message: "The answer is empty." });
  } else if (words < AI_ANSWER_MIN_WORDS) {
    issues.push({
      level: "warn",
      message: `${words} words. Aim for ${AI_ANSWER_MIN_WORDS}-${AI_ANSWER_MAX_WORDS} - short answers get skipped over.`,
    });
  } else if (words > AI_ANSWER_MAX_WORDS) {
    issues.push({
      level: "warn",
      message: `${words} words. Over ${AI_ANSWER_MAX_WORDS} and engines tend to quote a competitor's tighter answer instead.`,
    });
  }

  paragraphs.forEach((p, i) => {
    const n = countWords(p);
    if (n > MAX_PARAGRAPH_WORDS) {
      issues.push({
        level: "error",
        message: `Paragraph ${i + 1} is ${n} words. The engine fails anything over ${MAX_PARAGRAPH_WORDS} - split it.`,
      });
    }
  });

  return issues;
}

function textIssues(block: TextBlock): BlockIssue[] {
  const issues: BlockIssue[] = [];
  if (countWordsInHtml(block.html) === 0) {
    issues.push({ level: "warn", message: "This block is empty and will not be saved." });
    return issues;
  }

  const doc = parseFragment(block.html);

  const longParagraphs = Array.from(doc.querySelectorAll("p")).filter(
    (p) => countWords(p.textContent ?? "") > MAX_PARAGRAPH_WORDS,
  ).length;
  if (longParagraphs > 0) {
    issues.push({
      level: "error",
      message: `${longParagraphs} paragraph${longParagraphs === 1 ? "" : "s"} over ${MAX_PARAGRAPH_WORDS} words - the engine fails the paragraph check.`,
    });
  }

  const longItems = Array.from(doc.querySelectorAll("li")).filter(
    (li) => countWords(li.textContent ?? "") > MAX_LIST_ITEM_WORDS,
  ).length;
  if (longItems > 0) {
    issues.push({
      level: "error",
      message: `${longItems} list item${longItems === 1 ? "" : "s"} over ${MAX_LIST_ITEM_WORDS} words.`,
    });
  }

  return issues;
}

function imageTextIssues(block: ImageTextBlock, focusKeyword: string): BlockIssue[] {
  const issues: BlockIssue[] = [];

  if (!block.url) {
    issues.push({
      level: "error",
      message: "No image chosen - this block will not be saved.",
    });
  } else {
    if (!block.alt.trim()) {
      issues.push({
        level: "error",
        message: "No ALT text. Every image needs one, and the engine checks it.",
      });
    }

    // The engine wants 2 images with the focus keyword in ALL FOUR fields.
    const missing = (
      [
        ["title", block.title],
        ["caption", block.caption],
        ["description", block.description],
      ] as const
    )
      .filter(([, value]) => !value.trim())
      .map(([name]) => name);

    if (missing.length > 0) {
      issues.push({
        level: "warn",
        message: `Missing ${missing.join(", ")}. The 4-field image check needs all of alt, title, caption and description - fix it in the Image Library so every page using this image benefits.`,
      });
    }

    const kw = focusKeyword.trim().toLowerCase();
    if (kw && !block.alt.toLowerCase().includes(kw)) {
      issues.push({
        level: "warn",
        message: `The ALT does not mention "${focusKeyword.trim()}".`,
      });
    }

    if (!block.width || !block.height) {
      issues.push({
        level: "warn",
        message:
          "No width/height on this image, so the page can shift as it loads (CLS). Re-upload or set the dimensions in the Library.",
      });
    }
  }

  const paragraphs = block.paragraphs.map((para) => para.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    issues.push({ level: "warn", message: "No text beside the image yet." });
  }
  paragraphs.forEach((para, i) => {
    const n = countWords(para);
    if (n > MAX_PARAGRAPH_WORDS) {
      issues.push({
        level: "error",
        message: `Paragraph ${i + 1} is ${n} words. The engine fails anything over ${MAX_PARAGRAPH_WORDS} - split it.`,
      });
    }
  });

  return issues;
}

function ctaIssues(block: CtaButtonBlock): BlockIssue[] {
  const issues: BlockIssue[] = [];
  if (!block.label.trim()) issues.push({ level: "error", message: "The button has no label." });
  const href = block.href.trim();
  if (!href) {
    issues.push({ level: "error", message: "The button has no link yet." });
  } else if (!href.startsWith("/") && !/^https?:\/\//i.test(href) && !href.startsWith("#")) {
    issues.push({
      level: "warn",
      message: "Use a path like /contact for internal links, or a full https:// address.",
    });
  }
  return issues;
}

function iconBulletsIssues(block: IconBulletsBlock): BlockIssue[] {
  const issues: BlockIssue[] = [];
  const items = block.items.filter((it) => it.text.trim());
  if (items.length === 0) {
    issues.push({ level: "error", message: "No bullet points yet - add at least one." });
  }
  items.forEach((it, i) => {
    const n = countWords(it.text);
    if (n > MAX_LIST_ITEM_WORDS) {
      issues.push({
        level: "error",
        message: `Bullet ${i + 1} is ${n} words. The engine fails list items over ${MAX_LIST_ITEM_WORDS} - shorten it.`,
      });
    }
  });
  if (!block.heading.trim()) {
    issues.push({ level: "warn", message: "No headline over the bullets." });
  }
  return issues;
}

function accordionIssues(block: AccordionBlock): BlockIssue[] {
  const issues: BlockIssue[] = [];
  const complete = block.items.filter((it) => it.question.trim() && it.answer.trim());
  if (complete.length === 0) {
    issues.push({
      level: "error",
      message: "No complete question and answer yet - this block will not be saved.",
    });
  }
  block.items.forEach((it, i) => {
    const q = it.question.trim();
    const a = it.answer.trim();
    if (q && !a) issues.push({ level: "error", message: `Question ${i + 1} has no answer.` });
    if (!q && a) issues.push({ level: "error", message: `Answer ${i + 1} has no question.` });
    if (q && !q.endsWith("?")) {
      issues.push({ level: "warn", message: `Question ${i + 1} reads better ending in "?".` });
    }
    if (a && countWords(a) > MAX_PARAGRAPH_WORDS) {
      issues.push({
        level: "warn",
        message: `Answer ${i + 1} is ${countWords(a)} words - the engine prefers under ${MAX_PARAGRAPH_WORDS}.`,
      });
    }
  });
  return issues;
}

function videoIssues(block: VideoBlock): BlockIssue[] {
  const issues: BlockIssue[] = [];
  if (!block.url.trim()) {
    issues.push({ level: "error", message: "No video URL yet - this block will not be saved." });
  }
  if (block.url.trim() && !block.title.trim()) {
    issues.push({ level: "warn", message: "Add a title - it feeds video schema and accessibility." });
  }
  return issues;
}

function audioIssues(block: AudioBlock): BlockIssue[] {
  const issues: BlockIssue[] = [];
  if (!block.url.trim()) {
    issues.push({ level: "error", message: "No audio URL yet - this block will not be saved." });
  }
  return issues;
}

function gridIssues(block: GridBlock): BlockIssue[] {
  const issues: BlockIssue[] = [];
  const filled = block.cells.filter((c) => c.heading.trim() || c.text.trim());
  if (filled.length < 2) {
    issues.push({ level: "warn", message: "A grid works best with at least 2 filled columns." });
  }
  block.cells.forEach((c, i) => {
    const n = countWords(c.text);
    if (n > MAX_PARAGRAPH_WORDS) {
      issues.push({
        level: "error",
        message: `Column ${i + 1} text is ${n} words. The engine fails anything over ${MAX_PARAGRAPH_WORDS} - shorten it.`,
      });
    }
  });
  return issues;
}

function authorIssues(block: AuthorBlock): BlockIssue[] {
  const issues: BlockIssue[] = [];
  if (!block.name.trim()) {
    issues.push({ level: "error", message: "The author has no name." });
  }
  const bioWords = countWords(block.bio);
  if (bioWords === 0) {
    issues.push({ level: "error", message: "The bio is empty." });
  } else if (bioWords < 20) {
    issues.push({
      level: "warn",
      message: `The bio is ${bioWords} words. Google's E-E-A-T guidance wants a real bio - aim for 20+.`,
    });
  }
  if (!block.role.trim()) {
    issues.push({ level: "warn", message: "No role/title - it strengthens the author signal." });
  }
  return issues;
}

export function blockIssues(block: Block, focusKeyword = ""): BlockIssue[] {
  switch (block.type) {
    case "imageText":
      return imageTextIssues(block, focusKeyword);
    case "aiOverview":
      return aiOverviewIssues(block, focusKeyword);
    case "text":
      return textIssues(block);
    case "cta":
      return ctaIssues(block);
    case "iconBullets":
      return iconBulletsIssues(block);
    case "accordion":
      return accordionIssues(block);
    case "video":
      return videoIssues(block);
    case "audio":
      return audioIssues(block);
    case "grid":
      return gridIssues(block);
    case "author":
      return authorIssues(block);
    case "html":
      return block.html.trim() === ""
        ? [{ level: "warn", message: "This Raw HTML block is empty — nothing will render." }]
        : [];
    case "raw":
      return [
        {
          level: "warn",
          message:
            "Saved by a newer version of the CMS. It is kept exactly as-is - edit it there, not here.",
        },
      ];
  }
}

/* ------------------------------------------------------------------ */
/* Schema feed (for the Phase 4 server-side JSON-LD)                   */
/* ------------------------------------------------------------------ */

export type BlockImageMeta = {
  alt: string;
  title: string;
  caption: string;
  description: string;
};

/**
 * The image metadata these blocks contribute to the scoring payload's `media`
 * array.
 *
 * This matters more than it looks. The engine's 4-field image check reads
 * `featuredImage` and `media` only — it does NOT get all four fields from the
 * `<img>` tags in the body. So an in-content image whose metadata never reaches
 * `media` is invisible to that check, and the score would sit amber while the
 * CMS showed a fully tagged image. Deduplicated by library id, since the same
 * image used twice is still one tagged asset.
 */
export function collectBlockImageMeta(blocks: Block[]): BlockImageMeta[] {
  const seen = new Set<string>();
  const out: BlockImageMeta[] = [];

  for (const block of blocks) {
    if (block.type !== "imageText" || !block.url) continue;
    const key = block.mediaId ?? block.url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      alt: block.alt,
      title: block.title,
      caption: block.caption,
      description: block.description,
    });
  }

  return out;
}

export type QaPair = { question: string; answer: string };

/**
 * The Q&A pairs these blocks contribute to FAQPage / QAPage schema.
 *
 * Both fields come from the same block that renders on the page, so the
 * schema can never claim a question the reader cannot see - which is exactly
 * what Google's FAQ guidance requires.
 *
 * Phase 4 note: the frontend renders the stored HTML directly and needs no
 * parsing. For schema it should run `parseBlocks`-equivalent logic server-side
 * (linkedom or cheerio, since DOMParser is browser-only) and feed this.
 */
export function collectQaPairs(blocks: Block[]): QaPair[] {
  const seen = new Set<string>();
  const pairs: QaPair[] = [];

  for (const block of blocks) {
    if (block.type !== "aiOverview") continue;

    const question = block.question.trim();
    const answer = block.paragraphs.map((p) => p.trim()).filter(Boolean).join(" ");
    if (!question || !answer) continue;

    // The engine flags duplicate questions, and duplicate mainEntity entries
    // fail Rich Results validation. Drop repeats rather than emit both.
    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    pairs.push({ question, answer });
  }

  // Accordion items are FAQs too. Same dedupe set, so a question asked in both
  // an AI Overview block and an accordion is emitted once.
  for (const block of blocks) {
    if (block.type !== "accordion") continue;
    for (const item of block.items) {
      const question = item.question.trim();
      const answer = item.answer.trim();
      if (!question || !answer) continue;
      const key = question.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ question, answer });
    }
  }

  return pairs;
}

export type VideoMeta = { url: string; title: string; caption: string };

/** VideoObject feed for Phase 4 JSON-LD. Deduplicated by URL. */
export function collectVideos(blocks: Block[]): VideoMeta[] {
  const seen = new Set<string>();
  const out: VideoMeta[] = [];
  for (const block of blocks) {
    if (block.type !== "video" || !block.url.trim()) continue;
    const key = block.url.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: key, title: block.title.trim(), caption: block.caption.trim() });
  }
  return out;
}

export type AuthorMeta = { name: string; role: string; bio: string; image: string };

/** Person / author feed for Phase 4 JSON-LD. First named author wins. */
export function collectAuthors(blocks: Block[]): AuthorMeta[] {
  const out: AuthorMeta[] = [];
  for (const block of blocks) {
    if (block.type !== "author" || !block.name.trim()) continue;
    out.push({
      name: block.name.trim(),
      role: block.role.trim(),
      bio: block.bio.trim(),
      image: block.url.trim(),
    });
  }
  return out;
}
