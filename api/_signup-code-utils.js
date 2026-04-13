const crypto = require('crypto');

const SIGNUP_CODE_PURPOSE = 'signup';
const SIGNUP_CODE_RETRY_SECONDS = 60;
const SIGNUP_CODE_EXPIRY_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  let raw = '';
  await new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', resolve);
    req.on('error', reject);
  });

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (error) {
    const parseError = new Error('invalid_json');
    parseError.statusCode = 400;
    parseError.publicMessage = 'Invalid request body.';
    throw parseError;
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  const email = String(value || '').trim();
  if (!email || email.length > 254 || /\s/.test(email)) return false;

  const parts = email.split('@');
  if (parts.length !== 2) return false;

  const local = parts[0];
  const domain = parts[1];
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;

  if (domain.length > 253 || domain.startsWith('.') || domain.endsWith('.')) return false;
  if (!domain.includes('.')) return false;

  const labels = domain.split('.');
  if (labels.some((label) => !label || label.length > 63)) return false;
  if (labels.some((label) => label.startsWith('-') || label.endsWith('-'))) return false;
  if (labels.some((label) => !/^[A-Za-z0-9-]+$/.test(label))) return false;

  const tld = labels[labels.length - 1];
  if (!/^[A-Za-z]{2,}$/.test(tld)) return false;

  return true;
}

function isValidPassword(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/.test(String(value || ''));
}

function normalizeNickname(value) {
  return String(value || '').trim().slice(0, 80);
}

function getConfig() {
  return {
    supabaseUrl: String(
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      ''
    ).trim().replace(/\/+$/, ''),
    serviceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim(),
    secretKey: String(process.env.SUPABASE_SECRET_KEY || '').trim(),
    resendApiKey: String(process.env.RESEND_API_KEY || '').trim(),
    resendFromEmail: String(process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || '').trim(),
    emailCodeSecret: String(
      process.env.EMAIL_CODE_SECRET ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ''
    ).trim(),
    appName: String(process.env.APP_NAME || 'Club Enrollment Portal').trim() || 'Club Enrollment Portal'
  };
}

function assertConfig(config, requiredKeys) {
  const missing = requiredKeys.filter((key) => !config[key]);
  if (!missing.length) return;

  const error = new Error('missing_config');
  error.statusCode = 500;
  error.publicMessage = 'Email verification service is not configured yet.';
  error.missing = missing;
  throw error;
}

function getServerSupabaseKey(config) {
  return String(config.secretKey || config.serviceRoleKey || '').trim();
}

function buildPostgrestUrl(config, path, query) {
  const queryString = query ? `?${query.toString()}` : '';
  return `${config.supabaseUrl}/rest/v1/${path}${queryString}`;
}

async function supabaseRest(config, path, options) {
  const opts = options || {};
  const serverKey = getServerSupabaseKey(config);
  const headers = Object.assign(
    {
      apikey: serverKey,
      Authorization: `Bearer ${serverKey}`
    },
    opts.headers || {}
  );

  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.prefer) {
    headers.Prefer = opts.prefer;
  }

  const response = await fetch(buildPostgrestUrl(config, path, opts.query), {
    method: opts.method || 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });

  const text = await response.text();
  const data = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const error = new Error(mapSupabaseError(data) || 'Supabase request failed.');
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function supabaseAuthAdmin(config, path, options) {
  const opts = options || {};
  const serverKey = getServerSupabaseKey(config);
  const response = await fetch(`${config.supabaseUrl}/auth/v1${path}`, {
    method: opts.method || 'GET',
    headers: Object.assign(
      {
        apikey: serverKey,
        Authorization: `Bearer ${serverKey}`,
        'Content-Type': 'application/json'
      },
      opts.headers || {}
    ),
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });

  const text = await response.text();
  const data = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const error = new Error(mapSupabaseAuthError(data) || 'Supabase auth request failed.');
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
}

function mapSupabaseError(data) {
  if (!data) return '';
  return data.message || data.error_description || data.error || '';
}

function mapSupabaseAuthError(data) {
  if (!data) return '';
  return data.msg || data.message || data.error_description || data.error || '';
}

function createSignupCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function getSignupCodeHash(config, email, code) {
  return crypto
    .createHash('sha256')
    .update(`${normalizeEmail(email)}:${String(code || '').trim()}:${config.emailCodeSecret}`)
    .digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function minutesFromNowIso(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function secondsSince(dateString) {
  const value = Date.parse(dateString || '');
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - value) / 1000);
}

