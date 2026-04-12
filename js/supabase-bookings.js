(function (window) {
  'use strict';

  var DEFAULT_CLUB_PREVIEW_MAP_LINK = 'https://maps.app.goo.gl/f5FyrhZuWWudMy2VA';

  function trimText(value) {
    return String(value || '').trim();
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
      if (!slot || !slot.club_id || !slot.id) return;
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
        mapLink: trimText(club.map_link) || DEFAULT_CLUB_PREVIEW_MAP_LINK,
        onlineLink: trimText(club.online_link),
        time: timeSummary,
        seats: Number(club.seats || 0) || 20,
        fee: trimText(club.fee_text) || '£0',
        cover: resolveClubCover(trimText(club.slug), club.cover_url),
        tags: Array.isArray(club.tags) ? club.tags.filter(Boolean).map(function (tag) { return trimText(tag); }) : [],
        desc: trimText(club.description || club.hero_sub),
        heroSub: trimText(club.hero_sub),
        venueInfo: trimText(club.venue_info),
        whatWeDo: trimText(club.what_we_do),
        audience: trimText(club.audience),
        trainingPlan: trimText(club.training_plan),
        notes: trimText(club.notes),
        slots: template,
        slotsByDay: normalizedByDay
      };
    }).filter(function (club) {
      return !!club.slug;
    });
  }

  async function fetchClubCatalog(options) {
    var client = getSupabaseClientSafe();
    if (!client) return { clubs: [], availabilityMap: {} };

    var startDate = trimText(options && options.startDate) || formatIso(new Date());
    var endDate = trimText(options && options.endDate) || formatIso(addDays(new Date(startDate), 27));

    var clubQuery = client
      .from('clubs')
      .select('id, slug, name, category, mode, location, map_link, online_link, time_text, fee_text, cover_url, tags, description, hero_sub, venue_info, what_we_do, audience, training_plan, notes, seats, status')
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
      fee: trimText(row && row.fee_text) || '£0',
      userEmail: '',
      createdAt: trimText(row && row.created_at),
      cancelledAt: trimText(row && row.cancelled_at),
      status: mapBookingStatus(row && row.status),
      paymentMethod: trimText(row && row.payment_status) === 'paid' ? 'Paid' : trimText(row && row.payment_status),
      paidAmount: Number(row && row.payable_amount || 0),
      couponCode: ''
    };
  }

  async function fetchMyBookings(userId, fallbackEmail) {
    var client = getSupabaseClientSafe();
    if (!client || !trimText(userId)) return [];

    var result = await client
      .from('club_bookings')
      .select('id, order_id, club_id, slot_id, day_iso, day_label, slot_time, location, fee_text, status, payment_status, cancelled_at, created_at, payable_amount, club:clubs(name, slug)')
      .eq('user_id', trimText(userId))
      .order('created_at', { ascending: false });

    if (result.error) throw result.error;

    return (result.data || []).map(function (row) {
      var mapped = mapBookingRecord(row);
      mapped.userEmail = normalizeEmail(fallbackEmail);
      return mapped;
    });
  }

  function mapCreateBookingError(error) {
    var text = trimText(error && error.message).toLowerCase();
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

    var result = await client.rpc('create_club_booking', {
      p_order_id: trimText(order && order.orderId),
      p_club_id: trimText(order && order.clubId),
      p_slot_id: trimText(order && order.slotId),
      p_location: trimText(order && order.location),
      p_fee_text: trimText(order && order.feeText),
      p_base_fee: Number(order && order.baseFee || 0),
      p_service_fee: Number(order && order.serviceFee || 0),
      p_discount: Number(order && order.discount || 0),
      p_payable_amount: Number(order && order.payableAmount || 0)
    });

    if (result.error) throw result.error;

    var mapped = mapBookingRecord(result.data || {});
    mapped.userEmail = normalizeEmail(userEmail);
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
      .select('id, order_id, club_id, slot_id, day_iso, day_label, slot_time, location, fee_text, status, payment_status, cancelled_at, created_at, payable_amount, club:clubs(name, slug)')
      .single();

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
    mapBookingStatus: mapBookingStatus
  };
})(window);
