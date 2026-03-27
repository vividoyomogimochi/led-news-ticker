#!/usr/bin/env node
/**
 * SSE test server for led-news-ticker
 *
 * Alternates between JSON and plain-text messages every 5 seconds.
 *
 * JSON format:   data: { "text": "...", "type": "normal"|"accent"|"sep" }
 * Plain text:    data: raw string
 *
 * Usage:
 *   node scripts/sse-test-server.mjs [port]   (default port: 8081)
 *
 * Then set the ticker source:
 *   ?type=sse&url=http://localhost:8081/events
 */

import { createServer } from 'http';

const PORT = Number(process.argv[2]) || 8081;

const JSON_MESSAGES = [
  { text: '【JSON】速報：近所の猫、またコーヒーカップを落とす', type: 'normal' },
  { text: '【JSON】研究結果：昼寝は生産性向上に効果ありと判明', type: 'accent' },
  { text: '【JSON】市場情報：おそらく今のところ問題なし', type: 'normal' },
  { text: '【JSON】天気予報：午後は晴れ間あり、気分も概ね良好の見込み', type: 'accent' },
  { text: '【JSON】テクノロジー：「初回でコードが動いた」と開発者が主張、周囲は懐疑的', type: 'normal' },
];

const TEXT_MESSAGES = [
  '【TEXT】プレーンテキスト速報：午後の日差しが到来、住民戸惑う',
  '【TEXT】プレーンテキスト更新：コーヒーの在庫、午後も安定を維持',
  '【TEXT】プレーンテキスト警報：また誰かが電子レンジで魚を温める',
  '【TEXT】プレーンテキストスポーツ：地元チームが試合、結果は不明',
  '【TEXT】プレーンテキスト文化：新しい展覧会が開幕、「興味深い」との声',
];

let jsonIndex = 0;
let textIndex = 0;
let tick = 0; // even = JSON, odd = plain text

function nextMessage() {
  let message;
  if (tick % 2 === 0) {
    const payload = JSON_MESSAGES[jsonIndex % JSON_MESSAGES.length];
    jsonIndex++;
    message = JSON.stringify(payload);
  } else {
    message = TEXT_MESSAGES[textIndex % TEXT_MESSAGES.length];
    textIndex++;
  }
  tick++;
  return message;
}

/** @type {Set<import('http').ServerResponse>} */
const clients = new Set();

const server = createServer((req, res) => {
  // CORS headers for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/events' || req.url === '/') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const addr = req.socket.remoteAddress;
    console.log(`[sse-test-server] client connected: ${addr}`);
    clients.add(res);

    // Send one message immediately on connect
    const message = nextMessage();
    console.log(`[sse-test-server] → (connect) ${message}`);
    res.write(`data: ${message}\n\n`);

    req.on('close', () => {
      clients.delete(res);
      console.log(`[sse-test-server] client disconnected: ${addr}`);
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('sse-test-server running\n');
  }
});

function broadcast() {
  if (clients.size === 0) return;

  const message = nextMessage();
  const label = message.startsWith('{') ? 'JSON' : 'TEXT';
  console.log(`[sse-test-server] → ${label.padEnd(4)} : ${message}`);

  for (const client of clients) {
    client.write(`data: ${message}\n\n`);
  }
}

server.listen(PORT, () => {
  console.log(`[sse-test-server] listening on http://localhost:${PORT}/events`);
  console.log(`[sse-test-server] ticker URL: ?type=sse&url=http://localhost:${PORT}/events`);
  console.log('[sse-test-server] sending alternating JSON / plain-text every 5 s');
});

setInterval(broadcast, 5000);
