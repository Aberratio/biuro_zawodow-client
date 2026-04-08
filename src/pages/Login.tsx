import { FormEvent, useState } from 'react';
import { ScanLine, LogIn, KeyRound } from 'lucide-react';
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
        toast({ title: 'Błąd logowania', description: 'Nieprawidłowy email lub hasło.', variant: 'destructive' });
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
        toast({ title: 'Nie udało się wysłać linku', description: result.error, variant: 'destructive' });
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
    <div className="relative flex min-h-screen flex-col overflow-hidden px-4 py-6">
      <div className="pointer-events-none absolute inset-0 page-gradient" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[40rem] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      <div className="relative z-10 flex flex-1 items-center justify-center">
        <div className="w-full max-w-md space-y-5">
          <div className="surface-panel space-y-2 rounded-[2rem] border px-6 py-7 text-center">
            <div className="inline-flex items-center gap-2 text-2xl font-bold">
              <ScanLine className="h-7 w-7 text-primary" />
              Biuro Zawodów
            </div>
            <p className="text-sm text-muted-foreground">System zarządzania wydarzeniami sportowymi</p>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/70 bg-muted/20 pb-4">
              <CardTitle className="text-lg">Zaloguj się</CardTitle>
              <CardDescription>Podaj dane konta, aby przejść do panelu.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="email@example.pl" autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Hasło</Label>
                  <Input id="password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={!email || !password || isSubmitting}>
                  <LogIn className="h-4 w-4 mr-2" /> Zaloguj
                </Button>
              </form>

              <Collapsible open={isForgotOpen} onOpenChange={setIsForgotOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="link" className="h-auto px-0 text-sm">
                    <KeyRound className="mr-2 h-4 w-4" />
                    Zapomniałem hasła
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <form onSubmit={handleForgotPassword} className="mt-3 space-y-3 rounded-2xl border border-border/70 bg-background/40 p-4 backdrop-blur-sm">
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email">Email do resetu hasła</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={event => setResetEmail(event.target.value)}
                        placeholder="email@example.pl"
                        autoComplete="email"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Jeśli konto istnieje, wyślemy link ważny przez 60 minut.
                    </p>
                    <Button type="submit" variant="outline" className="w-full" disabled={!resetEmail || isResetSubmitting}>
                      Wyślij link resetujący
                    </Button>
                  </form>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="relative z-10 mx-auto mt-8 w-full max-w-3xl px-2 pb-2 text-center text-xs leading-6 text-muted-foreground">
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
