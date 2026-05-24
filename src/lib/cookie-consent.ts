export type CookieConsentPreferences = {
  essential: true;
  analytics: boolean;
  updatedAt: string;
  version: 1;
};

export const COOKIE_CONSENT_STORAGE_KEY = "biuro_zawodow_cookie_consent_v1";
export const COOKIE_CONSENT_COOKIE_NAME = "bz_cookie_consent";

export function getCookieConsentPreferences():
  | CookieConsentPreferences
  | null {
  try {
    const storedValue = window.localStorage.getItem(
      COOKIE_CONSENT_STORAGE_KEY,
    );

    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(
      storedValue,
    ) as Partial<CookieConsentPreferences>;

    if (parsedValue.version !== 1 || parsedValue.essential !== true) {
      return null;
    }

    return {
      essential: true,
      analytics: Boolean(parsedValue.analytics),
      updatedAt:
        typeof parsedValue.updatedAt === "string"
          ? parsedValue.updatedAt
          : new Date().toISOString(),
      version: 1,
    };
  } catch {
    return null;
  }
}

export function saveCookieConsentPreferences(
  analytics: boolean,
): CookieConsentPreferences {
  const preferences: CookieConsentPreferences = {
    essential: true,
    analytics,
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  window.localStorage.setItem(
    COOKIE_CONSENT_STORAGE_KEY,
    JSON.stringify(preferences),
  );

  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${analytics ? "analytics" : "essential"}; Max-Age=15552000; Path=/; SameSite=Lax${secureFlag}`;

  window.dispatchEvent(
    new CustomEvent<CookieConsentPreferences>("cookie-consent:updated", {
      detail: preferences,
    }),
  );

  return preferences;
}

export function openCookiePreferences() {
  window.dispatchEvent(new Event("cookie-consent:open"));
}
