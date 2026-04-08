import { FormEvent, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { generateStrongPassword } from '@/lib/password';
import { toast } from '@/hooks/use-toast';

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGeneratePassword = () => {
    const generatedPassword = generateStrongPassword();
    setPassword(generatedPassword);
    setPasswordConfirmation(generatedPassword);
    setShowPassword(true);
    setShowPasswordConfirmation(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await resetPassword(token, password, passwordConfirmation);
      if (!result.ok) {
        toast({ title: 'Nie udało się ustawić hasła', description: result.error, variant: 'destructive' });
        return;
      }

      toast({
        title: 'Hasło zostało ustawione',
        description: result.message ?? 'Możesz teraz zalogować się nowym hasłem.',
      });
      navigate('/login', { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 page-gradient" />
      <div className="pointer-events-none absolute right-[-8rem] top-[-6rem] h-[24rem] w-[24rem] rounded-full bg-primary/5 blur-3xl" />
      <Card className="relative z-10 w-full max-w-md overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-muted/20">
          <CardTitle>Ustaw nowe hasło</CardTitle>
          <CardDescription>Link resetujący jest ważny przez 60 minut.</CardDescription>
        </CardHeader>
        <CardContent>
          {token === '' ? (
            <div className="space-y-2 text-sm">
              <p>Brakuje tokenu resetu hasła.</p>
              <Button variant="outline" onClick={() => navigate('/login', { replace: true })}>Wróć do logowania</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Nowe hasło</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(previousValue => !previousValue)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                    <RefreshCw className="mr-1 h-4 w-4" /> Generuj
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="passwordConfirmation">Powtórz nowe hasło</Label>
                <div className="relative">
                  <Input
                    id="passwordConfirmation"
                    type={showPasswordConfirmation ? 'text' : 'password'}
                    value={passwordConfirmation}
                    onChange={event => setPasswordConfirmation(event.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirmation(previousValue => !previousValue)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showPasswordConfirmation ? 'Ukryj hasło' : 'Pokaż hasło'}
                  >
                    {showPasswordConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum 10 znaków, wielka i mała litera, cyfra oraz znak specjalny.
              </p>
              <Button type="submit" className="w-full" disabled={!password || !passwordConfirmation || isSubmitting}>
                Zapisz nowe hasło
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
