# English Tech

A complete, runnable video-learning application with a warm, responsive interface, a student portal, a teacher workspace, persistent data, OTP authentication, private video delivery, and server-enforced assignments.

## Start with your own teacher account

This release starts with **no accounts, courses, lessons, or announcements**. There is no default teacher password and no automatic demo seed.

Use Node.js 24 or later, then run these commands from this directory:

```sh
npm ci
npm run setup
npm run dev
```

Open **http://localhost:3000/auth/setup**. Enter your name, email, password (12 or more characters), and password confirmation. The account becomes the platform owner and you are signed in automatically. The setup form closes permanently after success, including after server restarts. Use **/auth/admin** for subsequent teacher sign-ins.

In your teacher workspace, open **Teachers → Add teacher** to create another teacher's account. Give the credentials to that teacher privately. They can change their password under Settings → Security. Only the owner can add or deactivate teachers. Deactivation invalidates their sessions without deleting their lessons. The owner cannot be deactivated through this screen.

`npm run setup` initializes an empty local SQLite database and creates `.env` with a random session secret only if that file does not already exist. Local data stays in `data/` across restarts. It never creates demo users or content. Automated tests create their own temporary fixtures outside the active database.

Local student OTP verification remains available with `LOCAL_OTP=true`: the code is displayed on the verification form. It is **not real delivery** and is disabled in production. Configure Twilio or implement the planned Google sign-in integration before inviting online students.

For the optimized local build, run `npm run build`, set `SERVE_BUILD=true` in your local environment, and run `npm start`.

## GitHub and Vercel

See **GITHUB-VERCEL.md**. Upload the contents of this project directory, with `package.json` at the repository root. Do not upload `.env`, `data`, `node_modules`, backups, or old source ZIP files.

The Vercel entry point and routing configuration are included. An external PostgreSQL database and the remaining production services must be configured **before the deployed API or first-teacher registration can work**. A Vercel frontend deployment alone does not provide persistent accounts or video storage. Google sign-in is a future integration and has not been represented by a placeholder button.

## What works

- Public landing page, subject catalog, working contact form, FAQ, animations, and mobile navigation.
- Email or international phone OTP signup/sign-in; five-minute local challenges, resend cooldown, persisted rate limits, attempt limits, and one-time consumption.
- Separate password-protected teacher sign-in, hashed passwords, secure sessions, logout, password change, and session invalidation.
- Four-step onboarding, profile photos, name updates, verified email/phone changes, and learning preferences.
- Student dashboard, assigned course and subject libraries, search, recent viewing, progress, learning streak, announcements, and read status.
- Native accessible player controls, playback speed, captions, resume, next/previous lessons, completion, private PDF resources, and notes.
- Teacher content CRUD for **subject → course → chapter → topic → video**, thumbnails, tags, publication state, and scheduled release.
- Video uploads, byte-signature checks, limits, upload progress, and a quarantine workflow for production objects.
- Student search/filter/sort, activation/approval/deactivation, removal, individual profiles, watch history, and access reset.
- Group creation/editing/deletion, membership management, and group assignments.
- Multi-item content assignment at every hierarchy level; review confirmation, revocation, and restoration.
- Real watch-event analytics, learner counts, watch time, completion, course completion, and audit logs.
- Platform name, support address, welcome message, weekly goal, teacher profile, and a contact-message inbox.
- Prerendered public homepage, metadata, sitemap, robots rules, and `X-Robots-Tag` on private routes.
- Responsive layouts, visible keyboard focus, native modal focus management, mobile drawer isolation, loading/error/empty states, toast feedback, and reduced-motion support.

The application starts empty. Create your own teaching content after registering the first teacher. Test fixtures are isolated from the running application and never load automatically.

## Architecture

| Layer | Implementation |
| --- | --- |
| Frontend | React 19, TypeScript, React Router, reusable components, responsive CSS, Lucide icons |
| Build | Vite, route-based dynamic imports, optimized production bundles, public HTML prerender |
| API | Node 24, Express 5, Zod validation, Helmet, secure cookies and CSRF checks |
| Development database | Node's SQLite driver, WAL, foreign keys, persisted data |
| Production database | PostgreSQL through `pg`, parameterized queries, indexes and relational constraints |
| OTP delivery | Twilio Verify SMS/email adapter; safe local demo delivery adapter |
| Media | Private S3 uploads; optional signed CloudFront upstream; authorization gateway for browser playback |
| Scanning | Separate worker with ffprobe validation and ClamAV INSTREAM; approved objects promoted to protected keys |

