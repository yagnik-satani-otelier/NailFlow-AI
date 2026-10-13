'use strict';

const STORE_KEY = 'nailflow.studio.v1';
const STARTER_SERVICES = [
  { id: 'basic-mani', name: 'Classic manicure', price: 399, minutes: 35, description: 'Shape, tidy and polish' },
  { id: 'gel-overlay', name: 'Gel overlay', price: 799, minutes: 60, description: 'Long-wear gel finish' },
  { id: 'extensions', name: 'Nail extensions', price: 1299, minutes: 100, description: 'Extensions with a clean finish' },
  { id: 'nail-art', name: 'Nail art add-on', price: 199, minutes: 20, description: 'Art added to an existing set' },
  { id: 'removal', name: 'Product removal', price: 199, minutes: 25, description: 'Removal and basic nail care' }
];
const VIEW_TITLES = { overview: 'Overview', quote: 'Quote studio', clients: 'Client pipeline', content: 'Content studio', services: 'Service menu', settings: 'Studio settings' };
const COMPLEXITY_ADD = { simple: 0, detailed: 150, intricate: 350 };
const COMPLEXITY_MINUTES = { simple: 0, detailed: 15, intricate: 30 };
let currentQuoteDraft = null;
let currentContentDraft = null;
let pipelineFilter = 'all';

