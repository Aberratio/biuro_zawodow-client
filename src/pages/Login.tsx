import { FormEvent, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScanLine, LogIn, KeyRound } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function Login() {
  const { login, forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-2xl font-bold">
            <ScanLine className="h-7 w-7 text-primary" />
            Biuro Zawodów
          </div>
          <p className="text-sm text-muted-foreground">System zarządzania wydarzeniami sportowymi</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
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
                <form onSubmit={handleForgotPassword} className="mt-3 space-y-3 rounded-lg border p-4">
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
  );
}
