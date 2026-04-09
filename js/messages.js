(function () {
  'use strict';

  var KEYS = {
    session: 'user_session_v1',
    users: 'club_users',
    board: 'user_message_board_v1'
  };

  var state = {
    currentUser: null,
    rows: [],
    conversations: [],
    selectedKey: '',
    search: '',
    backUrl: 'join.html?tab=message_board',
    backLabel: 'Back',
    queryTarget: null,
    pollTimer: 0,
    reloadTimer: 0,
    realtimeChannels: []
  };

  function trimText(value) {
    return String(value || '').trim();
  }

  function normalizeEmail(value) {
    return trimText(value).toLowerCase();
  }

  function normalizeId(value) {
    return trimText(value);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initials(value) {
    var text = trimText(value).replace(/\s+/g, '');
    if (!text) return 'US';
    return Array.from(text).slice(0, 2).join('').toUpperCase();
  }

  function timeValue(value) {
    var text = trimText(value);
    if (!text) return 0;
    var parsed = Date.parse(text);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function formatThreadTime(value) {
    var text = trimText(value);
    if (!text) return '';
    var date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return date.toLocaleString();
  }

  function formatConversationTime(value) {
    var text = trimText(value);
    if (!text) return '';
    var date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    var now = new Date();
    var sameDay = now.toDateString() === date.toDateString();
    return sameDay
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function autoGrowTextarea(area) {
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = Math.min(area.scrollHeight, 180) + 'px';
  }

  function readJsonArray(key) {
    try {
      var raw = window.localStorage.getItem(key);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeJsonArray(key, value) {
    window.localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
  }

  function readSession() {
    var stores = [window.localStorage, window.sessionStorage];
    for (var i = 0; i < stores.length; i += 1) {
      try {
        var raw = stores[i].getItem(KEYS.session);
        if (!raw) continue;
        var parsed = JSON.parse(raw);
        if (parsed && trimText(parsed.email)) return parsed;
      } catch (error) {}
    }
    return null;
  }

  function readUsers() {
    return readJsonArray(KEYS.users);
  }

  function resolveCurrentUser() {
    var session = readSession();
    if (!session) return null;

    var email = normalizeEmail(session.email);
    var users = readUsers();
    var match = users.find(function (item) {
      return normalizeEmail(item && item.email) === email;
    }) || {};

    return {
      userId: normalizeId(session.userId || match.userId || match.id),
      email: email,
      nickname: trimText(match.nickname || session.nickname || (email ? email.split('@')[0] : 'User')) || 'User',
      avatar: trimText(match.avatar || ''),
      initials: initials(match.nickname || session.nickname || (email ? email.split('@')[0] : 'User'))
    };
  }

  function getSupportService() {
    return window.clubSupportSupabase || null;
  }

  function getSupabaseClientSafe() {
    try {
      return typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    } catch (error) {
      return null;
    }
  }

  function hasSupabaseSupportConfigured() {
    var service = getSupportService();
    return !!(service && typeof service.isConfigured === 'function' && service.isConfigured());
  }

  function normalizeRow(item) {
    var row = item || {};
    return {
      id: normalizeId(row.id) || ('msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
      targetUserId: normalizeId(row.targetUserId || row.target_user_id),
      targetEmail: normalizeEmail(row.targetEmail || row.target_email),
      targetName: trimText(row.targetName || row.target_name),
      fromUserId: normalizeId(row.fromUserId || row.from_user_id),
      fromEmail: normalizeEmail(row.fromEmail || row.from_email),
      fromName: trimText(row.fromName || row.from_name),
      text: trimText(row.text || row.message_text),
      source: trimText(row.source) || 'forum-profile',
      createdAt: formatThreadTime(row.createdAt || row.created_at),
      createdTs: Number(row.createdTs || 0) || timeValue(row.createdAt || row.created_at)
    };
  }

  function isOutgoing(row) {
    var me = state.currentUser || {};
    var rowFromId = normalizeId(row && row.fromUserId);
    var rowFromEmail = normalizeEmail(row && row.fromEmail);
    if (me.userId && rowFromId && me.userId === rowFromId) return true;
    return !!(me.email && rowFromEmail && me.email === rowFromEmail);
  }

  function buildCounterparty(row) {
    if (isOutgoing(row)) {
      return {
        userId: normalizeId(row.targetUserId),
        email: normalizeEmail(row.targetEmail),
        name: trimText(row.targetName) || trimText(row.targetEmail) || 'Recipient'
      };
    }
    return {
      userId: normalizeId(row.fromUserId),
      email: normalizeEmail(row.fromEmail),
      name: trimText(row.fromName) || trimText(row.fromEmail) || 'Sender'
    };
  }

  function conversationKey(target) {
    var item = target || {};
    if (normalizeId(item.userId)) return 'user:' + normalizeId(item.userId);
    if (normalizeEmail(item.email)) return 'email:' + normalizeEmail(item.email);
    return 'name:' + trimText(item.name).toLowerCase();
  }

  function sanitizeBackUrl(raw) {
    var text = trimText(raw);
    if (!text) return 'join.html?tab=message_board';
    try {
      var url = new URL(text, window.location.href);
      if (url.origin !== window.location.origin) return 'join.html?tab=message_board';
      return url.pathname + url.search + url.hash;
    } catch (error) {
      return 'join.html?tab=message_board';
    }
  }

  function readQueryTarget() {
    var params = new URLSearchParams(window.location.search);
    var target = {
      userId: normalizeId(params.get('target_user_id')),
      email: normalizeEmail(params.get('target_email')),
      name: trimText(params.get('target_name'))
    };
    return {
      target: (target.userId || target.email || target.name) ? target : null,
      backUrl: sanitizeBackUrl(params.get('back')),
      backLabel: trimText(params.get('back_label')) || 'Back'
    };
  }

  async function fetchProfileMap(userIds) {
    var ids = (Array.isArray(userIds) ? userIds : []).map(normalizeId).filter(Boolean);
    if (!ids.length) return {};
    var client = getSupabaseClientSafe();
    if (!client) return {};

    try {
      var result = await client
        .from('profiles')
        .select('id, nickname, avatar_url')
        .in('id', ids);
      if (result.error) return {};
      return (Array.isArray(result.data) ? result.data : []).reduce(function (acc, row) {
        acc[normalizeId(row.id)] = {
          nickname: trimText(row.nickname),
          avatar: trimText(row.avatar_url)
        };
        return acc;
      }, {});
    } catch (error) {
      return {};
    }
  }

  async function loadRows() {
    var me = state.currentUser || {};
    var service = getSupportService();
    if (hasSupabaseSupportConfigured() && me.userId && service && typeof service.fetchMyMessageBoard === 'function') {
      var rows = await service.fetchMyMessageBoard(me.userId);
      return (Array.isArray(rows) ? rows : []).map(normalizeRow);
    }

    var localRows = readJsonArray(KEYS.board).map(normalizeRow);
    return localRows.filter(function (row) {
      var targetMatches = (me.userId && row.targetUserId && me.userId === row.targetUserId)
        || (me.email && row.targetEmail && me.email === row.targetEmail);
      var senderMatches = (me.userId && row.fromUserId && me.userId === row.fromUserId)
        || (me.email && row.fromEmail && me.email === row.fromEmail);
      return targetMatches || senderMatches;
    });
  }

  function buildConversations(rows, profileMap) {
    var grouped = {};

    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      var target = buildCounterparty(row);
      var key = conversationKey(target);
      if (!grouped[key]) {
        grouped[key] = {
          key: key,
          targetUserId: normalizeId(target.userId),
          targetEmail: normalizeEmail(target.email),
          targetName: trimText(target.name) || 'User',
          avatar: '',
          initials: initials(target.name || target.email || 'User'),
          messages: []
        };
      }

      var profile = grouped[key].targetUserId ? profileMap[grouped[key].targetUserId] : null;
      if (profile) {
        grouped[key].avatar = trimText(profile.avatar);
        if (!trimText(grouped[key].targetName) && trimText(profile.nickname)) {
          grouped[key].targetName = trimText(profile.nickname);
        }
        grouped[key].initials = initials(grouped[key].targetName || profile.nickname || grouped[key].targetEmail);
      }

      grouped[key].messages.push({
        id: row.id,
        text: row.text,
        source: row.source,
        createdAt: row.createdAt,
        createdTs: row.createdTs,
        outgoing: isOutgoing(row),
        author: isOutgoing(row) ? (state.currentUser.nickname || 'You') : grouped[key].targetName
      });
    });

    var queryTarget = state.queryTarget;
    if (queryTarget) {
      var queryKey = conversationKey(queryTarget);
      if (!grouped[queryKey]) {
        grouped[queryKey] = {
          key: queryKey,
          targetUserId: normalizeId(queryTarget.userId),
          targetEmail: normalizeEmail(queryTarget.email),
          targetName: trimText(queryTarget.name) || trimText(queryTarget.email) || 'Recipient',
          avatar: '',
          initials: initials(queryTarget.name || queryTarget.email || 'Recipient'),
          messages: []
        };
      }
    }

    return Object.keys(grouped).map(function (key) {
      var item = grouped[key];
      item.messages.sort(function (a, b) {
        return (a.createdTs || 0) - (b.createdTs || 0);
      });
      var last = item.messages[item.messages.length - 1] || null;
      item.lastMessage = last ? last.text : 'No messages yet. Start the conversation from the right panel.';
      item.lastTime = last ? last.createdAt : '';
      item.lastTs = last ? last.createdTs : 0;
      item.preview = trimText(item.lastMessage);
      return item;
    }).sort(function (a, b) {
      return (b.lastTs || 0) - (a.lastTs || 0);
    });
  }

  function selectedConversation() {
    return state.conversations.find(function (item) {
      return item.key === state.selectedKey;
    }) || null;
  }

  function renderAvatar(avatar, initialsText, large) {
    if (trimText(avatar)) {
      return '<span class="messages-avatar' + (large ? ' is-large' : '') + '">' +
        '<img src="' + escapeHtml(avatar) + '" alt="Avatar" />' +
      '</span>';
    }
    return '<span class="messages-avatar' + (large ? ' is-large' : '') + '">' + escapeHtml(initialsText) + '</span>';
  }

  function renderSelfCard() {
    var user = state.currentUser || {};
    var target = document.getElementById('messagesSelfCard');
    if (!target) return;
    target.innerHTML =
      renderAvatar(user.avatar, user.initials, true) +
      '<div class="messages-self-copy">' +
        '<div class="messages-self-name">' + escapeHtml(user.nickname || 'User') + '</div>' +
        '<div class="messages-self-email">' + escapeHtml(user.email || '') + '</div>' +
      '</div>';
  }

  function renderConversationList() {
    var container = document.getElementById('conversationList');
    if (!container) return;

    var query = trimText(state.search).toLowerCase();
    var list = state.conversations.filter(function (item) {
      if (!query) return true;
      return String(item.targetName || '').toLowerCase().indexOf(query) > -1
        || String(item.targetEmail || '').toLowerCase().indexOf(query) > -1
        || String(item.preview || '').toLowerCase().indexOf(query) > -1;
    });

    if (!list.length) {
      container.innerHTML = '<div class="messages-conversation-empty">No matching conversations yet. Use <strong>Send Message</strong> from a forum profile to start one.</div>';
      return;
    }

    container.innerHTML = list.map(function (item) {
      return (
        '<button class="messages-conversation-item' + (item.key === state.selectedKey ? ' is-active' : '') + '" type="button" data-conversation-key="' + escapeHtml(item.key) + '">' +
          renderAvatar(item.avatar, item.initials, false) +
          '<span class="messages-conversation-copy">' +
            '<span class="messages-conversation-topline">' +
              '<span class="messages-conversation-name">' + escapeHtml(item.targetName) + '</span>' +
              '<span class="messages-conversation-time">' + escapeHtml(formatConversationTime(item.lastTime)) + '</span>' +
            '</span>' +
            '<span class="messages-conversation-preview">' + escapeHtml(item.preview || 'Start chatting') + '</span>' +
          '</span>' +
        '</button>'
      );
    }).join('');
  }

  function renderPanelHead() {
    var head = document.getElementById('messagesPanelHead');
    if (!head) return;
    var conversation = selectedConversation();
    if (!conversation) {
      head.innerHTML = '<div class="messages-panel-user-copy"><div class="messages-panel-user-name">Messages</div><div class="messages-panel-user-email">Select a conversation from the left to start chatting.</div></div>';
      return;
    }

    head.innerHTML =
      '<div class="messages-panel-user">' +
        renderAvatar(conversation.avatar, conversation.initials, true) +
        '<div class="messages-panel-user-copy">' +
          '<div class="messages-panel-user-name">' + escapeHtml(conversation.targetName) + '</div>' +
          '<div class="messages-panel-user-email">' + escapeHtml(conversation.targetEmail || 'Direct conversation') + '</div>' +
          '<div class="messages-panel-sub">Messages sent from forum profiles and dashboard replies will appear here.</div>' +
        '</div>' +
      '</div>';
  }

  function renderThread() {
    var thread = document.getElementById('messagesThread');
    var input = document.getElementById('messagesComposeInput');
    var sendBtn = document.getElementById('messagesSendBtn');
    if (!thread || !input || !sendBtn) return;

    var conversation = selectedConversation();
    if (!conversation) {
      thread.innerHTML =
        '<div class="messages-thread-empty">' +
          '<h2>Select a conversation</h2>' +
          '<p>Open <strong>Send Message</strong> from another user\'s profile, or click a message inside your dashboard to continue chatting here.</p>' +
        '</div>';
      input.disabled = true;
      sendBtn.disabled = true;
      return;
    }

    input.disabled = false;
    sendBtn.disabled = false;

    var notices =
      '<div class="messages-thread-notice">Please keep the conversation respectful. Inappropriate content may be reviewed by platform administrators.</div>' +
      '<div class="messages-thread-notice">You can continue replying here after opening <strong>Send Message</strong> from forum profiles or dashboard message items.</div>';

    if (!conversation.messages.length) {
      thread.innerHTML = notices +
        '<div class="messages-thread-empty">' +
          '<h2>Start the conversation</h2>' +
          '<p>Send your first message to <strong>' + escapeHtml(conversation.targetName) + '</strong> using the message box below.</p>' +
        '</div>';
      return;
    }

    var stream = conversation.messages.map(function (message) {
      return (
        '<div class="messages-row ' + (message.outgoing ? 'outgoing' : 'incoming') + '">' +
          '<div class="messages-bubble">' +
            '<div class="messages-bubble-author">' + escapeHtml(message.outgoing ? 'You' : conversation.targetName) + '</div>' +
            '<div class="messages-bubble-text">' + escapeHtml(message.text || '') + '</div>' +
            '<div class="messages-bubble-time">' + escapeHtml(message.createdAt || '') + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    thread.innerHTML = notices + '<div class="messages-thread-stream">' + stream + '</div>';
    thread.scrollTop = thread.scrollHeight;
  }

  function setComposeStatus(text, type) {
    var el = document.getElementById('messagesComposeStatus');
    if (!el) return;
    el.className = 'messages-compose-status' + (type ? (' is-' + type) : '');
    el.textContent = trimText(text);
  }

  async function reloadConversations(preferredKey) {
    state.rows = await loadRows();
    var ids = state.rows.map(function (row) {
      return isOutgoing(row) ? normalizeId(row.targetUserId) : normalizeId(row.fromUserId);
    }).filter(Boolean);
    var profileMap = await fetchProfileMap(ids);
    state.conversations = buildConversations(state.rows, profileMap);
    if (preferredKey && state.conversations.some(function (item) { return item.key === preferredKey; })) {
      state.selectedKey = preferredKey;
    } else if (!state.selectedKey || !state.conversations.some(function (item) { return item.key === state.selectedKey; })) {
      state.selectedKey = state.conversations.length ? state.conversations[0].key : '';
    }
    renderConversationList();
    renderPanelHead();
    renderThread();
  }

  function scheduleReload(preferredKey) {
    window.clearTimeout(state.reloadTimer);
    state.reloadTimer = window.setTimeout(function () {
      reloadConversations(preferredKey || state.selectedKey);
    }, 160);
  }

  function stopLiveSync() {
    if (state.pollTimer) {
      window.clearInterval(state.pollTimer);
      state.pollTimer = 0;
    }
    if (state.reloadTimer) {
      window.clearTimeout(state.reloadTimer);
      state.reloadTimer = 0;
    }
    state.realtimeChannels.forEach(function (channel) {
      try {
        if (channel && typeof channel.unsubscribe === 'function') {
          channel.unsubscribe();
        }
      } catch (error) {}
    });
    state.realtimeChannels = [];
  }

  function startPollingFallback() {
    if (state.pollTimer) return;
    state.pollTimer = window.setInterval(function () {
      reloadConversations(state.selectedKey);
    }, 4000);
  }

  function startLiveSync() {
    stopLiveSync();

    var client = getSupabaseClientSafe();
    var currentUserId = normalizeId(state.currentUser && state.currentUser.userId);
    if (!client || !currentUserId || !hasSupabaseSupportConfigured()) {
      startPollingFallback();
      return;
    }

    var channel = client.channel('messages-live-' + currentUserId);
    channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_board_entries',
        filter: 'target_user_id=eq.' + currentUserId
      }, function () {
        scheduleReload(state.selectedKey);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_board_entries',
        filter: 'from_user_id=eq.' + currentUserId
      }, function () {
        scheduleReload(state.selectedKey);
      })
      .subscribe(function (status) {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startPollingFallback();
        }
      });

    state.realtimeChannels.push(channel);
    startPollingFallback();
  }

  function buildLocalMessage(payload) {
    return normalizeRow({
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      targetUserId: payload.targetUserId,
      targetEmail: payload.targetEmail,
      targetName: payload.targetName,
      fromUserId: state.currentUser.userId,
      fromEmail: state.currentUser.email,
      fromName: state.currentUser.nickname,
      text: payload.text,
      source: payload.source,
      createdAt: new Date().toISOString(),
      createdTs: Date.now()
    });
  }

  async function sendCurrentMessage(event) {
    event.preventDefault();
    var conversation = selectedConversation();
    var input = document.getElementById('messagesComposeInput');
    if (!conversation || !input) return;

    var text = trimText(input.value);
    if (!text) {
      setComposeStatus('Please enter a message first.', 'error');
      return;
    }

    var payload = {
      targetUserId: conversation.targetUserId,
      targetEmail: conversation.targetEmail,
      targetName: conversation.targetName,
      text: text,
      source: 'messages-page'
    };

    var service = getSupportService();
    try {
      if (hasSupabaseSupportConfigured() && state.currentUser.userId && service) {
        var created = await service.sendMessageBoardEntry(payload);
        state.rows.unshift(normalizeRow(created));
      } else {
        var localRows = readJsonArray(KEYS.board);
        localRows.unshift(buildLocalMessage(payload));
        writeJsonArray(KEYS.board, localRows);
        state.rows = localRows.map(normalizeRow);
      }
      input.value = '';
      autoGrowTextarea(input);
      setComposeStatus('Message sent.', 'success');
      await reloadConversations(conversation.key);
    } catch (error) {
      setComposeStatus(service && typeof service.mapSupportError === 'function' ? service.mapSupportError(error) : 'Unable to send this message right now.', 'error');
    }
  }

  function openSelectedConversation(key) {
    state.selectedKey = trimText(key);
    renderConversationList();
    renderPanelHead();
    renderThread();
    setComposeStatus('', '');
    var input = document.getElementById('messagesComposeInput');
    if (input && !input.disabled) {
      input.focus();
    }
  }

  function bindEvents() {
    var backBtn = document.getElementById('messagesBackBtn');
    var search = document.getElementById('conversationSearchInput');
    var form = document.getElementById('messagesComposeForm');
    var input = document.getElementById('messagesComposeInput');
    var list = document.getElementById('conversationList');

    if (backBtn) {
      backBtn.textContent = '← ' + state.backLabel;
      backBtn.addEventListener('click', function () {
        window.location.href = state.backUrl;
      });
    }

    if (search) {
      search.addEventListener('input', function () {
        state.search = trimText(search.value);
        renderConversationList();
      });
    }

    if (list) {
      list.addEventListener('click', function (event) {
        var button = event.target.closest('[data-conversation-key]');
        if (!button) return;
        openSelectedConversation(button.getAttribute('data-conversation-key'));
      });
    }

    if (input) {
      input.addEventListener('input', function () {
        autoGrowTextarea(input);
      });
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      });
      autoGrowTextarea(input);
    }

    if (form) {
      form.addEventListener('submit', sendCurrentMessage);
    }

    window.addEventListener('storage', function (event) {
      if (!event || event.key !== KEYS.board) return;
      reloadConversations(state.selectedKey);
    });

    window.addEventListener('pageshow', function () {
      reloadConversations(state.selectedKey);
    });

    window.addEventListener('beforeunload', stopLiveSync);
  }

  async function init() {
    state.currentUser = resolveCurrentUser();
    if (!state.currentUser || !state.currentUser.email) {
      window.location.href = 'join.html';
      return;
    }

    var query = readQueryTarget();
    state.queryTarget = query.target;
    state.backUrl = query.backUrl;
    state.backLabel = query.backLabel;

    renderSelfCard();
    bindEvents();
    await reloadConversations(state.queryTarget ? conversationKey(state.queryTarget) : '');
    startLiveSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
