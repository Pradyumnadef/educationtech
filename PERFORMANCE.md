# Performance verification — 27 September 2026

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
