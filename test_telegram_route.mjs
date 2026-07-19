import assert from 'node:assert/strict';

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.AXIS_MASTER_CHAT_ID = '111';

const sent = [];
global.fetch = async (url, options = {}) => {
  sent.push({ url: String(url), options });
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, result: {} }),
    text: async () => 'ok'
  };
};

const { default: handler } = await import('./api/telegram.js');

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; }
  };
}

let res = createRes();
await handler({
  method: 'POST',
  body: { message: { chat: { id: 111 }, text: '/cancel' } }
}, res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.status, 'CANCELLED');
assert.ok(sent.some(call => call.url.includes('/sendMessage') && JSON.parse(call.options.body).text === 'Cancelled.'));

res = createRes();
await handler({
  method: 'POST',
  body: { message: { chat: { id: 111 }, text: '/help' } }
}, res);
assert.equal(res.statusCode, 200);
assert.equal(res.payload.status, 'HELP_SENT');
assert.ok(sent.some(call => call.url.includes('/sendMessage') && JSON.parse(call.options.body).text.includes('AXIS TELEGRAM')));

console.log('telegram-route-tests-ok');
