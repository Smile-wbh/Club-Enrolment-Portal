(function () {
  'use strict';

  var FOOTER_CSS_HREF = '../css/portal-footer.css?v=20260415-footer-modal-1';
  var FOOTER_SECTIONS = {
    contact: {
      button: 'Contact Us',
      eyebrow: 'Support',
      title: 'Contact Us',
      lead: 'Need help with a booking, payment, course enrolment, or account issue?',
      bullets: [
        'Use the Support Center for registration questions, booking changes, payment concerns, and technical support.',
        'Include your club name, booking date, and a short summary so our team can help you faster.',
        'Requests are reviewed in order, and urgent access problems are handled as quickly as possible.'
      ],
      note: 'You can always return to the Support Center from the main navigation when you want to send a detailed request.'
    },
    privacy: {
      button: 'Privacy Policy',
      eyebrow: 'Privacy',
      title: 'Privacy Policy',
      lead: 'Your information is handled with care so the portal can stay safe, useful, and reliable.',
      bullets: [
        'We collect only the details needed to manage accounts, memberships, bookings, payments, and support requests.',
        'Data is used to operate the platform, improve service quality, and protect account security.',
        'Personal information is not sold, and access is limited to trusted service needs and club operations.'
      ],
      note: 'If privacy rules are updated, the latest version will be shown here and across the portal.'
    },
    terms: {
      button: 'Terms of Use',
      eyebrow: 'Guidelines',
      title: 'Terms of Use',
      lead: 'Using this portal means helping keep the club community accurate, respectful, and fair for everyone.',
      bullets: [
        'Provide accurate personal and booking information and keep your account details up to date.',
        'Respect club schedules, payment deadlines, and any participation rules set by organizers.',
        'Spam, misuse, fraud, or harmful behavior may lead to restricted bookings or account suspension.'
      ],
      note: 'Club-specific booking or course policies may apply in addition to these general platform terms.'
    },
    follow: {
      button: 'Follow Us',
      eyebrow: 'Community',
      title: 'Follow Us',
      lead: 'Stay connected with the latest club activity and community updates.',
      bullets: [
        'Follow club news for upcoming events, course openings, and seasonal activity reminders.',
        'Join discussions in the forum to hear from organizers and connect with other members.',
        'Check back often for announcements, highlights, and new opportunities across the portal.'
      ],
      note: 'The Club Forum and portal home page are the best places to catch fresh updates first.'
    }
  };
  var FOOTER_ORDER = ['contact', 'privacy', 'terms', 'follow'];
  var footerState = {
    activePanel: '',
    previousFocus: null
  };

  function ensureFooterStyles() {
    if (document.querySelector('link[data-portal-footer-style], link[href*="portal-footer.css"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FOOTER_CSS_HREF;
    link.setAttribute('data-portal-footer-style', 'true');
    document.head.appendChild(link);
  }

  function isLegacyFooter(node) {
    return !!(
      node &&
      node.nodeType === 1 &&
      node.classList &&
      node.classList.contains('footer') &&
      node.querySelector('.footer-links')
    );
  }

  function removeLegacyFooters() {
    Array.prototype.forEach.call(document.querySelectorAll('.footer'), function (node) {
      if (isLegacyFooter(node)) {
        node.remove();
      }
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildFooterLinks() {
    return FOOTER_ORDER.map(function (key) {
      var section = FOOTER_SECTIONS[key];
      return (
        '<button class="portal-site-footer__link" type="button" data-footer-panel="' + escapeHtml(key) + '" aria-haspopup="dialog" aria-expanded="false">' +
          escapeHtml(section.button) +
        '</button>'
      );
    }).join('');
  }

  function buildFooterInner() {
    return (
      '<div class="portal-site-footer__inner">' +
        '<nav class="portal-site-footer__links" aria-label="Footer navigation">' +
          buildFooterLinks() +
        '</nav>' +
        '<div class="portal-site-footer__copyright">Copyright © beihong wang 2026</div>' +
      '</div>'
    );
  }

  function buildFooter() {
    var footer = document.createElement('footer');
    footer.className = 'portal-site-footer';
    footer.innerHTML = buildFooterInner();
    footer.setAttribute('data-portal-footer-ready', 'true');
    return footer;
  }

  function ensureFooterMarkup(footer) {
    if (!footer || footer.getAttribute('data-portal-footer-ready') === 'true') return footer;
    footer.innerHTML = buildFooterInner();
    footer.setAttribute('data-portal-footer-ready', 'true');
    return footer;
  }

  function buildModalBody(section) {
    var bullets = section.bullets.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');

    return (
      '<div class="portal-footer-modal__eyebrow">' + escapeHtml(section.eyebrow) + '</div>' +
      '<h2 class="portal-footer-modal__title" id="portalFooterModalTitle">' + escapeHtml(section.title) + '</h2>' +
      '<p class="portal-footer-modal__lead">' + escapeHtml(section.lead) + '</p>' +
      '<ul class="portal-footer-modal__list">' + bullets + '</ul>' +
      '<p class="portal-footer-modal__note">' + escapeHtml(section.note) + '</p>'
    );
  }

  function ensureFooterModal() {
    var modal = document.getElementById('portalFooterModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'portalFooterModal';
    modal.className = 'portal-footer-modal';
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML =
      '<div class="portal-footer-modal__backdrop" data-footer-modal-close="true"></div>' +
      '<div class="portal-footer-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="portalFooterModalTitle">' +
        '<div class="portal-footer-modal__body" id="portalFooterModalBody"></div>' +
        '<div class="portal-footer-modal__actions">' +
          '<button class="portal-footer-modal__back" type="button" data-footer-modal-close="true">Back</button>' +
        '</div>' +
      '</div>';

    modal.addEventListener('click', function (event) {
      var closeTrigger = event.target.closest('[data-footer-modal-close="true"]');
      if (!closeTrigger) return;
      closeFooterModal();
    });

    document.body.appendChild(modal);
    return modal;
  }

  function setTriggerExpanded(panelKey, expanded) {
    var triggers = document.querySelectorAll('[data-footer-panel="' + panelKey + '"]');
    Array.prototype.forEach.call(triggers, function (node) {
      node.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  function closeFooterModal() {
    var activePanel = footerState.activePanel;
    var modal = document.getElementById('portalFooterModal');

    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }

    document.body && document.body.classList.remove('portal-footer-modal-open');

    if (activePanel) {
      setTriggerExpanded(activePanel, false);
    }

    footerState.activePanel = '';

    if (footerState.previousFocus && typeof footerState.previousFocus.focus === 'function') {
      try {
        footerState.previousFocus.focus();
      } catch (error) {}
    }
    footerState.previousFocus = null;
  }

  function openFooterModal(panelKey, trigger) {
    var section = FOOTER_SECTIONS[panelKey];
    if (!section) return;

    if (footerState.activePanel && footerState.activePanel !== panelKey) {
      setTriggerExpanded(footerState.activePanel, false);
    }

    footerState.previousFocus = trigger || document.activeElement;
    footerState.activePanel = panelKey;

    var modal = ensureFooterModal();
    var body = modal.querySelector('#portalFooterModalBody');
    if (body) {
      body.innerHTML = buildModalBody(section);
    }

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body && document.body.classList.add('portal-footer-modal-open');
    setTriggerExpanded(panelKey, true);

    var backButton = modal.querySelector('.portal-footer-modal__back');
    if (backButton) {
      window.requestAnimationFrame(function () {
        backButton.focus();
      });
    }
  }

  function bindFooterEvents() {
    if (window.__portalFooterEventsBound) return;
    window.__portalFooterEventsBound = true;

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-footer-panel]');
      if (!trigger) return;
      event.preventDefault();
      openFooterModal(trigger.getAttribute('data-footer-panel'), trigger);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !footerState.activePanel) return;
      event.preventDefault();
      closeFooterModal();
    }, true);
  }

  function syncFooter() {
    ensureFooterStyles();
    removeLegacyFooters();
    bindFooterEvents();
    ensureFooterModal();

    var existing = document.querySelector('.portal-site-footer');
    if (existing) {
      ensureFooterMarkup(existing);
      return;
    }

    document.body.appendChild(buildFooter());
  }

  function startFooterObserver() {
    if (!document.body || window.__portalFooterObserverStarted) return;
    window.__portalFooterObserverStarted = true;
    var observer = new MutationObserver(function () {
      syncFooter();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      syncFooter();
      startFooterObserver();
    });
  } else {
    syncFooter();
    startFooterObserver();
  }
})();
