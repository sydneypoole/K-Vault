const assert = require('assert');

class MemoryKV {
  constructor(initial = {}) {
    this.store = new Map(Object.entries(initial));
  }

  async get(key, options = {}) {
    const value = this.store.get(String(key));
    if (value == null) return null;
    if (options?.type === 'json') return JSON.parse(String(value));
    return String(value);
  }

  async put(key, value) {
    this.store.set(String(key), String(value));
  }
}

class FailingReadKV {
  async get() {
    throw new Error('KV get() limit exceeded for the day.');
  }

  async put() {}
}

describe('UI config API', function () {
  it('falls back to defaults instead of returning 500 when KV reads are exhausted', async function () {
    const { onRequestGet } = await import('../functions/api/ui-config.js');
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      const response = await onRequestGet({
        env: { img_url: new FailingReadKV() },
        request: new Request('https://example.com/api/ui-config'),
      });

      const payload = await response.json();
      assert.strictEqual(response.status, 200);
      assert.strictEqual(payload.success, true);
      assert.strictEqual(payload.source, 'default');
      assert.strictEqual(payload.binding, 'img_url');
      assert.strictEqual(payload.warning.code, 'KV_READ_FAILED');
      assert.strictEqual(payload.config.version, 1);
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('marks successful GET responses cacheable for short-lived UI config reuse', async function () {
    const { onRequestGet } = await import('../functions/api/ui-config.js');
    const kv = new MemoryKV({
      ui_config: JSON.stringify({
        baseColor: '#ffffff',
        effectStyle: 'none',
      }),
    });

    const response = await onRequestGet({
      env: { img_url: kv },
      request: new Request('https://example.com/api/ui-config'),
    });

    const payload = await response.json();
    assert.strictEqual(response.status, 200);
    assert.strictEqual(payload.success, true);
    assert.strictEqual(payload.config.baseColor, '#ffffff');
    assert.match(response.headers.get('Cache-Control') || '', /max-age=300/);
  });
});
