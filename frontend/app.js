/* ==========================================================
   SENTINEL AI — App Logic
   Navigation, chat engine, animations, demo responses
   ========================================================== */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  currentView: 'landing',
  currentMode: 'simple',   // 'simple' | 'advanced'
  messages: [],
  isTyping: false,
};

// ── View IDs ───────────────────────────────────────────────
const VIEWS = ['landing', 'mode-select', 'chat'];

// ── Suggestion prompts per mode ────────────────────────────
const SUGGESTIONS = {
  simple: [
    'Scrape https://supabase.com and summarize what they do',
    'Compare Vercel and Netlify pricing',
    'Find the top 5 Python web frameworks in 2025',
    'Search for the latest Next.js 15 features',
  ],
  advanced: [
    'Best open-source Firebase alternatives for Next.js',
    'Top vector databases for AI applications in 2025',
    'Compare Vercel and Netlify for React deployment',
    'Best ORM tools for Python developers',
  ],
};

// ── Demo AI Responses ──────────────────────────────────────
const SIMPLE_RESPONSES = [
  {
    trigger: ['supabase'],
    reply: `**Supabase** is an open-source Firebase alternative built on PostgreSQL.\n\n**Key offerings:**\n• ✅ Managed PostgreSQL database with real-time subscriptions\n• 🔐 Built-in auth (email, OAuth, magic links)\n• 📦 Object storage with a generous free tier\n• ⚡ Auto-generated REST & GraphQL APIs\n\n**Pricing:** Freemium — free tier includes 500MB database, 1GB storage, 50MB file uploads. Pro plan starts at $25/mo.\n\n**Tech Stack:** PostgreSQL · GoTrue · PostgREST · Realtime (Elixir) · Storage API`,
  },
  {
    trigger: ['vercel', 'netlify'],
    reply: `**Vercel vs Netlify** — Quick Comparison:\n\n| Feature | Vercel | Netlify |\n|---|---|---|\n| Best for | Next.js / React | Static sites / JAMstack |\n| Free tier | 100GB bandwidth | 100GB bandwidth |\n| Build speed | ⚡ Fastest | Fast |\n| Edge network | 100+ regions | 6 regions |\n| Price (Pro) | $20/mo | $19/mo |\n\n**Verdict:** Vercel wins for Next.js apps with its native framework support and edge runtime. Netlify is excellent for static sites and has more generous CI/CD minutes on the free plan.`,
  },
  {
    trigger: ['python', 'framework', 'web'],
    reply: `**Top 5 Python Web Frameworks (2025):**\n\n1. **FastAPI** ⚡ — Async, type-safe, OpenAPI auto-docs. Best for APIs & microservices.\n2. **Django** 🏗️ — Batteries-included full-stack framework. Best for complex web apps.\n3. **Flask** 🌶️ — Lightweight micro-framework. Best for small projects & prototyping.\n4. **Starlette** ✨ — ASGI foundation under FastAPI. Best for custom async services.\n5. **Litestar** 🚀 — Modern, highly performant. Rising star for production APIs.\n\nFor a new project in 2025, **FastAPI** is the go-to choice for APIs, and **Django** for full-stack web apps.`,
  },
];

const ADVANCED_RESPONSE = {
  steps: [
    { icon: '🔍', label: 'Extracting tool names from web search…', delay: 800 },
    { icon: '🕸️', label: 'Scraping official websites for each tool…', delay: 1800 },
    { icon: '🧠', label: 'Analyzing features, pricing & tech stacks…', delay: 2800 },
  ],
  tools: [
    {
      icon: '🗄️',
      name: 'Supabase',
      tags: ['Open Source', 'PostgreSQL', 'Freemium', 'REST API'],
      desc: 'Open-source Firebase alternative with a managed Postgres database, real-time subscriptions, built-in auth, and object storage. Excellent community support.',
    },
    {
      icon: '🔥',
      name: 'Firebase',
      tags: ['Google', 'NoSQL', 'Freemium', 'Realtime'],
      desc: 'Google\'s BaaS platform with Firestore NoSQL, Auth, Hosting, and Cloud Functions. Best-in-class mobile SDK support but proprietary lock-in.',
    },
    {
      icon: '🚀',
      name: 'PocketBase',
      tags: ['Open Source', 'SQLite', 'Self-hosted', 'Single Binary'],
      desc: 'Single-file open-source backend with built-in auth, file storage, and real-time APIs. Ideal for small-to-medium projects that need zero infrastructure overhead.',
    },
  ],
  recommendation: 'For a Next.js application, **Supabase** is the top recommendation — it offers a true PostgreSQL experience (enabling complex queries and joins), first-class Next.js/Vercel integration via Edge Functions, and a generous free tier. PocketBase is ideal for self-hosted, lightweight projects. Avoid Firebase if you want SQL querying or plan to migrate data later.',
};