function buildSignupCodeEmailHtml(appName, code) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f8ff;padding:24px;color:#1f2d3d;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid #d8e4f2;">
        <div style="font-size:28px;font-weight:800;line-height:1.2;margin-bottom:10px;">${escapeHtml(appName)}</div>
        <div style="font-size:16px;line-height:1.7;color:#5b6b82;margin-bottom:20px;">
          Use the verification code below to complete your sign up. The code will expire in ${SIGNUP_CODE_EXPIRY_MINUTES} minutes.
        </div>
        <div style="font-size:36px;font-weight:800;letter-spacing:0.24em;text-align:center;padding:18px 20px;border-radius:18px;background:#eef4ff;color:#305fae;margin-bottom:20px;">
          ${escapeHtml(code)}
        </div>
        <div style="font-size:14px;line-height:1.7;color:#6b778c;">
          If you did not request this email, you can ignore it safely.
        </div>
      </div>
    </div>
  `;
}

function buildSignupCodeEmailText(appName, code) {
  return `${appName}\n\nYour sign-up verification code is: ${code}\n\nThis code will expire in ${SIGNUP_CODE_EXPIRY_MINUTES} minutes.`;
}

async function sendSignupCodeEmail(config, email, code) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: config.resendFromEmail,
      to: [email],
      subject: `${config.appName} sign-up verification code`,
      html: buildSignupCodeEmailHtml(config.appName, code),
      text: buildSignupCodeEmailText(config.appName, code)
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error((data && (data.message || data.error)) || 'Unable to send the verification email.');
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

async function findProfileByEmail(config, email) {
  const query = new URLSearchParams({
    select: 'id,email',
    email: `eq.${normalizeEmail(email)}`,
    limit: '1'
  });
  const rows = await supabaseRest(config, 'profiles', { query });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getLatestSignupCodeRecord(config, email) {
  const query = new URLSearchParams({
    select: 'id,email,code_hash,attempts,created_at,expires_at,used_at',
    email: `eq.${normalizeEmail(email)}`,
    purpose: `eq.${SIGNUP_CODE_PURPOSE}`,
    order: 'created_at.desc',
    limit: '1'
  });
  const rows = await supabaseRest(config, 'email_verification_codes', { query });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function markSignupCodesUsed(config, email) {
  const query = new URLSearchParams({
    email: `eq.${normalizeEmail(email)}`,
    purpose: `eq.${SIGNUP_CODE_PURPOSE}`,
    used_at: 'is.null'
  });
  await supabaseRest(config, `email_verification_codes`, {
    method: 'PATCH',
    query,
    body: {
      used_at: nowIso()
    }
  });
}

async function insertSignupCodeRecord(config, email, codeHash) {
  const rows = await supabaseRest(config, 'email_verification_codes', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      email: normalizeEmail(email),
      purpose: SIGNUP_CODE_PURPOSE,
      code_hash: codeHash,
      attempts: 0,
      expires_at: minutesFromNowIso(SIGNUP_CODE_EXPIRY_MINUTES),
      used_at: null
    }
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function deleteSignupCodeRecord(config, id) {
  if (!id) return;
  const query = new URLSearchParams({
    id: `eq.${id}`
  });
  await supabaseRest(config, 'email_verification_codes', {
    method: 'DELETE',
    query
  });
}

async function updateSignupCodeRecord(config, id, patch) {
  if (!id) return null;
  const query = new URLSearchParams({
    id: `eq.${id}`
  });
  const rows = await supabaseRest(config, 'email_verification_codes', {
    method: 'PATCH',
    query,
    prefer: 'return=representation',
    body: patch
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function getRetryAfterSeconds(record) {
  if (!record || !record.created_at) return 0;
  const elapsed = secondsSince(record.created_at);
  if (!Number.isFinite(elapsed) || elapsed >= SIGNUP_CODE_RETRY_SECONDS) return 0;
  return SIGNUP_CODE_RETRY_SECONDS - elapsed;
}

function isCodeExpired(record) {
  return !record || !record.expires_at || Date.parse(record.expires_at) <= Date.now();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  MAX_CODE_ATTEMPTS,
  SIGNUP_CODE_EXPIRY_MINUTES,
  SIGNUP_CODE_RETRY_SECONDS,
  assertConfig,
  createSignupCode,
  deleteSignupCodeRecord,
  findProfileByEmail,
  getConfig,
  getLatestSignupCodeRecord,
  getRetryAfterSeconds,
  getServerSupabaseKey,
  getSignupCodeHash,
  insertSignupCodeRecord,
  isCodeExpired,
  isValidEmail,
  isValidPassword,
  markSignupCodesUsed,
  normalizeEmail,
  normalizeNickname,
  readJsonBody,
  sendJson,
  sendSignupCodeEmail,
  supabaseAuthAdmin,
  updateSignupCodeRecord
};
