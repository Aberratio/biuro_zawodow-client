declare global {
  interface Window {
    smartlook?: SmartlookQueue;
    __biuroZawodowSmartlookLoaded?: boolean;
  }
}

type SmartlookQueue = {
  (...args: unknown[]): void;
  api?: unknown[];
};

const smartlookProjectKey = import.meta.env.VITE_SMARTLOOK_PROJECT_KEY?.trim();
const smartlookEnabled =
  import.meta.env.VITE_SMARTLOOK_ENABLED === "true" &&
  Boolean(smartlookProjectKey);

function protectElement(element: Element) {
  if (
    element.matches(
      "input, textarea, select, [contenteditable='true'], [data-sensitive='true']",
    )
  ) {
    element.setAttribute("data-sl", "mask");
  }
}

export function maskSmartlookSensitiveElements() {
  document
    .querySelectorAll(
      "input, textarea, select, [contenteditable='true'], [data-sensitive='true']",
    )
    .forEach(protectElement);
}

export function watchSmartlookSensitiveElements() {
  maskSmartlookSensitiveElements();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return;
        }

        protectElement(node);
        node
          .querySelectorAll(
            "input, textarea, select, [contenteditable='true'], [data-sensitive='true']",
          )
          .forEach(protectElement);
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
}

export function loadSmartlookAfterConsent() {
  if (!smartlookEnabled || !smartlookProjectKey) {
    return false;
  }

  if (window.__biuroZawodowSmartlookLoaded) {
    return true;
  }

  maskSmartlookSensitiveElements();

  if (!window.smartlook) {
    const smartlookQueue: SmartlookQueue = (...args: unknown[]) => {
      smartlookQueue.api?.push(args);
    };
    smartlookQueue.api = [];
    window.smartlook = smartlookQueue;
  }

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.async = true;
  script.charset = "utf-8";
  script.src = "https://web-sdk.smartlook.com/recorder.js";
  script.referrerPolicy = "strict-origin-when-cross-origin";
  script.dataset.source = "cookie-consent";

  document.head.appendChild(script);
  window.smartlook("init", smartlookProjectKey, {
    region: "eu",
  });
  window.smartlook("record", {
    forms: false,
    emails: false,
    numbers: false,
  });
  window.__biuroZawodowSmartlookLoaded = true;

  return true;
}

export function isSmartlookConfigured() {
  return smartlookEnabled;
}
