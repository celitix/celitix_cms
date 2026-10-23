// Two custom nodes that exist purely so the writer can produce markup the
// IndscopeRank engine looks for. Both mirror the engine's own regexes:
//
//   hasCtaButton  ->  /<button|class="[^"]*(btn|button|cta)|role="button"/i
//   hasAccordion  ->  /<details|accordion|data-accordion|role="tab"|class="[^"]*(tab|accordion|toggle)/i
//
// Without these, the `cta` and `has_accordion` checks can never go green no
// matter how well the piece is written.

import { Node, mergeAttributes } from "@tiptap/react";

/**
 * A call-to-action link rendered as `<a class="cta-button" href="…">Label</a>`.
 * Block-level with editable text so the label can be typed inline; the href
 * lives in an attribute and is set from the toolbar.
 */
export const CtaButton = Node.create({
  name: "ctaButton",
  group: "block",
  content: "text*",
  marks: "",
  defining: true,

  addAttributes() {
    return {
      href: {
        default: "#",
        parseHTML: (el: HTMLElement) => el.getAttribute("href") ?? "#",
        renderHTML: (attrs: Record<string, unknown>) => ({ href: attrs.href }),
      },
    };
  },

  parseHTML() {
    // Priority must beat the Link mark's `a[href]` rule (default 50), or
    // reloading a saved item turns every CTA back into an ordinary link.
    return [{ tag: "a.cta-button", priority: 100 }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { class: "cta-button" }), 0];
  },
});

/** The clickable question line of an accordion: `<summary>…</summary>`. */
export const DetailsSummary = Node.create({
  name: "detailsSummary",
  content: "inline*",
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "summary" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["summary", mergeAttributes(HTMLAttributes), 0];
  },
});

/**
 * A native `<details>` accordion — a summary line followed by one or more
 * blocks. Rendered with `open` so it stays expanded while editing.
 */
export const Details = Node.create({
  name: "details",
  group: "block",
  content: "detailsSummary block+",
  defining: true,

  parseHTML() {
    return [{ tag: "details" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["details", mergeAttributes(HTMLAttributes, { open: "" }), 0];
  },
});
