import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Mail,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { Logo, Field, Button, useAuth, useToast, post, useData } from "../lib";
import { postSignInPath } from "../session";
export default function Auth() {
  const { mode } = useParams();
  const isAdmin = mode === "admin",
    signup = mode === "signup",
    forgot = mode === "forgot";
  const { setUser, refresh } = useAuth();
  const { data: setup } = useData<any>("/auth/setup");
  const { data: options } = useData<any>("/auth/options");
  const navigate = useNavigate(),
    location = useLocation(),
    toast = useToast();
  const [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [show, setShow] = useState(false),
    [challenge, setChallenge] = useState(""),
    [code, setCode] = useState(""),
    [demoCode, setDemoCode] = useState(""),
    [cooldown, setCooldown] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setChallenge("");
    setCode("");
    setPassword("");
    setConfirmPassword("");
    const reason = new URLSearchParams(window.location.search).get("authError");
    setError(
      reason === "linkGoogle"
        ? "Sign in with your teacher password, then connect Google from your profile."
        : reason === "signup"
          ? "Create your student account with Google to get started."
          : reason
            ? "Google sign-in could not be completed. Please try again."
            : "",
    );
  }, [mode]);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  async function send() {
    setBusy(true);
    setError("");
    try {
      const r = await post(
        forgot ? "/auth/password/forgot" : "/auth/otp/send",
        {
          ...(forgot
            ? { email: identifier }
            : { identifier, purpose: signup ? "signup" : "login" }),
        },
      );
      setChallenge(r.challenge);
      setDemoCode(r.demoCode || "");
      setCooldown(60);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if ((!isAdmin || forgot) && !challenge) return send();
    setBusy(true);
    setError("");
    try {
      if (forgot) {
        if (password !== confirmPassword)
          throw new Error("The new passwords do not match.");
        await post("/auth/password/reset", { challenge, code, password });
        toast("Your password has been reset. You can sign in now.");
        navigate("/auth/admin");
        return;
      }
      const r = isAdmin
        ? await post("/auth/admin", { email: identifier, password })
        : await post("/auth/otp/verify", { challenge, code });
      setUser(r.user);
      await refresh();
      toast(
        `Welcome${r.user.onboarding ? " back" : ""}, ${r.user.name.split(" ")[0]}!`,
      );
      navigate(postSignInPath(r.user, location.state?.from), { replace: true });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <Logo light />
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h1>
            A little curiosity.
            <br />A world of
            <br />
            <em>possibility.</em>
          </h1>
          <p>Give your ideas a place to grow.</p>
          <div className="auth-orbit">
            <span>✦</span>
            <i />
            <i />
            <i />
          </div>
        </div>
        <small>THOUGHTFULLY MADE FOR THE WAY YOU GROW.</small>
      </aside>
      <main className="auth-main">
        <Link to="/" className="back-link">
          <ArrowLeft size={16} /> Back to English Tech
        </Link>
        <div className="auth-form">
          <span className="auth-icon">
            {isAdmin || forgot ? (
              <ShieldCheck />
            ) : challenge ? (
              <Mail />
            ) : (
              <span>✦</span>
            )}
          </span>
          <span className="eyebrow">
            {forgot
              ? "ACCOUNT RECOVERY"
              : isAdmin
                ? "TEACHER WORKSPACE"
                : challenge
                  ? "A QUICK HELLO"
                  : "MAKE ROOM FOR POSSIBILITY"}
          </span>
          <h1>
            {forgot
              ? challenge
                ? "Choose a new password."
                : "Reset your teacher password."
              : isAdmin
                ? "Welcome back, teacher."
                : challenge
                  ? "Check your inbox."
                  : signup
                    ? "Your next chapter starts here."
                    : "Good to see you again."}
          </h1>
          <p>
            {forgot
              ? challenge
                ? "Enter the verification code and create a secure new password."
                : "We’ll send a verification code to your teacher email address."
              : isAdmin
                ? "Sign in to guide your students toward their next lightbulb moment."
                : challenge
                  ? `We sent a verification code to ${identifier}. It’s valid for five minutes.`
                  : signup
                    ? "A few details, a fresh start. Let’s make this space yours."
                    : "Pick up where your curiosity left off."}
          </p>
          {!challenge && !forgot && (
            <div className="google-signin">
              <Button
                className="full"
                variant="secondary"
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const r = await post("/auth/google/start", {
                      action: signup ? "signup" : "login",
                      returnTo: location.state?.from,
                    });
                    window.location.assign(r.url);
                  } catch (e: any) {
                    setError(e.message);
                    setBusy(false);
                  }
                }}
              >
                Continue with Google
              </Button>
              {options && !options.google && (
                <small>Google sign-in is awaiting provider setup.</small>
              )}
              <p>
                or continue with{" "}
                {isAdmin ? "your password" : "a verification code"}
              </p>
            </div>
          )}
          <form onSubmit={submit}>
            {!challenge ? (
              <>
                <Field
                  label={
                    isAdmin || forgot || (options?.emailOtp && !options?.sms)
                      ? "Email address"
                      : "Email address or mobile number"
                  }
                  hint={
                    isAdmin || forgot || (options?.emailOtp && !options?.sms)
                      ? undefined
                      : "For mobile, include the country code (for example +91)."
                  }
                >
                  <input
                    autoComplete={isAdmin || forgot ? "username" : "email"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com"
                    required
                    type={isAdmin || forgot ? "email" : "text"}
                    autoFocus
                  />
                </Field>
                {isAdmin && (
                  <>
                    <Field label="Password">
                      <div className="password-input">
                        <input
                          type={show ? "text" : "password"}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
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
                    <div className="auth-resend">
                      <Link to="/auth/forgot">Forgot password?</Link>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <Field label="Verification code">
                  <input
                    className="otp-input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6,8}"
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="00000000"
                    required
                    autoFocus
                  />
                </Field>
                {forgot && (
                  <>
                    <Field
                      label="New password"
                      hint="Use at least 12 characters."
                    >
                      <input
                        type={show ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={12}
                        maxLength={200}
                        required
                      />
                    </Field>
                    <Field label="Confirm new password">
                      <input
                        type={show ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={12}
                        maxLength={200}
                        required
                      />
                    </Field>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setShow(!show)}
                    >
                      {show ? "Hide passwords" : "Show passwords"}
                    </button>
                  </>
                )}
                {demoCode && (
                  <div className="demo-notice">
                    <b>Local development code: {demoCode}</b>
                    <span>
                      Shown only while local verification mode is enabled.
                    </span>
                  </div>
                )}
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button className="full" busy={busy} type="submit">
              {forgot
                ? challenge
                  ? "Reset password"
                  : "Send reset code"
                : isAdmin
                  ? "Enter your workspace"
                  : challenge
                    ? "Verify & continue"
                    : "Send verification code"}
              <ArrowRight size={18} />
            </Button>
          </form>
          {challenge ? (
            <div className="auth-resend">
              <button disabled={cooldown > 0 || busy} onClick={send}>
                {cooldown ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
              <button onClick={() => setChallenge("")}>
                Use a different address
              </button>
            </div>
          ) : (
            <div className="auth-switch">
              {forgot ? (
                <Link to="/auth/admin">Back to teacher sign in</Link>
              ) : isAdmin ? (
                <Link to="/auth/login">Looking for student sign in?</Link>
              ) : signup ? (
                <>
                  Already have a space here?{" "}
                  <Link to="/auth/login">Sign in</Link>
                </>
              ) : (
                <>
                  New to English Tech?{" "}
                  <Link to="/auth/signup">Start your journey</Link>
                </>
              )}
            </div>
          )}
          <div className="auth-security">
            <ShieldCheck size={16} />
            <span>Your learning space, securely yours.</span>
          </div>
          {isAdmin && setup && !setup.complete && (
            <div className="demo-notice">
              <b>New teaching workspace?</b>
              <span>Create the first teacher account to get started.</span>
              <Link className="button full" to="/auth/setup">
                Set up my teacher account <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
        <div className="auth-bottom">
          <span>Small steps. Real growth.</span>
          <span>© English Tech</span>
        </div>
      </main>
    </div>
  );
}