// ── Utility helpers ────────────────────────────────────────
function getEl(id) { return document.getElementById(id); }
function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── View Navigation ────────────────────────────────────────
function showView(viewId) {
  const prev = document.querySelector('.view.active');
  if (prev) {
    prev.style.opacity = '0';
    prev.style.transform = 'translateY(12px)';
    setTimeout(() => {
      prev.classList.remove('active');
      prev.style.opacity = '';
      prev.style.transform = '';
    }, 300);
  }
  setTimeout(() => {
    const next = getEl(viewId);
    if (!next) return;
    next.classList.add('active');
    state.currentView = viewId;

    if (viewId === 'chat') setupChatView();
  }, prev ? 320 : 0);
}

// ── Mode Selection ────────────────────────────────────────
function selectMode(mode) {
  state.currentMode = mode;
  state.messages = [];
  showView('chat');
}

// ── Chat View Setup ────────────────────────────────────────
function setupChatView() {
  const mode = state.currentMode;

  // Badge
  const badge = getEl('chat-mode-badge');
  const label = getEl('chat-mode-label');
  badge.className = `mode-badge ${mode}`;
  label.textContent = mode === 'simple' ? '🤖 Simple Agent' : '🔬 Advanced Agent';

  // Send button colour
  const sendBtn = getEl('send-btn');
  sendBtn.className = `send-btn ${mode}`;

  // Placeholder
  getEl('chat-input').placeholder =
    mode === 'simple'
      ? 'Ask me to scrape, search, or research anything…'
      : 'Describe the developer tools you want to research…';

  // Welcome screen
  const welcomeIcon = getEl('welcome-icon');
  const welcomeTitle = getEl('welcome-title');
  const welcomeSub = getEl('welcome-sub');
  welcomeIcon.className = `chat-welcome-icon ${mode}`;
  welcomeIcon.textContent = mode === 'simple' ? '🤖' : '🔬';
  welcomeTitle.textContent = mode === 'simple' ? 'Simple AI Agent' : 'Advanced AI Agent';
  welcomeSub.textContent = mode === 'simple'
    ? 'Ask me to scrape websites, search the web, or extract any data — just chat naturally.'
    : 'Enter a developer tools query and I\'ll run a full 3-step LangGraph research pipeline to deliver a structured report.';

  // Suggestions
  renderSuggestions(mode);

  // Restore messages or show welcome
  renderMessages();
}

function renderSuggestions(mode) {
  const container = getEl('chat-suggestions');
  container.innerHTML = '';
  SUGGESTIONS[mode].forEach(text => {
    const btn = document.createElement('button');
    btn.className = 'chat-suggestion';
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-label', `Suggested prompt: ${text}`);
    btn.textContent = text;
    btn.addEventListener('click', () => sendMessage(text));
    container.appendChild(btn);
  });
}

// ── Message Rendering ─────────────────────────────────────
function renderMessages() {
  const body = getEl('chat-body');
  const welcome = getEl('chat-welcome');

  // Clear non-welcome content
  Array.from(body.children).forEach(child => {
    if (!child.id || child.id !== 'chat-welcome') child.remove();
  });

  if (state.messages.length === 0) {
    welcome.style.display = 'flex';
    return;
  }

  welcome.style.display = 'none';

  state.messages.forEach(msg => {
    if (!getEl(`msg-${msg.id}`)) {
      body.appendChild(buildMessageEl(msg));
    }
  });

  scrollToBottom();
}

