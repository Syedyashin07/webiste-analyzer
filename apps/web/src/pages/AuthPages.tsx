import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { saveAuth } from "../lib/auth";

function Landscape({ seam }: { seam: "left" | "right" }) {
  return (
    <svg viewBox="0 0 640 800" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C4621A" />
          <stop offset="42%" stopColor="#8C3A0F" />
          <stop offset="100%" stopColor="#1C1916" />
        </linearGradient>
        <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#F7F1E6" />
          <stop offset="28%" stopColor="#F7F1E6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#F7F1E6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="640" height="800" fill="url(#sky)" />
      <path d="M180 260 L340 120 L470 230 L640 90 L640 520 L120 520 Z" fill="#A8683A" opacity="0.85" />
      <path d="M260 340 L430 160 L560 300 L640 220 L640 620 L200 620 Z" fill="#5C3A28" />
      <path d="M0 520 C120 470 220 560 340 500 C460 440 520 530 640 470 L640 800 L0 800 Z" fill="#3A2A22" />
      <path d="M390 430 L430 250 L470 430 Z" fill="#1C1916" />
      <path d="M450 460 L500 240 L548 460 Z" fill="#161310" />
      <path d="M500 480 L560 300 L620 490 Z" fill="#2A2420" />
      <path d="M520 210 C540 150 575 140 590 200 C610 150 640 170 640 230 L640 360 L500 360 Z" fill="#241C18" />
      <rect width="640" height="800" fill="url(#fade)" transform={seam === "right" ? "translate(640 0) scale(-1 1)" : undefined} />
    </svg>
  );
}

function Icon({ name }: { name: "user" | "mail" | "eye" | "eyeOff" }) {
  const common = { viewBox: "0 0 24 24", className: "h-4 w-4", fill: "none", stroke: "currentColor", strokeWidth: 1.8 };
  if (name === "user") {
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="8" r="3" />
        <path d="M6 19c1.2-3 3.2-4.5 6-4.5S16.8 16 18 19" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "mail") {
    return (
      <svg {...common} aria-hidden>
        <rect x="4" y="6" width="16" height="12" rx="2" />
        <path d="M5 8l7 6 7-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "eyeOff") {
    return (
      <svg {...common} aria-hidden>
        <path d="M4 5l16 16" strokeLinecap="round" />
        <path d="M9.5 9.8A4 4 0 0012 16a4 4 0 003.2-1.6M6 8.5C4.2 10 3 12 3 12s3.5 6 9 6c1.4 0 2.6-.3 3.7-.8M10 6.3A9 9 0 0112 6c5.5 0 9 6 9 6s-.7 1.2-2 2.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function TextField({
  label,
  type = "text",
  value,
  onChange,
  icon,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  icon: "user" | "mail";
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <span className="flex items-center gap-3 rounded-full border border-slate-300 bg-[#FFFBF5] px-5 py-3 text-slate-900 focus-within:border-brand-700 focus-within:ring-2 focus-within:ring-brand-700">
        <input
          required
          type={type}
          value={value}
          autoComplete={autoComplete}
          placeholder={label}
          onChange={(event) => onChange(event.target.value)}
          className="auth-field w-full bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          style={{ backgroundColor: "transparent" }}
        />
        <span className="text-slate-500">
          <Icon name={icon} />
        </span>
      </span>
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <span className="flex items-center gap-3 rounded-full border border-slate-300 bg-[#FFFBF5] px-5 py-3 text-slate-900 focus-within:border-brand-700 focus-within:ring-2 focus-within:ring-brand-700">
        <input
          required
          minLength={minLength}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          placeholder={label}
          onChange={(event) => onChange(event.target.value)}
          className="auth-field w-full bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          style={{ backgroundColor: "transparent" }}
        />
        <button
          type="button"
          className="auth-field text-slate-500 hover:text-slate-900"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name={visible ? "eyeOff" : "eye"} />
        </button>
      </span>
    </label>
  );
}

function AuthShell({
  side,
  kicker,
  title,
  switchText,
  switchLink,
  switchHref,
  children,
}: {
  side: "login" | "register";
  kicker: string;
  title: string;
  switchText: string;
  switchLink: string;
  switchHref: string;
  children: ReactNode;
}) {
  const formOnRight = side === "register";
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900 sm:p-8">
      <div
        className={`relative grid min-h-[680px] w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-2xl ${
          formOnRight ? "lg:grid-cols-[0.95fr_1.05fr]" : "lg:grid-cols-[1.05fr_0.95fr]"
        }`}
      >
        <div className={`relative z-10 flex flex-col bg-slate-50 px-6 py-7 sm:px-10 sm:py-8 ${formOnRight ? "auth-from-right lg:order-2" : "auth-from-left"}`}>
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-0 border-slate-900 ${
              formOnRight ? "rounded-r-[28px] border-b-[3px] border-r-[3px]" : "rounded-l-[28px] border-b-[3px] border-l-[3px]"
            }`}
          />
          <header className="flex items-center gap-8">
            <nav className="flex items-center gap-6 text-sm text-slate-600">
              <Link to="/" className="hover:text-slate-900">
                Home
              </Link>
              <Link to="/register" className={side === "register" ? "font-medium text-brand-800" : "hover:text-slate-900"}>
                Join
              </Link>
            </nav>
          </header>
          <div className="flex flex-1 flex-col justify-center py-10">
            <div className="w-full max-w-md">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-800">{kicker}</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                {title}
                <span className="text-brand-700">.</span>
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                {switchText}{" "}
                <Link className="font-medium text-brand-800 underline" to={switchHref}>
                  {switchLink}
                </Link>
              </p>
              {children}
            </div>
          </div>
        </div>
        <div className={`relative hidden min-h-full lg:block ${formOnRight ? "auth-from-left lg:order-1" : "auth-from-right"}`}>
          <Landscape seam={formOnRight ? "right" : "left"} />
          <svg
            viewBox="0 0 100 800"
            preserveAspectRatio="none"
            className={`pointer-events-none absolute inset-y-0 h-full w-24 ${formOnRight ? "right-0 -scale-x-100" : "left-0"}`}
            aria-hidden
          >
            <path d="M70 0 C 20 140, 90 260, 30 420 C 0 520, 80 640, 40 800" fill="none" stroke="rgba(28,25,22,0.35)" strokeWidth="1.2" strokeDasharray="1 7" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      </div>
    </div>
  );
}

const submitClass = "rounded-full bg-brand-700 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const registered = Boolean((location.state as { registered?: boolean } | null)?.registered);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await api.login({ email, password });
      saveAuth(result.token, result.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell side="login" kicker="Welcome back" title="Log in" switchText="No account yet?" switchLink="Register" switchHref="/register">
      <form onSubmit={submit} className="mt-8 space-y-3">
        {registered ? <p className="text-sm text-slate-700">Account created. Log in to open the dashboard.</p> : null}
        <TextField label="Email" type="email" value={email} onChange={setEmail} icon="mail" autoComplete="email" />
        <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" disabled={pending} className={`mt-3 ${submitClass}`}>
          {pending ? "Signing in…" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!agreed) {
      setError("Check the box to create your account");
      return;
    }
    setPending(true);
    setError("");
    try {
      await api.register({ name, email, password });
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Register failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell side="register" kicker="Start for free" title="Create new account" switchText="Already a member?" switchLink="Log in" switchHref="/login">
      <form onSubmit={submit} className="mt-8 space-y-3">
        <TextField label="Name" value={name} onChange={setName} icon="user" autoComplete="name" />
        <TextField label="Email" type="email" value={email} onChange={setEmail} icon="mail" autoComplete="email" />
        <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
        <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={8} />
        <label className="flex items-center gap-3 pt-1 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="h-4 w-4 accent-[#BF5700]"
          />
          I agree to create this account
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" disabled={pending} className={`mt-3 ${submitClass}`}>
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
