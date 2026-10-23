import { useCallback, useEffect, useState } from "react";
import Layout from "../components/Layout";
import {
  createRedirect,
  deleteRedirect,
  listRedirects,
  updateRedirect,
  type Redirect,
} from "../lib/api";

const CODES = [301, 302, 307, 308];
const CODE_HINT: Record<number, string> = {
  301: "Permanent",
  302: "Temporary",
  307: "Temporary (keep method)",
  308: "Permanent (keep method)",
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

export default function Redirects() {
  const [items, setItems] = useState<Redirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // add form
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [code, setCode] = useState(301);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listRedirects());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load redirects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    setFormError(null);
    if (!from.trim() || !to.trim()) {
      setFormError("Both paths are required.");
      return;
    }
    setSaving(true);
    try {
      const created = await createRedirect({
        fromPath: from,
        toPath: to,
        statusCode: code,
        note: note || null,
      });
      setItems((list) => [created, ...list]);
      setFrom("");
      setTo("");
      setCode(301);
      setNote("");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't create the redirect.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: Redirect) {
    // optimistic
    setItems((list) =>
      list.map((r) => (r.id === item.id ? { ...r, active: !r.active } : r)),
    );
    try {
      await updateRedirect(item.id, { active: !item.active });
    } catch {
      void load(); // revert on failure
    }
  }

  async function removeOne(item: Redirect) {
    if (!confirm(`Delete the redirect from ${item.fromPath}?`)) return;
    const prev = items;
    setItems((list) => list.filter((r) => r.id !== item.id));
    try {
      await deleteRedirect(item.id);
    } catch {
      setItems(prev); // revert
    }
  }

  return (
    <Layout title="Redirects">
      <div className="p-8 space-y-5">
        <p className="text-sm text-gray-500 max-w-2xl">
          Map an old path to a new one so a changed slug never leaves a 404. Paths
          are normalised (leading slash, no trailing slash). The frontend resolves
          these before rendering and issues the redirect.
        </p>

        {/* Add form */}
        <div className="rounded-2xl bg-white border border-gray-200 p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="block text-xs font-medium text-gray-500">From</label>
              <input
                className={`mt-1 ${inputClass}`}
                placeholder="/old-page"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">To</label>
              <input
                className={`mt-1 ${inputClass}`}
                placeholder="/new-page"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Type</label>
              <select
                className={`mt-1 ${inputClass}`}
                value={code}
                onChange={(e) => setCode(Number(e.target.value))}
              >
                {CODES.map((c) => (
                  <option key={c} value={c}>
                    {c} · {CODE_HINT[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500">
                Note (optional)
              </label>
              <input
                className={`mt-1 ${inputClass}`}
                placeholder="Why this redirect exists"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => void add()}
              disabled={saving}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
            >
              {saving ? "Adding…" : "Add redirect"}
            </button>
          </div>
          {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
        </div>

        {/* List */}
        <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="p-10 text-center text-sm text-gray-500">Loading…</p>
          ) : error ? (
            <div className="p-10 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-3 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-400">
              No redirects yet. Add one above.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">From → To</th>
                  <th className="px-5 py-3 font-semibold">Code</th>
                  <th className="px-5 py-3 font-semibold">Hits</th>
                  <th className="px-5 py-3 font-semibold">Active</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/70">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 break-all">{r.fromPath}</p>
                      <p className="text-xs text-gray-500 break-all">→ {r.toPath}</p>
                      {r.note && (
                        <p className="mt-0.5 text-xs text-gray-400">{r.note}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {r.statusCode}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{r.hits}</td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => void toggle(r)}
                        className={`relative h-5 w-9 rounded-full transition ${
                          r.active ? "bg-emerald-500" : "bg-gray-300"
                        }`}
                        aria-label={r.active ? "Deactivate" : "Activate"}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                            r.active ? "left-4" : "left-0.5"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void removeOne(r)}
                        className="font-medium text-red-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