function buildMessageEl(msg) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${msg.role}`;
  wrapper.id = `msg-${msg.id}`;

  if (msg.role === 'user') {
    wrapper.innerHTML = `
      <div class="msg-avatar user-av" aria-hidden="true">U</div>
      <div class="msg-content">
        <div class="msg-bubble">${escapeHtml(msg.text)}</div>
        <span class="msg-time" aria-label="Sent at ${msg.time}">${msg.time}</span>
      </div>`;
  } else if (msg.type === 'report') {
    wrapper.innerHTML = `
      <div class="msg-avatar ai" aria-hidden="true">🛡️</div>
      <div class="msg-content" style="max-width:100%">
        ${buildReportCard(msg)}
        <span class="msg-time" aria-label="Received at ${msg.time}">${msg.time}</span>
      </div>`;
  } else {
    wrapper.innerHTML = `
      <div class="msg-avatar ai" aria-hidden="true">🛡️</div>
      <div class="msg-content">
        <div class="msg-bubble">${formatMarkdown(msg.text)}</div>
        <span class="msg-time" aria-label="Received at ${msg.time}">${msg.time}</span>
      </div>`;
  }

  return wrapper;
}

function buildReportCard(msg) {
  const toolsHtml = msg.tools.map(t => `
    <div class="tool-result-card">
      <div class="tool-result-icon" aria-hidden="true">${t.icon}</div>
      <div class="tool-result-body">
        <div class="tool-result-name">${t.name}</div>
        <div class="tool-result-meta" aria-label="Tags for ${t.name}">
          ${t.tags.map(tag => `<span class="tool-meta-tag">${tag}</span>`).join('')}
        </div>
        <div class="tool-result-desc">${t.desc}</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="report-card" role="article" aria-label="Research report">
      <div class="report-header">
        <div class="report-header-icon" aria-hidden="true">📋</div>
        <div class="report-header-info">
          <div class="report-title">Research Report — ${msg.query}</div>
          <div class="report-meta">3-step LangGraph pipeline · ${msg.tools.length} tools analyzed</div>
        </div>
      </div>
      <div class="report-steps" aria-label="Pipeline steps completed">
        <div class="report-step">
          <div class="step-icon done" aria-label="Completed">✓</div>
          <span>Extracted tool names from web search</span>
        </div>
        <div class="report-step">
          <div class="step-icon done" aria-label="Completed">✓</div>
          <span>Scraped &amp; analyzed ${msg.tools.length} official websites</span>
        </div>
        <div class="report-step">
          <div class="step-icon done" aria-label="Completed">✓</div>
          <span>Generated expert recommendations</span>
        </div>
      </div>
      <div class="report-tools" aria-label="Analyzed tools">${toolsHtml}</div>
      <div class="report-recommendation">
        <div class="recommendation-label">💡 Expert Recommendation</div>
        <div class="recommendation-text">${formatMarkdown(msg.recommendation)}</div>
      </div>
    </div>
  `;
}

// ── Send Message ──────────────────────────────────────────
async function sendMessage(text) {
  if (state.isTyping) return;
  text = (text || '').trim();
  if (!text) return;

  // Clear input
  const input = getEl('chat-input');
  input.value = '';
  autoResizeTextarea(input);

  // Add user message
  const userMsg = {
    id: Date.now(),
    role: 'user',
    text,
    time: now(),
  };
  state.messages.push(userMsg);
  renderMessages();

  state.isTyping = true;
  getEl('send-btn').disabled = true;

  if (state.currentMode === 'simple') {
    await simulateSimpleResponse(text);
  } else {
    await simulateAdvancedResponse(text);
  }

  state.isTyping = false;
  getEl('send-btn').disabled = false;
  input.focus();
}

// ── Simple Mode Server Call ─────────────────────────────────
async function simulateSimpleResponse(query) {
  // Show typing indicator
  showTypingIndicator();

  try {
    // Extract recent context (last 5 messages excluding the current one)
    const history = state.messages
      .slice(Math.max(state.messages.length - 6, 0), state.messages.length - 1)
      .filter(m => m.role !== 'report')
      .map(m => ({ role: m.role, content: m.text }));

    const response = await fetch('http://localhost:8000/api/simple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query, history })
    });

    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    
    removeTypingIndicator();
    
    const aiMsg = {
      id: Date.now(),
      role: 'ai',
      text: data.reply,
      time: now(),
    };
    state.messages.push(aiMsg);
  } catch (error) {
    removeTypingIndicator();
    const aiMsg = {
      id: Date.now(),
      role: 'ai',
      text: `**Error:** Failed to connect to the backend server. Please ensure \`uvicorn server:app\` is running.\n\nDetails: ${error.message}`,
      time: now(),
    };
    state.messages.push(aiMsg);
  }
  
  renderMessages();
}

