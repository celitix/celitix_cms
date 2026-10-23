/**
 * Wires the Image Library picker into the content editor.
 *
 * What changes:
 *  - Featured image + extra images are chosen from the Library instead of a
 *    raw file input.
 *  - Every picked image carries its four metadata fields into the draft's
 *    `media` array — which is exactly what the Gold Mine scorer reads for
 *    img_count, img_4field and sec_images. This is what turns those checks green.
 *  - On save, the featured image is fetched from the library and sent through
 *    the existing upload path, so no backend or api.ts change is needed.
 *
 * Run from the celitix-cms folder:  node patch-editor.js
 */
const fs = require("fs");

const FILE = "src/pages/ContentEditor.tsx";
if (!fs.existsSync(FILE)) {
  console.error("ERROR: run this from the celitix-cms folder (src/pages not found).");
  process.exit(1);
}

let s = fs.readFileSync(FILE, "utf8");
const before = s;
const applied = [];
const skipped = [];

function edit(name, marker, find, replace) {
  if (marker && s.includes(marker)) {
    skipped.push(name + " (already applied)");
    return;
  }
  if (!s.includes(find)) {
    skipped.push(name + " (ANCHOR NOT FOUND)");
    return;
  }
  s = s.replace(find, replace);
  applied.push(name);
}

/* ---------------- 1. imports ---------------- */
if (!s.includes("ImagePicker")) {
  edit(
    "1. imports",
    "ImagePicker",
    'import { PLACEHOLDER_IMAGE_NAME, placeholderImageFile } from "../lib/placeholderImage";',
    'import { PLACEHOLDER_IMAGE_NAME, placeholderImageFile } from "../lib/placeholderImage";\n' +
      'import ImagePicker from "../components/ImagePicker";\n' +
      'import { mediaSrc, metaFilledCount, type MediaItem } from "../lib/mediaApi";',
  );
} else {
  skipped.push("1. imports (already applied)");
}

/* ---------------- 2. state ---------------- */
edit(
  "2. state",
  "const [picked, setPicked]",
  "  const [imageFile, setImageFile] = useState<File | null>(null);",
  "  const [imageFile, setImageFile] = useState<File | null>(null);\n" +
    "  // Images chosen from the Library. The first one is the featured image;\n" +
    "  // all of them feed the draft's `media` array, which is what the scorer\n" +
    "  // reads for the image checks.\n" +
    "  const [picked, setPicked] = useState<MediaItem[]>([]);\n" +
    "  const [pickerOpen, setPickerOpen] = useState(false);",
);

/* ---------------- 3. scoring draft: real media metadata ---------------- */
edit(
  "3. scoring draft",
  "media: picked.map",
  `  const hasImage = Boolean(imageFile) || hasStoredImage;
  const scoringDraft = useMemo<ContentDraft>(
    () => ({
      ...draft,
      featuredImage: hasImage ? { alt: draft.seo.focusKeyword } : undefined,
    }),
    [draft, hasImage],
  );`,
  `  const hasImage = Boolean(imageFile) || hasStoredImage || picked.length > 0;

  // Images picked from the Library carry all four metadata fields, so hand the
  // scorer the real values rather than a guess. Falling back to the focus
  // keyword only when nothing is picked keeps the old behaviour intact.
  const scoringDraft = useMemo<ContentDraft>(() => {
    const media = picked.map((m) => ({
      alt: m.alt,
      title: m.title,
      caption: m.caption,
      description: m.description,
    }));
    return {
      ...draft,
      featuredImage:
        media[0] ?? (hasImage ? { alt: draft.seo.focusKeyword } : undefined),
      media,
    };
  }, [draft, hasImage, picked]);`,
);

/* ---------------- 4. featured image UI -> picker ---------------- */
const OLD_UI_START = `              <div>
                <label className={labelClass} htmlFor="image">
                  Featured image <span className="text-gray-400">(optional)</span>
                </label>`;

