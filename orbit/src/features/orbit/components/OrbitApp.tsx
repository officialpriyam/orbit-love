"use client";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  User,
  Profile,
  Round,
  RoundStatus,
  Question,
  Answers,
  Dashboard,
  AdminDashboard,
  Dialog,
  Gender,
} from "../types";
import Landing from "./Landing";
import ThemeToggle from "./ThemeToggle";
import { defaultLocationSettings } from "../location-settings";
import { Button, Field, Select } from "./FormControls";

const genders: Gender[] = ["Woman", "Man", "Non-binary", "Self-described"];
const orientations = [
  "Straight",
  "Gay",
  "Lesbian",
  "Bisexual",
  "Pansexual",
  "Asexual",
  "Queer",
  "Questioning",
  "Self-described",
  "Prefer not to say",
];
const group = (i: number) =>
  i < 8
    ? "Your personality"
    : i < 16
      ? "Your everyday world"
      : i < 24
        ? "The things you love"
        : i < 32
          ? "Your kind of connection"
          : "Real-life chemistry";
const initialProfile: Profile = {
  country: "",
  outside_country: false,
  openrouter_consent: false,
  age: "",
  city: "",
  occupation: "",
  gender: "",
  orientation: "",
  intention: "",
  seeking: [],
  min_age: 18,
  max_age: 35,
  any_city: false,
  bio: "",
};
const sampleMatches = [
  {
    name: "Sam",
    age: 25,
    city: "Bengaluru",
    occupation: "Product designer",
    score: 84,
    shared: ["Slow Sundays", "Good conversations"],
    explanation:
      "You both make room for meaningful conversations and enjoy a thoughtful, unhurried pace.",
    icebreaker: "What is one small thing that always makes your Sunday better?",
  },
  {
    name: "River",
    age: 24,
    city: "Bengaluru",
    occupation: "Creative technologist",
    score: 79,
    shared: ["Shared playlists", "Curious minds"],
    explanation:
      "A shared curiosity and playful sense of humor give you a natural place to start.",
    icebreaker: "Which song would make the opening credits of your life?",
  },
];
const dateInput = (t: number) => {
  const d = new Date(t * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/" + path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r
    .json()
    .catch(() => ({ detail: "The service could not be reached." }));
  if (!r.ok) throw Error(data.detail || "Please try again.");
  return data;
}
export default function OrbitApp({ preview = false }) {
  const [route, setRoute] = useState("home"),
    [ready, setReady] = useState(false),
    [user, setUser] = useState<User | null>(null),
    [questions, setQuestions] = useState<Question[]>([]),
    [profile, setProfile] = useState(initialProfile),
    [answers, setAnswers] = useState<Answers>({}),
    [question, setQuestion] = useState(0),
    [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [admin, setAdmin] = useState<AdminDashboard | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState<Dialog | null>(null),
    [submitConsent, setSubmitConsent] = useState(false);
  const [round, setRound] = useState<Round>({
      id: "preview-round",
      title: "The first orbit",
      status: "open",
      closes_at: 0,
    }),
    [submitted, setSubmitted] = useState(false);
  const deletePasswordRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null),
    busyRef = useRef(false),
    priorFocus = useRef<HTMLElement | null>(null);
  const go = (r: string) => {
    if (window.location.hash === "#" + r) setRoute(r);
    else window.location.hash = r;
  };
  const notify = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(""), 5000);
  };
  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setError(message);
      notify(message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const persist = (patch = {}) => {
    if (preview)
      sessionStorage.setItem(
        "orbit-preview",
        JSON.stringify({ user, profile, answers, submitted, round, ...patch }),
      );
  };
  async function load() {
    if (preview) {
      setDashboard({
        round,
        has_profile: !!profile.age,
        answered: Object.keys(answers).length,
        submitted,
        matches: round.status === "published" ? sampleMatches : [],
      });
      return;
    }
    const d = await api("dashboard");
    setDashboard(d);
    setProfile({ ...initialProfile, ...d.profile });
    setAnswers(d.answers);
    setSubmitted(d.submitted);
  }
  async function loadAdmin() {
    if (preview) {
      setAdmin({
        round,
        participants: 24,
        submitted: 21,
        emails_pending: 0,
        events: [
          {
            action: "Preview round created. No real participant data.",
            created_at: Date.now() / 1000,
          },
        ],
      });
      return;
    }
    setAdmin(await api("admin"));
  }
  useEffect(() => {
    const routeChange = () => {
      setRoute(window.location.hash.slice(1) || "home");
      setError("");
      window.scrollTo(0, 0);
    };
    routeChange();
    window.addEventListener("hashchange", routeChange);
    (async () => {
      try {
        const q = await fetch("/questions.json").then((r) => r.json());
        setQuestions(q);
        if (preview) {
          const saved = JSON.parse(
            sessionStorage.getItem("orbit-preview") || "null",
          );
          setRound(
            saved?.round || {
              id: "preview-round",
              title: "The first orbit",
              status: "open",
              closes_at: Date.now() / 1000 + 3 * 86400,
            },
          );
          if (saved) {
            setUser(saved.user);
            setProfile({ ...initialProfile, ...saved.profile });
            setAnswers(saved.answers || {});
            setSubmitted(!!saved.submitted);
          }
        } else {
          try {
            setUser(await api("me"));
          } catch {}
        }
      } catch {
        setError("The questions could not load. Please reload.");
      } finally {
        setReady(true);
      }
    })();
    return () => window.removeEventListener("hashchange", routeChange);
  }, [preview]);
  useEffect(() => {
    if (!ready) return;
    if (["dashboard", "profile", "survey"].includes(route)) {
      if (!user) {
        go("login");
        return;
      }
      load().catch((e) => setError(e.message));
    }
    if (route === "admin") loadAdmin().catch((e) => setError(e.message));
    if (["how-it-works", "our-approach", "questions"].includes(route))
      setTimeout(
        () =>
          document
            .getElementById(route)
            ?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
  }, [route, ready]);
  useEffect(() => {
    if (!modal) return;
    priorFocus.current = document.activeElement as HTMLElement;
    const element = dialogRef.current;
    if (!element) return;
    element?.querySelector("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const f = [...element.querySelectorAll<HTMLElement>("button,a,input")];
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === f.at(-1)) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      priorFocus.current?.focus();
    };
  }, [modal]);
  async function saveDraft() {
    if (preview) persist();
    else await api("survey", "PUT", { answers });
  }
  const edit = (key: keyof Profile, value: unknown) =>
    setProfile((p) => ({ ...p, [key]: value }) as Profile);
  function privacy() {
    setModal({
      title: "Personal stays personal.",
      paragraphs: [
        "Orbit uses your age, city, selected preferences, and survey answers to find mutual matches. Raw answers, orientation, password, and email never appear in another user’s results.",
        "Matches see your first name, age, city, occupation, shared interests, and a short explanation. Notifications link to your private dashboard.",
        "Matching runs in Orbit’s Python service. If both people opt in, coarse shared themes are sent to OpenRouter and its selected model provider for an AI explanation. Names, contact details, orientation, biographies and raw answers are excluded. Provider retention policies vary. Otherwise explanations use local templates.",
        "Delete your account from your dashboard to remove your profile, answers, sessions, and match records." +
          (preview
            ? " This preview stores fictional progress only in this browser tab."
            : ""),
      ],
    });
  }
  function safety() {
    setModal({
      title: "Good connections need care.",
      paragraphs: [
        "Orbit is for adults 18+. Respect every identity and boundary. Do not harass, pressure, impersonate, or share someone else’s personal information.",
        "For a first meeting, choose a public place, tell someone you trust, and arrange your own transport. You never owe anyone a conversation or a date.",
        "This version offers match discovery and conversation prompts. Direct messaging and contact exchange are not enabled.",
      ],
    });
  }
  async function auth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    await run(async () => {
      const next = preview
        ? {
            id: "preview",
            name: data.name || "Alex",
            email: "alex@example.com",
            is_admin: true,
          }
        : await api(
            route === "login" ? "login" : "register",
            "POST",
            route === "login"
              ? { email: data.email, password: data.password }
              : {
                  name: data.name,
                  email: data.email,
                  password: data.password,
                  consent: data.consent === "on",
                },
          );
      setUser(next);
      persist({ user: next });
      go(route === "login" ? "dashboard" : "profile");
    });
  }
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await run(async () => {
      if (!profile.seeking.length)
        throw Error("Choose at least one gender you would like to meet.");
      if (Number(profile.min_age) > Number(profile.max_age))
        throw Error("Your preferred age range is invalid.");
      const data = {
        ...profile,
        age: Number(profile.age),
        min_age: Number(profile.min_age),
        max_age: Number(profile.max_age),
      };
      if (!preview) await api("profile", "PUT", data);
      setProfile(data);
      persist({ profile: data });
      setQuestion(0);
      go("survey");
    });
  }
  async function adminAction(action: string) {
    await run(async () => {
      if (preview) {
        const statuses: Record<string, RoundStatus> = {
          close: "closed",
          reopen: "open",
          generate: "ready",
          publish: "published",
          "new-round": "open",
        };
        const status = statuses[action];
        const updated = {
          ...round,
          status: status || round.status,
          ...(action === "new-round"
            ? { title: "A new orbit", closes_at: Date.now() / 1000 + 3 * 86400 }
            : {}),
        };
        setRound(updated);
        persist({ round: updated });
        setAdmin((a) => (a ? { ...a, round: updated } : null));
        notify(
          action === "publish"
            ? "Preview revealed. No emails sent."
            : "Preview round updated.",
        );
      } else {
        await api("admin/" + action, "POST", {});
        await loadAdmin();
        notify(
          action === "generate"
            ? "Matching job queued. Your Python service will process it."
            : "Round updated.",
        );
      }
    });
  }
  function confirmAdmin(action: string) {
    setModal({
      title:
        action === "close"
          ? "Close this matching round?"
          : "Reveal this round?",
      paragraphs: [
        action === "close"
          ? "Participants will no longer be able to change their profiles or answers."
          : "Results will become visible and notification emails will be queued for all submitted participants.",
      ],
      action: () => adminAction(action),
      label: action === "close" ? "Close survey" : "Reveal & notify",
    });
  }
  const location = dashboard?.location_settings ?? defaultLocationSettings;
  const open =
    dashboard?.round.status === "open" &&
    (dashboard?.round.closes_at ?? 0) > Date.now() / 1000;
  const landing = [
    "home",
    "how-it-works",
    "our-approach",
    "questions",
  ].includes(route);
  const errorBox = error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
  let content;
  if (landing) content = <Landing />;
  else if (!ready)
    content = <main className="loading">Finding your orbit…</main>;
  else if (route === "login" || route === "register")
    content = (
      <main className="auth-wrap">
        <div className="panel">
          <div className="eyebrow">
            {route === "login" ? "WELCOME BACK" : "YOUR NEXT CHAPTER"}
          </div>
          <h1>
            {route === "login"
              ? "Back in your orbit."
              : "Start with a little hello."}
          </h1>
          <p>
            {preview
              ? "Try a fictional profile. This preview creates no real account."
              : route === "login"
                ? "Your connections are right where you left them."
                : "A few details, then the interesting stuff. Adults 18+ only."}
          </p>
          <form onSubmit={auth}>
            {route === "register" && (
              <Field label="First name">
                <input
                  name="name"
                  autoComplete="given-name"
                  maxLength={60}
                  required
                  defaultValue={preview ? "Alex" : ""}
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={preview ? "alex@example.com" : ""}
              />
            </Field>
            {!preview && (
              <Field label="Password · at least 12 characters">
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete={
                    route === "login" ? "current-password" : "new-password"
                  }
                  required
                />
              </Field>
            )}
            {route === "register" && (
              <label className="check">
                <input name="consent" type="checkbox" required />
                <span>
                  I am 18 or older and agree to use my profile and answers for
                  matching.{" "}
                  <button
                    type="button"
                    className="textbtn inline-link"
                    onClick={privacy}
                  >
                    How my data is used
                  </button>
                </span>
              </label>
            )}
            {errorBox}
            <Button variant="full" disabled={busy}>
              {busy
                ? "One moment…"
                : preview
                  ? "Continue in preview"
                  : route === "login"
                    ? "Log in"
                    : "Create my account"}{" "}
              <span>↗</span>
            </Button>
          </form>
          <p style={{ textAlign: "center", fontSize: 11, margin: "20px 0 0" }}>
            {route === "login" ? (
              <>
                New around here?{" "}
                <a className="inline-link" href="#register">
                  Find your orbit
                </a>
              </>
            ) : (
              <>
                Already part of Orbit?{" "}
                <a className="inline-link" href="#login">
                  Log in
                </a>
              </>
            )}
          </p>
        </div>
      </main>
    );
  else if (route === "profile" && user)
    content = (
      <main className="workspace onboarding">
        <div className="workspace-top">
          <div>
            <div className="eyebrow">FIRST, THE INTRODUCTIONS</div>
            <h1>The person behind the profile.</h1>
            <p className="sub">
              Tell us a little about yourself. You decide who feels right.
            </p>
          </div>
        </div>
        <form className="panel" onSubmit={saveProfile}>
          <fieldset disabled={busy || !open}>
            <div className="fields">
              <Field label="Your age">
                <input
                  type="number"
                  min="18"
                  max="100"
                  value={profile.age}
                  onChange={(e) => edit("age", e.target.value)}
                  required
                />
              </Field>
              {location.country_enabled && (
                <Field label="Your country">
                  <input
                    value={profile.country}
                    onChange={(e) => edit("country", e.target.value)}
                    placeholder="Full country name, e.g. India"
                    maxLength={80}
                    required
                  />
                </Field>
              )}
              {location.city_enabled && (
                <Field label="Your city">
                  <input
                    value={profile.city}
                    onChange={(e) => edit("city", e.target.value)}
                    maxLength={80}
                    placeholder="e.g. Bengaluru"
                    required
                  />
                </Field>
              )}
              <Field label="What keeps you busy?">
                <input
                  value={profile.occupation}
                  onChange={(e) => edit("occupation", e.target.value)}
                  maxLength={100}
                  placeholder="Designer, student, building something…"
                  required
                />
              </Field>
              <Field label="I identify as">
                <Select
                  options={genders}
                  value={profile.gender}
                  onChange={(e) => edit("gender", e.target.value)}
                />
              </Field>
              <Field label="Orientation · optional">
                <Select
                  options={orientations}
                  value={profile.orientation}
                  onChange={(e) => edit("orientation", e.target.value)}
                  required={false}
                />
              </Field>
              <Field label="I'm here for">
                <Select
                  options={["Dating", "Friendship"]}
                  value={profile.intention}
                  onChange={(e) => edit("intention", e.target.value)}
                />
              </Field>
            </div>
            <fieldset>
              <legend>I'd like to meet · select all that apply</legend>
              <div className="gender-checks">
                {genders.map((v) => (
                  <label key={v}>
                    <input
                      type="checkbox"
                      checked={profile.seeking.includes(v)}
                      onChange={(e) =>
                        edit(
                          "seeking",
                          e.target.checked
                            ? [...profile.seeking, v]
                            : profile.seeking.filter((g) => g !== v),
                        )
                      }
                    />{" "}
                    {v}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="fields">
              <Field label="Preferred age · from">
                <input
                  type="number"
                  min="18"
                  max="100"
                  value={profile.min_age}
                  onChange={(e) => edit("min_age", e.target.value)}
                  required
                />
              </Field>
              <Field label="Preferred age · to">
                <input
                  type="number"
                  min="18"
                  max="100"
                  value={profile.max_age}
                  onChange={(e) => edit("max_age", e.target.value)}
                  required
                />
              </Field>
            </div>
            {location.city_enabled && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={profile.any_city}
                  onChange={(e) => edit("any_city", e.target.checked)}
                />
                <span>I'm open to meeting someone in another city.</span>
              </label>
            )}
            {location.country_enabled && location.outside_country_enabled && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={profile.outside_country}
                  onChange={(e) => edit("outside_country", e.target.checked)}
                />
                <span>
                  I'm open to meeting someone outside my country. Both people
                  must opt in.
                </span>
              </label>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={profile.openrouter_consent}
                onChange={(e) => edit("openrouter_consent", e.target.checked)}
              />
              <span>
                Optional: allow OpenRouter and its model provider to write an AI
                explanation using only shared themes when both people agree.
                Provider retention policies vary. Matching works without this.
              </span>
            </label>
            <Field label="A little about you">
              <textarea
                maxLength={500}
                value={profile.bio}
                onChange={(e) => edit("bio", e.target.value)}
                placeholder="A small thing that makes you, you."
              />
            </Field>
            <p className="tiny">
              Orientation stays private. Matching uses your explicitly selected
              preferences.
            </p>
            {errorBox}
            <Button variant="full" style={{ marginTop: 22 }}>
              On to the good questions ↗
            </Button>
          </fieldset>
          {!open && (
            <p className="notice">
              This round is closed. Your profile is locked.
            </p>
          )}
        </form>
      </main>
    );
  else if (route === "survey" && user) {
    const q = questions[question];
    content = (
      <main className="workspace onboarding">
        {errorBox}
        {!profile.age ? (
          <div className="panel">
            <h1>First, a little introduction.</h1>
            <a className="btn" href="#profile" style={{ marginTop: 20 }}>
              Complete my profile ↗
            </a>
          </div>
        ) : !open ? (
          <div className="panel">
            <h1>This round is closed.</h1>
            <a href="#dashboard" className="inline-link">
              Back to your dashboard
            </a>
          </div>
        ) : question < 40 && q ? (
          <>
            <div className="progress-top">
              <span>Your orbit, in the making</span>
              <span>{Object.keys(answers).length} / 40 answered</span>
            </div>
            <div className="progress">
              <i
                style={{
                  width: (Object.keys(answers).length / 40) * 100 + "%",
                }}
              />
            </div>
            <div className="category">
              {group(question)} · {question + 1} of 40
            </div>
            <h1 className="survey-title">{q.text}</h1>
            <div
              className="options"
              role="group"
              aria-label="Choose one answer"
            >
              {q.options.map((o) => (
                <button
                  key={o.id}
                  disabled={busy}
                  className={
                    "option " + (answers[q.id] === o.id ? "selected" : "")
                  }
                  aria-pressed={answers[q.id] === o.id}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                >
                  <b>{o.id}</b>
                  <span>{o.text}</span>
                </button>
              ))}
            </div>
            <div className="survey-nav">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  question === 0 ? go("profile") : setQuestion((n) => n - 1)
                }
              >
                ← Back
              </Button>
              <button
                className="textbtn tiny"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await saveDraft();
                    notify("Your progress is saved.");
                    go("dashboard");
                  })
                }
              >
                Save & leave
              </button>
              <Button
                disabled={busy || !answers[q.id]}
                onClick={() =>
                  run(async () => {
                    await saveDraft();
                    setQuestion((n) => n + 1);
                    window.scrollTo(0, 0);
                  })
                }
              >
                {question === 39 ? "Review" : "Next"} →
              </Button>
            </div>
            <p className="tiny" style={{ textAlign: "center", marginTop: 20 }}>
              Answer as yourself, not as who you think someone wants.
            </p>
          </>
        ) : (
          <>
            <div className="eyebrow">THAT'S YOUR KIND OF ORBIT</div>
            <h1>A little more you. All done.</h1>
            <p className="sub">Review your answers before joining the round.</p>
            <div className="panel" style={{ marginTop: 25 }}>
              <h3>{Object.keys(answers).length} of 40 answers ready</h3>
              <div className="review-grid">
                {questions.map((q, i) => (
                  <button key={q.id} onClick={() => setQuestion(i)}>
                    {q.id}. {q.text}
                    <small>
                      {q.options.find((o) => o.id === answers[q.id])?.text ||
                        "Not answered"}
                    </small>
                  </button>
                ))}
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={submitConsent}
                  onChange={(e) => setSubmitConsent(e.target.checked)}
                />
                <span>
                  I agree to join this round and receive a result notification
                  by email. Shared profile details will be visible to my
                  matches.
                </span>
              </label>
              <Button
                variant="full"
                disabled={
                  busy || !submitConsent || Object.keys(answers).length !== 40
                }
                onClick={() =>
                  run(async () => {
                    if (!preview)
                      await api("survey/submit", "POST", {
                        answers,
                        consent: true,
                      });
                    setSubmitted(true);
                    persist({ submitted: true });
                    notify("You’re in. Your orbit is taking shape.");
                    go("dashboard");
                  })
                }
              >
                Join this orbit ↗
              </Button>
            </div>
          </>
        )}
      </main>
    );
  } else if (route === "dashboard" && dashboard && user) {
    const d = dashboard,
      r = d.round;
    const remaining = Math.max(0, r.closes_at * 1000 - Date.now());
    content = (
      <main className="workspace">
        <div className="workspace-top">
          <div>
            <div className="eyebrow">A SPACE FOR YOUR CONNECTIONS</div>
            <h1>Hey {user.name}. Welcome to your orbit.</h1>
            <p className="sub">Good things take a little intention.</p>
          </div>
          {user.is_admin && (
            <a className="btn outline small" href="#admin">
              Admin ↗
            </a>
          )}
        </div>
        {errorBox}
        <div className="dashboard-grid">
          <section className="panel round-card">
            <span className="status-pill">
              <i className="dot" />
              {r.status === "published"
                ? "Results revealed"
                : !open
                  ? "Round closed"
                  : "Round open"}
            </span>
            <h2>
              {r.status === "published"
                ? "Your next hello starts here."
                : d.submitted
                  ? "You’re in. Let a little anticipation in."
                  : "Your people start with your story."}
            </h2>
            <p>
              {d.submitted
                ? "Your answers are safely in this round. We’ll let you know when your results are ready."
                : "Finish your profile and answer the survey to join the next matching round."}
            </p>
            {open ? (
              <>
                <div className="countdown">
                  {[
                    [Math.floor(remaining / 86400000), "DAYS"],
                    [Math.floor(remaining / 3600000) % 24, "HOURS"],
                    [Math.floor(remaining / 60000) % 60, "MINUTES"],
                  ].map(([v, k]) => (
                    <div key={k}>
                      <strong>{v}</strong>
                      <span>{k}</span>
                    </div>
                  ))}
                </div>
                <a
                  className="btn"
                  href={"#" + (d.has_profile ? "survey" : "profile")}
                >
                  {d.submitted
                    ? "Review my answers"
                    : d.answered
                      ? "Continue my survey"
                      : "Build my profile"}{" "}
                  ↗
                </a>
              </>
            ) : (
              <p style={{ marginTop: 25 }}>
                {r.status === "published"
                  ? "Take your time. A match is just the beginning."
                  : "Your profile is locked while this round is being matched."}
              </p>
            )}
          </section>
          <aside className="panel">
            <h3>Your little corner</h3>
            {[
              ["Profile", d.has_profile ? "Complete" : "To begin"],
              ["Your answers", d.answered + " / 40"],
              ["Round", r.title],
              ["Survey", d.submitted ? "Submitted" : "Draft"],
            ].map(([k, v]) => (
              <div className="side-stat" key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
            {open && (
              <a
                className="inline-link"
                style={{ display: "block", marginTop: 20 }}
                href="#profile"
              >
                Edit my profile ↗
              </a>
            )}
            <button
              className="textbtn tiny"
              style={{ marginTop: 18 }}
              onClick={() =>
                setModal({
                  title: "Leave your orbit?",
                  paragraphs: [
                    "This permanently deletes your account, answers, and match records. This cannot be undone.",
                  ],
                  label: "Delete my account",
                  requirePassword: !preview,
                  action: () =>
                    run(async () => {
                      if (!preview)
                        await api("account", "DELETE", {
                          password: deletePasswordRef.current?.value || "",
                        });
                      sessionStorage.removeItem("orbit-preview");
                      setUser(null);
                      setProfile(initialProfile);
                      setAnswers({});
                      setSubmitted(false);
                      setDashboard(null);
                      go("home");
                      notify("Your account and answers have been deleted.");
                    }),
                })
              }
            >
              Delete my account & answers
            </button>
          </aside>
        </div>
        <section className="results">
          <h2>
            {preview && r.status === "published"
              ? "Illustrative matches"
              : "Your connections"}
          </h2>
          {r.status === "published" ? (
            d.matches.length ? (
              <>
                <div className="match-grid">
                  {d.matches.map((m, i) => (
                    <article className="match-card" key={i}>
                      <span className="match-score">
                        {m.score}% shared-answer fit
                      </span>
                      <div className="avatar">{m.name[0]}</div>
                      <h3>
                        {m.name}, {m.age}
                      </h3>
                      <p>
                        {m.occupation} · {m.city}
                      </p>
                      <div className="tags">
                        {m.shared.map((s) => (
                          <span className="tag" key={s}>
                            {s}
                          </span>
                        ))}
                      </div>
                      <p>{m.explanation}</p>
                      <Button
                        variant="outline small"
                        onClick={() =>
                          setModal({
                            title: "A good place to start.",
                            paragraphs: [
                              m.icebreaker,
                              "Keep it kind. Orbit does not expose email addresses. Share contact details only when you both feel comfortable.",
                            ],
                          })
                        }
                      >
                        A conversation starter ↗
                      </Button>
                    </article>
                  ))}
                </div>
                <p className="tiny" style={{ marginTop: 16 }}>
                  A survey similarity score, not a prediction of relationship
                  success.
                </p>
              </>
            ) : (
              <div className="panel empty">
                No mutual matches this round. A smaller pool can mean waiting
                for a better fit. Your preferences always come first.
              </div>
            )
          ) : (
            <div className="panel empty">
              <span style={{ fontSize: 30 }}>✧</span>
              <p style={{ marginTop: 15 }}>A little mystery, for now.</p>
              <p>Your connections appear here after the round is revealed.</p>
            </div>
          )}
        </section>
      </main>
    );
  } else if (route === "admin" && admin) {
    const r = admin.round;
    content = (
      <main className="workspace">
        <div className="workspace-top">
          <div>
            <div className="eyebrow">
              ORBIT CONTROL ROOM {preview ? "· PREVIEW" : ""}
            </div>
            <h1>Make room for a little chemistry.</h1>
            <p className="sub">
              Manage the round, generate matches, and reveal the results.
            </p>
          </div>
          <a className="btn outline small" href="#dashboard">
            My dashboard ↗
          </a>
        </div>
        {errorBox}
        <div className="stats">
          {[
            ["Participants", admin.participants],
            ["Submitted", admin.submitted],
            ["Round status", r.status],
            ["Emails pending", admin.emails_pending],
          ].map(([k, v]) => (
            <div className="panel stat" key={k}>
              <span className="tiny">{k}</span>
              <strong style={typeof v === "string" ? { fontSize: 23 } : {}}>
                {v}
              </strong>
            </div>
          ))}
        </div>
        <section className="panel" style={{ marginBottom: 24 }}>
          <h3>Location controls</h3>
          <p className="tiny">
            Applies to this round’s onboarding and matching. Disabled fields are
            hidden and ignored. Controls lock once matching starts. Enabling a
            field requires existing participants to update their profile.
          </p>
          <div className="gender-checks">
            {(
              [
                ["country_enabled", "Country section"],
                ["outside_country_enabled", "Outside-country matching"],
                ["city_enabled", "City section"],
              ] as const
            ).map(([key, label]) => {
              const settings =
                admin.location_settings ?? defaultLocationSettings;
              return (
                <button
                  key={key}
                  type="button"
                  className="btn outline small"
                  role="switch"
                  aria-checked={settings[key]}
                  disabled={
                    busy ||
                    !["open", "closed"].includes(r.status) ||
                    (key === "outside_country_enabled" &&
                      !settings.country_enabled)
                  }
                  onClick={() =>
                    run(async () => {
                      const updated = { ...settings, [key]: !settings[key] };
                      if (!updated.country_enabled)
                        updated.outside_country_enabled = false;
                      if (!preview)
                        await api("admin/location-settings", "PUT", updated);
                      setAdmin((a) =>
                        a ? { ...a, location_settings: updated } : null,
                      );
                      setDashboard((d) =>
                        d ? { ...d, location_settings: updated } : null,
                      );
                    })
                  }
                >
                  {label}: {settings[key] ? "On" : "Off"}
                </button>
              );
            })}
          </div>
        </section>
        <div className="admin-columns">
          <section className="panel">
            <h3>The current round</h3>
            <form
              key={r.title + r.closes_at}
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                run(async () => {
                  const closes_at =
                    new Date(String(data.closes_at)).getTime() / 1000;
                  if (closes_at <= Date.now() / 1000)
                    throw Error("Choose a closing time in the future.");
                  if (preview) {
                    const updated = {
                      ...round,
                      title: String(data.title),
                      closes_at,
                    };
                    setRound(updated);
                    setAdmin((a) => (a ? { ...a, round: updated } : null));
                    persist({ round: updated });
                  } else {
                    await api("admin/round", "PUT", {
                      title: String(data.title),
                      closes_at,
                    });
                    await loadAdmin();
                  }
                  notify("Round schedule saved.");
                });
              }}
            >
              <Field label="Round name">
                <input
                  name="title"
                  maxLength={100}
                  defaultValue={r.title}
                  required
                  disabled={!["open", "closed"].includes(r.status)}
                />
              </Field>
              <Field label="Closing time · your local timezone">
                <input
                  name="closes_at"
                  type="datetime-local"
                  defaultValue={dateInput(r.closes_at)}
                  required
                  disabled={!["open", "closed"].includes(r.status)}
                />
              </Field>
              <Button
                variant="outline small"
                disabled={busy || !["open", "closed"].includes(r.status)}
              >
                Save schedule
              </Button>
            </form>
            <div className="admin-actions">
              <Button
                disabled={busy || r.status !== "open"}
                onClick={() => confirmAdmin("close")}
              >
                Close survey
              </Button>
              <Button
                variant="outline"
                disabled={busy || r.status !== "closed"}
                onClick={() => adminAction("reopen")}
              >
                Reopen
              </Button>
            </div>
            {r.status === "published" && (
              <Button
                variant="outline small"
                style={{ marginTop: 20 }}
                onClick={() => adminAction("new-round")}
              >
                Open next round ↗
              </Button>
            )}
          </section>
          <section className="panel">
            <h3>Matching & reveal</h3>
            <p className="tiny">
              Close the round before generating. Your independent Python service
              computes mutual matches and saves results. Publishing reveals
              matches and queues email notifications.
            </p>
            <div className="notice">
              {preview
                ? "Preview controls use fictional data. No matching job or email is sent."
                : admin.job
                  ? "Latest matching job: " + admin.job.status
                  : "No matching job for this round yet."}
            </div>
            <div className="admin-actions">
              <Button
                disabled={busy || !["closed", "failed"].includes(r.status)}
                onClick={() => adminAction("generate")}
              >
                ✳ Generate results
              </Button>
              <Button
                variant="light"
                disabled={busy || r.status !== "ready"}
                onClick={() => confirmAdmin("publish")}
              >
                Reveal & notify ↗
              </Button>
            </div>
            <button
              className="textbtn tiny"
              style={{ marginTop: 15 }}
              onClick={() => run(loadAdmin)}
            >
              ↻ Refresh job status
            </button>
            {!preview && (
              <>
                <p className="tiny" style={{ marginTop: 15 }}>
                  Infrastructure: {admin.database} · {admin.cache} · Email:{" "}
                  {admin.email_configured ? "configured" : "not configured"}
                </p>
                <button
                  className="textbtn tiny"
                  onClick={() => adminAction("retry-emails")}
                >
                  Retry failed emails
                </button>
              </>
            )}
          </section>
        </div>
        <section className="panel" style={{ marginTop: 24 }}>
          <h3>Activity</h3>
          <ul className="activity">
            {admin.events.length ? (
              admin.events.map((e, i) => (
                <li key={i}>
                  <span>{e.action}</span>
                  <span className="tiny">
                    {new Date(e.created_at * 1000).toLocaleString()}
                  </span>
                </li>
              ))
            ) : (
              <li>No activity yet.</li>
            )}
          </ul>
        </section>
      </main>
    );
  } else
    content = (
      <main className="workspace">
        {errorBox || <p className="loading">Finding your orbit…</p>}
        {error && (
          <a className="btn" href={user ? "#dashboard" : "#login"}>
            {user ? "Back to dashboard" : "Log in"}
          </a>
        )}
      </main>
    );
  return (
    <>
      {preview && (
        <div className="preview">
          Interactive preview · fictional profiles · no emails sent{" "}
          <a href="#admin">Explore admin ↗</a>
        </div>
      )}
      <nav>
        <a className="logo" href="#home" aria-label="Orbit home">
          <i className="logo-mark" />
          orbit
          <span style={{ fontSize: 16, alignSelf: "start", marginTop: 4 }}>
            ®
          </span>
        </a>
        <div className="navlinks">
          <a href="#how-it-works">How it works</a>
          <a href="#our-approach">Our approach</a>
          <a href="#questions">The little details</a>
        </div>
        <div className="navactions">
          <ThemeToggle />
          {user ? (
            <>
              <a href="#dashboard">My orbit</a>
              <button
                className="textbtn"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (!preview) await api("logout", "POST", {});
                    setUser(null);
                    setProfile(initialProfile);
                    setAnswers({});
                    setSubmitted(false);
                    setDashboard(null);
                    sessionStorage.removeItem("orbit-preview");
                    go("home");
                  })
                }
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <a href="#login">Log in</a>
              <a className="btn small" href="#register">
                Find my people ↗
              </a>
            </>
          )}
        </div>
      </nav>
      {content}
      <footer className="footer">
        <a className="logo" href="#home">
          orbit<span style={{ fontSize: 13 }}>®</span>
        </a>
        <p>A little serendipity. A lot of intention.</p>
        <div className="footer-links">
          <button onClick={privacy}>Privacy</button>
          <button onClick={safety}>Community & safety</button>
          <span>
            developed by <b>priyx</b> ↗
          </span>
        </div>
      </footer>
      <div
        id="toast"
        className={notice ? "show" : ""}
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button
              className="close"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              ×
            </button>
            <div className="eyebrow">A LITTLE MORE CONTEXT</div>
            <h2 id="modal-title">{modal.title}</h2>
            {modal.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {modal.requirePassword && (
              <Field label="Confirm your password">
                <input
                  type="password"
                  autoComplete="current-password"
                  ref={deletePasswordRef}
                  maxLength={128}
                />
              </Field>
            )}
            {modal.action && (
              <Button
                onClick={() => {
                  const action = modal.action;
                  action?.();
                  setModal(null);
                }}
              >
                {modal.label}
              </Button>
            )}
          </section>
        </div>
      )}
    </>
  );
}
