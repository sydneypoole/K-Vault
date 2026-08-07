const assert = require('assert');

describe('Chunked upload storage validation', function () {
  it('rejects Telegram chunked upload before creating a task', async function () {
    const { onRequestPost } = await import('../functions/api/chunked-upload/init.js');
    let putCalled = false;

    const response = await onRequestPost({
      request: new Request('https://example.com/api/chunked-upload/init', {
        method: 'POST',
        body: JSON.stringify({
          fileName: 'large-video.mp4',
          fileSize: 25 * 1024 * 1024,
          fileType: 'video/mp4',
          totalChunks: 5,
          storageMode: 'telegram',
        }),
      }),
      env: {
        img_url: {
          async put() {
            putCalled = true;
          },
        },
      },
    });

    const payload = await response.json();
    assert.strictEqual(response.status, 400);
    assert.match(payload.error, /Telegram .*不支持分片/);
    assert.strictEqual(putCalled, false);
  });
});
