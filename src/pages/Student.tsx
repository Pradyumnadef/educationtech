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
  else if (route[0] === "courses" && route[1])
    body = <CourseDetail id={route[1]} data={data} />;
  else if (route[0] === "profile") body = <Profile />;
  else if (route[0] === "notifications")
    body = <Notifications data={data} refresh={refresh} />;
  else if (route[0] === "progress") body = <Progress data={data} />;
  else if (["courses", "subjects", "videos"].includes(route[0]))
    body = <Library type={route[0]} data={data} />;
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
    courses = items.filter((i) => i.kind === "course" && i.accessible),
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
  const nextCourse =
    next &&
    courses.find((c) => descendants(c, items).some((i) => i.id === next.id));
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
            to={next ? `/app/watch/${next.id}` : "/app/courses"}
          >
            {next ? "Let’s keep learning" : "Explore your courses"}
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
          label="Assigned courses"
          value={courses.length}
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
                  {nextCourse?.name || "YOUR NEXT LESSON"}
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
              Your learning paths <span>{courses.length}</span>
            </h2>
            <Link to="/app/courses">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="grid two">
            {courses.slice(0, 2).map((c) => (
              <CourseCard
                key={c.id}
                item={c}
                items={items}
                progress={progress}
              />
            ))}
          </div>
          {!courses.length && <Empty />}
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
  const kind =
    type === "courses" ? "course" : type === "subjects" ? "subject" : "video";
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
            {type === "courses"
              ? "Your learning paths"
              : type === "subjects"
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
function CourseDetail({ id, data }: { id: string; data: any }) {
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
    videos = children.filter((c) => c.kind === "video" && c.accessible);
  return (
    <>
      <Link className="back-link" to="/app/courses">
        <ArrowLeft size={15} /> Your learning paths
      </Link>
      <div className="course-detail-hero">
        <div>
          <span className="eyebrow">
            {node.kind.toUpperCase()} · {subjectOf(node, items).name}
          </span>
          <h1>{node.name}</h1>
          <p>{node.description}</p>
          <div className="course-detail-meta">
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
            <h2>Your lessons</h2>
            <span className="muted">One little discovery at a time.</span>
          </div>
          <div className="video-list">
            {videos.map((v, i) => (
              <VideoRow
                key={v.id}
                video={v}
                index={i}
                progress={data.progress.find((p: any) => p.video_id === v.id)}
              />
            ))}
          </div>
          {!videos.length && <Empty />}
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
  const { data: lesson, error, loading } = useData(`/videos/${videoId}`),
    ref = useRef<HTMLVideoElement>(null),
    toast = useToast(),
    [tab, setTab] = useState("notes"),
    [denied, setDenied] = useState(""),
    [speed, setSpeed] = useState("1");
  const lastTime = useRef(0),
    lastSave = useRef(Date.now());
  const items: Item[] = data.content;
  const related = items.filter(
      (i) =>
        i.kind === "video" && i.accessible && i.parent_id === lesson?.parent_id,
    ),
    index = related.findIndex((i) => i.id === videoId);
  const save = async (complete = false) => {
    const v = ref.current;
    if (!v || !Number.isFinite(v.currentTime)) return;
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
    setDenied("");
    lastTime.current = 0;
    lastSave.current = Date.now();
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
            {lesson.media ? (
              <video
                key={videoId}
                ref={ref}
                controls
                controlsList="nodownload"
                playsInline
                preload="metadata"
                onContextMenu={(e) => e.preventDefault()}
                onLoadedMetadata={() => {
                  if (ref.current) {
                    ref.current.currentTime = Math.min(
                      lesson.progress?.position || 0,
                      Math.max(0, ref.current.duration - 1),
                    );
                    lastTime.current = ref.current.currentTime;
                    ref.current.playbackRate = Number(speed);
                  }
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
                <source src={lesson.media} />
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
            ) : lesson.resource ? (
              <a className="button secondary" href={lesson.resource}>
                <Download size={16} /> Download lesson resource
              </a>
            ) : (
              <p>
                No extra resources for this lesson. Your video has everything
                you need to get started.
              </p>
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
  const courses = data.content.filter(
    (n: Item) => n.kind === "course" && n.accessible,
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
        <h2>Your path, in perspective</h2>
      </div>
      <div className="grid three">
        {courses.map((c: Item) => (
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
  const subjects = [
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "Computer Science",
    "Programming",
    "Engineering",
    "English",
    "General Knowledge",
    "Other",
  ];
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
          <Button variant="secondary" onClick={async () => {
            try { const r = await post("/auth/google/start", { action: "link" }); window.location.assign(r.url); }
            catch (e: any) { toast(e.message, "error"); }
          }}>Connect Google account</Button>
          <small>Use the same email as your profile. Teachers must connect here before using Google sign-in.</small>
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
              "Are there particular topics you’d love to understand?",
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
              ["Mathematics", "math"],
              ["Physics", "physics"],
              ["Chemistry", "chemistry"],
              ["Biology", "biology"],
              ["Computer Science", "code"],
              ["Programming", "code"],
              ["Engineering", "physics"],
              ["English", "english"],
              ["General Knowledge", "english"],
              ["Other", "biology"],
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
            label="Topics you’re interested in (optional)"
            hint="Separate topics with commas. Interests do not grant access to lessons."
          >
            <textarea
              rows={4}
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              maxLength={800}
              placeholder="Quadratic equations, Python, creative writing…"
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
