import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Building2, CalendarDays, Plus, Radio, ShieldCheck, Users } from 'lucide-react';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

export default function Organizations() {
  const navigate = useNavigate();
  const { organizations, events, users, currentRole, currentUser, createOrganization, isLoading } = useData();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', event_limit: '1', admin_user_id: '' });
  const admins = users.filter(user => user.role === 'admin');

  const visibleOrganizations = useMemo(() => {
    if (currentRole === 'superadmin') return organizations;
    if (currentRole === 'admin') return organizations.filter(org => (currentUser.organization_ids ?? []).includes(org.id));
    return organizations.filter(org => org.id === currentUser.organization_id);
  }, [currentRole, currentUser, organizations]);

  if (isLoading) return <TableSkeleton rows={4} cols={4} subtitle="" />;

  const handleCreate = async () => {
    const parsedLimit = Number(form.event_limit);
    if (!form.name || !Number.isInteger(parsedLimit) || parsedLimit < 0) {
      toast({ title: 'Nieprawidłowe dane', description: 'Podaj nazwę i poprawny limit wydarzeń.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    if (currentRole === 'superadmin' && !form.admin_user_id) {
      toast({ title: 'Brak administratora', description: 'Wybierz admina dla nowej organizacji.', variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    const result = await createOrganization({
      name: form.name,
      event_limit: parsedLimit,
      admin_user_id: currentRole === 'superadmin' ? form.admin_user_id : undefined,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      toast({ title: 'Nie udało się utworzyć organizacji', description: result.error ?? 'Spróbuj ponownie.', variant: 'destructive' });
      return;
    }

    setForm({ name: '', event_limit: '1', admin_user_id: '' });
    setOpen(false);
    toast({ title: 'Organizacja utworzona' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Organizacje</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Przegląd organizacji. Otwórz wybraną kartę, aby zarządzać wydarzeniami, zespołem i limitami.
          </p>
        </div>
        {(currentRole === 'admin' || currentRole === 'superadmin') && (
          <Button onClick={() => setOpen(true)} size="sm" className="w-full sm:w-auto sm:self-auto">
            <Plus className="mr-1 h-4 w-4" />
            Nowa organizacja
          </Button>
        )}
      </div>

      {visibleOrganizations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Brak organizacji do wyświetlenia</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Gdy organizacje będą dostępne, pojawią się tutaj jako osobne karty.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {visibleOrganizations.map(org => {
            const orgEvents = events.filter(event => event.organization_id === org.id);
            const organizers = users.filter(user => user.organization_id === org.id && user.role === 'editor');
            const scanners = users.filter(user => user.organization_id === org.id && user.role === 'scanner');
            const remainingSlots = Math.max(org.event_limit - orgEvents.length, 0);
            const adminLabel = org.admin_user_name ?? users.find(user => user.id === org.admin_user_id)?.name ?? 'Brak admina';

            return (
              <Card
                key={org.id}
                className="overflow-hidden border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <CardHeader className="border-b bg-muted/20 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">{org.name}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Centrum zarządzania wydarzeniami, zespołem i dostępami organizacji.
                      </p>
                    </div>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center self-start rounded-2xl bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-background px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Wydarzenia
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <span className="text-2xl font-semibold tabular-nums">{orgEvents.length}/{org.event_limit}</span>
                        <Badge variant={remainingSlots > 0 ? 'secondary' : 'outline'}>
                          {remainingSlots} wolnych
                        </Badge>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-background px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        Zespół
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <span className="text-2xl font-semibold tabular-nums">{organizers.length + scanners.length}</span>
                        <span className="text-xs text-muted-foreground">łącznie osób</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1.5">
                      <ShieldCheck className="h-3 w-3" />
                      Admin: {adminLabel}
                    </Badge>
                    <Badge variant="outline" className="gap-1.5">
                      <Users className="h-3 w-3" />
                      {organizers.length} organizatorów
                    </Badge>
                    <Badge variant="outline" className="gap-1.5">
                      <Radio className="h-3 w-3" />
                      {scanners.length} skanerów
                    </Badge>
                  </div>

                  <div className="rounded-xl border bg-muted/20 px-4 py-3">
                    <div className="text-sm font-medium">Administrator organizacji</div>
                    <div className="mt-1 text-sm text-muted-foreground">{adminLabel}</div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Otwórz szczegóły, aby zarządzać limitami, wydarzeniami i użytkownikami tej organizacji.
                    </p>
                    <Button
                      className="h-11 w-full shrink-0 gap-2 sm:h-10 sm:w-auto"
                      onClick={() => navigate(`/organizations/${org.id}`)}
                    >
                      Otwórz organizację
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nowa organizacja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nazwa</Label>
              <Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label>Limit wydarzeń</Label>
              <Input type="number" min="0" value={form.event_limit} onChange={e => setForm(prev => ({ ...prev, event_limit: e.target.value }))} />
            </div>
            {currentRole === 'superadmin' && (
              <div>
                <Label>Administrator organizacji</Label>
                <Select value={form.admin_user_id} onValueChange={value => setForm(prev => ({ ...prev, admin_user_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz admina" />
                  </SelectTrigger>
                  <SelectContent>
                    {admins.map(admin => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              onClick={handleCreate}
              disabled={!form.name || !form.event_limit || (currentRole === 'superadmin' && !form.admin_user_id) || isSubmitting}
            >
              Utwórz organizację
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
