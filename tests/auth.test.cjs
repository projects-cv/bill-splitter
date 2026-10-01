const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadModule(file, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(name => {
    if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
    return mocks[name];
  }, module, module.exports);
  return module.exports;
}

const core = loadModule('src/auth/authCore.ts');
const { AuthManager, AuthError, normalizePhone, getLoginToken } = core;
const session = (id = 'alice') => ({ user: { id, phone: '+14155550123' }, sessionToken: 'session', refreshToken: id, expiresAt: Date.now() + 600_000 });

function setup(t, overrides = {}, stored = null) {
  const calls = [];
  const manager = new AuthManager({
    verify: async token => { calls.push(['verify', token]); return session(); },
    refresh: async token => { calls.push(['refresh', token]); return session(); },
    logout: async token => { calls.push(['logout', token]); },
    ...overrides,
  }, {
    read: async () => stored,
    write: async token => { stored = token; calls.push(['store', token]); },
  });
  t.after(() => manager.dispose());
  return { manager, calls, stored: () => stored };
}

test('phone normalization requires a country code and rejects malformed numbers', () => {
  assert.equal(normalizePhone(' +1 (415) 555-0123 '), '+14155550123');
  assert.equal(normalizePhone('+44 7911 123456'), '+447911123456');
  for (const bad of ['', '4155550123', '+0123456789', '+1abc4155550123', '+1', '++14155550123', '+1234567890123456']) {
    assert.throws(() => normalizePhone(bad), AuthError);
  }
});

test('login tokens are accepted only on the configured callback URL', () => {
  const url = 'https://cvbillsplitter.netlify.app/';
  assert.equal(getLoginToken(`${url}?t=token`, url), 'token');
  assert.equal(getLoginToken('billsplitter://login?t=token', 'billsplitter://login'), 'token');
  for (const bad of ['https://evil.example/?t=token', `${url}other?t=token`, `${url}?t=one&t=two`, `${url}?t=`, 'https://user@cvbillsplitter.netlify.app/?t=token', 'not-a-url']) {
    assert.equal(getLoginToken(bad, url), null);
  }
});

test('only a verified session unlocks the app; duplicate callback events are ignored', async t => {
  const { manager, calls, stored } = setup(t);
  await manager.restore();
  assert.equal(manager.getSnapshot().session, null);
  await manager.verify('one-time-token');
  assert.equal(manager.getSnapshot().session.user.id, 'alice');
  assert.equal(stored(), 'alice');
  await manager.verify('one-time-token');
  assert.equal(calls.filter(x => x[0] === 'verify').length, 1);
});

test('restore verifies the saved refresh token with the provider', async t => {
  const { manager, calls } = setup(t, {}, 'saved-token');
  assert.equal(manager.getSnapshot().session, null);
  await manager.restore();
  assert.deepEqual(calls[0], ['refresh', 'saved-token']);
  assert.equal(manager.getSnapshot().session.user.id, 'alice');
});

test('expired links and revoked sessions remain signed out', async t => {
  const { manager, stored } = setup(t, {
    verify: async () => { throw new AuthError('Expired link', true); },
    refresh: async () => { throw new AuthError('Expired session', true); },
  }, 'revoked-token');
  await manager.restore();
  assert.equal(manager.getSnapshot().session, null);
  assert.equal(stored(), null);
  await manager.verify('expired');
  assert.equal(manager.getSnapshot().error, 'Expired link');
  assert.equal(manager.getSnapshot().canRetry, false);
});

test('a temporary connection failure preserves the token for a successful retry', async t => {
  let offline = true;
  const { manager, stored } = setup(t, { refresh: async () => {
    if (offline) throw new Error('Offline'); return session();
  } }, 'saved-token');
  await manager.restore();
  assert.equal(manager.getSnapshot().session, null);
  assert.equal(manager.getSnapshot().canRetry, true);
  assert.equal(stored(), 'saved-token');
  offline = false;
  await manager.retry();
  assert.equal(manager.getSnapshot().session.user.id, 'alice');
});

test('logging out prevents an older in-flight refresh from logging back in', async t => {
  let resolve;
  const { manager, stored } = setup(t, { refresh: () => new Promise(r => { resolve = r; }) }, 'alice');
  const restore = manager.restore();
  await Promise.resolve();
  await manager.signOut();
  resolve(session());
  await restore;
  assert.equal(manager.getSnapshot().session, null);
  assert.equal(stored(), null);
});

test('a newer login wins when callback requests finish out of order', async t => {
  let resolve;
  const { manager, stored } = setup(t, {
    verify: token => token === 'old' ? new Promise(r => { resolve = r; }) : Promise.resolve(session('bob')),
  });
  const old = manager.verify('old');
  await manager.verify('new');
  resolve(session('alice'));
  await old;
  assert.equal(manager.getSnapshot().session.user.id, 'bob');
  assert.equal(stored(), 'bob');
});

