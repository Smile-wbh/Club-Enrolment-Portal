(function () {
  var METHOD_TEXT = {
    card: 'Recommended for Sports Membership. Once completed, it syncs immediately to User Dashboard -> Sports Membership.',
    paypal: 'Best for completing membership payment across devices. In the current preview build, success is simulated instantly.',
    apple: 'Great for quick mobile confirmation. In the current preview build, membership activation is simulated instantly.'
  };

  var METHOD_LABEL = {
    card: 'Bank Card',
    paypal: 'PayPal',
    apple: 'Apple Pay'
  };

  var state = {
    method: 'card',
    order: null,
    redirectTimer: null
  };

  function trimText(value) {
    return String(value || '').trim();
  }

  function normalizeEmail(value) {
    return trimText(value).toLowerCase();
  }

  function money(value) {
    return '£' + Number(value || 0).toFixed(2);
  }

  function getMembershipService() {
    return window.clubMembershipSupabase || null;
  }

  function hasMembershipService() {
    var service = getMembershipService();
    return !!(service && typeof service.isConfigured === 'function' && service.isConfigured());
  }

  function createOrder(session) {
    var timestamp = Date.now();
    return {
      orderId: 'MEM-' + timestamp,
      userId: trimText(session && session.userId),
      planName: 'Sports Membership',
      membershipType: 'Sports Membership',
      price: 20,
      billingCycle: 'monthly',
      billingCycleLabel: 'Monthly',
      benefitText: 'Weekly coupon code + waived Platform Service Fee + extra £2 off clubs and courses',
      userEmail: normalizeEmail(session && session.email),
      baseFee: 20,
      serviceFee: 0,
      discount: 0,
      payableAmount: 20,
      paymentMethod: METHOD_LABEL.card
    };
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

  function updateMethodUI() {
    var intro = document.getElementById('methodIntro');
    var cardFields = document.getElementById('cardFields');
    document.querySelectorAll('.method-option').forEach(function (btn) {
      var isActive = trimText(btn.getAttribute('data-method')) === state.method;
      btn.classList.toggle('is-active', isActive);
    });
    if (intro) intro.textContent = METHOD_TEXT[state.method] || METHOD_TEXT.card;
    if (cardFields) cardFields.hidden = state.method !== 'card';
  }

  function updatePayButtonText() {
    var btn = document.getElementById('paySubmitBtn');
    if (!btn || !state.order) return;
    btn.textContent = 'Confirm Payment ' + money(state.order.payableAmount);
  }

  function renderOrder() {
    if (!state.order) return;
    var fields = {
      orderPlanName: state.order.planName,
      orderMembershipType: state.order.membershipType,
      orderBillingCycle: state.order.billingCycleLabel || state.order.billingCycle,
      orderBenefitText: state.order.benefitText,
      orderIdText: state.order.orderId,
      orderUserEmail: state.order.userEmail,
      baseFeeText: money(state.order.baseFee),
      serviceFeeText: money(state.order.serviceFee),
      discountText: '-' + money(state.order.discount),
      payableAmountText: money(state.order.payableAmount)
    };

    Object.keys(fields).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = fields[id];
    });

    updatePayButtonText();
    updateMethodUI();
  }

  function buildEmptyState(title, message, primaryHref, primaryLabel, secondaryHref, secondaryLabel) {
    var empty = document.getElementById('paymentEmpty');
    if (!empty) return;
    empty.hidden = false;
    empty.innerHTML =
      '<h2>' + title + '</h2>' +
      '<p>' + message + '</p>' +
      '<div class="empty-actions">' +
        '<a class="primary-btn" href="' + trimText(primaryHref || 'membership.html') + '">' + trimText(primaryLabel || 'Back to Membership Details') + '</a>' +
        '<a class="ghost-btn" href="' + trimText(secondaryHref || 'join.html?view=login#auth-entry') + '">' + trimText(secondaryLabel || 'Open Login') + '</a>' +
      '</div>';
  }

  function validatePayment() {
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

  function fillSuccess(record) {
    var values = {
      successOrderId: trimText(record && record.orderId) || trimText(state.order && state.order.orderId) || '-',
      successPlanName: trimText(record && record.planName) || 'Sports Membership',
      successStatusText: trimText(record && record.status) || 'Active',
      successCouponCode: trimText(record && record.couponCode) || '-'
    };

    Object.keys(values).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = values[id];
    });
  }

  function startSuccessRedirect() {
    var textEl = document.getElementById('successAutoRedirectText');
    if (state.redirectTimer) {
      window.clearInterval(state.redirectTimer);
      state.redirectTimer = null;
    }

    var countdown = 4;
    if (textEl) {
      textEl.textContent = 'Opening User Dashboard -> Sports Membership in ' + countdown + ' seconds.';
    }

    state.redirectTimer = window.setInterval(function () {
      countdown -= 1;
      if (countdown <= 0) {
        window.clearInterval(state.redirectTimer);
        state.redirectTimer = null;
        window.location.href = 'join.html?tab=sports_membership';
        return;
      }
      if (textEl) {
        textEl.textContent = 'Opening User Dashboard -> Sports Membership in ' + countdown + ' seconds.';
      }
    }, 1000);
  }

  function showSuccess(record, existed) {
    var layout = document.getElementById('paymentLayout');
    var success = document.getElementById('paymentSuccess');
    var lead = document.getElementById('successLead');

    if (layout) layout.hidden = true;
    if (success) success.hidden = false;
    setStepState(3);
    fillSuccess(record);

    if (lead) {
      lead.textContent = existed
        ? 'This account already has an active Sports Membership. You can open User Dashboard to review its details and weekly coupon code.'
        : 'Your Sports Membership is now active. Open User Dashboard to review your membership status and weekly coupon code.';
    }

    startSuccessRedirect();
  }

  async function finalizePayment() {
    if (!state.order) return;
    if (!validatePayment()) return;

    var service = getMembershipService();
    var authMember = service && typeof service.getCurrentAuthenticatedMember === 'function'
      ? await service.getCurrentAuthenticatedMember()
      : null;
    if (!authMember || normalizeEmail(authMember.email) !== normalizeEmail(state.order.userEmail)) {
      setStatus('paymentStatus', 'The current signed-in account does not match this membership order. Please sign in again.', 'error');
      return;
    }

    setStatus('paymentStatus', 'Payment successful. Activating Sports Membership now.', 'success');

    try {
      state.order.paymentMethod = METHOD_LABEL[state.method] || METHOD_LABEL.card;
      var membership = await service.activateSportsMembership(state.order);
      showSuccess(membership, false);
    } catch (error) {
      setStatus('paymentStatus', service.mapMembershipActionError(error), 'error');
    }
  }

  async function init() {
    var service = getMembershipService();
    var session = service && typeof service.getCurrentAuthenticatedMember === 'function'
      ? await service.getCurrentAuthenticatedMember()
      : null;

    if (!hasMembershipService()) {
      buildEmptyState(
        'Membership sync is unavailable',
        'Please run the latest Sports Membership SQL in Supabase, then refresh this page.',
        'membership.html',
        'Back to Membership Details',
        'join.html?view=login#auth-entry',
        'Open Login'
      );
      return;
    }

    if (!session || !trimText(session.email) || !trimText(session.userId)) {
      buildEmptyState(
        'Please sign in before joining Sports Membership',
        'Membership payment is linked to your account. Sign in first, then return here to continue.',
        'join.html?view=login#auth-entry',
        'Open Login',
        'membership.html',
        'Back to Membership Details'
      );
      return;
    }

    try {
      var activeMembership = await service.fetchActiveSportsMembership(trimText(session.userId));
      if (activeMembership) {
        showSuccess(activeMembership, true);
        return;
      }
    } catch (error) {
      buildEmptyState(
        'Unable to load membership status',
        service.mapMembershipActionError(error),
        'membership.html',
        'Back to Membership Details',
        'join.html?tab=sports_membership',
        'Open User Dashboard'
      );
      return;
    }

    state.order = createOrder(session);
    renderOrder();
    setStepState(2);

    var empty = document.getElementById('paymentEmpty');
    var layout = document.getElementById('paymentLayout');
    if (empty) empty.hidden = true;
    if (layout) layout.hidden = false;

    document.querySelectorAll('.method-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.method = trimText(btn.getAttribute('data-method')) || 'card';
        updateMethodUI();
        setStatus('paymentStatus', '', '');
      });
    });

    var paySubmitBtn = document.getElementById('paySubmitBtn');
    if (paySubmitBtn) {
      paySubmitBtn.addEventListener('click', finalizePayment);
    }

    var paymentBackBtn = document.getElementById('paymentBackBtn');
    if (paymentBackBtn) {
      paymentBackBtn.addEventListener('click', function () {
        window.location.href = 'membership.html';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
