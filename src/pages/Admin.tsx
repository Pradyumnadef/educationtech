import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Plus,
  Search,
  Users,
  Video,
  BookOpen,
  Clock,
  ArrowUpRight,
  MoreHorizontal,
  Check,
  Trash2,
  Pencil,
  ShieldCheck,
  Upload,
  FileVideo,
  CheckCheck,
  UserPlus,
  KeyRound,
  Lock,
  Unlock,
  BarChart3,
  Download,
  Layers,
  Mail,
  Activity,
  Settings as SettingsIcon,
  X,
  ClipboardList,
  FileText,
  Timer,
  Eye,
} from "lucide-react";
import Teachers from "./Teachers";
import Shell from "../components/Shell";
import {
  api,
  post,
  put,
  patch,
  del,
  useData,
  useDebounced,
  useAuth,
  useToast,
  Button,
  Field,
  Modal,
  Avatar,
  Loading,
  Failure,
  Empty,
  Item,
  CourseArt,
  descendants,
  pathOf,
  mins,
  date,
  uploadFile,
} from "../lib";
import { ActivityChart, Stat, Profile } from "./Student";
export default function Admin() {
  const { data, error, loading, refresh } = useData("/admin/overview");
  const location = useLocation();
  const route = location.pathname.replace(/^\/admin\/?/, "") || "overview";
  let body: React.ReactNode;
  if (loading) body = <Loading />;
  else if (error) body = <Failure error={error} retry={refresh} />;
  else if (route === "overview") body = <Overview data={data} />;
  else if (route === "teachers") body = <Teachers />;
  else if (route === "students")
    body = <Students key={location.search} data={data} refresh={refresh} />;
  else if (route === "groups") body = <Groups data={data} refresh={refresh} />;
  else if (["library", "subjects", "chapters", "topics"].includes(route))
    body = (
      <ContentLibrary
        key={route + location.search}
        initialKind={route === "library" ? undefined : route.slice(0, -1)}
        data={data}
        refresh={refresh}
      />
    );
  else if (["materials", "videos"].includes(route))
    body = (
      <Content
        key={route + location.search}
        kind="video"
        data={data}
        refresh={refresh}
      />
    );
  else if (route === "assignments")
    body = <Coursework data={data} refresh={refresh} />;
  else if (route === "access")
    body = <Assignments data={data} refresh={refresh} />;
  else if (route === "announcements")
    body = <Announcements data={data} refresh={refresh} />;
  else if (route === "analytics") body = <Analytics data={data} />;
  else if (route === "settings")
    body = <Settings data={data} refresh={refresh} />;
  else
    body = (
      <Empty
        title="This page doesn’t exist"
        description="Use the navigation to return to your workspace."
      />
    );
  return <Shell admin>{body}</Shell>;
}
function Heading({
  eyebrow = "A LITTLE GUIDANCE. A WORLD OF GROWTH.",
  title,
  description,
  children,
}: any) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function Overview({ data }: { data: any }) {
  const videos = data.content.filter((c: Item) => c.kind === "video"),
    totalWatch = data.events.reduce(
      (a: number, e: any) => a + Number(e.seconds),
      0,
    );
  return (
    <>
      <Heading
        title="Good things are growing."
        description="A fresh perspective on your students and their learning journeys."
      >
        <Link className="button" to="/admin/materials">
          <Plus size={17} /> Add a lesson
        </Link>
      </Heading>
      <div className="teacher-banner">
        <div>
          <span className="eyebrow">TEACH. ENCOURAGE. INSPIRE.</span>
          <h2>
            Help a curious mind
            <br />
            find its next <em>possibility.</em>
          </h2>
          <p>Your guidance makes all the difference.</p>
        </div>
        <div className="teacher-banner-mark">
          ✦
          <span>
            SMALL MOMENTS.
            <br />
            LASTING IMPACT.
          </span>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          icon={Users}
          label="Total students"
          value={data.students.length}
          note={`${data.students.filter((s: any) => s.status === "active").length} active learners`}
        />
        <Stat
          icon={Video}
          label="Video lessons"
          value={videos.length}
          note={`${data.content.filter((c: Item) => c.kind === "subject").length} subjects`}
          color="purple"
        />
        <Stat
          icon={BookOpen}
          label="Subjects"
          value={data.content.filter((c: Item) => c.kind === "subject").length}
          note="Different ways to discover"
          color="orange"
        />
        <Stat
          icon={Clock}
          label="Watch time"
          value={mins(totalWatch)}
          note="Across the last 30 days"
          color="blue"
        />
      </div>
      <div className="grid two">
        <section className="panel">
          <div className="panel-title">
            <h3>A week of discovery</h3>
            <Link className="text-button" to="/admin/analytics">
              Analytics <ArrowUpRight size={15} />
            </Link>
          </div>
          <ActivityChart events={data.events} />
        </section>
        <section className="panel">
          <div className="panel-title">
            <h3>Your newest curious minds</h3>
            <Link className="text-button" to="/admin/students">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          {data.students.slice(0, 4).map((s: any) => (
            <div className="person-row" key={s.id}>
              <Avatar user={s} />
              <div>
                <b>{s.name}</b>
                <small>{s.email}</small>
              </div>
              <span className={`status ${s.status}`}>{s.status}</span>
            </div>
          ))}
        </section>
      </div>
      <div className="section-heading compact">
        <h2>Recently added lessons</h2>
        <Link to="/admin/materials">
          Manage library <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="grid three">
        {videos.slice(0, 3).map((v: Item) => (
          <Link className="admin-video-card" to="/admin/materials" key={v.id}>
            <CourseArt theme={v.thumbnail} />
            <div>
              <span className={`status ${v.status}`}>{v.status}</span>
              <h3>{v.name}</h3>
              <p>
                {mins(v.duration)} · Added {date(v.created_at)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
function Confirm({
  title,
  description,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<any>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    toast = useToast();
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{description}</p>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
              toast("The change has been saved.");
            } catch (e: any) {
              toast(e.message, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          Confirm change
        </Button>
      </div>
    </Modal>
  );
}
function Students({ data, refresh }: any) {
  const [q, setQ] = useState(
      new URLSearchParams(useLocation().search).get("q") || "",
    ),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("newest"),
    [page, setPage] = useState(1),
    [adding, setAdding] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [confirm, setConfirm] = useState<any>(null),
    [busy, setBusy] = useState(false),
    toast = useToast();
  const debounced = useDebounced(q);
  const students = data.students
    .filter(
      (s: any) =>
        `${s.name} ${s.email} ${s.phone}`
          .toLowerCase()
          .includes(debounced.toLowerCase()) &&
        (status === "all" || s.status === status),
    )
    .sort((a: any, b: any) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.created_at - a.created_at,
    );
  return (
    <>
      <Heading
        title="Every learner, a possibility."
        description="Support your students, shape their access, and see how they’re growing."
      >
        <Button onClick={() => setAdding(true)}>
          <UserPlus size={17} /> Add student
        </Button>
      </Heading>
      <div className="table-toolbar">
        <label className="search-box">
          <Search size={17} />
          <input
            placeholder="Find a curious mind…"
            aria-label="Search students"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Filter student status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All statuses</option>
          <option>active</option>
          <option>pending</option>
          <option>inactive</option>
        </select>
        <select
          aria-label="Sort students"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="name">Name A–Z</option>
        </select>
        <span>{students.length} students</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Status</th>
              <th>Learning progress</th>
              <th>Joined</th>
              <th>Last active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.slice((page - 1) * 15, page * 15).map((s: any) => {
              const p = data.progress.filter((p: any) => p.user_id === s.id);
              return (
                <tr key={s.id}>
                  <td>
                    <button
                      className="person-link"
                      onClick={() => setSelected(s)}
                    >
                      <Avatar user={s} />
                      <span>
                        <b>{s.name}</b>
                        <small>{s.email || s.phone}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className={`status ${s.status}`}>{s.status}</span>
                  </td>
                  <td>
                    <span>
                      {p.filter((p: any) => p.completed).length} lessons
                      completed
                    </span>
                  </td>
                  <td>{date(s.created_at)}</td>
                  <td>{s.last_active ? date(s.last_active) : "Not yet"}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-button"
                        aria-label={`View ${s.name}`}
                        onClick={() => setSelected(s)}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`${s.status === "active" ? "Deactivate" : "Activate"} ${s.name}`}
                        onClick={() =>
                          setConfirm({
                            title:
                              s.status === "active"
                                ? "Deactivate student?"
                                : "Activate student?",
                            description:
                              s.status === "active"
                                ? "This student will be signed out and lose access until reactivated."
                                : "This student will be able to sign in and access assigned content.",
                            action: async () => {
                              await patch(`/admin/students/${s.id}`, {
                                status:
                                  s.status === "active" ? "inactive" : "active",
                              });
                              refresh();
                            },
                          })
                        }
                      >
                        {s.status === "active" ? (
                          <Lock size={16} />
                        ) : (
                          <Unlock size={16} />
                        )}
                      </button>
                      <button
                        className="icon-button danger-text"
                        aria-label={`Remove ${s.name}`}
                        onClick={() =>
                          setConfirm({
                            title: "Remove this student?",
                            description:
                              "This permanently removes the student, their assignments, and their watch history.",
                            action: async () => {
                              await del(`/admin/students/${s.id}`);
                              refresh();
                            },
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!students.length && (
          <Empty
            title="No students found"
            description="Try another search or add your first student."
          />
        )}
      </div>
      <Pagination page={page} setPage={setPage} total={students.length} />
      {adding && (
        <Modal
          title="Make room for a new learner"
          onClose={() => setAdding(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await post("/admin/students", {
                  name: f.get("name"),
                  email: f.get("email"),
                  ...(f.get("phone") ? { phone: f.get("phone") } : {}),
                });
                refresh();
                setAdding(false);
                toast("Student added. They can now sign in with OTP.");
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Full name">
              <input name="name" required maxLength={200} />
            </Field>
            <Field label="Email">
              <input type="email" name="email" required />
            </Field>
            <Field label="Mobile number (optional, include country code)">
              <input type="tel" name="phone" pattern="\+[1-9][0-9]{7,14}" />
            </Field>
            <p className="muted">
              Students verify ownership of their email or phone when they first
              sign in.
            </p>
            <Button type="submit" busy={busy}>
              Add student <Plus size={16} />
            </Button>
          </form>
        </Modal>
      )}
      {selected && (
        <StudentDetail
          student={
            data.students.find((s: any) => s.id === selected.id) || selected
          }
          data={data}
          onClose={() => setSelected(null)}
          refresh={refresh}
        />
      )}
      {confirm && (
        <Confirm
          title={confirm.title}
          description={confirm.description}
          onClose={() => setConfirm(null)}
          onConfirm={confirm.action}
        />
      )}
    </>
  );
}
function Pagination({
  page,
  setPage,
  total,
}: {
  page: number;
  setPage: (p: number) => void;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / 15));
  return (
    <div className="pagination">
      <span>
        {total} records · Page {page} of {pages}
      </span>
      <Button
        variant="secondary small"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <Button
        variant="secondary small"
        disabled={page >= pages}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
function StudentDetail({ student: s, data, onClose, refresh }: any) {
  const toast = useToast(),
    [editing, setEditing] = useState(false),
    [name, setName] = useState(s.name),
    [reset, setReset] = useState(false);
  const p = data.progress.filter((p: any) => p.user_id === s.id),
    groups = data.members
      .filter((m: any) => m.user_id === s.id)
      .map((m: any) => m.group_id),
    grants = data.grants.filter(
      (g: any) => g.user_id === s.id || groups.includes(g.group_id),
    );
  return (
    <Modal title="A learner’s journey" onClose={onClose} wide>
      <div className="student-detail-header">
        <Avatar user={s} size={65} />
        <div>
          <h2>{s.name}</h2>
          <p>
            {s.email} {s.phone && `· ${s.phone}`}
          </p>
        </div>
        <span className={`status ${s.status}`}>{s.status}</span>
      </div>
      <div className="detail-stats">
        <span>
          <b>{p.filter((p: any) => p.completed).length}</b> Completed lessons
        </span>
        <span>
          <b>
            {mins(
              p.reduce((a: number, v: any) => a + Number(v.watched_seconds), 0),
            )}
          </b>{" "}
          Watch time
        </span>
        <span>
          <b>{date(s.created_at)}</b> Joined
        </span>
      </div>
      <div className="interest-chips">
        {(typeof s.interests === "string"
          ? JSON.parse(s.interests)
          : s.interests || []
        ).map((i: string) => (
          <span key={i}>{i}</span>
        ))}
      </div>
      <h3>Assigned content</h3>
      {grants.map((g: any) => (
        <div className="assignment-row" key={g.id}>
          <div>
            <b>
              {data.content.find((c: Item) => c.id === g.content_id)?.name ||
                "Removed content"}
            </b>
            <small>
              {g.group_id ? "Via student group" : "Individual assignment"}
            </small>
          </div>
          <span className={`status ${g.status}`}>{g.status}</span>
        </div>
      ))}
      {!grants.length && <p className="muted">No content assigned yet.</p>}
      <h3 className="mt">Watch history & progress</h3>
      {p.map((v: any) => (
        <div className="assignment-row" key={v.id}>
          <div>
            <b>{data.content.find((c: Item) => c.id === v.video_id)?.name}</b>
            <small>
              Last watched {date(v.updated_at)} · Resume at{" "}
              {Math.round(v.position)}s
            </small>
          </div>
          <span className={`status ${v.completed ? "active" : "pending"}`}>
            {v.completed ? "Completed" : "In progress"}
          </span>
        </div>
      ))}
      <div className="modal-actions">
        <Link className="button" to={`/admin/assignments?student=${s.id}`}>
          Assign content <KeyRound size={15} />
        </Link>
        <Button variant="secondary" onClick={() => setEditing(!editing)}>
          <Pencil size={15} /> Edit name
        </Button>
        <Button variant="danger" onClick={() => setReset(true)}>
          Reset access
        </Button>
      </div>
      {editing && (
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await patch(`/admin/students/${s.id}`, { name });
              refresh();
              toast("Student profile updated.");
              setEditing(false);
            } catch (e: any) {
              toast(e.message, "error");
            }
          }}
        >
          <input
            aria-label="Student name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Button type="submit">Save</Button>
        </form>
      )}
      {reset && (
        <Confirm
          title="Reset all access?"
          description="This revokes individual assignments and removes the student from all groups. Learning progress is kept."
          onClose={() => setReset(false)}
          onConfirm={async () => {
            await post(`/admin/students/${s.id}/reset-access`);
            refresh();
          }}
        />
      )}
    </Modal>
  );
}
function Groups({ data, refresh }: any) {
  const [adding, setAdding] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [confirm, setConfirm] = useState<any>(null),
    [busy, setBusy] = useState(false),
    toast = useToast();
  return (
    <>
      <Heading
        title="Grow better, together."
        description="Bring learners into classes and assign a shared path forward."
      >
        <Button
          onClick={() => {
            setSelected(null);
            setAdding(true);
          }}
        >
          <Plus size={17} /> Create group
        </Button>
      </Heading>
      <div className="grid three">
        {data.groups.map((g: any) => (
          <section className="panel group-card" key={g.id}>
            <span className="group-icon">
              <Users size={25} />
            </span>
            <h2>{g.name}</h2>
            <p>{g.description || "A space for shared curiosity."}</p>
            <div className="group-counts">
              <span>
                {data.members.filter((m: any) => m.group_id === g.id).length}{" "}
                learners
              </span>
              <span>
                {
                  data.grants.filter(
                    (a: any) => a.group_id === g.id && a.status === "assigned",
                  ).length
                }{" "}
                assignments
              </span>
            </div>
            <div className="table-actions">
              <Button variant="secondary small" onClick={() => setSelected(g)}>
                Manage learners <ArrowUpRight size={15} />
              </Button>
              <button
                className="icon-button"
                aria-label="Edit group"
                onClick={() => {
                  setSelected(g);
                  setAdding(true);
                }}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button danger-text"
                aria-label="Delete group"
                onClick={() => setConfirm(g)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </section>
        ))}
      </div>
      {!data.groups.length && (
        <Empty
          title="Make space for a learning community"
          description="Create your first student group to share content with a class."
        />
      )}
      {adding && (
        <Modal
          title={selected ? "Edit your group" : "A new group of curious minds"}
          onClose={() => {
            setAdding(false);
            setSelected(null);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const b = Object.fromEntries(new FormData(e.currentTarget));
                if (selected) await patch(`/admin/groups/${selected.id}`, b);
                else await post("/admin/groups", b);
                refresh();
                setAdding(false);
                setSelected(null);
                toast("Group saved.");
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Group name">
              <input
                name="name"
                defaultValue={selected?.name}
                required
                maxLength={200}
              />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                defaultValue={selected?.description}
                maxLength={1000}
              />
            </Field>
            <Button type="submit" busy={busy}>
              Save group
            </Button>
          </form>
        </Modal>
      )}
      {selected && !adding && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <p className="muted">
            Changes take effect immediately. Group assignments follow
            membership.
          </p>
          <div className="member-list">
            {data.students.map((s: any) => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  checked={data.members.some(
                    (m: any) =>
                      m.group_id === selected.id && m.user_id === s.id,
                  )}
                  onChange={async (e) => {
                    try {
                      await put(`/admin/groups/${selected.id}/members`, {
                        studentId: s.id,
                        member: e.target.checked,
                      });
                      refresh();
                      toast("Membership updated.");
                    } catch (e: any) {
                      toast(e.message, "error");
                    }
                  }}
                />
                <Avatar user={s} size={33} />
                <span>
                  <b>{s.name}</b>
                  <small>{s.email}</small>
                </span>
              </label>
            ))}
          </div>
          <Link
            className="button"
            to={`/admin/assignments?group=${selected.id}`}
          >
            Assign to this group <ArrowRightIcon />
          </Link>
        </Modal>
      )}
      {confirm && (
        <Confirm
          title="Remove this group?"
          description="Its members remain registered, but will lose any access inherited only through this group."
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await del(`/admin/groups/${confirm.id}`);
            refresh();
          }}
        />
      )}
    </>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={16} />;
}
function ContentLibrary({ initialKind, data, refresh }: any) {
  const requestedKind = new URLSearchParams(useLocation().search).get("type");
  const [kind, setKind] = useState(
    ["subject", "chapter", "topic"].includes(requestedKind || "")
      ? requestedKind
      : initialKind || "subject",
  );
  return (
    <Content
      key={kind}
      kind={kind}
      data={data}
      refresh={refresh}
      merged
      onKindChange={setKind}
    />
  );
}
function Content({
  kind,
  data,
  refresh,
  merged = false,
  onKindChange,
}: any) {
  const [q, setQ] = useState(
      new URLSearchParams(useLocation().search).get("q") || "",
    ),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<any>(null),
    [confirm, setConfirm] = useState<Item | null>(null),
    toast = useToast();
  const debounced = useDebounced(q);
  const itemLabel = kind === "video" ? "learning material" : kind;
  const pluralLabel = kind === "video" ? "learning materials" : `${kind}s`;
  const rows = data.content.filter(
    (c: Item) =>
      c.kind === kind &&
      `${c.name} ${c.description} ${c.tags}`
        .toLowerCase()
        .includes(debounced.toLowerCase()) &&
      (status === "all" || c.status === status),
  );
  return (
    <>
      <Heading
        title={
          merged
            ? "Subjects, chapters, and topics."
            : kind === "video"
              ? "Learning materials, all in one place."
            : `Make room for ${kind === "subject" ? "curiosity" : "the next chapter"}.`
        }
        description={
          merged
            ? "Build your curriculum in one section, from broad subjects to focused learning topics."
            : kind === "video"
              ? "Manage lesson videos, captions, downloadable files, notes, and publishing details."
            : kind === "subject"
            ? "English and UHV are ready. Add any new subject here whenever you need it."
            : `Organize your ${kind}s into thoughtful, connected learning experiences.`
        }
      >
        <Button onClick={() => setEditor({ kind })}>
          <Plus size={17} /> Add {itemLabel}
        </Button>
      </Heading>
      {merged && (
        <div
          className="tabs content-structure-tabs"
          role="tablist"
          aria-label="Content type"
        >
          {["subject", "chapter", "topic"].map((type) => (
            <button
              type="button"
              role="tab"
              className={kind === type ? "active" : ""}
              aria-selected={kind === type}
              onClick={() => onKindChange(type)}
              key={type}
            >
              {type[0].toUpperCase() + type.slice(1)}s
            </button>
          ))}
        </div>
      )}
      <div className="table-toolbar">
        <label className="search-box">
          <Search size={17} />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={`Search ${pluralLabel}…`}
            aria-label={`Search ${pluralLabel}`}
          />
        </label>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filter content status"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <span>
          {rows.length} {pluralLabel}
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{kind === "video" ? "Learning material" : "Name"}</th>
              <th>Located in</th>
              <th>Status</th>
              <th>{kind === "video" ? "Duration" : "Contents"}</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((page - 1) * 15, page * 15).map((c: Item) => (
              <tr key={c.id}>
                <td>
                  <button
                    className="content-cell"
                    onClick={async () => {
                      try {
                        setEditor(await api(`/admin/content/${c.id}`));
                      } catch (e: any) {
                        toast(e.message, "error");
                      }
                    }}
                  >
                    <div className="mini-art">
                      <CourseArt theme={c.thumbnail} />
                    </div>
                    <span>
                      <b>{c.name}</b>
                      <small>
                        {c.tags?.slice(0, 2).join(" · ") ||
                          `A ${kind} of possibilities`}
                      </small>
                    </span>
                  </button>
                </td>
                <td>
                  {data.content.find((n: Item) => n.id === c.parent_id)?.name ||
                    "Your library"}
                </td>
                <td>
                  <span className={`status ${c.status}`}>
                    {c.publish_at && c.publish_at > Date.now()
                      ? "Scheduled"
                      : c.status}
                  </span>
                </td>
                <td>
                  {kind === "video"
                    ? mins(c.duration)
                    : `${descendants(c, data.content).filter((i) => i.kind === "video").length} lessons`}
                </td>
                <td>{date(c.created_at)}</td>
                <td>
                  <div className="table-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${c.name}`}
                      onClick={async () => {
                        try {
                          setEditor(await api(`/admin/content/${c.id}`));
                        } catch (e: any) {
                          toast(e.message, "error");
                        }
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button danger-text"
                      aria-label={`Delete ${c.name}`}
                      onClick={() => setConfirm(c)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <Empty
            title="A blank page, full of possibility"
            description={`Add a ${itemLabel} to begin building your learning library.`}
          />
        )}
      </div>
      <Pagination total={rows.length} page={page} setPage={setPage} />
      {editor && (
        <ContentEditor
          item={editor}
          data={data}
          onClose={() => setEditor(null)}
          refresh={refresh}
        />
      )}
      {confirm && (
        <Confirm
          title={`Delete “${confirm.name}”?`}
          description="This permanently deletes this content, all nested content, assignments, and associated progress. Stored media should be removed separately according to your retention policy."
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await del(`/admin/content/${confirm.id}`);
            refresh();
          }}
        />
      )}
    </>
  );
}
function ContentEditor({ item, data, onClose, refresh }: any) {
  const [form, setForm] = useState<any>({
      name: "",
      description: "",
      parent_id: null,
      thumbnail: "math",
      status: "draft",
      public: 0,
      duration: 0,
      tags: [],
      notes: "",
      storage_key: "",
      caption_key: "",
      resource_key: "",
      publish_at: null,
      ...item,
    }),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(""),
    [progress, setProgress] = useState(0),
    [scan, setScan] = useState<any>(null),
    [uploadedFiles, setUploadedFiles] = useState<Record<string, any>>(
      item.uploaded_files || {},
    ),
    toast = useToast();
  const kindLabel =
    form.kind === "video" ? "learning material" : form.kind;
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const parentKind: Record<string, string> = {
    chapter: "subject",
    topic: "chapter",
    video: "topic",
  };
  const parents = data.content.filter(
    (c: Item) => c.kind === parentKind[form.kind],
  );
  async function upload(file: File, field: string) {
    setUploading(field);
    setProgress(0);
    try {
      const out = await uploadFile(file, setProgress);
      if (out.state === "ready") {
        set(field, out.key);
        setUploadedFiles((current) => ({ ...current, [field]: out }));
        toast("File uploaded and ready.");
      } else {
        setScan({ ...out, field });
        toast("Upload complete. Waiting for the security scan.");
      }
      if (field === "storage_key") {
        const v = document.createElement("video");
        const url = URL.createObjectURL(file);
        v.src = url;
        v.onloadedmetadata = () => {
          if (Number.isFinite(v.duration))
            set("duration", Math.ceil(v.duration));
          URL.revokeObjectURL(url);
        };
      }
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading("");
    }
  }
  return (
    <Modal
      title={`${item.id ? "Edit" : "Create"} ${kindLabel}`}
      onClose={onClose}
      wide
      canClose={!busy && !uploading}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            if (form.kind !== "subject" && !form.parent_id)
              throw new Error(
                `Create and select a ${parentKind[form.kind]} first.`,
              );
            const payload = {
              ...form,
              duration: Number(form.duration),
              public: Number(form.public),
            };
            if (item.id) await put(`/admin/content/${item.id}`, payload);
            else await post("/admin/content", payload);
            refresh();
            onClose();
            toast(
              `${kindLabel[0].toUpperCase() + kindLabel.slice(1)} saved to your library.`,
            );
          } catch (e: any) {
            toast(e.message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="editor-grid">
          <div>
            <Field label="Title">
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
                maxLength={200}
              />
            </Field>
            {form.kind !== "subject" && (
              <Field label={`Parent ${parentKind[form.kind]}`}>
                <select
                  value={form.parent_id || ""}
                  onChange={(e) => set("parent_id", e.target.value)}
                  required
                >
                  <option value="">Select {parentKind[form.kind]}</option>
                  {parents.map((p: Item) => (
                    <option key={p.id} value={p.id}>
                      {pathOf(p, data.content)}
                    </option>
                  ))}
                </select>
                {!parents.length && (
                  <small>
                    Create a {parentKind[form.kind]} in your library first.
                  </small>
                )}
              </Field>
            )}
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
                maxLength={5000}
              />
            </Field>
            <Field label="Tags (comma-separated)">
              <input
                value={form.tags.join(", ")}
                onChange={(e) =>
                  set(
                    "tags",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .slice(0, 20),
                  )
                }
              />
            </Field>
          </div>
          <div>
            <CourseArt theme={form.thumbnail} />
            <Field label="Cover illustration">
              <select
                value={
                  form.thumbnail.startsWith("data:") ? "custom" : form.thumbnail
                }
                onChange={(e) => set("thumbnail", e.target.value)}
              >
                {[
                  "math",
                  "physics",
                  "code",
                  "chemistry",
                  "biology",
                  "english",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
                {form.thumbnail.startsWith("data:") && (
                  <option value="custom">Custom image</option>
                )}
              </select>
            </Field>
            <Field label="Or upload a thumbnail (max 150 KB)">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 150000) {
                    toast("Use a thumbnail under 150 KB.", "error");
                    return;
                  }
                  const r = new FileReader();
                  r.onload = () => set("thumbnail", String(r.result));
                  r.readAsDataURL(f);
                }}
              />
            </Field>
            <div className="grid two">
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </Field>
              {form.kind === "video" && (
                <Field label="Duration (seconds)">
                  <input
                    type="number"
                    min="0"
                    max="86400"
                    value={form.duration}
                    onChange={(e) => set("duration", e.target.value)}
                  />
                </Field>
              )}
            </div>
            {form.kind === "subject" && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!form.public}
                  onChange={(e) => set("public", e.target.checked ? 1 : 0)}
                />{" "}
                Show title and cover in the public catalog
              </label>
            )}
          </div>
        </div>
        {form.kind === "video" && (
          <>
            <div className="upload-zone">
              <FileVideo size={32} />
              <h3>
                {form.storage_key
                  ? "Video attached. Ready for a little discovery."
                  : "Give this lesson its video."}
              </h3>
              <p>MP4, WebM, or MOV · Up to 2 GB · Private storage</p>
              <label className="button secondary">
                <Upload size={16} />
                {form.storage_key ? "Replace video" : "Choose video"}
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  hidden
                  disabled={!!uploading}
                  onChange={(e) => {
                    if (e.target.files?.[0])
                      upload(e.target.files[0], "storage_key");
                  }}
                />
              </label>
            </div>
            {uploadedFiles.storage_key && (
              <div className="material-preview">
                <div className="material-preview-heading">
                  <div className="uploaded-file-icon">
                    <FileVideo size={19} />
                  </div>
                  <div className="uploaded-file-meta">
                    <strong>{uploadedFiles.storage_key.filename}</strong>
                    <span>
                      {formatFileSize(uploadedFiles.storage_key.size)} · Ready
                      to view
                    </span>
                  </div>
                  <span className="file-ready"><Check size={13} /> Uploaded</span>
                </div>
                <video
                  controls
                  preload="metadata"
                  src={`/api/storage/preview/${uploadedFiles.storage_key.id}`}
                >
                  Your browser does not support video playback.
                </video>
              </div>
            )}
            {uploading && (
              <div role="status">
                <div className="progress-track">
                  <i style={{ width: `${progress}%` }} />
                </div>
                <p className="muted">Uploading… {progress}%</p>
              </div>
            )}
            {scan && (
              <div className="scan-notice">
                <p>
                  File uploaded. Security scan: {scan.state}. You can save this
                  lesson as a draft while processing.
                </p>
                <Button
                  type="button"
                  variant="secondary small"
                  onClick={async () => {
                    try {
                      const r = await api(`/storage/status/${scan.id}`);
                      if (r.state === "ready") {
                        set(scan.field, r.storage_key);
                        setUploadedFiles((current) => ({
                          ...current,
                          [scan.field]: {
                            ...scan,
                            key: r.storage_key,
                            state: "ready",
                          },
                        }));
                        setScan(null);
                        toast("Security scan complete. File attached.");
                      } else if (r.state === "rejected") {
                        toast(
                          "The file failed its security scan. Upload a different file.",
                          "error",
                        );
                        setScan(null);
                      } else toast("The scan is still in progress.");
                    } catch (e: any) {
                      toast(e.message, "error");
                    }
                  }}
                >
                  Check scan status
                </Button>
              </div>
            )}
            <div className="grid two">
              <Field
                label={
                  form.caption_key
                    ? "Captions attached · Replace VTT"
                    : "Captions (WebVTT, up to 1 MB)"
                }
              >
                <input
                  type="file"
                  accept=".vtt"
                  disabled={!!uploading}
                  onChange={(e) => {
                    if (e.target.files?.[0])
                      upload(e.target.files[0], "caption_key");
                  }}
                />
                {uploadedFiles.caption_key && (
                  <UploadedFile
                    file={uploadedFiles.caption_key}
                    label="Captions"
                    onRemove={() => {
                      set("caption_key", "");
                      setUploadedFiles((current) => ({
                        ...current,
                        caption_key: null,
                      }));
                    }}
                  />
                )}
              </Field>
              <Field
                label={
                  form.resource_key
                    ? "Resource attached · Replace file"
                    : "Lesson resource (PDF, Word, Excel, PowerPoint, text, or CSV)"
                }
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                  disabled={!!uploading}
                  onChange={(e) => {
                    if (e.target.files?.[0])
                      upload(e.target.files[0], "resource_key");
                  }}
                />
                {uploadedFiles.resource_key && (
                  <UploadedFile
                    file={uploadedFiles.resource_key}
                    label="Lesson resource"
                    onRemove={() => {
                      set("resource_key", "");
                      setUploadedFiles((current) => ({
                        ...current,
                        resource_key: null,
                      }));
                    }}
                  />
                )}
              </Field>
            </div>
            <Field label="Lesson notes">
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={4}
                maxLength={20000}
              />
            </Field>
          </>
        )}
        <Field
          label="Scheduled publish date (optional)"
          hint="Content must also be set to Published. Parent items must be published for students to access it."
        >
          <input
            type="datetime-local"
            value={
              form.publish_at
                ? new Date(
                    Number(form.publish_at) -
                      new Date().getTimezoneOffset() * 60000,
                  )
                    .toISOString()
                    .slice(0, 16)
                : ""
            }
            onChange={(e) =>
              set(
                "publish_at",
                e.target.value ? new Date(e.target.value).getTime() : null,
              )
            }
          />
        </Field>
        <div className="modal-actions">
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={busy || !!uploading}
          >
            Cancel
          </Button>
          <Button type="submit" busy={busy} disabled={!!uploading}>
            <Check size={16} /> Save {kindLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function formatFileSize(size: number) {
  if (!Number.isFinite(Number(size))) return "File";
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 ** 2).toFixed(1)} MB`;
}
function UploadedFile({ file, label, onRemove }: any) {
  return (
    <div className="uploaded-file-row">
      <div className="uploaded-file-icon">
        <FileText size={17} />
      </div>
      <div className="uploaded-file-meta">
        <strong>{file.filename}</strong>
        <span>{label} · {formatFileSize(file.size)}</span>
      </div>
      <a
        className="file-action"
        href={`/api/storage/preview/${file.id}`}
        target="_blank"
        rel="noreferrer"
      >
        <Eye size={14} /> View
      </a>
      <button
        className="icon-button file-remove"
        type="button"
        aria-label={`Remove ${file.filename}`}
        title="Remove attachment"
        onClick={onRemove}
      >
        <X size={14} />
      </button>
    </div>
  );
}
function Coursework({ data, refresh }: any) {
  const emptyForm = () => ({
    title: "",
    description: "",
    quizUrl: "",
    dueAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
    timeLimitMinutes: 0,
    status: "published",
    targetType: "student",
    targetIds: [] as string[],
    resourceUploadIds: [] as string[],
  });
  const [creating, setCreating] = useState(false),
    [form, setForm] = useState(emptyForm),
    [files, setFiles] = useState<any[]>([]),
    [uploading, setUploading] = useState(false),
    [uploadProgress, setUploadProgress] = useState(0),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [removing, setRemoving] = useState<any>(null),
    toast = useToast();
  const assignments = data.coursework || [];
  const targets = form.targetType === "student" ? data.students : data.groups;
  const toggleTarget = (targetId: string) =>
    setForm((f: any) => ({
      ...f,
      targetIds: f.targetIds.includes(targetId)
        ? f.targetIds.filter((id: string) => id !== targetId)
        : [...f.targetIds, targetId],
    }));
  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    if (files.length + list.length > 10)
      return toast("Add up to 10 resource files.", "error");
    setUploading(true);
    try {
      const added: { id: string; filename: string; size: number }[] = [];
      for (const file of Array.from(list)) {
        const uploaded = await uploadFile(
          file,
          setUploadProgress,
          "assignment",
        );
        if (uploaded.state !== "ready")
          throw new Error(
            "The file is still being checked. Try again shortly.",
          );
        added.push({ id: uploaded.id, filename: file.name, size: file.size });
      }
      setFiles((current) => [...current, ...added]);
      setForm((f: any) => ({
        ...f,
        resourceUploadIds: [...f.resourceUploadIds, ...added.map((x) => x.id)],
      }));
      toast("Assignment resources uploaded securely.");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }
  return (
    <>
      <Heading
        eyebrow="SET THE TASK. SUPPORT THE JOURNEY."
        title="Assignments, all in one place."
        description="Create timed work, share useful files, and review every student submission securely."
      >
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} /> New assignment
        </Button>
      </Heading>
      <div className="assignment-summary grid three">
        <Stat
          icon={ClipboardList}
          label="Assignments"
          value={assignments.length}
        />
        <Stat
          icon={Clock}
          label="Open now"
          value={
            assignments.filter(
              (a: any) => a.status === "published" && a.due_at > Date.now(),
            ).length
          }
        />
        <Stat
          icon={CheckCheck}
          label="Submissions"
          value={assignments.reduce(
            (n: number, a: any) =>
              n + a.submissions.filter((s: any) => s.submitted_at).length,
            0,
          )}
        />
      </div>
      <div className="coursework-grid">
        {assignments.map((a: any) => {
          const targetNames = a.targets
            .map(
              (t: any) =>
                data.students.find((s: any) => s.id === t.user_id)?.name ||
                data.groups.find((g: any) => g.id === t.group_id)?.name,
            )
            .filter(Boolean);
          return (
            <article className="panel coursework-card" key={a.id}>
              <div className="coursework-card-top">
                <span className={`status ${a.status}`}>{a.status}</span>
                <span
                  className={
                    a.due_at <= Date.now() ? "deadline overdue" : "deadline"
                  }
                >
                  <Clock size={14} />{" "}
                  {a.due_at <= Date.now() ? "Closed" : "Due"}{" "}
                  {new Date(a.due_at).toLocaleString()}
                </span>
              </div>
              <h2>{a.title}</h2>
              <p>{a.description}</p>
              <div className="coursework-meta">
                <span>
                  <Users size={15} /> {targetNames.slice(0, 2).join(", ")}
                  {targetNames.length > 2 ? ` +${targetNames.length - 2}` : ""}
                </span>
                <span>
                  <Timer size={15} />{" "}
                  {a.time_limit_minutes
                    ? `${a.time_limit_minutes} minute timer`
                    : "No start timer"}
                </span>
                <span>
                  <FileText size={15} /> {a.resources.length} resources
                </span>
                <span>
                  <CheckCheck size={15} />{" "}
                  {a.submissions.filter((s: any) => s.submitted_at).length}{" "}
                  submitted
                </span>
              </div>
              <div className="card-actions">
                <Button
                  variant="secondary small"
                  onClick={() => setSelected(a)}
                >
                  <Eye size={14} /> View & review
                </Button>
                <Button variant="ghost small" onClick={() => setRemoving(a)}>
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {!assignments.length && (
        <Empty
          title="Create your first assignment"
          description="Add instructions, a deadline, an optional timer, learning files, and the students who should receive it."
        >
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> New assignment
          </Button>
        </Empty>
      )}
      {creating && (
        <Modal
          title="Create an assignment"
          wide
          onClose={() => !busy && setCreating(false)}
        >
          <form
            className="assignment-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await post("/admin/coursework", {
                  ...form,
                  dueAt: new Date(form.dueAt).getTime(),
                });
                await refresh();
                setCreating(false);
                setForm(emptyForm());
                setFiles([]);
                toast("Assignment published for your learners.");
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="grid two">
              <Field label="Assignment title">
                <input
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Example: Grammar worksheet 1"
                />
              </Field>
              <Field label="Deadline">
                <input
                  required
                  type="datetime-local"
                  min={new Date().toISOString().slice(0, 16)}
                  value={form.dueAt}
                  onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Instructions">
              <textarea
                required
                rows={5}
                maxLength={10000}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Explain what students need to complete and submit…"
              />
            </Field>
            <Field label="Google Quiz link (optional)">
              <input
                type="url"
                maxLength={2048}
                value={form.quizUrl}
                onChange={(e) => setForm({ ...form, quizUrl: e.target.value })}
                placeholder="https://forms.gle/…"
              />
              <small>
                Paste the share link from Google Forms. Students will open it in
                a new tab.
              </small>
            </Field>
            <div className="grid two">
              <Field label="Timer after student starts (minutes)">
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={form.timeLimitMinutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      timeLimitMinutes: Number(e.target.value),
                    })
                  }
                />
                <small>
                  Use 0 for deadline only. The timer cannot be restarted.
                </small>
              </Field>
              <Field label="Visibility">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="published">Publish now</option>
                  <option value="draft">Save as draft</option>
                </select>
              </Field>
            </div>
            <div className="numbered-title mt">
              <span>01</span>
              <h3>Who should receive it?</h3>
            </div>
            <div className="tabs">
              <button
                type="button"
                className={form.targetType === "student" ? "active" : ""}
                onClick={() =>
                  setForm({ ...form, targetType: "student", targetIds: [] })
                }
              >
                Students
              </button>
              <button
                type="button"
                className={form.targetType === "group" ? "active" : ""}
                onClick={() =>
                  setForm({ ...form, targetType: "group", targetIds: [] })
                }
              >
                Groups
              </button>
            </div>
            <div className="assignment-picker compact-picker">
              {targets.map((target: any) => (
                <label key={target.id}>
                  <input
                    type="checkbox"
                    checked={form.targetIds.includes(target.id)}
                    onChange={() => toggleTarget(target.id)}
                  />
                  <span>
                    <b>{target.name}</b>
                    <small>
                      {target.email || target.description || "Student group"}
                    </small>
                  </span>
                  <Users size={16} />
                </label>
              ))}
              {!targets.length && (
                <p className="muted">
                  Add students or groups before creating this assignment.
                </p>
              )}
            </div>
            <div className="numbered-title mt">
              <span>02</span>
              <h3>Add resource files</h3>
            </div>
            <label className="document-upload">
              <Upload size={24} />
              <b>
                {uploading
                  ? `Uploading… ${uploadProgress}%`
                  : "Choose PDF, Word, Excel, PowerPoint, text, or CSV files"}
              </b>
              <small>Up to 10 files · 25 MB each</small>
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
                {files.map((file) => (
                  <span key={file.id}>
                    <FileText size={14} /> {file.filename}
                    <button
                      type="button"
                      aria-label={`Remove ${file.filename}`}
                      onClick={() => {
                        setFiles(files.filter((f) => f.id !== file.id));
                        setForm({
                          ...form,
                          resourceUploadIds: form.resourceUploadIds.filter(
                            (id: string) => id !== file.id,
                          ),
                        });
                      }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                busy={busy}
                disabled={uploading || !form.targetIds.length}
              >
                <Check size={16} /> Create assignment
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {selected && (
        <CourseworkDetails
          assignment={selected}
          data={data}
          refresh={refresh}
          onClose={() => setSelected(null)}
        />
      )}
      {removing && (
        <Modal title="Delete assignment?" onClose={() => setRemoving(null)}>
          <p className="muted">
            This removes the assignment and its submissions from the website.
            This cannot be undone.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await del(`/admin/coursework/${removing.id}`);
                  await refresh();
                  setRemoving(null);
                  toast("Assignment deleted.");
                } catch (e: any) {
                  toast(e.message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={15} /> Delete
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function CourseworkDetails({ assignment, data, refresh, onClose }: any) {
  const [feedback, setFeedback] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(""),
    toast = useToast();
  return (
    <Modal title={assignment.title} wide onClose={onClose}>
      <div className="assignment-detail-head">
        <div>
          <span className={`status ${assignment.status}`}>
            {assignment.status}
          </span>
          <p>{assignment.description}</p>
          {assignment.quiz_url && (
            <a
              className="button secondary small quiz-link"
              href={assignment.quiz_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Google Quiz <ArrowUpRight size={14} />
            </a>
          )}
        </div>
        <div>
          <b>Deadline</b>
          <span>{new Date(assignment.due_at).toLocaleString()}</span>
          <small>
            {assignment.time_limit_minutes
              ? `${assignment.time_limit_minutes} minutes after starting`
              : "Deadline only"}
          </small>
        </div>
      </div>
      <div className="section-heading compact">
        <h2>Teacher resources</h2>
        <span className="muted">{assignment.resources.length} files</span>
      </div>
      <div className="file-list">
        {assignment.resources.map((file: any) => (
          <a
            className="file-row"
            href={`/api/storage/assignment/${assignment.id}/resource/${file.upload_id}`}
            key={file.upload_id}
          >
            <FileText size={18} />
            <span>
              <b>{file.filename}</b>
              <small>{Math.ceil(file.size / 1024)} KB</small>
            </span>
            <Download size={16} />
          </a>
        ))}
        {!assignment.resources.length && (
          <p className="muted">No resource files were attached.</p>
        )}
      </div>
      <div className="section-heading compact">
        <h2>Student submissions</h2>
        <span className="muted">{assignment.submissions.length} started</span>
      </div>
      <div className="submission-list">
        {assignment.submissions.map((s: any) => (
          <article className="submission-review" key={s.id}>
            <div className="submission-review-head">
              <div>
                <Avatar user={{ name: s.student_name }} size={34} />
                <span>
                  <b>{s.student_name}</b>
                  <small>{s.student_email}</small>
                </span>
              </div>
              <span className={`status ${s.status}`}>
                {s.status.replace("_", " ")}
              </span>
            </div>
            {s.submitted_at ? (
              <small>
                Submitted {new Date(s.submitted_at).toLocaleString()}
              </small>
            ) : (
              <small>Started {new Date(s.started_at).toLocaleString()}</small>
            )}
            {s.note && <p>{s.note}</p>}
            <div className="file-chip-list">
              {s.files.map((f: any) => (
                <a
                  key={f.upload_id}
                  href={`/api/storage/submission/${s.id}/file/${f.upload_id}`}
                >
                  <FileText size={13} />
                  {f.filename}
                  <Download size={13} />
                </a>
              ))}
            </div>
            {s.submitted_at && (
              <>
                <textarea
                  rows={2}
                  value={feedback[s.id] ?? s.feedback ?? ""}
                  onChange={(e) =>
                    setFeedback({ ...feedback, [s.id]: e.target.value })
                  }
                  placeholder="Write feedback for this student…"
                />
                <Button
                  variant="secondary small"
                  busy={busy === s.id}
                  onClick={async () => {
                    setBusy(s.id);
                    try {
                      await patch(
                        `/admin/coursework/${assignment.id}/submissions/${s.id}`,
                        { feedback: feedback[s.id] ?? s.feedback ?? "" },
                      );
                      await refresh();
                      toast("Feedback saved.");
                    } catch (e: any) {
                      toast(e.message, "error");
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  Save feedback
                </Button>
              </>
            )}
          </article>
        ))}
        {!assignment.submissions.length && (
          <Empty
            title="No submissions yet"
            description="Student work will appear here after they start the assignment."
          />
        )}
      </div>
    </Modal>
  );
}
function Assignments({ data, refresh }: any) {
  const params = new URLSearchParams(useLocation().search);
  const [targetType, setTargetType] = useState(
      params.has("group") ? "group" : "student",
    ),
    [targetId, setTargetId] = useState(
      params.get("student") || params.get("group") || "",
    ),
    [contentIds, setContentIds] = useState<string[]>([]),
    [kind, setKind] = useState("subject"),
    [subject, setSubject] = useState(""),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("assigned"),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<any>(null),
    toast = useToast();
  const subjects = data.content.filter((c: Item) => c.kind === "subject"),
    root = data.content.find((c: Item) => c.id === subject),
    visible = data.content.filter(
      (c: Item) =>
        c.kind === kind &&
        c.name.toLowerCase().includes(q.toLowerCase()) &&
        (!root ||
          c.id === root.id ||
          descendants(root, data.content).some((n) => n.id === c.id)),
    );
  const grants = data.grants.filter(
    (g: any) => !targetId || g.user_id === targetId || g.group_id === targetId,
  );
  return (
    <>
      <Heading
        title="The right lessons. The right learners."
        description="Shape a personal learning path with precise, immediate access control."
      />
      <div className="assignment-layout">
        <section className="panel">
          <div className="numbered-title">
            <span>01</span>
            <h3>Choose your curious minds</h3>
          </div>
          <div className="tabs">
            <button
              className={targetType === "student" ? "active" : ""}
              onClick={() => {
                setTargetType("student");
                setTargetId("");
              }}
            >
              Individual student
            </button>
            <button
              className={targetType === "group" ? "active" : ""}
              onClick={() => {
                setTargetType("group");
                setTargetId("");
              }}
            >
              Student group
            </button>
          </div>
          <Field label={targetType === "student" ? "Student" : "Group"}>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
            >
              <option value="">Select a {targetType}</option>
              {(targetType === "student" ? data.students : data.groups).map(
                (s: any) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                    {s.email ? ` · ${s.email}` : ""}
                  </option>
                ),
              )}
            </select>
          </Field>
          <div className="numbered-title mt">
            <span>02</span>
            <h3>Build their path</h3>
          </div>
          <div className="grid two">
            <Field label="Content level">
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setContentIds([]);
                }}
              >
                {["subject", "chapter", "topic", "video"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Field>
            <Field label="Subject filter">
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="">All subjects</option>
                {subjects.map((s: Item) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="search-box">
            <Search size={16} />
            <input
              placeholder="Find content…"
              aria-label="Search content to assign"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <div className="assignment-picker">
            {visible.map((c: Item) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={contentIds.includes(c.id)}
                  onChange={(e) =>
                    setContentIds((v) =>
                      e.target.checked
                        ? [...v, c.id]
                        : v.filter((id) => id !== c.id),
                    )
                  }
                />
                <span>
                  <b>{c.name}</b>
                  <small>
                    {pathOf(c, data.content)} · {c.status}
                  </small>
                </span>
                <BookOpen size={16} />
              </label>
            ))}
            {!visible.length && (
              <p className="muted">
                No matching content. Create it in the library first.
              </p>
            )}
          </div>
          <div className="numbered-title mt">
            <span>03</span>
            <h3>Set their access</h3>
          </div>
          <Field label="Permission">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="assigned">Allow access</option>
              <option value="revoked">Revoke access</option>
            </select>
          </Field>
          <Button
            className="full"
            disabled={!targetId || !contentIds.length}
            onClick={() => setConfirm({ assignment: true })}
          >
            <KeyRound size={16} /> Review {contentIds.length}{" "}
            {contentIds.length === 1 ? "assignment" : "assignments"}
          </Button>
        </section>
        <aside>
          <section className="assignment-explainer">
            <ShieldCheck size={32} />
            <h2>
              A space that’s
              <br />
              securely theirs.
            </h2>
            <p>
              Assigning a subject, chapter, or topic includes its published
              lessons and future additions.
            </p>
            <p>
              Individual revocations override group access. Group revocations
              remove that group’s permission; independent assignments still
              apply.
            </p>
            <div>
              <Check size={16} /> Checked on every request
            </div>
            <div>
              <Check size={16} /> Interests never grant access
            </div>
            <div>
              <Check size={16} /> Student progress is preserved
            </div>
          </section>
        </aside>
      </div>
      <div className="section-heading compact">
        <h2>Existing assignments</h2>
        <span className="muted">{grants.length} permissions</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Learner / group</th>
              <th>Content</th>
              <th>Access</th>
              <th>Assigned</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {grants.map((g: any) => (
              <tr key={g.id}>
                <td>
                  {data.students.find((s: any) => s.id === g.user_id)?.name ||
                    data.groups.find((s: any) => s.id === g.group_id)?.name}
                </td>
                <td>
                  {data.content.find((c: Item) => c.id === g.content_id)?.name}
                </td>
                <td>
                  <span className={`status ${g.status}`}>{g.status}</span>
                </td>
                <td>{date(g.created_at)}</td>
                <td>
                  <Button
                    variant="secondary small"
                    onClick={() => setConfirm({ grant: g })}
                  >
                    {g.status === "assigned" ? (
                      <Lock size={13} />
                    ) : (
                      <Unlock size={13} />
                    )}{" "}
                    {g.status === "assigned" ? "Revoke" : "Restore"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!grants.length && (
          <Empty
            title="Their path is yours to shape"
            description="Select content above to make your first assignment."
          />
        )}
      </div>
      {confirm && (
        <Modal title="Confirm access changes" onClose={() => setConfirm(null)}>
          <p className="muted">
            {confirm.grant
              ? `${confirm.grant.status === "assigned" ? "Revoke" : "Restore"} this assignment? Future requests immediately use the updated permission.`
              : `${status === "assigned" ? "Allow" : "Revoke"} access to ${contentIds.length} selected item(s) for ${(targetType === "student" ? data.students : data.groups).find((s: any) => s.id === targetId)?.name}?`}
          </p>
          {!confirm.grant && (
            <ul className="review-list">
              {contentIds.map((id) => (
                <li key={id}>
                  {data.content.find((c: Item) => c.id === id)?.name}
                </li>
              ))}
            </ul>
          )}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  if (confirm.grant)
                    await patch(`/admin/assignments/${confirm.grant.id}`, {
                      status:
                        confirm.grant.status === "assigned"
                          ? "revoked"
                          : "assigned",
                    });
                  else
                    await post("/admin/assignments", {
                      targetType,
                      targetId,
                      contentIds,
                      status,
                    });
                  refresh();
                  setConfirm(null);
                  setContentIds([]);
                  toast("Access updated. The learning path is ready.");
                } catch (e: any) {
                  toast(e.message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm access <Check size={16} />
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Announcements({ data, refresh }: any) {
  const [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<any>(null),
    toast = useToast();
  return (
    <>
      <Heading
        title="A little encouragement goes a long way."
        description="Share news, new lessons, and thoughtful reminders with every learner."
      >
        <Button onClick={() => setAdding(true)}>
          <Plus size={17} /> New announcement
        </Button>
      </Heading>
      <div className="notification-list">
        {data.announcements.map((a: any) => (
          <article className="panel notification-card" key={a.id}>
            <span className="announcement-icon">
              <Mail size={21} />
            </span>
            <div>
              <small>{date(a.created_at)} · All students</small>
              <h3>{a.title}</h3>
              <p>{a.body}</p>
            </div>
            <button
              className="icon-button danger-text"
              aria-label={`Delete ${a.title}`}
              onClick={() => setConfirm(a)}
            >
              <Trash2 size={17} />
            </button>
          </article>
        ))}
      </div>
      {!data.announcements.length && (
        <Empty
          title="Something worth sharing?"
          description="Your announcement will appear in every student’s dashboard."
        />
      )}
      {adding && (
        <Modal title="A note to your learners" onClose={() => setAdding(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await post(
                  "/admin/announcements",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                refresh();
                setAdding(false);
                toast("Your announcement is now in every learner’s space.");
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Title">
              <input name="title" required maxLength={200} />
            </Field>
            <Field label="Your message">
              <textarea name="body" rows={6} required maxLength={5000} />
            </Field>
            <p className="muted">
              Visible to all active students inside English Tech.
            </p>
            <Button type="submit" busy={busy}>
              Publish announcement <ArrowUpRight size={16} />
            </Button>
          </form>
        </Modal>
      )}
      {confirm && (
        <Confirm
          title="Remove this announcement?"
          description="Students will no longer see this message in their dashboard."
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await del(`/admin/announcements/${confirm.id}`);
            refresh();
          }}
        />
      )}
    </>
  );
}
function Analytics({ data }: any) {
  const [period, setPeriod] = useState(30),
    [sort, setSort] = useState("most");
  const events = data.events.filter(
      (e: any) => Number(e.created_at) > Date.now() - period * 86400000,
    ),
    active = new Set(events.map((e: any) => e.user_id)).size,
    watch = events.reduce((a: number, e: any) => a + Number(e.seconds), 0),
    completed = data.progress.filter((p: any) => p.completed).length;
  const videos = data.content
    .filter((c: Item) => c.kind === "video")
    .map((v: Item) => {
      const ev = events.filter((e: any) => e.video_id === v.id),
        p = data.progress.filter((p: any) => p.video_id === v.id);
      return {
        ...v,
        viewers: new Set(ev.map((e: any) => e.user_id)).size,
        views: new Set(
          ev.map(
            (e: any) =>
              `${e.user_id}:${new Date(Number(e.created_at)).toDateString()}`,
          ),
        ).size,
        watch: ev.reduce((a: number, e: any) => a + Number(e.seconds), 0),
        completion: p.length
          ? Math.round(
              (p.filter((p: any) => p.completed).length / p.length) * 100,
            )
          : 0,
        percentage: p.length
          ? Math.round(
              p.reduce(
                (a: number, p: any) =>
                  a +
                  Math.min(100, (Number(p.position) / (v.duration || 1)) * 100),
                0,
              ) / p.length,
            )
          : 0,
      };
    })
    .sort((a: any, b: any) =>
      sort === "most" ? b.watch - a.watch : a.watch - b.watch,
    );
  return (
    <>
      <Heading
        title="See the growth behind the numbers."
        description="Understand your learners, celebrate their progress, and find where to guide them next."
      >
        <select
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
          aria-label="Analytics time range"
        >
          <option value={1}>Today</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </Heading>
      <div className="stats-grid">
        <Stat
          icon={Users}
          label="Active students"
          value={active}
          note={`Within the last ${period} days`}
        />
        <Stat
          icon={Clock}
          label="Learning time"
          value={mins(watch)}
          note="Verified playback heartbeats"
          color="purple"
        />
        <Stat
          icon={CheckCheck}
          label="Completed lessons"
          value={completed}
          note="Across all recorded progress"
          color="orange"
        />
        <Stat
          icon={BarChart3}
          label="Completion rate"
          value={`${data.progress.length ? Math.round((completed / data.progress.length) * 100) : 0}%`}
          note="Of started lessons, all time"
          color="blue"
        />
      </div>
      <section className="panel">
        <h3>Daily learning activity · last 7 days</h3>
        <ActivityChart events={data.events} />
      </section>
      <div className="section-heading compact">
        <h2>Your lessons, in perspective</h2>
        <select
          aria-label="Sort video analytics"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="most">Most watched first</option>
          <option value="least">Least watched first</option>
        </select>
      </div>
      <p className="muted small-note">
        Views count unique learner-days with recorded playback. Completion and
        average position use all-time progress.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lesson</th>
              <th>Views</th>
              <th>Unique viewers</th>
              <th>Watch time</th>
              <th>Completion</th>
              <th>Average position</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v: any) => (
              <tr key={v.id}>
                <td>
                  <b>{v.name}</b>
                </td>
                <td>{v.views}</td>
                <td>{v.viewers}</td>
                <td>{mins(v.watch)}</td>
                <td>{v.completion}%</td>
                <td>{v.percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="section-heading compact">
        <h2>Subject completion</h2>
      </div>
      <div className="grid three">
        {data.content
          .filter((c: Item) => c.kind === "subject")
          .map((c: Item) => {
            const ids = descendants(c, data.content)
                .filter((i) => i.kind === "video")
                .map((i) => i.id),
              learners = new Set(
                data.progress
                  .filter((p: any) => ids.includes(p.video_id))
                  .map((p: any) => p.user_id),
              );
            const finished = [...learners].filter(
              (u) =>
                ids.length &&
                ids.every((v) =>
                  data.progress.some(
                    (p: any) =>
                      p.user_id === u && p.video_id === v && p.completed,
                  ),
                ),
            ).length;
            return (
              <section className="panel" key={c.id}>
                <h3>{c.name}</h3>
                <p className="muted">
                  {finished} of {learners.size} participating learners completed
                </p>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${learners.size ? (finished / learners.size) * 100 : 0}%`,
                    }}
                  />
                </div>
              </section>
            );
          })}
      </div>
      <div className="section-heading compact">
        <h2>Recent administration activity</h2>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Record</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {data.logs.map((l: any) => (
              <tr key={l.id}>
                <td>{l.action.replaceAll(".", " · ")}</td>
                <td>
                  {data.content.find((c: Item) => c.id === l.target_id)?.name ||
                    data.students.find((s: any) => s.id === l.target_id)
                      ?.name ||
                    l.target_id}
                </td>
                <td>{date(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.logs.length && (
          <p className="muted table-empty">
            Admin actions will appear here as you work.
          </p>
        )}
      </div>
    </>
  );
}
function Settings({ data, refresh }: any) {
  const { refresh: refreshAuth } = useAuth();
  const [tab, setTab] = useState("platform"),
    [busy, setBusy] = useState(false),
    toast = useToast();
  return (
    <>
      <Heading
        title="Make English Tech your own."
        description="The details that keep your learning community running thoughtfully."
      />
      <div className="tabs settings-tabs">
        {["platform", "profile", "security", "messages"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "profile" ? (
        <Profile admin />
      ) : tab === "platform" ? (
        <section className="panel settings-panel">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              setBusy(true);
              try {
                await put("/admin/settings", {
                  ...f,
                  weeklyGoal: Number(f.weeklyGoal),
                });
                refresh();
                refreshAuth();
                toast("Platform settings saved.");
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>Your learning community</h3>
            <Field label="Platform name">
              <input
                name="name"
                defaultValue={data.settings.name}
                required
                maxLength={200}
              />
            </Field>
            <Field label="Support email">
              <input
                name="supportEmail"
                defaultValue={data.settings.supportEmail}
                type="email"
                required
              />
            </Field>
            <Field label="Welcome message">
              <input
                name="welcome"
                defaultValue={data.settings.welcome}
                maxLength={300}
              />
            </Field>
            <Field label="Weekly learning goal (minutes)">
              <input
                name="weeklyGoal"
                type="number"
                min="10"
                max="2400"
                defaultValue={data.settings.weeklyGoal}
              />
            </Field>
            <Button busy={busy} type="submit">
              Save settings <Check size={16} />
            </Button>
          </form>
        </section>
      ) : tab === "security" ? (
        <section className="panel settings-panel">
          <h3>A securely yours workspace</h3>
          <p className="muted">
            Use a unique password with at least 12 characters. Changing your
            password signs out your other sessions.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = Object.fromEntries(new FormData(form));
              if (f.password !== f.confirm) {
                toast("The new passwords do not match.", "error");
                return;
              }
              setBusy(true);
              try {
                await post("/auth/password", f);
                form.reset();
                toast("Your password has been updated.");
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Current password">
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="New password">
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={200}
              />
            </Field>
            <Field label="Confirm new password">
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
              />
            </Field>
            <Button busy={busy} type="submit">
              Update password <ShieldCheck size={16} />
            </Button>
          </form>
        </section>
      ) : (
        <div className="notification-list">
          {data.contacts.map((c: any) => (
            <article key={c.id} className="panel">
              <small className="muted">
                {date(c.created_at)} · {c.email}
              </small>
              <h3>{c.name}</h3>
              <p className="message-body">{c.message}</p>
              <a href={`mailto:${c.email}`} className="text-button">
                Reply by email <ArrowUpRight size={15} />
              </a>
            </article>
          ))}
          {!data.contacts.length && (
            <Empty
              title="Your inbox has a little breathing room"
              description="Messages from the public contact form will arrive here."
            />
          )}
        </div>
      )}
    </>
  );
}
