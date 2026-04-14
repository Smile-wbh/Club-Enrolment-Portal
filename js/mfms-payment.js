(function () {
  var KEYS = {
    session: 'user_session_v1',
    pending: 'mfms_pending_course_booking_v1',
    bookings: 'mfms_teaching_bookings_v1'
  };

  var METHOD_TEXT = {
    card: 'Recommended for standard course bookings. Once completed, it syncs immediately to User Dashboard -> Course Bookings.',
    paypal: 'Best for completing payment across devices. In the current preview build, success is simulated instantly.',
    apple: 'Great for quick confirmation on mobile devices. In the current preview build, completion is simulated instantly.'
  };

  var METHOD_LABEL = {
    card: 'Bank Card',
    paypal: 'PayPal',
    apple: 'Apple Pay'
  };

  var state = {
    order: null,
    method: 'card',
    discount: 0,
    couponCode: '',
    timer: null,
    redirectTimer: null
  };

  function readJson(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function trimText(value) {
    return String(value || '').trim();
  }

  function normalizeEmail(value) {
    return trimText(value).toLowerCase();
  }

  function normalizeBookingStatus(value) {
    var text = trimText(value);
    var normalizedText = text.toLowerCase();
    if (normalizedText === 'booked') return 'Booked';
    if (normalizedText === 'cancelled' || normalizedText === 'canceled') return 'Cancelled';
    return text || 'Booked';
  }

  function getCourseService() {
    return window.clubCourseSupabase || null;
  }

  function getMembershipService() {
    return window.clubMembershipSupabase || null;
  }

  function hasSupabaseCourses() {
    var service = getCourseService();
    return !!(service && typeof service.isConfigured === 'function' && service.isConfigured());
  }

  function hasSupabaseMemberships() {
    var service = getMembershipService();
    return !!(service && typeof service.isConfigured === 'function' && service.isConfigured());
  }

  function isBusinessCacheDisabled(email) {
    var service = window.clubLocalDataMigration || null;
    return !!(service && typeof service.isBusinessCacheDisabled === 'function' && service.isBusinessCacheDisabled(normalizeEmail(email)));
  }

  function readSession() {
    try {
      var local = JSON.parse(window.localStorage.getItem(KEYS.session) || 'null');
      if (local && trimText(local.email)) return local;
    } catch (error) {}

    try {
      var session = JSON.parse(window.sessionStorage.getItem(KEYS.session) || 'null');
      if (session && trimText(session.email)) return session;
    } catch (error) {}

    return null;
  }

  function readPendingOrder() {
    var order = readJson(KEYS.pending, null);
    return order && typeof order === 'object' ? order : null;
  }

  function readBookings() {
    var session = readSession();
    if (isBusinessCacheDisabled((session && session.email) || (state.order && state.order.userEmail))) {
      return [];
    }
    var bookings = readJson(KEYS.bookings, []);
    return Array.isArray(bookings) ? bookings : [];
  }

  function money(value) {
    var amount = Number(value || 0);
    return '£' + amount.toFixed(2);
  }

  function setStatus(id, text, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = trimText(text);
    el.className = 'inline-status' + (text ? (' ' + (type || 'info')) : '');
  }

  function setStepState(step) {
    var items = document.querySelectorAll('.step-item');
    items.forEach(function (item, index) {
      item.classList.remove('is-active', 'is-done');
      if (step > index + 1) item.classList.add('is-done');
      if (step === index + 1) item.classList.add('is-active');
    });
  }

  function currentPayable() {
    if (!state.order) return 0;
    return Math.max(0, Number(state.order.baseFee || 0) + Number(state.order.serviceFee || 0) - Number(state.discount || 0));
  }

  function syncOrderTotals() {
    if (!state.order) return;
    state.order.discount = Number(state.discount || 0);
    state.order.payableAmount = currentPayable();
    state.order.couponCode = trimText(state.couponCode);
  }

  function updatePayButtonText() {
    var btn = document.getElementById('paySubmitBtn');
    if (!btn) return;
    var total = currentPayable();
    btn.textContent = total > 0 ? ('Confirm Payment ' + money(total)) : 'Confirm Booking (Free)';
  }

  function updateMethodUI() {
    var intro = document.getElementById('methodIntro');
    var cardFields = document.getElementById('cardFields');
    document.querySelectorAll('.method-option').forEach(function (btn) {
      var isActive = btn.getAttribute('data-method') === state.method;
      btn.classList.toggle('is-active', isActive);
    });
    if (intro) intro.textContent = METHOD_TEXT[state.method] || METHOD_TEXT.card;
    if (cardFields) cardFields.hidden = state.method !== 'card';
  }

  function renderOrder() {
    if (!state.order) return;

    var formatParts = [trimText(state.order.level), trimText(state.order.mode)].filter(Boolean);
    var fields = {
      orderCourseTitle: trimText(state.order.title) || '-',
      orderClubName: trimText(state.order.clubName) || '-',
      orderFormatText: formatParts.join(' · ') || '-',
      orderScheduleText: trimText(state.order.selectedSchedule) || '-',
      orderLocation: trimText(state.order.location) || '-',
      orderIdText: trimText(state.order.orderId) || '-',
      orderUserEmail: trimText(state.order.userEmail) || '-',
      baseFeeText: money(state.order.baseFee),
      serviceFeeText: money(state.order.serviceFee),
      discountText: '-' + money(state.discount),
      payableAmountText: money(currentPayable())
    };

    Object.keys(fields).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = fields[id];
    });

    var paymentStateText = document.getElementById('paymentStateText');
    if (paymentStateText) paymentStateText.textContent = 'Pending Payment';

    updatePayButtonText();
    updateMethodUI();
  }

  function buildCourseDetailUrl(record) {
    var payload = record || state.order || {};
    var courseId = trimText(payload.courseId);
    if (!courseId) return 'mfms.html';
    return 'mfms-detail.html?id=' + encodeURIComponent(courseId);
  }

  function buildDashboardUrl() {
    return 'join.html?tab=teaching_bookings';
  }

  function buildEmptyState(title, message) {
    var empty = document.getElementById('paymentEmpty');
    if (!empty) return;
    empty.hidden = false;
    empty.innerHTML =
      '<h2>' + title + '</h2>' +
      '<p>' + message + '</p>' +
      '<div class="empty-actions">' +
        '<a class="primary-btn" href="' + buildCourseDetailUrl() + '">Back to Course Details</a>' +
        '<a class="ghost-btn" href="' + buildDashboardUrl() + '">View My Course Bookings</a>' +
      '</div>';
  }

  function getDeadlineAt() {
    if (!state.order) return 0;
    var created = Date.parse(trimText(state.order.createdAt));
    if (Number.isNaN(created)) created = Date.now();
    return created + 15 * 60 * 1000;
  }

  function isExpired() {
    return getDeadlineAt() <= Date.now();
  }

  function updateDeadline() {
    var note = document.getElementById('paymentDeadlineText');
    var payBtn = document.getElementById('paySubmitBtn');
    var stateText = document.getElementById('paymentStateText');
    if (!note || !payBtn) return;

    var diff = getDeadlineAt() - Date.now();
    if (diff <= 0) {
      note.textContent = 'This order has remained unpaid for more than 15 minutes and has expired. Please return to the course detail page and choose a new time slot.';
      payBtn.disabled = true;
      if (stateText) stateText.textContent = 'Expired';
      return;
    }

    var minutes = Math.floor(diff / 60000);
    var seconds = Math.floor((diff % 60000) / 1000);
    note.textContent = 'Complete payment within ' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + '. Once successful, the booking confirmation will appear here.';
    payBtn.disabled = false;
  }

  async function applyCoupon() {
    if (!state.order) return;
    var input = document.getElementById('couponInput');
    var code = trimText(input && input.value).toUpperCase();
    var totalAvailable = Number(state.order.baseFee || 0) + Number(state.order.serviceFee || 0);
    var serviceFee = Math.max(Number(state.order.serviceFee || 0), 0);
    var extraDiscount = Math.max(0, Math.min(2, totalAvailable - serviceFee));
    var totalMembershipDiscount = Math.min(totalAvailable, serviceFee + extraDiscount);

    if (!code) {
      state.discount = 0;
      state.couponCode = '';
      syncOrderTotals();
      renderOrder();
      setStatus('couponStatus', 'Coupon cleared. The order total has returned to the standard price.', 'info');
      return;
    }

    var session = readSession();
    var membershipService = getMembershipService();
    if (hasSupabaseMemberships() && session && trimText(session.userId) && membershipService && typeof membershipService.validateSportsMembershipCoupon === 'function') {
      try {
        var membership = await membershipService.validateSportsMembershipCoupon(trimText(session.userId), code);
        if (membership) {
          state.couponCode = code;
          state.discount = totalMembershipDiscount;
          syncOrderTotals();
          renderOrder();
          setStatus(
            'couponStatus',
            serviceFee > 0
              ? 'Membership code applied. The Platform Service Fee has been waived and an extra £2 discount has been applied.'
              : 'Membership code applied. This order already has no Platform Service Fee, and an extra £2 discount has been applied.',
            'success'
          );
          return;
        }
      } catch (error) {
        setStatus('couponStatus', membershipService.mapMembershipActionError(error), 'error');
        return;
      }
    }

    setStatus('couponStatus', 'This membership code is invalid for the current signed-in Sports Membership account.', 'error');
  }

  function validatePayment() {
    if (isExpired()) {
      setStatus('paymentStatus', 'This order has expired. Please return to the course detail page and start payment again.', 'error');
      return false;
    }

    if (state.method !== 'card') return true;

    var holder = trimText(document.getElementById('cardHolderName').value);
    var number = trimText(document.getElementById('cardNumber').value).replace(/\s+/g, '');
    var expiry = trimText(document.getElementById('cardExpiry').value);
    var cvv = trimText(document.getElementById('cardCvv').value);

    if (!holder || !number || !expiry || !cvv) {
      setStatus('paymentStatus', 'Please complete all bank card details.', 'error');
      return false;
    }

    if (!/^\d{12,19}$/.test(number)) {
      setStatus('paymentStatus', 'The bank card number format is invalid. Please re-enter it.', 'error');
      return false;
    }

    if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry)) {
      setStatus('paymentStatus', 'Expiry date must use the format MM / YY.', 'error');
      return false;
    }

    if (!/^\d{3,4}$/.test(cvv)) {
      setStatus('paymentStatus', 'The security code format is invalid.', 'error');
      return false;
    }

    return true;
  }

  function startSuccessRedirect(url, textEl) {
    if (state.redirectTimer) {
      window.clearInterval(state.redirectTimer);
      state.redirectTimer = null;
    }

    var countdown = 4;
    if (textEl) {
      textEl.textContent = 'Opening User Dashboard -> Course Bookings in ' + countdown + ' seconds.';
    }

    state.redirectTimer = window.setInterval(function () {
      countdown -= 1;
      if (countdown <= 0) {
        window.clearInterval(state.redirectTimer);
        state.redirectTimer = null;
        window.location.href = url;
        return;
      }
      if (textEl) {
        textEl.textContent = 'Opening User Dashboard -> Course Bookings in ' + countdown + ' seconds.';
      }
    }, 1000);
  }

  function showSuccess(record, existed) {
    var layout = document.getElementById('paymentLayout');
    var success = document.getElementById('paymentSuccess');
    var backToCourse = document.getElementById('successBackToCourse');
    var lead = document.getElementById('successLead');
    var autoText = document.getElementById('successAutoRedirectText');

    if (layout) layout.hidden = true;
    if (success) success.hidden = false;
    setStepState(3);

    var values = {
      successOrderId: trimText(record && record.orderId) || trimText(state.order && state.order.orderId) || '-',
      successCourseTitle: trimText(record && record.title) || trimText(state.order && state.order.title) || '-',
      successClubName: trimText(record && record.clubName) || trimText(state.order && state.order.clubName) || '-',
      successSlotTime: trimText(record && record.time) || trimText(state.order && state.order.selectedSchedule) || '-'
    };

    Object.keys(values).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = values[id];
    });

    if (lead) {
      lead.textContent = existed
        ? 'This course booking was already paid successfully before, so the booking confirmation is shown directly here.'
        : 'You can go back to the course detail page to review the course again, or open the user dashboard to check your course bookings.';
    }

    if (backToCourse) backToCourse.href = buildCourseDetailUrl(record);

    try {
      window.localStorage.removeItem(KEYS.pending);
    } catch (error) {}

    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }

    if (autoText) {
      startSuccessRedirect(buildDashboardUrl(), autoText);
    }
  }

  function syncLocalBookingMirror(record) {
    if (!record) return;
    if (isBusinessCacheDisabled(trimText(record.ownerEmail) || trimText(state.order && state.order.userEmail))) return;
    var bookings = readBookings();
    var nextRecord = Object.assign({}, record, {
      ownerEmail: trimText(record.ownerEmail) || trimText(state.order && state.order.userEmail)
    });
    var index = bookings.findIndex(function (item) {
      return trimText(item && item.id) === trimText(nextRecord.id);
    });
    if (index > -1) {
      bookings.splice(index, 1, nextRecord);
    } else {
      bookings.unshift(nextRecord);
    }
    writeJson(KEYS.bookings, bookings);
  }

  async function finalizePayment() {
    if (!state.order) return;
    if (!validatePayment()) return;

    var session = readSession();
    if (!session || normalizeEmail(session.email) !== normalizeEmail(state.order.userEmail)) {
      setStatus('paymentStatus', 'The current signed-in account does not match the pending order. Please start the booking again.', 'error');
      return;
    }

    if (state.order.bookingSource === 'supabase' && hasSupabaseCourses()) {
      var service = getCourseService();
      state.order.paymentMethod = METHOD_LABEL[state.method] || METHOD_LABEL.card;
      state.order.payerEmail = normalizeEmail(session.email) || normalizeEmail(state.order.userEmail);
      state.order.payableAmount = currentPayable();
      setStatus('paymentStatus', 'Payment successful. Syncing your booking to Supabase now.', 'success');
      try {
        var cloudRecord = await service.createCourseBooking({
          id: trimText(state.order.courseId),
          orderId: trimText(state.order.orderId),
          title: trimText(state.order.title),
          club: trimText(state.order.clubName),
          mode: trimText(state.order.mode),
          level: trimText(state.order.level),
          time: trimText(state.order.selectedSchedule),
          schedule: [trimText(state.order.selectedSchedule)],
          location: trimText(state.order.location),
          seats: Number(state.order.seats || 0),
          fee: trimText(state.order.feeText),
          source: 'supabase',
          baseFee: Number(state.order.baseFee || 0),
          serviceFee: Number(state.order.serviceFee || 0),
          discount: Number(state.order.discount || 0),
          payableAmount: Number(state.order.payableAmount || currentPayable()),
          paymentMethod: trimText(state.order.paymentMethod),
          payerEmail: trimText(state.order.payerEmail) || trimText(state.order.userEmail)
        }, trimText(state.order.selectedSchedule), state.order.userEmail);
        syncLocalBookingMirror(cloudRecord);
        showSuccess(cloudRecord, false);
        return;
      } catch (error) {
        setStatus('paymentStatus', service.mapCourseActionError(error), 'error');
        return;
      }
    }

    var bookings = readBookings();
    var existing = bookings.find(function (item) {
      return normalizeEmail(item && item.ownerEmail) === normalizeEmail(state.order.userEmail) &&
        trimText(item && item.courseId) === trimText(state.order.courseId) &&
        trimText(item && item.time) === trimText(state.order.selectedSchedule) &&
        normalizeBookingStatus(item && item.status) !== 'Cancelled';
    });

    if (existing) {
      showSuccess(existing, true);
      return;
    }

    var record = {
      id: Date.now(),
      orderId: trimText(state.order.orderId),
      courseId: trimText(state.order.courseId),
      title: trimText(state.order.title),
      clubName: trimText(state.order.clubName),
      mode: trimText(state.order.mode),
      level: trimText(state.order.level),
      time: trimText(state.order.selectedSchedule),
      location: trimText(state.order.location),
      seats: Number(state.order.seats || 0),
      fee: trimText(state.order.feeText) || money(state.order.baseFee),
      ownerEmail: trimText(state.order.userEmail),
      userEmail: trimText(state.order.userEmail),
      payerEmail: trimText(state.order.payerEmail) || trimText(state.order.userEmail),
      bookedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: 'Booked',
      paymentMethod: METHOD_LABEL[state.method] || METHOD_LABEL.card,
      paidAmount: currentPayable(),
      couponCode: state.couponCode
    };

    bookings.unshift(record);
    writeJson(KEYS.bookings, bookings);
    setStatus('paymentStatus', 'Payment successful. Syncing your booking record now.', 'success');
    showSuccess(record, false);
  }

  function bindEvents() {
    document.querySelectorAll('.method-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.method = trimText(btn.getAttribute('data-method')) || 'card';
        updateMethodUI();
        setStatus('paymentStatus', '', '');
      });
    });

    var applyCouponBtn = document.getElementById('applyCouponBtn');
    if (applyCouponBtn) {
      applyCouponBtn.addEventListener('click', applyCoupon);
    }

    var paySubmitBtn = document.getElementById('paySubmitBtn');
    if (paySubmitBtn) {
      paySubmitBtn.addEventListener('click', function () {
        finalizePayment();
      });
    }

    var paymentBackBtn = document.getElementById('paymentBackBtn');
    if (paymentBackBtn) {
      paymentBackBtn.addEventListener('click', function () {
        window.location.href = buildCourseDetailUrl();
      });
    }
  }

  function init() {
    state.order = readPendingOrder();
    if (!state.order) {
      buildEmptyState('No pending booking requires payment right now', 'Return to the course detail page, choose a time slot, and then come back here to complete payment.');
      return;
    }

    var session = readSession();
    if (!session || normalizeEmail(session.email) !== normalizeEmail(state.order.userEmail)) {
      buildEmptyState('This account cannot complete the current order', 'Please sign in with the account that started the booking before continuing to payment.');
      return;
    }

    state.discount = Number(state.order.discount || 0);
    state.couponCode = trimText(state.order.couponCode);
    syncOrderTotals();

    var empty = document.getElementById('paymentEmpty');
    var layout = document.getElementById('paymentLayout');
    if (empty) empty.hidden = true;
    if (layout) layout.hidden = false;

    renderOrder();
    bindEvents();
    setStepState(2);
    updateDeadline();
    state.timer = window.setInterval(updateDeadline, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