The database schema lives in `server/db.ts`. A generic hierarchical `content` table represents subjects, courses, chapters, topics, and videos; an `access_grants` table represents individual and group assignments. Users have a server-owned role. Related tables store sessions, OTP challenges, groups, memberships, progress, watch events, announcements, read state, uploads, settings, contacts, and audit events.

### Permission semantics

1. The account must be active and its session valid.
2. The requested content and its ancestors must be published and their release dates reached.
3. An assigned ancestor grants access to its descendants, including future published additions.
4. A **direct student revocation** on the item or any ancestor overrides both direct and group grants.
5. Revoking a group grant removes that group's permission. A separate individual assignment or another group's assignment can still grant access.
6. Interests never create assignments. A new student starts with no private lessons.
7. Students receive their own progress only. Unassigned video metadata, notes, resources, and storage keys are omitted. Publicly opted-in course titles and covers can be shown as locked.

Every lesson, progress, caption, resource, and media request repeats authorization on the server. Deactivation deletes sessions. Streaming connections are also rechecked every two seconds; the player saves progress about every ten seconds. Already downloaded or buffered bytes cannot be recalled. This is access-controlled delivery, not DRM or protection against screen recording.

## Production deployment

The application and adapters are implemented. **A live production deployment still requires your infrastructure and credentials, and integration verification against those services.** No hosting account, SMS subscription, cloud bucket, TLS certificate, or live database has been created for you.

