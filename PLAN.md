# Gold Mine Content Editor — Implementation Plan

A live-scoring content editor for Celitix CMS. As the writer types, the draft is
scored 0–100 by the backend's IndscopeRank engine and rendered as a red/amber/green
checklist — without saving.

> Status: **planning only.** Nothing in this document has been built. (One file,
> `src/lib/api.ts`, was extended with typed API helpers in an earlier step; it is
> unused by any screen and can be kept or reverted.)

---

## 1. What I read

### Frontend (`celitix-cms`)
- **Stack:** React 19, react-router-dom 7, Vite 8, Tailwind CSS 4 (via `@tailwindcss/vite`), TypeScript. No component/UI libraries, no rich-text editor installed.
- **Brand tokens** (`src/index.css`): `--color-brand: #9b44b6` exposed to Tailwind as `bg-brand`, `text-brand`, plus `brand-dark`, `brand-light`, `brand-50`. Reuse these — do not hardcode hex.
- **Auth** (`src/lib/auth.ts`): JWT in `localStorage` under `celitix_cms_token`; helpers `getToken()`, `getAdmin()`, `isAuthenticated()`. Admin shape `{ id, email, name?, role }`.
- **API base** (`src/lib/api.ts`): `import.meta.env.VITE_API_URL ?? "http://localhost:3000"`. Login helper returns the parsed body on any status.
- **Routing** (`src/App.tsx`): `/login`, `/dashboard` (guarded by `ProtectedRoute`), catch-all redirect. Only two pages exist.
- **Dashboard** (`src/pages/Dashboard.tsx`): sidebar with `["Pages","Blogs","Case Studies","Guides"]` as **inert buttons** (comment: "not wired to real pages yet"), a header showing the admin, and a placeholder main area. This is the shell to grow from.

### Backend scoring endpoint (`celitix_backend-main`)
- **Route** (`src/routes/publicContent.router.ts`): `POST /api/public/score/preview` → `score.controller.preview`. **Public** (no auth middleware).
- **Controller** (`src/controller/score.controller.ts`): reads a **nested payload** and calls `scoreContent(...)`. Key mapping — the title that gets scored is `seo.title || title`, and `metaDescription` = `seo.description`:

  ```jsonc
  {
    "id": "<optional slug/id, excludes self from uniqueness check>",
    "type": "PAGE | POST | CASE_STUDY | GUIDE",   // upper-cased server-side
    "title": "<fallback title>",
    "slug": "how-to-...",
    "content": "<HTML body>",
    "faqs": [{ "question": "", "answer": "" }],
    "seo": {
      "title": "<meta title — this is what the 50–60 char check grades>",
      "description": "<meta description — 140–160 char check>",
      "focusKeyword": "...",
      "secondaryKeywords": ["a", "b"],   // engine wants 2–4
      "aiQueries": "comma, separated",
      "tldr": "...",
      "hasFaq": true
    }
  }
  ```

- **Response** (`src/services/scoring/indscopeRank.ts`): `{ status: true, score: <0-100>, checks: Check[] }` with ~29 scored checks. Each check:
  `{ id, label, status: "green"|"yellow"|"red", points: 10|5|0, message }`.
  Score = `round(sumPoints / (numChecks * 10) * 100)`.
- **The body is parsed as HTML** (`textUtils` extracts headings, paragraphs, list items, images, links). So the rich text editor **must emit real HTML** — `<h2>/<h3>`, `<ul>/<ol>/<li>`, `<a href>`, `<img alt>` — or those checks can never go green. Notable checks the editor's output directly controls: word count (POST ≥600, others ≥1200; max 3500), keyword density 0.5–2.5%, keyword in H2/H3, has a list, has accordion/tabs, ≥3 internal + 1–2 external links, a CTA button, question-style heading, paragraphs ≤60 words, list items ≤50 words.
- **⚠ Gotcha:** flat field names (`focusKeyword` at top level) are silently ignored — everything SEO must be nested under `seo`. This is the single easiest thing to get wrong.

