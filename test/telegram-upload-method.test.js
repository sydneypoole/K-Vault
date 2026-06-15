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
