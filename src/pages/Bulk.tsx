import { useState } from "react";
import Layout from "../components/Layout";
import {
  bulkCreate,
  bulkSeo,
  uploadMediaFile,
  type BulkCreateResult,
  type BulkSeoResult,
} from "../lib/api";

const btn = "rounded-lg px-4 py-2 text-sm font-medium transition";
const input =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

/** Minimal CSV parser (handles quoted fields + embedded commas/newlines). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let i = 0,
    field = "",
    row: string[] = [],
    inQ = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      pushField();
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== "" || row.length) {
    pushField();
    pushRow();
  }
  const header = (rows.shift() || []).map((h) => h.trim());
  return rows
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const o: Record<string, string> = {};
      header.forEach((h, idx) => (o[h] = (r[idx] ?? "").trim()));
      return o;
    });
}

function downloadText(name: string, text: string, type = "text/csv") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------- Bulk SEO ------------------------------- */
function BulkSeoTab() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkSeoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onFile(f: File | undefined) {
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setRows(parseCsv(String(reader.result || "")));
    reader.readAsText(f);
  }

  async function apply() {
    if (!rows.length) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await bulkSeo(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk SEO failed.");
    } finally {
      setBusy(false);
    }
  }

  const template =
    "slug,title,description,focusKeyword,secondaryKeywords,tldr,canonical,robots,ogTitle,ogDescription\n" +
    "healthcare,\"Healthcare Communication Platform | Celitix\",\"Patient alerts, reminders & engagement over WhatsApp, SMS & voice.\",healthcare communication,\"patient engagement|healthcare messaging\",\"Celitix powers patient communication across channels.\",https://www.celitix.com/healthcare,\"index,follow\",,\n";

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Update SEO for many pages at once. Match rows to pages by <b>slug</b>; only non-empty columns
        are written. Columns: slug, title, description, focusKeyword, secondaryKeywords (pipe- or
        comma-separated), tldr, canonical, robots, ogTitle, ogDescription.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className={`${btn} cursor-pointer border border-brand text-brand hover:bg-brand-50`}>
          Choose CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <button type="button" onClick={() => downloadText("bulk-seo-template.csv", template)} className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}>
          Download template
        </button>
        {fileName && <span className="text-sm text-gray-500">{fileName} · {rows.length} rows</span>}
        <div className="flex-1" />
        <button type="button" onClick={() => void apply()} disabled={busy || rows.length === 0} className={`${btn} bg-brand text-white hover:opacity-90 disabled:opacity-50`}>
          {busy ? "Applying…" : `Apply to ${rows.length} rows`}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="text-emerald-700 font-medium">✓ {result.updated} pages updated</p>
          {result.notFound.length > 0 && (
            <p className="mt-1 text-amber-700">Not found ({result.notFound.length}): {result.notFound.join(", ")}</p>
          )}
          {result.errors.length > 0 && (
            <p className="mt-1 text-red-600">Errors: {result.errors.map((e) => `${e.slug} (${e.error})`).join("; ")}</p>
          )}
        </div>
      )}
      {rows.length > 0 && !result && <Preview rows={rows} />}
    </div>
  );
}

/* ------------------------------ Bulk Create ----------------------------- */
function BulkCreateTab() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkCreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onFile(f: File | undefined) {
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setRows(parseCsv(String(reader.result || "")));
    reader.readAsText(f);
  }
  async function apply() {
    if (!rows.length) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await bulkCreate(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk create failed.");
    } finally {
      setBusy(false);
    }
  }

  const template =
    "type,title,slug,shortDesc,description,category,status,focusKeyword,keywords,tldr\n" +
    "PAGE,\"Bulk SMS Pune\",bulk-sms-pune,\"Bulk SMS services in Pune\",\"Send bulk SMS in Pune with Celitix.\",SMS,DRAFT,bulk sms pune,\"bulk sms,sms marketing\",\"Fast bulk SMS delivery in Pune.\"\n";

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Create many pages/posts at once. Existing slugs are skipped (never overwritten). Columns:
        type (PAGE/POST/CASE_STUDY/GUIDE), title, slug, shortDesc, description, category, status
        (DRAFT/PUBLISHED), focusKeyword, keywords, tldr.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className={`${btn} cursor-pointer border border-brand text-brand hover:bg-brand-50`}>
          Choose CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <button type="button" onClick={() => downloadText("bulk-create-template.csv", template)} className={`${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`}>
          Download template
        </button>
        {fileName && <span className="text-sm text-gray-500">{fileName} · {rows.length} rows</span>}
        <div className="flex-1" />
        <button type="button" onClick={() => void apply()} disabled={busy || rows.length === 0} className={`${btn} bg-brand text-white hover:opacity-90 disabled:opacity-50`}>
          {busy ? "Creating…" : `Create ${rows.length} pages`}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="text-emerald-700 font-medium">✓ {result.created} pages created</p>
          {result.skipped.length > 0 && (
            <p className="mt-1 text-amber-700">Skipped (slug exists): {result.skipped.join(", ")}</p>
          )}
          {result.errors.length > 0 && (
            <p className="mt-1 text-red-600">Errors: {result.errors.map((e) => `${e.slug} (${e.error})`).join("; ")}</p>
          )}
        </div>
      )}
      {rows.length > 0 && !result && <Preview rows={rows} />}
    </div>
  );
}

