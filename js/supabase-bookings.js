(function (window) {
  'use strict';

  function trimText(value) {
    return String(value || '').trim();
  }

  function toArray(value) {
    return Array.isArray(value)
      ? value.map(function (item) { return trimText(item); }).filter(Boolean)
      : [];
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimText(value));
  }

  function isMissingBookingPaymentAuditColumn(error) {
    var text = trimText(error && (error.message || error.details || error.hint || error.code));
    return /payment_method|payer_email|\bbase_fee\b|\bservice_fee\b|\bdiscount\b|\bpayable_amount\b/i.test(text);
  }

  function isLegacyCreateBookingRpcSignature(error) {
    var text = trimText(error && (error.message || error.details || error.hint || error.code));
    return /create_club_booking/i.test(text) && (/schema cache|could not find the function|p_payment_method|p_payer_email/i.test(text));
  }

  function isDuplicateClubMemberError(error) {
    var text = trimText(error && (error.message || error.details || error.hint || error.code));
    return /duplicate key|already exists|club_members/i.test(text);
  }

  function buildClubMemberName(authUser, fallbackEmail) {
    var metadata = authUser && authUser.user_metadata && typeof authUser.user_metadata === 'object'
      ? authUser.user_metadata
      : {};
    var nickname = trimText(metadata.nickname || metadata.full_name || metadata.name);
    if (nickname) return nickname;
    var email = normalizeEmail(authUser && authUser.email) || normalizeEmail(fallbackEmail);
    if (email) {
      return trimText(email.split('@')[0]) || 'Club Member';
    }
    return 'Club Member';
  }

  async function ensureClubMembership(client, clubId, fallbackEmail) {
    var normalizedClubId = trimText(clubId);
    if (!client || !normalizedClubId || !client.auth || typeof client.auth.getUser !== 'function') return;

    try {
      var authResult = await client.auth.getUser();
      var authUser = authResult && authResult.data ? authResult.data.user : null;
      var userId = trimText(authUser && authUser.id);
      var userEmail = normalizeEmail(authUser && authUser.email) || normalizeEmail(fallbackEmail);
      if (!userId) return;

      var existingResult = await client
        .from('club_members')
        .select('id')
        .eq('club_id', normalizedClubId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingResult.error) {
        console.warn('Unable to check existing club membership after booking.', existingResult.error);
      } else if (existingResult.data && existingResult.data.id) {
        return;
      }

      var insertResult = await client
        .from('club_members')
        .insert({
          club_id: normalizedClubId,
          user_id: userId,
          member_name: buildClubMemberName(authUser, userEmail),
          user_email: userEmail,
          member_role: 'member'
        });

      if (insertResult.error && !isDuplicateClubMemberError(insertResult.error)) {
        console.warn('Unable to sync club membership after booking.', insertResult.error);
      }
    } catch (error) {
      console.warn('Unable to sync club membership after booking.', error);
    }
  }

  function formatClubFeeText(value) {
    var text = trimText(value).replace(/^[£$€¥]\s*/, '');
    if (!text) return '';
    if (/^\.[0-9]+(?:\b|[^0-9])/.test(text)) {
      return '£0' + text;
    }
    if (/^\d+(?:\.\d+)?(?:\b|[^A-Za-z0-9])/.test(text)) {
      return '£' + text;
    }
    return text;
  }

  var LEGACY_AUTO_COVER_PATHS = {
    '../zp/zq.webp': true,
    '../zp/ymq.webp': true,
    '../zp/gywm.webp': true
  };

  function normalizeCoverValue(value) {
    var text = trimText(value);
    return text;
  }

  var CLUB_COVER_MAP = {
    football: '../zp/zq.webp',
    badminton: '../zp/ymq.webp',
    swimming: '../zp/yy1.webp',
    cycling: '../zp/qx.webp',
    programming: '../zp/bc.webp',
    tennis: '../zp/wq.webp',
    music: '../zp/yy.webp',
    running: '../zp/pb.webp',
    basketball: '../zp/lq.webp',
    golf: '../zp/grf.webp',
    rugby: '../zp/glq.webp',
    handball: '../zp/sj.webp',
    gymnastics: '../zp/tc.webp',
    pingpong: '../zp/ppq.webp',
    baseball: '../zp/bq.webp',
    volleyball: '../zp/pq.webp',
    pickleball: '../zp/pkq.webp'
  };

  var CLUB_CUSTOM_COVER_SLUGS = {
    basketball: true,
    golf: true,
    rugby: true,
    handball: true,
    gymnastics: true,
    pingpong: true,
    volleyball: true,
    pickleball: true,
    baseball: true
  };

  var LEGACY_GENERIC_COVER_SET = {
    '../zp/hb1.webp': true,
    '../zp/hb2.webp': true,
    '../zp/hb3.webp': true
  };

  var LEGACY_STATIC_CLUB_DESC_FRAGMENTS = {
    football: ['friendly matches for a range of skill levels', 'match preparation for new and returning members'],
    badminton: ['regular training and campus competitions', 'doubles practice, casual games, and club match play'],
    swimming: ['stroke and endurance training for beginners through advanced swimmers', 'fitness training, safety guidance, and technique support'],
    cycling: ['weekend long-distance sessions with meet-up details', 'group city rides and route planning sessions'],
    programming: ['learn web, python, and ai fundamentals', 'project-driven coding workshops focused on web development'],
    tennis: ['doubles training and weekend activities with bookable sessions', 'serve practice, weekend rallies, and welcoming tennis sessions'],
    music: ['instrument exchange, ensemble rehearsals, and performance sign-up', 'hybrid rehearsal and showcase sessions for ensemble practice'],
    running: ['weekly group runs and campus running events', 'endurance-building runs and pacing sessions'],
    basketball: ['campus league sign-up with basic tactical coaching and scrimmages', 'shooting drills, teamwork drills, and half-court games'],
    golf: ['weekend experience sessions for beginners and casual players', 'swing basics, weekend experience rounds'],
    rugby: ['inter-school competition sign-up and tactical drills', 'tactical drills, strength work, and preparation for external fixtures'],
    handball: ['team coordination sessions and small-court games', 'attack and defense structure, movement coordination, and team drills'],
    gymnastics: ['foundational flexibility and strength training with movement demos', 'focused on flexibility, core movement patterns, and guided open practice'],
    pingpong: ['indoor table tennis sessions covering footwork, serve-return routines'],
    volleyball: ['structured volleyball practice in passing, setting, serving, attack timing'],
    pickleball: ['beginner-friendly pickleball sessions with serving, doubles movement'],
    baseball: ['fundamentals and live-play baseball practice including throwing, catching, batting']
  };

  function normalizeClubCoverSlug(value) {
    return trimText(value)
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-(club|society)$/g, '');
  }

  function resolveClubCover(slug, value) {
    var normalizedSlug = normalizeClubCoverSlug(slug);
    var text = normalizeCoverValue(value);
    var fallbackCover = CLUB_COVER_MAP[normalizedSlug] || '';
    if (!fallbackCover) return text;
    if (!text) return fallbackCover;
    if (text === fallbackCover) return text;
    if (CLUB_CUSTOM_COVER_SLUGS[normalizedSlug] && LEGACY_GENERIC_COVER_SET[text]) {
      return fallbackCover;
    }
    return text;
  }

  function normalizeEmail(value) {
    return trimText(value).toLowerCase();
  }

  function isLegacyStaticClubSeed(club) {
    var slug = normalizeClubCoverSlug(club && club.slug);
    if (!slug || !Object.prototype.hasOwnProperty.call(LEGACY_STATIC_CLUB_DESC_FRAGMENTS, slug)) {
      return false;
    }
    var desc = trimText(club && (club.desc || club.description)).toLowerCase();
    if (!desc) return false;
    return LEGACY_STATIC_CLUB_DESC_FRAGMENTS[slug].some(function (fragment) {
      return desc.indexOf(fragment) > -1;
    });
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

  function isMissingStructuredClubMapColumn(error) {
    var text = trimText(error && (error.message || error.details || error.hint || error.code));
    return /place_id|formatted_address|map_source|\blat\b|\blng\b|weekly_highlight|\bfaq\b/i.test(text);
  }

  function addDays(date, days) {
    var next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function formatIso(date) {
    var normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    var year = normalized.getFullYear();
    var month = String(normalized.getMonth() + 1).padStart(2, '0');
    var day = String(normalized.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function shortTime(value) {
    var text = trimText(value).slice(0, 5);
    if (!text) return '';
    var parts = text.split(':');
    if (parts.length < 2) return text;
    return String(Number(parts[0])) + ':' + parts[1];
  }

  function buildSlotTime(start, end) {
    return shortTime(start) + '-' + shortTime(end);
  }

  function buildAvailabilityKey(slotId, dayIso) {
    return trimText(slotId) + '|' + trimText(dayIso);
  }

  function slotSortValue(slot) {
    var item = slot || {};
    var start = trimText(item.startTime || item.start_time || item.time_short || item.time);
    var text = start.split('-')[0] ? start.split('-')[0].trim() : start;
    var parts = text.split(':');
    var hour = Number(parts[0] || 0);
    var minute = Number(parts[1] || 0);
    return hour * 60 + minute;
  }

  function buildTemplateSlots(groupedSlots, fallbackCapacity) {
    var seen = {};
    var list = [];
    Object.keys(groupedSlots || {}).forEach(function (dayIso) {
      (Array.isArray(groupedSlots[dayIso]) ? groupedSlots[dayIso] : []).forEach(function (slot, index) {
        var time = trimText(slot && slot.time);
        var timeShort = trimText(slot && slot.time_short) || (time ? time.split('-')[0].trim() : '');
        var startTime = trimText(slot && slot.startTime) || timeShort;
        var key = startTime + '|' + time + '|' + timeShort;
        if (!time || seen[key]) return;
        seen[key] = true;
        list.push({
          id: trimText(slot && slot.id) || ('template-slot-' + index),
          time: time,
          time_short: timeShort,
          startTime: startTime,
          endTime: trimText(slot && slot.endTime),
          capacity: Number(slot && slot.capacity || fallbackCapacity || 0)
        });
      });
    });
    return list.sort(function (a, b) {
      return slotSortValue(a) - slotSortValue(b);
    });
  }

  function timeTextToMinutes(value) {
    var match = trimText(value).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    var hour = Number(match[1]);
    var minute = Number(match[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
  }

  function minutesToTimeText(totalMinutes) {
    var value = Number(totalMinutes);
    if (!Number.isFinite(value) || value < 0) return '';
    var hour = Math.floor(value / 60);
    var minute = value % 60;
    return String(hour) + ':' + String(minute).padStart(2, '0');
  }

  function weekdayTokenToIndex(value) {
    var token = trimText(value).toLowerCase().replace(/\./g, '');
    var map = {
      sun: 0,
      sunday: 0,
      mon: 1,
      monday: 1,
      tue: 2,
      tues: 2,
      tuesday: 2,
      wed: 3,
      weds: 3,
      wednesday: 3,
      thu: 4,
      thur: 4,
      thurs: 4,
      thursday: 4,
      fri: 5,
      friday: 5,
      sat: 6,
      saturday: 6
    };
    return Object.prototype.hasOwnProperty.call(map, token) ? map[token] : null;
  }

  function dayIsoToWeekdayIndex(dayIso) {
    var date = new Date(trimText(dayIso) + 'T12:00:00');
    return Number.isNaN(date.getTime()) ? null : date.getDay();
  }

  function parseWeeklyTimeEntries(raw) {
    return String(raw || '')
      .replace(/[–—]/g, '-')
      .split(/\n|·|\|/)
      .map(function (item) { return trimText(item); })
      .filter(Boolean)
      .map(function (item) {
        var match = item.match(/^(.*?)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
        if (!match) return null;
        var dayLabel = trimText(match[1]);
        var dayIndex = weekdayTokenToIndex(dayLabel);
        var startMinutes = timeTextToMinutes(match[2]);
        var endMinutes = timeTextToMinutes(match[3]);
        if (dayIndex === null || startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
          return null;
        }
        return {
          dayLabel: dayLabel,
          dayIndex: dayIndex,
          startMinutes: startMinutes,
          endMinutes: endMinutes
        };
      })
      .filter(Boolean);
  }

  function buildWeeklyTemplateSlots(entries, capacity, clubKey) {
    var seen = {};
    var list = [];
    (Array.isArray(entries) ? entries : []).forEach(function (entry) {
      for (var cursor = entry.startMinutes; cursor < entry.endMinutes; cursor += 60) {
        var next = Math.min(cursor + 60, entry.endMinutes);
        if (next <= cursor) break;
        var startText = minutesToTimeText(cursor);
        var endText = minutesToTimeText(next);
        var time = startText + '-' + endText;
        if (seen[time]) continue;
        seen[time] = true;
        list.push({
          id: 'weekly-template-' + trimText(clubKey || 'club') + '-' + entry.dayIndex + '-' + cursor + '-' + next,
          time: time,
          time_short: startText,
          startTime: startText,
          endTime: endText,
          capacity: Number(capacity || 0)
        });
      }
    });
    return list.sort(function (a, b) {
      return slotSortValue(a) - slotSortValue(b);
    });
  }

  function buildWeeklySlotsForDay(entries, dayIso, capacity, clubKey) {
    var dayIndex = dayIsoToWeekdayIndex(dayIso);
    if (!Array.isArray(entries) || !entries.length || dayIndex === null) return [];
    var list = [];
    entries.filter(function (entry) {
      return entry.dayIndex === dayIndex;
    }).forEach(function (entry) {
      for (var cursor = entry.startMinutes; cursor < entry.endMinutes; cursor += 60) {
        var next = Math.min(cursor + 60, entry.endMinutes);
        if (next <= cursor) break;
        var startText = minutesToTimeText(cursor);
        var endText = minutesToTimeText(next);
        list.push({
          id: 'weekly-' + trimText(clubKey || 'club') + '-' + entry.dayIndex + '-' + cursor + '-' + next,
          dbId: '',
          time: startText + '-' + endText,
          time_short: startText,
          capacity: Number(capacity || 0),
          dayIso: trimText(dayIso),
          dayLabel: trimText(dayIso),
          startTime: startText,
          endTime: endText,
          bookedCount: 0
        });
      }
    });
    return list.sort(function (a, b) {
      return slotSortValue(a) - slotSortValue(b);
    });
  }

  function mergeSlotsByTime(primary, secondary) {
    var byTime = {};
    (Array.isArray(secondary) ? secondary : []).forEach(function (slot) {
      var slotTime = trimText(slot && slot.time);
      if (slotTime) byTime[slotTime] = slot;
    });
    (Array.isArray(primary) ? primary : []).forEach(function (slot) {
      var slotTime = trimText(slot && slot.time);
      if (slotTime) byTime[slotTime] = slot;
    });
    return Object.keys(byTime).map(function (slotTime) {
      return byTime[slotTime];
    }).sort(function (a, b) {
      return slotSortValue(a) - slotSortValue(b);
    });
  }

  function combineTemplateLists(lists, fallbackCapacity) {
    var indexByTime = {};
    var combined = [];
    (Array.isArray(lists) ? lists : []).forEach(function (list) {
      (Array.isArray(list) ? list : []).forEach(function (slot) {
        var time = trimText(slot && slot.time);
        if (!time) return;
        var timeShort = trimText(slot && slot.time_short) || (time ? time.split('-')[0].trim() : '');
        var item = {
          id: trimText(slot && slot.id) || ('template-slot-' + combined.length),
          time: time,
          time_short: timeShort,
          startTime: trimText(slot && slot.startTime) || timeShort,
          endTime: trimText(slot && slot.endTime),
          capacity: Number(slot && slot.capacity || fallbackCapacity || 0)
        };
        if (Object.prototype.hasOwnProperty.call(indexByTime, time)) {
          combined[indexByTime[time]] = item;
          return;
        }
        indexByTime[time] = combined.length;
        combined.push(item);
      });
    });
    return combined.sort(function (a, b) {
      return slotSortValue(a) - slotSortValue(b);
    });
  }

  function buildDayIsoRange(startDate, endDate) {
    var start = new Date(startDate);
    var end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    var list = [];
    for (var current = new Date(start); current <= end; current = addDays(current, 1)) {
      list.push(formatIso(current));
    }
    return list;
  }

  function mapBookingStatus(status) {
    var value = trimText(status).toLowerCase();
    if (value === 'pending_payment') return 'Pending Payment';
    if (value === 'booked') return 'Booked';
    if (value === 'checked_in') return 'Checked In';
    if (value === 'completed') return 'Completed';
    if (value === 'cancelled') return 'Cancelled';
    if (value === 'no_show') return 'No Show';
    return trimText(status) || 'Booked';
  }

  function mapAvailability(rows) {
    var out = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row) return;
      out[buildAvailabilityKey(row.slot_id, row.day_iso)] = Number(row.booked_count || 0);
    });
    return out;
  }

  function buildClubCatalog(clubs, slots, availabilityMap, startDate, endDate) {
    var slotGroups = {};
    (Array.isArray(slots) ? slots : []).forEach(function (slot) {
      if (!slot || !slot.club_id || !slot.id || trimText(slot.status).toLowerCase() === 'closed') return;
      var clubKey = trimText(slot.club_id);
      if (!slotGroups[clubKey]) slotGroups[clubKey] = {};
      var dayIso = trimText(slot.day_iso);
      if (!slotGroups[clubKey][dayIso]) slotGroups[clubKey][dayIso] = [];
      slotGroups[clubKey][dayIso].push({
        id: trimText(slot.id),
        dbId: trimText(slot.id),
        time: buildSlotTime(slot.start_time, slot.end_time),
        time_short: shortTime(slot.start_time),
        capacity: Number(slot.capacity || 0),
        dayIso: dayIso,
        dayLabel: dayIso,
        startTime: trimText(slot.start_time),
        endTime: trimText(slot.end_time),
        bookedCount: Number(availabilityMap[buildAvailabilityKey(slot.id, dayIso)] || 0)
      });
    });

    var dayRange = buildDayIsoRange(startDate, endDate);

    return (Array.isArray(clubs) ? clubs : []).map(function (club) {
      var grouped = slotGroups[trimText(club.id)] || {};
      var seats = Number(club && club.seats || 0);
      var weeklyEntries = parseWeeklyTimeEntries(club && club.time_text);
      var actualTemplate = buildTemplateSlots(grouped, seats);
      var weeklyTemplate = buildWeeklyTemplateSlots(weeklyEntries, seats, trimText(club && (club.id || club.slug)) || 'club');
      var template = combineTemplateLists([actualTemplate, weeklyTemplate], seats);
      var timeSummary = trimText(club && club.time_text);
      var normalizedByDay = {};

      if (!timeSummary && (actualTemplate.length || weeklyTemplate.length)) {
        var summarySource = actualTemplate.length ? actualTemplate : weeklyTemplate;
        timeSummary = summarySource.slice(0, 2).map(function (slot) {
          return trimText(slot && slot.time);
        }).filter(Boolean).join(' / ');
      }

      Object.keys(grouped).forEach(function (dayIso) {
        normalizedByDay[dayIso] = (Array.isArray(grouped[dayIso]) ? grouped[dayIso] : []).slice().sort(function (a, b) {
          return slotSortValue(a) - slotSortValue(b);
        });
      });

      if (dayRange.length) {
        dayRange.forEach(function (dayIso) {
          var actual = Array.isArray(normalizedByDay[dayIso]) ? normalizedByDay[dayIso].slice() : [];
          var generated = buildWeeklySlotsForDay(weeklyEntries, dayIso, seats, trimText(club && (club.id || club.slug)) || 'club');
          var mergedActual = mergeSlotsByTime(actual, generated);
          if (mergedActual.length) {
            normalizedByDay[dayIso] = mergedActual;
          }
        });
      }

      return {
        id: trimText(club.id),
        dbId: trimText(club.id),
        slug: trimText(club.slug),
        name: trimText(club.name) || 'Unnamed Club',
        category: trimText(club.category) || 'Sports',
        mode: trimText(club.mode) || 'In-person',
        location: trimText(club.location) || 'Location TBD',
        mapLink: trimText(club.map_link),
        placeId: trimText(club.place_id),
        formattedAddress: trimText(club.formatted_address),
        lat: trimText(club.lat),
        lng: trimText(club.lng),
        mapSource: trimText(club.map_source),
        onlineLink: trimText(club.online_link),
        time: timeSummary,
        seats: Number(club.seats || 0) || 20,
        fee: formatClubFeeText(club.fee_text) || '£0',
        cover: resolveClubCover(trimText(club.slug), club.cover_url),
        tags: toArray(club.tags),
        desc: trimText(club.description),
        heroSub: trimText(club.hero_sub),
        weeklyHighlight: trimText(club.weekly_highlight),
        venueInfo: trimText(club.venue_info),
        whatWeDo: trimText(club.what_we_do),
        audience: trimText(club.audience),
        trainingPlan: trimText(club.training_plan),
        notes: trimText(club.notes),
        faq: trimText(club.faq),
        slots: template,
        slotsByDay: normalizedByDay
      };
    }).filter(function (club) {
      return !!club.slug && !isLegacyStaticClubSeed(club);
    });
  }

  async function fetchClubCatalog(options) {
    var client = getSupabaseClientSafe();
    if (!client) return { clubs: [], availabilityMap: {} };

    var startDate = trimText(options && options.startDate) || formatIso(new Date());
    var endDate = trimText(options && options.endDate) || formatIso(addDays(new Date(startDate), 27));

    var clubSelect = 'id, slug, name, category, mode, location, map_link, place_id, formatted_address, lat, lng, map_source, online_link, time_text, fee_text, cover_url, tags, description, hero_sub, weekly_highlight, faq, venue_info, what_we_do, audience, training_plan, notes, seats, status';
    var clubSelectLegacy = 'id, slug, name, category, mode, location, map_link, online_link, time_text, fee_text, cover_url, tags, description, hero_sub, venue_info, what_we_do, audience, training_plan, notes, seats, status';

    var clubQuery = client
      .from('clubs')
      .select(clubSelect)
      .order('name', { ascending: true });

    var slotQuery = client
      .from('club_slots')
      .select('id, club_id, day_iso, start_time, end_time, capacity, status')
      .gte('day_iso', startDate)
      .lte('day_iso', endDate)
      .order('day_iso', { ascending: true })
      .order('start_time', { ascending: true });

    var availabilityPromise = client.rpc('get_club_booking_availability', {
      p_start_date: startDate,
      p_end_date: endDate
    });

    var results = await Promise.all([clubQuery, slotQuery, availabilityPromise]);
    var clubRows = results[0] && results[0].data ? results[0].data : [];
    var clubError = results[0] && results[0].error;
    var slotRows = results[1] && results[1].data ? results[1].data : [];
    var slotError = results[1] && results[1].error;
    var availabilityRows = results[2] && results[2].data ? results[2].data : [];
    var availabilityError = results[2] && results[2].error;

    if (clubError && isMissingStructuredClubMapColumn(clubError)) {
      var legacyClubResult = await client
        .from('clubs')
        .select(clubSelectLegacy)
        .order('name', { ascending: true });
      clubRows = legacyClubResult && legacyClubResult.data ? legacyClubResult.data : [];
      clubError = legacyClubResult && legacyClubResult.error;
    }

    if (clubError) throw clubError;
    if (slotError) throw slotError;
    if (availabilityError) throw availabilityError;

    var availabilityMap = mapAvailability(availabilityRows);
    return {
      clubs: buildClubCatalog(clubRows, slotRows, availabilityMap, startDate, endDate),
      availabilityMap: availabilityMap
    };
  }

  function mapBookingRecord(row) {
    var club = row && row.club ? row.club : {};
    var payerEmail = normalizeEmail(row && row.payer_email);
    return {
      id: trimText(row && row.id),
      orderId: trimText(row && row.order_id),
      clubId: trimText(row && row.club_id),
      clubSlug: trimText(club.slug),
      clubName: trimText(club.name),
      dayIso: trimText(row && row.day_iso),
      dayLabel: trimText(row && row.day_label) || trimText(row && row.day_iso),
      slotId: trimText(row && row.slot_id),
      slotTime: trimText(row && row.slot_time),
      location: trimText(row && row.location),
      fee: formatClubFeeText(row && row.fee_text) || '£0',
      userEmail: payerEmail,
      payerEmail: payerEmail,
      createdAt: trimText(row && row.created_at),
      cancelledAt: trimText(row && row.cancelled_at),
      status: mapBookingStatus(row && row.status),
      paymentStatus: trimText(row && row.payment_status),
      paymentMethod: trimText(row && row.payment_method) || '',
      baseFee: Number(row && row.base_fee || 0),
      serviceFee: Number(row && row.service_fee || 0),
      discount: Number(row && row.discount || 0),
      paidAmount: Number(row && row.payable_amount || 0),
      couponCode: ''
    };
  }

  async function fetchMyBookings(userId, fallbackEmail) {
    var client = getSupabaseClientSafe();
    if (!client || !trimText(userId)) return [];

    var result = await client
      .from('club_bookings')
      .select('id, order_id, club_id, slot_id, day_iso, day_label, slot_time, location, fee_text, status, payment_status, payment_method, payer_email, cancelled_at, created_at, base_fee, service_fee, discount, payable_amount, club:clubs(name, slug)')
      .eq('user_id', trimText(userId))
      .order('created_at', { ascending: false });

    if (result.error && isMissingBookingPaymentAuditColumn(result.error)) {
      result = await client
        .from('club_bookings')
        .select('id, order_id, club_id, slot_id, day_iso, day_label, slot_time, location, fee_text, status, payment_status, cancelled_at, created_at, payable_amount, club:clubs(name, slug)')
        .eq('user_id', trimText(userId))
        .order('created_at', { ascending: false });
    }

    if (result.error) throw result.error;

    return (result.data || []).map(function (row) {
      var mapped = mapBookingRecord(row);
      if (!mapped.userEmail) {
        mapped.userEmail = normalizeEmail(fallbackEmail);
      }
      if (!mapped.payerEmail) {
        mapped.payerEmail = mapped.userEmail;
      }
      return mapped;
    });
  }

  function mapCreateBookingError(error) {
    var text = trimText(error && error.message).toLowerCase();
    if (text.indexOf('slot_not_synced') > -1 || text.indexOf('invalid input syntax for type uuid') > -1) {
      return 'This club schedule has not finished syncing yet. Please ask the club owner to open Edit Club and save once, then try booking again.';
    }
    if (text.indexOf('slot_full') > -1) return 'This slot is already full. Please choose another one.';
    if (text.indexOf('slot_conflict') > -1) return 'You already have another booking in the same time slot.';
    if (text.indexOf('slot_expired') > -1) return 'This slot has expired and can no longer be booked.';
    if (text.indexOf('not_authenticated') > -1) return 'Please log in again before completing payment.';
    if (text.indexOf('duplicate key') > -1) return 'This booking already exists. Please refresh your booking list.';
    return trimText(error && error.message) || 'Unable to sync the booking to Supabase right now.';
  }

  async function createBooking(order, userEmail) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var slotId = trimText(order && order.slotId);
    if (!isUuid(slotId)) {
      throw new Error('slot_not_synced');
    }

    var result = await client.rpc('create_club_booking', {
      p_order_id: trimText(order && order.orderId),
      p_club_id: trimText(order && order.clubId),
      p_slot_id: slotId,
      p_location: trimText(order && order.location),
      p_fee_text: trimText(order && order.feeText),
      p_base_fee: Number(order && order.baseFee || 0),
      p_service_fee: Number(order && order.serviceFee || 0),
      p_discount: Number(order && order.discount || 0),
      p_payable_amount: Number(order && order.payableAmount || 0),
      p_payment_method: trimText(order && order.paymentMethod),
      p_payer_email: normalizeEmail(order && (order.payerEmail || order.userEmail))
    });

    if (result.error && isLegacyCreateBookingRpcSignature(result.error)) {
      result = await client.rpc('create_club_booking', {
        p_order_id: trimText(order && order.orderId),
        p_club_id: trimText(order && order.clubId),
        p_slot_id: slotId,
        p_location: trimText(order && order.location),
        p_fee_text: trimText(order && order.feeText),
        p_base_fee: Number(order && order.baseFee || 0),
        p_service_fee: Number(order && order.serviceFee || 0),
        p_discount: Number(order && order.discount || 0),
        p_payable_amount: Number(order && order.payableAmount || 0)
      });
    }

    if (result.error) throw result.error;

    var mapped = mapBookingRecord(result.data || {});
    await ensureClubMembership(
      client,
      trimText(order && order.clubId),
      normalizeEmail(order && (order.payerEmail || order.userEmail || userEmail))
    );
    if (!mapped.userEmail) {
      mapped.userEmail = normalizeEmail(userEmail);
    }
    if (!mapped.payerEmail) {
      mapped.payerEmail = mapped.userEmail;
    }
    return mapped;
  }

  async function cancelBooking(bookingId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var result = await client
      .from('club_bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', trimText(bookingId))
      .select('id, order_id, club_id, slot_id, day_iso, day_label, slot_time, location, fee_text, status, payment_status, payment_method, payer_email, cancelled_at, created_at, base_fee, service_fee, discount, payable_amount, club:clubs(name, slug)')
      .single();

    if (result.error && isMissingBookingPaymentAuditColumn(result.error)) {
      result = await client
        .from('club_bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', trimText(bookingId))
        .select('id, order_id, club_id, slot_id, day_iso, day_label, slot_time, location, fee_text, status, payment_status, cancelled_at, created_at, payable_amount, club:clubs(name, slug)')
        .single();
    }

    if (result.error) throw result.error;
    return mapBookingRecord(result.data || {});
  }

  window.clubBookingSupabase = {
    isConfigured: isConfigured,
    fetchClubCatalog: fetchClubCatalog,
    fetchMyBookings: fetchMyBookings,
    createBooking: createBooking,
    cancelBooking: cancelBooking,
    mapCreateBookingError: mapCreateBookingError,
    buildAvailabilityKey: buildAvailabilityKey,
    mapBookingStatus: mapBookingStatus,
    isLegacyStaticClubSeed: isLegacyStaticClubSeed
  };
})(window);
