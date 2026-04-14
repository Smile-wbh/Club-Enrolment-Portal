(function () {
  'use strict';

  var FOOTER_CSS_HREF = '../css/portal-footer.css?v=20260414-footer-2';

  function ensureFooterStyles() {
    if (document.querySelector('link[data-portal-footer-style]')) return;
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

  function buildFooter() {
    var footer = document.createElement('footer');
    footer.className = 'portal-site-footer';
    footer.innerHTML =
      '<div class="portal-site-footer__inner">' +
        '<nav class="portal-site-footer__links" aria-label="Footer navigation">' +
          '<a class="portal-site-footer__link" href="tzgg.html">Contact Us</a>' +
          '<a class="portal-site-footer__link" href="#">Privacy Policy</a>' +
          '<a class="portal-site-footer__link" href="#">Terms of Use</a>' +
          '<a class="portal-site-footer__link" href="spjs.html">Follow Us</a>' +
        '</nav>' +
        '<div class="portal-site-footer__copyright">Copyright © beihong wang 2026</div>' +
      '</div>';
    return footer;
  }

  function syncFooter() {
    ensureFooterStyles();
    removeLegacyFooters();

    var existing = document.querySelector('.portal-site-footer');
    if (existing) return;

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
