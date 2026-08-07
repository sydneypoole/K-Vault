const assert = require('assert');

class CountingSessionKV {
  constructor(sessionToken, sessionData) {
    this.sessionToken = sessionToken;
    this.sessionData = sessionData;
    this.getCalls = 0;
    this.deletedKeys = [];
  }

  async get(key, options = {}) {
    this.getCalls += 1;
    if (String(key) !== `session:${this.sessionToken}`) return null;
    if (options?.type === 'json') return this.sessionData;
    return JSON.stringify(this.sessionData);
  }

  async delete(key) {
    this.deletedKeys.push(String(key));
  }
}

describe('Auth session cache', function () {
  it('reuses a freshly verified session without another KV read', async function () {
    const { checkAuthentication } = await import('../functions/utils/auth.js');
    const sessionToken = `cache-test-${Date.now()}-${Math.random()}`;
    const kv = new CountingSessionKV(sessionToken, {
      user: 'admin',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    const context = {
      request: new Request('https://example.com/api/manage/list', {
        headers: {
          Cookie: `k_vault_session=${sessionToken}`,
        },
      }),
      env: {
        img_url: kv,
        BASIC_USER: 'admin',
        BASIC_PASS: 'secret',
      },
    };

    const first = await checkAuthentication(context);
    const second = await checkAuthentication(context);

    assert.strictEqual(first.authenticated, true);
    assert.strictEqual(second.authenticated, true);
    assert.strictEqual(kv.getCalls, 1);
  });
});
