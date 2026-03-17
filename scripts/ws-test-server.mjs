#!/usr/bin/env node
/**
 * WebSocket test server for led-news-ticker
 *
 * Alternates between JSON and plain-text messages every 5 seconds.
 *
 * JSON format:   { "text": "...", "type": "normal"|"accent"|"sep" }
 * Plain text:    raw string (fed as type "normal" by the client)
 *
 * Usage:
 *   node scripts/ws-test-server.mjs [port]   (default port: 8080)
 *
 * Then set the ticker source:
 *   ?type=ws&url=ws://localhost:8080
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.argv[2]) || 8080;

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

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ws-test-server running\n');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const addr = req.socket.remoteAddress;
  console.log(`[ws-test-server] client connected: ${addr}`);
  ws.on('close', () => console.log(`[ws-test-server] client disconnected: ${addr}`));

  // Send one message immediately on connect
  const message = nextMessage();
  console.log(`[ws-test-server] → (connect) ${message}`);
  if (ws.readyState === 1 /* OPEN */) ws.send(message);
});

function broadcast() {
  if (wss.clients.size === 0) return;

  const message = nextMessage();
  const label = message.startsWith('{') ? 'JSON' : 'TEXT';
  console.log(`[ws-test-server] → ${label.padEnd(4)} : ${message}`);

  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(message);
    }
  }
}

httpServer.listen(PORT, () => {
  console.log(`[ws-test-server] listening on ws://localhost:${PORT}`);
  console.log(`[ws-test-server] ticker URL: ?type=ws&url=ws://localhost:${PORT}`);
  console.log('[ws-test-server] sending alternating JSON / plain-text every 5 s');
});

setInterval(broadcast, 5000);
