import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Play,
  Check,
  Plus,
  Minus,
  Compass,
  BookOpen,
  ShieldCheck,
  Sparkles,
  Menu,
  X,
  MoveUpRight,
  Heart,
  Leaf,
} from "lucide-react";
import {
  Logo,
  Button,
  CourseArt,
  Field,
  Modal,
  useToast,
  post,
  useData,
} from "../lib";
const faqs = [
  [
    "How does learning on English Tech work?",
    "Create your account, verify your email or phone, and tell us what interests you. Your teacher assigns the right subjects and lessons, which appear in your personal dashboard.",
  ],
  [
    "Can I learn at my own pace?",
    "Absolutely. Pause, replay, change playback speed, and pick up exactly where you left off. Your progress is saved as you learn.",
  ],
  [
    "How do I get access to a subject?",
    "Your teacher manages access to individual lessons, topics, chapters, or entire subjects. Selecting an interest helps them understand your goals, but does not automatically unlock a subject.",
  ],
  [
    "Can I use English Tech on my phone?",
    "Yes. Your learning space works on phones, tablets, and computers. Your progress follows your account across devices.",
  ],
  [
    "Who can see my learning progress?",
    "You and your teacher can view your learning progress. Other students cannot access your profile, watch history, or assignments.",
  ],
];
export default function Landing() {
  const [menu, setMenu] = useState(false),
    [faq, setFaq] = useState(0),
    [contact, setContact] = useState(false),
    [busy, setBusy] = useState(false);
  const studentAccessMenu = useRef<HTMLDetailsElement>(null);
  const toast = useToast();
  const { data } = useData<any[]>("/catalog");
  const subjects = (data || []).filter((n) => n.kind === "subject").slice(0, 4);
  useEffect(() => {
    const closeStudentAccessMenu = (event: PointerEvent) => {
      if (
        studentAccessMenu.current &&
        !studentAccessMenu.current.contains(event.target as Node)
      )
        studentAccessMenu.current.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeStudentAccessMenu);
    return () =>
      document.removeEventListener("pointerdown", closeStudentAccessMenu);
  }, []);
  return (
    <div className="landing">
      <nav className="public-nav">
        <Logo />
        <div className={`nav-links ${menu ? "open" : ""}`}>
          <a href="#subjects" onClick={() => setMenu(false)}>
            Explore subjects
          </a>
          <a href="#why" onClick={() => setMenu(false)}>
            Why English Tech
          </a>
          <a href="#how" onClick={() => setMenu(false)}>
            How it works
          </a>
          <button onClick={() => setContact(true)}>Contact</button>
        </div>
        <div className="nav-actions">
          <details className="student-access-menu" ref={studentAccessMenu}>
            <summary className="sign-in">
              Sign in <ArrowUpRight size={15} />
            </summary>
            <div className="student-access-options">
              <Link to="/auth/login">
                <strong>Existing Student</strong>
                <span>Sign in to your account</span>
              </Link>
              <Link to="/auth/signup">
                <strong>New Student Registration</strong>
                <span>Create a new account</span>
              </Link>
            </div>
          </details>
          <Link className="button small" to="/auth/signup">
            Start learning <ArrowRight size={16} />
          </Link>
          <button
            className="mobile-menu icon-button"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </nav>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="pill">
              <span className="green-dot" /> BIG IDEAS START WITH A LITTLE
              CURIOSITY
            </span>
            <h1>
              A little learning.
              <br />A lot of <em>possibility.</em>
              <svg className="hand-underline" viewBox="0 0 360 20">
                <path
                  d="M3 12Q160-2 351 9M30 18Q200 7 327 15"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                />
              </svg>
            </h1>
            <p>
              Your subjects. Your pace. Your lightbulb moments.
              <br className="desktop" /> A thoughtful space to build confidence,
              follow your curiosity,
              <br className="desktop" /> and become a little more you.
            </p>
            <div className="hero-actions">
              <Link to="/auth/signup" className="button">
                Find your next chapter <ArrowUpRight size={18} />
              </Link>
              <a className="text-button" href="#subjects">
                <span className="round-play">
                  <Play size={14} fill="currentColor" />
                </span>{" "}
                Explore the possibilities
              </a>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack">
                <span>AM</span>
                <span>PS</span>
                <span>JW</span>
                <span>SR</span>
              </div>
              <div>
                <b>Different minds. Shared curiosity.</b>
                <p>A learning space for every kind of learner.</p>
              </div>
            </div>
          </div>
          <div
            className="hero-scene"
            aria-label="An illustrated world of books, ideas, and learning"
          >
            <div className="scene-label">
              <Sparkles size={15} /> YOUR NEXT LIGHTBULB MOMENT
            </div>
            <svg className="scene-art" viewBox="0 0 600 500" aria-hidden="true">
              <defs>
                <pattern
                  id="dots"
                  width="18"
                  height="18"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r="1" fill="#9ba986" opacity=".28" />
                </pattern>
              </defs>
              <path
                d="M50 465V223C50 74 141 18 301 18s250 62 250 205v242"
                fill="#e7ecd9"
              />
              <path
                d="M80 460V235C80 106 148 48 301 48s220 60 220 187v225"
                fill="url(#dots)"
              />
              <circle
                cx="302"
                cy="221"
                r="133"
                fill="none"
                stroke="#a5b293"
                strokeDasharray="6 8"
              />
              <ellipse
                cx="300"
                cy="429"
                rx="190"
                ry="24"
                fill="#c5ceae"
                opacity=".45"
              />
              <path d="M220 382l-67-208 198-50 63 211z" fill="#244d3e" />
              <path d="M229 369l-60-181 180-46 56 181z" fill="#dce5be" />
              <path
                d="M169 188l87 42 93-88m-93 88 56 158"
                fill="none"
                stroke="#8d9d6c"
                strokeWidth="2"
              />
              <path
                d="M202 209l41 19m-36-4 40 19m-35-3 40 19m-34-3 40 19m-34-4 40 19"
                stroke="#7b8f64"
                strokeWidth="2"
              />
              <path
                d="M272 230l59-47m-55 62 60-48m-56 63 61-49m-56 64 61-49"
                stroke="#7b8f64"
                strokeWidth="2"
              />
              <path d="M148 386h247v34H148z" fill="#a287ad" />
              <path d="M165 391h224v22H165" fill="#f8f3e9" />
              <path d="M177 374h253v29H177z" fill="#e1b36f" />
              <path d="M190 378h233v18H190" fill="#fcf6e7" />
              <path d="M370 340l-21-116" stroke="#46694c" strokeWidth="5" />
              <path
                d="M359 277q-60-9-52-51 56 5 52 51m1 15q60-47 69-6-38 33-69 6m-6-44q37-67 59-33-17 33-59 33"
                fill="#81996a"
              />
              <path d="M352 343h47l-8 40h-33z" fill="#b68e6a" />
              <path
                d="M375 87c-42 0-57 47-28 73 9 8 12 18 12 24h32c0-8 3-17 12-26 31-29 13-71-28-71z"
                fill="#f3d786"
                stroke="#b29d61"
                strokeWidth="2"
              />
              <path
                d="M359 191h32m-30 7h28m-25 7h21m-10-22v-39l-10-12m10 12 10-12"
                stroke="#8a865c"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M375 64v-13m58 51 12-6m-131 6-12-6m110-23 8-10m-81 10-8-10"
                stroke="#bca665"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M118 290l10 19 21 4-15 15 2 21-19-10-19 9 4-21-15-15 22-3z"
                fill="#e8c881"
              />
              <circle cx="458" cy="356" r="9" fill="#9aaeca" />
              <path
                d="M114 122v22m-11-11h22M466 214v18m-9-9h18"
                stroke="#a08da8"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <div className="floating-card fc-one">
              <span className="float-icon">
                <Check size={19} />
              </span>
              <div>
                <b>One step closer.</b>
                <small>Every lesson is a little win.</small>
              </div>
            </div>
            <div className="floating-card fc-two">
              <span>✦</span>
              <div>
                <b>Made for your curious mind</b>
                <small>Learn something that lights you up.</small>
              </div>
            </div>
            <div className="scene-caption">
              <span>01 /</span> THE POSSIBILITIES ARE ENDLESS{" "}
              <ArrowUpRight size={16} />
            </div>
          </div>
        </section>
        <div className="values-strip">
          <span>
            <BookOpen size={17} /> Thoughtfully guided lessons
          </span>
          <i />
          <span>
            <Compass size={17} /> A path that’s yours
          </span>
          <i />
          <span>
            <ShieldCheck size={17} /> A safe space to grow
          </span>
          <i />
          <span>
            <Heart size={17} /> Progress over perfection
          </span>
        </div>
        <section className="public-section" id="subjects">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FOLLOW YOUR CURIOSITY</span>
              <h2>What lights you up?</h2>
              <p>Find a subject that makes you want to know a little more.</p>
            </div>
            <Link to="/auth/signup" className="text-button">
              Explore all subjects <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="grid four subject-grid">
            {(subjects.length
              ? subjects
              : [
                  {
                    id: "english",
                    name: "English",
                    description: "Find your voice and share your ideas.",
                    thumbnail: "english",
                  },
                  {
                    id: "uhv",
                    name: "UHV (Universal Human Values)",
                    description:
                      "Learn with purpose, respect, and responsibility.",
                    thumbnail: "biology",
                  },
                ]
            ).map((s) => (
              <Link to="/auth/signup" className="public-subject" key={s.id}>
                <CourseArt theme={s.thumbnail} />
                <div>
                  <h3>
                    {s.name}
                    <ArrowUpRight size={18} />
                  </h3>
                  <p>{s.description}</p>
                  <small>Explore the subject</small>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section className="why-section public-section" id="why">
          <div className="why-visual">
            <span className="eyebrow">SMALL STEPS. REAL GROWTH.</span>
            <div className="growth-chart">
              <div className="growth-top">
                <span>Your confidence, growing.</span>
                <Leaf size={22} />
              </div>
              <svg viewBox="0 0 440 170">
                <defs>
                  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                    <stop stopColor="#91a777" stopOpacity=".35" />
                    <stop offset="1" stopColor="#91a777" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M10 150Q55 147 77 123T148 110 225 69 300 51 426 15V170H10Z"
                  fill="url(#fade)"
                />
                <path
                  d="M10 150Q55 147 77 123T148 110 225 69 300 51 426 15"
                  fill="none"
                  stroke="#5c7952"
                  strokeWidth="3"
                />
                <circle cx="426" cy="15" r="7" fill="#315942" />
              </svg>
              <div className="growth-bottom">
                <span>Your first step</span>
                <span>
                  Your next possibility <MoveUpRight size={14} />
                </span>
              </div>
            </div>
            <div className="growth-note">
              <span>“</span>You don’t have to have it all figured out.
              <br />
              You just have to begin.
            </div>
          </div>
          <div className="why-copy">
            <span className="eyebrow">LEARNING THAT FEELS DIFFERENT</span>
            <h2>
              More understanding.
              <br />
              <em>Less overwhelm.</em>
            </h2>
            <p>
              Big ambitions deserve a thoughtful approach. English Tech brings
              structure, encouragement, and a little breathing room to your
              learning journey.
            </p>
            {[
              [
                Compass,
                "Your own way forward",
                "Lessons chosen by your teacher, shaped around where you are and where you want to go.",
              ],
              [
                Play,
                "Press play. Pause. Try again.",
                "Learn on your schedule. Revisit the tricky bits. Make every idea your own.",
              ],
              [
                Sparkles,
                "See how far you’ve come",
                "Small wins add up. Keep track of your progress and celebrate the moments that matter.",
              ],
            ].map(([Icon, title, body]: any) => (
              <div className="benefit" key={title}>
                <span>
                  <Icon size={20} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="public-section how-section" id="how">
          <span className="eyebrow">YOUR JOURNEY, SIMPLIFIED</span>
          <h2>A brighter beginning, in three steps.</h2>
          <div className="grid three">
            {[
              [
                "01",
                "Make yourself at home",
                "Create your account and tell us a little about you. A few moments, a fresh start.",
              ],
              [
                "02",
                "Find your direction",
                "Choose what sparks your curiosity. Your teacher will build your personal learning path.",
              ],
              [
                "03",
                "Let your curiosity lead",
                "Dive into your lessons, grow your understanding, and keep moving forward.",
              ],
            ].map(([num, title, body]) => (
              <article className="step" key={num}>
                <span>{num}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="quote-section">
          <span className="eyebrow">OUR LEARNING PHILOSOPHY</span>
          <div className="quote-stars">✦ ✦ ✦</div>
          <blockquote>
            “The beautiful thing about learning is that
            <br className="desktop" /> every small step changes what’s
            possible.”
          </blockquote>
          <p>THE IDEA AT THE HEART OF ENGLISH TECH</p>
          <span className="small-note">
            A new learning community. Real student stories coming as we grow.
          </span>
        </section>
        <section className="public-section faq-section">
          <div>
            <span className="eyebrow">A LITTLE MORE CLARITY</span>
            <h2>
              Curious about
              <br />
              the details?
            </h2>
            <p>We thought you might be.</p>
            <button className="text-button" onClick={() => setContact(true)}>
              Let’s talk <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="faq-list">
            {faqs.map(([q, a], i) => (
              <div className={`faq ${faq === i ? "expanded" : ""}`} key={q}>
                <button
                  aria-expanded={faq === i}
                  onClick={() => setFaq(faq === i ? -1 : i)}
                >
                  {q}
                  {faq === i ? <Minus size={17} /> : <Plus size={17} />}
                </button>
                {faq === i && <p>{a}</p>}
              </div>
            ))}
          </div>
        </section>
        <section className="bottom-cta">
          <div>
            <span className="eyebrow">THERE’S A LITTLE MORE IN YOU.</span>
            <h2>Let’s see where curiosity takes you.</h2>
            <p>Your next chapter starts with a single step.</p>
          </div>
          <Link className="button cream" to="/auth/signup">
            Start your learning journey <ArrowUpRight size={19} />
          </Link>
        </section>
      </main>
      <footer>
        <div className="footer-main">
          <div>
            <Logo />
            <p>
              A little curiosity.
              <br />A world of possibility.
            </p>
          </div>
          <div>
            <b>Explore</b>
            <a href="#subjects">Subjects</a>
            <a href="#why">About English Tech</a>
            <a href="#how">How it works</a>
          </div>
          <div>
            <b>Your space</b>
            <Link to="/auth/login">Student sign in</Link>
            <Link to="/auth/admin">Teacher sign in</Link>
            <button onClick={() => setContact(true)}>Contact us</button>
          </div>
          <div className="footer-note">
            <Leaf size={27} />
            <p>
              Thoughtfully made for
              <br />
              the way you grow.
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} English Tech. Keep growing.</span>
          <span>Built around curiosity. Designed for you.</span>
        </div>
      </footer>
      {contact && (
        <Modal
          title="Let’s start a conversation"
          onClose={() => setContact(false)}
        >
          <p className="muted">
            Questions about learning or your account? Leave a note for the
            teaching team.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await post("/contact", Object.fromEntries(f));
                toast("Your message has reached the teaching team.");
                setContact(false);
              } catch (e: any) {
                toast(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Your name">
              <input name="name" required maxLength={200} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" required />
            </Field>
            <Field label="How can we help?">
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={3000}
                rows={4}
              />
            </Field>
            <Button busy={busy} type="submit">
              Send message <ArrowRight size={16} />
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
