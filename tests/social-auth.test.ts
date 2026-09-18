import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
mkdirSync('test-results', { recursive: true });
const directory = mkdtempSync(path.resolve('test-results/social-'));
Object.assign(process.env, { DATA_DIR: directory, DATABASE_URL: '', NODE_ENV: 'development',
  LOCAL_OTP: 'false', DEMO_MODE: 'false', SUPABASE_URL: 'https://auth.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'test-publishable', GOOGLE_AUTH_ENABLED: 'true', EMAIL_OTP_READY: 'true',
  EMAIL_OTP_PROVIDER: 'supabase', APP_ORIGIN: 'http://localhost:3112', SESSION_SECRET: 'isolated-social-test-secret-123456789' });
const db = await import('../server/db.ts');
const security = await import('../server/security.ts');
const { socialAuth } = await import('../server/supabase-auth.ts');
const { authRoutes } = await import('../server/auth.ts');
await db.initDB();
const app = express(); app.use(express.json(), cookieParser(), security.session, security.csrf);
app.use('/api/auth', authRoutes, socialAuth);
const server = app.listen(3112, '127.0.0.1');
const originalFetch = globalThis.fetch;
let email = 'learner@example.test', verified = true, providerError = false;
const user = () => ({ id: '00000000-0000-4000-8000-000000000001', email,
  email_confirmed_at: verified ? new Date().toISOString() : null,
  identities: [{ id: 'identity', provider: 'google', identity_data: { sub: email, email, email_verified: verified } }],
  app_metadata: { provider: 'google' }, user_metadata: { role: 'admin' }, aud: 'authenticated', created_at: new Date().toISOString() });
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith('https://auth.example.test/')) return originalFetch(input,init);
  if (providerError) return Response.json({ msg: 'Delivery failed' }, {status: 429});
  if (url.includes('/otp')) return Response.json({});
  if (url.includes('/user')) return Response.json(user());
  if (url.includes('/token') || url.includes('/verify')) {
    const body = JSON.parse(String(init?.body || '{}'));
    if (url.includes('/verify') && !['123456', '12345678'].includes(body.token)) return Response.json({msg:'Invalid token'}, {status:400});
    const token = ['header', Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000)+3600, sub: user().id })).toString('base64url'), 'signature'].join('.');
    return Response.json({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user: user() });
  }
  throw new Error('Unexpected mocked provider route');
};
async function request(route:string, body?:any, cookie='', csrf='') {
  const response = await originalFetch('http://127.0.0.1:3112/api/auth'+route, { method: body ? 'POST':'GET', redirect:'manual',
    headers: { Origin:'http://localhost:3112', 'Content-Type':'application/json', Cookie:cookie, 'X-CSRF-Token':csrf }, body: body ? JSON.stringify(body):undefined });
  return { response, data: await response.clone().json().catch(()=>null), cookie:response.headers.get('set-cookie')?.split(';')[0] || '' };
}
async function start(action='signup') {
  const r = await request('/google/start',{action}); assert.equal(r.response.status,200);
  const redirect = new URL(r.data.url).searchParams.get('redirect_to')!;
  return { ...r, callback:'/google/callback?flow='+new URL(redirect).searchParams.get('flow')+'&code=provider-code' };
}
test('Google callback rejects missing browser state, supports PKCE and prevents replay', async()=> {
  const r = await start();
  assert.ok(new URL(r.data.url).searchParams.get('code_challenge'));
  const denied = await request(r.callback); assert.match(denied.response.headers.get('location')!, /authError/);
  const accepted = await request(r.callback,undefined,r.cookie); assert.equal(accepted.response.headers.get('location'),'/onboarding');
  const saved = await db.one('SELECT * FROM users WHERE email=?',[email]); assert.equal(saved.role,'student');
  const replay = await request(r.callback,undefined,r.cookie); assert.match(replay.response.headers.get('location')!,/authError/);
});
test('Google cannot auto-link a teacher or authenticate an unverified identity', async()=> {
  email='teacher@example.test';
  await db.insert('users',{id:db.id(),role:'admin',name:'Teacher',email,status:'active',created_at:db.now(),updated_at:db.now()});
  const r=await start('login'); const callback=await request(r.callback,undefined,r.cookie);
  assert.equal(callback.response.headers.get('location'),'/auth/admin?authError=linkGoogle');
  email='unverified@example.test'; verified=false;
  const v=await start(); assert.match((await request(v.callback,undefined,v.cookie)).response.headers.get('location')!,/authError/);
  assert.equal(await db.one('SELECT id FROM users WHERE email=?',[email]),undefined); verified=true;
});
test('Google denies inactive accounts and anonymous identity linking',async()=> {
  email='learner@example.test'; await db.run("UPDATE users SET status='inactive' WHERE email=?",[email]);
  const r=await start('login'); assert.match((await request(r.callback,undefined,r.cookie)).response.headers.get('location')!,/authError/);
  assert.equal((await request('/google/start',{action:'link'})).response.status,401);
});
test('Real OTP adapter handles delivery failure, invalid codes, valid verification and replay without exposing codes',async()=> {
  email='otp@example.test'; providerError=true;
  assert.equal((await request('/otp/send',{identifier:email,purpose:'signup'})).response.status,429); providerError=false;
  const sent=await request('/otp/send',{identifier:email,purpose:'signup'}); assert.equal(sent.response.status,200); assert.equal(sent.data.demoCode,undefined);
  assert.equal((await request('/otp/verify',{challenge:sent.data.challenge,code:'111111'})).response.status,400);
  const passed=await request('/otp/verify',{challenge:sent.data.challenge,code:'12345678'}); assert.equal(passed.response.status,200); assert.equal(passed.data.user.role,'student');
  assert.equal((await request('/otp/verify',{challenge:sent.data.challenge,code:'12345678'})).response.status,400);
});

