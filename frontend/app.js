/* ═══════════════════════════════════════════════════════════
   SENTINEL AI — Premium App Logic v4
   ═══════════════════════════════════════════════════════════ */
'use strict';

// ── State ────────────────────────────────────────────────
const S = {
  mode: 'simple',
  msgs: [],
  loading: false,
  sidebarOpen: true,
  recentChats: [],
  user: null,
  chatId: null
};

// ── Suggestions ──────────────────────────────────────────
const CHIPS = {
  simple: [
    { icon: '🌐', text: 'Scrape & summarise a website', hint: 'Powered by Firecrawl MCP' },
    { icon: '⚖️', text: 'Compare two products or services', hint: 'e.g. Vercel vs Netlify pricing' },
    { icon: '🔎', text: 'Find top tools for a tech stack', hint: 'e.g. best Python ORMs' },
    { icon: '📰', text: 'Get the latest news on a topic', hint: 'e.g. Next.js 15 features' },
  ],
  advanced: [
    { icon: '🔥', text: 'Best Firebase alternatives for Next.js', hint: 'Full 3-step LangGraph report' },
    { icon: '🗄️', text: 'Top vector databases for AI apps in 2025', hint: 'Full 3-step LangGraph report' },
    { icon: '▲', text: 'Vercel vs Netlify for React deployment', hint: 'Full 3-step LangGraph report' },
    { icon: '🐍', text: 'Best ORM tools for Python developers', hint: 'Full 3-step LangGraph report' },
  ],
};

// ── DOM ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const ts = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ── Boot ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindAll();
  setMode('simple');
  buildChips();
  checkAuth();
});

