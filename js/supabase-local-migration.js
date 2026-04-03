(function (window) {
  'use strict';

  var TARGET_EMAIL = 'beihongwang132@gmail.com';
  var STATUS_PREFIX = 'local_business_migration_v1:';
  var LEGACY_AUTO_COVER_PATHS = {
    '../zp/zq.webp': true,
    '../zp/ymq.webp': true,
    '../zp/gywm.webp': true
  };
  var FIXED_CLEAR_KEYS = [
    'club_registry_v1',
    'specialty_clubs_v1',
    'club_members_v1',
    'specialty_bookings_v1',
    'specialty_pending_payment_v1',
    'mfms_courses_v1',
    'mfms_teaching_bookings_v1',
    'mfms_fav_courses_v1',
    'mfms_course_cache_v1',
    'mfms_materials_v1',
    'mfms_pending_course_booking_v1',
    'spjs_forum_posts_v1',
    'user_message_board_v1',
    'chat_messages_v1'
  ];
  var EMBEDDED_DEFAULT_CLUBS = [
    {
      id: 'embedded-football',
      slug: 'football',
      name: 'Football Club',
      category: 'Sports',
      mode: 'In-person',
      desc: 'Weekly training and friendly matches for a range of skill levels, with pitch booking and event sign-up support.',
      location: 'Stadium A (In-person)',
      time: 'Tue/Thu 18:00-20:00',
      seats: 12,
      fee: '£0 (Free)',
      cover: '../zp/zq.webp',
      tags: ['Event Sign-up', 'Training Camp', 'Teamwork']
    },
    {
      id: 'embedded-badminton',
      slug: 'badminton',
      name: 'Badminton Club',
      category: 'Sports',
      mode: 'In-person',
      desc: 'Multiple bookable slots with live seat updates, suitable for regular training and campus competitions.',
      location: 'Indoor Hall B (In-person)',
      time: 'Mon/Wed 19:00-21:00',
      seats: 8,
      fee: '£3/session (Optional)',
      cover: '../zp/ymq.webp',
      tags: ['Campus Matches', 'Live Seats', 'Hot Club']
    },
    {
      id: 'embedded-swimming',
      slug: 'swimming',
      name: 'Swimming Club',
      category: 'Sports',
      mode: 'In-person',
      desc: 'Stroke and endurance training for beginners through advanced swimmers, with lane-based session booking.',
      location: 'Aquatics Center (In-person)',
      time: 'Sat 10:00-12:00',
      seats: 16,
      fee: '£2/session',
      cover: '../zp/yy1.webp',
      tags: ['Level-based Training', 'Lane Booking', 'Beginner Friendly']
    },
    {
      id: 'embedded-cycling',
      slug: 'cycling',
      name: 'Cycling Club',
      category: 'Sports',
      mode: 'Hybrid',
      desc: 'City rides and weekend long-distance sessions with meet-up details and route plans shared ahead of time.',
      location: 'Meeting point: Campus Gate (In-person) / group updates (Online)',
      time: 'Sun 08:30-11:30',
      seats: 20,
      fee: '£0',
      cover: '../zp/qx.webp',
      tags: ['Weekend Rides', 'Route Sharing', 'Outdoor Community']
    },
    {
      id: 'embedded-programming',
      slug: 'programming',
      name: 'Programming Club',
      category: 'Academic',
      mode: 'Online',
      desc: 'Learn Web, Python, and AI fundamentals while sharing projects in a beginner-to-advanced online space.',
      location: 'Online meeting link (Virtual)',
      time: 'Fri 20:00-21:30',
      seats: 40,
      fee: '£0',
      cover: '../zp/bc.webp',
      tags: ['Web Development', 'Python', 'Project Practice']
    },
    {
      id: 'embedded-tennis',
      slug: 'tennis',
      name: 'Tennis Club',
      category: 'Sports',
      mode: 'In-person',
      desc: 'Doubles training and weekend activities with bookable sessions for members at different levels.',
      location: 'Tennis Court C (In-person)',
      time: 'Sat 14:00-16:00',
      seats: 10,
      fee: '£2/session',
      cover: '../zp/wq.webp',
      tags: ['Doubles Training', 'Weekend Activities', 'Session Booking']
    },
    {
      id: 'embedded-music',
      slug: 'music',
      name: 'Music Society',
      category: 'Arts',
      mode: 'Hybrid',
      desc: 'Instrument exchange, ensemble rehearsals, and performance sign-up with shared sheet music and rehearsal plans online.',
      location: 'Arts Building 2F / online sharing',
      time: 'Wed 17:00-18:30',
      seats: 18,
      fee: '£0',
      cover: '../zp/yy.webp',
      tags: ['Instrument Exchange', 'Ensemble Rehearsal', 'Performance Sign-up']
    },
    {
      id: 'embedded-running',
      slug: 'running',
      name: 'Running Club',
      category: 'Sports',
      mode: 'In-person',
      desc: 'Weekly group runs and campus running events with activity sign-up and training plans.',
      location: 'Track meeting point (In-person)',
      time: 'Tue/Fri 07:00-08:00',
      seats: 30,
      fee: '£0',
      cover: '../zp/pb.webp',
      tags: ['Morning Run Check-in', 'Road Running', 'Training Plan']
    },
    {
      id: 'embedded-basketball',
      slug: 'basketball',
      name: 'Basketball Club',
      category: 'Sports',
      mode: 'In-person',
      desc: 'Weekly practices and campus league sign-up with basic tactical coaching and scrimmages.',
      location: 'Basketball Court D (In-person)',
      time: 'Wed/Sat 18:00-20:00',
      seats: 18,
      fee: '£0 (Free)',
      cover: '../zp/hb1.webp',
      tags: ['League Sign-up', 'Tactical Training', 'Scrimmages']
    },
    {
      id: 'embedded-golf',
      slug: 'golf',
      name: 'Golf Club',
      category: 'Sports',
      mode: 'In-person',
      desc: 'Swing practice and weekend experience sessions for beginners and casual players.',
      location: 'Practice Ground E (In-person)',
      time: 'Sun 09:30-11:30',
      seats: 12,
      fee: '£5/session (Optional)',
      cover: '../zp/hb2.webp',
      tags: ['Swing Practice', 'Weekend Experience', 'Beginner Welcome']
    },
    {
      id: 'embedded-rugby',
      slug: 'rugby',
      name: 'Rugby Club',
      category: 'Sports',
      mode: 'In-person',
      desc: 'Core passing and contact training with support for inter-school competition sign-up and tactical drills.',
      location: 'Stadium F (In-person)',
      time: 'Tue/Thu 16:30-18:00',
      seats: 22,
      fee: '£0',
      cover: '../zp/hb3.webp',
      tags: ['Inter-school Events', 'Tactical Drills', 'Strength Training']
    },
    {
      id: 'embedded-handball',
      slug: 'handball',
      name: 'Handball Club',
      category: 'Sports',
      mode: 'In-person',
      desc: 'Team coordination sessions and small-court games with grouped practice and event sign-up.',
      location: 'Sports Hall G (In-person)',
      time: 'Mon 18:30-20:00',
      seats: 16,
      fee: '£0',
      cover: '../zp/hb2.webp',
      tags: ['Team Coordination', 'Grouped Practice', 'Event Sign-up']
    },
    {
      id: 'embedded-gymnastics',
      slug: 'gymnastics',
      name: 'Gymnastics Club',
      category: 'Sports',
      mode: 'In-person',
      desc: 'Foundational flexibility and strength training with movement demos and grouped practice for beginner to advanced members.',
      location: 'Gym Hall H (In-person)',
      time: 'Fri 17:00-18:30',
      seats: 14,
      fee: '£0',
      cover: '../zp/hb1.webp',
      tags: ['Flexibility Training', 'Strength Growth', 'Movement Demonstration']
    }
  ];

  function trimText(value) {
    return String(value || '').trim();
  }

  function normalizeEmail(value) {
    return trimText(value).toLowerCase();
  }

  function normalizeKey(value) {
    return trimText(value).toLowerCase();
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

  function hasValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (!value && value !== 0) return false;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return trimText(value).length > 0;
  }

  function safeDate(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value).toISOString();
    }
    var text = trimText(value);
    if (!text) return new Date().toISOString();
    var numeric = Number(text);
    if (!Number.isNaN(numeric) && text.length >= 8) {
      return new Date(numeric).toISOString();
    }
    var parsed = Date.parse(text);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
    return new Date().toISOString();
  }

  function formatIsoDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) date = new Date();
    date.setHours(0, 0, 0, 0);
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function addDays(date, days) {
    var next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function shortTime(value) {
    var text = trimText(value);
    if (!text) return '';
    var match = text.match(/(\d{1,2}):(\d{2})/);
    if (!match) return text;
    return String(Number(match[1])) + ':' + match[2];
  }

  function toSqlTime(value, fallbackHour) {
    var text = trimText(value);
    if (!text) {
      return String(fallbackHour || 9).padStart(2, '0') + ':00:00';
    }
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(text)) return text;
    var match = text.match(/(\d{1,2}):(\d{2})/);
    if (!match) {
      return String(fallbackHour || 9).padStart(2, '0') + ':00:00';
    }
    return String(Number(match[1])).padStart(2, '0') + ':' + match[2] + ':00';
  }

  function buildSlotTimeLabel(startTime, endTime) {
    return shortTime(startTime) + '-' + shortTime(endTime);
  }

  function parseMoney(value) {
    var text = trimText(value);
    if (!text) return 0;
    var match = text.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function normalizeCoverValue(value) {
    var text = trimText(value);
    return LEGACY_AUTO_COVER_PATHS[text] ? '' : text;
  }

  function slugify(value) {
    var source = trimText(value).toLowerCase();
    if (!source) return 'item-' + Date.now();
    var slug = source
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || ('item-' + Date.now());
  }

  function statusKey(email) {
    return STATUS_PREFIX + (normalizeEmail(email) || TARGET_EMAIL);
  }

  function readJson(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function readStatus(email) {
    var parsed = readJson(statusKey(email), {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }

  function writeStatus(email, patch) {
    var current = readStatus(email);
    var next = Object.assign({}, current, patch || {});
    writeJson(statusKey(email), next);
    return next;
  }

  function isTargetAccount(email) {
    return normalizeEmail(email) === TARGET_EMAIL;
  }

  function isBusinessCacheDisabled(email) {
    var status = readStatus(email);
    return !!(status && status.completed);
  }

  function getSupabaseClientSafe() {
    try {
      return typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    } catch (error) {
      return null;
    }
  }

  function getAdminService() {
    return window.clubAdminSupabase || null;
  }

  function getBookingService() {
    return window.clubBookingSupabase || null;
  }

  function getCourseService() {
    return window.clubCourseSupabase || null;
  }

  function getForumService() {
    return window.clubForumSupabase || null;
  }

  function getSupportService() {
    return window.clubSupportSupabase || null;
  }

  function hasSupabase() {
    return !!getSupabaseClientSafe();
  }

  function buildAliases(email, profile) {
    var nickname = trimText(profile && (profile.nickname || profile.displayName || profile.name));
    var aliases = [
      nickname,
      normalizeEmail(email),
      normalizeEmail(email).split('@')[0]
    ].map(normalizeKey).filter(Boolean);
    return Array.from(new Set(aliases));
  }

  function mergeFilledRecord(base, next) {
    var merged = Object.assign({}, base || {});
    Object.keys(next || {}).forEach(function (key) {
      if (hasValue(next[key])) merged[key] = next[key];
    });
    return merged;
  }

  function buildClubIdentity(value) {
    var row = value || {};
    return normalizeKey(row.slug || row.name || row.id || row.dbId);
  }

  function buildCourseIdentity(value) {
    var row = value || {};
    return normalizeKey(row.slug || row.title || row.id || row.courseId);
  }

  function normalizeClubStatus(value) {
    var text = normalizeKey(value);
    if (text === 'inactive') return 'inactive';
    if (text === 'pending') return 'pending';
    if (text === 'approved') return 'approved';
    return 'approved';
  }

  function normalizeBookingStatus(value) {
    var text = normalizeKey(value);
    if (text.indexOf('cancel') > -1) return 'cancelled';
    if (text.indexOf('pending') > -1) return 'pending_payment';
    if (text.indexOf('checked') > -1) return 'checked_in';
    if (text.indexOf('complete') > -1 || text.indexOf('expired') > -1) return 'completed';
    if (text.indexOf('no show') > -1 || text.indexOf('no_show') > -1) return 'no_show';
    return 'booked';
  }

  function normalizePaymentStatus(booking) {
    var status = normalizeBookingStatus(booking && booking.status);
    if (status === 'pending_payment') return 'pending';
    if (status === 'cancelled' && parseMoney(booking && booking.paidAmount) > 0) return 'refunded';
    return 'paid';
  }

  function normalizeCourseBookingStatus(value) {
    var text = normalizeKey(value);
    if (text.indexOf('cancel') > -1) return 'cancelled';
    return 'booked';
  }

  function normalizeLocalClub(club) {
    if (!club) return null;
    var name = trimText(club.name);
    if (!name) return null;
    var slug = trimText(club.slug) || slugify(name);
    var rawSlots = Array.isArray(club.slots) ? club.slots.slice() : [];
    var rawSlotsByDay = club.slotsByDay && typeof club.slotsByDay === 'object' ? club.slotsByDay : null;
    var slotCapacity = rawSlots.reduce(function (sum, slot) {
      return sum + Math.max(0, toNumber(slot && slot.capacity, 0));
    }, 0);
    var seats = Math.max(1, toNumber(club.seats, slotCapacity || 20));
    return {
      localId: trimText(club.dbId || club.id || slug),
      slug: slugify(slug),
      name: name,
      category: trimText(club.category) || 'Sports',
      mode: trimText(club.mode) || 'In-person',
      location: trimText(club.location),
      mapLink: trimText(club.mapLink || club.map_link),
      onlineLink: trimText(club.onlineLink || club.online_link),
      time: trimText(club.time || club.time_text),
      fee: trimText(club.fee || club.fee_text) || '£0',
      seats: seats,
      cover: normalizeCoverValue(club.cover || club.cover_url),
      tags: toArray(club.tags),
      desc: trimText(club.desc || club.description),
      heroSub: trimText(club.heroSub || club.hero_sub || club.desc || club.description),
      venueInfo: trimText(club.venueInfo || club.venue_info),
      whatWeDo: trimText(club.whatWeDo || club.what_we_do),
      audience: trimText(club.audience),
      trainingPlan: trimText(club.trainingPlan || club.training_plan),
      notes: trimText(club.notes),
      status: normalizeClubStatus(club.status),
      slots: rawSlots,
      slotsByDay: rawSlotsByDay
    };
  }

  function readEmbeddedDefaultClubs() {
    return EMBEDDED_DEFAULT_CLUBS.map(normalizeLocalClub).filter(Boolean);
  }

  function readLocalClubs(email) {
    var combined = {};
    ['club_registry_v1', 'specialty_clubs_v1'].forEach(function (key) {
      var list = readJson(key, []);
      (Array.isArray(list) ? list : []).forEach(function (item) {
        var club = normalizeLocalClub(item);
        if (!club) return;
        var identity = buildClubIdentity(club);
        combined[identity] = combined[identity]
          ? mergeFilledRecord(combined[identity], club)
          : club;
      });
    });
    var clubs = Object.keys(combined).map(function (key) {
      return combined[key];
    });
    return clubs;
  }

  function normalizeLocalCourse(course) {
    if (!course) return null;
    var title = trimText(course.title);
    if (!title) return null;
    var schedule = toArray(course.schedule);
    var time = trimText(course.time || course.time_text) || schedule[0] || 'Time TBD';
    if (!schedule.length && time) schedule = [time];
    return {
      localId: trimText(course.courseId || course.id || course.slug || title),
      slug: slugify(course.slug || title),
      title: title,
      clubId: trimText(course.clubId || course.club_id),
      clubSlug: trimText(course.clubSlug),
      clubName: trimText(course.club || course.clubName),
      clubCategory: trimText(course.clubCategory),
      englishClub: trimText(course.englishClub || course.english_club),
      level: trimText(course.level) || 'Beginner',
      mode: trimText(course.mode) || 'In-person',
      time: time,
      schedule: schedule,
      location: trimText(course.location),
      seats: Math.max(0, toNumber(course.seats, 0)),
      fee: trimText(course.fee || course.feeText || course.fee_text) || 'Free',
      cover: normalizeCoverValue(course.cover || course.cover_url || course.clubCover),
      desc: trimText(course.desc || course.description),
      lead: trimText(course.lead),
      detail: trimText(course.detail),
      coachName: trimText(course.coachName || course.coach_name),
      coachTitle: trimText(course.coachTitle || course.coach_title),
      coachBio: trimText(course.coachBio || course.coach_bio),
      learningPoints: toArray(course.learningPoints || course.learning_points),
      audienceTips: toArray(course.audienceTips || course.audience_tips),
      notesList: toArray(course.notesList || course.notes_list),
      popularity: Math.max(0, toNumber(course.popularity, 0))
    };
  }

  function filterForumPosts(list, email, aliases) {
    return (Array.isArray(list) ? list : []).map(function (item) {
      return item && typeof item === 'object' ? item : null;
    }).filter(Boolean).filter(function (item) {
      if (normalizeKey(item.source) === 'supabase') return false;
      var ownerEmail = normalizeEmail(item.ownerEmail);
      var author = normalizeKey(item.author);
      if (ownerEmail) return ownerEmail === normalizeEmail(email);
      if (author) return aliases.indexOf(author) > -1;
      return false;
    });
  }

  function filterSupportMessages(list, email) {
    var targetEmail = normalizeEmail(email);
    var targetUserId = targetEmail ? ('user:' + targetEmail) : '';
    return (Array.isArray(list) ? list : []).filter(function (item) {
      var role = normalizeKey(item && item.role);
      if (role && role !== 'user') return false;
      var userEmail = normalizeEmail(item && item.userEmail);
      var userId = trimText(item && item.userId);
      if (userEmail) return userEmail === targetEmail;
      if (userId) return userId === targetUserId;
      return trimText(item && item.text).length > 0;
    });
  }

  function filterMessageBoardEntries(list, email, aliases) {
    var targetEmail = normalizeEmail(email);
    return (Array.isArray(list) ? list : []).filter(function (item) {
      var fromEmail = normalizeEmail(item && item.fromEmail);
      var fromName = normalizeKey(item && item.fromName);
      var targetRowEmail = normalizeEmail(item && item.targetEmail);
      var targetName = normalizeKey(item && item.targetName);
      return fromEmail === targetEmail
        || targetRowEmail === targetEmail
        || (fromName && aliases.indexOf(fromName) > -1)
        || (targetName && aliases.indexOf(targetName) > -1);
    });
  }

  function inspectLocalData(email, profile) {
    var aliases = buildAliases(email, profile);
    var favoriteIdCount = 0;
    try {
      for (var i = 0; i < window.localStorage.length; i += 1) {
        var key = String(window.localStorage.key(i) || '');
        if (key.indexOf('mfms_favs_v1:') === 0) {
          favoriteIdCount += (readJson(key, []) || []).length;
        }
      }
    } catch (error) {}

    var counts = {
      clubs: readLocalClubs(email).length,
      members: readJson('club_members_v1', []).length,
      bookings: readJson('specialty_bookings_v1', []).length,
      courses: readJson('mfms_courses_v1', []).length,
      courseBookings: readJson('mfms_teaching_bookings_v1', []).length,
      favorites: readJson('mfms_fav_courses_v1', []).length + favoriteIdCount,
      forumPosts: filterForumPosts(readJson('spjs_forum_posts_v1', []), email, aliases).length,
      supportMessages: filterSupportMessages(readJson('chat_messages_v1', []), email).length,
      messageBoard: filterMessageBoardEntries(readJson('user_message_board_v1', []), email, aliases).length
    };
    counts.total = Object.keys(counts).reduce(function (sum, key) {
      return key === 'total' ? sum : sum + Number(counts[key] || 0);
    }, 0);
    return counts;
  }

  function collectLocalBusinessData(email, profile) {
    var aliases = buildAliases(email, profile);
    var favoriteIds = [];
    try {
      for (var i = 0; i < window.localStorage.length; i += 1) {
        var key = String(window.localStorage.key(i) || '');
        if (key.indexOf('mfms_favs_v1:') !== 0) continue;
        favoriteIds = favoriteIds.concat(readJson(key, []));
      }
    } catch (error) {}
    return {
      clubs: readLocalClubs(email),
      members: readJson('club_members_v1', []),
      bookings: readJson('specialty_bookings_v1', []),
      courses: (readJson('mfms_courses_v1', []) || []).map(normalizeLocalCourse).filter(Boolean),
      courseBookings: readJson('mfms_teaching_bookings_v1', []),
      favorites: readJson('mfms_fav_courses_v1', []),
      favoriteIds: favoriteIds,
      courseCache: readJson('mfms_course_cache_v1', {}),
      forumPosts: filterForumPosts(readJson('spjs_forum_posts_v1', []), email, aliases),
      supportMessages: filterSupportMessages(readJson('chat_messages_v1', []), email),
      messageBoard: filterMessageBoardEntries(readJson('user_message_board_v1', []), email, aliases)
    };
  }

  function buildClubLookup(clubs) {
    var map = {};
    (Array.isArray(clubs) ? clubs : []).forEach(function (club) {
      if (!club) return;
      [club.id, club.localId, club.slug, club.name].forEach(function (value) {
        var key = normalizeKey(value);
        if (key) map[key] = club;
      });
    });
    return map;
  }

  function buildCourseLookup(courses) {
    var map = {};
    (Array.isArray(courses) ? courses : []).forEach(function (course) {
      if (!course) return;
      [
        course.id,
        course.localId,
        course.courseId,
        course.slug,
        course.title,
        (trimText(course.clubName || course.club) + '|' + trimText(course.title))
      ].forEach(function (value) {
        var key = normalizeKey(value);
        if (key) map[key] = course;
      });
    });
    return map;
  }

  function resolveClubFromLookup(lookup, item) {
    var keys = [
      item && item.clubId,
      item && item.dbId,
      item && item.slug,
      item && item.clubSlug,
      item && item.name,
      item && item.clubName
    ];
    for (var i = 0; i < keys.length; i += 1) {
      var key = normalizeKey(keys[i]);
      if (key && lookup[key]) return lookup[key];
    }
    return null;
  }

  function resolveCourseFromLookup(lookup, item) {
    var clubName = trimText(item && (item.clubName || item.club));
    var title = trimText(item && item.title);
    var keys = [
      item && item.courseId,
      item && item.id,
      item && item.slug,
      title,
      clubName && title ? (clubName + '|' + title) : ''
    ];
    for (var i = 0; i < keys.length; i += 1) {
      var key = normalizeKey(keys[i]);
      if (key && lookup[key]) return lookup[key];
    }
    return null;
  }

  function normalizeSlotRange(slot, index) {
    var row = slot || {};
    var rawTime = trimText(row.time);
    var rangeParts = rawTime ? rawTime.split('-') : [];
    var startTime = toSqlTime(row.startTime || rangeParts[0], 9 + index);
    var endTime = toSqlTime(row.endTime || rangeParts[1], 10 + index);
    return {
      startTime: startTime,
      endTime: endTime,
      label: buildSlotTimeLabel(startTime, endTime)
    };
  }

  function defaultSlotTemplates(seats) {
    var list = [];
    for (var hour = 9; hour < 21; hour += 1) {
      list.push({
        time: hour + ':00-' + (hour + 1) + ':00',
        capacity: Math.max(1, seats || 20)
      });
    }
    return list;
  }

  function buildSlotRows(remoteClub, localClub) {
    var rows = [];
    var seats = Math.max(1, toNumber(localClub && localClub.seats, 20));
    var slotsByDay = localClub && localClub.slotsByDay && typeof localClub.slotsByDay === 'object'
      ? localClub.slotsByDay
      : null;

    if (slotsByDay && Object.keys(slotsByDay).length) {
      Object.keys(slotsByDay).forEach(function (dayIso) {
        var items = Array.isArray(slotsByDay[dayIso]) ? slotsByDay[dayIso] : [];
        items.forEach(function (slot, index) {
          var range = normalizeSlotRange(slot, index);
          rows.push({
            club_id: trimText(remoteClub && remoteClub.id),
            day_iso: formatIsoDate(dayIso),
            day_label: trimText(slot && slot.dayLabel) || formatIsoDate(dayIso),
            start_time: range.startTime,
            end_time: range.endTime,
            capacity: Math.max(1, toNumber(slot && slot.capacity, seats)),
            status: 'open'
          });
        });
      });
      return rows;
    }

    var rawSlots = Array.isArray(localClub && localClub.slots) && localClub.slots.length
      ? localClub.slots
      : defaultSlotTemplates(seats);
    var hasExplicitDay = rawSlots.some(function (slot) {
      return !!trimText(slot && slot.dayIso);
    });

    if (hasExplicitDay) {
      rawSlots.forEach(function (slot, index) {
        var dayIso = formatIsoDate(slot && slot.dayIso);
        var range = normalizeSlotRange(slot, index);
        rows.push({
          club_id: trimText(remoteClub && remoteClub.id),
          day_iso: dayIso,
          day_label: trimText(slot && slot.dayLabel) || dayIso,
          start_time: range.startTime,
          end_time: range.endTime,
          capacity: Math.max(1, toNumber(slot && slot.capacity, seats)),
          status: 'open'
        });
      });
      return rows;
    }

    for (var dayOffset = 0; dayOffset < 14; dayOffset += 1) {
      var dayIso = formatIsoDate(addDays(new Date(), dayOffset));
      rawSlots.forEach(function (slot, index) {
        var range = normalizeSlotRange(slot, index);
        rows.push({
          club_id: trimText(remoteClub && remoteClub.id),
          day_iso: dayIso,
          day_label: dayIso,
          start_time: range.startTime,
          end_time: range.endTime,
          capacity: Math.max(1, toNumber(slot && slot.capacity, seats)),
          status: 'open'
        });
      });
    }
    return rows;
  }

  function buildSlotLookupRows(rows) {
    var map = {};
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row) return;
      var dayIso = formatIsoDate(row.day_iso || row.dayIso);
      var start = toSqlTime(row.start_time || row.startTime);
      var end = toSqlTime(row.end_time || row.endTime);
      var key = normalizeKey([
        trimText(row.club_id || row.clubId),
        dayIso,
        shortTime(start),
        shortTime(end)
      ].join('|'));
      map[key] = {
        id: trimText(row.id),
        clubId: trimText(row.club_id || row.clubId),
        dayIso: dayIso,
        startTime: start,
        endTime: end
      };
    });
    return map;
  }

  function buildSlotLookupKey(clubId, dayIso, slotTime) {
    var rangeParts = trimText(slotTime).split('-');
    var start = toSqlTime(rangeParts[0], 9);
    var end = toSqlTime(rangeParts[1], Number(start.slice(0, 2)) + 1);
    return normalizeKey([
      trimText(clubId),
      formatIsoDate(dayIso),
      shortTime(start),
      shortTime(end)
    ].join('|'));
  }

  async function ensureProfile(client, userId, email, profile) {
    var payload = {
      id: trimText(userId),
      email: normalizeEmail(email),
      nickname: trimText(profile && (profile.nickname || profile.displayName || email.split('@')[0] || 'User')),
      avatar_url: normalizeCoverValue(profile && (profile.avatar || profile.avatarUrl)) || null,
      forum_cover_url: normalizeCoverValue(profile && profile.forumCoverUrl) || null
    };
    var result = await client
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('id')
      .single();
    if (result.error) throw result.error;
    return result.data || null;
  }

  async function fetchExistingState(userId, email) {
    var state = {
      clubs: [],
      members: [],
      courses: [],
      bookings: [],
      courseBookings: [],
      favorites: [],
      posts: [],
      supportMessages: [],
      messageBoard: [],
      publicCourses: []
    };
    var admin = getAdminService();
    var booking = getBookingService();
    var courses = getCourseService();
    var forum = getForumService();
    var support = getSupportService();

    if (admin && typeof admin.fetchDashboardState === 'function' && admin.isConfigured()) {
      try {
        var dashboard = await admin.fetchDashboardState(userId);
        state.clubs = Array.isArray(dashboard && dashboard.clubs) ? dashboard.clubs : [];
        state.members = Array.isArray(dashboard && dashboard.members) ? dashboard.members : [];
        state.courses = Array.isArray(dashboard && dashboard.courses) ? dashboard.courses : [];
      } catch (error) {}
    }
    if (booking && typeof booking.fetchMyBookings === 'function' && booking.isConfigured()) {
      try { state.bookings = await booking.fetchMyBookings(userId, email); } catch (error) {}
    }
    if (courses && typeof courses.fetchMyTeachingBookings === 'function' && courses.isConfigured()) {
      try { state.courseBookings = await courses.fetchMyTeachingBookings(userId, email); } catch (error) {}
      try { state.favorites = await courses.fetchMyFavorites(userId, email); } catch (error) {}
      try {
        var catalog = await courses.fetchCourseCatalog(userId);
        state.publicCourses = Array.isArray(catalog && catalog.courses) ? catalog.courses : [];
      } catch (error) {}
    }
    if (forum && typeof forum.fetchMyPosts === 'function' && forum.isConfigured()) {
      try { state.posts = await forum.fetchMyPosts(userId, email); } catch (error) {}
    }
    if (support && typeof support.fetchMySupportMessages === 'function' && support.isConfigured()) {
      try { state.supportMessages = await support.fetchMySupportMessages(userId, email); } catch (error) {}
      try { state.messageBoard = await support.fetchMyMessageBoard(userId); } catch (error) {}
    }
    return state;
  }

  async function createClubWithFallbackSlug(service, payload, userId, ownedBySlug) {
    var baseSlug = slugify(payload.slug || payload.name);
    var attempt = 0;
    while (attempt < 4) {
      var nextPayload = Object.assign({}, payload, {
        slug: attempt === 0 ? baseSlug : (baseSlug + '-migrated-' + attempt)
      });
      var owned = ownedBySlug[normalizeKey(nextPayload.slug)];
      if (owned) {
        return service.updateClub(owned.id, nextPayload, userId);
      }
      try {
        return await service.createClub(nextPayload, userId);
      } catch (error) {
        var message = normalizeKey(error && error.message);
        if (message.indexOf('duplicate') === -1 && message.indexOf('unique') === -1) throw error;
      }
      attempt += 1;
    }
    throw new Error('Unable to create a unique club slug for local migration.');
  }

  async function createCourseWithFallbackSlug(service, payload, userId, ownedBySlug) {
    var baseSlug = slugify(payload.slug || payload.title);
    var attempt = 0;
    while (attempt < 4) {
      var nextPayload = Object.assign({}, payload, {
        slug: attempt === 0 ? baseSlug : (baseSlug + '-migrated-' + attempt)
      });
      var owned = ownedBySlug[normalizeKey(nextPayload.slug)];
      if (owned) {
        return service.updateCourse(owned.id, nextPayload, userId);
      }
      try {
        return await service.createCourse(nextPayload, userId);
      } catch (error) {
        var message = normalizeKey(error && error.message);
        if (message.indexOf('duplicate') === -1 && message.indexOf('unique') === -1) throw error;
      }
      attempt += 1;
    }
    throw new Error('Unable to create a unique course slug for local migration.');
  }

  function chunkList(list, size) {
    var out = [];
    var current = [];
    (Array.isArray(list) ? list : []).forEach(function (item) {
      current.push(item);
      if (current.length >= size) {
        out.push(current);
        current = [];
      }
    });
    if (current.length) out.push(current);
    return out;
  }

  async function upsertClubSlots(client, remoteClub, localClub) {
    var rows = buildSlotRows(remoteClub, localClub);
    if (!rows.length) return [];
    var chunks = chunkList(rows, 150);
    for (var i = 0; i < chunks.length; i += 1) {
      var result = await client
        .from('club_slots')
        .upsert(chunks[i], { onConflict: 'club_id,day_iso,start_time,end_time' });
      if (result.error) throw result.error;
    }
    var fetchResult = await client
      .from('club_slots')
      .select('id, club_id, day_iso, start_time, end_time')
      .eq('club_id', trimText(remoteClub && remoteClub.id));
    if (fetchResult.error) throw fetchResult.error;
    return Array.isArray(fetchResult.data) ? fetchResult.data : [];
  }

  async function resolveOrCreateFallbackClub(service, ownedBySlug, booking, userId) {
    var name = trimText(booking && booking.clubName) || 'Imported Club';
    var payload = {
      slug: slugify(booking && booking.clubSlug || name),
      name: name,
      category: 'Sports',
      mode: 'In-person',
      location: trimText(booking && booking.location),
      mapLink: '',
      onlineLink: '',
      time: '',
      fee: trimText(booking && booking.fee) || '£0',
      seats: 20,
      cover: '',
      tags: [],
      desc: '',
      heroSub: '',
      venueInfo: '',
      whatWeDo: '',
      audience: '',
      trainingPlan: '',
      notes: '',
      status: 'approved'
    };
    return createClubWithFallbackSlug(service, payload, userId, ownedBySlug);
  }

  async function migrateClubs(client, localData, existingState, userId, onProgress) {
    var service = getAdminService();
    if (!service || !service.isConfigured()) throw new Error('Club admin service is not configured.');
    var ownedClubs = Array.isArray(existingState && existingState.clubs) ? existingState.clubs.slice() : [];
    var ownedBySlug = {};
    ownedClubs.forEach(function (club) {
      var key = normalizeKey(club && club.slug);
      if (key) ownedBySlug[key] = club;
    });

    var migrated = [];
    var counts = { clubs: 0, slots: 0 };
    for (var i = 0; i < localData.clubs.length; i += 1) {
      var club = localData.clubs[i];
      if (typeof onProgress === 'function') onProgress('Importing club ' + (i + 1) + ' of ' + localData.clubs.length + ': ' + club.name);
      var payload = {
        slug: club.slug,
        name: club.name,
        category: club.category,
        mode: club.mode,
        location: club.location,
        mapLink: club.mapLink,
        onlineLink: club.onlineLink,
        time: club.time,
        fee: club.fee,
        seats: club.seats,
        cover: club.cover,
        tags: club.tags,
        desc: club.desc,
        heroSub: club.heroSub,
        venueInfo: club.venueInfo,
        whatWeDo: club.whatWeDo,
        audience: club.audience,
        trainingPlan: club.trainingPlan,
        notes: club.notes,
        status: club.status || 'approved'
      };
      var remoteClub = await createClubWithFallbackSlug(service, payload, userId, ownedBySlug);
      counts.clubs += 1;
      var slotRows = await upsertClubSlots(client, remoteClub, club);
      counts.slots += slotRows.length;
      var merged = Object.assign({}, club, remoteClub, { slotRows: slotRows });
      migrated.push(merged);
      ownedBySlug[normalizeKey(remoteClub && remoteClub.slug)] = remoteClub;
    }
    return { clubs: migrated, counts: counts };
  }

  async function migrateMembers(client, localData, existingState, clubLookup, onProgress) {
    var service = getAdminService();
    if (!service || !service.isConfigured()) return { members: [], count: 0 };
    var existingKeys = {};
    (Array.isArray(existingState && existingState.members) ? existingState.members : []).forEach(function (item) {
      var key = normalizeKey([
        item && item.clubId,
        item && item.userEmail,
        item && item.name,
        item && item.role
      ].join('|'));
      if (key) existingKeys[key] = true;
    });
    var count = 0;
    var created = [];
    var list = Array.isArray(localData && localData.members) ? localData.members : [];
    for (var i = 0; i < list.length; i += 1) {
      var item = list[i] || {};
      var remoteClub = resolveClubFromLookup(clubLookup, item);
      if (!remoteClub) continue;
      var dedupeKey = normalizeKey([
        remoteClub.id,
        item.userEmail,
        item.name,
        item.role
      ].join('|'));
      if (!dedupeKey || existingKeys[dedupeKey]) continue;
      if (typeof onProgress === 'function') onProgress('Importing member ' + (i + 1) + ' of ' + list.length);
      try {
        var row = await service.createMember({
          clubId: remoteClub.id,
          name: trimText(item.name),
          userEmail: trimText(item.userEmail),
          role: trimText(item.role) || 'member'
        });
        created.push(row);
        existingKeys[dedupeKey] = true;
        count += 1;
      } catch (error) {}
    }
    return { members: created, count: count };
  }

  async function migrateBookings(client, localData, existingState, clubLookup, slotLookup, userId, onProgress) {
    var count = 0;
    var existingOrderIds = {};
    var existingKeys = {};
    (Array.isArray(existingState && existingState.bookings) ? existingState.bookings : []).forEach(function (item) {
      var orderId = trimText(item && item.orderId);
      if (orderId) existingOrderIds[normalizeKey(orderId)] = true;
      var key = normalizeKey([
        item && item.clubId,
        item && item.dayIso,
        item && item.slotTime,
        item && item.status
      ].join('|'));
      if (key) existingKeys[key] = true;
    });
    var service = getAdminService();
    var ownedBySlug = {};
    Object.keys(clubLookup || {}).forEach(function (key) {
      var club = clubLookup[key];
      if (club && club.slug) ownedBySlug[normalizeKey(club.slug)] = club;
    });

    for (var i = 0; i < localData.bookings.length; i += 1) {
      var booking = localData.bookings[i] || {};
      var remoteClub = resolveClubFromLookup(clubLookup, booking);
      if (!remoteClub) {
        remoteClub = await resolveOrCreateFallbackClub(service, ownedBySlug, booking, userId);
        clubLookup[normalizeKey(remoteClub.id)] = remoteClub;
        clubLookup[normalizeKey(remoteClub.slug)] = remoteClub;
        clubLookup[normalizeKey(remoteClub.name)] = remoteClub;
        var fallbackSlots = await upsertClubSlots(client, remoteClub, {
          seats: 20,
          slots: [{ time: trimText(booking.slotTime) || '9:00-10:00', capacity: 20 }]
        });
        var fallbackLookup = buildSlotLookupRows(fallbackSlots);
        Object.keys(fallbackLookup).forEach(function (key) { slotLookup[key] = fallbackLookup[key]; });
      }

      var dayIso = formatIsoDate(booking.dayIso || booking.dayLabel || new Date());
      var slotTime = trimText(booking.slotTime) || '9:00-10:00';
      var slotKey = buildSlotLookupKey(remoteClub.id, dayIso, slotTime);
      var remoteSlot = slotLookup[slotKey] || null;
      if (!remoteSlot) {
        try {
          var rangeParts = slotTime.split('-');
          var createdSlot = await client
            .from('club_slots')
            .upsert({
              club_id: trimText(remoteClub.id),
              day_iso: dayIso,
              day_label: trimText(booking.dayLabel) || dayIso,
              start_time: toSqlTime(rangeParts[0], 9),
              end_time: toSqlTime(rangeParts[1], 10),
              capacity: Math.max(1, toNumber(remoteClub.seats, 20)),
              status: 'open'
            }, {
              onConflict: 'club_id,day_iso,start_time,end_time'
            })
            .select('id, club_id, day_iso, start_time, end_time')
            .single();
          if (!createdSlot.error && createdSlot.data) {
            remoteSlot = {
              id: trimText(createdSlot.data.id),
              clubId: trimText(createdSlot.data.club_id),
              dayIso: formatIsoDate(createdSlot.data.day_iso),
              startTime: trimText(createdSlot.data.start_time),
              endTime: trimText(createdSlot.data.end_time)
            };
            slotLookup[slotKey] = remoteSlot;
          }
        } catch (error) {}
      }
      if (!remoteSlot) continue;

      var orderId = trimText(booking.orderId);
      if (orderId && existingOrderIds[normalizeKey(orderId)]) continue;
      var status = normalizeBookingStatus(booking.status);
      var dedupeKey = normalizeKey([remoteClub.id, dayIso, slotTime, status].join('|'));
      if (existingKeys[dedupeKey]) continue;

      if (typeof onProgress === 'function') onProgress('Importing club booking ' + (i + 1) + ' of ' + localData.bookings.length);
      var payload = {
        order_id: orderId || ('imported-booking-' + Date.now() + '-' + i),
        user_id: trimText(userId),
        club_id: trimText(remoteClub.id),
        slot_id: trimText(remoteSlot.id),
        status: status,
        payment_status: normalizePaymentStatus(booking),
        day_iso: dayIso,
        day_label: trimText(booking.dayLabel) || dayIso,
        slot_time: slotTime,
        location: trimText(booking.location || remoteClub.location),
        fee_text: trimText(booking.fee || remoteClub.fee) || '£0',
        base_fee: parseMoney(booking.baseFee || booking.fee || remoteClub.fee),
        service_fee: parseMoney(booking.serviceFee),
        discount: parseMoney(booking.discount),
        payable_amount: parseMoney(booking.payableAmount || booking.paidAmount || booking.fee || remoteClub.fee),
        created_at: safeDate(booking.createdAt),
        checked_in_at: status === 'checked_in' ? safeDate(booking.checkedInAt || booking.createdAt) : null,
        completed_at: status === 'completed' ? safeDate(booking.completedAt || booking.createdAt) : null,
        cancelled_at: status === 'cancelled' ? safeDate(booking.cancelledAt || booking.createdAt) : null
      };
      var result = await client.from('club_bookings').insert(payload);
      if (result.error) continue;
      existingKeys[dedupeKey] = true;
      if (payload.order_id) existingOrderIds[normalizeKey(payload.order_id)] = true;
      count += 1;
    }
    return count;
  }

  async function migrateCourses(localData, existingState, clubLookup, userId, onProgress) {
    var service = getAdminService();
    if (!service || !service.isConfigured()) return { courses: [], count: 0 };
    var ownedBySlug = {};
    (Array.isArray(existingState && existingState.courses) ? existingState.courses : []).forEach(function (course) {
      var key = normalizeKey(course && course.slug);
      if (key) ownedBySlug[key] = course;
    });
    var count = 0;
    var migrated = [];
    for (var i = 0; i < localData.courses.length; i += 1) {
      var course = localData.courses[i];
      var remoteClub = resolveClubFromLookup(clubLookup, course) || null;
      var payload = {
        slug: course.slug,
        clubId: trimText(remoteClub && remoteClub.id) || null,
        title: course.title,
        englishClub: course.englishClub || trimText(remoteClub && remoteClub.category),
        level: course.level,
        mode: course.mode,
        time: course.time,
        schedule: course.schedule,
        location: course.location,
        seats: course.seats,
        fee: course.fee,
        cover: course.cover,
        desc: course.desc,
        lead: course.lead,
        detail: course.detail,
        coachName: course.coachName,
        coachTitle: course.coachTitle,
        coachBio: course.coachBio,
        learningPoints: course.learningPoints,
        audienceTips: course.audienceTips,
        notesList: course.notesList,
        popularity: course.popularity,
        club: trimText(remoteClub && remoteClub.name) || course.clubName,
        clubSlug: trimText(remoteClub && remoteClub.slug) || course.clubSlug,
        clubCategory: trimText(remoteClub && remoteClub.category) || course.clubCategory
      };
      if (typeof onProgress === 'function') onProgress('Importing course ' + (i + 1) + ' of ' + localData.courses.length + ': ' + course.title);
      var remoteCourse = await createCourseWithFallbackSlug(service, payload, userId, ownedBySlug);
      migrated.push(Object.assign({}, course, remoteCourse));
      ownedBySlug[normalizeKey(remoteCourse && remoteCourse.slug)] = remoteCourse;
      count += 1;
    }
    return { courses: migrated, count: count };
  }

  async function migrateCourseBookings(client, localData, existingState, courseLookup, userId, onProgress) {
    var count = 0;
    var existingKeys = {};
    (Array.isArray(existingState && existingState.courseBookings) ? existingState.courseBookings : []).forEach(function (item) {
      var key = normalizeKey([
        item && item.courseId,
        item && item.time,
        item && item.status
      ].join('|'));
      if (key) existingKeys[key] = true;
    });

    for (var i = 0; i < localData.courseBookings.length; i += 1) {
      var item = localData.courseBookings[i] || {};
      var remoteCourse = resolveCourseFromLookup(courseLookup, item);
      if (!remoteCourse) continue;
      var selectedSchedule = trimText(item.selectedSchedule || item.time || remoteCourse.time);
      var status = normalizeCourseBookingStatus(item.status);
      var key = normalizeKey([remoteCourse.id, selectedSchedule, status].join('|'));
      if (existingKeys[key]) continue;
      if (typeof onProgress === 'function') onProgress('Importing course booking ' + (i + 1) + ' of ' + localData.courseBookings.length);
      var result = await client.from('course_bookings').insert({
        user_id: trimText(userId),
        course_id: trimText(remoteCourse.id),
        status: status,
        selected_schedule: selectedSchedule || null,
        booked_at: safeDate(item.bookedAt || item.createdAt),
        created_at: safeDate(item.bookedAt || item.createdAt),
        cancelled_at: status === 'cancelled' ? safeDate(item.cancelledAt || item.createdAt) : null
      });
      if (result.error) continue;
      existingKeys[key] = true;
      count += 1;
    }
    return count;
  }

  async function migrateFavorites(localData, existingState, courseLookup, userId, onProgress) {
    var service = getCourseService();
    if (!service || !service.isConfigured()) return 0;
    var existingIds = {};
    (Array.isArray(existingState && existingState.favorites) ? existingState.favorites : []).forEach(function (item) {
      var key = normalizeKey(item && item.courseId);
      if (key) existingIds[key] = true;
    });
    var favorites = [];
    (Array.isArray(localData.favorites) ? localData.favorites : []).forEach(function (item) {
      favorites.push(item);
    });
    toArray(localData.favoriteIds).forEach(function (id) {
      favorites.push((localData.courseCache && localData.courseCache[id]) || { courseId: id });
    });
    var count = 0;
    for (var i = 0; i < favorites.length; i += 1) {
      var favorite = favorites[i];
      var remoteCourse = resolveCourseFromLookup(courseLookup, favorite);
      if (!remoteCourse) continue;
      var courseId = trimText(remoteCourse.id);
      if (!courseId || existingIds[normalizeKey(courseId)]) continue;
      if (typeof onProgress === 'function') onProgress('Importing favorite ' + (i + 1) + ' of ' + favorites.length);
      try {
        await service.addFavorite(userId, courseId);
        existingIds[normalizeKey(courseId)] = true;
        count += 1;
      } catch (error) {}
    }
    return count;
  }

  function forumFingerprint(post) {
    return normalizeKey([
      trimText(post && post.title),
      trimText(post && post.content),
      trimText(post && post.club),
      trimText(post && post.videoUrl),
      toArray(post && post.imageUrls).join('|')
    ].join('|'));
  }

  async function migrateForumComments(service, postId, comments, userId, email) {
    var count = 0;
    async function walk(list, parentId) {
      for (var i = 0; i < list.length; i += 1) {
        var comment = list[i] || {};
        var text = trimText(comment.text || comment.content);
        if (!text && !trimText(comment.imageUrl)) continue;
        try {
          var created = await service.createComment(
            postId,
            parentId || null,
            text,
            trimText(comment.imageUrl),
            userId,
            email
          );
          count += 1;
          await walk(Array.isArray(comment.replies) ? comment.replies : [], trimText(created && created.id));
        } catch (error) {}
      }
    }
    await walk(Array.isArray(comments) ? comments : [], null);
    return count;
  }

  async function migrateForumPosts(localData, existingState, userId, email, profile, onProgress) {
    var service = getForumService();
    if (!service || !service.isConfigured()) return { posts: 0, comments: 0 };
    var existingFingerprints = {};
    (Array.isArray(existingState && existingState.posts) ? existingState.posts : []).forEach(function (item) {
      var key = forumFingerprint(item);
      if (key) existingFingerprints[key] = true;
    });
    var counts = { posts: 0, comments: 0 };
    for (var i = 0; i < localData.forumPosts.length; i += 1) {
      var post = localData.forumPosts[i];
      var fingerprint = forumFingerprint(post);
      if (!fingerprint || existingFingerprints[fingerprint]) continue;
      if (typeof onProgress === 'function') onProgress('Importing forum post ' + (i + 1) + ' of ' + localData.forumPosts.length);
      try {
        var createdPost = await service.createPost({
          title: trimText(post.title),
          type: trimText(post.type) || 'Experience Sharing',
          club: trimText(post.club) || 'Platform General',
          content: trimText(post.content),
          author: trimText(profile && profile.nickname),
          imageUrls: toArray(post.imageUrls),
          videoUrl: trimText(post.videoUrl),
          videoName: trimText(post.videoName),
          channel: trimText(post.channel),
          visibility: trimText(post.visibility) || 'public',
          pinned: !!post.pinned
        }, userId, email);
        counts.posts += 1;
        counts.comments += await migrateForumComments(
          service,
          trimText(createdPost && createdPost.id),
          Array.isArray(post.comments) ? post.comments : [],
          userId,
          email
        );
        existingFingerprints[fingerprint] = true;
      } catch (error) {}
    }
    return counts;
  }

  async function migrateSupportMessages(client, localData, existingState, userId, email, profile, onProgress) {
    var messages = Array.isArray(localData.supportMessages) ? localData.supportMessages.slice() : [];
    if (!messages.length) return 0;
    var existingKeys = {};
    (Array.isArray(existingState && existingState.supportMessages) ? existingState.supportMessages : []).forEach(function (item) {
      var key = normalizeKey([item && item.threadCategory, item && item.text].join('|'));
      if (key) existingKeys[key] = true;
    });
    var grouped = {};
    messages.forEach(function (item) {
      var category = trimText(item && (item.threadCategory || item.category)) || 'General';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(item);
    });
    var count = 0;
    var categories = Object.keys(grouped);
    for (var i = 0; i < categories.length; i += 1) {
      var category = categories[i];
      if (typeof onProgress === 'function') onProgress('Importing support history for ' + category);
      var threadResult = await client
        .from('support_threads')
        .insert({
          user_id: trimText(userId),
          subject: 'Imported Local Support History',
          category: category,
          status: 'waiting_reply'
        })
        .select('id')
        .single();
      if (threadResult.error || !threadResult.data || !threadResult.data.id) continue;
      var threadId = trimText(threadResult.data.id);
      var rows = grouped[category]
        .sort(function (a, b) { return Date.parse(a && a.createdAt || '') - Date.parse(b && b.createdAt || ''); })
        .map(function (item) {
          return item && typeof item === 'object' ? item : {};
        })
        .filter(function (item) {
          var key = normalizeKey([category, item && item.text].join('|'));
          return key && !existingKeys[key];
        })
        .map(function (item) {
          var key = normalizeKey([category, item && item.text].join('|'));
          existingKeys[key] = true;
          return {
            thread_id: threadId,
            sender_id: trimText(userId),
            sender_role: 'user',
            sender_name: trimText(profile && profile.nickname) || trimText(email) || 'User',
            message_text: trimText(item && item.text),
            attachments: Array.isArray(item && item.attachments) ? item.attachments : [],
            created_at: safeDate(item && item.createdAt)
          };
        });
      if (!rows.length) continue;
      var insertResult = await client.from('support_messages').insert(rows);
      if (insertResult.error) continue;
      count += rows.length;
    }
    return count;
  }

  async function migrateMessageBoard(localData, existingState, onProgress) {
    var service = getSupportService();
    if (!service || !service.isConfigured()) return 0;
    var existingKeys = {};
    (Array.isArray(existingState && existingState.messageBoard) ? existingState.messageBoard : []).forEach(function (item) {
      var key = normalizeKey([
        item && item.targetEmail,
        item && item.targetName,
        item && item.text,
        item && item.source
      ].join('|'));
      if (key) existingKeys[key] = true;
    });
    var count = 0;
    for (var i = 0; i < localData.messageBoard.length; i += 1) {
      var item = localData.messageBoard[i] || {};
      var key = normalizeKey([
        item.targetEmail,
        item.targetName,
        item.text,
        item.source
      ].join('|'));
      var fromEmail = normalizeEmail(item.fromEmail);
      if (fromEmail && fromEmail !== TARGET_EMAIL) continue;
      if (!key || existingKeys[key]) continue;
      if (!trimText(item.targetUserId || item.targetEmail || item.targetName)) continue;
      if (typeof onProgress === 'function') onProgress('Importing message board item ' + (i + 1) + ' of ' + localData.messageBoard.length);
      try {
        await service.sendMessageBoardEntry({
          targetUserId: trimText(item.targetUserId),
          targetEmail: trimText(item.targetEmail),
          targetName: trimText(item.targetName),
          text: trimText(item.text),
          source: trimText(item.source) || 'forum-profile'
        });
        existingKeys[key] = true;
        count += 1;
      } catch (error) {}
    }
    return count;
  }

  function clearBusinessLocalCache() {
    FIXED_CLEAR_KEYS.forEach(function (key) {
      try { window.localStorage.removeItem(key); } catch (error) {}
    });
    try {
      for (var i = window.localStorage.length - 1; i >= 0; i -= 1) {
        var key = String(window.localStorage.key(i) || '');
        if (key.indexOf('mfms_favs_v1:') === 0) {
          window.localStorage.removeItem(key);
        }
      }
    } catch (error) {}
  }

  async function runMigration(options) {
    var config = options || {};
    var email = normalizeEmail(config.email);
    var userId = trimText(config.userId);
    var profile = config.profile || {};
    var onProgress = typeof config.onProgress === 'function' ? config.onProgress : null;

    if (!isTargetAccount(email)) {
      throw new Error('This local migration is restricted to ' + TARGET_EMAIL + '.');
    }
    if (!hasSupabase()) {
      throw new Error('Supabase is not configured.');
    }
    if (!userId) {
      throw new Error('Missing authenticated user id.');
    }

    var inspection = inspectLocalData(email, profile);
    if (!inspection.total) {
      var emptyStatus = writeStatus(email, {
        completed: true,
        running: false,
        startedAt: safeDate(new Date()),
        finishedAt: safeDate(new Date()),
        counts: inspection,
        lastMessage: 'No local business data was found to migrate.'
      });
      emptyStatus.counts = inspection;
      return emptyStatus;
    }

    writeStatus(email, {
      completed: false,
      running: true,
      startedAt: safeDate(new Date()),
      counts: inspection,
      lastError: '',
      lastMessage: 'Preparing local data import.'
    });

    var client = getSupabaseClientSafe();
    var localData = collectLocalBusinessData(email, profile);
    var existingState = await fetchExistingState(userId, email);
    var counts = {
      clubs: 0,
      slots: 0,
      members: 0,
      bookings: 0,
      courses: 0,
      courseBookings: 0,
      favorites: 0,
      posts: 0,
      comments: 0,
      supportMessages: 0,
      messageBoard: 0
    };

    try {
      if (onProgress) onProgress('Syncing profile to cloud account.');
      await ensureProfile(client, userId, email, profile);

      var clubResult = await migrateClubs(client, localData, existingState, userId, onProgress);
      counts.clubs = clubResult.counts.clubs;
      counts.slots = clubResult.counts.slots;
      var clubLookup = buildClubLookup(
        (clubResult.clubs || []).concat(Array.isArray(existingState && existingState.clubs) ? existingState.clubs : [])
      );

      var memberResult = await migrateMembers(client, localData, existingState, clubLookup, onProgress);
      counts.members = memberResult.count;

      var slotLookup = {};
      (clubResult.clubs || []).forEach(function (club) {
        var rows = buildSlotLookupRows(club && club.slotRows);
        Object.keys(rows).forEach(function (key) {
          slotLookup[key] = rows[key];
        });
      });

      counts.bookings = await migrateBookings(client, localData, existingState, clubLookup, slotLookup, userId, onProgress);

      var courseResult = await migrateCourses(localData, existingState, clubLookup, userId, onProgress);
      counts.courses = courseResult.count;
      var courseLookup = buildCourseLookup(
        (courseResult.courses || [])
          .concat(Array.isArray(existingState && existingState.courses) ? existingState.courses : [])
          .concat(Array.isArray(existingState && existingState.publicCourses) ? existingState.publicCourses : [])
      );

      counts.courseBookings = await migrateCourseBookings(client, localData, existingState, courseLookup, userId, onProgress);
      counts.favorites = await migrateFavorites(localData, existingState, courseLookup, userId, onProgress);

      var forumCounts = await migrateForumPosts(localData, existingState, userId, email, profile, onProgress);
      counts.posts = forumCounts.posts;
      counts.comments = forumCounts.comments;

      counts.supportMessages = await migrateSupportMessages(client, localData, existingState, userId, email, profile, onProgress);
      counts.messageBoard = await migrateMessageBoard(localData, existingState, onProgress);

      clearBusinessLocalCache();

      return writeStatus(email, {
        completed: true,
        running: false,
        finishedAt: safeDate(new Date()),
        counts: counts,
        lastError: '',
        lastMessage: 'Local business data has been moved into ' + TARGET_EMAIL + ' and the browser cache was cleared.'
      });
    } catch (error) {
      writeStatus(email, {
        completed: false,
        running: false,
        finishedAt: safeDate(new Date()),
        counts: counts,
        lastError: trimText(error && error.message) || 'Migration failed.',
        lastMessage: 'Local business data migration did not finish.'
      });
      throw error;
    }
  }

  window.clubLocalDataMigration = {
    TARGET_EMAIL: TARGET_EMAIL,
    isTargetAccount: isTargetAccount,
    readStatus: readStatus,
    inspectLocalData: inspectLocalData,
    isBusinessCacheDisabled: isBusinessCacheDisabled,
    runMigration: runMigration
  };
})(window);
