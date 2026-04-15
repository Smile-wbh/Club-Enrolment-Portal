(function (window) {
  'use strict';

  var THREAD_SELECT = 'id, user_id, subject, category, status, created_at, updated_at, user:profiles(id, email, nickname, role)';
  var MESSAGE_SELECT = 'id, thread_id, sender_id, sender_role, sender_name, message_text, attachments, created_at';
  var DASHBOARD_MESSAGE_LIMIT = 600;

  function trimText(value) {
    return String(value || '').trim();
  }

  function normalizeId(value) {
    return trimText(value);
  }

  function normalizeEmail(value) {
    return trimText(value).toLowerCase();
  }

  function timeValue(value) {
    var text = trimText(value);
    if (!text) return 0;
    var parsed = Date.parse(text);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function formatTime(value) {
    var text = trimText(value);
    if (!text) return '';
    var date = new Date(text);
    return Number.isNaN(date.getTime()) ? text : date.toLocaleString();
  }

  function getSupabaseClientSafe() {
    try {
      return typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    } catch (error) {
      return null;
    }
  }

  function isConfigured() {
    var config = window.APP_CONFIG || {};
    return !!(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && getSupabaseClientSafe());
  }

  function attachmentKind(item) {
    var row = item || {};
    var kind = trimText(row.kind).toLowerCase();
    if (kind) return kind;
    var type = trimText(row.type).toLowerCase();
    if (type.indexOf('image/') === 0) return 'image';
    if (type.indexOf('video/') === 0) return 'video';
    if (trimText(row.url || row.dataUrl)) return 'link';
    return 'file';
  }

  function cloneAttachments(value) {
    return Array.isArray(value) ? value.map(function (item, index) {
      var row = item || {};
      return {
        id: trimText(row.id) || ('admin-att-' + Date.now() + '-' + index),
        kind: attachmentKind(row),
        title: trimText(row.title),
        name: trimText(row.name),
        type: trimText(row.type),
        size: Number(row.size || 0),
        dataUrl: trimText(row.dataUrl),
        url: trimText(row.url)
      };
    }).filter(function (item) {
      return item.dataUrl || item.url || item.name || item.title;
    }) : [];
  }

  function attachmentSummary(value) {
    var attachments = cloneAttachments(value);
    if (!attachments.length) return '';
    if (attachments.length === 1) {
      var only = attachments[0];
      if (only.kind === 'image') return 'Image';
      if (only.kind === 'video') return 'Video';
      if (only.kind === 'link') return 'Link';
      return 'Attachment';
    }
    return 'Attachment +' + (attachments.length - 1);
  }

  function buildSupportActionId(label) {
    var normalized = trimText(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || ('action-' + Date.now());
  }

  function cloneSupportActions(value) {
    return Array.isArray(value) ? value.map(function (item) {
      var row = item || {};
      var kind = trimText(row.kind).toLowerCase() === 'link' ? 'link' : 'reply';
      return {
        id: trimText(row.id) || buildSupportActionId(row.label),
        label: trimText(row.label),
        kind: kind,
        message: trimText(row.message),
        href: trimText(row.href),
        target: trimText(row.target) || '_self',
        style: trimText(row.style).toLowerCase() === 'primary' ? 'primary' : 'secondary'
      };
    }).filter(function (item) {
      if (!item.label) return false;
      if (item.kind === 'link') return !!item.href;
      return !!item.message;
    }) : [];
  }

  function parseSupportMessagePayload(value) {
    var raw = trimText(value);
    if (!raw) {
      return { text: '', actions: [] };
    }

    if (raw.charAt(0) === '{') {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.format === 'portal-support-message-v1') {
          return {
            text: trimText(parsed.text),
            actions: cloneSupportActions(parsed.actions)
          };
        }
      } catch (error) {}
    }

    return {
      text: raw,
      actions: []
    };
  }

  async function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(trimText(reader.result));
      };
      reader.onerror = function () {
        reject(new Error('file_read_failed'));
      };
      reader.readAsDataURL(file);
    });
  }

  async function getCurrentAdminProfile() {
    var client = getSupabaseClientSafe();
    if (!client || !client.auth || typeof client.auth.getSession !== 'function') {
      return null;
    }

    var sessionResult;
    try {
      sessionResult = await client.auth.getSession();
    } catch (error) {
      return null;
    }

    var session = sessionResult && sessionResult.data && sessionResult.data.session;
    var authUser = session && session.user;
    if (!authUser || !normalizeId(authUser.id)) {
      return null;
    }

    var profileResult = await client
      .from('profiles')
      .select('id, email, nickname, role, avatar_url, created_at')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileResult.error) throw profileResult.error;

    var profile = profileResult.data || {};
    var role = trimText(profile.role).toLowerCase();
    return {
      userId: normalizeId(profile.id || authUser.id),
      email: normalizeEmail(profile.email || authUser.email),
      nickname: trimText(profile.nickname) || trimText((authUser.email || '').split('@')[0]) || 'Admin',
      role: role || 'member',
      avatarUrl: trimText(profile.avatar_url),
      createdAt: trimText(profile.created_at),
      isAdmin: role === 'admin'
    };
  }

  function mapUserRow(row) {
    var item = row || {};
    return {
      id: normalizeId(item.id),
      email: normalizeEmail(item.email),
      nickname: trimText(item.nickname) || trimText((item.email || '').split('@')[0]) || 'User',
      role: trimText(item.role) || 'member',
      createdAt: formatTime(item.created_at),
      createdTs: timeValue(item.created_at)
    };
  }

  function mapClubRow(row) {
    var item = row || {};
    return {
      id: normalizeId(item.id),
      name: trimText(item.name),
      slug: trimText(item.slug),
      category: trimText(item.category),
      status: trimText(item.status) || 'draft',
      ownerId: normalizeId(item.owner_id),
      createdAt: formatTime(item.created_at),
      createdTs: timeValue(item.created_at)
    };
  }

  function mapCourseRow(row) {
    var item = row || {};
    var club = item.club || {};
    return {
      id: normalizeId(item.id),
      title: trimText(item.title),
      slug: trimText(item.slug),
      ownerId: normalizeId(item.owner_id),
      clubId: normalizeId(item.club_id),
      clubName: trimText(club.name),
      createdAt: formatTime(item.created_at),
      createdTs: timeValue(item.created_at)
    };
  }

  function mapThreadRow(row, latestMessage) {
    var item = row || {};
    var user = item.user || {};
    var latest = latestMessage || null;
    var parsed = latest ? parseSupportMessagePayload(latest.message_text) : { text: '', actions: [] };
    return {
      id: normalizeId(item.id),
      userId: normalizeId(item.user_id),
      userEmail: normalizeEmail(user.email),
      userName: trimText(user.nickname) || trimText((user.email || '').split('@')[0]) || 'User',
      userRole: trimText(user.role) || 'member',
      subject: trimText(item.subject) || 'Support Request',
      category: trimText(item.category) || 'General',
      status: trimText(item.status) || 'open',
      createdAt: formatTime(item.created_at),
      createdTs: timeValue(item.created_at),
      updatedAt: formatTime(item.updated_at),
      updatedTs: timeValue(item.updated_at),
      lastMessageAt: latest ? formatTime(latest.created_at) : formatTime(item.updated_at),
      lastMessageTs: latest ? timeValue(latest.created_at) : timeValue(item.updated_at),
      lastSenderRole: trimText(latest && latest.sender_role) || '',
      lastMessagePreview: trimText(parsed.text) || attachmentSummary(latest && latest.attachments) || 'No messages yet'
    };
  }

  function mapMessageRow(row) {
    var item = row || {};
    var parsed = parseSupportMessagePayload(item.message_text);
    return {
      id: normalizeId(item.id),
      threadId: normalizeId(item.thread_id),
      senderId: normalizeId(item.sender_id),
      senderRole: trimText(item.sender_role) || 'user',
      senderName: trimText(item.sender_name) || (trimText(item.sender_role) === 'admin' ? 'Support' : 'User'),
      text: trimText(parsed.text),
      actions: cloneSupportActions(parsed.actions),
      attachments: cloneAttachments(item.attachments),
      createdAt: formatTime(item.created_at),
      createdTs: timeValue(item.created_at)
    };
  }

  function buildLatestMessageMap(messages) {
    var map = {};
    (Array.isArray(messages) ? messages : []).forEach(function (row) {
      var threadId = normalizeId(row && row.thread_id);
      if (!threadId || map[threadId]) return;
      map[threadId] = row;
    });
    return map;
  }

  function buildOwnerLookup(clubs, courses) {
    var lookup = {};
    (Array.isArray(clubs) ? clubs : []).forEach(function (club) {
      var ownerId = normalizeId(club && club.ownerId);
      if (!ownerId) return;
      lookup[ownerId] = true;
    });
    (Array.isArray(courses) ? courses : []).forEach(function (course) {
      var ownerId = normalizeId(course && course.ownerId);
      if (!ownerId) return;
      lookup[ownerId] = true;
    });
    return lookup;
  }

  function resolveUserRoleLabel(user, ownerLookup) {
    var item = user || {};
    var role = trimText(item.role).toLowerCase();
    if (role === 'admin') return 'Admin';
    if (role === 'club_manager' || !!(ownerLookup && ownerLookup[normalizeId(item.id)])) {
      return 'Club Manager';
    }
    return 'Member';
  }

  async function fetchAdminDashboard() {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var profile = await getCurrentAdminProfile();
    if (!profile) throw new Error('not_authenticated');
    if (!profile.isAdmin) throw new Error('not_admin');

    var userQuery = client
      .from('profiles')
      .select('id, email, nickname, role, created_at')
      .order('created_at', { ascending: false });

    var clubQuery = client
      .from('clubs')
      .select('id, name, slug, category, status, owner_id, created_at')
      .order('name', { ascending: true });

    var courseQuery = client
      .from('courses')
      .select('id, title, slug, club_id, owner_id, created_at, club:clubs(id, name, slug)')
      .order('title', { ascending: true });

    var threadQuery = client
      .from('support_threads')
      .select(THREAD_SELECT)
      .order('updated_at', { ascending: false });

    var messageQuery = client
      .from('support_messages')
      .select(MESSAGE_SELECT)
      .order('created_at', { ascending: false })
      .limit(DASHBOARD_MESSAGE_LIMIT);

    var results = await Promise.all([userQuery, clubQuery, courseQuery, threadQuery, messageQuery]);
    var userResult = results[0] || {};
    var clubResult = results[1] || {};
    var courseResult = results[2] || {};
    var threadResult = results[3] || {};
    var messageResult = results[4] || {};

    if (userResult.error) throw userResult.error;
    if (clubResult.error) throw clubResult.error;
    if (courseResult.error) throw courseResult.error;
    if (threadResult.error) throw threadResult.error;
    if (messageResult.error) throw messageResult.error;

    var users = (userResult.data || []).map(mapUserRow);
    var clubs = (clubResult.data || []).map(mapClubRow);
    var courses = (courseResult.data || []).map(mapCourseRow);
    var rawMessages = Array.isArray(messageResult.data) ? messageResult.data : [];
    var latestByThread = buildLatestMessageMap(rawMessages);
    var ownerLookup = buildOwnerLookup(clubs, courses);

    users = users.map(function (user) {
      return Object.assign({}, user, {
        roleLabel: resolveUserRoleLabel(user, ownerLookup)
      });
    });

    return {
      profile: profile,
      users: users,
      clubs: clubs,
      courses: courses,
      threads: (threadResult.data || []).map(function (row) {
        return mapThreadRow(row, latestByThread[normalizeId(row && row.id)]);
      }).sort(function (a, b) {
        return (b.lastMessageTs || b.updatedTs || 0) - (a.lastMessageTs || a.updatedTs || 0);
      })
    };
  }

  async function fetchSupportThreadMessages(threadId) {
    var client = getSupabaseClientSafe();
    if (!client || !normalizeId(threadId)) return [];

    var profile = await getCurrentAdminProfile();
    if (!profile) throw new Error('not_authenticated');
    if (!profile.isAdmin) throw new Error('not_admin');

    var result = await client
      .from('support_messages')
      .select(MESSAGE_SELECT)
      .eq('thread_id', normalizeId(threadId))
      .order('created_at', { ascending: true });

    if (result.error) throw result.error;
    return (result.data || []).map(mapMessageRow);
  }

  async function updateSupportThreadStatus(threadId, status) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var profile = await getCurrentAdminProfile();
    if (!profile) throw new Error('not_authenticated');
    if (!profile.isAdmin) throw new Error('not_admin');

    var nextStatus = trimText(status) || 'open';
    var result = await client
      .from('support_threads')
      .update({ status: nextStatus })
      .eq('id', normalizeId(threadId))
      .select('id, user_id, subject, category, status, created_at, updated_at, user:profiles(id, email, nickname, role)')
      .single();

    if (result.error) throw result.error;
    return mapThreadRow(result.data, null);
  }

  async function sendSupportReply(payload, adminProfile) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var profile = adminProfile || await getCurrentAdminProfile();
    if (!profile) throw new Error('not_authenticated');
    if (!profile.isAdmin) throw new Error('not_admin');

    var threadId = normalizeId(payload && payload.threadId);
    var text = trimText(payload && payload.text);
    var attachments = cloneAttachments(payload && payload.attachments);
    var nextStatus = trimText(payload && payload.status) || 'open';
    if (!threadId) throw new Error('missing_thread_id');
    if (!text && !attachments.length) throw new Error('missing_support_content');

    var insertResult = await client
      .from('support_messages')
      .insert({
        thread_id: threadId,
        sender_id: normalizeId(profile.userId),
        sender_role: 'admin',
        sender_name: trimText(profile.nickname) || trimText(profile.email) || 'Platform Admin',
        message_text: text || '',
        attachments: attachments
      })
      .select(MESSAGE_SELECT)
      .single();

    if (insertResult.error) throw insertResult.error;

    var updateResult = await client
      .from('support_threads')
      .update({ status: nextStatus })
      .eq('id', threadId)
      .select('id, user_id, subject, category, status, created_at, updated_at, user:profiles(id, email, nickname, role)')
      .single();

    if (updateResult.error) throw updateResult.error;

    return {
      message: mapMessageRow(insertResult.data),
      thread: mapThreadRow(updateResult.data, insertResult.data)
    };
  }

  function unsubscribeChannel(client, channel) {
    if (!channel) return;
    try {
      if (client && typeof client.removeChannel === 'function') {
        client.removeChannel(channel);
        return;
      }
    } catch (error) {}
    try {
      if (typeof channel.unsubscribe === 'function') {
        channel.unsubscribe();
      }
    } catch (error) {}
  }

  async function subscribeAdminDashboard(handlers, adminProfile) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var profile = adminProfile || await getCurrentAdminProfile();
    if (!profile) throw new Error('not_authenticated');
    if (!profile.isAdmin) throw new Error('not_admin');

    var options = handlers || {};
    var channel = client.channel('admin-dashboard-live-' + normalizeId(profile.userId) + '-' + Date.now());
    var notifyChange = function (payload) {
      if (typeof options.onChange === 'function') {
        options.onChange(payload || {});
      }
    };

    [
      'profiles',
      'clubs',
      'courses',
      'support_threads',
      'support_messages'
    ].forEach(function (tableName) {
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: tableName
      }, notifyChange);
    });

    channel.subscribe(function (status) {
      if (typeof options.onStatus === 'function') {
        options.onStatus(status);
      }
    });

    return {
      channel: channel,
      unsubscribe: function () {
        unsubscribeChannel(client, channel);
      }
    };
  }

  function mapSupportError(error) {
    var text = trimText(error && (error.message || error.details || error.hint || error.code)).toLowerCase();
    if (text.indexOf('not_authenticated') > -1) return 'Please sign in with your admin account first.';
    if (text.indexOf('not_admin') > -1) return 'This account is signed in, but it does not have admin access.';
    if (text.indexOf('missing_thread_id') > -1) return 'Please choose a support conversation first.';
    if (text.indexOf('missing_support_content') > -1) return 'Please type a reply or attach a file before sending.';
    if (text.indexOf('row-level security') > -1) return 'This account does not currently have permission to manage support data.';
    if (text.indexOf('file_read_failed') > -1) return 'That attachment could not be read right now. Please try another file.';
    return trimText(error && error.message) || 'Unable to load admin data right now.';
  }

  window.platformAdminSupabase = {
    isConfigured: isConfigured,
    getCurrentAdminProfile: getCurrentAdminProfile,
    fetchAdminDashboard: fetchAdminDashboard,
    fetchSupportThreadMessages: fetchSupportThreadMessages,
    updateSupportThreadStatus: updateSupportThreadStatus,
    sendSupportReply: sendSupportReply,
    subscribeAdminDashboard: subscribeAdminDashboard,
    readFileAsDataUrl: readFileAsDataUrl,
    mapSupportError: mapSupportError
  };
})(window);