### Backend save endpoints (for completeness / the Save step)
- `POST /api/content/create` and `PUT /api/content/update` (`src/routes/content.router.ts`): both behind `checkAdminAuth` (**`Authorization: Bearer <token>`**) and `upload.single("image")` (**multipart/form-data**), validated by Zod (`src/schema/content.schema.ts`).
- **Create requires an uploaded image file** (`if (!req.file) return errorHandler("No file uploaded", 400)`). Update's image is optional.
- **Required fields beyond the core editor set:** `category` (≥1), `tags` (≥1), `shortDesc` (**≥50 chars**), `content` (**≥100 chars**), and `seo.keywords` (≥1), `seo.title` (≥1), `seo.description` (≥1). `seo` and `faqs` are sent as **JSON strings** inside the form data (server `JSON.parse`s them).
- List `GET /api/content?type=POST&limit=` returns `{ items:[{ title, type, status, slug, seo, score:{score} }], total, page }`; sending the token also returns `DRAFT`/`HIDDEN` items.

---

## 2. Files to create / change

### New files
| File | Purpose |
|---|---|
| `src/lib/api.ts` | *(already extended)* typed helpers: `listContent`, `getContent`, `scorePreview`, `createContent`, `updateContent`, and shared types (`ContentDraft`, `ScoreCheck`, `ScoreResult`, `ContentListItem`, `TYPE_BY_LABEL`). |
| `src/components/Layout.tsx` | Shared sidebar + header extracted from Dashboard, so the list and editor reuse it. Sidebar items become `<NavLink>`s to `/content?type=...`. |
| `src/pages/ContentList.tsx` | Table (title, type, status, score badge), "New Content" button, Edit links; reads `?type=` from the URL to filter. |
| `src/pages/ContentEditor.tsx` | The main screen — two-column layout, owns the draft state, debounced scoring, and Save. |
| `src/components/editor/RichTextEditor.tsx` | Body editor emitting HTML (see §3). |
| `src/components/editor/ScorePanel.tsx` | Sticky right panel: big 0–100 number (color-graded) + list of checks with colored dots + messages. |
| `src/components/editor/SeoFields.tsx` | Meta title, meta description, focus keyword, secondary keywords (2–4 chips), AI queries, TL;DR, "has FAQ" toggle. Presented as a tab/section within the editor. |
| `src/hooks/useDebouncedScore.ts` | Debounce + fetch + cancel logic for live scoring (see §4). |

### Changed files
| File | Change |
|---|---|
| `src/App.tsx` | Add guarded routes: `/content` (list), `/content/new`, `/content/edit/:slug` (editor). |
| `src/pages/Dashboard.tsx` | Refactor its sidebar/header into `Layout.tsx` (or keep Dashboard and just extract the shared shell). Point sidebar items at real routes. |

No changes to `auth.ts`, `ProtectedRoute.tsx`, `Login.tsx`, `index.css`, or build config are required.

---

## 3. Rich text editor choice

**Recommendation: a small custom `contentEditable` editor (zero new dependencies).**

Rationale:
- **React 19 compatibility.** The popular option, `react-quill`, is not React-19 ready (it wraps a class component with legacy refs and has an unmaintained peer range); pulling it in risks install/runtime friction on this exact stack.
- **The scorer only needs clean, predictable HTML** — `<h2>/<h3>`, `<p>`, `<ul>/<ol>/<li>`, `<a href>`, `<img alt>`. A focused toolbar (Bold, H2, H3, bullet list, numbered list, link, and a "CTA button" insert) driven by `document.execCommand` (or a thin wrapper) covers every check the body influences, with full control over the emitted markup.
- **No bundle bloat, no lock-in**, and it matches the app's current "hand-rolled, Tailwind-styled" character.

