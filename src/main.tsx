import React, { Suspense, lazy, Component } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, ToastProvider, useAuth, Loading, Failure } from "./lib";
import { resumePath } from "./session";
import "./styles.css";
const Landing = lazy(() => import("./pages/Landing"));
const TeacherSetup = lazy(() => import("./pages/TeacherSetup"));
const Auth = lazy(() => import("./pages/Auth"));
const Student = lazy(() => import("./pages/Student"));
const Admin = lazy(() => import("./pages/Admin"));
const Explore = lazy(() => import("./pages/Explore"));
// Fetch the requested workspace bundle while the session check is in flight.
// Authorization still happens in Guard before the workspace mounts.
if (window.location.pathname.startsWith("/admin"))
  void import("./pages/Admin").catch(() => {});
else if (/^\/(app|onboarding)(\/|$)/.test(window.location.pathname))
  void import("./pages/Student").catch(() => {});
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Failure
        error="The page could not load. Reload to recover your learning space."
        retry={() => window.location.reload()}
      />
    ) : (
      this.props.children
    );
  }
}
function Guard({
  admin = false,
  children,
}: {
  admin?: boolean;
  children: React.ReactNode;
}) {
  const { user, loading, error, refresh } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (error) return <Failure error={error} retry={refresh} />;
  if (!user)
    return (
      <Navigate
        to={admin ? "/auth/admin" : "/auth/login"}
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
        replace
      />
    );
  if (admin && user.role !== "admin") return <Navigate to="/app" replace />;
  if (!admin && user.role === "admin") return <Navigate to="/admin" replace />;
  return children;
}
function Home() {
  const { user, loading, error, refresh } = useAuth();
  if (loading) return <Loading />;
  if (error) return <Failure error={error} retry={refresh} />;
  if (!user) return <Landing />;
  return <Navigate to={resumePath(user)} replace />;
}
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Navigate to={resumePath(user)} replace /> : children;
}
function App() {
  const location = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
    document.title = location.pathname.startsWith("/admin")
      ? "Teacher workspace · English Tech"
      : location.pathname.startsWith("/app")
        ? "Your learning space · English Tech"
        : location.pathname.startsWith("/explore")
          ? "Guest Explore · English Tech"
          : "English Tech — A brighter way to learn";
  }, [location.pathname]);
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore/*" element={<Explore />} />
          <Route path="/auth/setup" element={<TeacherSetup />} />
          <Route
            path="/auth/:mode"
            element={
              <GuestOnly>
                <Auth />
              </GuestOnly>
            }
          />
          <Route
            path="/onboarding"
            element={
              <Guard>
                <Student onboarding />
              </Guard>
            }
          />
          <Route
            path="/app/*"
            element={
              <Guard>
                <Student />
              </Guard>
            }
          />
          <Route
            path="/admin/*"
            element={
              <Guard admin>
                <Admin />
              </Guard>
            }
          />
          <Route
            path="*"
            element={
              <div className="not-found">
                <h1>A little off course.</h1>
                <p>
                  That page doesn’t exist. Your next chapter is still waiting.
                </p>
                <a className="button" href="/">
                  Back to home
                </a>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
