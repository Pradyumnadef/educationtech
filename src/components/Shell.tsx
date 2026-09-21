import { useState, useEffect } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  Home,
  Shapes,
  Play,
  ChartNoAxesCombined,
  Bell,
  User,
  Users,
  FileText,
  KeyRound,
  Megaphone,
  Settings,
  LogOut,
  Search,
  Menu,
  X,
  ChevronDown,
  ArrowUpRight,
  Leaf,
  GraduationCap,
  ClipboardList,
} from "lucide-react";
import {
  Logo,
  Avatar,
  useAuth,
  post,
  useToast,
  api,
  Modal,
  Empty,
  contentKindLabel,
} from "../lib";
const studentNav = [
  ["", "Overview", Home],
  ["assignments", "Assignments", ClipboardList],
  ["subjects", "My subjects", Shapes],
  ["videos", "Learning materials", Play],
  ["progress", "My progress", ChartNoAxesCombined],
] as const;
const adminNav = [
  ["", "Overview", Home],
  ["students", "Students", Users],
  ["teachers", "Teachers", GraduationCap],
  ["groups", "Student groups", GraduationCap],
  ["library", "Content drive", FileText],
  ["assignments", "Assignments", ClipboardList],
  ["access", "Content access", KeyRound],
  ["analytics", "Analytics", ChartNoAxesCombined],
  ["announcements", "Announcements", Megaphone],
  ["settings", "Settings", Settings],
] as const;
export default function Shell({
  children,
  admin = false,
  unread = 0,
  onSearch,
}: {
  children: React.ReactNode;
  admin?: boolean;
  unread?: number;
  onSearch?: (s: string) => void;
}) {
  const { user, setUser, platform, isOwner } = useAuth(),
    [open, setOpen] = useState(false),
    [mobile, setMobile] = useState(window.innerWidth <= 760),
    [results, setResults] = useState<any[] | null>(null),
    [search, setSearch] = useState(""),
    toast = useToast(),
    navigate = useNavigate();
  useEffect(() => {
    const m = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(m.matches);
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  const base = admin ? "/admin" : "/app";
  return (
    <div className={`workspace ${admin ? "admin-workspace" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {open && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        inert={mobile && !open}
        className={`sidebar ${open ? "is-open" : ""}`}
      >
        <div className="sidebar-logo">
          <Logo />
          <button
            className="icon-button mobile-menu"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </div>
        <div className="workspace-label">
          {admin ? "TEACHER WORKSPACE" : "YOUR LEARNING SPACE"}
        </div>
        <nav>
          {(admin
            ? adminNav.filter(([path]) => path !== "teachers" || isOwner)
            : studentNav
          ).map(([path, title, Icon]) => (
            <NavLink
              end={!path}
              to={`${base}/${path}`}
              key={path}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>{title}</span>
            </NavLink>
          ))}
          {!admin && (
            <>
              <div className="nav-divider" />
              <NavLink to="/app/notifications" onClick={() => setOpen(false)}>
                <Bell size={19} />
                <span>Announcements</span>
                {unread > 0 && <b className="count-badge">{unread}</b>}
              </NavLink>
              <NavLink to="/app/profile" onClick={() => setOpen(false)}>
                <User size={19} />
                <span>My profile</span>
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          {!admin && (
            <div className="sidebar-note">
              <Leaf size={24} />
              <h4>A little better, every day.</h4>
              <p>It’s the small steps that take you somewhere new.</p>
              <Link to="/app/progress">
                See your growth <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
          <button
            className="sidebar-user"
            onClick={() =>
              navigate(`${base}/${admin ? "settings" : "profile"}`)
            }
          >
            <Avatar user={user} />
            <span>
              <b>{user.name}</b>
              <small>{admin ? "Teacher" : "Curious mind"}</small>
            </span>
            <ChevronDown size={15} />
          </button>
          <button
            className="logout"
            onClick={async () => {
              try {
                await post("/auth/logout");
                setUser(null);
                navigate("/");
              } catch (e: any) {
                toast(e.message, "error");
              }
            }}
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Your space <span>/</span>{" "}
            <b>{admin ? "Teach & inspire" : "Learn & grow"}</b>
          </div>
          <form
            className="header-search"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!search.trim()) return;
              if (onSearch) onSearch(search);
              else
                try {
                  setResults(
                    await api(`/search?q=${encodeURIComponent(search)}`),
                  );
                } catch (e: any) {
                  toast(e.message, "error");
                }
            }}
          >
            <Search size={17} />
            <input
              aria-label="Search learning content"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                admin
                  ? "Find students, subjects, lessons…"
                  : "Search your learning space…"
              }
            />
            <kbd>↵</kbd>
          </form>
          <Link
            to={`${base}/${admin ? "announcements" : "notifications"}`}
            className="icon-button notification-button"
            aria-label="Announcements"
          >
            <Bell size={20} />
            {unread > 0 && <i />}
          </Link>
          <Link
            to={`${base}/${admin ? "settings" : "profile"}`}
            aria-label="My profile"
          >
            <Avatar user={user} size={35} />
          </Link>
        </header>
        <main id="main-content" className="workspace-main">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>
            {platform?.supportEmail ? (
              <a href={`mailto:${platform.supportEmail}`}>
                Contact your teaching team
              </a>
            ) : (
              "Small steps. Real growth."
            )}
          </span>
          <span>
            Made for your curious mind. <span>✦</span>
          </span>
        </footer>
      </div>
      {results !== null && (
        <Modal
          title={`A little discovery: ${search}`}
          onClose={() => setResults(null)}
        >
          <div className="search-results">
            {results.map((r) => (
              <Link
                key={r.id}
                onClick={() => setResults(null)}
                to={
                  admin
                    ? r.kind === "student"
                      ? `/admin/students?q=${encodeURIComponent(r.name)}`
                      : r.kind === "video"
                        ? `/admin/materials?q=${encodeURIComponent(r.name)}`
                        : `/admin/library?type=${r.kind}&q=${encodeURIComponent(r.name)}`
                    : r.kind === "video"
                      ? `/app/watch/${r.id}`
                      : `/app/subjects/${r.id}`
                }
              >
                <span className="eyebrow">{contentKindLabel(r.kind)}</span>
                <b>{r.name}</b>
                <p>{r.description?.slice(0, 120)}</p>
              </Link>
            ))}
            {!results.length && (
              <Empty
                title="No matches just yet"
                description="Try another word or a broader search."
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
