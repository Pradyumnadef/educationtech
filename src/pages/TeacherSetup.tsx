import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import {
  Logo,
  Field,
  Button,
  useAuth,
  useData,
  useToast,
  post,
  Loading,
  Failure,
} from "../lib";

export default function TeacherSetup() {
  const {
    data,
    loading,
    error: loadError,
    refresh: reload,
  } = useData<any>("/auth/setup");
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  if (loading) return <Loading />;
  if (loadError) return <Failure error={loadError} retry={reload} />;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.password !== values.confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post("/auth/setup", values);
      await refresh();
      toast("Your teacher account is ready. Welcome to English Tech!");
      navigate("/admin", { replace: true });
    } catch (e: any) {
      setError(e.message);
      if (e.status === 409) reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <Logo light />
        <div>
          <span className="eyebrow">YOUR SCHOOL STARTS HERE</span>
          <h1>
            A fresh start.
            <br />A world of
            <br />
            <em>possibility.</em>
          </h1>
          <p>Your lessons. Your students. Your teaching space.</p>
        </div>
        <small>THOUGHTFULLY MADE FOR THE WAY YOU TEACH.</small>
      </aside>
      <main className="auth-main">
        <Link to="/" className="back-link">
          Back to English Tech
        </Link>
        <div className="auth-form">
          <span className="auth-icon">
            <ShieldCheck />
          </span>
          <span className="eyebrow">FIRST TEACHER SETUP</span>
          <h1>
            {data.complete
              ? "Your workspace is set up."
              : "Make this space yours."}
          </h1>
          <p>
            {data.complete
              ? "The first teacher account has already been created. Additional teachers are added by the account owner."
              : "Create your owner account. You can then add teachers, build subjects, and welcome students."}
          </p>
          {data.complete ? (
            <Link className="button full" to="/auth/admin">
              Go to teacher sign in <ArrowRight size={18} />
            </Link>
          ) : !data.available ? (
            <div className="demo-notice">
              <b>Owner setup is not enabled on this server.</b>
              <span>
                Configure a private TEACHER_SETUP_KEY in the server environment,
                then reopen this page.
              </span>
            </div>
          ) : (
            <form onSubmit={submit}>
              <Field label="Full name">
                <input
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={200}
                  required
                  autoFocus
                />
              </Field>
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  maxLength={200}
                  required
                />
              </Field>
              <Field
                label="Password"
                hint="Use at least 12 characters. Save this password somewhere secure."
              >
                <div className="password-input">
                  <input
                    aria-label="Password"
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={200}
                    required
                  />
                  <button
                    type="button"
                    aria-label={show ? "Hide password" : "Show password"}
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
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
              {data.requiresKey && (
                <Field
                  label="Owner setup key"
                  hint="Use the private key configured by the person managing this deployment."
                >
                  <input
                    name="setupKey"
                    type="password"
                    autoComplete="off"
                    required
                  />
                </Field>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" busy={busy} className="full">
                Create my teacher account <ArrowRight size={18} />
              </Button>
            </form>
          )}
          <p className="auth-security">
            <ShieldCheck size={16} />
            First-time registration closes after the owner account is created.
          </p>
        </div>
        <div className="auth-bottom">
          <span>Your next chapter starts here.</span>
          <span>© English Tech</span>
        </div>
      </main>
    </div>
  );
}
