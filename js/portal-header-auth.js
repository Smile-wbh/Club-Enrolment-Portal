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
      return;
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

  function readJsonArray(key) {
    try {
      var raw = window.localStorage.getItem(key);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function countUnreadNotifications(session, profile) {
    if (!session) return 0;

    var seenAt = readNotificationSeenAt(session);
    var email = normalizeEmail(session && session.email);
    var userId = String((session && session.userId) || '').trim();
    var aliases = currentAliases(session, profile);
    var count = 0;

    readJsonArray('user_message_board_v1').forEach(function (item) {
      var row = item || {};
      var targetUserId = String(row.targetUserId || '').trim();
      var targetEmail = normalizeEmail(row.targetEmail);
      var targetName = String(row.targetName || '').trim().toLowerCase();
      var fromUserId = String(row.fromUserId || '').trim();
      var fromEmail = normalizeEmail(row.fromEmail);
      var createdTs = Number(row.createdTs || 0) || parseTimeValue(row.createdAt);
      var isReceived = (userId && targetUserId && userId === targetUserId)
        || (email && targetEmail && email === targetEmail)
        || (!!targetName && aliases.indexOf(targetName) > -1);
      var isOutgoing = (userId && fromUserId && userId === fromUserId)
        || (email && fromEmail && email === fromEmail);
      if (isReceived && !isOutgoing && createdTs > seenAt) {
        count += 1;
      }
    });

    readJsonArray('specialty_bookings_v1').forEach(function (item) {
      var row = item || {};
      var bookingEmail = normalizeEmail(row.userEmail);
      var status = String(row.status || '').trim().toLowerCase();
      var createdTs = Number(row.createdTs || 0) || parseTimeValue(row.createdAt);
      if (email && bookingEmail === email && status !== 'cancelled' && createdTs > seenAt) {
        count += 1;
      }
    });

    return count;
  }

  function isMessagesPage() {
    return /\/html\/join\.html$/.test(window.location.pathname) && /(?:\?|&)tab=messages(?:&|$)/.test(window.location.search);
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

  function isSettingsPage() {
    return /\/html\/settings\.html$/.test(window.location.pathname);
  }

  function getUserCenterItems(pagePrefix, session) {
    var items = [
      { label: 'User Dashboard', href: pagePrefix + 'join.html?tab=home', active: isUserCenterPage() }
    ];

    items.push({
      label: 'Messages',
      href: pagePrefix + 'join.html?tab=messages',
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

    items.push({
      label: 'Settings',
      href: pagePrefix + 'settings.html',
      active: isSettingsPage()
    });

    return items;
  }

  function buildProfileMenuHtml(pagePrefix, session, unreadCount) {
    return getUserCenterItems(pagePrefix, session)
      .map(function (item) {
        var className = 'portal-profile-item' + (item.active ? ' active' : '');
        var badge = item.label === 'Messages' && unreadCount > 0
          ? '<span class="portal-menu-badge">' + escapeHtml(unreadCount > 99 ? '99+' : String(unreadCount)) + '</span>'
          : '';
        var extraClass = item.label === 'Messages' ? ' portal-profile-item-with-badge' : '';
        return '<a class="' + className + extraClass + '" href="' + item.href + '"><span>' + item.label + '</span>' + badge + '</a>';
      })
      .join('');
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
    renderTopNav(session, pagePrefix);
    var actionsList = document.querySelectorAll('.top-actions');
    actionsList.forEach(function (actions) {
      if (session) {
        var profile = resolveProfile(session, pagePrefix);
        var unreadCount = countUnreadNotifications(session, profile);
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
                '<span class="portal-user-sub">' + escapeHtml(profile.email) + '</span>' +
              '</span>' +
              (unreadCount > 0 ? '<span class="portal-user-alert-badge">' + escapeHtml(unreadCount > 99 ? '99+' : String(unreadCount)) + '</span>' : '') +
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
        '<a class="top-btn accent" href="' + pagePrefix + 'join.html">Sign up</a>';
    });
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
    if (!event || !event.key || event.key === 'user_session_v1' || event.key === 'club_users' || event.key === 'user_message_board_v1' || event.key === 'specialty_bookings_v1' || event.key.indexOf('user_notifications_seen_v1:') === 0) {
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

    renderActions();
    if (document.readyState === 'loading' && !document.querySelector('.top-actions')) {
      document.addEventListener('DOMContentLoaded', renderActions, { once: true });
    }
  })();
