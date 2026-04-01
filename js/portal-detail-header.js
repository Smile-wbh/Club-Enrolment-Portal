(function () {
  function getPathPrefix() {
    return /\/html\/club\//.test(window.location.pathname) ? '../' : '';
  }

    function ensureStyles() {
      return;
    }

  function buildHeaderHtml(prefix) {
    return (
      '<div class="container">' +
        '<a class="brand" href="' + prefix + 'index1.html">' +
          '<span class="brand-mark">' +
            '<img src="' + prefix + '../zp/gywm.webp" alt="Platform logo" />' +
          '</span>' +
          '<span class="brand-text">' +
            '<strong>Club Enrollment Portal</strong>' +
            '<em>Booking platform for campus and community clubs</em>' +
          '</span>' +
        '</a>' +
        '<nav class="top-nav" aria-label="Primary navigation">' +
          '<a href="' + prefix + 'index1.html">Home</a>' +
          '<a class="active" href="' + prefix + 'msjs.html">Club Preview</a>' +
          '<a href="' + prefix + 'specialty.html">Club Booking</a>' +
          '<a href="' + prefix + 'mfms.html">Club Courses</a>' +
          '<a href="' + prefix + 'spjs.html">Club Forum</a>' +
          '<a href="' + prefix + 'tzgg.html">Support Center</a>' +
        '</nav>' +
        '<div class="top-actions">' +
          '<a class="top-btn light" href="' + prefix + 'join.html">Log in</a>' +
          '<a class="top-btn accent" href="' + prefix + 'join.html">Sign up</a>' +
        '</div>' +
      '</div>'
    );
  }

  function mountHeader() {
    var topbar = document.querySelector('.topbar');
    if (!topbar || document.querySelector('.portal-header')) return;
    ensureStyles();
    var prefix = getPathPrefix();
    var header = document.createElement('header');
    header.className = 'portal-header';
    header.innerHTML = buildHeaderHtml(prefix);

    var wrap = topbar.closest('.wrap') || topbar.parentNode;
    if (wrap && wrap.parentNode) {
      wrap.parentNode.insertBefore(header, wrap);
    } else if (document.body.firstChild) {
      document.body.insertBefore(header, document.body.firstChild);
    } else {
      document.body.appendChild(header);
    }
    topbar.remove();
  }

    mountHeader();
    if (document.readyState === 'loading' && !document.querySelector('.portal-header')) {
      document.addEventListener('DOMContentLoaded', mountHeader, { once: true });
    }
  })();
