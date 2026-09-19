import { useState } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import {
  useData,
  post,
  patch,
  del,
  useToast,
  Button,
  Field,
  Modal,
  Avatar,
  Loading,
  Failure,
  date,
} from "../lib";

export default function Teachers() {
  const { data, loading, error, refresh } = useData<any[]>("/admin/teachers");
  const toast = useToast();
  const [adding, setAdding] = useState(false),
    [selected, setSelected] = useState<any>(null),
    [removing, setRemoving] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  if (loading) return <Loading />;
  if (error) return <Failure error={error} retry={refresh} />;
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.password !== values.confirmPassword) {
      setFormError("Your passwords do not match.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await post("/admin/teachers", values);
      setAdding(false);
      await refresh();
      toast("Teacher added. Share their sign-in details privately.");
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus() {
    setBusy(true);
    setFormError("");
    try {
      await patch(`/admin/teachers/${selected.id}`, {
        status: selected.status === "active" ? "inactive" : "active",
      });
      setSelected(null);
      await refresh();
      toast("Teacher access updated.");
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function removeTeacher() {
    setBusy(true);
    setFormError("");
    try {
      await del(`/admin/teachers/${removing.id}`);
      setRemoving(null);
      await refresh();
      toast("Teacher removed. Their learning materials remain available.");
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            GREAT LEARNING STARTS WITH GREAT TEACHERS
          </span>
          <h1>Your teaching team.</h1>
          <p>Add trusted teachers and manage their access to your workspace.</p>
        </div>
        <Button
          onClick={() => {
            setFormError("");
            setAdding(true);
          }}
        >
          <Plus size={18} />
          Add teacher
        </Button>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="teacher-identity">
                      <Avatar user={t} />
                      <div>
                        <b>{t.name}</b>
                        <p>{t.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>{t.is_owner ? "Owner" : "Teacher"}</td>
                  <td>{t.status === "active" ? "Active" : "Inactive"}</td>
                  <td>{date(t.created_at)}</td>
                  <td>
                    {t.is_owner ? (
                      <span className="muted">Protected owner account</span>
                    ) : (
                      <div className="table-actions">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setFormError("");
                            setSelected(t);
                          }}
                        >
                          {t.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                        <button
                          type="button"
                          className="icon-button danger-text"
                          aria-label={`Remove ${t.name}`}
                          onClick={() => {
                            setFormError("");
                            setRemoving(t);
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="teacher-help">
        <ShieldCheck size={17} />
        Teachers can manage students, lessons, assignments, and platform
        settings. Only you can manage the teaching team.
      </p>
      {adding && (
        <Modal title="Add a teacher" onClose={() => !busy && setAdding(false)}>
          <form onSubmit={create} className="teacher-form">
            <p>
              Give a trusted teacher their own sign-in. They can change their
              password in Settings after signing in.
            </p>
            <Field label="Full name">
              <input
                name="name"
                minLength={2}
                maxLength={200}
                autoComplete="off"
                required
              />
            </Field>
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="off"
                maxLength={200}
                required
              />
            </Field>
            <Field
              label="Initial password"
              hint="At least 12 characters. Share this privately with the teacher."
            >
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={200}
                required
              />
            </Field>
            <Field label="Confirm password">
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={200}
                required
              />
            </Field>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <Button type="submit" busy={busy}>
              Create teacher account
            </Button>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal
          title={`${selected.status === "active" ? "Deactivate" : "Activate"} ${selected.name}?`}
          onClose={() => !busy && setSelected(null)}
        >
          <div className="teacher-form">
            <p>
              {selected.status === "active"
                ? "This teacher will be signed out and lose access. Their lessons will stay available. You can reactivate them later."
                : "This teacher will be able to sign in again using their existing password."}
            </p>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <Button onClick={changeStatus} busy={busy}>
              Confirm{" "}
              {selected.status === "active" ? "deactivation" : "activation"}
            </Button>
          </div>
        </Modal>
      )}
      {removing && (
        <Modal
          title={`Remove ${removing.name}?`}
          onClose={() => !busy && setRemoving(null)}
          canClose={!busy}
        >
          <div className="teacher-form">
            <p>
              This permanently removes this teacher’s account and signs them
              out. Their uploaded files and assignments will stay available
              and transfer to the owner account.
            </p>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => setRemoving(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={removeTeacher} busy={busy}>
                Remove teacher
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
