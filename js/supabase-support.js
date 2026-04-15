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

  function isMissingCourseBookingPaymentColumn(error) {
    var text = trimText(error && (error.message || error.details || error.hint || error.code));
    return /order_id|payment_status|payment_method|payer_email|\bpayable_amount\b/i.test(text);
  }

  function cloneAttachments(value) {
    return Array.isArray(value) ? value.map(function (item) {
      var row = item || {};
      return {
        id: trimText(row.id) || ('att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
        kind: trimText(row.kind),
        title: trimText(row.title),
        name: trimText(row.name),
        type: trimText(row.type),
        size: Number(row.size || 0),
        dataUrl: trimText(row.dataUrl),
        url: trimText(row.url)
      };
    }) : [];
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

  function attachmentSummary(value) {
    var items = cloneAttachments(value);
    if (!items.length) return '';
    var labels = items.map(function (item) {
      var kind = attachmentKind(item);
      if (kind === 'image') return 'Image';
      if (kind === 'video') return 'Video';
      if (kind === 'link') return 'Link';
      return 'Attachment';
    });
    return labels.length === 1 ? labels[0] : (labels[0] + ' +' + (labels.length - 1));
  }

  function parseMessagePayload(value, fallbackAttachments) {
    var raw = trimText(value);
    var attachments = cloneAttachments(fallbackAttachments);
    if (!raw) {
      return {
        text: '',
        attachments: attachments
      };
    }

    if (raw.charAt(0) === '{') {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && (parsed.format === 'portal-message-v1' || Array.isArray(parsed.attachments))) {
          return {
            text: trimText(parsed.text),
            attachments: cloneAttachments(parsed.attachments)
          };
        }
      } catch (error) {}
    }

    return {
      text: raw,
      attachments: attachments
    };
  }

  function serializeMessagePayload(text, attachments) {
    var cleanText = trimText(text);
    var cleanAttachments = cloneAttachments(attachments);
    if (!cleanAttachments.length) return cleanText;
    return JSON.stringify({
      format: 'portal-message-v1',
      text: cleanText,
      attachments: cleanAttachments.map(function (item) {
        return {
          id: item.id,
          kind: attachmentKind(item),
          title: trimText(item.title),
          name: trimText(item.name),
          type: trimText(item.type),
          size: Number(item.size || 0),
          url: trimText(item.url),
          dataUrl: trimText(item.dataUrl)
        };
      })
    });
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
      return {
        text: '',
        actions: []
      };
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

  function serializeSupportMessagePayload(text, actions) {
    var cleanText = trimText(text);
    var cleanActions = cloneSupportActions(actions);
    if (!cleanActions.length) return cleanText;
    return JSON.stringify({
      format: 'portal-support-message-v1',
      text: cleanText,
      actions: cleanActions.map(function (item) {
        return {
          id: item.id,
          label: item.label,
          kind: item.kind,
          message: item.message,
          href: item.href,
          target: item.target,
          style: item.style
        };
      })
    });
  }

  function supportUserKey(email) {
    var normalized = normalizeEmail(email);
    return normalized ? ('user:' + normalized) : '';
  }

  function mapSupportMessageRow(row, currentEmail) {
    var item = row || {};
    var parsed = parseSupportMessagePayload(item.message_text);
    return {
      id: normalizeId(item.id),
      role: trimText(item.sender_role) || 'user',
      senderName: trimText(item.sender_name),
      text: trimText(parsed.text),
      actions: cloneSupportActions(parsed.actions),
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
    var parsed = parseMessagePayload(item.message_text, item.attachments);
    var text = trimText(parsed.text);
    var attachments = cloneAttachments(parsed.attachments);
    return {
      id: normalizeId(item.id),
      targetUserId: normalizeId(item.target_user_id),
      targetEmail: normalizeEmail(item.target_email),
      targetName: trimText(item.target_name),
      fromUserId: normalizeId(item.from_user_id),
      fromEmail: normalizeEmail(item.from_email),
      fromName: trimText(item.from_name),
      text: text,
      previewText: text || attachmentSummary(attachments),
      attachments: attachments,
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

  var SUPPORT_HUMAN_HANDOFF_REPLY = '我们已收到您的问题，将转到人工客服，请稍等。';
  var SUPPORT_ATTACHMENT_ONLY_REPLY = 'Thanks, we received your attachment. A support agent will review it shortly. If possible, please reply with the club or course name, the date and time, and a short note about the issue.';
  var SUPPORT_DEFAULT_REPLY = 'Thanks for your message. I can help with bookings, locations, course details, payments, and support history. If you share the club or course name and the date or time you care about, I can narrow it down right away.';
  var SUPPORT_AUTO_REPLY_CACHE_TTL = 5 * 60 * 1000;
  var SUPPORT_DYNAMIC_CONTEXT_CACHE_TTL = 2 * 60 * 1000;
  var SUPPORT_HUMAN_HANDOFF_KEYWORDS = Object.freeze([
    'human',
    'agent',
    'representative',
    'customer service',
    'support staff',
    'live support',
    'manual',
    'manual mode',
    'manual support',
    'human support',
    'real person',
    'switch to manual mode',
    '人工',
    '人工客服',
    '转人工',
    '转接人工'
  ]);
  var SUPPORT_CLUB_SELECT = 'id, slug, name, category, mode, location, map_link, time_text, fee_text, seats, description, venue_info, what_we_do, audience, training_plan, notes, tags, status';
  var SUPPORT_COURSE_SELECT = 'id, slug, club_id, title, level, mode, time_text, schedule, location, map_link, fee_text, seats, description, detail, coach_name, coach_title, coach_bio, learning_points, audience_tips, notes_list, created_at, club:clubs(name, slug, category, location, mode)';
  var SUPPORT_COURSE_SELECT_LEGACY = 'id, slug, club_id, title, level, mode, time_text, schedule, location, map_link, fee_text, seats, description, detail, coach_name, coach_title, coach_bio, learning_points, audience_tips, notes_list, created_at, club:clubs(name, slug, category)';
  var SUPPORT_FORUM_POST_SELECT = 'id, title, content, post_type, channel, likes_count, created_at, club:clubs(name, slug)';
  var supportAutoReplyRulesCache = null;
  var supportAutoReplyRulesFetchedAt = 0;
  var supportDynamicContextCache = null;
  var supportDynamicContextFetchedAt = 0;
  var SUPPORT_MATCH_STOP_WORDS = {
    a: true,
    an: true,
    and: true,
    at: true,
    book: true,
    booking: true,
    by: true,
    can: true,
    club: true,
    course: true,
    detail: true,
    details: true,
    for: true,
    from: true,
    help: true,
    i: true,
    info: true,
    information: true,
    is: true,
    list: true,
    me: true,
    my: true,
    of: true,
    on: true,
    please: true,
    schedule: true,
    slot: true,
    support: true,
    tell: true,
    that: true,
    the: true,
    this: true,
    time: true,
    today: true,
    want: true,
    with: true
  };
  var FALLBACK_SUPPORT_AUTO_REPLY_RULES = Object.freeze([
    {
      ruleName: 'human-handoff',
      keywords: SUPPORT_HUMAN_HANDOFF_KEYWORDS.slice(),
      responseText: SUPPORT_HUMAN_HANDOFF_REPLY,
      priority: 5,
      requiresHuman: true,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'booking-schedule',
      keywords: ['booking', 'book', 'slot', 'schedule', 'reservation', 'availability', 'available seat', 'seats'],
      responseText: 'I can help with availability and booking details. Tell me the club or course name and the date or time you want, and I will check the latest availability for you.',
      priority: 20,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'payment-refund',
      keywords: ['pay', 'payment', 'fee', 'refund', 'order', 'charge', 'billing'],
      responseText: 'I can help review a payment or refund question. Please send the order ID, the club or course name, and the relevant date and time, and I will check what is available on your account.',
      priority: 30,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'maps-location',
      keywords: ['map', 'location', 'address', 'venue', 'place', 'directions'],
      responseText: 'I can help with the venue or map details. Tell me the club or course name and I will look up the saved location information for you.',
      priority: 40,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'registration-publish',
      keywords: ['register', 'registration', 'publish', 'approved', 'review', 'approval', 'submit'],
      responseText: 'I can help with registration or publishing steps. Please tell me whether this is about club registration or course publishing, and which step is blocking you.',
      priority: 50,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'teaching-course-info',
      keywords: ['teaching', 'class', 'classes', 'lesson', 'lessons', 'learn', 'learning', 'coach', 'instructor', 'teacher', 'teaching content', 'teaching method', 'teaching methods', 'method', 'methods', 'content', 'contents', 'item', 'items', 'syllabus', 'topic', 'topics', 'what learn', 'curriculum', 'lesson plan'],
      responseText: 'I can help with course content, coaches, schedules, fees, and remaining seats. If you know the course name, send it and I will pull up the latest details.',
      priority: 55,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'club-course-info',
      keywords: ['club', 'course', 'info', 'information', 'detail', 'details', 'about', 'introduction'],
      responseText: 'I can help with club and course details. Tell me which club or course you want, and I will look up the latest schedule, location, fee, and availability information.',
      priority: 60,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'forum-community',
      keywords: ['forum', 'post', 'posts', 'community', 'comment', 'comments', 'thread', 'threads', 'discussion', 'activity'],
      responseText: 'I can help with forum and community questions. Tell me the club, course, or topic you are interested in, and I will check the latest public discussions.',
      priority: 65,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'cancel-reschedule',
      keywords: ['cancel', 'cancellation', 'reschedule', 'change booking', 'change slot', 'change time', 'switch time'],
      responseText: 'I can help with a cancellation or time change. Please send the club or course name, the date and time, and the reason for the change, and I will guide you to the next step.',
      priority: 70,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'dashboard-records',
      keywords: ['dashboard', 'record', 'records', 'history', 'my booking', 'bookings', 'booking history', 'support history'],
      responseText: 'I can help check your booking and support history. If anything looks missing, send the club or course name and the booking date, and I will review what is currently on your account.',
      priority: 80,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'attachments-proof',
      keywords: ['attachment', 'attachments', 'upload', 'image', 'images', 'screenshot', 'screenshots', 'file', 'files', 'photo', 'photos'],
      responseText: 'Attachments are helpful, especially for booking, payment, or login issues. If you can, please include the club or course name and the relevant date and time as well.',
      priority: 90,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'login-account',
      keywords: ['login', 'log in', 'sign in', 'signup', 'sign up', 'account', 'password', 'register account', 'credentials'],
      responseText: 'I can help with login and account issues. Please tell me which step failed and what message you saw on screen. A screenshot is especially helpful here.',
      priority: 100,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'default',
      keywords: [],
      responseText: SUPPORT_DEFAULT_REPLY,
      priority: 999,
      requiresHuman: false,
      isDefault: true,
      isActive: true
    }
  ]);

  function normalizeSupportMatchText(value) {
    return trimText(value)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeSupportLookupText(value) {
    return trimText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatSupportIso(date) {
    var normalized = new Date(date);
    if (Number.isNaN(normalized.getTime())) return '';
    normalized.setHours(0, 0, 0, 0);
    var year = normalized.getFullYear();
    var month = String(normalized.getMonth() + 1).padStart(2, '0');
    var day = String(normalized.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function supportShortTime(value) {
    var text = trimText(value).slice(0, 5);
    if (!text) return '';
    var parts = text.split(':');
    if (parts.length < 2) return text;
    return String(Number(parts[0])) + ':' + parts[1];
  }

  function buildSupportSlotTime(start, end) {
    return supportShortTime(start) + '-' + supportShortTime(end);
  }

  function addSupportDays(date, days) {
    var next = new Date(date);
    next.setDate(next.getDate() + Number(days || 0));
    return next;
  }

  function supportTextPreview(value, maxLength) {
    var text = trimText(value).replace(/\s+/g, ' ');
    if (!text) return '';
    return text.length > (maxLength || 180)
      ? (text.slice(0, maxLength || 180).replace(/[,:;.\- ]+$/, '') + '...')
      : text;
  }

  function supportListPreview(list, maxItems) {
    return (Array.isArray(list) ? list : [])
      .map(trimText)
      .filter(Boolean)
      .slice(0, maxItems || 3)
      .join('; ');
  }

  function supportTimeSortValue(value) {
    var match = supportShortTime(value).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return 0;
    return (Number(match[1]) * 60) + Number(match[2]);
  }

  function buildSupportAvailabilityKey(slotId, dayIso) {
    return trimText(slotId) + '|' + trimText(dayIso);
  }

  function mapSupportAvailability(rows) {
    var out = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row) return;
      out[buildSupportAvailabilityKey(row.slot_id, row.day_iso)] = Number(row.booked_count || 0);
    });
    return out;
  }

  function formatSupportFee(value, fallbackText) {
    var text = trimText(value).replace(/^[£$€¥]\s*/, '');
    if (!text) return trimText(fallbackText);
    if (/^\.[0-9]+(?:\b|[^0-9])/.test(text)) {
      return '£0' + text;
    }
    if (/^\d+(?:\.\d+)?(?:\b|[^A-Za-z0-9])/.test(text)) {
      return '£' + text;
    }
    return trimText(value);
  }

  function supportCourseScheduleCount(scheduleList, primaryTime) {
    var count = Array.isArray(scheduleList) ? scheduleList.filter(Boolean).length : 0;
    if (count > 0) return count;
    return trimText(primaryTime) ? 1 : 1;
  }

  function supportEntityMatchScore(messageText, aliases) {
    var normalizedMessage = normalizeSupportLookupText(messageText);
    if (!normalizedMessage) return 0;
    var bestScore = 0;
    (Array.isArray(aliases) ? aliases : []).forEach(function (alias) {
      var normalizedAlias = normalizeSupportLookupText(alias);
      if (!normalizedAlias) return;
      if (normalizedMessage.indexOf(normalizedAlias) > -1) {
        bestScore = Math.max(bestScore, 100 + normalizedAlias.length);
        return;
      }
      var score = 0;
      normalizedAlias.split(' ').forEach(function (token) {
        if (!token || token.length < 3 || SUPPORT_MATCH_STOP_WORDS[token]) return;
        if (normalizedMessage.indexOf(token) > -1) score += token.length;
      });
      bestScore = Math.max(bestScore, score);
    });
    return bestScore;
  }

  function pickSupportMatches(messageText, items, aliasFactory, limit) {
    return (Array.isArray(items) ? items : [])
      .map(function (item) {
        return {
          item: item,
          score: supportEntityMatchScore(messageText, aliasFactory(item))
        };
      })
      .filter(function (entry) {
        return entry.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, limit || 3)
      .map(function (entry) {
        return entry.item;
      });
  }

  function extractSupportOrderIds(text) {
    var matches = trimText(text).toUpperCase().match(/\b[A-Z]{2,}[A-Z0-9-]*\d+\b/g);
    return Array.isArray(matches) ? matches : [];
  }

  function cloneSupportDynamicContext(context) {
    return JSON.parse(JSON.stringify(context || {
      todayIso: '',
      tomorrowIso: '',
      clubs: [],
      courses: [],
      forumPosts: []
    }));
  }

  function isSupportMissingCourseMapLinkColumn(error) {
    var text = trimText(error && (error.message || error.details || error.hint || error.code));
    return /map_link/i.test(text);
  }

  async function fetchSupportDynamicContext() {
    var now = Date.now();
    if (supportDynamicContextCache && (now - supportDynamicContextFetchedAt) < SUPPORT_DYNAMIC_CONTEXT_CACHE_TTL) {
      return cloneSupportDynamicContext(supportDynamicContextCache);
    }

    if (!isConfigured()) {
      return {
        todayIso: formatSupportIso(new Date()),
        tomorrowIso: formatSupportIso(addSupportDays(new Date(), 1)),
        clubs: [],
        courses: [],
        forumPosts: []
      };
    }

    var client = getSupabaseClientSafe();
    if (!client) {
      return {
        todayIso: formatSupportIso(new Date()),
        tomorrowIso: formatSupportIso(addSupportDays(new Date(), 1)),
        clubs: [],
        courses: [],
        forumPosts: []
      };
    }

    var todayDate = new Date();
    var todayIso = formatSupportIso(todayDate);
    var tomorrowIso = formatSupportIso(addSupportDays(todayDate, 1));
    var clubPromise = client
      .from('clubs')
      .select(SUPPORT_CLUB_SELECT)
      .eq('status', 'approved')
      .order('name', { ascending: true });

    var slotPromise = client
      .from('club_slots')
      .select('id, club_id, day_iso, start_time, end_time, capacity, status')
      .in('day_iso', [todayIso, tomorrowIso])
      .order('start_time', { ascending: true });

    var availabilityPromise = client.rpc('get_club_booking_availability', {
      p_start_date: todayIso,
      p_end_date: tomorrowIso
    });

    var coursePromise = client
      .from('courses')
      .select(SUPPORT_COURSE_SELECT)
      .order('created_at', { ascending: false });

    var forumPromise = client
      .from('forum_posts')
      .select(SUPPORT_FORUM_POST_SELECT)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(80);

    var results = await Promise.all([clubPromise, slotPromise, availabilityPromise, coursePromise, forumPromise]);
    var clubResult = results[0] || {};
    var slotResult = results[1] || {};
    var availabilityResult = results[2] || {};
    var courseResult = results[3] || {};
    var forumResult = results[4] || {};

    if (clubResult.error) throw clubResult.error;
    if (slotResult.error) throw slotResult.error;
    if (availabilityResult.error) throw availabilityResult.error;
    if (courseResult.error && isSupportMissingCourseMapLinkColumn(courseResult.error)) {
      courseResult = await client
        .from('courses')
        .select(SUPPORT_COURSE_SELECT_LEGACY)
        .order('created_at', { ascending: false });
    }

    if (courseResult.error) throw courseResult.error;
    if (forumResult.error) throw forumResult.error;

    var courseRows = Array.isArray(courseResult.data) ? courseResult.data : [];
    var courseIds = courseRows.map(function (row) {
      return normalizeId(row && row.id);
    }).filter(Boolean);
    var countResult = await client.rpc('get_course_booking_counts', {
      p_course_ids: courseIds.length ? courseIds : null
    });
    if (countResult.error) throw countResult.error;

    var availabilityMap = mapSupportAvailability(availabilityResult.data);
    var slotGroups = {};
    (Array.isArray(slotResult.data) ? slotResult.data : []).forEach(function (slot) {
      if (!slot || trimText(slot.status).toLowerCase() === 'closed') return;
      var clubId = normalizeId(slot.club_id);
      if (!clubId) return;
      var remaining = Math.max(Number(slot.capacity || 0) - Number(availabilityMap[buildSupportAvailabilityKey(slot.id, slot.day_iso)] || 0), 0);
      if (!slotGroups[clubId]) slotGroups[clubId] = {};
      if (!slotGroups[clubId][slot.day_iso]) slotGroups[clubId][slot.day_iso] = [];
      slotGroups[clubId][slot.day_iso].push({
        id: normalizeId(slot.id),
        time: buildSupportSlotTime(slot.start_time, slot.end_time),
        remaining: remaining,
        capacity: Number(slot.capacity || 0)
      });
    });

    var clubs = (Array.isArray(clubResult.data) ? clubResult.data : []).map(function (club) {
      var clubId = normalizeId(club && club.id);
      var availabilityByDay = slotGroups[clubId] || {};
      Object.keys(availabilityByDay).forEach(function (dayIso) {
        availabilityByDay[dayIso] = (availabilityByDay[dayIso] || []).slice().sort(function (a, b) {
          return supportTimeSortValue(a.time) - supportTimeSortValue(b.time);
        });
      });
      var todaySlots = availabilityByDay[todayIso] || [];
      var tomorrowSlots = availabilityByDay[tomorrowIso] || [];
      return {
        id: clubId,
        slug: trimText(club && club.slug),
        name: trimText(club && club.name),
        category: trimText(club && club.category),
        mode: trimText(club && club.mode),
        location: trimText(club && club.location),
        mapLink: trimText(club && club.map_link),
        timeText: trimText(club && club.time_text),
        feeText: formatSupportFee(club && club.fee_text, '£0'),
        seats: Number(club && club.seats || 0),
        description: trimText(club && club.description),
        venueInfo: trimText(club && club.venue_info),
        whatWeDo: trimText(club && club.what_we_do),
        audience: trimText(club && club.audience),
        trainingPlan: trimText(club && club.training_plan),
        notes: trimText(club && club.notes),
        tags: Array.isArray(club && club.tags) ? club.tags.map(trimText).filter(Boolean) : [],
        availabilityByDay: availabilityByDay,
        todaySlots: todaySlots,
        tomorrowSlots: tomorrowSlots,
        totalRemainingToday: todaySlots.reduce(function (sum, slot) {
          return sum + Math.max(0, Number(slot.remaining || 0));
        }, 0),
        totalRemainingTomorrow: tomorrowSlots.reduce(function (sum, slot) {
          return sum + Math.max(0, Number(slot.remaining || 0));
        }, 0)
      };
    }).filter(function (club) {
      return !!club.name;
    });

    var courseCountMap = {};
    (Array.isArray(countResult.data) ? countResult.data : []).forEach(function (row) {
      courseCountMap[normalizeId(row && row.course_id)] = Math.max(0, Number(row && row.booked_count || 0));
    });

    var courses = courseRows.map(function (row) {
      var schedule = Array.isArray(row.schedule)
        ? row.schedule.map(trimText).filter(Boolean)
        : [];
      var primaryTime = trimText(row.time_text) || schedule[0] || '';
      var scheduleCount = supportCourseScheduleCount(schedule, primaryTime);
      var perSlotSeats = Math.max(0, Number(row.seats || 0));
      var totalCapacity = perSlotSeats * scheduleCount;
      var bookedCount = Math.max(0, Number(courseCountMap[normalizeId(row.id)] || 0));
      return {
        id: normalizeId(row.id),
        slug: trimText(row.slug),
        title: trimText(row.title),
        clubName: trimText(row.club && row.club.name),
        clubSlug: trimText(row.club && row.club.slug),
        location: trimText(row.location),
        mapLink: trimText(row.map_link),
        feeText: formatSupportFee(row.fee_text, ''),
        timeText: primaryTime,
        schedule: schedule.length ? schedule : (primaryTime ? [primaryTime] : []),
        description: trimText(row.description),
        detail: trimText(row.detail),
        coachName: trimText(row.coach_name),
        coachTitle: trimText(row.coach_title),
        coachBio: trimText(row.coach_bio),
        learningPoints: Array.isArray(row.learning_points) ? row.learning_points.map(trimText).filter(Boolean) : [],
        audienceTips: Array.isArray(row.audience_tips) ? row.audience_tips.map(trimText).filter(Boolean) : [],
        notesList: Array.isArray(row.notes_list) ? row.notes_list.map(trimText).filter(Boolean) : [],
        totalRemainingSeats: Math.max(totalCapacity - bookedCount, 0),
        totalCapacity: totalCapacity,
        perSlotSeats: perSlotSeats
      };
    }).filter(function (course) {
      return !!course.title;
    });

    var forumPosts = (Array.isArray(forumResult.data) ? forumResult.data : []).map(function (row) {
      return {
        id: normalizeId(row && row.id),
        title: trimText(row && row.title),
        content: trimText(row && row.content),
        postType: trimText(row && row.post_type),
        channel: trimText(row && row.channel),
        likesCount: Number(row && row.likes_count || 0),
        clubName: trimText(row && row.club && row.club.name),
        clubSlug: trimText(row && row.club && row.club.slug),
        createdAt: trimText(row && row.created_at)
      };
    }).filter(function (post) {
      return !!(post.title || post.content);
    });

    supportDynamicContextCache = {
      todayIso: todayIso,
      tomorrowIso: tomorrowIso,
      clubs: clubs,
      courses: courses,
      forumPosts: forumPosts
    };
    supportDynamicContextFetchedAt = now;
    return cloneSupportDynamicContext(supportDynamicContextCache);
  }

  async function fetchSupportUserBookings(currentUserId) {
    if (!isConfigured() || !normalizeId(currentUserId)) return [];
    var client = getSupabaseClientSafe();
    if (!client) return [];
    var result = await client
      .from('club_bookings')
      .select('order_id, status, payment_status, day_iso, slot_time, payable_amount, club:clubs(name)')
      .eq('user_id', normalizeId(currentUserId))
      .order('created_at', { ascending: false })
      .limit(30);
    if (result.error) throw result.error;
    return Array.isArray(result.data) ? result.data.map(function (row) {
      return {
        orderId: trimText(row && row.order_id).toUpperCase(),
        status: trimText(row && row.status),
        paymentStatus: trimText(row && row.payment_status),
        dayIso: trimText(row && row.day_iso),
        slotTime: trimText(row && row.slot_time),
        payableAmount: Number(row && row.payable_amount || 0),
        clubName: trimText(row && row.club && row.club.name)
      };
    }) : [];
  }

  async function fetchSupportUserCourseBookings(currentUserId) {
    if (!isConfigured() || !normalizeId(currentUserId)) return [];
    var client = getSupabaseClientSafe();
    if (!client) return [];
    var result = await client
      .from('course_bookings')
      .select('order_id, status, payment_status, payment_method, fee_text, payable_amount, payer_email, selected_schedule, booked_at, course:courses(title, location, fee_text)')
      .eq('user_id', normalizeId(currentUserId))
      .order('booked_at', { ascending: false })
      .limit(30);

    if (result.error && isMissingCourseBookingPaymentColumn(result.error)) {
      result = await client
        .from('course_bookings')
        .select('status, selected_schedule, booked_at, course:courses(title, location, fee_text)')
        .eq('user_id', normalizeId(currentUserId))
        .order('booked_at', { ascending: false })
        .limit(30);
    }
    if (result.error) throw result.error;
    return Array.isArray(result.data) ? result.data.map(function (row) {
      return {
        orderId: trimText(row && row.order_id).toUpperCase(),
        status: trimText(row && row.status),
        paymentStatus: trimText(row && row.payment_status),
        paymentMethod: trimText(row && row.payment_method),
        selectedSchedule: trimText(row && row.selected_schedule),
        bookedAt: trimText(row && row.booked_at),
        payableAmount: Number(row && row.payable_amount || 0),
        payerEmail: normalizeEmail(row && row.payer_email),
        courseTitle: trimText(row && row.course && row.course.title),
        location: trimText(row && row.course && row.course.location),
        feeText: trimText(row && row.fee_text) || trimText(row && row.course && row.course.fee_text)
      };
    }) : [];
  }

  function formatSupportSlotList(slots, maxItems) {
    return (Array.isArray(slots) ? slots : []).filter(function (slot) {
      return Number(slot && slot.remaining || 0) > 0;
    }).slice(0, maxItems || 3).map(function (slot) {
      return slot.time + ' (' + Math.max(0, Number(slot.remaining || 0)) + ' spots left)';
    }).join(', ');
  }

  function formatSupportSlotBulletLines(slots, maxItems) {
    return (Array.isArray(slots) ? slots : []).filter(function (slot) {
      return Number(slot && slot.remaining || 0) > 0;
    }).slice(0, maxItems || 4).map(function (slot) {
      var remaining = Math.max(0, Number(slot.remaining || 0));
      return '- ' + slot.time + ': ' + remaining + ' ' + (remaining === 1 ? 'spot' : 'spots') + ' left';
    }).join('\n');
  }

  function buildSupportUrl(path, params) {
    var pairs = [];
    Object.keys(params || {}).forEach(function (key) {
      var value = trimText(params[key]);
      if (!value) return;
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });
    return trimText(path) + (pairs.length ? ('?' + pairs.join('&')) : '');
  }

  function supportClubSlotsForDay(club, dayIso) {
    var availabilityByDay = club && club.availabilityByDay;
    return availabilityByDay && Array.isArray(availabilityByDay[dayIso])
      ? availabilityByDay[dayIso].slice()
      : [];
  }

  function supportClubRemainingForDay(club, dayIso) {
    return supportClubSlotsForDay(club, dayIso).reduce(function (sum, slot) {
      return sum + Math.max(0, Number(slot && slot.remaining || 0));
    }, 0);
  }

  function resolveSupportRequestedDay(text, context) {
    var rawText = trimText(text);
    if (/tomorrow|\u660e\u5929/i.test(rawText)) {
      return {
        dayIso: trimText(context && context.tomorrowIso) || trimText(context && context.todayIso),
        label: 'tomorrow'
      };
    }
    return {
      dayIso: trimText(context && context.todayIso),
      label: 'today'
    };
  }

  function createSupportReplyAction(label, message, style) {
    return {
      id: buildSupportActionId(label),
      label: trimText(label),
      kind: 'reply',
      message: trimText(message),
      style: trimText(style).toLowerCase() === 'primary' ? 'primary' : 'secondary'
    };
  }

  function createSupportLinkAction(label, href, style, target) {
    return {
      id: buildSupportActionId(label),
      label: trimText(label),
      kind: 'link',
      href: trimText(href),
      target: trimText(target) || '_self',
      style: trimText(style).toLowerCase() === 'primary' ? 'primary' : 'secondary'
    };
  }

  function normalizeSupportReplyResult(value, fallbackText) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return {
        text: trimText(value.text || fallbackText),
        actions: cloneSupportActions(value.actions)
      };
    }
    return {
      text: trimText(value || fallbackText),
      actions: []
    };
  }

  function buildSupportReplyResult(text, actions) {
    return normalizeSupportReplyResult({
      text: text,
      actions: actions
    }, '');
  }

  function buildSupportClubActions(club, context, dayInfo) {
    var actions = [];
    var requestedDayIso = trimText(dayInfo && dayInfo.dayIso) || trimText(context && context.todayIso);
    var isTomorrow = requestedDayIso && requestedDayIso === trimText(context && context.tomorrowIso);
    if (club && trimText(club.name) && trimText(context && context.tomorrowIso)) {
      actions.push(createSupportReplyAction(
        isTomorrow ? 'Check Today' : 'Check Tomorrow',
        'Please check ' + (isTomorrow ? 'today' : 'tomorrow') + '\'s availability for ' + club.name + '.'
      ));
    }
    if (trimText(club && club.mapLink)) {
      actions.push(createSupportLinkAction('View Location', club.mapLink, 'secondary', '_blank'));
    } else if (trimText(club && club.name)) {
      actions.push(createSupportReplyAction('View Location', 'Please show the location for ' + club.name + '.'));
    }
    actions.push(createSupportLinkAction(
      'Book Now',
      buildSupportUrl('Club-Booking.html', {
        club: trimText(club && club.slug),
        day: requestedDayIso
      }) || 'Club-Booking.html',
      'primary',
      '_self'
    ));
    return cloneSupportActions(actions).slice(0, 3);
  }

  function buildSupportCourseActions(course, context) {
    var actions = [];
    if (trimText(context && context.tomorrowIso) && trimText(course && (course.clubName || course.title))) {
      actions.push(createSupportReplyAction(
        'Check Tomorrow',
        'Please check tomorrow\'s availability for ' + (course.clubName || course.title) + '.'
      ));
    }
    if (trimText(course && course.mapLink)) {
      actions.push(createSupportLinkAction('View Location', course.mapLink, 'secondary', '_blank'));
    } else if (trimText(course && course.title)) {
      actions.push(createSupportReplyAction('View Location', 'Please show the location for ' + course.title + '.'));
    }
    actions.push(createSupportLinkAction('Book Now', 'Club-Courses.html', 'primary', '_self'));
    return cloneSupportActions(actions).slice(0, 3);
  }

  function buildSupportForumAliases(post) {
    return [
      post.title,
      post.clubName,
      post.clubSlug,
      post.postType,
      post.channel,
      post.content
    ];
  }

  function buildSupportClubAliases(club) {
    return [
      club.name,
      club.slug,
      club.category,
      club.location
    ];
  }

  function buildSupportCourseAliases(course) {
    return [
      course.title,
      course.slug,
      course.clubName,
      course.clubSlug,
      course.coachName,
      course.coachTitle
    ];
  }

  function supportPrefersCourseReply(text) {
    var normalizedText = normalizeSupportLookupText(text);
    if (!normalizedText) return false;
    return [
      'course',
      'courses',
      'class',
      'classes',
      'lesson',
      'lessons',
      'teaching',
      'coach',
      'instructor',
      'syllabus',
      'item',
      'items',
      'content',
      'contents',
      'learn',
      'learning',
      'curriculum',
      'lesson plan'
    ].some(function (keyword) {
      return normalizedText.indexOf(keyword) > -1;
    });
  }

  function extractSupportCourseInfoNeeds(text) {
    var normalizedText = normalizeSupportLookupText(text);
    return {
      overview: /overview|summary|introduction|detail|details|about/.test(normalizedText),
      coach: /coach|teacher|instructor|tutor/.test(normalizedText),
      focus: /focus|content|contents|syllabus|topic|topics|teaching method|teaching methods|method|methods|learning point|learning points|curriculum/.test(normalizedText),
      schedule: /schedule|time|times|timetable|lesson time/.test(normalizedText),
      location: /location|address|venue|place/.test(normalizedText),
      fee: /fee|fees|price|prices|cost|costs|payment/.test(normalizedText),
      seats: /seat|seats|space|spaces|availability|available|remaining/.test(normalizedText)
    };
  }

  function supportHasSpecificCourseInfoNeed(needs) {
    return !!(needs && (needs.overview || needs.coach || needs.focus || needs.schedule || needs.location || needs.fee || needs.seats));
  }

  function buildSupportTeachingFollowup(courses, subjectLabel) {
    var list = (Array.isArray(courses) ? courses : []).slice(0, 4);
    if (!list.length) return '';
    if (list.length === 1) {
      return 'I found one course that looks relevant for ' + subjectLabel + ': ' + list[0].title + '. Tell me whether you want the overview, teaching team, learning focus, schedule, location, fee, or remaining seats.';
    }
    return 'I found a few courses that may match ' + subjectLabel + ': ' + list.map(function (course) {
      return course.title;
    }).join('; ') + '. Tell me which course you want, and whether you need the overview, teaching team, learning focus, schedule, location, fee, or remaining seats.';
  }

  function buildSupportTeachingDirectReply(course, needs) {
    var parts = [];
    if (!course) return '';
    parts.push('I pulled up the teaching details for ' + course.title + '.');
    if (!needs || !supportHasSpecificCourseInfoNeed(needs) || needs.overview) {
      parts.push('Overview: ' + (supportTextPreview(course.detail || course.description, 180) || 'not provided yet') + '.');
    }
    if (!needs || !supportHasSpecificCourseInfoNeed(needs) || needs.coach) {
      parts.push('Teaching team: ' + ([course.coachName, course.coachTitle].filter(Boolean).join(' - ') || 'not provided') + '.');
    }
    if (!needs || !supportHasSpecificCourseInfoNeed(needs) || needs.focus) {
      parts.push('Learning focus: ' + (supportListPreview(course.learningPoints, 4) || supportTextPreview(course.detail || course.description, 140) || 'not provided yet') + '.');
    }
    if (!needs || !supportHasSpecificCourseInfoNeed(needs) || needs.schedule) {
      parts.push('Schedule: ' + (course.schedule.join(' / ') || 'not provided') + '.');
    }
    if (!needs || !supportHasSpecificCourseInfoNeed(needs) || needs.location) {
      parts.push('Location: ' + (course.location || 'not provided') + '.');
    }
    if (!needs || !supportHasSpecificCourseInfoNeed(needs) || needs.fee) {
      parts.push('Fee: ' + (course.feeText || 'free') + '.');
    }
    if (!needs || !supportHasSpecificCourseInfoNeed(needs) || needs.seats) {
      parts.push('Remaining seats: ' + Math.max(0, Number(course.totalRemainingSeats || 0)) + '.');
    }
    return parts.join('\n\n');
  }

  function appendUniqueSupportEntities(target, items) {
    var seen = {};
    (Array.isArray(target) ? target : []).forEach(function (item) {
      if (!item) return;
      seen[normalizeId(item.id) || trimText(item.slug) || trimText(item.name) || trimText(item.title)] = true;
    });
    (Array.isArray(items) ? items : []).forEach(function (item) {
      if (!item) return;
      var key = normalizeId(item.id) || trimText(item.slug) || trimText(item.name) || trimText(item.title);
      if (!key || seen[key]) return;
      seen[key] = true;
      target.push(item);
    });
    return target;
  }

  function resolveSupportConversationEntities(payload, context) {
    var clubs = Array.isArray(context && context.clubs) ? context.clubs : [];
    var courses = Array.isArray(context && context.courses) ? context.courses : [];
    var currentText = trimText(payload && payload.text);
    var threadSubject = trimText(payload && payload.threadSubject);
    var historyTexts = (Array.isArray(payload && payload.threadHistory) ? payload.threadHistory : []).map(function (entry) {
      return trimText(entry && (entry.text || entry.messageText));
    }).filter(Boolean);

    var currentCourseMatches = pickSupportMatches(currentText, courses, buildSupportCourseAliases, 4);
    var currentClubMatches = pickSupportMatches(currentText, clubs, buildSupportClubAliases, 3);

    var inferredCourses = appendUniqueSupportEntities([], currentCourseMatches.slice());
    var inferredClubs = appendUniqueSupportEntities([], currentClubMatches.slice());

    if (threadSubject) {
      appendUniqueSupportEntities(inferredCourses, pickSupportMatches(threadSubject, courses, buildSupportCourseAliases, 4));
      appendUniqueSupportEntities(inferredClubs, pickSupportMatches(threadSubject, clubs, buildSupportClubAliases, 3));
    }

    historyTexts.forEach(function (text) {
      appendUniqueSupportEntities(inferredCourses, pickSupportMatches(text, courses, buildSupportCourseAliases, 4));
      appendUniqueSupportEntities(inferredClubs, pickSupportMatches(text, clubs, buildSupportClubAliases, 3));
    });

    if (!inferredCourses.length && inferredClubs.length) {
      appendUniqueSupportEntities(inferredCourses, courses.filter(function (course) {
        var courseClubName = normalizeSupportLookupText(course.clubName);
        var courseClubSlug = normalizeSupportLookupText(course.clubSlug);
        return inferredClubs.some(function (club) {
          return (courseClubName && courseClubName === normalizeSupportLookupText(club.name))
            || (courseClubSlug && courseClubSlug === normalizeSupportLookupText(club.slug));
        });
      }).slice(0, 6));
    }

    return {
      currentCourses: currentCourseMatches,
      currentClubs: currentClubMatches,
      courses: inferredCourses,
      clubs: inferredClubs
    };
  }

  function buildBookingScheduleReply(payload, fallbackText, context) {
    var text = trimText(payload && payload.text);
    var clubs = Array.isArray(context && context.clubs) ? context.clubs : [];
    var courses = Array.isArray(context && context.courses) ? context.courses : [];
    var dayInfo = resolveSupportRequestedDay(text, context);
    var matchedClubs = pickSupportMatches(text, clubs, function (club) {
      return [club.name, club.slug];
    }, 2);
    var matchedCourses = pickSupportMatches(text, courses, function (course) {
      return [course.title, course.slug, course.clubName];
    }, 2);
    var normalizedText = normalizeSupportLookupText(text);
    var asksForCourse = normalizedText.indexOf('course') > -1;

    if (matchedClubs.length) {
      var club = matchedClubs[0];
      var daySlots = supportClubSlotsForDay(club, dayInfo.dayIso);
      var dayRemaining = supportClubRemainingForDay(club, dayInfo.dayIso);
      var clubSections = ['I checked ' + dayInfo.label + '\'s availability for ' + club.name + '.'];
      if (dayRemaining > 0) {
        clubSections.push('Open slots:\n' + (formatSupportSlotBulletLines(daySlots, 4) || '- No open slots listed right now'));
      } else {
        clubSections.push('I do not see any open slots for ' + dayInfo.label + ' right now.');
      }
      var clubDetails = [];
      if (club.location) clubDetails.push('Venue: ' + club.location);
      if (club.feeText) clubDetails.push('Fee: ' + club.feeText);
      if (!dayRemaining && club.timeText) clubDetails.push('Regular schedule: ' + club.timeText);
      if (clubDetails.length) {
        clubSections.push(clubDetails.join('\n'));
      }
      clubSections.push(dayRemaining > 0
        ? 'If you want, I can also show the location or take you straight to booking.'
        : 'If you want, I can check another day, show the location, or take you straight to booking.');
      return buildSupportReplyResult(clubSections.join('\n\n'), buildSupportClubActions(club, context, dayInfo));
    }

    if (asksForCourse || matchedCourses.length) {
      var course = matchedCourses[0];
      if (course) {
        return buildSupportReplyResult([
          'I checked the latest booking details for ' + course.title + '.',
          'Schedule: ' + (course.schedule.join(' / ') || 'not provided'),
          'Remaining seats: ' + Math.max(0, Number(course.totalRemainingSeats || 0)),
          'Location: ' + (course.location || 'not provided'),
          'Fee: ' + (course.feeText || 'free'),
          'If you want, I can also show the location or take you to the course page.'
        ].join('\n\n'), buildSupportCourseActions(course, context));
      }
      var openCourses = courses.filter(function (item) {
        return Number(item.totalRemainingSeats || 0) > 0;
      }).slice(0, 4);
      if (openCourses.length) {
        return [
          'I can help with that. These courses still have space available right now:',
          openCourses.map(function (item) {
            return '- ' + item.title + ': ' + Math.max(0, Number(item.totalRemainingSeats || 0)) + ' seats left';
          }).join('\n'),
          'Reply with a course name and I will narrow it down for you.'
        ].join('\n\n');
      }
    }

    var todayBookableClubs = clubs.filter(function (club) {
      return supportClubRemainingForDay(club, dayInfo.dayIso) > 0;
    }).slice(0, 4);
    if (todayBookableClubs.length) {
      return [
        'I can help with that. These clubs still have openings ' + dayInfo.label + ':',
        todayBookableClubs.map(function (club) {
          return '- ' + club.name + ': ' + formatSupportSlotList(supportClubSlotsForDay(club, dayInfo.dayIso), 2);
        }).join('\n'),
        'Reply with a club name and I will narrow it down for you.'
      ].join('\n\n');
    }

    return fallbackText;
  }

  function buildClubCourseInfoReply(payload, fallbackText, context) {
    var text = trimText(payload && payload.text);
    var clubs = Array.isArray(context && context.clubs) ? context.clubs : [];
    var courses = Array.isArray(context && context.courses) ? context.courses : [];
    var prefersCourse = supportPrefersCourseReply(text);
    var matchedCourses = pickSupportMatches(text, courses, function (course) {
      return [course.title, course.slug, course.clubName, course.coachName, course.coachTitle];
    }, 1);
    if (prefersCourse && matchedCourses.length) {
      var preferredCourse = matchedCourses[0];
      var preferredOverview = supportTextPreview(preferredCourse.detail || preferredCourse.description, 180);
      var preferredCoaching = supportTextPreview([preferredCourse.coachName, preferredCourse.coachTitle, preferredCourse.coachBio].filter(Boolean).join(' - '), 160);
      var preferredLearning = supportListPreview(preferredCourse.learningPoints, 3);
      return buildSupportReplyResult([
        'I pulled up the latest details for ' + preferredCourse.title + '.',
        'Schedule: ' + (preferredCourse.schedule.join(' / ') || 'not provided'),
        'Location: ' + (preferredCourse.location || 'not provided'),
        'Fee: ' + (preferredCourse.feeText || 'free'),
        'Remaining seats: ' + Math.max(0, Number(preferredCourse.totalRemainingSeats || 0)),
        preferredOverview ? ('Overview: ' + preferredOverview) : '',
        preferredCoaching ? ('Teaching team: ' + preferredCoaching) : '',
        preferredLearning ? ('Learning focus: ' + preferredLearning) : '',
        'If you want, I can also show the location or take you to the course page.'
      ].filter(Boolean).join('\n\n'), buildSupportCourseActions(preferredCourse, context));
    }
    var matchedClubs = pickSupportMatches(text, clubs, function (club) {
      return [club.name, club.slug];
    }, 1);
    if (matchedClubs.length) {
      var club = matchedClubs[0];
      var extra = Number(club.totalRemainingToday || 0) > 0
        ? ('Today\'s openings: ' + formatSupportSlotList(club.todaySlots, 3))
        : '';
      var intro = supportTextPreview(club.description || club.whatWeDo || club.venueInfo, 180);
      var training = supportTextPreview(club.trainingPlan || club.notes || club.audience, 160);
      var tags = supportListPreview(club.tags, 4);
      return buildSupportReplyResult([
        'I pulled up the latest details for ' + club.name + '.',
        'Category: ' + (club.category || 'not provided'),
        'Venue: ' + (club.location || 'not provided'),
        'Regular schedule: ' + (club.timeText || 'not provided yet'),
        'Fee: ' + (club.feeText || 'free'),
        intro ? ('Overview: ' + intro) : '',
        training ? ('Training and notes: ' + training) : '',
        tags ? ('Tags: ' + tags) : '',
        extra,
        'If you want, I can also check availability, show the location, or take you to booking.'
      ].filter(Boolean).join('\n\n'), buildSupportClubActions(club, context, resolveSupportRequestedDay(text, context)));
    }
    if (matchedCourses.length) {
      var course = matchedCourses[0];
      var overview = supportTextPreview(course.detail || course.description, 180);
      var coaching = supportTextPreview([course.coachName, course.coachTitle, course.coachBio].filter(Boolean).join(' - '), 160);
      var learning = supportListPreview(course.learningPoints, 3);
      return buildSupportReplyResult([
        'I pulled up the latest details for ' + course.title + '.',
        'Schedule: ' + (course.schedule.join(' / ') || 'not provided'),
        'Location: ' + (course.location || 'not provided'),
        'Fee: ' + (course.feeText || 'free'),
        'Remaining seats: ' + Math.max(0, Number(course.totalRemainingSeats || 0)),
        overview ? ('Overview: ' + overview) : '',
        coaching ? ('Teaching team: ' + coaching) : '',
        learning ? ('Learning focus: ' + learning) : '',
        'If you want, I can also show the location or take you to the course page.'
      ].filter(Boolean).join('\n\n'), buildSupportCourseActions(course, context));
    }
    return fallbackText;
  }

  function buildTeachingCourseReply(payload, fallbackText, context) {
    var text = trimText(payload && payload.text);
    var needs = extractSupportCourseInfoNeeds(text);
    var entityContext = resolveSupportConversationEntities(payload, context);
    var matchedCourses = entityContext.courses.slice(0, 4);
    var matchedClubs = entityContext.clubs.slice(0, 2);
    if (matchedCourses.length) {
      var course = matchedCourses[0];
      if (entityContext.currentCourses.length || entityContext.currentClubs.length) {
        return buildSupportTeachingFollowup(matchedCourses, trimText(entityContext.currentClubs[0] && entityContext.currentClubs[0].name) || trimText(entityContext.currentCourses[0] && entityContext.currentCourses[0].title) || 'your question') || fallbackText;
      }
      if (supportHasSpecificCourseInfoNeed(needs) && matchedCourses.length === 1) {
        return buildSupportReplyResult(buildSupportTeachingDirectReply(course, needs) || fallbackText, buildSupportCourseActions(course, context));
      }
      return buildSupportTeachingFollowup(matchedCourses, trimText(matchedClubs[0] && matchedClubs[0].name) || trimText(course.title) || 'your question') || fallbackText;
    }
    var courses = Array.isArray(context && context.courses) ? context.courses : [];
    if (!fallbackText) return '';
    var openCourses = courses.filter(function (item) {
      return Number(item.totalRemainingSeats || 0) > 0;
    }).slice(0, 4);
    if (openCourses.length) {
      return 'Courses you can currently ask about include: ' + openCourses.map(function (item) {
        return item.title + ' (' + (item.schedule.join(' / ') || 'schedule not provided') + ', ' + Math.max(0, Number(item.totalRemainingSeats || 0)) + ' seats left)';
      }).join('; ') + '. Please tell me which course you want, and whether you need the course overview, teaching team, learning focus, schedule, location, fee, or remaining seats.';
    }
    return fallbackText;
  }

  function buildMapsLocationReply(payload, fallbackText, context) {
    var text = trimText(payload && payload.text);
    var clubs = Array.isArray(context && context.clubs) ? context.clubs : [];
    var courses = Array.isArray(context && context.courses) ? context.courses : [];
    var matchedClubs = pickSupportMatches(text, clubs, function (club) {
      return [club.name, club.slug];
    }, 1);
    if (matchedClubs.length) {
      var club = matchedClubs[0];
      return buildSupportReplyResult([
        'I found the saved location details for ' + club.name + '.',
        'Venue: ' + (club.location || 'not provided'),
        club.mapLink ? 'A map link is available for this club.' : 'There is no saved map link for this club yet.',
        club.timeText ? ('Regular schedule: ' + club.timeText) : '',
        'If you want, you can open the location or go straight to booking.'
      ].filter(Boolean).join('\n\n'), buildSupportClubActions(club, context, resolveSupportRequestedDay(text, context)));
    }
    var matchedCourses = pickSupportMatches(text, courses, function (course) {
      return [course.title, course.slug, course.clubName];
    }, 1);
    if (matchedCourses.length) {
      var course = matchedCourses[0];
      return buildSupportReplyResult([
        'I found the saved location details for ' + course.title + '.',
        'Venue: ' + (course.location || 'not provided'),
        course.mapLink ? 'A map link is available for this course.' : 'There is no saved map link for this course yet.',
        course.schedule && course.schedule.length ? ('Schedule: ' + course.schedule.join(' / ')) : '',
        'If you want, you can open the location or go straight to the course page.'
      ].filter(Boolean).join('\n\n'), buildSupportCourseActions(course, context));
    }
    return fallbackText;
  }

  function buildForumCommunityReply(payload, fallbackText, context) {
    var text = trimText(payload && payload.text);
    var posts = Array.isArray(context && context.forumPosts) ? context.forumPosts : [];
    var matchedPosts = pickSupportMatches(text, posts, buildSupportForumAliases, 3);
    if (matchedPosts.length) {
      return 'Recent public forum topics related to your question include: ' + matchedPosts.map(function (post) {
        var title = post.title || supportTextPreview(post.content, 60) || 'Untitled post';
        var meta = [post.clubName, post.postType, post.channel].filter(Boolean).join(' / ');
        return title + (meta ? (' [' + meta + ']') : '');
      }).join('; ') + '.';
    }
    var recentPosts = posts.slice(0, 4);
    if (recentPosts.length) {
      return 'Recent public forum topics include: ' + recentPosts.map(function (post) {
        return (post.title || supportTextPreview(post.content, 56) || 'Untitled post') + (post.clubName ? (' [' + post.clubName + ']') : '');
      }).join('; ') + '.';
    }
    return fallbackText;
  }

  async function buildPaymentRefundReply(payload, fallbackText) {
    var orderIds = extractSupportOrderIds(payload && payload.text);
    if (!orderIds.length || !normalizeId(payload && payload.currentUserId)) {
      return fallbackText;
    }
    try {
      var bookings = await fetchSupportUserBookings(payload.currentUserId);
      var match = bookings.find(function (booking) {
        return orderIds.indexOf(trimText(booking.orderId).toUpperCase()) > -1;
      });
      if (!match) {
        return [
          'I could not find that order ID in your current club bookings.',
          'Please double-check the order ID and send it again, or reply with the club name and booking date and I will help you look it up.'
        ].join('\n\n');
      }
      return [
        'I found your booking order ' + match.orderId + '.',
        'Club: ' + (match.clubName || 'Club booking'),
        'Date and time: ' + ((match.dayIso || 'date not provided') + ' ' + (match.slotTime || '').trim()).trim(),
        'Booking status: ' + (match.status || 'unknown'),
        'Payment status: ' + (match.paymentStatus || 'unknown'),
        'If you need a refund review, reply with the reason for the request and I will note it for the team.'
      ].join('\n\n');
    } catch (error) {
      return fallbackText;
    }
  }

  async function buildDashboardRecordsReply(payload, fallbackText) {
    if (!normalizeId(payload && payload.currentUserId)) return fallbackText;
    try {
      var clubBookings = await fetchSupportUserBookings(payload.currentUserId);
      var courseBookings = await fetchSupportUserCourseBookings(payload.currentUserId);
      var latestClub = clubBookings[0];
      var latestCourse = courseBookings[0];
      var parts = [];
      parts.push('I checked the records currently visible in your dashboard.');
      parts.push('Club bookings: ' + clubBookings.length);
      parts.push('Course bookings: ' + courseBookings.length);
      if (latestClub) {
        parts.push('Latest club booking: ' + (latestClub.clubName || 'Club booking') + ' on ' + (latestClub.dayIso || 'date not provided') + ' ' + (latestClub.slotTime || '') + ' (' + (latestClub.status || 'unknown') + ' / ' + (latestClub.paymentStatus || 'unknown') + ').');
      }
      if (latestCourse) {
        parts.push('Latest course booking: ' + (latestCourse.courseTitle || 'Course booking') + ' ' + (latestCourse.selectedSchedule || '') + ' (' + (latestCourse.status || 'booked') + ').');
      }
      parts.push('If something looks missing, send me the club or course name and the booking date and I will help you check it.');
      return parts.join('\n\n');
    } catch (error) {
      return fallbackText;
    }
  }

  function cloneSupportAutoReplyRule(rule) {
    var item = rule || {};
    var ruleName = trimText(item.ruleName || item.rule_name);
    var keywords = Array.isArray(item.keywords) ? item.keywords.map(trimText).filter(Boolean) : [];
    if (ruleName === 'human-handoff') {
      keywords = SUPPORT_HUMAN_HANDOFF_KEYWORDS.concat(keywords).filter(function (keyword, index, list) {
        return !!keyword && list.indexOf(keyword) === index;
      });
    }
    return {
      id: normalizeId(item.id),
      ruleName: ruleName,
      keywords: keywords,
      responseText: ruleName === 'human-handoff'
        ? SUPPORT_HUMAN_HANDOFF_REPLY
        : trimText(item.responseText || item.response_text),
      priority: Number(item.priority || 0) || 0,
      requiresHuman: ruleName === 'human-handoff' ? true : !!(item.requiresHuman || item.requires_human),
      isDefault: !!(item.isDefault || item.is_default),
      isActive: item.isActive === undefined ? (item.is_active !== false) : !!item.isActive
    };
  }

  function fallbackSupportAutoReplyRules() {
    return FALLBACK_SUPPORT_AUTO_REPLY_RULES.map(cloneSupportAutoReplyRule);
  }

  function mergeSupportAutoReplyRules(rows) {
    var merged = {};
    fallbackSupportAutoReplyRules().forEach(function (rule) {
      merged[trimText(rule.ruleName)] = rule;
    });
    (Array.isArray(rows) ? rows : []).forEach(function (rule) {
      var key = trimText(rule && rule.ruleName);
      if (!key) return;
      merged[key] = rule;
    });
    return Object.keys(merged).map(function (key) {
      return cloneSupportAutoReplyRule(merged[key]);
    }).sort(function (a, b) {
      var priorityDelta = Number(a.priority || 0) - Number(b.priority || 0);
      if (priorityDelta) return priorityDelta;
      return trimText(a.ruleName).localeCompare(trimText(b.ruleName));
    });
  }

  async function fetchSupportAutoReplyRules() {
    var now = Date.now();
    if (Array.isArray(supportAutoReplyRulesCache) && (now - supportAutoReplyRulesFetchedAt) < SUPPORT_AUTO_REPLY_CACHE_TTL) {
      return supportAutoReplyRulesCache.map(cloneSupportAutoReplyRule);
    }

    if (!isConfigured()) {
      supportAutoReplyRulesCache = fallbackSupportAutoReplyRules();
      supportAutoReplyRulesFetchedAt = now;
      return supportAutoReplyRulesCache.map(cloneSupportAutoReplyRule);
    }

    try {
      var client = getSupabaseClientSafe();
      if (!client) throw new Error('missing_supabase_client');
      var result = await client
        .from('support_auto_reply_rules')
        .select('id, rule_name, keywords, response_text, priority, requires_human, is_default, is_active, created_at')
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });

      if (result.error) throw result.error;

      var rows = (Array.isArray(result.data) ? result.data : [])
        .map(cloneSupportAutoReplyRule)
        .filter(function (rule) {
          return rule.isActive && trimText(rule.responseText);
        });

      supportAutoReplyRulesCache = mergeSupportAutoReplyRules(rows);
      supportAutoReplyRulesFetchedAt = now;
      return supportAutoReplyRulesCache.map(cloneSupportAutoReplyRule);
    } catch (error) {
      supportAutoReplyRulesCache = fallbackSupportAutoReplyRules();
      supportAutoReplyRulesFetchedAt = now;
      return supportAutoReplyRulesCache.map(cloneSupportAutoReplyRule);
    }
  }

  function supportRuleMatchScore(normalizedText, rule) {
    var keywords = Array.isArray(rule && rule.keywords) ? rule.keywords : [];
    if (!normalizedText || !keywords.length) return 0;
    return keywords.reduce(function (count, keyword) {
      var normalizedKeyword = normalizeSupportMatchText(keyword);
      if (!normalizedKeyword) return count;
      return normalizedText.indexOf(normalizedKeyword) > -1 ? count + 1 : count;
    }, 0);
  }

  function pickSupportAutoReplyRule(text, rules) {
    var normalizedText = normalizeSupportMatchText(text);
    var list = Array.isArray(rules) ? rules.slice() : [];
    var bestRule = null;
    var bestScore = 0;

    list.forEach(function (rule) {
      if (!rule || !rule.isActive) return;
      var score = supportRuleMatchScore(normalizedText, rule);
      if (!score) return;
      if (!bestRule || score > bestScore || (score === bestScore && Number(rule.priority || 0) < Number(bestRule.priority || 0))) {
        bestRule = rule;
        bestScore = score;
      }
    });

    if (bestRule) return bestRule;
    return list.find(function (rule) {
      return rule && rule.isActive && rule.isDefault;
    }) || null;
  }

  async function resolveSupportAutoReply(payload) {
    var text = trimText(payload && payload.text);
    var attachments = cloneAttachments(payload && payload.attachments);
    if (!text && attachments.length) {
      return {
        text: SUPPORT_ATTACHMENT_ONLY_REPLY,
        actions: [],
        requiresHuman: false,
        ruleName: 'attachments-only'
      };
    }

    var rules = await fetchSupportAutoReplyRules();
    var rule = pickSupportAutoReplyRule(text, rules);
    var context = null;
    if (isConfigured()) {
      try {
        context = await fetchSupportDynamicContext();
      } catch (error) {
        context = null;
      }
    }
    if (rule && trimText(rule.responseText)) {
      var resolvedReply = normalizeSupportReplyResult(rule.responseText, rule.responseText);
      if (context) {
        try {
          if (trimText(rule.ruleName) === 'booking-schedule') {
            resolvedReply = normalizeSupportReplyResult(buildBookingScheduleReply(payload, resolvedReply.text, context), resolvedReply.text);
          } else if (trimText(rule.ruleName) === 'teaching-course-info') {
            resolvedReply = normalizeSupportReplyResult(buildTeachingCourseReply(payload, resolvedReply.text, context), resolvedReply.text);
          } else if (trimText(rule.ruleName) === 'club-course-info') {
            resolvedReply = normalizeSupportReplyResult(buildClubCourseInfoReply(payload, resolvedReply.text, context), resolvedReply.text);
          } else if (trimText(rule.ruleName) === 'forum-community') {
            resolvedReply = normalizeSupportReplyResult(buildForumCommunityReply(payload, resolvedReply.text, context), resolvedReply.text);
          } else if (trimText(rule.ruleName) === 'maps-location') {
            resolvedReply = normalizeSupportReplyResult(buildMapsLocationReply(payload, resolvedReply.text, context), resolvedReply.text);
          } else if (trimText(rule.ruleName) === 'payment-refund') {
            resolvedReply = normalizeSupportReplyResult(await buildPaymentRefundReply(payload, resolvedReply.text), resolvedReply.text);
          } else if (trimText(rule.ruleName) === 'dashboard-records') {
            resolvedReply = normalizeSupportReplyResult(await buildDashboardRecordsReply(payload, resolvedReply.text), resolvedReply.text);
          }
        } catch (error) {}
      }
      if (trimText(rule.ruleName) === 'default' && context) {
        try {
          var inferredTeachingReply = normalizeSupportReplyResult(buildTeachingCourseReply(payload, '', context), '');
          if (inferredTeachingReply.text) {
            resolvedReply = inferredTeachingReply;
            rule = {
              ruleName: 'teaching-course-followup',
              requiresHuman: false
            };
          }
        } catch (error) {}
      }
      return {
        text: resolvedReply.text,
        actions: resolvedReply.actions,
        requiresHuman: !!rule.requiresHuman,
        ruleName: trimText(rule.ruleName)
      };
    }

    return {
      text: SUPPORT_DEFAULT_REPLY,
      actions: [],
      requiresHuman: false,
      ruleName: 'default'
    };
  }

  async function resolveActiveSupportThread(client, currentUserId, subject, category) {
    var normalizedCategory = trimText(category) || 'General';
    var threadResult = await client
      .from('support_threads')
      .select('id, status, subject, category, updated_at')
      .eq('user_id', normalizeId(currentUserId))
      .eq('category', normalizedCategory)
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
          category: normalizedCategory,
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
    if (!trimText(current.category)) updatePatch.category = normalizedCategory;

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

  async function fetchSupportThreadHistory(client, threadId) {
    if (!client || !normalizeId(threadId)) return [];
    var result = await client
      .from('support_messages')
      .select('id, sender_role, sender_name, message_text, created_at')
      .eq('thread_id', normalizeId(threadId))
      .order('created_at', { ascending: false })
      .limit(12);
    if (result.error) throw result.error;
    return (Array.isArray(result.data) ? result.data : []).map(function (row) {
      var parsed = parseSupportMessagePayload(row && row.message_text);
      return {
        id: normalizeId(row && row.id),
        role: trimText(row && row.sender_role),
        senderName: trimText(row && row.sender_name),
        text: trimText(parsed.text),
        createdAt: trimText(row && row.created_at)
      };
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

    var userMessage = mapSupportMessageRow({
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

    var threadHistory = [];
    try {
      threadHistory = await fetchSupportThreadHistory(client, thread && thread.id);
    } catch (error) {}

    var autoReply = await resolveSupportAutoReply({
      text: text,
      attachments: attachments,
      category: trimText(payload && payload.category) || 'General',
      threadId: normalizeId(thread && thread.id),
      threadSubject: trimText(thread && thread.subject),
      threadCategory: trimText(thread && thread.category),
      threadHistory: threadHistory,
      currentUserId: currentUserId,
      currentEmail: currentEmail,
      currentName: currentName
    });
    var autoReplyText = trimText(autoReply && autoReply.text);
    if (!autoReplyText) {
      return [userMessage];
    }

    var replyResult = await client
      .from('support_messages')
      .insert({
        thread_id: normalizeId(thread && thread.id),
        sender_id: normalizeId(currentUserId),
        sender_role: 'admin',
        sender_name: 'Support Assistant',
        message_text: serializeSupportMessagePayload(autoReplyText, autoReply && autoReply.actions),
        attachments: []
      })
      .select('id, thread_id, sender_role, sender_name, message_text, attachments, created_at')
      .single();

    if (replyResult.error) throw replyResult.error;

    await client
      .from('support_threads')
      .update({ status: autoReply && autoReply.requiresHuman ? 'waiting_reply' : 'open' })
      .eq('id', normalizeId(thread && thread.id));

    return [
      userMessage,
      mapSupportMessageRow({
        id: replyResult.data.id,
        thread_id: replyResult.data.thread_id,
        sender_role: replyResult.data.sender_role,
        sender_name: replyResult.data.sender_name,
        message_text: replyResult.data.message_text,
        attachments: replyResult.data.attachments,
        created_at: replyResult.data.created_at,
        thread_status: autoReply && autoReply.requiresHuman ? 'waiting_reply' : 'open',
        thread_subject: thread && thread.subject,
        thread_category: thread && thread.category
      }, currentEmail)
    ];
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
    var text = trimText(payload && payload.text);
    var attachments = cloneAttachments(payload && payload.attachments);
    if (!text && !attachments.length) throw new Error('missing_message_text');
    var serialized = serializeMessagePayload(text, attachments);

    var targetUserId = normalizeId(payload && payload.targetUserId);
    var result;

    if (targetUserId) {
      result = await client.rpc('create_message_board_entry_by_user', {
        p_target_user_id: targetUserId,
        p_target_name: trimText(payload && payload.targetName) || null,
        p_message_text: serialized,
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
        p_message_text: serialized,
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
    if (text.indexOf('missing_message_text') > -1) return 'Please enter a message, add a link, or attach a file before sending.';
    if (text.indexOf('missing_support_content') > -1) return 'Please enter a message or attach a file before sending.';
    return trimText(error && error.message) || 'Unable to sync this support action to Supabase right now.';
  }

  window.clubSupportSupabase = {
    isConfigured: isConfigured,
    fetchMySupportMessages: fetchMySupportMessages,
    sendSupportMessage: sendSupportMessage,
    resolveSupportAutoReply: resolveSupportAutoReply,
    clearMySupportThreads: clearMySupportThreads,
    fetchMyMessageBoard: fetchMyMessageBoard,
    sendMessageBoardEntry: sendMessageBoardEntry,
    mapSupportError: mapSupportError,
    normalizeId: normalizeId
  };
})(window);
