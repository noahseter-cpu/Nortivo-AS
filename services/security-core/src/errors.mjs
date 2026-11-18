export class SecurityCoreError extends Error {
  constructor(status, code) {
    super(code);
    this.name = 'SecurityCoreError';
    this.status = status;
    this.code = code;
  }
}

const messages = Object.freeze({
  AUTH_REQUIRED: 'Sign in to continue.',
  AUTH_UNAVAILABLE: 'Authentication is temporarily unavailable.',
  FORBIDDEN: 'Access is not permitted.',
  MFA_REQUIRED: 'Recent multifactor verification is required.',
  INVALID_ORIGIN: 'Use this action from its own website.',
  CSRF_FAILED: 'Refresh this page before trying again.',
  METHOD_NOT_ALLOWED: 'This request method is not supported.',
  INVALID_BODY: 'Send a valid JSON object with the expected fields.',
  BODY_TOO_LARGE: 'The request is too large.',
  UNSUPPORTED_MEDIA_TYPE: 'Send a JSON request.',
  RATE_LIMITED: 'Too many requests. Try again later.',
  RATE_LIMIT_UNAVAILABLE: 'Request protection is temporarily unavailable.',
  AUDIT_UNAVAILABLE: 'Security logging is temporarily unavailable.',
  CLIENT_CONTEXT_REQUIRED: 'Request protection is temporarily unavailable.',
  NOT_FOUND: 'The requested resource is unavailable.',
  UNAVAILABLE: 'The action could not be confirmed.'
});

export function publicError(error) {
  if (!(error instanceof SecurityCoreError) || !Object.hasOwn(messages, error.code)) {
    return { status: 503, code: 'UNAVAILABLE', message: messages.UNAVAILABLE };
  }
  return { status: error.status, code: error.code, message: messages[error.code] };
}