/* ------------------------------ Bulk Images ----------------------------- */
type ImgRow = { file: File; alt: string; title: string; caption: string; description: string; status: "" | "up" | "done" | "err" };
function BulkImagesTab() {
  const [items, setItems] = useState<ImgRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const add: ImgRow[] = Array.from(files).map((file) => ({ file, alt: "", title: "", caption: "", description: "", status: "" }));
    setItems((x) => [...x, ...add]);
  }
  function edit(idx: number, field: keyof ImgRow, val: string) {
    setItems((x) => x.map((it, i) => (i === idx ? { ...it, [field]: val } : it)));
  }
  async function uploadAll() {
    setBusy(true);
    setDone(0);
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === "done") continue;
      setItems((x) => x.map((it, idx) => (idx === i ? { ...it, status: "up" } : it)));
      try {
        await uploadMediaFile(items[i].file, items[i]);
        setItems((x) => x.map((it, idx) => (idx === i ? { ...it, status: "done" } : it)));
        setDone((d) => d + 1);
      } catch {
        setItems((x) => x.map((it, idx) => (idx === i ? { ...it, status: "err" } : it)));
      }
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Upload many images at once, each with all four metadata fields (alt, title, caption,
        description) — the four the Gold Mine scorer checks. They land in the Image Library.
      </p>
      <div className="flex items-center gap-3">
        <label className={`${btn} cursor-pointer border border-brand text-brand hover:bg-brand-50`}>
          Add images
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </label>
        {items.length > 0 && <span className="text-sm text-gray-500">{items.length} images · {done} uploaded</span>}
        <div className="flex-1" />
        <button type="button" onClick={() => void uploadAll()} disabled={busy || items.length === 0} className={`${btn} bg-brand text-white hover:opacity-90 disabled:opacity-50`}>
          {busy ? "Uploading…" : "Upload all"}
        </button>
      </div>
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-3 rounded-xl border border-gray-200 p-3">
              <img src={URL.createObjectURL(it.file)} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <input className={input} placeholder="Alt text" value={it.alt} onChange={(e) => edit(idx, "alt", e.target.value)} />
                <input className={input} placeholder="Title" value={it.title} onChange={(e) => edit(idx, "title", e.target.value)} />
                <input className={input} placeholder="Caption" value={it.caption} onChange={(e) => edit(idx, "caption", e.target.value)} />
                <input className={input} placeholder="Description" value={it.description} onChange={(e) => edit(idx, "description", e.target.value)} />
              </div>
              <div className="w-16 shrink-0 self-center text-center text-xs">
                {it.status === "done" ? <span className="text-emerald-600">✓ done</span> : it.status === "up" ? <span className="text-gray-400">…</span> : it.status === "err" ? <span className="text-red-500">error</span> : <span className="text-gray-300">ready</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Preview({ rows }: { rows: Record<string, string>[] }) {
  const cols = Object.keys(rows[0] || {}).slice(0, 6);
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.slice(0, 8).map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c} className="px-3 py-1.5 text-gray-600">{(r[c] || "").slice(0, 40)}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {rows.length > 8 && <p className="px-3 py-2 text-xs text-gray-400">…and {rows.length - 8} more</p>}
    </div>
  );
}

export default function Bulk() {
  const [tab, setTab] = useState<"seo" | "create" | "images">("seo");
  return (
    <Layout title="Bulk Uploads">
      <div className="p-8">
        <div className="mb-5 inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {([["seo", "Bulk SEO"], ["create", "Bulk Create"], ["images", "Bulk Images"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === k ? "bg-brand text-white" : "text-gray-600 hover:text-gray-900"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 p-6">
          {tab === "seo" ? <BulkSeoTab /> : tab === "create" ? <BulkCreateTab /> : <BulkImagesTab />}
        </div>
      </div>
    </Layout>
  );
}