if (s.includes(OLD_UI_START)) {
  const startIdx = s.indexOf(OLD_UI_START);
  const endMarker = "              </div>\n            </section>";
  const endIdx = s.indexOf(endMarker, startIdx);
  if (endIdx === -1) {
    skipped.push("4. featured image UI (END ANCHOR NOT FOUND)");
  } else {
    const NEW_UI = `              <div>
                <span className={labelClass}>
                  Images <span className="text-gray-400">(from the Library)</span>
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  The first image is the featured one. Pick 2 or more with a
                  4/4 badge to turn the image checks green.
                </p>

                <div className="mt-2 flex flex-wrap gap-3">
                  {picked.map((m, i) => (
                    <div
                      key={m.id}
                      className="relative w-28 overflow-hidden rounded-lg border border-gray-200"
                    >
                      <div className="aspect-video bg-gray-100">
                        <img
                          src={mediaSrc(m.url)}
                          alt={m.alt || m.originalName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {i === 0 && (
                        <span className="absolute left-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Featured
                        </span>
                      )}
                      <span
                        className={\`absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold \${
                          metaFilledCount(m) === 4
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-700"
                        }\`}
                      >
                        {metaFilledCount(m)}/4
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPicked((p) => p.filter((x) => x.id !== m.id))
                        }
                        className="w-full bg-white py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="flex h-[86px] w-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-xs font-medium text-gray-500 transition hover:border-brand hover:text-brand"
                  >
                    <span className="text-lg leading-none">+</span>
                    Add image
                  </button>
                </div>

                {picked.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    None picked yet. Without images the API still needs a file,
                    so a 1-pixel placeholder (<code>{PLACEHOLDER_IMAGE_NAME}</code>)
                    is attached and the image checks stay red.
                  </p>
                )}

                <ImagePicker
                  open={pickerOpen}
                  multiple
                  title="Choose images for this page"
                  onClose={() => setPickerOpen(false)}
                  onSelect={(imgs) =>
                    setPicked((prev) => {
                      const seen = new Set(prev.map((p) => p.id));
                      return [...prev, ...imgs.filter((i) => !seen.has(i.id))];
                    })
                  }
                />
              </div>
            </section>`;
    s = s.slice(0, startIdx) + NEW_UI + s.slice(endIdx + endMarker.length);
    applied.push("4. featured image UI -> Library picker");
  }
} else if (s.includes("ImagePicker")) {
  skipped.push("4. featured image UI (already applied)");
} else {
  skipped.push("4. featured image UI (ANCHOR NOT FOUND)");
}

/* ---------------- 5. save: use the picked featured image ---------------- */
edit(
  "5. save uses picked image",
  "let fileToSend",
  "    setSaving(true);\n    setBanner(null);",
  `    setSaving(true);
    setBanner(null);

    // The picked featured image already lives on the server. Fetch it back as a
    // File so it goes through the existing multipart upload path unchanged —
    // no backend or api.ts change needed.
    let fileToSend = imageFile;
    if (!fileToSend && picked[0]) {
      try {
        const res = await fetch(mediaSrc(picked[0].url));
        const blob = await res.blob();
        fileToSend = new File([blob], picked[0].originalName, { type: blob.type });
      } catch {
        // Non-fatal: fall through to the placeholder rather than blocking a save.
      }
    }`,
);

edit(
  "6. save: create path",
  "fileToSend ?? placeholderImageFile",
  "        const file = imageFile ?? placeholderImageFile();",
  "        const file = fileToSend ?? placeholderImageFile();",
);

edit(
  "7. save: update path",
  "payload, fileToSend, status",
  "        const res = await updateContent(savedSlug, payload, imageFile, status);",
  "        const res = await updateContent(savedSlug, payload, fileToSend, status);",
);

edit(
  "8. save: media in payload",
  "media: picked.map((m) => ({\n        alt",
  `    const payload: ContentDraft = {
      ...draft,
      seo: {`,
  `    const payload: ContentDraft = {
      ...draft,
      media: picked.map((m) => ({
        alt: m.alt,
        title: m.title,
        caption: m.caption,
        description: m.description,
      })),
      seo: {`,
);

edit(
  "9. save: hasStoredImage flags",
  "if (fileToSend) setHasStoredImage",
  "        if (imageFile) setHasStoredImage(true);",
  "        if (fileToSend) setHasStoredImage(true);",
);

edit(
  "10. save: created flag",
  "Boolean(fileToSend)",
  "        setHasStoredImage(Boolean(imageFile));",
  "        setHasStoredImage(Boolean(fileToSend));",
);

/* ---------------- write + report ---------------- */
if (s !== before) {
  fs.writeFileSync(FILE + ".backup", before);
  fs.writeFileSync(FILE, s);
}

console.log("\n=== APPLIED ===");
applied.forEach((a) => console.log("  ✅ " + a));
console.log("\n=== SKIPPED ===");
if (skipped.length === 0) console.log("  (none)");
skipped.forEach((x) => console.log("  ⚠️  " + x));
console.log(
  "\nBackup saved to " + FILE + ".backup",
);
console.log(
  applied.length >= 8
    ? "\n🎉 Patch complete. Restart is not needed — Vite hot-reloads.\n"
    : "\n⚠️  Some edits did not apply — send this output to Balarama.\n",
);
