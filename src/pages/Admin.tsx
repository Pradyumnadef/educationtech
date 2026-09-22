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
  Folder,
  FolderPlus,
  ChevronRight,
  MapPin,
  Navigation,
  Target,
  ArrowUpDown,
} from "lucide-react";
import Teachers from "./Teachers";
import Shell from "../components/Shell";
import PdfViewer from "../components/PdfViewer";
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
  contentKindLabel,
  DriveSort,
  contentFolderSize,
  sortDriveEntries,
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
  else if (
    ["library", "subjects", "chapters", "materials", "videos"].includes(route)
  )
    body = <ContentDrive key={location.search} data={data} refresh={refresh} />;
  else if (route === "assignments")
    body = <Coursework data={data} refresh={refresh} />;
  else if (route === "attendance")
    body = <Attendance data={data} refresh={refresh} />;
  else if (route === "attendance-analysis")
    body = <AttendanceAnalysis data={data} refresh={refresh} />;
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
        `${s.name} ${s.email} ${s.phone} ${s.roll_number} ${s.group_name}`
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
        description="Support your students and see how they’re growing."
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
                        {(s.roll_number || s.group_name) && (
                          <small>{s.group_name || "No group"}{s.roll_number ? ` · Roll ${s.roll_number}` : ""}</small>
                        )}
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
    [name, setName] = useState(s.name);
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
          {(s.group_name || s.roll_number) && (
            <p>{s.group_name || "No student group"}{s.roll_number ? ` · Roll ${s.roll_number}` : ""}</p>
          )}
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
        <Button variant="secondary" onClick={() => setEditing(!editing)}>
          <Pencil size={15} /> Edit name
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
        description="Bring learners together and manage class membership."
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
            Membership changes take effect immediately.
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
        </Modal>
      )}
      {confirm && (
        <Confirm
          title="Remove this group?"
          description="Its members remain registered and will simply leave this group."
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
function ContentDrive({ data, refresh }: any) {
  const location = useLocation();
  const currentId = new URLSearchParams(location.search).get("folder");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [driveSort, setDriveSort] = useState<DriveSort>("date-desc");
  const [editor, setEditor] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [confirm, setConfirm] = useState<Item | null>(null);
  const toast = useToast();
  const items: Item[] = data.content;
  const current = currentId
    ? items.find(
        (item) =>
          item.id === currentId && ["subject", "folder"].includes(item.kind),
      )
    : undefined;
  const children = items
    .filter((item) =>
      current ? item.parent_id === current.id : item.kind === "subject",
    )
    .filter((item) =>
      `${item.name} ${item.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const folders = children.filter((item) =>
    ["subject", "folder"].includes(item.kind),
  );
  const materials = children.filter((item) => item.kind === "video");
  const uploadedItems = materials.flatMap((material) =>
    (material.assets || []).length
      ? (material.assets || []).map((asset: any) => ({ asset, material }))
      : [{ asset: null, material }],
  );
  const sortedFolders = sortDriveEntries(folders, driveSort, (folder) => ({
    name: folder.name,
    date: Number(folder.created_at || 0),
    size: contentFolderSize(items, folder.id),
  }));
  const sortedUploadedItems = sortDriveEntries(
    uploadedItems,
    driveSort,
    ({ asset, material }) => ({
      name: asset?.filename || material.name,
      date: Number(asset?.created_at || material.created_at || 0),
      size: Number(asset?.size || 0),
    }),
  );
  const crumbs: Item[] = [];
  if (current) {
    let node: Item | undefined = current;
    const seen = new Set<string>();
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      crumbs.unshift(node);
      node = items.find((item) => item.id === node?.parent_id);
    }
  }
  const openEditor = async (item: Item) => {
    try {
      setEditor(await api(`/admin/content/${item.id}`));
    } catch (error: any) {
      toast(error.message, "error");
    }
  };
  return (
    <>
      <Heading
        title={current ? current.name : "Your content drive."}
        description={
          current
            ? "Create folders inside folders, then upload videos and documents exactly where they belong."
            : "Open a subject to organize its learning content with simple folders."
        }
      >
        {!current ? (
          <Button onClick={() => setEditor({ kind: "subject" })}>
            <Plus size={17} /> New subject
          </Button>
        ) : (
          <div className="drive-heading-actions">
            <Button
              variant="secondary"
              onClick={() =>
                setEditor({ kind: "folder", parent_id: current.id })
              }
            >
              <FolderPlus size={17} /> New folder
            </Button>
            <Button
              onClick={() =>
                setEditor({
                  kind: "video",
                  parent_id: current.id,
                  assetTab: "videos",
                })
              }
            >
              <Upload size={17} /> Upload
            </Button>
          </div>
        )}
      </Heading>
      <nav className="drive-breadcrumbs" aria-label="Current folder">
        <Link to="/admin/library">Content drive</Link>
        {crumbs.map((crumb) => (
          <span key={crumb.id}>
            <ChevronRight size={15} />
            <Link to={`/admin/library?folder=${encodeURIComponent(crumb.id)}`}>
              {crumb.name}
            </Link>
          </span>
        ))}
      </nav>
      <div className="drive-toolbar">
        <div className="drive-toolbar-controls">
          <div className={`drive-search-control ${searchOpen ? "expanded" : ""}`}>
            <button
              type="button"
              className="icon-button"
              aria-label="Search this folder"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen(true)}
            >
              <Search size={17} />
            </button>
            {searchOpen && (
              <>
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search this folder…"
                  aria-label="Search this folder"
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Close search"
                  onClick={() => {
                    setQuery("");
                    setSearchOpen(false);
                  }}
                >
                  <X size={15} />
                </button>
              </>
            )}
          </div>
          <label className="drive-sort-control">
            <ArrowUpDown size={16} />
            <select
              value={driveSort}
              onChange={(event) => setDriveSort(event.target.value as DriveSort)}
              aria-label="Sort folder contents"
            >
              <option value="date-desc">Date: newest first</option>
              <option value="date-asc">Date: oldest first</option>
              <option value="name-asc">Name: A–Z</option>
              <option value="size-desc">Size: largest first</option>
              <option value="size-asc">Size: smallest first</option>
            </select>
          </label>
        </div>
        <span>{folders.length + uploadedItems.length} items</span>
      </div>
      {!!(folders.length || uploadedItems.length) && (
        <div className="drive-explorer-list admin-drive-list" role="list">
          {sortedFolders.map((folder) => (
            <article
              className="drive-explorer-row"
              key={folder.id}
              role="listitem"
            >
              <Link
                className="drive-explorer-main"
                to={`/admin/library?folder=${encodeURIComponent(folder.id)}`}
              >
                <span className="drive-folder-icon">
                  <Folder size={22} />
                </span>
                <span className="drive-explorer-name">
                  <strong>{folder.name}</strong>
                  <small>
                    {
                      items.filter((item) => item.parent_id === folder.id)
                        .length
                    }{" "}
                    items
                  </small>
                </span>
              </Link>
              <span className="drive-explorer-type">
                {folder.kind === "subject" ? "Subject" : "Folder"}
              </span>
              <div className="drive-row-actions">
                <button
                  className="icon-button"
                  aria-label={`Edit ${folder.name}`}
                  onClick={() => openEditor(folder)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button danger-text"
                  aria-label={`Delete ${folder.name}`}
                  onClick={() => setConfirm(folder)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
          {sortedUploadedItems.map(({ asset, material }, index) => {
            const isVideo = asset?.asset_type === "video";
            return (
              <article
                className="drive-explorer-row"
                key={`${material.id}-${asset?.id || index}`}
                role="listitem"
              >
                <button
                  className="drive-explorer-main drive-preview-trigger"
                  onClick={() =>
                    asset
                      ? setPreview({ asset, material })
                      : openEditor(material)
                  }
                >
                  <span className="drive-file-icon">
                    {isVideo ? <FileVideo size={20} /> : <FileText size={20} />}
                  </span>
                  <span className="drive-explorer-name">
                    <strong>{asset?.filename || material.name}</strong>
                    <small>
                      {material.name}
                      {asset
                        ? ` · ${formatFileSize(asset.size)}`
                        : " · No uploaded file"}
                    </small>
                  </span>
                </button>
                <span className="drive-explorer-type">
                  {isVideo
                    ? "Video"
                    : asset?.mime === "application/pdf"
                      ? "PDF"
                      : "Document"}
                </span>
                <div className="drive-row-actions">
                  {asset && (
                    <button
                      className="icon-button"
                      onClick={() => setPreview({ asset, material })}
                      aria-label={`View ${asset.filename}`}
                    >
                      <Eye size={15} />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label={`Edit ${material.name}`}
                    onClick={() => openEditor(material)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button danger-text"
                    aria-label={`Delete ${material.name}`}
                    onClick={() => setConfirm(material)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!children.length && (
        <Empty
          title={
            query
              ? "Nothing found"
              : current
                ? "This folder is empty"
                : "No subjects yet"
          }
          description={
            query
              ? "Try a different search."
              : current
                ? "Create a folder or upload videos and documents to begin."
                : "Create your first subject to begin organizing content."
          }
        />
      )}
      {editor && (
        <ContentEditor
          item={editor}
          data={data}
          onClose={() => setEditor(null)}
          refresh={refresh}
        />
      )}
      {preview && (
        <Modal
          title={preview.asset.filename}
          onClose={() => setPreview(null)}
          wide
        >
          <div className="teacher-preview-actions">
            <span>
              {preview.material.name} · {formatFileSize(preview.asset.size)}
            </span>
            <a
              className="button secondary small"
              href={`/api/storage/preview/${preview.asset.id}?download=1`}
            >
              <Download size={15} /> Download
            </a>
          </div>
          {preview.asset.mime === "application/pdf" ? (
            <PdfViewer
              url={`/api/storage/preview/${preview.asset.id}`}
              filename={preview.asset.filename}
            />
          ) : preview.asset.mime?.startsWith("video/") ? (
            <video
              className="teacher-video-preview"
              src={`/api/storage/preview/${preview.asset.id}`}
              controls
              preload="metadata"
            />
          ) : (
            <Empty
              title="Preview is available for PDF and video files"
              description="Use Download to open this file in the appropriate application."
            />
          )}
        </Modal>
      )}
      {confirm && (
        <Confirm
          title={`Delete “${confirm.name}”?`}
          description="This permanently deletes this item, its access grants, progress, and unused stored files."
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await del(`/admin/content/${confirm.id}`);
            setConfirm(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
function ContentLibrary({ initialKind, data, refresh }: any) {
  const requestedKind = new URLSearchParams(useLocation().search).get("type");
  const [kind, setKind] = useState(
    ["subject", "chapter"].includes(requestedKind || "")
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
function Content({ kind, data, refresh, merged = false, onKindChange }: any) {
  const [q, setQ] = useState(
      new URLSearchParams(useLocation().search).get("q") || "",
    ),
    [status, setStatus] = useState("all"),
    [materialTab, setMaterialTab] = useState<"videos" | "files" | "preview">(
      "videos",
    ),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<any>(null),
    [confirm, setConfirm] = useState<Item | null>(null),
    toast = useToast();
  const debounced = useDebounced(q);
  const itemLabel = contentKindLabel(kind);
  const pluralLabel = contentKindLabel(kind, true);
  const rows = data.content.filter(
    (c: Item) =>
      c.kind === kind &&
      (kind !== "video" ||
        (materialTab === "videos"
          ? Number(c.video_count || 0) > 0 || Number(c.file_count || 0) === 0
          : materialTab === "files"
            ? Number(c.file_count || 0) > 0
            : Number(c.video_count || 0) + Number(c.file_count || 0) > 0)) &&
      `${c.name} ${c.description} ${c.tags}`
        .toLowerCase()
        .includes(debounced.toLowerCase()) &&
      (status === "all" || c.status === status),
  );
  const displayedParent = (item: Item) => {
    const parent = data.content.find(
      (node: Item) => node.id === item.parent_id,
    );
    return item.kind === "video" && parent?.kind === "topic"
      ? data.content.find((node: Item) => node.id === parent.parent_id)
      : parent;
  };
  return (
    <>
      <Heading
        title={
          merged
            ? "Subjects and modules."
            : kind === "video"
              ? "Learning materials, all in one place."
              : `Make room for ${kind === "subject" ? "curiosity" : "the next chapter"}.`
        }
        description={
          merged
            ? "Build a simple learning path: create a subject, add modules, then place learning materials inside each module."
            : kind === "video"
              ? "Manage lesson videos, captions, downloadable files, notes, and publishing details."
              : kind === "subject"
                ? "English and UHV are ready. Add any new subject here whenever you need it."
                : `Organize your ${pluralLabel} into clear, connected learning experiences.`
        }
      >
        <Button
          onClick={() =>
            setEditor({
              kind,
              ...(kind === "video"
                ? {
                    assetTab:
                      materialTab === "preview" ? "videos" : materialTab,
                  }
                : {}),
            })
          }
        >
          <Plus size={17} /> Add {itemLabel}
        </Button>
      </Heading>
      {merged && (
        <div
          className="tabs content-structure-tabs"
          role="tablist"
          aria-label="Content type"
        >
          {["subject", "chapter"].map((type) => (
            <button
              type="button"
              role="tab"
              className={kind === type ? "active" : ""}
              aria-selected={kind === type}
              onClick={() => onKindChange(type)}
              key={type}
            >
              {contentKindLabel(type, true).replace(/^./, (c) =>
                c.toUpperCase(),
              )}
            </button>
          ))}
        </div>
      )}
      {kind === "video" && (
        <div
          className="tabs material-library-tabs"
          role="tablist"
          aria-label="Learning material type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={materialTab === "videos"}
            className={materialTab === "videos" ? "active" : ""}
            onClick={() => {
              setMaterialTab("videos");
              setPage(1);
            }}
          >
            <FileVideo size={17} /> Videos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={materialTab === "files"}
            className={materialTab === "files" ? "active" : ""}
            onClick={() => {
              setMaterialTab("files");
              setPage(1);
            }}
          >
            <FileText size={17} /> Files
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={materialTab === "preview"}
            className={materialTab === "preview" ? "active" : ""}
            onClick={() => {
              setMaterialTab("preview");
              setPage(1);
            }}
          >
            <Eye size={17} /> Preview
          </button>
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
      {kind === "video" && materialTab === "preview" ? (
        <MaterialPreviewLibrary
          rows={rows.slice((page - 1) * 15, page * 15)}
          onEdit={async (item: Item) => {
            try {
              setEditor(await api(`/admin/content/${item.id}`));
            } catch (e: any) {
              toast(e.message, "error");
            }
          }}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{kind === "video" ? "Learning material" : "Name"}</th>
                <th>Located in</th>
                <th>Status</th>
                <th>{kind === "video" ? "Uploaded items" : "Contents"}</th>
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
                            `A ${itemLabel} of possibilities`}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>{displayedParent(c)?.name || "Your library"}</td>
                  <td>
                    <span className={`status ${c.status}`}>
                      {c.publish_at && c.publish_at > Date.now()
                        ? "Scheduled"
                        : c.status}
                    </span>
                  </td>
                  <td>
                    {kind === "video"
                      ? `${Number(c.video_count || 0)} video${Number(c.video_count || 0) === 1 ? "" : "s"} · ${Number(c.file_count || 0)} file${Number(c.file_count || 0) === 1 ? "" : "s"}`
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
      )}
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
          description="This permanently deletes this content, all nested content, assignments, associated progress, and unused stored files."
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
function MaterialPreviewLibrary({ rows, onEdit }: any) {
  if (!rows.length)
    return (
      <Empty
        title="Nothing to preview yet"
        description="Upload a video or file to see it here."
      />
    );
  return (
    <div className="material-preview-library">
      {rows.map((item: Item) => {
        const videos = (item.assets || []).filter(
          (asset) => asset.asset_type === "video",
        );
        const files = (item.assets || []).filter(
          (asset) => asset.asset_type === "file",
        );
        return (
          <article className="material-preview-card" key={item.id}>
            <header>
              <div>
                <span className="eyebrow">LEARNING MATERIAL</span>
                <h3>{item.name}</h3>
                <p>{item.description || "No description added."}</p>
              </div>
              <div className="material-preview-card-actions">
                <span className={`status ${item.status}`}>{item.status}</span>
                <Button
                  type="button"
                  variant="secondary small"
                  onClick={() => onEdit(item)}
                >
                  <Pencil size={14} /> Edit
                </Button>
              </div>
            </header>
            {!!videos.length && (
              <section>
                <h4>
                  <FileVideo size={17} /> Videos <span>{videos.length}</span>
                </h4>
                <div className="material-preview-video-grid">
                  {videos.map((video, index) => (
                    <div className="material-preview" key={video.id}>
                      <div className="material-preview-heading">
                        <div className="uploaded-file-icon">
                          <FileVideo size={19} />
                        </div>
                        <div className="uploaded-file-meta">
                          <strong>{video.filename}</strong>
                          <span>
                            Video {index + 1} · {formatFileSize(video.size)}
                          </span>
                        </div>
                        <a
                          className="file-action"
                          href={`/api/storage/preview/${video.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Eye size={14} /> Open
                        </a>
                      </div>
                      <video
                        controls
                        preload="metadata"
                        src={`/api/storage/preview/${video.id}`}
                      >
                        Your browser does not support video playback.
                      </video>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {!!files.length && (
              <section>
                <h4>
                  <FileText size={17} /> Files <span>{files.length}</span>
                </h4>
                <div className="material-preview-file-list">
                  {files.map((file, index) => (
                    <UploadedFile
                      key={file.id}
                      file={file}
                      label={`File ${index + 1}`}
                    />
                  ))}
                </div>
              </section>
            )}
          </article>
        );
      })}
    </div>
  );
}
function ContentEditor({ item, data, onClose, refresh }: any) {
  const { data: uploadLimits } = useData<any>("/storage/limits");
  const legacyParent = data.content.find(
    (content: Item) =>
      content.id === item.parent_id && content.kind === "topic",
  );
  const normalizedItem =
    item.kind === "video" && legacyParent
      ? { ...item, parent_id: legacyParent.parent_id }
      : item;
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
      ...normalizedItem,
    }),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(""),
    [progress, setProgress] = useState(0),
    [scan, setScan] = useState<any>(null),
    [uploadedFiles, setUploadedFiles] = useState<Record<string, any>>(
      item.uploaded_files || {},
    ),
    [videoAssets, setVideoAssets] = useState<any[]>(
      (item.assets || []).filter((asset: any) => asset.asset_type === "video"),
    ),
    [fileAssets, setFileAssets] = useState<any[]>(
      (item.assets || []).filter((asset: any) => asset.asset_type === "file"),
    ),
    [pendingAssets, setPendingAssets] = useState<any[]>([]),
    toast = useToast();
  const kindLabel = contentKindLabel(form.kind);
  const videoLimit = Number(uploadLimits?.video || 50 * 1024 ** 2);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const parentKind: Record<string, string> = {
    folder: "folder",
    chapter: "subject",
    topic: "chapter",
    video: "folder",
  };
  const parentKinds: Record<string, string[]> = {
    folder: ["subject", "folder"],
    video: ["subject", "folder"],
    chapter: ["subject"],
    topic: ["chapter"],
  };
  const blockedParentIds = new Set(
    form.id
      ? [
          form.id,
          ...descendants(form as Item, data.content).map((item) => item.id),
        ]
      : [],
  );
  const parents = data.content.filter(
    (c: Item) =>
      parentKinds[form.kind]?.includes(c.kind) && !blockedParentIds.has(c.id),
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
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading("");
    }
  }
  async function uploadMany(files: File[], type: "video" | "file") {
    const available =
      type === "video" ? 20 - videoAssets.length : 30 - fileAssets.length;
    if (files.length > available) {
      toast(
        `You can attach up to ${type === "video" ? 20 : 30} ${type === "video" ? "videos" : "files"} to one learning material.`,
        "error",
      );
      return;
    }
    setUploading(type);
    setProgress(0);
    let completed = 0;
    try {
      for (const file of files) {
        if (type === "video" && file.size > videoLimit)
          throw new Error(
            `“${file.name}” is too large. Your current plan allows up to ${formatUploadLimit(videoLimit)} per video.`,
          );
        const out = await uploadFile(file, (value) =>
          setProgress(
            Math.round(((completed + value / 100) / files.length) * 100),
          ),
        );
        if (out.state === "ready") {
          const ready = { ...out, asset_type: type };
          if (type === "video")
            setVideoAssets((current) =>
              current.some((asset) => asset.id === out.id)
                ? current
                : [...current, ready],
            );
          else
            setFileAssets((current) =>
              current.some((asset) => asset.id === out.id)
                ? current
                : [...current, ready],
            );
        } else
          setPendingAssets((current) => [
            ...current,
            { ...out, asset_type: type },
          ]);
        completed += 1;
      }
      toast(
        `${files.length} ${files.length === 1 ? "item" : "items"} uploaded.`,
      );
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading("");
      setProgress(0);
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
              throw new Error("Choose a folder for this item first.");
            const payload = {
              ...form,
              storage_key:
                videoAssets[0]?.storage_key || videoAssets[0]?.key || "",
              resource_key:
                fileAssets[0]?.storage_key || fileAssets[0]?.key || "",
              video_upload_ids: videoAssets.map((asset) => asset.id),
              file_upload_ids: fileAssets.map((asset) => asset.id),
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
              <Field label="Location">
                <select
                  value={form.parent_id || ""}
                  onChange={(e) => set("parent_id", e.target.value)}
                  required
                >
                  <option value="">Select a subject or folder</option>
                  {parents.map((p: Item) => (
                    <option key={p.id} value={p.id}>
                      {pathOf(p, data.content)}
                    </option>
                  ))}
                </select>
                {!parents.length && (
                  <small>Create a subject in your content drive first.</small>
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
            <section className="asset-section" aria-label="Uploaded items">
              <div className="upload-zone">
                <Upload size={32} />
                <h3>Upload videos and documents</h3>
                <p>
                  Select one or more MP4, WebM, MOV, PDF, Word, Excel,
                  PowerPoint, text, or CSV files.
                </p>
                <label className="button secondary">
                  <Upload size={16} /> Choose files
                  <input
                    type="file"
                    multiple
                    accept="video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                    hidden
                    disabled={!!uploading}
                    onChange={async (event) => {
                      const selected = Array.from(event.target.files || []);
                      event.target.value = "";
                      const videos = selected.filter((file) =>
                        file.type.startsWith("video/"),
                      );
                      const files = selected.filter(
                        (file) => !file.type.startsWith("video/"),
                      );
                      if (videos.length) await uploadMany(videos, "video");
                      if (files.length) await uploadMany(files, "file");
                    }}
                  />
                </label>
              </div>
              <div className="asset-list drive-upload-list">
                {[...videoAssets, ...fileAssets].map((file) => {
                  const isVideo =
                    file.asset_type === "video" ||
                    file.mime?.startsWith("video/");
                  return (
                    <div className="uploaded-file" key={file.id}>
                      <div className="uploaded-file-icon">
                        {isVideo ? (
                          <FileVideo size={19} />
                        ) : (
                          <FileText size={19} />
                        )}
                      </div>
                      <div className="uploaded-file-meta">
                        <strong>{file.filename}</strong>
                        <span>
                          {isVideo ? "Video" : "Document"} ·{" "}
                          {formatFileSize(file.size)}
                        </span>
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
                        onClick={() =>
                          isVideo
                            ? setVideoAssets((current) =>
                                current.filter((asset) => asset.id !== file.id),
                              )
                            : setFileAssets((current) =>
                                current.filter((asset) => asset.id !== file.id),
                              )
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
                {!videoAssets.length && !fileAssets.length && (
                  <p className="asset-empty">
                    This folder has no uploaded files yet.
                  </p>
                )}
              </div>
            </section>
            {uploading && (
              <div role="status" className="upload-progress-panel">
                <div className="progress-track">
                  <i style={{ width: `${progress}%` }} />
                </div>
                <p className="muted">Uploading… {progress}%</p>
              </div>
            )}
            {!!pendingAssets.length && (
              <div className="scan-notice">
                <p>
                  {pendingAssets.length} uploaded{" "}
                  {pendingAssets.length === 1 ? "item is" : "items are"} waiting
                  for a security scan.
                </p>
                <Button
                  type="button"
                  variant="secondary small"
                  onClick={async () => {
                    try {
                      const remaining: any[] = [];
                      for (const pending of pendingAssets) {
                        const result = await api(
                          `/storage/status/${pending.id}`,
                        );
                        if (result.state === "ready") {
                          const ready = {
                            ...pending,
                            storage_key: result.storage_key,
                            key: result.storage_key,
                            state: "ready",
                          };
                          if (pending.asset_type === "video")
                            setVideoAssets((current) =>
                              current.some((asset) => asset.id === ready.id)
                                ? current
                                : [...current, ready],
                            );
                          else
                            setFileAssets((current) =>
                              current.some((asset) => asset.id === ready.id)
                                ? current
                                : [...current, ready],
                            );
                        } else if (result.state !== "rejected")
                          remaining.push(pending);
                      }
                      setPendingAssets(remaining);
                      toast(
                        remaining.length
                          ? "Some files are still being scanned."
                          : "Security scan complete. Files attached.",
                      );
                    } catch (e: any) {
                      toast(e.message, "error");
                    }
                  }}
                >
                  Check scan status
                </Button>
              </div>
            )}
            {scan && (
              <div className="scan-notice">
                <p>Caption uploaded. Security scan: {scan.state}.</p>
                <Button
                  type="button"
                  variant="secondary small"
                  onClick={async () => {
                    try {
                      const result = await api(`/storage/status/${scan.id}`);
                      if (result.state === "ready") {
                        set(scan.field, result.storage_key);
                        setUploadedFiles((current) => ({
                          ...current,
                          [scan.field]: {
                            ...scan,
                            key: result.storage_key,
                            state: "ready",
                          },
                        }));
                        setScan(null);
                        toast("Security scan complete. Caption attached.");
                      } else if (result.state === "rejected") {
                        setScan(null);
                        toast("The file failed its security scan.", "error");
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
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) upload(file, "caption_key");
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
function formatUploadLimit(size: number) {
  return size >= 1024 ** 3
    ? `${Number((size / 1024 ** 3).toFixed(1))} GB`
    : `${Math.round(size / 1024 ** 2)} MB`;
}
function UploadedFile({ file, label, onRemove }: any) {
  return (
    <div className="uploaded-file-row">
      <div className="uploaded-file-icon">
        <FileText size={17} />
      </div>
      <div className="uploaded-file-meta">
        <strong>{file.filename}</strong>
        <span>
          {label} · {formatFileSize(file.size)}
        </span>
      </div>
      <a
        className="file-action"
        href={`/api/storage/preview/${file.id}`}
        target="_blank"
        rel="noreferrer"
      >
        <Eye size={14} /> View
      </a>
      {onRemove && (
        <button
          className="icon-button file-remove"
          type="button"
          aria-label={`Remove ${file.filename}`}
          title="Remove attachment"
          onClick={onRemove}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
function Attendance({ data, refresh }: any) {
  const subjects = data.content.filter((item: Item) => item.kind === "subject");
  const studentGroups = data.groups || [];
  const synergyCampus = {
    locationName: "Synergy Institute of Technology, Bhubaneswar",
    latitude: "20.3473125",
    longitude: "85.8998125",
  };
  const localDateTime = (time: number) => {
    const value = new Date(time);
    return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  const emptyForm = () => ({
    title: "Class attendance",
    subjectId: subjects[0]?.id || "",
    groupId: studentGroups[0]?.id || "",
    ...synergyCampus,
    radiusM: 25,
    startsAt: localDateTime(Date.now()),
    endsAt: localDateTime(Date.now() + 30 * 60000),
  });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [removing, setRemoving] = useState<any>(null);
  const toast = useToast();
  const sessions = (data.attendance || []).filter(
    (session: any) =>
      session.status === "open" && Date.now() <= Number(session.ends_at),
  );
  const captureLocation = () => {
    if (!navigator.geolocation)
      return toast("This device does not support location capture.", "error");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current: any) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(7),
          longitude: position.coords.longitude.toFixed(7),
        }));
        setLocating(false);
        toast("Attendance location captured.");
      },
      () => {
        setLocating(false);
        toast(
          "Location permission is unavailable. The Synergy Institute preset is still available.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  return (
    <>
      <Heading
        eyebrow="PRESENT, VERIFIED, READY TO LEARN."
        title="Location-based attendance."
        description="Open a timed attendance session and allow check-in only within your chosen campus radius."
      >
        <Button
          disabled={!subjects.length || !studentGroups.length}
          onClick={() => setCreating(true)}
        >
          <Plus size={16} /> New attendance
        </Button>
      </Heading>
      <div className="assignment-summary grid three">
        <Stat icon={MapPin} label="Sessions" value={sessions.length} />
        <Stat
          icon={Clock}
          label="Open now"
          value={sessions.filter((session: any) =>
            session.status === "open" && Date.now() >= Number(session.starts_at) && Date.now() <= Number(session.ends_at)).length}
        />
        <Stat
          icon={CheckCheck}
          label="Check-ins"
          value={sessions.reduce((count: number, session: any) => count + session.records.length, 0)}
        />
      </div>
      <div className="attendance-grid teacher-attendance-grid">
        {sessions.map((session: any) => {
          const upcoming = Date.now() < Number(session.starts_at);
          const expired = Date.now() > Number(session.ends_at);
          const open = session.status === "open" && !upcoming && !expired;
          return (
            <article className="panel attendance-card" key={session.id}>
              <div className="attendance-card-top">
                <span className={`status ${open ? "published" : "draft"}`}>
                  {open ? "Open" : upcoming && session.status === "open" ? "Scheduled" : "Closed"}
                </span>
                <MapPin size={21} />
              </div>
              <h2>{session.title}</h2>
              <p>{session.location_name}</p>
              <div className="attendance-meta">
                <span><BookOpen size={15} /> {session.subject_name || "Unassigned subject"}</span>
                <span><Users size={15} /> {session.class_section_name || "All students"}</span>
                <span><Clock size={15} /> {new Date(session.starts_at).toLocaleString()}</span>
                <span><Target size={15} /> {session.radius_m} metre radius</span>
                <span><CheckCheck size={15} /> {session.records.length} present</span>
              </div>
              <div className="card-actions">
                <Button variant="secondary small" onClick={() => setSelected(session)}>
                  <Eye size={14} /> View attendance
                </Button>
                {!expired && (
                  <Button
                    variant="ghost small"
                    onClick={async () => {
                      try {
                        await patch(`/admin/attendance/${session.id}`, { status: open ? "closed" : "open" });
                        await refresh();
                      } catch (error: any) {
                        toast(error.message, "error");
                      }
                    }}
                  >
                    {open ? "Close" : "Reopen"}
                  </Button>
                )}
                <Button variant="ghost small" onClick={() => setRemoving(session)}>
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {!sessions.length && (
        <Empty
          title="Create your first attendance session"
          description={
            !subjects.length
              ? "Create a subject before opening attendance."
              : !studentGroups.length
                ? "Create a student group before opening attendance."
                : "Choose a subject and student group, then set the attendance location and time."
          }
        >
          <Button disabled={!subjects.length || !studentGroups.length} onClick={() => setCreating(true)}><Plus size={16} /> New attendance</Button>
        </Empty>
      )}
      {creating && (
        <Modal title="Create attendance session" onClose={() => !busy && setCreating(false)} wide>
          <form
            className="assignment-form attendance-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                await post("/admin/attendance", {
                  ...form,
                  latitude: Number(form.latitude),
                  longitude: Number(form.longitude),
                  radiusM: Number(form.radiusM),
                  startsAt: new Date(form.startsAt).getTime(),
                  endsAt: new Date(form.endsAt).getTime(),
                });
                await refresh();
                setCreating(false);
                setForm(emptyForm());
                toast("Attendance session is ready.");
              } catch (error: any) {
                toast(error.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="grid two">
              <Field label="Session title">
                <input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </Field>
              <Field label="Location name">
                <input required maxLength={200} value={form.locationName} onChange={(event) => setForm({ ...form, locationName: event.target.value })} />
              </Field>
            </div>
            <div className="grid two">
              <Field label="Subject">
                <select required value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}>
                  <option value="" disabled>Choose subject</option>
                  {subjects.map((subject: Item) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
                </select>
              </Field>
              <Field label="Student group">
                <select required value={form.groupId} onChange={(event) => setForm({ ...form, groupId: event.target.value })}>
                  <option value="" disabled>Choose student group</option>
                  {studentGroups.map((group: any) => <option value={group.id} key={group.id}>{group.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="attendance-location-capture">
              <div>
                <strong>Attendance centre</strong>
                <p>Use the saved institute location, or capture another attendance centre from this device.</p>
              </div>
              <div className="attendance-location-actions">
                <Button
                  type="button"
                  onClick={() => {
                    setForm((current: any) => ({ ...current, ...synergyCampus }));
                    toast("Synergy Institute location selected.");
                  }}
                >
                  <MapPin size={16} /> Use Synergy Institute location
                </Button>
                <Button type="button" variant="secondary" disabled={locating} onClick={captureLocation}>
                  <Navigation size={16} /> {locating ? "Finding location…" : "Use my current location"}
                </Button>
              </div>
            </div>
            <div className="grid three">
              <Field label="Latitude">
                <input required type="number" step="any" min={-90} max={90} value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} placeholder="20.0000000" />
              </Field>
              <Field label="Longitude">
                <input required type="number" step="any" min={-180} max={180} value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} placeholder="85.0000000" />
              </Field>
              <Field label="Allowed radius (metres)">
                <input required type="number" min={10} max={1000} value={form.radiusM} onChange={(event) => setForm({ ...form, radiusM: event.target.value })} />
                <small>Use 25 metres for a 50-metre diameter, or 50 for a 50-metre radius.</small>
              </Field>
            </div>
            <div className="grid two">
              <Field label="Opens at"><input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></Field>
              <Field label="Closes at"><input required type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></Field>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
              <Button disabled={busy || locating}><MapPin size={16} /> {busy ? "Creating…" : "Open attendance"}</Button>
            </div>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)} wide>
          <div className="attendance-report-heading">
            <div><b>{selected.records.length} students present</b><p>{selected.location_name} · {selected.radius_m} metre radius</p></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Roll number</th><th>Checked in</th><th>Distance</th><th>GPS accuracy</th></tr></thead>
              <tbody>
                {selected.records.map((record: any) => (
                  <tr key={record.id}>
                    <td><b>{record.student_name}</b><small>{record.student_email}</small></td>
                    <td>{record.student_roll_number || "—"}</td>
                    <td>{new Date(record.checked_at).toLocaleString()}</td>
                    <td>{Math.round(record.distance_m)} m</td>
                    <td>{Math.round(record.accuracy_m)} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!selected.records.length && <Empty title="No check-ins yet" description="Student attendance will appear here as it is recorded." />}
        </Modal>
      )}
      {removing && (
        <Confirm
          title="Delete this attendance session?"
          description="This permanently removes the session and every attendance record in it."
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await del(`/admin/attendance/${removing.id}`);
            setRemoving(null);
            await refresh();
          }}
        />
      )}
    </>
  );
}

type AttendanceExportRow = {
  subject: string;
  classSection: string;
  session: string;
  sessionDate: string;
  student: string;
  rollNumber: string;
  email: string;
  status: "Present" | "Absent";
  checkedIn: string;
  distance: string;
  accuracy: string;
};

function hasAttendanceRoster(session: any, data: any) {
  return (data.groups || []).some(
    (section: any) => section.id === session.class_section_id,
  );
}

function attendanceRows(session: any, data: any): AttendanceExportRow[] {
  const memberIds = new Set(
    (data.members || [])
      .filter((member: any) => member.group_id === session.class_section_id)
      .map((member: any) => member.user_id),
  );
  const students = (data.students || []).filter((student: any) =>
    memberIds.has(student.id),
  );
  const studentsById = new Map(students.map((student: any) => [student.id, student]));
  const recordedIds = new Set((session.records || []).map((record: any) => record.user_id));
  const participants = [
    ...students,
    ...(session.records || [])
      .filter((record: any) => !studentsById.has(record.user_id))
      .map((record: any) => ({
        id: record.user_id,
        name: record.student_name,
        email: record.student_email,
        roll_number: record.student_roll_number,
      })),
  ];
  return participants.map((student: any) => {
    const record = (session.records || []).find(
      (entry: any) => entry.user_id === student.id,
    );
    return {
      subject: session.subject_name || "Unassigned subject",
      classSection: session.class_section_name || "All students",
      session: session.title,
      sessionDate: new Date(session.starts_at).toLocaleString(),
      student: student.name || "Removed student",
      rollNumber: student.roll_number || "",
      email: student.email || "",
      status: recordedIds.has(student.id) ? "Present" : "Absent",
      checkedIn: record ? new Date(record.checked_at).toLocaleString() : "",
      distance: record ? `${Math.round(record.distance_m)} m` : "",
      accuracy: record ? `${Math.round(record.accuracy_m)} m` : "",
    };
  });
}

function downloadAttendanceExcel(rows: AttendanceExportRow[], label: string) {
  const xmlEscape = (value: unknown) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  const headers = [
    "Subject",
    "Student group",
    "Session",
    "Session date",
    "Student",
    "Roll number",
    "Email",
    "Status",
    "Checked in",
    "Distance",
    "GPS accuracy",
  ];
  const values = rows.map((row) => [
    row.subject,
    row.classSection,
    row.session,
    row.sessionDate,
    row.student,
    row.rollNumber,
    row.email,
    row.status,
    row.checkedIn,
    row.distance,
    row.accuracy,
  ]);
  const makeRow = (cells: unknown[], header = false) =>
    `<Row>${cells
      .map(
        (cell) =>
          `<Cell${header ? ' ss:StyleID="Header"' : ""}><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`,
      )
      .join("")}</Row>`;
  const present = rows.filter((row) => row.status === "Present").length;
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#EAF0DE" ss:Pattern="Solid"/></Style></Styles>
  <Worksheet ss:Name="Summary"><Table>
    ${makeRow(["Attendance analysis"], true)}
    ${makeRow(["Selection", label])}
    ${makeRow(["Students marked present", present])}
    ${makeRow(["Attendance rows", rows.length])}
    ${makeRow(["Generated", new Date().toLocaleString()])}
  </Table></Worksheet>
  <Worksheet ss:Name="Attendance"><Table>
    ${makeRow(headers, true)}
    ${values.map((row) => makeRow(row)).join("\n")}
  </Table></Worksheet>
</Workbook>`;
  const blob = new Blob(["\ufeff", workbook], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Attendance-${label.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "report"}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function AttendanceAnalysis({ data, refresh }: any) {
  const archivedSessions = (data.attendance || []).filter(
    (session: any) =>
      session.status === "closed" || Date.now() > Number(session.ends_at),
  );
  const subjectOptions = Array.from(
    new Map(
      archivedSessions.map((session: any) => [
        session.subject_id || "unassigned",
        {
          id: session.subject_id || "unassigned",
          name: session.subject_name || "Unassigned subject",
        },
      ]),
    ).values(),
  ) as Array<{ id: string; name: string }>;
  const [subjectId, setSubjectId] = useState("");
  const activeSubjectId = subjectOptions.some((subject) => subject.id === subjectId)
    ? subjectId
    : subjectOptions[0]?.id || "";
  const sectionOptions = Array.from(
    new Map(
      archivedSessions
        .filter(
          (session: any) =>
            (session.subject_id || "unassigned") === activeSubjectId,
        )
        .map((session: any) => [
          session.class_section_id || "unassigned",
          {
            id: session.class_section_id || "unassigned",
            name: session.class_section_name || "All students",
          },
        ]),
    ).values(),
  ) as Array<{ id: string; name: string }>;
  const [sectionId, setSectionId] = useState("");
  const activeSectionId = sectionOptions.some((section) => section.id === sectionId)
    ? sectionId
    : sectionOptions[0]?.id || "";
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("month");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const toast = useToast();
  const periodDays = period === "week" ? 7 : period === "month" ? 30 : 90;
  const cutoff = Date.now() - periodDays * 86400000;
  const sessions = archivedSessions
    .filter(
      (session: any) =>
        (session.subject_id || "unassigned") === activeSubjectId &&
        (session.class_section_id || "unassigned") === activeSectionId &&
        Number(session.starts_at) >= cutoff,
    )
    .sort((a: any, b: any) => Number(b.starts_at) - Number(a.starts_at));
  const rows: AttendanceExportRow[] = sessions.flatMap((session: any) =>
    attendanceRows(session, data),
  );
  const present = rows.filter((row) => row.status === "Present").length;
  const ratedRows: AttendanceExportRow[] = sessions
    .filter((session: any) => hasAttendanceRoster(session, data))
    .flatMap((session: any) => attendanceRows(session, data));
  const ratedPresent = ratedRows.filter((row) => row.status === "Present").length;
  const periodLabel =
    period === "week" ? "Weekly" : period === "month" ? "Monthly" : "Quarterly";
  const subjectName =
    subjectOptions.find((subject) => subject.id === activeSubjectId)?.name || "Attendance";
  const sectionName =
    sectionOptions.find((section) => section.id === activeSectionId)?.name || "All students";
  return (
    <>
      <Heading
        eyebrow="ATTENDANCE ANALYSIS"
        title="Attendance records, clearly organised."
        description="Review closed sessions by subject, student group, and reporting period."
      >
        <div className="attendance-analysis-actions">
          <button
            className={`icon-button ${periodOpen ? "active" : ""}`}
            type="button"
            aria-label="Choose attendance reporting period"
            aria-expanded={periodOpen}
            title="Reporting period"
            onClick={() => setPeriodOpen((open) => !open)}
          >
            <ArrowUpDown size={18} />
          </button>
          {periodOpen && (
            <label className="attendance-period-picker">
              <span>Period</span>
              <select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}>
                <option value="week">Weekly · last 7 days</option>
                <option value="month">Monthly · last 30 days</option>
                <option value="quarter">Quarterly · last 90 days</option>
              </select>
            </label>
          )}
          <Button
            variant="secondary"
            disabled={!sessions.length}
            onClick={() => {
              downloadAttendanceExcel(rows, `${subjectName}-${sectionName}-${periodLabel}`);
              toast("Attendance Excel report downloaded.");
            }}
          >
            <Download size={16} /> Download Excel
          </Button>
        </div>
      </Heading>
      {!archivedSessions.length ? (
        <Empty
          title="No closed attendance sessions yet"
          description="When an attendance session closes, it will appear here automatically."
        />
      ) : (
        <>
          <div className="attendance-analysis-tabs" role="tablist" aria-label="Subjects">
            {subjectOptions.map((subject) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeSubjectId === subject.id}
                className={activeSubjectId === subject.id ? "active" : ""}
                key={subject.id}
                onClick={() => {
                  setSubjectId(subject.id);
                  setSectionId("");
                }}
              >
                <BookOpen size={16} /> {subject.name}
              </button>
            ))}
          </div>
          <div className="attendance-section-tabs" role="tablist" aria-label="Student groups">
            <span>Student group</span>
            {sectionOptions.map((section) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeSectionId === section.id}
                className={activeSectionId === section.id ? "active" : ""}
                key={section.id}
                onClick={() => setSectionId(section.id)}
              >
                <Users size={15} /> {section.name}
              </button>
            ))}
          </div>
          <div className="assignment-summary grid three attendance-analysis-summary">
            <Stat icon={ClipboardList} label={`${periodLabel} sessions`} value={sessions.length} />
            <Stat icon={CheckCheck} label="Present records" value={present} />
            <Stat
              icon={BarChart3}
              label="Attendance rate"
              value={ratedRows.length ? `${Math.round((ratedPresent / ratedRows.length) * 100)}%` : "—"}
            />
          </div>
          <section className="panel attendance-analysis-table">
            <div className="attendance-report-heading">
              <div>
                <b>{subjectName} · {sectionName}</b>
                <p>{periodLabel} view · newest session first</p>
              </div>
            </div>
            {sessions.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Date</th><th>Session</th><th>Present</th><th>Class size</th><th>Rate</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {sessions.map((session: any) => {
                      const sessionRows = attendanceRows(session, data);
                      const sessionPresent = sessionRows.filter((row) => row.status === "Present").length;
                      const hasRoster = hasAttendanceRoster(session, data);
                      return (
                        <tr key={session.id}>
                          <td>{new Date(session.starts_at).toLocaleString()}</td>
                          <td><b>{session.title}</b><small>{session.location_name}</small></td>
                          <td>{sessionPresent}</td>
                          <td>{hasRoster ? sessionRows.length : "—"}</td>
                          <td>{hasRoster && sessionRows.length ? `${Math.round((sessionPresent / sessionRows.length) * 100)}%` : "—"}</td>
                          <td>
                            <div className="table-actions">
                              <Button variant="secondary small" onClick={() => setSelected(session)}><Eye size={14} /> Preview</Button>
                              {session.status === "closed" && Date.now() <= Number(session.ends_at) && (
                                <Button
                                  variant="ghost small"
                                  onClick={async () => {
                                    try {
                                      await patch(`/admin/attendance/${session.id}`, { status: "open" });
                                      await refresh();
                                      toast("Attendance session reopened.");
                                    } catch (error: any) {
                                      toast(error.message, "error");
                                    }
                                  }}
                                >Reopen</Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title={`No ${periodLabel.toLowerCase()} sessions`} description="Choose another reporting period to see older attendance sessions." />
            )}
          </section>
        </>
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)} wide>
          <div className="attendance-report-heading">
            <div>
              <b>{selected.subject_name || "Unassigned subject"} · {selected.class_section_name || "All students"}</b>
              <p>{new Date(selected.starts_at).toLocaleString()} · {selected.location_name}</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Roll number</th><th>Status</th><th>Checked in</th><th>Distance</th><th>GPS accuracy</th></tr></thead>
              <tbody>
                {attendanceRows(selected, data).map((row) => (
                  <tr key={`${selected.id}-${row.email || row.student}`}>
                    <td><b>{row.student}</b><small>{row.email}</small></td>
                    <td>{row.rollNumber || "—"}</td>
                    <td><span className={`status ${row.status === "Present" ? "published" : "draft"}`}>{row.status}</span></td>
                    <td>{row.checkedIn || "—"}</td>
                    <td>{row.distance || "—"}</td>
                    <td>{row.accuracy || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!attendanceRows(selected, data).length && <Empty title="No students in this group" description="Add students to this student group to calculate attendance." />}
        </Modal>
      )}
    </>
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
