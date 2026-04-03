(function () {
  var KEYS = {
    session: 'user_session_v1',
    pending: 'specialty_pending_payment_v1',
    bookings: 'specialty_bookings_v1'
  };

  var COUPONS = {
    CLUB2026: 1,
    WELCOME: 1.5,
    STUDENT: 2
  };

  var METHOD_TEXT = {
    card: 'Recommended for standard club bookings. Once completed, it syncs immediately to User Dashboard -> Club Bookings.',
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
    if (text === '\u5df2\u9884\u7ea6') return 'Booked';
    if (text === '\u5df2\u53d6\u6d88') return 'Cancelled';
    if (text === '\u5f85\u652f\u4ed8') return 'Pending Payment';
    if (text === '\u5df2\u8fc7\u671f') return 'Expired';
    return text;
  }

  function getBookingService() {
    return window.clubBookingSupabase || null;
  }

  function hasSupabaseBookings() {
    var service = getBookingService();
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
    if (!Array.isArray(bookings)) return [];
    var changed = false;
    var normalized = bookings.map(function (item) {
      if (!item || typeof item !== 'object') return item;
      var nextStatus = normalizeBookingStatus(item.status);
      var nextMethod = trimText(item.paymentMethod) === '\u94f6\u884c\u5361\u652f\u4ed8' ? 'Bank Card' : trimText(item.paymentMethod);
      var statusChanged = nextStatus !== trimText(item.status);
      var methodChanged = nextMethod !== trimText(item.paymentMethod);
      if (!statusChanged && !methodChanged) return item;
      changed = true;
      return Object.assign({}, item, {
        status: nextStatus,
        paymentMethod: nextMethod
      });
    });
    if (changed) writeJson(KEYS.bookings, normalized);
    return normalized;
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

  function buildBookingParams(payload) {
    var params = new URLSearchParams();
    if (trimText(payload.clubSlug)) params.set('club', trimText(payload.clubSlug));
    if (trimText(payload.dayIso)) params.set('day', trimText(payload.dayIso));
    if (trimText(payload.slotId)) params.set('slot', trimText(payload.slotId));
    return params;
  }

  function currentPayable() {
    if (!state.order) return 0;
    return Math.max(0, Number(state.order.baseFee || 0) + Number(state.order.serviceFee || 0) - Number(state.discount || 0));
  }

  function updatePayButtonText() {
    var btn = document.getElementById('paySubmitBtn');
    if (!btn) return;
    var total = currentPayable();
    btn.textContent = total > 0 ? ('Confirm Payment ' + money(total)) : 'Confirm Booking (Free)';
  }

  function renderOrder() {
    if (!state.order) return;

    var fields = {
      orderClubName: trimText(state.order.clubName) || '-',
      orderCategory: [trimText(state.order.category), trimText(state.order.mode)].filter(Boolean).join(' · ') || '-',
      orderDayLabel: trimText(state.order.dayLabel) || trimText(state.order.dayIso) || '-',
      orderSlotTime: trimText(state.order.slotTime) || '-',
      orderLocation: trimText(state.order.location) || '-',
      orderIdText: trimText(state.order.orderId) || '-',
      orderUserEmail: trimText(state.order.userEmail) || '-',
      baseFeeText: money(state.order.baseFee),
      serviceFeeText: money(state.order.serviceFee),
      discountText: '-'+ money(state.discount),
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

  function buildEmptyState(title, message) {
    var empty = document.getElementById('paymentEmpty');
    if (!empty) return;
    empty.hidden = false;
    empty.innerHTML =
      '<h2>' + title + '</h2>' +
      '<p>' + message + '</p>' +
      '<div class="empty-actions">' +
        '<a class="primary-btn" href="specialty.html">Back to Club Booking</a>' +
        '<a class="ghost-btn" href="join.html?tab=club_bookings">View My Bookings</a>' +
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
      note.textContent = 'This order has remained unpaid for more than 15 minutes and has expired. Please return to Club Booking and choose a new slot.';
      payBtn.disabled = true;
      if (stateText) stateText.textContent = 'Expired';
      return;
    }

    var minutes = Math.floor(diff / 60000);
    var seconds = Math.floor((diff % 60000) / 1000);
    note.textContent = 'Complete payment within ' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + '. Once successful, the booking confirmation will appear here.';
    payBtn.disabled = false;
  }

  function applyCoupon() {
    if (!state.order) return;
    var input = document.getElementById('couponInput');
    var code = trimText(input && input.value).toUpperCase();
    var available = Number(state.order.baseFee || 0) + Number(state.order.serviceFee || 0);

    if (!code) {
      state.discount = 0;
      state.couponCode = '';
      renderOrder();
      setStatus('couponStatus', 'Coupon cleared. The order total has returned to the standard price.', 'info');
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(COUPONS, code)) {
      setStatus('couponStatus', 'This coupon code is not available. Please check it and try again.', 'error');
      return;
    }

    state.couponCode = code;
    state.discount = Math.min(available, Number(COUPONS[code]));
    renderOrder();
    setStatus('couponStatus', 'Coupon applied. Current discount: ' + money(state.discount) + '.', 'success');
  }

  function validatePayment() {
    if (isExpired()) {
      setStatus('paymentStatus', 'This order has expired. Please return to Club Booking and start payment again.', 'error');
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

  function showSuccess(record, existed) {
    var layout = document.getElementById('paymentLayout');
    var success = document.getElementById('paymentSuccess');
    var backToBooking = document.getElementById('successBackToBooking');
    var lead = document.getElementById('successLead');
    var autoText = document.getElementById('successAutoRedirectText');

    if (layout) layout.hidden = true;
    if (success) success.hidden = false;
    setStepState(3);

    var values = {
      successOrderId: trimText(record && record.orderId) || trimText(state.order && state.order.orderId) || '-',
      successClubName: trimText(record && record.clubName) || trimText(state.order && state.order.clubName) || '-',
      successDayLabel: trimText(record && record.dayLabel) || trimText(state.order && state.order.dayLabel) || '-',
      successSlotTime: trimText(record && record.slotTime) || trimText(state.order && state.order.slotTime) || '-'
    };

    Object.keys(values).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = values[id];
    });

    if (lead) {
      lead.textContent = existed
        ? 'This booking was already paid successfully before, so the booking confirmation is shown directly here.'
        : 'You can return to Club Booking to view other slots, or open the user dashboard to check your booking record.';
    }

    var returnUrl = buildReturnUrl(record);
    if (backToBooking) backToBooking.href = returnUrl;

    try {
      window.localStorage.removeItem(KEYS.pending);
    } catch (error) {}

    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }

    if (autoText) {
      startSuccessRedirect(returnUrl, autoText);
    }
  }

  function buildReturnUrl(record) {
    var payload = record || state.order || {};
    var params = buildBookingParams(payload);
    if (trimText(payload.orderId)) params.set('order', trimText(payload.orderId));
    params.set('bookingSuccess', '1');
    return 'specialty.html?' + params.toString();
  }

  function buildBackUrl(record) {
    var params = buildBookingParams(record || state.order || {});
    var query = params.toString();
    return query ? ('specialty.html?' + query) : 'specialty.html';
  }

  function startSuccessRedirect(url, textEl) {
    if (state.redirectTimer) {
      window.clearInterval(state.redirectTimer);
      state.redirectTimer = null;
    }

    var countdown = 4;
    if (textEl) {
      textEl.textContent = 'Returning to Club Booking in ' + countdown + ' seconds and highlighting the slot you just booked.';
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
        textEl.textContent = 'Returning to Club Booking in ' + countdown + ' seconds and highlighting the slot you just booked.';
      }
    }, 1000);
  }

  function syncLocalBookingMirror(record) {
    if (!record) return;
    if (isBusinessCacheDisabled(trimText(record.userEmail) || trimText(state.order && state.order.userEmail))) return;
    var bookings = readBookings();
    var index = bookings.findIndex(function (item) {
      return trimText(item && item.id) === trimText(record.id);
    });
    var nextRecord = Object.assign({}, record, {
      userEmail: trimText(record.userEmail) || trimText(state.order && state.order.userEmail)
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

    if (state.order.bookingSource === 'supabase' && hasSupabaseBookings()) {
      var service = getBookingService();
      setStatus('paymentStatus', 'Payment successful. Syncing your booking to Supabase now.', 'success');
      try {
        var cloudRecord = await service.createBooking(state.order, state.order.userEmail);
        syncLocalBookingMirror(cloudRecord);
        showSuccess(cloudRecord, false);
        return;
      } catch (error) {
        setStatus('paymentStatus', service.mapCreateBookingError(error), 'error');
        return;
      }
    }

    var bookings = readBookings();
    var existing = bookings.find(function (item) {
        return normalizeEmail(item && item.userEmail) === normalizeEmail(state.order.userEmail) &&
        trimText(item && item.clubSlug) === trimText(state.order.clubSlug) &&
        trimText(item && item.dayIso) === trimText(state.order.dayIso) &&
        trimText(item && item.slotId) === trimText(state.order.slotId) &&
        normalizeBookingStatus(item && item.status) !== 'Cancelled';
    });

    if (existing) {
      showSuccess(existing, true);
      return;
    }

    var conflict = bookings.find(function (item) {
        return normalizeEmail(item && item.userEmail) === normalizeEmail(state.order.userEmail) &&
        trimText(item && item.dayIso) === trimText(state.order.dayIso) &&
        trimText(item && item.slotTime) === trimText(state.order.slotTime) &&
        normalizeBookingStatus(item && item.status) !== 'Cancelled';
    });

    if (conflict) {
      setStatus('paymentStatus', 'Another booking already exists in this time slot. Please cancel the original booking in the user dashboard first.', 'error');
      return;
    }

    var record = {
      id: Date.now(),
      orderId: trimText(state.order.orderId),
      clubSlug: trimText(state.order.clubSlug),
      clubName: trimText(state.order.clubName),
      dayIso: trimText(state.order.dayIso),
      dayLabel: trimText(state.order.dayLabel),
      slotId: trimText(state.order.slotId),
      slotTime: trimText(state.order.slotTime),
      location: trimText(state.order.location),
      fee: trimText(state.order.feeText) || money(state.order.baseFee),
      userEmail: trimText(state.order.userEmail),
      createdAt: new Date().toLocaleString(),
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
        window.location.href = buildBackUrl();
      });
    }
  }

  function init() {
    state.order = readPendingOrder();
    if (!state.order) {
      buildEmptyState('No pending booking requires payment right now', 'Return to Club Booking, choose a slot, and then come back here to complete payment.');
      return;
    }

    var session = readSession();
    if (!session || normalizeEmail(session.email) !== normalizeEmail(state.order.userEmail)) {
      buildEmptyState('This account cannot complete the current order', 'Please sign in with the account that started the booking before continuing to payment.');
      return;
    }

    state.discount = Number(state.order.discount || 0);
    state.couponCode = '';

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
