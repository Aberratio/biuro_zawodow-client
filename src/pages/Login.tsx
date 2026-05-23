import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Smartphone,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { BrandWordmark } from "@/components/BrandWordmark";
import { toast } from "@/hooks/use-toast";
import { validateEmail, validateRequired } from "@/lib/form-validation";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LoginFooterProps = {
  copyrightYears: string;
  className?: string;
  copyClassName?: string;
  primaryLinkClassName?: string;
  secondaryLinkClassName?: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function isRunningAsInstalledPwa() {
  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    Boolean(navigatorWithStandalone.standalone) ||
    document.referrer.startsWith("android-app://")
  );
}

function isIosDevice() {
  const navigatorWithTouch = window.navigator as Navigator & {
    maxTouchPoints?: number;
  };

  return (
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      (navigatorWithTouch.maxTouchPoints ?? 0) > 1)
  );
}

function isIosSafari() {
  const userAgent = window.navigator.userAgent;

  return (
    isIosDevice() &&
    /safari/i.test(userAgent) &&
    !/crios|fxios|edgios|opios|fbav|fban|instagram/i.test(userAgent)
  );
}

function LoginPwaInstallCard() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstallStarting, setIsInstallStarting] = useState(false);
  const [isIosInstallDialogOpen, setIsIosInstallDialogOpen] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    if (isRunningAsInstalledPwa()) {
      setIsInstalled(true);
      return;
    }

    setShowIosInstructions(isIosDevice());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setShowIosInstructions(false);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setShowIosInstructions(false);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      if (showIosInstructions) {
        setIsIosInstallDialogOpen(true);
      }
      return;
    }

    setIsInstallStarting(true);

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }

      setInstallPrompt(null);
    } finally {
      setIsInstallStarting(false);
    }
  };

  if (isInstalled || (!installPrompt && !showIosInstructions)) {
    return null;
  }

  return (
    <>
      <section
        className="overflow-hidden rounded-[1.35rem] border border-[hsl(var(--button-highlight)/0.18)] bg-[linear-gradient(135deg,hsl(220_12%_11%/0.92),hsl(220_14%_7%/0.92))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05),0_18px_42px_hsl(var(--surface-shadow)/0.22)] backdrop-blur-xl md:rounded-2xl"
        aria-label="Instalacja aplikacji PWA"
      >
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[hsl(var(--button-highlight)/0.22)] bg-[hsl(var(--button-highlight)/0.12)] text-[hsl(var(--button-highlight))]">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-6 tracking-normal text-foreground">
                Zainstaluj Biuro Zawodów
              </h2>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleInstallClick}
            className="h-11 w-full shrink-0 rounded-2xl px-4 text-sm sm:w-auto"
            disabled={Boolean(installPrompt) && isInstallStarting}
          >
            {installPrompt && isInstallStarting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            Pobierz aplikację
          </Button>
        </div>
      </section>

      <Dialog
        open={isIosInstallDialogOpen}
        onOpenChange={setIsIosInstallDialogOpen}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Instalacja na iPhonie</DialogTitle>
            <DialogDescription>
              Safari nie pozwala stronie uruchomić instalatora automatycznie.
              Dodaj aplikację z menu przeglądarki:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm leading-6 text-foreground/88">
            {!isIosSafari() && <li>1. Otwórz tę stronę w Safari.</li>}
            <li>
              {isIosSafari() ? "1" : "2"}. Naciśnij ikonę kwadratu ze
              strzałką.
            </li>
            <li>
              {isIosSafari() ? "2" : "3"}. Wybierz „Dodaj do ekranu
              początkowego”.
            </li>
            <li>{isIosSafari() ? "3" : "4"}. Potwierdź przyciskiem „Dodaj”.</li>
          </ol>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setIsIosInstallDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LoginFooter({
  copyrightYears,
  className,
  copyClassName,
  primaryLinkClassName,
  secondaryLinkClassName,
}: LoginFooterProps) {
  return (
    <footer className={className}>
      <p className={copyClassName}>
        (c) {copyrightYears}{" "}
        <a
          href="https://webcodesign.pl"
          target="_blank"
          rel="noreferrer"
          className={primaryLinkClassName}
        >
          webcodesign.pl
        </a>
        . Strona jest częścią aplikacji{" "}
        <a
          href="https://zmierzymyczas.pl"
          target="_blank"
          rel="noreferrer"
          className={secondaryLinkClassName}
        >
          zmierzymyczas.pl
        </a>
        , gdzie znajdują się wszystkie informacje oraz kontakt z
        właścicielami.
      </p>
    </footer>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showMobilePassword, setShowMobilePassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const currentYear = new Date().getFullYear();
  const copyrightYears = currentYear > 2026 ? `2026-${currentYear}` : "2026";

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setErrors((previous) => ({
      ...previous,
      email: undefined,
      form: undefined,
    }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setErrors((previous) => ({
      ...previous,
      password: undefined,
      form: undefined,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = {
      email: validateEmail(email),
      password: validateRequired(password, "Podaj hasło."),
    };

    if (nextErrors.email || nextErrors.password) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (!result.ok) {
        const message = result.error ?? "Nieprawidłowy e-mail lub hasło.";
        setErrors({ form: message });
        toast({
          title: "Błąd logowania",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-app-viewport relative flex flex-col overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 hidden md:block page-gradient" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(34_10%_10%)_0%,hsl(220_13%_6%)_18%,hsl(220_16%_4%)_56%,hsl(220_20%_3%)_100%)] md:hidden" />
      <div className="pointer-events-none absolute left-[-8rem] top-[-10rem] hidden h-[28rem] w-[28rem] rounded-full bg-primary/18 blur-3xl md:block" />
      <div className="pointer-events-none absolute right-[-6rem] top-[14%] hidden h-[24rem] w-[24rem] rounded-full bg-[hsl(var(--button-highlight)/0.12)] blur-3xl md:block" />
      <div className="pointer-events-none absolute bottom-[-10rem] left-1/2 hidden h-[24rem] w-[42rem] -translate-x-1/2 rounded-full bg-white/5 blur-3xl md:block" />
      <div className="pointer-events-none absolute left-[-7.5rem] top-[-2.5rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,hsl(var(--button-highlight)/0.24)_0%,hsl(var(--button-highlight)/0.12)_26%,transparent_70%)] blur-3xl md:hidden" />
      <div className="pointer-events-none absolute right-[-7.5rem] top-[-2.5rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,hsl(var(--button-highlight)/0.22)_0%,hsl(var(--button-highlight)/0.1)_24%,transparent_70%)] blur-3xl md:hidden" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.012] to-transparent md:hidden" />
      <div className="pointer-events-none absolute bottom-[-7rem] left-1/2 h-44 w-[24rem] -translate-x-1/2 rounded-full bg-white/[0.02] blur-3xl md:hidden" />

      <div className="relative z-10 flex min-h-app-viewport flex-col px-6 pb-safe-bottom pt-10 md:hidden">
        <div className="mx-auto flex w-full max-w-[25rem] flex-1 flex-col">
          <div className="flex-1">
            <div className="pt-7">
              <BrandWordmark
                className="mx-auto w-full max-w-[14rem]"
                imageClassName="h-auto w-full object-contain drop-shadow-[0_0_24px_hsl(var(--button-highlight)/0.08)]"
              />
            </div>

            <div className="mt-14">
              <h1 className="text-[2rem] font-semibold leading-none tracking-[-0.05em] text-foreground md:text-[2.25rem] lg:text-[2.55rem]">
                Logowanie
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
              <div className="space-y-3">
                <Label
                  htmlFor="login-mobile-email"
                  className="text-[0.9rem] font-semibold uppercase tracking-[0.24em] text-foreground/65"
                >
                  Email
                </Label>
                <div
                  className={cn(
                    "flex h-16 items-center rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,hsl(var(--background)/0.88),hsl(220_12%_7%/0.84))] px-5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04),0_18px_36px_hsl(var(--surface-shadow)/0.28)] backdrop-blur-xl transition-colors duration-200 focus-within:border-[hsl(var(--button-highlight)/0.72)]",
                    (errors.email || errors.form) && "border-destructive/80",
                  )}
                >
                  <Mail className="h-5 w-5 shrink-0 text-foreground/48" />
                  <input
                    id="login-mobile-email"
                    type="email"
                    value={email}
                    onChange={(event) => handleEmailChange(event.target.value)}
                    placeholder="email@gmail.com"
                    name="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="email"
                    required
                    aria-invalid={Boolean(errors.email || errors.form)}
                    aria-describedby={
                      errors.email ? "login-mobile-email-error" : undefined
                    }
                    className="h-full w-full bg-transparent pl-4 pr-1 text-[1.12rem] text-foreground placeholder:text-muted-foreground/62 outline-none"
                  />
                </div>
                <FieldError id="login-mobile-email-error">
                  {errors.email}
                </FieldError>
              </div>

              <div className="space-y-3">
                <Label
                  htmlFor="login-mobile-password"
                  className="text-[0.9rem] font-semibold uppercase tracking-[0.24em] text-foreground/65"
                >
                  Hasło
                </Label>
                <div
                  className={cn(
                    "flex h-16 items-center rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,hsl(var(--background)/0.88),hsl(220_12%_7%/0.84))] px-5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04),0_18px_36px_hsl(var(--surface-shadow)/0.28)] backdrop-blur-xl transition-colors duration-200 focus-within:border-[hsl(var(--button-highlight)/0.72)]",
                    (errors.password || errors.form) && "border-destructive/80",
                  )}
                >
                  <Lock className="h-5 w-5 shrink-0 text-foreground/48" />
                  <input
                    id="login-mobile-password"
                    type={showMobilePassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => handlePasswordChange(event.target.value)}
                    placeholder="********"
                    name="password"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    aria-invalid={Boolean(errors.password || errors.form)}
                    aria-describedby={
                      errors.password ? "login-mobile-password-error" : undefined
                    }
                    className="h-full w-full bg-transparent pl-4 pr-3 text-[1.12rem] text-foreground placeholder:text-muted-foreground/62 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowMobilePassword((previousValue) => !previousValue)
                    }
                    className="text-foreground/46 transition-colors hover:text-foreground/78"
                    aria-label={
                      showMobilePassword ? "Ukryj hasło" : "Pokaż hasło"
                    }
                  >
                    {showMobilePassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <FieldError id="login-mobile-password-error">
                  {errors.password}
                </FieldError>
              </div>

              <FieldError id="login-mobile-form-error">{errors.form}</FieldError>

              <Button
                type="submit"
                size="lg"
                className="mt-2 h-16 w-full rounded-[1.35rem] border-[hsl(var(--button-highlight)/0.86)] bg-[linear-gradient(180deg,hsl(40_40%_44%)_0%,hsl(39_29%_31%)_48%,hsl(38_24%_22%)_100%)] text-[1.12rem] font-semibold shadow-[inset_0_1px_0_hsl(var(--foreground)/0.14),0_0_0_1px_hsl(var(--button-highlight)/0.12),0_12px_24px_hsl(var(--surface-shadow)/0.28)] hover:bg-[linear-gradient(180deg,hsl(40_42%_47%)_0%,hsl(39_30%_33%)_48%,hsl(38_25%_24%)_100%)] hover:translate-y-0"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting && (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                )}
                {isSubmitting ? "Logowanie..." : "Zaloguj się"}
              </Button>

              <div className="flex justify-end pt-1">
                <Link
                  to="/forgot-password"
                  className="text-[1rem] font-medium text-foreground/88 transition-colors underline-offset-4 hover:text-[hsl(var(--button-highlight))] hover:underline"
                >
                  Zapomniałeś hasła?
                </Link>
              </div>
            </form>

            <div className="mt-6">
              <LoginPwaInstallCard />
            </div>
          </div>

          <LoginFooter
            copyrightYears={copyrightYears}
            className="pt-16 text-center"
            copyClassName="text-sm leading-7 text-muted-foreground"
            primaryLinkClassName="font-medium text-primary transition-colors hover:text-primary/80"
            secondaryLinkClassName="font-medium text-[hsl(var(--button-highlight))] transition-colors hover:text-primary"
          />
        </div>
      </div>

      <div className="relative z-10 hidden min-h-app-viewport flex-col md:flex">
        <div className="mx-auto flex w-full max-w-xl flex-1 items-start justify-center px-4 pb-5 pt-7 sm:px-6 sm:pb-6 sm:pt-8 lg:items-center lg:px-8 lg:py-6">
          <div className="flex w-full max-w-[30rem] flex-col">
            <div className="mb-4 flex justify-center sm:mb-5 lg:hidden">
              <div className="h-px w-20 bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
            </div>

            <div className="mb-8 flex justify-center sm:mb-9">
              <BrandWordmark
                className="w-[42%] sm:w-[58%] lg:w-[70%]"
                imageClassName="h-auto w-full object-contain"
              />
            </div>

            <Card className="overflow-hidden rounded-[1.75rem] border-white/10 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--background)/0.94))] lg:rounded-[2rem]">
              <CardHeader className="border-b border-white/10 bg-white/[0.03] px-6 pb-5 pt-6 sm:px-7">
                <CardTitle className="text-[1.9rem] tracking-tight">
                  Logowanie
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5 px-6 pb-6 pt-6 sm:px-7">
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label
                      htmlFor="login-desktop-email"
                      className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/65"
                    >
                      Email
                    </Label>
                    <Input
                      id="login-desktop-email"
                      type="email"
                      value={email}
                      onChange={(event) => handleEmailChange(event.target.value)}
                      placeholder="email@gmail.com"
                      name="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="email"
                      required
                      aria-invalid={Boolean(errors.email || errors.form)}
                      aria-describedby={
                        errors.email ? "login-desktop-email-error" : undefined
                      }
                      className="h-12 rounded-2xl border-white/10 bg-black/25 px-4 text-sm"
                    />
                    <FieldError id="login-desktop-email-error">
                      {errors.email}
                    </FieldError>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="login-desktop-password"
                      className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/65"
                    >
                      Hasło
                    </Label>
                    <Input
                      id="login-desktop-password"
                      type="password"
                      value={password}
                      onChange={(event) =>
                        handlePasswordChange(event.target.value)
                      }
                      placeholder="********"
                      name="password"
                      autoComplete="current-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      aria-invalid={Boolean(errors.password || errors.form)}
                      aria-describedby={
                        errors.password
                          ? "login-desktop-password-error"
                          : undefined
                      }
                      className="h-12 rounded-2xl border-white/10 bg-black/25 px-4 text-sm"
                    />
                    <FieldError id="login-desktop-password-error">
                      {errors.password}
                    </FieldError>
                  </div>

                  <FieldError id="login-desktop-form-error">
                    {errors.form}
                  </FieldError>

                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full rounded-2xl text-sm"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting && (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    )}
                    {isSubmitting ? "Logowanie..." : "Zaloguj się"}
                  </Button>

                  <div className="flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-sm font-medium text-foreground/72 transition-colors underline-offset-4 hover:text-[hsl(var(--button-highlight))] hover:underline"
                    >
                      Zapomniałeś hasła?
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="mt-5">
              <LoginPwaInstallCard />
            </div>
          </div>
        </div>

        <LoginFooter
          copyrightYears={copyrightYears}
          className="pb-safe-bottom mx-auto w-full max-w-7xl px-4 pt-2 text-center sm:px-6 lg:px-8"
          copyClassName="text-xs leading-6 text-muted-foreground"
          primaryLinkClassName="font-medium text-primary transition-colors hover:text-primary/80"
          secondaryLinkClassName="font-medium text-foreground/90 underline decoration-primary/30 underline-offset-4 transition-colors hover:text-foreground"
        />
      </div>
    </div>
  );
}
