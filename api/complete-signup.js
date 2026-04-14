const {
  MAX_CODE_ATTEMPTS,
  assertConfig,
  findProfileByEmail,
  getConfig,
  getLatestSignupCodeRecord,
  getSignupCodeHash,
  isCodeExpired,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  normalizeNickname,
  readJsonBody,
  sendJson,
  supabaseAuthAdmin,
  updateSignupCodeRecord,
  validateSignupEmailAccess
} = require('./_signup-code-utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed', message: 'Only POST requests are allowed.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(body && body.email);
    const code = String((body && body.code) || '').trim();
    const password = String((body && body.password) || '');
    const nickname = normalizeNickname(body && body.nickname);
    const withClubManagement = !!(body && body.withClubManagement);

    if (!isValidEmail(email)) {
      sendJson(res, 400, {
        error: 'invalid_email',
        field: 'email',
        message: 'Enter a valid email address.'
      });
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      sendJson(res, 400, {
        error: 'invalid_code_format',
        field: 'verificationCode',
        message: 'Enter the 6-digit email verification code sent to your email.'
      });
      return;
    }

    if (!isValidPassword(password)) {
      sendJson(res, 400, {
        error: 'invalid_password',
        field: 'password',
        message: 'The password must contain capital letters, lowercase letters, numbers and special symbols.'
      });
      return;
    }

    const config = getConfig();
    const emailAccess = await validateSignupEmailAccess(config, email);
    if (!emailAccess.ok) {
      sendJson(res, 400, {
        error: emailAccess.error,
        field: 'email',
        message: emailAccess.message
      });
      return;
    }

    assertConfig(config, ['supabaseUrl', 'serviceRoleKey', 'emailCodeSecret']);

    const existingProfile = await findProfileByEmail(config, email);
    if (existingProfile) {
      sendJson(res, 409, {
        error: 'email_exists',
        field: 'email',
        message: 'This email address is already registered.'
      });
      return;
    }

    const record = await getLatestSignupCodeRecord(config, email);
    if (!record || record.used_at) {
      sendJson(res, 400, {
        error: 'code_missing',
        field: 'verificationCode',
        message: 'Please request a new email verification code first.'
      });
      return;
    }

    if (isCodeExpired(record)) {
      await updateSignupCodeRecord(config, record.id, { used_at: new Date().toISOString() });
      sendJson(res, 400, {
        error: 'code_expired',
        field: 'verificationCode',
        message: 'This verification code has expired. Please request a new one.'
      });
      return;
    }

    const expectedHash = getSignupCodeHash(config, email, code);
    if (expectedHash !== String(record.code_hash || '')) {
      const nextAttempts = Number(record.attempts || 0) + 1;
      const patch = { attempts: nextAttempts };
      if (nextAttempts >= MAX_CODE_ATTEMPTS) {
        patch.used_at = new Date().toISOString();
      }
      await updateSignupCodeRecord(config, record.id, patch);
      sendJson(res, 400, {
        error: 'code_invalid',
        field: 'verificationCode',
        message: nextAttempts >= MAX_CODE_ATTEMPTS
          ? 'Too many incorrect codes. Please request a new verification code.'
          : 'The verification code is incorrect. Please try again.'
      });
      return;
    }

    try {
      await supabaseAuthAdmin(config, '/admin/users', {
        method: 'POST',
        body: {
          email,
          password,
          email_confirm: true,
          user_metadata: {
            nickname: nickname || email.split('@')[0],
            role: withClubManagement ? 'club_manager' : 'member'
          }
        }
      });
    } catch (error) {
      const message = String((error && error.message) || '').toLowerCase();
      if (message.includes('already been registered') || message.includes('already exists')) {
        sendJson(res, 409, {
          error: 'email_exists',
          field: 'email',
          message: 'This email address is already registered.'
        });
        return;
      }
      throw error;
    }

    await updateSignupCodeRecord(config, record.id, {
      used_at: new Date().toISOString(),
      attempts: Number(record.attempts || 0)
    });

    sendJson(res, 200, {
      ok: true,
      message: 'Account created successfully.'
    });
  } catch (error) {
    sendJson(res, error && error.statusCode ? error.statusCode : 500, {
      error: (error && error.message) || 'complete_signup_failed',
      message: (error && error.publicMessage) || 'Unable to create the account right now.'
    });
  }
};
