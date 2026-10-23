import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ContentList from "./pages/ContentList";
import ImageLibrary from "./pages/ImageLibrary";
import PageAnalyzer from "./pages/PageAnalyzer";
import TechnicalSeo from "./pages/TechnicalSeo";
import Redirects from "./pages/Redirects";
import Keywords from "./pages/Keywords";
import Backlinks from "./pages/Backlinks";
import AiOverview from "./pages/AiOverview";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Competitors from "./pages/Competitors";
import KeywordIntel from "./pages/KeywordIntel";
import Bulk from "./pages/Bulk";
import PageSeoList from "./pages/PageSeoList";
import ProtectedRoute from "./components/ProtectedRoute";
import { isAuthenticated } from "./lib/auth";

// The editor pulls in Tiptap and ProseMirror — most of the bundle. Loading it
// only when someone opens it keeps login, the dashboard and the list light.
const ContentEditor = lazy(() => import("./pages/ContentEditor"));
const Categories = lazy(() => import("./pages/Categories"));
// The SEO connector form is big (schema builder + image repeater) but is only
// opened one page at a time, so it splits out too.
const PageSeo = lazy(() => import("./pages/PageSeo"));

function EditorRoute() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <p className="p-10 text-center text-sm text-gray-500">Loading editor…</p>
        }
      >
        <ContentEditor />
      </Suspense>
    </ProtectedRoute>
  );
}

function PageSeoRoute() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <p className="p-10 text-center text-sm text-gray-500">Loading SEO editor…</p>
        }
      >
        <PageSeo />
      </Suspense>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/content"
        element={
          <ProtectedRoute>
            <ContentList />
          </ProtectedRoute>
        }
      />
      <Route path="/content/new" element={<EditorRoute />} />
      <Route path="/content/edit/:slug" element={<EditorRoute />} />
      <Route
        path="/seo"
        element={
          <ProtectedRoute>
            <PageSeoList />
          </ProtectedRoute>
        }
      />
      <Route path="/seo/:slug" element={<PageSeoRoute />} />
      <Route
        path="/categories"
        element={
          <ProtectedRoute>
            <Categories />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analyze"
        element={
          <ProtectedRoute>
            <PageAnalyzer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analyze/:slug"
        element={
          <ProtectedRoute>
            <PageAnalyzer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/technical"
        element={
          <ProtectedRoute>
            <TechnicalSeo />
          </ProtectedRoute>
        }
      />
      <Route
        path="/redirects"
        element={
          <ProtectedRoute>
            <Redirects />
          </ProtectedRoute>
        }
      />
      <Route
        path="/keywords"
        element={
          <ProtectedRoute>
            <Keywords />
          </ProtectedRoute>
        }
      />
      <Route
        path="/backlinks"
        element={
          <ProtectedRoute>
            <Backlinks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-overview"
        element={
          <ProtectedRoute>
            <AiOverview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/competitors"
        element={
          <ProtectedRoute>
            <Competitors />
          </ProtectedRoute>
        }
      />
      <Route
        path="/keyword-intel"
        element={
          <ProtectedRoute>
            <KeywordIntel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bulk"
        element={
          <ProtectedRoute>
            <Bulk />
          </ProtectedRoute>
        }
      />
      <Route
        path="/images"
        element={
          <ProtectedRoute>
            <ImageLibrary />
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated() ? "/dashboard" : "/login"} replace />}
      />
    </Routes>
  );
}
