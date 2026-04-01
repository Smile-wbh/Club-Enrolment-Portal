(function () {
  var KEYS = {
    session: 'user_session_v1',
    users: 'club_users',
    prefs: 'user_security_settings_v1',
    history: 'user_login_history_v1'
  };

  var state = {
    session: null,
    user: null,
    prefs: {},
    history: [],
    activePanel: '',
    authUser: null,
    hasSupabase: false
  };

  function readJson(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  function trimText(value) {
    return String(value || '').trim();
  }

  function getSupabaseClientSafe() {
    try {
      return typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    } catch (error) {
      return null;
    }
  }

  function hasSupabaseConfigured() {
    var config = window.APP_CONFIG || {};
    return !!(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && getSupabaseClientSafe());
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
    var parsed = readJson(KEYS.users, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveUsers(users) {
    writeJson(KEYS.users, Array.isArray(users) ? users : []);
  }

  function readPrefsMap() {
    var parsed = readJson(KEYS.prefs, {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }

  function savePrefsMap(map) {
    writeJson(KEYS.prefs, map && typeof map === 'object' ? map : {});
  }

  function readLoginHistory() {
    var parsed = readJson(KEYS.history, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveLoginHistory(list) {
    writeJson(KEYS.history, Array.isArray(list) ? list : []);
  }

  function formatDateText(value) {
    var text = trimText(value);
    if (!text) return 'Not set';
    var time = Date.parse(text);
    if (Number.isNaN(time)) return text;
    return new Date(time).toLocaleString();
  }

  function withinDays(value, days) {
    var time = Date.parse(trimText(value));
    if (Number.isNaN(time)) return false;
    var diff = Date.now() - time;
    return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
  }

  function maskPhone(value) {
    var text = trimText(value);
    if (!text) return 'Not set';
    if (text.length < 7) return text;
    return text.slice(0, 3) + '****' + text.slice(-4);
  }

  function detectCurrentEntry() {
    if (!state.session) return 'User Dashboard';
    if (state.session.entrySystem === 'club') return 'My Club Dashboard';
    return 'User Dashboard';
  }

  function isClubManagerRole(role) {
    var value = trimText(role).toLowerCase();
    return value === 'club_manager' || value === 'admin';
  }

  function buildCompatSession(user, target) {
    var role = trimText(user && user.role) || (user && user.isClubManager ? 'club_manager' : 'member');
    return {
      userId: trimText(user && user.id),
      email: normalizeEmail(user && user.email),
      nickname: trimText(user && user.nickname),
      isClubManager: !!(user && user.isClubManager),
      role: role || 'member',
      entrySystem: target === 'club' ? 'club' : 'user'
    };
  }

  function defaultPrefs(user, existing) {
    var base = {
      recoveryEmail: trimText(user && user.email),
      recoveryPhone: trimText(user && user.phone),
      loginAlert: true,
      bookingReminder: true,
      teachingReminder: true,
      messageBoardAlert: true,
      consultAlert: true,
      managerAuditAlert: !!(user && user.isClubManager),
      allowProfileMessages: true,
      showForumClub: true,
      showProfileLocation: false,
      hideEmailOnProfile: true,
      alwaysAskSystem: true,
      preferredEntrySystem: 'user',
      pendingResetCode: '',
      pendingResetAt: ''
    };
    var merged = Object.assign({}, base, existing || {});
    if (!(user && user.isClubManager)) {
      merged.alwaysAskSystem = true;
      merged.preferredEntrySystem = 'user';
      merged.managerAuditAlert = false;
    }
    return merged;
  }

  function syncSessionStore() {
    if (!state.user) return;
    var session = Object.assign({}, state.session || {}, {
      userId: trimText(state.user.id),
      email: normalizeEmail(state.user.email),
      nickname: trimText(state.user.nickname),
      isClubManager: !!state.user.isClubManager,
      role: trimText(state.user.role) || (state.user.isClubManager ? 'club_manager' : 'member'),
      entrySystem: state.session && state.session.entrySystem ? state.session.entrySystem : 'user'
    });
    try {
      window.localStorage.setItem(KEYS.session, JSON.stringify(session));
    } catch (error) {}
    try {
      window.sessionStorage.setItem(KEYS.session, JSON.stringify(session));
    } catch (error) {}
    state.session = session;
  }

  function updateUserRecord(updater) {
    var users = readUsers();
    var email = normalizeEmail(state.user && state.user.email);
    var index = users.findIndex(function (item) {
      return normalizeEmail(item && item.email) === email;
    });
    if (index < 0) return false;
    var nextUser = Object.assign({}, users[index]);
    updater(nextUser);
    users[index] = nextUser;
    saveUsers(users);
    state.user = Object.assign({}, state.user || {}, nextUser);
    syncSessionStore();
    return true;
  }

  function upsertLegacyUserCache(user) {
    if (!user || !trimText(user.email)) return;
    var users = readUsers();
    var email = normalizeEmail(user.email);
    var index = users.findIndex(function (item) {
      return normalizeEmail(item && item.email) === email;
    });
    var existing = index > -1 ? users[index] : {};
      var nextUser = Object.assign({}, existing, {
        userId: trimText(user.id) || trimText(existing.userId || existing.id),
        id: trimText(user.id) || trimText(existing.id || existing.userId),
        email: email,
        nickname: trimText(user.nickname) || trimText(existing.nickname) || email.split('@')[0] || 'User',
        isClubManager: !!user.isClubManager,
        role: trimText(user.role) || trimText(existing.role) || (user.isClubManager ? 'club_manager' : 'member'),
        avatar: trimText(user.avatar) || trimText(existing.avatar),
        forumCoverUrl: trimText(user.forumCoverUrl) || trimText(existing.forumCoverUrl),
        bio: trimText(user.bio) || trimText(existing.bio),
      gender: trimText(user.gender) || trimText(existing.gender),
      phone: trimText(user.phone) || trimText(existing.phone),
      birthday: trimText(user.birthday) || trimText(existing.birthday),
      location: trimText(user.location) || trimText(existing.location),
      hobbies: trimText(user.hobbies) || trimText(existing.hobbies),
      createdAt: trimText(user.createdAt) || trimText(existing.createdAt) || new Date().toISOString(),
      passwordUpdatedAt: trimText(user.passwordUpdatedAt) || trimText(existing.passwordUpdatedAt),
      password: typeof existing.password === 'string' ? existing.password : ''
    });
    if (index > -1) {
      users.splice(index, 1, nextUser);
    } else {
      users.push(nextUser);
    }
    saveUsers(users);
  }

  function findLegacyUserByEmail(email) {
    var normalized = normalizeEmail(email);
    if (!normalized) return null;
    return readUsers().find(function (item) {
      return normalizeEmail(item && item.email) === normalized;
    }) || null;
  }

  function persistPrefs() {
    var map = readPrefsMap();
    map[normalizeEmail(state.user && state.user.email)] = Object.assign({}, state.prefs);
    savePrefsMap(map);
  }

  function securityChecklist() {
    var passwordUpdatedAt = trimText(state.user && state.user.passwordUpdatedAt) || trimText(state.user && state.user.createdAt);
    var items = [
      { label: 'Login email connected', ok: isValidEmail(state.user && state.user.email), weight: 15 },
      { label: 'Cloud account connected to Supabase', ok: !state.hasSupabase || !!trimText(state.user && state.user.id), weight: 20 },
      { label: 'Recovery contact email saved', ok: isValidEmail(state.prefs.recoveryEmail), weight: 15 },
      { label: 'Recovery phone saved', ok: !!trimText(state.prefs.recoveryPhone), weight: 10 },
      { label: 'Password updated within the last 180 days', ok: withinDays(passwordUpdatedAt, 180), weight: 20 },
      { label: 'Login security alerts enabled', ok: !!state.prefs.loginAlert, weight: 20 }
    ];
    var score = items.reduce(function (sum, item) {
      return sum + (item.ok ? item.weight : 0);
    }, 0);
    var grade = score >= 85 ? 'Excellent' : (score >= 65 ? 'Good' : 'Needs Improvement');
    return { items: items, score: score, grade: grade };
  }

  function setStatus(id, text, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = trimText(text);
    el.className = 'form-status' + (text ? (' ' + (type || 'info')) : '');
  }

  function mapAuthErrorMessage(error, fallback) {
    var text = trimText(error && error.message);
    var lower = text.toLowerCase();
    if (lower.indexOf('invalid login credentials') > -1) return 'The current password is incorrect. Please try again.';
    if (lower.indexOf('auth session missing') > -1) return 'Your sign-in session has expired. Please log in again.';
    if (lower.indexOf('email not confirmed') > -1) return 'Please confirm your email before updating account security settings.';
    if (lower.indexOf('password should be at least') > -1) return 'Password must be at least 6 characters.';
    if (lower.indexOf('same') > -1 && lower.indexOf('password') > -1) return 'The new password must be different from the current one.';
    if (lower.indexOf('reauthentication') > -1 || lower.indexOf('security purposes') > -1) return 'Please log in again before updating your password.';
    return text || fallback || 'Unable to complete the request right now.';
  }

  function buildJoinPageUrl() {
    try {
      return new URL('join.html', window.location.href).toString();
    } catch (error) {
      return 'join.html';
    }
  }

  function renderHero() {
    var result = securityChecklist();
    var score = result.score;
    var ring = document.getElementById('securityRing');
    var scoreValue = document.getElementById('securityScoreValue');
    var grade = document.getElementById('securityGrade');
    var checklist = document.getElementById('securityChecklist');
    var metaList = document.getElementById('securityMetaList');
    var email = trimText(state.user && state.user.email) || 'Not logged in';
    var createdAt = trimText(state.user && state.user.createdAt) ? formatDateText(state.user.createdAt) : 'Creation time pending sync';
    var passwordUpdatedAt = trimText(state.user && state.user.passwordUpdatedAt) || trimText(state.user && state.user.createdAt);

    if (ring) {
      ring.style.background = 'conic-gradient(#5fd06e ' + (score * 3.6) + 'deg, rgba(255,255,255,0.12) ' + (score * 3.6) + 'deg)';
    }
    if (scoreValue) scoreValue.textContent = String(score);
    if (grade) grade.textContent = result.grade;

    var badgeRole = document.getElementById('accountRoleBadge');
    var badgeEmail = document.getElementById('accountEmailBadge');
    var badgeCreated = document.getElementById('accountCreatedBadge');
    if (badgeRole) badgeRole.textContent = state.user && state.user.isClubManager ? 'Club Manager Account' : 'Standard User Account';
    if (badgeEmail) badgeEmail.textContent = email;
    if (badgeCreated) badgeCreated.textContent = createdAt;

    if (metaList) {
      metaList.innerHTML = [
        '<div class="security-meta-item"><span>Current Entry</span><strong>' + detectCurrentEntry() + '</strong></div>',
        '<div class="security-meta-item"><span>Last Password Change</span><strong>' + formatDateText(passwordUpdatedAt) + '</strong></div>',
        '<div class="security-meta-item"><span>Auth Mode</span><strong>' + (state.hasSupabase ? 'Supabase Auth' : 'Local Demo') + '</strong></div>'
      ].join('');
    }

    if (checklist) {
      checklist.innerHTML = result.items.map(function (item) {
        return '<div class="checklist-item ' + (item.ok ? 'good' : 'warn') + '">' +
          (item.ok ? 'Completed' : 'Needs Attention') + ' · ' + item.label +
        '</div>';
      }).join('');
    }
  }

  function renderSummary() {
    var passwordUpdatedAt = trimText(state.user && state.user.passwordUpdatedAt) || trimText(state.user && state.user.createdAt);
    var summaryMap = {
      summaryEmail: trimText(state.user && state.user.email) || '-',
      summaryNickname: trimText(state.user && state.user.nickname) || 'User',
      summaryEntry: detectCurrentEntry(),
      summaryRecoveryEmail: trimText(state.prefs.recoveryEmail) || 'Not set',
      summaryRecoveryPhone: maskPhone(state.prefs.recoveryPhone)
    };
    Object.keys(summaryMap).forEach(function (key) {
      var el = document.getElementById(key);
      if (el) el.textContent = summaryMap[key];
    });
    var passwordText = document.getElementById('passwordUpdatedText');
    if (passwordText) passwordText.textContent = formatDateText(passwordUpdatedAt);
  }

  function renderManagerState() {
    var isManager = !!(state.user && state.user.isClubManager);
    var managerGroup = document.getElementById('managerSettingGroup');
    var shortcut = document.getElementById('clubDashboardShortcut');
    if (managerGroup) managerGroup.hidden = !isManager;
    if (shortcut) shortcut.hidden = !isManager;
  }

  function renderHistory() {
    var list = document.getElementById('loginHistoryList');
    var count = document.getElementById('historyCount');
    if (count) count.textContent = state.history.length + ' records';
    if (!list) return;
    if (!state.history.length) {
      list.innerHTML = '<div class="empty-state">No login history is available yet. After your next sign-in, it will sync here automatically.</div>';
      return;
    }
    list.innerHTML = state.history.map(function (item) {
      var entry = trimText(item && item.entrySystem) || 'User Dashboard';
      var device = trimText(item && item.device) || 'Current Device';
      var time = trimText(item && item.loginText) || formatDateText(item && item.loginAt);
      var source = trimText(item && item.source) || 'Account Login';
      return '<div class="history-item">' +
        '<div class="history-copy">' +
          '<strong>' + entry + '</strong>' +
          '<span>' + time + '</span>' +
          '<span>' + device + ' · ' + source + '</span>' +
        '</div>' +
        '<span class="history-tag">' + entry + '</span>' +
      '</div>';
    }).join('');
  }

  function renderRecoveryMode() {
    var badge = document.getElementById('recoveryModeBadge');
    var note = document.getElementById('recoveryAssistNote');
    var resetForm = document.getElementById('resetAssistForm');
    var desc = document.getElementById('recoveryPanelDesc');
    if (badge) {
      badge.textContent = state.hasSupabase ? 'Supabase Recovery' : 'Demo Recovery';
    }
    if (desc) {
      desc.textContent = state.hasSupabase
        ? 'Use this section to keep a backup contact email and phone on file. Supabase password reset links always go to your account email and finish on the login page.'
        : 'Even when logged out, you can still use "Forgot Password" from the login page. This section lets you confirm the recovery email in advance and demonstrates the email verification reset flow.';
    }
    if (note) {
      note.hidden = !state.hasSupabase;
    }
    if (resetForm) {
      resetForm.hidden = !!state.hasSupabase;
    }
  }

  function setActivePanel(panelId) {
    var nextId = trimText(panelId);
    var empty = document.getElementById('settingsEmptyState');
    var panels = document.querySelectorAll('.settings-content-panel');
    var navLinks = document.querySelectorAll('.settings-nav-link');
    var matched = false;

    panels.forEach(function (panel) {
      var isActive = !!nextId && panel.id === nextId;
      panel.hidden = !isActive;
      panel.classList.toggle('is-visible', isActive);
      if (isActive) matched = true;
    });

    navLinks.forEach(function (link) {
      var isActive = !!nextId && trimText(link.getAttribute('data-panel')) === nextId;
      link.classList.toggle('is-active', isActive);
    });

    state.activePanel = matched ? nextId : '';
    if (empty) {
      empty.hidden = !!state.activePanel;
    }
  }

  function fillForms() {
    var ids = {
      recoveryEmail: trimText(state.prefs.recoveryEmail),
      recoveryPhone: trimText(state.prefs.recoveryPhone),
      loginAlert: !!state.prefs.loginAlert,
      bookingReminder: !!state.prefs.bookingReminder,
      teachingReminder: !!state.prefs.teachingReminder,
      messageBoardAlert: !!state.prefs.messageBoardAlert,
      consultAlert: !!state.prefs.consultAlert,
      managerAuditAlert: !!state.prefs.managerAuditAlert,
      allowProfileMessages: !!state.prefs.allowProfileMessages,
      showForumClub: !!state.prefs.showForumClub,
      showProfileLocation: !!state.prefs.showProfileLocation,
      hideEmailOnProfile: !!state.prefs.hideEmailOnProfile,
      alwaysAskSystem: state.prefs.alwaysAskSystem !== false,
      preferredEntrySystem: state.prefs.preferredEntrySystem === 'club' ? 'club' : 'user'
    };

    Object.keys(ids).forEach(function (key) {
      var el = document.getElementById(key);
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!ids[key];
      } else {
        el.value = ids[key];
      }
    });

    togglePreferredSystemState();
  }

  function togglePreferredSystemState() {
    var alwaysAsk = document.getElementById('alwaysAskSystem');
    var preferred = document.getElementById('preferredEntrySystem');
    if (!preferred) return;
    preferred.disabled = !!(alwaysAsk && alwaysAsk.checked);
  }

  async function fetchSupabaseResolvedUser() {
    var supabase = getSupabaseClientSafe();
    if (!supabase || !supabase.auth || typeof supabase.auth.getSession !== 'function') return null;
    try {
      var sessionResult = await supabase.auth.getSession();
      var session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
      if (!session || !session.user) return null;
      var authUser = session.user;
      state.authUser = authUser;

      var profile = null;
      try {
        var profileResult = await supabase
          .from('profiles')
          .select('id, email, nickname, role, avatar_url, forum_cover_url, bio, gender, phone, birthday, location, hobbies, created_at, updated_at')
          .eq('id', authUser.id)
          .maybeSingle();
        if (!profileResult.error) {
          profile = profileResult.data || null;
        }
      } catch (error) {}

      var legacy = findLegacyUserByEmail((profile && profile.email) || authUser.email);
      var role = trimText(
        (profile && profile.role) ||
        (authUser.user_metadata && authUser.user_metadata.role) ||
        (legacy && legacy.role) ||
        ((legacy && legacy.isClubManager) ? 'club_manager' : 'member')
      ) || 'member';
      var email = normalizeEmail((profile && profile.email) || authUser.email || (legacy && legacy.email));
      if (!email) return null;

      return {
        id: trimText(authUser.id),
        email: email,
        nickname: trimText(
          (profile && profile.nickname) ||
          (authUser.user_metadata && authUser.user_metadata.nickname) ||
          (legacy && legacy.nickname) ||
          email.split('@')[0] ||
          'User'
        ),
        role: role,
        isClubManager: isClubManagerRole(role),
        avatar: trimText((profile && profile.avatar_url) || (legacy && legacy.avatar)),
        forumCoverUrl: trimText((profile && profile.forum_cover_url) || (legacy && legacy.forumCoverUrl)),
        bio: trimText((profile && profile.bio) || (legacy && legacy.bio)),
        gender: trimText((profile && profile.gender) || (legacy && legacy.gender)),
        phone: trimText((profile && profile.phone) || (legacy && legacy.phone)),
        birthday: trimText((profile && profile.birthday) || (legacy && legacy.birthday)),
        location: trimText((profile && profile.location) || (legacy && legacy.location)),
        hobbies: trimText((profile && profile.hobbies) || (legacy && legacy.hobbies)),
        createdAt: trimText((profile && profile.created_at) || (legacy && legacy.createdAt) || authUser.created_at),
        passwordUpdatedAt: trimText(legacy && legacy.passwordUpdatedAt)
      };
    } catch (error) {
      return null;
    }
  }

  async function syncState() {
    state.hasSupabase = hasSupabaseConfigured();
    state.authUser = null;

    if (state.hasSupabase) {
      var resolved = await fetchSupabaseResolvedUser();
      if (!resolved) {
        window.location.href = 'join.html';
        return false;
      }
      state.user = resolved;
      upsertLegacyUserCache(resolved);
      state.session = buildCompatSession(resolved, (readSession() || {}).entrySystem || 'user');
      syncSessionStore();
    } else {
      state.session = readSession();
      if (!state.session || !trimText(state.session.email)) {
        window.location.href = 'join.html';
        return false;
      }
      var email = normalizeEmail(state.session.email);
      var users = readUsers();
      state.user = users.find(function (item) {
        return normalizeEmail(item && item.email) === email;
      }) || null;
      if (!state.user) {
        window.location.href = 'join.html';
        return false;
      }
    }

    var prefsMap = readPrefsMap();
    var prefsEmail = normalizeEmail(state.user && state.user.email);
    state.prefs = defaultPrefs(state.user, prefsMap[prefsEmail]);
    if (JSON.stringify(prefsMap[prefsEmail] || {}) !== JSON.stringify(state.prefs)) {
      prefsMap[prefsEmail] = state.prefs;
      savePrefsMap(prefsMap);
    }

    state.history = readLoginHistory()
      .filter(function (item) {
        return normalizeEmail(item && item.email) === prefsEmail;
      })
      .sort(function (a, b) {
        return (Date.parse(trimText(b && b.loginAt)) || 0) - (Date.parse(trimText(a && a.loginAt)) || 0);
      });

    return true;
  }

  function rerender() {
    renderManagerState();
    renderHero();
    renderSummary();
    renderRecoveryMode();
    fillForms();
    renderHistory();
    setActivePanel(state.activePanel);
  }

  function updatePassword(newPassword) {
    return updateUserRecord(function (user) {
      user.password = '';
      user.passwordUpdatedAt = new Date().toISOString();
    });
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    var current = trimText(document.getElementById('currentPassword').value);
    var nextPassword = trimText(document.getElementById('newPassword').value);
    var confirm = trimText(document.getElementById('confirmPassword').value);

    if (!current || !nextPassword || !confirm) {
      setStatus('passwordStatus', 'Please complete the current password, new password, and confirmation fields.', 'error');
      return;
    }
    if (nextPassword.length < 6) {
      setStatus('passwordStatus', 'The new password must be at least 6 characters long. 8 or more is recommended.', 'error');
      return;
    }
    if (nextPassword !== confirm) {
      setStatus('passwordStatus', 'The two new password entries do not match.', 'error');
      return;
    }
    if (nextPassword === current) {
      setStatus('passwordStatus', 'The new password cannot be the same as the current password.', 'error');
      return;
    }

    if (state.hasSupabase) {
      var supabase = getSupabaseClientSafe();
      if (!supabase) {
        setStatus('passwordStatus', 'Supabase is not configured yet. Please check js/supabase-config.js.', 'error');
        return;
      }
      setStatus('passwordStatus', 'Verifying your current password and updating Supabase Auth...', 'info');
      try {
        var verifyResult = await supabase.auth.signInWithPassword({
          email: normalizeEmail(state.user && state.user.email),
          password: current
        });
        if (verifyResult.error) {
          setStatus('passwordStatus', mapAuthErrorMessage(verifyResult.error, 'The current password is incorrect. Please try again.'), 'error');
          return;
        }
        var updateResult = await supabase.auth.updateUser({ password: nextPassword });
        if (updateResult.error) {
          setStatus('passwordStatus', mapAuthErrorMessage(updateResult.error, 'Unable to update the password right now.'), 'error');
          return;
        }
        updatePassword(nextPassword);
        event.target.reset();
        await syncState();
        rerender();
        setStatus('passwordStatus', 'Password updated successfully. Supabase Auth and this security page are now in sync.', 'success');
        return;
      } catch (error) {
        setStatus('passwordStatus', 'Unable to update the password right now.', 'error');
        return;
      }
    }

    if (current !== trimText(state.user && state.user.password)) {
      setStatus('passwordStatus', 'The current password is incorrect. Please try again.', 'error');
      return;
    }
    if (!updatePassword(nextPassword)) {
      setStatus('passwordStatus', 'The current account could not be found. Please sign in again and retry.', 'error');
      return;
    }
    event.target.reset();
    await syncState();
    rerender();
    setStatus('passwordStatus', 'Password updated successfully. The login page and settings have been synced.', 'success');
  }

  async function saveRecoveryProfilePhone(phone) {
    if (!state.hasSupabase || !trimText(state.user && state.user.id)) return true;
    var supabase = getSupabaseClientSafe();
    if (!supabase) return false;
    try {
      var result = await supabase
        .from('profiles')
        .update({ phone: phone || null })
        .eq('id', state.user.id);
      return !result.error;
    } catch (error) {
      return false;
    }
  }

  async function handleRecoverySave(event) {
    event.preventDefault();
    var recoveryEmail = normalizeEmail(document.getElementById('recoveryEmail').value);
    var recoveryPhone = trimText(document.getElementById('recoveryPhone').value);
    if (recoveryEmail && !isValidEmail(recoveryEmail)) {
      setStatus('recoveryStatus', 'Please enter a valid backup contact email address.', 'error');
      return;
    }
    state.prefs.recoveryEmail = recoveryEmail || trimText(state.user && state.user.email);
    state.prefs.recoveryPhone = recoveryPhone;
    persistPrefs();

    if (state.hasSupabase) {
      var saved = await saveRecoveryProfilePhone(recoveryPhone);
      if (!saved) {
        setStatus('recoveryStatus', 'Backup contact saved locally, but the phone number could not be synced to Supabase.', 'error');
        await syncState();
        rerender();
        return;
      }
    }

    await syncState();
    rerender();
    setStatus('recoveryStatus', state.hasSupabase
      ? 'Backup contact details saved. Supabase password reset emails will still be sent to your login email address.'
      : 'Recovery options saved. This email can now be used first if you forget your password.', 'success');
  }

  async function handleRecoverySend() {
    var recoveryEmail = normalizeEmail(document.getElementById('recoveryEmail').value) || normalizeEmail(state.user && state.user.email);
    if (state.hasSupabase) {
      var loginEmail = normalizeEmail(state.user && state.user.email);
      if (!isValidEmail(loginEmail)) {
        setStatus('recoveryStatus', 'Your account email is missing. Please log in again.', 'error');
        return;
      }
      var supabase = getSupabaseClientSafe();
      if (!supabase) {
        setStatus('recoveryStatus', 'Supabase is not configured yet. Please check js/supabase-config.js.', 'error');
        return;
      }
      try {
        var result = await supabase.auth.resetPasswordForEmail(loginEmail, {
          redirectTo: buildJoinPageUrl()
        });
        if (result.error) {
          setStatus('recoveryStatus', mapAuthErrorMessage(result.error, 'Unable to send the recovery email right now.'), 'error');
          return;
        }
        state.prefs.recoveryEmail = recoveryEmail || loginEmail;
        persistPrefs();
        setStatus('recoveryStatus', 'Password reset email sent to ' + loginEmail + '. Open the link in that email to finish the reset on the login page.', 'success');
      } catch (error) {
        setStatus('recoveryStatus', 'Unable to send the recovery email right now.', 'error');
      }
      return;
    }

    if (!isValidEmail(recoveryEmail)) {
      setStatus('recoveryStatus', 'Save a valid recovery email before sending the code.', 'error');
      return;
    }
    var code = String(Math.floor(100000 + Math.random() * 900000));
    state.prefs.recoveryEmail = recoveryEmail;
    state.prefs.pendingResetCode = code;
    state.prefs.pendingResetAt = new Date().toISOString();
    persistPrefs();
    await syncState();
    rerender();
    setStatus('recoveryStatus', 'Recovery code sent to ' + recoveryEmail + ' for this browser: ' + code, 'info');
  }

  async function handleRecoveryAssistSubmit(event) {
    event.preventDefault();
    var code = trimText(document.getElementById('resetCodeInput').value);
    var nextPassword = trimText(document.getElementById('resetNewPassword').value);
    var confirm = trimText(document.getElementById('resetConfirmPassword').value);
    if (!trimText(state.prefs.pendingResetCode)) {
      setStatus('recoveryStatus', 'Send the recovery code first.', 'error');
      return;
    }
    if (withinDays(state.prefs.pendingResetAt, 1 / 48) === false) {
      setStatus('recoveryStatus', 'The recovery code has expired. Please send a new one.', 'error');
      return;
    }
    if (code !== trimText(state.prefs.pendingResetCode)) {
      setStatus('recoveryStatus', 'The recovery code is incorrect. Please check it and try again.', 'error');
      return;
    }
    if (nextPassword.length < 6) {
      setStatus('recoveryStatus', 'The new password must be at least 6 characters long.', 'error');
      return;
    }
    if (nextPassword !== confirm) {
      setStatus('recoveryStatus', 'The two new password entries do not match.', 'error');
      return;
    }
    if (!updatePassword(nextPassword)) {
      setStatus('recoveryStatus', 'Password reset could not be completed. Please sign in again and retry.', 'error');
      return;
    }
    state.prefs.pendingResetCode = '';
    state.prefs.pendingResetAt = '';
    persistPrefs();
    event.target.reset();
    await syncState();
    rerender();
    setStatus('recoveryStatus', 'Password reset completed with the recovery code. The login page now uses the new password.', 'success');
  }

  async function bindEvents() {
    var passwordForm = document.getElementById('passwordForm');
    var recoveryForm = document.getElementById('recoveryForm');
    var resetAssistForm = document.getElementById('resetAssistForm');
    var notificationForm = document.getElementById('notificationForm');
    var privacyForm = document.getElementById('privacyForm');
    var sendResetCodeBtn = document.getElementById('sendResetCodeBtn');
    var clearHistoryBtn = document.getElementById('clearLoginHistoryBtn');
    var resetPrefsBtn = document.getElementById('resetSecurityPrefsBtn');
    var logoutBtn = document.getElementById('logoutNowBtn');
    var alwaysAskSystem = document.getElementById('alwaysAskSystem');
    var navLinks = document.querySelectorAll('.settings-nav-link');

    navLinks.forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        var panelId = trimText(link.getAttribute('data-panel'));
        if (!panelId) return;
        setActivePanel(panelId);
      });
    });

    if (alwaysAskSystem) {
      alwaysAskSystem.addEventListener('change', togglePreferredSystemState);
    }

    if (passwordForm) {
      passwordForm.addEventListener('submit', function (event) {
        handlePasswordSubmit(event);
      });
    }

    if (recoveryForm) {
      recoveryForm.addEventListener('submit', function (event) {
        handleRecoverySave(event);
      });
    }

    if (sendResetCodeBtn) {
      sendResetCodeBtn.addEventListener('click', function () {
        handleRecoverySend();
      });
    }

    if (resetAssistForm) {
      resetAssistForm.addEventListener('submit', function (event) {
        handleRecoveryAssistSubmit(event);
      });
    }

    if (notificationForm) {
      notificationForm.addEventListener('submit', function (event) {
        event.preventDefault();
        state.prefs.loginAlert = !!document.getElementById('loginAlert').checked;
        state.prefs.bookingReminder = !!document.getElementById('bookingReminder').checked;
        state.prefs.teachingReminder = !!document.getElementById('teachingReminder').checked;
        state.prefs.messageBoardAlert = !!document.getElementById('messageBoardAlert').checked;
        state.prefs.consultAlert = !!document.getElementById('consultAlert').checked;
        if (state.user && state.user.isClubManager) {
          state.prefs.managerAuditAlert = !!document.getElementById('managerAuditAlert').checked;
          state.prefs.alwaysAskSystem = !!document.getElementById('alwaysAskSystem').checked;
          state.prefs.preferredEntrySystem = document.getElementById('preferredEntrySystem').value === 'club' ? 'club' : 'user';
        } else {
          state.prefs.alwaysAskSystem = true;
          state.prefs.preferredEntrySystem = 'user';
        }
        persistPrefs();
        syncState().then(function (ok) {
          if (!ok) return;
          rerender();
          setStatus('notificationStatus', 'Reminder and login protection settings have been saved.', 'success');
        });
      });
    }

    if (privacyForm) {
      privacyForm.addEventListener('submit', function (event) {
        event.preventDefault();
        state.prefs.allowProfileMessages = !!document.getElementById('allowProfileMessages').checked;
        state.prefs.showForumClub = !!document.getElementById('showForumClub').checked;
        state.prefs.showProfileLocation = !!document.getElementById('showProfileLocation').checked;
        state.prefs.hideEmailOnProfile = !!document.getElementById('hideEmailOnProfile').checked;
        persistPrefs();
        syncState().then(function (ok) {
          if (!ok) return;
          rerender();
          setStatus('privacyStatus', 'Privacy and interaction permissions have been saved.', 'success');
        });
      });
    }

    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', function () {
        if (!window.confirm('Clear the recent login history for the current account?')) return;
        var email = normalizeEmail(state.user && state.user.email);
        var next = readLoginHistory().filter(function (item) {
          return normalizeEmail(item && item.email) !== email;
        });
        saveLoginHistory(next);
        syncState().then(function (ok) {
          if (!ok) return;
          rerender();
          setStatus('actionStatus', 'Recent login history has been cleared.', 'success');
        });
      });
    }

    if (resetPrefsBtn) {
      resetPrefsBtn.addEventListener('click', function () {
        if (!window.confirm('Restore the default security settings? This will not delete your account information.')) return;
        state.prefs = defaultPrefs(state.user, {});
        persistPrefs();
        syncState().then(function (ok) {
          if (!ok) return;
          rerender();
          setStatus('actionStatus', 'Security settings have been restored to their defaults.', 'success');
        });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function () {
        if (!window.confirm('Log out of the current account?')) return;
        var supabase = getSupabaseClientSafe();
        if (state.hasSupabase && supabase && supabase.auth && typeof supabase.auth.signOut === 'function') {
          try {
            await supabase.auth.signOut();
          } catch (error) {}
        }
        try {
          window.localStorage.removeItem(KEYS.session);
        } catch (error) {}
        try {
          window.sessionStorage.removeItem(KEYS.session);
        } catch (error) {}
        clearStoredSupabaseAuth();
        window.location.href = 'join.html';
      });
    }

    window.addEventListener('storage', function (event) {
      if (!event) return;
      if ([KEYS.session, KEYS.users, KEYS.prefs, KEYS.history].indexOf(event.key) === -1) return;
      syncState().then(function (ok) {
        if (!ok) return;
        rerender();
      });
    });
  }

  async function init() {
    if (!await syncState()) return;
    rerender();
    await bindEvents();
    setActivePanel('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
