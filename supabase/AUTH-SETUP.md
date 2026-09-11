# Activate Google and email verification

The implementation is present, but the external providers are not activated. Teacher password sign-in remains available. No development OTP is displayed by the active installation. The project now has 20 application tables, including temporary OAuth flows, linked identities, and account-bound OTP challenges.

## 1. Google account setup

1. Open https://console.cloud.google.com/ and sign in to your Google account.
2. Select or create a project for English Tech, then open Google Auth Platform.
3. Complete Branding and Audience for your app. If the app is in testing, add the Google accounts that will test it.
4. Under Clients, create an OAuth client of type Web application.
5. Add this authorized redirect URI exactly: `https://cbfeamcsymukjsfmvviq.supabase.co/auth/v1/callback`.
6. Copy the Client ID and Client Secret into the Google provider panel at https://supabase.com/dashboard/project/cbfeamcsymukjsfmvviq/auth/providers?provider=Google . Enter credentials directly there; do not paste them into chat or GitHub.
7. Enable Google and save. Leave Skip nonce checks and Allow users without an email off.
8. In Supabase Authentication > URL Configuration, set Site URL to `http://localhost:3000` while testing. Allow the redirect `http://localhost:3000/api/auth/google/callback**` so the per-request flow parameter is accepted. For deployment use your exact HTTPS domain and remove unused redirects.
9. Set `GOOGLE_AUTH_ENABLED=true` in the website's private .env and restart it.
10. Sign in with your teacher password. In Settings > Profile, choose Connect Google account and select the Google account with the same email. Only then can that teacher use Google sign-in. New Google signups create students only.

## 2. Email sender setup

Supabase's default sender only serves project-team addresses and is limited; it cannot support student signups. Its dashboard currently requires custom SMTP before editing the email templates.

1. Obtain an SMTP host, port, username, password, and verified sender address from your email delivery provider. Check its free allowance and billing terms before choosing it.
2. Enter these directly at https://supabase.com/dashboard/project/cbfeamcsymukjsfmvviq/auth/smtp and save.
3. Under Emails, edit BOTH Confirm sign up and Magic link or OTP templates. Include the one-time code using `{{ .Token }}`. Suggested HTML:

```html
<h2>Your English Tech verification code</h2>
<p>Enter this code in the website:</p>
<p style="font-size:28px;font-weight:bold">{{ .Token }}</p>
<p>The code expires in five minutes. If you did not request it, ignore this email.</p>
```

4. In Sign In / Providers > Email, set OTP length to six digits and expiration to 300 seconds. Keep email confirmation enabled.
5. The app already has `EMAIL_OTP_PROVIDER=supabase`. Set `EMAIL_OTP_READY=true` only once SMTP and templates are configured, then restart.
6. Test with a real student email: request a code, check the inbox/spam folder, verify it, complete onboarding, and confirm the account exists in public.users. Try an invalid code and confirm a used code cannot be reused.

SMS remains a separate Twilio integration; it is not enabled or represented as free. Google and email provider credentials are not included in the source download.

## Verification and boundaries

Build and 32 tests pass. New tests simulate Supabase responses; they do not certify real Google consent or inbox delivery. Live provider tests are still required after the account configuration above. Supabase's database security advisor reports no findings. Provider access/refresh tokens remain server-side and are not returned to the website client; the website issues its own existing secure session. OTP contact changes are bound to the initiating account. Google claims never grant teacher roles.

Official guidance: https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/auth/auth-smtp .
