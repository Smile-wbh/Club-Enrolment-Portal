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

  var SUPPORT_HUMAN_HANDOFF_REPLY = 'We have received your message. Our customer support team will assist you shortly. If possible, please provide the club or course name, the relevant date and time, and any helpful screenshots or attachments. Thank you for your patience.';
  var SUPPORT_ATTACHMENT_ONLY_REPLY = 'We have received your attachment. Our support team will review it shortly. If needed, please reply with the related club or course name, the date and time, and a brief description of the issue.';
  var SUPPORT_DEFAULT_REPLY = 'We have received your message. To help us handle it more quickly, please provide the club or course name, the relevant date and time, and any helpful screenshots or attachments. We will assist you as soon as possible.';
  var SUPPORT_AUTO_REPLY_CACHE_TTL = 5 * 60 * 1000;
  var SUPPORT_DYNAMIC_CONTEXT_CACHE_TTL = 2 * 60 * 1000;
  var SUPPORT_COURSE_SELECT = 'id, slug, club_id, title, level, mode, time_text, schedule, location, map_link, fee_text, seats, created_at, club:clubs(name, slug, category)';
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
      keywords: ['转人工', '人工', '人工客服', '客服', '真人', '人工服务', 'human', 'agent', 'representative', 'customer service'],
      responseText: SUPPORT_HUMAN_HANDOFF_REPLY,
      priority: 5,
      requiresHuman: true,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'booking-schedule',
      keywords: ['booking', 'book', 'slot', 'schedule', 'reservation', '预约', '时段', '时间段', '预定', '可预约', '名额'],
      responseText: 'We have received your booking question. Please provide the club or course name, the relevant date and time slot, and we will help you confirm availability, remaining seats, and booking status.',
      priority: 20,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'payment-refund',
      keywords: ['pay', 'payment', 'fee', 'refund', 'order', '付款', '支付', '费用', '退款', '订单'],
      responseText: 'We have received your payment question. Please provide the order ID, the club or course name, and the relevant date and time. If a refund is involved, the final outcome will follow the club or course policy.',
      priority: 30,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'maps-location',
      keywords: ['map', 'location', 'address', 'venue', '地图', '位置', '地点', '地址'],
      responseText: 'We have received your location question. Please provide the club or course name, along with the map link or location details you entered, and we will help you verify whether the map is displaying correctly.',
      priority: 40,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'registration-publish',
      keywords: ['register', 'registration', 'publish', 'approved', 'review', '注册', '发布', '审核', '审批'],
      responseText: 'We have received your registration or publishing question. Please let us know whether this is about club registration or course publishing, and tell us which step you are stuck on so we can help you continue.',
      priority: 50,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'club-course-info',
      keywords: ['club', 'course', 'info', 'information', 'detail', 'details', '俱乐部', '课程', '信息', '详情', '介绍'],
      responseText: 'We have received your information request. Please tell us which club or course you want to know about, and we can help you check the introduction, schedule, location, fee, and available booking slots.',
      priority: 60,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'cancel-reschedule',
      keywords: ['cancel', 'cancellation', 'reschedule', 'change booking', 'change slot', '取消', '改期', '更改时间', '换时间'],
      responseText: 'If you need to cancel or change a booking, please send the club or course name, the date and time, and the reason for the change. We can then help you check the next available step.',
      priority: 70,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'dashboard-records',
      keywords: ['dashboard', 'record', 'records', 'history', 'my booking', 'bookings', '我的预约', '记录', '历史'],
      responseText: 'You can review your club bookings, course bookings, and support records in the user dashboard. If anything is missing, please send the related club or course name and the booking date.',
      priority: 80,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'attachments-proof',
      keywords: ['attachment', 'attachments', 'upload', 'image', 'images', 'screenshot', 'screenshots', 'file', '附件', '上传', '截图', '图片'],
      responseText: 'You can include screenshots or other attachments to help us review the issue more quickly. If you are reporting a booking or payment problem, please also include the club or course name and the relevant date and time.',
      priority: 90,
      requiresHuman: false,
      isDefault: false,
      isActive: true
    },
    {
      ruleName: 'login-account',
      keywords: ['login', 'log in', 'sign in', 'signup', 'sign up', 'account', 'password', '登录', '注册账号', '账户', '密码'],
      responseText: 'If you are having trouble logging in or creating an account, please tell us which step failed and what message you saw on screen. A screenshot is especially helpful for account issues.',
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
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
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
      clubs: [],
      courses: []
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
        clubs: [],
        courses: []
      };
    }

    var client = getSupabaseClientSafe();
    if (!client) {
      return {
        todayIso: formatSupportIso(new Date()),
        clubs: [],
        courses: []
      };
    }

    var todayIso = formatSupportIso(new Date());
    var clubPromise = client
      .from('clubs')
      .select('id, slug, name, category, mode, location, map_link, time_text, fee_text, seats, status')
      .eq('status', 'approved')
      .order('name', { ascending: true });

    var slotPromise = client
      .from('club_slots')
      .select('id, club_id, day_iso, start_time, end_time, capacity, status')
      .eq('day_iso', todayIso)
      .order('start_time', { ascending: true });

    var availabilityPromise = client.rpc('get_club_booking_availability', {
      p_start_date: todayIso,
      p_end_date: todayIso
    });

    var coursePromise = client
      .from('courses')
      .select(SUPPORT_COURSE_SELECT)
      .order('created_at', { ascending: false });

    var results = await Promise.all([clubPromise, slotPromise, availabilityPromise, coursePromise]);
    var clubResult = results[0] || {};
    var slotResult = results[1] || {};
    var availabilityResult = results[2] || {};
    var courseResult = results[3] || {};

    if (clubResult.error) throw clubResult.error;
    if (slotResult.error) throw slotResult.error;
    if (availabilityResult.error) throw availabilityResult.error;
    if (courseResult.error && isSupportMissingCourseMapLinkColumn(courseResult.error)) {
      courseResult = await client
        .from('courses')
        .select('id, slug, club_id, title, level, mode, time_text, schedule, location, fee_text, seats, created_at, club:clubs(name, slug, category)')
        .order('created_at', { ascending: false });
    }

    if (courseResult.error) throw courseResult.error;

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
      if (!slotGroups[clubId]) slotGroups[clubId] = [];
      slotGroups[clubId].push({
        id: normalizeId(slot.id),
        time: buildSupportSlotTime(slot.start_time, slot.end_time),
        remaining: remaining,
        capacity: Number(slot.capacity || 0)
      });
    });

    var clubs = (Array.isArray(clubResult.data) ? clubResult.data : []).map(function (club) {
      var clubId = normalizeId(club && club.id);
      var todaySlots = (slotGroups[clubId] || []).sort(function (a, b) {
        return supportTimeSortValue(a.time) - supportTimeSortValue(b.time);
      });
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
        todaySlots: todaySlots,
        totalRemainingToday: todaySlots.reduce(function (sum, slot) {
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
        totalRemainingSeats: Math.max(totalCapacity - bookedCount, 0),
        totalCapacity: totalCapacity,
        perSlotSeats: perSlotSeats
      };
    }).filter(function (course) {
      return !!course.title;
    });

    supportDynamicContextCache = {
      todayIso: todayIso,
      clubs: clubs,
      courses: courses
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

  function formatSupportSlotList(slots, maxItems) {
    return (Array.isArray(slots) ? slots : []).filter(function (slot) {
      return Number(slot && slot.remaining || 0) > 0;
    }).slice(0, maxItems || 3).map(function (slot) {
      return slot.time + ' (' + Math.max(0, Number(slot.remaining || 0)) + ' left)';
    }).join(', ');
  }

  function buildBookingScheduleReply(payload, fallbackText, context) {
    var text = trimText(payload && payload.text);
    var clubs = Array.isArray(context && context.clubs) ? context.clubs : [];
    var courses = Array.isArray(context && context.courses) ? context.courses : [];
    var matchedClubs = pickSupportMatches(text, clubs, function (club) {
      return [club.name, club.slug];
    }, 2);
    var matchedCourses = pickSupportMatches(text, courses, function (course) {
      return [course.title, course.slug, course.clubName];
    }, 2);
    var normalizedText = normalizeSupportLookupText(text);
    var asksForCourse = normalizedText.indexOf('course') > -1 || normalizedText.indexOf('课程') > -1;

    if (matchedClubs.length) {
      var club = matchedClubs[0];
      if (Number(club.totalRemainingToday || 0) > 0) {
        return 'Today ' + club.name + ' can be booked. Available slots: ' + formatSupportSlotList(club.todaySlots, 4) + '. Location: ' + (club.location || 'not provided') + '. Fee: ' + (club.feeText || 'free') + '.';
      }
      return club.name + ' does not currently show a bookable slot for today. Registered regular time: ' + (club.timeText || 'not provided yet') + '. If you want, send another date and I can help you check again.';
    }

    if (asksForCourse || matchedCourses.length) {
      var course = matchedCourses[0];
      if (course) {
        return 'Current booking info for ' + course.title + ': schedules ' + (course.schedule.join(' / ') || 'not provided') + ', total remaining seats ' + Math.max(0, Number(course.totalRemainingSeats || 0)) + ', location ' + (course.location || 'not provided') + ', fee ' + (course.feeText || 'free') + '.';
      }
      var openCourses = courses.filter(function (item) {
        return Number(item.totalRemainingSeats || 0) > 0;
      }).slice(0, 4);
      if (openCourses.length) {
        return 'Courses that currently have seats available include: ' + openCourses.map(function (item) {
          return item.title + ' (' + Math.max(0, Number(item.totalRemainingSeats || 0)) + ' seats left)';
        }).join(', ') + '. Send the course name if you want the exact schedule and booking details.';
      }
    }

    var todayBookableClubs = clubs.filter(function (club) {
      return Number(club.totalRemainingToday || 0) > 0;
    }).slice(0, 4);
    if (todayBookableClubs.length) {
      return 'Today these clubs currently have bookable slots: ' + todayBookableClubs.map(function (club) {
        return club.name + ' (' + formatSupportSlotList(club.todaySlots, 2) + ')';
      }).join('; ') + '. Send a club name if you want me to narrow it down.';
    }

    return fallbackText;
  }

  function buildClubCourseInfoReply(payload, fallbackText, context) {
    var text = trimText(payload && payload.text);
    var clubs = Array.isArray(context && context.clubs) ? context.clubs : [];
    var courses = Array.isArray(context && context.courses) ? context.courses : [];
    var matchedClubs = pickSupportMatches(text, clubs, function (club) {
      return [club.name, club.slug];
    }, 1);
    if (matchedClubs.length) {
      var club = matchedClubs[0];
      var extra = Number(club.totalRemainingToday || 0) > 0
        ? (' Today\'s bookable slots: ' + formatSupportSlotList(club.todaySlots, 3) + '.')
        : '';
      return 'Here is the current information for ' + club.name + '. Location: ' + (club.location || 'not provided') + '. Regular time: ' + (club.timeText || 'not provided yet') + '. Fee: ' + (club.feeText || 'free') + '.' + extra;
    }
    var matchedCourses = pickSupportMatches(text, courses, function (course) {
      return [course.title, course.slug, course.clubName];
    }, 1);
    if (matchedCourses.length) {
      var course = matchedCourses[0];
      return 'Here is the current information for ' + course.title + '. Schedules: ' + (course.schedule.join(' / ') || 'not provided') + '. Location: ' + (course.location || 'not provided') + '. Fee: ' + (course.feeText || 'free') + '. Total remaining seats: ' + Math.max(0, Number(course.totalRemainingSeats || 0)) + '.';
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
      return 'The registered location for ' + club.name + ' is ' + (club.location || 'not provided') + '. ' + (club.mapLink ? ('Saved map link: ' + club.mapLink) : 'There is currently no saved map link for this club.');
    }
    var matchedCourses = pickSupportMatches(text, courses, function (course) {
      return [course.title, course.slug, course.clubName];
    }, 1);
    if (matchedCourses.length) {
      var course = matchedCourses[0];
      return 'The registered location for ' + course.title + ' is ' + (course.location || 'not provided') + '. ' + (course.mapLink ? ('Saved map link: ' + course.mapLink) : 'There is currently no saved map link for this course.');
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
        return 'We could not find that order ID in your current club bookings. Please double-check the order ID and send it again, or include the club name and booking date.';
      }
      return 'We found your order ' + match.orderId + ': ' + (match.clubName || 'Club booking') + ', ' + (match.dayIso || 'date not provided') + ' ' + (match.slotTime || '').trim() + '. Booking status: ' + (match.status || 'unknown') + '. Payment status: ' + (match.paymentStatus || 'unknown') + '. If you need a refund review, please reply with the reason for the request.';
    } catch (error) {
      return fallbackText;
    }
  }

  function cloneSupportAutoReplyRule(rule) {
    var item = rule || {};
    return {
      id: normalizeId(item.id),
      ruleName: trimText(item.ruleName || item.rule_name),
      keywords: Array.isArray(item.keywords) ? item.keywords.map(trimText).filter(Boolean) : [],
      responseText: trimText(item.responseText || item.response_text),
      priority: Number(item.priority || 0) || 0,
      requiresHuman: !!(item.requiresHuman || item.requires_human),
      isDefault: !!(item.isDefault || item.is_default),
      isActive: item.isActive === undefined ? (item.is_active !== false) : !!item.isActive
    };
  }

  function fallbackSupportAutoReplyRules() {
    return FALLBACK_SUPPORT_AUTO_REPLY_RULES.map(cloneSupportAutoReplyRule);
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

      supportAutoReplyRulesCache = rows.length ? rows : fallbackSupportAutoReplyRules();
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
        requiresHuman: false,
        ruleName: 'attachments-only'
      };
    }

    var rules = await fetchSupportAutoReplyRules();
    var rule = pickSupportAutoReplyRule(text, rules);
    if (rule && trimText(rule.responseText)) {
      var resolvedText = trimText(rule.responseText);
      if (isConfigured()) {
        try {
          var context = await fetchSupportDynamicContext();
          if (trimText(rule.ruleName) === 'booking-schedule') {
            resolvedText = trimText(buildBookingScheduleReply(payload, resolvedText, context)) || resolvedText;
          } else if (trimText(rule.ruleName) === 'club-course-info') {
            resolvedText = trimText(buildClubCourseInfoReply(payload, resolvedText, context)) || resolvedText;
          } else if (trimText(rule.ruleName) === 'maps-location') {
            resolvedText = trimText(buildMapsLocationReply(payload, resolvedText, context)) || resolvedText;
          } else if (trimText(rule.ruleName) === 'payment-refund') {
            resolvedText = trimText(await buildPaymentRefundReply(payload, resolvedText)) || resolvedText;
          }
        } catch (error) {}
      }
      return {
        text: resolvedText,
        requiresHuman: !!rule.requiresHuman,
        ruleName: trimText(rule.ruleName)
      };
    }

    return {
      text: SUPPORT_DEFAULT_REPLY,
      requiresHuman: false,
      ruleName: 'default'
    };
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

    var autoReply = await resolveSupportAutoReply({
      text: text,
      attachments: attachments,
      category: trimText(payload && payload.category) || 'General',
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
        message_text: autoReplyText,
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
