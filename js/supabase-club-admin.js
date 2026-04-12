(function (window) {
  'use strict';

  var DEMO_CLUB_SLUGS = {
    football: true,
    badminton: true,
    swimming: true,
    cycling: true,
    programming: true,
    tennis: true,
    music: true,
    running: true,
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

  var DEMO_COURSE_SLUGS = {
    'badminton-serve-fundamentals': true,
    'football-passing-basics': true,
    'swimming-breathing-and-stroke': true,
    'cycling-route-planning': true,
    'programming-html-css-foundations': true,
    'tennis-serve-and-rally-basics': true,
    'music-ensemble-rehearsal-skills': true,
    'running-endurance-rhythm': true,
    'basketball-shooting-and-spacing': true,
    'golf-swing-basics': true,
    'rugby-contact-and-shape': true,
    'handball-attack-defense-core': true,
    'gymnastics-core-movement-flexibility': true
  };

  var LEGACY_AUTO_COVER_PATHS = {
    '../zp/zq.webp': true,
    '../zp/ymq.webp': true,
    '../zp/gywm.webp': true
  };

  var COURSE_ADMIN_SELECT = 'id, slug, club_id, title, english_club, level, mode, time_text, schedule, location, map_link, seats, fee_text, cover_url, description, lead, detail, coach_name, coach_title, coach_bio, learning_points, audience_tips, notes_list, owner_id, popularity, created_at, updated_at, club:clubs(id, name, slug, category, cover_url)';
  var COURSE_ADMIN_SELECT_LEGACY = 'id, slug, club_id, title, english_club, level, mode, time_text, schedule, location, seats, fee_text, cover_url, description, lead, detail, coach_name, coach_title, coach_bio, learning_points, audience_tips, notes_list, owner_id, popularity, created_at, updated_at, club:clubs(id, name, slug, category, cover_url)';

  function trimText(value) {
    return String(value || '').trim();
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimText(value));
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

  function normalizeCoverValue(value) {
    var text = trimText(value);
    return text;
  }

  function normalizeEmail(value) {
    return trimText(value).toLowerCase();
  }

  function isDemoClubSlug(value) {
    return !!DEMO_CLUB_SLUGS[trimText(value).toLowerCase()];
  }

  function isDemoCourseSlug(value) {
    return !!DEMO_COURSE_SLUGS[trimText(value).toLowerCase()];
  }

  function toArray(value) {
    return Array.isArray(value)
      ? value.map(function (item) { return trimText(item); }).filter(Boolean)
      : [];
  }

  function toNumber(value, fallback) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : (fallback || 0);
  }

  function formatIsoDate(value) {
    var date = value instanceof Date ? new Date(value.getTime()) : new Date(trimText(value));
    if (Number.isNaN(date.getTime())) {
      date = new Date();
    }
    date.setHours(0, 0, 0, 0);
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function toSqlTime(value, fallbackHour) {
    var text = trimText(value);
    var match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) {
      return String(Number(fallbackHour || 0)).padStart(2, '0') + ':00:00';
    }
    return String(Number(match[1])).padStart(2, '0') + ':' + match[2] + ':00';
  }

  function chunkList(list, size) {
    var items = Array.isArray(list) ? list : [];
    var chunkSize = Math.max(1, Number(size) || 100);
    var out = [];
    for (var index = 0; index < items.length; index += chunkSize) {
      out.push(items.slice(index, index + chunkSize));
    }
    return out;
  }

  function buildClubSlotRows(remoteClub, payload) {
    var rows = [];
    var clubId = trimText(remoteClub && remoteClub.id);
    var seats = Math.max(1, toNumber(payload && payload.seats, 20));
    var slotsByDay = payload && payload.slotsByDay && typeof payload.slotsByDay === 'object'
      ? payload.slotsByDay
      : null;
    if (!clubId || !slotsByDay) return rows;

    Object.keys(slotsByDay).forEach(function (dayIso) {
      var items = Array.isArray(slotsByDay[dayIso]) ? slotsByDay[dayIso] : [];
      items.forEach(function (slot, index) {
        var slotTime = trimText(slot && slot.time);
        var parts = slotTime.split('-');
        rows.push({
          club_id: clubId,
          day_iso: formatIsoDate(dayIso),
          day_label: trimText(slot && slot.dayLabel) || formatIsoDate(dayIso),
          start_time: toSqlTime(slot && (slot.startTime || parts[0]), 9 + index),
          end_time: toSqlTime(slot && (slot.endTime || parts[1]), 10 + index),
          capacity: Math.max(1, toNumber(slot && slot.capacity, seats)),
          status: 'open'
        });
      });
    });

    return rows;
  }

  function buildClubSlotKey(row) {
    return [
      trimText(row && (row.club_id || row.clubId)),
      formatIsoDate(row && (row.day_iso || row.dayIso)),
      toSqlTime(row && (row.start_time || row.startTime), 0),
      toSqlTime(row && (row.end_time || row.endTime), 0)
    ].join('|');
  }

  async function syncClubSlots(client, remoteClub, payload) {
    var clubId = trimText(remoteClub && remoteClub.id);
    if (!clubId) return;

    var rows = buildClubSlotRows(remoteClub, payload);
    var desiredKeys = {};
    rows.forEach(function (row) {
      desiredKeys[buildClubSlotKey(row)] = true;
    });

    if (rows.length) {
      var chunks = chunkList(rows, 150);
      for (var i = 0; i < chunks.length; i += 1) {
        var upsertResult = await client
          .from('club_slots')
          .upsert(chunks[i], { onConflict: 'club_id,day_iso,start_time,end_time' });
        if (upsertResult.error) throw upsertResult.error;
      }
    }

    var existingResult = await client
      .from('club_slots')
      .select('id, club_id, day_iso, start_time, end_time, status')
      .eq('club_id', clubId);
    if (existingResult.error) throw existingResult.error;

    var existingRows = Array.isArray(existingResult.data) ? existingResult.data : [];
    var toClose = existingRows
      .filter(function (row) { return !desiredKeys[buildClubSlotKey(row)] && trimText(row && row.status) !== 'closed'; })
      .map(function (row) { return trimText(row && row.id); })
      .filter(isUuid);

    if (toClose.length) {
      var closeResult = await client
        .from('club_slots')
        .update({ status: 'closed' })
        .in('id', toClose);
      if (closeResult.error) throw closeResult.error;
    }
  }

  function isMissingCourseMapLinkColumn(error) {
    var text = trimText(error && (error.message || error.details || error.hint || error.code));
    return /map_link/i.test(text);
  }

  function withoutCourseMapLink(payload) {
    var next = Object.assign({}, payload || {});
    delete next.map_link;
    return next;
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

  function mapClubStatus(status) {
    return 'approved';
  }

  function mapBookingStatusToDb(status) {
    var value = trimText(status).toLowerCase();
    if (value === 'checked in' || value === 'checked_in') return 'checked_in';
    if (value === 'completed') return 'completed';
    if (value === 'cancelled' || value === 'canceled') return 'cancelled';
    if (value === 'no show' || value === 'no_show') return 'no_show';
    if (value === 'pending payment' || value === 'pending_payment') return 'pending_payment';
    return 'booked';
  }

  function mapBookingStatusFromDb(status) {
    var value = trimText(status).toLowerCase();
    if (value === 'pending_payment') return 'Pending Payment';
    if (value === 'checked_in') return 'Checked In';
    if (value === 'completed') return 'Completed';
    if (value === 'cancelled') return 'Cancelled';
    if (value === 'no_show') return 'No Show';
    return 'Booked';
  }

  function mapClubRow(row) {
    if (!row || !row.id) return null;
    return {
      id: trimText(row.id),
      slug: trimText(row.slug),
      name: trimText(row.name),
      category: trimText(row.category),
      mode: trimText(row.mode),
      location: trimText(row.location),
      mapLink: trimText(row.map_link),
      onlineLink: trimText(row.online_link),
      time: trimText(row.time_text),
      fee: formatClubFeeText(row.fee_text),
      seats: Math.max(0, toNumber(row.seats, 0)),
      cover: normalizeCoverValue(row.cover_url),
      tags: [],
      desc: trimText(row.description),
      heroSub: '',
      venueInfo: trimText(row.venue_info),
      whatWeDo: trimText(row.what_we_do),
      audience: trimText(row.audience),
      trainingPlan: trimText(row.training_plan),
      notes: trimText(row.notes),
      ownerId: trimText(row.owner_id),
      ownerEmail: '',
      createdAt: trimText(row.created_at),
      updatedAt: trimText(row.updated_at),
      status: mapClubStatus(row.status)
    };
  }

  function mapMemberRow(row) {
    if (!row || !row.id) return null;
    var club = row.club || {};
    return {
      id: trimText(row.id),
      clubId: trimText(row.club_id) || trimText(club.id),
      clubName: trimText(club.name),
      userId: trimText(row.user_id),
      name: trimText(row.member_name) || trimText(row.user_email) || 'Member',
      userEmail: normalizeEmail(row.user_email),
      role: trimText(row.member_role) || 'member',
      joinTime: trimText(row.joined_at) || trimText(row.created_at),
      createdAt: trimText(row.created_at)
    };
  }

  function mapBookingRow(row) {
    if (!row || !row.id) return null;
    var club = row.club || {};
    return {
      id: trimText(row.id),
      orderId: trimText(row.order_id),
      clubId: trimText(row.club_id) || trimText(club.id),
      clubSlug: trimText(club.slug),
      clubName: trimText(club.name),
      dayIso: trimText(row.day_iso),
      dayLabel: trimText(row.day_label) || trimText(row.day_iso),
      slotId: trimText(row.slot_id),
      slotTime: trimText(row.slot_time),
      location: trimText(row.location),
      fee: formatClubFeeText(row.fee_text),
      userId: trimText(row.user_id),
      userEmail: 'Cloud booking',
      createdAt: trimText(row.created_at),
      cancelledAt: trimText(row.cancelled_at),
      checkedInAt: trimText(row.checked_in_at),
      completedAt: trimText(row.completed_at),
      status: mapBookingStatusFromDb(row.status)
    };
  }

  function mapCourseRow(row) {
    if (!row || !row.id) return null;
    var club = row.club || {};
    var schedule = toArray(row.schedule);
    var primaryTime = trimText(row.time_text) || schedule[0] || '';
    var safeSchedule = schedule.length ? schedule : (primaryTime ? [primaryTime] : []);
    return {
      id: trimText(row.id),
      slug: trimText(row.slug),
      title: trimText(row.title),
      clubId: trimText(row.club_id) || trimText(club.id),
      club: trimText(club.name),
      clubSlug: trimText(club.slug),
      clubCategory: trimText(club.category) || trimText(club.name),
      clubCover: normalizeCoverValue(club.cover_url),
      englishClub: trimText(row.english_club),
      level: trimText(row.level),
      mode: trimText(row.mode),
      time: primaryTime,
      schedule: safeSchedule,
      location: trimText(row.location),
      mapLink: trimText(row.map_link),
      seats: Math.max(0, toNumber(row.seats, 0)),
      fee: trimText(row.fee_text),
      cover: normalizeCoverValue(row.cover_url) || normalizeCoverValue(club.cover_url),
      desc: trimText(row.description),
      lead: trimText(row.lead),
      detail: trimText(row.detail),
      coachName: trimText(row.coach_name),
      coachTitle: trimText(row.coach_title),
      coachBio: trimText(row.coach_bio),
      learningPoints: toArray(row.learning_points),
      audienceTips: toArray(row.audience_tips),
      notesList: toArray(row.notes_list),
      popularity: Math.max(0, toNumber(row.popularity, 0)),
      ownerId: trimText(row.owner_id),
      ownerEmail: '',
      createdAt: trimText(row.created_at),
      updatedAt: trimText(row.updated_at)
    };
  }

  function mapClubInput(payload, userId) {
    var source = payload || {};
    return {
      slug: trimText(source.slug),
      name: trimText(source.name),
      category: trimText(source.category),
      mode: trimText(source.mode),
      location: trimText(source.location),
      map_link: trimText(source.mapLink),
      online_link: trimText(source.onlineLink),
      time_text: trimText(source.time),
      fee_text: formatClubFeeText(source.fee),
      seats: Math.max(0, toNumber(source.seats, 0)),
      cover_url: normalizeCoverValue(source.cover) || null,
      tags: [],
      description: trimText(source.desc),
      hero_sub: '',
      venue_info: trimText(source.venueInfo),
      what_we_do: trimText(source.whatWeDo),
      audience: trimText(source.audience),
      training_plan: trimText(source.trainingPlan),
      notes: trimText(source.notes),
      owner_id: trimText(source.ownerId) || trimText(userId),
      status: mapClubStatus(source.status),
      updated_at: new Date().toISOString()
    };
  }

  function mapCourseInput(payload, clubId, userId) {
    var source = payload || {};
    return {
      slug: trimText(source.slug),
      club_id: trimText(clubId) || null,
      title: trimText(source.title),
      english_club: trimText(source.englishClub),
      level: trimText(source.level),
      mode: trimText(source.mode),
      time_text: trimText(source.time),
      schedule: toArray(source.schedule),
      location: trimText(source.location),
      map_link: trimText(source.mapLink),
      seats: Math.max(0, toNumber(source.seats, 0)),
      fee_text: trimText(source.fee),
      cover_url: normalizeCoverValue(source.cover) || null,
      description: trimText(source.desc),
      lead: trimText(source.lead),
      detail: trimText(source.detail),
      coach_name: trimText(source.coachName),
      coach_title: trimText(source.coachTitle),
      coach_bio: trimText(source.coachBio),
      learning_points: toArray(source.learningPoints),
      audience_tips: toArray(source.audienceTips),
      notes_list: toArray(source.notesList),
      owner_id: trimText(source.ownerId) || trimText(userId),
      popularity: Math.max(0, toNumber(source.popularity, 0)),
      updated_at: new Date().toISOString()
    };
  }

  async function fetchDashboardState(userId) {
    var client = getSupabaseClientSafe();
    var normalizedUserId = trimText(userId);
    if (!client || !normalizedUserId) {
      return { clubs: [], members: [], bookings: [], courses: [] };
    }

    var clubResult = await client
      .from('clubs')
      .select('id, slug, name, category, mode, location, map_link, online_link, time_text, fee_text, seats, cover_url, tags, description, hero_sub, venue_info, what_we_do, audience, training_plan, notes, owner_id, status, created_at, updated_at')
      .eq('owner_id', normalizedUserId)
      .order('created_at', { ascending: false });

    if (clubResult.error) throw clubResult.error;

    var clubs = (clubResult.data || [])
      .map(mapClubRow)
      .filter(Boolean)
      .filter(function (club) { return !isDemoClubSlug(club.slug); });
    var clubIds = clubs.map(function (club) { return trimText(club.id); }).filter(Boolean);

    if (!clubIds.length) {
      return { clubs: clubs, members: [], bookings: [], courses: [] };
    }

    var memberPromise = client
      .from('club_members')
      .select('id, club_id, user_id, member_name, user_email, member_role, joined_at, created_at, club:clubs(id, name)')
      .in('club_id', clubIds)
      .order('joined_at', { ascending: false });

    var bookingPromise = client
      .from('club_bookings')
      .select('id, order_id, user_id, club_id, slot_id, status, day_iso, day_label, slot_time, location, fee_text, created_at, cancelled_at, checked_in_at, completed_at, club:clubs(id, name, slug)')
      .in('club_id', clubIds)
      .order('created_at', { ascending: false });

    var results = await Promise.all([memberPromise, bookingPromise]);
    var membersResult = results[0] || {};
    var bookingsResult = results[1] || {};
    var coursesResult = await client
      .from('courses')
      .select(COURSE_ADMIN_SELECT)
      .or('owner_id.eq.' + normalizedUserId + ',club_id.in.(' + clubIds.join(',') + ')')
      .order('created_at', { ascending: false });

    if (coursesResult.error && isMissingCourseMapLinkColumn(coursesResult.error)) {
      coursesResult = await client
        .from('courses')
        .select(COURSE_ADMIN_SELECT_LEGACY)
        .or('owner_id.eq.' + normalizedUserId + ',club_id.in.(' + clubIds.join(',') + ')')
        .order('created_at', { ascending: false });
    }

    if (membersResult.error) throw membersResult.error;
    if (bookingsResult.error) throw bookingsResult.error;
    if (coursesResult.error) throw coursesResult.error;

    return {
      clubs: clubs,
      members: (membersResult.data || []).map(mapMemberRow).filter(Boolean),
      bookings: (bookingsResult.data || []).map(mapBookingRow).filter(Boolean),
      courses: (coursesResult.data || [])
        .map(mapCourseRow)
        .filter(Boolean)
        .filter(function (course) { return !isDemoCourseSlug(course.slug); })
    };
  }

  async function createClub(payload, userId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var result = await client
      .from('clubs')
      .insert(mapClubInput(payload, userId))
      .select('id, slug, name, category, mode, location, map_link, online_link, time_text, fee_text, seats, cover_url, tags, description, hero_sub, venue_info, what_we_do, audience, training_plan, notes, owner_id, status, created_at, updated_at')
      .single();
    if (result.error) throw result.error;
    await syncClubSlots(client, result.data, payload);
    return mapClubRow(result.data);
  }

  async function updateClub(clubId, payload, userId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var result = await client
      .from('clubs')
      .update(mapClubInput(payload, userId))
      .eq('id', trimText(clubId))
      .select('id, slug, name, category, mode, location, map_link, online_link, time_text, fee_text, seats, cover_url, tags, description, hero_sub, venue_info, what_we_do, audience, training_plan, notes, owner_id, status, created_at, updated_at')
      .single();
    if (result.error) throw result.error;
    await syncClubSlots(client, result.data, payload);
    return mapClubRow(result.data);
  }

  async function deleteClub(clubId) {
    var client = getSupabaseClientSafe();
    var normalizedClubId = trimText(clubId);
    if (!client) throw new Error('Supabase is not configured.');
    if (!normalizedClubId) throw new Error('Missing club id.');

    var courseDelete = await client
      .from('courses')
      .delete()
      .eq('club_id', normalizedClubId);

    if (courseDelete.error) throw courseDelete.error;

    var clubDelete = await client
      .from('clubs')
      .delete()
      .eq('id', normalizedClubId);

    if (clubDelete.error) throw clubDelete.error;
    return true;
  }

  async function createMember(payload) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var result = await client
      .from('club_members')
      .insert({
        club_id: trimText(payload && payload.clubId),
        member_name: trimText(payload && payload.name),
        user_email: normalizeEmail(payload && payload.userEmail),
        member_role: trimText(payload && payload.role) || 'member'
      })
      .select('id, club_id, user_id, member_name, user_email, member_role, joined_at, created_at, club:clubs(id, name)')
      .single();

    if (result.error) throw result.error;
    return mapMemberRow(result.data);
  }

  async function deleteMember(memberId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var result = await client
      .from('club_members')
      .delete()
      .eq('id', trimText(memberId));
    if (result.error) throw result.error;
    return true;
  }

  async function createCourse(payload, userId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var courseInput = mapCourseInput(payload, payload && payload.clubId, userId);

    var result = await client
      .from('courses')
      .insert(courseInput)
      .select(COURSE_ADMIN_SELECT)
      .single();

    if (result.error && isMissingCourseMapLinkColumn(result.error)) {
      result = await client
        .from('courses')
        .insert(withoutCourseMapLink(courseInput))
        .select(COURSE_ADMIN_SELECT_LEGACY)
        .single();
    }

    if (result.error) throw result.error;
    return mapCourseRow(result.data);
  }

  async function updateCourse(courseId, payload, userId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var courseInput = mapCourseInput(payload, payload && payload.clubId, userId);

    var result = await client
      .from('courses')
      .update(courseInput)
      .eq('id', trimText(courseId))
      .select(COURSE_ADMIN_SELECT)
      .single();

    if (result.error && isMissingCourseMapLinkColumn(result.error)) {
      result = await client
        .from('courses')
        .update(withoutCourseMapLink(courseInput))
        .eq('id', trimText(courseId))
        .select(COURSE_ADMIN_SELECT_LEGACY)
        .single();
    }

    if (result.error) throw result.error;
    return mapCourseRow(result.data);
  }

  async function deleteCourse(courseId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');
    var result = await client
      .from('courses')
      .delete()
      .eq('id', trimText(courseId));
    if (result.error) throw result.error;
    return true;
  }

  async function updateBookingStatus(bookingId, status) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var dbStatus = mapBookingStatusToDb(status);
    var payload = {
      status: dbStatus,
      updated_at: new Date().toISOString()
    };
    if (dbStatus === 'checked_in') payload.checked_in_at = new Date().toISOString();
    if (dbStatus === 'completed') payload.completed_at = new Date().toISOString();
    if (dbStatus === 'cancelled') payload.cancelled_at = new Date().toISOString();

    var result = await client
      .from('club_bookings')
      .update(payload)
      .eq('id', trimText(bookingId))
      .select('id, order_id, user_id, club_id, slot_id, status, day_iso, day_label, slot_time, location, fee_text, created_at, cancelled_at, checked_in_at, completed_at, club:clubs(id, name, slug)')
      .single();

    if (result.error) throw result.error;
    return mapBookingRow(result.data);
  }

  function mapAdminError(error) {
    var text = trimText(error && error.message).toLowerCase();
    if (text.indexOf('duplicate key') > -1 || text.indexOf('unique') > -1) {
      return 'This name is already in use. Please change the title or slug and try again.';
    }
    if (text.indexOf('row-level security') > -1) {
      return 'Your account does not currently have permission to manage this club data.';
    }
    if (text.indexOf('not configured') > -1) {
      return 'Supabase is not configured yet on this page.';
    }
    return trimText(error && error.message) || 'Unable to sync this management action right now.';
  }

  window.clubAdminSupabase = {
    isConfigured: isConfigured,
    fetchDashboardState: fetchDashboardState,
    createClub: createClub,
    updateClub: updateClub,
    deleteClub: deleteClub,
    createMember: createMember,
    deleteMember: deleteMember,
    createCourse: createCourse,
    updateCourse: updateCourse,
    deleteCourse: deleteCourse,
    updateBookingStatus: updateBookingStatus,
    mapAdminError: mapAdminError
  };
})(window);
