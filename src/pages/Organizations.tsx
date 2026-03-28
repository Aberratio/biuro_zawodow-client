import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMockData } from '@/contexts/MockDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, ArrowRight, Plus } from 'lucide-react';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

export default function Organizations() {
  const navigate = useNavigate();
  const { organizations, events, users, currentRole, currentUser, createOrganization, isLoading } = useMockData();
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
      toast({ title: 'Nieprawidlowe dane', description: 'Podaj nazwe i poprawny limit wydarzen.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    if (currentRole === 'superadmin' && !form.admin_user_id) {
      toast({ title: 'Brak administratora', description: 'Wybierz admina dla nowej organizacji.', variant: 'destructive' });
      return;
    }

    const result = await createOrganization({
      name: form.name,
      event_limit: parsedLimit,
      admin_user_id: currentRole === 'superadmin' ? form.admin_user_id : undefined,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      toast({ title: 'Nie udalo sie utworzyc organizacji', description: result.error ?? 'Sprobuj ponownie.', variant: 'destructive' });
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
            Przeglad organizacji. Wejdz do wybranej organizacji, aby zobaczyc wydarzenia, zespoly i limity.
          </p>
        </div>
        {(currentRole === 'admin' || currentRole === 'superadmin') && (
          <Button onClick={() => setOpen(true)} size="sm" className="self-start sm:self-auto">
            <Plus className="mr-1 h-4 w-4" /> Nowa organizacja
          </Button>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {visibleOrganizations.map(org => {
          const orgEvents = events.filter(event => event.organization_id === org.id);
          const organizers = users.filter(user => user.organization_id === org.id && user.role === 'editor');
          const scanners = users.filter(user => user.organization_id === org.id && user.role === 'scanner');
          const remainingSlots = Math.max(org.event_limit - orgEvents.length, 0);
          const adminLabel = org.admin_user_name ?? users.find(user => user.id === org.admin_user_id)?.name ?? 'Brak admina';

          return (
            <Card key={org.id} className="overflow-hidden border-border/70 shadow-sm">
              <CardHeader className="border-b bg-muted/30">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{org.name}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">Podsumowanie organizacji i dostepnych zasobow.</p>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-3">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{orgEvents.length}/{org.event_limit} wydarzen</Badge>
                  <Badge variant="outline">{remainingSlots} wolnych miejsc</Badge>
                  <Badge variant="outline">{organizers.length} organizatorow</Badge>
                  <Badge variant="outline">{scanners.length} skanerow</Badge>
                </div>
                <div className="rounded-xl border bg-background px-4 py-3 text-sm">
                  <div className="font-medium">Administrator organizacji</div>
                  <div className="text-muted-foreground">{adminLabel}</div>
                </div>
                <div className="rounded-xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                  Kliknij ponizej, aby wejsc do srodka organizacji i zarzadzac szczegolami.
                </div>
                <Button className="w-full justify-between" variant="outline" onClick={() => navigate(`/organizations/${org.id}`)}>
                  Wejdz do organizacji
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>Nowa organizacja</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nazwa</Label><Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} /></div>
            <div><Label>Limit wydarzen</Label><Input type="number" min="0" value={form.event_limit} onChange={e => setForm(prev => ({ ...prev, event_limit: e.target.value }))} /></div>
            {currentRole === 'superadmin' && (
              <div>
                <Label>Administrator organizacji</Label>
                <Select value={form.admin_user_id} onValueChange={value => setForm(prev => ({ ...prev, admin_user_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz admina" />
                  </SelectTrigger>
                  <SelectContent>
                    {admins.map(admin => (
                      <SelectItem key={admin.id} value={admin.id}>{admin.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={!form.name || !form.event_limit || (currentRole === 'superadmin' && !form.admin_user_id) || isSubmitting}>Utworz organizacje</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
