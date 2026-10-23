import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import {
  getSettings,
  testDataforseo,
  updateSettings,
  DFS_COUNTRIES,
  type AppSettings,
} from "../lib/api";

const input =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition";

function Field({
  label, value, onChange, placeholder, hint, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500">{label}</label>
      <input type={type} className={`mt-1 ${input}`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {desc && <p className="text-sm text-gray-500">{desc}</p>}
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // DataForSEO + rank
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [siteDomain, setSiteDomain] = useState("celitix.com");
  const [country, setCountry] = useState("in");
  const [device, setDevice] = useState("desktop");

  // general (head/schema)
  const [g, setG] = useState<Record<string, string>>({});
  const gv = (k: string) => g[k] ?? "";
  const setGv = (k: string) => (v: string) => setG((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        setUsername(s.dataforseoUsername);
        setSiteDomain(s.siteDomain);
        setCountry(s.defaultCountry);
        setDevice(s.defaultDevice);
        setG(s.general || {});
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load settings."))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateSettings({
        dataforseoUsername: username,
        ...(password ? { dataforseoPassword: password } : {}),
        siteDomain,
        defaultCountry: country,
        defaultDevice: device,
        general: g,
      });
      setPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      await updateSettings({ dataforseoUsername: username, ...(password ? { dataforseoPassword: password } : {}) });
      setPassword("");
      const r = await testDataforseo();
      setTestResult(r);
      setSettings(await getSettings());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed.");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <Layout title="Settings">
        <p className="p-8 text-sm text-gray-500">Loading…</p>
      </Layout>
    );
  }

  return (
    <Layout title="Settings">
      <div className="p-8 max-w-3xl space-y-6">
        {/* DataForSEO */}
        <Card title="DataForSEO" desc="Powers keyword positions, volume, competitors and AI visibility. Keys stored encrypted.">
          <div className="flex items-center justify-between -mt-2">
            <span />
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${settings?.dataforseoConfigured ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
              {settings?.dataforseoConfigured ? "Configured" : "Not set"}
            </span>
          </div>
          <Field label="Username (login)" value={username} onChange={setUsername} placeholder="DataForSEO login" />
          <div>
            <label className="block text-xs font-medium text-gray-500">Password (API key)</label>
            <input type="password" className={`mt-1 ${input}`} value={password}
              placeholder={settings?.dataforseoConfigured ? "•••••• (leave blank to keep)" : "API password"}
              onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <button type="button" onClick={() => void runTest()} disabled={testing}
              className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-50 disabled:opacity-50 transition">
              {testing ? "Testing…" : "Test connection"}
            </button>
            {testResult && (
              <p className={`mt-2 text-sm ${testResult.ok ? "text-emerald-600" : "text-red-600"}`}>
                {testResult.ok ? "✓ " : "✗ "}{testResult.message}
              </p>
            )}
          </div>
        </Card>

        {/* Rank tracking */}
        <Card title="Rank tracking" desc="Defaults for keyword checks; the site domain is matched against Google results.">
          <Field label="Site domain" value={siteDomain} onChange={setSiteDomain} placeholder="celitix.com" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-500">Default country</label>
              <select className={`mt-1 ${input}`} value={country} onChange={(e) => setCountry(e.target.value)}>
                {DFS_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Default device</label>
              <select className={`mt-1 ${input}`} value={device} onChange={(e) => setDevice(e.target.value)}>
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Site & branding */}
        <Card title="Site & branding" desc="Used across meta titles and Organization schema.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title separator" value={gv("separator")} onChange={setGv("separator")} placeholder="–" />
            <div>
              <label className="block text-xs font-medium text-gray-500">Organization schema type</label>
              <select className={`mt-1 ${input}`} value={gv("org_type") || "Organization"} onChange={(e) => setGv("org_type")(e.target.value)}>
                <option value="Organization">Organization</option>
                <option value="LocalBusiness">LocalBusiness</option>
                <option value="Corporation">Corporation</option>
                <option value="TechCompany">TechCompany</option>
                <option value="SoftwareApplication">SoftwareApplication</option>
              </select>
            </div>
          </div>
          <Field label="Organization name" value={gv("org_name")} onChange={setGv("org_name")} placeholder="Celitix" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Logo URL" value={gv("org_logo")} onChange={setGv("org_logo")} placeholder="https://www.celitix.com/logo.png" />
            <Field label="Organization URL" value={gv("org_url")} onChange={setGv("org_url")} placeholder="https://www.celitix.com" />
          </div>
        </Card>

        {/* Social defaults */}
        <Card title="Social defaults" desc="Open Graph / Twitter fallbacks when a page has none.">
          <Field label="Default OG image URL" value={gv("default_og_image")} onChange={setGv("default_og_image")} placeholder="https://www.celitix.com/og.jpg" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="OG locale" value={gv("og_locale")} onChange={setGv("og_locale")} placeholder="en_US" />
            <Field label="Twitter handle" value={gv("twitter_handle")} onChange={setGv("twitter_handle")} placeholder="@celitix" />
            <Field label="Facebook App ID" value={gv("fb_app_id")} onChange={setGv("fb_app_id")} />
          </div>
        </Card>

        {/* Verification */}
        <Card title="Site verification" desc="Webmaster/console ownership tags. Only non-empty tokens are rendered.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Google" value={gv("verify_google")} onChange={setGv("verify_google")} placeholder="google-site-verification token" />
            <Field label="Bing" value={gv("verify_bing")} onChange={setGv("verify_bing")} placeholder="msvalidate.01 token" />
            <Field label="Pinterest" value={gv("verify_pinterest")} onChange={setGv("verify_pinterest")} />
            <Field label="Yandex" value={gv("verify_yandex")} onChange={setGv("verify_yandex")} />
          </div>
        </Card>

        {/* Tracking */}
        <Card title="Analytics & tracking" desc="GA4 / GTM. Leave OFF if the live site already loads these (avoids double-tagging).">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={gv("tracking_enabled") === "true"} onChange={(e) => setGv("tracking_enabled")(e.target.checked ? "true" : "false")} />
            Inject analytics from the connector
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="GA4 Measurement ID" value={gv("ga4_id")} onChange={setGv("ga4_id")} placeholder="G-XXXXXXX" />
            <Field label="GTM Container ID" value={gv("gtm_id")} onChange={setGv("gtm_id")} placeholder="GTM-XXXXXX" />
          </div>
        </Card>

        {/* Local Business */}
        <Card title="Local Business (NAP)" desc="Adds address/phone/geo/hours to Organization schema when org type is LocalBusiness.">
          <Field label="Phone" value={gv("lb_phone")} onChange={setGv("lb_phone")} placeholder="+91 968-000-6460" />
          <Field label="Street address" value={gv("lb_street")} onChange={setGv("lb_street")} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Locality (city)" value={gv("lb_locality")} onChange={setGv("lb_locality")} placeholder="Jaipur" />
            <Field label="Region (state)" value={gv("lb_region")} onChange={setGv("lb_region")} placeholder="Rajasthan" />
            <Field label="Postal code" value={gv("lb_postal")} onChange={setGv("lb_postal")} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Country" value={gv("lb_country")} onChange={setGv("lb_country")} placeholder="IN" />
            <Field label="Latitude" value={gv("lb_lat")} onChange={setGv("lb_lat")} />
            <Field label="Longitude" value={gv("lb_lng")} onChange={setGv("lb_lng")} />
          </div>
        </Card>

        {/* Hreflang */}
        <Card title="Hreflang (global)" desc='JSON array of alternates, e.g. [{"hreflang":"en-in","href":"https://www.celitix.com/"}]. Leave empty if single-region.'>
          <textarea className={`${input} h-24 font-mono text-xs`} value={gv("hreflang_global")} onChange={(e) => setGv("hreflang_global")(e.target.value)}
            placeholder='[{"hreflang":"en","href":"https://www.celitix.com/"},{"hreflang":"x-default","href":"https://www.celitix.com/"}]' />
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="sticky bottom-4 flex items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={saving}
            className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white shadow-lg hover:opacity-90 disabled:opacity-50 transition">
            {saving ? "Saving…" : "Save all settings"}
          </button>
          {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
        </div>
      </div>
    </Layout>
  );
}