// ── Advanced Mode Server Call ───────────────────────────────
async function simulateAdvancedResponse(query) {
  const steps = [
    { icon: '🔍', label: 'Extracting tool names from web search…' },
    { icon: '🕸️', label: 'Scraping official websites for each tool…' },
    { icon: '🧠', label: 'Analyzing features, pricing & tech stacks…' }
  ];
  
  showPipelineIndicator(steps);

  try {
    // Start step 1
    updatePipelineStep(0);
    
    // We don't have real-time streaming steps from LangGraph yet,
    // so we'll visually cycle the steps every few seconds while waiting
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < 2) {
        stepIndex++;
        updatePipelineStep(stepIndex);
      }
    }, 4000);

    const response = await fetch('http://localhost:8000/api/advanced', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    clearInterval(interval);
    
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    
    // Final step complete
    updatePipelineStep(2);
    await delay(600);
    removePipelineIndicator();

    const reportMsg = {
      id: Date.now(),
      role: 'ai',
      type: 'report',
      query: query,
      tools: data.tools,
      recommendation: data.recommendation,
      time: now(),
    };
    state.messages.push(reportMsg);
  } catch (error) {
    removePipelineIndicator();
    const errorMsg = {
      id: Date.now(),
      role: 'ai',
      text: `**Error:** Failed to connect to the backend server. Please ensure \`uvicorn server:app\` is running.\n\nDetails: ${error.message}`,
      time: now(),
    };
    state.messages.push(errorMsg);
  }
  
  renderMessages();
}

// ── Typing Indicator ──────────────────────────────────────
function showTypingIndicator() {
  const body = getEl('chat-body');
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.id = 'typing-indicator';
  el.innerHTML = `
    <div class="msg-avatar ai" aria-hidden="true">🛡️</div>
    <div class="typing-bubble" aria-label="Sentinel AI is typing">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  body.appendChild(el);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = getEl('typing-indicator');
  if (el) el.remove();
}

// ── Pipeline Indicator ────────────────────────────────────
function showPipelineIndicator(steps) {
  const body = getEl('chat-body');
  const stepsHtml = steps.map((s, i) => `
    <div class="pipeline-step-item" id="pipeline-step-${i}" aria-label="Step ${i+1}: ${s.label}">
      <span aria-hidden="true">${i === 0 ? '⏳' : '○'}</span>
      <span>${s.label}</span>
    </div>
  `).join('');

  const el = document.createElement('div');
  el.className = 'pipeline-indicator';
  el.id = 'pipeline-indicator';
  el.innerHTML = `
    <div class="pipeline-header">
      <div class="pipeline-spinner" aria-hidden="true"></div>
      <span>Running LangGraph Pipeline…</span>
    </div>
    <div class="pipeline-steps-list" aria-label="Pipeline progress">${stepsHtml}</div>
  `;

  body.appendChild(el);
  scrollToBottom();
}

function updatePipelineStep(index) {
  const step = getEl(`pipeline-step-${index}`);
  if (step) {
    step.classList.add('done');
    step.querySelector('span').textContent = '✓';
  }
  const next = getEl(`pipeline-step-${index + 1}`);
  if (next) {
    next.classList.add('active');
    next.querySelector('span').textContent = '⏳';
  }
}

function removePipelineIndicator() {
  const el = getEl('pipeline-indicator');
  if (el) el.remove();
}

// ── Scroll ────────────────────────────────────────────────
function scrollToBottom() {
  const body = getEl('chat-body');
  requestAnimationFrame(() => {
    body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
  });
}

// ── Textarea auto-resize ──────────────────────────────────
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

// ── Markdown formatter (minimal) ──────────────────────────
function formatMarkdown(text) {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Inline code
    .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:\'JetBrains Mono\',monospace;font-size:0.85em">$1</code>')
    // Unordered list items
    .replace(/^[•\-\*] (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>')
    // Numbered list items
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;list-style:decimal">$1</li>')
    // Table rows (simple)
    .replace(/\|(.+)\|/g, (match, content) => {
      const cells = content.split('|').map(c => c.trim());
      const isHeader = cells.every(c => c.match(/^[-:]+$/));
      if (isHeader) return '';
      const tag = 'td';
      return `<tr>${cells.map(c => `<${tag} style="padding:6px 12px;border:1px solid rgba(255,255,255,0.06)">${c}</${tag}>`).join('')}</tr>`;
    })
    // Wrap consecutive <tr> in <table>
    .replace(/(<tr>[\s\S]+?<\/tr>)+/g, m => `<table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:13px">${m}</table>`)
    // Newlines to <br>
    .replace(/\n/g, '<br>');
}

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, m => map[m]);
}

