import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Play,
  BookOpen,
  Check,
  CheckCheck,
  Clock,
  Flame,
  Leaf,
  Sparkles,
  ChevronRight,
  Lock,
  Bell,
  Search,
  Settings,
  Download,
  Volume2,
  Target,
  Mail,
  Camera,
  ClipboardList,
  FileText,
  Upload,
  Timer,
  AlertTriangle,
  X,
} from "lucide-react";
import Shell from "../components/Shell";
import {
  api,
  post,
  patch,
  useAuth,
  useData,
  useDebounced,
  useToast,
  Avatar,
  Button,
  Field,
  Modal,
  Loading,
  Failure,
  Empty,
  Item,
  CourseCard,
  CourseArt,
  descendants,
  subjectOf,
  mins,
  date,
  Logo,
  uploadFile,
  contentKindLabel,
} from "../lib";
export function ActivityChart({ events = [] }: { events: any[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    d.setHours(0, 0, 0, 0);
    return {
      date: d,
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      value:
        events
          .filter(
            (e) =>
              Number(e.created_at) >= d.getTime() &&
              Number(e.created_at) < d.getTime() + 86400000,
          )
          .reduce((a, e) => a + Number(e.seconds), 0) / 60,
    };
  });
  const max = Math.max(...days.map((d) => d.value), 10);
  return (
    <div
      className="activity-chart"
      aria-label="Minutes learned over the last seven days"
    >
      {days.map((d, i) => (
        <div className="chart-column" key={i}>
          <span className="chart-value">{Math.round(d.value)}m</span>
          <div className="bar-space">
            <i
              style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }}
              className={i === 6 ? "today" : ""}
            />
          </div>
          <small>{d.label}</small>
        </div>
      ))}
    </div>
  );
}
export default function Student({
  onboarding = false,
}: {
  onboarding?: boolean;
}) {
  const { user } = useAuth();
  const { data, error, loading, refresh } = useData("/learning");
  const location = useLocation();
  if (onboarding) return <Onboarding />;
  if (!user.onboarding) return <Onboarding />;
  const route = location.pathname.replace(/^\/app\/?/, "").split("/");
  let body: React.ReactNode;
  if (loading) body = <Loading />;
  else if (error) body = <Failure error={error} retry={refresh} />;
  else if (route[0] === "watch" && route[1])
    body = <Watch videoId={route[1]} data={data} refresh={refresh} />;
  else if (route[0] === "subjects" && route[1])
    body = <SubjectDetail id={route[1]} data={data} />;
  else if (route[0] === "profile") body = <Profile />;
  else if (route[0] === "notifications")
    body = <Notifications data={data} refresh={refresh} />;
  else if (route[0] === "progress") body = <Progress data={data} />;
  else if (route[0] === "assignments")
    body = <StudentAssignments data={data} refresh={refresh} />;
  else if (route[0] === "videos") body = <LearningMaterials data={data} />;
  else if (route[0] === "subjects")
    body = <Library type="subjects" data={data} />;
  else if (!route[0]) body = <Overview data={data} />;
  else
    body = (
      <Empty
        title="This page isn’t in your learning path"
        description="Return to your overview to continue."
      >
        <Link to="/app" className="button">
          Your overview
        </Link>
      </Empty>
    );
  return (
    <Shell unread={data?.announcements.filter((a: any) => !a.read).length || 0}>
      {body}
    </Shell>
  );
}
function Overview({ data }: { data: any }) {
  const { user } = useAuth();
  const items: Item[] = data.content,
    progress = data.progress,
    subjects = items.filter((i) => i.kind === "subject" && i.accessible),
    videos = items.filter((i) => i.kind === "video" && i.accessible),
    completed = progress.filter((p: any) => p.completed).length;
  const continuing = [...progress]
    .filter((p: any) => !p.completed && p.position > 0)
    .sort((a, b) => b.updated_at - a.updated_at);
  const next =
    items.find((i) => i.id === continuing[0]?.video_id) ||
    videos.find(
      (i) => !progress.find((p: any) => p.video_id === i.id && p.completed),
    );
  const nextSubject =
    next &&
    subjects.find((s) => descendants(s, items).some((i) => i.id === next.id));
  const totalWatch = data.events.reduce(
      (a: number, e: any) => a + Number(e.seconds),
      0,
    ),
    percent = videos.length ? Math.round((completed / videos.length) * 100) : 0;
  const dates = new Set(
    data.events.map((e: any) => new Date(Number(e.created_at)).toDateString()),
  );
  let streak = 0;
  const d = new Date();
  if (!dates.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (dates.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {data.settings?.welcome || "A LITTLE PROGRESS, EVERY DAY"}
          </span>
          <h1>
            Welcome back, {user.name.split(" ")[0]}{" "}
            <span className="wave">✦</span>
          </h1>
          <p>It’s a good day to discover something new.</p>
        </div>
        <div className="date-chip">
          <span className="green-dot" />
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </div>
      </div>
      <section className="welcome-banner">
        <div>
          <span className="banner-tag">
            <Sparkles size={13} /> YOUR NEXT LIGHTBULB MOMENT
          </span>
          <h2>
            Big things start
            <br />
            with a little <em>curiosity.</em>
          </h2>
          <p>Pick up where you left off. Your next discovery is waiting.</p>
          <Link
            className="button cream"
            to={next ? `/app/watch/${next.id}` : "/app/subjects"}
          >
            {next ? "Let’s keep learning" : "Explore your subjects"}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="banner-art">
          <svg viewBox="0 0 380 240" aria-hidden="true">
            <circle cx="209" cy="119" r="100" fill="#345845" />
            <ellipse
              cx="216"
              cy="137"
              rx="128"
              ry="45"
              fill="none"
              stroke="#889c6f"
              transform="rotate(-26 216 137)"
            />
            <path
              d="M133 189l-20-123q42-8 79 18 34-36 82-28l23 125q-46-9-86 26-37-24-78-18z"
              fill="#dbe3b5"
            />
            <path
              d="M192 84l19 123M136 90l42 13m-39 2 42 13m-39 2 42 13m-39 2 42 13m28-53 43-18m-40 33 43-18m-40 33 43-18m-40 33 43-18"
              fill="none"
              stroke="#889c70"
              strokeWidth="2"
            />
            <path
              d="M293 43v24m-12-12h24m-201 114v18m-9-9h18"
              stroke="#d9cf92"
              strokeWidth="3"
            />
            <circle cx="305" cy="159" r="9" fill="#aab989" />
            <circle cx="104" cy="38" r="5" fill="#aab989" />
          </svg>
          <div className="banner-art-label">
            <Check size={12} /> ONE LESSON CLOSER TO YOUR GOALS
          </div>
        </div>
      </section>
      <div className="stats-grid">
        <Stat
          icon={BookOpen}
          label="Assigned subjects"
          value={subjects.length}
          note="A world to explore"
          color="green"
        />
        <Stat
          icon={CheckCheck}
          label="Lessons completed"
          value={completed}
          note={`${videos.length - completed} more little discoveries`}
          color="purple"
        />
        <Stat
          icon={Clock}
          label="Learning time"
          value={mins(totalWatch)}
          note="Over the last 30 days"
          color="orange"
        />
        <Stat
          icon={Flame}
          label="Learning streak"
          value={`${streak} ${streak === 1 ? "day" : "days"}`}
          note={
            streak
              ? "Keep your curiosity going"
              : "A fresh start is a step away"
          }
          color="blue"
        />
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <div className="section-heading compact">
            <h2>Keep your momentum</h2>
            <Link to="/app/videos">
              All lessons <ArrowUpRight size={15} />
            </Link>
          </div>
          {next ? (
            <Link className="continue-card" to={`/app/watch/${next.id}`}>
              <div className="continue-art">
                <CourseArt theme={next.thumbnail} />
                <span className="play-circle">
                  <Play fill="currentColor" size={18} />
                </span>
              </div>
              <div className="continue-info">
                <span className="eyebrow">
                  {nextSubject?.name || "YOUR NEXT LESSON"}
                </span>
                <h3>{next.name}</h3>
                <p>
                  {mins(next.duration)} <span>·</span>{" "}
                  {subjectOf(next, items).name}
                </p>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${Math.min(100, ((continuing.find((p: any) => p.video_id === next.id)?.position || 0) / (next.duration || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="progress-caption">
                  <span>
                    {continuing.some((p: any) => p.video_id === next.id)
                      ? "Ready when you are"
                      : "A new beginning"}
                  </span>
                  <b>
                    Continue <ArrowRight size={13} />
                  </b>
                </div>
              </div>
            </Link>
          ) : (
            <Empty
              title={
                videos.length
                  ? "A chapter well finished."
                  : "Your path is taking shape."
              }
              description={
                videos.length
                  ? "You’ve completed every assigned lesson. Revisit a favorite or check back for something new."
                  : "Your teacher will assign your first lessons soon."
              }
            />
          )}
          <div className="section-heading compact course-section-title">
            <h2>
              Your subjects <span>{subjects.length}</span>
            </h2>
            <Link to="/app/subjects">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="grid two">
            {subjects.slice(0, 2).map((c) => (
              <CourseCard
                key={c.id}
                item={c}
                items={items}
                progress={progress}
              />
            ))}
          </div>
          {!subjects.length && <Empty />}
        </div>
        <aside className="dashboard-secondary">
          <section className="panel weekly-panel">
            <div className="panel-title">
              <h3>Your weekly rhythm</h3>
              <span className="pill tiny">This week</span>
            </div>
            <div className="weekly-number">
              {Math.round(
                data.events
                  .filter(
                    (e: any) =>
                      Number(e.created_at) > Date.now() - 7 * 86400000,
                  )
                  .reduce((a: number, e: any) => a + Number(e.seconds), 0) / 60,
              )}
              <span> minutes of discovery</span>
            </div>
            <ActivityChart events={data.events} />
            <div className="chart-foot">
              <Leaf size={14} /> Weekly goal: {data.settings?.weeklyGoal || 120}{" "}
              minutes.
            </div>
          </section>
          <section className="panel journey-panel">
            <h3>A little further along</h3>
            <div
              className="progress-ring"
              style={{
                background: `conic-gradient(#47684b ${percent}%, #eceee3 0)`,
              }}
            >
              <div>
                <b>{percent}%</b>
                <small>of your journey</small>
              </div>
            </div>
            <p>
              {completed} lessons down.
              <br />
              So much possibility ahead.
            </p>
            <Link to="/app/progress">
              See your progress <ArrowUpRight size={14} />
            </Link>
          </section>
        </aside>
      </div>
      {data.announcements[0] && (
        <section className="announcement-banner">
          <span className="announcement-icon">
            <Bell size={20} />
          </span>
          <div>
            <span className="eyebrow">A NOTE FROM YOUR TEACHER</span>
            <h3>{data.announcements[0].title}</h3>
            <p>{data.announcements[0].body}</p>
          </div>
          <Link to="/app/notifications" aria-label="Read announcements">
            <ArrowUpRight size={21} />
          </Link>
        </section>
      )}
    </>
  );
}
export function Stat({ icon: Icon, label, value, note, color = "green" }: any) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>
          <Icon size={18} />
        </span>
      </div>
      <b>{value}</b>
      <small>{note}</small>
    </div>
  );
}
function Library({ type, data }: { type: string; data: any }) {
  const location = useLocation();
  const [search, setSearch] = useState(
      new URLSearchParams(location.search).get("q") || "",
    ),
    [filter, setFilter] = useState("all");
  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get("q") || "");
  }, [location.search]);
  const debounced = useDebounced(search);
  const items: Item[] = data.content;
  const kind = type === "subjects" ? "subject" : "video";
  const filtered = items.filter(
    (i) =>
      i.kind === kind &&
      (kind !== "video" || i.accessible) &&
      `${i.name} ${i.description}`
        .toLowerCase()
        .includes(debounced.toLowerCase()) &&
      (filter === "all" || (filter === "assigned" ? i.accessible : i.locked)),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
          <h1>
            {type === "subjects"
              ? "A world to explore"
              : "One lesson at a time"}
          </h1>
          <p>Space to discover. Room to grow. A pace that’s yours.</p>
        </div>
      </div>
      <div className="library-toolbar">
        <div className="tabs">
          {["all", "assigned", ...(kind === "video" ? [] : ["locked"])].map(
            (t) => (
              <button
                key={t}
                className={filter === t ? "active" : ""}
                onClick={() => setFilter(t)}
              >
                {t === "all"
                  ? "All " + type
                  : t === "assigned"
                    ? "Assigned to you"
                    : "Not assigned"}
              </button>
            ),
          )}
        </div>
        <label className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Find a ${kind}…`}
            aria-label={`Search ${type}`}
          />
        </label>
      </div>
      {!filtered.length ? (
        <Empty
          title="A little quiet here"
          description="Try a different search, or check back when your teacher adds new content."
        />
      ) : kind === "video" ? (
        <div className="video-list">
          {filtered.map((v, i) => (
            <VideoRow
              key={v.id}
              video={v}
              index={i}
              progress={data.progress.find((p: any) => p.video_id === v.id)}
            />
          ))}
        </div>
      ) : (
        <div className="grid three">
          {filtered.map((c) => (
            <CourseCard
              key={c.id}
              item={c}
              items={items}
              progress={data.progress}
            />
          ))}
        </div>
      )}
    </>
  );
}
function fileSize(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function LearningMaterials({ data }: { data: any }) {
  const [tab, setTab] = useState<"videos" | "documents">("videos");
  const [search, setSearch] = useState("");
  const location = useLocation();
  const debounced = useDebounced(search);
  const items: Item[] = data.content;
  const selectedModuleId = new URLSearchParams(location.search).get("module");
  useEffect(() => {
    setSearch("");
    setTab("videos");
  }, [selectedModuleId]);
  const selectedModule = items.find(
    (item) =>
      item.id === selectedModuleId &&
      item.kind === "chapter" &&
      item.accessible,
  );
  const allLessons = items.filter(
    (item) => item.kind === "video" && item.accessible,
  );
  const matches = (value: string) =>
    value.toLowerCase().includes(debounced.toLowerCase());
  const moduleGroups = items
    .filter((item) => item.kind === "chapter" && item.accessible)
    .map((module) => {
      const moduleIds = new Set([
        module.id,
        ...descendants(module, items).map((item) => item.id),
      ]);
      const lessons = allLessons.filter((lesson) => moduleIds.has(lesson.id));
      return {
        module,
        subject: subjectOf(module, items),
        lessons,
        videoCount: lessons.reduce(
          (total, lesson) => total + Number(lesson.video_count || 0),
          0,
        ),
        documentCount: lessons.reduce(
          (total, lesson) => total + Number(lesson.file_count || 0),
          0,
        ),
      };
    })
    .filter(
      (group) =>
        (group.videoCount > 0 || group.documentCount > 0) &&
        matches(
          `${group.subject.name} ${group.module.name} ${group.module.description} ${group.lessons.map((lesson) => lesson.name).join(" ")}`,
        ),
    );
  if (!selectedModule) {
    const subjects = Array.from(
      new Map(
        moduleGroups.map((group) => [group.subject.id, group.subject]),
      ).values(),
    );
    return (
      <>
        <div className="page-heading">
          <div>
            <span className="eyebrow">YOUR LEARNING LIBRARY</span>
            <h1>Learning materials</h1>
            <p>Choose a subject and module to see its videos and documents.</p>
          </div>
        </div>
        <div className="student-material-toolbar module-library-search">
          <label className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search subjects or modules…"
              aria-label="Search subjects or modules"
            />
          </label>
          <span>
            {moduleGroups.length}{" "}
            {moduleGroups.length === 1 ? "module" : "modules"}
          </span>
        </div>
        {!moduleGroups.length ? (
          <Empty
            title={
              search ? "No modules found" : "No learning materials assigned yet"
            }
            description={
              search
                ? "Try a different subject or module name."
                : "Your teacher will share modules and learning materials here."
            }
          />
        ) : (
          <div className="student-subject-materials">
            {subjects.map((subject) => {
              const subjectModules = moduleGroups.filter(
                (group) => group.subject.id === subject.id,
              );
              return (
                <section className="student-subject-group" key={subject.id}>
                  <header>
                    <span className="student-subject-icon">
                      <BookOpen size={19} />
                    </span>
                    <div>
                      <span className="eyebrow">SUBJECT</span>
                      <h2>{subject.name}</h2>
                    </div>
                    <span>
                      {subjectModules.length}{" "}
                      {subjectModules.length === 1 ? "module" : "modules"}
                    </span>
                  </header>
                  <div className="student-module-grid">
                    {subjectModules.map((group) => (
                      <Link
                        className="student-module-card"
                        to={`/app/videos?module=${encodeURIComponent(group.module.id)}`}
                        key={group.module.id}
                      >
                        <span className="student-module-label">MODULE</span>
                        <h3>{group.module.name}</h3>
                        {group.module.description && (
                          <p>{group.module.description}</p>
                        )}
                        <div>
                          <span>
                            <Play size={14} /> {group.videoCount} videos
                          </span>
                          <span>
                            <FileText size={14} /> {group.documentCount}{" "}
                            documents
                          </span>
                        </div>
                        <strong>
                          Open module <ArrowRight size={15} />
                        </strong>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </>
    );
  }
  const selectedIds = new Set([
    selectedModule.id,
    ...descendants(selectedModule, items).map((item) => item.id),
  ]);
  const lessons = allLessons.filter((lesson) => selectedIds.has(lesson.id));
  const selectedSubject = subjectOf(selectedModule, items);
  const videos = lessons.filter(
    (item) =>
      Number(item.video_count) > 0 &&
      matches(
        `${item.name} ${item.description} ${(item.assets || []).map((asset) => asset.filename).join(" ")}`,
      ),
  );
  const documents = lessons.flatMap((lesson) =>
    (lesson.assets || [])
      .filter(
        (asset) =>
          asset.asset_type === "file" &&
          matches(`${asset.filename} ${lesson.name} ${lesson.description}`),
      )
      .map((asset) => ({ asset, lesson })),
  );
  const visibleCount = tab === "videos" ? videos.length : documents.length;
  return (
    <>
      <Link className="back-link" to="/app/videos">
        <ArrowLeft size={15} /> All subjects and modules
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{selectedSubject.name} · MODULE</span>
          <h1>{selectedModule.name}</h1>
          <p>
            Choose Videos or Documents to open the materials in this module.
          </p>
        </div>
      </div>
      <div
        className="material-library-tabs student-material-tabs"
        role="tablist"
        aria-label="Learning material type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "videos"}
          className={tab === "videos" ? "active" : ""}
          onClick={() => setTab("videos")}
        >
          <Play size={17} /> Videos <span>{videos.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "documents"}
          className={tab === "documents" ? "active" : ""}
          onClick={() => setTab("documents")}
        >
          <FileText size={17} /> Documents <span>{documents.length}</span>
        </button>
      </div>
      <div className="student-material-toolbar">
        <label className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${tab}…`}
            aria-label={`Search ${tab}`}
          />
        </label>
        <span>
          {visibleCount} {visibleCount === 1 ? "item" : "items"}
        </span>
      </div>
      {!visibleCount ? (
        <Empty
          title={search ? `No ${tab} found` : `No ${tab} assigned yet`}
          description={
            search
              ? "Try a different search."
              : "Your teacher will share learning materials here."
          }
        />
      ) : tab === "videos" ? (
        <div className="video-list">
          {videos.map((video, index) => (
            <VideoRow
              key={video.id}
              video={video}
              index={index}
              progress={data.progress.find(
                (entry: any) => entry.video_id === video.id,
              )}
            />
          ))}
        </div>
      ) : (
        <div className="student-document-list">
          {documents.map(({ asset, lesson }) => (
            <a
              className="student-document-row"
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              key={`${lesson.id}-${asset.id}`}
            >
              <span className="student-document-icon">
                <FileText size={20} />
              </span>
              <span className="student-document-copy">
                <strong>{asset.filename}</strong>
                <small>
                  {lesson.name} · {fileSize(asset.size)}
                </small>
              </span>
              <span className="student-document-action">
                Open <ArrowUpRight size={16} />
              </span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
function VideoRow({
  video,
  index,
  progress,
}: {
  video: Item;
  index: number;
  progress?: any;
}) {
  return (
    <Link to={`/app/watch/${video.id}`} className="video-row">
      <span className={`lesson-index ${progress?.completed ? "complete" : ""}`}>
        {progress?.completed ? (
          <Check size={16} />
        ) : (
          String(index + 1).padStart(2, "0")
        )}
      </span>
      <div>
        <h3>{video.name}</h3>
        <p>
          {mins(video.duration)} <span>·</span>{" "}
          {progress?.completed
            ? "Completed"
            : progress?.position
              ? "In progress"
              : "Ready to explore"}
        </p>
      </div>
      <Play size={17} />
    </Link>
  );
}
function SubjectDetail({ id, data }: { id: string; data: any }) {
  const items: Item[] = data.content,
    node = items.find((n) => n.id === id);
  if (!node)
    return (
      <Empty
        title="This learning path isn’t available"
        description="Return to your library to see the content shared with you."
      />
    );
  const children = descendants(node, items),
    videos = children.filter((c) => c.kind === "video" && c.accessible),
    modules = items.filter(
      (item) => item.kind === "chapter" && item.parent_id === node.id,
    );
  return (
    <>
      <Link className="back-link" to="/app/subjects">
        <ArrowLeft size={15} /> Your subjects
      </Link>
      <div className="course-detail-hero">
        <div>
          <span className="eyebrow">
            {contentKindLabel(node.kind).toUpperCase()} ·{" "}
            {subjectOf(node, items).name}
          </span>
          <h1>{node.name}</h1>
          <p>{node.description}</p>
          <div className="course-detail-meta">
            <span>
              <BookOpen size={15} /> {modules.length} modules
            </span>
            <span>
              <Play size={15} /> {videos.length} lessons
            </span>
            <span>
              <Clock size={15} />{" "}
              {mins(videos.reduce((a, v) => a + v.duration, 0))}
            </span>
          </div>
          {videos[0] && (
            <Link className="button" to={`/app/watch/${videos[0].id}`}>
              Start learning <ArrowRight size={17} />
            </Link>
          )}
        </div>
        <CourseArt theme={node.thumbnail} large />
      </div>
      {node.locked ? (
        <Empty
          title="A possibility for another day"
          description="This content has not been assigned to your account yet. Let your teacher know you’re interested."
        >
          <Lock size={24} />
        </Empty>
      ) : (
        <>
          <div className="section-heading compact">
            <h2>Your modules</h2>
            <span className="muted">Choose a lesson and start learning.</span>
          </div>
          <div className="subject-curriculum">
            {modules.map((module, moduleIndex) => {
              const moduleVideos = descendants(module, items).filter(
                (item) => item.kind === "video" && item.accessible,
              );
              return (
                <section className="module-card" key={module.id}>
                  <header className="module-heading">
                    <span className="module-number">
                      MODULE {String(moduleIndex + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{module.name}</h3>
                      {module.description && <p>{module.description}</p>}
                    </div>
                    <span className="module-count">
                      {moduleVideos.length}{" "}
                      {moduleVideos.length === 1 ? "lesson" : "lessons"}
                    </span>
                  </header>
                  <div className="module-materials video-list">
                    {moduleVideos.map((video, videoIndex) => (
                      <VideoRow
                        key={video.id}
                        video={video}
                        index={videoIndex}
                        progress={data.progress.find(
                          (progress: any) => progress.video_id === video.id,
                        )}
                      />
                    ))}
                    {!moduleVideos.length && (
                      <p className="module-empty">
                        Your teacher has not added learning materials to this
                        module yet.
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          {!modules.length && (
            <Empty
              title="No modules here yet"
              description="Your teacher will add modules and learning materials to this subject."
            />
          )}
        </>
      )}
    </>
  );
}
function Watch({
  videoId,
  data,
  refresh,
}: {
  videoId: string;
  data: any;
  refresh: () => void;
}) {
  const { user } = useAuth(),
    { data: lesson, error, loading } = useData(`/videos/${videoId}`),
    ref = useRef<HTMLVideoElement>(null),
    toast = useToast(),
    [tab, setTab] = useState("notes"),
    [denied, setDenied] = useState(""),
    [speed, setSpeed] = useState("1"),
    [selectedVideo, setSelectedVideo] = useState("");
  const lastTime = useRef(0),
    lastSave = useRef(Date.now()),
    lastLocalSave = useRef(0);
  const positionKey = `english-tech:video-position:${user.id}:${videoId}`;
  const rememberPosition = (position: number, complete = false) => {
    try {
      if (complete) localStorage.removeItem(positionKey);
      else if (Number.isFinite(position) && position > 0)
        localStorage.setItem(positionKey, String(position));
    } catch {}
  };
  const items: Item[] = data.content;
  const moduleIdFor = (item?: Item) => {
    let current = item;
    let steps = 0;
    while (current && current.kind !== "chapter" && steps++ < 10)
      current = items.find((candidate) => candidate.id === current?.parent_id);
    return current?.id;
  };
  const activeModuleId = moduleIdFor(items.find((item) => item.id === videoId));
  const related = items.filter(
      (i) =>
        i.kind === "video" && i.accessible && moduleIdFor(i) === activeModuleId,
    ),
    index = related.findIndex((i) => i.id === videoId);
  const save = async (complete = false) => {
    const v = ref.current;
    if (!v || !Number.isFinite(v.currentTime)) return;
    rememberPosition(v.currentTime, complete);
    const elapsed = (Date.now() - lastSave.current) / 1000;
    lastSave.current = Date.now();
    const delta = Math.max(
      0,
      Math.min(20, v.currentTime - lastTime.current, elapsed),
    );
    lastTime.current = v.currentTime;
    try {
      await post(`/progress/${videoId}`, {
        position: v.currentTime,
        seconds: delta,
        completed: complete,
      });
    } catch (e: any) {
      if (e.status === 403 || e.status === 401) {
        v.pause();
        v.removeAttribute("src");
        v.load();
        setDenied(e.message);
      } else toast(e.message, "error");
    }
  };
  useEffect(() => {
    if (!lesson) return;
    setSelectedVideo(lesson.videos?.[0]?.url || lesson.media || "");
  }, [lesson, videoId]);
  useEffect(() => {
    setDenied("");
    lastTime.current = 0;
    lastSave.current = Date.now();
    lastLocalSave.current = 0;
    const timer = setInterval(() => {
      if (ref.current && !ref.current.paused) save();
    }, 10000);
    return () => {
      clearInterval(timer);
    };
  }, [videoId]);
  if (loading) return <Loading />;
  if (error || denied) return <Failure error={error || denied} />;
  return (
    <>
      <Link className="back-link" to="/app/videos">
        <ArrowLeft size={15} /> Your lessons
      </Link>
      <div className="watch-layout">
        <div>
          <div className="video-player">
            {selectedVideo ? (
              <video
                key={`${videoId}:${selectedVideo}`}
                ref={ref}
                controls
                controlsList="nodownload"
                playsInline
                preload="metadata"
                onContextMenu={(e) => e.preventDefault()}
                onLoadedMetadata={() => {
                  if (ref.current) {
                    let localPosition = 0;
                    try {
                      localPosition =
                        Number(localStorage.getItem(positionKey)) || 0;
                    } catch {}
                    ref.current.currentTime = Math.min(
                      Math.max(lesson.progress?.position || 0, localPosition),
                      Math.max(0, ref.current.duration - 1),
                    );
                    lastTime.current = ref.current.currentTime;
                    ref.current.playbackRate = Number(speed);
                  }
                }}
                onTimeUpdate={() => {
                  const video = ref.current;
                  if (!video || Date.now() - lastLocalSave.current < 1000)
                    return;
                  lastLocalSave.current = Date.now();
                  rememberPosition(video.currentTime);
                }}
                onPause={() => save()}
                onEnded={() => {
                  save(true);
                  toast("One more little win. Lesson completed!");
                  refresh();
                }}
                onError={() =>
                  toast(
                    "The video could not load. It may still be processing, or your access may have changed.",
                    "error",
                  )
                }
              >
                <source src={selectedVideo} />
                {lesson.captions && (
                  <track
                    src={lesson.captions}
                    kind="captions"
                    srcLang="en"
                    label="English"
                    default
                  />
                )}
              </video>
            ) : (
              <Empty
                title="This lesson is getting ready"
                description="Your teacher has created this lesson and will attach its video soon."
              />
            )}
          </div>
          {lesson.videos?.length > 1 && (
            <div
              className="lesson-video-picker"
              aria-label="Videos in this learning material"
            >
              <strong>Videos in this lesson</strong>
              <div>
                {lesson.videos.map((video: any, index: number) => (
                  <button
                    type="button"
                    key={video.id}
                    className={selectedVideo === video.url ? "active" : ""}
                    onClick={() => setSelectedVideo(video.url)}
                  >
                    <Play size={14} /> {video.filename || `Video ${index + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="player-toolbar">
            <span>
              <ShieldIcon /> Your private learning space
            </span>
            <label>
              Playback speed{" "}
              <select
                aria-label="Playback speed"
                value={speed}
                onChange={(e) => {
                  setSpeed(e.target.value);
                  if (ref.current)
                    ref.current.playbackRate = Number(e.target.value);
                }}
              >
                {["0.5", "0.75", "1", "1.25", "1.5", "2"].map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="lesson-heading">
            <span className="eyebrow">
              {subjectOf(lesson, items).name} · {mins(lesson.duration)}
            </span>
            <h1>{lesson.name}</h1>
            <p>{lesson.description}</p>
          </div>
          <div className="lesson-actions">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await post(`/progress/${videoId}`, {
                    position: ref.current?.currentTime || 0,
                    completed: true,
                  });
                  toast("Lesson marked as completed.");
                  refresh();
                } catch (e: any) {
                  toast(e.message, "error");
                }
              }}
            >
              <Check size={16} /> Mark as completed
            </Button>
            {related[index + 1] && (
              <Link
                className="button"
                to={`/app/watch/${related[index + 1].id}`}
              >
                Next lesson <ArrowRight size={16} />
              </Link>
            )}
            {related[index - 1] && (
              <Link
                className="text-button"
                to={`/app/watch/${related[index - 1].id}`}
              >
                <ArrowLeft size={15} /> Previous
              </Link>
            )}
          </div>
          <div className="tabs">
            <button
              className={tab === "notes" ? "active" : ""}
              onClick={() => setTab("notes")}
            >
              Lesson notes
            </button>
            <button
              className={tab === "resources" ? "active" : ""}
              onClick={() => setTab("resources")}
            >
              Resources
            </button>
          </div>
          <div className="lesson-notes">
            {tab === "notes" ? (
              <p>
                {lesson.notes || "No notes have been added to this lesson yet."}
              </p>
            ) : lesson.files?.length ? (
              <div className="lesson-resource-list">
                {lesson.files.map((file: any) => (
                  <a className="button secondary" href={file.url} key={file.id}>
                    <Download size={16} /> {file.filename}
                  </a>
                ))}
              </div>
            ) : lesson.resource ? (
              <a className="button secondary" href={lesson.resource}>
                <Download size={16} /> Download lesson resource
              </a>
            ) : (
              <p>No files have been added to this lesson yet.</p>
            )}
          </div>
        </div>
        <aside className="panel playlist">
          <span className="eyebrow">YOUR LEARNING PATH</span>
          <h3>Up next, more possibility.</h3>
          {related.map((v, i) => (
            <Link
              className={v.id === videoId ? "current" : ""}
              to={`/app/watch/${v.id}`}
              key={v.id}
            >
              <span>
                {v.id === videoId ? (
                  <Play size={14} />
                ) : data.progress.some(
                    (p: any) => p.video_id === v.id && p.completed,
                  ) ? (
                  <Check size={14} />
                ) : (
                  i + 1
                )}
              </span>
              <div>
                <b>{v.name}</b>
                <small>{mins(v.duration)}</small>
              </div>
            </Link>
          ))}
        </aside>
      </div>
    </>
  );
}
function ShieldIcon() {
  return <Lock size={13} />;
}
function Progress({ data }: { data: any }) {
  const subjects = data.content.filter(
    (n: Item) => n.kind === "subject" && n.accessible,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LOOK HOW FAR YOU’VE COME</span>
          <h1>Small steps. Real growth.</h1>
          <p>Every moment of learning moves you a little further.</p>
        </div>
        <Leaf size={36} />
      </div>
      <div className="grid two">
        <section className="panel">
          <h3>Your weekly rhythm</h3>
          <ActivityChart events={data.events} />
        </section>
        <section className="panel progress-summary">
          <Target size={34} />
          <h2>
            {data.progress.filter((p: any) => p.completed).length} lightbulb
            moments
          </h2>
          <p>Lessons completed, ideas explored, and confidence earned.</p>
          <span>
            {mins(
              data.events.reduce(
                (a: number, e: any) => a + Number(e.seconds),
                0,
              ),
            )}{" "}
            invested in yourself this month.
          </span>
        </section>
      </div>
      <div className="section-heading compact">
        <h2>Your subjects, in perspective</h2>
      </div>
      <div className="grid three">
        {subjects.map((c: Item) => (
          <CourseCard
            key={c.id}
            item={c}
            items={data.content}
            progress={data.progress}
          />
        ))}
      </div>
      <div className="section-heading compact">
        <h2>Recently watched</h2>
      </div>
      <div className="video-list">
        {[...data.progress]
          .sort((a, b) => b.updated_at - a.updated_at)
          .slice(0, 10)
          .map((p: any, i: number) => {
            const v = data.content.find((c: Item) => c.id === p.video_id);
            return v ? (
              <VideoRow key={p.id} video={v} progress={p} index={i} />
            ) : null;
          })}
      </div>
    </>
  );
}
function Countdown({ deadline }: { deadline: number }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, deadline - Date.now()),
  );
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const total = Math.floor(remaining / 1000),
    days = Math.floor(total / 86400),
    hours = Math.floor((total % 86400) / 3600),
    minutes = Math.floor((total % 3600) / 60),
    seconds = total % 60;
  return (
    <span
      className={remaining ? "countdown" : "countdown ended"}
      aria-live="polite"
    >
      <Timer size={15} />{" "}
      {remaining
        ? `${days ? `${days}d ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : "Time ended"}
    </span>
  );
}
function StudentAssignments({
  data,
  refresh,
}: {
  data: any;
  refresh: () => Promise<void> | void;
}) {
  const assignments = data.assignments || [],
    [selected, setSelected] = useState<any>(null);
  const submitted = assignments.filter(
    (a: any) => a.submission?.submitted_at,
  ).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR WORK. YOUR PROGRESS.</span>
          <h1>Assignments made clear.</h1>
          <p>
            Keep track of instructions, files, timers, and everything you have
            submitted.
          </p>
        </div>
      </div>
      <div className="assignment-summary grid three">
        <Stat
          icon={ClipboardList}
          label="Assigned"
          value={assignments.length}
        />
        <Stat
          icon={Clock}
          label="To complete"
          value={assignments.length - submitted}
        />
        <Stat icon={CheckCheck} label="Submitted" value={submitted} />
      </div>
      <div className="student-assignment-list">
        {assignments.map((a: any) => {
          const closed = a.effective_deadline <= Date.now();
          return (
            <button
              className="student-assignment-card panel"
              key={a.id}
              onClick={() => setSelected(a)}
            >
              <span
                className={`assignment-state ${a.submission?.submitted_at ? "submitted" : closed ? "closed" : "open"}`}
              >
                {a.submission?.submitted_at ? (
                  <>
                    <Check size={14} /> Submitted
                  </>
                ) : closed ? (
                  <>
                    <Lock size={14} /> Closed
                  </>
                ) : (
                  <>Open</>
                )}
              </span>
              <div>
                <h2>{a.title}</h2>
                <p>{a.description}</p>
              </div>
              <div className="student-assignment-footer">
                <span>
                  <FileText size={15} />
                  {a.resources.length} teacher files
                </span>
                {a.time_limit_minutes > 0 && !a.submission?.started_at ? (
                  <span>
                    <Timer size={15} />
                    {a.time_limit_minutes} minutes after start
                  </span>
                ) : (
                  <Countdown deadline={a.effective_deadline} />
                )}
                <ChevronRight size={19} />
              </div>
            </button>
          );
        })}
      </div>
      {!assignments.length && (
        <Empty
          title="No assignments right now"
          description="When your teacher gives you an assignment, it will appear here."
        />
      )}
      {selected && (
        <AssignmentWork
          assignment={selected}
          refresh={refresh}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function AssignmentWork({ assignment, refresh, onClose }: any) {
  const [submission, setSubmission] = useState(assignment.submission),
    [files, setFiles] = useState<any[]>([]),
    [note, setNote] = useState(assignment.submission?.note || ""),
    [uploading, setUploading] = useState(false),
    [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false),
    toast = useToast();
  const effectiveDeadline =
    submission?.started_at && assignment.time_limit_minutes > 0
      ? Math.min(
          assignment.due_at,
          submission.started_at + assignment.time_limit_minutes * 60000,
        )
      : assignment.due_at;
  const closed = effectiveDeadline <= Date.now();
  async function start() {
    setBusy(true);
    try {
      const result = await post(`/assignments/${assignment.id}/start`);
      setSubmission(result);
      toast("Your timer has started. You’ve got this.");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    if (files.length + list.length > 5)
      return toast("You can submit up to 5 files.", "error");
    setUploading(true);
    try {
      const added: { id: string; filename: string; size: number }[] = [];
      for (const file of Array.from(list)) {
        const uploaded = await uploadFile(file, setProgress, "submission");
        if (uploaded.state !== "ready")
          throw new Error(
            "The file is still being checked. Try again shortly.",
          );
        added.push({ id: uploaded.id, filename: file.name, size: file.size });
      }
      setFiles((current) => [...current, ...added]);
      toast("Your file is ready to submit.");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }
  return (
    <Modal title={assignment.title} wide onClose={onClose}>
      <div className="assignment-detail-head">
        <div>
          <span
            className={`assignment-state ${submission?.submitted_at ? "submitted" : closed ? "closed" : "open"}`}
          >
            {submission?.submitted_at
              ? "Submitted"
              : closed
                ? "Closed"
                : "Open"}
          </span>
          <p>{assignment.description}</p>
          {assignment.quiz_url &&
            !closed &&
            (!assignment.time_limit_minutes || submission?.started_at) && (
              <a
                className="button quiz-link"
                href={assignment.quiz_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Google Quiz <ArrowUpRight size={15} />
              </a>
            )}
        </div>
        <div>
          <b>
            {submission?.started_at && assignment.time_limit_minutes
              ? "Time remaining"
              : "Deadline"}
          </b>
          {submission?.started_at && assignment.time_limit_minutes ? (
            <Countdown deadline={effectiveDeadline} />
          ) : (
            <span>{new Date(assignment.due_at).toLocaleString()}</span>
          )}
          <small>
            {assignment.time_limit_minutes
              ? `${assignment.time_limit_minutes}-minute timer starts once`
              : "Submit before the deadline"}
          </small>
        </div>
      </div>
      {!!assignment.resources.length && (
        <>
          <div className="section-heading compact">
            <h2>Files from your teacher</h2>
          </div>
          <div className="file-list">
            {assignment.resources.map((f: any) => (
              <a
                className="file-row"
                href={`/api/storage/assignment/${assignment.id}/resource/${f.id}`}
                key={f.id}
              >
                <FileText size={18} />
                <span>
                  <b>{f.filename}</b>
                  <small>{Math.ceil(f.size / 1024)} KB</small>
                </span>
                <Download size={16} />
              </a>
            ))}
          </div>
        </>
      )}
      {assignment.time_limit_minutes > 0 &&
      !submission?.started_at &&
      !closed ? (
        <section className="timer-start">
          <Timer size={30} />
          <div>
            <h3>Ready to begin?</h3>
            <p>
              The {assignment.time_limit_minutes}-minute timer cannot be paused
              or restarted.
            </p>
          </div>
          <Button busy={busy} onClick={start}>
            Start assignment
          </Button>
        </section>
      ) : (
        <>
          {submission?.files?.length > 0 && (
            <>
              <div className="section-heading compact">
                <h2>Your submitted files</h2>
              </div>
              <div className="file-list">
                {submission.files.map((f: any) => (
                  <a
                    className="file-row"
                    href={`/api/storage/submission/${submission.id}/file/${f.id}`}
                    key={f.id}
                  >
                    <FileText size={18} />
                    <span>
                      <b>{f.filename}</b>
                    </span>
                    <Download size={16} />
                  </a>
                ))}
              </div>
            </>
          )}
          {!closed && (
            <section className="submission-box">
              <div className="section-heading compact">
                <h2>
                  {submission?.submitted_at
                    ? "Replace your submission"
                    : "Send your work"}
                </h2>
              </div>
              <label className="document-upload">
                <Upload size={24} />
                <b>
                  {uploading
                    ? `Uploading… ${progress}%`
                    : "Choose your answer files"}
                </b>
                <small>
                  PDF, Word, Excel, PowerPoint, text, or CSV · Up to 5 files
                </small>
                <input
                  hidden
                  type="file"
                  multiple
                  disabled={uploading}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </label>
              {!!files.length && (
                <div className="file-chip-list">
                  {files.map((f) => (
                    <span key={f.id}>
                      <FileText size={13} />
                      {f.filename}
                      <button
                        aria-label={`Remove ${f.filename}`}
                        onClick={() =>
                          setFiles(files.filter((x) => x.id !== f.id))
                        }
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <Field label="Message to your teacher (optional)">
                <textarea
                  rows={3}
                  maxLength={3000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a short note about your work…"
                />
              </Field>
              <Button
                className="full"
                busy={busy}
                disabled={uploading || !files.length}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await post(`/assignments/${assignment.id}/submit`, {
                      uploadIds: files.map((f) => f.id),
                      note,
                    });
                    await refresh();
                    toast("Your assignment was submitted successfully.");
                    onClose();
                  } catch (e: any) {
                    toast(e.message, "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Upload size={16} />{" "}
                {submission?.submitted_at
                  ? "Replace submission"
                  : "Submit assignment"}
              </Button>
            </section>
          )}
        </>
      )}
      {closed && !submission?.submitted_at && (
        <div className="deadline-message">
          <AlertTriangle size={22} />
          <div>
            <b>Submission time has ended</b>
            <p>Contact your teacher if you need help with this assignment.</p>
          </div>
        </div>
      )}
      {submission?.feedback && (
        <section className="feedback-card">
          <span className="eyebrow">TEACHER FEEDBACK</span>
          <p>{submission.feedback}</p>
        </section>
      )}
    </Modal>
  );
}
function Notifications({ data, refresh }: { data: any; refresh: () => void }) {
  const toast = useToast();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">STAY IN THE LOOP</span>
          <h1>A note for you.</h1>
          <p>Updates, encouragement, and your next little discoveries.</p>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await post("/notifications/read");
              refresh();
              toast("You’re all caught up.");
            } catch (e: any) {
              toast(e.message, "error");
            }
          }}
        >
          <CheckCheck size={16} /> Mark all as read
        </Button>
      </div>
      <div className="notification-list">
        {data.announcements.map((a: any) => (
          <article
            className={`panel notification-card ${!a.read ? "unread" : ""}`}
            key={a.id}
          >
            <span className="announcement-icon">
              <Bell size={20} />
            </span>
            <div>
              <small>
                {date(a.created_at)} · From your teacher{" "}
                {!a.read && <b className="new-badge">NEW</b>}
              </small>
              <h3>{a.title}</h3>
              <p>{a.body}</p>
            </div>
          </article>
        ))}
      </div>
      {!data.announcements.length && (
        <Empty
          title="All quiet for now"
          description="Your teacher’s announcements will appear here."
        />
      )}
    </>
  );
}
export function Profile({ admin = false }: { admin?: boolean }) {
  const { user, setUser } = useAuth(),
    toast = useToast();
  const [name, setName] = useState(user.name),
    [avatar, setAvatar] = useState(user.avatar),
    [interests, setInterests] = useState<string[]>(user.interests || []),
    [busy, setBusy] = useState(false),
    [contact, setContact] = useState(""),
    [identifier, setIdentifier] = useState(""),
    [challenge, setChallenge] = useState(""),
    [code, setCode] = useState(""),
    [devCode, setDevCode] = useState("");
  const subjects = ["English", "UHV (Universal Human Values)"];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h1>Your space. Your story.</h1>
          <p>A few details to make your learning feel more like you.</p>
        </div>
      </div>
      <div className="profile-layout">
        <section className="panel profile-identity">
          <Avatar user={{ name, avatar }} size={90} />
          <h2>{user.name}</h2>
          <p>{user.email || user.phone}</p>
          <span className="pill">{admin ? "Teacher" : "Curious mind"}</span>
          <small>Growing with us since {date(user.created_at)}</small>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const r = await post("/auth/google/start", { action: "link" });
                window.location.assign(r.url);
              } catch (e: any) {
                toast(e.message, "error");
              }
            }}
          >
            Connect Google account
          </Button>
          <small>
            Use the same email as your profile. Teachers must connect here
            before using Google sign-in.
          </small>
          <label className="button secondary small">
            <Camera size={16} /> Change photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 150000) {
                  toast("Choose an image smaller than 150 KB.", "error");
                  return;
                }
                const r = new FileReader();
                r.onload = () => setAvatar(String(r.result));
                r.readAsDataURL(f);
              }}
            />
          </label>
        </section>
        <section className="panel">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const u = await patch("/profile", { name, avatar, interests });
                setUser(u);
                toast("Your profile is up to date.");
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>The essentials</h3>
            <Field label="Full name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
              />
            </Field>
            <div className="contact-row">
              <div>
                <span>Email</span>
                <b>{user.email || "Not added"}</b>
              </div>
              <button
                type="button"
                onClick={() => {
                  setContact("email");
                  setChallenge("");
                  setIdentifier("");
                }}
              >
                Verify & update
              </button>
            </div>
            <div className="contact-row">
              <div>
                <span>Mobile number</span>
                <b>{user.phone || "Not added"}</b>
              </div>
              <button
                type="button"
                onClick={() => {
                  setContact("phone");
                  setChallenge("");
                  setIdentifier("");
                }}
              >
                Verify & update
              </button>
            </div>
            {!admin && (
              <>
                <h3 className="mt">What sparks your curiosity?</h3>
                <p className="muted">
                  These are your interests. Your teacher manages your assigned
                  content.
                </p>
                <div className="interest-chips">
                  {subjects.map((s) => (
                    <button
                      type="button"
                      key={s}
                      className={interests.includes(s) ? "selected" : ""}
                      onClick={() =>
                        setInterests((a) =>
                          a.includes(s) ? a.filter((v) => v !== s) : [...a, s],
                        )
                      }
                    >
                      {interests.includes(s) && <Check size={13} />} {s}
                    </button>
                  ))}
                </div>
              </>
            )}
            <Button type="submit" busy={busy}>
              Save your changes <Check size={17} />
            </Button>
          </form>
        </section>
      </div>
      {contact && (
        <Modal
          title={`Update your ${contact === "email" ? "email" : "mobile number"}`}
          onClose={() => setContact("")}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                if (!challenge) {
                  const r = await post("/auth/otp/send", {
                    identifier,
                    purpose: contact,
                  });
                  setChallenge(r.challenge);
                  setDevCode(r.demoCode || "");
                } else {
                  const r = await post("/auth/otp/verify", { challenge, code });
                  setUser(r.user);
                  toast("Verified and updated.");
                  setContact("");
                }
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {!challenge ? (
              <Field
                label={
                  contact === "email"
                    ? "New email"
                    : "New phone number (with country code)"
                }
              >
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  type={contact === "email" ? "email" : "tel"}
                />
              </Field>
            ) : (
              <Field label="Verification code">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]{6,8}"
                  required
                  maxLength={8}
                />
                {devCode && <small>Development code: {devCode}</small>}
              </Field>
            )}
            <Button busy={busy} type="submit">
              {challenge ? "Verify & update" : "Send verification code"}
            </Button>
            {challenge && (
              <button
                type="button"
                className="text-button"
                onClick={() => setChallenge("")}
              >
                Request a new code
              </button>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}
function Onboarding() {
  const { user, setUser } = useAuth(),
    navigate = useNavigate(),
    toast = useToast();
  const [step, setStep] = useState(0),
    [name, setName] = useState(user.name === "New learner" ? "" : user.name),
    [selected, setSelected] = useState<string[]>(user.interests || []),
    [topics, setTopics] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="onboarding">
      <Logo />
      <div className="onboarding-progress">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i <= step ? "done" : ""} />
        ))}
      </div>
      <main>
        <span className="eyebrow">
          YOUR NEXT CHAPTER · STEP {step + 1} OF 4
        </span>
        <h1>
          {
            [
              "Welcome to English Tech.",
              "What lights you up?",
              "Let’s get a little more curious.",
              "Your learning space is ready.",
            ][step]
          }
        </h1>
        <p>
          {
            [
              "A space for your ideas, your questions, and your possibility. What should we call you?",
              "Pick the subjects you’d love to explore. You can always change these later.",
              "Are there particular learning goals you’d love to achieve?",
              "Your teacher will bring the right lessons into your space. Until then, make yourself at home.",
            ][step]
          }
        </p>
        {step === 0 && (
          <Field label="Your full name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              maxLength={200}
              autoFocus
            />
          </Field>
        )}
        {step === 1 && (
          <div className="onboarding-subjects">
            {[
              ["English", "english"],
              ["UHV (Universal Human Values)", "biology"],
            ].map(([s, t]) => (
              <button
                className={selected.includes(s) ? "selected" : ""}
                onClick={() =>
                  setSelected((v) =>
                    v.includes(s) ? v.filter((x) => x !== s) : [...v, s],
                  )
                }
                key={s}
              >
                <CourseArt theme={t} />
                <span>
                  {s}
                  {selected.includes(s) ? <Check size={17} /> : <span>+</span>}
                </span>
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <Field
            label="Learning goals (optional)"
            hint="Separate goals with commas. Interests do not grant access to lessons."
          >
            <textarea
              rows={4}
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              maxLength={800}
              placeholder="Spoken English, grammar, harmony, ethics…"
            />
          </Field>
        )}
        {step === 3 && (
          <div className="onboarding-ready">
            <Check size={42} />
            <span>A little progress, every day.</span>
          </div>
        )}
        <div className="onboarding-actions">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft size={16} /> Back
            </Button>
          )}
          <Button
            disabled={step === 0 && !name.trim()}
            busy={busy}
            onClick={async () => {
              if (step < 3) {
                setStep((s) => s + 1);
                return;
              }
              setBusy(true);
              try {
                const u = await patch("/profile", {
                  name,
                  interests: [
                    ...selected,
                    ...topics
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  ].slice(0, 30),
                  onboarding: true,
                });
                setUser(u);
                toast("Welcome to your learning space.");
                navigate("/app");
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            {step === 3 ? "Let’s begin" : "Continue"}
            <ArrowRight size={17} />
          </Button>
        </div>
      </main>
    </div>
  );
}