test('An authenticated teacher can explicitly link Google and sign in again', async()=> {
  email='teacher@example.test';
  const teacher=await db.one('SELECT * FROM users WHERE email=?',[email]);
  let cookie='';
  const session=await security.createSession({cookie:(name:string,value:string)=>{cookie=name+'='+value}} as any,teacher);
  const r=await request('/google/start',{action:'link'},cookie,session.csrf);
  assert.equal(r.response.status,200);
  const redirect=new URL(new URL(r.data.url).searchParams.get('redirect_to')!);
  const callback='/google/callback?flow='+redirect.searchParams.get('flow')+'&code=provider-code';
  const linked=await request(callback,undefined,cookie+'; '+r.cookie);
  assert.equal(linked.response.headers.get('location'),'/?signedIn=1');
  const again=await start('login');
  assert.equal((await request(again.callback,undefined,again.cookie)).response.headers.get('location'),'/?signedIn=1');
});
test('Expired Google flows cannot create a session',async()=> {
  email='expired@example.test'; const r=await start();
  await db.run('UPDATE oauth_flows SET expires_at=0');
  assert.match((await request(r.callback,undefined,r.cookie)).response.headers.get('location')!,/authError/);
});
test('Contact OTPs cannot be transferred to another user',async()=> {
  email='contact@example.test';
  const teacher=await db.one("SELECT * FROM users WHERE role='admin'");
  let cookie=''; const session=await security.createSession({cookie:(n:string,v:string)=>{cookie=n+'='+v}} as any,teacher);
  const sent=await request('/otp/send',{identifier:email,purpose:'email'},cookie,session.csrf);
  assert.equal(sent.response.status,200);
  assert.equal((await request('/otp/verify',{challenge:sent.data.challenge,code:'123456'})).response.status,403);
});
after(async()=>{ globalThis.fetch=originalFetch; await new Promise<void>(resolve=>server.close(()=>resolve())); await db.closeDB(); rmSync(directory,{recursive:true,force:true}); });
