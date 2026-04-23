const {
  assertConfig,
  getConfig,
  getServerSupabaseKey,
  sendJson,
  supabaseAuthAdmin
} = require('./_signup-code-utils');

const BUCKET_ID = 'portal-media';

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function createHeaders(config, authorization, extraHeaders) {
  const serverKey = getServerSupabaseKey(config);
  return Object.assign(
    {
      apikey: serverKey,
      Authorization: authorization || `Bearer ${serverKey}`
    },
    extraHeaders || {}
  );
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? safeParseJson(text) : null;
  if (!response.ok) {
    const error = new Error(
      (data && (data.message || data.error_description || data.error || data.msg)) || 'Supabase request failed.'
    );
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function postgrestRequest(config, path, options) {
  const query = options && options.query ? `?${options.query.toString()}` : '';
  return fetchJson(`${config.supabaseUrl}/rest/v1/${path}${query}`, {
    method: (options && options.method) || 'GET',
    headers: Object.assign(
      createHeaders(config, null, options && options.body !== undefined ? { 'Content-Type': 'application/json' } : null),
      options && options.prefer ? { Prefer: options.prefer } : {}
    ),
    body: options && options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
}

async function fetchAuthenticatedUser(config, accessToken) {
  return fetchJson(`${config.supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: createHeaders(config, `Bearer ${accessToken}`)
  });
}

async function storageRequest(config, path, options) {
  return fetchJson(`${config.supabaseUrl}/storage/v1${path}`, {
    method: (options && options.method) || 'GET',
    headers: createHeaders(
      config,
      null,
      options && options.body !== undefined ? { 'Content-Type': 'application/json' } : null
    ),
    body: options && options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
}

async function collectStoragePaths(config, prefix) {
  const queue = [prefix];
  const collected = [];

  while (queue.length) {
    const currentPrefix = queue.pop();
    let offset = 0;

    while (true) {
      const page = await storageRequest(config, `/object/list/${BUCKET_ID}`, {
        method: 'POST',
        body: {
          prefix: currentPrefix,
          limit: 100,
          offset,
          sortBy: {
            column: 'name',
            order: 'asc'
          }
        }
      });

      if (!Array.isArray(page) || !page.length) {
        break;
      }

      page.forEach((item) => {
        const name = String((item && item.name) || '').trim();
        if (!name) return;
        const nextPath = `${currentPrefix}/${name}`;
        const isFolder = !item.id && !item.metadata;
        if (isFolder) {
          queue.push(nextPath);
          return;
        }
        collected.push(nextPath);
      });

      if (page.length < 100) {
        break;
      }

      offset += page.length;
    }
  }

  return collected;
}

async function deleteStorageFolder(config, userId) {
  if (!userId) return 0;
  let deletedCount = 0;

  try {
    const paths = await collectStoragePaths(config, userId);
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      if (!batch.length) continue;
      await storageRequest(config, `/object/${BUCKET_ID}`, {
        method: 'DELETE',
        body: { prefixes: batch }
      });
      deletedCount += batch.length;
    }
  } catch (error) {
    deletedCount = 0;
  }

  return deletedCount;
}

async function deleteByQuery(config, table, query) {
  await postgrestRequest(config, table, {
    method: 'DELETE',
    query
  });
}

async function updateByQuery(config, table, query, body) {
  await postgrestRequest(config, table, {
    method: 'PATCH',
    query,
    body,
    prefer: 'return=minimal'
  });
}

async function fetchRows(config, table, query) {
  const rows = await postgrestRequest(config, table, { query });
  return Array.isArray(rows) ? rows : [];
}

async function hasOwnedCatalogRows(config, userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return false;

  const makeQuery = () => new URLSearchParams({
    select: 'id',
    owner_id: `eq.${normalizedUserId}`,
    limit: '1'
  });

  const clubRows = await fetchRows(config, 'clubs', makeQuery());
  if (clubRows.length) return true;

  const courseRows = await fetchRows(config, 'courses', makeQuery());
  return courseRows.length > 0;
}

async function findFallbackCatalogOwnerId(config, deletedUserId) {
  const normalizedUserId = String(deletedUserId || '').trim();
  if (!normalizedUserId) return '';

  const adminQuery = new URLSearchParams({
    select: 'id',
    id: `neq.${normalizedUserId}`,
    role: 'eq.admin',
    order: 'created_at.asc',
    limit: '1'
  });
  const adminRows = await fetchRows(config, 'profiles', adminQuery);
  if (adminRows[0] && adminRows[0].id) return String(adminRows[0].id).trim();

  const fallbackQuery = new URLSearchParams({
    select: 'id',
    id: `neq.${normalizedUserId}`,
    order: 'created_at.asc',
    limit: '1'
  });
  const fallbackRows = await fetchRows(config, 'profiles', fallbackQuery);
  return fallbackRows[0] && fallbackRows[0].id ? String(fallbackRows[0].id).trim() : '';
}

async function transferOwnedCatalog(config, userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId || !(await hasOwnedCatalogRows(config, normalizedUserId))) {
    return '';
  }

  const fallbackOwnerId = await findFallbackCatalogOwnerId(config, normalizedUserId);
  if (!fallbackOwnerId) {
    const error = new Error('catalog_owner_transfer_unavailable');
    error.statusCode = 409;
    throw error;
  }

  const ownerQuery = new URLSearchParams({
    owner_id: `eq.${normalizedUserId}`
  });
  await updateByQuery(config, 'courses', ownerQuery, { owner_id: fallbackOwnerId });
  await updateByQuery(config, 'clubs', ownerQuery, { owner_id: fallbackOwnerId });
  return fallbackOwnerId;
}

async function deleteAccountData(config, userId, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  await deleteStorageFolder(config, userId);

  await deleteByQuery(config, 'support_messages', new URLSearchParams({
    sender_id: `eq.${userId}`
  }));

  await deleteByQuery(config, 'club_members', new URLSearchParams({
    user_id: `eq.${userId}`
  }));

  if (normalizedEmail) {
    await deleteByQuery(config, 'club_members', new URLSearchParams({
      user_email: `eq.${normalizedEmail}`
    }));
  }

  await transferOwnedCatalog(config, userId);

  if (normalizedEmail) {
    await deleteByQuery(config, 'email_verification_codes', new URLSearchParams({
      email: `eq.${normalizedEmail}`
    }));
  }

  await deleteByQuery(config, 'profiles', new URLSearchParams({
    id: `eq.${userId}`
  }));

  await supabaseAuthAdmin(config, `/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, {
      error: 'method_not_allowed',
      message: 'Only POST requests are allowed.'
    });
    return;
  }

  try {
    const accessTokenHeader = String(req.headers.authorization || '').trim();
    const accessToken = accessTokenHeader.replace(/^Bearer\s+/i, '').trim();

    if (!accessToken) {
      sendJson(res, 401, {
        error: 'missing_token',
        message: 'Please sign in again before deleting this account.'
      });
      return;
    }

    const config = getConfig();
    assertConfig(config, ['supabaseUrl', 'serviceRoleKey']);

    const user = await fetchAuthenticatedUser(config, accessToken);
    const userId = String((user && user.id) || '').trim();
    const email = String((user && user.email) || '').trim().toLowerCase();

    if (!userId || !email) {
      sendJson(res, 401, {
        error: 'invalid_session',
        message: 'Please sign in again before deleting this account.'
      });
      return;
    }

    await deleteAccountData(config, userId, email);

    sendJson(res, 200, {
      ok: true,
      message: 'Your account and related data were deleted.'
    });
  } catch (error) {
    const lower = String((error && error.message) || '').toLowerCase();
    const status = error && error.statusCode ? error.statusCode : 500;
    const message = lower.indexOf('jwt') > -1 || status === 401 || status === 403
      ? 'Please sign in again before deleting this account.'
      : lower.indexOf('missing_config') > -1
        ? 'Account deletion is not configured yet.'
        : lower.indexOf('catalog_owner_transfer_unavailable') > -1
          ? 'This account owns club or course catalog data. Create another account first so the catalog can be transferred safely.'
          : 'Unable to delete this account right now.';

    sendJson(res, status, {
      error: (error && error.message) || 'delete_account_failed',
      message
    });
  }
};
