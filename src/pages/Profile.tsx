import { FormEvent, useMemo, useState } from 'react';
import { Eye, EyeOff, Info, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useMockData } from '@/contexts/MockDataContext';
import { generateStrongPassword } from '@/lib/password';
import { toast } from '@/hooks/use-toast';

const roleLabels: Record<string, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  editor: 'Organizator',
  scanner: 'Skaner',
};

export default function Profile() {
  const { user, changePassword } = useAuth();
  const { organizations } = useMockData();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirmation, setShowNewPasswordConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const organizationLabel = useMemo(() => {
    if (!user) return 'Brak';
    if (user.role === 'admin') {
      const names = (user.organization_ids ?? [])
        .map(organizationId => organizations.find(organization => organization.id === organizationId)?.name ?? organizationId)
        .filter(Boolean);

      return names.length > 0 ? names.join(', ') : 'Brak przypisanych organizacji';
    }

    if (!user.organization_id) return 'Brak';
    return organizations.find(organization => organization.id === user.organization_id)?.name ?? user.organization_id;
  }, [organizations, user]);

  const handleGeneratePassword = () => {
    const generatedPassword = generateStrongPassword();
    setNewPassword(generatedPassword);
    setNewPasswordConfirmation(generatedPassword);
    setShowNewPassword(true);
    setShowNewPasswordConfirmation(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await changePassword(currentPassword, newPassword, newPasswordConfirmation);
      if (!result.ok) {
        toast({ title: 'Nie udało się zmienić hasła', description: result.error, variant: 'destructive' });
        return;
      }

      toast({
        title: 'Hasło zostało zmienione',
        description: result.message ?? 'Nowe hasło jest już aktywne.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirmation('');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Mój profil</CardTitle>
          <CardDescription>Podstawowe informacje o koncie i dostępach.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Dane profilu poniżej nie są edytowalne ręcznie. Jeśli chcesz zmienić nazwę, email, rolę lub organizację, skontaktuj się z administratorem.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Imię i nazwisko</Label>
              <Input value={user.name} readOnly disabled className="cursor-not-allowed border-dashed bg-muted text-muted-foreground opacity-100" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user.email} readOnly disabled className="cursor-not-allowed border-dashed bg-muted text-muted-foreground opacity-100" />
            </div>
            <div className="space-y-1.5">
              <Label>Rola</Label>
              <Input value={roleLabels[user.role] ?? user.role} readOnly disabled className="cursor-not-allowed border-dashed bg-muted text-muted-foreground opacity-100" />
            </div>
            <div className="space-y-1.5">
              <Label>Organizacja</Label>
              <Input value={organizationLabel} readOnly disabled className="cursor-not-allowed border-dashed bg-muted text-muted-foreground opacity-100" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zmień hasło</CardTitle>
          <CardDescription>Hasło musi mieć minimum 10 znaków, wielką i małą literę, cyfrę oraz znak specjalny.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Aktualne hasło</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(previousValue => !previousValue)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={showCurrentPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nowe hasło</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={event => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(previousValue => !previousValue)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showNewPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" onClick={handleGeneratePassword}>
                  <RefreshCw className="mr-1 h-4 w-4" /> Generuj
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPasswordConfirmation">Powtórz nowe hasło</Label>
              <div className="relative">
                <Input
                  id="newPasswordConfirmation"
                  type={showNewPasswordConfirmation ? 'text' : 'password'}
                  value={newPasswordConfirmation}
                  onChange={event => setNewPasswordConfirmation(event.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPasswordConfirmation(previousValue => !previousValue)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={showNewPasswordConfirmation ? 'Ukryj hasło' : 'Pokaż hasło'}
                >
                  {showNewPasswordConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={!currentPassword || !newPassword || !newPasswordConfirmation || isSubmitting}>
              Zapisz nowe hasło
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
