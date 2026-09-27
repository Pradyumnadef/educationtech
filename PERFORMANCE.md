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

Live Vercel log inspection found an `/api/learning` request received in Mumbai but executed in Washington (`iad1`): 1.50 s function execution and 2.1 s total response. Supabase is in Mumbai. Fluid Compute is already enabled. A separate Mumbai preview (`a737fc3`) subsequently passed database-backed guest browsing and rendered the real 39-page PDF without browser errors. Its `/api/explore` request took 66 ms function execution / 102 ms total in Vercel's logs. The verified `bom1` region is now configured in `vercel.json`. These samples are not equivalent load-test cohorts and should not be presented as a percentage speedup. The live database snapshot showed no blocked-query queue. Cloudflare dashboard currently requires sign-in, so authenticated Worker delivery has not been configured.

The full suite now contains 54 passing tests, including concurrent diagnostic isolation and sensitive-value exclusion. A production-like PostgreSQL/R2 staging run and a sustained real-browser workload are still required before assigning a supported live student count.

## Changes

- Teacher attendance and analysis use `/api/admin/attendance-data`: six database reads instead of the twenty used by the full overview (both counts exclude authentication). Content, assignments and watch history are no longer transferred for these screens.
- Attendance reports index students, profiles, groups and records once rather than repeatedly scanning them for every session and record. The full overview shares the same report assembly.
- Student attendance, profile and onboarding no longer wait for `/api/learning` to fetch the entire workspace.
- The shared PDF viewer renders the current page and its immediate neighbours, releases offscreen canvas buffers, cleans up page resources, and caps each canvas at four million pixels. Zoom and viewport changes preserve the selected page.

## Evidence

- Production build and TypeScript check passed.
- 53 automated tests passed. The isolated classroom test runs 200 accounts concurrently through learning, attendance, search, progress and PDF byte ranges; 100 also sign in using local test OTPs. It makes 500 sign-in requests, 3,400 workspace requests, plus teacher operations and 200 checks that closed attendance disappears.
- The focused attendance response matches the existing overview's attendance records, groups, membership and student report fields. Anonymous and student access to the teacher endpoint remain denied.
- Browser verification used an isolated 60-page PDF: the last page renders after scrolling, previous canvases are removed, and zoom retains the page. Phone-width layout and fullscreen controls were exercised. No console errors were recorded during these checks.
- Teacher browser flow verified creation, closing, analysis listing and student-table preview using disposable local fixture data.
- Live database statistics were read without changing production data. Recorded mean execution times for the main content and asset catalogue queries were below one millisecond; these are SQL execution times, not end-to-end request timings.

## Limits

The classroom simulation uses a local SQLite database, local OTPs and local file delivery. It does not certify production capacity, email-provider throughput, R2 delivery bandwidth, Vercel concurrency or mobile network speeds. Sustained production capacity needs representative authenticated traffic with real media sizes and monitoring of response-time percentiles, errors, database connection waits and hosting limits. No hosting plan, database region or security policy was changed in this update.
