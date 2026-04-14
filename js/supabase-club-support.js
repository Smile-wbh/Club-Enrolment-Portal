(function (window) {
  'use strict';

  var THREAD_SELECT = 'id, club_id, user_id, user_email, user_name, status, last_message_at, last_message_preview, last_message_sender_role, user_last_read_at, club_last_read_at, created_at, updated_at, club:clubs(id, slug, name, owner_id), profile:profiles(id, email, nickname, avatar_url)';
  var MESSAGE_SELECT = 'id, thread_id, club_id, sender_user_id, sender_role, sender_name, sender_email, message_text, attachments, created_at';

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

  function getSupabaseClientSafe() {
    try {
      return typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    } catch (error) {
      return null;
    }
  }

  function getStorageService() {
    return window.clubStorageSupabase || null;
  }

  function isConfigured() {
    var config = window.APP_CONFIG || {};
    return !!(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && getSupabaseClientSafe());
  }

  function isMissingClubSupportSchema(error) {
    var text = trimText(error && (error.message || error.details || error.hint || error.code)).toLowerCase();
    return text.indexOf('club_support_threads') > -1
      || text.indexOf('club_support_messages') > -1
      || text.indexOf('create_club_support_message_as_user') > -1
      || text.indexOf('create_club_support_message_as_owner') > -1
      || text.indexOf('get_my_club_support_unread_counts') > -1
      || text.indexOf('mark_club_support_thread_read') > -1;
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
        id: trimText(row.id) || ('club-att-' + Date.now() + '-' + index),
        kind: attachmentKind(row),
        title: trimText(row.title),
        name: trimText(row.name),
        type: trimText(row.type),
        size: Number(row.size || 0),
        url: trimText(row.url),
        dataUrl: trimText(row.dataUrl)
      };
    }).filter(function (item) {
      return item.url || item.dataUrl || item.name || item.title;
    }) : [];
  }

  function attachmentSummary(attachments) {
    var items = cloneAttachments(attachments);
    if (!items.length) return '';
    if (items.length === 1) {
      if (items[0].kind === 'image') return 'Image';
      if (items[0].kind === 'video') return 'Video';
      return 'Attachment';
    }
    return 'Attachment +' + (items.length - 1);
  }

  function mapThreadRow(row) {
    var item = row || {};
    var club = item.club || {};
    var profile = item.profile || {};
    var lastMessageAt = trimText(item.last_message_at);
    var clubLastReadAt = trimText(item.club_last_read_at);
    var userLastReadAt = trimText(item.user_last_read_at);
    var lastSenderRole = trimText(item.last_message_sender_role).toLowerCase();
    return {
      id: normalizeId(item.id),
      clubId: normalizeId(item.club_id),
      userId: normalizeId(item.user_id),
      userEmail: normalizeEmail(item.user_email || profile.email),
      userName: trimText(item.user_name || profile.nickname) || trimText((profile.email || '').split('@')[0]) || 'Member',
      status: trimText(item.status) || 'open',
      lastMessageAt: lastMessageAt,
      lastMessageTs: timeValue(lastMessageAt),
      lastMessagePreview: trimText(item.last_message_preview),
      lastMessageSenderRole: lastSenderRole || 'user',
      clubLastReadAt: clubLastReadAt,
      userLastReadAt: userLastReadAt,
      createdAt: trimText(item.created_at),
      updatedAt: trimText(item.updated_at),
      club: {
        id: normalizeId(club.id),
        slug: trimText(club.slug),
        name: trimText(club.name),
        ownerId: normalizeId(club.owner_id)
      },
      profile: {
        id: normalizeId(profile.id),
        email: normalizeEmail(profile.email),
        nickname: trimText(profile.nickname),
        avatarUrl: trimText(profile.avatar_url)
      },
      hasUnreadForClub: lastSenderRole === 'user' && timeValue(lastMessageAt) > timeValue(clubLastReadAt),
      hasUnreadForUser: lastSenderRole === 'club' && timeValue(lastMessageAt) > timeValue(userLastReadAt)
    };
  }

  function mapMessageRow(row) {
    var item = row || {};
    return {
      id: normalizeId(item.id),
      threadId: normalizeId(item.thread_id),
      clubId: normalizeId(item.club_id),
      senderUserId: normalizeId(item.sender_user_id),
      senderRole: trimText(item.sender_role) || 'user',
      senderName: trimText(item.sender_name),
      senderEmail: normalizeEmail(item.sender_email),
      text: trimText(item.message_text),
      attachments: cloneAttachments(item.attachments),
      createdAt: trimText(item.created_at),
      createdTs: timeValue(item.created_at)
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

  async function getCurrentProfile() {
    var client = getSupabaseClientSafe();
    if (!client || !client.auth || typeof client.auth.getUser !== 'function') {
      return null;
    }

    var authResult;
    try {
      authResult = await client.auth.getUser();
    } catch (error) {
      return null;
    }

    var authUser = authResult && authResult.data && authResult.data.user;
    if (!authUser || !normalizeId(authUser.id)) {
      return null;
    }

    var profileResult = await client
      .from('profiles')
      .select('id, email, nickname, avatar_url, role')
      .eq('id', authUser.id)
      .maybeSingle();

    var profile = profileResult && profileResult.data ? profileResult.data : null;
    return {
      userId: normalizeId((profile && profile.id) || authUser.id),
      email: normalizeEmail((profile && profile.email) || authUser.email),
      nickname: trimText(profile && profile.nickname) || trimText((authUser.email || '').split('@')[0]) || 'User',
      avatarUrl: trimText(profile && profile.avatar_url),
      role: trimText(profile && profile.role)
    };
  }

  async function uploadAttachment(file, userId) {
    var normalizedUserId = normalizeId(userId);
    if (!normalizedUserId) throw new Error('not_authenticated');

    var storage = getStorageService();
    var type = trimText(file && file.type).toLowerCase();
    if (storage && typeof storage.isConfigured === 'function' && storage.isConfigured()) {
      var uploaded = type.indexOf('video/') === 0
        ? await storage.uploadMessageVideo(file, normalizedUserId)
        : await storage.uploadMessageImage(file, normalizedUserId);
      return {
        id: 'club-att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        kind: type.indexOf('video/') === 0 ? 'video' : 'image',
        name: trimText(file && file.name),
        title: trimText(file && file.name),
        type: trimText(file && file.type),
        size: Number(file && file.size || 0),
        url: trimText(uploaded && uploaded.publicUrl)
      };
    }

    return {
      id: 'club-att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      kind: type.indexOf('video/') === 0 ? 'video' : 'image',
      name: trimText(file && file.name),
      title: trimText(file && file.name),
      type: trimText(file && file.type),
      size: Number(file && file.size || 0),
      dataUrl: await readFileAsDataUrl(file)
    };
  }

  async function fetchUserThread(clubId) {
    var client = getSupabaseClientSafe();
    var profile = await getCurrentProfile();
    if (!client || !profile || !normalizeId(clubId)) return null;

    var result = await client
      .from('club_support_threads')
      .select(THREAD_SELECT)
      .eq('club_id', normalizeId(clubId))
      .eq('user_id', profile.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) {
      if (isMissingClubSupportSchema(result.error)) return null;
      throw result.error;
    }

    return result.data ? mapThreadRow(result.data) : null;
  }

  async function fetchOwnerThreads(clubId) {
    var client = getSupabaseClientSafe();
    if (!client || !normalizeId(clubId)) return [];

    var result = await client
      .from('club_support_threads')
      .select(THREAD_SELECT)
      .eq('club_id', normalizeId(clubId))
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (result.error) {
      if (isMissingClubSupportSchema(result.error)) return [];
      throw result.error;
    }

    return (result.data || []).map(mapThreadRow);
  }

  async function fetchThreadMessages(threadId) {
    var client = getSupabaseClientSafe();
    if (!client || !normalizeId(threadId)) return [];

    var result = await client
      .from('club_support_messages')
      .select(MESSAGE_SELECT)
      .eq('thread_id', normalizeId(threadId))
      .order('created_at', { ascending: true });

    if (result.error) {
      if (isMissingClubSupportSchema(result.error)) return [];
      throw result.error;
    }

    return (result.data || []).map(mapMessageRow);
  }

  async function sendUserMessage(clubId, text, attachments) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var result = await client.rpc('create_club_support_message_as_user', {
      p_club_id: normalizeId(clubId),
      p_message_text: trimText(text) || null,
      p_attachments: cloneAttachments(attachments)
    });

    if (result.error) throw result.error;
    return mapMessageRow(result.data);
  }

  async function sendOwnerMessage(threadId, text, attachments) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var result = await client.rpc('create_club_support_message_as_owner', {
      p_thread_id: normalizeId(threadId),
      p_message_text: trimText(text) || null,
      p_attachments: cloneAttachments(attachments)
    });

    if (result.error) throw result.error;
    return mapMessageRow(result.data);
  }

  async function markThreadRead(threadId) {
    var client = getSupabaseClientSafe();
    if (!client || !normalizeId(threadId)) return null;

    var result = await client.rpc('mark_club_support_thread_read', {
      p_thread_id: normalizeId(threadId)
    });

    if (result.error) {
      if (isMissingClubSupportSchema(result.error)) return null;
      throw result.error;
    }

    return result.data ? mapThreadRow(result.data) : null;
  }

  async function fetchOwnerUnreadCounts(clubIds) {
    var client = getSupabaseClientSafe();
    if (!client) return {};

    var normalizedIds = Array.isArray(clubIds)
      ? clubIds.map(normalizeId).filter(Boolean)
      : [];

    var result = await client.rpc('get_my_club_support_unread_counts', {
      p_club_ids: normalizedIds.length ? normalizedIds : null
    });

    if (result.error) {
      if (isMissingClubSupportSchema(result.error)) return {};
      throw result.error;
    }

    return (result.data || []).reduce(function (acc, row) {
      var clubId = normalizeId(row && row.club_id);
      if (!clubId) return acc;
      acc[clubId] = Number(row && row.unread_count || 0);
      return acc;
    }, {});
  }

  function mapSupportError(error) {
    var text = trimText(error && error.message).toLowerCase();
    if (text.indexOf('not_authenticated') > -1) return 'Please sign in before sending a message to the club.';
    if (text.indexOf('missing_club_id') > -1 || text.indexOf('club_not_found') > -1) return 'This club could not be matched for support chat.';
    if (text.indexOf('missing_thread_id') > -1 || text.indexOf('thread_not_found') > -1) return 'This conversation could not be opened. Please refresh and try again.';
    if (text.indexOf('missing_message_content') > -1) return 'Please enter a message or attach an image before sending.';
    if (text.indexOf('row-level security') > -1 || text.indexOf('not_authorized') > -1) return 'Your account does not currently have permission to access this club chat.';
    if (text.indexOf('club_support_threads') > -1 || text.indexOf('club_support_messages') > -1) {
      return 'Club support chat is not ready in Supabase yet. Please run the latest club support SQL first.';
    }
    if (text.indexOf('file_read_failed') > -1) return 'This attachment could not be read right now. Please try another file.';
    return trimText(error && error.message) || 'Unable to sync club chat right now.';
  }

  window.clubSupportSupabase = {
    isConfigured: isConfigured,
    getCurrentProfile: getCurrentProfile,
    fetchUserThread: fetchUserThread,
    fetchOwnerThreads: fetchOwnerThreads,
    fetchThreadMessages: fetchThreadMessages,
    sendUserMessage: sendUserMessage,
    sendOwnerMessage: sendOwnerMessage,
    markThreadRead: markThreadRead,
    fetchOwnerUnreadCounts: fetchOwnerUnreadCounts,
    uploadAttachment: uploadAttachment,
    attachmentSummary: attachmentSummary,
    mapSupportError: mapSupportError
  };
})(window);
