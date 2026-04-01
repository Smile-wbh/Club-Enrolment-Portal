(function (window) {
  'use strict';

  function trimText(value) {
    return String(value || '').trim();
  }

  function normalizeEmail(value) {
    return trimText(value).toLowerCase();
  }

  function toArray(value) {
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return trimText(item);
      }).filter(Boolean);
    }
    return [];
  }

  function toNumber(value, fallback) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : (fallback || 0);
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

  function titleFromSlug(value) {
    return trimText(value)
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map(function (item) {
        return item.charAt(0).toUpperCase() + item.slice(1);
      })
      .join(' ');
  }

  function englishClubFromRow(row, club) {
    var custom = trimText(row && row.english_club);
    if (custom) return custom;
    var clubName = trimText(club && club.name) || titleFromSlug(club && club.slug);
    if (!clubName) return 'Club Course';
    return /club|society/i.test(clubName) ? clubName : (clubName + ' Club');
  }

  function parseSchedule(value, timeText) {
    var items = toArray(value);
    var primary = trimText(timeText);
    if (!items.length && primary) items.push(primary);
    return items.slice(0, 12);
  }

  function mapCourseStatus(status) {
    var value = trimText(status).toLowerCase();
    if (value === 'cancelled') return 'Cancelled';
    if (value === 'completed') return 'Completed';
    return 'Booked';
  }

  function buildCourseCountsMap(rows) {
    var out = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row) return;
      out[trimText(row.course_id)] = Math.max(0, toNumber(row.booked_count, 0));
    });
    return out;
  }

  function mapCourseRow(row, bookedCount) {
    if (!row || !row.id) return null;
    var club = row.club || {};
    var schedule = parseSchedule(row.schedule, row.time_text);
    var primaryTime = trimText(row.time_text) || schedule[0] || 'Time TBD';
    var capacity = Math.max(1, toNumber(row.seats, 12));
    var reserved = Math.max(0, toNumber(bookedCount, 0));
    var remaining = Math.max(capacity - reserved, 0);
    var description = trimText(row.description) || trimText(row.lead) || trimText(row.detail);
    var detail = trimText(row.detail) || description || 'Open the detail page to review this course.';
    var clubName = trimText(club.name) || titleFromSlug(club.slug) || 'Unnamed Club';
    return {
      id: trimText(row.id),
      dbId: trimText(row.id),
      source: 'supabase',
      slug: trimText(row.slug),
      clubId: trimText(row.club_id),
      clubSlug: trimText(club.slug),
      club: clubName,
      clubCategory: trimText(club.category) || clubName,
      englishClub: englishClubFromRow(row, club),
      title: trimText(row.title) || 'Untitled Course',
      desc: description || 'Structured course content with booking support.',
      lead: trimText(row.lead) || '',
      detail: detail,
      level: trimText(row.level) || 'Beginner',
      mode: trimText(row.mode) || 'In-person',
      time: primaryTime,
      schedule: schedule.length ? schedule : [primaryTime],
      location: trimText(row.location) || 'Location TBD',
      seats: remaining,
      seatCapacity: capacity,
      bookedCount: reserved,
      fee: trimText(row.fee_text) || 'Free',
      feeText: trimText(row.fee_text) || 'Free',
      cover: trimText(row.cover_url) || trimText(club.cover_url),
      popularity: Math.max(0, toNumber(row.popularity, 0)),
      createdAt: trimText(row.created_at),
      updatedAt: trimText(row.updated_at),
      coachName: trimText(row.coach_name),
      coachTitle: trimText(row.coach_title),
      coachBio: trimText(row.coach_bio),
      learningPoints: toArray(row.learning_points),
      audienceTips: toArray(row.audience_tips),
      notesList: toArray(row.notes_list)
    };
  }

  function mapCourseBookingRecord(row, fallbackEmail) {
    if (!row) return null;
    var course = row.course || {};
    var club = course.club || {};
    var scheduleList = toArray(course.schedule);
    var selectedSchedule = trimText(row.selected_schedule) || trimText(course.time_text) || scheduleList[0] || 'Time TBD';
    return {
      id: trimText(row.id),
      courseId: trimText(row.course_id) || trimText(course.id),
      title: trimText(course.title) || 'Untitled Course',
      clubName: trimText(club.name) || trimText(course.english_club) || 'Default Club',
      clubSlug: trimText(club.slug),
      mode: trimText(course.mode) || 'In-person',
      level: trimText(course.level) || 'Beginner',
      time: selectedSchedule,
      location: trimText(course.location) || 'Location TBD',
      seats: Math.max(0, toNumber(course.seats, 0)),
      fee: trimText(course.fee_text) || 'Free',
      ownerEmail: normalizeEmail(fallbackEmail),
      bookedAt: trimText(row.booked_at),
      createdAt: trimText(row.booked_at),
      cancelledAt: trimText(row.cancelled_at),
      status: mapCourseStatus(row.status)
    };
  }

  function mapFavoriteRecord(row, fallbackEmail) {
    if (!row) return null;
    var course = row.course || {};
    var club = course.club || {};
    var scheduleList = toArray(course.schedule);
    return {
      id: trimText(row.course_id) || trimText(course.id),
      courseId: trimText(row.course_id) || trimText(course.id),
      title: trimText(course.title) || 'Untitled Course',
      clubName: trimText(club.name) || trimText(course.english_club) || 'Default Club',
      clubSlug: trimText(club.slug),
      mode: trimText(course.mode) || 'In-person',
      level: trimText(course.level) || 'Beginner',
      time: trimText(course.time_text) || scheduleList[0] || 'Time TBD',
      location: trimText(course.location) || 'Location TBD',
      seats: Math.max(0, toNumber(course.seats, 0)),
      fee: trimText(course.fee_text) || 'Free',
      ownerEmail: normalizeEmail(fallbackEmail),
      createdAt: trimText(row.created_at),
      updatedAt: trimText(row.created_at)
    };
  }

  async function fetchCourseCatalog(userId) {
    var client = getSupabaseClientSafe();
    if (!client) {
      return {
        courses: [],
        favoriteIds: [],
        bookingCountsMap: {}
      };
    }

    var normalizedUserId = trimText(userId);
    var courseResult = await client
      .from('courses')
      .select('id, slug, club_id, title, english_club, level, mode, time_text, schedule, location, seats, fee_text, cover_url, description, lead, detail, coach_name, coach_title, coach_bio, learning_points, audience_tips, notes_list, popularity, created_at, updated_at, club:clubs(name, slug, category, cover_url)')
      .order('created_at', { ascending: false });

    if (courseResult.error) throw courseResult.error;

    var courseRows = Array.isArray(courseResult.data) ? courseResult.data : [];
    var courseIds = courseRows.map(function (row) {
      return trimText(row && row.id);
    }).filter(Boolean);

    var countPromise = client.rpc('get_course_booking_counts', {
      p_course_ids: courseIds.length ? courseIds : null
    });
    var favoritePromise = normalizedUserId
      ? client
          .from('course_favorites')
          .select('course_id')
          .eq('user_id', normalizedUserId)
      : Promise.resolve({ data: [], error: null });

    var results = await Promise.all([countPromise, favoritePromise]);
    var countResult = results[0] || {};
    var favoriteResult = results[1] || {};

    if (countResult.error) throw countResult.error;
    if (favoriteResult.error) throw favoriteResult.error;

    var bookingCountsMap = buildCourseCountsMap(countResult.data);
    return {
      courses: courseRows.map(function (row) {
        return mapCourseRow(row, bookingCountsMap[trimText(row.id)]);
      }).filter(Boolean),
      favoriteIds: (favoriteResult.data || []).map(function (row) {
        return trimText(row && row.course_id);
      }).filter(Boolean),
      bookingCountsMap: bookingCountsMap
    };
  }

  async function fetchMyTeachingBookings(userId, fallbackEmail) {
    var client = getSupabaseClientSafe();
    var normalizedUserId = trimText(userId);
    if (!client || !normalizedUserId) return [];

    var result = await client
      .from('course_bookings')
      .select('id, course_id, status, booked_at, selected_schedule, cancelled_at, course:courses(id, title, english_club, level, mode, time_text, schedule, location, seats, fee_text, club:clubs(name, slug, category))')
      .eq('user_id', normalizedUserId)
      .neq('status', 'cancelled')
      .order('booked_at', { ascending: false });

    if (result.error) throw result.error;

    return (result.data || []).map(function (row) {
      return mapCourseBookingRecord(row, fallbackEmail);
    }).filter(Boolean);
  }

  async function fetchMyFavorites(userId, fallbackEmail) {
    var client = getSupabaseClientSafe();
    var normalizedUserId = trimText(userId);
    if (!client || !normalizedUserId) return [];

    var result = await client
      .from('course_favorites')
      .select('created_at, course_id, course:courses(id, title, english_club, level, mode, time_text, schedule, location, seats, fee_text, club:clubs(name, slug, category))')
      .eq('user_id', normalizedUserId)
      .order('created_at', { ascending: false });

    if (result.error) throw result.error;

    return (result.data || []).map(function (row) {
      return mapFavoriteRecord(row, fallbackEmail);
    }).filter(Boolean);
  }

  async function addFavorite(userId, courseId) {
    var client = getSupabaseClientSafe();
    var normalizedUserId = trimText(userId);
    var normalizedCourseId = trimText(courseId);
    if (!client) throw new Error('Supabase is not configured.');
    if (!normalizedUserId) throw new Error('Missing user id.');
    if (!normalizedCourseId) throw new Error('Missing course id.');

    var result = await client
      .from('course_favorites')
      .upsert({
        user_id: normalizedUserId,
        course_id: normalizedCourseId
      }, {
        onConflict: 'user_id,course_id'
      })
      .select('course_id')
      .single();

    if (result.error) throw result.error;
    return trimText(result.data && result.data.course_id);
  }

  async function removeFavorite(userId, courseId) {
    var client = getSupabaseClientSafe();
    var normalizedUserId = trimText(userId);
    var normalizedCourseId = trimText(courseId);
    if (!client) throw new Error('Supabase is not configured.');
    if (!normalizedUserId) throw new Error('Missing user id.');
    if (!normalizedCourseId) throw new Error('Missing course id.');

    var result = await client
      .from('course_favorites')
      .delete()
      .eq('user_id', normalizedUserId)
      .eq('course_id', normalizedCourseId);

    if (result.error) throw result.error;
    return true;
  }

  async function createCourseBooking(course, selectedSchedule, userEmail) {
    var client = getSupabaseClientSafe();
    var normalizedCourse = (course && typeof course === 'object') ? course : { id: course };
    var courseId = trimText(normalizedCourse.id || normalizedCourse.courseId);
    if (!client) throw new Error('Supabase is not configured.');
    if (!courseId) throw new Error('Missing course id.');

    var result = await client.rpc('create_course_booking', {
      p_course_id: courseId,
      p_selected_schedule: trimText(selectedSchedule || normalizedCourse.time)
    });

    if (result.error) throw result.error;

    return mapCourseBookingRecord({
      id: trimText(result.data && result.data.id),
      course_id: courseId,
      status: trimText(result.data && result.data.status) || 'booked',
      booked_at: trimText(result.data && result.data.booked_at) || new Date().toISOString(),
      selected_schedule: trimText(result.data && result.data.selected_schedule) || trimText(selectedSchedule || normalizedCourse.time),
      cancelled_at: trimText(result.data && result.data.cancelled_at),
      course: {
        id: courseId,
        title: normalizedCourse.title,
        english_club: normalizedCourse.englishClub,
        level: normalizedCourse.level,
        mode: normalizedCourse.mode,
        time_text: normalizedCourse.time,
        schedule: normalizedCourse.schedule,
        location: normalizedCourse.location,
        seats: normalizedCourse.seatCapacity || normalizedCourse.seats,
        fee_text: normalizedCourse.fee || normalizedCourse.feeText,
        club: {
          name: normalizedCourse.club,
          slug: normalizedCourse.clubSlug,
          category: normalizedCourse.clubCategory
        }
      }
    }, userEmail);
  }

  async function cancelCourseBooking(bookingId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var result = await client
      .from('course_bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', trimText(bookingId))
      .select('id, course_id, status, booked_at, selected_schedule, cancelled_at')
      .single();

    if (result.error) throw result.error;
    return result.data || null;
  }

  function mapCourseActionError(error) {
    var text = trimText(error && error.message).toLowerCase();
    if (text.indexOf('course_full') > -1) return 'This course has no seats left right now.';
    if (text.indexOf('course_not_found') > -1) return 'This course is no longer available.';
    if (text.indexOf('course_not_bookable') > -1) return 'This course is not open for booking right now.';
    if (text.indexOf('not_authenticated') > -1) return 'Please log in again before completing the booking.';
    if (text.indexOf('duplicate') > -1) return 'You have already booked this course time.';
    return trimText(error && error.message) || 'Unable to sync the course action to Supabase right now.';
  }

  window.clubCourseSupabase = {
    isConfigured: isConfigured,
    fetchCourseCatalog: fetchCourseCatalog,
    fetchMyTeachingBookings: fetchMyTeachingBookings,
    fetchMyFavorites: fetchMyFavorites,
    addFavorite: addFavorite,
    removeFavorite: removeFavorite,
    createCourseBooking: createCourseBooking,
    cancelCourseBooking: cancelCourseBooking,
    mapCourseActionError: mapCourseActionError,
    mapCourseStatus: mapCourseStatus
  };
})(window);
