'use strict';

const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

let appProcess;
let appBaseUrl;
let ollamaServer;
let ollamaBaseUrl;
let appOutput = '';
let ollamaOnline = true;

async function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(url) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (appProcess && appProcess.exitCode !== null) throw new Error(`App server exited early: ${appOutput}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(400) });
      if (response.ok) return;
    } catch { /* wait for the app to start */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`App server did not start in time: ${appOutput}`);
}

before(async () => {
  ollamaServer = http.createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    if (req.url === '/api/tags') {
      if (!ollamaOnline) { res.writeHead(503); res.end(JSON.stringify({ error: 'mock offline' })); return; }
      res.end(JSON.stringify({ models: [{ name: 'test-model' }] }));
      return;
    }
    if (req.url === '/api/generate' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const request = JSON.parse(body);
      const response = request.prompt.includes('prepare a draft response')
        ? { whatsapp: 'Your appointment is confirmed. Price ₹9,999 and we have an available slot.', caption: 'A lovely set', aftercare: ['Use cuticle oil', 'Avoid picking'], followup: 'Checking in', reviewNotes: 'Review before sending.' }
        : { caption: 'An elegant set, made personal.', shortStory: 'A fresh look ✨', hashtags: ['#Nails', '#NailArt'], callToAction: 'Message to discuss your design.' };
      res.end(JSON.stringify({ response: JSON.stringify(response), done: true }));
      return;
    }
    res.writeHead(404); res.end(JSON.stringify({ error: 'not found' }));
  });
  await new Promise((resolve, reject) => {
    ollamaServer.once('error', reject);
    ollamaServer.listen(0, '127.0.0.1', resolve);
  });
  ollamaBaseUrl = `http://127.0.0.1:${ollamaServer.address().port}`;

  const port = await reservePort();
  appBaseUrl = `http://127.0.0.1:${port}`;
  appProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), OLLAMA_URL: ollamaBaseUrl, OLLAMA_MODEL: 'test-model' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  appProcess.stdout.on('data', chunk => { appOutput += chunk.toString(); });
  appProcess.stderr.on('data', chunk => { appOutput += chunk.toString(); });
  await waitForServer(`${appBaseUrl}/`);
});

after(async () => {
  if (appProcess && appProcess.exitCode === null) appProcess.kill('SIGTERM');
  if (ollamaServer) await new Promise(resolve => ollamaServer.close(resolve));
});

test('serves the app shell with a safe content type and security headers', async () => {
  const response = await fetch(`${appBaseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(await response.text(), /NailFlow AI/);
});

test('reports that the configured Ollama model is ready', async () => {
  const response = await fetch(`${appBaseUrl}/api/status`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ready, true);
  assert.equal(body.installed, true);
  assert.equal(body.model, 'test-model');
});

test('bridges to Ollama and post-processes unsafe quote output', async () => {
  const response = await fetch(`${appBaseUrl}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'quote', payload: { service: 'Gel overlay', price: 1299, minutes: 60, clientName: 'Riya' } })
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, 'local-ai');
  assert.match(body.result.whatsapp, /₹1,299/);
  assert.doesNotMatch(body.result.whatsapp, /₹9,999/);
  assert.doesNotMatch(body.result.whatsapp, /appointment is confirmed/i);
  assert.match(body.result.whatsapp, /not confirmed/i);
});

test('generates content through the configured Ollama bridge', async () => {
  const response = await fetch(`${appBaseUrl}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'content', payload: { service: 'Festive nail art', style: 'olive and gold', channel: 'Instagram' } })
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, 'local-ai');
  assert.match(body.result.caption, /elegant set/i);
  assert.deepEqual(body.result.hashtags, ['#Nails', '#NailArt']);
});

test('falls back clearly when the Ollama server becomes unavailable', async () => {
  ollamaOnline = false;
  const response = await fetch(`${appBaseUrl}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'quote', payload: { service: 'Gel overlay', price: 799, minutes: 60, clientName: 'Riya' } })
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, 'template');
  assert.match(body.result.whatsapp, /₹799/);
  assert.match(body.notice, /template/i);
  ollamaOnline = true;
});

test('returns a useful 400 for invalid JSON', async () => {
  const response = await fetch(`${appBaseUrl}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not-json' });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Invalid JSON/);
});

test('rejects unsupported methods and path traversal', async () => {
  const method = await fetch(`${appBaseUrl}/api/generate`, { method: 'PUT' });
  assert.equal(method.status, 405);
  const traversal = await fetch(`${appBaseUrl}/..%2Fserver.js`);
  assert.equal(traversal.status, 403);
});

test('rejects malformed URL-encoded static paths without killing the server', async () => {
  const response = await fetch(`${appBaseUrl}/%E0%A4%A`);
  assert.equal(response.status, 400);
  const stillUp = await fetch(`${appBaseUrl}/api/status`);
  assert.equal(stillUp.status, 200);
});

test('rejects oversized API requests with 413', async () => {
  const response = await fetch(`${appBaseUrl}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'content', payload: { service: 'x', details: 'a'.repeat(30_000) } })
  });
  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /too large/i);
});
