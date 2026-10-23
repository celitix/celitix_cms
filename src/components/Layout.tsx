import type { ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { clearSession, getAdmin } from "../lib/auth";
import { TYPE_BY_LABEL } from "../lib/api";

const NAV_ITEMS = Object.entries(TYPE_BY_LABEL);

type LayoutProps = {
  title: string;
  /** Buttons for the right side of the header (e.g. "New Content", "Save"). */
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * The app shell: sidebar + header. Every signed-in screen renders inside it so
 * the furniture stays identical across the dashboard, list, editor and library.
 */
export default function Layout({ title, actions, children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const admin = getAdmin();

  const onContent = location.pathname.startsWith("/content");
  const activeType = params.get("type");

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  const linkClass = (active: boolean) =>
    `block rounded-lg px-3 py-2 text-sm font-medium transition ${
      active
        ? "bg-brand-50 text-brand"
        : "text-gray-600 hover:bg-brand-50 hover:text-brand"
    }`;

  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900">
      <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-gray-200">
          <div className="h-8 w-8 rounded-lg bg-brand flex items-center justify-center text-white font-bold">
            C
          </div>
          <span className="font-semibold">Celitix CMS</span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <Link
            to="/dashboard"
            className={linkClass(location.pathname === "/dashboard")}
          >
            Dashboard
          </Link>

          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Content
          </p>

          {NAV_ITEMS.map(([label, type]) => (
            <Link
              key={type}
              to={`/content?type=${type}`}
              className={linkClass(onContent && activeType === type)}
            >
              {label}
            </Link>
          ))}

          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Tools
          </p>

          <Link
            to="/seo"
            className={linkClass(location.pathname.startsWith("/seo"))}
          >
            Page SEO
          </Link>

          <Link
            to="/keyword-intel"
            className={linkClass(location.pathname.startsWith("/keyword-intel"))}
          >
            Keyword Intelligence
          </Link>

          <Link
            to="/bulk"
            className={linkClass(location.pathname.startsWith("/bulk"))}
          >
            Bulk Uploads
          </Link>

          <Link
            to="/analyze"
            className={linkClass(location.pathname.startsWith("/analyze"))}
          >
            Page Analyzer
          </Link>

          <Link
            to="/ai-overview"
            className={linkClass(location.pathname.startsWith("/ai-overview"))}
          >
            AI-Overview
          </Link>

          <Link
            to="/competitors"
            className={linkClass(location.pathname.startsWith("/competitors"))}
          >
            Competitor Intel
          </Link>

          <Link
            to="/reports"
            className={linkClass(location.pathname.startsWith("/reports"))}
          >
            Reports &amp; Exports
          </Link>

          <Link
            to="/technical"
            className={linkClass(location.pathname.startsWith("/technical"))}
          >
            Technical SEO
          </Link>

          <Link
            to="/redirects"
            className={linkClass(location.pathname.startsWith("/redirects"))}
          >
            Redirects
          </Link>

          <Link
            to="/categories"
            className={linkClass(location.pathname.startsWith("/categories"))}
          >
            Categories
          </Link>

          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Configuration
          </p>

          <Link
            to="/settings"
            className={linkClass(location.pathname.startsWith("/settings"))}
          >
            Settings
          </Link>

          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Media
          </p>

          <Link
            to="/images"
            className={linkClass(location.pathname === "/images")}
          >
            Image Library
          </Link>
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between gap-4 px-6">
          <h1 className="text-lg font-semibold truncate">{title}</h1>
          <div className="flex items-center gap-4 shrink-0">
            {actions}
            {admin && (
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {admin.name || admin.email}
                </p>
                <p className="text-xs text-gray-500">{admin.role}</p>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
