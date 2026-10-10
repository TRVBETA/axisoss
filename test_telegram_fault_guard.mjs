import assert from 'node:assert/strict';

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.AXIS_MASTER_CHAT_ID = '111';
delete process.env.GROQ_API_KEY; // force transcription faults on demand

const sentMessages = [];
const calls = [];
global.fetch = async (url, options = {}) => {
  const u = String(url);
  calls.push({ url: u, options });
  if (u.includes('/sendMessage')) {
    sentMessages.push(JSON.parse(options.body));
  }
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

function post(body) {
  const res = createRes();
  return handler({ method: 'POST', body }, res).then(() => res);
}

/* 1) RANDOM FILE (non-audio document, no caption)
   Must NOT reach getFile/Groq at all, must reply once with the friendly
   hint, and must answer 200 so Telegram never re-delivers. */
let res = await post({
  update_id: 900001,
  message: {
    chat: { id: 111 },
    document: { file_id: 'BADFILE', file_name: 'random.zip', mime_type: 'application/zip', file_size: 123456 }
  }
});
assert.equal(res.statusCode, 200, 'random file must be answered with 200');
assert.equal(res.payload.status, 'NO_TEXT_CONTENT');
assert.ok(sentMessages.some(m => m.text.includes('Send text')), 'expected the text/voice hint');
assert.ok(!calls.some(c => c.url.includes('/getFile')), 'getFile must not be called for non-audio documents');
assert.ok(!calls.some(c => c.url.includes('api.groq.com')), 'Groq must not be called for non-audio documents');

/* 2) TELEGRAM RE-DELIVERY of the same update is ignored (the storm killer) */
const sentBefore = sentMessages.length;
res = await post({
  update_id: 900001,
  message: {
    chat: { id: 111 },
    document: { file_id: 'BADFILE', file_name: 'random.zip', mime_type: 'application/zip' }
  }
});
assert.equal(res.statusCode, 200);
assert.equal(res.payload.status, 'DUPLICATE_UPDATE_IGNORED');
assert.equal(sentMessages.length, sentBefore, 're-delivered update must not send another message');

/* 3) GENUINE AUDIO DOCUMENT (voice flow) with missing GROQ_API_KEY:
   faults are reported to the user ONCE and the webhook still answers 200. */
res = await post({
  update_id: 900002,
  message: {
    chat: { id: 111 },
    voice: { file_id: 'VOICE1', file_size: 54321, mime_type: 'audio/ogg' }
  }
});
assert.equal(res.statusCode, 200, 'fault path must still answer 200');
assert.equal(res.payload.status, 'BRIDGE_FAULT_HANDLED');
assert.ok(sentMessages.some(m => m.text.includes('SYSTEM BRIDGE FAULT')), 'user should see the fault once');

/* 3b) re-delivering the faulted update does not repeat the fault message */
const faultsBefore = sentMessages.filter(m => m.text.includes('SYSTEM BRIDGE FAULT')).length;
res = await post({
  update_id: 900002,
  message: { chat: { id: 111 }, voice: { file_id: 'VOICE1', file_size: 54321 } }
});
assert.equal(res.statusCode, 200);
assert.equal(res.payload.status, 'DUPLICATE_UPDATE_IGNORED');
assert.equal(
  sentMessages.filter(m => m.text.includes('SYSTEM BRIDGE FAULT')).length,
  faultsBefore,
  'fault reply must not repeat on re-delivery'
);

/* 4) OVERSIZED audio is rejected politely without any network work */
res = await post({
  update_id: 900003,
  message: {
    chat: { id: 111 },
    audio: { file_id: 'BIG', file_size: 40 * 1024 * 1024, mime_type: 'audio/mpeg' }
  }
});
assert.equal(res.statusCode, 200);
assert.equal(res.payload.status, 'NO_TEXT_CONTENT');
assert.ok(sentMessages.some(m => m.text.includes('too large')), 'expected the size hint');
assert.ok(!calls.some(c => c.url.includes('/getFile') && c.options?.body?.includes?.('BIG')), 'oversized file must not be fetched');

/* 5) audio-mime DOCUMENTS are still treated as voice (regression guard) */
res = await post({
  update_id: 900004,
  message: {
    chat: { id: 111 },
    document: { file_id: 'AUD1', file_name: 'note.mp3', mime_type: 'audio/mpeg', file_size: 99999 }
  }
});
assert.equal(res.statusCode, 200);
assert.equal(res.payload.status, 'BRIDGE_FAULT_HANDLED', 'audio document should still attempt transcription (and fault here without GROQ key)');

/* 6) sanity: plain command flow still intact */
res = await post({ update_id: 900005, message: { chat: { id: 111 }, text: '/cancel' } });
assert.equal(res.statusCode, 200);
assert.equal(res.payload.status, 'CANCELLED');

console.log('telegram-fault-guard-tests-ok');
