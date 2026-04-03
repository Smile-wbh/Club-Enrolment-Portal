module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  var rawUrl = String((req.query && req.query.url) || '').trim();
  if (!rawUrl) {
    res.status(400).json({ error: 'missing_url' });
    return;
  }

  var parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    res.status(400).json({ error: 'invalid_url' });
    return;
  }

  var host = String(parsed.hostname || '').toLowerCase();
  var allowedHosts = {
    'maps.app.goo.gl': true,
    'www.google.com': true,
    'google.com': true,
    'maps.google.com': true
  };

  if (!allowedHosts[host]) {
    res.status(400).json({ error: 'unsupported_host' });
    return;
  }

  try {
    var response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'user-agent': 'Club-Enrolment-Portal/1.0'
      }
    });

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({
      finalUrl: response.url || parsed.toString()
    });
  } catch (error) {
    res.status(502).json({
      error: 'resolve_failed',
      message: error && error.message ? error.message : 'Failed to resolve map URL.'
    });
  }
};
