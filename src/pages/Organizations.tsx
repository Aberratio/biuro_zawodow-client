import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';

export default function Organizations() {
  const navigate = useNavigate();
  const { organizations, events, users, currentRole, currentUser, createOrganization, isLoading } = useData();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState({ name: '', event_limit: '1', admin_user_id: '' });
  const admins = users.filter(user => user.role === 'admin');

  const visibleOrganizations = useMemo(() => {
    if (currentRole === 'superadmin') return organizations;
    if (currentRole === 'admin') return organizations.filter(org => (currentUser.organization_ids ?? []).includes(org.id));
    return organizations.filter(org => org.id === currentUser.organization_id);
  }, [currentRole, currentUser, organizations]);

  const shouldShowSearch = visibleOrganizations.length > 5;
  const normalizedQuery = shouldShowSearch ? searchQuery.trim().toLocaleLowerCase('pl-PL') : '';

  const filteredOrganizations = useMemo(() => {
    return visibleOrganizations
      .filter(org => !normalizedQuery || org.name.toLocaleLowerCase('pl-PL').includes(normalizedQuery))
      .map(org => {
        const orgEvents = events.filter(event => event.organization_id === org.id);
        const organizers = users.filter(user => user.organization_id === org.id && user.role === 'editor');
        const scanners = users.filter(user => user.organization_id === org.id && user.role === 'scanner');
        const remainingSlots = Math.max(org.event_limit - orgEvents.length, 0);
        const adminLabel = org.admin_user_name ?? users.find(user => user.id === org.admin_user_id)?.name ?? 'Brak admina';

        return {
          ...org,
          adminLabel,
          eventCount: orgEvents.length,
          organizerCount: organizers.length,
          scannerCount: scanners.length,
          teamCount: organizers.length + scanners.length,
          remainingSlots,
        };
      });
  }, [events, normalizedQuery, users, visibleOrganizations]);

  if (isLoading) return <TableSkeleton rows={8} cols={4} subtitle="" showFilters />;

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
    if (result.entityId) {
      navigate(`/organizations/${result.entityId}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Organizacje</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Lista organizacji. Kliknij wiersz, aby otworzyć szczegóły.
          </p>
        </div>
        {(currentRole === 'admin' || currentRole === 'superadmin') && (
          <Button onClick={() => setOpen(true)} size="sm" className="w-full sm:w-auto sm:self-auto">
            Nowa organizacja
          </Button>
        )}
      </div>

      {visibleOrganizations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div>
              <p className="font-medium">Brak organizacji do wyświetlenia</p>
              <p className="mt-1 text-sm text-muted-foreground">Gdy organizacje będą dostępne, pojawią się tutaj w tabeli.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {shouldShowSearch && (
            <Input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Szukaj po nazwie organizacji..."
              aria-label="Szukaj organizacji"
              className="h-11 sm:h-10 max-w-md"
            />
          )}

          {filteredOrganizations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <p className="font-medium">Nie znaleziono organizacji</p>
                <p className="mt-1 text-sm text-muted-foreground">Spróbuj wpisać inną frazę lub wyczyść wyszukiwanie.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nazwa</TableHead>
                    <TableHead className="hidden md:table-cell">Administrator</TableHead>
                    <TableHead>Wydarzenia</TableHead>
                    <TableHead className="hidden sm:table-cell">Zespół</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
              {filteredOrganizations.map(org => (
                <TableRow
                  key={org.id}
                  className="cursor-pointer active:bg-accent/50"
                  onClick={() => navigate(`/organizations/${org.id}`)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/organizations/${org.id}`);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Otwórz organizację ${org.name}`}
                >
                  <TableCell>
                    <div>
                      <span className="font-medium text-sm">{org.name}</span>
                      <span className="block md:hidden text-xs text-muted-foreground truncate">
                        {org.adminLabel}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {org.adminLabel}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {org.eventCount}/{org.event_limit}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm tabular-nums">
                    {org.teamCount}
                  </TableCell>
                </TableRow>
              ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{filteredOrganizations.length} organizacji</p>
        </>
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
