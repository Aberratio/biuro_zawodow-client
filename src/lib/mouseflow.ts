declare global {
  interface Window {
    _mfq?: unknown[];
    __biuroZawodowMouseflowLoaded?: boolean;
  }
}

const mouseflowProjectId = import.meta.env.VITE_MOUSEFLOW_PROJECT_ID?.trim();
const mouseflowEnabled =
  import.meta.env.VITE_MOUSEFLOW_ENABLED === "true" &&
  Boolean(mouseflowProjectId);

function protectElement(element: Element) {
  if (
    element.matches(
      "input, textarea, select, [contenteditable='true'], [data-sensitive='true']",
    )
  ) {
    element.setAttribute("data-mf-ignore", "true");
  }
}

export function maskMouseflowSensitiveElements() {
  document
    .querySelectorAll(
      "input, textarea, select, [contenteditable='true'], [data-sensitive='true']",
    )
    .forEach(protectElement);
}

export function watchMouseflowSensitiveElements() {
  maskMouseflowSensitiveElements();

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

export function loadMouseflowAfterConsent() {
  if (!mouseflowEnabled || !mouseflowProjectId) {
    return false;
  }

  if (window.__biuroZawodowMouseflowLoaded) {
    return true;
  }

  maskMouseflowSensitiveElements();
  window._mfq = window._mfq || [];

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.defer = true;
  script.src = `https://cdn.mouseflow.com/projects/${encodeURIComponent(
    mouseflowProjectId,
  )}.js`;
  script.referrerPolicy = "strict-origin-when-cross-origin";
  script.dataset.source = "cookie-consent";

  document.head.appendChild(script);
  window.__biuroZawodowMouseflowLoaded = true;

  return true;
}

export function isMouseflowConfigured() {
  return mouseflowEnabled;
}
