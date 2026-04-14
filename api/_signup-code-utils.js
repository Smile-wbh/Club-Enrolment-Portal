const crypto = require('crypto');
const dns = require('dns').promises;

const SIGNUP_CODE_PURPOSE = 'signup';
const SIGNUP_CODE_RETRY_SECONDS = 60;
const SIGNUP_CODE_EXPIRY_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const EMAIL_DOMAIN_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_ALLOWED_SIGNUP_EMAIL_DOMAINS = Object.freeze([
  'gmail.com',
  'outlook.com',
  'qq.com',
  '163.com',
  '126.com',
  'yeah.net'
]);
const DEFAULT_ALLOWED_ACADEMIC_EMAIL_DOMAINS = Object.freeze([
  'edu',
  'edu.cn',
  'edu.hk',
  'edu.au',
  'edu.sg',
  'edu.my',
  'edu.tw',
  'edu.ph',
  'edu.mo',
  'ac.uk',
  'ac.jp',
  'ac.kr',
  'ac.nz',
  'ac.in',
  'ac.th',
  'ac.id'
]);
const DEFAULT_BLOCKED_EMAIL_DOMAINS = Object.freeze([
  '10minutemail.com',
  'dispostable.com',
  'guerrillamail.com',
  'maildrop.cc',
  'mailinator.com',
  'moakt.com',
  'sharklasers.com',
  'temp-mail.org',
  'tempmail.com',
  'trashmail.com',
  'yopmail.com'
]);
const emailDomainValidationCache = new Map();

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

function normalizeDomain(value) {
  return String(value || '').trim().toLowerCase().replace(/\.+$/, '');
}

function parseDomainList(value) {
  return String(value || '')
    .split(/[,\n\r\s]+/)
    .map(normalizeDomain)
    .filter(Boolean);
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
    allowedSignupEmailDomains: parseDomainList(
      process.env.ALLOWED_SIGNUP_EMAIL_DOMAINS ||
      process.env.ALLOWED_EMAIL_DOMAINS ||
      ''
    ),
    blockedSignupEmailDomains: parseDomainList(
      process.env.BLOCKED_SIGNUP_EMAIL_DOMAINS ||
      process.env.BLOCKED_EMAIL_DOMAINS ||
      ''
    ),
    emailCodeSecret: String(
      process.env.EMAIL_CODE_SECRET ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ''
    ).trim(),
    appName: String(process.env.APP_NAME || 'Club Enrollment Portal').trim() || 'Club Enrollment Portal'
  };
}

function getEmailDomain(email) {
  return normalizeDomain(String(normalizeEmail(email).split('@')[1] || ''));
}

function domainMatchesRule(domain, ruleDomain) {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedRule = normalizeDomain(ruleDomain);
  if (!normalizedDomain || !normalizedRule) return false;
  return normalizedDomain === normalizedRule || normalizedDomain.endsWith(`.${normalizedRule}`);
}

function matchesAnyDomainRule(domain, ruleList) {
  return (Array.isArray(ruleList) ? ruleList : []).some((rule) => domainMatchesRule(domain, rule));
}

function getCachedEmailDomainValidation(domain) {
  const key = normalizeDomain(domain);
  const cached = emailDomainValidationCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    emailDomainValidationCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedEmailDomainValidation(domain, value) {
  emailDomainValidationCache.set(normalizeDomain(domain), {
    value,
    expiresAt: Date.now() + EMAIL_DOMAIN_CACHE_TTL_MS
  });
}

async function domainCanReceiveEmail(domain) {
  const normalizedDomain = normalizeDomain(domain);
  const cached = getCachedEmailDomainValidation(normalizedDomain);
  if (cached !== null) return cached;

  let hasMailRoute = false;
  try {
    const mxRecords = await dns.resolveMx(normalizedDomain);
    hasMailRoute = Array.isArray(mxRecords) && mxRecords.length > 0;
  } catch (error) {
    hasMailRoute = false;
  }

  if (!hasMailRoute) {
    try {
      const aRecords = await dns.resolve4(normalizedDomain);
      hasMailRoute = Array.isArray(aRecords) && aRecords.length > 0;
    } catch (error) {
      hasMailRoute = false;
    }
  }

  if (!hasMailRoute) {
    try {
      const aaaaRecords = await dns.resolve6(normalizedDomain);
      hasMailRoute = Array.isArray(aaaaRecords) && aaaaRecords.length > 0;
    } catch (error) {
      hasMailRoute = false;
    }
  }

  setCachedEmailDomainValidation(normalizedDomain, hasMailRoute);
  return hasMailRoute;
}

async function validateSignupEmailAccess(config, email) {
  const domain = getEmailDomain(email);
  const allowedDomains = DEFAULT_ALLOWED_SIGNUP_EMAIL_DOMAINS.concat(
    Array.isArray(config && config.allowedSignupEmailDomains) ? config.allowedSignupEmailDomains : []
  );
  const allowedAcademicDomains = DEFAULT_ALLOWED_ACADEMIC_EMAIL_DOMAINS.slice();
  const blockedDomains = DEFAULT_BLOCKED_EMAIL_DOMAINS.concat(
    Array.isArray(config && config.blockedSignupEmailDomains) ? config.blockedSignupEmailDomains : []
  );

  if (!domain) {
    return {
      ok: false,
      error: 'invalid_email_domain',
      message: 'Enter a valid email address.'
    };
  }

  if (matchesAnyDomainRule(domain, blockedDomains)) {
    return {
      ok: false,
      error: 'email_domain_blocked',
      message: 'Use a real email inbox. Temporary or disposable email addresses are not allowed.'
    };
  }

  if (allowedDomains.length && !matchesAnyDomainRule(domain, allowedDomains) && !matchesAnyDomainRule(domain, allowedAcademicDomains)) {
    return {
      ok: false,
      error: 'email_domain_not_allowed',
      message: 'Please use Gmail, Outlook, QQ Mail, NetEase Mail, or a valid school email address for registration.'
    };
  }

  const canReceiveEmail = await domainCanReceiveEmail(domain);
  if (!canReceiveEmail) {
    return {
      ok: false,
      error: 'email_domain_unreachable',
      message: 'This email domain cannot receive mail. Use a real email address you can access.'
    };
  }

  return {
    ok: true,
    domain
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
  updateSignupCodeRecord,
  validateSignupEmailAccess
};
