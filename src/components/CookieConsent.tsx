import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getCookieConsentPreferences,
  saveCookieConsentPreferences,
  type CookieConsentPreferences,
} from "@/lib/cookie-consent";
import {
  isMouseflowConfigured,
  loadMouseflowAfterConsent,
  watchMouseflowSensitiveElements,
} from "@/lib/mouseflow";

function applyConsent(preferences: CookieConsentPreferences | null) {
  if (preferences?.analytics) {
    loadMouseflowAfterConsent();
  }
}

export function CookieConsent() {
  const [preferences, setPreferences] =
    useState<CookieConsentPreferences | null>(() =>
      getCookieConsentPreferences(),
    );
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const mouseflowConfigured = isMouseflowConfigured();

  useEffect(() => watchMouseflowSensitiveElements(), []);

  useEffect(() => {
    applyConsent(preferences);
    setIsBannerVisible(preferences === null);
    setAnalyticsEnabled(preferences?.analytics ?? true);
  }, [preferences]);

  useEffect(() => {
    const handleOpen = () => {
      setAnalyticsEnabled(getCookieConsentPreferences()?.analytics ?? true);
      setIsPreferencesOpen(true);
      setIsBannerVisible(false);
    };

    const handleUpdated = (event: Event) => {
      const nextPreferences = (event as CustomEvent<CookieConsentPreferences>)
        .detail;
      setPreferences(nextPreferences);
    };

    window.addEventListener("cookie-consent:open", handleOpen);
    window.addEventListener("cookie-consent:updated", handleUpdated);

    return () => {
      window.removeEventListener("cookie-consent:open", handleOpen);
      window.removeEventListener("cookie-consent:updated", handleUpdated);
    };
  }, []);

  const savePreferences = (analytics: boolean) => {
    const nextPreferences = saveCookieConsentPreferences(analytics);
    setPreferences(nextPreferences);
    setIsBannerVisible(false);
    setIsPreferencesOpen(false);
  };

  return (
    <>
      {isBannerVisible && (
        <section
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-5xl overflow-hidden rounded-[1.35rem] border border-[hsl(var(--button-highlight)/0.28)] bg-[linear-gradient(180deg,hsl(220_12%_10%/0.98),hsl(220_17%_5%/0.98))] p-4 shadow-[0_24px_80px_hsl(var(--surface-shadow)/0.62),inset_0_1px_0_hsl(var(--foreground)/0.06)] backdrop-blur-2xl md:bottom-5 md:p-5"
          aria-label="Zgoda na pliki cookies"
        >
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.95rem] border border-[hsl(var(--button-highlight)/0.24)] bg-[hsl(var(--button-highlight)/0.12)] text-[hsl(var(--button-highlight))]">
                <Cookie className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-normal text-foreground">
                  Prywatność i cookies
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Używamy niezbędnych cookies do działania aplikacji. Analitykę i
                  nagrywanie sesji Mouseflow uruchamiamy tylko po Twojej zgodzie.
                  Pola formularzy są maskowane przed nagrywaniem.
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <Link
                    to="/legal/privacy"
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Polityka prywatności
                  </Link>
                  <Link
                    to="/legal/cookies"
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Polityka cookies
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 md:w-[26rem]">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-[0.95rem] border-white/10 bg-white/[0.03]"
                onClick={() => savePreferences(false)}
              >
                Odrzuć
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-[0.95rem] border-white/10 bg-white/[0.03]"
                onClick={() => setIsPreferencesOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Ustawienia
              </Button>
              <Button
                type="button"
                className="h-11 rounded-[0.95rem]"
                onClick={() => savePreferences(true)}
                title={
                  mouseflowConfigured
                    ? undefined
                    : "Brak VITE_MOUSEFLOW_PROJECT_ID dla tego środowiska"
                }
              >
                Akceptuję
              </Button>
            </div>
          </div>
        </section>
      )}

      <Dialog open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[1.35rem] border-[hsl(var(--button-highlight)/0.22)] bg-[linear-gradient(180deg,hsl(220_12%_10%/0.98),hsl(220_16%_6%/0.98))] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck
                className="h-5 w-5 text-[hsl(var(--button-highlight))]"
                aria-hidden="true"
              />
              Preferencje prywatności
            </DialogTitle>
            <DialogDescription className="leading-6">
              Możesz włączyć lub wyłączyć analitykę. Niezbędne cookies są
              wymagane do logowania, bezpieczeństwa i zapamiętania tej decyzji.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label className="text-sm font-semibold">
                    Niezbędne cookies
                  </Label>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Sesja, bezpieczeństwo, stan interfejsu i zapis preferencji.
                    Nie można ich wyłączyć, bo aplikacja nie działałaby
                    prawidłowo.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-[hsl(var(--button-highlight)/0.3)] bg-[hsl(var(--button-highlight)/0.1)] text-[hsl(var(--button-highlight))]"
                >
                  Zawsze aktywne
                </Badge>
              </div>
            </div>

            <div className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="analytics-consent" className="text-sm font-semibold">
                    Analityka i nagrywanie sesji
                  </Label>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Mouseflow pomaga wykrywać problemy z obsługą panelu. Skrypt
                    ładuje się dopiero po zgodzie, a pola formularzy są oznaczane
                    jako pomijane w nagraniach.
                  </p>
                  {!mouseflowConfigured && (
                    <p className="mt-2 text-xs leading-5 text-[hsl(var(--button-highlight))]">
                      W tym środowisku brakuje klucza Mouseflow, więc ta opcja
                      nie uruchomi skryptu.
                    </p>
                  )}
                </div>
                <Switch
                  id="analytics-consent"
                  checked={analyticsEnabled && mouseflowConfigured}
                  disabled={!mouseflowConfigured}
                  onCheckedChange={setAnalyticsEnabled}
                  aria-label="Analityka i nagrywanie sesji"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-[0.95rem] border-white/10 bg-white/[0.03]"
              onClick={() => savePreferences(false)}
            >
              Tylko niezbędne
            </Button>
            <Button
              type="button"
              className="rounded-[0.95rem]"
              onClick={() => savePreferences(analyticsEnabled)}
            >
              Zapisz preferencje
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
