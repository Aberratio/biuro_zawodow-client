import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_STORAGE_KEY,
  getCookieConsentPreferences,
  openCookiePreferences,
  saveCookieConsentPreferences,
} from './cookie-consent';

describe('cookie consent helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/`;
  });

  it('returns null for missing, malformed or unsupported stored preferences', () => {
    expect(getCookieConsentPreferences()).toBeNull();
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, '{bad');
    expect(getCookieConsentPreferences()).toBeNull();
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({ version: 2, essential: true }));
    expect(getCookieConsentPreferences()).toBeNull();
  });

  it('saves preferences to localStorage, cookie and update event', () => {
    const listener = vi.fn();
    window.addEventListener('cookie-consent:updated', listener);

    const preferences = saveCookieConsentPreferences(true);

    expect(preferences.essential).toBe(true);
    expect(preferences.analytics).toBe(true);
    expect(getCookieConsentPreferences()?.analytics).toBe(true);
    expect(document.cookie).toContain(`${COOKIE_CONSENT_COOKIE_NAME}=analytics`);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('dispatches an event when preferences should be opened', () => {
    const listener = vi.fn();
    window.addEventListener('cookie-consent:open', listener);

    openCookiePreferences();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
