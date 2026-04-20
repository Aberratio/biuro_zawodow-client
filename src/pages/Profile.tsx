import { FormEvent, useMemo, useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { generateStrongPassword } from '@/lib/password';
import { validatePasswordConfirmation, validateRequired, validateStrongPassword } from '@/lib/form-validation';
import { toast } from '@/hooks/use-toast';

const roleLabels: Record<string, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  editor: 'Organizator',
  scanner: 'Operator',
  scanner_plus: 'Operator Plus',
};

export default function Profile() {
  const { user, changePassword } = useAuth();
  const { organizations } = useData();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirmation, setShowNewPasswordConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    newPasswordConfirmation?: string;
    form?: string;
  }>({});

  const organizationLabel = useMemo(() => {
    if (!user) return 'Brak';
    if (user.role === 'admin') return 'Wszystkie organizacje';

    if (!user.organization_id) return 'Brak';
    return organizations.find(organization => organization.id === user.organization_id)?.name ?? user.organization_id;
  }, [organizations, user]);

  const handleGeneratePassword = () => {
    const generatedPassword = generateStrongPassword();
    setNewPassword(generatedPassword);
    setNewPasswordConfirmation(generatedPassword);
    setShowNewPassword(true);
    setShowNewPasswordConfirmation(true);
    setErrors(previous => ({ ...previous, newPassword: undefined, newPasswordConfirmation: undefined, form: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = {
      currentPassword: validateRequired(currentPassword, 'Podaj aktualne hasło.'),
      newPassword: validateStrongPassword(newPassword),
      newPasswordConfirmation: validatePasswordConfirmation(newPassword, newPasswordConfirmation),
    };

    if (nextErrors.currentPassword || nextErrors.newPassword || nextErrors.newPasswordConfirmation) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const result = await changePassword(currentPassword, newPassword, newPasswordConfirmation);
      if (!result.ok) {
        setErrors({ form: result.error ?? 'Nie udało się zmienić hasła.' });
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
      setErrors({});
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
          <CardDescription>Podstawowe informacje o koncie.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 rounded-xl border px-4 py-3">
              <p className="text-sm text-muted-foreground">Imię i nazwisko</p>
              <p className="text-sm font-medium">{user.name}</p>
            </div>
            <div className="space-y-1 rounded-xl border px-4 py-3">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-sm font-medium break-all">{user.email}</p>
            </div>
            <div className="space-y-1 rounded-xl border px-4 py-3">
              <p className="text-sm text-muted-foreground">Rola</p>
              <p className="text-sm font-medium">{roleLabels[user.role] ?? user.role}</p>
            </div>
            <div className="space-y-1 rounded-xl border px-4 py-3">
              <p className="text-sm text-muted-foreground">Organizacja</p>
              <p className="text-sm font-medium">{organizationLabel}</p>
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
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Aktualne hasło</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={event => {
                    setCurrentPassword(event.target.value);
                    setErrors(previous => ({ ...previous, currentPassword: undefined, form: undefined }));
                  }}
                  autoComplete="current-password"
                  required
                  aria-invalid={Boolean(errors.currentPassword || errors.form)}
                  aria-describedby={errors.currentPassword ? 'profile-current-password-error' : undefined}
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
              <FieldError id="profile-current-password-error">{errors.currentPassword}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nowe hasło</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={event => {
                      setNewPassword(event.target.value);
                      setErrors(previous => ({ ...previous, newPassword: undefined, form: undefined }));
                    }}
                    autoComplete="new-password"
                    required
                    minLength={10}
                    aria-invalid={Boolean(errors.newPassword || errors.form)}
                    aria-describedby={errors.newPassword ? 'profile-new-password-error' : undefined}
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
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleGeneratePassword}>
                  <RefreshCw className="mr-1 h-4 w-4" /> Generuj
                </Button>
              </div>
              <PasswordRequirements password={newPassword} />
              <FieldError id="profile-new-password-error">{errors.newPassword}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPasswordConfirmation">Powtórz nowe hasło</Label>
              <div className="relative">
                <Input
                  id="newPasswordConfirmation"
                  type={showNewPasswordConfirmation ? 'text' : 'password'}
                  value={newPasswordConfirmation}
                  onChange={event => {
                    setNewPasswordConfirmation(event.target.value);
                    setErrors(previous => ({ ...previous, newPasswordConfirmation: undefined, form: undefined }));
                  }}
                  autoComplete="new-password"
                  required
                  aria-invalid={Boolean(errors.newPasswordConfirmation || errors.form)}
                  aria-describedby={errors.newPasswordConfirmation ? 'profile-new-password-confirmation-error' : undefined}
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
              <FieldError id="profile-new-password-confirmation-error">{errors.newPasswordConfirmation}</FieldError>
            </div>
            <FieldError id="profile-password-form-error">{errors.form}</FieldError>
            <Button className="w-full sm:w-auto" type="submit" disabled={isSubmitting}>
              Zapisz nowe hasło
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
