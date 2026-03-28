import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScanLine, ChevronDown, LogIn } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const demoAccounts = [
  { role: 'Superadmin', email: 'super@biurozawodow.pl', password: 'demo123' },
  { role: 'Admin (SportEvents)', email: 'admin@sportevents.pl', password: 'demo123' },
  { role: 'Admin (RunPoland)', email: 'admin@runpoland.pl', password: 'demo123' },
  { role: 'Organizator', email: 'org.gniezno@sportevents.pl', password: 'demo123' },
  { role: 'Skaner', email: 'skaner1@sportevents.pl', password: 'demo123' },
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoOpen, setDemoOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(email, password);
    if (!ok) {
      toast({ title: 'Błąd logowania', description: 'Nieprawidłowy email lub hasło', variant: 'destructive' });
    }
  };

  const quickLogin = async (email: string, password: string) => {
    const ok = await login(email, password);
    if (!ok) {
      toast({ title: 'BĹ‚Ä…d logowania', description: 'NieprawidĹ‚owy email lub hasĹ‚o', variant: 'destructive' });
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
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.pl" autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Hasło</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" disabled={!email || !password}>
                <LogIn className="h-4 w-4 mr-2" /> Zaloguj
              </Button>
            </form>
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
                    {demoAccounts.map(a => (
                      <TableRow key={a.email} className="cursor-pointer hover:bg-muted/50" onClick={() => quickLogin(a.email, a.password)}>
                        <TableCell className="text-xs font-medium py-2">{a.role}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2">{a.email}</TableCell>
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
