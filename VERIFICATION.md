# Verification record

Verified locally on 11 September 2026 using Node 24 and the SQLite development adapter.

## Current release

- TypeScript validation and production frontend build passed.
- Automated tests: **25 passed, 0 failed**.
- First-teacher setup renders correctly in the local browser, including the narrow mobile pane. The active setup form is left unclaimed for the owner.
- No accounts or content are created automatically. Old local accounts, media, and seed scripts were moved outside the application and release archive. Permanent deletion was blocked by automatic approval review.
- The source package excludes local databases, uploaded media, actual environment files, dependencies, and test output. Test fixture identities exist only in regression tests.

## Automated coverage

The existing 18 tests cover salted password verification, permission inheritance and direct revocation, publication gates, anonymous/student/admin authorization, CSRF, private search and progress isolation, profile privilege protection, OTP expiration and attempt limits, hierarchy CRUD, upload validation, authorized media byte ranges, announcements, account deactivation, and group access.

Seven additional tests cover empty startup, setup-key/origin/password validation, concurrent owner registration, setup closure across restarts, owner-only teacher creation, duplicate accounts, protecting the owner from deactivation, blocking student and ordinary teacher team management, and invalidating teacher sessions on deactivation. Tests use separate temporary databases; they do not populate the active app.

## Still requires external verification

The PostgreSQL owner transaction and production schema have not been exercised against a live PostgreSQL service. Real OTP delivery, private cloud storage, scanning/promotion, backups, monitoring, and HTTPS require configured provider services. The Vercel adapter and routing configuration are included but have not been deployed. Google sign-in is not implemented in this release. Long video delivery and scheduled cleanup must be reviewed against the chosen host's limits. Load testing and independent accessibility/security review remain outstanding.

See README.md and GITHUB-VERCEL.md for configuration and deployment boundaries.

## Supabase connection update

English-Tech is now connected to live Supabase PostgreSQL with a restricted server role and verified TLS. Existing local records, including the owner session, were migrated transactionally with matching row counts. Browser profile save was verified in the remote users table while the old local SQLite snapshot remained unchanged. Supabase security advisor: no findings. Build and 25 isolated regression tests passed after integration. See supabase/README.md for configuration and remaining media/OTP/deployment work.

## Google and email authentication implementation

Google OAuth/PKCE and Supabase email OTP support are now implemented. Build and 32 tests pass, including 7 provider-simulated tests for state binding, replay/expiry rejection, teacher link protection, verified identity checks, inactive users, OTP delivery errors, and contact ownership. These are not live Google/email delivery tests. The provider dashboard has empty Google credentials and no custom SMTP sender. Activation is intentionally gated pending those configurations; teacher password access is preserved and displayed local OTPs are disabled in the active installation. See supabase/AUTH-SETUP.md.