test('logout clears the local token and revokes the provider session', async t => {
  const { manager, stored, calls } = setup(t);
  await manager.verify('login');
  await manager.signOut();
  assert.equal(stored(), null);
  assert.equal(manager.getSnapshot().session, null);
  assert.ok(calls.some(x => x[0] === 'logout' && x[1] === 'alice'));
});

test('sessions refresh before expiration without hiding the active account', async t => {
  let resolve;
  const { manager } = setup(t, {
    verify: async () => ({ ...session(), expiresAt: Date.now() + 50_000 }),
    refresh: () => new Promise(r => { resolve = r; }),
  });
  await manager.verify('login');
  const refresh = manager.refreshIfNeeded();
  assert.equal(manager.getSnapshot().session.user.id, 'alice');
  assert.equal(manager.getSnapshot().loading, false);
  resolve(session());
  await refresh;
  assert.ok(manager.getSnapshot().session.expiresAt - Date.now() > 60_000);
});

test('an expired session locks the app when it cannot be refreshed', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { manager } = setup(t, { verify: async () => ({ ...session(), expiresAt: Date.now() + 1000 }) });
  await manager.verify('login');
  t.mock.timers.tick(1001);
  assert.equal(manager.getSnapshot().session, null);
  assert.equal(manager.getSnapshot().canRetry, true);
});

test('a storage failure never silently grants a persistent session', async t => {
  const manager = new AuthManager({ verify: async () => session() }, {
    read: async () => null,
    write: async () => { throw new Error('Storage unavailable'); },
  });
  t.after(() => manager.dispose());
  await manager.verify('login');
  assert.equal(manager.getSnapshot().session, null);
  assert.equal(manager.getSnapshot().canRetry, true);
});

test('unsuccessful provider logout stays locked and can be retried', async t => {
  let offline = true;
  const { manager, stored } = setup(t, { logout: async () => { if (offline) throw new Error('offline'); } });
  await manager.verify('login');
  await manager.signOut();
  assert.equal(stored(), null);
  assert.equal(manager.getSnapshot().session, null);
  assert.equal(manager.getSnapshot().canRetry, true);
  offline = false;
  await manager.retry();
  assert.equal(manager.getSnapshot().error, null);
  assert.equal(manager.getSnapshot().session, null);
});

test('provider integration sends SMS signup-or-login and rejects unverified phone identities', async () => {
  process.env.EXPO_PUBLIC_DESCOPE_PROJECT_ID = 'test-project';
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL = 'https://cvbillsplitter.netlify.app/';
  const calls = [];
  const data = { sessionJwt: 'session', refreshJwt: 'refresh', sessionExpiration: Math.floor(Date.now() / 1000) + 600,
    user: { userId: 'alice', phone: '+14155550123', verifiedPhone: true } };
  const api = loadModule('src/auth/authClient.ts', {
    './authCore': core, 'react-native': { Platform: { OS: 'web' } },
    '@descope/core-js-sdk': () => ({ magicLink: {
      signUpOrIn: { sms: async (...args) => { calls.push(args); return { ok: true, data: {} }; } },
      verify: async () => ({ ok: true, data }),
    } }),
  });
  await api.sendLoginLink('+1 (415) 555-0123');
  assert.deepEqual(calls, [['+14155550123', 'https://cvbillsplitter.netlify.app/']]);
  assert.equal((await api.authApi.verify('token')).user.id, 'alice');
  data.user.verifiedPhone = false;
  await assert.rejects(api.authApi.verify('token'), /verified phone/);
});

test('failed SMS requests expose safe references and useful actions without provider details', async () => {
  process.env.EXPO_PUBLIC_DESCOPE_PROJECT_ID = 'test-project';
  let response;
  const api = loadModule('src/auth/authClient.ts', {
    './authCore': core, 'react-native': { Platform: { OS: 'web' } },
    '@descope/core-js-sdk': () => ({ magicLink: {
      signUpOrIn: { sms: async () => response },
    } }),
  });
  for (const [status, code, expected] of [
    [400, 'E061003', /configured by the app owner/],
    [401, 'E071001', /configured by the app owner/],
    [400, 'E013009', /configured by the app owner/],
    [400, 'E032106', /Check the number and country code/],
    [429, 'E032101', /temporarily limited/],
    [400, 'E032101', /contact the app owner/],
    [503, 'E999999', /temporarily unavailable/],
    [400, 'E123456', /contact the app owner/],
    [400, 'phone +14155550123 token secret', /contact the app owner/],
    [400, undefined, /contact the app owner/],
  ]) {
    response = { ok: false, code: status, error: {
      errorCode: code, errorDescription: '+14155550123', errorMessage: 'token secret',
    } };
    await assert.rejects(api.sendLoginLink('+14155550123'), error => {
      assert.ok(error instanceof AuthError);
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /14155550123|secret/);
      if (code && /^E\d{6}$/.test(code)) assert.ok(error.message.includes(`Reference: ${code}.`));
      else assert.doesNotMatch(error.message, /Reference:/);
      return true;
    });
  }
});