// ── Events ──────────────────────────────────────────────
function bindAll() {
  $('toggle-btn').addEventListener('click', toggleSidebar);
  $('new-chat-btn').addEventListener('click', newChat);
  $('clear-btn').addEventListener('click', clearChat);
  $('mode-btn-simple').addEventListener('click', () => setMode('simple'));
  $('mode-btn-advanced').addEventListener('click', () => setMode('advanced'));

  const inp = $('chat-input');
  inp.addEventListener('input', () => { grow(inp); guard(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  $('send-btn').addEventListener('click', () => send());

  $('sign-out-btn').addEventListener('click', doSignOut);
}

// ── Authentication ──────────────────────────────────────
function checkAuth() {
  const savedUser = localStorage.getItem('sentinel_user');
  if (savedUser) {
    try {
      S.user = JSON.parse(savedUser);
      updateUserUI();
      loadUserChats();
    } catch (e) {
      showLogin();
    }
  } else {
    showLogin();
  }
}

function showLogin() {
  $('login-modal').classList.add('active');

  const mockBtn = $('mock-google-btn');
  if (mockBtn) {
    mockBtn.onclick = () => {
      $('login-modal').classList.remove('active');
      openGoogleModal();
    };
  }
}

function openGoogleModal() {
  const modal = $('google-email-modal');
  modal.style.display = 'flex';
  // Reset to email step
  $('google-step-email').style.display = 'block';
  $('google-step-confirm').style.display = 'none';
  $('google-modal-error').style.display = 'none';
  const inp = $('google-email-input');
  inp.value = '';
  setTimeout(() => inp.focus(), 100);

  // Enter key on email input
  inp.onkeydown = (e) => { if (e.key === 'Enter') googleEmailNext(); };
}

function closeGoogleModal() {
  $('google-email-modal').style.display = 'none';
  $('login-modal').classList.add('active');
}

function googleBackToEmail() {
  $('google-step-confirm').style.display = 'none';
  $('google-step-email').style.display = 'block';
  $('google-modal-error').style.display = 'none';
  setTimeout(() => $('google-email-input').focus(), 100);
}

function googleEmailNext() {
  const email = $('google-email-input').value.trim();
  const errEl = $('google-modal-error');
  errEl.style.display = 'none';

  if (!email || !email.includes('@')) {
    errEl.textContent = 'Enter a valid email address.';
    errEl.style.display = 'block';
    $('google-email-input').style.border = '1px solid #d93025';
    return;
  }
  $('google-email-input').style.border = '1px solid #dadce0';

  // Derive a display name from the email (part before @)
  const localPart = email.split('@')[0];
  const displayName = localPart
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  // Use UI Avatars with the derived name
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1a73e8&color=fff&size=128&bold=true`;

  // Populate confirm step
  $('google-profile-img').src = avatarUrl;
  $('google-display-name').textContent = displayName;
  $('google-display-email').textContent = email;

  // Store for use at confirm
  $('google-email-modal').dataset.email = email;
  $('google-email-modal').dataset.name = displayName;
  $('google-email-modal').dataset.picture = avatarUrl;

  $('google-step-email').style.display = 'none';
  $('google-step-confirm').style.display = 'block';
}

async function googleConfirmLogin() {
  const modal = $('google-email-modal');
  const email = modal.dataset.email;
  const displayName = modal.dataset.name;
  const picture = modal.dataset.picture;

  // Use the local part of the email as the backend username key
  const username = email.split('@')[0].replace(/[._-]/g, '').toLowerCase();

  let userId = 'local-' + username;
  try {
    const res = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const data = await res.json();
      userId = data.user_id;
    }
  } catch (e) {
    console.info('Server not reachable, using local session.');
  }

  S.user = { user_id: userId, username, googleName: displayName, email, picture };
  localStorage.setItem('sentinel_user', JSON.stringify(S.user));

  modal.style.display = 'none';
  $('login-modal').classList.remove('active');

  updateUserUI();
  loadUserChats();
}

function updateUserUI() {
  if (S.user) {
    const dName = document.getElementById('user-name-display');
    const dAva = document.getElementById('user-avatar-char');
    const greetEl = document.getElementById('home-greeting-name');
    const firstName = (S.user.googleName || S.user.username).split(' ')[0];

    if (dName) dName.textContent = S.user.googleName || S.user.username;
    if (greetEl) greetEl.textContent = firstName + '.';
    if (dAva) {
      if (S.user.picture) {
        dAva.innerHTML = `<img src="${S.user.picture}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" referrerpolicy="no-referrer">`;
      } else {
        dAva.textContent = (S.user.googleName || S.user.username).charAt(0).toUpperCase();
      }
    }
  }
}


function doSignOut() {
  S.user = null;
  S.chatId = null;
  S.recentChats = [];
  S.msgs = [];
  localStorage.removeItem('sentinel_user');

  // Reset UI to logged-out state
  const dName = document.getElementById('user-name-display');
  const dAva = document.getElementById('user-avatar-char');
  const greetEl = document.getElementById('home-greeting-name');
  if (dName) dName.textContent = 'Username';
  if (dAva) { dAva.innerHTML = ''; dAva.textContent = 'S'; }
  if (greetEl) greetEl.textContent = 'Friend.';

  resetToHome();
  renderRecent();
  showLogin();
}

// ── Sidebar ──────────────────────────────────────────────
function toggleSidebar() {
  S.sidebarOpen = !S.sidebarOpen;
  $('sidebar').classList.toggle('closed', !S.sidebarOpen);
  $('toggle-btn').setAttribute('aria-expanded', String(S.sidebarOpen));
  // Shift pipeline offset
  updatePipelineOffset();
}

function updatePipelineOffset() {
  const pf = $('pipeline-float');
  if (S.sidebarOpen) {
    pf.style.removeProperty('transform');
  } else {
    pf.style.transform = 'translateX(-50%) translateY(0)';
  }
}

// ── Mode ────────────────────────────────────────────────
function setMode(m) {
  S.mode = m;

  ['simple', 'advanced'].forEach(id => {
    const btn = $(`mode-btn-${id}`);
    const active = id === m;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', String(active));
    btn.querySelector('.active-badge').style.display = active ? '' : 'none';
  });

  $('pill-label').textContent = m === 'simple'
    ? 'Simple Agent · Gemini 2.5 Flash'
    : 'Advanced Agent · LangGraph Pipeline';

  $('input-mode-tag').textContent = m === 'simple' ? '🤖 Simple' : '🔬 Advanced';

  if ($('home-sub')) {
    $('home-sub').textContent = m === 'simple'
      ? 'What would you like to research today?'
      : 'I\'ll run a 3-step LangGraph pipeline and return a structured report.';
  }

  if (S.msgs.length === 0) buildChips();
}

// ── New Chat / Clear ─────────────────────────────────────
function newChat() {
  S.msgs = [];
  S.chatId = null;
  resetToHome();
  renderRecent();
}

function clearChat() {
  S.msgs = [];
  S.chatId = null;
  resetToHome();
  renderRecent();
}

function resetToHome() {
  const mc = document.querySelector('.msgs');
  if (mc) mc.remove();
  const h = $('home');
  if (h) {
    h.style.display = 'flex';
    h.style.animation = 'none';
    requestAnimationFrame(() => {
      h.style.animation = 'rise .45s cubic-bezier(.25,.46,.45,.94) both';
    });
  }
  buildChips();
  $('chat-input').value = '';
  grow($('chat-input'));
  guard();
}

// ── Chips ────────────────────────────────────────────────
function buildChips() {
  const c = $('chips');
  if (!c) return;
  c.innerHTML = '';
  CHIPS[S.mode].forEach((ch, i) => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.style.animationDelay = `${i * 0.07}s`;
    btn.innerHTML = `
      <span class="chip-icon">${ch.icon}</span>
      <span class="chip-text">${ch.text}</span>
      <span class="chip-hint">${ch.hint}</span>
    `;
    btn.addEventListener('click', () => send(ch.text));
    c.appendChild(btn);
  });
}

// ── Send ─────────────────────────────────────────────────
async function send(forced) {
  if (S.loading) return;
  const inp = $('chat-input');
  const text = (forced ?? inp.value).trim();
  if (!text) return;

  inp.value = '';
  grow(inp);
  guard();

  // Hide home
  const home = $('home');
  if (home) home.style.display = 'none';

  // Get/create msgs container
  const container = getMsgs();

  // Ensure we have a chat session
  if (!S.chatId && S.user) {
    try {
      const res = await fetch('http://localhost:8000/api/history/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: S.user.user_id,
          title: text.slice(0, 46) + (text.length > 46 ? '…' : ''),
          mode: S.mode
        })
      });
      if (res.ok) {
        const data = await res.json();
        S.chatId = data.session_id;
        loadUserChats();
      }
    } catch (e) {
      console.error("Failed to create chat session", e);
    }
  }

  // User message
  S.msgs.push({ id: Date.now(), role: 'user', text });
  container.appendChild(mkUser(text));
  scrollDown();

  S.loading = true;
  $('send-btn').disabled = true;

  if (S.mode === 'simple') await doSimple(text, container);
  else await doAdvanced(text, container);

  S.loading = false;
  guard();
  inp.focus();
}

// ── Simple API ───────────────────────────────────────────
async function doSimple(query, container) {
  const typer = mkTyping();
  container.appendChild(typer);
  scrollDown();

  const history = S.msgs
    .slice(Math.max(0, S.msgs.length - 8), S.msgs.length - 1)
    .filter(m => m.role !== 'report')
    .map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.text }));

  const bodyParams = { message: query, history };
  if (S.chatId) bodyParams.chat_id = S.chatId;

  try {
    const res = await fetch('http://localhost:8000/api/simple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyParams),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    typer.remove();
    const msg = { id: Date.now(), role: 'ai', text: data.reply };
    S.msgs.push(msg);
    container.appendChild(mkAi(msg.text));
  } catch (e) {
    typer.remove();
    container.appendChild(mkError(e.message));
  }
  scrollDown();
}

// ── Advanced API ──────────────────────────────────────────
async function doAdvanced(query, container) {
  showPipeline(['🔍 Extracting tool names from the web…', '🕸️ Scraping official websites…', '🧠 Generating structured report…']);

  let step = 0;
  const iv = setInterval(() => { if (step < 2) pipelineStep(++step); }, 5000);

  const bodyParams = { query };
  if (S.chatId) bodyParams.chat_id = S.chatId;

  try {
    const res = await fetch('http://localhost:8000/api/advanced', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyParams),
    });
    clearInterval(iv);
    pipelineStep(2);
    await pause(500);
    hidePipeline();
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const msg = { id: Date.now(), role: 'ai', type: 'report', query, tools: data.tools, recommendation: data.recommendation };
    S.msgs.push(msg);
    container.appendChild(mkReport(msg));
  } catch (e) {
    clearInterval(iv);
    hidePipeline();
    container.appendChild(mkError(e.message));
  }
  scrollDown();
}

// ── Pipeline ─────────────────────────────────────────────
let _pSteps = [];
function showPipeline(steps) {
  _pSteps = steps;
  const list = $('pipeline-steps');
  list.innerHTML = '';
  steps.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'pstep' + (i === 0 ? ' active' : '');
    d.id = `ps-${i}`;
    d.innerHTML = `<span class="pstep-icon">${i === 0 ? '⏳' : '○'}</span><span>${s}</span>`;
    list.appendChild(d);
  });
  const pf = $('pipeline-float');
  pf.setAttribute('aria-hidden', 'false');
  updatePipelineOffset();
}

function pipelineStep(i) {
  for (let j = 0; j < i; j++) {
    const el = $(`ps-${j}`);
    if (el) { el.className = 'pstep done'; el.querySelector('.pstep-icon').textContent = '✓'; }
  }
  const cur = $(`ps-${i}`);
  if (cur) { cur.className = 'pstep active'; cur.querySelector('.pstep-icon').textContent = '⏳'; }
}

function hidePipeline() { $('pipeline-float').setAttribute('aria-hidden', 'true'); }

// ── Build Elements ────────────────────────────────────────
function getMsgs() {
  let c = document.querySelector('.msgs');
  if (!c) {
    c = document.createElement('div');
    c.className = 'msgs';
    $('chat-area').appendChild(c);
  }
  return c;
}

function mkUser(text) {
  const d = document.createElement('div');
  d.className = 'row-user';
  const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  d.innerHTML = `
    <div class="bubble-user">
      ${esc(text)}
      <div class="bubble-user-meta">${time}</div>
    </div>
  `;
  return d;
}

function mkAi(text) {
  const d = document.createElement('div');
  d.className = 'row-ai';
  const copyId = 'c' + Math.random().toString(36).slice(2);
  const isAdv = S.mode === 'advanced';
  const agentName = isAdv ? 'Advanced Agent' : 'Simple Agent';
  const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  d.innerHTML = `
    <div class="ai-gem">${gemSvg()}</div>
    <div class="ai-body">
      <div class="ai-body-meta">
        <span class="ai-badge">${agentName}</span>
        <span>• ${time}</span>
      </div>
      <div class="ai-text">${md(text)}</div>
      <div class="ai-actions">
        <button class="ai-action" id="${copyId}" onclick="cpText('${copyId}',${JSON.stringify(text).replace(/</g,'\\u003c')})">
          ${copyIco()} Copy text
        </button>
      </div>
    </div>
  `;
  return d;
}

function mkTyping() {
  const d = document.createElement('div');
  d.className = 'row-typing';
  d.innerHTML = `
    <div class="ai-gem">${gemSvg()}</div>
    <div class="typing-bub">
      <div class="td"></div><div class="td"></div><div class="td"></div>
    </div>
  `;
  return d;
}

function mkError(msg) {
  const d = document.createElement('div');
  d.className = 'row-ai';
  d.innerHTML = `
    <div class="ai-gem">${gemSvg()}</div>
    <div class="ai-body">
      <div class="msg-error">
        <strong>Connection error</strong> — Make sure the server is running at <code>localhost:8000</code>.<br>
        <span style="font-size:12px;opacity:.65">Details: ${esc(msg)}</span>
      </div>
    </div>
  `;
  return d;
}

function mkReport(m) {
  const toolsHtml = (m.tools || []).map(t => `
    <div class="tool-row">
      <div class="tool-emoji">${t.icon}</div>
      <div class="tool-body">
        <div class="tool-name">${t.name}</div>
        <div class="tool-tags">${(t.tags||[]).map(tag => `<span class="ttag">${tag}</span>`).join('')}</div>
        <div class="tool-desc">${t.desc}</div>
      </div>
    </div>
  `).join('');

  const d = document.createElement('div');
  d.className = 'row-ai';
  d.innerHTML = `
    <div class="ai-gem">${gemSvg()}</div>
    <div class="ai-body" style="max-width:100%">
      <div class="report">
        <div class="report-top">
          <div class="report-top-icon">📋</div>
          <div>
            <div class="report-top-title">Research Report — ${esc(m.query)}</div>
            <div class="report-top-meta">3-step LangGraph pipeline · ${(m.tools||[]).length} tools analysed</div>
          </div>
        </div>
        <div class="report-steps-row">
          <div class="rstep"><div class="rcheck">✓</div> Extracted tool names</div>
          <div class="rstep"><div class="rcheck">✓</div> Scraped ${(m.tools||[]).length} sites</div>
          <div class="rstep"><div class="rcheck">✓</div> Generated report</div>
        </div>
        ${toolsHtml}
        <div class="report-rec">
          <div class="rec-label">💡 Expert Recommendation</div>
          <div class="rec-body">${md(m.recommendation || 'No recommendation available.')}</div>
        </div>
      </div>
    </div>
  `;
  return d;
}

// ── History & Recent ────────────────────────────────────────
async function loadUserChats() {
  if (!S.user) return;
  try {
    const res = await fetch(`http://localhost:8000/api/history/user/${S.user.user_id}`);
    if (!res.ok) return;
    const data = await res.json();
    S.recentChats = data.sessions || [];
    renderRecent();
  } catch (e) {
    console.error('Failed to load chats:', e);
  }
}

async function loadChatHistory(chat) {
  if (S.chatId === chat.id) return;
  S.chatId = chat.id;
  setMode(chat.mode || 'simple');
  
  try {
    const res = await fetch(`http://localhost:8000/api/history/chat/${chat.id}`);
    if (!res.ok) return;
    const data = await res.json();
    
    const home = $('home');
    if (home) home.style.display = 'none';
    
    const mc = document.querySelector('.msgs');
    if (mc) mc.remove();
    
    const container = getMsgs();
    S.msgs = [];
    
    data.messages.forEach(msg => {
      if (msg.role === 'user') {
        S.msgs.push({ id: msg.id, role: 'user', text: msg.content });
        container.appendChild(mkUser(msg.content));
      } else if (msg.role === 'ai') {
        if (msg.message_type === 'report') {
           const extra = msg.extra_data ? JSON.parse(msg.extra_data) : {};
           const rMsg = { id: msg.id, role: 'ai', type: 'report', query: extra.query || 'Report', tools: extra.tools, recommendation: extra.recommendation || msg.content };
           S.msgs.push(rMsg);
           container.appendChild(mkReport(rMsg));
        } else {
           S.msgs.push({ id: msg.id, role: 'ai', text: msg.content });
           container.appendChild(mkAi(msg.content));
        }
      }
    });
    
    scrollDown();
    renderRecent();
  } catch (e) {
    console.error('Failed to load history:', e);
  }
}

function renderRecent() {
  const el = $('recent-list');
  el.innerHTML = '';
  if (!S.recentChats.length) {
    el.innerHTML = '<p class="empty-hint">Your conversations will appear here</p>';
    return;
  }
  S.recentChats.forEach(chat => {
    const d = document.createElement('div');
    d.className = 'recent-item';
    if (chat.id === S.chatId) d.style.background = 'var(--c-hover)';
    d.innerHTML = `<div class="recent-dot"></div><span>${esc(chat.title)}</span>`;
    d.addEventListener('click', () => loadChatHistory(chat));
    el.appendChild(d);
  });
}

// ── Utilities ─────────────────────────────────────────────
function scrollDown() {
  const a = $('chat-area');
  requestAnimationFrame(() => a.scrollTo({ top: a.scrollHeight, behavior: 'smooth' }));
}

function grow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

function guard() {
  $('send-btn').disabled = !$('chat-input').value.trim() || S.loading;
}

function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

function esc(s = '') {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function showToast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function cpText(btnId, text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!');
  });
}

function copyIco() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
}

