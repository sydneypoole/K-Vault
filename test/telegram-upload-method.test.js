const assert = require('assert');
const { TelegramStorageAdapter } = require('../server/lib/storage/adapters/telegram');

describe('Telegram upload method selection', function () {
  it('uploads transparency-capable images as documents in Cloudflare routes', async function () {
    const { getTelegramUploadMethodAndField } = await import('../functions/utils/telegram.js');

    assert.deepStrictEqual(
      getTelegramUploadMethodAndField('image/png'),
      { method: 'sendDocument', field: 'document' }
    );
    assert.deepStrictEqual(
      getTelegramUploadMethodAndField('image/webp'),
      { method: 'sendDocument', field: 'document' }
    );
    assert.deepStrictEqual(
      getTelegramUploadMethodAndField('image/svg+xml'),
      { method: 'sendDocument', field: 'document' }
    );
  });

  it('keeps jpeg uploads on the photo endpoint', async function () {
    const { getTelegramUploadMethodAndField } = await import('../functions/utils/telegram.js');

    assert.deepStrictEqual(
      getTelegramUploadMethodAndField('image/jpeg'),
      { method: 'sendPhoto', field: 'photo' }
    );
  });

  it('extracts document file ids when Telegram omits the ok field', async function () {
    const { pickTelegramFileId } = await import('../functions/utils/telegram.js');

    assert.strictEqual(
      pickTelegramFileId({
        result: {
          message_id: 123,
          document: { file_id: 'doc_without_ok' },
        },
      }),
      'doc_without_ok'
    );
    assert.strictEqual(
      pickTelegramFileId({
        ok: false,
        result: {
          document: { file_id: 'should_not_use' },
        },
      }),
      null
    );
  });

  it('surfaces Telegram ok=false errors instead of reporting a missing file id', async function () {
    const { onRequestPost } = await import('../functions/upload.js');
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;
    const requestedUrls = [];

    global.fetch = async (url) => {
      requestedUrls.push(String(url));
      return new Response(JSON.stringify({
        ok: false,
        description: 'Bad Request: chat not found',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    console.error = () => {};

    try {
      const formData = new FormData();
      formData.append('file', new File([new Uint8Array([1, 2, 3])], 'transparent.png', { type: 'image/png' }));

      const response = await onRequestPost({
        request: new Request('https://example.com/upload', {
          method: 'POST',
          body: formData,
        }),
        env: {
          disable_telemetry: 'true',
          TG_Bot_Token: 'token',
          TG_Chat_ID: 'chat',
        },
        data: {},
        next: () => new Response('ok'),
      });

      const payload = await response.json();
      assert.strictEqual(response.status, 500);
      assert.strictEqual(payload.error, 'Bad Request: chat not found');
      assert.deepStrictEqual(requestedUrls, ['https://api.telegram.org/bottoken/sendDocument']);
    } finally {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
    }
  });

  it('handles non-json Telegram errors without throwing a Worker exception', async function () {
    const { onRequestPost } = await import('../functions/upload.js');
    const originalFetch = global.fetch;
    const originalConsoleError = console.error;

    global.fetch = async () => new Response('error code: 1101', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
    console.error = () => {};

    try {
      const formData = new FormData();
      formData.append('file', new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' }));

      const response = await onRequestPost({
        request: new Request('https://example.com/upload', {
          method: 'POST',
          body: formData,
        }),
        env: {
          disable_telemetry: 'true',
          TG_Bot_Token: 'token',
          TG_Chat_ID: 'chat',
        },
        data: {},
        next: () => new Response('ok'),
      });

      const payload = await response.json();
      assert.strictEqual(response.status, 500);
      assert.match(payload.error, /error code: 1101/);
    } finally {
      global.fetch = originalFetch;
      console.error = originalConsoleError;
    }
  });

  it('uses sendDocument for png uploads in the Docker storage adapter', async function () {
    const originalFetch = global.fetch;
    const requestedUrls = [];

    global.fetch = async (url, options = {}) => {
      requestedUrls.push(String(url));
      assert.ok(options.body instanceof FormData);
      assert.ok(options.body.get('document') instanceof File);
      assert.strictEqual(options.body.get('photo'), null);
      return new Response(JSON.stringify({
        ok: true,
        result: {
          message_id: 123,
          document: { file_id: 'doc_png_file_id' },
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const adapter = new TelegramStorageAdapter({
        botToken: 'token',
        chatId: 'chat',
      });

      const result = await adapter.upload({
        buffer: new Uint8Array([1, 2, 3]).buffer,
        fileName: 'transparent.png',
        mimeType: 'image/png',
        fileSize: 3,
      });

      assert.deepStrictEqual(requestedUrls, ['https://api.telegram.org/bottoken/sendDocument']);
      assert.strictEqual(result.storageKey, 'doc_png_file_id');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
