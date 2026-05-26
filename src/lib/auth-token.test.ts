import { decodeJwtPayload, isJwtExpired } from './auth-token';

function encodeBase64Url(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function tokenWithPayload(payload: unknown): string {
  return `header.${encodeBase64Url(payload)}.signature`;
}

describe('auth token helpers', () => {
  it('decodes a JWT payload encoded with base64url padding omitted', () => {
    expect(decodeJwtPayload(tokenWithPayload({ exp: 123, role: 'admin' }))).toEqual({
      exp: 123,
      role: 'admin',
    });
  });

  it('treats malformed or missing-exp tokens as expired', () => {
    expect(decodeJwtPayload('not-a-token')).toBeNull();
    expect(isJwtExpired(tokenWithPayload({ role: 'admin' }), 1_000)).toBe(true);
    expect(isJwtExpired('not-a-token', 1_000)).toBe(true);
  });

  it('compares token expiration against the supplied clock', () => {
    expect(isJwtExpired(tokenWithPayload({ exp: 10 }), 9_999)).toBe(false);
    expect(isJwtExpired(tokenWithPayload({ exp: 10 }), 10_000)).toBe(true);
  });
});
