import { createClient } from '@supabase/supabase-js';
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { id, now, one, insert, run, production } from './db.ts';
import { hash, throttle, createSession, audit } from './security.ts';

export function authClient(storage?: Record<string, string>) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY)
    throw Object.assign(new Error('Authentication delivery is not configured yet.'), { status: 503 });
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: !!storage, detectSessionInUrl: false,
      flowType: 'pkce', ...(storage ? { storage: {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => { storage[key] = value; },
        removeItem: (key: string) => { delete storage[key]; },
      }} : {}) },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
  });
}
export async function sendEmailOtp(email: string) {
  if (process.env.EMAIL_OTP_READY !== 'true') throw Object.assign(new Error('Email verification is awaiting sender setup. Please contact your teacher.'), { status: 503 });
  const { error } = await authClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw Object.assign(new Error(error.status === 429
    ? 'Email delivery limit reached. Please wait and try again.'
    : 'Email could not be sent. Your teacher needs to check the email delivery settings.'), { status: error.status === 429 ? 429 : 503 });
}
export async function verifyEmailOtp(email: string, code: string) {
  const client = authClient();
  const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error || !data.session) return false;
  const verified = await client.auth.getUser(data.session.access_token);
  return !verified.error && !!verified.data.user?.email_confirmed_at && verified.data.user.email?.toLowerCase() === email;
}

export const socialAuth = Router();
socialAuth.get('/options', (_req, res) => res.json({
  google: process.env.GOOGLE_AUTH_ENABLED === 'true',
  emailOtp: process.env.EMAIL_OTP_PROVIDER === 'supabase',
  emailReady: process.env.EMAIL_OTP_READY === 'true',
  sms: !!process.env.TWILIO_VERIFY_SERVICE_SID,
}));
socialAuth.post('/google/start', async (req, res) => {
  const { action, returnTo } = z.object({
    action: z.enum(['login', 'signup', 'link']).default('login'),
    returnTo: z.string().max(2048).regex(/^\/(?:app|admin)(?:\/|\?|$)[^\r\n]*$/).optional(),
  }).parse(req.body);
  if (req.headers.origin !== (process.env.APP_ORIGIN || 'http://localhost:3000'))
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  if (process.env.GOOGLE_AUTH_ENABLED !== 'true')
    return res.status(503).json({ error: 'Google sign-in is awaiting provider setup. Please use the available sign-in method.' });
  const current = (req as any).user;
  if (action === 'link' && !current) return res.status(401).json({ error: 'Sign in before connecting Google.' });
  await throttle(`google:${req.ip}`, 10, 900000);
  await run('DELETE FROM oauth_flows WHERE expires_at<=?', [now()]);
  const flow = id(), browser = randomBytes(32).toString('hex'), storage: Record<string,string> = {};
  const { data, error } = await authClient(storage).auth.signInWithOAuth({ provider: 'google', options: {
    redirectTo: `${process.env.APP_ORIGIN || 'http://localhost:3000'}/api/auth/google/callback?flow=${flow}`,
    skipBrowserRedirect: true, queryParams: { prompt: 'select_account' },
  }});
  if (error || !data.url) return res.status(503).json({ error: 'Google sign-in could not start. Try again shortly.' });
  await insert('oauth_flows', { id: flow, browser_hash: hash(browser), state: JSON.stringify({ storage, returnTo }), action,
    user_id: action === 'link' ? current.id : null, expires_at: now()+300000 });
  res.cookie('english_tech_oauth', browser, { httpOnly: true, secure: production, sameSite: 'lax', path: '/api/auth/google', maxAge: 300000 });
  res.json({ url: data.url });
});
socialAuth.get('/google/callback', async (req, res) => {
  const fail = () => res.redirect('/auth/login?authError=google');
  const flow = z.uuid().safeParse(req.query.flow);
  const cookie = req.cookies?.english_tech_oauth;
  if (!flow.success || typeof cookie !== 'string') return fail();
  const state = await one('DELETE FROM oauth_flows WHERE id=? AND browser_hash=? AND expires_at>? RETURNING *', [flow.data, hash(cookie), now()]);
  res.clearCookie('english_tech_oauth', { path: '/api/auth/google' });
  if (!state || typeof req.query.code !== 'string' || req.query.code.length > 2048) return fail();
  try {
    const saved = JSON.parse(state.state);
    const storage = saved.storage || saved;
    const returnTo = typeof saved.returnTo === 'string' ? saved.returnTo : '';
    const client = authClient(storage);
    const { data, error } = await client.auth.exchangeCodeForSession(req.query.code);
    if (error || !data.session) return fail();
    const verified = await client.auth.getUser(data.session.access_token);
    const identity = verified.data.user;
    const google = identity?.identities?.find(i => i.provider === 'google');
    const subject = google?.identity_data?.sub;
    const email = identity?.email?.toLowerCase();
    if (verified.error || !identity?.email_confirmed_at || !google || typeof subject !== 'string' || !email || google.identity_data?.email_verified !== true || google.identity_data?.email?.toLowerCase() !== email) return fail();
    const linked = await one('SELECT * FROM external_identities WHERE provider=? AND subject=?', ['google', subject]);
    let user;
    if (state.action === 'link') {
      user = (req as any).user;
      if (!user || user.id !== state.user_id || user.email?.toLowerCase() !== email || (linked && linked.user_id !== user.id)) return fail();
    } else if (linked) user = await one('SELECT * FROM users WHERE id=?', [linked.user_id]);
    else {
      user = await one('SELECT * FROM users WHERE email=?', [email]);
      // A teacher must explicitly connect Google from an authenticated profile.
      if (user?.role === 'admin') return res.redirect('/auth/admin?authError=linkGoogle');
      if (!user) {
        if (state.action !== 'signup') return res.redirect('/auth/signup?authError=signup');
        user = await insert('users', { id: id(), role: 'student', name: 'New learner', email, status: 'active',
          avatar: '', interests: '[]', onboarding: 0, created_at: now(), updated_at: now() });
      }
    }
    if (!user || user.status !== 'active') return fail();
    if (!linked) {
      await run('INSERT INTO external_identities(id,provider,subject,user_id,created_at) VALUES (?,?,?,?,?) ON CONFLICT(provider,subject) DO NOTHING', [id(),'google',subject,user.id,now()]);
      const mapping = await one('SELECT user_id FROM external_identities WHERE provider=? AND subject=?', ['google',subject]);
      if (mapping?.user_id !== user.id) return fail();
    }
    await createSession(res, user);
    await audit(user.id, state.action === 'link' ? 'google.link' : 'google.login', user.id);
    const allowedReturn = user.role === 'admin'
      ? /^\/admin(?:\/|\?|$)/.test(returnTo)
      : /^\/app(?:\/|\?|$)/.test(returnTo);
    res.redirect(user.role !== 'admin' && !user.onboarding
      ? '/onboarding'
      : allowedReturn ? returnTo : '/?signedIn=1');
  } catch { return fail(); }
});
