import { createRoot } from "react-dom/client";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { initializeSentry } from "@/lib/sentry";
import App from "./App.tsx";
import "./index.css";

initializeSentry();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const baseUrl = import.meta.env.BASE_URL;
    const serviceWorkerUrl = new URL(
      `${baseUrl}service-worker.js`,
      window.location.href,
    );

    void navigator.serviceWorker
      .register(serviceWorkerUrl, { scope: baseUrl })
      .catch(() => undefined);
  });
}
