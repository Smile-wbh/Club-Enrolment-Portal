const {
  SIGNUP_CODE_RETRY_SECONDS,
  assertConfig,
  createSignupCode,
  deleteSignupCodeRecord,
  findProfileByEmail,
  getConfig,
  getLatestSignupCodeRecord,
  getRetryAfterSeconds,
  getSignupCodeHash,
  insertSignupCodeRecord,
  isValidEmail,
  markSignupCodesUsed,
  normalizeEmail,
  readJsonBody,
  sendJson,
  sendSignupCodeEmail,
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

    if (!isValidEmail(email)) {
      sendJson(res, 400, {
        error: 'invalid_email',
        field: 'email',
        message: 'Enter a valid email address before requesting a code.'
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

    assertConfig(config, ['supabaseUrl', 'serviceRoleKey', 'resendApiKey', 'resendFromEmail', 'emailCodeSecret']);

    const existingProfile = await findProfileByEmail(config, email);
    if (existingProfile) {
      sendJson(res, 409, {
        error: 'email_exists',
        field: 'email',
        message: 'This email address is already registered.'
      });
      return;
    }

    const latestRecord = await getLatestSignupCodeRecord(config, email);
    const retryAfterSeconds = getRetryAfterSeconds(latestRecord);
    if (retryAfterSeconds > 0) {
      sendJson(res, 429, {
        error: 'rate_limited',
        field: 'verificationCode',
        retryAfterSeconds,
        message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`
      });
      return;
    }

    const code = createSignupCode();
    const codeHash = getSignupCodeHash(config, email, code);

    await markSignupCodesUsed(config, email);
    const createdRecord = await insertSignupCodeRecord(config, email, codeHash);

    try {
      await sendSignupCodeEmail(config, email, code);
    } catch (error) {
      await deleteSignupCodeRecord(config, createdRecord && createdRecord.id);
      throw error;
    }

    sendJson(res, 200, {
      ok: true,
      retryAfterSeconds: SIGNUP_CODE_RETRY_SECONDS,
      message: 'A 6-digit verification code has been sent to your email.'
    });
  } catch (error) {
    sendJson(res, error && error.statusCode ? error.statusCode : 500, {
      error: (error && error.message) || 'send_signup_code_failed',
      message: (error && error.publicMessage) || 'Unable to send the verification code right now.'
    });
  }
};
