'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { buildPrompt, parseModelJson, enforceQuoteGuardrails, fallbackResult, validatePayload } = require('./lib/core');

const ROOT = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 4174;
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = process.env.OLLAMA_MODEL || 'gemma3:1b';

// Ollama's JSON mode alone can still be unreliable with small models. Give the
// runtime an explicit schema so it can constrain decoding to the UI contract.
const OUTPUT_SCHEMAS = {
  quote: {
    type: 'object',
    properties: {
      whatsapp: { type: 'string' },
      caption: { type: 'string' },
      aftercare: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
      followup: { type: 'string' },
      reviewNotes: { type: 'string' }
    },
    required: ['whatsapp', 'caption', 'aftercare', 'followup', 'reviewNotes'],
    additionalProperties: false
  },
  content: {
    type: 'object',
    properties: {
      caption: { type: 'string' },
      shortStory: { type: 'string' },
      hashtags: { type: 'array', items: { type: 'string' }, maxItems: 12 },
      callToAction: { type: 'string' }
    },
    required: ['caption', 'shortStory', 'hashtags', 'callToAction'],
    additionalProperties: false
  }
};
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}

function readJson(req, maxBytes = 24_000) {
  return new Promise((resolve, reject) => {
    let raw = ''; let bytes = 0; let settled = false;
    req.on('data', chunk => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > maxBytes) {
        settled = true;
        const error = new Error('Request is too large.');
        error.statusCode = 413;
        reject(error);
        req.resume(); // Drain the request so the server can return a 400 cleanly.
        return;
      }
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', error => { if (!settled) { settled = true; reject(error); } });
  });
}

async function ollamaStatus() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(1800) });
    if (!response.ok) return { ready: false, model: MODEL, reason: 'Ollama did not respond successfully.' };
    const result = await response.json();
    const models = (result.models || []).map(m => m.name || '');
    const found = models.some(name => name === MODEL || name.startsWith(`${MODEL}:`) || name.startsWith(MODEL));
    return { ready: true, model: MODEL, installed: found, availableModels: models.slice(0, 12) };
  } catch {
    return { ready: false, model: MODEL, reason: 'Ollama is unavailable. Template mode is ready.' };
  }
}

async function generate(body) {
  const mode = body.mode;
  const payload = validatePayload(mode, body.payload);
  const status = await ollamaStatus();
  if (!status.ready || !status.installed) return { mode: 'template', model: null, result: fallbackResult(mode, payload), notice: status.ready ? `Model ${MODEL} is not installed; used built-in template.` : 'Ollama unavailable; used built-in template.' };
  const prompt = buildPrompt(mode, payload);
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        format: OUTPUT_SCHEMAS[mode],
        options: { temperature: 0.2, num_predict: 900 }
      }),
      signal: AbortSignal.timeout(75_000)
    });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
    const data = await response.json();
    let result = parseModelJson(data.response, mode);
    if (mode === 'quote') result = enforceQuoteGuardrails(result, payload);
    return { mode: 'local-ai', model: MODEL, result, notice: 'Generated with local Ollama inference. Review and edit before sending.' };
  } catch (error) {
    return { mode: 'template', model: null, result: fallbackResult(mode, payload), notice: `Local AI response could not be used (${String(error.message).slice(0, 90)}). Used built-in template instead.` };
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  if (req.method === 'GET' && parsed.pathname === '/api/status') {
    const status = await ollamaStatus(); send(res, 200, status); return;
  }
  if (req.method === 'POST' && parsed.pathname === '/api/generate') {
    try { const body = await readJson(req); send(res, 200, await generate(body)); }
    catch (error) { send(res, error.statusCode || 400, { error: error.message || 'Could not process request.' }); }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, { error: 'Method not allowed.' }); return; }
  let requestPath;
  try { requestPath = parsed.pathname === '/' ? '/index.html' : decodeURIComponent(parsed.pathname); }
  catch { send(res, 400, { error: 'Malformed URL path.' }); return; }
  const resolved = path.resolve(ROOT, `.${requestPath}`);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== path.join(ROOT, 'index.html')) { send(res, 403, { error: 'Forbidden.' }); return; }
  fs.readFile(resolved, (error, buffer) => {
    if (error) { send(res, 404, { error: 'Not found.' }); return; }
    const ext = path.extname(resolved).toLowerCase();
    send(res, 200, req.method === 'HEAD' ? '' : buffer, MIME[ext] || 'application/octet-stream');
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`NailFlow AI running at http://127.0.0.1:${PORT} · model=${MODEL} · local-only server`));
