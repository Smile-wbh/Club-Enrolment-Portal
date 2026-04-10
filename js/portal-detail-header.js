(function () {
  var DEFAULT_CLUB_PREVIEW_MAP_LINK = 'https://maps.app.goo.gl/f5FyrhZuWWudMy2VA';
  var DEFAULT_CLUB_PREVIEW_MAP_RESOLVED_URL = 'https://www.google.com/maps/place/Hull+Sport/@53.7738999,-0.3687267,18z';

  function getPathPrefix() {
    return /\/html\/club\//.test(window.location.pathname) ? '../' : '';
  }

  function toExternalUrl(value) {
    var raw = String(value || '').trim();
    if (!raw) return '#';
    if (/^https?:\/\//i.test(raw)) return raw;
    return 'https://' + raw;
  }

  function buildMapEmbedFromLink(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    try {
      var normalized = toExternalUrl(raw);
      var url = new URL(normalized);
      var href = decodeURIComponent(normalized);
      var directQuery = url.searchParams.get('q')
        || url.searchParams.get('query')
        || url.searchParams.get('destination')
        || url.searchParams.get('daddr');
      if (directQuery) {
        return 'https://www.google.com/maps?q=' + encodeURIComponent(directQuery.trim()) + '&z=16&output=embed';
      }

      var center = url.searchParams.get('center') || url.searchParams.get('ll');
      if (center) {
        return 'https://www.google.com/maps?q=' + encodeURIComponent(center.trim()) + '&z=16&output=embed';
      }

      var atMatch = href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
      if (atMatch) {
        return 'https://www.google.com/maps?q=' + encodeURIComponent(atMatch[1] + ',' + atMatch[2]) + '&z=16&output=embed';
      }

      var placeMatch = decodeURIComponent(url.pathname || '').match(/\/place\/([^/]+)/);
      if (placeMatch && placeMatch[1]) {
        return 'https://www.google.com/maps?q=' + encodeURIComponent(placeMatch[1].replace(/\+/g, ' ').trim()) + '&z=16&output=embed';
      }
    } catch (error) {
      return '';
    }
    return '';
  }

  function buildMapEmbedFromQuery(value) {
    var query = String(value || '').trim();
    if (!query) return '';
    return 'https://www.google.com/maps?q=' + encodeURIComponent(query) + '&z=16&output=embed';
  }

  function buildMapSearchUrl(value) {
    var query = String(value || '').trim();
    if (!query) return '';
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
  }

  async function resolveMapLink(raw) {
    var value = toExternalUrl(raw);
    try {
      var parsed = new URL(value);
      if (parsed.hostname && parsed.hostname.toLowerCase() === 'maps.app.goo.gl') {
        var resolver = await fetch('/api/resolve-map?url=' + encodeURIComponent(value), {
          method: 'GET',
          cache: 'no-store'
        });
        if (resolver.ok) {
          var payload = await resolver.json();
          var finalUrl = String(payload && payload.finalUrl || '').trim();
          return finalUrl || value;
        }
        if (value === DEFAULT_CLUB_PREVIEW_MAP_LINK) {
          return DEFAULT_CLUB_PREVIEW_MAP_RESOLVED_URL;
        }
      }
    } catch (error) {
      if (value === DEFAULT_CLUB_PREVIEW_MAP_LINK) {
        return DEFAULT_CLUB_PREVIEW_MAP_RESOLVED_URL;
      }
      return value;
    }
    if (value === DEFAULT_CLUB_PREVIEW_MAP_LINK) {
      return DEFAULT_CLUB_PREVIEW_MAP_RESOLVED_URL;
    }
    return value;
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
          '<a class="top-btn accent" href="' + prefix + 'join.html?view=signup#auth-entry">Sign up</a>' +
        '</div>' +
      '</div>'
    );
  }

  function shouldUseHistoryBack() {
    var referrer = String(document.referrer || '').trim();
    if (!referrer) return false;
    try {
      var refUrl = new URL(referrer, window.location.href);
      return refUrl.origin === window.location.origin && refUrl.href !== window.location.href;
    } catch (error) {
      return false;
    }
  }

  function mountBackButton() {
    var wrap = document.querySelector('.wrap');
    if (!wrap || wrap.querySelector('.detail-back-row')) return;

    var prefix = getPathPrefix();
    var fallbackHref = prefix + 'msjs.html';

    var row = document.createElement('div');
    row.className = 'detail-back-row';

    var button = document.createElement('a');
    button.className = 'detail-back-btn';
    button.href = fallbackHref;
    button.textContent = '← Back';
    button.addEventListener('click', function (event) {
      if (!shouldUseHistoryBack()) return;
      event.preventDefault();
      window.history.back();
    });

    row.appendChild(button);
    wrap.insertBefore(row, wrap.firstChild);
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

  async function ensureStaticDetailMap() {
    if (!/\/html\/club\//.test(window.location.pathname)) return;

    var hero = document.querySelector('.hero');
    var main = document.querySelector('.main');
    if (!hero || !main || document.querySelector('.map-band')) return;

    var venueChip = Array.prototype.slice.call(document.querySelectorAll('.hero .chips .chip')).find(function (node) {
      return /venue:/i.test(node.textContent || '');
    });
    var titleNode = document.querySelector('.heroTitle');
    var titleText = titleNode ? String(titleNode.textContent || '').trim() : 'Club location';
    var venueText = venueChip
      ? String(venueChip.textContent || '').replace(/^📍\s*Venue:\s*/i, '').trim()
      : titleText;
    var fallbackMapQuery = Array.from(new Set([venueText, titleText].filter(Boolean))).join(' ');

    var actionRow = hero.querySelector('.chips:last-of-type') || hero.querySelector('.chips');
    var mapChip = null;
    if (actionRow && !actionRow.querySelector('.chip-link')) {
      mapChip = document.createElement('a');
      mapChip.className = 'chip chip-link';
      mapChip.href = toExternalUrl(DEFAULT_CLUB_PREVIEW_MAP_LINK);
      mapChip.target = '_blank';
      mapChip.rel = 'noopener';
      mapChip.textContent = '🗺 Map Link';
      actionRow.appendChild(mapChip);
    } else if (actionRow) {
      mapChip = actionRow.querySelector('.chip-link');
    }

    var section = document.createElement('section');
    section.className = 'map-band map-band-bottom';
    section.innerHTML =
      '<div class="map-band-shell">' +
        '<iframe class="map-band-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen title="' + titleText + ' Google Maps location"></iframe>' +
        '<div class="map-band-overlay">' +
          '<span class="map-band-eyebrow">Google Maps</span>' +
          '<strong>' + venueText + '</strong>' +
          '<span>Use the shared venue map for arrival and navigation.</span>' +
        '</div>' +
        '<a class="map-band-action" href="' + toExternalUrl(DEFAULT_CLUB_PREVIEW_MAP_LINK) + '" target="_blank" rel="noopener">Open in Google Maps</a>' +
      '</div>';

    var iframe = section.querySelector('.map-band-frame');
    var mapAction = section.querySelector('.map-band-action');
    if (iframe) {
      var resolvedLink = await resolveMapLink(DEFAULT_CLUB_PREVIEW_MAP_LINK);
      var embedUrl = buildMapEmbedFromLink(resolvedLink);
      var openUrl = resolvedLink ? toExternalUrl(resolvedLink) : toExternalUrl(DEFAULT_CLUB_PREVIEW_MAP_LINK);
      if (!embedUrl && fallbackMapQuery) {
        embedUrl = buildMapEmbedFromQuery(fallbackMapQuery);
        openUrl = buildMapSearchUrl(fallbackMapQuery) || openUrl;
      }
      if (mapChip) {
        mapChip.href = openUrl;
      }
      if (mapAction) {
        mapAction.href = openUrl;
      }
      if (embedUrl) {
        iframe.src = embedUrl;
      } else {
        iframe.remove();
      }
    }

    main.insertAdjacentElement('afterend', section);
  }

  async function boot() {
    mountHeader();
    mountBackButton();
    await ensureStaticDetailMap();
  }

  boot();
  if (document.readyState === 'loading' && !document.querySelector('.portal-header')) {
    document.addEventListener('DOMContentLoaded', function () {
      boot();
    }, { once: true });
  }
})();
