import { FormEvent, useState } from 'react';
import { ArrowRight, ChevronDown, KeyRound, LockKeyhole, LogIn, Mail, ScanLine, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';

export default function Login() {
  const { login, forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const currentYear = new Date().getFullYear();
  const copyrightYears = currentYear > 2026 ? `2026-${currentYear}` : '2026';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const ok = await login(email, password);
      if (!ok) {
        toast({
          title: 'Błąd logowania',
          description: 'Nieprawidłowy email lub hasło.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsResetSubmitting(true);

    try {
      const result = await forgotPassword(resetEmail);
      if (!result.ok) {
        toast({
          title: 'Nie udało się wysłać linku',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Sprawdź pocztę',
        description: result.message ?? 'Jeśli konto istnieje, wysłaliśmy link do resetu hasła.',
      });
      setResetEmail('');
      setIsForgotOpen(false);
    } finally {
      setIsResetSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 page-gradient" />
      <div className="pointer-events-none absolute left-[-8rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute right-[-6rem] top-[14%] h-[24rem] w-[24rem] rounded-full bg-[hsl(var(--button-highlight)/0.08)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-10rem] left-1/2 h-[24rem] w-[42rem] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-start px-4 py-4 sm:px-6 sm:py-6 lg:items-center lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,30rem)] lg:items-center">
          <section className="surface-panel order-2 relative overflow-hidden rounded-[2rem] border px-5 py-5 sm:px-8 sm:py-9 lg:order-1 lg:min-h-[42rem] lg:px-10 lg:py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--foreground)/0.08),transparent_24rem)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="space-y-5 sm:space-y-8">
                <div className="hidden w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-foreground/70 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] sm:inline-flex">
                  <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--button-highlight))]" />
                  Panel premium dla organizatorów
                </div>

                <div className="space-y-4 sm:space-y-5">
                  <div className="inline-flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[1.1rem] border border-primary/30 bg-primary/12 shadow-[0_18px_40px_hsl(var(--surface-shadow)/0.45)] sm:h-14 sm:w-14 sm:rounded-[1.4rem]">
                      <ScanLine className="h-5 w-5 text-primary sm:h-7 sm:w-7" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-foreground/55">Biuro Zawodów</p>
                      <p className="text-xs text-muted-foreground sm:text-sm">System zarządzania wydarzeniami sportowymi</p>
                    </div>
                  </div>

                  <div className="max-w-2xl space-y-3 sm:space-y-4">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                      Zarządzanie wydarzeniem w eleganckim, zamkniętym panelu.
                    </h1>
                    <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                      Dostęp do aplikacji mają wyłącznie konta utworzone przez administratora. Zaloguj się, aby przejść do obsługi zawodów, uczestników i procesów organizacyjnych.
                    </p>
                  </div>
                </div>

                <div className="hidden gap-3 sm:grid sm:grid-cols-3">
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 shadow-[0_18px_38px_hsl(var(--surface-shadow)/0.32)] backdrop-blur-xl">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <p className="mt-4 text-sm font-medium text-foreground">Dostęp prywatny</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">Panel nie udostępnia otwartej rejestracji użytkowników.</p>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 shadow-[0_18px_38px_hsl(var(--surface-shadow)/0.32)] backdrop-blur-xl">
                    <LockKeyhole className="h-5 w-5 text-[hsl(var(--button-highlight))]" />
                    <p className="mt-4 text-sm font-medium text-foreground">Konta zakładane ręcznie</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">Nowe konto tworzy administrator organizacji lub właściciel systemu.</p>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 shadow-[0_18px_38px_hsl(var(--surface-shadow)/0.32)] backdrop-blur-xl">
                    <Mail className="h-5 w-5 text-foreground/80" />
                    <p className="mt-4 text-sm font-medium text-foreground">Reset przez email</p>
                    <p className="mt-1 text-xs leading-6 text-muted-foreground">Jeśli masz konto, możesz odzyskać dostęp z użyciem adresu przypisanego do profilu.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-black/15 p-4 shadow-[0_18px_42px_hsl(var(--surface-shadow)/0.32)] sm:grid-cols-[1fr_auto] sm:items-center sm:rounded-[1.75rem]">
                <div>
                  <p className="text-sm font-medium text-foreground">Potrzebujesz nowego konta?</p>
                  <p className="mt-1 text-xs leading-6 text-muted-foreground">
                    W tej aplikacji nie da się założyć konta samodzielnie. Skontaktuj się z administratorem swojej organizacji albo z właścicielem systemu.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-medium text-foreground/85">
                  Dostęp nadawany indywidualnie
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
            </div>
          </section>

          <Card className="order-1 overflow-hidden rounded-[1.75rem] border-white/10 bg-[linear-gradient(180deg,hsl(var(--card)/0.96),hsl(var(--background)/0.92))] lg:order-2 lg:rounded-[2rem]">
            <CardHeader className="border-b border-white/10 bg-white/[0.03] px-6 pb-5 pt-6 sm:px-7">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-foreground/75">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Dostęp autoryzowany
              </div>
              <CardTitle className="text-[1.9rem] tracking-tight">Zaloguj się</CardTitle>
              <CardDescription className="max-w-sm text-sm leading-6">
                Użyj danych konta przypisanego do Twojej organizacji, aby wejść do panelu.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 px-6 pb-6 pt-6 sm:px-7">
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)]">
                <p className="text-sm font-medium text-foreground">Brak publicznej rejestracji</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  Jeśli nie masz jeszcze danych dostępowych, poproś administratora o utworzenie konta. Rejestracja własna nie jest dostępna w tej aplikacji.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/65">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="email@example.pl"
                    autoComplete="email"
                    className="h-12 rounded-2xl border-white/10 bg-black/20 px-4 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/65">
                    Hasło
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="h-12 rounded-2xl border-white/10 bg-black/20 px-4 text-sm"
                  />
                </div>

                <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-sm" disabled={!email || !password || isSubmitting}>
                  <LogIn className="h-4 w-4" />
                  Zaloguj do panelu
                </Button>
              </form>

              <Collapsible open={isForgotOpen} onOpenChange={setIsForgotOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-auto w-full justify-between rounded-[1.35rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-foreground/85 hover:bg-white/[0.06]"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--button-highlight))]" />
                      <span className="min-w-0 whitespace-normal leading-6">
                        Zapomniałeś hasła? Otwórz formularz resetu dostępu.
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-300 ${isForgotOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="pt-3">
                  <form onSubmit={handleForgotPassword} className="space-y-4 rounded-[1.6rem] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)] backdrop-blur-sm">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email" className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/65">
                        Email do resetu
                      </Label>
                      <Input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={event => setResetEmail(event.target.value)}
                        placeholder="email@example.pl"
                        autoComplete="email"
                        className="h-12 rounded-2xl border-white/10 bg-background/60 px-4 text-sm"
                      />
                    </div>

                    <p className="text-xs leading-6 text-muted-foreground">
                      Jeśli konto istnieje, wyślemy link resetujący na przypisany adres email. Link będzie aktywny przez 60 minut.
                    </p>

                    <Button type="submit" variant="outline" className="h-11 w-full rounded-2xl" disabled={!resetEmail || isResetSubmitting}>
                      Wyślij link resetujący
                    </Button>
                  </form>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-6 text-center text-xs leading-6 text-muted-foreground sm:px-6 lg:px-8">
        <p>
          © {copyrightYears}{' '}
          <a
            href="https://webcodesign.pl"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary transition-colors hover:text-primary/80"
          >
            webcodesign.pl
          </a>
          . Strona jest częścią aplikacji{' '}
          <a
            href="https://zmierzymyczas.pl"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground/90 underline decoration-primary/30 underline-offset-4 transition-colors hover:text-foreground"
          >
            zmierzymyczas.pl
          </a>
          , gdzie znajdują się wszystkie informacje oraz kontakt z właścicielami.
        </p>
      </footer>
    </div>
  );
}
