(function () {
  const currentScript = document.currentScript;
  if (!currentScript) { console.error("zoabit: currentScript is null."); return; }

  const chatbotId = currentScript.getAttribute("data-id");
  if (!chatbotId) { console.error('zoabit: Add data-id="YOUR_CHATBOT_ID" to the script tag.'); return; }

  const backendOrigin = new URL(currentScript.src).origin;

  // ── State ─────────────────────────────────────────────────────────────────
  let isOpen = false;
  let isMinimized = false;
  let inputVal = "";
  let history = [];
  let isLoading = false;
  let config = null;
  let shadow = null; // set once in init()

  const HISTORY_KEY = `zoabit_history_${chatbotId}`;
  try { const s = localStorage.getItem(HISTORY_KEY); if (s) history = JSON.parse(s); } catch (e) { }

  // ── Config helpers ────────────────────────────────────────────────────────
  function c(path, fallback) {
    if (!config) return fallback;
    return path.split('.').reduce((o, k) => o?.[k], config) ?? fallback;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function saveHistory() { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }

  function formatMarkdown(text) {
    if (!text) return "";
    let h = text.replace(/\n/g, "<br/>");
    h = h.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
    h = h.replace(/^### (.*$)/gm, "<h3>$1</h3>");
    // Simple list support
    h = h.replace(/^\s*[-*]\s+(.*)$/gm, "<li>$1</li>");
    if (h.includes("<li>")) h = h.replace(/(<li>.*<\/li>+)/s, "<ul>$1</ul>");
    return h;
  }

  function buildMessagesHTML() {
    const greeting = c('greeting', 'Hello! How can I help you today?');
    const faqs = c('faq', []);
    const replyType = c('style.replyStyle.replyType', 'bubble');
    const senderType = c('style.senderStyle.senderType', 'bubble');
    let html = '';

    if (history.length === 0) {
      const gText = greeting ? formatMarkdown(greeting) : "Hello!";
      const greetingStyle = replyType === 'text' ? 'style-text' : '';
      html += `
        <div class="msg-row bot ${greetingStyle}">
          <div class="msg-wrap">
            <div class="msg-avatar">${icons.bot}</div>
            <div class="bubble">${gText}</div>
          </div>
        </div>`;
    }

    history.forEach(msg => {
      const isUser = msg.role === 'user';
      const st = isUser ? (senderType === 'text' ? 'style-text' : '') : (replyType === 'text' ? 'style-text' : '');
      html += `
        <div class="msg-row ${isUser ? 'user' : 'bot'} ${st}">
          <div class="msg-wrap">
            <div class="msg-avatar">${isUser ? icons.user : icons.bot}</div>
            <div class="bubble">${formatMarkdown(msg.content)}</div>
          </div>
        </div>`;
    });

    if (isLoading) {
      html += `
        <div class="msg-row bot loading-row">
          <div class="msg-wrap">
            <div class="msg-avatar">${icons.bot}</div>
            <div class="bubble"><div class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div></div>
          </div>
        </div>`;
    }
    return html;
  }

  // ── SVG Icons ─────────────────────────────────────────────────────────────
  const icons = {
    msg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>',
    bot: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>',
    user: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    min: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>',
    max: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    x: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    send: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    arrL: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    arrR: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  };

  // ── CSS ───────────────────────────────────────────────────────────────────
  function buildCSS() {
    const primary = c('style.brandColor.primary', '#158effff');
    const secondary = c('style.brandColor.secondary', '#003ba8ff');
    const accent = c('style.brandColor.accent', '#53d7ffff');
    const bgColor = c('style.bgColor', '#ffffff');
    const textColor = c('style.textColor', '#000000');
    const replyBg = c('style.replyStyle.bgColor', 'transparent');
    const replyClr = c('style.replyStyle.textColor', '#1e1e1e');
    const senderBg = c('style.senderStyle.bgColor', '#158effff');
    const senderClr = c('style.senderStyle.textColor', '#ffffff');

    const getBase = color => (color && color.startsWith('#') && color.length > 7) ? color.substring(0, 7) : color;
    const pBase = getBase(primary);
    const sbBase = getBase(senderBg);

    const isLeft = c('position', 'bottom-right') === 'bottom-left';
    const side = isLeft ? 'left' : 'right';
    const winRadius = c('style.corner', 'rounded') === 'square' ? '0px' : '20px';
    const avatarRad = c('style.icon', 'rounded') === 'square' ? '4px' : '50%';
    const chipRadius = c('style.corner', 'rounded') === 'square' ? '0px' : '20px';

    return `
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }

      .widget-btn {
        position: fixed; ${side}: 24px; bottom: 24px;
        width: 56px; height: 56px;
        background: ${primary}; color: #fff;
        border-radius: ${avatarRad}; border: none;
        // box-shadow: 0 8px 30px ${pBase}77;
        cursor: pointer; z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s;
      }
      .widget-btn:hover { transform: scale(1.12); }

      /* The window — NO animation here; animation handled by .window-enter class */
      .chat-window {
        position: fixed; ${side}: 24px; bottom: 96px;
        width: 420px; height: 620px; max-height: calc(100vh - 120px);
        background: ${bgColor}; color: ${textColor};
        border-radius: ${winRadius}; border: 1px solid rgba(0,0,0,0.08);
        box-shadow: 0 24px 64px rgba(0,0,0,0.18);
        display: flex; flex-direction: column; overflow: hidden;
        z-index: 2147483647;
        transition: height 0.3s cubic-bezier(0.165, 0.84, 0.44, 1),
                    width  0.3s cubic-bezier(0.165, 0.84, 0.44, 1),
                    border-radius 0.3s;
      }
      /* Only animate on first open */
      .chat-window.window-enter {
        animation: sbIn 0.35s cubic-bezier(0.165, 0.84, 0.44, 1) forwards;
      }
      @keyframes sbIn {
        from { opacity: 0; transform: scale(0.88) translateY(16px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
      .chat-window.minimized { height: 64px; width: 340px; border-radius: 16px; }

      @media (max-width: 639px) {
        .chat-window { inset: 0; width: 100%; height: 100%; border-radius: 0; max-height: 100%; }
        .chat-window.minimized { inset: auto; ${side}: 12px; bottom: 12px; height: 60px; width: 220px; border-radius: 16px; }
        .widget-btn { ${side}: 16px; bottom: 16px; }
        .widget-btn.hide-on-mobile { display: none !important; }
      }

      .chat-header {
        padding: 14px 16px; flex-shrink: 0;
        background: ${primary};
        color: #fff;
        display: flex; align-items: center; justify-content: space-between;
      }
      .header-left { display: flex; align-items: center; gap: 10px; }
      .bot-avatar-wrap {
        width: 36px; height: 36px; border-radius: ${avatarRad};
        background: rgba(255,255,255,0.18); border: 1.5px solid rgba(255,255,255,0.3);
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .header-name  { font-size: 14px; font-weight: 700; line-height: 1.2; }
      .header-status { display: flex; align-items: center; gap: 5px; font-size: 11px; opacity: 0.9; margin-top: 2px; }
      .pulse-dot {
        width: 6px; height: 6px; border-radius: 50%; background: #4ade80;
        animation: pulse 2s ease-in-out infinite;
      }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

      .header-actions { display: flex; align-items: center; gap: 2px; }
      .header-actions button {
        background: transparent; border: none; color: rgba(255,255,255,0.7); padding: 6px;
        border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.15s, color 0.15s;
      }
      .header-actions button:hover { background: rgba(255,255,255,0.15); color: #fff; }

      .chat-body {
        flex: 1; overflow-y: auto; padding: 16px;
        display: flex; flex-direction: column; gap: 12px;
        background: ${bgColor};
      }
      .chat-body::-webkit-scrollbar { width: 5px; }
      .chat-body::-webkit-scrollbar-track { background: transparent; }
      .chat-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 8px; }

      .faq-wrap {
        position: relative; margin-bottom: 8px; display: flex; align-items: center; width: 100%;
      }
      .faq-strip {
        display: flex; gap: 8px; overflow-x: auto; scroll-behavior: smooth;
        flex: 1; padding: 2px 0;
      }
      .faq-strip::-webkit-scrollbar { display: none; }
      .faq-strip { -ms-overflow-style: none; scrollbar-width: none; }
      
      .faq-nav {
        flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
        background: ${bgColor}; border: 1px solid rgba(0,0,0,0.1);
        color: ${textColor}; display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 2; transition: background 0.2s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin: 0 4px;
      }
      .faq-nav:hover { background: rgba(0,0,0,0.04); }
      .faq-nav.hidden { display: none; }
      
      .faq-chip {
        flex-shrink: 0; padding: 6px 12px; border-radius: ${chipRadius}; font-size: 12px; font-weight: 500;
        background: transparent; border: 1px solid ${primary}; color: ${primary};
        cursor: pointer; line-height: 1.4; transition: all 0.2s; white-space: nowrap;
      }
      .faq-chip:hover { color: #fff; background: ${primary}; }

      .msg-row { display: flex; }
      .msg-row.user { justify-content: flex-end; }
      .msg-row.bot  { justify-content: flex-start; }
      .msg-wrap { display: flex; gap: 8px; max-width: 82%; align-items: flex-start; }
      .msg-row.user .msg-wrap { flex-direction: row-reverse; }

      .msg-avatar {
        width: 26px; height: 26px; border-radius: ${avatarRad};
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; font-size: 11px; font-weight: 700;
        margin-top: 4px; /* Align with first line of bubble text */
      }
      .msg-row.user .msg-avatar { background: ${senderBg}; color: ${senderClr}; }
      .msg-row.bot  .msg-avatar { background: ${replyBg};   color: ${replyClr}; }

      .bubble {
        padding: 10px 14px; font-size: 13.5px; line-height: 1.55;
        word-break: break-word;
      }
      .msg-row.user .bubble {
        background: ${senderBg}; color: ${senderClr};
        border-radius: 16px 2px 16px 16px;
        box-shadow: 0 4px 12px ${sbBase}44;
      }
      .msg-row.bot .bubble {
        background: ${replyBg === 'transparent' ? pBase + '11' : replyBg};
        color: ${replyClr};
        border: 1px solid ${pBase}18;
        border-radius: 2px 16px 16px 16px;
      }
      .bubble a { color: ${accent}; }
      .bubble code { background: rgba(0,0,0,0.07); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
      .bubble strong { font-weight: 600; }

      /* text style overrides */
      .style-text.msg-row.user .bubble,
      .style-text.msg-row.bot  .bubble {
        background: transparent; border: none; box-shadow: none;
        // border-bottom: 1px solid rgba(0,0,0,0.07);
        border-radius: 0; padding: 6px 0;
      }
      .style-text.msg-row.user .bubble { color: ${senderBg}; }
      .style-text.msg-row.bot  .bubble { color: ${textColor}; }

      .loading-row .bubble { background: transparent !important; border: none !important; box-shadow: none !important; padding: 8px 4px; }
      .dots { display: flex; gap: 5px; align-items: center; }
      .dot  { width: 7px; height: 7px; border-radius: 50%; background: ${primary}; opacity: 0.5; animation: bounce 1.2s infinite ease-in-out both; }
      .dot:nth-child(1){animation-delay:-0.3s} .dot:nth-child(2){animation-delay:-0.15s}
      @keyframes bounce { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }

      .chat-footer {
        padding: 12px 16px; border-top: 1px solid rgba(0,0,0,0.06);
        background: ${bgColor}; flex-shrink: 0;
      }
      .input-row { position: relative; display: flex; align-items: center; }
      .chat-input {
        width: 100%; padding: 11px 48px 11px 16px;
        border: 1.5px solid rgba(0,0,0,0.1); border-radius: 12px;
        font-size: 13.5px; outline: none; background: rgba(0,0,0,0.03);
        color: ${textColor}; transition: border-color 0.2s, box-shadow 0.2s;
      }
      .chat-input:focus { border-color: ${primary}; box-shadow: 0 0 0 3px ${pBase}22; }
      .send-btn {
        position: absolute; right: 8px; width: 32px; height: 32px;
        background: ${primary}; color: #fff; border: none; border-radius: 9px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.2s, transform 0.15s;
      }
      .send-btn:hover:not(:disabled) { background: ${secondary}; transform: scale(1.05); }
      .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .powered-by { text-align: center; font-size: 10.5px; margin-top: 8px; opacity: 0.4; }
    `;
  }

  // ── DOM element references (set when window is built) ────────────────────
  let elBody = null;
  let elInput = null;
  let elSend = null;
  let elWindow = null;

  // ── Build the full chat window (only called once on open) ────────────────
  function buildWindow(appDiv) {
    const botName = c('name', 'Assistant');

    appDiv.innerHTML = `
      <div class="chat-window" id="sb-win" style="display: none;">
        <div class="chat-header">
          <div class="header-left">
            <div class="bot-avatar-wrap">${icons.bot}</div>
            <div>
              <div class="header-name" id="sb-header-name">${botName}</div>
              <div class="header-status"><span class="pulse-dot"></span> Online</div>
            </div>
          </div>
          <div class="header-actions">
            <button id="sb-clear" title="Clear chat">${icons.trash}</button>
            <button id="sb-min"></button>
            <button id="sb-close">${icons.x}</button>
          </div>
        </div>
        <div class="chat-body" id="sb-body"></div>
        <div class="chat-footer" id="sb-footer">
          <div class="faq-wrap" id="sb-faq-wrap" style="display:none;">
            <button class="faq-nav left hidden" id="sb-faq-left" type="button">${icons.arrL}</button>
            <div id="sb-faqs" class="faq-strip"></div>
            <button class="faq-nav right hidden" id="sb-faq-right" type="button">${icons.arrR}</button>
          </div>
          <form id="sb-form" class="input-row">
            <input id="sb-input" class="chat-input" type="text"
              placeholder="Type a message…" autocomplete="off" />
            <button type="submit" class="send-btn" id="sb-send" disabled>${icons.send}</button>
          </form>
          <div class="powered-by">Powered by zoabit</div>
        </div>
      </div>`;

    // Remove enter animation class after it plays so re-renders don't replay it
    elWindow = shadow.getElementById('sb-win');
    elWindow.addEventListener('animationend', () => elWindow.classList.remove('window-enter'), { once: true });

    elBody = shadow.getElementById('sb-body');
    elInput = shadow.getElementById('sb-input');
    elSend = shadow.getElementById('sb-send');

    // Update minimize button icon
    updateMinBtn();

    // ── Events — attached once, never re-attached ─────────────────────────

    // 1. Stop ALL clicks/pointer inside the window from reaching the host page
    elWindow.addEventListener('click', (e) => e.stopPropagation());
    elWindow.addEventListener('pointerdown', (e) => e.stopPropagation());
    elWindow.addEventListener('mousedown', (e) => e.stopPropagation());
    elWindow.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

    // 2. Scroll containment — prevent host page from scrolling when
    //    the chat body hits its top or bottom boundary
    elBody.addEventListener('wheel', (e) => {
      const { scrollTop, scrollHeight, clientHeight } = elBody;
      const atTop = scrollTop === 0 && e.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight && e.deltaY > 0;
      if (atTop || atBottom) e.preventDefault();
      e.stopPropagation();
    }, { passive: false });

    elBody.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });

    // 3. Global keyboard handler scoped to this shadow root
    //    Escape → close, and stop all key events from leaking to host
    shadow.addEventListener('keydown', (e) => {
      e.stopPropagation(); // never let key events reach the host document
      if (e.key === 'Escape') {
        if (isOpen && !isMinimized) {
          isOpen = false; elWindow = null; elBody = null; elInput = null; elSend = null;
          appDiv.innerHTML = `<button class="widget-btn" id="sb-open">${icons.msg}</button>`;
          shadow.getElementById('sb-open').onclick = openChat.bind(null, appDiv);
        }
      }
    });

    shadow.getElementById('sb-close').onclick = (e) => {
      e.stopPropagation();
      toggleChat();
    };

    shadow.getElementById('sb-min').onclick = (e) => {
      e.stopPropagation();
      isMinimized = !isMinimized;
      elWindow.classList.toggle('minimized', isMinimized);
      shadow.getElementById('sb-footer').style.display = isMinimized ? 'none' : '';
      elBody.style.display = isMinimized ? 'none' : '';
      updateMinBtn();
    };

    shadow.getElementById('sb-clear').onclick = (e) => {
      e.stopPropagation();
      if (confirm("Clear chat history?")) {
        history = []; saveHistory(); refreshMessages();
      }
    };

    shadow.getElementById('sb-form').addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation(); // stop form submit from bubbling to host page forms
      const text = elInput.value.trim();
      if (!text || isLoading) return;
      elInput.value = '';
      elSend.disabled = true;
      sendMessage(text);
    });

    elInput.addEventListener('input', (e) => {
      e.stopPropagation();
      elSend.disabled = !elInput.value.trim() || isLoading;
    });

    elInput.addEventListener('keydown', (e) => {
      e.stopPropagation(); // prevent host shortcuts (e.g. search bars, hotkeys)
    });
  }

  function updateMinBtn() {
    const btn = shadow.getElementById('sb-min');
    if (btn) btn.innerHTML = isMinimized ? icons.max : icons.min;
  }

  function toggleChat() {
    isOpen = !isOpen;
    if (!elWindow) buildWindow(shadow.getElementById('sb-app-root'));

    if (isOpen) {
      elWindow.style.display = 'flex';
      elWindow.classList.add('window-enter');
      elWindow.addEventListener('animationend', () => elWindow.classList.remove('window-enter'), { once: true });
      refreshMessages();
      elInput.focus();
    } else {
      elWindow.style.display = 'none';
    }

    // Update main toggle button icon and mobile visibility
    const openBtn = shadow.getElementById('sb-open');
    if (openBtn) {
      openBtn.innerHTML = isOpen ? icons.x : icons.msg;
      if (isOpen) openBtn.classList.add('hide-on-mobile');
      else openBtn.classList.remove('hide-on-mobile');
    }
  }

  function openChat(appDiv) {
    if (!isOpen) toggleChat();
  }

  // ── refreshMessages — updates ONLY the body, no window rebuild ────────────
  function refreshMessages() {
    if (!elBody) return;
    elBody.innerHTML = buildMessagesHTML();
    elBody.scrollTop = elBody.scrollHeight;
  }

  // ── Send Message ──────────────────────────────────────────────────────────
  async function sendMessage(text) {
    if (!text || isLoading) return;
    history.push({ role: 'user', content: text });

    // Check if there's a predefined FAQ answer
    const faqs = c('faq', []);
    if (Array.isArray(faqs)) {
      const matchedFaq = faqs.find(f => f.question && f.question.trim().toLowerCase() === text.trim().toLowerCase());
      if (matchedFaq && matchedFaq.answer && matchedFaq.answer.trim()) {
        history.push({ role: 'assistant', content: matchedFaq.answer });
        saveHistory();
        refreshMessages();
        if (elSend && elInput) elSend.disabled = !elInput.value.trim();
        if (elInput) elInput.focus();
        return; // Return immediately, don't hit API
      }
    }

    isLoading = true;
    if (elSend) elSend.disabled = true;
    refreshMessages();

    try {
      const res = await fetch(`${backendOrigin}/api/chatbot/ask/${chatbotId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, history: history.slice(0, -1) })
      });
      const json = await res.json();
      history.push({
        role: 'assistant', content: json.success && json.data
          ? json.data
          : (json.message || "Sorry, I couldn't respond. Please try again.")
      });
    } catch {
      history.push({ role: 'assistant', content: "Connection error. Please try again later." });
    } finally {
      isLoading = false;
      saveHistory();
      refreshMessages();
      if (elSend && elInput) elSend.disabled = !elInput.value.trim();
      if (elInput) elInput.focus();
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    const container = document.createElement("div");
    container.id = `zoabit-${chatbotId}`;
    document.body.appendChild(container);

    shadow = container.attachShadow({ mode: "open" });

    const styleEl = document.createElement("style");
    shadow.appendChild(styleEl);

    // Add container for the window
    const appRoot = document.createElement("div");
    appRoot.id = "sb-app-root";
    shadow.appendChild(appRoot);

    // Toggle button — hidden until config confirms the bot exists & is valid
    const btn = document.createElement("button");
    btn.className = "widget-btn";
    btn.id = "sb-open";
    btn.innerHTML = icons.msg;
    btn.style.display = 'none'; // stay hidden until validated
    shadow.appendChild(btn);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleChat();
    });

    // Fetch config (apply styles after, re-render if window already open)
    fetch(`${backendOrigin}/api/chatbot/config/${chatbotId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(json => { if (json.success) config = json.data; })
      .catch(() => { config = null; })
      .finally(() => {
        // Config failed (wrong ID, server error, network issue) — silently remove
        if (!config) {
          container.remove();
          return;
        }

        // Check if chatbot is active
        if (config.isActive === false) {
          container.remove();
          return;
        }

        // Early domain verification
        const v = config.verifiedDomains || [];
        const host = window.location.hostname;
        if (v.length > 0 && !v.includes(host) && host !== 'localhost' && host !== '127.0.0.1') {
          console.warn('zoabit: Domain not authorized for this widget.');
          container.remove();
          return;
        }

        styleEl.textContent = buildCSS();
        // Pre-build the window hidden so it's ready
        buildWindow(shadow.getElementById('sb-app-root'));

        // Inject FAQs into the footer strip
        const faqs = config.faq || [];
        const validFaqs = faqs.filter(f => f.question && f.question.trim());
        const faqWrap = shadow.getElementById('sb-faq-wrap');
        const faqContainer = shadow.getElementById('sb-faqs');
        const btnL = shadow.getElementById('sb-faq-left');
        const btnR = shadow.getElementById('sb-faq-right');

        if (faqWrap && faqContainer && validFaqs.length > 0) {
          faqWrap.style.display = 'flex';
          faqContainer.innerHTML = validFaqs.map(q =>
            `<button type="button" class="faq-chip" data-q="${q.question.replace(/"/g, '&quot;')}">${q.question}</button>`
          ).join('');

          faqContainer.querySelectorAll('.faq-chip').forEach(btn => {
            btn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              elInput.value = ''; // clears any current input
              sendMessage(btn.dataset.q);
            };
          });

          const checkScroll = () => {
            btnL.classList.toggle('hidden', faqContainer.scrollLeft <= 5);
            btnR.classList.toggle('hidden', faqContainer.scrollLeft >= faqContainer.scrollWidth - faqContainer.clientWidth - 5);
          };

          faqContainer.addEventListener('scroll', checkScroll);

          // Trigger checkScroll when container becomes visible/resizes
          if (window.ResizeObserver) {
            new ResizeObserver(() => checkScroll()).observe(faqContainer);
          } else {
            setTimeout(checkScroll, 100);
          }

          btnL.onclick = (e) => { e.preventDefault(); faqContainer.scrollBy({ left: -150, behavior: 'smooth' }); };
          btnR.onclick = (e) => { e.preventDefault(); faqContainer.scrollBy({ left: 150, behavior: 'smooth' }); };

        }

        // All checks passed — reveal the widget button
        btn.style.display = '';

        if (isOpen) toggleChat();
      });
  }

  if (document.body) { init(); }
  else { document.addEventListener("DOMContentLoaded", init); }

})();