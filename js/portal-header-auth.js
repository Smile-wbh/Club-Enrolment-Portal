(function () {
  function isClubSubPage() {
    return /\/html\/club\//.test(window.location.pathname);
  }

  function getPagePrefix() {
    return isClubSubPage() ? '../' : '';
  }

  function getAssetPath(pagePrefix, relativePath) {
    return pagePrefix + '../' + relativePath;
  }

  function ensureHeaderStyles() {
    if (!document || document.getElementById('portalHeaderAccountDeleteStyles')) return;
    var style = document.createElement('style');
    style.id = 'portalHeaderAccountDeleteStyles';
    style.textContent = [
      '.portal-profile-divider{height:1px;margin:4px 4px 6px;background:rgba(148,163,184,.28);}',
      '.portal-profile-item-danger{color:#b42318 !important;font-weight:700;}',
      '.portal-profile-item-danger:hover{background:#fff0ee !important;color:#912018 !important;}'
    ].join('');
    document.head && document.head.appendChild(style);
  }

  function readSession() {
    var stores = [window.localStorage, window.sessionStorage];
    for (var i = 0; i < stores.length; i += 1) {
      try {
        var raw = stores[i].getItem('user_session_v1');
        if (!raw) continue;
        var session = JSON.parse(raw);
        var email = session && typeof session.email === 'string' ? session.email.trim() : '';
        if (email) return session;
      } catch (error) {}
    }
    return null;
  }

  function clearStoredSupabaseAuth() {
    [window.localStorage, window.sessionStorage].forEach(function (store) {
      if (!store) return;
      try {
        for (var i = store.length - 1; i >= 0; i -= 1) {
          var key = String(store.key(i) || '');
          if ((key.indexOf('sb-') === 0 && key.indexOf('auth-token') > -1) || key.indexOf('supabase.auth.token') > -1) {
            store.removeItem(key);
          }
        }
      } catch (error) {}
    });
  }

  function readUsers() {
    try {
      var raw = window.localStorage.getItem('club_users');
      var users = raw ? JSON.parse(raw) : [];
      return Array.isArray(users) ? users : [];
    } catch (error) {
      return [];
    }
  }

  function normalizeEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildInitials(value) {
    var source = String(value || '').replace(/\s+/g, '').trim();
    if (!source) return 'US';
    return Array.from(source).slice(0, 2).join('').toUpperCase();
  }

  function parseTimeValue(value) {
    var text = String(value || '').trim();
    if (!text) return 0;
    var parsed = Date.parse(text);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
  }

  function getSupabaseClientSafe() {
    try {
      return typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    } catch (error) {
      return null;
    }
  }

  function readJsonObject(key) {
    try {
      var raw = window.localStorage.getItem(key);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function filterLocalArray(key, predicate) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      var next = parsed.filter(predicate);
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch (error) {}
  }

  function removePendingRecordIfOwned(key, email, userId) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      var target = parsed && typeof parsed === 'object' && parsed.order && typeof parsed.order === 'object'
        ? parsed.order
        : parsed;
      if (!target || typeof target !== 'object') return;
      if (rowMatchesUser(target, email, userId, ['userEmail', 'ownerEmail'], ['userId', 'ownerId'])) {
        window.localStorage.removeItem(key);
      }
    } catch (error) {}
  }

  function rowMatchesUser(row, email, userId, emailKeys, idKeys) {
    var emailMatch = false;
    var idMatch = false;
    (emailKeys || []).forEach(function (key) {
      if (email && normalizeEmail(row && row[key]) === email) {
        emailMatch = true;
      }
    });
    (idKeys || []).forEach(function (key) {
      if (userId && String((row && row[key]) || '').trim() === userId) {
        idMatch = true;
      }
    });
    return emailMatch || idMatch;
  }

  function isForumEntryOwnedByUser(item, email, userId, aliases) {
    var ownerEmail = normalizeEmail(item && item.ownerEmail);
    var authorEmail = normalizeEmail(item && item.authorEmail);
    var ownerId = String((item && (item.ownerId || item.userId || item.authorId)) || '').trim();
    var author = String((item && item.author) || '').trim().toLowerCase();
    if (email && (ownerEmail === email || authorEmail === email)) return true;
    if (userId && ownerId === userId) return true;
    return !ownerEmail && !authorEmail && !!author && aliases.indexOf(author) > -1;
  }

  function pruneForumComments(list, email, userId, aliases) {
    return (Array.isArray(list) ? list : []).reduce(function (result, item) {
      if (!item || typeof item !== 'object') return result;
      if (isForumEntryOwnedByUser(item, email, userId, aliases)) {
        return result;
      }
      var next = Object.assign({}, item);
      if (Array.isArray(item.replies)) {
        next.replies = pruneForumComments(item.replies, email, userId, aliases);
      }
      result.push(next);
      return result;
    }, []);
  }

  function clearStoredAccountData(session) {
    var email = normalizeEmail(session && session.email);
    var userId = String((session && session.userId) || '').trim();
    var aliases = currentAliases(session, { nickname: session && session.nickname });
    var rememberedLoginEmail = '';

    if (!email && !userId) return;

    try {
      rememberedLoginEmail = normalizeEmail(window.localStorage.getItem('remembered_login_email_v1') || '');
      if (rememberedLoginEmail && rememberedLoginEmail === email) {
        window.localStorage.removeItem('remembered_login_email_v1');
      }
    } catch (error) {}

    filterLocalArray('club_users', function (item) {
      return normalizeEmail(item && item.email) !== email;
    });

    filterLocalArray('specialty_bookings_v1', function (item) {
      return !rowMatchesUser(item, email, userId, ['userEmail', 'ownerEmail'], ['userId', 'ownerId']);
    });

    filterLocalArray('mfms_teaching_bookings_v1', function (item) {
      return !rowMatchesUser(item, email, userId, ['userEmail', 'ownerEmail'], ['userId', 'ownerId']);
    });

    filterLocalArray('mfms_fav_courses_v1', function (item) {
      return !rowMatchesUser(item, email, userId, ['ownerEmail', 'userEmail'], ['ownerId', 'userId']);
    });

    filterLocalArray('club_registry_v1', function (item) {
      return !rowMatchesUser(item, email, userId, ['ownerEmail', 'userEmail'], ['ownerId', 'userId']);
    });

    filterLocalArray('specialty_clubs_v1', function (item) {
      return !rowMatchesUser(item, email, userId, ['ownerEmail', 'userEmail'], ['ownerId', 'userId']);
    });

    filterLocalArray('club_members_v1', function (item) {
      return !rowMatchesUser(item, email, userId, ['userEmail', 'ownerEmail'], ['userId', 'ownerId']);
    });

    filterLocalArray('mfms_courses_v1', function (item) {
      return !rowMatchesUser(item, email, userId, ['ownerEmail'], ['ownerId', 'userId']);
    });

    filterLocalArray('chat_messages_v1', function (item) {
      var messageUserId = String((item && item.userId) || '').trim();
      var sessionScopedChatUserId = email ? ('user:' + email) : '';
      var emailMatch = email && normalizeEmail(item && item.userEmail) === email;
      var idMatch = !!sessionScopedChatUserId && messageUserId === sessionScopedChatUserId;
      var userMatch = userId && messageUserId === userId;
      return !(emailMatch || idMatch || userMatch);
    });

    filterLocalArray('user_message_board_v1', function (item) {
      var fromEmail = normalizeEmail(item && item.fromEmail);
      var targetEmail = normalizeEmail(item && item.targetEmail);
      var fromUserId = String((item && item.fromUserId) || '').trim();
      var targetUserId = String((item && item.targetUserId) || '').trim();
      var fromName = String((item && item.fromName) || '').trim().toLowerCase();
      var targetName = String((item && item.targetName) || '').trim().toLowerCase();
      var matchesEmail = email && (fromEmail === email || targetEmail === email);
      var matchesUserId = userId && (fromUserId === userId || targetUserId === userId);
      var matchesAlias = (!!fromName && aliases.indexOf(fromName) > -1)
        || (!!targetName && aliases.indexOf(targetName) > -1);
      return !(matchesEmail || matchesUserId || matchesAlias);
    });

    filterLocalArray('user_login_history_v1', function (item) {
      return normalizeEmail(item && item.email) !== email;
    });

    try {
      var rawForumPosts = window.localStorage.getItem('spjs_forum_posts_v1');
      var forumPosts = rawForumPosts ? JSON.parse(rawForumPosts) : [];
      if (Array.isArray(forumPosts)) {
        var nextForumPosts = forumPosts.reduce(function (result, item) {
          if (!item || typeof item !== 'object') return result;
          if (isForumEntryOwnedByUser(item, email, userId, aliases)) {
            return result;
          }
          var nextItem = Object.assign({}, item);
          nextItem.comments = pruneForumComments(item.comments, email, userId, aliases);
          result.push(nextItem);
          return result;
        }, []);
        window.localStorage.setItem('spjs_forum_posts_v1', JSON.stringify(nextForumPosts));
      }
    } catch (error) {}

    try {
      var securitySettings = readJsonObject('user_security_settings_v1');
      if (securitySettings && email) {
        delete securitySettings[email];
        window.localStorage.setItem('user_security_settings_v1', JSON.stringify(securitySettings));
      }
    } catch (error) {}

    try {
      var profileCovers = readJsonObject('spjs_forum_profile_covers_v1');
      var coverKey = email ? ('email:' + email) : '';
      if (profileCovers && coverKey) {
        delete profileCovers[coverKey];
        window.localStorage.setItem('spjs_forum_profile_covers_v1', JSON.stringify(profileCovers));
      }
    } catch (error) {}

    try {
      for (var i = window.localStorage.length - 1; i >= 0; i -= 1) {
        var key = String(window.localStorage.key(i) || '');
        var normalizedKey = key.toLowerCase();
        if (email && normalizedKey === ('mfms_favs_v1:' + email)) {
          window.localStorage.removeItem(key);
          continue;
        }
        if (email && normalizedKey === ('local_business_migration_v1:' + email)) {
          window.localStorage.removeItem(key);
        }
      }
    } catch (error) {}

    try {
      if (email) window.localStorage.removeItem('user_notifications_seen_v1:' + email);
      if (userId) window.localStorage.removeItem('user_notifications_seen_v1:' + userId);
      window.localStorage.removeItem('chat_user_id_v1');
    } catch (error) {}

    removePendingRecordIfOwned('specialty_pending_payment_v1', email, userId);
    removePendingRecordIfOwned('mfms_pending_course_booking_v1', email, userId);

    try {
      window.localStorage.removeItem('user_session_v1');
    } catch (error) {}
    try {
      window.sessionStorage.removeItem('user_session_v1');
    } catch (error) {}

    clearStoredSupabaseAuth();
  }

  function showPortalConfirm(message, options) {
    if (window.portalConfirm) {
      return window.portalConfirm(message, options || {});
    }
    return Promise.resolve(window.confirm(String(message || '')));
  }

  function showPortalAlert(message, options) {
    if (window.portalAlert) {
      return window.portalAlert(message, options || {});
    }
    window.alert(String(message || ''));
    return Promise.resolve();
  }

  async function getCurrentAccessToken() {
    var client = getSupabaseClientSafe();
    if (!client || !client.auth || typeof client.auth.getSession !== 'function') {
      return '';
    }
    try {
      var result = await client.auth.getSession();
      return String((result && result.data && result.data.session && result.data.session.access_token) || '').trim();
    } catch (error) {
      return '';
    }
  }

  async function requestAccountDeletion(accessToken) {
    var response = await window.fetch('/api/delete-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken
      },
      body: JSON.stringify({})
    });
    var result = {};
    try {
      result = await response.json();
    } catch (error) {}
    if (!response.ok) {
      var failure = new Error((result && result.message) || 'Unable to delete this account right now.');
      failure.code = result && result.error;
      throw failure;
    }
    return result || {};
  }

  function mapDeleteAccountError(error) {
    var text = String((error && error.message) || '').trim();
    var lower = text.toLowerCase();
    if (!text) return 'Unable to delete this account right now. Please try again.';
    if (
      lower.indexOf('sign in again') > -1
      || lower.indexOf('unauthorized') > -1
      || lower.indexOf('invalid jwt') > -1
      || lower.indexOf('jwt expired') > -1
      || lower.indexOf('session') > -1
    ) {
      return 'Please sign in again, then retry deleting this account.';
    }
    return text;
  }

  async function startDeleteAccountFlow(options) {
    var session = readSession();
    var config = options && typeof options === 'object' ? options : {};
    var redirectUrl = String(config.redirectUrl || 'join.html').trim() || 'join.html';
    var accessToken = '';
    var hasCloudSession = false;
    var message = '';

    if (window.__portalDeleteAccountPending) {
      return false;
    }

    if (!session || !normalizeEmail(session.email)) {
      await showPortalAlert('Please sign in before deleting this account.', {
        title: 'Delete Account',
        confirmText: 'OK'
      });
      return false;
    }

    accessToken = await getCurrentAccessToken();
    hasCloudSession = !!accessToken;

    if (!hasCloudSession && isUuid(session.userId)) {
      await showPortalAlert('Please sign in again before deleting this account so the cloud data can be removed as well.', {
        title: 'Delete Account',
        confirmText: 'OK'
      });
      return false;
    }

    message = hasCloudSession
      ? 'This will permanently delete your account and remove your profile, clubs, courses, bookings, messages, forum content, and uploaded data.\n\nThis action cannot be undone.'
      : 'This will permanently remove the saved account and related browser data on this device.\n\nThis action cannot be undone.';

    var confirmed = await showPortalConfirm(message, {
      title: 'Delete Account',
      confirmText: 'Delete Account',
      cancelText: 'Keep Account',
      confirmVariant: 'danger',
      hideHeaderClose: true
    });

    if (!confirmed) {
      return false;
    }

    window.__portalDeleteAccountPending = true;
    try {
      if (hasCloudSession) {
        await requestAccountDeletion(accessToken);
      }

      clearStoredAccountData(session);

      var client = getSupabaseClientSafe();
      if (client && client.auth && typeof client.auth.signOut === 'function') {
        try {
          await client.auth.signOut();
        } catch (error) {}
      }

      await showPortalAlert('Your account has been deleted. You will be returned to the login page.', {
        title: 'Account Deleted',
        confirmText: 'OK'
      });

      window.location.replace(redirectUrl);
      return true;
    } catch (error) {
      await showPortalAlert(mapDeleteAccountError(error), {
        title: 'Delete Account',
        confirmText: 'OK'
      });
      return false;
    } finally {
      window.__portalDeleteAccountPending = false;
    }
  }

  function notificationSeenKey(session) {
    var userKey = String((session && (session.userId || session.email)) || '').trim();
    return 'user_notifications_seen_v1:' + (userKey || 'guest');
  }

  function readNotificationSeenAt(session) {
    try {
      return Number(window.localStorage.getItem(notificationSeenKey(session)) || 0) || 0;
    } catch (error) {
      return 0;
    }
  }

  function currentAliases(session, profile) {
    var email = normalizeEmail(session && session.email);
    var nickname = String((profile && profile.nickname) || (session && session.nickname) || '').trim().toLowerCase();
    var aliases = [
      nickname,
      email,
      email ? email.split('@')[0] : ''
    ].filter(Boolean);
    return Array.from(new Set(aliases));
  }

  function getSupportService() {
    return window.clubSupportSupabase || null;
  }

  function hasCloudSupportConfigured() {
    var service = getSupportService();
    return !!(service && typeof service.isConfigured === 'function' && service.isConfigured());
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

  function isIncomingMessageForSession(row, session, profile) {
    var email = normalizeEmail(session && session.email);
    var userId = String((session && session.userId) || '').trim();
    var aliases = currentAliases(session, profile);
    var targetUserId = String((row && (row.targetUserId || row.target_user_id)) || '').trim();
    var targetEmail = normalizeEmail(row && (row.targetEmail || row.target_email));
    var targetName = String((row && (row.targetName || row.target_name)) || '').trim().toLowerCase();
    var fromUserId = String((row && (row.fromUserId || row.from_user_id)) || '').trim();
    var fromEmail = normalizeEmail(row && (row.fromEmail || row.from_email));
    var fromName = String((row && (row.fromName || row.from_name)) || '').trim().toLowerCase();
    var isReceived = (userId && targetUserId && userId === targetUserId)
      || (email && targetEmail && email === targetEmail)
      || (!!targetName && aliases.indexOf(targetName) > -1);
    var isOutgoing = (userId && fromUserId && userId === fromUserId)
      || (email && fromEmail && email === fromEmail)
      || (!!fromName && aliases.indexOf(fromName) > -1);
    return isReceived && !isOutgoing;
  }

  async function fetchMyMessageBoardRows(session) {
    var userId = String((session && session.userId) || '').trim();
    var email = normalizeEmail(session && session.email);
    if (!userId && !email) return [];

    var service = getSupportService();
    if (hasCloudSupportConfigured() && userId && service && typeof service.fetchMyMessageBoard === 'function') {
      try {
        var serviceRows = await service.fetchMyMessageBoard(userId);
        return Array.isArray(serviceRows) ? serviceRows : [];
      } catch (error) {}
    }

    var client = getSupabaseClientSafe();
    if (!client) return [];

    var selectText = 'id, target_user_id, target_email, target_name, from_user_id, from_email, from_name, created_at';
    var tasks = [];
    if (userId) {
      tasks.push(client.from('message_board_entries').select(selectText).eq('target_user_id', userId));
    }
    if (email) {
      tasks.push(client.from('message_board_entries').select(selectText).eq('target_email', email));
    }
    if (!tasks.length) return [];

    try {
      var results = await Promise.all(tasks);
      var unique = {};
      results.forEach(function (result) {
        if (!result || result.error || !Array.isArray(result.data)) return;
        result.data.forEach(function (row) {
          var key = String((row && row.id) || '').trim() || JSON.stringify(row || {});
          if (!key || unique[key]) return;
          unique[key] = row;
        });
      });
      return Object.keys(unique).map(function (key) {
        return unique[key];
      });
    } catch (error) {
      return [];
    }
  }

  function formatUnreadBadgeText(unreadCount) {
    return unreadCount > 99 ? '99+' : String(Math.max(0, unreadCount || 0));
  }

  function setUnreadBadgeState(unreadCount) {
    var text = formatUnreadBadgeText(unreadCount);
    document.querySelectorAll('[data-portal-message-badge]').forEach(function (element) {
      element.textContent = text;
      element.hidden = unreadCount <= 0;
    });
  }

  var unreadRefreshToken = 0;

  async function refreshUnreadIndicators(session, profile) {
    var token = ++unreadRefreshToken;
    if (!session) {
      setUnreadBadgeState(0);
      return 0;
    }

    try {
      var seenAt = readNotificationSeenAt(session);
      var rows = await fetchMyMessageBoardRows(session);
      if (token !== unreadRefreshToken) return 0;
      var count = rows.filter(function (row) {
        if (!isIncomingMessageForSession(row, session, profile)) return false;
        var createdTs = Number(row && row.createdTs) || parseTimeValue(row && (row.createdAt || row.created_at));
        return createdTs > seenAt;
      }).length;
      setUnreadBadgeState(count);
      return count;
    } catch (error) {
      if (token !== unreadRefreshToken) return 0;
      setUnreadBadgeState(0);
      return 0;
    }
  }

  function isMessagesPage() {
    return /\/html\/messages\.html$/.test(window.location.pathname);
  }

  function resolveProfile(session, pagePrefix) {
    var email = session && typeof session.email === 'string' ? session.email.trim() : '';
    var nickname = session && typeof session.nickname === 'string' ? session.nickname.trim() : '';
    var avatar = '';
    var users = readUsers();
    var match = users.find(function (user) {
      return normalizeEmail(user && user.email) === normalizeEmail(email);
    });

    if (match) {
      if (typeof match.nickname === 'string' && match.nickname.trim()) {
        nickname = match.nickname.trim();
      }
      if (typeof match.email === 'string' && match.email.trim()) {
        email = match.email.trim();
      }
      if (typeof match.avatar === 'string' && match.avatar.trim()) {
        avatar = match.avatar.trim();
      }
    }

    return {
      nickname: nickname || (email ? email.split('@')[0] : 'User'),
      email: email || 'Not logged in',
      avatar: avatar,
      initials: buildInitials(nickname || (email ? email.split('@')[0] : 'User'))
    };
  }

  function isUserCenterPage() {
    return /\/html\/join\.html$/.test(window.location.pathname) && !isMessagesPage();
  }

  function isClubDashboardPage() {
    return /\/html\/club_management_dashboard\.html$/.test(window.location.pathname);
  }

  function getUserCenterItems(pagePrefix, session) {
    var items = [
      { label: 'User Dashboard', href: pagePrefix + 'join.html?tab=home', active: isUserCenterPage() }
    ];

    items.push({
      label: 'Messages',
      href: pagePrefix + 'messages.html',
      active: isMessagesPage(),
      unreadCount: 0
    });

    if (session && session.isClubManager) {
      items.push({
        label: 'My Club Dashboard',
        href: pagePrefix + 'club_management_dashboard.html',
        active: isClubDashboardPage()
        });
      }

    return items;
  }

  function buildProfileMenuHtml(pagePrefix, session, unreadCount) {
    var itemsHtml = getUserCenterItems(pagePrefix, session)
      .map(function (item) {
        var className = 'portal-profile-item' + (item.active ? ' active' : '');
        var badge = item.label === 'Messages'
          ? '<span class="portal-menu-badge" data-portal-message-badge="menu"' + (unreadCount > 0 ? '' : ' hidden') + '>' + escapeHtml(formatUnreadBadgeText(unreadCount)) + '</span>'
          : '';
        var extraClass = item.label === 'Messages' ? ' portal-profile-item-with-badge' : '';
        return '<a class="' + className + extraClass + '" href="' + item.href + '"><span>' + item.label + '</span>' + badge + '</a>';
      })
      .join('');
    return itemsHtml
      + '<div class="portal-profile-divider" role="separator"></div>'
      + '<button class="portal-profile-item portal-profile-item-danger" type="button" data-portal-delete-account="true">Delete Account</button>';
  }

  function removeDynamicNavLinks(nav) {
    if (!nav) return;
    nav.querySelectorAll('[data-portal-dynamic-nav="true"]').forEach(function (link) {
      link.remove();
    });
  }

  function appendNavLink(nav, href, label) {
    if (!nav) return;
    var link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    link.setAttribute('data-portal-dynamic-nav', 'true');
    nav.appendChild(link);
  }

  function renderTopNav(session, pagePrefix) {
    var navList = document.querySelectorAll('.top-nav');
    navList.forEach(function (nav) {
      removeDynamicNavLinks(nav);
    });
  }

  function closeProfileMenu(wrap) {
    if (!wrap) return;
    var toggle = wrap.querySelector('[data-portal-profile-toggle="true"]');
    var menu = wrap.querySelector('[data-portal-profile-menu="true"]');
    wrap.classList.remove('open');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
    }
    if (menu) {
      menu.hidden = true;
    }
  }

  function openProfileMenu(wrap) {
    if (!wrap) return;
    var toggle = wrap.querySelector('[data-portal-profile-toggle="true"]');
    var menu = wrap.querySelector('[data-portal-profile-menu="true"]');
    wrap.classList.add('open');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'true');
    }
    if (menu) {
      menu.hidden = false;
    }
  }

  function closeAllProfileMenus(exceptWrap) {
    document.querySelectorAll('.portal-profile-wrap').forEach(function (wrap) {
      if (exceptWrap && wrap === exceptWrap) return;
      closeProfileMenu(wrap);
    });
  }

  function renderActions() {
    ensureHeaderStyles();
    var session = readSession();
    var pagePrefix = getPagePrefix();
    var profile = session ? resolveProfile(session, pagePrefix) : null;
    renderTopNav(session, pagePrefix);
    var actionsList = document.querySelectorAll('.top-actions');
    actionsList.forEach(function (actions) {
      if (session) {
        var unreadCount = 0;
        var avatarHtml = profile.avatar
          ? (
            '<span class="portal-user-avatar has-image">' +
              '<img src="' + escapeHtml(profile.avatar) + '" alt="User avatar" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
              '<span class="portal-user-avatar-text" style="display:none">' + escapeHtml(profile.initials) + '</span>' +
            '</span>'
          )
          : (
            '<span class="portal-user-avatar">' +
              '<span class="portal-user-avatar-text">' + escapeHtml(profile.initials) + '</span>' +
            '</span>'
          );
        actions.innerHTML =
          '<div class="portal-profile-wrap">' +
            '<button class="portal-user-chip" type="button" data-portal-profile-toggle="true" aria-expanded="false" aria-label="Open profile menu">' +
              avatarHtml +
              '<span class="portal-user-meta">' +
                '<span class="portal-user-name">' + escapeHtml(profile.nickname) + '</span>' +
              '</span>' +
              '<span class="portal-user-alert-badge" data-portal-message-badge="chip"' + (unreadCount > 0 ? '' : ' hidden') + '>' + escapeHtml(formatUnreadBadgeText(unreadCount)) + '</span>' +
              '<span class="portal-user-arrow" aria-hidden="true">▼</span>' +
            '</button>' +
            '<div class="portal-profile-menu" data-portal-profile-menu="true" hidden>' +
              buildProfileMenuHtml(pagePrefix, session, unreadCount) +
            '</div>' +
          '</div>' +
          '<a class="top-btn accent" href="#" data-portal-logout="true">Log Out</a>';
        return;
      }

      actions.innerHTML =
        '<a class="top-btn light" href="' + pagePrefix + 'join.html">Log in</a>' +
        '<a class="top-btn accent" href="' + pagePrefix + 'join.html?view=signup#auth-entry">Sign up</a>';
    });
    if (session && profile) {
      refreshUnreadIndicators(session, profile);
    } else {
      setUnreadBadgeState(0);
    }
  }

  function handleDocumentClick(event) {
    var logoutTarget = event.target.closest('[data-portal-logout]');
    if (logoutTarget) {
      event.preventDefault();
      try {
        window.localStorage.removeItem('user_session_v1');
      } catch (error) {}
      try {
        window.sessionStorage.removeItem('user_session_v1');
      } catch (error) {}
      clearStoredSupabaseAuth();
      closeAllProfileMenus();
      renderActions();
      window.location.reload();
      return;
    }

    var deleteAccountTarget = event.target.closest('[data-portal-delete-account]');
    if (deleteAccountTarget) {
      event.preventDefault();
      closeAllProfileMenus();
      startDeleteAccountFlow();
      return;
    }

    var toggle = event.target.closest('[data-portal-profile-toggle="true"]');
    if (toggle) {
      event.preventDefault();
      var wrap = toggle.closest('.portal-profile-wrap');
      var nextOpen = !(wrap && wrap.classList.contains('open'));
      closeAllProfileMenus(nextOpen ? wrap : null);
      if (wrap) {
        if (nextOpen) {
          openProfileMenu(wrap);
        } else {
          closeProfileMenu(wrap);
        }
      }
      return;
    }

    if (!event.target.closest('.portal-profile-wrap')) {
      closeAllProfileMenus();
    }
  }

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeAllProfileMenus();
    }
  });
  window.addEventListener('storage', function (event) {
    if (!event || !event.key || event.key === 'user_session_v1' || event.key === 'club_users' || event.key.indexOf('user_notifications_seen_v1:') === 0) {
      closeAllProfileMenus();
      renderActions();
    }
  });
  window.addEventListener('pageshow', function () {
    closeAllProfileMenus();
    renderActions();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      closeAllProfileMenus();
      renderActions();
    }
  });

  window.portalRefreshUnreadMessages = function () {
    var session = readSession();
    if (!session) {
      setUnreadBadgeState(0);
      return Promise.resolve(0);
    }
    return refreshUnreadIndicators(session, resolveProfile(session, getPagePrefix()));
  };

    window.portalDeleteAccountFlow = startDeleteAccountFlow;

    renderActions();
    if (document.readyState === 'loading' && !document.querySelector('.top-actions')) {
      document.addEventListener('DOMContentLoaded', renderActions, { once: true });
    }
  })();