**If you prefer a library instead, my pick is [Tiptap](https://tiptap.dev) (`@tiptap/react` + `@tiptap/starter-kit`):** it is genuinely React-19 compatible, headless (so it styles cleanly in brand purple), and gives structured HTML output plus easy custom nodes (e.g. an FAQ/accordion block, which would satisfy the `has_accordion` check natively). Trade-off: ~3 new dependencies and a bit more wiring. **Open question for you below.**

Either way, the editor's contract is the same: **value in = HTML string, onChange out = HTML string**, so it can be swapped later without touching the scoring or save code.

---

## 4. Wiring the live debounced scoring

Data flow: **editor state → debounce (~800ms) → `POST /score/preview` → render panel.**

1. `ContentEditor` holds the full `ContentDraft` in state (title, slug, shortDesc, HTML content, and the nested `seo` fields + faqs).
2. A `useDebouncedScore(draft)` hook:
   - On every draft change, starts/reset an ~800ms timer (so scoring fires after the writer pauses, not on each keystroke).
   - When it fires, calls `scorePreview(draft)` which maps state into the **nested `seo` payload** shape above and POSTs it (no token needed).
   - **Cancels in-flight/stale requests** with an `AbortController`, and guards against out-of-order responses (ignore a response whose request is no longer the latest — e.g. track a monotonically increasing request id). This prevents an old, slow response from overwriting a newer score.
   - Exposes `{ score, checks, loading, error }`.
3. `ScorePanel` renders `score` big and color-graded (red < 50, amber 50–79, green ≥ 80 — thresholds TBD) and maps `checks` to rows: a dot colored by `check.status` + `check.label` + `check.message`. Panel is `sticky top-...` in the right column.
4. **Slug** auto-generates from the title (lowercase, spaces→hyphens, strip punctuation) until the user edits the slug manually, after which it stays put. Slug feeds both the `focus_in_slug` check and the save payload.
5. Scoring is **fully decoupled from Save** — typing never writes to the DB; only the explicit Save button does.

Edge handling: empty/near-empty drafts still score (the endpoint returns a low score, not an error); show a neutral state before the first response; on network error show a small "couldn't reach scorer" note in the panel without blocking editing.

---

## 5. Save flow (for the later step)

- Build `multipart/form-data`: scalar fields plus `seo` and `faqs` as `JSON.stringify`'d strings, and the **image** file. Send `Authorization: Bearer <getToken()>`; **do not set `Content-Type`** (let the browser set the multipart boundary).
- **New content:** require a featured image (backend rejects create without one) → `POST /api/content/create`.
- **Edit:** image optional → `PUT /api/content/update` with `id` = the item's slug.
- Enforce the backend minimums in the UI *before* submit (shortDesc ≥50, content ≥100, category/tags present, seo.title/description/keywords present) with inline validation, so users get friendly errors instead of a 400. Derive `seo.keywords` from focus + secondary keywords if we don't want a separate field.
- Surface `{ status, message }` clearly: green success toast/banner with the returned score; red banner with the server message on failure (409 slug clash, 401 token expired, 400 validation).

---

## 6. Risks & open questions

**For you to decide:**
1. **Rich text editor:** custom zero-dep editor (my recommendation) vs. Tiptap (nicer, +3 deps, native accordion/FAQ block)? Tonight I built nothing, so either is open.
2. **Featured image on create is mandatory backend-side.** The original scope didn't mention an image field. OK to add a required "Featured image" upload to the New Content form? (Otherwise create will 400.)
3. **Extra required fields** — `category` and `tags` are required by the API but weren't in the scope. Add simple fields for them, or hardcode sensible defaults (e.g. category = the type, tags = the focus keyword)?
4. **Score color thresholds** — what cutoffs do you want for red/amber/green on the big number (I've assumed <50 / 50–79 / ≥80)?

**Technical risks:**
- **Payload shape is easy to get wrong** — SEO fields *must* be nested under `seo`; flat fields are ignored silently (no error, just a stuck-low score). Covered by the typed `scorePreview` mapper.
- **HTML-dependent checks** — several checks (accordion/tabs, CTA button, internal/external links, images-in-all-4-fields) can only go green if the editor can produce that markup/metadata. Some (e.g. "2 images with focus in all 4 fields", "2 images per secondary keyword") depend on a **media manager** that doesn't exist yet — those checks may be **unreachable in this session** and will stay amber/red by design. Worth setting expectations that a perfect 100 isn't attainable without the media metadata UI.
- **CORS / ports:** `vite.config.ts` pins the dev server to `5173` (`strictPort`) because the backend's CORS allow-list includes it. Don't change the port. The public score endpoint needs to allow the same origin — verify it's covered by CORS (it's a POST with JSON).
- **Auth expiry:** there's no refresh flow; an expired token will 401 on save. Handle by showing the error and (optionally) bouncing to `/login`.
- **`type` casing:** backend upper-cases `type`; keep the UI values as `PAGE/POST/CASE_STUDY/GUIDE` internally and map sidebar labels via `TYPE_BY_LABEL`.

---

## 7. Suggested build order (when you give the go-ahead)
1. API helpers + types *(done)* → 2. Shared `Layout` + `/content` list with type filter → 3. Editor shell (two columns, state, auto-slug) → 4. Rich text editor → 5. Live debounced scoring + `ScorePanel` → 6. SEO section + Save (create/update, image, validation, success/error states).
