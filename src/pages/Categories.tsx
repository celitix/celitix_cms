import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,
} from "../lib/api";

const input = "rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default function Categories() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<"blog" | "page">("blog");
  const [desc, setDesc] = useState("");
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await listCategories();
      setCats(r.categories || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      await createCategory(name.trim(), type, desc.trim() || undefined);
      setName("");
      setDesc("");
      setMsg("Category created");
      load();
      setTimeout(() => setMsg(""), 2000);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    try {
      await updateCategory(editing.id, { name: editing.name, type: editing.type, description: editing.description || "" });
      setEditing(null);
      load();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this category? Content keeps its data but is un-categorised.")) return;
    await deleteCategory(id);
    load();
  }

  const blogCats = cats.filter((c) => c.type === "blog");
  const pageCats = cats.filter((c) => c.type === "page");

  return (
    <Layout title="Categories">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Categories</h1>
      <p className="mb-4 text-sm text-gray-500">Manage taxonomy for blogs and pages.</p>
      {msg && <div className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand">{msg}</div>}

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-gray-800">Add category</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-gray-600">Name</label>
            <input className={input + " w-full"} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. WhatsApp API" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Type</label>
            <select className={input} value={type} onChange={(e) => setType(e.target.value as "blog" | "page")}>
              <option value="blog">Blog</option>
              <option value="page">Page</option>
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-gray-600">Description (optional)</label>
            <input className={input + " w-full"} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <button onClick={handleCreate} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Add
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[
            { title: "Blog categories", list: blogCats },
            { title: "Page categories", list: pageCats },
          ].map((group) => (
            <div key={group.title} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-gray-800">{group.title}</div>
              {group.list.length === 0 ? (
                <p className="text-xs text-gray-400">None yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {group.list.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2">
                      {editing?.id === c.id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <input
                            className={input + " flex-1"}
                            value={editing.name}
                            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                          />
                          <button onClick={handleSaveEdit} className="text-sm font-medium text-brand">Save</button>
                          <button onClick={() => setEditing(null)} className="text-sm text-gray-400">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <div className="text-sm text-gray-800">{c.name}</div>
                            <div className="text-xs text-gray-400">/{c.slug}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => setEditing(c)} className="text-sm text-gray-500 hover:text-brand">Edit</button>
                            <button onClick={() => handleDelete(c.id)} className="text-sm text-red-500 hover:text-red-700">Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
