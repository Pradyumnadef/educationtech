import {
  initDB,
  one,
  insert,
  id,
  now,
  demo,
  production,
  run,
} from "../../server/db.ts";
import { passwordHash } from "../../server/security.ts";
export async function seed() {
  if (production || !demo || process.env.SEED_DEMO !== "true") return;
  if (await one("SELECT id FROM users LIMIT 1")) return;
  const t = now();
  const users = [
    [
      "admin",
      "Sophie Chen",
      process.env.DEMO_ADMIN_EMAIL || "teacher@lumio.local",
    ],
    [
      "student",
      "Alex Morgan",
      process.env.DEMO_STUDENT_EMAIL || "alex@lumio.local",
    ],
    ["student", "Priya Sharma", "priya@lumio.local"],
    ["student", "Jamie Wilson", "jamie@lumio.local"],
    ["student", "Sam Rivera", "sam@lumio.local"],
  ];
  for (let i = 0; i < users.length; i++) {
    const [role, name, email] = users[i];
    await insert("users", {
      id: `user-${i}`,
      role,
      name,
      email,
      phone: null,
      password_hash:
        role === "admin"
          ? passwordHash(
              process.env.DEMO_ADMIN_PASSWORD || "ChangeMe-Demo-2026!",
            )
          : null,
      status: i === 4 ? "pending" : "active",
      avatar: "",
      interests: '["English","UHV"]',
      onboarding: 1,
      created_at: t - (20 - i * 3) * 86400000,
      updated_at: t,
      last_active: t - i * 3600000,
    });
  }
  const subjects = [
    [
      "english",
      "ETW (English for Technical Writing)",
      "Find your voice. Share your ideas.",
      "english",
    ],
    [
      "uhv",
      "UHV (Universal Human Values)",
      "Learn with purpose, respect, and responsibility.",
      "biology",
    ],
  ];
  for (const [key, name, description, thumbnail] of subjects)
    await insert("content", {
      id: key,
      kind: "subject",
      parent_id: null,
      name,
      description,
      thumbnail,
      status: "published",
      public: 1,
      created_at: t,
      updated_at: t,
    });
  const chapters = [
    [
      "algebra",
      "english",
      "Grammar foundations",
      "Build a confident foundation in written English.",
      "english",
    ],
    [
      "motion",
      "uhv",
      "Understanding harmony",
      "Explore harmony within ourselves and our relationships.",
      "biology",
    ],
    [
      "python",
      "english",
      "Communication skills",
      "Express ideas with clarity and confidence.",
      "english",
    ],
    [
      "organic",
      "uhv",
      "Values in daily life",
      "Connect values with choices and responsible action.",
      "biology",
    ],
    [
      "calculus",
      "english",
      "Reading and comprehension",
      "Read closely, understand context, and respond thoughtfully.",
      "english",
    ],
  ];
  for (const [key, parent, name, description, thumbnail] of chapters) {
    await insert("content", {
      id: key,
      kind: "chapter",
      parent_id: parent,
      name,
      description,
      thumbnail,
      status: "published",
      public: 0,
      created_at: t,
      updated_at: t,
    });
    await insert("content", {
      id: `${key}-topic`,
      kind: "topic",
      parent_id: key,
      name: "Getting started",
      description: "Your first lightbulb moments.",
      thumbnail,
      status: "published",
      public: 0,
      created_at: t,
      updated_at: t,
    });
  }
  const lessons: Record<string, string[]> = {
    algebra: [
      "Thinking in equations",
      "The language of algebra",
      "Solving linear equations",
      "A first look at quadratics",
    ],
    motion: [
      "A world in motion",
      "Understanding velocity",
      "Newton’s first law",
      "Forces in everyday life",
    ],
    python: [
      "Hello, possibilities",
      "Variables and data types",
      "Making decisions with code",
      "Your first Python project",
    ],
    organic: ["Meet the elements", "Inside the atom", "The periodic table"],
    calculus: [
      "What is a derivative?",
      "Understanding limits",
      "Finding the slope",
    ],
  };
  for (const [key, titles] of Object.entries(lessons))
    for (let i = 0; i < titles.length; i++)
      await insert("content", {
        id: `${key}-${i + 1}`,
        kind: "video",
        parent_id: `${key}-topic`,
        name: titles[i],
        description: `A focused lesson in ${chapters.find((c) => c[0] === key)![2].toLowerCase()}. Learn the key ideas, follow an example, and take a moment to practice.`,
        thumbnail: chapters.find((c) => c[0] === key)![4],
        status: "published",
        public: 0,
        duration: 90,
        tags: JSON.stringify(["Foundations", "Beginner"]),
        notes:
          "Take a moment to pause and explain the key idea in your own words.\n\nPractice: create one example of your own, then compare it to the lesson.\n\nReflection: What became clearer? What would you like to ask your teacher?",
        created_at: t - (titles.length - i) * 86400000,
        updated_at: t,
      });
  await insert("student_groups", {
    id: "group-1",
    name: "Section-A",
    description: "Our weekday foundation learners.",
    created_at: t,
  });
  for (const uid of ["user-1", "user-2"])
    await insert("group_members", {
      id: id(),
      group_id: "group-1",
      user_id: uid,
    });
  for (const key of ["algebra", "motion", "python"])
    await insert("access_grants", {
      id: id(),
      user_id: null,
      group_id: "group-1",
      content_id: key,
      status: "assigned",
      created_at: t,
    });
  await insert("access_grants", {
    id: id(),
    user_id: "user-3",
    group_id: null,
    content_id: "organic",
    status: "assigned",
    created_at: t,
  });
  for (const [video, position, complete] of [
    ["algebra-1", 90, 1],
    ["algebra-2", 90, 1],
    ["algebra-3", 37, 0],
    ["motion-1", 90, 1],
    ["motion-2", 22, 0],
    ["python-1", 90, 1],
    ["python-2", 12, 0],
  ] as const) {
    await insert("progress", {
      id: id(),
      user_id: "user-1",
      video_id: video,
      position,
      watched_seconds: position,
      completed: complete,
      updated_at: t - Math.random() * 86400000,
    });
  }
  for (let d = 0; d < 7; d++)
    for (let j = 0; j < (d % 3) + 1; j++)
      await insert("watch_events", {
        id: id(),
        user_id: "user-1",
        video_id: "algebra-1",
        seconds: 60 + 20 * d,
        created_at: t - d * 86400000 - j * 60000,
      });
  await insert("announcements", {
    id: id(),
    title: "A fresh week, a little more possibility",
    body: "Your new English and UHV lessons are ready. Bring your questions to our next class. You’ve got this!",
    created_at: t - 3600000,
  });
  await insert("announcements", {
    id: id(),
    title: "Welcome to your learning space",
    body: "This is your place to explore, ask questions, and learn at your own pace. Your teacher will add new lessons to your library as you go.",
    created_at: t - 86400000,
  });
  await insert("settings", {
    id: "platform",
    value: JSON.stringify({
      name: "English Tech",
      supportEmail: "hello@lumio.local",
      welcome: "A little progress, every day.",
      weeklyGoal: 120,
    }),
  });

  console.log("Development seed created. See .env for demo credentials.");
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/seed.ts")) {
  await initDB();
  await seed();
  const { closeDB } = await import("../../server/db.ts");
  await closeDB();
}