function gemSvg() {
  const id = 'g' + Math.random().toString(36).slice(2);
  return `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 2C16 9.732 9.732 16 2 16C9.732 16 16 22.268 16 30C16 22.268 22.268 16 30 16C22.268 16 16 9.732 16 2Z" fill="url(#${id})"/>
    <defs>
      <linearGradient id="${id}" x1="2" y1="2" x2="30" y2="30">
        <stop stop-color="#818cf8"/><stop offset=".5" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/>
      </linearGradient>
    </defs>
  </svg>`;
}

function md(text = '') {
  if (!text) return '';

  // 1. Escape HTML entities first (only in text segments, not tags we create)
  const ESC = s => s
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');

  // 2. Process fenced code blocks (``` lang ... ```) FIRST before any other processing
  let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = lang ? `<span class="md-code-lang">${ESC(lang)}</span>` : '';
    return `<div class="md-code-block">${langLabel}<pre><code>${ESC(code.trim())}</code></pre></div>`;
  });

  // 3. Split into lines for block-level processing
  const lines = processed.split('\n');
  const output = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);
    const h4 = line.match(/^#### (.+)/);

    if (h1) { output.push(`<h1 class="md-h1">${inlineFormat(h1[1])}</h1>`); i++; continue; }
    if (h2) { output.push(`<h2 class="md-h2">${inlineFormat(h2[1])}</h2>`); i++; continue; }
    if (h3) { output.push(`<h3 class="md-h3">${inlineFormat(h3[1])}</h3>`); i++; continue; }
    if (h4) { output.push(`<h4 class="md-h4">${inlineFormat(h4[1])}</h4>`); i++; continue; }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      output.push('<hr class="md-hr">'); i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      let bqLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bqLines.push(inlineFormat(lines[i].slice(2)));
        i++;
      }
      output.push(`<blockquote class="md-blockquote">${bqLines.join('<br>')}</blockquote>`);
      continue;
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && /^\|?[\s|:-]+\|/.test(lines[i + 1])) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines.filter(r => !/^\|?[\s|:-]+\|/.test(r));
      let tableHtml = '<div class="md-table-wrap"><table class="md-table">';
      rows.forEach((row, ri) => {
        const cells = row.split('|').map(c => c.trim()).filter((c, ci, arr) => ci !== 0 || c !== '' || arr.length > 1);
        const tag = ri === 0 ? 'th' : 'td';
        tableHtml += `<tr>${cells.filter(c => c !== undefined).map(c => `<${tag}>${inlineFormat(c)}</${tag}>`).join('')}</tr>`;
      });
      tableHtml += '</table></div>';
      output.push(tableHtml);
      continue;
    }

    // Unordered list
    if (/^(\s*)([-*•]) /.test(line)) {
      let listItems = [];
      while (i < lines.length && /^(\s*)([-*•]) /.test(lines[i])) {
        const content = lines[i].replace(/^(\s*)([-*•]) /, '');
        listItems.push(`<li>${inlineFormat(content)}</li>`);
        i++;
      }
      output.push(`<ul class="md-ul">${listItems.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      let listItems = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const content = lines[i].replace(/^\d+\. /, '');
        listItems.push(`<li>${inlineFormat(content)}</li>`);
        i++;
      }
      output.push(`<ol class="md-ol">${listItems.join('')}</ol>`);
      continue;
    }

    // Blank line → paragraph break
    if (line.trim() === '') {
      output.push('<div class="md-spacer"></div>');
      i++;
      continue;
    }

    // Regular paragraph line
    output.push(`<p class="md-p">${inlineFormat(line)}</p>`);
    i++;
  }

  return output.join('');
}

// Inline formatting (bold, italic, code, links, strikethrough)
function inlineFormat(text) {
  return text
    // Already-processed code block placeholders — skip
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    // HTML-escape
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    // Bold-italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    // Links  [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>');
}

