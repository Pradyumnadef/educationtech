import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  X,
  Check,
  AlertCircle,
  LoaderCircle,
  ArrowUpRight,
  Play,
  BookOpen,
  Lock,
} from "lucide-react";
import { Link } from "react-router-dom";
export type Item = {
  id: string;
  kind: string;
  parent_id: string | null;
  name: string;
  description: string;
  thumbnail: string;
  status: string;
  duration: number;
  tags: string[];
  notes: string;
  accessible?: boolean;
  locked?: boolean;
  container?: boolean;
  created_at: number;
  public: number;
  publish_at: number | null;
  storage_key?: string;
  caption_key?: string;
  resource_key?: string;
};
export type User = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  avatar: string;
  interests: string[];
  onboarding: number;
  status: string;
  created_at: number;
};
let csrf = "";
export async function api<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const r = await fetch(`/api${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf,
      ...options.headers,
    },
  });
  const d = await r
    .json()
    .catch(() => ({ error: "The server could not complete this request." }));
  if (!r.ok)
    throw Object.assign(new Error(d.error || "Something went wrong."), {
      status: r.status,
    });
  if (d.csrf) csrf = d.csrf;
  return d;
}
export const post = (url: string, data: any = {}) =>
  api(url, { method: "POST", body: JSON.stringify(data) });
export const put = (url: string, data: any) =>
  api(url, { method: "PUT", body: JSON.stringify(data) });
export const patch = (url: string, data: any) =>
  api(url, { method: "PATCH", body: JSON.stringify(data) });
export const del = (url: string) => api(url, { method: "DELETE" });
const AuthContext = createContext<any>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [demo, setDemo] = useState(false),
    [isOwner, setIsOwner] = useState(false),
    [platform, setPlatform] = useState<any>({ name: "English Tech" }),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const d = await api("/auth/session");
      setUser(d.user);
      setDemo(d.demo);
      setIsOwner(!!d.isOwner);
      setPlatform(d.platform);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        demo,
        refresh,
        error,
        platform,
        isOwner,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
const ToastContext = createContext<(message: string, type?: string) => void>(
  () => {},
);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<any[]>([]);
  const toast = useCallback((message: string, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div className={`toast ${t.type}`} key={t.id}>
            {t.type === "success" ? (
              <Check size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{t.message}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setToasts((s) => s.filter((x) => x.id !== t.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
export function useDebounced<T>(value: T, delay = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
export function useData<T = any>(url: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setData(await api(url));
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);
  return { data, error, loading, refresh, setData };
}
export function Logo({ light = false }: { light?: boolean }) {
  const { platform } = useAuth();
  return (
    <Link
      to="/"
      className={`logo ${light ? "light" : ""}`}
      aria-label={`${platform?.name || "English Tech"} home`}
    >
      <img
        className="logo-brand-image"
        src="/assets/english-tech-brand-mark.webp"
        alt=""
        width="96"
        height="96"
        decoding="async"
      />
      {platform?.name || "English Tech"}
      <span className="logo-period">.</span>
    </Link>
  );
}
export function Avatar({ user, size = 40 }: { user: any; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, minWidth: size }}
    >
      {user?.avatar ? (
        <img src={user.avatar} alt="" />
      ) : (
        user?.name
          ?.split(" ")
          .map((n: string) => n[0])
          .slice(0, 2)
          .join("") || "L"
      )}
    </span>
  );
}
export function Button({
  children,
  busy = false,
  variant = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  variant?: string;
}) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={`button ${variant} ${props.className || ""}`}
    >
      {busy ? <LoaderCircle className="spin" size={17} /> : null}
      {children}
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  canClose = true,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  canClose?: boolean;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const requestClose = () => {
    if (canClose) onClose();
  };
  useEffect(() => {
    ref.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        const dialog = ref.current;
        if (!dialog || e.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const outside =
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom;
        if (outside) requestClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={requestClose}
          disabled={!canClose}
          aria-label="Close dialog"
        >
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) &&
        ["input", "select", "textarea"].includes(String(child.type))
          ? React.cloneElement(child as React.ReactElement<any>, {
              "aria-label": label,
            })
          : child,
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  title = "Your next chapter starts here",
  description = "Your teacher will add learning content to this space soon.",
  children,
}: {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <BookOpen size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status" aria-label="Loading">
      <div className="skeleton skeleton-title" />
      <div className="grid three">
        {[1, 2, 3].map((i) => (
          <div className="skeleton skeleton-card" key={i} />
        ))}
      </div>
      <div className="skeleton skeleton-wide" />
    </div>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: string;
  retry?: () => void;
}) {
  return (
    <div className="empty">
      <AlertCircle />
      <h3>Let’s try that again</h3>
      <p>{error}</p>
      {retry && <Button onClick={retry}>Try again</Button>}
    </div>
  );
}
export const mins = (s: number) =>
  Number(s) > 0 && Number(s) < 60
    ? `${Math.round(s)} sec`
    : `${Math.round(Number(s || 0) / 60)} min`;
export const date = (n: number) =>
  new Date(Number(n)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
export const subjectOf = (n: Item, items: Item[]): Item =>
  n.parent_id
    ? subjectOf(
        items.find((i) => i.id === n.parent_id) || { ...n, parent_id: null },
        items,
      )
    : n;
export function pathOf(node: Item, items: Item[]): string {
  const names = [node.name];
  let p = node.parent_id;
  let steps = 0;
  while (p && steps++ < 10) {
    const parent = items.find((n) => n.id === p);
    if (!parent) break;
    names.unshift(parent.name);
    p = parent.parent_id;
  }
  return names.join(" › ");
}
export function descendants(node: Item, items: Item[]): Item[] {
  const children = items.filter((i) => i.parent_id === node.id);
  return [...children, ...children.flatMap((c) => descendants(c, items))];
}
export function CourseArt({
  theme = "math",
  large = false,
}: {
  theme?: string;
  large?: boolean;
}) {
  if (theme?.startsWith("data:"))
    return (
      <div className="course-art">
        <img src={theme} alt="Subject thumbnail" />
      </div>
    );
  const t =
    theme === "physics"
      ? "physics"
      : theme === "code"
        ? "code"
        : theme === "chemistry"
          ? "chemistry"
          : theme === "biology"
            ? "biology"
            : theme === "english"
              ? "english"
              : "math";
  return (
    <div className={`course-art art-${t} ${large ? "large" : ""}`}>
      <svg viewBox="0 0 400 230" aria-hidden="true">
        <defs>
          <pattern
            id={`grid-${t}`}
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="currentColor"
              opacity=".07"
            />
          </pattern>
        </defs>
        <rect width="400" height="230" fill={`url(#grid-${t})`} />
        {t === "math" ? (
          <>
            <circle cx="280" cy="70" r="65" fill="#c3d19b" opacity=".35" />
            <path
              d="M90 175V65M65 150h230"
              stroke="#617b52"
              strokeWidth="1.5"
              opacity=".4"
            />
            <path
              d="M90 80Q190 250 287 66"
              fill="none"
              stroke="#53734c"
              strokeWidth="3"
            />
            <path
              d="M210 175l65-110 67 110z"
              fill="#d9e5b9"
              stroke="#52734b"
              strokeWidth="2"
            />
            <path d="M275 65v110" stroke="#52734b" strokeDasharray="5 5" />
            <text
              x="55"
              y="74"
              fill="#385639"
              fontSize="34"
              fontFamily="Georgia"
              fontStyle="italic"
            >
              ƒ(x) = x²
            </text>
            <text x="150" y="200" fill="#547749" fontSize="14">
              A LITTLE LOGIC. LIMITLESS POSSIBILITY.
            </text>
            <circle cx="188" cy="157" r="5" fill="#3c663f" />
          </>
        ) : t === "physics" ? (
          <>
            <circle
              cx="205"
              cy="112"
              r="59"
              fill="none"
              stroke="#bca7d8"
              strokeDasharray="4 6"
            />
            <ellipse
              cx="205"
              cy="112"
              rx="106"
              ry="34"
              fill="none"
              stroke="#84709b"
              strokeWidth="2"
              transform="rotate(-32 205 112)"
            />
            <ellipse
              cx="205"
              cy="112"
              rx="106"
              ry="34"
              fill="none"
              stroke="#84709b"
              strokeWidth="2"
              transform="rotate(32 205 112)"
            />
            <circle cx="205" cy="112" r="25" fill="#9982b1" />
            <circle cx="115" cy="157" r="10" fill="#d8ccec" />
            <circle cx="295" cy="157" r="9" fill="#78608f" />
            <text
              x="38"
              y="47"
              fill="#7a628f"
              fontSize="21"
              fontFamily="Georgia"
              fontStyle="italic"
            >
              F = ma
            </text>
            <text x="95" y="205" fill="#806698" fontSize="14">
              SMALL QUESTIONS. BIG DISCOVERIES.
            </text>
          </>
        ) : t === "code" ? (
          <>
            <rect
              x="75"
              y="37"
              width="250"
              height="150"
              rx="13"
              fill="#36576b"
            />
            <path d="M75 65h250" stroke="#74909e" />
            {[94, 107, 120].map((x) => (
              <circle key={x} cx={x} cy="51" r="3" fill="#d8c78d" />
            ))}
            <text
              x="95"
              y="96"
              fill="#9bc6b9"
              fontSize="13"
              fontFamily="monospace"
            >
              # Your next big idea
            </text>
            <text
              x="95"
              y="121"
              fill="#e3d9af"
              fontSize="15"
              fontFamily="monospace"
            >
              print("Hello, world!")
            </text>
            <text
              x="95"
              y="155"
              fill="#a4becc"
              fontSize="18"
              fontFamily="monospace"
            >
              &gt; Hello, possibilities_
            </text>
            <path d="M65 187h270l18 13H48z" fill="#7999a8" />
            <text x="110" y="223" fill="#466578" fontSize="12">
              A BLANK SCREEN. A FRESH START.
            </text>
          </>
        ) : t === "chemistry" || t === "biology" ? (
          <>
            <path
              d="M164 45h71m-57 0v64l-51 76q-7 13 12 13h119q19 0 12-13l-50-76V45"
              fill="none"
              stroke="#9e784d"
              strokeWidth="4"
            />
            <path d="M157 144h84l25 43H132z" fill="#d6b174" />
            <circle cx="199" cy="136" r="7" fill="#c69b67" />
            <circle cx="215" cy="111" r="4" fill="#c69b67" />
            <text
              x="57"
              y="89"
              fill="#a78158"
              fontSize="27"
              fontFamily="Georgia"
            >
              H₂O
            </text>
            <text
              x="285"
              y="153"
              fill="#a78158"
              fontSize="25"
              fontFamily="Georgia"
            >
              Na
            </text>
          </>
        ) : (
          <>
            <path
              d="M80 65q60-22 120 0v120q-60-22-120 0zM200 65q60-22 120 0v120q-60-22-120 0z"
              fill="#ead5c5"
              stroke="#a87860"
              strokeWidth="2"
            />
            <text
              x="107"
              y="136"
              fill="#a87860"
              fontSize="44"
              fontFamily="Georgia"
            >
              Aa
            </text>
            <path
              d="M225 92h64m-64 20h64m-64 20h50"
              stroke="#b28b72"
              strokeWidth="3"
            />
          </>
        )}
      </svg>
    </div>
  );
}
export function CourseCard({
  item,
  items,
  progress = [],
  compact = false,
}: {
  item: Item;
  items: Item[];
  progress?: any[];
  compact?: boolean;
}) {
  const children = descendants(item, items).filter(
      (i) => i.kind === "video" && i.accessible,
    ),
    completed = children.filter((c) =>
      progress.some((p) => p.video_id === c.id && p.completed),
    ).length,
    percent = children.length
      ? Math.round((completed / children.length) * 100)
      : 0;
  const subject = subjectOf(item, items);
  return (
    <Link
      to={`/app/subjects/${item.id}`}
      className={`course-card ${compact ? "compact" : ""}`}
    >
      <div className="art-wrap">
        <CourseArt theme={item.thumbnail} />
        <span className="art-badge">
          {item.locked ? (
            <>
              <Lock size={12} />
              Not assigned
            </>
          ) : (
            <>
              <Play size={11} /> {children.length} lessons
            </>
          )}
        </span>
      </div>
      <div className="course-card-body">
        <span className={`eyebrow subject-${subject.thumbnail}`}>
          {subject.name}
        </span>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="course-meta">
          <span>
            <BookOpen size={13} />{" "}
            {children.length
              ? mins(children.reduce((a, c) => a + c.duration, 0))
              : "Learning path"}
          </span>
          <span>Foundations</span>
        </div>
        {!item.locked && (
          <>
            <div className="progress-track">
              <i style={{ width: `${percent}%` }} />
            </div>
            <div className="progress-caption">
              <span>
                {completed} of {children.length} lessons complete
              </span>
              <b>{percent}%</b>
            </div>
          </>
        )}
        <span className="card-link">
          {item.locked ? "View subject" : "Continue learning"}
          <ArrowUpRight size={16} />
        </span>
      </div>
    </Link>
  );
}
const fileMimes: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  vtt: "text/vtt",
};
export async function uploadFile(
  file: File,
  onProgress: (n: number) => void,
  purpose: "content" | "assignment" | "submission" = "content",
) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const mime = file.type || fileMimes[extension] || "";
  const p = await post("/storage/prepare", {
    filename: file.name,
    mime,
    size: file.size,
    purpose,
  });
  await new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(p.method, p.url);
    if (p.cloud) x.setRequestHeader("Content-Type", mime);
    else x.setRequestHeader("X-CSRF-Token", csrf);
    x.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    x.onerror = () =>
      reject(new Error("Upload failed. Check your connection."));
    x.onload = () =>
      x.status >= 200 && x.status < 300
        ? resolve()
        : reject(new Error("Upload failed validation. Please check the file."));
    if (p.cloud) x.send(file);
    else {
      const form = new FormData();
      form.append("file", file);
      x.send(form);
    }
  });
  const result = await post(`/storage/complete/${p.id}`);
  return {
    ...result,
    id: p.id,
    filename: file.name,
    mime,
    size: file.size,
  };
}