1. Provision PostgreSQL and a **private** S3 bucket. Keep S3 public access blocked and enable encryption, versioning, and appropriate lifecycle policies. Do not expose database ports publicly.
2. Copy `.env.production.example` to `.env.production`, configure your HTTPS `APP_ORIGIN`, and fill in real credentials. Use independent random secrets. Set `DEMO_MODE=false` and `SEED_DEMO=false`.
3. Configure Twilio Verify for SMS and/or email. Email delivery additionally requires a supported email integration in your Verify service. The app chooses SMS for an E.164 phone number and email for an email address. [Twilio Verify documentation](https://www.twilio.com/docs/verify/api); [email integration](https://www.twilio.com/docs/verify/email).
4. Apply the bucket CORS policy in `deploy/s3-cors.json`, replacing the example origin. Give the app permission to upload quarantine objects and read approved media; the scanner needs read, conditional copy, and delete permissions. Prefer cloud workload roles to static access keys.
5. Build the application image with target `runtime`. `compose.yaml` provides PostgreSQL, the app, a separate scanner, and ClamAV. Set `POSTGRES_PASSWORD` in the Compose environment, then run:

   ```sh
   docker compose --env-file .env.production up -d --build
   ```

   Add `POSTGRES_PASSWORD` to `.env.production` when using this command. Choose a URL-safe strong password or URL-encode it in a custom `DATABASE_URL`. The sample database connection has TLS disabled only for the internal Compose network; enable verified TLS for external managed PostgreSQL.

6. Configure a TLS reverse proxy. `deploy/nginx.conf` is an example. The app port binds to localhost in Compose. `TRUST_PROXY=true` assumes exactly one trusted proxy; do not enable it behind an untrusted direct connection.
7. Set a random `TEACHER_SETUP_KEY` of at least 32 characters in your server environment and open `/auth/setup` to create the owner. The public setup form requires that private key; remove it from the environment after setup. Alternatively, create the owner using `npm run create-admin` in the configured app environment. Supply `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, and a unique `INITIAL_ADMIN_PASSWORD` with at least 16 characters. Remove the initial password afterward. This command refuses to overwrite an existing account. For Compose, use `docker compose --env-file .env.production run --rm -e INITIAL_ADMIN_NAME -e INITIAL_ADMIN_EMAIL -e INITIAL_ADMIN_PASSWORD app node server/create-admin.ts`, with those variables securely provided in your shell.
8. Verify signup, real OTP delivery, large uploads, scanner completion, playback seeking, assignment revocation, and database backup/restore against your deployed services.

Production startup fails if critical configuration is missing, the origin is not HTTPS, demo mode is enabled, or the session secret is a placeholder.

### Media pipeline and CDN

The browser requests an authorized upload ticket, then uploads directly to S3 using a short-lived signed PUT. Completion verifies object size and MIME metadata and moves the database record into `scanning`. A separate scanner validates video structure with ffprobe, scans with ClamAV, and conditionally copies the **exact scanned object** to a new `media/` key. This prevents a reusable upload ticket from modifying approved media. Failed scans never become playable. The editor's **Check scan status** action attaches the approved object.

For a free serverless deployment without an always-running scanner, set `INLINE_UPLOAD_VALIDATION=true`. The API reads only the file signature from the quarantined object, rejects mismatched formats, and promotes the exact object using its ETag. This keeps uploads functional on Vercel, but a dedicated ClamAV worker remains the stronger choice when accepting files from untrusted teachers.

An external scanner can call `POST /api/storage/scan-result` with a bearer `SCANNER_WEBHOOK_SECRET` and `{ "uploadId": "...", "clean": true, "etag": "the-scanned-object-etag" }`. Rejected scans use `clean:false`. Keep this secret restricted to the scanner.

To use CloudFront, configure a distribution with a private S3 origin and a trusted key group, then set `CDN_DOMAIN`, `CDN_KEY_PAIR_ID`, and `CDN_PRIVATE_KEY_BASE64`. The server signs upstream CDN requests for 60 seconds and relays authorized ranges. Private signed URLs never go to the browser. The gateway still carries video traffic so that access can be checked on every request; provision its bandwidth accordingly. [AWS private-content documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PrivateContent.html).

This implementation uses progressive MP4/WebM playback. MOV upload is accepted, but browser playback depends on its codecs. Use H.264/AAC MP4 or compatible WebM for broad support. Adaptive HLS transcoding, DRM, and push/SMS announcements are not included.

### Operations and scope

- Store secrets outside source control. `.env*`, runtime databases, and dependencies are excluded from the source archive.
- Back up PostgreSQL and media; test restoration. Protect and retain audit records according to your organization’s policy.
- Database initialization is idempotent. Future schema changes should use reviewed versioned migrations.
- List pages paginate their rendered rows; a paginated student API is also available. The current teacher overview loads the complete teaching workspace, and authorization builds an in-memory hierarchy per request. For a large institution, replace these with paginated queries/recursive SQL and add load-tested aggregation/caching before scaling.
- Auth rate limits persist in the database. The additional general HTTP limiter is per process; use a shared edge limiter for a multi-instance deployment.
- Thumbnail/profile images are restricted raster data URLs, capped at 150 KB, to keep the local experience self-contained.
- `data/` file storage and signature-only validation are development conveniences. Production uses cloud storage and the separate scanner. Clean up abandoned quarantine objects through a bucket lifecycle policy; retain or remove unreferenced approved objects according to your media policy.
- A production security review, load test, live PostgreSQL/Twilio/S3/CloudFront/ClamAV integration test, and accessibility audit remain deployment responsibilities. The local tests do not certify those external services or a regulatory standard.

## Verification

```sh
npm run build
npm test
npm audit --omit=dev
```

The regression suite launches its own local server and isolated SQLite database. It checks password hashing, role restrictions, CSRF/origin rejection, account isolation, OTP attempt limits and single-use behavior, unauthorized search and playback, inherited access and revocations, hierarchy validation, progress attribution, upload validation, private byte ranges, announcements, and deactivation. It does not contact real OTP or storage services.

The current regression suite includes 25 tests covering authentication, access controls, content operations, and first-owner/team management. The fresh teacher setup page was checked in the local browser. See VERIFICATION.md for scope and remaining external checks.

## Source map

- `src/pages/` — landing page, authentication, student portal, and teacher tools.
- `src/components/Shell.tsx` — responsive workspace navigation and global search.
- `src/lib.tsx` — API client, session context, reusable controls, cards, and illustrations.
- `src/styles.css` — shared responsive design system and reduced-motion rules.
- `server/auth.ts`, `security.ts` — identity, sessions, rate limiting, and authorization.
- `server/api.ts` — learning, profile, teacher management, analytics data, and assignments.
- `server/storage.ts`, `scanner.ts`, `promote-upload.ts` — private uploads, delivery, scanning, and promotion.
- `server/db.ts` — relational schema and database adapters.
- `server/teachers.ts`, `src/pages/TeacherSetup.tsx`, `src/pages/Teachers.tsx` — one-time owner registration and owner-controlled teacher management.
- `api/index.ts`, `vercel.json` — Vercel API entry point and frontend routing.
- `tests/security.test.ts` — isolated API and permission regression suite.
- `deploy/`, `Dockerfile`, `compose.yaml` — production infrastructure examples.


## Connected Supabase installation

This computer's private .env now connects the website to English-Tech in Supabase. Its existing teacher account was migrated and preserved. A fresh source download still contains no accounts or credentials: configure it with the same private database environment values to reuse the existing project. See supabase/README.md for verified behavior and deployment settings.

Google sign-in and email OTP are now implemented but awaiting provider credentials and email sender setup. Follow supabase/AUTH-SETUP.md to activate and test them; they are not live yet.
