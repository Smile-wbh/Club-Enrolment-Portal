(function (window) {
  'use strict';

  function trimText(value) {
    return String(value || '').trim();
  }

  function normalizeId(value) {
    return trimText(value);
  }

  function normalizeEmail(value) {
    return trimText(value).toLowerCase();
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

  function cloneAttachments(value) {
    return Array.isArray(value) ? value.map(function (item) {
      var row = item || {};
      return {
        id: trimText(row.id) || ('att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
        name: trimText(row.name),
        type: trimText(row.type),
        size: Number(row.size || 0),
        dataUrl: trimText(row.dataUrl)
      };
    }) : [];
  }

  function supportUserKey(email) {
    var normalized = normalizeEmail(email);
    return normalized ? ('user:' + normalized) : '';
  }

  function mapSupportMessageRow(row, currentEmail) {
    var item = row || {};
    return {
      id: normalizeId(item.id),
      role: trimText(item.sender_role) || 'user',
      senderName: trimText(item.sender_name),
      text: trimText(item.message_text),
      userId: supportUserKey(currentEmail),
      userEmail: normalizeEmail(currentEmail),
      createdAt: formatTime(item.created_at),
      createdTs: timeValue(item.created_at),
      attachments: cloneAttachments(item.attachments),
      threadId: normalizeId(item.thread_id),
      threadStatus: trimText(item.thread_status),
      threadSubject: trimText(item.thread_subject),
      threadCategory: trimText(item.thread_category)
    };
  }

  function mapMessageBoardRow(row) {
    var item = row || {};
    return {
      id: normalizeId(item.id),
      targetUserId: normalizeId(item.target_user_id),
      targetEmail: normalizeEmail(item.target_email),
      targetName: trimText(item.target_name),
      fromUserId: normalizeId(item.from_user_id),
      fromEmail: normalizeEmail(item.from_email),
      fromName: trimText(item.from_name),
      text: trimText(item.message_text),
      source: trimText(item.source) || 'forum-profile',
      createdAt: formatTime(item.created_at),
      createdTs: timeValue(item.created_at)
    };
  }

  function buildSupportSubject(text) {
    var value = trimText(text).replace(/\s+/g, ' ');
    if (!value) return 'Support Request';
    return value.length > 60 ? (value.slice(0, 60) + '...') : value;
  }

  async function resolveActiveSupportThread(client, currentUserId, subject, category) {
    var threadResult = await client
      .from('support_threads')
      .select('id, status, subject, category, updated_at')
      .eq('user_id', normalizeId(currentUserId))
      .order('updated_at', { ascending: false })
      .limit(1);

    if (threadResult.error) throw threadResult.error;

    var current = Array.isArray(threadResult.data) && threadResult.data.length ? threadResult.data[0] : null;
    if (!current || /^(resolved|closed)$/i.test(trimText(current.status))) {
      var createResult = await client
        .from('support_threads')
        .insert({
          user_id: normalizeId(currentUserId),
          subject: buildSupportSubject(subject),
          category: trimText(category) || null,
          status: 'open'
        })
        .select('id, status, subject, category, updated_at')
        .single();

      if (createResult.error) throw createResult.error;
      return createResult.data || null;
    }

    var updatePatch = {
      status: 'waiting_reply'
    };
    if (!trimText(current.subject)) updatePatch.subject = buildSupportSubject(subject);
    if (!trimText(current.category) && trimText(category)) updatePatch.category = trimText(category);

    var updateResult = await client
      .from('support_threads')
      .update(updatePatch)
      .eq('id', normalizeId(current.id))
      .select('id, status, subject, category, updated_at')
      .single();

    if (updateResult.error) throw updateResult.error;
    return updateResult.data || current;
  }

  async function fetchMySupportMessages(currentUserId, currentEmail) {
    var client = getSupabaseClientSafe();
    if (!client) return [];

    var threadResult = await client
      .from('support_threads')
      .select('id, subject, category, status, created_at, updated_at')
      .eq('user_id', normalizeId(currentUserId))
      .order('updated_at', { ascending: false });

    if (threadResult.error) throw threadResult.error;

    var threads = Array.isArray(threadResult.data) ? threadResult.data : [];
    var threadMap = {};
    var threadIds = threads.map(function (row) {
      var id = normalizeId(row && row.id);
      if (!id) return '';
      threadMap[id] = row || {};
      return id;
    }).filter(Boolean);

    if (!threadIds.length) return [];

    var messageResult = await client
      .from('support_messages')
      .select('id, thread_id, sender_id, sender_role, sender_name, message_text, attachments, created_at')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: true });

    if (messageResult.error) throw messageResult.error;

    return (Array.isArray(messageResult.data) ? messageResult.data : [])
      .map(function (row) {
        var thread = threadMap[normalizeId(row && row.thread_id)] || {};
        return mapSupportMessageRow({
          id: row.id,
          thread_id: row.thread_id,
          sender_role: row.sender_role,
          sender_name: row.sender_name,
          message_text: row.message_text,
          attachments: row.attachments,
          created_at: row.created_at,
          thread_status: thread.status,
          thread_subject: thread.subject,
          thread_category: thread.category
        }, currentEmail);
      })
      .sort(function (a, b) {
        return (a.createdTs || 0) - (b.createdTs || 0);
      });
  }

  async function sendSupportMessage(payload, currentUserId, currentEmail, currentName) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var text = trimText(payload && payload.text);
    var attachments = cloneAttachments(payload && payload.attachments);
    if (!text && !attachments.length) {
      throw new Error('missing_support_content');
    }

    var thread = await resolveActiveSupportThread(
      client,
      currentUserId,
      text,
      trimText(payload && payload.category) || 'General'
    );

    var insertResult = await client
      .from('support_messages')
      .insert({
        thread_id: normalizeId(thread && thread.id),
        sender_id: normalizeId(currentUserId),
        sender_role: 'user',
        sender_name: trimText(currentName) || trimText(currentEmail) || 'User',
        message_text: text || '',
        attachments: attachments
      })
      .select('id, thread_id, sender_role, sender_name, message_text, attachments, created_at')
      .single();

    if (insertResult.error) throw insertResult.error;

    return mapSupportMessageRow({
      id: insertResult.data.id,
      thread_id: insertResult.data.thread_id,
      sender_role: insertResult.data.sender_role,
      sender_name: insertResult.data.sender_name,
      message_text: insertResult.data.message_text,
      attachments: insertResult.data.attachments,
      created_at: insertResult.data.created_at,
      thread_status: 'waiting_reply',
      thread_subject: thread && thread.subject,
      thread_category: thread && thread.category
    }, currentEmail);
  }

  async function clearMySupportThreads(currentUserId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var result = await client
      .from('support_threads')
      .delete()
      .eq('user_id', normalizeId(currentUserId));
    if (result.error) throw result.error;
    return true;
  }

  async function fetchMyMessageBoard(currentUserId) {
    var client = getSupabaseClientSafe();
    if (!client) return [];

    var userId = normalizeId(currentUserId);
    var inboxResult = await client
      .from('message_board_entries')
      .select('id, target_user_id, target_email, target_name, from_user_id, from_email, from_name, source, message_text, created_at')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false });

    if (inboxResult.error) throw inboxResult.error;

    var sentResult = await client
      .from('message_board_entries')
      .select('id, target_user_id, target_email, target_name, from_user_id, from_email, from_name, source, message_text, created_at')
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false });

    if (sentResult.error) throw sentResult.error;

    var seen = {};
    var merged = [];
    [inboxResult.data, sentResult.data].forEach(function (list) {
      (Array.isArray(list) ? list : []).forEach(function (row) {
        var id = normalizeId(row && row.id);
        if (!id || seen[id]) return;
        seen[id] = true;
        merged.push(row);
      });
    });

    return merged
      .map(mapMessageBoardRow)
      .sort(function (a, b) {
        return (b.createdTs || 0) - (a.createdTs || 0);
      });
  }

  async function sendMessageBoardEntry(payload) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var targetUserId = normalizeId(payload && payload.targetUserId);
    var result;

    if (targetUserId) {
      result = await client.rpc('create_message_board_entry_by_user', {
        p_target_user_id: targetUserId,
        p_target_name: trimText(payload && payload.targetName) || null,
        p_message_text: trimText(payload && payload.text),
        p_source: trimText(payload && payload.source) || 'forum-profile'
      });
      if (result.error && /create_message_board_entry_by_user/i.test(trimText(result.error.message))) {
        result = null;
      }
    } else {
      result = null;
    }

    if (!result) {
      result = await client.rpc('create_message_board_entry', {
        p_target_email: trimText(payload && payload.targetEmail) || null,
        p_target_name: trimText(payload && payload.targetName) || null,
        p_message_text: trimText(payload && payload.text),
        p_source: trimText(payload && payload.source) || 'forum-profile'
      });
    }

    if (result.error) throw result.error;
    return mapMessageBoardRow(result.data || {});
  }

  function mapSupportError(error) {
    var text = trimText(error && error.message).toLowerCase();
    if (text.indexOf('not_authenticated') > -1) return 'Please log in again before continuing.';
    if (text.indexOf('profile_not_found') > -1) return 'Your profile could not be found in Supabase yet.';
    if (text.indexOf('message_target_not_found') > -1) return 'This recipient could not be matched to a registered account.';
    if (text.indexOf('self_message_not_allowed') > -1) return 'You cannot send a message to yourself.';
    if (text.indexOf('missing_message_text') > -1) return 'Please enter a message before sending.';
    if (text.indexOf('missing_support_content') > -1) return 'Please enter a message or attach a file before sending.';
    return trimText(error && error.message) || 'Unable to sync this support action to Supabase right now.';
  }

  window.clubSupportSupabase = {
    isConfigured: isConfigured,
    fetchMySupportMessages: fetchMySupportMessages,
    sendSupportMessage: sendSupportMessage,
    clearMySupportThreads: clearMySupportThreads,
    fetchMyMessageBoard: fetchMyMessageBoard,
    sendMessageBoardEntry: sendMessageBoardEntry,
    mapSupportError: mapSupportError,
    normalizeId: normalizeId
  };
})(window);
