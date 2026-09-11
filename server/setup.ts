import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  const content = readFileSync(".env.example", "utf8").replace(
    "replace-with-at-least-32-random-characters",
    randomBytes(48).toString("hex"),
  );
  writeFileSync(".env", content);
}
await import("dotenv/config");
const { initDB, closeDB } = await import("./db.ts");
await initDB();
await closeDB();
console.log(
  "English Tech is ready. Run npm run dev and open http://localhost:3000/auth/setup to create your first teacher account.",
);