function defaultState() {
  return { settings: { studioName: 'Your Studio', language: 'English', tone: 'warm' }, services: structuredClone(STARTER_SERVICES), quotes: [], contentDrafts: [] };
}
function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!data || typeof data !== 'object') return defaultState();
    return {
      settings: { ...defaultState().settings, ...(data.settings || {}) },
      services: Array.isArray(data.services) && data.services.length ? data.services : structuredClone(STARTER_SERVICES),
      quotes: Array.isArray(data.quotes) ? data.quotes : [],
      contentDrafts: Array.isArray(data.contentDrafts) ? data.contentDrafts : []
    };
  } catch { return defaultState(); }
}
let state = loadState();
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); return true; }
  catch { toast('Could not save: browser storage may be full. Export your data or remove a large attachment.', 'error'); return false; }
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}
function fmtMoney(value) { return `₹${Math.max(0, Math.round(Number(value) || 0)).toLocaleString('en-IN')}`; }
function uid() { return `nf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function serviceById(id) { return state.services.find(s => s.id === id) || state.services[0]; }
function estimate(service, complexity, addOn, rush) {
  const base = Number(service?.price) || 0;
  const complexityAdd = COMPLEXITY_ADD[complexity] ?? 0;
  const add = addOn ? 100 : 0;
  const rushExtra = rush ? 100 : 0;
  return { base, complexityAdd, add, rushExtra, total: base + complexityAdd + add + rushExtra,
    minutes: Math.min(600, Number(service?.minutes || 60) + (COMPLEXITY_MINUTES[complexity] || 0)) };
}
function toast(message, type = 'success') {
  const region = document.getElementById('toastRegion');
  const el = document.createElement('div'); el.className = `toast ${type === 'error' ? 'error' : ''}`; el.textContent = message; region.appendChild(el);
  window.setTimeout(() => el.remove(), 3600);
}
function navigate(view) {
  if (!VIEW_TITLES[view]) return;
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  document.querySelectorAll('.nav-item[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  document.getElementById('breadcrumbTitle').textContent = VIEW_TITLES[view];
  document.getElementById('sidebar').classList.remove('open');
  if (view === 'services') renderServices();
  if (view === 'clients') renderPipeline();
  if (view === 'settings') fillSettingsForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function studioInitial() { return (state.settings.studioName || 'S').trim().charAt(0).toUpperCase() || 'S'; }
function updateIdentity() {
  const name = state.settings.studioName || 'Your Studio';
  document.getElementById('sidebarStudioName').textContent = name;
  document.getElementById('studioAvatar').textContent = studioInitial();
  document.getElementById('topAvatar').textContent = studioInitial();
  document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
}
function fillServiceOptions() {
  const select = document.getElementById('quoteService');
  const previous = select.value;
  select.innerHTML = state.services.map(service => `<option value="${escapeHtml(service.id)}">${escapeHtml(service.name)} · ${fmtMoney(service.price)}</option>`).join('');
  if (state.services.some(s => s.id === previous)) select.value = previous;
  updateEstimate();
}
function currentEstimateFromForm() {
  const form = document.getElementById('quoteForm');
  const fd = new FormData(form);
  const service = serviceById(fd.get('serviceId'));
  const result = estimate(service, fd.get('complexity'), fd.has('addOn'), fd.has('rush'));
  return { fd, service, estimate: result };
}
function updateEstimate() {
  if (!state.services.length) return;
  const { fd, service, estimate: e } = currentEstimateFromForm();
  document.getElementById('livePrice').textContent = fmtMoney(e.total);
  const pieces = [`base ${fmtMoney(e.base)}`];
  if (e.complexityAdd) pieces.push(`complexity +${fmtMoney(e.complexityAdd)}`);
  if (e.add) pieces.push(`embellishments +${fmtMoney(e.add)}`);
  if (e.rushExtra) pieces.push(`rush +${fmtMoney(e.rushExtra)}`);
  document.getElementById('priceFormula').textContent = pieces.join(' · ');
}
function quotePayload() {
  const { fd, service, estimate: e } = currentEstimateFromForm();
  return {
    clientName: String(fd.get('clientName') || '').trim() || 'there', service: service.name, price: e.total, minutes: e.minutes,
    length: fd.get('length'), complexity: fd.get('complexity'), event: fd.get('event'), clientNotes: fd.get('clientNotes'), datePreference: fd.get('datePreference'),
    studioName: state.settings.studioName, language: state.settings.language, tone: state.settings.tone,
    pricing: e
  };
}
function localQuoteFallback(p) {
  let whatsapp, caption, followup;
  let aftercare = ['Avoid picking or peeling product; contact your artist for safe removal.', 'Use cuticle oil and moisturise your hands regularly.', 'Wear gloves for prolonged cleaning or chemical exposure.', 'If you notice unusual pain, swelling or irritation, stop using the product and seek appropriate professional advice.'];
  if (p.language === 'Gujarati') {
    whatsapp = `નમસ્તે ${p.clientName}! ${p.studioName} માં ${p.service} માટે સંપર્ક કરવા બદલ આભાર. અંદાજિત કિંમત ₹${p.price} છે અને સેશનમાં લગભગ ${p.minutes} મિનિટ લાગી શકે. આ માત્ર અંદાજ છે, બુકિંગ કન્ફર્મ નથી. અંતિમ કિંમત અને ઉપલબ્ધતા માટે તમારી પસંદગીની તારીખ અને રેફરન્સ ડિઝાઇન મોકલો.`;
    caption = `${p.service}, તમારી સ્ટાઇલ પ્રમાણે ✨\nડિઝાઇન અને તારીખ વિશે વાત કરવા મેસેજ કરો.`;
    followup = `નમસ્તે ${p.clientName}, ${p.service} વિશે પૂછવું હતું. અનુકૂળ હોય ત્યારે પસંદગીની તારીખ મોકલો, જેથી આગળની વિગતો તપાસી શકું.`;
    aftercare = ['પ્રોડક્ટને ખેંચીને કે છોલીને દૂર ન કરો; સલામત રીતે દૂર કરવા માટે તમારા નેઇલ આર્ટિસ્ટનો સંપર્ક કરો.', 'ક્યુટિકલ ઓઇલ વાપરો અને હાથને નિયમિત રીતે મોઇશ્ચરાઇઝ કરો.', 'સફાઈના કેમિકલ સાથે કામ કરતી વખતે ગ્લોવ્સ પહેરો.', 'અસામાન્ય દુખાવો, સોજો કે ચળચળાટ થાય તો પ્રોડક્ટનો ઉપયોગ બંધ કરો અને યોગ્ય નિષ્ણાતની સલાહ લો.'];
  } else if (p.language === 'Hinglish') {
    whatsapp = `Hi ${p.clientName}! ${p.studioName} par ${p.service} ke liye thanks. Estimated price ₹${p.price} hai aur session mein around ${p.minutes} minutes lag sakte hain. Yeh estimate hai, confirmed booking nahi. Final quote aur availability check karne ke liye preferred date aur reference design share kar dijiye.`;
    caption = `${p.service}, aapke style ke hisaab se ✨\nApni inspiration aur preferred date DM karein.`;
    followup = `Hi ${p.clientName}, ${p.service} ke baare mein follow up kar raha/rahi hoon. Jab convenient ho, preferred date share kar dijiye.`;
    aftercare = ['Product ko pick ya peel na karein; safe removal ke liye nail artist se contact karein.', 'Cuticle oil use karein aur hands moisturise rakhein.', 'Cleaning products ke saath gloves pehnein.', 'Unusual pain, swelling ya irritation ho to use rok dein aur professional advice lein.'];
  } else {
    whatsapp = `Hi ${p.clientName}! Thanks for checking with ${p.studioName} for ${p.service}. Based on the details shared, the estimated price is ${fmtMoney(p.price)} and the session may take around ${p.minutes} minutes. This is an estimate, not a confirmed booking. Please share your preferred date and any reference design so I can review the details and confirm the final quote and availability.`;
    caption = `${p.service}, tailored to your style ✨\nA little detail can make the whole set feel personal. Message us with your inspiration and preferred date to discuss your look.`;
    followup = `Hi ${p.clientName}, just checking whether you'd like to explore the ${p.service} idea. No pressure. Send your preferred date when convenient and I can review the next steps.`;
  }
  return { mode: 'template', model: null, notice: 'Ollama is unavailable in this browser session; built-in template used.', result: { whatsapp, caption, aftercare, followup, reviewNotes: 'Template mode: review price, wording and availability before sending.' } };
}
function localContentFallback(p) {
  const gu = p.language === 'Gujarati'; const hi = p.language === 'Hinglish';
  return { mode: 'template', model: null, notice: 'Ollama unavailable; built-in template used.', result: {
    caption: gu ? `${p.service}, તમારી સ્ટાઇલ પ્રમાણે ✨\n${p.style ? p.style + '. ' : ''}${p.details ? p.details + ' ' : ''}ડિઝાઇન અને તારીખ વિશે વાત કરવા મેસેજ કરો.${p.offer ? ` ${p.offer}` : ''}` : hi ? `${p.service}, aapke style ke hisaab se ✨\n${p.style ? p.style + '. ' : ''}${p.details ? p.details + ' ' : ''}Design aur date discuss karne ke liye DM karein.${p.offer ? ` ${p.offer}` : ''}` : `${p.service}, made personal ✨\n${p.style ? p.style + '. ' : ''}${p.details ? p.details + ' ' : ''}Tell us the look you're dreaming of and we'll help plan your next set.${p.offer ? ` ${p.offer}` : ''}`,
    shortStory: gu ? `${p.service} માટે તમારો આગલો લુક પ્લાન કરીએ ✨\nડિઝાઇન અને તારીખ માટે મેસેજ કરો.` : hi ? `Aapka next ${p.service.toLowerCase()} look yahan se shuru ✨\nDesign aur date discuss karne ke liye DM karein.` : `Your next ${p.service.toLowerCase()} idea starts here ✨\nDM to discuss your look and preferred date.`,
    hashtags: ['#NailArt', '#NailStudio', '#NailInspiration', '#NailArtist', '#BeautyBusiness'],
    callToAction: gu ? 'તમારી ડિઝાઇન અને તારીખ વિશે મેસેજ કરો.' : hi ? 'Design aur appointment preference discuss karne ke liye message karein.' : 'Message us to discuss your design and appointment preferences.'
  }};
}
async function requestGeneration(mode, payload) {
  try {
    const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, payload }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Server error ${response.status}`);
    return data;
  } catch (error) {
    if (mode === 'quote') return localQuoteFallback(payload);
    return localContentFallback(payload);
  }
}
function setBusy(button, busy, busyText) {
  if (!button.dataset.originalText) button.dataset.originalText = button.innerHTML;
  button.disabled = busy; button.innerHTML = busy ? `<span class="spinner"></span>${escapeHtml(busyText)}` : button.dataset.originalText;
}
function modeNotice(response) {
  const isAI = response.mode === 'local-ai';
  return `<div class="output-notice ${isAI ? 'ai' : 'template'}"><strong>${isAI ? '✦ LOCAL AI' : '◌ TEMPLATE MODE'}</strong> · ${escapeHtml(response.notice || '')}</div>`;
}
function resultCard(title, content, copyValue, extra = '') {
  return `<article class="result-card"><div class="result-card-head"><h4>${escapeHtml(title)}</h4><button type="button" class="result-copy" data-copy="${escapeHtml(copyValue)}">Copy text ↗</button></div>${content}${extra}</article>`;
}
function editableResultCard(title, field, value, mode, rows = 4) {
  const text = Array.isArray(value) ? value.join('\n') : String(value ?? '');
  const attr = mode === 'quote' ? `data-edit-quote="${escapeHtml(field)}"` : `data-edit-content="${escapeHtml(field)}"`;
  return `<article class="result-card"><div class="result-card-head"><label for="edit-${mode}-${field}">${escapeHtml(title)}</label><button type="button" class="result-copy" data-copy-field="${escapeHtml(field)}">Copy text ↗</button></div><textarea id="edit-${mode}-${field}" class="result-editor" ${attr} rows="${rows}" maxlength="${field === 'aftercare' ? 1400 : 1800}" aria-label="Edit ${escapeHtml(title)}">${escapeHtml(text)}</textarea><div class="result-meta">Editable draft · review before sending or publishing</div></article>`;
}
function renderQuoteOutput(response, payload, existingId = null, existingDate = null) {
  const r = response.result;
  const savedStatus = existingId ? (state.quotes.find(q => q.id === existingId)?.status || 'draft') : 'draft';
  currentQuoteDraft = { id: existingId || uid(), createdAt: existingDate || new Date().toISOString(), clientName: payload.clientName, service: payload.service, price: payload.price, minutes: payload.minutes, payload, response, status: savedStatus };
  document.getElementById('quoteOutput').innerHTML = `${modeNotice(response)}<div class="result-card"><div class="result-card-head"><h4>Estimate · ${escapeHtml(payload.service)}</h4><span class="pipeline-price">${fmtMoney(payload.price)}</span></div><p>${escapeHtml(payload.minutes)} min estimated session · ${escapeHtml(payload.complexity)} design</p><div class="result-meta">${escapeHtml(payload.pricing ? `Base ${fmtMoney(payload.pricing.base)}${payload.pricing.complexityAdd ? ` + complexity ${fmtMoney(payload.pricing.complexityAdd)}` : ''}${payload.pricing.add ? ` + extras ${fmtMoney(payload.pricing.add)}` : ''}${payload.pricing.rushExtra ? ` + rush ${fmtMoney(payload.pricing.rushExtra)}` : ''}` : 'Human-reviewed estimate')}</div></div>${editableResultCard('WhatsApp reply', 'whatsapp', r.whatsapp, 'quote', 5)}${editableResultCard('Social caption', 'caption', r.caption, 'quote', 3)}${editableResultCard('Aftercare guide', 'aftercare', r.aftercare || [], 'quote', 5)}${editableResultCard('Gentle follow-up', 'followup', r.followup || '', 'quote', 3)}<div class="output-notice">${escapeHtml(r.reviewNotes || 'Review every draft before sending. Confirm final price, design details and availability yourself.')}</div><button type="button" class="button primary save-quote-button" id="saveQuoteBtn">Save to client pipeline <span>＋</span></button>`;
}
function renderContentOutput(response, payload, existingId = null, existingDate = null) {
  const r = response.result;
  currentContentDraft = { id: existingId || uid(), createdAt: existingDate || new Date().toISOString(), payload, response };
  document.getElementById('contentModeBadge').textContent = response.mode === 'local-ai' ? 'Local AI' : 'Template';
  document.getElementById('contentModeBadge').className = `status-tag ${response.mode === 'local-ai' ? 'ai' : 'template'}`;
  const hashtags = (r.hashtags || []).map(x => x.startsWith('#') ? x : `#${x}`).join(' ');
  document.getElementById('contentOutput').innerHTML = `${modeNotice(response)}${editableResultCard('Main caption', 'caption', r.caption, 'content', 5)}${editableResultCard('Short story / status', 'shortStory', r.shortStory, 'content', 3)}${editableResultCard('Hashtags', 'hashtags', hashtags, 'content', 2)}${editableResultCard('Call to action', 'callToAction', r.callToAction || '', 'content', 2)}<button type="button" class="button primary save-content-button" id="saveContentBtn">Save content draft <span>＋</span></button>`;
}
function syncEditedField(mode, textarea) {
  const field = mode === 'quote' ? textarea.dataset.editQuote : textarea.dataset.editContent;
  const draft = mode === 'quote' ? currentQuoteDraft : currentContentDraft;
  if (!draft || !field) return;
  if (mode === 'quote' && field === 'aftercare') {
    draft.response.result.aftercare = textarea.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 6);
  } else if (mode === 'content' && field === 'hashtags') {
    draft.response.result.hashtags = [...new Set(textarea.value.split(/\s+/).map(tag => tag.trim()).filter(Boolean).map(tag => tag.startsWith('#') ? tag : `#${tag}`).map(tag => tag.replace(/[^#\p{L}\p{N}_]/gu, '')).filter(tag => tag.length > 1))].slice(0, 12);
  } else {
    draft.response.result[field] = textarea.value.slice(0, mode === 'quote' ? 1800 : 1800);
  }
  const saveButton = textarea.closest('.result-card')?.querySelector('[data-copy-field]');
  if (saveButton) saveButton.dataset.copy = textarea.value;
}
function persistEditedField(mode) {
  const draft = mode === 'quote' ? currentQuoteDraft : currentContentDraft;
  if (!draft) return;
  const collection = mode === 'quote' ? state.quotes : state.contentDrafts;
  // Saved drafts share the response object with the editor; persist on blur,
  // not on every keystroke, to avoid excessive synchronous localStorage writes.
  if (collection.some(item => item.id === draft.id)) persist();
}
async function onQuoteSubmit(event) {
  event.preventDefault();
  const payload = quotePayload();
  const button = document.getElementById('generateQuoteBtn');
  setBusy(button, true, 'Writing your client pack…');
  try { const response = await requestGeneration('quote', payload); renderQuoteOutput(response, payload); toast(response.mode === 'local-ai' ? 'Client pack generated with local AI.' : 'Client pack ready in template mode.'); }
  finally { setBusy(button, false); }
}
async function onContentSubmit(event) {
  event.preventDefault();
  const fd = new FormData(event.currentTarget);
  const payload = { studioName: state.settings.studioName, language: state.settings.language, tone: fd.get('tone') || state.settings.tone, service: fd.get('service'), style: fd.get('style'), channel: fd.get('channel'), offer: fd.get('offer'), details: fd.get('details') };
  const button = document.getElementById('generateContentBtn'); setBusy(button, true, 'Creating your content pack…');
  try { const response = await requestGeneration('content', payload); renderContentOutput(response, payload); toast(response.mode === 'local-ai' ? 'Content pack generated with local AI.' : 'Content pack ready in template mode.'); }
  finally { setBusy(button, false); }
}
function renderRecent() {
  const holder = document.getElementById('recentQuotes');
  const quotes = [...state.quotes].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,4);
  if (!quotes.length) { holder.innerHTML = `<div class="empty-state"><span class="empty-icon">✳</span><strong>Your next great client conversation starts here.</strong><p>Build a quote to see it in your workspace.</p><button class="button secondary small" data-view="quote">Create first quote</button></div>`; return; }
  holder.innerHTML = quotes.map(q => `<div class="recent-card" data-open-quote="${escapeHtml(q.id)}"><div class="pipeline-avatar">${escapeHtml((q.clientName || 'C').slice(0,1).toUpperCase())}</div><div><strong>${escapeHtml(q.clientName || 'New client')} · ${escapeHtml(q.service)}</strong><small>${new Date(q.createdAt).toLocaleDateString('en-IN', { day:'numeric',month:'short' })} · ${escapeHtml(q.status || 'draft')}</small></div><b>${fmtMoney(q.price)} ↗</b></div>`).join('');
}
function updateDashboard() {
  document.getElementById('statQuotes').textContent = state.quotes.length;
  document.getElementById('statFollowups').textContent = state.quotes.filter(q => q.status === 'followup').length;
  document.getElementById('statServices').textContent = state.services.length;
  document.getElementById('clientNavCount').textContent = state.quotes.length;
  document.getElementById('pipelineCount').textContent = `${state.quotes.length} saved`;
  document.getElementById('serviceCount').textContent = `${state.services.length} service${state.services.length === 1 ? '' : 's'}`;
  renderRecent();
}
function renderPipeline() {
  const holder = document.getElementById('pipelineList');
  const all = [...state.quotes].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
  const shown = pipelineFilter === 'all' ? all : all.filter(q => q.status === pipelineFilter);
  if (!shown.length) { holder.innerHTML = `<div class="pipeline-empty">${all.length ? 'No conversations in this filter.' : 'No saved quotes yet. Start with one client inquiry and build from there.'}</div>`; return; }
  holder.innerHTML = shown.map(q => `<article class="pipeline-card"><div class="pipeline-avatar">${escapeHtml((q.clientName || 'C').slice(0,1).toUpperCase())}</div><div class="pipeline-details"><strong>${escapeHtml(q.clientName || 'New client')} · ${escapeHtml(q.service)}</strong><small>${new Date(q.createdAt).toLocaleString('en-IN', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · ${escapeHtml(q.minutes || 60)} min estimate</small></div><span class="pipeline-price">${fmtMoney(q.price)}</span><span class="pipeline-status ${escapeHtml(q.status || 'draft')}">${escapeHtml(q.status || 'draft')}</span><div class="pipeline-actions"><select class="mini-select" data-status-id="${escapeHtml(q.id)}" aria-label="Change status"><option value="draft" ${q.status === 'draft' ? 'selected' : ''}>Draft</option><option value="followup" ${q.status === 'followup' ? 'selected' : ''}>Follow-up</option><option value="done" ${q.status === 'done' ? 'selected' : ''}>Done</option></select><button class="delete-button" data-delete-id="${escapeHtml(q.id)}" aria-label="Delete quote">×</button></div></article>`).join('');
}
function renderServices() {
  document.getElementById('serviceList').innerHTML = state.services.map(service => `<div class="service-row"><div class="service-name"><strong>${escapeHtml(service.name)}</strong><small>${escapeHtml(service.description || 'Custom studio service')}</small></div><label class="price-control"><span>₹</span><input type="number" min="0" max="100000" step="1" data-service-price="${escapeHtml(service.id)}" value="${Math.round(Number(service.price)||0)}" aria-label="Starting price for ${escapeHtml(service.name)}"></label><label class="time-control"><input type="number" min="5" max="600" step="5" data-service-minutes="${escapeHtml(service.id)}" value="${Math.round(Number(service.minutes)||60)}" aria-label="Session duration in minutes for ${escapeHtml(service.name)}"><span>min</span></label><button class="service-remove" data-remove-service="${escapeHtml(service.id)}" aria-label="Remove ${escapeHtml(service.name)}">×</button></div>`).join('');
}
function fillSettingsForm() {
  const form = document.getElementById('settingsForm');
  form.elements.studioName.value = state.settings.studioName;
  form.elements.language.value = state.settings.language;
  form.elements.tone.value = state.settings.tone;
  const contentTone = document.querySelector('#contentForm [name="tone"]');
  if (contentTone) contentTone.value = state.settings.tone;
}
function updateStatus(status) {
  const ready = Boolean(status.ready && status.installed);
  const isOnline = Boolean(status.ready);
  const text = ready ? `Gemma ready · ${status.model}` : isOnline ? `${status.model} not installed` : 'Template mode available';
  document.getElementById('sidebarModelStatus').textContent = text;
  document.getElementById('sidebarStatusDot').classList.toggle('ready', ready);
  document.getElementById('statAi').textContent = ready ? 'Gemma ready' : 'Template mode';
  document.getElementById('statAiHint').textContent = ready ? `${status.model} · local inference` : 'Local Ollama is not ready';
  document.getElementById('settingsStatus').textContent = ready ? 'Local AI is ready' : 'Built-in templates are ready';
  document.getElementById('settingsModel').textContent = status.model ? `Configured model: ${status.model}` : 'Ollama not configured';
  document.getElementById('settingsStatusDot').classList.toggle('ready', ready);
}
async function checkStatus() {
  try { const response = await fetch('/api/status'); if (!response.ok) throw new Error('status'); updateStatus(await response.json()); }
  catch { updateStatus({ ready:false, installed:false, model:'gemma3:1b' }); }
}
function copyText(text) {
  const value = String(text || '');
  if (!value) { toast('Nothing to copy.', 'error'); return; }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(value).then(() => toast('Copied to clipboard.')).catch(() => fallbackCopy(value));
  else fallbackCopy(value);
}
function fallbackCopy(value) {
  const area = document.createElement('textarea'); area.value = value; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select();
  try { const ok = document.execCommand('copy'); toast(ok ? 'Copied to clipboard.' : 'Copy failed. Select and copy the text manually.', ok ? 'success' : 'error'); } catch { toast('Copy failed. Select and copy the text manually.', 'error'); }
  area.remove();
}
function saveCurrentQuote() {
  if (!currentQuoteDraft) return;
  const duplicate = state.quotes.some(q => q.id === currentQuoteDraft.id);
  if (duplicate) { toast('This quote is already saved.'); return; }
  state.quotes.unshift(currentQuoteDraft); persist(); updateDashboard(); renderPipeline(); toast('Quote saved in your local client pipeline.');
}
function saveCurrentContent() {
  if (!currentContentDraft) return;
  const index = state.contentDrafts.findIndex(item => item.id === currentContentDraft.id);
  if (index >= 0) state.contentDrafts[index] = currentContentDraft;
  else state.contentDrafts.unshift(currentContentDraft);
  state.contentDrafts = state.contentDrafts.slice(0, 100); persist(); renderSavedContent(); toast(index >= 0 ? 'Saved draft updated locally.' : 'Content draft saved locally.');
}
function renderSavedContent() {
  const holder = document.getElementById('savedContentList');
  if (!holder) return;
  if (!state.contentDrafts.length) { holder.innerHTML = '<p class="saved-empty">No saved content yet. Create a pack to keep a reusable draft here.</p>'; return; }
  holder.innerHTML = state.contentDrafts.slice(0, 8).map(item => `<article class="saved-content-row"><div><strong>${escapeHtml(item.payload?.service || 'Content draft')}</strong><small>${new Date(item.createdAt).toLocaleDateString('en-IN', {day:'numeric',month:'short'})} · ${escapeHtml(item.payload?.channel || 'Social')}</small></div><button type="button" class="saved-load" data-load-content="${escapeHtml(item.id)}">Load</button><button type="button" class="saved-delete" data-delete-content="${escapeHtml(item.id)}" aria-label="Delete saved draft">×</button></article>`).join('');
}
function exportData() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `nailflow-backup-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); toast('Local data export prepared. Keep the file somewhere private.');
}
function installListeners() {
  document.addEventListener('click', event => {
    const viewEl = event.target.closest('[data-view]');
    if (viewEl) { event.preventDefault(); navigate(viewEl.dataset.view); return; }
    const copy = event.target.closest('[data-copy],[data-copy-field]');
    if (copy) { const field = copy.dataset.copyField; const editor = field ? copy.closest('.result-card')?.querySelector('textarea') : null; copyText(editor ? editor.value : copy.dataset.copy); return; }
    const remove = event.target.closest('[data-remove-service]');
    if (remove) {
      if (state.services.length <= 1) { toast('Keep at least one service in your menu.', 'error'); return; }
      state.services = state.services.filter(s => s.id !== remove.dataset.removeService); persist(); renderServices(); fillServiceOptions(); updateDashboard(); toast('Service removed from your local menu.'); return;
    }
    const del = event.target.closest('[data-delete-id]');
    if (del) { state.quotes = state.quotes.filter(q => q.id !== del.dataset.deleteId); persist(); updateDashboard(); renderPipeline(); toast('Quote removed from the pipeline.'); return; }
    const recent = event.target.closest('[data-open-quote]');
    if (recent) { const q = state.quotes.find(item => item.id === recent.dataset.openQuote); if (q?.response?.result) { currentQuoteDraft = q; renderQuoteOutput(q.response, q.payload, q.id, q.createdAt); navigate('quote'); } else toast('This saved item contains its summary only.', 'error'); return; }
    const loadContent = event.target.closest('[data-load-content]');
    if (loadContent) { const item = state.contentDrafts.find(draft => draft.id === loadContent.dataset.loadContent); if (item) { renderContentOutput(item.response, item.payload, item.id, item.createdAt); toast('Saved draft loaded.'); } return; }
    const deleteContent = event.target.closest('[data-delete-content]');
    if (deleteContent) { state.contentDrafts = state.contentDrafts.filter(draft => draft.id !== deleteContent.dataset.deleteContent); persist(); renderSavedContent(); toast('Saved draft deleted.'); return; }
  });
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.view)));
  document.getElementById('mobileMenu').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('quoteForm').addEventListener('submit', onQuoteSubmit);
  document.getElementById('contentForm').addEventListener('submit', onContentSubmit);
  document.getElementById('quoteForm').addEventListener('input', updateEstimate);
  document.getElementById('quoteForm').addEventListener('change', updateEstimate);
  document.getElementById('saveQuoteBtn')?.addEventListener('click', saveCurrentQuote);
  document.getElementById('quoteOutput').addEventListener('click', e => { if (e.target.closest('#saveQuoteBtn')) saveCurrentQuote(); });
  document.getElementById('contentOutput').addEventListener('click', e => { if (e.target.closest('#saveContentBtn')) saveCurrentContent(); });
  document.getElementById('quoteOutput').addEventListener('input', e => { const editor = e.target.closest('[data-edit-quote]'); if (editor) syncEditedField('quote', editor); });
  document.getElementById('contentOutput').addEventListener('input', e => { const editor = e.target.closest('[data-edit-content]'); if (editor) syncEditedField('content', editor); });
  document.getElementById('quoteOutput').addEventListener('focusout', e => { if (e.target.closest('[data-edit-quote]')) persistEditedField('quote'); });
  document.getElementById('contentOutput').addEventListener('focusout', e => { if (e.target.closest('[data-edit-content]')) persistEditedField('content'); });
  document.getElementById('pipelineList').addEventListener('change', event => {
    const select = event.target.closest('[data-status-id]'); if (!select) return;
    const quote = state.quotes.find(q => q.id === select.dataset.statusId); if (!quote) return;
    quote.status = select.value; persist(); updateDashboard(); renderPipeline(); toast('Pipeline status updated.');
  });
  document.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
    pipelineFilter = btn.dataset.filter; document.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('active', x === btn)); renderPipeline();
  }));
  document.getElementById('serviceList').addEventListener('change', event => {
    const priceInput = event.target.closest('[data-service-price]');
    const minutesInput = event.target.closest('[data-service-minutes]');
    const input = priceInput || minutesInput; if (!input) return;
    const service = serviceById(priceInput ? priceInput.dataset.servicePrice : minutesInput.dataset.serviceMinutes); if (!service) return;
    if (priceInput) {
      service.price = Math.min(100000, Math.max(0, Math.round(Number(input.value) || 0)));
      input.value = service.price;
      toast(`${service.name} starting price updated.`);
    } else {
      service.minutes = Math.min(600, Math.max(5, Math.round(Number(input.value) || 5)));
      input.value = service.minutes;
      toast(`${service.name} session duration updated.`);
    }
    persist(); renderServices(); fillServiceOptions(); updateDashboard();
  });
  document.getElementById('addServiceForm').addEventListener('submit', event => {
    event.preventDefault(); const name = document.getElementById('newServiceName').value.trim(); const price = Number(document.getElementById('newServicePrice').value); const minutes = Number(document.getElementById('newServiceMinutes').value);
    if (!name || !Number.isFinite(price) || price < 0 || price > 100000 || !Number.isFinite(minutes) || minutes < 5 || minutes > 600) { toast('Check the service name, price and session time.', 'error'); return; }
    state.services.push({ id: uid(), name: name.slice(0,80), price: Math.round(price), minutes: Math.round(minutes), description: 'Custom studio service' }); persist(); event.currentTarget.reset(); document.getElementById('newServicePrice').value = '299'; document.getElementById('newServiceMinutes').value = '30'; renderServices(); fillServiceOptions(); updateDashboard(); toast('New service added.');
  });
  document.getElementById('settingsForm').addEventListener('submit', event => {
    event.preventDefault(); const fd = new FormData(event.currentTarget);
    state.settings = { studioName: String(fd.get('studioName')||'Your Studio').trim().slice(0,70)||'Your Studio', language: ['English','Gujarati','Hinglish'].includes(fd.get('language')) ? fd.get('language') : 'English', tone: ['warm','premium','playful','minimal'].includes(fd.get('tone')) ? fd.get('tone') : 'warm' };
    persist(); updateIdentity();
    const contentTone = document.querySelector('#contentForm [name="tone"]');
    if (contentTone) contentTone.value = state.settings.tone;
    toast('Studio preferences saved on this device.');
  });
  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('clearData').addEventListener('click', () => {
    if (!window.confirm('Clear all NailFlow data stored in this browser? Export a backup first if you need it.')) return;
    localStorage.removeItem(STORE_KEY); state = defaultState(); currentQuoteDraft = null; currentContentDraft = null; persist(); updateIdentity(); fillServiceOptions(); renderServices(); updateDashboard(); renderPipeline(); renderSavedContent(); fillSettingsForm(); document.getElementById('quoteOutput').innerHTML = '<div class="output-placeholder"><div class="output-orbit"><span>✦</span></div><strong>Good communication is part of the service.</strong><p>Your quote, WhatsApp reply, aftercare and follow-up will appear here.</p></div>'; document.getElementById('contentOutput').innerHTML = '<div class="output-placeholder compact-output"><div class="output-orbit"><span>✎</span></div><strong>Your next post starts with your craft.</strong><p>Your caption, story and hashtags will appear here.</p></div>'; document.getElementById('contentModeBadge').textContent = 'Waiting'; document.getElementById('contentModeBadge').className = 'status-tag'; toast('Local data cleared.'); navigate('overview');
  });
}
function bootstrap() {
  updateIdentity(); fillServiceOptions(); renderServices(); updateDashboard(); renderPipeline(); fillSettingsForm(); installListeners(); checkStatus();
  renderSavedContent();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}
bootstrap();
