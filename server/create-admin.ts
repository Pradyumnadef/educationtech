import "dotenv/config";
import { z } from "zod";
import { initDB, one, createInitialTeacher, id, now, closeDB } from "./db.ts";
import { passwordHash } from "./security.ts";
const b = z
  .object({
    email: z.email().toLowerCase(),
    name: z.string().min(1).max(200),
    password: z.string().min(16).max(200),
  })
  .parse({
    email: process.env.INITIAL_ADMIN_EMAIL,
    name: process.env.INITIAL_ADMIN_NAME,
    password: process.env.INITIAL_ADMIN_PASSWORD,
  });
await initDB();
if (await one("SELECT id FROM users WHERE email=?", [b.email]))
  throw new Error("This account already exists. No changes were made.");
await createInitialTeacher({
  id: id(),
  role: "admin",
  email: b.email,
  name: b.name,
  password_hash: passwordHash(b.password),
  status: "active",
  avatar: "",
  interests: "[]",
  onboarding: 1,
  created_at: now(),
  updated_at: now(),
});
console.log(
  "Owner account created. Remove INITIAL_ADMIN_PASSWORD from the environment.",
);
await closeDB();
