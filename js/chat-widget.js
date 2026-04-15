(function () {
  if (window.__chatWidgetLoaded) return;
  window.__chatWidgetLoaded = true;

  var KEYS = {
    messages: 'chat_messages_v1',
    templates: 'chat_templates_v1',
    userId: 'chat_user_id_v1'
  };
  var REMOTE_CATEGORY = 'Course Widget';
  var POLL_MS = 12000;
  var defaultTemplates = [
    {
      id: 't1',
      title: 'Course Advice',
      keywords: ['course', 'recommend', 'suitable', 'beginner'],
      reply: 'If this is your first time, start with a beginner course and check the time and available seats. Tell me your interest area if you want a tailored suggestion.',
      active: true
    },
    {
      id: 't2',
      title: 'Booking Process',
      keywords: ['book', 'booking', 'sign up', 'how to book'],
      reply: 'Open the course details page and click Book Now. After logging in, the booking will appear in the course bookings list in the user dashboard.',
      active: true
    },
    {
      id: 't3',
      title: 'Time and Location',
      keywords: ['time', 'location', 'schedule', 'class'],
      reply: 'Each course includes its own schedule and location details. Open the course card to view the full arrangement.',
      active: true
    }
  ];
  var quickQuestions = [
    'Which course should I choose?',
    'How is the class schedule arranged?',
    'Where can I find my booking after I reserve?'
  ];
  var GREETING_MESSAGE = 'Hello, I am the course support assistant. Tell me which course or question you would like help with.';
  var FALLBACK_REPLY = 'We received your question and will reply as soon as possible. You can also check the course details and support pages first.';
  var LEGACY_TEXT_MAP = {
    '\u4f60\u597d\uff0c\u6211\u662f\u8bfe\u7a0b\u54a8\u8be2\u52a9\u624b\u3002\u8bf7\u544a\u8bc9\u6211\u4f60\u60f3\u4e86\u89e3\u7684\u8bfe\u7a0b\u6216\u95ee\u9898\u3002': GREETING_MESSAGE,
    '\u5df2\u6536\u5230\u4f60\u7684\u95ee\u9898\uff0c\u6211\u4eec\u4f1a\u5c3d\u5feb\u56de\u590d\uff0c\u4e5f\u53ef\u4ee5\u5148\u67e5\u770b\u8bfe\u7a0b\u8be6\u60c5\u4e0e\u54a8\u8be2\u9875\u9762\u3002': FALLBACK_REPLY,
    '\u5982\u679c\u662f\u7b2c\u4e00\u6b21\u4f53\u9a8c\uff0c\u5efa\u8bae\u4ece\u5165\u95e8\u8bfe\u7a0b\u5f00\u59cb\uff0c\u5173\u6ce8\u8bfe\u7a0b\u65f6\u95f4\u4e0e\u540d\u989d\u3002\u4e5f\u53ef\u4ee5\u544a\u8bc9\u6211\u4f60\u7684\u5174\u8da3\u65b9\u5411\uff0c\u6211\u5e2e\u4f60\u63a8\u8350\u3002': defaultTemplates[0].reply,
    '\u70b9\u51fb\u8bfe\u7a0b\u8be6\u60c5\u91cc\u7684\u201c\u7acb\u5373\u9884\u7ea6\u201d\uff0c\u767b\u5f55\u540e\u4f1a\u4fdd\u5b58\u5230\u4e2a\u4eba\u4e2d\u5fc3\u7684\u6559\u5b66\u9884\u7ea6\u5217\u8868\u3002': defaultTemplates[1].reply,
    '\u6bcf\u95e8\u8bfe\u7a0b\u90fd\u6709\u65f6\u95f4\u8868\u4e0e\u5730\u70b9\u4fe1\u606f\uff0c\u70b9\u51fb\u8bfe\u7a0b\u5361\u7247\u5373\u53ef\u67e5\u770b\u5b8c\u6574\u5b89\u6392\u3002': defaultTemplates[2].reply
  };
  var defaultTemplateMap = defaultTemplates.reduce(function (acc, tpl) {
    acc[tpl.id] = tpl;
    return acc;
  }, {});

  var state = {
    userId: '',
    session: null,
    messages: [],
    templates: [],
    sending: false,
    open: false,
    pollTimer: null
  };
  var ui = null;

  function trimText(value) {
    return String(value || '').trim();
  }

  function normalizeEmail(value) {
    return trimText(value).toLowerCase();
  }

  function getSupportService() {
    return window.clubSupportSupabase || null;
  }

  function readSession() {
    var tryLoad = function (store) {
      try {
        var raw = store.getItem('user_session_v1');
        var parsed = raw ? JSON.parse(raw) : null;
        if (!parsed) return null;
        return {
          userId: trimText(parsed.userId),
          email: normalizeEmail(parsed.email),
          nickname: trimText(parsed.nickname),
          role: trimText(parsed.role)
        };
      } catch (error) {
        return null;
      }
    };
    return tryLoad(localStorage) || tryLoad(sessionStorage) || null;
  }

  function isBusinessCacheDisabled() {
    var service = window.clubLocalDataMigration || null;
    var session = readSession();
    var email = normalizeEmail(session && session.email);
    return !!(service && typeof service.isBusinessCacheDisabled === 'function' && service.isBusinessCacheDisabled(email));
  }

  function ensureGuestUserId() {
    var userId = trimText(localStorage.getItem(KEYS.userId));
    if (!userId) {
      userId = 'guest-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      localStorage.setItem(KEYS.userId, userId);
    }
    return userId;
  }

  function refreshIdentity() {
    var session = readSession();
    state.session = session;
    state.userId = normalizeEmail(session && session.email)
      ? ('user:' + normalizeEmail(session.email))
      : ensureGuestUserId();
  }

  function hasSupabaseChat() {
    var service = getSupportService();
    return !!(
      service &&
      typeof service.isConfigured === 'function' &&
      service.isConfigured() &&
      state.session &&
      trimText(state.session.userId) &&
      normalizeEmail(state.session.email)
    );
  }

  function safeParse(key, fallback) {
    if (key === KEYS.messages && isBusinessCacheDisabled()) return fallback;
    try {
      var raw = localStorage.getItem(key);
      if (raw === null || raw === undefined || raw === '') return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function save(key, value) {
    if (key === KEYS.messages && isBusinessCacheDisabled()) return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (match) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[match];
    });
  }

  function hasCjk(value) {
    return /[\u4E00-\u9FFF]/.test(String(value || ''));
  }

  function loadTemplates() {
    var templates = safeParse(KEYS.templates, []);
    if (!Array.isArray(templates) || !templates.length) {
      templates = defaultTemplates.slice();
      save(KEYS.templates, templates);
      return templates;
    }
    var changed = false;
    templates = templates.map(function (tpl, index) {
      var fallback = defaultTemplateMap[tpl && tpl.id] || defaultTemplates[index] || null;
      if (!tpl || !fallback) return tpl;
      var keywords = Array.isArray(tpl.keywords) ? tpl.keywords : String(tpl.keywords || '').split(/[,\uFF0C]/);
      var needsMigration = hasCjk(tpl.title) || hasCjk(tpl.reply) || keywords.some(hasCjk);
      if (!needsMigration) return tpl;
      changed = true;
      return Object.assign({}, fallback, { active: tpl.active !== false });
    });
    if (changed) save(KEYS.templates, templates);
    return templates;
  }

  function loadLocalMessages() {
    var all = safeParse(KEYS.messages, []);
    if (!Array.isArray(all)) return [];
    var changed = false;
    var migrated = all.map(function (msg) {
      if (!msg || typeof msg !== 'object') return msg;
      var text = trimText(msg.text);
      var nextText = LEGACY_TEXT_MAP[text];
      if (!nextText) return msg;
      changed = true;
      return Object.assign({}, msg, { text: nextText });
    });
    if (changed) save(KEYS.messages, migrated);
    return migrated;
  }

  function getVisibleLocalMessages() {
    return state.messages.filter(function (message) {
      return trimText(message.userId) === state.userId;
    });
  }

  function getVisibleMessages() {
    return hasSupabaseChat() ? state.messages.slice() : getVisibleLocalMessages();
  }

  function createLocalMessage(role, text) {
    return {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
      role: role,
      text: trimText(text),
      userId: state.userId,
      userEmail: normalizeEmail(state.session && state.session.email),
      createdAt: new Date().toLocaleString()
    };
  }

  function addLocalMessage(role, text) {
    var message = createLocalMessage(role, text);
    state.messages.push(message);
    save(KEYS.messages, state.messages);
    renderMessages();
    return message;
  }

  function matchTemplate(text) {
    var target = trimText(text).toLowerCase();
    for (var i = 0; i < state.templates.length; i += 1) {
      var tpl = state.templates[i];
      if (!tpl || tpl.active === false) continue;
      var keys = Array.isArray(tpl.keywords) ? tpl.keywords : String(tpl.keywords || '').split(/[,\uFF0C]/);
      for (var j = 0; j < keys.length; j += 1) {
        var key = trimText(keys[j]).toLowerCase();
        if (key && target.indexOf(key) > -1) return tpl.reply || '';
      }
    }
    return FALLBACK_REPLY;
  }

  function filterRemoteMessages(messages) {
    return (Array.isArray(messages) ? messages : []).filter(function (message) {
      return trimText(message && message.threadCategory) === REMOTE_CATEGORY;
    });
  }

  async function syncRemoteMessages() {
    if (!hasSupabaseChat()) return false;
    var service = getSupportService();
    try {
      var messages = await service.fetchMySupportMessages(state.session.userId, state.session.email);
      state.messages = filterRemoteMessages(messages);
      renderMessages();
      return true;
    } catch (error) {
      return false;
    }
  }

  function ensureLocalGreeting() {
    if (hasSupabaseChat()) return;
    var hasAny = getVisibleLocalMessages().length > 0;
    if (!hasAny) {
      addLocalMessage('bot', GREETING_MESSAGE);
    }
  }

  function buildMessageHtml(message) {
    var role = trimText(message && (message.role || message.senderRole)).toLowerCase();
    var text = trimText(message && message.text);
    var createdAt = trimText(message && message.createdAt);
    var bubbleClass = role === 'user' ? 'user' : (role === 'admin' ? 'admin' : 'bot');
    return (
      '<div class="chat-bubble ' + bubbleClass + '">' +
        '<div>' + escapeHtml(text) + '</div>' +
        '<div class="chat-bubble-meta">' + escapeHtml(createdAt) + '</div>' +
      '</div>'
    );
  }

  function renderMessages() {
    if (!ui || !ui.body) return;
    var list = getVisibleMessages();
    var html = '';
    if (!list.length) {
      html = buildMessageHtml({
        role: 'bot',
        text: GREETING_MESSAGE,
        createdAt: new Date().toLocaleString()
      });
    } else {
      html = list.map(buildMessageHtml).join('');
    }
    ui.body.innerHTML = '<div class="chat-date">' + escapeHtml(new Date().toLocaleDateString()) + '</div>' + html;
    ui.body.scrollTop = ui.body.scrollHeight;
  }

  function renderQuick() {
    if (!ui || !ui.quick) return;
    var buttons = quickQuestions.map(function (question) {
      return '<button type="button" data-q="' + escapeHtml(question) + '">' + escapeHtml(question) + '</button>';
    }).join('');
    ui.quick.innerHTML = buttons;
    Array.prototype.forEach.call(ui.quick.querySelectorAll('button'), function (button) {
      button.addEventListener('click', function () {
        sendMessage(button.getAttribute('data-q'));
      });
    });
  }

  function setSendingState(sending) {
    state.sending = !!sending;
    if (!ui) return;
    ui.sendBtn.disabled = state.sending;
    ui.input.disabled = state.sending;
    ui.sendBtn.textContent = state.sending ? 'Sending...' : 'Send';
  }

  async function sendRemoteMessage(text) {
    if (!hasSupabaseChat()) return;
    var service = getSupportService();
    setSendingState(true);
    try {
      await service.sendSupportMessage(
        {
          text: trimText(text),
          attachments: [],
          category: REMOTE_CATEGORY
        },
        state.session.userId,
        state.session.email,
        state.session.nickname || state.session.email
      );
      await syncRemoteMessages();
    } catch (error) {
      alert(service.mapSupportError(error));
    } finally {
      setSendingState(false);
    }
  }

  function sendLocalMessage(text) {
    var cleanText = trimText(text);
    if (!cleanText) return;
    addLocalMessage('user', cleanText);
    var reply = matchTemplate(cleanText);
    setTimeout(function () {
      addLocalMessage('bot', reply);
    }, 600);
  }

  function sendMessage(text) {
    var cleanText = trimText(text);
    if (!cleanText || state.sending) return;
    if (hasSupabaseChat()) {
      sendRemoteMessage(cleanText);
      return;
    }
    sendLocalMessage(cleanText);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function startPolling() {
    stopPolling();
    if (!hasSupabaseChat()) return;
    state.pollTimer = window.setInterval(function () {
      if (state.open) syncRemoteMessages();
    }, POLL_MS);
  }

  async function syncMessages() {
    refreshIdentity();
    if (hasSupabaseChat()) {
      var synced = await syncRemoteMessages();
      if (synced) {
        startPolling();
        return;
      }
    }
    stopPolling();
    state.messages = loadLocalMessages();
    ensureLocalGreeting();
    renderMessages();
  }

  function setupUI() {
    var wrap = document.createElement('div');
    wrap.className = 'chat-widget';
    wrap.innerHTML = '' +
      '<button class="chat-toggle" type="button"><span>💬</span>Chat with Us</button>' +
      '<div class="chat-panel">' +
        '<div class="chat-header">' +
          '<div><div class="chat-header-title">Club Enrollment Portal</div><div class="chat-header-sub">Usually replies within a few minutes</div></div>' +
          '<button class="chat-close" type="button">×</button>' +
        '</div>' +
        '<div class="chat-body"></div>' +
        '<div class="chat-quick"></div>' +
        '<div class="chat-input">' +
          '<div class="chat-input-box">' +
            '<input type="text" placeholder="Type your question...">' +
            '<button type="button">Send</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    ui = {
      wrap: wrap,
      toggle: wrap.querySelector('.chat-toggle'),
      panel: wrap.querySelector('.chat-panel'),
      close: wrap.querySelector('.chat-close'),
      body: wrap.querySelector('.chat-body'),
      quick: wrap.querySelector('.chat-quick'),
      input: wrap.querySelector('.chat-input-box input'),
      sendBtn: wrap.querySelector('.chat-input-box button')
    };

    ui.toggle.addEventListener('click', function () {
      state.open = !ui.panel.classList.contains('open');
      ui.panel.classList.toggle('open');
      if (state.open) {
        syncMessages();
      } else {
        stopPolling();
      }
    });

    ui.close.addEventListener('click', function () {
      state.open = false;
      ui.panel.classList.remove('open');
      stopPolling();
    });

    ui.sendBtn.addEventListener('click', function () {
      var text = ui.input.value;
      sendMessage(text);
      ui.input.value = '';
      ui.input.focus();
    });

    ui.input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        ui.sendBtn.click();
      }
    });
  }

  function bindEvents() {
    window.addEventListener('storage', function (event) {
      if (!event) return;
      if (event.key === KEYS.messages || event.key === 'user_session_v1') {
        syncMessages();
      }
    });
    window.addEventListener('focus', function () {
      if (state.open) syncMessages();
    });
  }

  function init() {
    refreshIdentity();
    state.templates = loadTemplates();
    state.messages = loadLocalMessages();
    setupUI();
    renderQuick();
    syncMessages();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
