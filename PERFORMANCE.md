# Performance verification — 27 September 2026

## Capacity measurements and diagnostics

`npm run test:load` now runs isolated 100 → 200 → 500 student stages and stops on a failed stage. Each stage includes 100 local OTP sign-ins, authenticated learning/search/progress/attendance, teacher record verification, and eight 256 KiB PDF ranges per student from an 8 MiB synthetic transport fixture. Reports are written to ignored `test-results/load-{size}.json` with p50/p95/p99 timings. The fixture is not a renderable PDF; viewer rendering was checked separately below.

All three stages passed on 27 September. Sample p95 response times, in milliseconds:

| Concurrent accounts | Learning | Attendance check-in | 256 KiB PDF range |
| --- | ---: | ---: | ---: |
| 100 | 266 | 383 | 343 |
| 200 | 976 | 944 | 1,635 |
| 500 | 1,673 | 1,496 | 1,892 |

These are single-run localhost measurements with the generator and server on the same Windows machine. They are not production capacity promises or before/after speed comparisons. Larger payloads exposed increasing latency even though correctness checks passed. No production student records were created or changed by these tests.

API requests now have an `X-Request-Id`. Structured `request_performance` logs record every request taking at least one second, server errors and disconnects, plus a 1% sample of successful fast requests. Fields include total duration, database operation count, accumulated database time and connection-pool wait. Parallel database durations can add up to more than wall-clock request duration. Route templates are logged; request bodies, query strings, cookies, student identifiers, SQL and query parameters are excluded. `PERFORMANCE_LOGS=false` disables this logging. Logs are per invocation in the existing Vercel runtime logs, not a persistent analytics database.

PostgreSQL startup logs report whether the configured endpoint is a Supabase transaction pooler on port 6543, without logging credentials. Idle pool errors no longer crash the process. Failed queries discard their connection, and connections are always released. Cancelling a preview now aborts the pending R2/S3 fetch as well as the response stream.

Live Vercel log inspection found an `/api/learning` request received in Mumbai but executed in Washington (`iad1`): 1.50 s function execution and 2.1 s total response. Supabase is in Mumbai. Fluid Compute is already enabled. A separate Mumbai preview (`a737fc3`) subsequently passed database-backed guest browsing and rendered the real 39-page PDF without browser errors. Its `/api/explore` request took 66 ms function execution / 102 ms total in Vercel's logs. The verified `bom1` region is now configured in `vercel.json`. These samples are not equivalent load-test cohorts and should not be presented as a percentage speedup. The live database snapshot showed no blocked-query queue. Cloudflare R2 remains private and stores the existing files. Dashboard access is available; a separate Worker delivery service has not been configured.

The full suite now contains 56 passing tests, including concurrent diagnostic isolation, sensitive-value exclusion, and connection-mode selection. A production-like PostgreSQL/R2 staging run and a sustained real-browser workload are still required before assigning a supported live student count.

## Connection pooling

The production startup diagnostic identified the Supabase shared pooler in session mode on port 5432. On Vercel, the application now selects transaction mode on port 6543 for that same shared-pooler host, preserving credentials, database name and TLS options. This releases underlying database connections between transactions instead of reserving them for each idle application connection. Direct database URLs, other providers, local development and migration scripts are unchanged. The application uses unnamed parameterized queries; its explicit transaction uses one checked-out client and remains supported.

Set `DATABASE_POOL_MODE=session` and redeploy to restore the previous connection mode. Startup logs report the effective port and pooler mode without credentials. The client-side pool remains bounded at five connections per runtime instance; this is not a global connection limit.

## Live release checks

Commit `bdf7028` passed a protected Vercel preview before production release. Both environments logged port 6543 with `supabaseTransactionPooler: true`. The real public 39-page PDF rendered successfully, including partial-content responses. No browser JavaScript errors were observed in the preview verification.

Bounded read-only probes from one Windows client to the live domain on 27 September:

| Endpoint / workload | Simultaneous requests | Median | p95 | Failures |
| --- | ---: | ---: | ---: | ---: |
| Public catalogue, after 1/5/10/25/50 ramp | 100 | 479 ms | 1,007 ms | 0 |
| Public PDF, one 256 KiB range per request, warm ramp | 100 | 1,452 ms | 1,917 ms | 0 |

The first PDF ramp was stopped at 10 concurrent transfers when p95 reached 3,299 ms; all responses were valid. A sampled server request from that burst took 121 ms function execution / 138 ms total in Vercel. A diagnostic rerun measuring headers separately reached 629 ms p95 at 10 concurrent transfers. Only then was a further 25/50/100 ramp run; all returned status 206, the expected byte count and PDF signature. At 100, headers p95 was 1,581 ms and full range p95 was 1,917 ms. Variation includes connection startup, scaling, local network and transfer time; these are brief warm-load measurements, not sustained throughput guarantees.

Production probes did not sign in synthetic users, send OTPs, submit attendance, modify data, or change publication permissions. They do not certify 100 simultaneous complete student sessions, video playback or different mobile networks. Local authenticated tests cover correctness separately. Reports are in ignored `test-results/production-*-probe.json` files. No paid plan was purchased.

## Changes

- Teacher attendance and analysis use `/api/admin/attendance-data`: six database reads instead of the twenty used by the full overview (both counts exclude authentication). Content, assignments and watch history are no longer transferred for these screens.
- Attendance reports index students, profiles, groups and records once rather than repeatedly scanning them for every session and record. The full overview shares the same report assembly.
- Student attendance, profile and onboarding no longer wait for `/api/learning` to fetch the entire workspace.
- The shared PDF viewer renders the current page and its immediate neighbours, releases offscreen canvas buffers, cleans up page resources, and caps each canvas at four million pixels. Zoom and viewport changes preserve the selected page.

## Evidence

- Production build and TypeScript check passed.
- 56 automated tests passed. The isolated classroom test runs 200 accounts concurrently through learning, attendance, search, progress and PDF byte ranges; 100 also sign in using local test OTPs. It makes 500 sign-in requests, 3,400 workspace requests, plus teacher operations and 200 checks that closed attendance disappears.
- The focused attendance response matches the existing overview's attendance records, groups, membership and student report fields. Anonymous and student access to the teacher endpoint remain denied.
- Browser verification used an isolated 60-page PDF: the last page renders after scrolling, previous canvases are removed, and zoom retains the page. Phone-width layout and fullscreen controls were exercised. No console errors were recorded during these checks.
- Teacher browser flow verified creation, closing, analysis listing and student-table preview using disposable local fixture data.
- Live database statistics were read without changing production data. Recorded mean execution times for the main content and asset catalogue queries were below one millisecond; these are SQL execution times, not end-to-end request timings.

## Limits

The classroom simulation uses a local SQLite database, local OTPs and local file delivery. It does not certify production capacity, email-provider throughput, R2 delivery bandwidth, Vercel concurrency or mobile network speeds. Sustained production capacity needs representative authenticated traffic with real media sizes and monitoring of response-time percentiles, errors, database connection waits and hosting limits. No hosting plan, database region or security policy was changed in this update.