// ── Delay helper ──────────────────────────────────────────
function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

// ── Landing Page Entrance Animation ──────────────────────
function animateLandingEntrance() {
  const hero = document.querySelector('.hero');
  if (hero) {
    hero.style.opacity = '0';
    hero.style.transform = 'translateY(30px)';
    requestAnimationFrame(() => {
      setTimeout(() => {
        hero.style.transition = 'opacity 0.9s ease, transform 0.9s ease';
        hero.style.opacity = '1';
        hero.style.transform = 'translateY(0)';
      }, 100);
    });
  }
}

// ── Intersection Observer — feature cards entrance ────────
function setupFeatureCardAnimations() {
  const cards = document.querySelectorAll('.feature-card');
  if (!('IntersectionObserver' in window)) return;

  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(24px)';
    card.style.transition = `opacity 0.5s ${i * 0.08}s ease, transform 0.5s ${i * 0.08}s ease`;
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  cards.forEach(card => observer.observe(card));
}

// ── Event Listeners ───────────────────────────────────────
function bindEvents() {
  // Landing → Mode Select
  getEl('nav-get-started').addEventListener('click', () => showView('mode-select'));
  getEl('hero-get-started').addEventListener('click', () => showView('mode-select'));
  getEl('cta-get-started').addEventListener('click', () => showView('mode-select'));

  // Quick nav links
  getEl('nav-simple').addEventListener('click', () => { state.currentMode = 'simple'; showView('chat'); });
  getEl('nav-advanced').addEventListener('click', () => { state.currentMode = 'advanced'; showView('chat'); });
  getEl('nav-docs').addEventListener('click', () => showView('mode-select'));
  getEl('hero-learn-more').addEventListener('click', () => {
    document.querySelector('.features-section').scrollIntoView({ behavior: 'smooth' });
  });

  // Keyboard support for nav links
  ['nav-simple', 'nav-advanced', 'nav-docs'].forEach(id => {
    getEl(id).addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); getEl(id).click(); }
    });
  });

  // Mode Select → back
  getEl('mode-back-btn').addEventListener('click', () => showView('landing'));

  // Mode Select → Chat
  getEl('select-simple').addEventListener('click', () => selectMode('simple'));
  getEl('select-advanced').addEventListener('click', () => selectMode('advanced'));

  // Keyboard navigation for mode cards
  ['select-simple', 'select-advanced'].forEach(id => {
    getEl(id).addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        getEl(id).click();
      }
    });
  });

  // Chat — change mode
  getEl('change-mode-btn').addEventListener('click', () => showView('mode-select'));

  // Chat — clear
  getEl('chat-clear-btn').addEventListener('click', () => {
    state.messages = [];
    renderMessages();
  });

  // Chat — send button
  getEl('send-btn').addEventListener('click', () => {
    const val = getEl('chat-input').value;
    if (val.trim()) sendMessage(val);
  });

  // Chat — Enter key to send (Shift+Enter for newline)
  getEl('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const val = getEl('chat-input').value;
      if (val.trim()) sendMessage(val);
    }
  });

  // Textarea auto-resize
  getEl('chat-input').addEventListener('input', e => autoResizeTextarea(e.target));
}

// ── Init ──────────────────────────────────────────────────
function init() {
  bindEvents();
  showView('landing');
  animateLandingEntrance();
  setupFeatureCardAnimations();
}

document.addEventListener('DOMContentLoaded', init);
