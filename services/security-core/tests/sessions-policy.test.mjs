import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSessionVerifier, randomSessionToken, sessionCookie, clearSessionCookie } from '../src/sessions.mjs';
import { authorize } from '../src/policy.mjs';

const time = 1_800_000_000_000;
const rawToken = Buffer.alloc(32, 27).toString('base64url');
const request = (cookie = `__Host-nortivo_security_core=${rawToken}`) => new Request('https://nortivo.example/private', { headers: { cookie } });
const record = extra => ({subjectId:'account-1', createdAt:time-10_000, expiresAt:time+60_000, roles:['user'], ...extra});
const hasError = (status, code) => error => error.status === status && error.code === code;
const verifier = value => createSessionVerifier({lookupSession:async()=>value, now:()=>time});

test('session hashes credential, checks live storage each request and returns frozen trusted attributes', async () => {
  const calls = [];
  let active = record({mfaVerifiedAt:time-1000});
  const verify = createSessionVerifier({lookupSession:async (...args)=>{calls.push(args);return active;},now:()=>time});
  const principal = await verify(request());
  assert.equal(principal.id, 'account-1');
  assert.equal(principal.sessionHash, createHash('sha256').update(rawToken).digest('hex'));
  assert.deepEqual(calls[0], [principal.sessionHash,time]);
  assert.equal(JSON.stringify(principal).includes(rawToken), false);
  assert.throws(()=>principal.roles.push('admin'));
  assert.throws(()=>{principal.id='account-2';});
  active = null;
  await assert.rejects(verify(request()), hasError(401,'AUTH_REQUIRED'));
  assert.equal(calls.length, 2);
});

test('missing, duplicate, invalid, noncanonical and oversized cookies never reach session storage', async () => {
  let calls = 0;
  const verify = createSessionVerifier({lookupSession:async()=>{calls++;return record();},now:()=>time});
  const invalid = ['',`other=${rawToken}`,`__Host-nortivo_security_core=${rawToken}; __Host-nortivo_security_core=${rawToken}`,
    '__Host-nortivo_security_core=bad', `__Host-nortivo_security_core=${rawToken}=`,
    `__Host-nortivo_security_core=${'A'.repeat(42)}B`, `x=${'a'.repeat(8192)}; __Host-nortivo_security_core=${rawToken}`];
  for (const cookie of invalid) await assert.rejects(verify(request(cookie)), hasError(401,'AUTH_REQUIRED'));
  assert.equal(calls, 0);
});

test('expired, revoked, future-created and overlong sessions fail closed', async () => {
  for (const value of [null, record({expiresAt:time}), record({revokedAt:time-1}), record({revokedAt:0}),
    record({createdAt:time+1}), record({createdAt:time-8*60*60*1000, expiresAt:time+1}),
    record({createdAt:NaN}), record({expiresAt:'forever'}), record({roles:['user','user']}),
    record({roles:['user\nadmin']}), record({subjectId:''}),record({mfaVerifiedAt:'yes'})]) {
    await assert.rejects(verifier(value)(request()),hasError(401,'AUTH_REQUIRED'));
  }
});

test('storage failures return availability error and never a cached or anonymous identity', async () => {
  const verify = createSessionVerifier({lookupSession:async()=>{throw new Error('private connection string');},now:()=>time});
  await assert.rejects(verify(request()),error=>hasError(503,'AUTH_UNAVAILABLE')(error) && !error.message.includes('connection'));
});

test('cookie helpers use canonical random tokens and secure host-only attributes', () => {
  const generated = randomSessionToken();
  assert.equal(Buffer.from(generated,'base64url').length,32);
  assert.match(sessionCookie(generated), /^__Host-nortivo_security_core=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800$/);
  assert.doesNotMatch(sessionCookie(generated),/Domain=/);
  assert.match(clearSessionCookie(),/Max-Age=0$/);
  assert.throws(()=>sessionCookie('bad'));
  assert.throws(()=>sessionCookie(generated,{cookieName:'bad\r\nInjected'}));
  assert.throws(()=>sessionCookie(generated,{maxAgeSeconds:Infinity}));
});

test('policy denies unconfigured, anonymous, missing roles and forged ownership requests', () => {
  const principal = {id:'account-1',roles:['user'],mfaVerifiedAt:null};
  assert.throws(()=>authorize(null,{roles:['user']},time),hasError(401,'AUTH_REQUIRED'));
  assert.throws(()=>authorize(principal,{},time),hasError(403,'FORBIDDEN'));
  assert.throws(()=>authorize(principal,{roles:['support']},time),hasError(403,'FORBIDDEN'));
  assert.throws(()=>authorize({...principal,roles:['superuser']},{roles:['admin']},time),hasError(403,'FORBIDDEN'));
  assert.throws(()=>authorize(principal,{ownerId:'account-2'},time),hasError(403,'FORBIDDEN'));
  assert.throws(()=>authorize(principal,{roles:['user'],ownerId:'account-2'},time),hasError(403,'FORBIDDEN'));
  assert.throws(()=>authorize(principal,{roles:['admin'],ownerId:'account-1'},time),hasError(403,'FORBIDDEN'));
  assert.equal(authorize(principal,{roles:['user'],ownerId:'account-1'},time),principal);
  assert.equal(authorize(principal,{ownerId:'account-1'},time),principal);
});

test('admin policy always needs recent trusted MFA and rejects future or stale timestamps', () => {
  const admin = {id:'admin-1',roles:['admin'],mfaVerifiedAt:time-1000};
  assert.equal(authorize(admin,{roles:['admin']},time),admin);
  for (const mfaVerifiedAt of [null,undefined,time+1,time-300_000,NaN,'verified']) {
    assert.throws(()=>authorize({...admin,mfaVerifiedAt},{roles:['admin']},time),hasError(403,'MFA_REQUIRED'));
  }
  assert.throws(()=>authorize({...admin,mfaVerifiedAt:null},{ownerId:'admin-1'},time),hasError(403,'MFA_REQUIRED'));
  const user = {id:'user-1',roles:['user'],mfaVerifiedAt:null};
  assert.throws(()=>authorize(user,{roles:['user'],requireMfa:true},time),hasError(403,'MFA_REQUIRED'));
});
