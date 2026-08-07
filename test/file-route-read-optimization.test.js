const assert = require('assert');

class CountingKV {
  constructor(records = {}) {
    this.records = new Map(Object.entries(records));
    this.getWithMetadataCalls = [];
  }

  async getWithMetadata(key) {
    this.getWithMetadataCalls.push(String(key));
    const metadata = this.records.get(String(key));
    if (!metadata) return null;
    return {
      value: '',
      metadata,
    };
  }
}

describe('File route KV read optimization', function () {
  const originalFetch = global.fetch;

  afterEach(function () {
    global.fetch = originalFetch;
  });

  it('checks an exact unprefixed file key before probing storage prefixes', async function () {
    const { onRequest } = await import('../functions/file/[id].js');
    const kv = new CountingKV({
      'plain-photo.png': {
        TimeStamp: Date.now(),
        ListType: 'None',
        Label: 'None',
        fileName: 'plain-photo.png',
        storageType: 'telegram',
      },
    });

    global.fetch = async (url) => {
      const textUrl = String(url);
      if (textUrl.includes('/getFile')) {
        return new Response(JSON.stringify({
          ok: true,
          result: { file_path: 'photos/plain-photo.png' },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (textUrl.includes('/file/bot')) {
        return new Response('image-bytes', {
          status: 200,
          headers: {
            'Content-Length': '11',
            'Content-Type': 'image/png',
          },
        });
      }

      throw new Error(`Unexpected fetch: ${textUrl}`);
    };

    const response = await onRequest({
      request: new Request('https://example.com/file/plain-photo.png'),
      env: {
        img_url: kv,
        TG_Bot_Token: 'token',
      },
      params: { id: 'plain-photo.png' },
      waitUntil: () => {},
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(kv.getWithMetadataCalls, ['plain-photo.png']);
    assert.match(response.headers.get('Cache-Control') || '', /max-age=600/);
    assert.match(response.headers.get('CDN-Cache-Control') || '', /max-age=600/);
  });

  it('keeps protected share responses uncacheable', async function () {
    const { onRequest } = await import('../functions/file/[id].js');
    const kv = new CountingKV({
      'limited-photo.png': {
        TimeStamp: Date.now(),
        ListType: 'None',
        Label: 'None',
        fileName: 'limited-photo.png',
        storageType: 'telegram',
        shareMaxDownloads: 5,
        shareDownloadCount: 0,
      },
    });

    global.fetch = async (url) => {
      const textUrl = String(url);
      if (textUrl.includes('/getFile')) {
        return new Response(JSON.stringify({
          ok: true,
          result: { file_path: 'photos/limited-photo.png' },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('image-bytes', { status: 200 });
    };

    const response = await onRequest({
      request: new Request('https://example.com/file/limited-photo.png'),
      env: {
        img_url: kv,
        TG_Bot_Token: 'token',
      },
      params: { id: 'limited-photo.png' },
      waitUntil: (promise) => promise.catch(() => {}),
    });

    assert.strictEqual(response.status, 200);
    assert.match(response.headers.get('Cache-Control') || '', /no-store/);
    assert.match(response.headers.get('CDN-Cache-Control') || '', /no-store/);
  });
});
