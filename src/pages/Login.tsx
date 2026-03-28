import { FormEvent, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScanLine, ChevronDown, LogIn, KeyRound } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const demoAccounts = [
  { role: 'Superadmin', email: 'super@biurozawodow.pl', password: 'demo123' },
  { role: 'Admin (SportEvents)', email: 'admin@sportevents.pl', password: 'demo123' },
  { role: 'Admin (RunPoland)', email: 'admin@runpoland.pl', password: 'demo123' },
  { role: 'Organizator', email: 'org.gniezno@sportevents.pl', password: 'demo123' },
  { role: 'Skaner', email: 'skaner1@sportevents.pl', password: 'demo123' },
];

export default function Login() {
  const { login, forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [demoOpen, setDemoOpen] = useState(false);
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

  const quickLogin = async (nextEmail: string, nextPassword: string) => {
    const ok = await login(nextEmail, nextPassword);
    if (!ok) {
      toast({ title: 'Błąd logowania', description: 'Nieprawidłowy email lub hasło.', variant: 'destructive' });
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

        <Collapsible open={demoOpen} onOpenChange={setDemoOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-muted/50 rounded-lg transition-colors">
                <span>Konta demo</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${demoOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Rola</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demoAccounts.map(account => (
                      <TableRow key={account.email} className="cursor-pointer hover:bg-muted/50" onClick={() => quickLogin(account.email, account.password)}>
                        <TableCell className="text-xs font-medium py-2">{account.role}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2">{account.email}</TableCell>
                        <TableCell className="py-2">
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2">Zaloguj</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">Hasło dla wszystkich: <code className="bg-muted px-1 rounded">demo123</code></p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}
